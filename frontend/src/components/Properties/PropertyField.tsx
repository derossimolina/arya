import { schema } from '../../../wailsjs/go/models';

interface PropertyFieldProps {
    property: schema.Property;
    value: unknown;
    onChange: (value: unknown) => void;
}

// Generic dispatcher: renders the widget appropriate for a property's
// `kind`. This is the concrete implementation of CLAUDE.md's
// <PropertyField kind={...} /> sketch — any type a user defines gets a
// working editor for free, driven only by data (the schema), never by
// per-type code.
function PropertyField({ property, value, onChange }: PropertyFieldProps) {
    switch (property.kind) {
        case 'text':
            return <TextField value={value} onChange={onChange} />;
        case 'number':
            return <NumberField value={value} onChange={onChange} />;
        case 'date':
            return <DateField value={value} onChange={onChange} />;
        case 'select':
            return <SelectField options={property.options ?? []} value={value} onChange={onChange} />;
        case 'multi_select':
            return <MultiSelectField options={property.options ?? []} value={value} onChange={onChange} />;
        case 'checkbox':
            return <CheckboxField value={value} onChange={onChange} />;
        case 'relation':
            return <RelationField multiple={!!property.multiple} value={value} onChange={onChange} />;
        case 'file':
            return <FileField value={value} onChange={onChange} />;
        case 'url':
            return <UrlField value={value} onChange={onChange} />;
        default:
            return <div className="property-unknown-kind">tipo de propriedade desconhecido: {property.kind}</div>;
    }
}

interface WidgetProps {
    value: unknown;
    onChange: (value: unknown) => void;
}

function TextField({ value, onChange }: WidgetProps) {
    return (
        <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function NumberField({ value, onChange }: WidgetProps) {
    return (
        <input
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
    );
}

function DateField({ value, onChange }: WidgetProps) {
    return (
        <input
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function SelectField({ options, value, onChange }: WidgetProps & { options: string[] }) {
    return (
        <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
            <option value=""></option>
            {options.map((opt) => (
                <option key={opt} value={opt}>
                    {opt}
                </option>
            ))}
        </select>
    );
}

function MultiSelectField({ options, value, onChange }: WidgetProps & { options: string[] }) {
    const selected: string[] = Array.isArray(value) ? value : [];

    function toggle(opt: string) {
        if (selected.includes(opt)) {
            onChange(selected.filter((v) => v !== opt));
        } else {
            onChange([...selected, opt]);
        }
    }

    return (
        <div className="multi-select-field">
            {options.map((opt) => (
                <label key={opt}>
                    <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                    <span className="tag-hash">#</span>
                    {opt}
                </label>
            ))}
        </div>
    );
}

function CheckboxField({ value, onChange }: WidgetProps) {
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
}

// No note-picker yet (needs the SQLite index from a later slice to query
// "all notes of type X") — a plain manual text input for now.
function RelationField({ multiple, value, onChange }: WidgetProps & { multiple: boolean }) {
    if (multiple) {
        const text = Array.isArray(value) ? value.join(', ') : '';
        return (
            <input
                type="text"
                placeholder="separado por vírgula"
                value={text}
                onChange={(e) =>
                    onChange(
                        e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                    )
                }
            />
        );
    }
    return (
        <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

// Plain path text field for now — same reasoning as RelationField, a real
// file picker isn't worth building before the index exists.
function FileField({ value, onChange }: WidgetProps) {
    return (
        <input
            type="text"
            placeholder="caminho do arquivo"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function UrlField({ value, onChange }: WidgetProps) {
    return (
        <input
            type="url"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export default PropertyField;
