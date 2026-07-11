package schema

import "gopkg.in/yaml.v3"

// Parse decodes raw YAML bytes into a Schema. It does not validate; call
// Validate() separately once the caller knows which registry to check
// against.
func Parse(data []byte) (Schema, error) {
	var s Schema
	if err := yaml.Unmarshal(data, &s); err != nil {
		return Schema{}, err
	}
	return s, nil
}

// Serialize encodes a Schema back to YAML. Field order in the Schema struct
// drives key order in the output.
func Serialize(s Schema) ([]byte, error) {
	return yaml.Marshal(s)
}
