import { Router } from 'express';
import mongoose from 'mongoose';
import { CatalogSubject, CatalogService, CatalogProject, PricingRule, AuditLog, CatalogMedia, ContentBlock, CatalogFaq } from '../db.js';
import { authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore, can } from '../permissions.js';
import {
    validateInput, catalogSubjectSchema, catalogServiceSchema, catalogProjectSchema, catalogStatusSchema, catalogPublishSchema,
    pricingRuleSchema, wordConfigSchema, quoteSchema, wordPricingSchema,
} from '../validation.js';
import { getWordPricing, saveWordPricing, getInrRates, WordPricingError, MULTIPLIER_MIN, MULTIPLIER_MAX, MIN_NOTICE_HOURS, BASE_RATE_PER_WORD_INR } from '../services/wordPricing.js';
import { recordAudit } from '../services/audit.js';
import { isIsoCurrency, toMinor, fromMinor } from '../services/money.js';
import { FORMULAS, PricingError, unitPriceFor, quote, getWordConfig, saveWordConfig, normaliseRuleScope } from '../services/pricing.js';
import { receiveCatalogFiles, storeCatalogFiles, removeCatalogFile, streamCatalogFile, MediaError, LIMITS } from '../services/catalogMedia.js';
import { cacheDelPattern, invalidateOnWrite } from '../services/cache.js';

// Admin CRM core: /api/admin/catalog. Subjects/Services/Projects need
// catalog.manage; pricing rules and word/page config need pricing.manage.
const router = Router();
router.use(noStore, authenticateAdmin);
router.use(invalidateOnWrite('catalog:'));   // also covers images, project files and pricing rules

const CATALOG = requirePermission('catalog.manage');
const PRICING = requirePermission('pricing.manage');
const EITHER = requirePermission('catalog.manage', 'pricing.manage');

class CrmError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

function handle(res, err, fallback) {
    if (err instanceof CrmError || err instanceof PricingError || err instanceof MediaError) return res.status(err.status).json({ error: err.message });
    if (err?.code === 11000) return res.status(409).json({ error: 'That slug is already used here. Choose another.' });
    if (err?.name === 'CastError') return res.status(404).json({ error: 'Not found.' });
    console.error(`[Catalog] ${fallback}:`, err);
    return res.status(500).json({ error: fallback });
}

const isId = (v) => mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(String(v));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const str = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const toSlug = (v) => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'item';

