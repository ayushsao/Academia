import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Search } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { OrderModal } from '../components/OrderModal';
import { SignInModal } from '../components/SignInModal';
import { SideDrawer } from '../components/SideDrawer';
import { api, ApiError } from '../lib/api';
import { coverSrc, postDate, type BlogCard, type BlogList, type BlogPostData } from '../lib/blog';

// Public blog: /blog (all published posts) and /blog/:slug (one post).
// Posts are written in Admin → Blog.

function Shell({ children }: { children: (openOrder: () => void) => React.ReactNode }) {
    const [orderOpen, setOrderOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const openOrder = () => setOrderOpen(true);
    return (
        <div className="flex min-h-screen flex-col bg-white font-sans">
            <Navbar onOpenOrder={openOrder} onOpenSignIn={() => setSignInOpen(true)} onOpenDrawer={() => setDrawerOpen(true)} activeSection="" onNavigate={() => { }} />
            <main className="flex-grow">{children(openOrder)}</main>
            <Footer onOpenOrder={openOrder} onOpenSignIn={() => setSignInOpen(true)} onNavigate={() => { }} />
            <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onProceedToOrder={openOrder} />
            <OrderModal isOpen={orderOpen} onClose={() => setOrderOpen(false)} />
            <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
        </div>
    );
}

// Title, description and canonical link for the page; restored on leave.
function usePageMeta(title: string | null, description = '') {
    useEffect(() => {
        if (!title) return;
        const previous = document.title;
        document.title = title;
        let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        const created = !meta;
        if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
        const previousDescription = meta.content;
        meta.content = description;
        const canonical = document.createElement('link');
        canonical.rel = 'canonical'; canonical.href = window.location.origin + window.location.pathname;
        document.head.appendChild(canonical);
        return () => {
            document.title = previous;
            if (created) meta!.remove(); else meta!.content = previousDescription;
            canonical.remove();
        };
    }, [title, description]);
}

const Spinner = () => (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#002147]" />
    </div>
);

export function PostCard({ post, large = false }: { post: BlogCard; large?: boolean }) {
    const src = coverSrc(post);
    return (
        <Link to={`/blog/${post.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white transition hover:border-[#d2d2d7] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className={`overflow-hidden bg-[#f5f5f7] ${large ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}>
                {src ? <img src={src} alt={post.coverAlt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    : <div className="flex h-full items-center justify-center px-6 text-center text-lg font-bold text-[#1d1d1f]/70">{post.title}</div>}
            </div>
            <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-medium text-[#6e6e73]">{post.category || 'Article'} · {postDate(post.publishedAt)}</p>
                <h3 className={`mt-2 font-bold leading-snug text-[#1d1d1f] group-hover:text-[#002147] ${large ? 'text-xl md:text-2xl' : 'text-[17px]'}`}>{post.title}</h3>
                {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#6e6e73]">{post.excerpt}</p>}
                <p className="mt-auto pt-4 text-xs text-[#6e6e73]"><Clock className="mr-1 inline h-3.5 w-3.5" />{post.readingMinutes} min read</p>
            </div>
        </Link>
    );
}

export function BlogIndexPage() {
    const [params, setParams] = useSearchParams();
    const category = params.get('category') || '';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const [q, setQ] = useState(params.get('q') || '');
    const [data, setData] = useState<BlogList | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const ctrl = new AbortController();
        const qs = new URLSearchParams({ page: String(page), limit: '9', ...(category && { category }), ...(params.get('q') && { q: params.get('q')! }) });
        setError('');
        api<BlogList>(`/blog?${qs}`, { signal: ctrl.signal }).then(setData).catch(e => { if (e?.name !== 'AbortError') setError('Could not load the blog. Please try again.'); });
        return () => ctrl.abort();
    }, [category, page, params]);

    usePageMeta('Blog | AssignmentMinds', 'Study guides, writing tips and dissertation topics from AssignmentMinds experts.');
    const set = (next: Record<string, string>) => {
        const p = new URLSearchParams(params);
        Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
        if (!('page' in next)) p.delete('page');
        setParams(p);
    };
    const pages = data ? Math.ceil(data.total / data.limit) : 0;

    return (
        <Shell>{() => (
            <>
                <section className="bg-[#f6f6fa] py-14 md:py-20">
                    <div className="mx-auto max-w-6xl px-4 text-center">
                        <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] md:text-5xl">Blog</h1>
                        <p className="mx-auto mt-3 max-w-2xl text-[15px] text-[#6e6e73] md:text-lg">Study guides, writing tips and topic ideas from our academic experts.</p>
                        <form className="mx-auto mt-7 flex max-w-md items-center gap-2 rounded-full border border-[#e5e5ea] bg-white px-4 py-2.5" onSubmit={e => { e.preventDefault(); set({ q: q.trim() }); }}>
                            <Search className="h-4 w-4 shrink-0 text-[#6e6e73]" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search articles" aria-label="Search articles" className="w-full bg-transparent text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b]" />
                        </form>
                    </div>
                </section>

                <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
                    {data && data.categories.length > 0 && (
                        <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                            {['', ...data.categories].map(c => (
                                <button key={c || 'all'} onClick={() => set({ category: c })} aria-pressed={category === c}
                                    className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${category === c ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white' : 'border-[#e5e5ea] text-[#1d1d1f] hover:border-[#d2d2d7]'}`}>
                                    {c || 'All'}
                                </button>
                            ))}
                        </div>
                    )}
                    {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
                    {!data && !error && <Spinner />}
                    {data && data.posts.length === 0 && (
                        <p className="py-16 text-center text-[#6e6e73]">{params.get('q') || category ? 'No articles match your search.' : 'No articles yet — check back soon.'}</p>
                    )}
                    {data && data.posts.length > 0 && (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {data.posts.map((p, i) => (
                                <div key={p.slug} className={page === 1 && i === 0 && !category && !params.get('q') ? 'sm:col-span-2 lg:col-span-2' : ''}>
                                    <PostCard post={p} large={page === 1 && i === 0 && !category && !params.get('q')} />
                                </div>
                            ))}
                        </div>
                    )}
                    {pages > 1 && (
                        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pages">
                            <button disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="rounded-full border border-[#e5e5ea] px-4 py-2 text-sm font-medium disabled:opacity-40">Previous</button>
                            <span className="px-3 text-sm text-[#6e6e73]">Page {page} of {pages}</span>
                            <button disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} className="rounded-full border border-[#e5e5ea] px-4 py-2 text-sm font-medium disabled:opacity-40">Next</button>
                        </nav>
                    )}
                </section>
            </>
        )}</Shell>
    );
}

export function BlogPostPage() {
    const { slug = '' } = useParams();
    const [post, setPost] = useState<BlogPostData | null>(null);
    const [related, setRelated] = useState<BlogCard[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

    useEffect(() => {
        const ctrl = new AbortController();
        setState('loading');
        api<{ post: BlogPostData; related: BlogCard[] }>(`/blog/${encodeURIComponent(slug.toLowerCase())}`, { signal: ctrl.signal })
            .then(r => { setPost(r.post); setRelated(r.related); setState('ready'); window.scrollTo(0, 0); })
            .catch(e => { if (e?.name === 'AbortError') return; setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error'); });
        return () => ctrl.abort();
    }, [slug]);

    usePageMeta(state === 'ready' && post ? `${post.seo.title} | AssignmentMinds` : null, post?.seo.description || '');
    const src = post ? coverSrc(post) : null;

    return (
        <Shell>{(openOrder) => (
            <>
                {state === 'loading' && <Spinner />}
                {(state === 'missing' || state === 'error') && (
                    <div className="mx-auto max-w-xl px-4 py-24 text-center">
                        <h1 className="text-2xl font-bold text-[#1d1d1f]">{state === 'missing' ? 'Article not found' : 'Could not load this article'}</h1>
                        <Link to="/blog" className="mt-6 inline-flex items-center gap-1.5 font-semibold text-[#002147]"><ArrowLeft className="h-4 w-4" /> Back to the blog</Link>
                    </div>
                )}
                {state === 'ready' && post && (
                    <article>
                        <header className="mx-auto max-w-3xl px-4 pt-10 md:pt-14">
                            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6e6e73] hover:text-[#1d1d1f]"><ArrowLeft className="h-4 w-4" /> Blog</Link>
                            {post.category && <p className="mt-6 text-sm font-semibold text-[#e36100]">{post.category}</p>}
                            <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-tight text-[#1d1d1f] md:text-[44px]">{post.title}</h1>
                            {post.excerpt && <p className="mt-4 text-lg leading-relaxed text-[#6e6e73]">{post.excerpt}</p>}
                            <p className="mt-5 text-sm text-[#6e6e73]">{post.author} · {postDate(post.publishedAt)} · {post.readingMinutes} min read</p>
                        </header>
                        {src && (
                            <div className="mx-auto mt-8 max-w-5xl px-4">
                                <img src={src} alt={post.coverAlt} className="aspect-[16/9] w-full rounded-2xl bg-[#f5f5f7] object-cover" />
                            </div>
                        )}
                        <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
                            {/* Sanitised on the server when the admin saves the post. */}
                            <div className="cms-prose text-[17px]" dangerouslySetInnerHTML={{ __html: post.content }} />
                            {post.tags.length > 0 && (
                                <div className="mt-10 flex flex-wrap gap-2">
                                    {post.tags.map(t => <span key={t} className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-medium text-[#6e6e73]">{t}</span>)}
                                </div>
                            )}
                            <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl bg-[#f6f6fa] p-6 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-bold text-[#1d1d1f]">Need help with your assignment?</p>
                                    <p className="mt-1 text-sm text-[#6e6e73]">Get it written by a subject expert, on time.</p>
                                </div>
                                <button onClick={openOrder} className="shrink-0 rounded-lg bg-[#fea520] px-5 py-2.5 text-sm font-bold text-[#000a1e] hover:bg-[#e36100] hover:text-white">Order Now</button>
                            </div>
                        </div>
                        {related.length > 0 && (
                            <section className="bg-[#f6f6fa] py-12 md:py-16">
                                <div className="mx-auto max-w-6xl px-4">
                                    <div className="mb-6 flex items-center justify-between">
                                        <h2 className="text-2xl font-bold text-[#1d1d1f]">Related articles</h2>
                                        <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-[#002147]">All articles <ArrowRight className="h-4 w-4" /></Link>
                                    </div>
                                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map(p => <React.Fragment key={p.slug}><PostCard post={p} /></React.Fragment>)}</div>
                                </div>
                            </section>
                        )}
                    </article>
                )}
            </>
        )}</Shell>
    );
}
