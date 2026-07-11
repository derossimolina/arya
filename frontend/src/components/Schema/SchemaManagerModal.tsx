import { useEffect, useState } from 'react';
import { ListSchemas, DeleteSchema } from '../../../wailsjs/go/main/SchemaService';
import { schema } from '../../../wailsjs/go/models';
import SchemaEditorPanel from './SchemaEditorPanel';

interface SchemaManagerModalProps {
    onClose: () => void;
    onOpenView: (schemaId: string, view: schema.View) => void;
}

// undefined = list view, null = creating a new type, string = editing that id
type EditingState = string | null | undefined;

function SchemaManagerModal({ onClose, onOpenView }: SchemaManagerModalProps) {
    const [schemas, setSchemas] = useState<schema.LoadedSchema[]>([]);
    const [editing, setEditing] = useState<EditingState>(undefined);
    const [error, setError] = useState<string | null>(null);

    function reload() {
        ListSchemas()
            .then(setSchemas)
            .catch((err) => setError(String(err)));
    }

    useEffect(() => {
        reload();
    }, []);

    async function handleDelete(id: string) {
        try {
            await DeleteSchema(id);
            reload();
        } catch (err) {
            setError(String(err));
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal schema-manager-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Tipos</h2>
                    <button onClick={onClose}>Fechar</button>
                </div>
                {error && <div className="error">{error}</div>}
                {editing !== undefined ? (
                    <SchemaEditorPanel
                        schemaId={editing}
                        allSchemas={schemas}
                        onSaved={() => {
                            setEditing(undefined);
                            reload();
                        }}
                        onCancel={() => setEditing(undefined)}
                    />
                ) : (
                    <>
                        <ul className="schema-list">
                            {schemas.map((s) => (
                                <li key={s.id} className="schema-list-row">
                                    <span>
                                        {s.schema.icon ? `${s.schema.icon} ` : ''}
                                        {s.schema.name || s.id} <em>({s.id})</em>
                                        {s.error && <span className="error"> — {s.error}</span>}
                                    </span>
                                    <div>
                                        {(s.schema.views ?? []).map((v, i) => (
                                            <button key={i} onClick={() => onOpenView(s.id, v)}>
                                                Ver: {v.name}
                                            </button>
                                        ))}
                                        <button onClick={() => setEditing(s.id)}>Editar</button>
                                        <button onClick={() => handleDelete(s.id)}>Apagar</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <button onClick={() => setEditing(null)}>+ Novo Tipo</button>
                    </>
                )}
            </div>
        </div>
    );
}

export default SchemaManagerModal;