// Slug from the input (or the name), made unique within its scope by suffixing -2, -3…
async function uniqueSlug(Model, wanted, scope, excludeId) {
    const base = toSlug(wanted);
    for (let i = 1; i < 500; i++) {
        const slug = i === 1 ? base : `${base}-${i}`;
        if (!await Model.exists({ ...scope, slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) return slug;
    }
    throw new CrmError('Could not find a free slug. Please choose one manually.', 409);
}

function pageParams(q) {
    const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit, 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
const SORTS = { order: { sortOrder: 1, _id: 1 }, name: { name: 1, _id: 1 }, title: { title: 1, _id: 1 }, newest: { createdAt: -1, _id: -1 }, updated: { updatedAt: -1, _id: -1 } };

const audit = (req, action, targetType, doc, reason = '') =>
    recordAudit(req, action, { targetType, targetId: doc?._id, reason: (reason || doc?.name || doc?.title || doc?.label || '').slice(0, 300) });

/**
 * Registers list/get/create/update/status/publish/delete routes for one entity.
 * Hooks: prepare(body, existing) → fields to save; beforeDelete(doc); decorate(rows).
 */
function crud({ path, Model, schema, entity, guard, nameField = 'name', searchFields, filters = [], publishable = true, prepare, beforeDelete, afterDelete, decorate }) {
    const targetType = `CATALOG_${entity}`;

    router.get(path, guard, async (req, res) => {
        try {
            const { page, limit, skip } = pageParams(req.query);
            const filter = {};
            const search = str(req.query.search);
            if (search) filter.$or = searchFields.map(f => ({ [f]: new RegExp(escapeRegex(search), 'i') }));
            if (['ACTIVE', 'INACTIVE'].includes(req.query.status)) filter.status = req.query.status;
            if (publishable && ['true', 'false'].includes(req.query.published)) filter.published = req.query.published === 'true';
            for (const f of filters) if (isId(req.query[f])) filter[f] = req.query[f];
            if (filters.includes('currency') && /^[A-Z]{3}$/.test(req.query.currency || '')) filter.currency = req.query.currency;
            const sort = SORTS[req.query.sort] || SORTS.order;
            const [total, rows] = await Promise.all([Model.countDocuments(filter), Model.find(filter).sort(sort).skip(skip).limit(limit).lean()]);
            res.json({ total, page, limit, items: decorate ? await decorate(rows) : rows });
        } catch (err) { handle(res, err, `Could not load ${entity.toLowerCase()}s.`); }
    });

    router.get(`${path}/:id`, guard, async (req, res) => {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
            const doc = await Model.findById(req.params.id).lean();
            if (!doc) return res.status(404).json({ error: 'Not found.' });
            res.json({ item: decorate ? (await decorate([doc]))[0] : doc });
        } catch (err) { handle(res, err, `Could not load ${entity.toLowerCase()}.`); }
    });

    router.post(path, guard, validateInput(schema), async (req, res) => {
        try {
            const fields = await prepare(req.body, null);
            if (publishable && fields.published) fields.publishedAt = new Date();
            const doc = await Model.create(fields);
            await audit(req, `${targetType}_CREATED`, targetType, doc);
            await cacheDelPattern('catalog:');
            res.status(201).json({ item: decorate ? (await decorate([doc.toObject()]))[0] : doc });
        } catch (err) { handle(res, err, `Could not create ${entity.toLowerCase()}.`); }
    });

    router.put(`${path}/:id`, guard, validateInput(schema), async (req, res) => {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
            const existing = await Model.findById(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Not found.' });
            const fields = await prepare(req.body, existing);
            if (publishable && fields.published && !existing.published) fields.publishedAt = new Date();
            existing.set(fields);
            await existing.save();
            await audit(req, `${targetType}_UPDATED`, targetType, existing);
            await cacheDelPattern('catalog:');
            res.json({ item: decorate ? (await decorate([existing.toObject()]))[0] : existing });
        } catch (err) { handle(res, err, `Could not save ${entity.toLowerCase()}.`); }
    });

    router.patch(`${path}/:id/status`, guard, validateInput(catalogStatusSchema), async (req, res) => {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
            const doc = await Model.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true }).lean();
            if (!doc) return res.status(404).json({ error: 'Not found.' });
            await audit(req, `${targetType}_${req.body.status === 'ACTIVE' ? 'ACTIVATED' : 'DEACTIVATED'}`, targetType, doc);
            await cacheDelPattern('catalog:');
            res.json({ item: decorate ? (await decorate([doc]))[0] : doc });
        } catch (err) { handle(res, err, 'Could not change status.'); }
    });

    if (publishable) {
        router.patch(`${path}/:id/publish`, guard, validateInput(catalogPublishSchema), async (req, res) => {
            try {
                if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
                const set = { published: req.body.published, ...(req.body.published ? { publishedAt: new Date() } : {}) };
                const doc = await Model.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
                if (!doc) return res.status(404).json({ error: 'Not found.' });
                await audit(req, `${targetType}_${req.body.published ? 'PUBLISHED' : 'UNPUBLISHED'}`, targetType, doc);
                await cacheDelPattern('catalog:');
                res.json({ item: decorate ? (await decorate([doc]))[0] : doc });
            } catch (err) { handle(res, err, 'Could not change publishing.'); }
        });
    }

    router.delete(`${path}/:id`, guard, async (req, res) => {
        try {
            if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found.' });
            const doc = await Model.findById(req.params.id);
            if (!doc) return res.status(404).json({ error: 'Not found.' });
            if (beforeDelete) await beforeDelete(doc);
            await doc.deleteOne();
            if (afterDelete) await afterDelete(doc);
            await audit(req, `${targetType}_DELETED`, targetType, doc, doc[nameField]);
            await cacheDelPattern('catalog:');
            res.json({ ok: true });
        } catch (err) { handle(res, err, `Could not delete ${entity.toLowerCase()}.`); }
    });
}

// A deleted page takes its content blocks and FAQs with it.
const removeEntityContent = (entityType, entityId) => Promise.all([ContentBlock.deleteMany({ entityType, entityId }), CatalogFaq.deleteMany({ entityType, entityId })]);

