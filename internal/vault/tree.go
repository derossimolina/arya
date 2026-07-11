package vault

import (
	"os"
	"sort"
	"strings"
)

// reservedNames are top-level-ish entries that belong to the app, not the
// user's notebooks, and must never appear in the note tree.
var reservedNames = map[string]bool{
	"_schemas": true,
}

// Tree returns the folder/note tree rooted at the vault root. Only
// directories and *.md files are included; dotfiles/dirs and reserved
// names (e.g. _schemas/) are skipped.
func (v *Vault) Tree() (Node, error) {
	children, err := v.listDir("")
	if err != nil {
		return Node{}, err
	}
	return Node{Name: "", Path: "", Type: NodeFolder, Children: children}, nil
}

func (v *Vault) listDir(relPath string) ([]Node, error) {
	abs, err := v.resolve(relPath)
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(abs)
	if err != nil {
		return nil, err
	}

	var nodes []Node
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, ".") || reservedNames[name] {
			continue
		}

		childRel := joinRel(relPath, name)

		if entry.IsDir() {
			children, err := v.listDir(childRel)
			if err != nil {
				return nil, err
			}
			nodes = append(nodes, Node{Name: name, Path: childRel, Type: NodeFolder, Children: children})
			continue
		}

		if strings.HasSuffix(strings.ToLower(name), ".md") {
			nodes = append(nodes, Node{Name: name, Path: childRel, Type: NodeNote})
		}
	}

	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].Type != nodes[j].Type {
			return nodes[i].Type == NodeFolder
		}
		return strings.ToLower(nodes[i].Name) < strings.ToLower(nodes[j].Name)
	})

	return nodes, nil
}
