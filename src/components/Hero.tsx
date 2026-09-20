import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  PlayCircle,
  Calculator,
  Minus,
  Plus,
  Calendar,
  ChevronDown,
  CheckCircle2,
  FileSearch,
  PenTool,
  CheckSquare,
  Crown
} from 'lucide-react';
import { ServiceType, SubjectType } from '../types';

interface HeroProps {
  onOpenOrder: (prefill?: { service?: ServiceType; subject?: SubjectType; pages?: number; deadline?: string }) => void;
  onScrollToTimeline: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenOrder, onScrollToTimeline }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [service, setService] = useState<ServiceType | ''>('');
  const [subject, setSubject] = useState<SubjectType | ''>('');
  const [pages, setPages] = useState<number>(0);
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

  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const WORDS_PER_PAGE = 250;

  // Dynamic pricing calculation based on service type & pages
  const getBaseRate = (srv: ServiceType): number => {
    switch (srv) {
      case 'Academic Writing': return 15;
      case 'Dissertation & Thesis': return 22;
      case 'Editing & Proofreading': return 10;
      case 'Data Analysis & SPSS': return 25;
      case 'Literature Review': return 18;
      case 'Case Study Analysis': return 16;
      default: return 0;
    }
  };

  const calculatedPrice = pages * getBaseRate(service);

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

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenOrder({
      service: service as ServiceType || undefined,
      subject: subject as SubjectType || undefined,
      pages: pages === 0 ? 1 : pages,
      deadline
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
    <section ref={containerRef} className="relative pt-12 md:pt-16 pb-24 overflow-hidden bg-white">
      {/* Faint Background Letters matching screenshot */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] text-[180px] font-black leading-none overflow-hidden flex flex-col justify-between whitespace-nowrap text-[#fea520]">
        <div className="flex justify-between w-full"><span>FINANCIAL</span><span>MATHS</span></div>
        <div className="flex justify-between w-full"><span>ACCOUNTING</span><span>MEDICAL</span></div>
        <div className="flex justify-between w-full"><span>ASSIGNMENT</span><span>HISTORY</span></div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 relative z-10 flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-10">

        {/* LEFT: Dynamic Carousel Container */}
        <div className="flex-1 w-full min-h-[450px] lg:min-h-0 relative overflow-hidden rounded-[30px] shadow-[0_10px_40px_rgba(213,56,103,0.08)] bg-white">
          <AnimatePresence mode='wait'>

            {/* SLIDE 0: Path to Academic Excellence */}
            {currentSlide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 bg-gradient-to-br from-white via-[#fff1f4] to-[#ffe4e9] p-8 md:p-12 w-full h-full border border-white"
              >
                <h1 className="text-3xl md:text-[38px] lg:text-[42px] font-bold text-[#333] leading-[1.2] tracking-tight max-w-[85%] relative z-20">
                  Your Path to Academic Excellence <br /> Starts from Here
                </h1>

                {/* Dashboard/Image Area */}
                <div className="absolute bottom-0 left-0 w-full md:w-[65%] h-[280px] z-10 flex items-end">
                  <img
                    src="https://images.pexels.com/photos/1462630/pexels-photo-1462630.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="Student pointing"
                    className="w-full h-full object-cover object-top rounded-bl-[30px]"
                    style={{ maskImage: 'linear-gradient(to top, black 80%, transparent)', WebkitMaskImage: 'linear-gradient(to top, black 80%, transparent)' }}
                  />

                  {/* Play Button Over Image */}
                  <div
                    onClick={onScrollToTimeline}
                    className="absolute top-[40%] left-[25%] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform"
                  >
                    <div className="w-14 h-14 rounded-full border-2 border-white/60 bg-black/20 backdrop-blur-sm flex items-center justify-center">
                      <PlayCircle className="w-8 h-8 text-white ml-1 opacity-90" />
                    </div>
                  </div>
                </div>

                {/* Watch our video dash-line */}
                <div className="absolute top-[50%] left-[40%] hidden md:flex items-center gap-2 z-20">
                  <svg width="150" height="40" viewBox="0 0 150 40" fill="none" className="text-gray-400">
                    <path d="M0 35 Q75 -10 150 10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                  </svg>
                  <span className="text-[#666] text-sm font-medium whitespace-nowrap mt-2">Watch our video</span>
                </div>

                {/* Scored A+ Grades Floating Box */}
                <div className="absolute bottom-10 md:bottom-16 right-4 md:right-8 bg-[#fea520] text-white p-4 md:p-5 outline outline-4 outline-white shadow-xl z-30 transform hover:scale-105 transition-transform overflow-hidden min-w-[240px]">
                  <span className="text-lg md:text-xl font-medium tracking-wide">Scored A+ Grades with</span>
                  <div className="bg-white px-3 py-2 mt-2 inline-flex items-center gap-0 shadow-inner w-fit pr-4 group rounded-sm">
                    <div className="w-5 h-5 bg-[#fea520] text-white flex items-center justify-center text-[11px] font-black transform -rotate-12 italic z-10 transition-transform group-hover:rotate-0 shadow-sm">A</div>
                    <div className="flex flex-col z-0 -ml-px">
                      <span className="text-[#222] font-black text-sm uppercase tracking-tighter leading-none">ssignment<span className="text-[#fea520]">Minds</span></span>
                      <span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-[1px] pl-1">You Express, We Write</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SLIDE 1: Guaranteed NO-AI Work */}
            {currentSlide === 1 && (
              <motion.div
                key="slide-1"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 bg-[#fbfbfb] p-6 md:p-10 w-full h-full border border-gray-100 flex flex-col justify-between items-center"
              >
                <div className="text-center w-full z-20 shrink-0">
                  <h1 className="text-[28px] md:text-[36px] lg:text-[44px] font-medium text-[#333] leading-[1.1] tracking-tight max-w-[95%] mx-auto">
                    Guaranteed <strong className="text-[#fea520] font-black">NO-AI</strong> Work, with <strong className="font-black">Free<br />Plagiarism</strong> Report
                  </h1>
                </div>

                {/* Image and Badges Area */}
                <div className="relative flex-1 w-full flex items-center justify-center mt-4 mb-4">
                  {/* Radial Pink aura */}
                  <div className="absolute w-[300px] h-[300px] bg-[#fea520]/10 rounded-full blur-[40px] pointer-events-none"></div>
                  <div className="absolute w-[200px] h-[200px] bg-[#fea520]/15 rounded-full blur-[30px] pointer-events-none"></div>
                  <div className="absolute w-[280px] h-[280px] rounded-full border border-[#fea520]/30 pointer-events-none"></div>

                  <img
                    src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800"
                    alt="Student"
                    className="w-[200px] md:w-[260px] h-[260px] md:h-[300px] object-cover object-top relative z-10"
                    style={{ maskImage: 'linear-gradient(to top, transparent, black 15%)', WebkitMaskImage: 'linear-gradient(to top, transparent, black 15%)' }}
                  />

                  {/* Floating Badges */}
                  <div className="absolute top-[10%] right-[10%] md:right-[15%] w-[70px] h-[70px] md:w-[80px] md:h-[80px] bg-white rounded-full p-1 shadow-lg z-20 flex flex-col items-center justify-center border-4 border-[#0ebf92]/20">
                    <div className="w-full h-full bg-[#0ebf92] rounded-full flex flex-col items-center justify-center text-white leading-none">
                      <span className="text-[17px] md:text-xl font-bold">A+</span>
                      <span className="text-[6.5px] md:text-[7.5px] font-bold text-center">TOP<br />GRADES</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-[#1d8eff] rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-white" /></div>
                  </div>

                  <div className="absolute top-[35%] left-[5%] md:left-[10%] w-[75px] h-[75px] md:w-[85px] md:h-[85px] bg-white rounded-full p-1 shadow-lg z-20 flex flex-col items-center justify-center border-4 border-[#1ec908]/20">
                    <div className="w-full h-full border-2 border-[#1ec908] rounded-full flex flex-col items-center justify-center text-[#1ec908] leading-none text-center">
                      <span className="text-[11px] md:text-[12px] font-black">100%</span>
                      <span className="text-[6.5px] md:text-[7.5px] font-bold leading-tight mt-0.5">Plagiarism<br />Free Report</span>
                    </div>
                    <div className="absolute -bottom-1 right-2 bg-[#1d8eff] rounded-full p-0.5"><CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-white" /></div>
                  </div>

                  <div className="absolute bottom-[10%] right-[5%] md:right-[12%] w-[75px] h-[75px] md:w-[85px] md:h-[85px] bg-[#000a1e] rounded-full p-1 shadow-2xl z-20 flex items-center justify-center border-4 border-[#fea520]/30 transform hover:scale-110 transition-transform">
                    <div className="w-full h-full border-2 border-[#fea520] rounded-full flex flex-col items-center justify-center text-[#fea520] relative overflow-hidden shadow-[inset_0_0_15px_rgba(254,165,32,0.3)]">
                      <Crown className="w-7 h-7 md:w-8 md:h-8 text-[#fea520] mb-0.5" fill="currentColor" strokeWidth={1} />
                      <span className="text-[7px] md:text-[8px] font-black tracking-widest text-center leading-none">PREMIUM</span>
                    </div>
                  </div>
                </div>

                <div className="text-center font-bold text-[#555] text-[15px] md:text-[18px] relative z-20 shrink-0 pb-1">
                  Our writers can assist you with their Premium work
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
                className="absolute inset-0 bg-gradient-to-br from-[#c92458] to-[#991740] p-7 md:p-10 w-full h-full flex flex-col items-start justify-between text-white pb-10"
              >
                <div className="flex flex-col w-full h-full overflow-y-auto">
                  <h1 className="text-3xl md:text-[38px] lg:text-[42px] font-medium leading-[1.15] mb-2 tracking-tight">
                    Best Assignment Help in <strong className="font-black">UK</strong> for Students
                  </h1>
                  <p className="text-[16px] md:text-lg text-white/90 font-medium mb-6">
                    High-Quality Assistance by Top Assignment Helpers
                  </p>

                  <ul className="space-y-3 mb-6 flex-1">
                    <li className="flex items-center gap-3">
                      <FileSearch className="w-6 h-6 md:w-7 md:h-7 text-white/80 shrink-0" strokeWidth={1.5} />
                      <span className="text-[15px] md:text-[16px] leading-tight text-white/90"><strong className="text-white font-bold">0% Plagiarism</strong> Complete Authenticity</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <PenTool className="w-6 h-6 md:w-7 md:h-7 text-white/80 shrink-0" strokeWidth={1.5} />
                      <span className="text-[15px] md:text-[16px] leading-tight text-white/90"><strong className="text-white font-bold">Ph.D. Writers</strong> For Reliable Service</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckSquare className="w-6 h-6 md:w-7 md:h-7 text-white/80 shrink-0" strokeWidth={1.5} />
                      <span className="text-[15px] md:text-[16px] leading-tight text-white/90"><strong className="text-white font-bold">AI-Free</strong> Content</span>
                    </li>
                  </ul>

                  <button onClick={() => onOpenOrder()} className="bg-white/10 hover:bg-white/25 backdrop-blur-md border border-white/20 text-white font-semibold text-[15px] md:text-[16px] px-7 py-3 rounded-full flex items-center justify-center gap-2 transition-all w-fit group">
                    Order Now <ArrowRight className="w-[18px] h-[18px] group-hover:translate-x-1 transition-transform" />
                  </button>

                  <div className="flex flex-col gap-0.5 mt-auto pt-6 shrink-0 z-20 relative">
                    <p className="text-white text-[13px] md:text-[14px] font-medium">Our experts are happy to help you</p>
                    <div className="flex items-center gap-1.5 text-[#ffcb05] text-[16px]">
                      ★★★★★ <span className="text-white text-xs md:text-sm font-bold ml-1">5/5 &nbsp; 1Lac+ ratings</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Pagination Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-50">
            {[0, 1, 2].map((idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all rounded-full ${currentSlide === idx ? 'w-6 bg-[#fea520]' : 'w-2.5 bg-[#fea520]/50 hover:bg-[#fea520]/80'} h-2.5`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Right Form Column (Cost Calculator) */}
        <div className="lg:col-span-5 relative z-10 flex justify-center lg:justify-end">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] h-[115%] bg-gradient-radial from-[#dbe9ff]/70 to-transparent blur-[80px] -z-10 rounded-full pointer-events-none" />

          <div
            id="cost-calculator-card"
            className="bg-white rounded-[1.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.06)] p-6 sm:p-8 border border-white/80 w-full max-w-md relative transition-shadow hover:shadow-lg overflow-hidden"
          >
            {/* 51% OFF Ribbon (From Pic 2) */}
            <div className="absolute top-5 -right-12 bg-[#fea520] text-white py-1 px-12 transform rotate-45 flex flex-col items-center justify-center shadow-md">
              <span className="text-[9px] font-bold tracking-widest uppercase opacity-90 leading-none mb-0.5">Up to</span>
              <span className="text-sm font-black leading-none">51% OFF</span>
            </div>

            <div className="flex justify-between items-start mb-6 pr-8">
              <div>
                <h2 className="text-[26px] font-black text-[#000a1e] tracking-tight leading-none mb-1">Calculate Cost</h2>
                <p className="text-[13px] font-medium text-[#708ab5]">Transparent institutional pricing</p>
              </div>
              <div className="w-[46px] h-[46px] rounded-2xl bg-[#e4efff] flex items-center justify-center text-[#002147] shadow-[inset_0_2px_4px_rgba(255,255,255,1)]">
                <Calculator className="w-6 h-6 stroke-[1.5]" />
              </div>
            </div>

            <form onSubmit={handleSubmitQuote} className="space-y-5">
              {/* Dropdowns Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-[#000a1e] mb-2 uppercase tracking-wide">
                    SELECT SERVICE
                  </label>
                  <div className="relative">
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value as ServiceType)}
                      className={`w-full appearance-none border-0 rounded-full px-3.5 py-[14px] ${!service ? 'text-[#74777f]' : 'text-[#555]'} bg-gray-50 hover:bg-gray-100/50 focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[14px] font-bold shadow-[inset_0_2px_6px_rgba(0,0,0,0.01)] cursor-pointer`}
                    >
                      <option value="" disabled>Select a Service</option>
                      <option value="Academic Writing">Academic Writing</option>
                      <option value="Dissertation & Thesis">Dissertation</option>
                      <option value="Editing & Proofreading">Editing</option>
                      <option value="Data Analysis & SPSS">Data Analysis</option>
                      <option value="Literature Review">Literature Review</option>
                      <option value="Case Study Analysis">Case Study</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <ChevronDown className="w-[18px] h-[18px] stroke-[1.5]" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-[#000a1e] mb-2 uppercase tracking-wide">
                    SELECT SUBJECT
                  </label>
                  <div className="relative">
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as SubjectType)}
                      className={`w-full appearance-none border-0 rounded-full px-3.5 py-[14px] ${!subject ? 'text-[#74777f]' : 'text-[#555]'} bg-gray-50 hover:bg-gray-100/50 focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[14px] font-bold shadow-[inset_0_2px_6px_rgba(0,0,0,0.01)] cursor-pointer`}
                    >
                      <option value="" disabled>Select a Subject</option>
                      <option value="Business & Mgt">Business & Mgt</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Literature & Humanities">Literature</option>
                      <option value="Finance & Economics">Finance & Econ</option>
                      <option value="Law & Legal Studies">Law & Legal</option>
                      <option value="Medical & Healthcare">Medical Sciences</option>
                      <option value="Engineering & STEM">Engineering</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <ChevronDown className="w-[18px] h-[18px] stroke-[1.5]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pages Selector Row */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-black text-[#000a1e] uppercase tracking-wide">
                    LENGTH (PAGES)
                  </label>
                  <span className="text-[13px] text-[#708ab5] font-semibold">1 Page ≈ 250 Words</span>
                </div>
                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-[16px]">
                  <div className="flex items-center bg-white rounded-full overflow-hidden h-[46px] shadow-[0_2px_10px_rgb(0,0,0,0.03)] flex-shrink-0 w-[120px]">
                    <button
                      type="button"
                      onClick={() => setPages(p => Math.max(0, p - 1))}
                      aria-label="Decrease pages"
                      className="text-[#44474e] hover:bg-gray-50 font-medium w-10 h-full flex items-center justify-center transition-colors border-r border-gray-100"
                    >
                      <Minus className="w-[18px] h-[18px] stroke-[1.5]" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      value={pages}
                      onChange={(e) => setPages(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full h-full text-center border-none bg-transparent text-[16px] font-black text-[#000a1e] focus:ring-0 p-0 m-0 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setPages(p => p + 1)}
                      aria-label="Increase pages"
                      className="bg-[#000a1e] text-white hover:bg-[#002147] font-medium w-12 h-full flex items-center justify-center transition-colors shadow-sm"
                    >
                      <Plus className="w-[18px] h-[18px]" />
                    </button>
                  </div>

                  <div className="flex flex-col text-[13px] text-[#44474e]">
                    <span className="font-semibold text-gray-500">
                      Total Pages: <strong className="text-[#000a1e] ml-1 font-black">{pages}</strong>
                    </span>
                    <span className="font-semibold text-gray-500 mt-1">
                      Approx Words: <strong className="text-[#000a1e] ml-1 font-black">{pages * 250}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Deadline Row */}
              <div>
                <label className="block text-[11px] font-black text-[#000a1e] mb-2 uppercase tracking-wide">
                  DEADLINE
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full border-0 rounded-full px-3.5 py-[14px] bg-gray-50 text-[#000a1e] focus:ring-2 focus:ring-[#002147]/20 transition-all outline-none text-[15px] font-black shadow-[inset_0_2px_6px_rgba(0,0,0,0.01)]"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#708ab5]">
                    <Calendar className="w-5 h-5 stroke-[1.5]" />
                  </div>
                </div>
              </div>

              {/* Price Output & CTA */}
              <div className="pt-5 border-t border-gray-100 flex flex-col gap-5 mt-2">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-black text-[#000a1e] uppercase tracking-wide">ESTIMATED COST</span>
                    <span className="text-[13px] font-medium text-[#708ab5] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 stroke-[2.5]" /> Free Plagiarism Check Included
                    </span>
                  </div>
                  <div className="flex items-start text-[#000a1e]">
                    <span className="text-[28px] font-black mt-2 mr-1">£</span>
                    <span className="text-[52px] font-black tracking-tighter leading-none">
                      {animatedPrice}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-[#000a1e] hover:bg-[#00173d] text-white font-semibold text-[16px] px-6 py-3.5 rounded-full transition-all w-full flex items-center justify-center gap-2 group"
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
