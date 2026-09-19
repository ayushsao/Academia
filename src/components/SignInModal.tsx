import React, { useState } from 'react';
import { Mail, Lock, X, ArrowRight, ShieldCheck, Sparkles, AlertCircle, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { AcademiaLogo } from './AcademiaLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';
import emailjs from '@emailjs/browser';

const API = (import.meta as any).env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api');

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showEmailForm, setShowEmailForm] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [apiError, setApiError] = useState<string>('');
  const login = useStore(state => state.login);
  const navigate = useNavigate();

  const sendWelcomeEmail = async (userName: string, userEmail: string) => {
    try {
      const env = (import.meta as any).env;
      await emailjs.send(
        env.VITE_EMAILJS_SERVICE_ID || 'service_089l13d',
        env.VITE_EMAILJS_WELCOME_TEMPLATE_ID || env.VITE_EMAILJS_TEMPLATE_ID,
        {
          from_name: "AssignmentMinds Team",
          to_name: userName || 'Student',
          to_email: userEmail, // Send TO the user
          reply_to: "support@assignmentminds.com",
          subject: "Welcome to AssignmentMinds!",
          message: "Welcome to AssignmentMinds! Your account has been created successfully. We're thrilled to have you onboard as a premium member, and look forward to helping you ace your academics! Let us know if you need any assignment help."
        },
        env.VITE_EMAILJS_PUBLIC_KEY || 'u1Lnz6UEF9jlDevVZ'
      );
    } catch (emailErr) {
      console.error("Welcome email failed", emailErr);
    }
  };

  const handleGoogleSuccess = async (tokenResponse: any) => {
    setIsAuthenticating(true);
    setApiError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${API}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: tokenResponse.access_token }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google login failed');

      // Fire welcome email if backend tagged them as a fresh Google insertion
      if (data.isNewUser) {
        await sendWelcomeEmail(data.user.name, data.user.email);
      }

      login(data.user.email, data.user.name, data.token, data.user.id);
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setApiError('Server is waking up (free tier). Please try again in 30 seconds.');
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        setApiError('Cannot reach server. It may be starting up — please retry in 30s.');
      } else {
        setApiError(err.message || 'Google Auth failed');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signInWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setApiError('Google Login failed (Popup closed or blocked)'),
  });

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsAuthenticating(true);
    setApiError('');
    try {
      const endpoint = activeTab === 'login' ? '/auth/login' : '/auth/signup';
      const body = activeTab === 'signup' ? { name: name || 'Student', email, password } : { email, password };
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      login(data.user.email, data.user.name, data.token, data.user.id);

      // -- Send Welcome Email on Signup --
      if (activeTab === 'signup') {
        await sendWelcomeEmail(data.user.name, data.user.email);
      }

      setIsAuthenticating(false);
      onClose();
      navigate('/dashboard');
    } catch (err: any) {
      // Fallback: demo mode when backend is offline
      if (err instanceof TypeError && err.message.includes('fetch')) {
        login(email, name || 'Demo User');
        setIsAuthenticating(false);
        onClose();
        navigate('/dashboard');
      } else {
        setIsAuthenticating(false);
        setApiError(err.message);
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', damping: 25, stiffness: 300 }
    },
    exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2 } }
  };

  const formVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
    exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#000a1e]/40 backdrop-blur-md overflow-y-auto">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,10,30,0.2)] border border-white/50 w-full max-w-[420px] overflow-hidden my-auto relative pt-12 pb-8 px-6 sm:px-10 flex flex-col items-center"
          >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -m-20 w-40 h-40 bg-[#fea520]/20 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 -m-20 w-40 h-40 bg-[#002147]/10 blur-3xl rounded-full pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-gray-400 hover:text-[#000a1e] bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-all cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Brand */}
            <div className="flex flex-col items-center mb-10 z-10">
              <div className="flex items-center gap-1.5 mb-2 cursor-pointer group">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#fea520] blur opacity-0 group-hover:opacity-40 transition-opacity rounded-full"></div>
                  <AcademiaLogo className="h-9 w-auto relative z-10 group-hover:scale-105 transition-transform" />
                </div>
                <span className="text-2xl tracking-tight">
                  <span className="font-extrabold text-[#000a1e]">cademia</span>
                  <span className="font-extrabold text-[#fea520]">Pro</span>
                  <sup className="text-[10px] font-bold text-gray-400 ml-0.5">TM</sup>
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-gray-500 font-medium tracking-wide">
                World's No. 1 Essay & Assignment Help Co. since 2007
              </span>
            </div>

            {isAuthenticating ? (
              <div className="flex flex-col items-center justify-center py-12 z-10">
                <div className="relative w-16 h-16 mb-6">
                  <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-[#fea520] rounded-full border-t-transparent animate-spin"></div>
                  <ShieldCheck className="absolute inset-0 m-auto w-6 h-6 text-[#002147]" />
                </div>
                <h3 className="text-lg font-bold text-[#000a1e]">Authenticating...</h3>
                <p className="text-xs text-gray-500 mt-2">Securing your session</p>
              </div>
            ) : (
              <div className="w-full z-10">
                {/* Tabs */}
                <div className="flex w-full mb-8 relative justify-center gap-8">
                  <button
                    onClick={() => { setActiveTab('login'); setShowEmailForm(false); }}
                    className={`text-lg transition-colors px-2 cursor-pointer pb-2 relative font-bold outline-none ${activeTab === 'login' ? 'text-[#000a1e]' : 'text-gray-400 hover:text-gray-700'
                      }`}
                  >
                    Login
                    {activeTab === 'login' && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#fea520] rounded-t-full shadow-[0_0_8px_rgba(254,165,32,0.6)]" />
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('signup'); setShowEmailForm(false); }}
                    className={`text-lg transition-colors px-2 cursor-pointer pb-2 relative font-bold outline-none ${activeTab === 'signup' ? 'text-[#000a1e]' : 'text-gray-400 hover:text-gray-700'
                      }`}
                  >
                    Signup
                    {activeTab === 'signup' && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#fea520] rounded-t-full shadow-[0_0_8px_rgba(254,165,32,0.6)]" />
                    )}
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-100 -z-10" />
                </div>

                <AnimatePresence mode="wait">
                  {!showEmailForm ? (
                    <motion.div
                      key="options"
                      variants={formVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {/* Buttons List */}
                      <div className="w-full space-y-3.5">
                        <button
                          onClick={() => signInWithGoogle()}
                          className="w-full flex items-center justify-center gap-3 border border-gray-200 bg-white rounded-xl py-3.5 hover:border-[#4285F4]/50 hover:bg-[#4285F4]/5 hover:shadow-sm transition-all cursor-pointer group"
                        >
                          {/* Google Icon SVG */}
                          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-1 7.28-2.69l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.87 0-5.3-1.94-6.16-4.53H2.15v2.85C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.11c-.22-.69-.35-1.43-.35-2.11s.13-1.42.35-2.11V7.04H2.15C1.4 8.52 1 10.2 1 12s.4 3.48 1.15 4.96l3.69-2.85z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.15 7.04l3.69 2.85c.86-2.59 3.29-4.51 6.16-4.51z" fill="#EA4335" />
                          </svg>
                          <span className="text-[#4285F4] text-sm font-bold">
                            {isAuthenticating ? 'Connecting to Google...' : 'Continue With Google'}
                          </span>
                        </button>

                        <button
                          onClick={() => setShowEmailForm(true)}
                          className="w-full flex items-center justify-center gap-3 border border-gray-200 bg-white rounded-xl py-3.5 hover:border-[#000a1e]/30 hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer text-[#000a1e] group"
                        >
                          <Mail className="w-5 h-5 text-[#002147] group-hover:scale-110 transition-transform" strokeWidth={2} />
                          <span className="text-sm font-bold">{activeTab === 'login' ? 'Login' : 'Signup'} With Email & Password</span>
                        </button>

                        <button className="w-full flex items-center justify-center gap-3 border border-gray-200 bg-white rounded-xl py-3.5 hover:border-[#000a1e]/30 hover:bg-gray-50 hover:shadow-sm transition-all cursor-pointer text-[#000a1e] group">
                          <div className="relative group-hover:scale-110 transition-transform">
                            <Lock className="w-5 h-5 text-[#002147]" strokeWidth={2} />
                            <span className="absolute -bottom-1 -right-1 text-[7px] bg-white rounded-full font-bold px-0.5 text-gray-500">OTP</span>
                          </div>
                          <span className="text-sm font-bold">{activeTab === 'login' ? 'Login' : 'Signup'} With OTP</span>
                        </button>
                      </div>


                      {apiError && (
                        <div className="mt-4 text-center text-red-500 text-xs font-bold bg-red-50 p-2 rounded-lg">
                          {apiError}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      variants={formVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onSubmit={handleLogin}
                      className="w-full space-y-4"
                    >
                      {apiError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-center gap-2 font-semibold">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />{apiError}
                        </div>
                      )}
                      {activeTab === 'signup' && (
                        <div>
                          <div className="relative group">
                            <User className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-[#002147] transition-colors" />
                            <input
                              type="text"
                              placeholder="Full name"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full border border-gray-200 bg-gray-50/50 rounded-xl pl-12 pr-4 py-3.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] transition-all font-medium text-sm text-[#000a1e]"
                              required
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-[#002147] transition-colors" />
                          <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-gray-200 bg-gray-50/50 rounded-xl pl-12 pr-4 py-3.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] transition-all font-medium text-sm text-[#000a1e]"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-[#002147] transition-colors" />
                          <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-200 bg-gray-50/50 rounded-xl pl-12 pr-4 py-3.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fea520]/50 focus:border-[#fea520] transition-all font-medium text-sm text-[#000a1e]"
                            required
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-[#000a1e] hover:bg-[#002147] text-white py-4 rounded-xl font-bold mt-4 transition-all shadow-glass hover:shadow-lg flex items-center justify-center gap-2 group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                        <span>{activeTab === 'login' ? 'Login Securely' : 'Create Account'}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#fea520]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEmailForm(false)}
                        className="w-full text-center text-sm font-semibold text-gray-400 hover:text-[#000a1e] transition-colors pt-2 underline decoration-transparent hover:decoration-gray-200 underline-offset-4 cursor-pointer"
                      >
                        Back to options
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Footer Text */}
            <div className="w-full text-center mt-10 text-[10px] sm:text-xs text-gray-400 font-medium leading-relaxed px-2 z-10">
              <Sparkles className="w-3.5 h-3.5 inline-block mr-1 text-[#fea520] mb-0.5" />
              By continuing, you agree to our<br className="sm:hidden" />
              {' '}<a href="#" className="text-[#002147] font-semibold hover:underline decoration-[#fea520] underline-offset-2">Terms of Service</a>,
              {' '}<a href="#" className="text-[#002147] font-semibold hover:underline decoration-[#fea520] underline-offset-2">Privacy Policy</a>, and
              {' '}<a href="#" className="text-[#002147] font-semibold hover:underline decoration-[#fea520] underline-offset-2">Refund Policy</a>.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
