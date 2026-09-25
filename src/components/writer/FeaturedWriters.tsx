import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { api } from '../../lib/api';
import type { PublicWriter } from '../../lib/writerTypes';
import { WriterAvatar } from './WriterBits';

// Real writers from the public directory for menus and teasers — names,
// photos, degrees and ratings are the writers' own, never hardcoded personas.
// One request per page load, shared by every menu that shows them.
let featured: Promise<PublicWriter[]> | null = null;
const loadFeatured = () => {
    if (!featured) featured = api<{ writers: PublicWriter[] }>('/writers/public?limit=12').then(r => r.writers).catch(() => { featured = null; return []; });
    return featured;
};

export function useFeaturedWriters() {
    const [writers, setWriters] = useState<PublicWriter[] | null>(null);
    useEffect(() => { let live = true; loadFeatured().then(w => { if (live) setWriters(w); }); return () => { live = false; }; }, []);
    return writers;
}

const summary = (w: PublicWriter) => w.topDegree || w.headline || w.subjects[0] || 'Academic writer';
const rating = (w: PublicWriter) => (w.metrics.ratingCount ? `★ ${w.metrics.rating.toFixed(1)}/5` : 'New');

export function FeaturedWriterLink({ w, compact, onNavigate }: { w: PublicWriter; compact?: boolean; onNavigate?: () => void }) {
    return (
        <Link to={`/writer/${w.id}`} onClick={onNavigate}
            className={compact ? 'flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-100' : 'group/writer flex items-center gap-3 rounded-lg border border-transparent p-2 transition-all hover:border-gray-200 hover:bg-gray-50'}>
            <span className="relative shrink-0">
                <WriterAvatar writerId={w.id} name={w.name} hasPhoto={w.hasPhoto} version={w.photoVersion} size={compact ? 32 : 40} />
                {w.availability === 'AVAILABLE' && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" aria-label="Available" />}
            </span>
            <span className="min-w-0 overflow-hidden">
                <span className={`flex items-center gap-1 truncate font-bold text-[#000a1e] ${compact ? 'text-xs' : 'text-[13px] transition-colors group-hover/writer:text-[#fea520]'}`}>
                    <span className="truncate">{w.name}</span>
                    {w.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#b86e00]" aria-label="Verified writer" />}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400">
                    <span className="truncate">{summary(w)}</span>
                    <span className="h-1 w-1 shrink-0 rounded-full bg-gray-300" />
                    <span className="shrink-0 text-[#fea520]">{rating(w)}</span>
                </span>
            </span>
        </Link>
    );
}
