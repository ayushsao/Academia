import {
    User, Writer, Notification, NotificationPreference, Assignment, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS,
} from '../db.js';
import { sendEmail, sendSms, sendWhatsApp, channelUsable, DeliveryUnavailableError } from './messaging.js';

// Every user-facing notification goes through notify(): it stores the in-app
// record, decides which external channels to use from the user's preferences,
// and hands delivery to an outbox so a slow or failing provider never blocks the
// action that caused it. Failed sends retry with backoff; dedupe keys make
// reminders idempotent. New channels plug in via CHANNEL_SENDERS.

export const CATEGORY_META = {
    APPLICATION: { label: 'Application updates', description: 'Review decisions and requests for more information.' },
    APPROVAL: { label: 'Approvals', description: 'Your account or work being approved.' },
    SUBSCRIPTION: { label: 'Membership', description: 'Activation, renewals, plan changes and expiry.' },
    PAYMENT: { label: 'Payments', description: 'Payment confirmations, rejections, failures and payouts.' },
    OPPORTUNITY: { label: 'Opportunities', description: 'New assignment offers you are eligible for.' },
    ASSIGNMENT: { label: 'Assignments', description: 'Changes to work you have accepted.' },
    DEADLINE: { label: 'Deadline reminders', description: 'Reminders before work is due and when it is overdue.' },
    REVISION: { label: 'Revisions', description: 'Revision requests on your submissions.' },
    ACCOUNT: { label: 'Account & security', description: 'Important account notices. Email can’t be turned off.' },
};
// Channels that can't be switched off for a category (security-relevant mail).
const LOCKED = { ACCOUNT: ['EMAIL'] };
const DEFAULTS = { EMAIL: true, SMS: false, WHATSAPP: false };

const CHANNEL_SENDERS = {
    EMAIL: async (n, user) => {
        const url = absoluteLink(n.link);
        await sendEmail({
            to: user.email,
            subject: `AssignmentMinds: ${n.title}`,
            text: `${n.message}${url ? `\n\nOpen: ${url}` : ''}\n\n—\nManage notifications: ${absoluteLink('/writer/notifications') || 'your dashboard'}`,
            html: emailHtml(n, url),
        });
    },
    SMS: async (n, user, writer) => sendSms({ to: writer.phoneE164, text: shortText(n) }),
    WHATSAPP: async (n, user, writer) => sendWhatsApp({ to: writer.phoneE164, text: shortText(n) }),
};

const MAX_ATTEMPTS = 4;
const LEASE_MS = 2 * 60 * 1000;
const backoffMs = (attempts) => Math.min(6 * 60 * 60 * 1000, 60 * 1000 * 5 ** (attempts - 1));   // 1m, 5m, 25m, …

