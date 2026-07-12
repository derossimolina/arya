package index

import (
	"database/sql"
	"strings"

	_ "modernc.org/sqlite"

	"github.com/derossimolina/arya/internal/vault"
)

// SearchIndex is a full-text index over every note in a vault, regardless of
// whether it has a `type` — unlike Index (which only covers typed objects),
// this exists so a note never becomes unreachable just because it has no
// schema. Same "rebuild fresh, never persist" discipline as Index.
type SearchIndex struct {
	db *sql.DB
}

// SearchResult is one match: the note's path/title plus an FTS5-generated
// snippet of the matching text, with <mark>...</mark> around the hit.
type SearchResult struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

const searchSchemaDDL = `
CREATE VIRTUAL TABLE notes_fts USING fts5(path UNINDEXED, title, body, tokenize='trigram');
`

// BuildSearchIndex walks every note in v (no type filter) and indexes its
// title and body text. Notes with a frontmatter parse error are skipped —
// there is nothing reliable to show as a title/snippet for them.
func BuildSearchIndex(v *vault.Vault) (*SearchIndex, error) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return nil, err
	}

	if _, err := db.Exec(searchSchemaDDL); err != nil {
		db.Close()
		return nil, err
	}

	idx := &SearchIndex{db: db}

	root, err := v.Tree()
	if err != nil {
		idx.Close()
		return nil, err
	}

	err = WalkNotes(v, root, func(path string, note vault.Note) error {
		if note.FrontmatterError != "" {
			return nil
		}
		title, _ := note.Frontmatter["title"].(string)
		if title == "" {
			title = path
		}
		_, err := idx.db.Exec(
			`INSERT INTO notes_fts (path, title, body) VALUES (?, ?, ?)`,
			path, title, note.Body,
		)
		return err
	})
	if err != nil {
		idx.Close()
		return nil, err
	}

	return idx, nil
}

// Search returns up to limit notes whose title or body match query, ranked
// by FTS5's default bm25 ordering, each with a highlighted snippet of the
// matching body text. The query is wrapped as a single literal phrase so
// that FTS5 query-syntax characters in user input (", *, ^, :) never cause a
// MATCH syntax error — trigram tokenization still matches substrings within
// a quoted phrase.
func (idx *SearchIndex) Search(query string, limit int) ([]SearchResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []SearchResult{}, nil
	}
	if limit <= 0 {
		limit = 20
	}

	phrase := `"` + strings.ReplaceAll(query, `"`, `""`) + `"`

	// Column -1 lets FTS5 pick whichever column (title or body) best matched,
	// instead of a fixed column that would show an unhighlighted snippet
	// whenever the match was only in the other column.
	rows, err := idx.db.Query(
		`SELECT path, title, snippet(notes_fts, -1, '<mark>', '</mark>', '…', 8)
		 FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT ?`,
		phrase, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []SearchResult{}
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.Path, &r.Title, &r.Snippet); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Close releases the in-memory database.
func (idx *SearchIndex) Close() error {
	return idx.db.Close()
}
