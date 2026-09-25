import React, { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import type { BlockType, EntityType } from '../../../../lib/catalogContent';
import { fieldClass, type CatalogStatus, type Options } from './shared';

// ── Types (mirror /api/admin/catalog content responses) ────────────────────────
export type BlockMedia = { mediaId: string; storedName: string; originalName: string; mimeType: string; kind: 'IMAGE' | 'FILE'; alt: string };
export type AdminBlock = { _id: string; entityType: EntityType; entityId: string; type: BlockType; title: string; content: Record<string, any>; media: BlockMedia[]; sortOrder: number; status: CatalogStatus };
export type AdminFaq = { _id: string; entityType: EntityType; entityId: string; question: string; answer: string; sortOrder: number; status: CatalogStatus };
export type SeoFields = { metaTitle?: string; metaDescription?: string; keywords?: string[]; canonicalUrl?: string; ogTitle?: string; ogDescription?: string; ogImage?: { storedName: string; originalName: string } | null; robots?: string };
export type ContentEntity = { type: EntityType; id: string; name: string; slug: string; status: CatalogStatus; published: boolean; path: string; live: boolean; seo: SeoFields; description: string; hasImage: boolean };
export type SeoDefaults = { title: string; description: string; canonical: string; og: { image: string | null } };
export type EntityRef = { type: EntityType; id: string; name: string };

export const ENTITY_PATH: Record<EntityType, string> = { SUBJECT: '/subjects', SERVICE: '/services', PROJECT: '/projects' };
export const ENTITY_LABEL: Record<EntityType, string> = { SUBJECT: 'Subject', SERVICE: 'Service', PROJECT: 'Project' };
export const adminMediaUrl = (storedName: string) => `/api/admin/catalog/media/${storedName}`;

// Drag-and-drop (HTML5) plus explicit up/down moves for keyboard users.
export function useReorder<T>(items: T[], commit: (next: T[]) => void) {
    const [drag, setDrag] = useState<number | null>(null);
    const [over, setOver] = useState<number | null>(null);
    const move = (from: number, to: number) => {
        if (from === to || to < 0 || to >= items.length) return;
        const next = [...items];
        const [x] = next.splice(from, 1);
        next.splice(to, 0, x);
        commit(next);
    };
    const rowProps = (i: number, enabled = true) => enabled ? {
        draggable: true,
        onDragStart: (e: React.DragEvent) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); },
        onDragOver: (e: React.DragEvent) => { if (drag === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(i); },
        onDrop: (e: React.DragEvent) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); },
        onDragEnd: () => { setDrag(null); setOver(null); },
    } : {};
    return { move, rowProps, drag, over };
}

export function MoveControls({ index, count, onMove, label }: { index: number; count: number; onMove: (from: number, to: number) => void; label: string }) {
    return (
        <div className="flex shrink-0 items-center gap-0.5 text-gray-400">
            <GripVertical className="hidden h-4 w-4 cursor-grab sm:block" aria-hidden />
            <div className="flex flex-col">
                <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label={`Move ${label} up`} className="rounded p-0.5 hover:bg-gray-100 hover:text-[#000a1e] disabled:opacity-25"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === count - 1} aria-label={`Move ${label} down`} className="rounded p-0.5 hover:bg-gray-100 hover:text-[#000a1e] disabled:opacity-25"><ArrowDown className="h-3.5 w-3.5" /></button>
            </div>
        </div>
    );
}

// One select for any subject / service / project ("assign to").
export function EntitySelect({ id, value, onChange, options }: { id?: string; value: { type: EntityType; id: string }; onChange: (v: { type: EntityType; id: string }) => void; options: Options }) {
    const subjectName = (sid: string) => options.subjects.find(s => s._id === sid)?.name || '?';
    const serviceName = (sid: string) => options.services.find(s => s._id === sid)?.name || '?';
    return (
        <select id={id} value={`${value.type}:${value.id}`} onChange={e => { const [type, eid] = e.target.value.split(':'); onChange({ type: type as EntityType, id: eid }); }} className={fieldClass}>
            <optgroup label="Subjects">{options.subjects.map(s => <option key={s._id} value={`SUBJECT:${s._id}`}>{s.name}</option>)}</optgroup>
            <optgroup label="Services">{options.services.map(s => <option key={s._id} value={`SERVICE:${s._id}`}>{subjectName(s.subjectId)} › {s.name}</option>)}</optgroup>
            <optgroup label="Projects">{options.projects.map(p => <option key={p._id} value={`PROJECT:${p._id}`}>{serviceName(p.serviceId)} › {p.title}</option>)}</optgroup>
        </select>
    );
}

// Unsaved drafts are previewed in the admin's own browser before the server has
// sanitised them: strip anything executable first (the saved copy is cleaned server-side).
export function scrubHtml(html: string) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    doc.querySelectorAll('script,style,object,embed,link,meta,base,form,iframe').forEach(n => n.remove());
    doc.body.querySelectorAll('*').forEach(el => {
        for (const attr of Array.from(el.attributes)) {
            const v = attr.value.trim().toLowerCase();
            if (attr.name.startsWith('on') || attr.name === 'style' || ((attr.name === 'href' || attr.name === 'src') && /^(javascript|data|vbscript):/.test(v))) el.removeAttribute(attr.name);
        }
    });
    return doc.body.innerHTML;
}

export const Counter = ({ value, ideal, max }: { value: string; ideal: number; max: number }) => {
    const n = value.length;
    return <span className={n > max ? 'text-red-600' : n > ideal ? 'text-amber-600' : 'text-gray-400'}>{n}/{ideal}{n > ideal && n <= max ? ' · may be cut off' : ''}</span>;
};
