import { useState } from 'react';
import MarkdownCodeMirror from './MarkdownCodeMirror';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';

interface NoteEditorProps {
    path: string;
    content: string;
    onSave: (path: string, content: string) => Promise<void>;
}

// Mounted fresh (via a `key={path}` from the parent) whenever the open note
// changes, so `path`/`content` never change during this component's life —
// no need to special-case switching notes inside here.
function NoteEditor({ path, content, onSave }: NoteEditorProps) {
    const [value, setValue] = useState(content);
    const { status, schedule, flush } = useDebouncedSave<string>((next) => onSave(path, next));

    function handleChange(next: string) {
        setValue(next);
        schedule(next);
    }

    return (
        <div
            className="note-editor"
            onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    flush();
                }
            }}
        >
            <div className="note-editor-status">
                {status === 'saving' ? 'Salvando…' : status === 'pending' ? 'Alterado' : 'Salvo'}
            </div>
            <MarkdownCodeMirror value={value} onChange={handleChange} />
        </div>
    );
}

export default NoteEditor;
