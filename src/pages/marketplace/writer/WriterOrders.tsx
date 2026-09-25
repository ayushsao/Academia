import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, API } from '../../../lib/api';
import { useStore } from '../../../store/useStore';
import { Inbox, Clock, CheckCircle2, AlertTriangle, Upload, Eye, FileText, Calendar, DollarSign, BookOpen, ArrowRight, RefreshCw, Crown } from 'lucide-react';

type OrderFile = {
    _id: string;
    originalName: string;
    fileName: string;
    mimeType: string;
    size: number;
    version: number;
    uploadedAt: string;
};

type Order = {
    _id: string;
    orderId: string;
    topicTitle: string;
    service: string;
    subject: string;
    instructions: string;
    description: string;
    pages: number;
    wordCount: number;
    deadline: string;
    totalAmount: number;
    currency: string;
    status: string;
    files: string[];
    deliveryFiles: OrderFile[];
    adminNotes: string;
    createdAt: string;
    submittedAt?: string;
    completedAt?: string;
    userId?: { name: string; email: string };
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-800', icon: Clock },
    assigned: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Inbox },
    in_progress: { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: RefreshCw },
    submitted: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Upload },
    revision_required: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertTriangle },
    completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle2 },
};

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending', assigned: 'Assigned', in_progress: 'In Progress',
    submitted: 'Submitted', revision_required: 'Revision Required', completed: 'Completed',
    cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
    const Icon = style.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${style.bg} ${style.text}`}>
            <Icon className="w-3.5 h-3.5" />{STATUS_LABELS[status] || status}
        </span>
    );
}

function formatDate(d?: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WriterOrdersPage() {
    const token = useStore(s => s.writerToken);
    // Opens on "My Orders" right after a writer accepts an order from Opportunities.
    const initialTab = (useLocation().state as { tab?: 'my-orders' } | null)?.tab;
    const [tab, setTab] = useState<'available' | 'my-orders'>(initialTab || 'available');
    const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
    const [myOrders, setMyOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [requiresMembership, setRequiresMembership] = useState(false);
    const [membershipPlan, setMembershipPlan] = useState('');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [accepting, setAccepting] = useState<string | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);

    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [uploadTarget, setUploadTarget] = useState<string | null>(null);

    const loadOrders = async () => {
        setLoading(true);
        setError('');
        try {
            const [avail, mine] = await Promise.all([
                api<{ orders: Order[]; requiresMembership?: boolean; membershipPlan?: string }>('/order-workflow/writer/available', { token: token || undefined }),
                api<{ orders: Order[] }>('/order-workflow/writer/my-orders', { token: token || undefined }),
            ]);
            setAvailableOrders(avail.orders || []);
            setRequiresMembership(Boolean(avail.requiresMembership));
            setMembershipPlan(avail.membershipPlan || '');
            setMyOrders(mine.orders || []);
        } catch (e: any) {
            setError(e.message || 'Failed to load orders.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, [token]);

    const handleAccept = async (orderId: string) => {
        if (!confirm('Are you sure you want to accept this order?')) return;
        setAccepting(orderId);
        try {
            await api('/order-workflow/writer/accept/' + orderId, { method: 'POST', token: token || undefined });
            await loadOrders();
            setTab('my-orders');
        } catch (e: any) {
            alert(e.message || 'Failed to accept order.');
        } finally {
            setAccepting(null);
        }
    };

    const handleUpload = async (orderId: string, files: FileList) => {
        setUploading(orderId);
        try {
            const form = new FormData();
            Array.from(files).forEach(f => form.append('files', f));
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(`${API}/order-workflow/writer/upload/${orderId}`, {
                method: 'POST', headers, credentials: 'include', body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed.');
            alert('Work submitted successfully!');
            await loadOrders();
        } catch (e: any) {
            alert(e.message || 'Upload failed.');
        } finally {
            setUploading(null);
            setUploadTarget(null);
        }
    };

    const handleDownloadRef = async (orderId: string, fileName: string) => {
        try {
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(`${API}/order-workflow/writer/files/${encodeURIComponent(orderId)}/${encodeURIComponent(fileName)}`, { headers, credentials: 'include' });
            if (!res.ok) throw new Error('Download failed.');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = fileName.replace(/^[0-9a-f]{32}-/, '');
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch { alert('Failed to download file.'); }
    };

    const orders = tab === 'available' ? availableOrders : myOrders;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#002147] sm:text-3xl">Client Orders</h1>
                    <p className="mt-1 text-slate-600">Accept orders, deliver work, and manage submissions.</p>
                </div>
                <button onClick={loadOrders} className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-100 border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-200 transition">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </button>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
                {([
                    { key: 'available', label: 'Available Orders', count: availableOrders.length },
                    { key: 'my-orders', label: 'My Orders', count: myOrders.length },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition ${
                            tab === t.key
                                ? 'bg-white text-[#002147] shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        {t.label}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                            tab === t.key ? 'bg-[#002147] text-white' : 'bg-slate-200 text-slate-600'
                        }`}>{t.count}</span>
                    </button>
                ))}
            </div>

            {error && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium">{error}</div>}

            {loading ? (
                <div className="flex justify-center py-20">
                    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#002147]" />
                </div>
            ) : tab === 'available' && requiresMembership ? (
                <div className="rounded-3xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50/30 p-8 text-center max-w-xl mx-auto shadow-sm my-6">
                    <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-[#fea520] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200">
                        <Crown className="w-8 h-8" />
                    </div>
                    <span className="inline-block text-[11px] font-extrabold uppercase tracking-widest bg-amber-200/60 text-amber-900 px-3 py-1 rounded-full mb-3">
                        Plan Purchase Required
                    </span>
                    <h3 className="text-xl font-black text-[#002147]">Active Membership Required</h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                        Admin-approved client orders are available exclusively to writers with an active membership plan. Once you subscribe to a plan, all available orders will appear here automatically.
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link
                            to="/writer/membership"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#002147] hover:bg-[#001233] text-white font-extrabold px-6 py-3 rounded-xl transition shadow-md"
                        >
                            <Crown className="w-4 h-4 text-amber-400" /> View Membership Plans
                        </Link>
                        <button
                            onClick={loadOrders}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-5 py-3 rounded-xl transition"
                        >
                            <RefreshCw className="w-4 h-4" /> Check Again
                        </button>
                    </div>
                </div>
            ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                        <Inbox className="w-8 h-8" />
                    </div>
                    <p className="text-lg text-slate-500 font-medium">
                        {tab === 'available' ? 'No orders available right now.' : 'No orders assigned to you yet.'}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                        {tab === 'available' ? 'New orders will appear here once approved by admin.' : 'Accept an available order to get started.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tab === 'available' && !requiresMembership && (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs text-emerald-800 font-semibold mb-2">
                            <div className="flex items-center gap-2">
                                <Crown className="w-4 h-4 text-emerald-600" />
                                <span>Membership Active: <strong className="text-emerald-900">{membershipPlan || 'Active Plan'}</strong> (Eligible to view & accept admin-approved orders)</span>
                            </div>
                            <span className="text-[10px] uppercase font-extrabold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">Verified</span>
                        </div>
                    )}
                    {orders.map(order => {
                        const isExpanded = expandedOrder === order.orderId;
                        return (
                            <div key={order.orderId} className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition hover:border-slate-300 hover:shadow-sm">
                                {/* Order Header */}
                                <div className="p-5 cursor-pointer" onClick={() => setExpandedOrder(isExpanded ? null : order.orderId)}>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-xs font-bold text-slate-400">{order.orderId}</span>
                                                <StatusBadge status={order.status} />
                                            </div>
                                            <h3 className="text-base font-bold text-[#0b1b33] truncate">{order.topicTitle}</h3>
                                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{order.subject}</span>
                                                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{order.pages} pg{order.pages > 1 ? 's' : ''}{order.wordCount ? ` · ${order.wordCount} words` : ''}</span>
                                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{order.deadline}</span>
                                                <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{order.currency || '£'} {order.totalAmount}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {tab === 'available' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAccept(order.orderId); }}
                                                    disabled={accepting === order.orderId}
                                                    className="inline-flex items-center gap-2 bg-[#fea520] hover:bg-[#e89400] text-[#0b1b33] font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                                                >
                                                    {accepting === order.orderId ? 'Accepting...' : <>Accept <ArrowRight className="w-4 h-4" /></>}
                                                </button>
                                            )}
                                            {(order.status === 'in_progress' || order.status === 'revision_required') && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setUploadTarget(order.orderId); fileInputRef.current?.click(); }}
                                                    disabled={uploading === order.orderId}
                                                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                                                >
                                                    <Upload className="w-4 h-4" />{uploading === order.orderId ? 'Uploading...' : 'Submit Work'}
                                                </button>
                                            )}
                                            <button className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-400">
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-4">
                                        {/* Instructions */}
                                        {(order.instructions || order.description) && (
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Instructions & Requirements</h4>
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{order.instructions || order.description}</p>
                                            </div>
                                        )}

                                        {/* Admin Notes (revision notes) */}
                                        {order.adminNotes && order.status === 'revision_required' && (
                                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2 flex items-center gap-1.5">
                                                    <AlertTriangle className="w-4 h-4" /> Revision Notes
                                                </h4>
                                                <p className="text-sm text-red-800 whitespace-pre-wrap">{order.adminNotes}</p>
                                            </div>
                                        )}

                                        {/* Reference Files */}
                                        {order.files && order.files.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Reference Files</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {order.files.map((fn, i) => {
                                                        const clean = fn.replace(/^[0-9a-f]{32}-/, '');
                                                        return (
                                                            <button key={i} onClick={() => handleDownloadRef(order.orderId, fn)}
                                                                className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-200 transition text-left">
                                                                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                                                <span className="text-xs font-medium text-slate-700 truncate">{clean}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Delivered Files */}
                                        {order.deliveryFiles && order.deliveryFiles.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Submitted Work</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {order.deliveryFiles.map(f => (
                                                        <div key={f._id} className="flex items-center justify-between bg-white border border-emerald-200 rounded-lg p-3">
                                                            <div className="flex items-center gap-2 min-w-0 mr-2">
                                                                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-medium text-slate-700 truncate">{f.originalName}</p>
                                                                    <p className="text-[10px] text-slate-400">v{f.version} · {formatFileSize(f.size)} · {formatDate(f.uploadedAt)}</p>
                                                                </div>
                                                            </div>
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Client Info (for assigned orders) */}
                                        {order.userId && tab === 'my-orders' && (
                                            <div className="text-xs text-slate-500">
                                                <span className="font-bold">Client:</span> {(order.userId as any).name}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Hidden file input for uploads */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                className="hidden"
                onChange={(e) => {
                    if (e.target.files && uploadTarget) {
                        handleUpload(uploadTarget, e.target.files);
                    }
                    e.target.value = '';
                }}
            />
        </div>
    );
}