// Lookup maps for decorating rows with parent names.
async function namesById(Model, ids, field = 'name') {
    const unique = [...new Set(ids.filter(Boolean).map(String))];
    if (!unique.length) return new Map();
    const rows = await Model.find({ _id: { $in: unique } }).select(`${field} status published`).lean();
    return new Map(rows.map(r => [String(r._id), { id: r._id, name: r[field], status: r.status, published: r.published }]));
}
const countBy = async (Model, field, ids) => new Map((await Model.aggregate([
    { $match: { [field]: { $in: ids.map(id => new mongoose.Types.ObjectId(String(id))) } } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } },
])).map(r => [String(r._id), r.n]));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Subjects ───────────────────────────────────────────────────────────────────
crud({
    path: '/subjects', Model: CatalogSubject, schema: catalogSubjectSchema, entity: 'SUBJECT', guard: CATALOG, searchFields: ['name', 'slug', 'description'],
    prepare: async (b, existing) => ({ ...b, slug: await uniqueSlug(CatalogSubject, b.slug || b.name, {}, existing?._id) }),
    beforeDelete: async (doc) => {
        const [services, rules] = await Promise.all([CatalogService.countDocuments({ subjectId: doc._id }), PricingRule.countDocuments({ subjectId: doc._id })]);
        if (services || rules) throw new CrmError(`This subject still has ${[services && plural(services, 'service'), rules && plural(rules, 'price rule')].filter(Boolean).join(' and ')}. Delete or move them first.`, 409);
    },
    afterDelete: (doc) => Promise.all([removeCatalogFile(doc.image?.storedName), removeEntityContent('SUBJECT', doc._id)]),
    decorate: async (rows) => {
        const ids = rows.map(r => r._id);
        const [svc, prj] = await Promise.all([countBy(CatalogService, 'subjectId', ids), countBy(CatalogProject, 'subjectId', ids)]);
        return rows.map(r => ({ ...r, servicesCount: svc.get(String(r._id)) || 0, projectsCount: prj.get(String(r._id)) || 0 }));
    },
});

// ── Services ───────────────────────────────────────────────────────────────────
crud({
    path: '/services', Model: CatalogService, schema: catalogServiceSchema, entity: 'SERVICE', guard: CATALOG, searchFields: ['name', 'slug', 'description'], filters: ['subjectId'],
    prepare: async (b, existing) => {
        if (!await CatalogSubject.exists({ _id: b.subjectId })) throw new CrmError('Choose an existing subject.');
        if (existing && String(existing.subjectId) !== b.subjectId) {
            const [projects, rules] = await Promise.all([CatalogProject.countDocuments({ serviceId: existing._id }), PricingRule.countDocuments({ serviceId: existing._id })]);
            if (projects || rules) throw new CrmError('This service has projects or price rules, so it can’t move to another subject.', 409);
        }
        return { ...b, slug: await uniqueSlug(CatalogService, b.slug || b.name, { subjectId: b.subjectId }, existing?._id) };
    },
    beforeDelete: async (doc) => {
        const [projects, rules] = await Promise.all([CatalogProject.countDocuments({ serviceId: doc._id }), PricingRule.countDocuments({ serviceId: doc._id })]);
        if (projects || rules) throw new CrmError(`This service still has ${[projects && plural(projects, 'project'), rules && plural(rules, 'price rule')].filter(Boolean).join(' and ')}. Delete or move them first.`, 409);
    },
    afterDelete: (doc) => removeEntityContent('SERVICE', doc._id),
    decorate: async (rows) => {
        const [subjects, prj] = await Promise.all([namesById(CatalogSubject, rows.map(r => r.subjectId)), countBy(CatalogProject, 'serviceId', rows.map(r => r._id))]);
        return rows.map(r => ({ ...r, subject: subjects.get(String(r.subjectId)) || null, projectsCount: prj.get(String(r._id)) || 0 }));
    },
});

// ── Projects ───────────────────────────────────────────────────────────────────
crud({
    path: '/projects', Model: CatalogProject, schema: catalogProjectSchema, entity: 'PROJECT', guard: CATALOG, nameField: 'title', searchFields: ['title', 'slug', 'description'], filters: ['subjectId', 'serviceId'],
    prepare: async (b, existing) => {
        const service = await CatalogService.findById(b.serviceId).select('subjectId').lean();
        if (!service) throw new CrmError('Choose an existing service.');
        if (b.subjectId && b.subjectId !== String(service.subjectId)) throw new CrmError('The service does not belong to the chosen subject.');
        if (existing && String(existing.serviceId) !== b.serviceId && await PricingRule.exists({ projectId: existing._id }))
            throw new CrmError('This project has price rules, so it can’t move to another service.', 409);
        return { ...b, subjectId: service.subjectId, slug: await uniqueSlug(CatalogProject, b.slug || b.title, { serviceId: b.serviceId }, existing?._id) };
    },
    beforeDelete: async (doc) => {
        const rules = await PricingRule.countDocuments({ projectId: doc._id });
        if (rules) throw new CrmError(`This project still has ${plural(rules, 'price rule')}. Delete them first.`, 409);
    },
    afterDelete: (doc) => Promise.all([...doc.files.map(f => removeCatalogFile(f.storedName)), removeEntityContent('PROJECT', doc._id)]),
    decorate: async (rows) => {
        const [subjects, services] = await Promise.all([namesById(CatalogSubject, rows.map(r => r.subjectId)), namesById(CatalogService, rows.map(r => r.serviceId))]);
        return rows.map(r => ({ ...r, subject: subjects.get(String(r.subjectId)) || null, service: services.get(String(r.serviceId)) || null }));
    },
});

