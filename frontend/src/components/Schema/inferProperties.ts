import type { PropertyRow } from './SchemaEditorPanel';

const RESERVED_KEYS = new Set(['title', 'type', 'created']);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

function capitalize(text: string): string {
    return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

function guessKind(value: unknown): string {
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'multi_select';
    if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) return 'date';
    return 'text';
}

// Turns whatever's already in a note's frontmatter into a starting-point
// property list for the "create this type now" flow — best-effort guesses
// the user reviews/adjusts in the form, not a final answer (there's no
// reliable way to tell e.g. a "url" or "select" apart from a plain string
// just by looking at one example value).
export function inferPropertiesFromFrontmatter(frontmatter: Record<string, unknown>): PropertyRow[] {
    return Object.keys(frontmatter)
        .filter((key) => !RESERVED_KEYS.has(key))
        .map((key) => {
            const value = frontmatter[key];
            return {
                key,
                label: capitalize(key),
                kind: guessKind(value),
                required: false,
                optionsText: '',
                defaultText: '',
                relationType: '',
                multiple: Array.isArray(value),
            };
        });
}
