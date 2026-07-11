package schema

import "testing"

func TestMergeProperties_ChildOverridesParentInPlace(t *testing.T) {
	parent := []Property{
		{Key: "a", Label: "Parent A", Kind: KindText},
		{Key: "b", Label: "Parent B", Kind: KindText},
	}
	child := []Property{
		{Key: "b", Label: "Child B", Kind: KindNumber},
		{Key: "c", Label: "Child C", Kind: KindCheckbox},
	}

	merged := mergeProperties(parent, child)
	if len(merged) != 3 {
		t.Fatalf("expected 3 merged properties, got %d: %+v", len(merged), merged)
	}
	if merged[0].Key != "a" {
		t.Errorf("expected parent-only property 'a' first, got %+v", merged[0])
	}
	if merged[1].Key != "b" || merged[1].Label != "Child B" || merged[1].Kind != KindNumber {
		t.Errorf("expected child override of 'b' at parent's position, got %+v", merged[1])
	}
	if merged[2].Key != "c" {
		t.Errorf("expected child-only property 'c' appended last, got %+v", merged[2])
	}
}

func newTestManager(t *testing.T) *Manager {
	t.Helper()
	return NewManager(t.TempDir())
}

func TestResolve_MultiLevelExtends(t *testing.T) {
	m := newTestManager(t)

	mustSave(t, m, Schema{ID: "grandparent", Name: "GP", Properties: []Property{
		{Key: "gp_only", Kind: KindText},
		{Key: "shared", Kind: KindText, Label: "from gp"},
	}})
	mustSave(t, m, Schema{ID: "parent", Name: "P", Extends: "grandparent", Properties: []Property{
		{Key: "shared", Kind: KindText, Label: "from parent"},
		{Key: "parent_only", Kind: KindNumber},
	}})
	mustSave(t, m, Schema{ID: "child", Name: "C", Extends: "parent", Properties: []Property{
		{Key: "shared", Kind: KindText, Label: "from child"},
		{Key: "child_only", Kind: KindCheckbox},
	}})

	resolved, err := m.Resolve("child")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	byKey := make(map[string]Property)
	for _, p := range resolved.Properties {
		byKey[p.Key] = p
	}

	if byKey["shared"].Label != "from child" {
		t.Errorf("expected child's 'shared' override to win, got %+v", byKey["shared"])
	}
	if _, ok := byKey["gp_only"]; !ok {
		t.Error("expected grandparent-only property to survive")
	}
	if _, ok := byKey["parent_only"]; !ok {
		t.Error("expected parent-only property to survive")
	}
	if _, ok := byKey["child_only"]; !ok {
		t.Error("expected child-only property to survive")
	}
}

func TestResolve_ExtendsCycle_ReturnsError(t *testing.T) {
	m := newTestManager(t)
	mustSave(t, m, Schema{ID: "a", Name: "A", Extends: "b"})
	mustSave(t, m, Schema{ID: "b", Name: "B", Extends: "a"})

	if _, err := m.Resolve("a"); err == nil {
		t.Fatal("expected error for extends cycle, got nil")
	}
}

func TestResolve_TemplateInheritance(t *testing.T) {
	m := newTestManager(t)
	mustSave(t, m, Schema{ID: "parent", Name: "P", Template: "parent template"})
	mustSave(t, m, Schema{ID: "child-empty", Name: "CE", Extends: "parent"})
	mustSave(t, m, Schema{ID: "child-own", Name: "CO", Extends: "parent", Template: "child template"})

	resolvedEmpty, err := m.Resolve("child-empty")
	if err != nil {
		t.Fatalf("Resolve child-empty: %v", err)
	}
	if resolvedEmpty.Template != "parent template" {
		t.Errorf("expected empty child template to inherit parent's, got %q", resolvedEmpty.Template)
	}

	resolvedOwn, err := m.Resolve("child-own")
	if err != nil {
		t.Fatalf("Resolve child-own: %v", err)
	}
	if resolvedOwn.Template != "child template" {
		t.Errorf("expected non-empty child template to win, got %q", resolvedOwn.Template)
	}
}

func mustSave(t *testing.T, m *Manager, s Schema) {
	t.Helper()
	if err := m.Save(s); err != nil {
		t.Fatalf("Save(%q): %v", s.ID, err)
	}
}
