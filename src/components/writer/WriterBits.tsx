import React, { useEffect, useState } from 'react';
import { WRITER_STATUS_META, type WriterStatus } from '../../lib/writerOptions';
import { fetchFileUrl, writerPhotoUrl } from '../../lib/api';
import { cn } from '../../lib/utils';

export function StatusBadge({ status, className }: { status: WriterStatus; className?: string }) {
    const meta = WRITER_STATUS_META[status] || { label: status, className: 'bg-gray-100 text-gray-700 ring-gray-200' };
    return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', meta.className, className)}>{meta.label}</span>;
}

export function AvailabilityDot({ status, label = true }: { status: 'AVAILABLE' | 'UNAVAILABLE'; label?: boolean }) {
    const on = status === 'AVAILABLE';
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className={cn('h-2 w-2 rounded-full', on ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]' : 'bg-slate-300')} />
            {label && (on ? 'Available' : 'Unavailable')}
        </span>
    );
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

/**
 * Writer photo. `mode="public"` uses a plain <img> (listed writers);
 * `mode="private"` fetches with auth headers so owners/admins can see photos
 * of writers who aren't publicly listed yet.
 */
export function WriterAvatar({ writerId, name, hasPhoto, version, size = 48, mode = 'public', token, className, src }: {
    writerId?: string; name?: string; hasPhoto?: boolean; version?: number | null; size?: number;
    mode?: 'public' | 'private'; token?: string; className?: string; src?: string | null;
}) {
    const [privateUrl, setPrivateUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
        if (mode !== 'private' || !hasPhoto || !writerId || src) return;
        let revoked = false, url: string | null = null;
        fetchFileUrl(`/writers/${writerId}/photo?v=${version || ''}`, token)
            .then(u => { url = u; if (!revoked) setPrivateUrl(u); else URL.revokeObjectURL(u); })
            .catch(() => setFailed(true));
        return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
    }, [mode, hasPhoto, writerId, version, token, src]);

    const url = src || (hasPhoto && writerId ? (mode === 'public' ? writerPhotoUrl(writerId, version) : privateUrl) : null);
    const style = { width: size, height: size, fontSize: Math.max(12, size * 0.36) };

    if (url && !failed) {
        return <img loading="lazy" decoding="async" src={url} alt={name ? `${name}'s photo` : 'Writer photo'} style={style} onError={() => setFailed(true)}
            className={cn('shrink-0 rounded-full object-cover bg-slate-100', className)} />;
    }
    return (
        <span style={style} aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#002147] to-[#1d4f8c] font-bold text-white', className)}>
            {initials(name)}
        </span>
    );
}

export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Spinner({ className }: { className?: string }) {
    return <span className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-label="Loading" />;
}
