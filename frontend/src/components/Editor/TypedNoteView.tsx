import { useEffect, useRef, useState } from 'react';
import { schema, vault } from '../../../wailsjs/go/models';
import { ReadNote } from '../../../wailsjs/go/main/NotesService';
import { ResolveSchema } from '../../../wailsjs/go/main/SchemaService';
import PropertyField from '../Properties/PropertyField';
import MarkdownCodeMirror from './MarkdownCodeMirror';
import YamlCodeMirror from './YamlCodeMirror';
import { useDebouncedSave } from '../../hooks/useDebouncedSave';
import CreateTypeFromNoteModal from '../Schema/CreateTypeFromNoteModal';

interface TypedNoteViewProps {
    note: vault.Note;
    onSaveStructured: (path: string, frontmatter: Record<string, unknown>, body: string) => Promise<void>;
    onSaveRaw: (path: string, content: string) => Promise<void>;
}

function isSchemaNotFoundError(err: unknown): boolean {
    return String(err).includes('schema: not found');
}

function composeRaw(yamlText: string, body: string): string {
    const block = yamlText.endsWith('\n') ? yamlText : yamlText + '\n';
    return `---\n${block}---\n\n${body}`;
}

// Mounted fresh (via a `key={note.path}` from the parent), same convention
// as NoteEditor — note.path never changes during this component's life.
function TypedNoteView({ note, onSaveStructured, onSaveRaw }: TypedNoteViewProps) {
    const typeID = typeof note.frontmatter.type === 'string' ? note.frontmatter.type : '';
    const [resolved, setResolved] = useState<schema.Schema | null>(null);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [showCreateType, setShowCreateType] = useState(false);

    const [viewMode, setViewMode] = useState<'form' | 'yaml'>('form');
    const [frontmatter, setFrontmatter] = useState<Record<string, unknown>>(note.frontmatter);
    const [body, setBody] = useState(note.body);
    const [yamlText, setYamlText] = useState(note.frontmatterRaw);

    // Read by the debounced save below, kept in sync synchronously (not via
    // an effect) so a flush can never read a one-render-stale value.
    const viewModeRef = useRef(viewMode);
    const frontmatterRef = useRef(frontmatter);
    const bodyRef = useRef(body);
    const yamlTextRef = useRef(yamlText);

    const { status, schedule, flush } = useDebouncedSave<number>(async () => {
        if (viewModeRef.current === 'yaml') {
            await onSaveRaw(note.path, composeRaw(yamlTextRef.current, bodyRef.current));
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

    function updateYamlText(next: string) {
        setYamlText(next);
        yamlTextRef.current = next;
        schedule(Date.now());
    }

    // Switching modes flushes whatever's pending in the mode being left,
    // then re-reads the note from disk so the other mode starts from the
    // canonical saved state rather than trying to convert between a JS
    // object and YAML text in-browser.
    async function switchToYaml() {
        await flush();
        try {
            const fresh = await ReadNote(note.path);
            setYamlText(fresh.frontmatterRaw);
            yamlTextRef.current = fresh.frontmatterRaw;
            setBody(fresh.body);
            bodyRef.current = fresh.body;
        } catch {
            // keep current in-memory text if the refetch itself fails
        }
        viewModeRef.current = 'yaml';
        setViewMode('yaml');
    }

    async function switchToForm() {
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
        viewModeRef.current = 'form';
        setViewMode('form');
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
                    onClick={() => (viewMode === 'form' ? switchToYaml() : switchToForm())}
                >
                    {viewMode === 'form' ? 'Ver YAML' : 'Ver formulário'}
                </button>
            </div>

            {viewMode === 'yaml' ? (
                <div className="property-panel yaml-panel">
                    <YamlCodeMirror value={yamlText} onChange={updateYamlText} />
                </div>
            ) : (
                <div className="property-panel">
                    <div className="property-row">
                        <label>Título</label>
                        <input
                            type="text"
                            value={typeof frontmatter.title === 'string' ? frontmatter.title : ''}
                            onChange={(e) => updateFrontmatter({ ...frontmatter, title: e.target.value })}
                        />
                    </div>
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
            )}

            <MarkdownCodeMirror value={body} onChange={updateBody} />
        </div>
    );
}

export default TypedNoteView;
