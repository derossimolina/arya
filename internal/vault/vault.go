// Package vault implements file I/O for an Arya vault: a folder tree of
// "cadernos" containing markdown notes with YAML frontmatter. Files on disk
// are the only source of truth; this package has no in-memory index.
package vault

import (
	"errors"
	"os"
	"strings"
	"time"
)

type NodeType string

const (
	NodeFolder NodeType = "folder"
	NodeNote   NodeType = "note"
)

// Node is one entry in the vault's folder/note tree.
type Node struct {
	Name     string   `json:"name"`
	Path     string   `json:"path"` // vault-relative, slash-separated; "" for the root
	Type     NodeType `json:"type"`
	Children []Node   `json:"children,omitempty"`
}

// Note is a single markdown file's content plus its parsed frontmatter.
type Note struct {
	Path             string                 `json:"path"`
	RawContent       string                 `json:"rawContent"`
	Body             string                 `json:"body"`           // content after the frontmatter fence; == RawContent if none
	FrontmatterRaw   string                 `json:"frontmatterRaw"` // exact YAML text between the fences, "" if none
	Frontmatter      map[string]interface{} `json:"frontmatter"`
	FrontmatterError string                 `json:"frontmatterError,omitempty"`
}

var (
	ErrPathTraversal = errors.New("vault: path escapes vault root")
	ErrAlreadyExists = errors.New("vault: a file or folder with that name already exists")
	// ErrRootMissing is returned by callers (see notesservice.go) when the
	// configured vault root no longer exists on disk.
	ErrRootMissing = errors.New("vault: root folder not found")
)

type Vault struct {
	root string
}

func New(root string) *Vault {
	return &Vault{root: root}
}

func (v *Vault) ReadNote(relPath string) (Note, error) {
	abs, err := v.resolve(relPath)
	if err != nil {
		return Note{}, err
	}

	data, err := os.ReadFile(abs)
	if err != nil {
		return Note{}, err
	}

	note := Note{Path: relPath, RawContent: string(data)}

	_, body, _ := SplitFrontmatter(data)
	note.Body = body
	note.FrontmatterRaw, _ = FrontmatterInner(data)

	fm, fmErr := parseFrontmatter(data)
	if fmErr != nil {
		note.FrontmatterError = fmErr.Error()
		note.Frontmatter = map[string]interface{}{}
	} else {
		note.Frontmatter = fm
	}

	return note, nil
}

func (v *Vault) SaveNote(relPath, content string) error {
	abs, err := v.resolve(relPath)
	if err != nil {
		return err
	}
	return os.WriteFile(abs, []byte(content), 0o644)
}

// SaveNoteStructured composes a frontmatter map + body into one file and
// saves it. See ComposeNote's doc comment for the formatting trade-off this
// implies compared to SaveNote's opaque-string round trip.
func (v *Vault) SaveNoteStructured(relPath string, frontmatter map[string]interface{}, body string) error {
	content, err := ComposeNote(frontmatter, body)
	if err != nil {
		return err
	}
	return v.SaveNote(relPath, content)
}

func (v *Vault) CreateFolder(parentRelPath, name string) (string, error) {
	relPath := joinRel(parentRelPath, name)
	abs, err := v.resolve(relPath)
	if err != nil {
		return "", err
	}

	if err := rejectIfExists(abs); err != nil {
		return "", err
	}

	if err := os.MkdirAll(abs, 0o755); err != nil {
		return "", err
	}
	return relPath, nil
}

func (v *Vault) CreateNote(parentRelPath, title string) (string, error) {
	return v.CreateNoteWithContent(parentRelPath, title, noteTemplate(title))
}

// CreateNoteWithContent creates a new note file with the given exact
// content (e.g. a type-driven frontmatter + rendered template), sharing the
// slugify/collision/mkdir logic used by the plain CreateNote path.
func (v *Vault) CreateNoteWithContent(parentRelPath, title, content string) (string, error) {
	relPath := joinRel(parentRelPath, slugify(title)+".md")
	abs, err := v.resolve(relPath)
	if err != nil {
		return "", err
	}

	if err := rejectIfExists(abs); err != nil {
		return "", err
	}

	parentAbs, err := v.resolve(parentRelPath)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(parentAbs, 0o755); err != nil {
		return "", err
	}

	if err := os.WriteFile(abs, []byte(content), 0o644); err != nil {
		return "", err
	}
	return relPath, nil
}

func rejectIfExists(abs string) error {
	if _, err := os.Stat(abs); err == nil {
		return ErrAlreadyExists
	} else if !os.IsNotExist(err) {
		return err
	}
	return nil
}

func noteTemplate(title string) string {
	escaped := strings.ReplaceAll(title, `"`, `\"`)
	return "---\n" +
		"title: \"" + escaped + "\"\n" +
		"created: \"" + time.Now().Format(time.RFC3339) + "\"\n" +
		"---\n\n"
}
