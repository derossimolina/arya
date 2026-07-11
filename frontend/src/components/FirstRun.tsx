import { useState } from 'react';
import { ChooseVaultPath } from '../../wailsjs/go/main/ConfigService';

interface FirstRunProps {
    onVaultChosen: (path: string) => void;
}

function FirstRun({ onVaultChosen }: FirstRunProps) {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function choose() {
        setError(null);
        setLoading(true);
        try {
            const path = await ChooseVaultPath();
            if (path) {
                onVaultChosen(path);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="first-run">
            <h1>Bem-vindo ao Arya</h1>
            <p>Escolha (ou crie) a pasta onde suas notas serão guardadas.</p>
            <button onClick={choose} disabled={loading}>
                {loading ? 'Abrindo...' : 'Escolher pasta do vault'}
            </button>
            {error && <p className="error">{error}</p>}
        </div>
    );
}

export default FirstRun;
