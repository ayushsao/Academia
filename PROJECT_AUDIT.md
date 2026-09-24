# Project Audit: AssignmentMinds

## Existing Architecture
- **Frontend**: Built with React 19, Vite, Tailwind CSS, React Router DOM, and Zustand for state management. Uses Framer Motion for animations.
- **Backend**: Node.js with Express.js. Implements standard REST APIs, protected by JWT authentication and rate-limiting.
- **Database**: MongoDB using Mongoose.
- **File Storage**: Local file system via Multer (`server/uploads`), serving files statically.
- **Payment**: Currently simulated/basic job payments, lacks a robust external provider like Razorpay/Stripe for subscriptions.
- **Authentication**: JWT-based with bcrypt password hashing. Includes Google OAuth support.

## Reusable Components
- **UI & Layout**: `Navbar`, `Footer`, `Hero`, `SideDrawer`.
- **Modals**: `SignInModal`, `WriterModal`, `OrderModal`, `ConsultantModal`, `ToolModal`.
- **Widgets**: `ChatWidget`, `FloatingElements`, `StatsBar`, `TopUtilityBar`.
- **State**: `useStore` (Zustand) containing User and Order state.

## Existing APIs
- **`/api/auth`**: `signup`, `login`, `logout`, `google`, `me`.
- **`/api/upload`**: Single endpoint for multi-file uploads (PDF, Word, Images).
- **`/api/orders`**: Order management and CRUD.
- **`/api/marketplace`**: Routes for basic marketplace (hire writers, profiles).
- **`/api/admin`**: Administrative controls and data fetching.
- **`/api/contact`**, **`/api/tools`**, **`/api/agent`**.

## Existing Database Models
- **Core**: `User`, `Order`, `Contact`, `Admin`, `SiteSettings`, `PageView`.
- **Marketplace**: `WriterProfile`, `Job`, `Bid`, `Payment`, `Message`, `Notification`.

## Existing Admin Features
- Admin panel accessible at `/admin`.
- Views for managing platform Jobs (`/admin/jobs`) and Writers (`/admin/writers`).

## Missing Features
- **Writer Verification**: No robust verification process (email/phone) or application review pipeline (HR flow).
- **Writer Application Model**: Lacks dedicated structured tracking for writer applications and HR audit logs.
- **Subscriptions**: No membership plans, recurring billing, or payment gateway integrations for writers.

## Required New Models
- `WriterApplication` (to track application state: Pending, Under Review, etc.).
- `WriterSkill`, `WriterDocument` (can be integrated into `WriterProfile` or kept separate).
- `SubscriptionPlan` (Basic, Professional, Premium).
- `WriterSubscription` (to track active writer memberships).
- `SubscriptionPayment` (for recurring billing logs).

*Note: Existing `User`, `WriterProfile`, and `Payment` models will be reused and extended.*

## Required New APIs
- **Writer Onboarding**: `/api/writer/register`, `/api/writer/verify`, `/api/writer/profile`, `/api/writer/application`.
- **HR/Admin Management**: Endpoints for HR to view, approve, reject, request info, or suspend writers.
- **Subscriptions**: Endpoints to fetch plans, create payment sessions/intents, verify payments, and handle webhooks from Stripe/Razorpay.

## Required New Pages
- `/become-a-writer` (Landing page, existing but needs update)
- `/writer/register` (Initial registration)
- `/writer/verify` (OTP/Email verification)
- `/writer/profile` (Extensive profile completion)
- HR Dashboard views (Applications review, Document viewer, Audit logs).
- Membership selection and payment checkout pages for writers.

## Integration Plan
1. **Milestone 1**: Update `User` and `WriterProfile` schemas. Build out the multistep writer registration and profile completion flow. Ensure file uploads handle certificates and samples securely.
2. **Milestone 2**: Create the HR review pipeline. Build Admin UI to review applications, approve/reject, and update `verificationStatus`. Add an audit log for status changes.
3. **Milestone 3**: Implement a payment gateway (e.g., Stripe). Create `SubscriptionPlan` schema. Build backend logic to handle subscription creation, webhooks, and restrict writer capabilities based on their active plan.


