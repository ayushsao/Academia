import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { CatalogSubject, CatalogService, CatalogProject, CatalogFaq, CatalogMedia, ContentBlock, BLOCK_TYPES } from '../db.js';

// Dynamic content: validation/sanitising of typed blocks, and turning stored
// blocks + SEO into the payload the public page (and admin preview) renders.
// Adding content never needs code; adding a new *block type* is one entry in
// BLOCK_SPECS here plus a renderer on the frontend.

export class ContentError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

// ── HTML sanitising ────────────────────────────────────────────────────────────
const LINK_SCHEMES = ['http', 'https', 'mailto', 'tel'];
const linkTransform = (tagName, attribs) => {
    const out = { ...attribs };
    if (out.target === '_blank') out.rel = 'noopener noreferrer';
    else delete out.target;
    return { tagName, attribs: out };
};

// Rich text from the editor: formatting, headings, lists, links, simple tables.
export const cleanRichText = (html) => sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span'],
    allowedAttributes: { a: ['href', 'target', 'rel', 'title'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: LINK_SCHEMES,
    transformTags: { a: linkTransform, b: 'strong', i: 'em' },
}).trim();

// Custom HTML: layout markup and class names, plus embeds from known video/map
// providers. Scripts, event handlers, inline styles and javascript: URLs are removed.
export const cleanCustomHtml = (html) => sanitizeHtml(String(html || ''), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'iframe', 'figure', 'figcaption', 'section', 'article', 'aside', 'header', 'footer', 'details', 'summary', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    allowedAttributes: {
        '*': ['class', 'id', 'title', 'aria-label', 'role'],
        a: ['href', 'target', 'rel', 'name'],
        img: ['src', 'alt', 'width', 'height', 'loading'],
        iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'loading', 'title', 'referrerpolicy'],
        th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
    },
    allowedSchemes: LINK_SCHEMES,
    allowedSchemesByTag: { img: ['https'] },
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'www.google.com'],
    allowIframeRelativeUrls: false,
    transformTags: { a: linkTransform },
}).trim();

const text = (max) => z.string().trim().max(max).transform(s => s.replace(/<[^>]*>/g, ''));
const rich = (max) => z.string().max(max * 2).transform(cleanRichText).pipe(z.string().max(max, 'This text is too long'));
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
// Internal paths (/subjects/…), or absolute https/mailto/tel links.
const linkUrl = z.string().trim().max(500).refine(v => v === '' || /^\/(?!\/)/.test(v) || /^(https:\/\/|mailto:|tel:)/i.test(v), 'Use a site path like /subjects/law or a full https:// link');

// ── Block types ────────────────────────────────────────────────────────────────
// `content` schema per type, whether a title is required, and media rules.
export const BLOCK_SPECS = {
    HEADING: { titleRequired: true, content: z.object({ level: z.enum(['h2', 'h3']).default('h2'), subtitle: text(300).default('') }) },
    RICH_TEXT: { content: z.object({ html: rich(100000).default('') }) },
    INTRODUCTION: { content: z.object({ html: rich(20000).default(''), highlight: text(300).default('') }) },
    FEATURES: { content: z.object({ columns: z.coerce.number().int().min(2).max(4).default(3), items: z.array(z.object({ title: text(120).pipe(z.string().min(1, 'Each feature needs a title')), text: text(600).default('') })).max(24).default([]) }) },
    AVAILABLE_PROJECTS: { content: z.object({ mode: z.enum(['AUTO', 'MANUAL']).default('AUTO'), projectIds: z.array(objectId).max(50).default([]), limit: z.coerce.number().int().min(1).max(50).default(12) }) },
    PROGRAMMING_LANGUAGES: { content: z.object({ items: z.array(z.object({ name: text(60).pipe(z.string().min(1, 'Each language needs a name')), note: text(200).default('') })).max(60).default([]) }) },
    FAQ: { content: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }) },
    CTA: { content: z.object({ text: text(600).default(''), buttonLabel: text(60).default(''), buttonUrl: linkUrl.default(''), action: z.enum(['LINK', 'ORDER']).default('ORDER') }) },
    IMAGE: { media: { min: 1, max: 1, kinds: ['IMAGE'] }, content: z.object({ caption: text(300).default(''), alt: text(200).default(''), size: z.enum(['full', 'wide', 'medium']).default('wide') }) },
    CUSTOM_HTML: { content: z.object({ html: z.string().max(200000).transform(cleanCustomHtml).default('') }) },
    SEO_CONTENT: { content: z.object({ html: rich(200000).default(''), collapsible: z.boolean().default(true) }) },
};
for (const t of BLOCK_TYPES) if (!BLOCK_SPECS[t]) throw new Error(`Missing BLOCK_SPECS for ${t}`);

