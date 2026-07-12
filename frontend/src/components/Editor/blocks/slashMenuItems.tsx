import type { BlockNoteEditor } from '@blocknote/core';
import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import type { DefaultReactSuggestionItem } from '@blocknote/react';

// Custom slash-menu entries, appended to BlockNote's own defaults (table,
// heading, list, etc. all come for free from getDefaultReactSlashMenuItems).
// Each phase that adds a custom block type appends its own item(s) here.
export function getCustomSlashMenuItems(editor: BlockNoteEditor<any, any, any>): DefaultReactSuggestionItem[] {
    return [
        {
            title: 'Criar página',
            subtext: 'Cria uma nova nota e insere um link para ela',
            aliases: ['pagina', 'página', 'page', 'nota'],
            group: 'Arya',
            icon: <span className="slash-menu-monogram">P</span>,
            onItemClick: () => {
                insertOrUpdateBlockForSlashMenu(editor, { type: 'pageLink' } as any);
            },
        },
    ];
}
