import { useEffect, useState } from 'react';
import { QueryByType } from '../../../wailsjs/go/main/IndexService';
import { index, schema } from '../../../wailsjs/go/models';

interface ViewRendererProps {
    schemaId: string;
    view: schema.View;
    onOpenNote: (path: string) => void;
    onClose: () => void;
}

function ViewRenderer({ schemaId, view, onOpenNote, onClose }: ViewRendererProps) {
    const [rows, setRows] = useState<index.ObjectRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setRows(null);
        setError(null);
        QueryByType(schemaId)
            .then(setRows)
            .catch((err) => setError(String(err)));
    }, [schemaId]);

    return (
        <div className="view-renderer">
            <div className="view-renderer-header">
                <h2>{view.name}</h2>
                <button onClick={onClose}>Fechar</button>
            </div>
            {error && <div className="error">{error}</div>}
            {!error && rows === null && <div className="loading">Carregando…</div>}
            {!error && rows !== null && view.type === 'kanban' && (
                <KanbanView rows={rows} groupBy={view.groupBy ?? ''} onOpenNote={onOpenNote} />
            )}
            {!error && rows !== null && view.type !== 'kanban' && (
                <TableView rows={rows} columns={view.columns ?? []} onOpenNote={onOpenNote} />
            )}
        </div>
    );
}

function TableView({
    rows,
    columns,
    onOpenNote,
}: {
    rows: index.ObjectRow[];
    columns: string[];
    onOpenNote: (path: string) => void;
}) {
    return (
        <table className="view-table">
            <thead>
                <tr>
                    <th>Título</th>
                    {columns.map((col) => (
                        <th key={col}>{col}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.path} onClick={() => onOpenNote(row.path)} className="view-table-row">
                        <td>{row.title || row.path}</td>
                        {columns.map((col) => (
                            <td key={col}>{row.properties[col] ?? ''}</td>
                        ))}
                    </tr>
                ))}
                {rows.length === 0 && (
                    <tr>
                        <td colSpan={columns.length + 1}>Nenhuma nota deste tipo ainda.</td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function KanbanView({
    rows,
    groupBy,
    onOpenNote,
}: {
    rows: index.ObjectRow[];
    groupBy: string;
    onOpenNote: (path: string) => void;
}) {
    const columns = new Map<string, index.ObjectRow[]>();
    for (const row of rows) {
        const value = row.properties[groupBy] || '(vazio)';
        if (!columns.has(value)) columns.set(value, []);
        columns.get(value)!.push(row);
    }

    if (columns.size === 0) {
        return <div className="empty">Nenhuma nota deste tipo ainda.</div>;
    }

    return (
        <div className="kanban-board">
            {[...columns.entries()].map(([value, items]) => (
                <div className="kanban-column" key={value}>
                    <h4>{value}</h4>
                    {items.map((item) => (
                        <div className="kanban-card" key={item.path} onClick={() => onOpenNote(item.path)}>
                            {item.title || item.path}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default ViewRenderer;