const appUrl = () => (process.env.APP_URL || '').trim().replace(/\/$/, '');
const absoluteLink = (link) => (link && /^\/[^/]/.test(link) && /^https?:\/\//.test(appUrl()) ? `${appUrl()}${link}` : '');
const shortText = (n) => { const url = absoluteLink(n.link); return `AssignmentMinds — ${n.title}: ${n.message.replace(/\s+/g, ' ').slice(0, 220)}${url ? ` ${url}` : ''}`; };
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function emailHtml(n, url) {
    return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b1b33">
<p style="font-size:13px;color:#64748b;margin:0 0 16px">AssignmentMinds</p>
<h1 style="font-size:20px;margin:0 0 12px">${esc(n.title)}</h1>
<p style="font-size:15px;line-height:1.6;white-space:pre-line;margin:0 0 20px">${esc(n.message)}</p>
${url ? `<p style="margin:0 0 24px"><a href="${esc(url)}" style="background:#002147;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;display:inline-block">Open in AssignmentMinds</a></p>` : ''}
<p style="font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px">You’re receiving this because of activity on your AssignmentMinds account.</p></div>`;
}

// ── Preferences ────────────────────────────────────────────────────────────────

async function contactFor(userId) {
    const [user, writer] = await Promise.all([
        User.findById(userId).select('email name role').lean(),
        Writer.findOne({ userId }).select('phoneE164 phoneVerified').lean(),
    ]);
    return { user, writer };
}

// Whether a channel can be used at all for this user (provider + verified contact).
const channelAvailable = (channel, { user, writer }) =>
    channelUsable(channel) && (channel === 'EMAIL' ? Boolean(user?.email) : Boolean(writer?.phoneVerified && writer.phoneE164));

export async function getPreferences(userId) {
    const [pref, contact] = await Promise.all([NotificationPreference.findOne({ userId }).lean(), contactFor(userId)]);
    const saved = pref?.channels || {};
    return NOTIFICATION_CATEGORIES.map(key => ({
        key, ...CATEGORY_META[key],
        channels: Object.fromEntries(NOTIFICATION_CHANNELS.map(ch => {
            const locked = (LOCKED[key] || []).includes(ch);
            const stored = saved[key]?.[ch];
            return [ch, { enabled: locked || (typeof stored === 'boolean' ? stored : DEFAULTS[ch]), locked, available: channelAvailable(ch, contact) }];
        })),
    }));
}

export async function setPreferences(userId, changes) {
    const $set = {};
    for (const [key, chans] of Object.entries(changes || {})) {
        if (!NOTIFICATION_CATEGORIES.includes(key)) continue;
        for (const [ch, on] of Object.entries(chans || {})) {
            if (!NOTIFICATION_CHANNELS.includes(ch) || typeof on !== 'boolean') continue;
            if ((LOCKED[key] || []).includes(ch)) continue;
            $set[`channels.${key}.${ch}`] = on;
        }
    }
    if (Object.keys($set).length) await NotificationPreference.updateOne({ userId }, { $set }, { upsert: true });
    return getPreferences(userId);
}

async function channelsFor(userId, category, contact) {
    const pref = await NotificationPreference.findOne({ userId }).lean();
    return NOTIFICATION_CHANNELS.filter(ch => {
        if (!channelAvailable(ch, contact)) return false;
        if ((LOCKED[category] || []).includes(ch)) return true;
        const stored = pref?.channels?.[category]?.[ch];
        return typeof stored === 'boolean' ? stored : DEFAULTS[ch];
    });
}

// ── Sending ────────────────────────────────────────────────────────────────────

/**
 * Records a notification and queues its external deliveries.
 * @param {object} n  { userId | writerId, category, type, title, message, link?, dedupeKey? }
 * @returns the Notification, or the existing one when dedupeKey was already used.
 */
export async function notify({ userId, writerId, category = 'ACCOUNT', type, title, message, link = '', dedupeKey }) {
    if (!userId && writerId) userId = (await Writer.findById(writerId).select('userId').lean())?.userId;
    if (!userId) return null;
    if (!NOTIFICATION_CATEGORIES.includes(category)) category = 'ACCOUNT';
    const contact = await contactFor(userId);
    const channels = await channelsFor(userId, category, contact);
    let doc;
    try {
        doc = await Notification.create({
            userId, category, type: type || category, title, message, link, ...(dedupeKey ? { dedupeKey } : {}),
            deliveries: channels.map(channel => ({ channel })),
        });
    } catch (err) {
        if (err?.code === 11000 && dedupeKey) return Notification.findOne({ dedupeKey });
        throw err;
    }
    if (channels.length) setImmediate(() => deliverNotification(doc._id).catch(err => console.error('[Notify] delivery error:', err.message)));
    return doc;
}

// Sends every due delivery of one notification. Each delivery is claimed with a
// short lease first, so concurrent workers never send the same message twice.
export async function deliverNotification(id, now = new Date()) {
    const n = await Notification.findById(id).lean();
    if (!n) return;
    const due = n.deliveries.filter(d => d.status === 'PENDING' && new Date(d.nextAttemptAt) <= now);
    if (!due.length) return;
    const contact = await contactFor(n.userId);
    for (const d of due) {
        const claim = await Notification.updateOne(
            { _id: id, deliveries: { $elemMatch: { channel: d.channel, status: 'PENDING', nextAttemptAt: { $lte: now } } } },
            { $set: { 'deliveries.$.nextAttemptAt': new Date(now.getTime() + LEASE_MS) }, $inc: { 'deliveries.$.attempts': 1 } },
        );
        if (!claim.modifiedCount) continue;
        const attempts = (d.attempts || 0) + 1;
        const set = (fields) => Notification.updateOne({ _id: id, 'deliveries.channel': d.channel },
            { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`deliveries.$.${k}`, v])) });
        try {
            if (!channelAvailable(d.channel, contact)) { await set({ status: 'SKIPPED', lastError: 'Channel unavailable for this user' }); continue; }
            await CHANNEL_SENDERS[d.channel](n, contact.user, contact.writer);
            await set({ status: 'SENT', sentAt: new Date(), lastError: '' });
        } catch (err) {
            const message = String(err?.message || err).slice(0, 300);
            if (err instanceof DeliveryUnavailableError) await set({ status: 'SKIPPED', lastError: message });
            else if (attempts >= MAX_ATTEMPTS) await set({ status: 'FAILED', lastError: message });
            else await set({ status: 'PENDING', lastError: message, nextAttemptAt: new Date(Date.now() + backoffMs(attempts)) });
            console.error(`[Notify] ${d.channel} attempt ${attempts} failed:`, message);
        }
    }
}

export async function processOutbox(limit = 200) {
    const now = new Date();
    const due = await Notification.find({ deliveries: { $elemMatch: { status: 'PENDING', nextAttemptAt: { $lte: now } } } })
        .select('_id').sort({ createdAt: 1 }).limit(limit).lean();
    for (const n of due) await deliverNotification(n._id, now).catch(err => console.error('[Notify] outbox error:', err.message));
    return due.length;
}

// ── Deadline reminders ─────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const REMINDERS = [
    { key: '24h', within: 24 * HOUR, text: 'is due in less than 24 hours' },
    { key: '2h', within: 2 * HOUR, text: 'is due in less than 2 hours' },
];

// Reminds assigned writers before their deadline (24h and 2h) and once when it
// passes. Dedupe keys include the deadline, so a moved deadline reminds again.
export async function runDeadlineReminders(now = new Date()) {
    let sent = 0;
    const active = await Assignment.find({
        status: { $in: ['ASSIGNED', 'REVISION_REQUESTED'] }, assignedWriterId: { $ne: null },
        $or: [{ writerDeadline: { $lte: new Date(now.getTime() + 24 * HOUR) } }, { revisionDueAt: { $lte: new Date(now.getTime() + 24 * HOUR) } }],
    }).select('assignmentRef title status assignedWriterId writerDeadline revisionDueAt').limit(1000).lean();
    for (const a of active) {
        const due = a.status === 'REVISION_REQUESTED' && a.revisionDueAt ? new Date(a.revisionDueAt) : new Date(a.writerDeadline);
        const what = a.status === 'REVISION_REQUESTED' ? `Your revision for “${a.title}”` : `“${a.title}”`;
        const base = `deadline:${a._id}:${a.assignedWriterId}:${due.toISOString()}`;
        const link = `/writer/assignments/${a.assignmentRef}`;
        const left = due.getTime() - now.getTime();
        let spec = null;
        if (left <= 0) spec = { key: 'overdue', title: 'Deadline passed', message: `${what} was due ${due.toUTCString()}. Please submit as soon as possible or contact the team.` };
        else {
            const r = [...REMINDERS].reverse().find(x => left <= x.within);
            if (r) spec = { key: r.key, title: 'Deadline reminder', message: `${what} ${r.text} (due ${due.toUTCString()}).` };
        }
        if (!spec) continue;
        const dedupeKey = `${base}:${spec.key}`;
        if (await Notification.exists({ dedupeKey })) continue;
        await notify({ writerId: a.assignedWriterId, category: 'DEADLINE', type: `DEADLINE_${spec.key.toUpperCase()}`, title: spec.title, message: spec.message, link, dedupeKey });
        sent += 1;
    }
    return sent;
}

let timer = null;
export function startNotificationWorker(intervalMs = 60 * 1000) {
    if (timer) return;
    let ticks = 0;
    const tick = async () => {
        try {
            await processOutbox();
            if (ticks++ % 5 === 0) await runDeadlineReminders();   // every ~5 minutes
        } catch (err) { console.error('[Notify] worker failed:', err.message); }
    };
    tick();
    timer = setInterval(tick, intervalMs);
    timer.unref?.();
}
