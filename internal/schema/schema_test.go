package schema

import "testing"

const paperYAML = `
id: paper
name: "Artigo Acadêmico"
icon: "📄"
color: "#4A90D9"
extends: null
properties:
  - key: status
    label: "Status"
    kind: select
    required: true
    options: ["rascunho", "submetido", "aceito", "publicado"]
    default: "rascunho"
  - key: autores
    label: "Autores"
    kind: relation
    relation_type: pessoa
    multiple: true
  - key: revisado
    label: "Revisado"
    kind: checkbox
    default: false
views:
  - name: "Por Status"
    type: kanban
    group_by: status
  - name: "Tabela Geral"
    type: table
    columns: [status, venue, data_submissao]
template: |
  # {{title}}
  ## Resumo
  ## Notas
`

func TestParse_PaperExample(t *testing.T) {
	s, err := Parse([]byte(paperYAML))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	if s.ID != "paper" || s.Name != "Artigo Acadêmico" {
		t.Fatalf("unexpected id/name: %+v", s)
	}
	if s.Extends != "" {
		t.Errorf("Extends = %q, want empty (extends: null)", s.Extends)
	}
	if len(s.Properties) != 3 {
		t.Fatalf("expected 3 properties, got %d", len(s.Properties))
	}

	status := s.Properties[0]
	if status.Kind != KindSelect || !status.Required || status.Default != "rascunho" {
		t.Errorf("status property mismatch: %+v", status)
	}
	if len(status.Options) != 4 {
		t.Errorf("expected 4 options, got %d", len(status.Options))
	}

	autores := s.Properties[1]
	if autores.Kind != KindRelation || autores.RelationType != "pessoa" || !autores.Multiple {
		t.Errorf("autores property mismatch: %+v", autores)
	}

	if len(s.Views) != 2 || s.Views[0].Type != "kanban" || s.Views[1].Type != "table" {
		t.Errorf("views mismatch: %+v", s.Views)
	}
	if err := s.Validate(); err != nil {
		t.Errorf("expected valid schema, got: %v", err)
	}
}

func TestParse_MalformedYAML_ReturnsError(t *testing.T) {
	_, err := Parse([]byte("id: [unterminated"))
	if err == nil {
		t.Fatal("expected an error for malformed YAML")
	}
}

func TestValidate_RejectsUnknownKind(t *testing.T) {
	s := Schema{ID: "x", Name: "X", Properties: []Property{{Key: "a", Kind: "not_a_kind"}}}
	if err := s.Validate(); err == nil {
		t.Fatal("expected error for unknown kind")
	}
}

func TestValidate_RejectsDuplicateKey(t *testing.T) {
	s := Schema{ID: "x", Name: "X", Properties: []Property{
		{Key: "a", Kind: KindText},
		{Key: "a", Kind: KindNumber},
	}}
	if err := s.Validate(); err == nil {
		t.Fatal("expected error for duplicate property key")
	}
}

func TestValidate_RejectsMissingIDOrName(t *testing.T) {
	if err := (Schema{Name: "X"}).Validate(); err == nil {
		t.Error("expected error for missing id")
	}
	if err := (Schema{ID: "x"}).Validate(); err == nil {
		t.Error("expected error for missing name")
	}
}

func TestSerializeParse_RoundTrip_AllKinds(t *testing.T) {
	original := Schema{
		ID:   "all-kinds",
		Name: "Todos os Kinds",
		Properties: []Property{
			{Key: "a", Label: "A", Kind: KindText, Default: "x"},
			{Key: "b", Label: "B", Kind: KindNumber, Default: 3},
			{Key: "c", Label: "C", Kind: KindDate},
			{Key: "d", Label: "D", Kind: KindSelect, Options: []string{"um", "dois"}},
			{Key: "e", Label: "E", Kind: KindMultiSelect, Options: []string{"um", "dois"}, Multiple: true},
			{Key: "f", Label: "F", Kind: KindCheckbox, Default: true},
			{Key: "g", Label: "G", Kind: KindRelation, RelationType: "pessoa", Multiple: true},
			{Key: "h", Label: "H", Kind: KindFile},
			{Key: "i", Label: "I", Kind: KindURL},
		},
	}

	data, err := Serialize(original)
	if err != nil {
		t.Fatalf("Serialize: %v", err)
	}

	roundTripped, err := Parse(data)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	if len(roundTripped.Properties) != len(original.Properties) {
		t.Fatalf("property count mismatch: got %d, want %d", len(roundTripped.Properties), len(original.Properties))
	}
	for i, p := range original.Properties {
		if roundTripped.Properties[i].Kind != p.Kind || roundTripped.Properties[i].Key != p.Key {
			t.Errorf("property %d mismatch: got %+v, want %+v", i, roundTripped.Properties[i], p)
		}
	}
}
