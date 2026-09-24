import { AuditLog } from '../db.js';

// Single place every admin action (and every sensitive read) is recorded.
// Failures to write the log never block the action itself, but are reported.
export async function recordAudit(req, action, { reason = '', writerUserId, targetType, targetId } = {}) {
    try {
        await AuditLog.create({
            adminId: req.admin.id,
            adminUsername: req.admin.username,
            adminRole: req.admin.adminRole,
            action,
            reason: String(reason || '').slice(0, 1000),
            writerId: writerUserId || undefined,
            targetType,
            targetId: targetId ? String(targetId) : undefined,
            ip: req.ip,
            userAgent: String(req.get('user-agent') || '').slice(0, 200),
        });
    } catch (err) {
        console.error('[Audit] failed to record', action, err.message);
    }
}
