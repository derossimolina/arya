import { useEffect, useRef, useState } from 'react';
import { Search } from '../../../wailsjs/go/main/SearchService';
import { index } from '../../../wailsjs/go/models';

interface CommandPaletteProps {
    onClose: () => void;
    onOpenNote: (path: string) => void;
}

// Renders an FTS5 snippet (plain text with literal "<mark>"/"</mark>"
// markers around the match, not real HTML) as React nodes instead of
// dangerouslySetInnerHTML — the snippet is built from note content the user
// wrote, not markup we should ever parse/inject as HTML.
function Snippet({ text }: { text: string }) {
    const parts = text.split(/(<mark>|<\/mark>)/);
    let marking = false;
    return (
        <>
            {parts.map((part, i) => {
                if (part === '<mark>') {
                    marking = true;
                    return null;
                }
                if (part === '</mark>') {
                    marking = false;
                    return null;
                }
                return marking ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>;
            })}
        </>
    );
}

function CommandPalette({ onClose, onOpenNote }: CommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<index.SearchResult[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim() === '') {
            setResults([]);
            setActiveIndex(0);
            return;
        }
        debounceRef.current = setTimeout(() => {
            Search(query)
                .then((r) => {
                    setResults(r);
                    setActiveIndex(0);
                    setError(null);
                })
                .catch((err) => setError(String(err)));
        }, 150);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    function openResult(path: string) {
        onOpenNote(path);
        onClose();
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const active = results[activeIndex];
            if (active) openResult(active.path);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal command-palette" onClick={(e) => e.stopPropagation()}>
                <input
                    ref={inputRef}
                    className="command-palette-input"
                    type="text"
                    placeholder="Buscar notas…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                {error && <div className="error">{error}</div>}
                <ul className="command-palette-results">
                    {results.map((r, i) => (
                        <li
                            key={r.path}
                            className={i === activeIndex ? 'command-palette-result active' : 'command-palette-result'}
                            onMouseEnter={() => setActiveIndex(i)}
                            onClick={() => openResult(r.path)}
                        >
                            <div className="command-palette-result-title">{r.title}</div>
                            <div className="command-palette-result-snippet">
                                <Snippet text={r.snippet} />
                            </div>
                        </li>
                    ))}
                    {query.trim() !== '' && results.length === 0 && !error && (
                        <li className="command-palette-empty">Nenhum resultado.</li>
                    )}
                </ul>
            </div>
        </div>
    );
}

export default CommandPalette;
