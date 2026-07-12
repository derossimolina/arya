package main

import (
	"strings"

	"github.com/derossimolina/arya/internal/index"
	"github.com/derossimolina/arya/internal/schema"
	"github.com/derossimolina/arya/internal/vault"
)

// IndexService exposes read-only queries over a vault-wide SQLite index of
// typed notes to the frontend (table/kanban views). Like the other
// services, it reloads the vault fresh on every call — here that also means
// rebuilding the in-memory index from disk every time, since the index is a
// pure cache, never the source of truth (see internal/index doc comment).
type IndexService struct{}

func NewIndexService() *IndexService {
	return &IndexService{}
}

func (s *IndexService) QueryByType(typeID string) ([]index.ObjectRow, error) {
	root, err := currentVaultRoot()
	if err != nil {
		return nil, err
	}

	loaded, err := schema.NewManager(root).List()
	if err != nil {
		return nil, err
	}
	validTypes := make(map[string]bool, len(loaded))
	for _, ls := range loaded {
		if ls.Error == "" {
			validTypes[ls.ID] = true
		}
	}

	idx, err := index.BuildFromVault(vault.New(root), validTypes)
	if err != nil {
		return nil, err
	}
	defer idx.Close()

	return idx.QueryByType(typeID)
}

// ResolveNoteTitle finds the path of the first note whose frontmatter
// `title` matches the given text (case-insensitive). Returns "" (not an
// error) when no note matches — used to turn a `[[title]]` wikilink token
// back into a clickable reference when a note is loaded into the block
// editor. Notes with a frontmatter parse error are skipped, same as every
// other vault-wide scan in this package.
func (s *IndexService) ResolveNoteTitle(title string) (string, error) {
	root, err := currentVaultRoot()
	if err != nil {
		return "", err
	}

	v := vault.New(root)
	tree, err := v.Tree()
	if err != nil {
		return "", err
	}

	var found string
	err = index.WalkNotes(v, tree, func(path string, note vault.Note) error {
		if found != "" || note.FrontmatterError != "" {
			return nil
		}
		noteTitle, _ := note.Frontmatter["title"].(string)
		if strings.EqualFold(noteTitle, title) {
			found = path
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	return found, nil
}
