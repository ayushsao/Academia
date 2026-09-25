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

// Shown only while no real writer has joined yet. Always labelled "Sample":
// no photos, degrees or ratings, so nobody mistakes them for real people.
export const SAMPLE_WRITERS: { name: string; country: string; area: string }[] = [
    { name: 'Ananya Iyer', country: 'India', area: 'Nursing & Healthcare' },
    { name: 'James Whitfield', country: 'United Kingdom', area: 'Law & Legal Studies' },
    { name: 'Chloe Nguyen', country: 'Australia', area: 'Psychology' },
    { name: 'Marcus Bell', country: 'United States', area: 'Business & Finance' },
    { name: 'Léa Moreau', country: 'France', area: 'Literature & Humanities' },
    { name: 'Rahul Mehta', country: 'India', area: 'Computer Science' },
    { name: 'Olivia Grant', country: 'Canada', area: 'Education' },
    { name: 'Lukas Weber', country: 'Germany', area: 'Engineering' },
];

const initials = (name: string) => name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

export function SampleWriterItem({ s, compact, onClick }: { s: (typeof SAMPLE_WRITERS)[number]; compact?: boolean; onClick?: () => void }) {
    return (
        <button type="button" onClick={onClick} title="Sample profile"
            className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${compact ? 'hover:bg-gray-100' : 'border border-transparent hover:border-gray-200 hover:bg-gray-50'}`}>
            <span className={`flex shrink-0 items-center justify-center rounded-full bg-[#002147] font-bold text-white ${compact ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs'}`}>{initials(s.name)}</span>
            <span className="min-w-0 overflow-hidden">
                <span className={`block truncate font-bold text-[#000a1e] ${compact ? 'text-xs' : 'text-[13px]'}`}>{s.name}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400">
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-px text-[9px] tracking-wide text-gray-500">Sample</span>
                    <span className="truncate">{s.area} · {s.country}</span>
                </span>
            </span>
        </button>
    );
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
