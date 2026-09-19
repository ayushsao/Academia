import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/academiapro';

let connected = false;

export async function connectDB() {
  if (connected) return;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log(`[DB] MongoDB connected successfully.`);
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student', enum: ['student', 'admin'] },
  lastLogin: { type: Date },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: String, required: true },
  subject: { type: String, required: true },
  academicLevel: { type: String, default: 'Undergraduate' },
  pages: { type: Number, default: 1 },
  deadline: { type: String, required: true },
  topicTitle: { type: String, required: true },
  instructions: { type: String, default: '' },
  files: { type: [String], default: [] },
  turnitinReport: { type: Boolean, default: false },
  topExpert: { type: Boolean, default: false },
  abstractPage: { type: Boolean, default: false },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, default: 'Pending', enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'] },
  assignedTo: { type: String, default: '' },
  adminNotes: { type: String, default: '' },
}, { timestamps: true });

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: 'unread', enum: ['unread', 'read'] },
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String, required: true },
}, { timestamps: true });

const siteSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

const pageViewSchema = new mongoose.Schema({
  page: { type: String, required: true },
  userAgent: { type: String, default: '' },
  referrer: { type: String, default: '' },
  country: { type: String, default: 'Unknown' },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Order = mongoose.model('Order', orderSchema);
export const Contact = mongoose.model('Contact', contactSchema);
export const Admin = mongoose.model('Admin', adminSchema);
export const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);
export const PageView = mongoose.model('PageView', pageViewSchema);
