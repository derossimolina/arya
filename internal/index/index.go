// Package index builds a queryable, in-memory SQLite view over a vault's
// notes. It is a pure cache derived from the files on disk — never the
// source of truth — so it is rebuilt from scratch on every use instead of
// being persisted or updated incrementally. See CLAUDE.md's "Índice local:
// SQLite" section for the schema this mirrors (minus the links/tasks
// tables, which belong to later slices).
package index

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"

	"github.com/derossimolina/arya/internal/vault"
)

// Index is a built, queryable snapshot of a vault. Callers must Close it
// when done.
type Index struct {
	db *sql.DB
}

// ObjectRow is one indexed note: its identity plus every frontmatter key
// (other than "type"/"title") as a string, keyed by property key.
type ObjectRow struct {
	Path       string            `json:"path"`
	Type       string            `json:"type"`
	Title      string            `json:"title"`
	Properties map[string]string `json:"properties"`
}

const schemaDDL = `
CREATE TABLE objects (
	id    TEXT PRIMARY KEY,
	type  TEXT,
	title TEXT
);
CREATE TABLE properties (
	object_id TEXT,
	key       TEXT,
	value     TEXT
);
CREATE INDEX idx_objects_type ON objects(type);
CREATE INDEX idx_properties_object_id ON properties(object_id);
`

// BuildFromVault walks every note in v and indexes the ones whose
// frontmatter `type` is present in validTypes. Notes with no type, an
// unresolvable type, or a frontmatter parse error are silently skipped —
// that is not a build failure, just an unindexed note.
func BuildFromVault(v *vault.Vault, validTypes map[string]bool) (*Index, error) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return nil, err
	}

	if _, err := db.Exec(schemaDDL); err != nil {
		db.Close()
		return nil, err
	}

	idx := &Index{db: db}

	root, err := v.Tree()
	if err != nil {
		idx.Close()
		return nil, err
	}

	err = WalkNotes(v, root, func(path string, note vault.Note) error {
		return idx.indexNote(path, note, validTypes)
	})
	if err != nil {
		idx.Close()
		return nil, err
	}

	return idx, nil
}

// WalkNotes visits every note reachable from root (recursing into folders),
// reading each one and invoking fn with its path and parsed content. It is
// shared by every package that needs to scan a whole vault once per call
// (this package's type index, the full-text search index, and later the
// tasks/blocks indexes) instead of each re-implementing the same tree
// recursion + ReadNote calls.
func WalkNotes(v *vault.Vault, root vault.Node, fn func(path string, note vault.Note) error) error {
	if root.Type == vault.NodeNote {
		note, err := v.ReadNote(root.Path)
		if err != nil {
			return err
		}
		return fn(root.Path, note)
	}
	for _, child := range root.Children {
		if err := WalkNotes(v, child, fn); err != nil {
			return err
		}
	}
	return nil
}

func (idx *Index) indexNote(path string, note vault.Note, validTypes map[string]bool) error {
	if note.FrontmatterError != "" {
		return nil
	}

	typeID, _ := note.Frontmatter["type"].(string)
	if typeID == "" || !validTypes[typeID] {
		return nil
	}

	title, _ := note.Frontmatter["title"].(string)

	if _, err := idx.db.Exec(
		`INSERT INTO objects (id, type, title) VALUES (?, ?, ?)`,
		path, typeID, title,
	); err != nil {
		return err
	}

	for key, value := range note.Frontmatter {
		if key == "type" || key == "title" {
			continue
		}
		if _, err := idx.db.Exec(
			`INSERT INTO properties (object_id, key, value) VALUES (?, ?, ?)`,
			path, key, fmt.Sprintf("%v", value),
		); err != nil {
			return err
		}
	}

	return nil
}

// QueryByType returns every indexed object of the given type, each with its
// properties map populated.
func (idx *Index) QueryByType(typeID string) ([]ObjectRow, error) {
	rows, err := idx.db.Query(`SELECT id, type, title FROM objects WHERE type = ? ORDER BY title`, typeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byID := make(map[string]*ObjectRow)
	var order []string
	for rows.Next() {
		var o ObjectRow
		if err := rows.Scan(&o.Path, &o.Type, &o.Title); err != nil {
			return nil, err
		}
		o.Properties = map[string]string{}
		byID[o.Path] = &o
		order = append(order, o.Path)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(order) == 0 {
		return []ObjectRow{}, nil
	}

	propRows, err := idx.db.Query(
		`SELECT object_id, key, value FROM properties WHERE object_id IN (SELECT id FROM objects WHERE type = ?)`,
		typeID,
	)
	if err != nil {
		return nil, err
	}
	defer propRows.Close()

	for propRows.Next() {
		var objectID, key, value string
		if err := propRows.Scan(&objectID, &key, &value); err != nil {
			return nil, err
		}
		if o, ok := byID[objectID]; ok {
			o.Properties[key] = value
		}
	}
	if err := propRows.Err(); err != nil {
		return nil, err
	}

	out := make([]ObjectRow, 0, len(order))
	for _, path := range order {
		out = append(out, *byID[path])
	}
	return out, nil
}

// Close releases the in-memory database.
func (idx *Index) Close() error {
	return idx.db.Close()
}
