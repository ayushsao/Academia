import { Router } from 'express';
import mongoose from 'mongoose';
import { ContentBlock, CatalogFaq, CatalogMedia, BLOCK_TYPES } from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { validateInput, contentBlockSchema, reorderSchema, faqSchema, seoInputSchema, mediaAltSchema, catalogStatusSchema } from '../validation.js';
import { recordAudit } from '../services/audit.js';
import { ContentError, normaliseBlock, cleanRichText, loadEntity, buildPage, resolveSeo, MODELS } from '../services/contentBlocks.js';
import { receiveCatalogFiles, storeCatalogFiles, removeCatalogFile, MediaError } from '../services/catalogMedia.js';
import { cacheDelPattern } from '../services/cache.js';

// Dynamic content CMS for the catalogue: /api/admin/catalog (content routes).
// Blocks, FAQs, SEO and the media library need catalog.manage.
const router = Router();
router.use(noStore, authenticateAdmin, requirePermission('catalog.manage'));
router.use((req, res, next) => {
    if (req.method !== 'GET') {
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cacheDelPattern('catalog:').catch(() => {});
            }
            return originalJson(body);
        };
    }
    next();
});

const isId = (v) => mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(String(v));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ADMIN_MEDIA = (name) => `/api/admin/catalog/media/${name}`;
const origin = (req) => `${req.protocol}://${req.get('host')}`;

function handle(res, err, fallback) {
    if (err instanceof ContentError || err instanceof MediaError) return res.status(err.status).json({ error: err.message });
    if (err?.code === 11000) return res.status(409).json({ error: 'That slug is already used here. Choose another.' });
    console.error(`[Content] ${fallback}:`, err);
    return res.status(500).json({ error: fallback });
}
const audit = (req, action, targetType, targetId, reason) => recordAudit(req, action, { targetType, targetId, reason: String(reason || '').slice(0, 300) });
const typeParam = (t) => { const type = String(t || '').toUpperCase(); if (!MODELS[type]) throw new ContentError('Unknown content type.', 404); return type; };
const nextOrder = async (Model, entityType, entityId) => ((await Model.findOne({ entityType, entityId }).sort({ sortOrder: -1 }).select('sortOrder').lean())?.sortOrder ?? -10) + 10;

// ── Content overview for one entity ────────────────────────────────────────────
// GET /content/:type/:id → entity (+SEO), all blocks and FAQs (incl. disabled).
router.get('/content/:type/:id', async (req, res) => {
    try {
        const type = typeParam(req.params.type);
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const ctx = await loadEntity(type, req.params.id);
        const [blocks, faqs] = await Promise.all([
            ContentBlock.find({ entityType: type, entityId: ctx.entity._id }).sort({ sortOrder: 1, _id: 1 }).lean(),
            CatalogFaq.find({ entityType: type, entityId: ctx.entity._id }).sort({ sortOrder: 1, _id: 1 }).lean(),
        ]);
        const e = ctx.entity;
        res.json({
            entity: { type, id: e._id, name: ctx.name, slug: e.slug, status: e.status, published: e.published, path: ctx.path, live: ctx.live, seo: e.seo || {}, description: e.description, hasImage: Boolean(e.image) },
            blocks, faqs, blockTypes: BLOCK_TYPES,
            // What the page uses when a SEO field is left blank (editor placeholders).
            seoDefaults: resolveSeo({ ...ctx, live: true, entity: { ...e, seo: {} } }, { mediaUrl: ADMIN_MEDIA, apiOrigin: origin(req) }),
        });
    } catch (err) { handle(res, err, 'Could not load content.'); }
});

// ── Blocks ─────────────────────────────────────────────────────────────────────
async function blockFields(body) {
    await loadEntity(body.entityType, body.entityId);   // entity must exist
    const n = await normaliseBlock(body);
    return { entityType: body.entityType, entityId: body.entityId, type: body.type, status: body.status, ...n };
}

router.post('/blocks', validateInput(contentBlockSchema), async (req, res) => {
    try {
        const fields = await blockFields(req.body);
        fields.sortOrder = req.body.sortOrder ?? await nextOrder(ContentBlock, fields.entityType, fields.entityId);
        const block = await ContentBlock.create(fields);
        await audit(req, 'CATALOG_BLOCK_CREATED', 'CATALOG_BLOCK', block._id, `${block.type} ${block.title}`);
        res.status(201).json({ block });
    } catch (err) { handle(res, err, 'Could not add block.'); }
});

