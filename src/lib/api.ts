const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.endsWith('.local')
);

export const API = String((import.meta as any).env.VITE_API_URL || (isLocal ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api')).trim().replace(/\/+$/, '');

export class ApiError extends Error {
    constructor(message: string, public status: number, public data: any) { super(message); }
}

type ApiOptions = { method?: string; body?: unknown; token?: string; signal?: AbortSignal };

// JSON/FormData request helper. The global fetch interceptor in main.tsx
// attaches the signed-in user's token; pass `token` to use a different one (admin).
export async function api<T = any>(path: string, { method = 'GET', body, token, signal }: ApiOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

    let res: Response;
    try {
        res = await fetch(`${API}${path}`, { method, headers, body: payload, signal });
    } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        throw new ApiError('Network error. Check your connection and try again.', 0, null);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
    return data as T;
}

// Fetches a protected file with auth headers and returns an object URL.
// Callers must URL.revokeObjectURL() it when done.
export async function fetchFileUrl(path: string, token?: string): Promise<string> {
    const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError('Could not open file.', res.status, null);
    return URL.createObjectURL(await res.blob());
}

export async function openProtectedFile(path: string, token?: string) {
    // Open the tab synchronously so popup blockers allow it, then point it at the blob.
    const win = window.open('', '_blank');
    try {
        const url = await fetchFileUrl(path, token);
        if (win) win.location.href = url; else window.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
        win?.close();
        throw err;
    }
}

export const writerPhotoUrl = (writerId: string, version?: number | null) =>
    `${API}/writers/${writerId}/photo${version ? `?v=${version}` : ''}`;
