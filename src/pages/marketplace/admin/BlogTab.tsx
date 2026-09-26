import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../../../lib/api';
import RichTextEditor from './catalog/RichTextEditor';
import { AdminImg, MediaPicker } from './catalog/MediaLibrary';
import { Counter } from './catalog/cmsShared';
import { ConfirmDialog, Label, fieldClass } from './catalog/shared';

// Admin → Blog: write and publish blog posts without touching code.
// Posts appear on the website at /blog and /blog/<url>.

type Status = 'DRAFT' | 'PUBLISHED';
type Post = {
    id: string; title: string; slug: string; excerpt: string; content: string; category: string; tags: string[]; author: string;
    status: Status; publishedAt?: string; readingMinutes: number; cover: { mediaId: string | null; storedName: string; alt: string } | null;
    metaTitle: string; metaDescription: string; updatedAt: string;
};
type Draft = {
    title: string; slug: string; excerpt: string; content: string; category: string; tags: string; author: string;
    cover: { mediaId: string | null; storedName: string; alt: string } | null; coverChanged: boolean; metaTitle: string; metaDescription: string;
};

const EMPTY: Draft = { title: '', slug: '', excerpt: '', content: '', category: '', tags: '', author: '', cover: null, coverChanged: false, metaTitle: '', metaDescription: '' };
const toDraft = (p: Post): Draft => ({ ...p, tags: p.tags.join(', '), coverChanged: false });
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
const siteUrl = (slug: string) => `${window.location.origin}/blog/${slug}`;
const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function StatusBadge({ status }: { status: Status }) {
    return status === 'PUBLISHED'
        ? <span className="rounded-full bg-[#1d1d1f] px-2.5 py-0.5 text-xs font-semibold text-white">Published</span>
        : <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Draft</span>;
}

