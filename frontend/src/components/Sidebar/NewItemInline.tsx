import { useState } from 'react';

interface NewItemInlineProps {
    placeholder: string;
    onSubmit: (name: string) => void;
    onCancel: () => void;
}

function NewItemInline({ placeholder, onSubmit, onCancel }: NewItemInlineProps) {
    const [value, setValue] = useState('');
    const [submitted, setSubmitted] = useState(false);

    function submit() {
        if (submitted) return;
        const trimmed = value.trim();
        setSubmitted(true);
        if (trimmed) {
            onSubmit(trimmed);
        } else {
            onCancel();
        }
    }

    return (
        <input
            className="new-item-input"
            autoFocus
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') {
                    setSubmitted(true);
                    onCancel();
                }
            }}
        />
    );
}

export default NewItemInline;
