// Outbound email/SMS delivery. Providers are selected from environment
// variables so no SDKs are required:
//   Email: RESEND_API_KEY  or  SENDGRID_API_KEY  (+ EMAIL_FROM)
//   SMS:   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + (TWILIO_FROM_NUMBER | TWILIO_MESSAGING_SERVICE_SID)
// Without a provider, development builds log messages to the server console;
// production builds refuse to send so verification can never silently pass.

const isProduction = process.env.NODE_ENV === 'production';

export class DeliveryUnavailableError extends Error {}

function devFallback(channel, to, text) {
    if (isProduction) throw new DeliveryUnavailableError(`${channel} delivery is not configured.`);
    console.log(`\n[DEV ${channel}] → ${to}\n${text}\n`);
}

async function postJson(url, headers, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Email provider responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function sendEmail({ to, subject, text, html }) {
    const from = process.env.EMAIL_FROM || 'AssignmentMinds <no-reply@assignmentminds.com>';
    if (process.env.RESEND_API_KEY) {
        return postJson('https://api.resend.com/emails',
            { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
            { from, to: [to], subject, text, html });
    }
    if (process.env.SENDGRID_API_KEY) {
        const match = from.match(/^(.*)<(.+)>$/);
        return postJson('https://api.sendgrid.com/v3/mail/send',
            { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
            {
                personalizations: [{ to: [{ email: to }] }],
                from: match ? { name: match[1].trim(), email: match[2].trim() } : { email: from },
                subject,
                content: [{ type: 'text/plain', value: text }, ...(html ? [{ type: 'text/html', value: html }] : [])],
            });
    }
    return devFallback('EMAIL', to, `${subject}\n${text}`);
}

export async function sendSms({ to, text }) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) {
        const params = new URLSearchParams({ To: to, Body: text });
        if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
        else params.set('From', process.env.TWILIO_FROM_NUMBER || '');
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });
        if (!res.ok) throw new Error(`SMS provider responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
    }
    return devFallback('SMS', to, text);
}

// WhatsApp via Twilio's WhatsApp sender: TWILIO_WHATSAPP_FROM (e.g. +14155238886)
// plus the Twilio credentials above. Business-initiated WhatsApp messages outside a
// 24-hour customer session must use a Meta-approved template; set
// TWILIO_WHATSAPP_CONTENT_SID to send through an approved template whose single
// variable {{1}} receives the notification text.
export async function sendWhatsApp({ to, text }) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (sid && token && from) {
        const params = new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${from}` });
        if (process.env.TWILIO_WHATSAPP_CONTENT_SID) {
            params.set('ContentSid', process.env.TWILIO_WHATSAPP_CONTENT_SID);
            params.set('ContentVariables', JSON.stringify({ 1: text.slice(0, 900) }));
        } else params.set('Body', text);
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
        });
        if (!res.ok) throw new Error(`WhatsApp provider responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return;
    }
    return devFallback('WHATSAPP', to, text);
}

// Which outbound channels have a real provider configured. (Development builds
// still "send" unconfigured channels to the console.)
export function providerStatus() {
    const twilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    return {
        EMAIL: Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY),
        SMS: twilio && Boolean(process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID),
        WHATSAPP: twilio && Boolean(process.env.TWILIO_WHATSAPP_FROM),
    };
}
export const channelUsable = (channel) => providerStatus()[channel] || !isProduction;
