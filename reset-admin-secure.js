import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { Admin, connectDB } from './server/db.js';

// Resets (or creates) the "admin" super admin's password.
// The password is read from ADMIN_RESET_PASSWORD so it never lives in source
// control or shell history files:
//   ADMIN_RESET_PASSWORD='a-long-unique-passphrase' node reset-admin-secure.js
// Add --reset-2fa if the admin also lost their authenticator and recovery
// codes: they will set up two-factor authentication again at next sign-in.
async function resetAdminSecure() {
    const password = (process.env.ADMIN_RESET_PASSWORD || '').trim();
    if (password.length < 12) {
        console.error('Set ADMIN_RESET_PASSWORD to a password of at least 12 characters.');
        process.exit(1);
    }
    await connectDB();
    const hash = await bcrypt.hash(password, 12);
    const admin = await Admin.findOne({ username: 'admin' });
    if (admin) {
        admin.password = hash;
        await admin.save();
        console.log('Admin password reset.');
        if (process.argv.includes('--reset-2fa')) {
            await Admin.updateOne({ _id: admin._id }, { $set: { 'twoFactor.enabled': false, 'twoFactor.recoveryHashes': [], 'twoFactor.lastUsedStep': -1 }, $unset: { 'twoFactor.secretEnc': 1, 'twoFactor.pendingSecretEnc': 1 } });
            console.log('Two-factor authentication reset: set it up again at next sign-in.');
        }
    } else {
        await Admin.create({ username: 'admin', password: hash, role: 'SUPER_ADMIN' });
        console.log('Admin account created.');
    }
    process.exit(0);
}

resetAdminSecure().catch(err => { console.error(err.message); process.exit(1); });
