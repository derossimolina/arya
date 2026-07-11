package schema

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestManager_List_ReturnsValidAndMalformed(t *testing.T) {
	m := newTestManager(t)
	mustSave(t, m, Schema{ID: "good", Name: "Good"})

	badPath := filepath.Join(m.dir, "bad.yaml")
	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(badPath, []byte("id: [unterminated"), 0o644); err != nil {
		t.Fatal(err)
	}

	list, err := m.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 entries, got %d: %+v", len(list), list)
	}

	var good, bad *LoadedSchema
	for i := range list {
		switch list[i].ID {
		case "good":
			good = &list[i]
		case "bad":
			bad = &list[i]
		}
	}
	if good == nil || good.Error != "" {
		t.Errorf("expected 'good' with no error, got %+v", good)
	}
	if bad == nil || bad.Error == "" {
		t.Errorf("expected 'bad' with a parse error, got %+v", bad)
	}
}

func TestManager_SaveGet_RoundTrip(t *testing.T) {
	m := newTestManager(t)
	original := Schema{ID: "roundtrip", Name: "Round Trip", Icon: "🔁", Properties: []Property{
		{Key: "status", Label: "Status", Kind: KindSelect, Options: []string{"a", "b"}, Default: "a"},
	}}

	if err := m.Save(original); err != nil {
		t.Fatalf("Save: %v", err)
	}

	got, err := m.Get("roundtrip")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Name != original.Name || got.Icon != original.Icon {
		t.Errorf("got %+v, want %+v", got, original)
	}
	if len(got.Properties) != 1 || got.Properties[0].Kind != KindSelect {
		t.Errorf("properties mismatch: %+v", got.Properties)
	}
}

func TestManager_Get_MissingSchema_ReturnsErrNotFound(t *testing.T) {
	m := newTestManager(t)

	if _, err := m.Get("does-not-exist"); !errors.Is(err, ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
	if _, err := m.Resolve("does-not-exist"); !errors.Is(err, ErrNotFound) {
		t.Errorf("expected Resolve to surface ErrNotFound, got %v", err)
	}
}

func TestManager_EnsureSeeded_CreatesFourFiles(t *testing.T) {
	m := newTestManager(t)

	seeded, err := m.EnsureSeeded()
	if err != nil {
		t.Fatalf("EnsureSeeded: %v", err)
	}
	if !seeded {
		t.Error("expected EnsureSeeded to report it seeded a fresh vault")
	}

	list, err := m.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 4 {
		t.Fatalf("expected 4 seed schemas, got %d: %+v", len(list), list)
	}
}

func TestManager_EnsureSeeded_IsNoOpOnSecondCall(t *testing.T) {
	m := newTestManager(t)

	if _, err := m.EnsureSeeded(); err != nil {
		t.Fatalf("first EnsureSeeded: %v", err)
	}
	if err := m.Delete("nota"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	seeded, err := m.EnsureSeeded()
	if err != nil {
		t.Fatalf("second EnsureSeeded: %v", err)
	}
	if seeded {
		t.Error("expected second EnsureSeeded to be a no-op (dir already existed)")
	}

	list, err := m.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 3 {
		t.Errorf("expected deleted seed to stay deleted (3 remaining), got %d: %+v", len(list), list)
	}
}

func TestManager_EnsureSeeded_RespectsManuallyCreatedEmptyDir(t *testing.T) {
	m := newTestManager(t)
	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		t.Fatal(err)
	}

	seeded, err := m.EnsureSeeded()
	if err != nil {
		t.Fatalf("EnsureSeeded: %v", err)
	}
	if seeded {
		t.Error("expected EnsureSeeded not to seed an already-existing (even if empty) _schemas dir")
	}

	list, err := m.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected no seed files in a manually pre-created empty dir, got %d", len(list))
	}
}
