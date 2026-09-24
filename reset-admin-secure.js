import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { Admin, connectDB } from './server/db.js';

// Resets (or creates) the "admin" super admin's password.
// The password is read from ADMIN_RESET_PASSWORD so it never lives in source
// control or shell history files:
//   ADMIN_RESET_PASSWORD='a-long-unique-passphrase' node reset-admin-secure.js
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
    } else {
        await Admin.create({ username: 'admin', password: hash, role: 'SUPER_ADMIN' });
        console.log('Admin account created.');
    }
    process.exit(0);
}

resetAdminSecure().catch(err => { console.error(err.message); process.exit(1); });
