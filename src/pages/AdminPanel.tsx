import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard, ShoppingBag, Users, MessageSquare, LogOut,
    Search, RefreshCw, Trash2, ChevronDown, X, Check, Eye,
    TrendingUp, AlertCircle, Clock, CheckCircle2, XCircle,
    Shield, Mail, DollarSign, FileText, Menu, Award,
    BarChart2, Settings, Tag, Globe, Save, Activity
} from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────
const API = (import.meta as any).env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api');

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
    totalOrders: number; totalUsers: number; totalRevenue: number;
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
    totalAmount: number; status: string; assignedTo?: string;
    adminNotes?: string; createdAt: string; updatedAt: string;
}
interface User { _id: string; name: string; email: string; role: string; createdAt: string; lastLogin?: string; order_count: number; total_spent: number; }
interface Contact { _id: string; name: string; email: string; phone?: string; subject: string; message: string; status: string; createdAt: string; }

// ─── Status Badge ─────────────────────────────────────────────────────────────
const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    Pending: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: <Clock className="w-3 h-3" /> },
    'In Progress': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    Completed: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    Cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-3 h-3" /> },
};

const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] || { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
            {cfg.icon}{status}
        </span>
    );
};

// ─── Login Screen ─────────────────────────────────────────────────────────────
const AdminLogin = ({ onLogin }: { onLogin: (t: string) => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const data = await apiFetch('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
            localStorage.setItem('ap_admin_token', data.token);
            onLogin(data.token);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#000a1e] via-[#001233] to-[#002147] flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#fea520]/10 border border-[#fea520]/30 mb-4 shadow-[0_0_40px_rgba(254,165,32,0.2)]">
                        <Shield className="w-10 h-10 text-[#fea520]" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mb-1">Admin Console</h1>
                    <p className="text-white/40 text-sm">AssignmentMinds Control Centre</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 shadow-2xl space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Username</label>
                        <input
                            type="text" value={username} onChange={e => setUsername(e.target.value)} required
                            placeholder="Enter admin username"
                            className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#fea520]/50 focus:ring-2 focus:ring-[#fea520]/20 placeholder:text-white/20 font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">Password</label>
                        <input
                            type="password" value={password} onChange={e => setPassword(e.target.value)} required
                            placeholder="Enter password"
                            className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#fea520]/50 focus:ring-2 focus:ring-[#fea520]/20 placeholder:text-white/20 font-medium"
                        />
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full bg-[#fea520] hover:bg-[#e09510] disabled:opacity-60 text-[#000a1e] font-extrabold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-[0_0_20px_rgba(254,165,32,0.4)] flex items-center justify-center gap-2">
                        {loading ? <><div className="w-4 h-4 border-2 border-[#000a1e]/30 border-t-[#000a1e] rounded-full animate-spin" />Authenticating...</> : 'Login to Dashboard'}
                    </button>
                    <p className="text-center text-white/20 text-xs pt-2">Default: admin / admin123</p>
                </form>
            </div>
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

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            {/* Side Drawer */}
            <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#000a1e] to-[#002147] text-white px-6 py-5 flex items-start justify-between flex-shrink-0">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-bold text-[#fea520]">{order.orderId}</span>
                            {isNew && <span className="bg-[#fea520] text-[#000a1e] text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">NEW</span>}
                            <StatusBadge status={order.status} />
                        </div>
                        <h2 className="text-base font-extrabold leading-snug truncate">{order.topicTitle}</h2>
                        <p className="text-white/40 text-xs mt-0.5">
                            Placed {new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                    <button onClick={onClose} className="ml-4 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors flex-shrink-0">
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
                                    className="ml-auto bg-[#000a1e] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#002147] transition-colors flex items-center gap-1.5">
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
                                ['Total Amount', `£${order.totalAmount}`],
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
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Uploaded Files</p>
                        {order.files && order.files.length > 0 ? (
                            <div className="space-y-2">
                                {order.files.map((fileName, idx) => (
                                    <a
                                        key={idx}
                                        href={`${API.replace('/api', '')}/uploads/${fileName}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 bg-[#eef4ff] border border-[#d1e4ff] rounded-xl hover:bg-[#dbeafe] transition-colors group"
                                    >
                                        <div className="w-8 h-8 bg-[#002147] text-white rounded-lg flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-semibold text-[#002147] truncate flex-1">{fileName}</span>
                                        <span className="text-xs font-bold text-[#fea520] group-hover:text-[#e09510] flex-shrink-0">Download ↗</span>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-400 py-2">
                                <FileText className="w-4 h-4" />
                                <span className="text-sm">No files uploaded by student</span>
                            </div>
                        )}
                    </div>

                    {/* Admin Controls */}
                    <div className="bg-[#eef4ff] rounded-2xl p-5 border border-[#d1e4ff] space-y-4">
                        <p className="text-[10px] font-bold text-[#002147] uppercase tracking-widest">Admin Controls</p>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Update Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)}
                                className="w-full bg-white border border-[#d1e4ff] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#000a1e] focus:outline-none focus:ring-2 focus:ring-[#002147]/20">
                                {['Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Assign Writer</label>
                            <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                                placeholder="Writer name or email..."
                                className="w-full bg-white border border-[#d1e4ff] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#000a1e] focus:outline-none focus:ring-2 focus:ring-[#002147]/20" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Internal Admin Notes</label>
                            <textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                                placeholder="Not visible to student..."
                                className="w-full bg-white border border-[#d1e4ff] rounded-xl px-4 py-2.5 text-sm text-[#000a1e] focus:outline-none focus:ring-2 focus:ring-[#002147]/20 resize-none" />
                        </div>
                    </div>
                </div>

                {/* Sticky Save Footer */}
                <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4">
                    <button onClick={handleSave} disabled={saving}
                        className="w-full bg-[#000a1e] hover:bg-[#002147] text-white px-6 py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-lg">
                        {saving
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving Changes...</>
                            : saved ? <><Check className="w-4 h-4 text-emerald-400" />Changes Saved!</>
                                : '💾 Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
};

// ─── Orders Tab ───────────────────────────────────────────────────────────────
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
                <div className="bg-[#fea520] text-[#000a1e] px-5 py-3 rounded-2xl font-extrabold text-sm flex items-center gap-3 shadow-lg animate-bounce">
                    <span className="text-xl">🔔</span>
                    {newCount} New Order{newCount > 1 ? 's' : ''} Received! Refresh to see the latest.
                </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search by ID, topic, client..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#002147]/20 shadow-sm" />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-[#000a1e] focus:outline-none shadow-sm">
                    {['all', 'Pending', 'In Progress', 'Completed', 'Cancelled'].map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
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
                                                    <span className="font-mono text-xs font-bold text-[#002147]">{order.orderId}</span>
                                                    {isNew && <span className="bg-[#fea520] text-[#000a1e] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
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
                                            <td className="px-6 py-4 font-extrabold text-[#000a1e] whitespace-nowrap">£{order.totalAmount}</td>
                                            <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
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
                <button onClick={load} className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 shadow-sm"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
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
                <button onClick={load} className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm hover:bg-gray-50 shadow-sm flex items-center gap-2">
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
                                        className="bg-[#000a1e] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#002147] transition-colors">
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
                <StatCard label="Total Revenue" value={`£${Number(stats.totalRevenue).toFixed(0)}`} icon={<DollarSign className="w-5 h-5 text-emerald-600" />} accent="bg-emerald-600" />
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
        <div className="space-y-6 max-w-2xl">
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

            <button onClick={handleSave} disabled={saving}
                className="bg-[#000a1e] hover:bg-[#002147] text-white px-8 py-3.5 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all disabled:opacity-60 shadow-lg">
                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                    : saved ? <><Check className="w-4 h-4 text-emerald-400" />Saved!</>
                        : <><Save className="w-4 h-4" />Save Settings</>}
            </button>
        </div>
    );
};

// ─── Founders / Admins Tab ──────────────────────────────────────────────────────────
const AdminsTab = ({ token }: { token: string }) => {
    const [admins, setAdmins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);

    const load = React.useCallback(async () => {
        try {
            const data = await apiFetch('/admin/managers', {}, token);
            setAdmins(data.admins);
        } catch (e: any) { alert(e.message); }
        finally { setLoading(false); }
    }, [token]);

    React.useEffect(() => { load(); }, [load]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setInviting(true);
        try {
            const data = await apiFetch('/admin/managers', { method: 'POST', body: JSON.stringify({ email: inviteEmail }) }, token);

            // Send Email over EmailJS
            const EmailJSConfig = {
                serviceId: (import.meta as any).env.VITE_EMAILJS_SERVICE_ID || 'service_089l13d',
                templateId: (import.meta as any).env.VITE_EMAILJS_TEMPLATE_ID || 'template_omo2hya',
                publicKey: (import.meta as any).env.VITE_EMAILJS_PUBLIC_KEY || 'u1Lnz6UEF9jlDevVZ'
            };
            const emailjs = (await import('@emailjs/browser')).default;
            await emailjs.send(
                EmailJSConfig.serviceId as string,
                EmailJSConfig.templateId as string,
                {
                    name: 'Co-Founder',
                    email: inviteEmail,
                    subject: 'Admin Access Granted for AssignmentMinds',
                    message: `You have been granted Admin Access.\n\nPlease go to ${window.location.origin}/admin and login:\nUsername: ${data.admin.username} \nPassword: ${data.plainPassword}\n\nPlease keep these safe.`
                },
                EmailJSConfig.publicKey as string
            );

            alert('Admin invited successfully! An email with credentials has been sent.');
            setInviteEmail('');
            load();
        } catch (e: any) { alert('Failed to invite admin: ' + e.message); }
        finally { setInviting(false); }
    };

    const handleDelete = async (id: string, username: string) => {
        if (!window.confirm(`Revoke admin access for ${username}?`)) return;
        try {
            await apiFetch(`/admin/managers/${id}`, { method: 'DELETE' }, token);
            load();
        } catch (e: any) { alert(e.message); }
    };

    if (loading) return <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#fea520] rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-xl">
                <h3 className="font-bold text-[#000a1e] mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-[#fea520]" /> Invite Co-Founder</h3>
                <p className="text-sm text-gray-500 mb-5">Grant admin console access to another team member via email.</p>
                <form onSubmit={handleInvite} className="flex gap-3">
                    <input type="email" placeholder="Co-founder's email address..." value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#fea520]" />
                    <button type="submit" disabled={inviting}
                        className="bg-[#000a1e] hover:bg-[#002147] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60 flex items-center gap-2">
                        {inviting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Mail className="w-4 h-4" />} Invite
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-[#000a1e]">Active Admins <span className="text-gray-400 font-normal text-sm">({admins.length} total)</span></h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Username / Email</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Added On</th>
                                <th className="text-right px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {admins.map(admin => (
                                <tr key={admin._id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-[#000a1e]">{admin.username}</div>
                                        {admin.email && <div className="text-xs text-gray-400">{admin.email}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-medium">{new Date(admin.createdAt || Date.now()).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        {admin.username !== 'admin' && (
                                            <button onClick={() => handleDelete(admin._id, admin.username)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors inline-block" title="Revoke Access">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
export const AdminPanel: React.FC = () => {
    const [token, setToken] = useState<string>(() => localStorage.getItem('ap_admin_token') || '');
    const [tab, setTab] = useState<'overview' | 'orders' | 'users' | 'contacts' | 'analytics' | 'settings' | 'admins'>('overview');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => { localStorage.removeItem('ap_admin_token'); setToken(''); };

    // Auto-logout when any API call returns 401 Unauthorized
    useEffect(() => {
        const onUnauth = () => { localStorage.removeItem('ap_admin_token'); setToken(''); };
        window.addEventListener('admin-unauthorized', onUnauth);
        return () => window.removeEventListener('admin-unauthorized', onUnauth);
    }, []);

    if (!token) return <AdminLogin onLogin={setToken} />;

    const navItems = [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'orders', label: 'Orders', icon: <ShoppingBag className="w-5 h-5" /> },
        { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> },
        { id: 'contacts', label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
        { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-5 h-5" /> },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
        { id: 'admins', label: 'Co-Founders', icon: <Shield className="w-5 h-5" /> },
    ] as const;

    return (
        <div className="min-h-screen bg-[#f4f6fb] flex">
            {/* Sidebar */}
            <aside className={`fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-[#000a1e] flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="px-6 py-7 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#fea520]/10 border border-[#fea520]/30 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#fea520]" />
                        </div>
                        <div>
                            <div className="text-white font-extrabold text-sm">AssignmentMinds</div>
                            <div className="text-white/30 text-xs">Admin Console</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1">
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${tab === item.id ? 'bg-[#fea520] text-[#000a1e]' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                            {item.icon}{item.label}
                        </button>
                    ))}
                </nav>

                <div className="px-4 py-5 border-t border-white/5">
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white/40 hover:text-white hover:bg-white/5 transition-all">
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </aside>

            {/* Overlay */}
            {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Topbar */}
                <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden text-gray-400 hover:text-[#000a1e]" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></button>
                        <div>
                            <h1 className="text-xl font-extrabold text-[#000a1e] capitalize">{
                                tab === 'overview' ? 'Dashboard Overview'
                                    : tab === 'contacts' ? 'Contact Messages'
                                        : tab === 'analytics' ? 'Traffic & Analytics'
                                            : tab === 'settings' ? 'Site Settings'
                                                : tab.charAt(0).toUpperCase() + tab.slice(1) + ' Management'
                            }</h1>
                            <p className="text-xs text-gray-400">AssignmentMinds Admin Console</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold">Live</span>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6 lg:p-8 overflow-auto">
                    {tab === 'overview' && <OverviewTab token={token} />}
                    {tab === 'orders' && <OrdersTab token={token} />}
                    {tab === 'users' && <UsersTab token={token} />}
                    {tab === 'contacts' && <ContactsTab token={token} />}
                    {tab === 'analytics' && <AnalyticsTab token={token} />}
                    {tab === 'settings' && <SettingsTab token={token} />}
                    {tab === 'admins' && <AdminsTab token={token} />}
                </main>
            </div>
        </div>
    );
};