/** Validates + sanitises a block's title/content/media; resolves media from the library. */
export async function normaliseBlock({ type, title = '', content = {}, mediaIds = [] }) {
    const spec = BLOCK_SPECS[type];
    if (!spec) throw new ContentError('Unknown block type.');
    const cleanTitle = String(title || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
    if (spec.titleRequired && !cleanTitle) throw new ContentError('This block needs a title.');
    const parsed = spec.content.safeParse(content && typeof content === 'object' ? content : {});
    if (!parsed.success) { const i = parsed.error.issues[0]; throw new ContentError(`${i.path.join(' › ') || 'Content'}: ${i.message}`); }

    const ids = [...new Set((mediaIds || []).map(String))];
    const rules = spec.media || { min: 0, max: 12, kinds: ['IMAGE', 'FILE'] };
    if (ids.length < rules.min) throw new ContentError('Choose an image for this block.');
    if (ids.length > rules.max) throw new ContentError(`This block can hold at most ${rules.max} media item${rules.max === 1 ? '' : 's'}.`);
    const found = ids.length ? await CatalogMedia.find({ _id: { $in: ids } }).lean() : [];
    if (found.length !== ids.length) throw new ContentError('Some selected media no longer exist.');
    const byId = new Map(found.map(m => [String(m._id), m]));
    const media = ids.map(id => byId.get(id)).map(m => {
        if (!rules.kinds.includes(m.kind)) throw new ContentError('Only images can be used here.');
        return { mediaId: m._id, storedName: m.storedName, originalName: m.originalName, mimeType: m.mimeType, kind: m.kind, alt: m.alt };
    });
    return { title: cleanTitle, content: parsed.data, media };
}

// ── Entities, URLs, SEO ────────────────────────────────────────────────────────
export const MODELS = { SUBJECT: CatalogSubject, SERVICE: CatalogService, PROJECT: CatalogProject };
const LIVE = (e) => e && e.status === 'ACTIVE' && e.published;
const appUrl = () => (process.env.APP_URL || '').trim().replace(/\/+$/, '');

/** Loads an entity with its parents; returns names, public path and liveness. */
export async function loadEntity(type, id) {
    const Model = MODELS[type];
    if (!Model) throw new ContentError('Unknown content type.');
    const entity = await Model.findById(id).lean();
    if (!entity) throw new ContentError('Not found.', 404);
    let subject = null, service = null;
    if (type === 'SUBJECT') subject = entity;
    else subject = await CatalogSubject.findById(entity.subjectId).lean();
    if (type === 'SERVICE') service = entity;
    if (type === 'PROJECT') service = await CatalogService.findById(entity.serviceId).lean();
    const chain = [subject, service, type === 'PROJECT' ? entity : null].filter(Boolean);
    const path = '/subjects/' + chain.map(e => e.slug).join('/');
    return { type, entity, subject, service, path, live: chain.every(LIVE), name: entity.name || entity.title };
}

const excerpt = (s, n) => { const t = String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };

export function resolveSeo(ctx, { mediaUrl, apiOrigin, preview }) {
    const { entity, subject, service, path, type } = ctx;
    const seo = entity.seo || {};
    const name = ctx.name;
    const context = type === 'SUBJECT' ? '' : type === 'SERVICE' ? subject?.name : `${service?.name} · ${subject?.name}`;
    const title = seo.metaTitle || [name, context, 'AssignmentMinds'].filter(Boolean).join(' | ');
    const description = seo.metaDescription || excerpt(entity.description, 158) || `${name} — expert academic support from AssignmentMinds.`;
    const image = seo.ogImage || entity.image || (entity.files || []).find(f => f.kind === 'IMAGE') || null;
    const canonical = seo.canonicalUrl || (appUrl() ? `${appUrl()}${path}` : path);
    return {
        title, description, keywords: seo.keywords || [], canonical,
        robots: preview || !ctx.live ? 'noindex,nofollow' : (seo.robots || 'index,follow'),
        og: {
            title: seo.ogTitle || title, description: seo.ogDescription || description, type: 'website', url: canonical,
            image: image ? `${apiOrigin}${mediaUrl(image.storedName)}` : null,
        },
    };
}

/**
 * Builds the renderable page: active blocks (with resolved projects/FAQs/media
 * URLs), FAQs, breadcrumbs, children and SEO. `liveOnly` hides drafts (public).
 */
export async function buildPage(ctx, { liveOnly, mediaUrl, apiOrigin, preview = false }) {
    const { type, entity, subject, service } = ctx;
    const liveFilter = liveOnly ? { status: 'ACTIVE', published: true } : {};
    const [blocks, faqs] = await Promise.all([
        ContentBlock.find({ entityType: type, entityId: entity._id, status: 'ACTIVE' }).sort({ sortOrder: 1, _id: 1 }).lean(),
        CatalogFaq.find({ entityType: type, entityId: entity._id, status: 'ACTIVE' }).sort({ sortOrder: 1, _id: 1 }).lean(),
    ]);
    const faqView = faqs.map(f => ({ id: f._id, question: f.question, answer: f.answer }));

    // Projects that "Available projects" blocks may list.
    const projectScope = type === 'SUBJECT' ? { subjectId: entity._id } : type === 'SERVICE' ? { serviceId: entity._id } : { serviceId: entity.serviceId, _id: { $ne: entity._id } };
    const needsProjects = blocks.some(b => b.type === 'AVAILABLE_PROJECTS');
    const services = await CatalogService.find({ ...(type === 'SUBJECT' ? { subjectId: entity._id } : { _id: { $in: [service?._id].filter(Boolean) } }), ...liveFilter }).lean();
    const serviceSlug = new Map(services.map(s => [String(s._id), s.slug]));
    // Only projects whose service is visible here (drafts under a hidden service are skipped).
    const candidateProjects = (needsProjects ? await CatalogProject.find({ ...projectScope, ...liveFilter }).sort({ sortOrder: 1, _id: 1 }).lean() : [])
        .filter(p => serviceSlug.has(String(p.serviceId)));
    const projectCard = (p) => ({
        id: p._id, title: p.title, slug: p.slug, summary: excerpt(p.description, 160),
        url: serviceSlug.get(String(p.serviceId)) ? `/subjects/${subject.slug}/${serviceSlug.get(String(p.serviceId))}/${p.slug}` : null,
        image: (() => { const f = (p.files || []).find(x => x.kind === 'IMAGE'); return f ? { url: mediaUrl(f.storedName), alt: p.title } : null; })(),
    });

    const renderBlocks = blocks.map(b => {
        const out = { id: b._id, type: b.type, title: b.title, content: b.content, media: (b.media || []).map(m => ({ url: mediaUrl(m.storedName), name: m.originalName, kind: m.kind, alt: m.alt || b.content?.alt || '' })) };
        if (b.type === 'AVAILABLE_PROJECTS') {
            const list = b.content.mode === 'MANUAL'
                ? b.content.projectIds.map(id => candidateProjects.find(p => String(p._id) === id)).filter(Boolean)
                : candidateProjects;
            out.projects = list.slice(0, b.content.limit).map(projectCard);
        }
        if (b.type === 'FAQ') out.faqs = faqView.slice(0, b.content.limit);
        return out;
    });

    const crumbs = [{ name: subject?.name, path: `/subjects/${subject?.slug}` }];
    if (service) crumbs.push({ name: service.name, path: `/subjects/${subject.slug}/${service.slug}` });
    if (type === 'PROJECT') crumbs.push({ name: entity.title, path: ctx.path });

    // Children for navigation: services of a subject, projects of a service.
    let children = [];
    if (type === 'SUBJECT') children = services.map(s => ({ name: s.name, path: `/subjects/${subject.slug}/${s.slug}`, summary: excerpt(s.description, 140) }));
    if (type === 'SERVICE') children = (await CatalogProject.find({ serviceId: entity._id, ...liveFilter }).sort({ sortOrder: 1, _id: 1 }).limit(60).lean())
        .map(p => ({ name: p.title, path: `/subjects/${subject.slug}/${entity.slug}/${p.slug}`, summary: excerpt(p.description, 140) }));

    return {
        entity: {
            type, id: entity._id, name: ctx.name, slug: entity.slug, description: entity.description, path: ctx.path, live: ctx.live,
            image: entity.image ? { url: mediaUrl(entity.image.storedName), alt: ctx.name } : null,
            files: type === 'PROJECT' ? (entity.files || []).map(f => ({ url: mediaUrl(f.storedName), name: f.originalName, kind: f.kind })) : [],
            ids: { subjectId: subject?._id, serviceId: service?._id || null, projectId: type === 'PROJECT' ? entity._id : null },
        },
        breadcrumbs: crumbs, children, blocks: renderBlocks, faqs: faqView,
        seo: resolveSeo(ctx, { mediaUrl, apiOrigin, preview }),
    };
}

/** Where a stored file is referenced from live content (for public media access). */
export async function isPublicContentFile(storedName) {
    const { BlogPost } = await import('../db.js');
    if (await BlogPost.exists({ status: 'PUBLISHED', 'coverImage.storedName': storedName })) return true;
    const blocks = await ContentBlock.find({ status: 'ACTIVE', 'media.storedName': storedName }).select('entityType entityId').limit(20).lean();
    for (const b of blocks) {
        try { if ((await loadEntity(b.entityType, b.entityId)).live) return true; } catch { /* entity gone */ }
    }
    for (const type of Object.keys(MODELS)) {
        const e = await MODELS[type].findOne({ 'seo.ogImage.storedName': storedName }).select('_id').lean();
        if (e) { try { if ((await loadEntity(type, e._id)).live) return true; } catch { /* ignore */ } }
    }
    return false;
}
