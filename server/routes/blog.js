import { Router } from 'express';
import mongoose from 'mongoose';
import { BlogPost, CatalogMedia } from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { validateInput, blogPostSchema, blogStatusSchema } from '../validation.js';
import { recordAudit } from '../services/audit.js';
import { cleanRichText } from '../services/contentBlocks.js';

// Blog: admins write posts in Admin → Blog (no code); the website shows the
// published ones at /blog and /blog/:slug.

const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'post';
const words = (html) => String(html).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const coverUrl = (post) => (post.coverImage?.storedName ? `/api/catalog/media/${encodeURIComponent(post.coverImage.storedName)}` : null);

// What the website shows.
const publicCard = (p) => ({
    slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category, tags: p.tags, author: p.author || 'AssignmentMinds Editorial',
    publishedAt: p.publishedAt, readingMinutes: p.readingMinutes, cover: coverUrl(p), coverAlt: p.coverImage?.alt || p.title,
});
const publicPost = (p) => ({
    ...publicCard(p), content: p.content, updatedAt: p.updatedAt,
    seo: { title: p.seo?.metaTitle || p.title, description: p.seo?.metaDescription || p.excerpt || '' },
});
const adminView = (p) => ({
    id: String(p._id), title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, category: p.category, tags: p.tags,
    author: p.author, status: p.status, publishedAt: p.publishedAt, readingMinutes: p.readingMinutes,
    cover: p.coverImage?.storedName ? { mediaId: p.coverImage.mediaId ? String(p.coverImage.mediaId) : null, storedName: p.coverImage.storedName, alt: p.coverImage.alt || '' } : null,
    metaTitle: p.seo?.metaTitle || '', metaDescription: p.seo?.metaDescription || '', createdAt: p.createdAt, updatedAt: p.updatedAt,
});

// A slug that no other post uses (adds -2, -3… when needed).
async function uniqueSlug(base, exceptId) {
    const root = slugify(base);
    for (let i = 1; i < 200; i++) {
        const slug = i === 1 ? root : `${root}-${i}`;
        const clash = await BlogPost.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
        if (!clash) return slug;
    }
    return `${root}-${Date.now()}`;
}

async function fieldsFrom(body, existing) {
    const content = cleanRichText(body.content);
    const fields = {
        title: body.title,
        excerpt: body.excerpt || '',
        content,
        category: body.category || '',
        tags: [...new Set((body.tags || []).map(t => t.trim()).filter(Boolean))],
        author: body.author || '',
        status: body.status,
        readingMinutes: Math.max(1, Math.round(words(content) / 200)),
        seo: { metaTitle: body.metaTitle || '', metaDescription: body.metaDescription || '' },
    };
    if (body.coverMediaId === null) fields.coverImage = undefined;
    else if (body.coverMediaId) {
        const media = await CatalogMedia.findOne({ _id: body.coverMediaId, kind: 'IMAGE' }).lean();
        if (!media) throw Object.assign(new Error('Choose an image from the media library for the cover.'), { status: 400 });
        fields.coverImage = { mediaId: media._id, storedName: media.storedName, alt: body.coverAlt || media.alt || '' };
    } else if (existing?.coverImage && body.coverAlt !== undefined) {
        fields.coverImage = { ...existing.coverImage, alt: body.coverAlt || existing.coverImage.alt || '' };
    }
    // First publish sets the date; it stays when the post is edited later.
    if (body.status === 'PUBLISHED' && !existing?.publishedAt) fields.publishedAt = new Date();
    return fields;
}

const fail = (res, err, fallback) => {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    if (err?.code === 11000) return res.status(409).json({ error: 'Another post already uses this URL. Choose a different one.' });
    console.error('[Blog]', err?.message);
    res.status(500).json({ error: fallback });
};

// ═══════════════════════════ Public ═══════════════════════════
const router = Router();

// GET /api/blog?page=&limit=&category=&q=
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const filter = { status: 'PUBLISHED' };
        if (req.query.category) filter.category = String(req.query.category).slice(0, 60);
        if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
        const [total, posts, categories] = await Promise.all([
            BlogPost.countDocuments(filter),
            BlogPost.find(filter).select('-content').sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            BlogPost.distinct('category', { status: 'PUBLISHED', category: { $ne: '' } }),
        ]);
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.json({ total, page, limit, posts: posts.map(publicCard), categories: categories.sort() });
    } catch (err) { fail(res, err, 'Could not load the blog.'); }
});

