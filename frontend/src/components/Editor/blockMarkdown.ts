import type { Block, BlockNoteEditor } from '@blocknote/core';
import { isStyledTextInlineContent } from '@blocknote/core';
import { ResolveNoteTitle } from '../../../wailsjs/go/main/IndexService';

// Extension seam for blocks whose markdown shape BlockNote's own
// blocksToMarkdownLossy/tryParseMarkdownToBlocks can't round-trip (custom
// block types added from Phase 4 onward: kanban/cronograma view embeds,
// inline tasks, block references). Each phase registers a serializer here
// for its own block type(s) instead of every block type threading its own
// special case through BlockEditor.
type CustomSerializer = (block: Block<any, any, any>) => string | undefined;

const customSerializers: Record<string, CustomSerializer> = {};

export function registerBlockSerializer(blockType: string, serialize: CustomSerializer) {
    customSerializers[blockType] = serialize;
}

// BlockNote's own markdown exporter has no idea what our custom `wikilink`
// inline content type is — this swaps every such node in a block's content
// back into plain `[[title]]` text before handing the block to
// blocksToMarkdownLossy, so a wikilink anywhere in a sentence (not just
// alone on its own line) round-trips correctly to disk.
function inertWikilinksInBlock(block: Block<any, any, any>): Block<any, any, any> {
    if (!Array.isArray(block.content)) {
        return block;
    }
    let changed = false;
    const content = block.content.map((node: any) => {
        if (node.type === 'wikilink') {
            changed = true;
            return { type: 'text', text: `[[${node.props.title}]]`, styles: {} };
        }
        return node;
    });
    return changed ? { ...block, content } : block;
}

// Serializes the whole document block-by-block: a custom serializer (if one
// is registered for that block's type) takes priority, otherwise the block
// is delegated to BlockNote's own markdown exporter. Block-by-block (rather
// than calling blocksToMarkdownLossy once over the whole document) is what
// lets custom and native blocks be freely interleaved in one note.
export function serializeDocumentToMarkdown(editor: BlockNoteEditor<any, any, any>): string {
    const parts: string[] = [];
    for (const block of editor.document) {
        const custom = customSerializers[block.type];
        const md = custom?.(block);
        parts.push(md !== undefined ? md : editor.blocksToMarkdownLossy([inertWikilinksInBlock(block)]));
    }
    return parts.join('\n\n');
}

// Matches a paragraph whose *entire* content is one `[[title]]` token — the
// exact shape the pageLink *block* serializes to (see pageLinkBlock.tsx).
// Checked first so a page created via the "/Criar página" slash command
// keeps its nicer block-level card look across a save/reload round trip,
// rather than degrading to a plain inline link like any other wikilink.
const WIKILINK_WHOLE_LINE_RE = /^\[\[([^\]]+)\]\]$/;

// Matches every `[[title]]` occurrence anywhere in a run of text, for the
// general inline case (typed via the "[[" suggestion menu, or hand-written
// mid-sentence, same as Obsidian).
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

// BlockNote's default markdown parser has no idea what a `[[title]]` token
// means — it comes back as inert text. This walks the parsed result
// afterwards and resolves every such token to an existing note (via
// IndexService.ResolveNoteTitle), turning it back into a clickable
// reference — either the pageLink block (whole-line case) or an inline
// `wikilink` content node (mid-sentence case) — so links survive a
// save/reload round trip. Titles that don't match any note are left as
// plain text rather than a dead link. Later phases (arya-view fenced
// blocks, Logseq-style task property lines, block anchors) extend this same
// post-parse pass for their own marker syntax.
export async function parseMarkdownToBlocks(
    editor: BlockNoteEditor<any, any, any>,
    markdown: string,
): Promise<Block<any, any, any>[]> {
    const blocks = editor.tryParseMarkdownToBlocks(markdown);
    return Promise.all(blocks.map(resolveWikilinksInBlock));
}

async function resolveWikilinksInBlock(block: Block<any, any, any>): Promise<Block<any, any, any>> {
    if (block.type === 'paragraph' && Array.isArray(block.content) && block.content.length === 1) {
        const node = block.content[0];
        if (isStyledTextInlineContent(node)) {
            const whole = WIKILINK_WHOLE_LINE_RE.exec(node.text.trim());
            if (whole) {
                const path = await resolveTitle(whole[1]);
                if (path) {
                    return { ...block, type: 'pageLink', props: { ...block.props, path, title: whole[1] } } as Block<
                        any,
                        any,
                        any
                    >;
                }
            }
        }
    }

    if (!Array.isArray(block.content)) {
        return block;
    }

    const newContent: any[] = [];
    let changed = false;
    for (const node of block.content) {
        if (!isStyledTextInlineContent(node) || !node.text.includes('[[')) {
            newContent.push(node);
            continue;
        }
        const segments = await splitTextByWikilinks(node);
        changed = true;
        newContent.push(...segments);
    }
    return changed ? { ...block, content: newContent } : block;
}

async function splitTextByWikilinks(node: { text: string; styles: any }): Promise<any[]> {
    const parts: any[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    WIKILINK_RE.lastIndex = 0;
    while ((match = WIKILINK_RE.exec(node.text))) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', text: node.text.slice(lastIndex, match.index), styles: node.styles });
        }
        const title = match[1];
        const path = await resolveTitle(title);
        parts.push(
            path
                ? { type: 'wikilink', props: { path, title } }
                : { type: 'text', text: match[0], styles: node.styles },
        );
        lastIndex = WIKILINK_RE.lastIndex;
    }
    if (lastIndex < node.text.length) {
        parts.push({ type: 'text', text: node.text.slice(lastIndex), styles: node.styles });
    }
    return parts.length > 0 ? parts : [node];
}

async function resolveTitle(title: string): Promise<string> {
    try {
        return await ResolveNoteTitle(title);
    } catch {
        return '';
    }
}
