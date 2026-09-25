import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { CatalogSubject, CatalogService, CatalogProject, CatalogMedia } from '../db.js';
import { loadEntity, buildPage, isPublicContentFile } from '../services/contentBlocks.js';
import { validateInput, quoteSchema } from '../validation.js';
import { quote, getWordConfig, activePricing, isLiveSelection, PricingError } from '../services/pricing.js';
import { streamCatalogFile } from '../services/catalogMedia.js';

// Public catalogue: /api/catalog. Only ACTIVE + published items whose parents
// are ACTIVE + published are visible. Internal fields are never returned.
const router = Router();
const LIVE = { status: 'ACTIVE', published: true };
const ORDER = { sortOrder: 1, _id: 1 };
const quoteLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many price requests. Please slow down.' } });

const media = (f) => (f ? { url: `/api/catalog/media/${f.storedName}`, name: f.originalName, kind: f.kind, mimeType: f.mimeType } : null);
const subjectView = (s) => ({ id: s._id, name: s.name, slug: s.slug, description: s.description, image: media(s.image) });
const serviceView = (s) => ({ id: s._id, subjectId: s.subjectId, name: s.name, slug: s.slug, description: s.description });
const projectView = (p) => ({ id: p._id, subjectId: p.subjectId, serviceId: p.serviceId, title: p.title, slug: p.slug, description: p.description, files: p.files.map(media) });

async function liveTree() {
    const subjects = await CatalogSubject.find(LIVE).sort(ORDER).lean();
    const subjectIds = subjects.map(s => s._id);
    const services = await CatalogService.find({ ...LIVE, subjectId: { $in: subjectIds } }).sort(ORDER).lean();
    const projects = await CatalogProject.find({ ...LIVE, serviceId: { $in: services.map(s => s._id) } }).sort(ORDER).lean();
    return { subjects, services, projects };
}

// GET /api/catalog/tree — the whole published hierarchy (names/slugs only).
router.get('/tree', async (_req, res) => {
    try {
        const { subjects, services, projects } = await liveTree();
        res.setHeader('Cache-Control', 'no-cache'); // revalidate (ETag) so admin edits show immediately
        res.json({
            subjects: subjects.map(s => ({
                ...subjectView(s),
                services: services.filter(v => String(v.subjectId) === String(s._id)).map(v => ({
                    ...serviceView(v),
                    projects: projects.filter(p => String(p.serviceId) === String(v._id)).map(p => ({ id: p._id, title: p.title, slug: p.slug })),
                })),
            })),
        });
    } catch { res.status(500).json({ error: 'Could not load the catalogue.' }); }
});

// GET /api/catalog/subjects/:slug — one subject with its services and projects.
router.get('/subjects/:slug', async (req, res) => {
    try {
        const subject = await CatalogSubject.findOne({ ...LIVE, slug: String(req.params.slug).toLowerCase() }).lean();
        if (!subject) return res.status(404).json({ error: 'Subject not found.' });
        const services = await CatalogService.find({ ...LIVE, subjectId: subject._id }).sort(ORDER).lean();
        const projects = await CatalogProject.find({ ...LIVE, serviceId: { $in: services.map(s => s._id) } }).sort(ORDER).lean();
        res.json({ subject: { ...subjectView(subject), services: services.map(s => ({ ...serviceView(s), projects: projects.filter(p => String(p.serviceId) === String(s._id)).map(projectView) })) } });
    } catch { res.status(500).json({ error: 'Could not load the subject.' }); }
});

// GET /api/catalog/word-config — what the order form needs to convert words ↔ pages.
router.get('/word-config', async (_req, res) => {
    try {
        const c = await getWordConfig();
        res.json({ config: { defaultWordsPerPage: c.defaultWordsPerPage, rounding: c.rounding, minPages: c.minPages, maxPages: c.maxPages, spacingOptions: c.spacingOptions, defaultSpacing: c.defaultSpacing } });
    } catch { res.status(500).json({ error: 'Could not load settings.' }); }
});

// POST /api/catalog/quote — price for a published subject/service/project.
router.post('/quote', quoteLimiter, validateInput(quoteSchema), async (req, res) => {
    try {
        if (!await isLiveSelection(req.body)) return res.status(404).json({ error: 'That selection is not available.' });
        const q = await quote(req.body);
        const { ruleId, ...publicQuote } = q;
        res.json({ quote: publicQuote });
    } catch (err) {
        if (err instanceof PricingError) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: 'Could not calculate a price.' });
    }
});

// GET /api/catalog/pricing?subjectId=&serviceId=&projectId= — the active price
// per page (one entry per currency) for a live selection. Never cached, so a
// pricing change in the admin shows on the next page view.
router.get('/pricing', quoteLimiter, async (req, res) => {
    try {
        const one = (v) => (typeof v === 'string' && v ? v : undefined);
        const sel = { subjectId: one(req.query.subjectId), serviceId: one(req.query.serviceId), projectId: one(req.query.projectId) };
        if (!await isLiveSelection(sel)) return res.status(404).json({ error: 'That selection is not available.' });
        res.setHeader('Cache-Control', 'no-store');
        res.json({ pricing: await activePricing(sel) });
    } catch { res.status(500).json({ error: 'Could not load pricing.' }); }
});

