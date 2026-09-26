import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import { useStore } from './store/useStore';

// Every page except Home is loaded on demand, so a first visit only downloads
// what the landing page needs (admin, dashboards and tools come later, if ever).
const named = <T extends Record<string, any>>(load: () => Promise<T>, name: keyof T) =>
    lazy(() => load().then(m => ({ default: m[name] })));

const Dashboard = named(() => import('./pages/Dashboard'), 'Dashboard');
const AdminPanel = named(() => import('./pages/AdminPanel'), 'AdminPanel');
const DynamicPage = named(() => import('./pages/DynamicPage'), 'DynamicPage');
const CatalogPage = named(() => import('./pages/CatalogPage'), 'CatalogPage');
const BlogIndexPage = named(() => import('./pages/BlogPages'), 'BlogIndexPage');
const BlogPostPage = named(() => import('./pages/BlogPages'), 'BlogPostPage');
const SubjectsPage = named(() => import('./pages/SubjectsPage'), 'SubjectsPage');
const ResourcesPage = named(() => import('./pages/ResourcesPage'), 'ResourcesPage');
const ReviewsPage = named(() => import('./pages/ReviewsPage'), 'ReviewsPage');
const ChatWidget = named(() => import('./components/ChatWidget'), 'ChatWidget');

// Writer Pages
const HireWriters = lazy(() => import('./pages/marketplace/HireWriters'));
const WriterProfilePage = lazy(() => import('./pages/marketplace/WriterProfilePage'));
const BecomeWriter = lazy(() => import('./pages/marketplace/BecomeWriter'));
const WriterPricing = lazy(() => import('./pages/marketplace/WriterPricing'));
const WriterTerms = lazy(() => import('./pages/marketplace/WriterTerms'));
const WriterLogin = lazy(() => import('./pages/marketplace/WriterLogin'));
const WriterRegister = lazy(() => import('./pages/marketplace/WriterRegister'));
const WriterOnboarding = lazy(() => import('./pages/marketplace/WriterOnboarding'));
const WriterDashboardLayout = lazy(() => import('./pages/marketplace/writer/WriterDashboardLayout'));
const WriterOverview = lazy(() => import('./pages/marketplace/writer/WriterOverview'));
const WriterOpportunities = lazy(() => import('./pages/marketplace/writer/WriterOpportunities'));
const WriterAssignments = lazy(() => import('./pages/marketplace/writer/WriterAssignments'));
const WriterAssignmentDetail = lazy(() => import('./pages/marketplace/writer/WriterAssignmentDetail'));
const WriterHistory = lazy(() => import('./pages/marketplace/writer/WriterHistory'));
const WriterEarnings = lazy(() => import('./pages/marketplace/writer/WriterEarnings'));
const WriterNotifications = lazy(() => import('./pages/marketplace/writer/WriterNotifications'));
const WriterSettings = lazy(() => import('./pages/marketplace/writer/WriterSettings'));
const WriterProfileEdit = lazy(() => import('./pages/marketplace/writer/WriterProfileEdit'));
const WriterDocuments = lazy(() => import('./pages/marketplace/writer/WriterDocuments'));
const WriterMessages = lazy(() => import('./pages/marketplace/writer/WriterMessages'));
const WriterMembership = lazy(() => import('./pages/marketplace/writer/WriterMembership'));
const MembershipCheckout = lazy(() => import('./pages/marketplace/writer/MembershipCheckout'));
const WriterOrders = lazy(() => import('./pages/marketplace/writer/WriterOrders'));

const PageLoader = () => (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#002147]" />
    </div>
);

// The chat widget isn't needed for first paint: mount it once the browser is idle.
function DeferredChatWidget() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const w = window as any;
        const id = w.requestIdleCallback ? w.requestIdleCallback(() => setReady(true), { timeout: 3000 }) : window.setTimeout(() => setReady(true), 1500);
        return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : window.clearTimeout(id));
    }, []);
    return ready ? <Suspense fallback={null}><ChatWidget /></Suspense> : null;
}

// Signed-in pages. The customer account and the writer portal are separate
// sessions: customer pages need the customer sign-in, writer pages the writer's.
const ProtectedRoute = ({ children, area = 'customer' }: { children: React.ReactNode; area?: 'customer' | 'writer' }) => {
    const signedIn = useStore((state) => Boolean(area === 'writer' ? state.writer : state.user));
    if (!signedIn) return <Navigate to={area === 'writer' ? '/writer/login' : '/'} replace />;
    return <>{children}</>;
};

export default function App() {
    return (
        <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/p/:slug" element={<DynamicPage />} />
                    <Route path="/blog" element={<BlogIndexPage />} />
                    <Route path="/blog/:slug" element={<BlogPostPage />} />
                    <Route path="/subjects" element={<SubjectsPage />} />
                    <Route path="/subjects/:subject" element={<CatalogPage />} />
                    <Route path="/subjects/:subject/:service" element={<CatalogPage />} />
                    <Route path="/subjects/:subject/:service/:project" element={<CatalogPage />} />
                    <Route path="/resources" element={<ResourcesPage />} />
                    <Route path="/reviews" element={<ReviewsPage />} />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute area="customer">
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />

                    {/* Public Marketplace */}
                    <Route path="/hire-writers" element={<HireWriters />} />
                    <Route path="/writer/:id" element={<WriterProfilePage />} />
                    <Route path="/become-a-writer" element={<BecomeWriter />} />
                    <Route path="/writer-membership" element={<WriterPricing />} />
                    <Route path="/become-a-writer/pricing" element={<Navigate to="/writer-membership" replace />} />
                    <Route path="/writer-terms" element={<WriterTerms />} />
                    <Route path="/writer/login" element={<WriterLogin />} />
                    <Route path="/writer/register" element={<WriterRegister />} />
                    <Route path="/writer/onboarding" element={<WriterOnboarding />} />
                    <Route path="/writer/verify" element={<Navigate to="/writer/onboarding" replace />} />

                    {/* Writer Dashboard */}
                    <Route path="/writer" element={<ProtectedRoute area="writer"><WriterDashboardLayout /></ProtectedRoute>}>
                        <Route path="dashboard" element={<WriterOverview />} />
                        <Route path="opportunities" element={<WriterOpportunities />} />
                        <Route path="assignments" element={<WriterAssignments />} />
                        <Route path="assignments/:ref" element={<WriterAssignmentDetail />} />
                        <Route path="history" element={<WriterHistory />} />
                        <Route path="earnings" element={<WriterEarnings />} />
                        {/* Old bidding-era URLs */}
                        <Route path="jobs/*" element={<Navigate to="/writer/opportunities" replace />} />
                        <Route path="bids" element={<Navigate to="/writer/opportunities" replace />} />
                        <Route path="active-jobs" element={<Navigate to="/writer/assignments" replace />} />
                        <Route path="completed" element={<Navigate to="/writer/history" replace />} />
                        <Route path="profile" element={<WriterProfileEdit />} />
                        <Route path="documents" element={<WriterDocuments />} />
                        <Route path="messages" element={<WriterMessages />} />
                        <Route path="membership" element={<WriterMembership />} />
                        <Route path="membership/checkout" element={<MembershipCheckout />} />
                        <Route path="orders" element={<WriterOrders />} />
                        <Route path="notifications" element={<WriterNotifications />} />
                        <Route path="settings" element={<WriterSettings />} />
                    </Route>

                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/admin/jobs" element={<Navigate to="/admin" replace />} />
                    <Route path="/admin/writers" element={<Navigate to="/admin" replace />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
            <DeferredChatWidget />
        </BrowserRouter>
    );
}