router.put('/blocks/reorder', validateInput(reorderSchema), async (req, res) => {
    try {
        const { entityType, entityId, ids } = req.body;
        const owned = await ContentBlock.countDocuments({ _id: { $in: ids }, entityType, entityId });
        if (owned !== new Set(ids).size) throw new ContentError('Some blocks don’t belong to this page.');
        await ContentBlock.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i * 10 } } } })));
        await audit(req, 'CATALOG_BLOCKS_REORDERED', 'CATALOG_BLOCK', entityId, `${entityType} · ${ids.length} blocks`);
        res.json({ blocks: await ContentBlock.find({ entityType, entityId }).sort({ sortOrder: 1, _id: 1 }).lean() });
    } catch (err) { handle(res, err, 'Could not reorder blocks.'); }
});

router.put('/blocks/:id', validateInput(contentBlockSchema), async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const block = await ContentBlock.findById(req.params.id);
        if (!block) throw new ContentError('Not found.', 404);
        const fields = await blockFields(req.body);
        const moved = String(block.entityId) !== String(fields.entityId) || block.entityType !== fields.entityType;
        if (moved) fields.sortOrder = await nextOrder(ContentBlock, fields.entityType, fields.entityId);   // reassigned: append
        else if (req.body.sortOrder !== undefined) fields.sortOrder = req.body.sortOrder;
        block.set(fields);
        block.markModified('content');
        await block.save();
        await audit(req, moved ? 'CATALOG_BLOCK_REASSIGNED' : 'CATALOG_BLOCK_UPDATED', 'CATALOG_BLOCK', block._id, `${block.type} ${block.title}`);
        res.json({ block });
    } catch (err) { handle(res, err, 'Could not save block.'); }
});

router.patch('/blocks/:id/status', validateInput(catalogStatusSchema), async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const block = await ContentBlock.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true }).lean();
        if (!block) throw new ContentError('Not found.', 404);
        await audit(req, req.body.status === 'ACTIVE' ? 'CATALOG_BLOCK_ENABLED' : 'CATALOG_BLOCK_DISABLED', 'CATALOG_BLOCK', block._id, `${block.type} ${block.title}`);
        res.json({ block });
    } catch (err) { handle(res, err, 'Could not change block.'); }
});

router.post('/blocks/:id/duplicate', async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const src = await ContentBlock.findById(req.params.id).lean();
        if (!src) throw new ContentError('Not found.', 404);
        const { _id, createdAt, updatedAt, ...rest } = src;
        // Place the copy right after the original, shifting later blocks down.
        await ContentBlock.updateMany({ entityType: src.entityType, entityId: src.entityId, sortOrder: { $gt: src.sortOrder } }, { $inc: { sortOrder: 10 } });
        const block = await ContentBlock.create({ ...rest, title: rest.title ? `${rest.title} (copy)` : '', status: 'INACTIVE', sortOrder: src.sortOrder + 5 });
        await audit(req, 'CATALOG_BLOCK_DUPLICATED', 'CATALOG_BLOCK', block._id, `${block.type} ${block.title}`);
        res.status(201).json({ block });
    } catch (err) { handle(res, err, 'Could not duplicate block.'); }
});

router.delete('/blocks/:id', async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const block = await ContentBlock.findByIdAndDelete(req.params.id).lean();
        if (!block) throw new ContentError('Not found.', 404);
        await audit(req, 'CATALOG_BLOCK_DELETED', 'CATALOG_BLOCK', block._id, `${block.type} ${block.title}`);
        res.json({ ok: true });
    } catch (err) { handle(res, err, 'Could not delete block.'); }
});

