import { useEffect, useRef, useState } from 'react';
import { vault, schema } from '../../wailsjs/go/models';
import {
    Tree as FetchTree,
    ReadNote,
    SaveNote,
    SaveNoteStructured,
    CreateFolder,
    CreateNote,
} from '../../wailsjs/go/main/NotesService';
import Tree from './Sidebar/Tree';
import NewItemInline from './Sidebar/NewItemInline';
import NewNoteInline from './Sidebar/NewNoteInline';
import NoteEditor from './Editor/NoteEditor';
import TypedNoteView from './Editor/TypedNoteView';
import SchemaManagerModal from './Schema/SchemaManagerModal';
import ViewRenderer from './Views/ViewRenderer';
import CommandPalette from './Search/CommandPalette';
import { SidebarCollapseIcon } from './icons/Icons';

interface MainLayoutProps {
    vaultPath: string;
    onVaultMissing: () => void;
}

function isRootMissingError(err: unknown): boolean {
    return String(err).includes('root folder not found');
}

// A note uses the typed property panel only when it has no frontmatter
// parse error and declares a non-empty `type` — otherwise it falls back to
// the plain raw editor from slice 1 (also covers notes created before this
// slice existed, which have no `type` at all).
function isTypedNote(note: vault.Note): boolean {
    return !note.frontmatterError && typeof note.frontmatter.type === 'string' && note.frontmatter.type !== '';
}

