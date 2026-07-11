import { useEffect, useState } from 'react';
import { GetSchema, SaveSchema, ListKinds } from '../../../wailsjs/go/main/SchemaService';
import { schema } from '../../../wailsjs/go/models';

export interface PropertyRow {
    key: string;
    label: string;
    kind: string;
    required: boolean;
    optionsText: string; // comma-separated in the UI, array on the wire
    defaultText: string;
    relationType: string;
    multiple: boolean;
}

export interface SchemaPrefill {
    id?: string;
    name?: string;
    properties?: PropertyRow[];
}

export interface ViewRow {
    name: string;
    type: string; // 'table' | 'kanban'
    groupBy: string;
    columnsText: string; // comma-separated in the UI, array on the wire
}

function toViewRow(v: schema.View): ViewRow {
    return {
        name: v.name,
        type: v.type,
        groupBy: v.groupBy ?? '',
        columnsText: (v.columns ?? []).join(', '),
    };
}

function emptyViewRow(): ViewRow {
    return { name: '', type: 'table', groupBy: '', columnsText: '' };
}

interface SchemaEditorPanelProps {
    schemaId: string | null; // null = creating a new type
    allSchemas: schema.LoadedSchema[];
    // Only used when schemaId is null — seeds the "new type" form (e.g. from
    // properties inferred out of a note's existing frontmatter).
    prefill?: SchemaPrefill;
    onSaved: () => void;
    onCancel: () => void;
}

function toPropertyRow(p: schema.Property): PropertyRow {
    return {
        key: p.key,
        label: p.label,
        kind: p.kind,
        required: !!p.required,
        optionsText: (p.options ?? []).join(', '),
        defaultText: p.default === undefined || p.default === null ? '' : String(p.default),
        relationType: p.relationType ?? '',
        multiple: !!p.multiple,
    };
}

function emptyPropertyRow(): PropertyRow {
    return {
        key: '',
        label: '',
        kind: 'text',
        required: false,
        optionsText: '',
        defaultText: '',
        relationType: '',
        multiple: false,
    };
}

function parseDefault(text: string): unknown {
    if (text === '') return null;
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text.trim() !== '' && !Number.isNaN(Number(text))) return Number(text);
    return text;
}

