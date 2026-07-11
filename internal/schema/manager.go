package schema

import (
	"embed"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

//go:embed seeds/*.yaml
var seedFS embed.FS

// LoadedSchema is one schema file as read from disk, with any parse/
// validation error attached instead of failing the whole listing.
type LoadedSchema struct {
	ID     string `json:"id"`
	Schema Schema `json:"schema"`
	Error  string `json:"error,omitempty"`
}

// Manager reads/writes schema YAML files under a vault's _schemas/ folder.
type Manager struct {
	dir string
}

func NewManager(vaultRoot string) *Manager {
	return &Manager{dir: filepath.Join(vaultRoot, "_schemas")}
}

func (m *Manager) path(id string) string {
	return filepath.Join(m.dir, id+".yaml")
}

// List reads every *.yaml file in _schemas/. A malformed or invalid file is
// still included, with Error set, instead of failing the whole call.
func (m *Manager) List() ([]LoadedSchema, error) {
	entries, err := os.ReadDir(m.dir)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var out []LoadedSchema
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".yaml") {
			continue
		}

		stem := strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
		loaded := LoadedSchema{ID: stem}

		data, err := os.ReadFile(filepath.Join(m.dir, entry.Name()))
		if err != nil {
			loaded.Error = err.Error()
			out = append(out, loaded)
			continue
		}

		s, err := Parse(data)
		if err != nil {
			loaded.Error = err.Error()
			out = append(out, loaded)
			continue
		}
		if s.ID == "" {
			s.ID = stem
		}

		if err := s.Validate(); err != nil {
			loaded.Error = err.Error()
		}
		loaded.Schema = s
		out = append(out, loaded)
	}

	return out, nil
}

// ErrNotFound is returned by Get (and thus Resolve) when no schema file
// exists for the given id, so callers can distinguish "not created yet"
// from other I/O errors and offer to create it.
var ErrNotFound = errors.New("schema: not found")

// Get returns the raw, unmerged schema for id (for the edit form). It does
// not apply `extends`.
func (m *Manager) Get(id string) (Schema, error) {
	data, err := os.ReadFile(m.path(id))
	if os.IsNotExist(err) {
		return Schema{}, ErrNotFound
	}
	if err != nil {
		return Schema{}, err
	}

	s, err := Parse(data)
	if err != nil {
		return Schema{}, err
	}
	if s.ID == "" {
		s.ID = id
	}
	return s, nil
}

// Save validates and writes a schema to <dir>/<id>.yaml atomically.
func (m *Manager) Save(s Schema) error {
	if err := s.Validate(); err != nil {
		return err
	}

	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		return err
	}

	data, err := Serialize(s)
	if err != nil {
		return err
	}

	dest := m.path(s.ID)
	tmp := dest + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, dest)
}

func (m *Manager) Delete(id string) error {
	return os.Remove(m.path(id))
}

// EnsureSeeded copies the built-in starter types into _schemas/ the first
// time it doesn't exist yet. It never re-seeds afterwards, including if the
// user later deletes some or all of the starter types — the directory's
// mere existence is the one-time bootstrap sentinel.
func (m *Manager) EnsureSeeded() (bool, error) {
	if info, err := os.Stat(m.dir); err == nil {
		if !info.IsDir() {
			return false, nil
		}
		return false, nil
	} else if !os.IsNotExist(err) {
		return false, err
	}

	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		return false, err
	}

	entries, err := seedFS.ReadDir("seeds")
	if err != nil {
		return false, err
	}

	for _, entry := range entries {
		data, err := seedFS.ReadFile("seeds/" + entry.Name())
		if err != nil {
			return false, err
		}
		if err := os.WriteFile(filepath.Join(m.dir, entry.Name()), data, 0o644); err != nil {
			return false, err
		}
	}

	return true, nil
}
