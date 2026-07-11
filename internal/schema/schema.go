// Package schema implements Arya's user-defined type system: YAML files
// under a vault's _schemas/ folder describe object types, each with a set
// of typed properties. The set of property "kinds" is closed and lives in
// code (Registry below); the types themselves are 100% user data.
package schema

import (
	"errors"
	"fmt"
	"regexp"
)

type Kind string

const (
	KindText        Kind = "text"
	KindNumber      Kind = "number"
	KindDate        Kind = "date"
	KindSelect      Kind = "select"
	KindMultiSelect Kind = "multi_select"
	KindCheckbox    Kind = "checkbox"
	KindRelation    Kind = "relation"
	KindFile        Kind = "file"
	KindURL         Kind = "url"
)

// KindMeta describes one property kind for display in the schema-authoring UI.
type KindMeta struct {
	Kind  Kind   `json:"kind"`
	Label string `json:"label"`
}

// Registry is a lookup over the known property kinds. It's a struct (not a
// bare package-level map) so a future third-party plugin system has a seam
// to register additional kinds at runtime without an API break; no such
// registration API exists yet.
type Registry struct {
	kinds []KindMeta
}

func NewRegistry() *Registry {
	return &Registry{kinds: []KindMeta{
		{KindText, "Texto"},
		{KindNumber, "Número"},
		{KindDate, "Data"},
		{KindSelect, "Seleção única"},
		{KindMultiSelect, "Seleção múltipla"},
		{KindCheckbox, "Caixa de seleção"},
		{KindRelation, "Relação"},
		{KindFile, "Arquivo"},
		{KindURL, "URL"},
	}}
}

func (r *Registry) Has(k Kind) bool {
	for _, m := range r.kinds {
		if m.Kind == k {
			return true
		}
	}
	return false
}

// All returns the known kinds in a stable order (suitable for a UI dropdown).
func (r *Registry) All() []KindMeta {
	out := make([]KindMeta, len(r.kinds))
	copy(out, r.kinds)
	return out
}

var DefaultRegistry = NewRegistry()

// Property is one field a Schema declares.
type Property struct {
	Key          string      `yaml:"key" json:"key"`
	Label        string      `yaml:"label" json:"label"`
	Kind         Kind        `yaml:"kind" json:"kind"`
	Required     bool        `yaml:"required,omitempty" json:"required,omitempty"`
	Options      []string    `yaml:"options,omitempty" json:"options,omitempty"`
	Default      interface{} `yaml:"default,omitempty" json:"default,omitempty"`
	RelationType string      `yaml:"relation_type,omitempty" json:"relationType,omitempty"`
	Multiple     bool        `yaml:"multiple,omitempty" json:"multiple,omitempty"`
}

// View describes a saved way of looking at all notes of a type. Parsed and
// round-tripped as data only in this slice — no UI renders it yet (needs
// the SQLite index from a later slice to query "all notes of type X").
type View struct {
	Name    string   `yaml:"name" json:"name"`
	Type    string   `yaml:"type" json:"type"`
	GroupBy string   `yaml:"group_by,omitempty" json:"groupBy,omitempty"`
	Columns []string `yaml:"columns,omitempty" json:"columns,omitempty"`
}

// Schema is one user-defined object type.
type Schema struct {
	ID         string     `yaml:"id" json:"id"`
	Name       string     `yaml:"name" json:"name"`
	Icon       string     `yaml:"icon,omitempty" json:"icon,omitempty"`
	Color      string     `yaml:"color,omitempty" json:"color,omitempty"`
	Extends    string     `yaml:"extends,omitempty" json:"extends,omitempty"`
	Properties []Property `yaml:"properties,omitempty" json:"properties,omitempty"`
	Views      []View     `yaml:"views,omitempty" json:"views,omitempty"`
	Template   string     `yaml:"template,omitempty" json:"template,omitempty"`
}

var propertyKeyPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

var (
	ErrMissingID    = errors.New("schema: id is required")
	ErrMissingName  = errors.New("schema: name is required")
	ErrDuplicateKey = errors.New("schema: duplicate property key")
	ErrInvalidKey   = errors.New("schema: invalid property key")
	ErrUnknownKind  = errors.New("schema: unknown property kind")
)

// Validate checks structural invariants that must hold regardless of the
// registry used to resolve kinds (DefaultRegistry in production, a fake one
// in tests).
func (s Schema) Validate() error {
	return s.ValidateWithRegistry(DefaultRegistry)
}

func (s Schema) ValidateWithRegistry(r *Registry) error {
	if s.ID == "" {
		return ErrMissingID
	}
	if s.Name == "" {
		return ErrMissingName
	}

	seen := make(map[string]bool, len(s.Properties))
	for _, p := range s.Properties {
		if !propertyKeyPattern.MatchString(p.Key) {
			return fmt.Errorf("%w: %q", ErrInvalidKey, p.Key)
		}
		if seen[p.Key] {
			return fmt.Errorf("%w: %q", ErrDuplicateKey, p.Key)
		}
		seen[p.Key] = true

		if !r.Has(p.Kind) {
			return fmt.Errorf("%w: %q", ErrUnknownKind, p.Kind)
		}
	}

	return nil
}