// First version, deliberately minimal per CLAUDE.md's "formulário 'Novo
// Tipo'" — no live preview, no drag-to-reorder.
function SchemaEditorPanel({ schemaId, allSchemas, prefill, onSaved, onCancel }: SchemaEditorPanelProps) {
    const isNew = schemaId === null;
    const [id, setId] = useState(prefill?.id ?? '');
    const [name, setName] = useState(prefill?.name ?? prefill?.id ?? '');
    const [icon, setIcon] = useState('');
    const [color, setColor] = useState('');
    const [extendsId, setExtendsId] = useState('');
    const [properties, setProperties] = useState<PropertyRow[]>(prefill?.properties ?? []);
    const [views, setViews] = useState<ViewRow[]>([]);
    const [template, setTemplate] = useState('');
    const [kinds, setKinds] = useState<schema.KindMeta[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(!isNew);

    useEffect(() => {
        ListKinds()
            .then(setKinds)
            .catch(() => setKinds([]));
    }, []);

    useEffect(() => {
        if (isNew) return;
        GetSchema(schemaId!)
            .then((s) => {
                setId(s.id);
                setName(s.name);
                setIcon(s.icon ?? '');
                setColor(s.color ?? '');
                setExtendsId(s.extends ?? '');
                setProperties((s.properties ?? []).map(toPropertyRow));
                setViews((s.views ?? []).map(toViewRow));
                setTemplate(s.template ?? '');
                setLoading(false);
            })
            .catch((err) => {
                setError(String(err));
                setLoading(false);
            });
    }, [schemaId, isNew]);

    function addProperty() {
        setProperties((prev) => [...prev, emptyPropertyRow()]);
    }

    function updateProperty(index: number, patch: Partial<PropertyRow>) {
        setProperties((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    }

    function removeProperty(index: number) {
        setProperties((prev) => prev.filter((_, i) => i !== index));
    }

    function addView() {
        setViews((prev) => [...prev, emptyViewRow()]);
    }

    function updateView(index: number, patch: Partial<ViewRow>) {
        setViews((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
    }

    function removeView(index: number) {
        setViews((prev) => prev.filter((_, i) => i !== index));
    }

    async function save() {
        setError(null);
        const payload = new schema.Schema({
            id,
            name,
            icon,
            color,
            extends: extendsId,
            template,
            properties: properties.map((p) => ({
                key: p.key,
                label: p.label,
                kind: p.kind,
                required: p.required,
                options: p.optionsText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                default: parseDefault(p.defaultText),
                relationType: p.kind === 'relation' ? p.relationType : '',
                multiple: p.multiple,
            })),
            views: views
                .filter((v) => v.name.trim() !== '')
                .map((v) => ({
                    name: v.name,
                    type: v.type,
                    groupBy: v.type === 'kanban' ? v.groupBy : '',
                    columns: v.columnsText
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                })),
        });

        try {
            await SaveSchema(payload);
            onSaved();
        } catch (err) {
            setError(String(err));
        }
    }

    if (loading) return <div className="loading">Carregando…</div>;

    return (
        <div className="schema-editor-panel">
            <div className="form-row">
                <label>ID</label>
                <input value={id} disabled={!isNew} onChange={(e) => setId(e.target.value)} />
            </div>
            <div className="form-row">
                <label>Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-row">
                <label>Ícone</label>
                <input value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div className="form-row">
                <label>Cor</label>
                <input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div className="form-row">
                <label>Estende</label>
                <select value={extendsId} onChange={(e) => setExtendsId(e.target.value)}>
                    <option value="">(nenhum)</option>
                    {allSchemas
                        .filter((s) => s.id !== id)
                        .map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.schema.name || s.id}
                            </option>
                        ))}
                </select>
            </div>

            <h3>Propriedades</h3>
            {properties.map((p, i) => (
                <div className="property-editor-row" key={i}>
                    <input
                        placeholder="key"
                        value={p.key}
                        onChange={(e) => updateProperty(i, { key: e.target.value })}
                    />
                    <input
                        placeholder="label"
                        value={p.label}
                        onChange={(e) => updateProperty(i, { label: e.target.value })}
                    />
                    <select value={p.kind} onChange={(e) => updateProperty(i, { kind: e.target.value })}>
                        {kinds.map((k) => (
                            <option key={k.kind} value={k.kind}>
                                {k.label}
                            </option>
                        ))}
                    </select>
                    <label>
                        <input
                            type="checkbox"
                            checked={p.required}
                            onChange={(e) => updateProperty(i, { required: e.target.checked })}
                        />
                        obrigatório
                    </label>
                    <input
                        placeholder="opções (a, b, c)"
                        value={p.optionsText}
                        onChange={(e) => updateProperty(i, { optionsText: e.target.value })}
                    />
                    <input
                        placeholder="default"
                        value={p.defaultText}
                        onChange={(e) => updateProperty(i, { defaultText: e.target.value })}
                    />
                    {p.kind === 'relation' && (
                        <input
                            placeholder="relation_type"
                            value={p.relationType}
                            onChange={(e) => updateProperty(i, { relationType: e.target.value })}
                        />
                    )}
                    <label>
                        <input
                            type="checkbox"
                            checked={p.multiple}
                            onChange={(e) => updateProperty(i, { multiple: e.target.checked })}
                        />
                        múltiplo
                    </label>
                    <button onClick={() => removeProperty(i)}>Remover</button>
                </div>
            ))}
            <button onClick={addProperty}>+ Propriedade</button>

            <h3>Views</h3>
            {views.map((v, i) => (
                <div className="view-editor-row" key={i}>
                    <input
                        placeholder="nome"
                        value={v.name}
                        onChange={(e) => updateView(i, { name: e.target.value })}
                    />
                    <select value={v.type} onChange={(e) => updateView(i, { type: e.target.value })}>
                        <option value="table">Tabela</option>
                        <option value="kanban">Kanban</option>
                    </select>
                    {v.type === 'kanban' ? (
                        <input
                            placeholder="agrupar por (key da propriedade)"
                            value={v.groupBy}
                            onChange={(e) => updateView(i, { groupBy: e.target.value })}
                        />
                    ) : (
                        <input
                            placeholder="colunas (key1, key2, ...)"
                            value={v.columnsText}
                            onChange={(e) => updateView(i, { columnsText: e.target.value })}
                        />
                    )}
                    <button onClick={() => removeView(i)}>Remover</button>
                </div>
            ))}
            <button onClick={addView}>+ View</button>

            <h3>Template</h3>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={6} />

            {error && <div className="error">{error}</div>}

            <div className="schema-editor-actions">
                <button onClick={save}>Salvar</button>
                <button onClick={onCancel}>Cancelar</button>
            </div>
        </div>
    );
}

export default SchemaEditorPanel;