// ── Pricing rules ──────────────────────────────────────────────────────────────
const ruleView = (r, subjects, services, projects, inEffect) => ({
    ...r, basePrice: fromMinor(r.basePriceMinor, r.currency), unitPriceMinor: unitPriceFor(r),
    subject: subjects.get(String(r.subjectId)) || null, service: r.serviceId ? services.get(String(r.serviceId)) || null : null,
    project: r.projectId ? projects.get(String(r.projectId)) || null : null,
    state: r.status !== 'ACTIVE' ? 'INACTIVE' : new Date(r.effectiveDate) > new Date() ? 'SCHEDULED' : inEffect.has(String(r._id)) ? 'IN_EFFECT' : 'SUPERSEDED',
});
crud({
    path: '/pricing', Model: PricingRule, schema: pricingRuleSchema, entity: 'PRICING', guard: PRICING, nameField: 'label', publishable: false,
    searchFields: ['label', 'currency', 'formula'], filters: ['subjectId', 'serviceId', 'projectId', 'currency'],
    prepare: async (b) => {
        if (!isIsoCurrency(b.currency)) throw new CrmError('Use a valid ISO currency code (e.g. GBP, USD, INR).');
        if (!FORMULAS[b.formula]) throw new CrmError('Unknown pricing formula.');
        if (!await CatalogSubject.exists({ _id: b.subjectId })) throw new CrmError('Choose an existing subject.');
        const scope = await normaliseRuleScope({ subjectId: b.subjectId, serviceId: b.serviceId || null, projectId: b.projectId || null });
        const { basePrice, ...rest } = b;
        return { ...rest, ...scope, wordsPerPage: b.wordsPerPage || null, basePriceMinor: toMinor(basePrice, b.currency) };
    },
    decorate: async (rows) => {
        const [subjects, services, projects] = await Promise.all([
            namesById(CatalogSubject, rows.map(r => r.subjectId)), namesById(CatalogService, rows.map(r => r.serviceId)), namesById(CatalogProject, rows.map(r => r.projectId), 'title'),
        ]);
        // For each scope+currency on this page, which rule is the one currently in effect?
        const inEffect = new Set();
        const scopes = [...new Map(rows.map(r => [`${r.subjectId}|${r.serviceId}|${r.projectId}|${r.currency}`, r])).values()];
        await Promise.all(scopes.map(async (r) => {
            const current = await PricingRule.findOne({ subjectId: r.subjectId, serviceId: r.serviceId, projectId: r.projectId, currency: r.currency, status: 'ACTIVE', effectiveDate: { $lte: new Date() } })
                .sort({ effectiveDate: -1, updatedAt: -1 }).select('_id').lean();
            if (current) inEffect.add(String(current._id));
        }));
        return rows.map(r => ruleView(r, subjects, services, projects, inEffect));
    },
});

router.get('/pricing-formulas', PRICING, (_req, res) =>
    res.json({ formulas: Object.entries(FORMULAS).map(([key, f]) => ({ key, label: f.label, description: f.description })) }));

// Preview what a customer would pay (uses the same resolution as the public quote).
router.post('/pricing-preview', PRICING, validateInput(quoteSchema), async (req, res) => {
    try { res.json({ quote: await quote(req.body) }); }
    catch (err) { handle(res, err, 'Could not calculate a price.'); }
});

// ── Word / page configuration ──────────────────────────────────────────────────
router.get('/word-config', PRICING, async (_req, res) => {
    try { res.json({ config: await getWordConfig() }); } catch (err) { handle(res, err, 'Could not load word settings.'); }
});
router.put('/word-config', PRICING, validateInput(wordConfigSchema), async (req, res) => {
    try {
        const config = await saveWordConfig(req.body);
        await recordAudit(req, 'CATALOG_WORD_CONFIG_UPDATED', { targetType: 'CATALOG_CONFIG', reason: `${config.defaultWordsPerPage} words/page · ${config.rounding}` });
        res.json({ config });
    } catch (err) { handle(res, err, 'Could not save word settings.'); }
});

