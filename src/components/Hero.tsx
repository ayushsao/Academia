import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AcademiaLogo } from './AcademiaLogo';
import {
  ArrowRight, PlayCircle, Calculator, Minus, Plus, Calendar, ChevronDown, CheckCircle2, FileSearch, PenTool, CheckSquare, Crown, Paperclip, ShieldCheck, Clock, X, GraduationCap, Award, Zap, Star, BookOpen, Users, Check
} from 'lucide-react';
import { ServiceType, SubjectType } from '../types';
import { useOrderQuote, fetchOrderQuote, CURRENCY_BY_SYMBOL, type OrderQuote } from '../lib/orderQuote';

interface HeroProps {
  onOpenOrder: (prefill?: {
    quote?: OrderQuote;
    service?: ServiceType;
    subject?: SubjectType;
    pages?: number;
    deadline?: string;
    academicLevel?: 'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional';
    topicTitle?: string;
    instructions?: string;
    files?: string[];
    fileObjects?: File[];
  }) => void;
  onScrollToTimeline: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenOrder, onScrollToTimeline }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<'Writing' | 'Technical' | 'Online Class'>('Writing');
  const [academicLevel, setAcademicLevel] = useState<'Undergraduate' | 'Master\'s' | 'PhD / Doctoral'>('Undergraduate');
  const [service, setService] = useState<ServiceType | ''>('Academic Writing');
  const [subject, setSubject] = useState<SubjectType | ''>('');
  const [pages, setPages] = useState<number>(0);
  const [deadlineTime, setDeadlineTime] = useState<string>('10:00 PM');
  const [email, setEmail] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('IN(+91)');
  const [phone, setPhone] = useState<string>('');
  const [courseCode, setCourseCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);
  const [currency, setCurrency] = useState<'£' | '$' | '€' | 'A$'>('£');
  const [showDetailsSection, setShowDetailsSection] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const [deadline, setDeadline] = useState<string>(getNextWeek());
  const [animatedPrice, setAnimatedPrice] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);


  const WORDS_PER_PAGE = 250;

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
  const quoteInput = { service: orderService, pages, academicLevel, currency: CURRENCY_BY_SYMBOL[currency] };
  const { quote, lastQuote, ensure, error: quoteError } = useOrderQuote(quoteInput, { enabled: pages > 0 });
  const shownQuote = quote || lastQuote;

  const calculatedPrice = pages === 0 ? 0 : shownQuote?.total ?? 0;
  const originalCatalogPrice = Math.round(calculatedPrice * 2.04);

  useEffect(() => {
    // Number roll animation
    const duration = 250;
    const startVal = animatedPrice;
    const endVal = calculatedPrice;
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
  }, [calculatedPrice]);

  const handleIncrement = () => {
    setPages((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setPages((prev) => (prev > 0 ? prev - 1 : 0));
  };

  const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 0) {
      setPages(0);
    } else {
      setPages(Math.min(val, 500));
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    // Hand the order form the exact quote shown here (fetched now if the inputs just changed).
    let finalQuote: OrderQuote | undefined;
    try {
      finalQuote = pages === 0 ? await fetchOrderQuote({ ...quoteInput, pages: 1 }) : await ensure();
    } catch { finalQuote = undefined; /* the order form will quote again */ }
    onOpenOrder({
      quote: finalQuote,
      service: orderService,
      subject: (subject as SubjectType) || 'Business & Mgt',
      pages: pages === 0 ? 1 : pages,
      deadline: `${deadline} (${deadlineTime})`,
      academicLevel,
      topicTitle: courseCode ? `[${courseCode}]` : undefined,
      instructions: description || (email ? `Contact: ${email} | Phone: ${countryCode} ${phone}` : undefined),
      files: attachedFileName ? [attachedFileName] : undefined,
      fileObjects: attachedFile ? [attachedFile] : undefined,
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
    <section className="relative pt-12 md:pt-16 pb-24 overflow-hidden bg-white">
      {/* Faint Background Letters matching screenshot */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] text-[180px] font-black leading-none overflow-hidden flex flex-col justify-between whitespace-nowrap text-[#fea520]">
        <div className="flex justify-between w-full"><span>FINANCIAL</span><span>MATHS</span></div>
        <div className="flex justify-between w-full"><span>ACCOUNTING</span><span>MEDICAL</span></div>
        <div className="flex justify-between w-full"><span>ASSIGNMENT</span><span>HISTORY</span></div>
      </div>

      <div className="max-w-[1280px] 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 relative z-10 flex flex-col lg:flex-row items-stretch justify-between gap-6 lg:gap-8 2xl:gap-10">

        {/* LEFT: Dynamic Carousel Container */}
        <div className="flex-1 w-full min-w-0 relative overflow-hidden rounded-[26px] shadow-[0_10px_35px_rgba(213,56,103,0.07)] bg-white min-h-[560px] lg:min-h-[560px]">
          <AnimatePresence mode="wait">
            {/* SLIDE 0: Path to Academic Excellence */}
            {currentSlide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 bg-gradient-to-br from-[#fffbfa] via-[#fff5f6] to-[#feeef1] p-5 sm:p-6 md:p-7 w-full h-full border border-white flex flex-col justify-between overflow-y-auto"
              >
                {/* 1. Top Bar & Live Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-pink-100/70 shrink-0">
                  <div className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#002147]/5 text-[#002147] text-xs sm:text-[13px] font-bold whitespace-nowrap">
                    <Award className="w-3.5 h-3.5 shrink-0 text-[#b86e00]" />
                    <span className="sm:hidden">UK's #1 Academic Network</span>
                    <span className="hidden sm:inline truncate">UK's #1 Ranked Academic Consultation Network</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold whitespace-nowrap text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>84 Ph.D. Mentors Active</span>
                  </div>
                </div>

                {/* 2. Main Headline & Subtitle */}
                <div className="my-1 shrink-0">
                  <h1 className="text-xl sm:text-2xl md:text-[27px] lg:text-[29px] font-black text-[#111827] leading-[1.2] tracking-tight">
                    Your Path to <span className="bg-gradient-to-r from-[#ea580c] via-[#fea520] to-[#e11d48] bg-clip-text text-transparent">Academic Excellence</span> Starts from Here
                  </h1>
                  <p className="text-[13px] sm:text-[15px] text-gray-600 font-medium mt-1 leading-snug">
                    Bespoke dissertations, essays, research coursework & data modeling tailored to UK university grading rubrics by verified Oxford & Russell Group scholars.
                  </p>
                </div>

                {/* 3. Core Visual Showcase + 3 High-Impact Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch my-1 shrink-0">
                  {/* Scholar Portrait Card (5 cols) */}
                  <div className="sm:col-span-5 relative group">
                    <div className="relative w-full h-[180px] sm:h-full min-h-[175px] rounded-2xl overflow-hidden border-3 border-white shadow-md bg-slate-100">
                      <img
                        src="https://images.pexels.com/photos/1462630/pexels-photo-1462630.jpeg?auto=compress&cs=tinysrgb&w=800"
                        alt="UK Academic Scholar"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-full shadow-xs border border-emerald-100 flex items-center gap-1 text-xs font-bold text-emerald-700">
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
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2.5 border border-pink-100 shadow-xs flex items-center gap-2.5 hover:border-amber-300 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] sm:text-[15px] font-bold text-gray-900">Guaranteed A+ Standard</span>
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">Top 5% Ph.D.</span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Strict adherence to UK university grading rubrics & marking criteria.</p>
                      </div>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2.5 border border-pink-100 shadow-xs flex items-center gap-2.5 hover:border-emerald-300 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] sm:text-[15px] font-bold text-gray-900">Turnitin Authenticity</span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Custom-written from scratch with official plagiarism certificate.</p>
                      </div>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2.5 border border-pink-100 shadow-xs flex items-center gap-2.5 hover:border-blue-300 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] sm:text-[15px] font-bold text-gray-900">Urgent 3-Hour Delivery</span>
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">24/7 Live</span>
                        </div>
                        <p className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Direct scholar assignment with guaranteed on-time delivery.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Popular Subject Disciplines Chips */}
                <div className="bg-white/75 backdrop-blur-sm rounded-xl p-2 border border-pink-100/80 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] font-bold text-gray-700 uppercase tracking-wider">Specialized Disciplines</span>
                    <span className="text-xs font-semibold text-pink-600">85+ Subjects Covered</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Business & Mgt', 'Law & OSCOLA', 'Nursing & Health', 'Computer Science & AI', 'Finance & SPSS', 'Engineering'].map((sub, i) => (
                      <span key={i} className="text-[11.5px] sm:text-[12.5px] font-semibold px-2 py-0.5 rounded-md bg-white border border-pink-100 text-gray-700 shadow-2xs">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 5. Russell Group Institutional Trust Strip */}
                <div className="grid grid-cols-4 gap-1.5 py-1.5 px-2 bg-white/85 backdrop-blur-sm rounded-xl border border-pink-100 text-center shadow-xs shrink-0">
                  <div>
                    <div className="text-[13px] font-black text-gray-900">25,000+</div>
                    <div className="text-[11px] text-gray-500 font-medium">Papers Delivered</div>
                  </div>
                  <div className="border-x border-pink-100">
                    <div className="text-[13px] font-black text-gray-900">1,200+</div>
                    <div className="text-[11px] text-gray-500 font-medium">Ph.D. Writers</div>
                  </div>
                  <div className="border-r border-pink-100">
                    <div className="text-[13px] font-black text-emerald-600">0.0%</div>
                    <div className="text-[11px] text-gray-500 font-medium">Plagiarism</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-black text-amber-600">4.9 / 5.0</div>
                    <div className="text-[11px] text-gray-500 font-medium">18k+ Reviews</div>
                  </div>
                </div>

                {/* 6. Verified Student Social Proof Testimonial */}
                <div className="bg-gradient-to-r from-amber-500/10 via-pink-500/5 to-rose-500/10 rounded-xl p-2 border border-amber-200/60 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      S
                    </div>
                    <p className="text-[12.5px] text-gray-700 font-medium truncate">
                      <strong className="text-gray-900 font-bold">"Scored 78% Distinction in UCL Master's Thesis!</strong> Flawless research and methodology."
                    </p>
                  </div>
                  <span className="text-[11.5px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                    ★★★★★ Verified Student
                  </span>
                </div>

                {/* 7. Bottom Luxury A+ Distinction Banner */}
                <div className="relative z-20 shrink-0">
                  <div className="bg-gradient-to-r from-[#fea520] via-[#f59e0b] to-[#ea580c] text-white p-2.5 sm:p-3 rounded-xl shadow-md border-2 border-white flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
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
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        currentSlide === idx
                          ? 'bg-[#fea520] text-white shadow-xs scale-105'
                          : 'bg-white/80 hover:bg-white text-gray-600 border border-gray-200'
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
                className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] p-5 sm:p-6 md:p-7 w-full h-full border border-gray-100 flex flex-col justify-between overflow-y-auto"
              >
                {/* 1. Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80 shrink-0">
                  <div className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fea520]/10 text-[#d87500] text-xs sm:text-[13px] font-bold whitespace-nowrap">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden">Originality Check Active</span>
                    <span className="hidden sm:inline truncate">Turnitin Originality Check Active</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold whitespace-nowrap text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Turnitin Scanner Online</span>
                  </div>
                </div>

                {/* 2. Main Headline */}
                <div className="text-center my-1 shrink-0">
                  <h1 className="text-xl sm:text-2xl md:text-[27px] lg:text-[29px] font-black text-[#0f172a] leading-[1.2] tracking-tight">
                    Guaranteed <strong className="text-[#fea520] font-black">Original</strong> Work, with <strong className="font-black text-[#000a1e]">Free Turnitin</strong> Report
                  </h1>
                  <p className="text-[13px] sm:text-[15px] text-gray-500 mt-1 max-w-[92%] mx-auto">
                    Authenticity verified with an official Turnitin Originality report. Every paper is custom-crafted from scratch by verified subject scholars.
                  </p>
                </div>

                {/* 3. Center Dual Showcase */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch my-1 shrink-0">
                  {/* Left Certificate Preview Card (5 cols) */}
                  <div className="sm:col-span-5 relative group">
                    <div className="w-full h-[180px] sm:h-full min-h-[175px] rounded-2xl overflow-hidden border-3 border-white shadow-md bg-slate-200 relative">
                      <img
                        src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800"
                        alt="UK Students Collaborating"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full px-2 py-0.5 text-xs font-bold shadow-sm flex items-center gap-1 border border-white">
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
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <PenTool className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] sm:text-[15px] font-bold text-gray-900 leading-tight">Written From Scratch</div>
                        <div className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Written from scratch by real subject scholars with genuine critical evaluation.</div>
                      </div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-black text-[13px]">
                        100%
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] sm:text-[15px] font-bold text-gray-900 leading-tight">Free Turnitin Similarity Report</div>
                        <div className="text-xs sm:text-[13px] text-gray-500 leading-tight mt-0.5">Official full similarity breakdown PDF delivered free with every consultation.</div>
                      </div>
                    </div>

                    <div className="bg-white/95 rounded-xl p-2.5 border border-slate-200 shadow-xs flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
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
                    <span className="text-xs font-semibold text-blue-600">Full In-Text & Bibliography</span>
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
                    <div className="text-[13px] font-black text-blue-600">&lt; 3%</div>
                    <div className="text-[11px] text-gray-500 font-medium">Similarity Index</div>
                  </div>
                  <div className="border-r border-slate-200">
                    <div className="text-[13px] font-black text-amber-600">20+</div>
                    <div className="text-[11px] text-gray-500 font-medium">Peer Sources</div>
                  </div>
                  <div>
                    <div className="text-[13px] font-black text-indigo-600">100%</div>
                    <div className="text-[11px] text-gray-500 font-medium">Confidential</div>
                  </div>
                </div>

                {/* 6. Social Proof */}
                <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/5 to-teal-500/10 rounded-xl p-2 border border-blue-200/60 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      L
                    </div>
                    <p className="text-[12.5px] text-gray-700 font-medium truncate">
                      <strong className="text-gray-900 font-bold">"Turnitin scan came back 1% similarity!</strong> Tutor commended the critical arguments."
                    </p>
                  </div>
                  <span className="text-[11.5px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
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
                    className="text-[13px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer whitespace-nowrap"
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
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        currentSlide === idx
                          ? 'bg-[#fea520] text-white shadow-xs scale-105'
                          : 'bg-white/80 hover:bg-white text-gray-600 border border-gray-200'
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
                className="absolute inset-0 bg-gradient-to-br from-[#7c1134] via-[#991740] to-[#b01c4a] p-5 sm:p-6 md:p-7 w-full h-full flex flex-col justify-between text-white overflow-y-auto"
              >
                {/* 1. Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/20 shrink-0">
                  <div className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-xs sm:text-[13px] font-bold whitespace-nowrap">
                    <Crown className="w-3.5 h-3.5 shrink-0 text-[#ffcb05]" />
                    <span className="sm:hidden">UK's Highest-Rated Network</span>
                    <span className="hidden sm:inline truncate">UK's Highest-Rated Student Consultation Network</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold whitespace-nowrap text-emerald-300 bg-black/25 px-2 py-0.5 rounded-full border border-emerald-400/30 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>1,200+ Ph.D. Writers Available</span>
                  </div>
                </div>

                {/* 2. Main Headline */}
                <div className="my-1 shrink-0">
                  <h1 className="text-xl sm:text-2xl md:text-[27px] lg:text-[29px] font-black leading-[1.2] tracking-tight">
                    Best Assignment Help in <span className="text-[#ffcb05] font-black underline decoration-wavy">UK</span> for Students
                  </h1>
                  <p className="text-[13px] sm:text-[15px] text-white/90 font-medium mt-1">
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
                    <div className="flex text-[#ffcb05] text-[15px]">★★★★★</div>
                    <div>
                      <div className="text-[13px] font-bold text-white">4.95/5 Rating</div>
                      <div className="text-[11.5px] text-white/80">Over 100,000+ UK student assignments completed</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenOrder()}
                    className="bg-white text-[#9f1239] hover:bg-[#ffcb05] hover:text-[#9f1239] font-bold text-[13px] sm:text-[15px] px-5 py-2 rounded-full flex items-center gap-2 shadow-lg transition-all cursor-pointer"
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
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        currentSlide === idx
                          ? 'bg-[#ffcb05] text-[#9f1239] shadow-xs scale-105'
                          : 'bg-white/20 hover:bg-white/30 text-white border border-white/20'
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

        {/* Right Form Column (Cost Calculator) */}
        <div className="w-full lg:w-[480px] xl:w-[500px] shrink-0 relative z-10 flex justify-center lg:justify-end">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] h-[115%] bg-gradient-radial from-[#dbe9ff]/70 to-transparent blur-[80px] -z-10 rounded-full pointer-events-none" />

          <div
            id="cost-calculator-card"
            className="bg-white rounded-[1.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.06)] p-5 sm:p-7 border border-white/80 w-full relative transition-shadow hover:shadow-lg overflow-hidden"
          >
            {/* 51% OFF Ribbon (From Pic 2) */}
            <div className="absolute top-5 -right-12 bg-[#fea520] text-white py-1 px-12 transform rotate-45 flex flex-col items-center justify-center shadow-md z-20 pointer-events-none">
              <span className="text-[11px] font-bold tracking-widest uppercase opacity-90 leading-none mb-0.5">Up to</span>
              <span className="text-[15px] font-black leading-none">51% OFF</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-start mb-3 pr-8">
              <div>
                <h2 className="text-[24px] sm:text-[26px] font-black text-[#000a1e] tracking-tight leading-none mb-1">Calculate Cost</h2>
                <p className="text-sm sm:text-[15px] font-medium text-[#708ab5]">Transparent institutional pricing</p>
              </div>
              <div className="w-[44px] h-[44px] rounded-2xl bg-[#e4efff] flex items-center justify-center text-[#002147] shadow-[inset_0_2px_4px_rgba(255,255,255,1)] shrink-0">
                <Calculator className="w-5 h-5 stroke-[1.5]" />
              </div>
            </div>

            {/* 1. Trust Guarantees Bar (From Pic 1) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-3 gap-y-1 text-xs 2xl:text-[13px] font-bold text-gray-700 bg-gray-50/90 rounded-xl px-3 py-2 border border-gray-100 mb-4">
              <span className="flex items-center gap-1.5 text-emerald-600 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Guaranteed Grade or Refund</span>
              </span>
              <span className="hidden sm:inline text-gray-300">•</span>
              <span className="flex items-center gap-1 text-[#000a1e] whitespace-nowrap">
                <ShieldCheck className="w-3.5 h-3.5 text-[#fea520]" />
                <span>100% Original</span>
              </span>
              <span className="hidden sm:inline text-gray-300">•</span>
              <span className="flex items-center gap-1 text-blue-600 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                <span>24/7 Support</span>
              </span>
            </div>

            <form onSubmit={handleSubmitQuote} className="space-y-4">
              {/* 2. Track Category Radio Pills (From Pic 1) */}
              <div>
                <div className="flex items-center justify-between gap-2 p-1 bg-gray-100/70 rounded-full border border-gray-200/60">
                  {(['Writing', 'Technical', 'Online Class'] as const).map((track) => {
                    const isSelected = selectedTrack === track;
                    return (
                      <button
                        key={track}
                        type="button"
                        onClick={() => handleTrackChange(track)}
                        className={`flex-1 py-1.5 px-2 rounded-full text-xs sm:text-[13px] font-bold whitespace-nowrap transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#000a1e] text-white shadow-sm'
                            : 'text-gray-600 hover:text-[#000a1e]'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#fea520] bg-[#fea520]' : 'border-gray-400 bg-white'}`}>
                          {isSelected && <span className="w-1 h-1 rounded-full bg-[#000a1e]" />}
                        </span>
                        <span>{track}</span>
                        <span title={getTrackTooltip(track)} className="hidden sm:inline opacity-60 text-xs">ⓘ</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Academic Level Segmented Controls */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-black text-[#000a1e] uppercase tracking-wider">
                    ACADEMIC LEVEL
                  </label>
                  <span className="text-xs text-gray-400 font-semibold">Tier Multiplier</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-100">
                  {[
                    { label: 'Undergrad', value: 'Undergraduate' },
                    { label: 'Master’s', value: "Master's" },
                    { label: 'PhD / Doc', value: 'PhD / Doctoral' }
                  ].map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setAcademicLevel(lvl.value as any)}
                      className={`py-1.5 text-[13px] font-bold rounded-lg transition-all cursor-pointer ${
                        academicLevel === lvl.value
                          ? 'bg-white text-[#000a1e] shadow-sm border border-gray-200/80 font-black'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Dropdowns Row: Service & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#000a1e] mb-1.5 uppercase tracking-wide">
                    SELECT SERVICE
                  </label>
                  <div className="relative">
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value as ServiceType)}
                      className="w-full appearance-none border-0 rounded-full px-3.5 py-[11px] text-[#333] bg-gray-50 hover:bg-gray-100/50 focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[15px] font-bold shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] cursor-pointer"
                    >
                      <option value="" disabled>Select a Service</option>
                      {getServicesForTrack().map((srv) => (
                        <option key={srv} value={srv}>{srv}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-500">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#000a1e] mb-1.5 uppercase tracking-wide">
                    SELECT SUBJECT
                  </label>
                  <div className="relative">
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as SubjectType)}
                      className="w-full appearance-none border-0 rounded-full px-3.5 py-[11px] text-[#333] bg-gray-50 hover:bg-gray-100/50 focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[15px] font-bold shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] cursor-pointer"
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
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-500">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Contact Row (Email & Phone with Country code - from Pic 1) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-[#000a1e] mb-1.5 uppercase tracking-wide">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border-0 rounded-full px-3.5 py-[11px] bg-gray-50 text-[#000a1e] placeholder:text-gray-400 focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[15px] font-medium shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-[#000a1e] mb-1.5 uppercase tracking-wide">
                    PHONE NO.
                  </label>
                  <div className="flex rounded-full overflow-hidden bg-gray-50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border-0 focus-within:ring-2 focus-within:ring-[#002147]/20">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-transparent px-2.5 py-[11px] text-sm font-bold text-gray-700 outline-none border-r border-gray-200 cursor-pointer"
                    >
                      <option value="IN(+91)">IN(+91)</option>
                      <option value="US(+1)">US(+1)</option>
                      <option value="UK(+44)">UK(+44)</option>
                      <option value="AU(+61)">AU(+61)</option>
                      <option value="CA(+1)">CA(+1)</option>
                      <option value="AE(+971)">AE(+971)</option>
                    </select>
                    <input
                      type="tel"
                      placeholder="Phone no."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-[11px] bg-transparent text-[#000a1e] placeholder:text-gray-400 outline-none text-[15px] font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Pages Stepper Row */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-black text-[#000a1e] uppercase tracking-wide">
                    LENGTH (PAGES)
                  </label>
                  <span className="text-sm text-[#708ab5] font-semibold">1 Page ≈ 250 Words</span>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-[16px]">
                  <div className="flex items-center bg-white rounded-full overflow-hidden h-[42px] shadow-[0_2px_8px_rgb(0,0,0,0.03)] flex-shrink-0 w-[116px]">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      aria-label="Decrease pages"
                      className="text-[#44474e] hover:bg-gray-50 font-medium w-10 h-full flex items-center justify-center transition-colors border-r border-gray-100 cursor-pointer"
                    >
                      <Minus className="w-4 h-4 stroke-[2]" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={pages}
                      onChange={handlePageChange}
                      className="w-full h-full text-center border-none bg-transparent text-[17px] font-black text-[#000a1e] focus:ring-0 p-0 m-0 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleIncrement}
                      aria-label="Increase pages"
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
                      Approx Words: <strong className="text-[#000a1e] ml-1 font-black">{pages * WORDS_PER_PAGE}</strong>
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
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-[13px] px-2.5 py-1 rounded-full border border-emerald-200">
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
                          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-[#fea520]" />
                          <span>Attach file</span>
                        </button>
                      )}
                      <span className="text-xs text-gray-400">PDF, DOC, XLSX, TXT, ZIP (Max 50MB)</span>
                    </div>
                  </div>
                ) : attachedFileName ? (
                  <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 text-[13px] px-3 py-1.5 rounded-lg border border-emerald-200">
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
                  className="w-4 h-4 rounded text-[#fea520] focus:ring-[#fea520] accent-[#000a1e] cursor-pointer"
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
                    {(['£', '$', '€', 'A$'] as const).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setCurrency(curr)}
                        className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${currency === curr ? 'bg-[#000a1e] text-white shadow-xs' : 'hover:text-[#000a1e]'}`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    {calculatedPrice > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] text-gray-400 line-through font-semibold">{currency}{originalCatalogPrice}</span>
                        <span className="text-xs font-extrabold bg-[#fea520]/20 text-[#c85600] px-2 py-0.5 rounded-full">
                          Save 51%
                        </span>
                      </div>
                    )}
                    {quoteError && pages > 0 && !quote ? (
                      <span role="alert" className="text-xs font-semibold text-red-600">{quoteError}</span>
                    ) : (
                    <span className="text-sm font-medium text-[#708ab5] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" /> Free Plagiarism Check Included
                    </span>
                    )}
                  </div>
                  <div className="flex items-start text-[#000a1e]">
                    <span className="text-[24px] font-black mt-1 mr-1">{currency}</span>
                    <span className="text-[46px] font-black tracking-tighter leading-none">
                      {animatedPrice}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-[#000a1e] hover:bg-[#00173d] text-white font-semibold text-[17px] px-6 py-3.5 rounded-full transition-all w-full flex items-center justify-center gap-2 group cursor-pointer shadow-md hover:shadow-lg"
                >
                  <span>Get Detailed Quote</span>
                  <ArrowRight className="w-[18px] h-[18px] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
