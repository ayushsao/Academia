import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, List, Coins, Layers, Plus, Bookmark, Wallet, Bell, MessageCircle, ChevronRight, User, FileText, CheckCircle, Clock, Home, Paperclip, Download, Star, Send, ArrowDown, Eye, Package } from 'lucide-react';
import { OrderModal } from '../components/OrderModal';
import { AcademiaLogo } from '../components/AcademiaLogo';

import { API } from '../lib/api';
import { formatOrderTotal } from '../lib/money';

// Normalise legacy/new status values for display
const normaliseStatus = (s: string): string => {
    const map: Record<string, string> = { 'Pending': 'pending', 'In Progress': 'in_progress', 'Completed': 'completed', 'Cancelled': 'cancelled' };
    return map[s] || s;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-100', borderColor: 'border-amber-200' },
    assigned: { label: 'Writer Assigned', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-200' },
    in_progress: { label: 'In progress', color: 'text-indigo-700', bgColor: 'bg-indigo-100', borderColor: 'border-indigo-200' },
    submitted: { label: 'Submitted', color: 'text-purple-700', bgColor: 'bg-purple-100', borderColor: 'border-purple-200' },
    revision_required: { label: 'Revision required', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-200' },
    completed: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-100', borderColor: 'border-emerald-200' },
    cancelled: { label: 'Cancelled', color: 'text-slate-700', bgColor: 'bg-slate-100', borderColor: 'border-slate-200' },
};

const PROGRESS_STEPS = ['pending', 'assigned', 'in_progress', 'submitted', 'completed'];

function OrderProgress({ status }: { status: string }) {
    const currentIdx = PROGRESS_STEPS.indexOf(status);
    return (
        <div className="flex items-center gap-1 w-full">
            {PROGRESS_STEPS.map((step, i) => {
                const done = i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                    <React.Fragment key={step}>
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-black transition-all ${
                            done ? (isCurrent ? 'bg-[#e37e25] text-white ring-2 ring-[#e37e25]/30' : 'bg-emerald-500 text-white') : 'bg-slate-200 text-slate-400'
                        }`}>
                            {done && !isCurrent ? '✓' : i + 1}
                        </div>
                        {i < PROGRESS_STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 rounded ${i < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function StarRating({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(s => (
                <button key={s} type="button" onClick={() => onChange(s)}
                    className={`p-0.5 transition-transform hover:scale-110 ${s <= rating ? 'text-amber-400' : 'text-slate-300'}`}>
                    <Star className="w-6 h-6" fill={s <= rating ? 'currentColor' : 'none'} />
                </button>
            ))}
        </div>
    );
}

export const Dashboard: React.FC = () => {
    const { user, token, orders, logout, setOrders } = useStore();
    const navigate = useNavigate();
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'loyalty' | 'resources'>('orders');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [uploadingForOrder, setUploadingForOrder] = useState<string | null>(null);
    const studentFileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
    // Orders always come from the server for the signed-in account.
    const [ordersState, setOrdersState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [ordersAttempt, setOrdersAttempt] = useState(0);

    const handleDownload = async (fileName: string) => {
        try {
            const fileUrl = `${API}/orders/files/${encodeURIComponent(fileName)}`;
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const resp = await fetch(fileUrl, { headers, credentials: 'include' });
            if (!resp.ok) throw new Error("Could not download file.");
            const blob = await resp.blob();
            const localUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = localUrl;
            a.download = fileName.replace(/^[0-9a-f]{32}-/, '');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(localUrl);
        } catch {
            alert("Failed to download file.");
        }
    };

    const handleStudentFileUpload = async (orderId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files.length) return;
        setUploadingForOrder(orderId);
        try {
            const formData = new FormData();
            (Array.from(e.target.files) as File[]).forEach(f => formData.append('files', f));
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API}/orders/${orderId}/files`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: formData
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to attach file');
            }

            const data = await res.json();
            setOrders(orders.map(o => ((o as any).orderId === orderId || (o as any).id === orderId) ? { ...o, files: data.files } : o));
            alert('File(s) attached successfully!');
        } catch (err: any) {
            alert(err.message || 'Upload failed');
        } finally {
            setUploadingForOrder(null);
            e.target.value = '';
        }
    };

    // Signed in = a remembered profile; the session itself is an httpOnly cookie.
    useEffect(() => {
        if (!user) return;
        let live = true;
        const loadOrders = async (quiet = false) => {
            if (!quiet) setOrdersState('loading');
            try {
                const res = await fetch(`${API}/orders`, {
                    credentials: 'include',   // cookie session (the interceptor adds a fallback token if needed)
                    cache: 'no-store',
                });
                if (!live) return;
                if (res.status === 401) {
                    // Session expired: sign in again so the right account's orders load.
                    logout();
                    alert('Your session has expired. Please sign in again to see your orders.');
                    navigate('/');
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setOrders(data.orders || []);
                setOrdersState('ready');
            } catch {
                if (live && !quiet) setOrdersState('error');
            }
        };
        loadOrders();
        // New deliveries and status changes appear on their own: every minute while
        // the tab is visible, and as soon as the customer comes back to the tab.
        const refresh = () => { if (document.visibilityState === 'visible') loadOrders(true); };
        const timer = window.setInterval(refresh, 60_000);
        document.addEventListener('visibilitychange', refresh);
        return () => { live = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
    }, [user?.email, setOrders, ordersAttempt]);

    const handleLogout = async () => {
        try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch (e) {}
        logout();
        navigate('/');
    };

    const [feedbackOrder, setFeedbackOrder] = useState<string | null>(null);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [feedbackSending, setFeedbackSending] = useState(false);
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

    const handleDeliveryDownload = async (orderId: string, fileId: string, fileName: string) => {
        setDownloadingFile(fileId);
        try {
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(`${API}/order-workflow/client/download/${orderId}/${fileId}`, { headers, credentials: 'include' });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Download failed.'); }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) { alert(e.message || 'Download failed.'); }
        finally { setDownloadingFile(null); }
    };

    // Enhanced status categories using normalised statuses
    const activeOrders = orders.filter(o => !['completed', 'cancelled', 'Completed', 'Cancelled'].includes(o.status));
    const completedOrders = orders.filter(o => ['completed', 'Completed'].includes(o.status));
    const pastOrders = orders.filter(o => ['completed', 'cancelled', 'Completed', 'Cancelled'].includes(o.status));

    return (
        <div className="min-h-screen bg-[#fafbfc] font-sans">
            {/* Top Orange Navigation Bar */}
            <header className="bg-gradient-to-r from-[#e37e25] to-[#f4933a] shadow-md px-6 py-3 flex items-center justify-between sticky top-0 z-40">
                {/* Logo Area */}
                <div className="flex items-center gap-0 cursor-pointer group" onClick={() => navigate('/')}>
                    <div className="w-10 h-10 bg-[#000a1e] rounded-full flex items-center justify-center z-10 transition-transform group-hover:scale-110">
                        <AcademiaLogo isDark className="h-7 w-auto" />
                    </div>
                    <div className="flex flex-col z-0 -ml-0.5">
                        <span className="text-2xl font-black text-white uppercase tracking-tight leading-none">ssignment<span className="text-[#000a1e]">Minds</span>™</span>
                        <span className="text-[9px] font-bold text-white/90 tracking-widest uppercase pl-1 pt-0.5">World's No. 1 Academic Help</span>
                    </div>
                </div>

                {/* Center Navigation Icons */}
                <div className="hidden lg:flex items-center gap-10 text-white/90">
                    <button
                        onClick={() => navigate('/')}
                        className="flex flex-col items-center gap-1 hover:text-white transition-colors opacity-60 pt-1 pb-1 border-b-2 border-transparent"
                    >
                        <Home className="w-5 h-5" />
                        <span className="text-xs font-semibold">Home</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-white border-b-2 border-white pb-1 pt-1' : 'hover:text-white opacity-60 pt-1 pb-1 border-b-2 border-transparent'}`}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        <span className={`text-xs ${activeTab === 'dashboard' ? 'font-bold' : 'font-semibold'}`}>Dashboard</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'orders' ? 'text-white border-b-2 border-white pb-1 pt-1' : 'hover:text-white opacity-60 pt-1 pb-1 border-b-2 border-transparent'}`}
                    >
                        <List className="w-5 h-5" />
                        <span className={`text-xs ${activeTab === 'orders' ? 'font-bold' : 'font-semibold'}`}>All orders</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('loyalty')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'loyalty' ? 'text-white border-b-2 border-white pb-1 pt-1' : 'hover:text-white opacity-60 pt-1 pb-1 border-b-2 border-transparent'}`}
                    >
                        <Coins className="w-5 h-5" />
                        <span className={`text-xs ${activeTab === 'loyalty' ? 'font-bold' : 'font-semibold'}`}>Loyalty points</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('resources')}
                        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'resources' ? 'text-white border-b-2 border-white pb-1 pt-1' : 'hover:text-white opacity-60 pt-1 pb-1 border-b-2 border-transparent'}`}
                    >
                        <Layers className="w-5 h-5" />
                        <span className={`text-xs ${activeTab === 'resources' ? 'font-bold' : 'font-semibold'}`}>Resources</span>
                    </button>
                </div>

                {/* Mobile Bottom Navigation Bar (Fixed) */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#000a1e] border-t border-gray-800 flex justify-around items-center px-2 py-3 z-50 rounded-t-2xl shadow-[0_-10px_20px_rgba(0,0,0,0.15)] pb-safe">
                    <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100 text-white">
                        <Home className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Home</span>
                    </button>
                    <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 text-white transition-opacity ${activeTab === 'dashboard' ? 'opacity-100' : 'opacity-70'}`}>
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Dash</span>
                    </button>
                    <button onClick={() => setActiveTab('orders')} className={`flex flex-col items-center gap-1 text-white transition-opacity ${activeTab === 'orders' ? 'opacity-100' : 'opacity-70'}`}>
                        <List className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Orders</span>
                    </button>
                    <button onClick={() => setActiveTab('loyalty')} className={`flex flex-col items-center gap-1 text-[#fea520] transition-opacity ${activeTab === 'loyalty' ? 'opacity-100' : 'opacity-70'}`}>
                        <Coins className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Loyalty</span>
                    </button>
                </div>

                {/* Right Side Icons & Profile */}
                <div className="flex items-center gap-2 sm:gap-5">
                    <button
                        onClick={() => setOrderModalOpen(true)}
                        className="bg-white text-[#e37e25] px-3 sm:px-4 py-1.5 rounded text-xs sm:text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-1 relative whitespace-nowrap"
                    >
                        New Order <Plus className="w-3 h-3 absolute -top-1 -right-1 text-emerald-500 font-extrabold" />
                    </button>

                    <button className="text-white/90 hover:text-white hidden sm:block">
                        <Bookmark className="w-5 h-5" />
                    </button>

                    <div className="hidden sm:flex items-center gap-1 text-white/90">
                        <Wallet className="w-5 h-5" />
                        <span className="bg-[#000a1e] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">£ 0.00</span>
                    </div>

                    <button className="text-white/90 hover:text-white relative hidden sm:block">
                        <Bell className="w-5 h-5" />
                        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-[#f4933a]"></div>
                    </button>

                    <div className="relative group cursor-pointer pl-2 sm:pl-4 sm:border-l border-white/20 flex flex-col items-center">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-[#e37e25] flex items-center justify-center font-bold relative z-10 border-2 border-white overflow-hidden shadow-sm">
                            <User className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <span className="hidden sm:inline-block text-[10px] text-white font-bold tracking-wide mt-0.5">{user?.name?.split(' ')[0] || 'Account'}</span>
                        <span className="hidden sm:inline-block absolute -bottom-2 bg-white text-[#222] text-[8px] font-black px-1.5 rounded-sm shadow-sm">NEW</span>

                        {/* Logout Dropdown */}
                        <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                            <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 font-bold hover:bg-gray-50 rounded flex items-center gap-2">
                                <LogOut className="w-4 h-4" /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Layout Area */}
            <main className="max-w-[1400px] mx-auto p-3 sm:p-6 pb-24 lg:pb-6 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">

                {/* Left Side Main Content Base on Tab */}
                <div className="flex-1 w-full space-y-6">
                    {activeTab === 'dashboard' && (
                        <div>
                            <div className="mb-6">
                                <h1 className="text-xl sm:text-2xl font-extrabold mb-1 tracking-tight text-[#000a1e]">Welcome Back, {user?.name?.split(' ')[0]}!</h1>
                                <p className="text-gray-500 text-xs sm:text-sm">Here's a quick overview of your latest academic progress.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10 w-full">
                                <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">Total Orders</p>
                                            <p className="text-xl font-black text-[#000a1e]">{orders.length}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                            <CheckCircle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">Completed</p>
                                            <p className="text-xl font-black text-[#000a1e]">{completedOrders.length}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                            <Clock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">In Progress</p>
                                            <p className="text-xl font-black text-[#000a1e]">{activeOrders.length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[400px] flex flex-col">
                            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-[#fdfdfd]">
                                <h2 className="text-sm font-bold text-[#1b2733] uppercase">All Projects ({orders.length})</h2>
                            </div>

                            {ordersState === 'loading' && orders.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-8 bg-gray-50/50" role="status" aria-label="Loading your orders">
                                    <div className="w-8 h-8 rounded-full border-[3px] border-gray-200 border-t-[#002147] animate-spin" />
                                </div>
                            ) : ordersState === 'error' ? (
                                <div className="flex-1 flex items-center justify-center p-8 text-center bg-gray-50/50">
                                    <div className="flex flex-col items-center">
                                        <p className="text-lg text-gray-600">We couldn’t load your orders.</p>
                                        <p className="text-xs text-gray-400 mt-2">Your orders are safe — check your connection and try again.</p>
                                        <button onClick={() => setOrdersAttempt(a => a + 1)} className="mt-4 rounded-lg bg-[#002147] px-5 py-2.5 text-sm font-semibold text-white">Try again</button>
                                    </div>
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-8 text-center bg-gray-50/50">
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                                            <List className="w-8 h-8 opacity-50" />
                                        </div>
                                        <p className="text-lg sm:text-2xl text-gray-500 font-light">No orders found</p>
                                        <p className="text-xs text-gray-400 mt-2">Create a new order to get started</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[700px]">
                                        <thead>
                                            <tr className="bg-[#dfe4ef] text-[#4a5568] text-[11px] sm:text-sm">
                                                <th className="font-bold py-3 px-4 sm:px-6 whitespace-nowrap">Order ID & Status</th>
                                                <th className="font-bold py-3 px-4 sm:px-6 whitespace-nowrap">Service Type</th>
                                                <th className="font-bold py-3 px-4 sm:px-6 whitespace-nowrap">Deadline</th>
                                                <th className="font-bold py-3 px-4 sm:px-6 whitespace-nowrap">Files</th>
                                                <th className="font-bold py-3 px-4 sm:px-6 whitespace-nowrap">Price Quote</th>
                                                <th className="font-bold py-3 px-4 sm:px-6 whitespace-nowrap">Payment</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map(order => {
                                                const oid = (order as any).orderId || (order as any).id;
                                                const hasFiles = order.files && order.files.length > 0;
                                                const isExpanded = expandedOrderId === oid;
                                                return (
                                                    <React.Fragment key={oid}>
                                                        <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                            <td className="py-4 px-4 sm:px-6">
                                                                <div className="font-bold text-[#000a1e] text-xs sm:text-sm">{oid}</div>
                                                                <span className={`inline-block mt-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${(STATUS_CONFIG[normaliseStatus(order.status)] || STATUS_CONFIG.pending).bgColor} ${(STATUS_CONFIG[normaliseStatus(order.status)] || STATUS_CONFIG.pending).color}`}>
                                                                    {(STATUS_CONFIG[normaliseStatus(order.status)] || STATUS_CONFIG.pending).label}
                                                                </span>
                                                                {normaliseStatus(order.status) === 'submitted' && <div className="mt-1 text-[10px] sm:text-xs text-gray-500">Writer submitted the work. We’re checking it.</div>}
                                                            </td>
                                                            <td className="py-4 px-4 sm:px-6">
                                                                <div className="font-bold text-gray-700 text-xs sm:text-sm whitespace-pre-wrap line-clamp-2">{order.service}</div>
                                                                <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{order.subject}</div>
                                                            </td>
                                                            <td className="py-4 px-4 sm:px-6 text-xs sm:text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                                {order.deadline}
                                                            </td>
                                                            <td className="py-4 px-4 sm:px-6 text-xs whitespace-nowrap">
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => setExpandedOrderId(isExpanded ? null : oid)}
                                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${hasFiles ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                                                    >
                                                                        <Paperclip className="w-3 h-3" />
                                                                        <span>{hasFiles ? `${order.files!.length} file(s)` : 'No files'}</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => studentFileInputRefs.current[oid]?.click()}
                                                                        disabled={uploadingForOrder === oid}
                                                                        className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                                        title="Attach rubric or files"
                                                                    >
                                                                        {uploadingForOrder === oid ? '...' : '+ Attach'}
                                                                    </button>
                                                                    <input
                                                                        ref={el => { studentFileInputRefs.current[oid] = el; }}
                                                                        type="file"
                                                                        multiple
                                                                        accept=".pdf,.doc,.docx,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.rtf,.zip,.jpg,.jpeg,.png,.webp"
                                                                        className="hidden"
                                                                        onChange={(e) => handleStudentFileUpload(oid, e)}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 sm:px-6 font-black text-[#e37e25] text-sm">
                                                                {formatOrderTotal(order.totalAmount, order.currency)}
                                                            </td>
                                                            <td className="py-4 px-4 sm:px-6">
                                                                {(order as any).payment?.status === 'PAID' ? (
                                                                    <div className="flex flex-col items-start gap-1">
                                                                        <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">PAID</span>
                                                                        <Link to={`/dashboard/receipt/${encodeURIComponent(oid)}`} className="text-[11px] sm:text-xs font-semibold text-[#002147] underline underline-offset-2 hover:text-[#e37e25]">Receipt</Link>
                                                                    </div>
                                                                ) : (order as any).payment?.status === 'PENDING_VERIFICATION' ? (
                                                                    <span className="text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100" title="We’re checking your payment reference">VERIFYING</span>
                                                                ) : order.totalAmount > 0 ? (
                                                                    <span className="text-[10px] sm:text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">UNPAID</span>
                                                                ) : (
                                                                    <span className="text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">FREE</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-blue-50/40 border-b border-blue-100">
                                                                <td colSpan={6} className="py-3 px-6">
                                                                    <div className="text-xs font-bold text-[#000a1e] mb-2 uppercase tracking-wider flex items-center justify-between">
                                                                        <span>Uploaded Files for Order {oid}</span>
                                                                        <button
                                                                            onClick={() => studentFileInputRefs.current[oid]?.click()}
                                                                            disabled={uploadingForOrder === oid}
                                                                            className="text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg cursor-pointer"
                                                                        >
                                                                            + Upload Another File
                                                                        </button>
                                                                    </div>
                                                                    {hasFiles ? (
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                            {order.files!.map((fn, fIdx) => {
                                                                                const clean = fn.replace(/^[0-9a-f]{32}-/, '');
                                                                                return (
                                                                                    <div key={fIdx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                                                                                        <div className="flex items-center gap-2 min-w-0 mr-2">
                                                                                            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                                                                            <span className="text-xs font-medium text-gray-800 truncate" title={clean}>{clean}</span>
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => handleDownload(fn)}
                                                                                            className="text-xs font-bold text-[#002147] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                                                                                        >
                                                                                            <Download className="w-3.5 h-3.5" />
                                                                                            <span>Download</span>
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-500 py-1">No files attached to this order yet. Use "+ Upload Another File" above to upload rubrics, prompts or datasets.</p>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Submissions Awaiting Client Review ────────── */}
                    {/* ── Completed Orders with Download & Feedback ────────── */}
                    {activeTab === 'orders' && completedOrders.length > 0 && (
                        <div className="mt-6 space-y-4">
                            <h2 className="text-sm font-bold text-[#1b2733] uppercase flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-600" /> Completed Work ({completedOrders.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {completedOrders.map(order => {
                                    const oid = (order as any).orderId || (order as any).id;
                                    const allFiles: any[] = (order as any).deliveryFiles || [];
                                    // The final file(s): the writer's latest approved version.
                                    const latest = Math.max(0, ...allFiles.map(f => f.version || 1));
                                    const deliveryFiles = allFiles.filter(f => (f.version || 1) === latest);
                                    const feedback = (order as any).feedback;
                                    const isFeedbackOpen = feedbackOrder === oid;

                                    const handleSubmitFeedback = async () => {
                                        if (!feedbackRating) return alert('Please select a rating.');
                                        setFeedbackSending(true);
                                        try {
                                            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                                            if (token) headers.Authorization = `Bearer ${token}`;
                                            const res = await fetch(`${API}/order-workflow/client/feedback/${oid}`, {
                                                method: 'POST', headers, credentials: 'include',
                                                body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment }),
                                            });
                                            const data = await res.json();
                                            if (!res.ok) throw new Error(data.error || 'Failed.');
                                            alert('Thank you for your feedback!');
                                            setFeedbackOrder(null);
                                            setFeedbackRating(0);
                                            setFeedbackComment('');
                                            setOrdersAttempt(a => a + 1); // refresh
                                        } catch (e: any) { alert(e.message); }
                                        finally { setFeedbackSending(false); }
                                    };

                                    return (
                                        <div key={oid} className="bg-white rounded-2xl border border-emerald-200 p-5 hover:shadow-md transition-shadow">
                                            {/* Header */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400">{oid}</span>
                                                    <h3 className="text-sm font-bold text-[#0b1b33] mt-0.5 line-clamp-2">{(order as any).topicTitle || order.service}</h3>
                                                </div>
                                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg">
                                                    <CheckCircle className="w-3 h-3" /> Completed
                                                </span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mb-3">
                                                <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{order.subject}</span>
                                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{(order as any).completedAt ? new Date((order as any).completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : order.deadline}</span>
                                                <span className="font-bold text-[#e37e25]">{formatOrderTotal(order.totalAmount, order.currency)}</span>
                                            </div>

                                            {/* Progress tracker */}
                                            <div className="mb-4">
                                                <OrderProgress status="completed" />
                                            </div>

                                            {/* Delivery Files */}
                                            {deliveryFiles.length > 0 && (
                                                <div className="mb-3">
                                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{deliveryFiles.length > 1 ? 'Final files' : 'Final file'}</h4>
                                                    <div className="space-y-2">
                                                        {deliveryFiles.map((f: any) => (
                                                            <div key={f._id} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                                                <div className="flex items-center gap-2 min-w-0 mr-2">
                                                                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                    <span className="text-xs font-medium text-slate-700 truncate">{f.originalName}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeliveryDownload(oid, f._id, f.originalName)}
                                                                    disabled={downloadingFile === f._id}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 shrink-0"
                                                                >
                                                                    <Download className="w-3.5 h-3.5" />{downloadingFile === f._id ? '...' : 'Download'}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {deliveryFiles.length === 0 && (
                                                <p className="mb-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">Your final file is being prepared. It will appear here to download.</p>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 mt-3">
                                                {deliveryFiles.length > 0 && (
                                                    <button onClick={() => handleDeliveryDownload(oid, deliveryFiles[deliveryFiles.length - 1]._id, deliveryFiles[deliveryFiles.length - 1].originalName)}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-[#002147] hover:bg-[#001233] text-white text-xs font-bold rounded-xl transition">
                                                        <Download className="w-3.5 h-3.5" /> Download completed work
                                                    </button>
                                                )}
                                                {!feedback ? (
                                                    <button onClick={() => { setFeedbackOrder(oid); setFeedbackRating(0); setFeedbackComment(''); }}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-bold rounded-xl transition border border-amber-200">
                                                        <Star className="w-3.5 h-3.5" /> Give feedback
                                                    </button>
                                                ) : (
                                                    <div className="flex-1 flex items-center gap-1 text-xs text-amber-600 font-semibold justify-center">
                                                        {[...Array(feedback.rating)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                                                        <span className="ml-1">Reviewed</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Feedback Form */}
                                            {isFeedbackOpen && !feedback && (
                                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                                                    <h4 className="text-xs font-bold text-[#0b1b33] mb-3">Rate this order</h4>
                                                    <StarRating rating={feedbackRating} onChange={setFeedbackRating} />
                                                    <textarea
                                                        value={feedbackComment}
                                                        onChange={e => setFeedbackComment(e.target.value)}
                                                        placeholder="Share your experience (optional)"
                                                        rows={3}
                                                        className="w-full mt-3 rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                                                    />
                                                    <div className="flex gap-2 mt-3">
                                                        <button onClick={handleSubmitFeedback} disabled={feedbackSending || !feedbackRating}
                                                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-[#e37e25] hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition disabled:opacity-50">
                                                            <Send className="w-3.5 h-3.5" />{feedbackSending ? 'Submitting...' : 'Submit Feedback'}
                                                        </button>
                                                        <button onClick={() => setFeedbackOrder(null)}
                                                            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {activeTab === 'loyalty' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[500px] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-white to-amber-50">
                            <div className="w-24 h-24 bg-gradient-to-tr from-amber-400 to-[#e37e25] rounded-full flex flex-col items-center justify-center text-white shadow-xl shadow-amber-200 mb-6 border-4 border-white">
                                <span className="text-3xl font-black">200</span>
                            </div>
                            <h2 className="text-2xl font-black text-[#000a1e] mb-2">Loyalty Points</h2>
                            <p className="text-gray-500 max-w-md">You've unlocked 200 loyalty points for joining AssignmentMinds! You can use these to claim discounts on future academic orders.</p>
                            <button className="mt-8 bg-[#e37e25] hover:bg-amber-600 text-white font-bold px-8 py-3 rounded-[12px] transition-all shadow-md">
                                Redeem Points
                            </button>
                        </div>
                    )}

                    {activeTab === 'resources' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[500px] p-8">
                            <h2 className="text-xl font-bold text-[#000a1e] mb-6">Premium Academic Resources</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {['Citation Guide 2024', 'Structure of a Perfect Essay', 'Research Methodologies Guide'].map((res, i) => (
                                    <div key={i} className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:bg-blue-50/50 transition-colors cursor-pointer group flex items-start gap-4">
                                        <div className="w-10 h-10 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{res}</h3>
                                            <p className="text-xs text-gray-500 mt-1">Download this free PDF guide to dramatically improve your assignment quality.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Sidebar Navigation/Action Buttons */}
                <div className="space-y-4">
                    {/* Floating WhatsApp Button */}
                    <div className="fixed bottom-6 right-6 z-50">
                        <button className="w-14 h-14 bg-[#25D366] hover:bg-[#20b858] text-white rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(37,211,102,0.4)] transition-transform hover:scale-110">
                            <MessageCircle className="w-8 h-8" />
                        </button>
                    </div>

                    {/* Personal A/C Manager Button */}
                    <button className="w-full bg-[#f0f9f1] border border-[#a3d8ab] rounded-md p-4 flex items-center justify-between hover:bg-[#e4f5e7] transition-colors relative group">
                        <div className="flex flex-col items-start pr-8">
                            <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm line-height-none tracking-wider mb-1">FREE</span>
                            <span className="text-[#3b8449] font-semibold text-[13px] uppercase tracking-wide leading-tight text-left">PERSONAL A/C MANAGER</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                            <MessageCircle className="w-5 h-5 ml-[-1px]" />
                        </div>
                    </button>

                    {/* Quick Tools List */}
                    <div className="space-y-3 pt-2">
                        {['FREE TOOLS', 'ESSAY TYPER', 'REFERENCING'].map((label, idx) => (
                            <button key={idx} className="w-full bg-[#eef0f3] hover:bg-[#e2e6eb] border border-[#e2e6eb] rounded-[12px] py-3.5 px-4 flex items-center justify-between transition-colors shadow-sm text-[#1b2733] group">
                                <span className="font-bold text-[13px] tracking-wide">{label}</span>
                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-700 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            </main>

            <OrderModal
                isOpen={orderModalOpen}
                onClose={() => setOrderModalOpen(false)}
            />
        </div>
    );
};
