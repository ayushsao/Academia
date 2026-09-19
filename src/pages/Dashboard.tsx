import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, List, Coins, Layers, Plus, Bookmark, Wallet, Bell, MessageCircle, ChevronRight, User, FileText, CheckCircle, Clock, Home } from 'lucide-react';
import { OrderModal } from '../components/OrderModal';

export const Dashboard: React.FC = () => {
    const { user, orders, logout } = useStore();
    const navigate = useNavigate();
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'loyalty' | 'resources'>('orders');

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Calculate generic student ID based on name or random fallback
    const studentId = user?.id?.toString().substring(0, 7) || Math.floor(1000000 + Math.random() * 9000000);

    const activeOrders = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled');
    const pastOrders = orders.filter(o => o.status === 'Completed' || o.status === 'Cancelled');

    return (
        <div className="min-h-screen bg-[#fafbfc] font-sans">
            {/* Top Orange Navigation Bar */}
            <header className="bg-gradient-to-r from-[#e37e25] to-[#f4933a] shadow-md px-6 py-3 flex items-center justify-between sticky top-0 z-40">
                {/* Logo Area */}
                <div className="flex items-center gap-0 cursor-pointer group" onClick={() => navigate('/')}>
                    <div className="w-9 h-9 bg-[#000a1e] rounded-full flex items-center justify-center font-black text-[#fea520] text-2xl z-10 transition-transform group-hover:scale-110">
                        A
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

                {/* Right Side Icons & Profile */}
                <div className="flex items-center gap-5">
                    <button
                        onClick={() => setOrderModalOpen(true)}
                        className="bg-white text-[#e37e25] px-4 py-1.5 rounded text-sm font-bold shadow-sm hover:bg-gray-50 flex items-center gap-1 relative"
                    >
                        New Order <Plus className="w-3 h-3 absolute -top-1 -right-1 text-emerald-500 font-extrabold" />
                    </button>

                    <button className="text-white/90 hover:text-white hidden sm:block">
                        <Bookmark className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-1 text-white/90">
                        <Wallet className="w-5 h-5" />
                        <span className="bg-[#000a1e] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">£ 0.00</span>
                    </div>

                    <button className="text-white/90 hover:text-white relative">
                        <Bell className="w-5 h-5" />
                        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-[#f4933a]"></div>
                    </button>

                    <div className="relative group cursor-pointer pl-4 border-l border-white/20 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-white text-[#e37e25] flex items-center justify-center font-bold relative z-10 border-2 border-white overflow-hidden shadow-sm">
                            <User className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] text-white font-bold tracking-wide mt-0.5">ID {studentId}</span>
                        <span className="absolute -bottom-2 bg-white text-[#222] text-[8px] font-black px-1.5 rounded-sm shadow-sm">NEW</span>

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
            <main className="max-w-[1400px] mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8">

                {/* Left Side Main Content Base on Tab */}
                <div className="flex-1 w-full space-y-6">
                    {activeTab === 'dashboard' && (
                        <div>
                            <div className="mb-6">
                                <h1 className="text-2xl font-extrabold mb-1 tracking-tight text-[#000a1e]">Welcome Back, {user?.name?.split(' ')[0]}!</h1>
                                <p className="text-gray-500 text-sm">Here's a quick overview of your latest academic progress.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 w-full">
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                            <FileText className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-bold uppercase">Total Orders</p>
                                            <p className="text-2xl font-black text-[#000a1e]">{orders.length}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                            <CheckCircle className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-bold uppercase">Completed</p>
                                            <p className="text-2xl font-black text-[#000a1e]">{pastOrders.length}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                            <Clock className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-bold uppercase">In Progress</p>
                                            <p className="text-2xl font-black text-[#000a1e]">{activeOrders.length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-[#fdfdfd]">
                                <h2 className="text-sm font-bold text-[#1b2733] uppercase">All Projects ({orders.length})</h2>
                            </div>

                            <div className="w-full overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#dfe4ef] text-[#4a5568] text-sm">
                                            <th className="font-bold py-3 px-6 whitespace-nowrap">Order ID & Status</th>
                                            <th className="font-bold py-3 px-6 whitespace-nowrap">Service Type</th>
                                            <th className="font-bold py-3 px-6 whitespace-nowrap">Deadline</th>
                                            <th className="font-bold py-3 px-6 whitespace-nowrap">Price Quote</th>
                                            <th className="font-bold py-3 px-6 whitespace-nowrap">Payment Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center text-3xl text-gray-500 font-light bg-gray-50/50">
                                                    No results
                                                </td>
                                            </tr>
                                        ) : (
                                            orders.map(order => (
                                                <tr key={order.orderId || order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold text-[#000a1e] text-sm">{order.orderId || order.id}</div>
                                                        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700'
                                                            : order.status === 'Pending' ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold text-gray-700 text-sm whitespace-pre-wrap line-clamp-2">{order.service}</div>
                                                        <div className="text-xs text-gray-500 mt-1">{order.subject}</div>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                        {order.deadline}
                                                    </td>
                                                    <td className="py-4 px-6 font-black text-[#e37e25]">
                                                        £{order.totalAmount}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        {order.totalAmount > 0 ? (
                                                            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">UNPAID</span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">FREE</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
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
                            <button className="mt-8 bg-[#e37e25] hover:bg-amber-600 text-white font-bold px-8 py-3 rounded-full transition-all shadow-md">
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
                            <button key={idx} className="w-full bg-[#eef0f3] hover:bg-[#e2e6eb] border border-[#e2e6eb] rounded-md py-3.5 px-4 flex items-center justify-between transition-colors shadow-sm text-[#1b2733] group">
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
