import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard, ShoppingBag, Users, MessageSquare, LogOut,
    Search, RefreshCw, Trash2, ChevronDown, X, Check, Eye,
    TrendingUp, AlertCircle, Clock, CheckCircle2, XCircle,
    Shield, Mail, DollarSign, FileText, Menu, Award,
    BarChart2, Settings, Tag, Globe, Save, Activity,
    PenTool, History, CheckSquare, Crown, ClipboardList, Gauge, Megaphone, ShieldAlert, FileEdit, KeyRound, Library,
    UploadCloud
} from 'lucide-react';

import AdminWritersTab from './marketplace/admin/AdminWritersTab';
import AdminApplicationsTab from './marketplace/admin/AdminApplicationsTab';
import AdminAuditLogsTab from './marketplace/admin/AdminAuditLogsTab';
import AdminMembershipTab from './marketplace/admin/membership/AdminMembershipTab';
import AdminAssignmentsTab from './marketplace/admin/assignments/AdminAssignmentsTab';
import AdminTeamTab from './marketplace/admin/AdminTeamTab';
import MarketplaceDashboard from './marketplace/admin/MarketplaceDashboard';
import RecruitmentTab from './marketplace/admin/RecruitmentTab';
import { hasPermission, type AdminAccess } from './marketplace/admin/access';
import TrustSafetyTab from './marketplace/admin/TrustSafetyTab';
import CatalogTab from './marketplace/admin/catalog/CatalogTab';
import SiteContentTab from './marketplace/admin/SiteContentTab';
import AdminPasswordDialog from './marketplace/admin/AdminPasswordDialog';
import { AdminLogin, AdminSecurityDialog, restoreAdminSession, signOutAdmin } from './marketplace/admin/AdminAuth';

import { API } from '../lib/api';
import { formatOrderTotal } from '../lib/money';

// ─── API helpers ─────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { ...opts, headers: { ...headers, ...(opts.headers as Record<string, string> || {}) } });
    if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Request failed' }));
        // Auto-logout on 401 Unauthorized (expired/invalid token)
        if (res.status === 401) {
            localStorage.removeItem('ap_admin_token');
            window.dispatchEvent(new Event('admin-unauthorized'));
        }
        throw new Error(e.error);
    }
    return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
    totalOrders: number; totalUsers: number; totalRevenue: number; otherRevenue?: { currency: string; total: number }[];
    pendingOrders: number; inProgressOrders: number; completedOrders: number;
    cancelledOrders: number; unreadContacts: number;
    recentRevenue: { day: string; revenue: number }[];
}
interface Order {
    _id: string; orderId: string; userId: string; user_name?: string; user_email?: string;
    service: string; subject: string; academicLevel: string; pages: number;
    deadline: string; topicTitle: string; instructions?: string;
    files?: string[];
    turnitinReport?: boolean;
    topExpert?: boolean;
    abstractPage?: boolean;
    totalAmount: number; currency?: string; status: string; assignedTo?: string;
    adminApproved?: boolean; adminApprovedAt?: string;
    adminNotes?: string; revisionNote?: string; transactionId?: string; writerId?: string | null;
    deliveryFiles?: { _id: string; originalName: string; mimeType?: string; size: number; uploadedAt: string; version: number }[];
    submittedAt?: string; completedAt?: string; feedback?: { rating: number; comment?: string; createdAt: string }; payment?: { provider: 'RAZORPAY' | 'MANUAL'; status: 'PAID' | 'PENDING_VERIFICATION'; providerPaymentId?: string; amountMinor?: number; currency?: string }; createdAt: string; updatedAt: string;
}
interface User { _id: string; name: string; email: string; role: string; createdAt: string; lastLogin?: string; order_count: number; total_spent: number; }
interface Contact { _id: string; name: string; email: string; phone?: string; subject: string; message: string; status: string; createdAt: string; }

// ─── Status Badge ─────────────────────────────────────────────────────────────
const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    // Legacy statuses
    Pending: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
    'In Progress': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    Completed: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    Cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-3 h-3" /> },
    // New workflow statuses
    pending: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
    assigned: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Users className="w-3 h-3" /> },
    in_progress: { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    submitted: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <UploadCloud className="w-3 h-3" /> },
    revision_required: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <AlertCircle className="w-3 h-3" /> },
    completed: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-3 h-3" /> },
};

// Workflow statuses in plain words.
const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending', available: 'Released to writers', assigned: 'Assigned', in_progress: 'In progress',
    submitted: 'Submitted', revision_required: 'Revision required', completed: 'Completed', cancelled: 'Cancelled',
};
const ORDER_STATUSES = ['pending', 'available', 'in_progress', 'submitted', 'revision_required', 'completed', 'cancelled'];

const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
            {cfg.icon}{STATUS_LABELS[status] || status}
        </span>
    );
};

const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

