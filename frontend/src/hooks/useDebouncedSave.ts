import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'saved' | 'pending' | 'saving';

const DEFAULT_DEBOUNCE_MS = 800;

// Shared debounce/flush-on-unmount logic for autosave. Assumes the owning
// component is mounted fresh (via a stable `key`) whenever the thing being
// saved (e.g. a note path) changes, so `save`'s closure never goes stale
// mid-life even though the flush-on-unmount effect only ever sees the
// mount-time closure (deps intentionally empty).
export function useDebouncedSave<T>(save: (value: T) => Promise<void>, debounceMs = DEFAULT_DEBOUNCE_MS) {
    const [status, setStatus] = useState<SaveStatus>('saved');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<T | null>(null);

    function flush(): Promise<void> {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const toSave = pendingRef.current;
        if (toSave === null) return Promise.resolve();
        pendingRef.current = null;
        setStatus('saving');
        return save(toSave).then(() => setStatus('saved'));
    }

    useEffect(() => {
        return () => {
            flush();
        };
    }, []);

    function schedule(value: T) {
        pendingRef.current = value;
        setStatus('pending');
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, debounceMs);
    }

    return { status, schedule, flush };
}
