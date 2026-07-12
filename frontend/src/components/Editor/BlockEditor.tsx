import { useEffect, useRef, useState } from 'react';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { filterSuggestionItems } from '@blocknote/core/extensions';
import {
    useCreateBlockNote,
    getDefaultReactSlashMenuItems,
    SuggestionMenuController,
    DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import '@blocknote/ariakit/style.css';
import { EditorHostProvider } from './EditorHostContext';
import { pageLinkBlockSpec } from './blocks/pageLinkBlock';
import { wikilinkInlineContentSpec } from './blocks/wikilinkInlineContent';
import { getCustomSlashMenuItems } from './blocks/slashMenuItems';
import { parseMarkdownToBlocks, serializeDocumentToMarkdown } from './blockMarkdown';
import { Search } from '../../../wailsjs/go/main/SearchService';

// The block/inline-content schema is shared module-level state (not
// per-editor-instance): every phase that adds a custom type registers it
// here once, so any BlockEditor instance in the app can parse/render/insert
// it.
const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        pageLink: pageLinkBlockSpec(),
    },
    inlineContentSpecs: {
        ...defaultInlineContentSpecs,
        wikilink: wikilinkInlineContentSpec,
    },
});

interface BlockEditorProps {
    value: string; // markdown body — the note's `Body`, never a proprietary format
    onChange: (markdown: string) => void;
    parentPath: string;
    onOpenNote: (path: string) => void;
    onNoteCreated: () => void;
}

// Notion-style block editor with a "/" slash menu, replacing the plain
// markdown CodeMirror editor for a note's body. Internally BlockNote keeps
// its own block-tree document, but the only thing that ever leaves this
// component (via onChange) — and the only thing it's ever initialized from
// (via value) — is plain markdown text, since that's the vault's on-disk
// source of truth (see CLAUDE.md's "arquivos em disco são a única fonte da
// verdade"). See blockMarkdown.ts for the (de)serialization boundary.
function BlockEditor({ value, onChange, parentPath, onOpenNote, onNoteCreated }: BlockEditorProps) {
    const editor = useCreateBlockNote({ schema });
    const [ready, setReady] = useState(false);
    const loadedValueRef = useRef<string | null>(null);
    const suppressChangeRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const blocks = await parseMarkdownToBlocks(editor, value);
            if (cancelled) return;
            suppressChangeRef.current = true;
            editor.replaceBlocks(
                editor.document,
                (blocks.length > 0 ? blocks : [{ type: 'paragraph' }]) as typeof editor.document,
            );
            loadedValueRef.current = value;
            suppressChangeRef.current = false;
            setReady(true);
        }
        load();
        return () => {
            cancelled = true;
        };
        // Intentionally only on mount: BlockEditor is remounted with a fresh
        // `key` by its parent whenever the underlying note/body-mode changes
        // (same convention as NoteEditor/TypedNoteView elsewhere), so `value`
        // never changes out from under an already-loaded instance.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <EditorHostProvider value={{ parentPath, onOpenNote, onNoteCreated }}>
            <BlockNoteView
                editor={editor}
                theme="light"
                slashMenu={false}
                onChange={() => {
                    if (suppressChangeRef.current || !ready) return;
                    onChange(serializeDocumentToMarkdown(editor));
                }}
            >
                <SuggestionMenuController
                    triggerCharacter="/"
                    getItems={async (query) => {
                        const items: DefaultReactSuggestionItem[] = [
                            ...getDefaultReactSlashMenuItems(editor),
                            ...getCustomSlashMenuItems(editor),
                        ];
                        return filterSuggestionItems<DefaultReactSuggestionItem>(items, query);
                    }}
                />
                <SuggestionMenuController
                    triggerCharacter="[["
                    getItems={async (query) => {
                        if (!query.trim()) return [];
                        const results = await Search(query);
                        return results.map((r) => ({
                            title: r.title,
                            subtext: r.path,
                            onItemClick: () => {
                                editor.insertInlineContent([
                                    { type: 'wikilink', props: { path: r.path, title: r.title } },
                                    ' ',
                                ]);
                            },
                        }));
                    }}
                />
            </BlockNoteView>
        </EditorHostProvider>
    );
}

export default BlockEditor;
