package index

import (
	"strings"
	"testing"

	"github.com/derossimolina/arya/internal/vault"
)

func TestBuildSearchIndex_FindsUntypedAndTypedNotes(t *testing.T) {
	dir := t.TempDir()
	writeNote(t, dir, "reuniao.md", "---\ntitle: \"Reunião Trimestral\"\n---\n\nDiscutimos o orçamento do próximo trimestre.\n")
	writeNote(t, dir, "paper1.md", "---\ntype: paper\ntitle: \"Paper Um\"\n---\n\nConteúdo sobre redes neurais.\n")
	writeNote(t, dir, "sem-titulo.md", "---\n---\n\nNada de especial aqui.\n")

	v := vault.New(dir)
	idx, err := BuildSearchIndex(v)
	if err != nil {
		t.Fatalf("BuildSearchIndex: %v", err)
	}
	defer idx.Close()

	results, err := idx.Search("trimestral", 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result for 'trimestral', got %d: %+v", len(results), results)
	}
	if results[0].Path != "reuniao.md" {
		t.Errorf("path = %q, want %q", results[0].Path, "reuniao.md")
	}
	if results[0].Title != "Reunião Trimestral" {
		t.Errorf("title = %q, want %q", results[0].Title, "Reunião Trimestral")
	}
	if !strings.Contains(results[0].Snippet, "<mark>") {
		t.Errorf("snippet %q should contain a <mark> highlight", results[0].Snippet)
	}

	results, err = idx.Search("neurais", 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(results) != 1 || results[0].Path != "paper1.md" {
		t.Fatalf("expected paper1.md for 'neurais', got %+v", results)
	}

	results, err = idx.Search("especial", 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(results) != 1 || results[0].Path != "sem-titulo.md" {
		t.Fatalf("expected sem-titulo.md (untyped, titleless note still searchable), got %+v", results)
	}
	if results[0].Title != "sem-titulo.md" {
		t.Errorf("title should fall back to path when frontmatter has none, got %q", results[0].Title)
	}
}

func TestSearch_NoMatch_ReturnsEmptyNotNil(t *testing.T) {
	dir := t.TempDir()
	writeNote(t, dir, "nota.md", "---\ntitle: \"Nota\"\n---\n\nConteúdo qualquer.\n")

	v := vault.New(dir)
	idx, err := BuildSearchIndex(v)
	if err != nil {
		t.Fatalf("BuildSearchIndex: %v", err)
	}
	defer idx.Close()

	results, err := idx.Search("inexistente-xyz", 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if results == nil {
		t.Fatal("expected non-nil empty slice")
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(results))
	}
}

func TestSearch_QuerySyntaxCharactersDoNotError(t *testing.T) {
	dir := t.TempDir()
	writeNote(t, dir, "nota.md", "---\ntitle: \"Nota\"\n---\n\nConteúdo qualquer.\n")

	v := vault.New(dir)
	idx, err := BuildSearchIndex(v)
	if err != nil {
		t.Fatalf("BuildSearchIndex: %v", err)
	}
	defer idx.Close()

	for _, q := range []string{`"quotes"`, "star*", "^caret", "colon:value"} {
		if _, err := idx.Search(q, 10); err != nil {
			t.Errorf("Search(%q) returned error, want none: %v", q, err)
		}
	}
}

func TestSearch_EmptyQuery_ReturnsEmptyNotNil(t *testing.T) {
	dir := t.TempDir()
	v := vault.New(dir)
	idx, err := BuildSearchIndex(v)
	if err != nil {
		t.Fatalf("BuildSearchIndex: %v", err)
	}
	defer idx.Close()

	results, err := idx.Search("   ", 10)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if results == nil || len(results) != 0 {
		t.Fatalf("expected non-nil empty slice, got %+v", results)
	}
}
