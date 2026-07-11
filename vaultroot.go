package main

import (
	"os"

	"github.com/derossimolina/arya/internal/config"
	"github.com/derossimolina/arya/internal/vault"
)

// currentVaultRoot loads the configured vault path fresh (no caching) and
// verifies it still exists on disk, returning vault.ErrRootMissing
// otherwise. Shared by NotesService and SchemaService.
func currentVaultRoot() (string, error) {
	cfg, err := config.Load()
	if err != nil {
		return "", err
	}
	if cfg.VaultPath == "" {
		return "", vault.ErrRootMissing
	}
	if _, err := os.Stat(cfg.VaultPath); err != nil {
		return "", vault.ErrRootMissing
	}
	return cfg.VaultPath, nil
}
