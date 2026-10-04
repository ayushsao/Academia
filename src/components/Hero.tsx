import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AcademiaLogo } from './AcademiaLogo';
import {
  ArrowRight, PlayCircle, Calculator, Minus, Plus, Calendar, ChevronDown, CheckCircle2, FileSearch, PenTool, CheckSquare, Crown, Paperclip, ShieldCheck, Clock, X, GraduationCap, Award, Zap, Star, BookOpen, Users, Check
} from 'lucide-react';
import { ServiceType, SubjectType } from '../types';
import { useOrderQuote, fetchOrderQuote, SPACING_OPTIONS, DEFAULT_SPACING, pagesFor, deadlineAtFrom, type OrderQuote, type Spacing, localDateString } from '../lib/orderQuote';
import { DIAL_CODES, POPULAR_DIAL_CODES, dialLabel, countryName, currencyForDial } from '../lib/countryCodes';
import { MAIN_CURRENCIES, currencySymbolOf } from '../lib/currencyDisplay';

// The currencies always offered in the calculator; the customer's own is added when different.
import { api } from '../lib/api';
import type { Coupon } from '../lib/charges';
import { Stars } from './ui/Stars';
import { trackEvent } from '../lib/track';

interface HeroProps {
  onOpenOrder: (prefill?: {
    quote?: OrderQuote;
    service?: ServiceType;
    subject?: SubjectType;
    pages?: number;
    words?: number;
    spacing?: Spacing;
    deadline?: string;
    academicLevel?: 'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional';
    topicTitle?: string;
    instructions?: string;
    files?: string[];
    fileObjects?: File[];
    coupon?: Coupon;
  }) => void;
  onScrollToTimeline: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenOrder, onScrollToTimeline }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<'Writing' | 'Technical' | 'Online Class'>('Writing');
  const [academicLevel, setAcademicLevel] = useState<'Undergraduate' | 'Master\'s' | 'PhD / Doctoral'>('Undergraduate');
  const [service, setService] = useState<ServiceType | ''>('Academic Writing');
  const [subject, setSubject] = useState<SubjectType | ''>('');
  const [words, setWords] = useState<number>(0);
  const [spacing, setSpacing] = useState<Spacing>(DEFAULT_SPACING);
  const pages = pagesFor(words, spacing);   // display only: the price depends on words and the deadline
  const [deadlineTime, setDeadlineTime] = useState<string>('10:00 PM');
  const [email, setEmail] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('IN(+91)');
  const [phone, setPhone] = useState<string>('');
  const [contactErrors, setContactErrors] = useState<{ email?: string; phone?: string }>({});
  const [courseCode, setCourseCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);
  // Currency code (ISO 4217). It follows the phone country code; the customer can still pick another.
  const [currency, setCurrency] = useState<string>('INR');
  const [showDetailsSection, setShowDetailsSection] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return localDateString(d);
  };

  const [deadline, setDeadline] = useState<string>(getNextWeek());
  const [animatedPrice, setAnimatedPrice] = useState<number>(0);

  // The carousel advances every 5 s, only while it's on screen and the tab is
  // visible (no off-screen re-renders on phones), and not for people who ask
  // their system for reduced motion.
  const carouselRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let onScreen = true;
    const observer = typeof IntersectionObserver !== 'undefined' && carouselRef.current
      ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; })
      : null;
    if (observer && carouselRef.current) observer.observe(carouselRef.current);
    const timer = setInterval(() => {
      if (onScreen && document.visibilityState === 'visible') setCurrentSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => { clearInterval(timer); observer?.disconnect(); };
  }, []);


  const WORD_STEP = 250;

  const getTrackTooltip = (track: 'Writing' | 'Technical' | 'Online Class') => {
    switch (track) {
      case 'Writing': return 'Essays, Dissertations, Research Papers & Academic Theses';
      case 'Technical': return 'Coding, STEM, Math, SPSS & Quantitative Modeling';
      case 'Online Class': return 'Full Course Management, Weekly Quizzes & Timed Exams';
    }
  };

  const getServicesForTrack = (): ServiceType[] => {
    switch (selectedTrack) {
      case 'Writing':
        return [
          'Academic Writing',
          'Dissertation & Thesis',
          'Literature Review',
          'Case Study Analysis',
          'Research Paper Writing',
          'Editing & Proofreading',
          'Ghost Writer'
        ];
      case 'Technical':
        return [
          'Programming Assignment Help',
          'Data Analysis & SPSS',
          'Assessment Help',
          'Pay Someone To Do My Homework',
          'Coursework Help'
        ];
      case 'Online Class':
        return [
          'Take My Online Class',
          'Take My Online Exam',
          'Assessment Help',
          'Homework Help',
          'Term Paper Help'
        ];
    }
  };

  const handleTrackChange = (track: 'Writing' | 'Technical' | 'Online Class') => {
    setSelectedTrack(track);
    if (track === 'Writing') setService('Academic Writing');
    else if (track === 'Technical') setService('Programming Assignment Help');
    else if (track === 'Online Class') setService('Take My Online Class');
  };

  // Price comes from the server quote (the same one the order form and the order use).
  const orderService: ServiceType = (service as ServiceType) || (selectedTrack === 'Technical' ? 'Programming Assignment Help' : selectedTrack === 'Online Class' ? 'Take My Online Class' : 'Academic Writing');
  const quoteInput = { words, spacing, deadlineAt: deadlineAtFrom(deadline, deadlineTime), currency };
  const { quote, lastQuote, ensure, error: quoteError } = useOrderQuote(quoteInput, { enabled: words > 0 });
  const shownQuote = quote || lastQuote;

  const calculatedPrice = words === 0 ? 0 : shownQuote?.total ?? 0;
  const currencySymbol = currencySymbolOf(currency);
  const currencyOptions = MAIN_CURRENCIES.includes(currency) ? MAIN_CURRENCIES : [...MAIN_CURRENCIES, currency];
  // No live rate for the customer's own currency: fall back to US dollars.
  useEffect(() => {
    if (quoteError && /available right now/.test(quoteError) && !MAIN_CURRENCIES.includes(currency)) setCurrency('USD');
  }, [quoteError, currency]);
  const originalCatalogPrice = Math.round(calculatedPrice * 2.04);

  // Coupon: checked by the server here and again when the order is placed.
  // The price shown is after the discount; tax is added at checkout.
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponMsg({ ok: false, text: 'Enter a coupon code.' }); return; }
    setCouponBusy(true);
    setCouponMsg(null);
    try {
      const { coupon: found } = await api<{ coupon: Coupon }>('/orders/coupon', { method: 'POST', body: { code } });
      setCoupon(found);
      setCouponInput(found.code);
      setCouponMsg({ ok: true, text: `${found.percent}% off applied. Tax is added at checkout.` });
    } catch (e: any) {
      setCoupon(null);
      setCouponMsg({ ok: false, text: e?.message || 'This coupon code is not valid.' });
    } finally {
      setCouponBusy(false);
    }
  };
  const removeCoupon = () => { setCoupon(null); setCouponInput(''); setCouponMsg(null); };
  const shownPrice = coupon ? Math.round(calculatedPrice * (100 - coupon.percent)) / 100 : calculatedPrice;

  useEffect(() => {
    // Number roll animation
    const duration = 250;
    const startVal = animatedPrice;
    const endVal = shownPrice;
    if (startVal === endVal) return;

    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const val = Math.floor(startVal + (endVal - startVal) * progress);
      setAnimatedPrice(val);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setAnimatedPrice(endVal);
      }
    };
    requestAnimationFrame(step);
  }, [shownPrice]);

  const handleIncrement = () => {
    setWords((prev) => Math.min(200000, (Math.floor(prev / WORD_STEP) + 1) * WORD_STEP));
  };

  const handleDecrement = () => {
    setWords((prev) => (prev > WORD_STEP ? (Math.ceil(prev / WORD_STEP) - 1) * WORD_STEP : 0));
  };

  const handleWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 0) {
      setWords(0);
    } else {
      setWords(Math.min(val, 200000));
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    // Email and phone are required before the detailed quote.
    const errs: { email?: string; phone?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errs.email = email.trim() ? 'Enter a valid email address.' : 'Email is required.';
    const phoneDigits = phone.replace(/[\s()+-]/g, '');
    if (!/^\d{6,15}$/.test(phoneDigits)) errs.phone = phone.trim() ? 'Enter a valid phone number.' : 'Phone number is required.';
    setContactErrors(errs);
    if (errs.email || errs.phone) return;
    trackEvent('Lead', { content_name: 'Home quote calculator' });
    // Hand the order form the exact quote shown here (fetched now if the inputs just changed).
    let finalQuote: OrderQuote | undefined;
    try {
      finalQuote = words === 0 ? await fetchOrderQuote({ ...quoteInput, words: WORD_STEP }) : await ensure();
    } catch { finalQuote = undefined; /* the order form will quote again */ }
    onOpenOrder({
      quote: finalQuote,
      service: orderService,
      subject: (subject as SubjectType) || 'Business & Mgt',
      pages: Math.max(1, pages),
      words: words || WORD_STEP,
      spacing,
      deadline: `${deadline} (${deadlineTime})`,
      academicLevel,
      topicTitle: courseCode ? `[${courseCode}]` : undefined,
      instructions: [description.trim(), `Contact: ${email.trim()} | Phone: ${countryCode} ${phone.trim()}`].filter(Boolean).join('\n\n'),
      files: attachedFileName ? [attachedFileName] : undefined,
      fileObjects: attachedFile ? [attachedFile] : undefined,
      coupon: coupon || undefined,
    });
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const fadeUpItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };

  return (
    <section className="relative pt-10 md:pt-14 pb-20 overflow-hidden bg-[#f4f7fc] bg-arc-hero">
      {/* AM-style subtle concentric arc background decoration */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-180px] right-[-180px] w-[700px] h-[700px] rounded-full border border-[rgba(180,205,240,0.12)]"
          style={{ boxShadow: '0 0 0 60px rgba(180,205,240,0.06), 0 0 0 130px rgba(180,205,240,0.04), 0 0 0 220px rgba(180,205,240,0.02)' }} />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full border border-[rgba(180,205,240,0.10)]"
          style={{ boxShadow: '0 0 0 50px rgba(180,205,240,0.05), 0 0 0 110px rgba(180,205,240,0.03)' }} />
      </div>

      <div className="max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 relative z-10 flex flex-col lg:flex-row items-stretch justify-between gap-6 lg:gap-8 2xl:gap-10">

        {/* LEFT: Dynamic Carousel Container */}
        <div ref={carouselRef} className="flex-1 w-full min-w-0 relative overflow-hidden rounded-[16px] shadow-[0_4px_24px_rgba(30,58,95,0.08)] bg-white min-h-[560px] lg:min-h-[560px]">
          {/* initial={false}: the first slide shows straight away (no entrance animation delaying the first paint). */}
          <AnimatePresence mode="wait" initial={false}>
            {/* SLIDE 0: Path to Academic Excellence */}
            {currentSlide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 bg-white p-5 sm:p-6 md:p-7 w-full h-full border border-[#f0f2f5] flex flex-col justify-between overflow-y-auto"
              >
                {/* 1. Top Bar & Live Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-pink-100/70 shrink-0">
                  <div className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#002147]/5 text-[#002147] text-xs sm:text-[13px] font-bold whitespace-nowrap">
                    <Award className="w-3.5 h-3.5 shrink-0 text-[#b86e00]" />
                    <span className="sm:hidden">UK's #1 Academic Network</span>
                    <span className="hidden sm:inline truncate">UK's #1 Ranked Academic Consultation Network</span>
                  </div>
                  <div className="text-xs sm:text-[13px] font-medium whitespace-nowrap text-[#6e6e73] shrink-0">
                    <span>84 Ph.D. Mentors Active</span>
                  </div>
                </div>

                {/* 2. Main Headline & Subtitle */}
                <div className="my-1 shrink-0">
                  <h1 className="text-xl sm:text-2xl md:text-[27px] lg:text-[29px] font-black leading-[1.2] tracking-tight">
                    <span className="text-[#eb6200]">Assignment &amp; Dissertation Help</span> <span className="text-[#1e3a5f]">for Academic Excellence</span> <span className="text-[#eb6200]">Starts Here</span>
                  </h1>
                  <p className="text-[13px] sm:text-[15px] text-[#4b5563] font-normal mt-1 leading-relaxed">
                    Bespoke dissertations, essays, research coursework & data modeling tailored to UK university grading rubrics by verified Oxford & Russell Group scholars.
                  </p>
                </div>

                {/* 3. Core Visual Showcase + 3 High-Impact Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch my-1 shrink-0">
                  {/* Scholar Portrait Card (5 cols) */}
                  <div className="sm:col-span-5 relative group">
                    <div className="relative w-full h-[180px] sm:h-full min-h-[175px] rounded-2xl overflow-hidden border-3 border-white shadow-md bg-slate-100">
                      <img
                        src="/hero/scholar-640.webp"
                        width={640} height={426} fetchPriority="high" decoding="async"
                        alt="UK Academic Scholar"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-full shadow-xs border border-white/60 flex items-center gap-1 text-xs font-semibold text-[#1d1d1f]">
                        <Award className="w-3 h-3 text-amber-500" />
                        98.4% Distinction
                      </div>

                      <button
                        type="button"
                        onClick={onScrollToTimeline}
                        className="absolute inset-0 bg-black/15 hover:bg-black/25 flex items-center justify-center transition-all cursor-pointer group-hover:bg-black/20"
                        title="Watch video overview"
                      >
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-white text-gray-900 font-bold text-[13px] shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
                          <PlayCircle className="w-4 h-4 text-[#fea520] fill-[#fea520]" />
                          <span>Watch Tour</span>
                        </div>
                      </button>

                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 text-center">
                        <div className="text-[13px] font-bold text-white tracking-wide">Oxford & Cambridge Mentors</div>
                        <div className="text-[11px] text-white/80">Guaranteed 1st Class & 2:1 Honours</div>
                      </div>
                    </div>
                  </div>

                  {/* 3 Guarantee Cards (7 cols) */}
                  <div className="sm:col-span-7 flex flex-col justify-between gap-2">
                    <div className="bg-white rounded-xl p-2.5 border border-[#e5e7eb] shadow-[0_1px_4px_rgba(30,58,95,0.06)] flex items-center gap-2.5 hover:border-[#eb6200]/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#f4f7fc] text-[#1e3a5f] flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] sm:text-[15px] font-bold text-[#1a1a2e]">Guaranteed A+ Standard</span>
                          <span className="text-[11px] font-medium text-[#6b7280] bg-[#f4f7fc] px-1.5 py-0.5 rounded border border-[#e5e7eb]">Top 5% Ph.D.</span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-[#6b7280] leading-tight mt-0.5">Strict adherence to UK university grading rubrics & marking criteria.</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-2.5 border border-[#e5e7eb] shadow-[0_1px_4px_rgba(30,58,95,0.06)] flex items-center gap-2.5 hover:border-[#eb6200]/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#f4f7fc] text-[#1e3a5f] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] sm:text-[15px] font-bold text-[#1a1a2e]">Turnitin Authenticity</span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-[#6b7280] leading-tight mt-0.5">Custom-written from scratch with official plagiarism certificate.</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-2.5 border border-[#e5e7eb] shadow-[0_1px_4px_rgba(30,58,95,0.06)] flex items-center gap-2.5 hover:border-[#eb6200]/30 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-[#f4f7fc] text-[#1e3a5f] flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] sm:text-[15px] font-bold text-[#1a1a2e]">Urgent 3-Hour Delivery</span>
                          <span className="text-[11px] font-medium text-[#6b7280] bg-[#f4f7fc] px-1.5 py-0.5 rounded border border-[#e5e7eb]">24/7 Live</span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-[#6b7280] leading-tight mt-0.5">Direct scholar assignment with guaranteed on-time delivery.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Popular Subject Disciplines Chips */}
                <div className="bg-[#f9fafb] rounded-xl p-2 border border-[#e5e7eb] shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-semibold text-[#1a1a2e] uppercase tracking-wider">Specialized Disciplines</span>
                    <span className="text-xs font-medium text-[#6b7280]">85+ Subjects Covered</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Business & Mgt', 'Law & OSCOLA', 'Nursing & Health', 'Computer Science & AI', 'Finance & SPSS', 'Engineering'].map((sub, i) => (
                      <span key={i} className="text-[11.5px] sm:text-[12.5px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#e5e7eb] text-[#374151]">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 5. Russell Group Institutional Trust Strip */}
                <div className="grid grid-cols-4 gap-1.5 py-1.5 px-2 bg-white rounded-xl border border-[#e5e7eb] text-center shadow-[0_1px_4px_rgba(30,58,95,0.05)] shrink-0">
                  <div>
                    <div className="text-[13px] font-bold text-[#1a1a2e]">25,000+</div>
                    <div className="text-[11px] text-[#6b7280] font-medium">Papers Delivered</div>
                  </div>
                  <div className="border-x border-[#e5e7eb]">
                    <div className="text-[13px] font-bold text-[#1a1a2e]">1,200+</div>
                    <div className="text-[11px] text-[#6b7280] font-medium">Ph.D. Writers</div>
                  </div>
                  <div className="border-r border-[#e5e7eb]">
                    <div className="text-[13px] font-bold text-[#eb6200]">0.0%</div>
                    <div className="text-[11px] text-[#6b7280] font-medium">Plagiarism</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#1a1a2e]">4.9 / 5.0</div>
                    <div className="text-[11px] text-[#6b7280] font-medium">18k+ Reviews</div>
                  </div>
                </div>

                {/* 6. Verified Student Social Proof Testimonial */}
                <div className="bg-[#f9fafb] rounded-xl p-2 border border-[#e5e7eb] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#eb6200] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      S
                    </div>
                    <p className="text-[12.5px] text-[#374151] font-medium truncate">
                      <strong className="text-[#1a1a2e] font-bold">"Scored 78% Distinction in UCL Master's Thesis!</strong> Flawless research and methodology."
                    </p>
                  </div>
                  <span className="text-[11.5px] font-medium text-[#6b7280] bg-white px-2 py-0.5 rounded-full border border-[#e5e7eb] shrink-0 text-[#eb6200]">
                    <span className="inline-flex items-center gap-1"><Stars className="w-3 h-3" /> Verified Student</span>
                  </span>
                </div>

                {/* 7. Bottom Luxury A+ Distinction Banner */}
                <div className="relative z-20 shrink-0">
                  <div className="bg-[#eb6200] text-white p-2.5 sm:p-3 rounded-xl shadow-[0_4px_14px_rgba(235,98,0,0.35)] flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 text-center sm:text-left">
                      <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="text-[13px] sm:text-[15px] font-bold tracking-tight block">Scored A+ Grades in 2026 Semester</span>
                        <span className="text-xs text-white/90 font-medium">Over 15,000+ verified student reviews across 80+ UK universities</span>
                      </div>
                    </div>
                    <div className="bg-white px-2.5 py-1 rounded-md shadow-xs inline-flex items-center gap-1.5 shrink-0">
                      <AcademiaLogo className="h-6 w-auto" />
                      <div className="flex flex-col">
                        <span className="text-[#222] font-black text-[13px] uppercase tracking-tighter leading-none">Assignment<span className="text-[#fea520]">Minds</span></span>
                        <span className="text-[6px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-0.5">You Express, We Write</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 8. Slide Switcher Tabs */}
                <div className="flex items-center justify-center gap-1.5 pt-1 shrink-0">
                  {[
                    { label: '01 Academic Excellence' },
                    { label: '02 100% Original Work' },
                    { label: '03 UK Ph.D. Writers' }
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlide(idx)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        currentSlide === idx
                          ? 'bg-[#eb6200] text-white shadow-sm scale-105'
                          : 'bg-white hover:bg-[#f4f7fc] text-[#4b5563] border border-[#e5e7eb]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SLIDE 1: Guaranteed Original Work */}
            {currentSlide === 1 && (
              <motion.div
                key="slide-1"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 bg-white p-5 sm:p-6 md:p-7 w-full h-full border border-[#f0f2f5] flex flex-col justify-between overflow-y-auto"
              >
                {/* 1. Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 shrink-0">
                  <div className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fea520]/10 text-[#d87500] text-xs sm:text-[13px] font-bold whitespace-nowrap">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden">Originality Check Active</span>
                    <span className="hidden sm:inline truncate">Turnitin Originality Check Active</span>
                  </div>
                  <div className="text-xs sm:text-[13px] font-medium whitespace-nowrap text-[#6e6e73] shrink-0">
                    <span>Turnitin Scanner Online</span>
                  </div>
                </div>

                {/* 2. Main Headline */}
                <div className="text-center my-1 shrink-0">
                  <h1 className="text-xl sm:text-2xl md:text-[27px] lg:text-[29px] font-black leading-[1.2] tracking-tight">
                    <span className="text-[#1e3a5f]">Guaranteed</span> <strong className="text-[#eb6200] font-black">Original</strong> <span className="text-[#1e3a5f]">Work, with</span> <strong className="font-black text-[#1e3a5f]">Free Turnitin</strong> <span className="text-[#eb6200]">Report</span>
                  </h1>
                  <p className="text-[13px] sm:text-[15px] text-[#4b5563] mt-1 max-w-[92%] mx-auto">
                    Authenticity verified with an official Turnitin Originality report. Every paper is custom-crafted from scratch by verified subject scholars.
                  </p>
                </div>

                {/* 3. Center Dual Showcase */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch my-1 shrink-0">
                  {/* Left Certificate Preview Card (5 cols) */}
                  <div className="sm:col-span-5 relative group">
                    <div className="w-full h-[180px] sm:h-full min-h-[175px] rounded-2xl overflow-hidden border-3 border-white shadow-md bg-slate-200 relative">
                      <img
                        src="/hero/students-640.webp"
                        width={640} height={426} decoding="async"
                        alt="UK Students Collaborating"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md text-[#1d1d1f] rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm flex items-center gap-1 border border-white/60">
                        <CheckCircle2 className="w-3 h-3" /> A+ Distinction
                      </div>
                      <div className="absolute bottom-2 left-2 bg-[#000a1e] text-[#fea520] rounded-full px-2 py-0.5 text-[11px] font-black shadow-sm flex items-center gap-1 border border-[#fea520]/40">
                        <Crown className="w-2.5 h-2.5 fill-current" /> Turnitin Report
                      </div>
                    </div>
                  </div>

                  {/* Right Guarantee Cards (7 cols) */}
                  <div className="sm:col-span-7 flex flex-col justify-between gap-2">
                    <div className="bg-white/95 rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center shrink-0">
                        <PenTool className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] sm:text-[15px] font-bold text-gray-900 leading-tight">Written From Scratch</div>
                        <div className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Written from scratch by real subject scholars with genuine critical evaluation.</div>
                      </div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center shrink-0 font-black text-[13px]">
                        100%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] sm:text-[15px] font-bold text-gray-900 leading-tight">Free Turnitin Similarity Report</div>
                        <div className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Official full similarity breakdown PDF delivered free with every consultation.</div>
                      </div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] text-[#1d1d1f] flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] sm:text-[15px] font-bold text-gray-900 leading-tight">Academic Integrity Promise</div>
                        <div className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Free unlimited revisions until perfection with 100% copyright transfer.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Supported Citation Styles Strip */}
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-2 border border-slate-200 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-bold text-gray-700 uppercase tracking-wider">Citation & Referencing Precision</span>
                    <span className="text-xs font-medium text-[#6e6e73]">Full In-Text & Bibliography</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Harvard UK', 'APA 7th Edition', 'OSCOLA Law', 'IEEE / ACM', 'Chicago & Turabian', 'MHRA'].map((c, i) => (
                      <span key={i} className="text-[11.5px] sm:text-[12.5px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-gray-700 shadow-2xs">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 5. Integrity Matrix Strip */}
                <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 bg-white/85 backdrop-blur-sm rounded-xl border border-slate-200 text-center shadow-xs shrink-0">
                  <div className="border-r border-slate-200">
                    <div className="text-[13px] font-black text-[#1d1d1f]">&lt; 3%</div>
                    <div className="text-[11px] text-gray-500 font-medium">Similarity Index</div>
                  </div>
                  <div className="border-r border-slate-200">
                    <div className="text-[13px] font-black text-[#1d1d1f]">20+</div>
                    <div className="text-[11px] text-gray-500 font-medium">Peer Sources</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-black text-[#1d1d1f]">100%</div>
                    <div className="text-[11px] text-gray-500 font-medium">Confidential</div>
                  </div>
                </div>

                {/* 6. Social Proof */}
                <div className="bg-[#f5f5f7] rounded-xl p-2 border border-[#e5e5ea] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      L
                    </div>
                    <p className="text-[12.5px] text-gray-700 font-medium truncate">
                      <strong className="text-gray-900 font-bold">"Turnitin scan came back 1% similarity!</strong> Tutor commended the critical arguments."
                    </p>
                  </div>
                  <span className="text-[11.5px] font-medium text-[#6e6e73] bg-white px-2 py-0.5 rounded-full border border-[#e5e5ea] shrink-0">
                    Manchester MSc Student
                  </span>
                </div>

                {/* 7. Bottom Quality Banner */}
                <div className="text-center font-semibold text-gray-800 text-[13px] sm:text-[15px] relative z-20 shrink-0 bg-white/95 py-2.5 px-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#b86e00]" />
                    <span>Official Turnitin Originality Certificate Included with Every Order</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenOrder()}
                    className="text-[13px] font-bold text-[#eb6200] hover:text-[#c45200] underline cursor-pointer whitespace-nowrap"
                  >
                    Order Original Work →
                  </button>
                </div>

                {/* 8. Slide Switcher Tabs */}
                <div className="flex items-center justify-center gap-1.5 pt-1 shrink-0">
                  {[
                    { label: '01 Academic Excellence' },
                    { label: '02 100% Original Work' },
                    { label: '03 UK Ph.D. Writers' }
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlide(idx)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        currentSlide === idx
                          ? 'bg-[#eb6200] text-white shadow-sm scale-105'
                          : 'bg-white hover:bg-[#f4f7fc] text-[#4b5563] border border-[#e5e7eb]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SLIDE 2: Best Assignment Help UK */}
            {currentSlide === 2 && (
              <motion.div
                key="slide-2"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 bg-gradient-to-br from-[#831843] via-[#9d174d] to-[#be185d] p-5 sm:p-6 md:p-7 w-full h-full flex flex-col justify-between text-white overflow-y-auto"
              >
                {/* 1. Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/20 shrink-0">
                  <div className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-xs sm:text-[13px] font-bold whitespace-nowrap">
                    <Crown className="w-3.5 h-3.5 shrink-0 text-[#ffcb05]" />
                    <span className="sm:hidden">UK's Highest-Rated Network</span>
                    <span className="hidden sm:inline truncate">UK's Highest-Rated Student Consultation Network</span>
                  </div>
                  <div className="text-xs sm:text-[13px] font-medium whitespace-nowrap text-white/70 shrink-0">
                    <span>1,200+ Ph.D. Writers Available</span>
                  </div>
                </div>

                {/* 2. Main Headline */}
                <div className="my-1 shrink-0">
                  <h1 className="text-xl sm:text-2xl md:text-[27px] lg:text-[29px] font-black leading-[1.2] tracking-tight">
                    Best Assignment Help in <span className="text-[#eb6200] font-black">UK</span> for Students
                  </h1>
                  <p className="text-[13px] sm:text-[15px] text-white/85 font-normal mt-1">
                    High-quality academic assistance by verified subject helpers, Ph.D. mentors, and former Russell Group university academics.
                  </p>
                </div>

                {/* 3. 4 Feature Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1 shrink-0">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <FileSearch className="w-4 h-4 text-[#ffcb05]" />
                      <span className="text-[13px] sm:text-[15px] font-bold text-white">0% Plagiarism Authenticity</span>
                    </div>
                    <p className="text-[12.5px] text-white/80 leading-snug">Strict Turnitin compliance with complete originality guaranteed on every order.</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <PenTool className="w-4 h-4 text-[#ffcb05]" />
                      <span className="text-[13px] sm:text-[15px] font-bold text-white">1,200+ Ph.D. Writers</span>
                    </div>
                    <p className="text-[12.5px] text-white/80 leading-snug">Distinguished graduates from Oxford, Cambridge, UCL, Imperial & LSE.</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CheckSquare className="w-4 h-4 text-[#ffcb05]" />
                      <span className="text-[13px] sm:text-[15px] font-bold text-white">Genuine Scholarly Depth</span>
                    </div>
                    <p className="text-[12.5px] text-white/80 leading-snug">100% human academic reasoning, qualitative analysis & peer-reviewed sources.</p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Clock className="w-4 h-4 text-[#ffcb05]" />
                      <span className="text-[13px] sm:text-[15px] font-bold text-white">24/7 Delivery & Support</span>
                    </div>
                    <p className="text-[12.5px] text-white/80 leading-snug">On-time guaranteed submission from 3 hours express to semester projects.</p>
                  </div>
                </div>

                {/* 4. Russell Group Universities Strip */}
                <div className="py-2 px-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 text-center shrink-0">
                  <div className="text-[13px] font-bold text-white/95">
                    Russell Group Mentors: <span className="text-[#ffcb05]">Oxford • Cambridge • Imperial • UCL • LSE • KCL • Manchester • Edinburgh</span>
                  </div>
                </div>

                {/* 5. Academic Scope Strip */}
                <div className="py-1.5 px-3 bg-black/20 rounded-xl border border-white/10 text-center shrink-0">
                  <span className="text-xs text-white/90 font-medium">
                    Dissertations • Essays • Systematic Literature Reviews • Case Studies • Theses • Quantitative Coding
                  </span>
                </div>

                {/* 6. Real Student Testimonial */}
                <div className="bg-black/25 rounded-xl p-2 border border-white/15 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#ffcb05] text-gray-900 flex items-center justify-center text-xs font-bold shrink-0">
                      J
                    </div>
                    <p className="text-[12.5px] text-white/90 font-medium truncate">
                      <strong className="text-white font-bold">"Finished my Master's thesis in 4 days.</strong> Incredible depth of research & methodology."
                    </p>
                  </div>
                  <span className="text-[11.5px] font-bold text-[#ffcb05] bg-black/40 px-2 py-0.5 rounded-full border border-white/20 shrink-0">
                    KCL MSc Student
                  </span>
                </div>

                {/* 7. Footer Rating & CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 pt-2 border-t border-white/20">
                  <div className="flex items-center gap-2 text-center sm:text-left">
                    <div className="flex text-[#ffcb05]"><Stars className="w-4 h-4" /></div>
                    <div>
                      <div className="text-[13px] font-bold text-white">4.95/5 Rating</div>
                      <div className="text-[11.5px] text-white/80">Over 100,000+ UK student assignments completed</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenOrder()}
                    className="bg-[#eb6200] hover:bg-[#d45600] text-white font-bold text-[13px] sm:text-[15px] px-5 py-2 rounded-md flex items-center gap-2 shadow-[0_4px_14px_rgba(235,98,0,0.4)] transition-all cursor-pointer"
                  >
                    <span>Claim 51% Discount</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 8. Slide Switcher Tabs */}
                <div className="flex items-center justify-center gap-1.5 pt-1 shrink-0">
                  {[
                    { label: '01 Academic Excellence' },
                    { label: '02 100% Original Work' },
                    { label: '03 UK Ph.D. Writers' }
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlide(idx)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        currentSlide === idx
                          ? 'bg-[#eb6200] text-white shadow-sm scale-105'
                          : 'bg-white/15 hover:bg-white/25 text-white/90 border border-white/20'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Carousel Pagination Dots */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentSlide === idx
                    ? 'w-6 h-2 bg-[#fea520]'
                    : 'w-2 h-2 bg-[#fea520]/40 hover:bg-[#fea520]/70'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Right Form Column (Cost Calculator) — AM golden-frame card */}
        <div className="w-full lg:w-[480px] xl:w-[500px] shrink-0 relative z-10 flex justify-center lg:justify-end">

          {/* AM golden outer frame */}
          <div className="am-form-frame w-full">
          <div
            id="cost-calculator-card"
            className="am-form-inner w-full relative overflow-hidden"
          >
            {/* UP TO 51% OFF Ribbon - diagonal top-right */}
            <div className="absolute top-[18px] -right-[46px] bg-[#eb6200] text-white py-[5px] px-14 transform rotate-45 flex flex-col items-center justify-center shadow-md z-20 pointer-events-none">
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase leading-none mb-0.5">UP TO</span>
              <span className="text-[13px] font-black leading-none tracking-tight">51% OFF</span>
            </div>

            {/* Header - Calculate Cost */}
            <div className="flex justify-between items-center mb-4 pr-10">
              <div>
                <h2 className="text-[22px] sm:text-[24px] font-extrabold text-[#1a1a2e] tracking-tight leading-tight mb-0.5">Calculate Cost</h2>
                <p className="text-[13px] font-normal text-[#6b8db8]">Transparent institutional pricing</p>
              </div>
              <div className="w-[46px] h-[46px] rounded-xl bg-[#dbeafe] flex items-center justify-center text-[#3b82f6] shrink-0">
                <Calculator className="w-5 h-5 stroke-[1.75]" />
              </div>
            </div>

            {/* 1. Trust Guarantees Bar — MAH style */}
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-3 gap-y-1 text-xs font-medium text-[#374151] bg-[#f9fafb] rounded-lg px-3 py-2 border border-[#e5e7eb] mb-4">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2] text-[#eb6200]" />
                <span>Free Revisions Included</span>
              </span>
              <span className="hidden sm:inline text-[#d1d5db]">•</span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5 text-[#eb6200]" />
                <span>No AI</span>
              </span>
              <span className="hidden sm:inline text-[#d1d5db]">•</span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-[#1e3a5f]" />
                <span>24/7 Support</span>
              </span>
            </div>

            <form onSubmit={handleSubmitQuote} noValidate className="space-y-4">
              {/* 2. Track Category Radio Pills — MAH style */}
              <div>
                <div className="flex items-center justify-between gap-2 p-1 bg-[#f4f7fc] rounded-lg border border-[#e5e7eb]">
                  {(['Writing', 'Technical', 'Online Class'] as const).map((track) => {
                    const isSelected = selectedTrack === track;
                    return (
                      <label
                        key={track}
                        className={`flex-1 py-2 px-2 rounded-md text-xs sm:text-[13px] font-medium whitespace-nowrap transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-white text-[#1a1a2e] shadow-sm border border-[#e5e7eb] font-semibold'
                            : 'text-[#6b7280] hover:text-[#1a1a2e]'
                        }`}
                      >
                        <input type="radio" name="track" value={track} checked={isSelected} onChange={() => handleTrackChange(track)} className="sr-only" />
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-[#eb6200]' : 'border-[#d1d5db]'}`}>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#eb6200]" />}
                        </span>
                        <span>{track}</span>
                        <span title={getTrackTooltip(track)} className="hidden sm:inline opacity-50 text-xs">ⓘ</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 3. Academic Level Segmented Controls — MAH style */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-widest">
                    Academic Level
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-[#f4f7fc] p-1 rounded-lg border border-[#e5e7eb]">
                  {[
                    { label: 'Undergrad', value: 'Undergraduate' },
                    { label: "Master's", value: "Master's" },
                    { label: 'PhD / Doc', value: 'PhD / Doctoral' }
                  ].map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setAcademicLevel(lvl.value as any)}
                      className={`py-2 text-[13px] font-medium rounded-md transition-all cursor-pointer ${
                        academicLevel === lvl.value
                          ? 'bg-white text-[#1a1a2e] shadow-sm border border-[#e5e7eb] font-semibold'
                          : 'text-[#6b7280] hover:text-[#374151]'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Dropdowns Row: Service & Subject — MAH style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="relative">
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value as ServiceType)}
                      className="am-input appearance-none cursor-pointer pr-9"
                    >
                      <option value="" disabled>Select a Service</option>
                      {getServicesForTrack().map((srv) => (
                        <option key={srv} value={srv}>{srv}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6b7280]">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as SubjectType)}
                      className="am-input appearance-none cursor-pointer pr-9"
                    >
                      <option value="" disabled>Select a Subject</option>
                      <option value="Business & Mgt">Business & Mgt</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Literature & Humanities">Literature</option>
                      <option value="Finance & Economics">Finance & Econ</option>
                      <option value="Law & Legal Studies">Law & Legal</option>
                      <option value="Medical & Healthcare">Medical Sciences</option>
                      <option value="Engineering & STEM">Engineering</option>
                      <option value="Psychology & Sociology">Psychology</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#6b7280]">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Contact Row — MAH style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="email"
                    placeholder="Email *"
                    aria-label="Email (required)"
                    aria-invalid={!!contactErrors.email}
                    aria-required="true"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (contactErrors.email) setContactErrors(p => ({ ...p, email: undefined })); }}
                    className={`am-input ${contactErrors.email ? 'border-red-500!' : ''}`}
                  />
                  {contactErrors.email && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{contactErrors.email}</p>}
                </div>

                <div>
                  <div className={`flex rounded-[6px] overflow-hidden border ${contactErrors.phone ? 'border-red-500' : 'border-[#d1d5db]'} bg-white focus-within:border-[#eb6200] focus-within:shadow-[0_0_0_3px_rgba(235,98,0,0.10)] transition-all`}>
                    <select
                      value={countryCode}
                      onChange={(e) => { setCountryCode(e.target.value); setCurrency(currencyForDial(e.target.value)); }}
                      className="bg-transparent px-2 py-[10px] text-sm font-medium text-[#374151] outline-none border-r border-[#d1d5db] cursor-pointer"
                    >
                      <optgroup label="Popular">
                        {POPULAR_DIAL_CODES.map(c => <option key={`p-${c[0]}`} value={dialLabel(c)} title={countryName(c[0])}>{dialLabel(c)}</option>)}
                      </optgroup>
                      <optgroup label="All countries">
                        {DIAL_CODES.filter(c => !POPULAR_DIAL_CODES.some(p => p[0] === c[0])).map(c => <option key={c[0]} value={dialLabel(c)} title={countryName(c[0])}>{dialLabel(c)}</option>)}
                      </optgroup>
                    </select>
                    <input
                      type="tel"
                      inputMode="tel"
                      placeholder="Phone no. *"
                      aria-label="Phone number (required)"
                      aria-invalid={!!contactErrors.phone}
                      aria-required="true"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s()+-]/g, '')); if (contactErrors.phone) setContactErrors(p => ({ ...p, phone: undefined })); }}
                      className="w-full px-3 py-[10px] bg-transparent text-[#374151] placeholder:text-[#9ca3af] outline-none text-sm font-normal"
                    />
                  </div>
                  {contactErrors.phone && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{contactErrors.phone}</p>}
                </div>
              </div>

              {/* 6. Words Stepper Row */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="calc-words" className="text-xs font-black text-[#000a1e] uppercase tracking-wide">
                    LENGTH (WORDS)
                  </label>
                  <select
                    aria-label="Spacing"
                    value={spacing}
                    onChange={(e) => setSpacing(e.target.value as Spacing)}
                    className="text-sm text-[#708ab5] font-semibold bg-transparent outline-none cursor-pointer text-right"
                  >
                    {SPACING_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label} · {o.wordsPerPage} words/page</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-[16px]">
                  <div className="flex items-center bg-white rounded-full overflow-hidden h-[42px] shadow-[0_2px_8px_rgb(0,0,0,0.03)] flex-shrink-0 w-[116px]">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      aria-label="Decrease words"
                      className="text-[#44474e] hover:bg-gray-50 font-medium w-10 h-full flex items-center justify-center transition-colors border-r border-gray-100 cursor-pointer"
                    >
                      <Minus className="w-4 h-4 stroke-[2]" />
                    </button>
                    <input
                      id="calc-words"
                      type="number"
                      min="0"
                      max="200000"
                      step={WORD_STEP}
                      value={words}
                      onChange={handleWordChange}
                      className="w-full h-full text-center border-none bg-transparent text-[17px] font-black text-[#000a1e] focus:ring-0 p-0 m-0 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleIncrement}
                      aria-label="Increase words"
                      className="bg-[#000a1e] text-white hover:bg-[#002147] font-medium w-12 h-full flex items-center justify-center transition-colors shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col text-sm text-[#44474e] leading-tight">
                    <span className="font-semibold text-gray-500">
                      Total Pages: <strong className="text-[#000a1e] ml-1 font-black">{pages}</strong>
                    </span>
                    <span className="font-semibold text-gray-500 mt-0.5">
                      Delivery: <strong className="text-[#000a1e] ml-1 font-black" data-testid="calc-delivery">{words > 0 && shownQuote ? shownQuote.deliveryLabel : '—'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* 7. Deadline Date & Time Row (From Pic 1) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#000a1e] mb-1.5 uppercase tracking-wide">
                    DEADLINE DATE
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full border-0 rounded-full px-3.5 py-[11px] bg-gray-50 text-[#000a1e] focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[15px] font-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#708ab5]">
                      <Calendar className="w-4 h-4 stroke-[1.5]" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#000a1e] mb-1.5 uppercase tracking-wide">
                    DEADLINE TIME
                  </label>
                  <div className="relative">
                    <select
                      value={deadlineTime}
                      onChange={(e) => setDeadlineTime(e.target.value)}
                      className="w-full appearance-none border-0 rounded-full px-3.5 py-[11px] text-[#000a1e] bg-gray-50 focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[15px] font-bold shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] cursor-pointer"
                    >
                      <option value="10:00 PM">10:00 PM</option>
                      <option value="11:59 PM (Midnight)">11:59 PM (Midnight)</option>
                      <option value="09:00 AM (Morning)">09:00 AM (Morning)</option>
                      <option value="05:00 PM (Evening)">05:00 PM (Evening)</option>
                      <option value="Urgent / ASAP">Urgent / ASAP</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-500">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Coupon code */}
              <div>
                <label htmlFor="calc-coupon" className="block text-xs font-black text-[#000a1e] mb-1.5 uppercase tracking-wide">
                  COUPON CODE
                </label>
                <div className="flex gap-2">
                  <input
                    id="calc-coupon"
                    type="text"
                    value={couponInput}
                    maxLength={40}
                    disabled={!!coupon}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); if (couponMsg) setCouponMsg(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                    placeholder="Enter coupon code"
                    className="flex-1 min-w-0 border-0 rounded-full px-3.5 py-[11px] bg-gray-50 text-[#000a1e] placeholder:text-[#9ca3af] placeholder:font-medium focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[15px] font-bold uppercase tracking-wider shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] disabled:opacity-70"
                  />
                  {coupon ? (
                    <button type="button" onClick={removeCoupon}
                      className="shrink-0 rounded-full px-5 text-[14px] font-bold text-[#374151] bg-white border border-[#d1d5db] hover:bg-gray-50 transition-colors cursor-pointer">
                      Remove
                    </button>
                  ) : (
                    <button type="button" onClick={applyCoupon} disabled={couponBusy || !couponInput.trim()}
                      className="shrink-0 rounded-full px-5 text-[14px] font-bold text-white bg-[#eb6200] hover:bg-[#c85600] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      {couponBusy ? 'Checking…' : 'Apply'}
                    </button>
                  )}
                </div>
                {couponMsg && (
                  <p role={couponMsg.ok ? 'status' : 'alert'} className={`mt-1.5 text-[13px] font-semibold ${couponMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                    {couponMsg.text}
                  </p>
                )}
              </div>

              {/* 8. Course Code & Description / Attach File (From Pic 1) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-[#000a1e] uppercase tracking-wide">
                    DETAILS & ATTACHMENT
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDetailsSection(!showDetailsSection)}
                    className="text-[13px] font-bold text-[#e36100] hover:underline cursor-pointer"
                  >
                    {showDetailsSection ? '− Hide Details' : '+ Subject Code & File Attach'}
                  </button>
                </div>

                {showDetailsSection ? (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-2.5">
                    <input
                      type="text"
                      placeholder="Subject / Course Code (e.g. CS-101, MBA-500)"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-[13px] text-[#000a1e] outline-none focus:border-[#fea520]"
                    />

                    <textarea
                      placeholder="Description (Write instructions or attach rubric file)..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg p-2.5 bg-white text-[13px] text-[#000a1e] outline-none focus:border-[#fea520] resize-none"
                    />

                    <div className="flex items-center justify-between">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.rtf,.zip,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAttachedFileName(e.target.files[0].name);
                            setAttachedFile(e.target.files[0]);
                          }
                          e.target.value = '';
                        }}
                      />
                      {attachedFileName ? (
                        <div className="flex items-center gap-1.5 bg-[#f5f5f7] text-[#1d1d1f] text-[13px] px-2.5 py-1 rounded-full border border-[#e5e5ea]">
                          <Paperclip className="w-3 h-3" />
                          <span className="max-w-[170px] truncate font-medium">{attachedFileName}</span>
                          <button
                            type="button"
                            onClick={() => { setAttachedFileName(null); setAttachedFile(null); }}
                            className="hover:text-red-500 ml-1 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#374151] bg-white border border-[#d1d5db] hover:bg-[#f4f7fc] px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-[#fea520]" />
                          <span>Attach file</span>
                        </button>
                      )}
                      <span className="text-xs text-gray-400">PDF, DOC, XLSX, TXT, ZIP (Max 50MB)</span>
                    </div>
                  </div>
                ) : attachedFileName ? (
                  <div className="flex items-center justify-between bg-[#f5f5f7] text-[#1d1d1f] text-[13px] px-3 py-1.5 rounded-lg border border-[#e5e5ea]">
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      <Paperclip className="w-3.5 h-3.5" /> {attachedFileName}
                    </span>
                    <button type="button" onClick={() => { setAttachedFileName(null); setAttachedFile(null); }} className="text-gray-500 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>

              {/* 9. T&C Checkbox (From Pic 1) */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  type="checkbox"
                  id="calc-terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 rounded text-[#eb6200] focus:ring-[#eb6200] accent-[#eb6200] cursor-pointer"
                />
                <label htmlFor="calc-terms" className="text-[13px] text-gray-600 font-medium cursor-pointer select-none">
                  I accept the T&C, agree to receive offers & updates
                </label>
              </div>

              {/* 10. Price Output, Currency Toggle & CTA */}
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-4">
                {/* Currency Switcher */}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-[#000a1e] uppercase tracking-wide">ESTIMATED COST</span>
                  <div className="flex items-center gap-1 bg-gray-100/70 p-0.5 rounded-full text-[13px] font-bold text-gray-600">
                    {currencyOptions.map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        title={curr}
                        onClick={() => setCurrency(curr)}
                        className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${currency === curr ? 'bg-[#eb6200] text-white shadow-sm' : 'hover:text-[#eb6200]'}`}
                      >
                        {currencySymbolOf(curr)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    {calculatedPrice > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-gray-400 line-through font-semibold">{currencySymbol}{originalCatalogPrice}</span>
                        <span className="text-xs font-extrabold bg-[#fea520]/20 text-[#c85600] px-2 py-0.5 rounded-full">
                          Save 51%
                        </span>
                      </div>
                    )}
                    {coupon && calculatedPrice > 0 && (
                      <span className="text-xs font-bold text-emerald-700">Coupon {coupon.code}: −{coupon.percent}% applied</span>
                    )}
                    {quoteError && words > 0 && !quote ? (
                      <span role="alert" className="text-xs font-semibold text-red-600">{quoteError}</span>
                    ) : (
                    <span className="text-sm font-medium text-[#708ab5] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1d1d1f] stroke-[2.5]" /> Free Plagiarism Check Included
                    </span>
                    )}
                  </div>
                  <div className="flex items-start text-[#1a1a2e]">
                    <span className="text-[24px] font-black mt-1 mr-1">{currencySymbol}</span>
                    <span className="text-[46px] font-black tracking-tighter leading-none">
                      {animatedPrice}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-[#000a1e] hover:bg-[#00173d] text-white font-bold text-[17px] px-6 py-3.5 rounded-full transition-all w-full flex items-center justify-center gap-2.5 group cursor-pointer shadow-md hover:shadow-lg"
                >
                  <span>Get Detailed Quote</span>
                  <ArrowRight className="w-[18px] h-[18px] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
};

