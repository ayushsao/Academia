import React, { useState } from 'react';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { Footer } from '../../components/Footer';
import { Mail, Lock, LogIn } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { API, api } from '../../lib/api';

const ONBOARDING_STEPS = ['COMPLETE_PROFILE', 'SUBMIT_APPLICATION'];

export default function WriterLogin() {
    const navigate = useNavigate();
    const notice = (useLocation().state as { message?: string } | null)?.message;
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const login = useStore(state => state.login);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            if (data.user.role !== 'WRITER' && data.user.role !== 'ADMIN' && data.user.role !== 'admin') {
                throw new Error("You don't have a writer account.");
            }

            login(data.user.email, data.user.name, data.token, data.user._id || data.user.id, data.user.role);
            if (data.user.role !== 'WRITER') { navigate('/writer/dashboard'); return; }
            // Send writers who haven't finished applying back into the onboarding flow.
            const me = await api<{ writer: { onboarding: { nextStep: string } } }>('/writers/me', { token: data.token });
            navigate(ONBOARDING_STEPS.includes(me.writer.onboarding.nextStep) ? '/writer/onboarding' : '/writer/dashboard');
        } catch (err: any) {
            setError(err.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative z-0">
            <Navbar activeSection="" />

            <main className="flex-grow pt-12 pb-24 lg:pt-16 flex flex-col justify-center items-center px-4">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden max-w-md w-full relative z-10 transition-transform">
                    <div className="bg-[#002147] p-8 text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                            <LogIn className="w-8 h-8 text-[#fea520]" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-white mb-2">Writer Login</h2>
                        <p className="text-gray-300 text-sm font-medium">Access your marketplace dashboard.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8">
                        {notice && !error && (
                            <div className="mb-6 p-4 bg-sky-50 text-sky-800 rounded-xl border border-sky-100 text-sm font-semibold text-center">{notice}</div>
                        )}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-bold text-center">
                                {error}
                            </div>
                        )}
                        <div className="mb-6 relative">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                            <Mail className="absolute right-4 top-[38px] text-gray-400 w-5 h-5" />
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#fea520] outline-none"
                            />
                        </div>
                        <div className="mb-8 relative">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
                            <Lock className="absolute right-4 top-[38px] text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#fea520] outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold hover:bg-[#fea520] hover:text-[#002147] transition-all disabled:opacity-50 flex items-center justify-center shadow-lg"
                        >
                            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                        </button>
                    </form>
                    <div className="bg-gray-50 p-6 text-center border-t border-gray-100">
                        <p className="text-sm text-gray-600 font-medium">
                            Not a writer yet? <span className="text-[#fea520] font-bold cursor-pointer hover:underline" onClick={() => navigate('/writer/register')}>Apply Here</span>
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