// ── Dynamic pages (blocks + FAQs + SEO) ──────────────────────────────────────
// GET /api/catalog/pages/subject/:s · /pages/service/:s/:v · /pages/project/:s/:v/:p
const PUBLIC_MEDIA = (name) => `/api/catalog/media/${name}`;
async function sendPage(req, res, type, id) {
    const ctx = await loadEntity(type, id);
    if (!ctx.live) return res.status(404).json({ error: 'Page not found.' });
    res.setHeader('Cache-Control', 'no-cache'); // revalidate (ETag) so admin edits show immediately
    res.json({ page: await buildPage(ctx, { liveOnly: true, mediaUrl: PUBLIC_MEDIA, apiOrigin: `${req.protocol}://${req.get('host')}` }) });
}
const slugOf = (v) => String(v || '').toLowerCase().slice(0, 120);
const liveSubject = (slug) => CatalogSubject.findOne({ ...LIVE, slug: slugOf(slug) }).select('_id').lean();
const liveService = (subjectId, slug) => CatalogService.findOne({ ...LIVE, subjectId, slug: slugOf(slug) }).select('_id').lean();

router.get('/pages/subject/:s', async (req, res) => {
    try {
        const s = await liveSubject(req.params.s);
        if (!s) return res.status(404).json({ error: 'Page not found.' });
        await sendPage(req, res, 'SUBJECT', s._id);
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load page.' }); }
});
router.get('/pages/service/:s/:v', async (req, res) => {
    try {
        const s = await liveSubject(req.params.s);
        const v = s && await liveService(s._id, req.params.v);
        if (!v) return res.status(404).json({ error: 'Page not found.' });
        await sendPage(req, res, 'SERVICE', v._id);
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load page.' }); }
});
router.get('/pages/project/:s/:v/:p', async (req, res) => {
    try {
        const s = await liveSubject(req.params.s);
        const v = s && await liveService(s._id, req.params.v);
        const pr = v && await CatalogProject.findOne({ ...LIVE, serviceId: v._id, slug: slugOf(req.params.p) }).select('_id').lean();
        if (!pr) return res.status(404).json({ error: 'Page not found.' });
        await sendPage(req, res, 'PROJECT', pr._id);
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load page.' }); }
});

// GET /api/catalog/sitemap.xml — live, indexable catalogue pages.
router.get('/sitemap.xml', async (_req, res) => {
    try {
        const base = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
        const { subjects, services, projects } = await liveTree();
        const subjectById = new Map(subjects.map(s => [String(s._id), s]));
        const serviceById = new Map(services.map(s => [String(s._id), s]));
        const indexable = (e) => !String(e.seo?.robots || 'index').startsWith('noindex');
        const urls = [
            ...subjects.filter(indexable).map(s => ({ loc: `/subjects/${s.slug}`, at: s.updatedAt })),
            ...services.filter(indexable).map(v => ({ loc: `/subjects/${subjectById.get(String(v.subjectId)).slug}/${v.slug}`, at: v.updatedAt })),
            ...projects.filter(indexable).map(pr => {
                const v = serviceById.get(String(pr.serviceId));
                return { loc: `/subjects/${subjectById.get(String(v.subjectId)).slug}/${v.slug}/${pr.slug}`, at: pr.updatedAt };
            }),
        ];
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const body = urls.map(u => `  <url><loc>${esc(base + u.loc)}</loc><lastmod>${new Date(u.at).toISOString()}</lastmod></url>`).join('\n');
        res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
        res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    } catch { res.status(500).type('text/plain').send('Could not build sitemap.'); }
});

// GET /api/catalog/media/:name — images/files of live items only.
router.get('/media/:name', async (req, res) => {
    try {
        const name = String(req.params.name);
        const subject = await CatalogSubject.findOne({ ...LIVE, 'image.storedName': name }).select('image').lean();
        let file = subject?.image;
        if (!file) {
            const project = await CatalogProject.findOne({ ...LIVE, 'files.storedName': name }).select('files serviceId subjectId').lean();
            const parentsLive = project && await CatalogService.exists({ ...LIVE, _id: project.serviceId }) && await CatalogSubject.exists({ ...LIVE, _id: project.subjectId });
            file = parentsLive ? project.files.find(f => f.storedName === name) : null;
        }
        // Media-library files used by an active block or SEO image on a live page.
        if (!file && await isPublicContentFile(name)) file = await CatalogMedia.findOne({ storedName: name }).lean();
        if (!file) return res.status(404).json({ error: 'File not found.' });
        await streamCatalogFile(res, file, { cache: 'public, max-age=3600' });
    } catch { if (!res.headersSent) res.status(500).json({ error: 'Could not load file.' }); }
});

export default router;