// ── FAQs ───────────────────────────────────────────────────────────────────────
router.get('/faqs', async (req, res) => {
    try {
        const filter = {};
        if (['SUBJECT', 'SERVICE', 'PROJECT'].includes(req.query.entityType)) filter.entityType = req.query.entityType;
        if (isId(req.query.entityId)) filter.entityId = req.query.entityId;
        if (['ACTIVE', 'INACTIVE'].includes(req.query.status)) filter.status = req.query.status;
        const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
        if (search) filter.$or = [{ question: new RegExp(escapeRegex(search), 'i') }, { answer: new RegExp(escapeRegex(search), 'i') }];
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
        const [total, items] = await Promise.all([CatalogFaq.countDocuments(filter), CatalogFaq.find(filter).sort({ sortOrder: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean()]);
        res.json({ total, page, limit, items });
    } catch (err) { handle(res, err, 'Could not load FAQs.'); }
});

const faqFields = async (b) => {
    await loadEntity(b.entityType, b.entityId);
    const answer = cleanRichText(b.answer);
    if (answer.replace(/<[^>]*>/g, '').trim().length < 2) throw new ContentError('Write an answer.');
    return { entityType: b.entityType, entityId: b.entityId, question: b.question, answer, status: b.status };
};

router.post('/faqs', validateInput(faqSchema), async (req, res) => {
    try {
        const fields = await faqFields(req.body);
        fields.sortOrder = req.body.sortOrder ?? await nextOrder(CatalogFaq, fields.entityType, fields.entityId);
        const faq = await CatalogFaq.create(fields);
        await audit(req, 'CATALOG_FAQ_CREATED', 'CATALOG_FAQ', faq._id, faq.question);
        res.status(201).json({ faq });
    } catch (err) { handle(res, err, 'Could not add FAQ.'); }
});

router.put('/faqs/reorder', validateInput(reorderSchema), async (req, res) => {
    try {
        const { entityType, entityId, ids } = req.body;
        const owned = await CatalogFaq.countDocuments({ _id: { $in: ids }, entityType, entityId });
        if (owned !== new Set(ids).size) throw new ContentError('Some FAQs don’t belong to this page.');
        await CatalogFaq.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i * 10 } } } })));
        await audit(req, 'CATALOG_FAQS_REORDERED', 'CATALOG_FAQ', entityId, `${entityType} · ${ids.length} FAQs`);
        res.json({ faqs: await CatalogFaq.find({ entityType, entityId }).sort({ sortOrder: 1, _id: 1 }).lean() });
    } catch (err) { handle(res, err, 'Could not reorder FAQs.'); }
});

router.put('/faqs/:id', validateInput(faqSchema), async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const faq = await CatalogFaq.findById(req.params.id);
        if (!faq) throw new ContentError('Not found.', 404);
        const fields = await faqFields(req.body);
        if (String(faq.entityId) !== String(fields.entityId)) fields.sortOrder = await nextOrder(CatalogFaq, fields.entityType, fields.entityId);
        else if (req.body.sortOrder !== undefined) fields.sortOrder = req.body.sortOrder;
        faq.set(fields);
        await faq.save();
        await audit(req, 'CATALOG_FAQ_UPDATED', 'CATALOG_FAQ', faq._id, faq.question);
        res.json({ faq });
    } catch (err) { handle(res, err, 'Could not save FAQ.'); }
});

router.patch('/faqs/:id/status', validateInput(catalogStatusSchema), async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const faq = await CatalogFaq.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true }).lean();
        if (!faq) throw new ContentError('Not found.', 404);
        await audit(req, req.body.status === 'ACTIVE' ? 'CATALOG_FAQ_ENABLED' : 'CATALOG_FAQ_DISABLED', 'CATALOG_FAQ', faq._id, faq.question);
        res.json({ faq });
    } catch (err) { handle(res, err, 'Could not change FAQ.'); }
});

router.delete('/faqs/:id', async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const faq = await CatalogFaq.findByIdAndDelete(req.params.id).lean();
        if (!faq) throw new ContentError('Not found.', 404);
        await audit(req, 'CATALOG_FAQ_DELETED', 'CATALOG_FAQ', faq._id, faq.question);
        res.json({ ok: true });
    } catch (err) { handle(res, err, 'Could not delete FAQ.'); }
});

// ── SEO ────────────────────────────────────────────────────────────────────────
// PUT /seo/:type/:id — SEO fields plus the slug (unique within its parent).
router.put('/seo/:type/:id', validateInput(seoInputSchema), async (req, res) => {
    try {
        const type = typeParam(req.params.type);
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const Model = MODELS[type];
        const entity = await Model.findById(req.params.id);
        if (!entity) throw new ContentError('Not found.', 404);
        const { slug, ogImageMediaId, keywords, ...seo } = req.body;
        let ogImage = entity.seo?.ogImage || null;
        if (ogImageMediaId === null) ogImage = null;
        else if (ogImageMediaId) {
            const m = await CatalogMedia.findById(ogImageMediaId).lean();
            if (!m) throw new ContentError('That image no longer exists.');
            if (m.kind !== 'IMAGE') throw new ContentError('The social image must be an image.');
            ogImage = { storedName: m.storedName, originalName: m.originalName, mimeType: m.mimeType, size: m.size, kind: 'IMAGE' };
        }
        entity.seo = { ...seo, keywords: [...new Set(keywords.map(k => k.trim()).filter(Boolean))], ogImage };
        if (slug && slug !== entity.slug) {
            const scope = type === 'SUBJECT' ? {} : type === 'SERVICE' ? { subjectId: entity.subjectId } : { serviceId: entity.serviceId };
            if (await Model.exists({ ...scope, slug, _id: { $ne: entity._id } })) throw new ContentError('That slug is already used here. Choose another.', 409);
            entity.slug = slug;
        }
        await entity.save();
        await audit(req, 'CATALOG_SEO_UPDATED', `CATALOG_${type}`, entity._id, entity.name || entity.title);
        const ctx = await loadEntity(type, entity._id);
        res.json({ entity: { type, id: entity._id, name: ctx.name, slug: entity.slug, path: ctx.path, live: ctx.live, seo: entity.seo } });
    } catch (err) { handle(res, err, 'Could not save SEO.'); }
});