// ── Order pricing (word-based): delivery-type multipliers ─────────────────────
const wordPricingView = async () => {
    const [settings, fx] = await Promise.all([getWordPricing(), getInrRates()]);
    return {
        ...settings,
        limits: { multiplierMin: MULTIPLIER_MIN, multiplierMax: MULTIPLIER_MAX, minNoticeHours: MIN_NOTICE_HOURS },
        baseRatePerWord: BASE_RATE_PER_WORD_INR,
        exchangeRates: { rates: fx.rates, at: fx.at, source: fx.source },
    };
};
router.get('/word-pricing', PRICING, async (_req, res) => {
    try { res.json({ pricing: await wordPricingView() }); } catch (err) { handle(res, err, 'Could not load order pricing.'); }
});
router.put('/word-pricing', PRICING, validateInput(wordPricingSchema), async (req, res) => {
    try {
        const saved = await saveWordPricing(req.body);
        const t = saved.tiers;
        await recordAudit(req, 'ORDER_WORD_PRICING_UPDATED', { targetType: 'CATALOG_CONFIG', reason: `Standard ${t.STANDARD.multiplier}× · Express ${t.EXPRESS.multiplier}× · Urgent ${t.URGENT.multiplier}× · Emergency ${t.EMERGENCY.multiplier}×` });
        res.json({ pricing: await wordPricingView() });
    } catch (err) {
        if (err instanceof WordPricingError) return res.status(err.status).json({ error: err.message });
        handle(res, err, 'Could not save order pricing.');
    }
});

// ── Media ──────────────────────────────────────────────────────────────────────
router.post('/subjects/:id/image', CATALOG, receiveCatalogFiles, async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new CrmError('Not found.', 404);
        const subject = await CatalogSubject.findById(req.params.id);
        if (!subject) throw new CrmError('Not found.', 404);
        if ((req.files || []).length > 1) throw new MediaError('A subject has one image. Upload a single file.');
        const [image] = await storeCatalogFiles(req.files, ['IMAGE']);
        const previous = subject.image?.storedName;
        subject.image = image;
        await subject.save();
        await removeCatalogFile(previous);
        await audit(req, 'CATALOG_SUBJECT_IMAGE_UPDATED', 'CATALOG_SUBJECT', subject);
        res.json({ item: subject });
    } catch (err) {
        await Promise.all((req.files || []).map(f => removeCatalogFile(f.filename)));
        handle(res, err, 'Could not upload image.');
    }
});
router.delete('/subjects/:id/image', CATALOG, async (req, res) => {
    try {
        const subject = isId(req.params.id) && await CatalogSubject.findById(req.params.id);
        if (!subject) throw new CrmError('Not found.', 404);
        const previous = subject.image?.storedName;
        subject.image = null;
        await subject.save();
        await removeCatalogFile(previous);
        await audit(req, 'CATALOG_SUBJECT_IMAGE_REMOVED', 'CATALOG_SUBJECT', subject);
        res.json({ item: subject });
    } catch (err) { handle(res, err, 'Could not remove image.'); }
});
router.post('/projects/:id/files', CATALOG, receiveCatalogFiles, async (req, res) => {
    try {
        if (!isId(req.params.id)) throw new CrmError('Not found.', 404);
        const project = await CatalogProject.findById(req.params.id);
        if (!project) throw new CrmError('Not found.', 404);
        if (project.files.length + (req.files || []).length > 30) throw new MediaError('A project can hold at most 30 images and files.');
        const stored = await storeCatalogFiles(req.files, ['IMAGE', 'FILE']);
        project.files.push(...stored);
        await project.save();
        await audit(req, 'CATALOG_PROJECT_FILES_ADDED', 'CATALOG_PROJECT', project, `${project.title} (+${stored.length})`);
        res.status(201).json({ item: project });
    } catch (err) {
        await Promise.all((req.files || []).map(f => removeCatalogFile(f.filename)));
        handle(res, err, 'Could not upload files.');
    }
});
router.delete('/projects/:id/files/:fileId', CATALOG, async (req, res) => {
    try {
        const project = isId(req.params.id) && await CatalogProject.findById(req.params.id);
        if (!project) throw new CrmError('Not found.', 404);
        const file = project.files.id(req.params.fileId);
        if (!file) throw new CrmError('File not found.', 404);
        const storedName = file.storedName;
        file.deleteOne();
        await project.save();
        await removeCatalogFile(storedName);
        await audit(req, 'CATALOG_PROJECT_FILE_REMOVED', 'CATALOG_PROJECT', project, `${project.title} (−${file.originalName})`);
        res.json({ item: project });
    } catch (err) { handle(res, err, 'Could not remove file.'); }
});

