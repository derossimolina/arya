import { useEffect, useRef, useState } from 'react';
import { schema, vault } from '../../../wailsjs/go/models';
import { ReadNote } from '../../../wailsjs/go/main/NotesService';
import { ResolveSchema } from '../../../wailsjs/go/main/SchemaService';
import PropertyField from '../Properties/PropertyField';
import MarkdownCodeMirror from './MarkdownCodeMirror';
import BlockEditor from './BlockEditor';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import CreateTypeFromNoteModal from '../Schema/CreateTypeFromNoteModal';
import { parentPathOf } from '../../lib/path';

interface TypedNoteViewProps {
    note: vault.Note;
    onSaveStructured: (path: string, frontmatter: Record<string, unknown>, body: string) => Promise<void>;
    onSaveRaw: (path: string, content: string) => Promise<void>;
    onOpenNote: (path: string) => void;
    onNoteCreated: () => void;
}

function isSchemaNotFoundError(err: unknown): boolean {
    return String(err).includes('schema: not found');
}

// Mounted fresh (via a `key={note.path}` from the parent), same convention
// as NoteEditor — note.path never changes during this component's life.
function TypedNoteView({ note, onSaveStructured, onSaveRaw, onOpenNote, onNoteCreated }: TypedNoteViewProps) {
    const typeID = typeof note.frontmatter.type === 'string' ? note.frontmatter.type : '';
    const [resolved, setResolved] = useState<schema.Schema | null>(null);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [showCreateType, setShowCreateType] = useState(false);

    // One toggle, not two: "structured" (property form + block editor) vs
    // "markdown" (the whole file — frontmatter and body together — as a
    // single raw text editor), mirroring how Obsidian's source mode works.
    // A separate "just the YAML" mode was removed — clicking Markdown now
    // shows the frontmatter and body combined, not a third option.
    const [mode, setMode] = useState<'structured' | 'markdown'>('structured');
    const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>(note.frontmatter);
    const [body, setBody] = useState(note.body);
    const [rawValue, setRawValue] = useState(note.rawContent);

    // Read by the debounced save below, kept in sync synchronously (not via
    // an effect) so a flush can never read a one-render-stale value.
    const modeRef = useRef(mode);
    const frontmatterRef = useRef(frontmatter);
    const bodyRef = useRef(body);
    const rawValueRef = useRef(rawValue);

    const { status, schedule, flush } = useDebouncedSave<number>(async () => {
        if (modeRef.current === 'markdown') {
            await onSaveRaw(note.path, rawValueRef.current);
        } else {
            await onSaveStructured(note.path, frontmatterRef.current, bodyRef.current);
        }
    });

    function tryResolve() {
        setResolveError(null);
        setNotFound(false);
        ResolveSchema(typeID)
            .then(setResolved)
            .catch((err) => {
                if (isSchemaNotFoundError(err)) {
                    setNotFound(true);
                } else {
                    setResolveError(String(err));
                }
            });
    }

    useEffect(tryResolve, [typeID]);

    function updateFrontmatter(next: Record<string, unknown>) {
        setFrontmatter(next);
        frontmatterRef.current = next;
        schedule(Date.now());
    }

    function updateBody(next: string) {
        setBody(next);
        bodyRef.current = next;
        schedule(Date.now());
    }

    function updateRawValue(next: string) {
        setRawValue(next);
        rawValueRef.current = next;
        schedule(Date.now());
    }

    // Switching modes flushes whatever's pending in the mode being left,
    // then re-reads the note from disk so the other mode starts from the
    // canonical saved state rather than trying to convert in-browser
    // between a JS frontmatter object and raw file text.
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

    async function switchToStructured() {
        await flush();
        try {
            const fresh = await ReadNote(note.path);
            setFrontmatter(fresh.frontmatter);
            frontmatterRef.current = fresh.frontmatter;
            setBody(fresh.body);
            bodyRef.current = fresh.body;
        } catch {
            // keep current in-memory state if the refetch itself fails
        }
        modeRef.current = 'structured';
        setMode('structured');
    }

    if (notFound) {
        return (
            <div className="type-not-found">
                <p>
                    O tipo "{typeID}" ainda não existe como schema (só está escrito no frontmatter desta
                    nota).
                </p>
                <button onClick={() => setShowCreateType(true)}>Criar tipo "{typeID}" agora</button>
                {showCreateType && (
                    <CreateTypeFromNoteModal
                        typeID={typeID}
                        frontmatter={frontmatter}
                        onCreated={() => {
                            setShowCreateType(false);
                            tryResolve();
                        }}
                        onCancel={() => setShowCreateType(false)}
                    />
                )}
            </div>
        );
    }
    if (resolveError) {
        return (
            <div className="error">
                Não foi possível carregar o tipo "{typeID}": {resolveError}
            </div>
        );
    }
    if (!resolved) {
        return <div className="editor-placeholder">Carregando tipo…</div>;
    }

    return (
        <div
            className="typed-note-view"
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
                    onClick={() => (mode === 'structured' ? switchToMarkdown() : switchToStructured())}
                >
                    {mode === 'structured' ? 'Ver Markdown' : 'Ver Estruturado'}
                </button>
            </div>

            {mode === 'markdown' ? (
                <MarkdownCodeMirror value={rawValue} onChange={updateRawValue} />
            ) : (
                <div className="note-page">
                    <input
                        className="note-page-title"
                        type="text"
                        placeholder="Sem título"
                        value={typeof frontmatter.title === 'string' ? frontmatter.title : ''}
                        onChange={(e) => updateFrontmatter({ ...frontmatter, title: e.target.value })}
                    />
                    <div className="property-panel">
                        <div className="property-row readonly">
                            <label>Tipo</label>
                            <span>
                                {resolved.icon ? `${resolved.icon} ` : ''}
                                {resolved.name}
                            </span>
                        </div>
                        {resolved.properties?.map((prop) => (
                            <div className="property-row" key={prop.key}>
                                <label>{prop.label || prop.key}</label>
                                <PropertyField
                                    property={prop}
                                    value={frontmatter[prop.key]}
                                    onChange={(value) => updateFrontmatter({ ...frontmatter, [prop.key]: value })}
                                />
                            </div>
                        ))}
                    </div>
                    <BlockEditor
                        key={note.path}
                        value={body}
                        onChange={updateBody}
                        parentPath={parentPathOf(note.path)}
                        onOpenNote={onOpenNote}
                        onNoteCreated={onNoteCreated}
                    />
                </div>
            )}
        </div>
    );
}

export default TypedNoteView;
