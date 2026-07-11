import { useEffect, useState } from 'react';
import './App.css';
import { GetVaultPath } from '../wailsjs/go/main/ConfigService';
import FirstRun from './components/FirstRun';
import MainLayout from './components/MainLayout';

function App() {
    const [vaultPath, setVaultPath] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        GetVaultPath()
            .then((path) => setVaultPath(path || null))
            .catch(() => setVaultPath(null));
    }, []);

    if (vaultPath === undefined) {
        return <div className="loading">Carregando...</div>;
    }

    if (!vaultPath) {
        return <FirstRun onVaultChosen={setVaultPath} />;
    }

    return <MainLayout vaultPath={vaultPath} onVaultMissing={() => setVaultPath(null)} />;
}

export default App;
