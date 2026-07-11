package schema

import (
	"strings"
	"time"
)

// RenderTemplate performs the single literal {{title}} substitution
// CLAUDE.md's schema template example uses. This is deliberately not
// text/template — one placeholder doesn't justify a templating engine, and
// a real engine would add a code-execution-shaped surface over
// user-authored strings for no benefit here.
func RenderTemplate(tmpl, title string) string {
	return strings.ReplaceAll(tmpl, "{{title}}", title)
}

// BuildFrontmatter constructs the initial frontmatter map for a new note of
// the given (already-`extends`-resolved) schema.
func BuildFrontmatter(s Schema, title string) map[string]interface{} {
	fm := map[string]interface{}{
		"title":   title,
		"type":    s.ID,
		"created": time.Now().Format(time.RFC3339),
	}
	for _, p := range s.Properties {
		if p.Default != nil {
			fm[p.Key] = p.Default
		}
	}
	return fm
}
