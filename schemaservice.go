package main

import "github.com/derossimolina/arya/internal/schema"

// SchemaService exposes the vault's user-defined type/schema system to the
// frontend. Like NotesService, it reloads the vault config fresh on every
// call rather than caching a manager instance.
type SchemaService struct{}

func NewSchemaService() *SchemaService {
	return &SchemaService{}
}

func (s *SchemaService) currentManager() (*schema.Manager, error) {
	root, err := currentVaultRoot()
	if err != nil {
		return nil, err
	}
	mgr := schema.NewManager(root)
	if _, err := mgr.EnsureSeeded(); err != nil {
		return nil, err
	}
	return mgr, nil
}

func (s *SchemaService) ListSchemas() ([]schema.LoadedSchema, error) {
	mgr, err := s.currentManager()
	if err != nil {
		return nil, err
	}
	return mgr.List()
}

func (s *SchemaService) GetSchema(id string) (schema.Schema, error) {
	mgr, err := s.currentManager()
	if err != nil {
		return schema.Schema{}, err
	}
	return mgr.Get(id)
}

func (s *SchemaService) ResolveSchema(id string) (schema.Schema, error) {
	mgr, err := s.currentManager()
	if err != nil {
		return schema.Schema{}, err
	}
	return mgr.Resolve(id)
}

func (s *SchemaService) SaveSchema(sc schema.Schema) error {
	mgr, err := s.currentManager()
	if err != nil {
		return err
	}
	return mgr.Save(sc)
}

func (s *SchemaService) DeleteSchema(id string) error {
	mgr, err := s.currentManager()
	if err != nil {
		return err
	}
	return mgr.Delete(id)
}

func (s *SchemaService) ListKinds() ([]schema.KindMeta, error) {
	return schema.DefaultRegistry.All(), nil
}
