import { createReactInlineContentSpec } from '@blocknote/react';
import { useEditorHost } from '../EditorHostContext';

// Inline (not block-level) wikilink reference — the real `[[title]]`
// behavior: usable mid-sentence, inserted via the "[[" suggestion menu
// (see BlockEditor.tsx) or restored on load by blockMarkdown.ts whenever a
// `[[title]]` token resolves to an existing note. Distinct from the
// `pageLink` *block* (blocks/pageLinkBlock.tsx), which is the "/Criar
// página" slash-command flow for creating a brand new note — this type is
// for referencing a note that already exists, anywhere in the text.
export const wikilinkInlineContentSpec = createReactInlineContentSpec(
    {
        type: 'wikilink',
        propSchema: {
            path: { default: '' },
            title: { default: '' },
        },
        content: 'none',
    },
    {
        render: (props) => {
            const host = useEditorHost();
            return (
                <span
                    className="wikilink-inline"
                    contentEditable={false}
                    onClick={() => host.onOpenNote(props.inlineContent.props.path)}
                >
                    {props.inlineContent.props.title}
                </span>
            );
        },
    },
);
