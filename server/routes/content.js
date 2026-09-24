import { Router } from 'express';
import crypto from 'crypto';
import { authenticateAdmin } from '../middleware.js';
import { requirePermission, noStore } from '../permissions.js';
import { recordAudit } from '../services/audit.js';
import { getContent, saveContent, ContentError, DEFAULT_CONTENT, JOURNEY_STEPS } from '../services/siteContent.js';

// Public: GET /api/content/marketplace — recruitment page, FAQ, pricing copy,
// terms and contact details. Revalidated on every request via ETag (unchanged content costs a 304).
const router = Router();

router.get('/marketplace', async (req, res) => {
    try {
        const body = JSON.stringify(await getContent());
        const etag = `"${crypto.createHash('sha1').update(body).digest('base64url')}"`;
        res.setHeader('Cache-Control', 'public, no-cache');   // always revalidate (cheap 304) so edits show immediately
        res.setHeader('ETag', etag);
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        res.type('application/json').send(body);
    } catch { res.status(500).json({ error: 'Could not load content.' }); }
});

export default router;

// Admin: /api/admin/content (content.manage).
export const contentAdminRouter = Router();
contentAdminRouter.use(noStore, authenticateAdmin, requirePermission('content.manage'));

contentAdminRouter.get('/marketplace', async (_req, res) => {
    try { res.json({ ...(await getContent()), defaults: DEFAULT_CONTENT, steps: JOURNEY_STEPS }); }
    catch { res.status(500).json({ error: 'Could not load content.' }); }
});

contentAdminRouter.put('/marketplace', async (req, res) => {
    try {
        const result = await saveContent(req.body?.content);
        if (result.changed.length) await recordAudit(req, 'CONTENT_UPDATED', { targetType: 'CONTENT', targetId: 'marketplace', reason: `Sections: ${result.changed.join(', ')}` });
        res.json(result);
    } catch (err) {
        if (err instanceof ContentError) return res.status(400).json({ error: err.message });
        console.error('[Content] save failed:', err);
        res.status(500).json({ error: 'Could not save content.' });
    }
});
