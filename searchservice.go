package main

import (
	"github.com/derossimolina/arya/internal/index"
	"github.com/derossimolina/arya/internal/vault"
)

// SearchService exposes full-text search over every note in the vault
// (typed or not) to the frontend. Like the other services, it rebuilds its
// index fresh from disk on every call — see internal/index/search.go's doc
// comment.
type SearchService struct{}

func NewSearchService() *SearchService {
	return &SearchService{}
}

func (s *SearchService) Search(query string) ([]index.SearchResult, error) {
	root, err := currentVaultRoot()
	if err != nil {
		return nil, err
	}

	idx, err := index.BuildSearchIndex(vault.New(root))
	if err != nil {
		return nil, err
	}
	defer idx.Close()

	return idx.Search(query, 20)
}