// GET /api/blog/:slug — one published post, plus a few related ones.
router.get('/:slug', async (req, res) => {
    try {
        const post = await BlogPost.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'PUBLISHED' }).lean();
        if (!post) return res.status(404).json({ error: 'Post not found.' });
        const related = await BlogPost.find({ status: 'PUBLISHED', _id: { $ne: post._id }, ...(post.category ? { category: post.category } : {}) })
            .select('-content').sort({ publishedAt: -1 }).limit(3).lean();
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.json({ post: publicPost(post), related: related.map(publicCard) });
    } catch (err) { fail(res, err, 'Could not load the post.'); }
});

export default router;

// ═══════════════════════════ Admin ═══════════════════════════
export const blogAdminRouter = Router();
blogAdminRouter.use(noStore, authenticateAdmin, requirePermission('blog.manage'));

// GET /api/admin/blog?status=&q=&page=
blogAdminRouter.get('/', async (req, res) => {
    try {
        const limit = 20, page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const filter = {};
        if (['DRAFT', 'PUBLISHED'].includes(req.query.status)) filter.status = req.query.status;
        if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
        const [total, posts] = await Promise.all([
            BlogPost.countDocuments(filter),
            BlogPost.find(filter).select('-content').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        ]);
        res.json({ total, page, limit, posts: posts.map(adminView) });
    } catch (err) { fail(res, err, 'Could not load posts.'); }
});

blogAdminRouter.get('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Post not found.' });
        const post = await BlogPost.findById(req.params.id).lean();
        if (!post) return res.status(404).json({ error: 'Post not found.' });
        res.json({ post: adminView(post) });
    } catch (err) { fail(res, err, 'Could not load the post.'); }
});

blogAdminRouter.post('/', validateInput(blogPostSchema), async (req, res) => {
    try {
        const fields = await fieldsFrom(req.body, null);
        const post = await BlogPost.create({ ...fields, slug: await uniqueSlug(req.body.slug || req.body.title), createdBy: req.admin.username, updatedBy: req.admin.username });
        await recordAudit(req, 'BLOG_POST_CREATED', { targetType: 'BLOG_POST', targetId: String(post._id), reason: `${post.status} · ${post.title}` });
        res.status(201).json({ post: adminView(post.toObject()) });
    } catch (err) { fail(res, err, 'Could not save the post.'); }
});

blogAdminRouter.put('/:id', validateInput(blogPostSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Post not found.' });
        const existing = await BlogPost.findById(req.params.id).lean();
        if (!existing) return res.status(404).json({ error: 'Post not found.' });
        const fields = await fieldsFrom(req.body, existing);
        const slug = req.body.slug && slugify(req.body.slug) !== existing.slug ? await uniqueSlug(req.body.slug, existing._id) : existing.slug;
        const update = { $set: { ...fields, slug, updatedBy: req.admin.username } };
        if ('coverImage' in fields && fields.coverImage === undefined) { delete update.$set.coverImage; update.$unset = { coverImage: 1 }; }
        const post = await BlogPost.findByIdAndUpdate(existing._id, update, { new: true }).lean();
        await recordAudit(req, 'BLOG_POST_UPDATED', { targetType: 'BLOG_POST', targetId: String(post._id), reason: `${post.status} · ${post.title}` });
        res.json({ post: adminView(post) });
    } catch (err) { fail(res, err, 'Could not save the post.'); }
});

// PATCH /api/admin/blog/:id/status — publish or move back to draft.
blogAdminRouter.patch('/:id/status', validateInput(blogStatusSchema), async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Post not found.' });
        const existing = await BlogPost.findById(req.params.id).select('publishedAt').lean();
        if (!existing) return res.status(404).json({ error: 'Post not found.' });
        const set = { status: req.body.status, updatedBy: req.admin.username };
        if (req.body.status === 'PUBLISHED' && !existing.publishedAt) set.publishedAt = new Date();
        const post = await BlogPost.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
        await recordAudit(req, req.body.status === 'PUBLISHED' ? 'BLOG_POST_PUBLISHED' : 'BLOG_POST_UNPUBLISHED', { targetType: 'BLOG_POST', targetId: String(post._id), reason: post.title });
        res.json({ post: adminView(post) });
    } catch (err) { fail(res, err, 'Could not update the post.'); }
});

blogAdminRouter.delete('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Post not found.' });
        const post = await BlogPost.findByIdAndDelete(req.params.id).lean();
        if (!post) return res.status(404).json({ error: 'Post not found.' });
        await recordAudit(req, 'BLOG_POST_DELETED', { targetType: 'BLOG_POST', targetId: String(post._id), reason: post.title });
        res.json({ ok: true });
    } catch (err) { fail(res, err, 'Could not delete the post.'); }
});
