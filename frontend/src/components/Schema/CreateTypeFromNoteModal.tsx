import { useEffect, useState } from 'react';
import { ListSchemas } from '../../../wailsjs/go/main/SchemaService';
import { schema } from '../../../wailsjs/go/models';
import SchemaEditorPanel from './SchemaEditorPanel';
import { inferPropertiesFromFrontmatter } from './inferProperties';

interface CreateTypeFromNoteModalProps {
    typeID: string;
    frontmatter: Record<string, unknown>;
    onCreated: () => void;
    onCancel: () => void;
}

// Opens when a note's frontmatter references a `type` that has no schema
// yet — lets the user create that schema on the spot, pre-filled with
// properties guessed from the values already sitting in the frontmatter.
function CreateTypeFromNoteModal({ typeID, frontmatter, onCreated, onCancel }: CreateTypeFromNoteModalProps) {
    const [allSchemas, setAllSchemas] = useState<schema.LoadedSchema[]>([]);

    useEffect(() => {
        ListSchemas()
            .then(setAllSchemas)
            .catch(() => setAllSchemas([]));
    }, []);

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal schema-manager-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Criar tipo "{typeID}"</h2>
                    <button onClick={onCancel}>Fechar</button>
                </div>
                <p className="modal-hint">
                    As propriedades abaixo foram sugeridas a partir do frontmatter desta nota — revise o
                    <code> kind</code> de cada uma antes de salvar.
                </p>
                <SchemaEditorPanel
                    schemaId={null}
                    allSchemas={allSchemas}
                    prefill={{ id: typeID, properties: inferPropertiesFromFrontmatter(frontmatter) }}
                    onSaved={onCreated}
                    onCancel={onCancel}
                />
            </div>
        </div>
    );
}

export default CreateTypeFromNoteModal;
