// Small hand-authored outline icons (thin stroke, Lucide-like) used in place
// of emoji throughout the app's chrome — the Sheepdog Design System
// explicitly bans emoji ("No emoji. Ever.") and recommends this exact
// visual style. Kept as inline SVG rather than pulling the Lucide package
// from a CDN so the app stays usable fully offline (see CLAUDE.md).
interface IconProps {
    size?: number;
}

const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

export function FolderIcon({ size = 15 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...common}>
            <path d="M3 6.5a1 1 0 0 1 1-1h5l2 2.5h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        </svg>
    );
}

export function NoteIcon({ size = 15 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...common}>
            <path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-18a.5.5 0 0 1 .5-.5z" />
            <path d="M14 2.5V7h4" />
            <path d="M8 12.5h8M8 16h5.5" />
        </svg>
    );
}

export function SidebarCollapseIcon({ size = 16 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" {...common}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9.5 4v16" />
        </svg>
    );
}
