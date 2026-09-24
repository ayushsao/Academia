import crypto from 'crypto';
import { OtpToken } from '../db.js';
import { OTP_SECRET } from '../config.js';
import { sendEmail, sendSms } from './messaging.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;


const hashCode = (userId, channel, code) =>
    crypto.createHmac('sha256', OTP_SECRET).update(`${userId}:${channel}:${code}`).digest('hex');

export class OtpError extends Error {
    constructor(message, status = 400, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

// Creates a fresh code (invalidating any previous one) and delivers it.
// The code itself is never returned to the caller.
export async function issueOtp({ userId, channel, target }) {
    const existing = await OtpToken.findOne({ userId, channel }).sort({ createdAt: -1 });
    if (existing) {
        const waitMs = existing.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
        if (waitMs > 0) throw new OtpError('Please wait before requesting another code.', 429, { retryAfter: Math.ceil(waitMs / 1000) });
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await OtpToken.deleteMany({ userId, channel });
    await OtpToken.create({
        userId, channel, target,
        codeHash: hashCode(userId, channel, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    const text = `Your AssignmentMinds verification code is ${code}. It expires in 10 minutes. Never share this code with anyone.`;
    if (channel === 'EMAIL') {
        await sendEmail({
            to: target,
            subject: 'Verify your AssignmentMinds writer account',
            text,
            html: `<p>Your AssignmentMinds verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
        });
    } else {
        await sendSms({ to: target, text });
    }
    return { expiresInSeconds: OTP_TTL_MS / 1000, resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
}

// Checks a submitted code. The token is bound to the target it was sent to, so
// changing the phone/email after sending invalidates it.
export async function verifyOtp({ userId, channel, target, code }) {
    const token = await OtpToken.findOne({ userId, channel }).sort({ createdAt: -1 });
    if (!token || token.expiresAt < new Date() || token.target !== target)
        throw new OtpError('This code has expired. Please request a new one.');
    if (token.attempts >= MAX_ATTEMPTS)
        throw new OtpError('Too many incorrect attempts. Please request a new code.', 429);

    const expected = Buffer.from(token.codeHash, 'hex');
    const actual = Buffer.from(hashCode(userId, channel, code), 'hex');
    if (!crypto.timingSafeEqual(expected, actual)) {
        token.attempts += 1;
        await token.save();
        const remaining = MAX_ATTEMPTS - token.attempts;
        throw new OtpError(remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please request a new code.');
    }
    await OtpToken.deleteMany({ userId, channel });
}
