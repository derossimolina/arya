import { useRef, useState } from 'react';
import { vault } from '../../../wailsjs/go/models';
import { ReadNote } from '../../../wailsjs/go/main/NotesService';
import MarkdownCodeMirror from './MarkdownCodeMirror';
import BlockEditor from './BlockEditor';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import { parentPathOf } from '../../lib/path';

interface NoteEditorProps {
    note: vault.Note;
    onSave: (path: string, content: string) => Promise<void>;
    onOpenNote: (path: string) => void;
    onNoteCreated: () => void;
}

// Reassembles a whole raw file from its already-split frontmatter block +
// body — same shape vault.ComposeNote produces on the Go side, needed here
// because Blocks mode only ever edits `body` (see BlockEditor's doc
// comment), never the frontmatter fence, but this note has no schema so
// there's no SaveNoteStructured to hand the two pieces to separately; they
// have to be rejoined before the existing raw SaveNote.
function composeRaw(frontmatterRaw: string, body: string): string {
    if (!frontmatterRaw) return body;
    const block = frontmatterRaw.endsWith('\n') ? frontmatterRaw : frontmatterRaw + '\n';
    return `---\n${block}---\n\n${body}`;
}

// Mounted fresh (via a `key={note.path}` from the parent) whenever the open
// note changes, same convention as TypedNoteView — note.path never changes
// during this component's life.
function NoteEditor({ note, onSave, onOpenNote, onNoteCreated }: NoteEditorProps) {
    const [mode, setMode] = useState<'blocks' | 'markdown'>('blocks');
    const [rawValue, setRawValue] = useState(note.rawContent);
    const [bodyValue, setBodyValue] = useState(note.body);
    const [frontmatterRaw, setFrontmatterRaw] = useState(note.frontmatterRaw);

    const modeRef = useRef(mode);
    const rawValueRef = useRef(rawValue);
    const bodyValueRef = useRef(bodyValue);
    const frontmatterRawRef = useRef(frontmatterRaw);

    const { status, schedule, flush } = useDebouncedSave<number>(async () => {
        if (modeRef.current === 'markdown') {
            await onSave(note.path, rawValueRef.current);
        } else {
            await onSave(note.path, composeRaw(frontmatterRawRef.current, bodyValueRef.current));
        }
    });

    function handleRawChange(next: string) {
        setRawValue(next);
        rawValueRef.current = next;
        schedule(Date.now());
    }

    function handleBodyChange(next: string) {
        setBodyValue(next);
        bodyValueRef.current = next;
        schedule(Date.now());
    }

    // Same flush-then-refetch pattern as TypedNoteView's switchToYaml/
    // switchToForm: whichever mode is being left is saved first, then the
    // other mode starts from the canonical saved state on disk.
    async function switchToMarkdown() {
        await flush();
        try {
            const fresh = await ReadNote(note.path);
            setRawValue(fresh.rawContent);
            rawValueRef.current = fresh.rawContent;
        } catch {
            // keep current in-memory text if the refetch itself fails
        }
        modeRef.current = 'markdown';
        setMode('markdown');
    }

    async function switchToBlocks() {
        await flush();
        try {
            const fresh = await ReadNote(note.path);
            setBodyValue(fresh.body);
            bodyValueRef.current = fresh.body;
            setFrontmatterRaw(fresh.frontmatterRaw);
            frontmatterRawRef.current = fresh.frontmatterRaw;
        } catch {
            // keep current in-memory text if the refetch itself fails
        }
        modeRef.current = 'blocks';
        setMode('blocks');
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
                <button
                    className="view-toggle"
                    onClick={() => (mode === 'blocks' ? switchToMarkdown() : switchToBlocks())}
                >
                    {mode === 'blocks' ? 'Ver Markdown' : 'Ver Blocos'}
                </button>
            </div>
            {mode === 'markdown' ? (
                <MarkdownCodeMirror value={rawValue} onChange={handleRawChange} />
            ) : (
                <div className="note-page">
                    <BlockEditor
                        key={note.path}
                        value={bodyValue}
                        onChange={handleBodyChange}
                        parentPath={parentPathOf(note.path)}
                        onOpenNote={onOpenNote}
                        onNoteCreated={onNoteCreated}
                    />
                </div>
            )}
        </div>
    );
}

export default NoteEditor;
