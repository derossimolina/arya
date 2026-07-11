package vault

import (
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
)

// resolve converts a vault-relative, slash-separated path into an absolute
// OS path, rejecting anything that would escape the vault root.
func (v *Vault) resolve(relPath string) (string, error) {
	slash := strings.TrimPrefix(filepath.ToSlash(relPath), "/")

	cleaned := path.Clean(slash)
	if cleaned == "." {
		cleaned = ""
	}
	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrPathTraversal
	}

	abs := filepath.Join(v.root, filepath.FromSlash(cleaned))

	rootAbs, err := filepath.Abs(v.root)
	if err != nil {
		return "", err
	}
	absClean, err := filepath.Abs(abs)
	if err != nil {
		return "", err
	}

	rootLower := strings.ToLower(rootAbs)
	absLower := strings.ToLower(absClean)
	if absLower != rootLower && !strings.HasPrefix(absLower, rootLower+string(filepath.Separator)) {
		return "", ErrPathTraversal
	}

	return absClean, nil
}

func joinRel(parent, name string) string {
	if parent == "" {
		return name
	}
	return path.Join(parent, name)
}

var (
	accentFold = map[rune]rune{
		'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
		'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
		'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
		'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
		'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
		'ç': 'c', 'ñ': 'n', 'ý': 'y',
	}
	repeatedHyphens = regexp.MustCompile(`-+`)
)

// slugify turns a note title (possibly with Portuguese accents) into a safe
// ASCII filename stem.
func slugify(title string) string {
	title = strings.TrimSpace(title)

	var b strings.Builder
	for _, r := range title {
		r = unicode.ToLower(r)
		if repl, ok := accentFold[r]; ok {
			b.WriteRune(repl)
			continue
		}
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			continue
		}
		b.WriteRune('-')
	}

	slug := repeatedHyphens.ReplaceAllString(b.String(), "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "sem-titulo"
	}
	return slug
}
