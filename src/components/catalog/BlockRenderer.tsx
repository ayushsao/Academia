import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Code2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { absoluteMedia, type PageBlock, type PageFaq } from '../../lib/catalogContent';

// Renders catalogue content blocks. Shared by the public pages and the admin
// preview; HTML fields arrive sanitised from the server.

export type ImgComponent = (p: { src: string; alt: string; className?: string }) => React.ReactElement;
const DefaultImg: ImgComponent = ({ src, alt, className }) => <img src={absoluteMedia(src)} alt={alt} loading="lazy" decoding="async" className={className} />;

type Ctx = { Img: ImgComponent; onOrder: () => void; preview: boolean };

const Html = ({ html, className }: { html: string; className?: string }) =>
    html ? <div className={cn('cms-prose', className)} dangerouslySetInnerHTML={{ __html: html }} /> : null;

const BlockTitle = ({ children, as: Tag = 'h2' }: { children: React.ReactNode; as?: 'h2' | 'h3' }) => (
    <Tag className={cn('font-bold tracking-tight text-[#000a1e]', Tag === 'h2' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl')}>{children}</Tag>
);

// Internal paths use the router; external links open in a new tab. In the admin
// preview links are inert so clicking doesn't leave the editor.
function SmartLink({ href, className, children, preview }: { href: string; className?: string; children: React.ReactNode; preview: boolean }) {
    if (preview) return <a href={href} onClick={e => e.preventDefault()} className={className}>{children}</a>;
    if (href.startsWith('/')) return <Link to={href} className={className}>{children}</Link>;
    return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={className}>{children}</a>;
}

export function FaqList({ faqs }: { faqs: PageFaq[] }) {
    return (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {faqs.map(f => (
                <details key={f.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-[#000a1e] hover:bg-gray-50 md:px-6 [&::-webkit-details-marker]:hidden">
                        {f.question}
                        <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180" />
                    </summary>
                    <Html html={f.answer} className="px-5 pb-5 text-[15px] md:px-6" />
                </details>
            ))}
        </div>
    );
}

const FEATURE_COLS: Record<number, string> = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' };
const IMAGE_WIDTH: Record<string, string> = { full: 'max-w-none', wide: 'max-w-5xl', medium: 'max-w-2xl' };

function renderBlock(block: PageBlock, ctx: Ctx): React.ReactNode {
    const c = block.content || {};
    const { Img } = ctx;
    switch (block.type) {
        case 'HEADING':
            return (
                <div className="max-w-3xl">
                    <BlockTitle as={c.level === 'h3' ? 'h3' : 'h2'}>{block.title}</BlockTitle>
                    {c.subtitle && <p className="mt-2 text-lg text-gray-500">{c.subtitle}</p>}
                </div>
            );
        case 'RICH_TEXT':
            return <div className="max-w-3xl space-y-4">{block.title && <BlockTitle>{block.title}</BlockTitle>}<Html html={c.html} /></div>;
        case 'INTRODUCTION':
            return (
                <div className="max-w-3xl space-y-5">
                    {block.title && <BlockTitle>{block.title}</BlockTitle>}
                    <Html html={c.html} className="text-lg md:text-xl md:leading-relaxed" />
                    {c.highlight && <p className="flex items-start gap-3 rounded-2xl border border-[#fea520]/30 bg-[#fea520]/10 px-5 py-4 font-semibold text-[#000a1e]"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#b86e00]" />{c.highlight}</p>}
                </div>
            );
        case 'FEATURES':
            return (
                <div className="space-y-6">
                    {block.title && <BlockTitle>{block.title}</BlockTitle>}
                    <div className={cn('grid gap-4', FEATURE_COLS[c.columns] || FEATURE_COLS[3])}>
                        {(c.items || []).map((it: { title: string; text: string }, i: number) => (
                            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#000a1e] text-sm font-bold text-[#fea520]">{String(i + 1).padStart(2, '0')}</span>
                                <h3 className="text-lg font-bold text-[#000a1e]">{it.title}</h3>
                                {it.text && <p className="mt-2 leading-relaxed text-gray-600">{it.text}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'AVAILABLE_PROJECTS': {
            const projects = block.projects || [];
            if (!projects.length && !ctx.preview) return null;
            return (
                <div className="space-y-6">
                    {block.title && <BlockTitle>{block.title}</BlockTitle>}
                    {!projects.length ? <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">No projects to show yet — they appear here once published.</p> : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {projects.map(p => {
                                const card = (
                                    <>
                                        {p.image ? <Img src={p.image.url} alt={p.image.alt} className="aspect-[16/9] w-full object-cover" /> : <span className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#000a1e] to-[#002147] text-3xl font-black text-[#fea520]/80">{p.title.slice(0, 1)}</span>}
                                        <span className="block p-5">
                                            <span className="block font-bold text-[#000a1e]">{p.title}</span>
                                            {p.summary && <span className="mt-1.5 line-clamp-3 block text-sm leading-relaxed text-gray-600">{p.summary}</span>}
                                            {p.url && <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#002147]">View project <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>}
                                        </span>
                                    </>
                                );
                                const cls = 'group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md';
                                return <React.Fragment key={p.id}>{p.url ? <SmartLink href={p.url} preview={ctx.preview} className={cls}>{card}</SmartLink> : <div className={cls}>{card}</div>}</React.Fragment>;
                            })}
                        </div>
                    )}
                </div>
            );
        }
        case 'PROGRAMMING_LANGUAGES':
            return (
                <div className="space-y-6">
                    {block.title && <BlockTitle>{block.title}</BlockTitle>}
                    <ul className="flex flex-wrap gap-3">
                        {(c.items || []).map((it: { name: string; note: string }, i: number) => (
                            <li key={i} className="flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                                <Code2 className="h-5 w-5 shrink-0 text-[#b86e00]" />
                                <span><span className="block font-semibold text-[#000a1e]">{it.name}</span>{it.note && <span className="block text-xs text-gray-500">{it.note}</span>}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        case 'FAQ': {
            const faqs = block.faqs || [];
            if (!faqs.length && !ctx.preview) return null;
            return (
                <div className="max-w-4xl space-y-6">
                    {block.title && <BlockTitle>{block.title}</BlockTitle>}
                    {faqs.length ? <FaqList faqs={faqs} /> : <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">No active FAQs yet — add them in the FAQ tab.</p>}
                </div>
            );
        }
        case 'CTA': {
            const label = c.buttonLabel || 'Get started';
            const btn = 'inline-flex items-center gap-2 rounded-full bg-[#fea520] px-7 py-3.5 font-bold text-[#000a1e] shadow-lg shadow-[#fea520]/20 transition hover:bg-[#ffb340]';
            return (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#000a1e] to-[#002147] px-6 py-10 text-white md:px-12 md:py-14">
                    <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#fea520]/15 blur-3xl" aria-hidden />
                    <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-2xl">
                            {block.title && <h2 className="text-2xl font-bold md:text-3xl">{block.title}</h2>}
                            {c.text && <p className="mt-2 text-lg text-white/75">{c.text}</p>}
                        </div>
                        {c.action === 'LINK' && c.buttonUrl
                            ? <SmartLink href={c.buttonUrl} preview={ctx.preview} className={cn(btn, 'shrink-0 self-start md:self-auto')}>{label}<ArrowRight className="h-4 w-4" /></SmartLink>
                            : <button type="button" onClick={ctx.onOrder} className={cn(btn, 'shrink-0 self-start md:self-auto')}>{label}<ArrowRight className="h-4 w-4" /></button>}
                    </div>
                </div>
            );
        }
        case 'IMAGE': {
            const m = block.media[0];
            if (!m) return null;
            return (
                <figure className={cn('mx-auto w-full', IMAGE_WIDTH[c.size] || IMAGE_WIDTH.wide)}>
                    {block.title && <div className="mb-4"><BlockTitle>{block.title}</BlockTitle></div>}
                    <Img src={m.url} alt={c.alt || m.alt || block.title || ''} className="w-full rounded-2xl object-cover shadow-sm" />
                    {c.caption && <figcaption className="mt-3 text-center text-sm text-gray-500">{c.caption}</figcaption>}
                </figure>
            );
        }
        case 'CUSTOM_HTML':
            return <div className="space-y-4">{block.title && <BlockTitle>{block.title}</BlockTitle>}<Html html={c.html} className="max-w-none" /></div>;
        case 'SEO_CONTENT':
            if (!c.html) return null;
            if (c.collapsible) return (
                <details className="group max-w-4xl rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm md:px-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[#000a1e] [&::-webkit-details-marker]:hidden">
                        {block.title || 'Read more'}<ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition group-open:rotate-180" />
                    </summary>
                    <Html html={c.html} className="mt-4 text-[15px]" />
                </details>
            );
            return <div className="max-w-4xl space-y-4">{block.title && <BlockTitle>{block.title}</BlockTitle>}<Html html={c.html} className="text-[15px]" /></div>;
        default:
            return null;   // unknown type from a newer server: skip safely
    }
}

export function BlockRenderer({ blocks, onOrder = () => {}, Img = DefaultImg, preview = false, className }: {
    blocks: PageBlock[]; onOrder?: () => void; Img?: ImgComponent; preview?: boolean; className?: string;
}) {
    const ctx: Ctx = { Img, onOrder, preview };
    return (
        <div className={cn('space-y-14 md:space-y-16', className)}>
            {blocks.map(b => ({ b, el: renderBlock(b, ctx) })).filter(x => x.el).map(({ b, el }) => (
                <section key={b.id} id={`block-${b.id}`} data-block-type={b.type}>{el}</section>
            ))}
        </div>
    );
}