// Any catalogue file, regardless of publish state (admin preview).
router.get('/media/:name', EITHER, async (req, res) => {
    try {
        const name = String(req.params.name);
        const subject = await CatalogSubject.findOne({ 'image.storedName': name }).select('image').lean();
        const file = subject?.image || (await CatalogProject.findOne({ 'files.storedName': name }).select('files').lean())?.files.find(f => f.storedName === name)
            || await CatalogMedia.findOne({ storedName: name }).lean();   // media library (blocks, SEO images)
        if (!file) return res.status(404).json({ error: 'File not found.' });
        await streamCatalogFile(res, file);
    } catch (err) { if (!res.headersSent) handle(res, err, 'Could not load file.'); }
});

// ── Dashboard & options ────────────────────────────────────────────────────────
router.get('/dashboard', EITHER, async (req, res) => {
    try {
        const tally = (Model) => Promise.all([Model.countDocuments(), Model.countDocuments({ status: 'ACTIVE' }), Model.countDocuments({ status: 'ACTIVE', published: true })])
            .then(([total, active, published]) => ({ total, active, published }));
        const now = new Date();
        const [subjects, services, projects, rulesTotal, rulesActive, scheduled, currencies, recent] = await Promise.all([
            tally(CatalogSubject), tally(CatalogService), tally(CatalogProject),
            PricingRule.countDocuments(), PricingRule.countDocuments({ status: 'ACTIVE', effectiveDate: { $lte: now } }),
            PricingRule.countDocuments({ status: 'ACTIVE', effectiveDate: { $gt: now } }), PricingRule.distinct('currency', { status: 'ACTIVE' }),
            AuditLog.find({ targetType: { $regex: /^CATALOG_/ } }).sort({ createdAt: -1 }).limit(8).select('action adminUsername reason createdAt').lean(),
        ]);
        // Active services with no active subject- or service-level price in effect.
        const pricedServices = new Set((await PricingRule.distinct('serviceId', { status: 'ACTIVE', effectiveDate: { $lte: now }, serviceId: { $ne: null } })).map(String));
        const pricedSubjects = new Set((await PricingRule.distinct('subjectId', { status: 'ACTIVE', effectiveDate: { $lte: now }, serviceId: null, projectId: null })).map(String));
        const activeServices = await CatalogService.find({ status: 'ACTIVE' }).select('_id subjectId name').lean();
        const unpriced = activeServices.filter(s => !pricedServices.has(String(s._id)) && !pricedSubjects.has(String(s.subjectId)));
        res.json({
            subjects, services, projects,
            pricing: { total: rulesTotal, inEffect: rulesActive, scheduled, currencies: currencies.sort() },
            unpricedServices: { count: unpriced.length, sample: await Promise.all(unpriced.slice(0, 5).map(async s => ({ id: s._id, name: `${(await CatalogSubject.findById(s.subjectId).select('name').lean())?.name || '?'} › ${s.name}` }))) },
            wordConfig: can(req.admin.adminRole, 'pricing.manage') ? await getWordConfig() : null,
            recent: recent.map(r => ({ action: r.action, by: r.adminUsername, reason: r.reason, at: r.createdAt })),
        });
    } catch (err) { handle(res, err, 'Could not load the catalogue dashboard.'); }
});

// Compact lists for dropdowns (all statuses, so drafts can be linked too).
router.get('/options', EITHER, async (_req, res) => {
    try {
        const [subjects, services, projects] = await Promise.all([
            CatalogSubject.find().sort(SORTS.order).select('name status published').limit(2000).lean(),
            CatalogService.find().sort(SORTS.order).select('name subjectId status published').limit(5000).lean(),
            CatalogProject.find().sort(SORTS.order).select('title subjectId serviceId status published').limit(10000).lean(),
        ]);
        res.json({ subjects, services, projects, limits: { imageMB: LIMITS.IMAGE / 1048576, fileMB: LIMITS.FILE / 1048576 } });
    } catch (err) { handle(res, err, 'Could not load options.'); }
});

export default router;