function MainLayout({ vaultPath, onVaultMissing }: MainLayoutProps) {
    const [tree, setTree] = useState<vault.Node | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [selectedFolder, setSelectedFolder] = useState('');
    const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
    const [activeNote, setActiveNote] = useState<vault.Note | null>(null);
    const [creating, setCreating] = useState<'folder' | 'note' | null>(null);
    const [schemaManagerOpen, setSchemaManagerOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeView, setActiveView] = useState<{ schemaId: string; view: schema.View } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        function handleGlobalKeyDown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        }
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    function openNote(path: string) {
        setActiveView(null);
        setActiveNotePath(path);
    }

    // Mirrors activeNotePath for use inside async callbacks (e.g.
    // handleSave's post-save refetch) without capturing a stale value from
    // whichever render scheduled that callback.
    const activeNotePathRef = useRef<string | null>(null);
    useEffect(() => {
        activeNotePathRef.current = activeNotePath;
    }, [activeNotePath]);

    async function reloadTree() {
        try {
            const t = await FetchTree();
            setTree(t);
        } catch (err) {
            if (isRootMissingError(err)) {
                onVaultMissing();
                return;
            }
            setError(String(err));
        }
    }

    useEffect(() => {
        reloadTree();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vaultPath]);

    useEffect(() => {
        if (!activeNotePath) {
            setActiveNote(null);
            return;
        }
        ReadNote(activeNotePath)
            .then(setActiveNote)
            .catch((err) => {
                if (isRootMissingError(err)) {
                    onVaultMissing();
                    return;
                }
                setError(String(err));
            });
    }, [activeNotePath]);

    function toggleFolder(path: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }

    async function handleSave(path: string, content: string) {
        try {
            await SaveNote(path, content);
            // Re-check whether this raw save just gave the note a `type` it
            // didn't have before (e.g. the user hand-typed `type: x` into
            // the frontmatter) — if so, the note should switch over to the
            // typed property panel without requiring the user to navigate
            // away and back.
            if (activeNotePathRef.current === path) {
                const fresh = await ReadNote(path);
                if (activeNotePathRef.current === path) {
                    setActiveNote(fresh);
                }
            }
        } catch (err) {
            if (isRootMissingError(err)) {
                onVaultMissing();
                return;
            }
            setError(String(err));
        }
    }

    async function handleSaveStructured(path: string, frontmatter: Record<string, unknown>, body: string) {
        try {
            await SaveNoteStructured(path, frontmatter, body);
        } catch (err) {
            if (isRootMissingError(err)) {
                onVaultMissing();
                return;
            }
            setError(String(err));
        }
    }

    async function handleCreateFolder(name: string) {
        setCreating(null);
        try {
            await CreateFolder(selectedFolder, name);
            setExpanded((prev) => new Set(prev).add(selectedFolder));
            await reloadTree();
        } catch (err) {
            setError(String(err));
        }
    }

    async function handleCreateNote(title: string, typeID: string) {
        setCreating(null);
        try {
            const path = await CreateNote(selectedFolder, title, typeID);
            setExpanded((prev) => new Set(prev).add(selectedFolder));
            await reloadTree();
            openNote(path);
        } catch (err) {
            setError(String(err));
        }
    }

    return (
        <div className="main-layout">
            <div className="sidebar-rail">
                <button
                    className="sidebar-collapse-toggle"
                    title={sidebarCollapsed ? 'Mostrar sidebar' : 'Esconder sidebar'}
                    onClick={() => setSidebarCollapsed((v) => !v)}
                >
                    <SidebarCollapseIcon />
                </button>
            </div>
            <aside className={sidebarCollapsed ? 'sidebar collapsed' : 'sidebar'}>
                <div className="sidebar-header" title={vaultPath}>
                    {vaultPath}
                </div>
                <button className="sidebar-search-trigger" onClick={() => setSearchOpen(true)}>
                    <span>Buscar notas…</span>
                    <span className="sidebar-search-shortcut">Ctrl+K</span>
                </button>
                <div className="sidebar-actions">
                    <button onClick={() => setCreating('folder')}>Caderno</button>
                    <button onClick={() => setCreating('note')}>Nota</button>
                    <button onClick={() => setSchemaManagerOpen(true)}>Tipos</button>
                </div>
                {creating === 'folder' && (
                    <NewItemInline
                        placeholder="Nome do caderno"
                        onSubmit={handleCreateFolder}
                        onCancel={() => setCreating(null)}
                    />
                )}
                {creating === 'note' && (
                    <NewNoteInline onSubmit={handleCreateNote} onCancel={() => setCreating(null)} />
                )}
                {error && <div className="error">{error}</div>}
                {tree && (
                    <Tree
                        nodes={tree.children ?? []}
                        expanded={expanded}
                        onToggleFolder={toggleFolder}
                        selectedFolder={selectedFolder}
                        onSelectFolder={setSelectedFolder}
                        activeNotePath={activeNotePath}
                        onOpenNote={openNote}
                    />
                )}
            </aside>
            <main className="editor-pane">
                {activeView ? (
                    <ViewRenderer
                        key={`${activeView.schemaId}:${activeView.view.name}`}
                        schemaId={activeView.schemaId}
                        view={activeView.view}
                        onOpenNote={openNote}
                        onClose={() => setActiveView(null)}
                    />
                ) : activeNote ? (
                    isTypedNote(activeNote) ? (
                        <TypedNoteView
                            key={activeNote.path}
                            note={activeNote}
                            onSaveStructured={handleSaveStructured}
                            onSaveRaw={handleSave}
                            onOpenNote={openNote}
                            onNoteCreated={reloadTree}
                        />
                    ) : (
                        <NoteEditor
                            key={activeNote.path}
                            note={activeNote}
                            onSave={handleSave}
                            onOpenNote={openNote}
                            onNoteCreated={reloadTree}
                        />
                    )
                ) : (
                    <div className="editor-placeholder">Selecione ou crie uma nota.</div>
                )}
            </main>
            {schemaManagerOpen && (
                <SchemaManagerModal
                    onClose={() => setSchemaManagerOpen(false)}
                    onOpenView={(schemaId, view) => {
                        setSchemaManagerOpen(false);
                        setActiveView({ schemaId, view });
                    }}
                />
            )}
            {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} onOpenNote={openNote} />}
        </div>
    );
}

export default MainLayout;
