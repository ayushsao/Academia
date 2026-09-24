import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { AdminPanel } from './pages/AdminPanel';
import { useStore } from './store/useStore';

import { DynamicPage } from './pages/DynamicPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { ChatWidget } from './components/ChatWidget';

// Writer Pages
import HireWriters from './pages/marketplace/HireWriters';
import WriterProfilePage from './pages/marketplace/WriterProfilePage';
import BecomeWriter from './pages/marketplace/BecomeWriter';
import WriterPricing from './pages/marketplace/WriterPricing';
import WriterTerms from './pages/marketplace/WriterTerms';
import WriterLogin from './pages/marketplace/WriterLogin';
import WriterRegister from './pages/marketplace/WriterRegister';
import WriterOnboarding from './pages/marketplace/WriterOnboarding';
import WriterDashboardLayout from './pages/marketplace/writer/WriterDashboardLayout';
import WriterOverview from './pages/marketplace/writer/WriterOverview';
import WriterOpportunities from './pages/marketplace/writer/WriterOpportunities';
import WriterAssignments from './pages/marketplace/writer/WriterAssignments';
import WriterAssignmentDetail from './pages/marketplace/writer/WriterAssignmentDetail';
import WriterHistory from './pages/marketplace/writer/WriterHistory';
import WriterEarnings from './pages/marketplace/writer/WriterEarnings';
import WriterNotifications from './pages/marketplace/writer/WriterNotifications';
import WriterSettings from './pages/marketplace/writer/WriterSettings';
import WriterProfileEdit from './pages/marketplace/writer/WriterProfileEdit';
import WriterDocuments from './pages/marketplace/writer/WriterDocuments';
import WriterMessages from './pages/marketplace/writer/WriterMessages';
import WriterMembership from './pages/marketplace/writer/WriterMembership';
import MembershipCheckout from './pages/marketplace/writer/MembershipCheckout';

// Admin Marketplace Pages

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const user = useStore((state) => state.user);
    if (!user) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/p/:slug" element={<DynamicPage />} />
                <Route path="/resources" element={<ResourcesPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
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
                <Route path="/writer" element={<ProtectedRoute><WriterDashboardLayout /></ProtectedRoute>}>
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
                    <Route path="notifications" element={<WriterNotifications />} />
                    <Route path="settings" element={<WriterSettings />} />
                </Route>

                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin/jobs" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/writers" element={<Navigate to="/admin" replace />} />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ChatWidget />
        </BrowserRouter>
    );
}
