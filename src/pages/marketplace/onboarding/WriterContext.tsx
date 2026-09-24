import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../../lib/api';
import type { WriterMe } from '../../../lib/writerTypes';
import { useStore } from '../../../store/useStore';

type WriterCtx = {
    writer: WriterMe | null;
    loading: boolean;
    error: string;
    setWriter: (w: WriterMe) => void;
    refresh: () => Promise<void>;
};

const Ctx = createContext<WriterCtx | null>(null);

export function WriterProvider({ children }: { children: React.ReactNode }) {
    const [writer, setWriter] = useState<WriterMe | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const logout = useStore(s => s.logout);

    const refresh = useCallback(async () => {
        try {
            const data = await api<{ writer: WriterMe }>('/writers/me');
            setWriter(data.writer);
            setError('');
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                logout();
                navigate('/writer/login', { replace: true, state: { message: 'Your session has expired. Please sign in again.' } });
                return;
            }
            setError(err instanceof ApiError && err.status === 403
                ? 'This account is not a writer account. Sign in with the email you used to apply.'
                : (err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [logout, navigate]);

    useEffect(() => { refresh(); }, [refresh]);

    return <Ctx.Provider value={{ writer, loading, error, setWriter, refresh }}>{children}</Ctx.Provider>;
}

export function useWriter() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useWriter must be used inside <WriterProvider>');
    return ctx;
}
