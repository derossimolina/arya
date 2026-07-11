import { useEffect, useState } from 'react';
import { ListSchemas } from '../../../wailsjs/go/main/SchemaService';
import { schema } from '../../../wailsjs/go/models';

interface NewNoteInlineProps {
    onSubmit: (title: string, typeID: string) => void;
    onCancel: () => void;
}

function NewNoteInline({ onSubmit, onCancel }: NewNoteInlineProps) {
    const [title, setTitle] = useState('');
    const [typeID, setTypeID] = useState('');
    const [types, setTypes] = useState<schema.LoadedSchema[]>([]);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        ListSchemas()
            .then((list) => setTypes(list.filter((s) => !s.error)))
            .catch(() => setTypes([]));
    }, []);

    function submit() {
        if (submitted) return;
        const trimmed = title.trim();
        setSubmitted(true);
        if (trimmed) {
            onSubmit(trimmed, typeID);
        } else {
            onCancel();
        }
    }

    function cancel() {
        if (submitted) return;
        setSubmitted(true);
        onCancel();
    }

    return (
        <div className="new-note-inline">
            <input
                className="new-item-input"
                autoFocus
                placeholder="Título da nota"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') cancel();
                }}
            />
            <select value={typeID} onChange={(e) => setTypeID(e.target.value)}>
                <option value="">Nota livre</option>
                {types.map((t) => (
                    <option key={t.id} value={t.id}>
                        {t.schema.icon ? `${t.schema.icon} ` : ''}
                        {t.schema.name || t.id}
                    </option>
                ))}
            </select>
            <div className="new-note-inline-actions">
                <button onClick={submit}>Criar</button>
                <button onClick={cancel}>Cancelar</button>
            </div>
        </div>
    );
}

export default NewNoteInline;
