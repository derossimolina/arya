package main

import (
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