// The writer's uploaded work, and the admin's decision on it: approve (the
// customer can then download it) or send it back with a note for the writer.
const WriterSubmission = ({ order, token, onUpdate, download }: { order: Order; token: string; onUpdate: (o: Partial<Order>) => void; download: (url: string, name: string) => void }) => {
    const [busy, setBusy] = useState<'approve' | 'revision' | null>(null);
    const [asking, setAsking] = useState(false);
    const [note, setNote] = useState('');
    const [uploading, setUploading] = useState(false);
    const fileInput = React.useRef<HTMLInputElement>(null);
    const files = order.deliveryFiles || [];
    const cancelled = ['cancelled', 'Cancelled'].includes(order.status);
    const completed = ['completed', 'Completed'].includes(order.status);
    // The admin can upload the final file themselves (orders handled without a
    // marketplace writer, or a corrected file). It then waits for approval, or
    // reaches the customer at once if the order is already completed.
    const upload = async (list: FileList | null) => {
        if (!list?.length) return;
        setUploading(true);
        try {
            const form = new FormData();
            Array.from(list).forEach(f => form.append('files', f));
            const res = await fetch(`${API}/order-workflow/admin/upload/${order.orderId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Upload failed.');
            onUpdate({ status: data.order.status, deliveryFiles: data.order.deliveryFiles, completedAt: data.order.completedAt, submittedAt: data.order.submittedAt });
        } catch (e: any) { alert(e.message || 'Upload failed.'); }
        finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
    };
    const uploadButton = !cancelled && (
        <>
            <button onClick={() => fileInput.current?.click()} disabled={uploading}
                className="text-xs font-bold text-[#002147] bg-white border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                <UploadCloud className="w-3.5 h-3.5" />{uploading ? 'Uploading...' : files.length ? 'Upload a new version' : 'Upload final file'}
            </button>
            <input ref={fileInput} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.zip" className="hidden" onChange={e => upload(e.target.files)} />
        </>
    );
    if (!files.length) return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Final work</p>
                    <p className="text-xs text-gray-500">
                        {completed ? 'This order is completed but has no final file, so the customer has nothing to download. Upload the final file.'
                            : order.writerId ? 'The writer hasn’t uploaded the work yet.' : 'No final file yet. The writer uploads it, or you can upload it here.'}
                    </p>
                </div>
                {uploadButton}
            </div>
        </div>
    );
    const latest = Math.max(...files.map(f => f.version || 1));
    const current = files.filter(f => (f.version || 1) === latest);
    const earlier = files.filter(f => (f.version || 1) !== latest).sort((a, b) => b.version - a.version);
    const act = async (kind: 'approve' | 'revision') => {
        if (kind === 'approve' && !confirm(`Approve the work for ${order.orderId}? The customer will be able to download it.`)) return;
        setBusy(kind);
        try {
            const data = await apiFetch(`/order-workflow/admin/${kind}/${order.orderId}`, { method: 'POST', body: JSON.stringify(kind === 'revision' ? { note } : {}) }, token);
            onUpdate({ status: data.order.status, completedAt: data.order.completedAt, revisionNote: data.order.revisionNote });
            setAsking(false); setNote('');
        } catch (e: any) { alert(e.message); }
        finally { setBusy(null); }
    };
    const row = (f: NonNullable<Order['deliveryFiles']>[number]) => (
        <div key={f._id} className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-800 truncate block" title={f.originalName}>{f.originalName}</span>
                <span className="text-[11px] text-gray-400 block">Version {f.version} · {fileSize(f.size)} · {new Date(f.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button onClick={() => download(`${API}/order-workflow/admin/delivery-file/${order.orderId}/${f._id}`, f.originalName)}
                className="text-xs font-bold bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-lg hover:border-gray-300 hover:text-[#000a1e] transition-colors">
                Download
            </button>
        </div>
    );
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Final work</p>
                {uploadButton}
            </div>
            <p className="text-xs text-gray-500 mb-4">
                {order.status === 'submitted' ? 'The work has been submitted. Download and check it, then approve it or ask for a revision.'
                    : order.status === 'revision_required' ? 'Sent back to the writer for a revision.'
                        : ['completed', 'Completed'].includes(order.status) ? 'Approved. The customer can download the work.' : ''}
            </p>
            <div className="space-y-3">{current.map(row)}</div>
            {earlier.length > 0 && (
                <details className="mt-3">
                    <summary className="text-xs font-semibold text-gray-500 cursor-pointer">Earlier versions ({earlier.length})</summary>
                    <div className="space-y-3 mt-3">{earlier.map(row)}</div>
                </details>
            )}
            {order.status === 'revision_required' && order.revisionNote && (
                <p className="mt-4 text-sm text-gray-700 bg-orange-50 border border-orange-100 rounded-xl p-3 whitespace-pre-wrap"><span className="font-semibold">Revision note:</span> {order.revisionNote}</p>
            )}
            {order.status === 'submitted' && (asking ? (
                <div className="mt-4 space-y-3">
                    <label htmlFor="revision-note" className="block text-xs font-bold text-gray-500">What should the writer change?</label>
                    <textarea id="revision-note" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000a1e] focus:outline-none focus:border-gray-400 resize-none" />
                    <div className="flex gap-2">
                        <button onClick={() => act('revision')} disabled={busy !== null || !note.trim()} className="bg-[#000a1e] text-white font-bold text-xs px-4 py-2.5 rounded-xl disabled:opacity-50">{busy === 'revision' ? 'Sending...' : 'Send to writer'}</button>
                        <button onClick={() => setAsking(false)} className="text-xs font-bold text-gray-500 px-4 py-2.5 rounded-xl hover:bg-gray-100">Cancel</button>
                    </div>
                </div>
            ) : (
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button onClick={() => act('approve')} disabled={busy !== null} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" />{busy === 'approve' ? 'Approving...' : 'Approve and mark completed'}
                    </button>
                    <button onClick={() => setAsking(true)} disabled={busy !== null} className="flex-1 bg-white border border-gray-200 text-[#000a1e] font-bold text-xs px-4 py-2.5 rounded-xl hover:border-gray-300">
                        Ask for a revision
                    </button>
                </div>
            ))}
            {order.feedback && (
                <p className="mt-4 text-sm text-gray-700"><span className="font-semibold">Customer feedback:</span> {order.feedback.rating}/5{order.feedback.comment ? ` — “${order.feedback.comment}”` : ''}</p>
            )}
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; accent: string }) => (
    <div className={`bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-12 translate-x-12 opacity-5 ${accent}`} />
        <div className={`inline-flex p-3 rounded-xl ${accent} bg-opacity-10 mb-4`}>{icon}</div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-[#000a1e]">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
);

// ─── Order Detail Side Drawer ─────────────────────────────────────────────────
const OrderDetailDrawer = ({
    order, token, onClose, onUpdate
}: { order: Order; token: string; onClose: () => void; onUpdate: (o: Order) => void }) => {
    const [status, setStatus] = useState(order.status);
    const [assignedTo, setAssignedTo] = useState(order.assignedTo || '');
    const [adminNotes, setAdminNotes] = useState(order.adminNotes || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [releasing, setReleasing] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const adminFileInputRef = React.useRef<HTMLInputElement>(null);

    const handleReleaseToWriters = async () => {
        if (!confirm(`Approve order ${order.orderId} and release to writers with active membership plans?`)) return;
        setReleasing(true);
        try {
            const data = await apiFetch(`/order-workflow/admin/release/${order.orderId}`, { method: 'POST' }, token);
            onUpdate({ ...order, status: data.order.status, adminApproved: data.order.adminApproved, adminApprovedAt: data.order.adminApprovedAt });
            alert('Order approved and released to writers with active memberships!');
        } catch (e: any) {
            alert(e.message || 'Failed to release order.');
        } finally {
            setReleasing(false);
        }
    };

    const handleAdminFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files.length) return;
        setUploadingFile(true);
        try {
            const formData = new FormData();
            (Array.from(e.target.files) as File[]).forEach(f => formData.append('files', f));

            const res = await fetch(`${API}/admin/orders/${order.orderId}/files`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to attach file');
            }

            const data = await res.json();
            onUpdate(data.order);
            alert('File(s) attached successfully!');
        } catch (err: any) {
            alert(err.message || 'Upload failed');
        } finally {
            setUploadingFile(false);
            if (adminFileInputRef.current) adminFileInputRef.current.value = '';
        }
    };

    const isNew = (new Date().getTime() - new Date(order.createdAt).getTime()) < 5 * 60 * 1000;

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = await apiFetch(`/admin/orders/${order.orderId}`, {
                method: 'PATCH', body: JSON.stringify({ status, assignedTo, adminNotes })
            }, token);
            onUpdate(data.order);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e: any) { alert(e.message); }
        finally { setSaving(false); }
    };

    const handleForceDownload = async (fileUrl: string, fileName: string) => {
        try {
            // Order files are private: fetched with the admin token, never via a public URL.
            const resp = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (!resp.ok) throw new Error("File not found");
            const blob = await resp.blob();
            const localUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = localUrl;
            a.download = fileName.replace(/^[0-9a-f]{32}-/, '');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(localUrl);
        } catch (e) {
            alert("This file couldn’t be downloaded. It may have been removed.");
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            {/* Side Drawer */}
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-gray-100 px-6 py-6 flex items-start justify-between flex-shrink-0 sticky top-0 z-10">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">{order.orderId}</span>
                            {isNew && <span className="bg-blue-50 text-blue-600 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-200">NEW</span>}
                            <StatusBadge status={order.status} />
                        </div>
                        <h2 className="text-xl font-extrabold text-[#000a1e] leading-snug truncate">{order.topicTitle}</h2>
                        <p className="text-gray-400 font-medium text-xs mt-1.5 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Placed {new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="ml-4 text-gray-400 hover:text-[#000a1e] bg-gray-50 hover:bg-gray-100 p-2.5 rounded-full transition-colors flex-shrink-0 shadow-sm border border-gray-100 hover:border-gray-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Client */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Client Details</p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#002147] text-white flex items-center justify-center text-sm font-extrabold flex-shrink-0">
                                {(order.user_name || 'NA').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-bold text-[#000a1e]">{order.user_name || 'N/A'}</div>
                                <div className="text-xs text-gray-500">{order.user_email || 'N/A'}</div>
                            </div>
                            {order.user_email && (
                                <a href={`mailto:${order.user_email}?subject=Re: Your Order ${order.orderId}`}
                                    className="ml-auto bg-[#000a1e] text-white text-xs font-bold px-3 py-1.5 rounded-[12px] hover:bg-[#002147] transition-colors flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> Email
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Order Details Grid */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Order Specifications</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {([
                                ['Service', order.service],
                                ['Subject', order.subject],
                                ['Academic Level', order.academicLevel],
                                ['Pages', `${order.pages} pages (~${order.pages * 250} words)`],
                                ['Deadline', order.deadline],
                                ['Total Amount', formatOrderTotal(order.totalAmount, order.currency)],
                                ['Payment', order.payment?.provider === 'RAZORPAY' && order.payment.status === 'PAID' ? 'Paid online · Razorpay (verified by server)' : 'Manual — verify the reference before starting work'],
                                ['Transaction ID', order.transactionId || 'Not Provided'],
                            ] as [string, string][]).map(([k, v]) => (
                                <div key={k}>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{k}</p>
                                    <p className="text-sm font-semibold text-[#000a1e] mt-0.5">{v}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add-ons */}
                    <div className="flex flex-wrap gap-2">
                        {order.turnitinReport && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                                <Check className="w-3 h-3" /> Plagiarism Report
                            </span>
                        )}
                        {order.topExpert && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold">
                                <Award className="w-3 h-3" /> Top Expert (+£15)
                            </span>
                        )}
                        {order.abstractPage && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold">
                                <FileText className="w-3 h-3" /> Abstract Page (+£10)
                            </span>
                        )}
                        {!order.turnitinReport && !order.topExpert && !order.abstractPage && (
                            <span className="text-xs text-gray-400 italic">No add-ons selected</span>
                        )}
                    </div>

                    {/* Instructions */}
                    {order.instructions && (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Student Instructions</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{order.instructions}</p>
                        </div>
                    )}

                    {/* Uploaded Files */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Uploaded Files</p>
                            <button
                                onClick={() => adminFileInputRef.current?.click()}
                                disabled={uploadingFile}
                                className="text-xs font-bold text-[#002147] hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <UploadCloud className="w-3.5 h-3.5" />
                                {uploadingFile ? 'Uploading...' : '+ Attach File'}
                            </button>
                            <input
                                ref={adminFileInputRef}
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.rtf,.zip,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={handleAdminFileUpload}
                            />
                        </div>
                        {order.files && order.files.length > 0 ? (
                            <div className="space-y-3">
                                {order.files.map((fileName, idx) => {
                                    const fileUrl = `${API}/admin/orders/files/${encodeURIComponent(fileName)}`;
                                    const cleanName = fileName.replace(/^[0-9a-f]{32}-/, '');
                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-colors group"
                                        >
                                            <div className="w-10 h-10 bg-white border border-gray-200 text-gray-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                                                <FileText className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-semibold text-gray-800 truncate block" title={cleanName}>{cleanName}</span>
                                                <span className="text-[11px] text-gray-400 truncate block font-mono">{fileName}</span>
                                            </div>
                                            <button
                                                onClick={() => handleForceDownload(fileUrl, fileName)}
                                                className="text-[11px] uppercase tracking-widest font-extrabold bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-lg hover:border-gray-300 hover:text-[#000a1e] hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                Download
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between text-gray-400 py-3 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">No files uploaded by student</span>
                                </div>
                                <button
                                    onClick={() => adminFileInputRef.current?.click()}
                                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                                >
                                    Upload Now
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Writer Marketplace Release Section */}
                    {/* Only for new orders: approving sends them to writers. */}
                    {['pending', 'Pending', 'available'].includes(order.status) && (
                    <div className={`rounded-2xl p-4 border ${order.adminApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-[#fea520]" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-[#000a1e]">
                                        {order.adminApproved ? 'Writer Marketplace: Approved & Released' : 'Writer Marketplace: Awaiting Approval'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {order.adminApproved
                                        ? 'This order is approved and visible to writers with active membership plans.'
                                        : 'Writers cannot see or accept this order until admin approves and releases it.'}
                                </p>
                            </div>
                            {!order.adminApproved && (!order.assignedTo || order.assignedTo === '') && (
                                <button
                                    type="button"
                                    onClick={handleReleaseToWriters}
                                    disabled={releasing}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm shrink-0 disabled:opacity-50"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {releasing ? 'Releasing...' : 'Approve for Writers'}
                                </button>
                            )}
                        </div>
                    </div>
                    )}

                    <WriterSubmission order={order} token={token} download={handleForceDownload}
                        onUpdate={changes => { if (changes.status) setStatus(changes.status); onUpdate({ ...order, ...changes }); }} />

                    {/* Admin Controls */}
                    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] space-y-5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5" /> Admin Controls
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Update Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-[#000a1e] focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 shadow-sm">
                                {[...(ORDER_STATUSES.includes(status) ? [] : [status]), ...ORDER_STATUSES].map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Assign Writer</label>
                            <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                                placeholder="Writer name or email..."
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-[#000a1e] focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Internal Admin Notes</label>
                            <textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                                placeholder="Not visible to student..."
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000a1e] focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 shadow-sm resize-none" />
                        </div>
                    </div>
                </div>

                {/* Sticky Save Footer */}
                <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-5 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                    <button onClick={handleSave} disabled={saving}
                        className="w-full bg-[#000a1e] hover:bg-gray-800 text-white px-6 py-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-[0_4px_14px_rgba(0,10,30,0.15)] hover:shadow-[0_6px_20px_rgba(0,10,30,0.2)]">
                        {saving
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                            : saved ? <><Check className="w-4 h-4 text-emerald-400" />Saved Successfully</>
                                : <><Save className="w-4 h-4" /> Save Changes</>}
                    </button>
                </div>
            </div>
        </>
    );
};

// ─── Orders Tab ───────────────────────────────────────────────────────────────
// Auto-approve: new orders paid online go straight to writers with a membership
// plan. Manual (UPI/PayPal/bank) payments still wait here for an admin to check.
const AutoApproveToggle = ({ token }: { token: string }) => {
    const [on, setOn] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        apiFetch('/order-workflow/admin/settings', {}, token).then(d => setOn(Boolean(d.settings?.autoRelease))).catch(() => setOn(null));
    }, [token]);
    const toggle = async () => {
        if (on === null) return;
        const next = !on;
        if (next && !confirm('Turn on auto-approve? New orders paid online will be released to writers immediately, without waiting for you.')) return;
        setSaving(true);
        try {
            const d = await apiFetch('/order-workflow/admin/settings', { method: 'PUT', body: JSON.stringify({ autoRelease: next }) }, token);
            setOn(Boolean(d.settings?.autoRelease));
        } catch (e: any) { alert(e.message || 'Could not save.'); }
        finally { setSaving(false); }
    };
    if (on === null) return null;
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-sm font-bold text-[#000a1e]">Auto-approve new orders</p>
                <p className="mt-0.5 text-xs text-gray-500">
                    {on ? 'On: orders paid online go straight to every writer with a membership plan. Manual payments still need your approval.'
                        : 'Off: you approve each order before writers can see it.'}
                </p>
            </div>
            <button type="button" role="switch" aria-checked={on} aria-label="Auto-approve new orders" onClick={toggle} disabled={saving}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );
};

const OrdersTab = ({ token }: { token: string }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Order | null>(null);
    const [newCount, setNewCount] = useState(0);
    const prevTotalRef = React.useRef(0);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15', status: statusFilter });
            if (search) params.set('search', search);
            const data = await apiFetch(`/admin/orders?${params}`, {}, token);
            setOrders(data.orders); setTotal(data.total);
            // detect new orders while admin is on this tab
            if (prevTotalRef.current > 0 && data.total > prevTotalRef.current) {
                setNewCount(data.total - prevTotalRef.current);
                setTimeout(() => setNewCount(0), 5000);
            }
            prevTotalRef.current = data.total;
        } catch (e: any) { if (!silent) alert(e.message); }
        finally { if (!silent) setLoading(false); }
    }, [token, page, statusFilter, search]);

    useEffect(() => { load(); }, [load]);

    // ── Auto-poll every 30 s ──────────────────────────────────────────────────
    useEffect(() => {
        const id = setInterval(() => load(true), 30000);
        return () => clearInterval(id);
    }, [load]);

    const handleDelete = async (id: string) => {
        if (!confirm(`Delete order ${id}? This cannot be undone.`)) return;
        try { await apiFetch(`/admin/orders/${id}`, { method: 'DELETE' }, token); load(); }
        catch (e: any) { alert(e.message); }
    };

    return (
        <div className="space-y-6">
            {/* New order alert banner */}
            {newCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-5 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-3 shadow-sm animate-fade-in text-center">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                    {newCount} New Order{newCount > 1 ? 's' : ''} Received! Click 'Refresh' to see the latest.
                </div>
            )}
            <AutoApproveToggle token={token} />
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search by ID, topic, client..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 shadow-sm" />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-[#000a1e] focus:outline-none shadow-sm">
                    {['all', ...ORDER_STATUSES].map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : STATUS_LABELS[s]}</option>)}
                </select>
                <button onClick={() => load(false)} className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 text-xs font-bold text-gray-500">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-[#000a1e]">Orders <span className="text-gray-400 font-normal text-sm">({total} total)</span></h3>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" /></div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-16 text-gray-400"><FileText className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-semibold">No orders found</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    {['Order ID', 'Client', 'Service', 'Deadline', 'Amount', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {orders.map(order => {
                                    const isNew = (new Date().getTime() - new Date(order.createdAt).getTime()) < 5 * 60 * 1000;
                                    return (
                                        <tr key={order.orderId} className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isNew ? 'bg-amber-50/50' : ''}`} onClick={() => setSelected(order)}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-gray-700">{order.orderId}</span>
                                                    {isNew && <span className="bg-blue-50 border border-blue-200 text-blue-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">NEW</span>}
                                                </div>
                                                <div className="text-gray-400 text-[10px] mt-0.5">{new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-[#000a1e] truncate max-w-[140px]">{order.user_name || '—'}</div>
                                                <div className="text-gray-400 text-xs truncate max-w-[140px]">{order.user_email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-[#000a1e] truncate max-w-[160px]">{order.topicTitle}</div>
                                                <div className="text-gray-400 text-xs">{order.service}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">{order.deadline}</td>
                                            <td className="px-6 py-4 font-extrabold text-[#000a1e] whitespace-nowrap">{formatOrderTotal(order.totalAmount, order.currency)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <StatusBadge status={order.status} />
                                                {order.adminApproved ? (
                                                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 w-fit">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Writers: Approved
                                                    </div>
                                                ) : (!order.assignedTo || order.assignedTo === '') && (
                                                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 w-fit">
                                                        <Clock className="w-3 h-3 text-amber-600" /> Awaiting Writer Approval
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setSelected(order)} className="text-[#002147] hover:text-[#fea520] p-1.5 hover:bg-[#eef4ff] rounded-lg transition-colors" title="View Details"><Eye className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(order.orderId)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {/* Pagination */}
                {total > 15 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                        <p className="text-sm text-gray-400">Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-gray-50">Prev</button>
                            <button onClick={() => setPage(p => p + 1)} disabled={page * 15 >= total}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-gray-50">Next</button>
                        </div>
                    </div>
                )}
            </div>
            {selected && (
                <OrderDetailDrawer order={selected} token={token} onClose={() => setSelected(null)}
                    onUpdate={(updated) => { setOrders(prev => prev.map(o => o.orderId === updated.orderId ? updated : o)); setSelected(updated); }} />
            )}
        </div>
    );
};

// ─── Users Tab ────────────────────────────────────────────────────────────────
const UsersTab = ({ token }: { token: string }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '15' });
            if (search) params.set('search', search);
            const data = await apiFetch(`/admin/users?${params}`, {}, token);
            setUsers(data.users); setTotal(data.total);
        } catch (e: any) { alert(e.message); }
        finally { setLoading(false); }
    }, [token, page, search]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete user "${name}" and all their orders? This cannot be undone.`)) return;
        try { await apiFetch(`/admin/users/${id}`, { method: 'DELETE' }, token); load(); }
        catch (e: any) { alert(e.message); }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search by name or email..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 shadow-sm" />
                </div>
                <button onClick={load} className="bg-white border border-gray-200 rounded-[12px] px-4 py-3 hover:bg-gray-50 shadow-sm"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-[#000a1e]">Users <span className="text-gray-400 font-normal text-sm">({total} total)</span></h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" /></div>
                ) : users.length === 0 ? (
                    <div className="text-center py-16 text-gray-400"><Users className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-semibold">No users found</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    {['User', 'Role', 'Orders', 'Total Spent', 'Joined', 'Last Login', 'Actions'].map(h => (
                                        <th key={h} className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {users.map(u => (
                                    <tr key={u._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[#002147] text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                                                    {u.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[#000a1e]">{u.name}</div>
                                                    <div className="text-gray-400 text-xs">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><span className="bg-[#eef4ff] text-[#002147] border border-[#d1e4ff] px-2.5 py-1 rounded-lg text-xs font-bold capitalize">{u.role}</span></td>
                                        <td className="px-6 py-4 font-bold text-[#000a1e]">{u.order_count}</td>
                                        <td className="px-6 py-4 font-bold text-emerald-700">£{Number(u.total_spent).toFixed(0)}</td>
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{u.createdAt?.slice(0, 10)}</td>
                                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{u.lastLogin ? u.lastLogin.slice(0, 10) : '—'}</td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => handleDelete(u._id, u.name)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Contacts Tab ─────────────────────────────────────────────────────────────
const ContactsTab = ({ token }: { token: string }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try { const data = await apiFetch('/admin/contacts', {}, token); setContacts(data.contacts); }
        catch (e: any) { alert(e.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const markRead = async (id: string) => {
        try {
            await apiFetch(`/admin/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) }, token);
            setContacts(prev => prev.map(c => c._id === id ? { ...c, status: 'read' } : c));
        } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#000a1e]">Contact Submissions <span className="text-gray-400 font-normal text-sm">({contacts.length} total)</span></h3>
                <button onClick={load} className="bg-white border border-gray-200 rounded-[12px] px-4 py-2.5 text-sm hover:bg-gray-50 shadow-sm flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
            </div>
            {loading ? (
                <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" /></div>
            ) : contacts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 text-center py-16 text-gray-400 shadow-sm">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="font-semibold">No contact submissions yet</p>
                </div>
            ) : (
                contacts.map(c => (
                    <div key={c._id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${c.status === 'unread' ? 'border-[#fea520]/30 shadow-[0_0_0_1px_rgba(254,165,32,0.15)]' : 'border-gray-100'}`}>
                        <div className="px-6 py-4 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === c._id ? null : c._id)}>
                            <div className="flex items-center gap-4">
                                {c.status === 'unread' && <div className="w-2 h-2 bg-[#fea520] rounded-full flex-shrink-0 animate-pulse" />}
                                <div className="w-10 h-10 rounded-xl bg-[#eef4ff] text-[#002147] flex items-center justify-center text-xs font-extrabold">{c.name.slice(0, 2).toUpperCase()}</div>
                                <div>
                                    <div className="font-bold text-[#000a1e]">{c.name}</div>
                                    <div className="text-xs text-gray-400">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:block text-right">
                                    <div className="font-semibold text-sm text-[#000a1e]">{c.subject}</div>
                                    <div className="text-xs text-gray-400">{c.created_at?.slice(0, 10)}</div>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded === c.id ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                        {expanded === c._id && (
                            <div className="px-6 pb-5 border-t border-gray-50 pt-4 space-y-4">
                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4">{c.message}</p>
                                <div className="flex gap-3">
                                    <a href={`mailto:${c.email}?subject=Re: ${c.subject}`}
                                        className="bg-[#000a1e] text-white px-5 py-2.5 rounded-[12px] text-sm font-bold flex items-center gap-2 hover:bg-[#002147] transition-colors">
                                        <Mail className="w-4 h-4" /> Reply via Email
                                    </a>
                                    {c.status === 'unread' && (
                                        <button onClick={() => markRead(c._id)}
                                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-100 transition-colors">
                                            <Check className="w-4 h-4" /> Mark as Read
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────
const OverviewTab = ({ token }: { token: string }) => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/admin/stats', {}, token)
            .then(data => setStats(data))
            .catch(e => console.error(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" /></div>;
    if (!stats) return null;

    const maxRevenue = Math.max(...(stats.recentRevenue.map(r => r.revenue)), 1);

    return (
        <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Revenue" value={[`£${Number(stats.totalRevenue).toFixed(0)}`, ...(stats.otherRevenue || []).map(r => formatOrderTotal(Math.round(r.total), r.currency))].join(' + ')} icon={<DollarSign className="w-5 h-5 text-emerald-600" />} accent="bg-emerald-600" />
                <StatCard label="Total Orders" value={stats.totalOrders} sub={`${stats.pendingOrders} pending`} icon={<ShoppingBag className="w-5 h-5 text-[#002147]" />} accent="bg-[#002147]" />
                <StatCard label="Total Users" value={stats.totalUsers} icon={<Users className="w-5 h-5 text-purple-600" />} accent="bg-purple-600" />
                <StatCard label="Unread Messages" value={stats.unreadContacts} icon={<MessageSquare className="w-5 h-5 text-[#fea520]" />} accent="bg-[#fea520]" />
            </div>

            {/* Order Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-bold text-[#000a1e] mb-5">Order Status Breakdown</h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Pending', count: stats.pendingOrders, color: 'bg-amber-400' },
                            { label: 'In Progress', count: stats.inProgressOrders, color: 'bg-blue-500' },
                            { label: 'Completed', count: stats.completedOrders, color: 'bg-emerald-500' },
                            { label: 'Cancelled', count: stats.cancelledOrders, color: 'bg-red-400' },
                        ].map(({ label, count, color }) => (
                            <div key={label} className="flex items-center gap-4">
                                <div className="w-24 text-sm font-semibold text-gray-600">{label}</div>
                                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${color} rounded-full transition-all duration-700`}
                                        style={{ width: stats.totalOrders ? `${(count / stats.totalOrders) * 100}%` : '0%' }} />
                                </div>
                                <div className="w-8 text-sm font-extrabold text-[#000a1e] text-right">{count}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Revenue chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-bold text-[#000a1e] mb-5 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Revenue (Last 7 Days)</h3>
                    {stats.recentRevenue.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-gray-300 text-sm font-semibold">No revenue data yet</div>
                    ) : (
                        <div className="flex items-end gap-2 h-40">
                            {stats.recentRevenue.map(r => (
                                <div key={r.day} className="flex-1 flex flex-col items-center gap-1.5">
                                    <div className="text-xs font-bold text-[#000a1e]">£{r.revenue.toFixed(0)}</div>
                                    <div className="w-full bg-gradient-to-t from-[#002147] to-[#fea520] rounded-t-lg transition-all duration-700"
                                        style={{ height: `${(r.revenue / maxRevenue) * 100}px`, minHeight: '4px' }} />
                                    <div className="text-[10px] text-gray-400 font-medium">{r.day.slice(5)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Analytics Tab ────────────────────────────────────────────────────────────
const AnalyticsTab = ({ token }: { token: string }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/admin/analytics', {}, token)
            .then(d => setData(d))
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" /></div>;
    if (!data) return <div className="text-center py-16 text-gray-400">No analytics data yet. Traffic will appear as visitors browse the site.</div>;

    const maxViews = Math.max(...(data.dailyViews?.map((d: any) => d.views) || [1]), 1);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3"><Globe className="w-5 h-5 text-blue-500" /><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Page Views</span></div>
                    <p className="text-3xl font-extrabold text-[#000a1e]">{data.totalViews?.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3"><Activity className="w-5 h-5 text-emerald-500" /><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">This Week Views</span></div>
                    <p className="text-3xl font-extrabold text-[#000a1e]">{data.weeklyViews?.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3"><BarChart2 className="w-5 h-5 text-purple-500" /><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Top Pages Tracked</span></div>
                    <p className="text-3xl font-extrabold text-[#000a1e]">{data.topPages?.length || 0}</p>
                </div>
            </div>

            {/* Daily Views Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-[#000a1e] mb-5 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-500" /> Page Views (Last 7 Days)</h3>
                {!data.dailyViews?.length ? (
                    <div className="flex items-center justify-center h-40 text-gray-300 text-sm font-semibold">No traffic data yet</div>
                ) : (
                    <div className="flex items-end gap-3 h-40">
                        {data.dailyViews.map((d: any) => (
                            <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                                <div className="text-xs font-bold text-[#000a1e]">{d.views}</div>
                                <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-700"
                                    style={{ height: `${(d.views / maxViews) * 120}px`, minHeight: '4px' }} />
                                <div className="text-[10px] text-gray-400 font-medium">{d.day.slice(5)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Pages */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-bold text-[#000a1e] mb-4">Top Pages (Last 30 Days)</h3>
                    {!data.topPages?.length ? (
                        <p className="text-gray-400 text-sm">No page data yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {data.topPages.map((p: any, i: number) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-[#eef4ff] text-[#002147] text-xs font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                    <span className="text-sm text-gray-700 font-medium truncate flex-1">{p.page}</span>
                                    <span className="text-xs font-extrabold text-[#002147] bg-[#eef4ff] px-2 py-0.5 rounded-lg">{p.count} views</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Referrers */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-bold text-[#000a1e] mb-4">Top Referrers</h3>
                    {!data.topReferrers?.length ? (
                        <p className="text-gray-400 text-sm">No referrer data yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {data.topReferrers.map((r: any, i: number) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 text-xs font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                    <span className="text-sm text-gray-700 font-medium truncate flex-1">{r.referrer}</span>
                                    <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">{r.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Settings Tab ─────────────────────────────────────────────────────────────
const SettingsTab = ({ token }: { token: string }) => {
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        apiFetch('/admin/settings', {}, token)
            .then(d => setSettings(d))
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }, [token]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiFetch('/admin/settings', { method: 'PATCH', body: JSON.stringify(settings) }, token);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e: any) { alert(e.message); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
            {/* Coupon / Discount */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1"><Tag className="w-5 h-5 text-[#fea520]" /><h3 className="font-bold text-[#000a1e]">Discount / Coupon Code</h3></div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Coupon Code</label>
                        <input type="text" value={settings.discount_code || ''}
                            onChange={e => setSettings({ ...settings, discount_code: e.target.value.toUpperCase() })}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-[#000a1e] focus:outline-none focus:ring-2 focus:ring-[#fea520]/30 uppercase tracking-widest" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Discount %</label>
                        <input type="number" min="0" max="100" value={settings.discount_percent || 0}
                            onChange={e => setSettings({ ...settings, discount_percent: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-[#000a1e] focus:outline-none focus:ring-2 focus:ring-[#fea520]/30" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setSettings({ ...settings, discount_active: !settings.discount_active })}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${settings.discount_active ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.discount_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{settings.discount_active ? 'Coupon Active' : 'Coupon Disabled'}</span>
                    </label>
                </div>
            </div>

            {/* Site Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-2 mb-1"><Globe className="w-5 h-5 text-blue-500" /><h3 className="font-bold text-[#000a1e]">Site Info</h3></div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">WhatsApp Number</label>
                    <input type="text" value={settings.whatsapp_number || ''}
                        onChange={e => setSettings({ ...settings, whatsapp_number: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-[#000a1e] focus:outline-none focus:ring-2 focus:ring-[#fea520]/30" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Site Announcement Banner</label>
                    <textarea rows={3} value={settings.site_announcement || ''}
                        onChange={e => setSettings({ ...settings, site_announcement: e.target.value })}
                        placeholder="Leave empty to hide the announcement..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#000a1e] focus:outline-none focus:ring-2 focus:ring-[#fea520]/30 resize-none" />
                </div>
            </div>
            </div>

            <button onClick={handleSave} disabled={saving}
                className="bg-[#000a1e] hover:bg-[#002147] text-white px-8 py-3.5 rounded-[12px] font-extrabold text-sm flex items-center gap-2 transition-all disabled:opacity-60 shadow-lg">
                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                    : saved ? <><Check className="w-4 h-4 text-emerald-400" />Saved!</>
                        : <><Save className="w-4 h-4" />Save Settings</>}
            </button>
        </div>
    );
};

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
type TabId = 'dashboard' | 'overview' | 'orders' | 'users' | 'writers' | 'applications' | 'assignments' | 'memberships' | 'recruitment' | 'catalog' | 'content' | 'trust' | 'audit' | 'contacts' | 'analytics' | 'settings' | 'admins';

// Each tab lists the permissions that unlock it (any one is enough). The server
// enforces the same permissions; this only keeps the navigation honest.
const NAV: { id: TabId; label: string; title: string; icon: React.ReactNode; perms: string[] }[] = [
    { id: 'dashboard', label: 'Dashboard', title: 'Marketplace Dashboard', icon: <Gauge className="w-5 h-5" />, perms: ['dashboard.view'] },
    { id: 'overview', label: 'Orders Overview', title: 'Orders Overview', icon: <LayoutDashboard className="w-5 h-5" />, perms: ['orders.read'] },
    { id: 'orders', label: 'Orders', title: 'Orders Management', icon: <ShoppingBag className="w-5 h-5" />, perms: ['orders.read'] },
    { id: 'users', label: 'Users', title: 'Users Management', icon: <Users className="w-5 h-5" />, perms: ['users.manage'] },
    { id: 'writers', label: 'Writers', title: 'Writer Management', icon: <PenTool className="w-5 h-5" />, perms: ['writers.read'] },
    { id: 'applications', label: 'Applications', title: 'Writer Applications', icon: <CheckSquare className="w-5 h-5" />, perms: ['writers.read'] },
    { id: 'assignments', label: 'Assignments', title: 'Assignments', icon: <ClipboardList className="w-5 h-5" />, perms: ['assignments.manage', 'payouts.manage'] },
    { id: 'memberships', label: 'Memberships', title: 'Memberships & Payments', icon: <Crown className="w-5 h-5" />, perms: ['subscriptions.read', 'memberships.manage', 'payments.read'] },
    { id: 'recruitment', label: 'Recruitment', title: 'Writer Recruitment', icon: <Megaphone className="w-5 h-5" />, perms: ['recruitment.read'] },
    { id: 'catalog', label: 'Catalog & Pricing', title: 'Catalog & Pricing', icon: <Library className="w-5 h-5" />, perms: ['catalog.manage', 'pricing.manage'] },
    { id: 'content', label: 'Site Content', title: 'Site Content', icon: <FileEdit className="w-5 h-5" />, perms: ['content.manage'] },
    { id: 'trust', label: 'Trust & Safety', title: 'Trust & Safety', icon: <ShieldAlert className="w-5 h-5" />, perms: ['risk.review'] },
    { id: 'contacts', label: 'Messages', title: 'Contact Messages', icon: <MessageSquare className="w-5 h-5" />, perms: ['leads.manage'] },
    { id: 'analytics', label: 'Analytics', title: 'Traffic & Analytics', icon: <BarChart2 className="w-5 h-5" />, perms: ['analytics.read'] },
    { id: 'audit', label: 'Audit Logs', title: 'Audit Logs', icon: <History className="w-5 h-5" />, perms: ['audit.read'] },
    { id: 'settings', label: 'Settings', title: 'Site Settings', icon: <Settings className="w-5 h-5" />, perms: ['settings.manage'] },
    { id: 'admins', label: 'Team & Roles', title: 'Team & Roles', icon: <Shield className="w-5 h-5" />, perms: ['admins.manage'] },
];

export const AdminPanel: React.FC = () => {
    // The session is an httpOnly cookie; `token` is a placeholder (or an in-memory
    // fallback token when the browser blocks the cookie). Nothing is stored.
    const [token, setToken] = useState<string>('');
    const [restoring, setRestoring] = useState(true);
    const [securityOpen, setSecurityOpen] = useState(false);
    const [access, setAccess] = useState<AdminAccess | null>(null);
    const [accessError, setAccessError] = useState('');
    const [tab, setTab] = useState<TabId | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const clearSession = () => { signOutAdmin(); localStorage.removeItem('ap_admin_role'); setToken(''); setAccess(null); setTab(null); };

    useEffect(() => { restoreAdminSession().then(t => { setToken(t); setRestoring(false); }); }, []);
    const handleLogout = clearSession;

    // Auto-logout when any API call returns 401 Unauthorized (the session expired or was revoked)
    const [sessionExpired, setSessionExpired] = useState(false);
    useEffect(() => {
        const expired = () => { clearSession(); setSessionExpired(true); };
        window.addEventListener('admin-unauthorized', expired);
        return () => window.removeEventListener('admin-unauthorized', expired);
    }, []);

    // The role is read from the server, with resilient fallback to token claims so legacy/in-flight backends still work.
    useEffect(() => {
        if (!token) return;
        let live = true;
        setAccessError('');
        apiFetch('/admin/me', {}, token)
            .then(data => { if (live) setAccess(data.admin); })
            .catch((e: any) => {
                if (live) {
                    setAccessError(e.message || 'Could not load your access.');
                }
            });
        return () => { live = false; };
    }, [token]);

    const navItems = NAV.filter(i => hasPermission(access, ...i.perms));
    const current = navItems.find(i => i.id === tab) || navItems[0];

    if (restoring) return <div className="min-h-screen bg-[#000a1e] flex items-center justify-center" role="status" aria-label="Loading"><div className="w-8 h-8 border-[3px] border-white/20 border-t-[#fea520] rounded-full animate-spin" /></div>;
    if (!token) return <AdminLogin notice={sessionExpired ? 'Your session expired. Please sign in again.' : ''} onLogin={t => { setSessionExpired(false); setToken(t); }} />;

    if (!access) {
        return (
            <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center p-6">
                {accessError ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm text-center">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 mb-5">{accessError}</p>
                        <button onClick={handleLogout} className="bg-[#000a1e] text-white px-5 py-2.5 rounded-xl text-sm font-bold">Sign in again</button>
                    </div>
                ) : <div className="w-10 h-10 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" />}
            </div>
        );
    }

    // Fixed-height shell: the sidebar stays put (scrolling its own nav) and only the content column scrolls.
    return (
        <div className="h-screen bg-[#f4f6fb] flex overflow-hidden">
            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 h-screen shrink-0 bg-[#000a1e] flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="px-6 py-5 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#fea520]/10 border border-[#fea520]/30 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#fea520]" />
                        </div>
                        <div>
                            <div className="text-white font-extrabold text-sm">AssignmentMinds</div>
                            <div className="text-white/30 text-xs">{access.roleLabel} Console</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${current?.id === item.id ? 'bg-[#fea520] text-[#000a1e]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                            {item.icon}{item.label}
                        </button>
                    ))}
                </nav>

                <div className="px-4 py-4 border-t border-white/5 shrink-0">
                    <div className="px-4 pb-3 text-xs text-white/40 truncate">Signed in as <span className="text-white/70 font-semibold">{access.username}</span></div>
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-[12px] text-sm font-semibold text-white/40 hover:text-white hover:bg-white/5 transition-all">
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </aside>

            {/* Overlay */}
            {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 h-screen">
                {/* Topbar */}
                <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shadow-sm sticky top-0 z-20">
                    <div className="flex items-center gap-4 min-w-0">
                        <button className="lg:hidden text-gray-400 hover:text-[#000a1e]" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu className="w-5 h-5" /></button>
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl font-extrabold text-[#000a1e] truncate">{current?.title || 'Admin Console'}</h1>
                            <p className="text-xs text-gray-400">AssignmentMinds Admin Console</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold" title="Your role">
                            <Shield className="w-3.5 h-3.5" />{access.roleLabel}
                        </span>
                        <button onClick={() => setSecurityOpen(true)} aria-label="Security and two-factor authentication" title="Security" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                            <Shield className="w-3.5 h-3.5" /><span className="hidden sm:inline">Security</span>
                        </button>
                        <button onClick={() => setChangingPassword(true)} aria-label="Change password" title="Change password" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
                            <KeyRound className="w-3.5 h-3.5" /><span className="hidden sm:inline">Password</span>
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-8">
                    {!current && <p className="text-sm text-gray-500">Your role doesn’t have access to any console sections yet. Ask a Super Admin to update it.</p>}
                    {current?.id === 'dashboard' && <MarketplaceDashboard token={token} onNavigate={(t) => navItems.some(i => i.id === t) && setTab(t as TabId)} />}
                    {current?.id === 'overview' && <OverviewTab token={token} />}
                    {current?.id === 'orders' && <OrdersTab token={token} />}
                    {current?.id === 'users' && <UsersTab token={token} />}
                    {current?.id === 'writers' && <AdminWritersTab token={token} access={access} />}
                    {current?.id === 'applications' && <AdminApplicationsTab token={token} access={access} />}
                    {current?.id === 'assignments' && <AdminAssignmentsTab token={token} access={access} />}
                    {current?.id === 'memberships' && <AdminMembershipTab token={token} access={access} />}
                    {current?.id === 'recruitment' && <RecruitmentTab token={token} canSeeLeads={hasPermission(access, 'leads.manage')} onOpenLeads={() => setTab('contacts')} />}
                    {current?.id === 'audit' && <AdminAuditLogsTab token={token} />}
                    {current?.id === 'contacts' && <ContactsTab token={token} />}
                    {current?.id === 'analytics' && <AnalyticsTab token={token} />}
                    {current?.id === 'settings' && <SettingsTab token={token} />}
                    {current?.id === 'admins' && <AdminTeamTab token={token} />}
                    {current?.id === 'catalog' && <CatalogTab token={token} access={access} />}
                    {current?.id === 'content' && <SiteContentTab token={token} />}
                    {current?.id === 'trust' && <TrustSafetyTab token={token} access={access} />}
                </main>
            </div>
            {changingPassword && <AdminPasswordDialog token={token} onClose={() => setChangingPassword(false)} />}
            {securityOpen && <AdminSecurityDialog token={token} onClose={() => setSecurityOpen(false)} />}
        </div>
    );
};
