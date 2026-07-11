package vault

import (
	"os"
	"path/filepath"
	"testing"
)

func newTestVault(t *testing.T) (*Vault, string) {
	t.Helper()
	dir := t.TempDir()
	return New(dir), dir
}

func TestReadNote_ParsesFrontmatterMap(t *testing.T) {
	v, dir := newTestVault(t)
	content := "---\n" +
		"title: \"Minha Nota\"\n" +
		"done: true\n" +
		"count: 3\n" +
		"---\n\n" +
		"Corpo da nota.\n"
	if err := os.WriteFile(filepath.Join(dir, "nota.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	note, err := v.ReadNote("nota.md")
	if err != nil {
		t.Fatalf("ReadNote: %v", err)
	}
	if note.FrontmatterError != "" {
		t.Fatalf("unexpected FrontmatterError: %s", note.FrontmatterError)
	}
	if note.Frontmatter["title"] != "Minha Nota" {
		t.Errorf("title = %v, want %q", note.Frontmatter["title"], "Minha Nota")
	}
	if note.Frontmatter["done"] != true {
		t.Errorf("done = %v, want true", note.Frontmatter["done"])
	}
	if note.RawContent != content {
		t.Errorf("RawContent mismatch")
	}
}

func TestReadNote_MalformedYAML_ReturnsRawContentAnyway(t *testing.T) {
	v, dir := newTestVault(t)
	content := "---\n" +
		"title: \"unterminated\n" +
		"---\n\nCorpo.\n"
	if err := os.WriteFile(filepath.Join(dir, "ruim.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	note, err := v.ReadNote("ruim.md")
	if err != nil {
		t.Fatalf("ReadNote should not fail on malformed frontmatter: %v", err)
	}
	if note.RawContent != content {
		t.Errorf("RawContent must be preserved even when frontmatter is malformed")
	}
	if note.FrontmatterError == "" {
		t.Errorf("expected FrontmatterError to be set for malformed YAML")
	}
}

func TestReadNote_FrontmatterMustBeFirstLine(t *testing.T) {
	v, dir := newTestVault(t)
	// Leading blank line before the "---" fence: goldmark-meta only
	// recognizes frontmatter starting on line 0, so this must NOT be
	// parsed as frontmatter (empty map, no error).
	content := "\n---\ntitle: \"Nope\"\n---\n\nCorpo.\n"
	if err := os.WriteFile(filepath.Join(dir, "atrasada.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	note, err := v.ReadNote("atrasada.md")
	if err != nil {
		t.Fatalf("ReadNote: %v", err)
	}
	if len(note.Frontmatter) != 0 {
		t.Errorf("expected empty frontmatter map, got %v", note.Frontmatter)
	}
}

func TestSaveNote_RoundTrip_PreservesContent(t *testing.T) {
	v, dir := newTestVault(t)
	path := filepath.Join(dir, "roundtrip.md")
	if err := os.WriteFile(path, []byte("placeholder"), 0o644); err != nil {
		t.Fatal(err)
	}

	content := "---\r\ntitle: \"CRLF\"\r\n---\r\n\r\nLinha 1\r\nLinha 2\r\n"
	if err := v.SaveNote("roundtrip.md", content); err != nil {
		t.Fatalf("SaveNote: %v", err)
	}

	note, err := v.ReadNote("roundtrip.md")
	if err != nil {
		t.Fatalf("ReadNote: %v", err)
	}
	if note.RawContent != content {
		t.Errorf("round trip mismatch: got %q, want %q", note.RawContent, content)
	}
}

func TestTree_OnlyMarkdownAndFolders_SortedFoldersFirst(t *testing.T) {
	v, dir := newTestVault(t)

	mustWrite := func(rel string, content string) {
		abs := filepath.Join(dir, rel)
		if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(abs, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	mustWrite("zeta.md", "z")
	mustWrite("alpha.md", "a")
	mustWrite("Caderno/nested.md", "n")
	mustWrite("ignore.txt", "not markdown")
	if err := os.MkdirAll(filepath.Join(dir, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}

	tree, err := v.Tree()
	if err != nil {
		t.Fatalf("Tree: %v", err)
	}

	if len(tree.Children) != 3 {
		t.Fatalf("expected 3 children (1 folder + 2 notes), got %d: %+v", len(tree.Children), tree.Children)
	}
	if tree.Children[0].Type != NodeFolder || tree.Children[0].Name != "Caderno" {
		t.Errorf("expected folder first, got %+v", tree.Children[0])
	}
	if tree.Children[1].Name != "alpha.md" || tree.Children[2].Name != "zeta.md" {
		t.Errorf("expected notes sorted alphabetically, got %+v then %+v", tree.Children[1], tree.Children[2])
	}
	if len(tree.Children[0].Children) != 1 || tree.Children[0].Children[0].Name != "nested.md" {
		t.Errorf("expected nested note inside Caderno, got %+v", tree.Children[0].Children)
	}
}

func TestTree_ExcludesReservedSchemasFolder(t *testing.T) {
	v, dir := newTestVault(t)

	if err := os.MkdirAll(filepath.Join(dir, "_schemas"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "_schemas", "nota.yaml"), []byte("id: nota"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "nota.md"), []byte("n"), 0o644); err != nil {
		t.Fatal(err)
	}

	tree, err := v.Tree()
	if err != nil {
		t.Fatalf("Tree: %v", err)
	}

	if len(tree.Children) != 1 || tree.Children[0].Name != "nota.md" {
		t.Errorf("expected _schemas/ to be excluded from the tree, got %+v", tree.Children)
	}
}

func TestResolve_RejectsPathTraversalOutsideRoot(t *testing.T) {
	v, _ := newTestVault(t)

	_, err := v.ReadNote("../outside.md")
	if err != ErrPathTraversal {
		t.Errorf("expected ErrPathTraversal, got %v", err)
	}

	_, err = v.ReadNote("sub/../../outside.md")
	if err != ErrPathTraversal {
		t.Errorf("expected ErrPathTraversal, got %v", err)
	}
}

func TestCreateNote_SlugifiesAccentedPortugueseTitles(t *testing.T) {
	v, dir := newTestVault(t)

	relPath, err := v.CreateNote("", "Reunião de Ação")
	if err != nil {
		t.Fatalf("CreateNote: %v", err)
	}
	if relPath != "reuniao-de-acao.md" {
		t.Errorf("relPath = %q, want %q", relPath, "reuniao-de-acao.md")
	}
	if _, err := os.Stat(filepath.Join(dir, "reuniao-de-acao.md")); err != nil {
		t.Errorf("expected file to exist: %v", err)
	}
}

func TestCreateFolder_DuplicateName_ReturnsErrAlreadyExists(t *testing.T) {
	v, _ := newTestVault(t)

	if _, err := v.CreateFolder("", "Trabalho"); err != nil {
		t.Fatalf("first CreateFolder: %v", err)
	}
	if _, err := v.CreateFolder("", "Trabalho"); err != ErrAlreadyExists {
		t.Errorf("expected ErrAlreadyExists, got %v", err)
	}
}

func TestCreateNote_DuplicateTitle_ReturnsErrAlreadyExists(t *testing.T) {
	v, _ := newTestVault(t)

	if _, err := v.CreateNote("", "Duplicada"); err != nil {
		t.Fatalf("first CreateNote: %v", err)
	}
	if _, err := v.CreateNote("", "Duplicada"); err != ErrAlreadyExists {
		t.Errorf("expected ErrAlreadyExists, got %v", err)
	}
}

func TestCreateNoteWithContent_WritesExactContentAndEnforcesGuards(t *testing.T) {
	v, dir := newTestVault(t)

	relPath, err := v.CreateNoteWithContent("", "Com Conteúdo", "---\ntype: tarefa\n---\n\nCorpo.\n")
	if err != nil {
		t.Fatalf("CreateNoteWithContent: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(dir, relPath))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "---\ntype: tarefa\n---\n\nCorpo.\n" {
		t.Errorf("content mismatch: got %q", data)
	}

	if _, err := v.CreateNoteWithContent("", "Com Conteúdo", "outro"); err != ErrAlreadyExists {
		t.Errorf("expected ErrAlreadyExists on duplicate, got %v", err)
	}
	if _, err := v.CreateNoteWithContent("../escape", "X", "y"); err != ErrPathTraversal {
		t.Errorf("expected ErrPathTraversal, got %v", err)
	}
}

func TestSplitFrontmatter_AgreesWithParseFrontmatterOnFenceDetection(t *testing.T) {
	cases := []struct {
		name      string
		content   string
		wantHasFM bool
		wantBody  string
	}{
		{
			name:      "normal fence",
			content:   "---\ntitle: \"x\"\n---\n\nCorpo.\n",
			wantHasFM: true,
			wantBody:  "Corpo.\n",
		},
		{
			name:      "fence not on line 0",
			content:   "\n---\ntitle: \"x\"\n---\n\nCorpo.\n",
			wantHasFM: false,
			wantBody:  "\n---\ntitle: \"x\"\n---\n\nCorpo.\n",
		},
		{
			name:      "CRLF fence",
			content:   "---\r\ntitle: \"x\"\r\n---\r\n\r\nCorpo.\r\n",
			wantHasFM: true,
			wantBody:  "Corpo.\r\n",
		},
		{
			name:      "malformed YAML inside valid fence still splits",
			content:   "---\ntitle: \"unterminated\n---\n\nCorpo.\n",
			wantHasFM: true,
			wantBody:  "Corpo.\n",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, body, hasFM := SplitFrontmatter([]byte(tc.content))
			if hasFM != tc.wantHasFM {
				t.Errorf("hasFrontmatter = %v, want %v", hasFM, tc.wantHasFM)
			}
			if body != tc.wantBody {
				t.Errorf("body = %q, want %q", body, tc.wantBody)
			}
		})
	}
}

func TestFrontmatterInner_ReturnsYAMLTextWithoutFences(t *testing.T) {
	inner, hasFM := FrontmatterInner([]byte("---\ntitle: \"x\"\nstatus: pendente\n---\n\nCorpo.\n"))
	if !hasFM {
		t.Fatal("expected hasFrontmatter=true")
	}
	if inner != "title: \"x\"\nstatus: pendente\n" {
		t.Errorf("inner = %q, want %q", inner, "title: \"x\"\nstatus: pendente\n")
	}
}

func TestFrontmatterInner_NoFence_ReturnsEmpty(t *testing.T) {
	inner, hasFM := FrontmatterInner([]byte("Só corpo, sem frontmatter.\n"))
	if hasFM {
		t.Error("expected hasFrontmatter=false")
	}
	if inner != "" {
		t.Errorf("inner = %q, want empty", inner)
	}
}

func TestReadNote_PopulatesFrontmatterRaw(t *testing.T) {
	v, dir := newTestVault(t)
	content := "---\ntitle: \"x\"\nstatus: pendente\n---\n\nCorpo.\n"
	if err := os.WriteFile(filepath.Join(dir, "nota.md"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	note, err := v.ReadNote("nota.md")
	if err != nil {
		t.Fatalf("ReadNote: %v", err)
	}
	if note.FrontmatterRaw != "title: \"x\"\nstatus: pendente\n" {
		t.Errorf("FrontmatterRaw = %q", note.FrontmatterRaw)
	}
}

func TestComposeNote_SaveNoteStructured_RoundTripsFrontmatterAndBody(t *testing.T) {
	v, _ := newTestVault(t)
	if _, err := v.CreateNote("", "Estruturada"); err != nil {
		t.Fatalf("CreateNote: %v", err)
	}

	fm := map[string]interface{}{"title": "Estruturada", "type": "tarefa", "status": "pendente"}
	body := "\nCorpo da tarefa.\n"
	if err := v.SaveNoteStructured("estruturada.md", fm, body); err != nil {
		t.Fatalf("SaveNoteStructured: %v", err)
	}

	note, err := v.ReadNote("estruturada.md")
	if err != nil {
		t.Fatalf("ReadNote: %v", err)
	}
	if note.Frontmatter["status"] != "pendente" || note.Frontmatter["type"] != "tarefa" {
		t.Errorf("frontmatter mismatch: %+v", note.Frontmatter)
	}
	if note.Body != body {
		t.Errorf("body = %q, want %q", note.Body, body)
	}
}