function Editor({ token, post, onDone }: { token: string; post: Post | null; onDone: (saved?: Post) => void }) {
    const [d, setD] = useState<Draft>(post ? toDraft(post) : EMPTY);
    const [slugTouched, setSlugTouched] = useState(Boolean(post));
    const [picking, setPicking] = useState(false);
    const [saving, setSaving] = useState<Status | null>(null);
    const [error, setError] = useState('');
    const set = (patch: Partial<Draft>) => setD(prev => ({ ...prev, ...patch }));

    const save = async (status: Status) => {
        setError('');
        if (d.title.trim().length < 3) return setError('Add a title (at least 3 characters).');
        if (status === 'PUBLISHED' && !d.content.replace(/<[^>]*>/g, '').trim()) return setError('Write the article before publishing.');
        setSaving(status);
        try {
            const body = {
                title: d.title, slug: d.slug, excerpt: d.excerpt, content: d.content, category: d.category, author: d.author,
                tags: d.tags.split(',').map(t => t.trim()).filter(Boolean), status, metaTitle: d.metaTitle, metaDescription: d.metaDescription,
                coverAlt: d.cover?.alt || '',
                ...(d.coverChanged ? { coverMediaId: d.cover?.mediaId ?? null } : {}),
            };
            const r = post
                ? await api<{ post: Post }>(`/admin/blog/${post.id}`, { method: 'PUT', token, body })
                : await api<{ post: Post }>('/admin/blog', { method: 'POST', token, body });
            onDone(r.post);
        } catch (e) { setError((e as Error).message); }
        finally { setSaving(null); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button onClick={() => onDone()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-[#000a1e]"><ArrowLeft className="h-4 w-4" /> All posts</button>
                <div className="flex items-center gap-2">
                    {post?.status === 'PUBLISHED' && <a href={siteUrl(post.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100"><ExternalLink className="h-4 w-4" /> View</a>}
                    <button onClick={() => save('DRAFT')} disabled={saving !== null} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#000a1e] hover:border-gray-300 disabled:opacity-50">{saving === 'DRAFT' ? 'Saving…' : post?.status === 'PUBLISHED' ? 'Unpublish & save as draft' : 'Save draft'}</button>
                    <button onClick={() => save('PUBLISHED')} disabled={saving !== null} className="rounded-xl bg-[#000a1e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#002147] disabled:opacity-50">{saving === 'PUBLISHED' ? 'Publishing…' : post?.status === 'PUBLISHED' ? 'Update' : 'Publish'}</button>
                </div>
            </div>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
                    <div>
                        <Label htmlFor="blog-title">Title</Label>
                        <input id="blog-title" value={d.title} maxLength={160} onChange={e => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
                            placeholder="e.g. How to write a literature review" className={`${fieldClass} text-lg font-semibold`} />
                    </div>
                    <div>
                        <Label htmlFor="blog-slug" hint="— the address of the post">Web address</Label>
                        <div className="flex items-center overflow-hidden rounded-xl border border-gray-200 focus-within:border-[#fea520]">
                            <span className="shrink-0 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">/blog/</span>
                            <input id="blog-slug" value={d.slug} maxLength={100} onChange={e => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} className="w-full px-2 py-2.5 text-sm outline-none" />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="blog-excerpt" hint="— shown on the blog list and in Google">Short summary</Label>
                        <textarea id="blog-excerpt" rows={2} maxLength={400} value={d.excerpt} onChange={e => set({ excerpt: e.target.value })} className={`${fieldClass} resize-none`} />
                    </div>
                    <RichTextEditor id="blog-content" label="Article" value={d.content} onChange={html => set({ content: html })} minHeight={360} placeholder="Write your article… Use the toolbar for headings, lists and links." />
                </div>

                <aside className="space-y-5">
                    <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5">
                        <p className="text-sm font-bold text-[#000a1e]">Cover image</p>
                        {d.cover ? (
                            <div className="space-y-2">
                                <AdminImg src={`/media/${d.cover.storedName}`} alt={d.cover.alt} token={token} className="aspect-[16/9] w-full rounded-xl object-cover" />
                                <input value={d.cover.alt} maxLength={200} onChange={e => set({ cover: { ...d.cover!, alt: e.target.value } })} placeholder="Describe the image (for accessibility)" aria-label="Cover image description" className={fieldClass} />
                                <div className="flex gap-2">
                                    <button onClick={() => setPicking(true)} className="text-xs font-semibold text-[#002147] hover:underline">Change</button>
                                    <button onClick={() => set({ cover: null, coverChanged: true })} className="text-xs font-semibold text-red-600 hover:underline">Remove</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setPicking(true)} className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-gray-400">
                                <ImagePlus className="h-6 w-6" /> Choose or upload an image
                            </button>
                        )}
                    </div>

                    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
                        <div><Label htmlFor="blog-category">Category</Label><input id="blog-category" value={d.category} maxLength={60} onChange={e => set({ category: e.target.value })} placeholder="e.g. Dissertation" className={fieldClass} /></div>
                        <div><Label htmlFor="blog-tags" hint="— separate with commas">Tags</Label><input id="blog-tags" value={d.tags} onChange={e => set({ tags: e.target.value })} placeholder="nursing, referencing" className={fieldClass} /></div>
                        <div><Label htmlFor="blog-author">Author</Label><input id="blog-author" value={d.author} maxLength={80} onChange={e => set({ author: e.target.value })} placeholder="AssignmentMinds Editorial" className={fieldClass} /></div>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
                        <p className="text-sm font-bold text-[#000a1e]">Google preview <span className="font-normal text-gray-400">(optional)</span></p>
                        <div>
                            <Label htmlFor="blog-meta-title">Title in Google <Counter value={d.metaTitle || d.title} ideal={60} max={120} /></Label>
                            <input id="blog-meta-title" value={d.metaTitle} maxLength={120} onChange={e => set({ metaTitle: e.target.value })} placeholder={d.title || 'Uses the post title'} className={fieldClass} />
                        </div>
                        <div>
                            <Label htmlFor="blog-meta-desc">Description in Google <Counter value={d.metaDescription || d.excerpt} ideal={155} max={320} /></Label>
                            <textarea id="blog-meta-desc" rows={3} maxLength={320} value={d.metaDescription} onChange={e => set({ metaDescription: e.target.value })} placeholder={d.excerpt || 'Uses the short summary'} className={`${fieldClass} resize-none`} />
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                            <p className="truncate text-xs text-gray-500">{siteUrl(d.slug || 'your-post')}</p>
                            <p className="mt-0.5 line-clamp-1 text-[15px] text-[#1a0dab]">{d.metaTitle || d.title || 'Post title'}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{d.metaDescription || d.excerpt || 'Short summary of the post.'}</p>
                        </div>
                    </div>
                </aside>
            </div>

            {picking && (
                <MediaPicker token={token} title="Choose a cover image" pickedIds={d.cover?.mediaId ? [d.cover.mediaId] : []} onClose={() => setPicking(false)}
                    onPick={item => { set({ cover: { mediaId: item._id, storedName: item.storedName, alt: item.alt || d.cover?.alt || '' }, coverChanged: true }); setPicking(false); }} />
            )}
        </div>
    );
}

export default function BlogTab({ token }: { token: string }) {
    const [posts, setPosts] = useState<Post[] | null>(null);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState<'' | Status>('');
    const [q, setQ] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [editing, setEditing] = useState<Post | 'new' | null>(null);
    const [deleting, setDeleting] = useState<Post | null>(null);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        setError('');
        try {
            const qs = new URLSearchParams({ page: String(page), ...(status && { status }), ...(search && { q: search }) });
            const r = await api<{ posts: Post[]; total: number }>(`/admin/blog?${qs}`, { token });
            setPosts(r.posts); setTotal(r.total);
        } catch (e) { setError((e as Error).message); }
    }, [token, status, search, page]);
    useEffect(() => { load(); }, [load]);

    const openEditor = async (p: Post) => {
        try { setEditing((await api<{ post: Post }>(`/admin/blog/${p.id}`, { token })).post); }
        catch (e) { setError((e as Error).message); }
    };
    const toggle = async (p: Post) => {
        try {
            await api(`/admin/blog/${p.id}/status`, { method: 'PATCH', token, body: { status: p.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' } });
            setNotice(p.status === 'PUBLISHED' ? `“${p.title}” is now a draft.` : `“${p.title}” is published.`);
            load();
        } catch (e) { setError((e as Error).message); }
    };
    const remove = async () => {
        if (!deleting) return;
        setBusy(true);
        try { await api(`/admin/blog/${deleting.id}`, { method: 'DELETE', token }); setNotice(`Deleted “${deleting.title}”.`); setDeleting(null); load(); }
        catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    if (editing) return (
        <Editor token={token} post={editing === 'new' ? null : editing} onDone={saved => {
            setEditing(null);
            if (saved) setNotice(saved.status === 'PUBLISHED' ? `Published “${saved.title}”.` : `Saved “${saved.title}” as a draft.`);
            load();
        }} />
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-bold text-[#000a1e]">Blog posts {posts && <span className="font-normal text-gray-400">({total})</span>}</h2>
                    <p className="text-sm text-gray-500">Published posts appear on the website at <a href="/blog" target="_blank" rel="noreferrer" className="font-semibold text-[#002147] hover:underline">/blog</a> and on the homepage.</p>
                </div>
                <button onClick={() => setEditing('new')} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#000a1e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#002147]"><Plus className="h-4 w-4" /> New post</button>
            </div>

            {notice && <p role="status" className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm text-[#000a1e]">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X className="h-4 w-4 text-gray-400" /></button></p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="flex flex-col gap-3 sm:flex-row">
                <form className="relative flex-1" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(q.trim()); }}>
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by title" aria-label="Search posts" className={`${fieldClass} pl-10`} />
                </form>
                <select value={status} onChange={e => { setPage(1); setStatus(e.target.value as '' | Status); }} aria-label="Filter by status" className={`${fieldClass} sm:w-44`}>
                    <option value="">All posts</option><option value="PUBLISHED">Published</option><option value="DRAFT">Drafts</option>
                </select>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                {!posts && !error && <p className="p-8 text-center text-sm text-gray-400">Loading…</p>}
                {posts && posts.length === 0 && (
                    <div className="p-10 text-center">
                        <p className="font-semibold text-[#000a1e]">{search || status ? 'No posts match.' : 'No posts yet'}</p>
                        {!search && !status && <p className="mt-1 text-sm text-gray-500">Write your first article — no coding needed.</p>}
                    </div>
                )}
                {posts && posts.length > 0 && (
                    <ul className="divide-y divide-gray-100">
                        {posts.map(p => (
                            <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                                <button onClick={() => openEditor(p)} className="min-w-0 flex-1 text-left">
                                    <p className="truncate font-semibold text-[#000a1e] hover:text-[#002147]">{p.title}</p>
                                    <p className="mt-0.5 text-xs text-gray-500">{p.category || 'No category'} · {p.status === 'PUBLISHED' ? `Published ${when(p.publishedAt)}` : `Edited ${when(p.updatedAt)}`} · /blog/{p.slug}</p>
                                </button>
                                <div className="flex shrink-0 items-center gap-2">
                                    <StatusBadge status={p.status} />
                                    <button onClick={() => toggle(p)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">{p.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button>
                                    {p.status === 'PUBLISHED' && <a href={siteUrl(p.slug)} target="_blank" rel="noreferrer" aria-label={`View ${p.title}`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><ExternalLink className="h-4 w-4" /></a>}
                                    <button onClick={() => openEditor(p)} aria-label={`Edit ${p.title}`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>
                                    <button onClick={() => setDeleting(p)} aria-label={`Delete ${p.title}`} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {total > 20 && (
                <div className="flex items-center justify-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40">Previous</button>
                    <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
                    <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40">Next</button>
                </div>
            )}

            {deleting && <ConfirmDialog title="Delete this post?" message={<>“{deleting.title}” will be removed from the website. This can’t be undone.</>} busy={busy} onConfirm={remove} onCancel={() => setDeleting(null)} />}
        </div>
    );
}
