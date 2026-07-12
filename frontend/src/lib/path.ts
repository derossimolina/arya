// Vault-relative paths are always forward-slash separated (see
// internal/vault's joinRel), regardless of host OS — mirrored here for any
// frontend code that needs a note's containing folder (e.g. to create a new
// page alongside it from a slash-menu block).
export function parentPathOf(path: string): string {
    const idx = path.lastIndexOf('/');
    return idx === -1 ? '' : path.slice(0, idx);
}
