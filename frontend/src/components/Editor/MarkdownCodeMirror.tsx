import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';

interface MarkdownCodeMirrorProps {
    value: string;
    onChange: (value: string) => void;
}

// Bare CodeMirror 6 markdown editor, shared by NoteEditor (raw notes) and
// TypedNoteView (a typed note's body pane).
function MarkdownCodeMirror({ value, onChange }: MarkdownCodeMirrorProps) {
    return (
        <CodeMirror
            value={value}
            height="100%"
            theme="dark"
            extensions={[markdown(), EditorView.lineWrapping]}
            onChange={onChange}
        />
    );
}

export default MarkdownCodeMirror;