// ── Preview ────────────────────────────────────────────────────────────────────
// GET /preview/:type/:id — the page exactly as it would render, drafts included.
router.get('/preview/:type/:id', async (req, res) => {
    try {
        const type = typeParam(req.params.type);
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const ctx = await loadEntity(type, req.params.id);
        res.json({ page: await buildPage(ctx, { liveOnly: false, mediaUrl: ADMIN_MEDIA, apiOrigin: origin(req), preview: true }) });
    } catch (err) { handle(res, err, 'Could not build preview.'); }
});

// ── Media library ──────────────────────────────────────────────────────────────
router.get('/media-library', async (req, res) => {
    try {
        const filter = {};
        if (['IMAGE', 'FILE'].includes(req.query.kind)) filter.kind = req.query.kind;
        const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
        if (search) filter.$or = [{ originalName: new RegExp(escapeRegex(search), 'i') }, { alt: new RegExp(escapeRegex(search), 'i') }];
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(60, Math.max(1, Number.parseInt(req.query.limit, 10) || 24));
        const [total, items] = await Promise.all([CatalogMedia.countDocuments(filter), CatalogMedia.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
        res.json({ total, page, limit, items });
    } catch (err) { handle(res, err, 'Could not load media.'); }
});

router.post('/media-library', receiveCatalogFiles, async (req, res) => {
    try {
        const stored = await storeCatalogFiles(req.files, ['IMAGE', 'FILE']);
        const items = await CatalogMedia.insertMany(stored.map(s => ({ ...s, uploadedBy: req.admin.username })));
        await audit(req, 'CATALOG_MEDIA_UPLOADED', 'CATALOG_MEDIA', items[0]?._id, items.map(i => i.originalName).join(', '));
        res.status(201).json({ items });
    } catch (err) {
        await Promise.all((req.files || []).map(f => removeCatalogFile(f.filename)));
        handle(res, err, 'Could not upload media.');
    }
});

router.patch('/media-library/:id', validateInput(mediaAltSchema), async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const item = await CatalogMedia.findByIdAndUpdate(req.params.id, { $set: { alt: req.body.alt } }, { new: true }).lean();
        if (!item) throw new ContentError('Not found.', 404);
        await ContentBlock.updateMany({ 'media.storedName': item.storedName }, { $set: { 'media.$[m].alt': item.alt } }, { arrayFilters: [{ 'm.storedName': item.storedName }] });
        res.json({ item });
    } catch (err) { handle(res, err, 'Could not save media.'); }
});

router.delete('/media-library/:id', async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new ContentError('Not found.', 404);
        const item = await CatalogMedia.findById(req.params.id).lean();
        if (!item) throw new ContentError('Not found.', 404);
        const usedInBlocks = await ContentBlock.countDocuments({ 'media.storedName': item.storedName });
        const usedInSeo = (await Promise.all(Object.values(MODELS).map(M => M.countDocuments({ 'seo.ogImage.storedName': item.storedName })))).reduce((a, b) => a + b, 0);
        if (usedInBlocks || usedInSeo) throw new ContentError(`This file is used by ${[usedInBlocks && `${usedInBlocks} block${usedInBlocks === 1 ? '' : 's'}`, usedInSeo && `${usedInSeo} SEO image${usedInSeo === 1 ? '' : 's'}`].filter(Boolean).join(' and ')}. Remove it there first.`, 409);
        await CatalogMedia.deleteOne({ _id: item._id });
        await removeCatalogFile(item.storedName);
        await audit(req, 'CATALOG_MEDIA_DELETED', 'CATALOG_MEDIA', item._id, item.originalName);
        res.json({ ok: true });
    } catch (err) { handle(res, err, 'Could not delete media.'); }
});

export default router;
