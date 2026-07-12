import { createReactBlockSpec } from '@blocknote/react';
import { useState } from 'react';
import { CreateNote } from '../../../../wailsjs/go/main/NotesService';
import { useEditorHost } from '../EditorHostContext';
import { registerBlockSerializer } from '../blockMarkdown';

// Notion-style "create a page inline" block: before creation it's a small
// inline form (title + button); once CreateNote succeeds it becomes a
// clickable link to the freshly-created note. Serializes to a plain
// `[[title]]` wikilink token — inert text to goldmark/BlockNote today, but
// the same token Phase 6 formalizes into a real wikilink/backlink target.
export const pageLinkBlockSpec = createReactBlockSpec(
    {
        type: 'pageLink',
        propSchema: {
            path: { default: '' },
            title: { default: '' },
        },
        content: 'none',
    },
    {
        render: ({ block, editor }) => {
            const host = useEditorHost();
            const [title, setTitle] = useState(block.props.title);
            const [creating, setCreating] = useState(false);
            const [error, setError] = useState<string | null>(null);

            if (block.props.path) {
                return (
                    <div className="pagelink-block" onClick={() => host.onOpenNote(block.props.path)}>
                        <span className="pagelink-block-label">Página</span>
                        {block.props.title}
                    </div>
                );
            }

            async function handleCreate() {
                if (!title.trim() || creating) return;
                setCreating(true);
                setError(null);
                try {
                    const path = await CreateNote(host.parentPath, title, '');
                    editor.updateBlock(block, { props: { path, title } });
                    host.onNoteCreated();
                } catch (err) {
                    setError(String(err));
                    setCreating(false);
                }
            }

            return (
                <div className="pagelink-block pagelink-block-editing" contentEditable={false}>
                    <span className="pagelink-block-label">Página</span>
                    <input
                        autoFocus
                        placeholder="Título da nova página"
                        value={title}
                        disabled={creating}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreate();
                            }
                        }}
                    />
                    <button onClick={handleCreate} disabled={creating}>
                        {creating ? 'Criando…' : 'Criar'}
                    </button>
                    {error && <span className="error">{error}</span>}
                </div>
            );
        },
    },
);

registerBlockSerializer('pageLink', (block) => (block.props.title ? `[[${block.props.title}]]` : ''));
