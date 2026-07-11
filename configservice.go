package main

import (
	"context"

	"github.com/derossimolina/arya/internal/config"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ConfigService exposes Arya's app-level settings (currently just the vault
// root path) to the frontend.
type ConfigService struct {
	ctx context.Context
}

func NewConfigService() *ConfigService {
	return &ConfigService{}
}

func (s *ConfigService) startup(ctx context.Context) {
	s.ctx = ctx
}

// GetVaultPath returns the configured vault path, or "" if none is set yet.
func (s *ConfigService) GetVaultPath() (string, error) {
	cfg, err := config.Load()
	if err != nil {
		return "", err
	}
	return cfg.VaultPath, nil
}

// ChooseVaultPath opens a native folder picker and persists the choice.
// Returns "" (with no error) if the user cancels the dialog.
func (s *ConfigService) ChooseVaultPath() (string, error) {
	path, err := runtime.OpenDirectoryDialog(s.ctx, runtime.OpenDialogOptions{
		Title:                "Escolha a pasta do seu vault Arya",
		CanCreateDirectories: true,
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	if err := config.Save(config.Config{VaultPath: path}); err != nil {
		return "", err
	}
	return path, nil
}
