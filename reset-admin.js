import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { Admin, connectDB } from './server/db.js';

// Development helper: resets the local "admin" account to admin/admin123.
// Refuses to run against anything but a local database, so it can never put a
// known password on a production admin account (use reset-admin-secure.js).
async function resetAdmin() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/academiapro';
    const local = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(uri);
    if (!local || process.env.NODE_ENV === 'production') {
        console.error('reset-admin.js only works on a local development database. Use reset-admin-secure.js instead.');
        process.exit(1);
    }
    await connectDB();
    const hash = await bcrypt.hash('admin123', 12);
    const admin = await Admin.findOne({ username: 'admin' });
    if (admin) {
        admin.password = hash;
        await admin.save();
        console.log('Local admin password reset to the development default.');
    } else {
        await Admin.create({ username: 'admin', password: hash, role: 'SUPER_ADMIN' });
        console.log('Local admin created with the development default password.');
    }
    process.exit(0);
}

resetAdmin().catch(err => { console.error(err.message); process.exit(1); });
