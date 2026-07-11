package index

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/derossimolina/arya/internal/vault"
)

func writeNote(t *testing.T, dir, path, content string) {
	t.Helper()
	abs := filepath.Join(dir, path)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(abs, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestBuildFromVault_QueryByType(t *testing.T) {
	dir := t.TempDir()
	writeNote(t, dir, "paper1.md", "---\ntype: paper\ntitle: \"Paper Um\"\nstatus: rascunho\n---\n\nCorpo.\n")
	writeNote(t, dir, "sub/paper2.md", "---\ntype: paper\ntitle: \"Paper Dois\"\nstatus: publicado\n---\n\nCorpo.\n")
	writeNote(t, dir, "pessoa1.md", "---\ntype: pessoa\ntitle: \"Fulano\"\n---\n\nCorpo.\n")
	writeNote(t, dir, "sem-tipo.md", "---\ntitle: \"Sem Tipo\"\n---\n\nCorpo.\n")

	v := vault.New(dir)
	idx, err := BuildFromVault(v, map[string]bool{"paper": true, "pessoa": true})
	if err != nil {
		t.Fatalf("BuildFromVault: %v", err)
	}
	defer idx.Close()

	rows, err := idx.QueryByType("paper")
	if err != nil {
		t.Fatalf("QueryByType: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 paper rows, got %d", len(rows))
	}

	byPath := map[string]ObjectRow{}
	for _, r := range rows {
		byPath[r.Path] = r
	}

	p1, ok := byPath["paper1.md"]
	if !ok {
		t.Fatalf("paper1.md missing from results")
	}
	if p1.Title != "Paper Um" {
		t.Errorf("paper1 title = %q, want %q", p1.Title, "Paper Um")
	}
	if p1.Properties["status"] != "rascunho" {
		t.Errorf("paper1 status = %q, want %q", p1.Properties["status"], "rascunho")
	}

	p2, ok := byPath["sub/paper2.md"]
	if !ok {
		t.Fatalf("sub/paper2.md missing from results")
	}
	if p2.Properties["status"] != "publicado" {
		t.Errorf("paper2 status = %q, want %q", p2.Properties["status"], "publicado")
	}
}

func TestBuildFromVault_SkipsUntypedAndUnknownTypeAndMalformed(t *testing.T) {
	dir := t.TempDir()
	writeNote(t, dir, "sem-tipo.md", "---\ntitle: \"Sem Tipo\"\n---\n\nCorpo.\n")
	writeNote(t, dir, "tipo-desconhecido.md", "---\ntype: fantasma\ntitle: \"Fantasma\"\n---\n\nCorpo.\n")
	writeNote(t, dir, "malformado.md", "---\ntype: paper\ntitle: \"unterminated\n---\n\nCorpo.\n")

	v := vault.New(dir)
	idx, err := BuildFromVault(v, map[string]bool{"paper": true})
	if err != nil {
		t.Fatalf("BuildFromVault: %v", err)
	}
	defer idx.Close()

	rows, err := idx.QueryByType("paper")
	if err != nil {
		t.Fatalf("QueryByType: %v", err)
	}
	if len(rows) != 0 {
		t.Fatalf("expected 0 paper rows (untyped/unknown-type/malformed all skipped), got %d: %+v", len(rows), rows)
	}
}

func TestQueryByType_NoMatches_ReturnsEmptyNotNil(t *testing.T) {
	dir := t.TempDir()
	v := vault.New(dir)
	idx, err := BuildFromVault(v, map[string]bool{"paper": true})
	if err != nil {
		t.Fatalf("BuildFromVault: %v", err)
	}
	defer idx.Close()

	rows, err := idx.QueryByType("paper")
	if err != nil {
		t.Fatalf("QueryByType: %v", err)
	}
	if rows == nil {
		t.Fatal("expected non-nil empty slice")
	}
	if len(rows) != 0 {
		t.Fatalf("expected 0 rows, got %d", len(rows))
	}
}
