import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { User, Writer, WriterProfile, WriterApplication, WriterAvailability, Admin, Order, connectDB } from './server/db.js';

async function seed() {
    await connectDB();
    console.log('Connected to MongoDB.');

    const passwordHash = await bcrypt.hash('Password123!', 12);
    const adminHash = await bcrypt.hash('AdminPassword123!', 12);

    // 1. Client / Student account
    let studentUser = await User.findOne({ email: 'student@example.com' });
    if (!studentUser) {
        studentUser = await User.create({
            name: 'Alex Student',
            email: 'student@example.com',
            password: passwordHash,
            role: 'student',
        });
        console.log('✓ Created Client: student@example.com / Password123!');
    } else {
        studentUser.password = passwordHash;
        studentUser.role = 'student';
        await studentUser.save();
        console.log('✓ Updated Client: student@example.com / Password123!');
    }

    // 2. Writer account
    let writerUser = await User.findOne({ email: 'writer@example.com' });
    if (!writerUser) {
        writerUser = await User.create({
            name: 'Dr. Sarah Writer',
            email: 'writer@example.com',
            password: passwordHash,
            role: 'WRITER',
        });
        console.log('✓ Created Writer User: writer@example.com / Password123!');
    } else {
        writerUser.password = passwordHash;
        writerUser.role = 'WRITER';
        await writerUser.save();
        console.log('✓ Updated Writer User: writer@example.com / Password123!');
    }

    let writerDoc = await Writer.findOne({ userId: writerUser._id });
    if (!writerDoc) {
        writerDoc = await Writer.create({
            userId: writerUser._id,
            status: 'APPROVED',
            displayName: 'Dr. Sarah Writer',
            emailCanonical: 'writer@example.com',
            phoneCountry: 'GB',
            phoneNumber: '07123456789',
            dialCode: '+44',
            phoneE164: '+447123456789',
            emailVerified: true,
            emailVerifiedAt: new Date(),
            phoneVerified: true,
            phoneVerifiedAt: new Date(),
        });
        await WriterProfile.create({
            writerId: writerDoc._id,
            userId: writerUser._id,
            country: 'GB',
            city: 'London',
            bio: 'Expert Academic Writer with 10+ years experience in Research and Dissertations.',
            academicLevel: 'DOCTORATE',
            educationLevel: 'PhD',
        });
        await WriterApplication.create({
            writerId: writerDoc._id,
            userId: writerUser._id,
            status: 'APPROVED',
            approvedAt: new Date(),
            history: [{ action: 'APPROVED', toStatus: 'APPROVED', actorType: 'ADMIN' }],
        });
        await WriterAvailability.create({
            writerId: writerDoc._id,
            effectiveStatus: 'AVAILABLE',
        });
        console.log('✓ Initialized complete Writer profile & approval for writer@example.com');
    } else {
        // Set active membership on writer so they can access approved orders
        writerDoc.membership = {
            status: 'ACTIVE',
            plan: 'Basic',
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
        await writerDoc.save();
        console.log('✓ Configured Writer Membership: Basic (ACTIVE)');
    }

    // 3. Admin account
    let admin = await Admin.findOne({ username: 'admin' });
    if (!admin) {
        admin = await Admin.create({
            username: 'admin',
            email: 'admin@academiapro.com',
            password: adminHash,
            role: 'SUPER_ADMIN',
        });
        console.log('✓ Created Admin: admin / AdminPassword123!');
    } else {
        admin.password = adminHash;
        await admin.save();
        console.log('✓ Updated Admin: admin / AdminPassword123!');
    }

    // 4. Sample Orders demonstrating the workflow
    await Order.deleteMany({ orderId: { $in: ['AP-2026-101', 'AP-2026-102'] } });

    // Order 1: Placed by client, NOT approved yet (Hidden from writers)
    await Order.create({
        orderId: 'AP-2026-101',
        userId: studentUser._id,
        user_name: studentUser.name,
        user_email: studentUser.email,
        service: 'Dissertation',
        subject: 'Finance & Banking',
        academicLevel: 'Master',
        topicTitle: 'Impact of AI & Machine Learning on Modern Retail Banking Fraud Detection',
        description: 'Comprehensive 15-page dissertation analyzing machine learning classification algorithms in transaction fraud prevention.',
        instructions: 'Follow Harvard referencing style, include at least 25 peer-reviewed citations from 2020-2026.',
        pages: 15,
        wordCount: 3750,
        deadline: '7 Days',
        totalAmount: 220,
        currency: 'GBP',
        status: 'pending',
        adminApproved: false,
    });
    console.log('✓ Seeded Order AP-2026-101 (Pending Admin Approval - Hidden from writers)');

    // Order 2: Approved by Admin (Visible to writers with active plan)
    await Order.create({
        orderId: 'AP-2026-102',
        userId: studentUser._id,
        user_name: studentUser.name,
        user_email: studentUser.email,
        service: 'Research Paper',
        subject: 'Environmental Sciences',
        academicLevel: 'Undergraduate',
        topicTitle: 'Renewable Energy Transition Strategies in Emerging Economies',
        description: 'Empirical research evaluating solar and wind infrastructure investments across Southeast Asia.',
        instructions: 'APA 7th edition formatting with data charts and policy recommendations.',
        pages: 8,
        wordCount: 2000,
        deadline: '5 Days',
        totalAmount: 140,
        currency: 'GBP',
        status: 'available',
        adminApproved: true,
        adminApprovedAt: new Date(),
    });
    console.log('✓ Seeded Order AP-2026-102 (Admin Approved & Released - Visible to Writers)');

    console.log('\n--- DEMO CREDENTIALS READY ---');
    console.log('Client: student@example.com / Password123!');
    console.log('Writer: writer@example.com / Password123!');
    console.log('Admin:  admin / AdminPassword123!');
    process.exit(0);
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
