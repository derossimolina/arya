import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';

interface YamlCodeMirrorProps {
    value: string;
    onChange: (value: string) => void;
}

// Raw YAML text editor for a note's frontmatter block — the "view as YAML"
// side of the Obsidian-style toggle in TypedNoteView.
function YamlCodeMirror({ value, onChange }: YamlCodeMirrorProps) {
    return (
        <CodeMirror
            value={value}
            height="100%"
            theme="dark"
            extensions={[yaml(), EditorView.lineWrapping]}
            onChange={onChange}
        />
    );
}

export default YamlCodeMirror;
