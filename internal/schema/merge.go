package schema

import "fmt"

// Resolve returns the effective schema for id after walking its `extends`
// chain: child properties override same-key parent properties in place;
// parent-only and child-only properties both survive; an empty child
// template inherits the parent's.
func (m *Manager) Resolve(id string) (Schema, error) {
	return m.resolve(id, map[string]bool{})
}

func (m *Manager) resolve(id string, visiting map[string]bool) (Schema, error) {
	if visiting[id] {
		return Schema{}, fmt.Errorf("schema: extends cycle detected at %q", id)
	}
	visiting[id] = true

	child, err := m.Get(id)
	if err != nil {
		return Schema{}, err
	}
	if child.Extends == "" {
		return child, nil
	}

	parent, err := m.resolve(child.Extends, visiting)
	if err != nil {
		return Schema{}, err
	}

	return mergeSchemas(parent, child), nil
}

func mergeSchemas(parent, child Schema) Schema {
	merged := child
	merged.Properties = mergeProperties(parent.Properties, child.Properties)
	if child.Template == "" {
		merged.Template = parent.Template
	}
	return merged
}

func mergeProperties(parentProps, childProps []Property) []Property {
	childByKey := make(map[string]Property, len(childProps))
	for _, p := range childProps {
		childByKey[p.Key] = p
	}

	seen := make(map[string]bool, len(parentProps)+len(childProps))
	result := make([]Property, 0, len(parentProps)+len(childProps))

	for _, p := range parentProps {
		if override, ok := childByKey[p.Key]; ok {
			result = append(result, override)
		} else {
			result = append(result, p)
		}
		seen[p.Key] = true
	}

	for _, p := range childProps {
		if !seen[p.Key] {
			result = append(result, p)
		}
	}

	return result
}
