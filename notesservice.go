package main

import (
	"github.com/derossimolina/arya/internal/schema"
	"github.com/derossimolina/arya/internal/vault"
)

// NotesService exposes vault file operations (tree, read/save notes, create
// folders/notes) to the frontend. It reloads the vault config on every call
// instead of caching it, so a mid-session vault change is always picked up.
type NotesService struct{}

func NewNotesService() *NotesService {
	return &NotesService{}
}

func (s *NotesService) currentVault() (*vault.Vault, error) {
	root, err := currentVaultRoot()
	if err != nil {
		return nil, err
	}
	return vault.New(root), nil
}

func (s *NotesService) Tree() (vault.Node, error) {
	v, err := s.currentVault()
	if err != nil {
		return vault.Node{}, err
	}
	return v.Tree()
}

func (s *NotesService) ReadNote(path string) (vault.Note, error) {
	v, err := s.currentVault()
	if err != nil {
		return vault.Note{}, err
	}
	return v.ReadNote(path)
}

func (s *NotesService) SaveNote(path string, content string) error {
	v, err := s.currentVault()
	if err != nil {
		return err
	}
	return v.SaveNote(path, content)
}

// SaveNoteStructured saves a typed note's edited frontmatter + body. See
// vault.ComposeNote for the YAML-canonicalization trade-off this implies.
func (s *NotesService) SaveNoteStructured(path string, frontmatter map[string]interface{}, body string) error {
	v, err := s.currentVault()
	if err != nil {
		return err
	}
	return v.SaveNoteStructured(path, frontmatter, body)
}

func (s *NotesService) CreateFolder(parentPath string, name string) (string, error) {
	v, err := s.currentVault()
	if err != nil {
		return "", err
	}
	return v.CreateFolder(parentPath, name)
}

// CreateNote creates a note. If typeID is empty, it uses the plain fixed
// template (today's behavior). Otherwise it resolves the schema (applying
// `extends`), builds the initial frontmatter + renders the schema's
// template, and creates the note with that composed content.
func (s *NotesService) CreateNote(parentPath string, title string, typeID string) (string, error) {
	root, err := currentVaultRoot()
	if err != nil {
		return "", err
	}
	v := vault.New(root)

	if typeID == "" {
		return v.CreateNote(parentPath, title)
	}

	resolved, err := schema.NewManager(root).Resolve(typeID)
	if err != nil {
		return "", err
	}

	frontmatter := schema.BuildFrontmatter(resolved, title)
	body := schema.RenderTemplate(resolved.Template, title)
	content, err := vault.ComposeNote(frontmatter, body)
	if err != nil {
		return "", err
	}
	return v.CreateNoteWithContent(parentPath, title, content)
}
