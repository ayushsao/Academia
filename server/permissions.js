// Admin roles and what each may do. Routes check permissions, never role names,
// so adjusting a role is a one-line change here.

export const ADMIN_ROLES = ['SUPER_ADMIN', 'HR', 'OPERATIONS', 'FINANCE', 'MARKETING'];

export const ROLE_LABELS = {
    SUPER_ADMIN: 'Super Admin',
    HR: 'HR',
    OPERATIONS: 'Operations',
    FINANCE: 'Finance',
    MARKETING: 'Marketing',
};

// Accounts created before roles existed ('ADMIN' or no role) are full admins.
export const normalizeRole = (role) => (!role || role === 'ADMIN' ? 'SUPER_ADMIN' : role);

export const PERMISSIONS = {
    // Marketplace dashboard (each section is further filtered by the permissions below)
    'dashboard.view': 'View the marketplace dashboard',
    // Writers
    'writers.read': 'View writers and applications',
    'writers.review': 'Approve, reject, request info, suspend and reactivate writers',
    'writers.contact': 'See writer email addresses and phone numbers',
    'writers.documents': 'Open writer documents',
    'writers.availability': 'Override writer availability and workload limits',
    'writers.performance': 'See writer ratings and performance',
    // Assignments (operations)
    'assignments.manage': 'Create, allocate, review and rate assignments',
    // Finance
    'memberships.manage': 'Manage membership plans and settings',
    'subscriptions.read': 'View subscriptions and subscription revenue',
    'subscriptions.manage': 'Suspend, reinstate or cancel subscriptions',
    'payments.read': 'View payments, references and revenue',
    'payments.review': 'Verify manual payments',
    'payouts.manage': 'View and pay writer earnings',
    // Marketing
    'leads.manage': 'View and manage contact enquiries',
    'recruitment.read': 'View writer recruitment funnel',
    'analytics.read': 'View site traffic analytics',
    'content.manage': 'Edit recruitment page, FAQ, pricing copy, terms and contact details',
    'blog.manage': 'Write, publish and delete blog posts',
    'bidding.manage': 'Open orders for writer bidding, set writer budgets and accept bids',
    // Admin CRM (academic catalogue)
    'catalog.manage': 'Manage subjects, services and projects (create, edit, publish, delete)',
    'pricing.manage': 'Manage pricing rules and word/page settings',
    // Trust & safety
    'risk.review': 'Review and resolve fraud and abuse flags',
    // Existing customer-order area
    'orders.read': 'View customer orders',
    'orders.write': 'Update customer orders',
    // Platform
    'users.manage': 'View and delete customer accounts',
    'settings.manage': 'Edit site settings and discounts',
    'admins.manage': 'Create admins and assign roles',
    'audit.read': 'View the audit log',
};

const ALL = Object.keys(PERMISSIONS);

export const ROLE_PERMISSIONS = {
    SUPER_ADMIN: ALL,
    HR: ['dashboard.view', 'writers.read', 'writers.review', 'writers.contact', 'writers.documents', 'writers.availability', 'writers.performance', 'recruitment.read', 'risk.review', 'bidding.manage'],
    OPERATIONS: ['dashboard.view', 'assignments.manage', 'writers.read', 'writers.availability', 'writers.performance', 'orders.read', 'orders.write', 'catalog.manage', 'bidding.manage'],
    FINANCE: ['dashboard.view', 'memberships.manage', 'subscriptions.read', 'subscriptions.manage', 'payments.read', 'payments.review', 'payouts.manage', 'orders.read', 'risk.review', 'pricing.manage'],
    MARKETING: ['dashboard.view', 'recruitment.read', 'leads.manage', 'analytics.read', 'content.manage', 'catalog.manage', 'blog.manage'],
};

// No role (e.g. not an admin at all) means no permissions. Legacy admin accounts
// are normalised to SUPER_ADMIN when authenticated, never here.
export const permissionsFor = (role) => (role ? ROLE_PERMISSIONS[role] || [] : []);
export const can = (role, permission) => permissionsFor(role).includes(permission);

// Express guard: passes if the admin holds ANY of the listed permissions.
export const requirePermission = (...perms) => (req, res, next) => {
    if (!req.admin) return res.status(401).json({ error: 'Unauthorized.' });
    if (perms.some(p => can(req.admin.adminRole, p))) return next();
    return res.status(403).json({ error: 'Your admin role does not permit this action.' });
};

// Admin API responses often carry personal or financial data: never cache them.
export const noStore = (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); };
