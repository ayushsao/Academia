import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
  ShieldCheck,
  Lock,
  FileText,
  Award
} from 'lucide-react';
import { ServiceType, SubjectType } from '../types';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';

import { API, api } from '../lib/api';
import { formatMoney, fromMinor } from '../lib/money';
import type { CatalogOrderContext, PublicPricing, PublicQuote } from '../lib/catalogContent';
import { useOrderQuote, type OrderQuote } from '../lib/orderQuote';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opened from a catalogue page: priced from the admin's pricing rules. */
  catalog?: CatalogOrderContext | null;
  initialConfig?: {
    service?: ServiceType;
    subject?: SubjectType;
    pages?: number;
    deadline?: string;
    academicLevel?: 'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional';
    topicTitle?: string;
    instructions?: string;
    files?: string[];
    /** The quotation calculated on the previous step; shown as-is while its inputs are unchanged. */
    quote?: OrderQuote;
  };
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  initialConfig,
  catalog,
}) => {
  const getNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const [step, setStep] = useState<number>(1);
  const [service, setService] = useState<ServiceType | ''>(initialConfig?.service || '');
  const [subject, setSubject] = useState<SubjectType | ''>(initialConfig?.subject || '');
  const [pages, setPages] = useState<number>(initialConfig?.pages || 0);
  const [deadline, setDeadline] = useState<string>(initialConfig?.deadline || getNextWeek());
  const [academicLevel, setAcademicLevel] = useState<'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional'>(initialConfig?.academicLevel || 'Undergraduate');
  const [topicTitle, setTopicTitle] = useState<string>(initialConfig?.topicTitle || '');
  const [instructions, setInstructions] = useState<string>(initialConfig?.instructions || '');
  const [files, setFiles] = useState<string[]>(initialConfig?.files || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actualFileObjects, setActualFileObjects] = useState<File[]>([]);

  const [errors, setErrors] = useState<{ topicTitle?: string; instructions?: string; files?: string; pricing?: string }>({});

  // Add-ons (Start unselected to match base quote accurately)
  const [turnitinReport, setTurnitinReport] = useState<boolean>(true); // Free anyway
  const [topExpert, setTopExpert] = useState<boolean>(!!initialConfig?.quote?.input.topExpert);
  const [abstractPage, setAbstractPage] = useState<boolean>(!!initialConfig?.quote?.input.abstractPage);
  // Currency of the accepted quote (the home calculator lets customers pick one).
  const [quoteCurrency, setQuoteCurrency] = useState<string>(initialConfig?.quote?.currency || 'GBP');

  const [transactionId, setTransactionId] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('');

  const addOrder = useStore(state => state.addOrder);
  const user = useStore(state => state.user);
  const authToken = useStore(state => state.token);
  const logout = useStore(state => state.logout);
  const navigate = useNavigate();

  // Reset internal state to incoming initialConfig every time the modal OPENS
  React.useEffect(() => {
    if (isOpen) {
      setService(initialConfig?.service || '');
      setSubject(initialConfig?.subject || '');
      setPages(initialConfig?.pages || 0); // 0 pages by default if empty
      setDeadline(initialConfig?.deadline || getNextWeek());
      setAcademicLevel(initialConfig?.academicLevel || (initialConfig?.quote?.academicLevel as typeof academicLevel) || 'Undergraduate');
      setQuoteCurrency(initialConfig?.quote?.currency || 'GBP');
      setTopExpert(!!initialConfig?.quote?.input.topExpert);
      setAbstractPage(!!initialConfig?.quote?.input.abstractPage);
      setErrors({});
      if (initialConfig?.topicTitle) setTopicTitle(initialConfig.topicTitle);
      if (initialConfig?.instructions) setInstructions(initialConfig.instructions);
      if (initialConfig?.files && initialConfig.files.length > 0) setFiles(initialConfig.files);
      setStep(1);
    }
  }, [isOpen, initialConfig]);

  // Catalogue mode: the price comes from the admin's active pricing rule (API),
  // and the server re-prices the order on submit. Without an online price the
  // standard form is used.
  const [catState, setCatState] = useState<'off' | 'loading' | 'ready' | 'error'>('off');
  const [catPricing, setCatPricing] = useState<PublicPricing | null>(null);
  const [catCurrency, setCatCurrency] = useState('');
  const [catWords, setCatWords] = useState(0);
  const [catSpacing, setCatSpacing] = useState('');
  const [catQuote, setCatQuote] = useState<PublicQuote | null>(null);
  const [catQuoteError, setCatQuoteError] = useState('');
  const [catAttempt, setCatAttempt] = useState(0);
  const catIds = catalog ? { subjectId: catalog.subjectId, ...(catalog.serviceId && { serviceId: catalog.serviceId }), ...(catalog.projectId && { projectId: catalog.projectId }) } : null;
  const catKey = catIds ? new URLSearchParams(catIds).toString() : '';

  React.useEffect(() => {
    if (!isOpen || !catalog) { setCatState('off'); return; }
    let live = true;
    setCatState('loading'); setCatQuote(null); setCatQuoteError('');
    api<{ pricing: PublicPricing }>(`/catalog/pricing?${catKey}`)
      .then(({ pricing }) => {
        if (!live) return;
        if (!pricing.rates.length) { setCatState('off'); return; }
        const rate = pricing.rates.find(r => r.currency === catalog.currency) || pricing.rates[0];
        setCatPricing(pricing);
        setCatCurrency(rate.currency);
        setCatSpacing(catalog.spacing && pricing.spacingOptions.some(o => o.key === catalog.spacing) ? catalog.spacing : pricing.defaultSpacing);
        setCatWords(catalog.words && catalog.words > 0 ? catalog.words : rate.wordsPerPage);
        setCatState('ready');
      })
      .catch((e: any) => { if (live) setCatState(e?.status === 404 ? 'off' : 'error'); });
    return () => { live = false; };
  }, [isOpen, catKey, catAttempt]);

  React.useEffect(() => {
    if (catState !== 'ready' || !catIds || !(catWords > 0)) { setCatQuote(null); return; }
    let live = true;
    const t = setTimeout(() => {
      api<{ quote: PublicQuote }>('/catalog/quote', { method: 'POST', body: { ...catIds, words: catWords, spacing: catSpacing, currency: catCurrency } })
        .then(r => { if (live) { setCatQuote(r.quote); setCatQuoteError(''); } })
        .catch((e: any) => { if (live) { setCatQuote(null); setCatQuoteError(e?.message || 'Could not calculate a price.'); } });
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [catState, catKey, catWords, catSpacing, catCurrency]);

  // Standard orders: one server quote, reused from the previous step and only
  // re-quoted when the customer changes an input on this form.
  const catActive = !!catalog && catState !== 'off';
  const std = useOrderQuote(
    { service, pages, academicLevel, currency: quoteCurrency, topExpert, abstractPage },
    { enabled: isOpen && !catActive && pages >= 1, initial: initialConfig?.quote ?? null },
  );

  // Keep the floating chat button off the order form's buttons.
  React.useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('order-open');
    return () => document.body.classList.remove('order-open');
  }, [isOpen]);

  if (!isOpen) return null;

  const catMode = !!catalog && catState !== 'off';

  // The quote shown on this form: the current one, or the last one while a changed input is re-quoted.
  const stdQuote = std.quote;
  const shownStd = std.quote || (pages >= 1 ? std.lastQuote : null);
  const sym = shownStd?.symbol || '£';
  const grandTotal = shownStd?.total ?? 0;
  const addOnLabel = (key: string) => { const a = shownStd?.addOnOptions.find(o => o.key === key); return a ? `${sym} ${a.price}` : '…'; };
  // What the customer sees and pays (catalogue: the server quote in its own currency).
  const catTotal = catQuote ? fromMinor(catQuote.totalMinor, catQuote.currency) : 0;
  const totalLabel = catMode ? (catQuote ? formatMoney(catQuote.totalMinor, catQuote.currency) : '—') : `${sym} ${grandTotal}`;
  const showUpi = !catMode || catQuote?.currency === 'INR';
  const showPaypal = !catMode || (!!catQuote && catQuote.currency !== 'INR');
  const upiAmount = catMode ? catTotal : shownStd?.upi.amount ?? 0;
  const paypalAmount = catMode ? `${catTotal}${catQuote?.currency || ''}` : `${grandTotal}${shownStd?.currency || 'GBP'}`;
  // Ready to order only when the price shown is the quote for exactly these inputs.
  const quoteReady = catMode ? !!catQuote : !!stdQuote;
  const orderSubject = catMode ? catalog!.subjectName : subject;
  const orderService = catMode ? (catalog!.serviceName || catalog!.subjectName) : service;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const newFileNames = selectedFiles.map((f: File) => f.name);

      if (files.length + newFileNames.length > 5) {
        setErrors(prev => ({ ...prev, files: 'Maximum 5 files allowed.' }));
        return;
      }
      setErrors(prev => ({ ...prev, files: undefined }));
      setFiles(prev => [...prev, ...newFileNames]);
      setActualFileObjects(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setActualFileObjects(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const validateStep1 = () => {
    const newErrors: { topicTitle?: string; instructions?: string; files?: string; pricing?: string } = {};
    if (!catMode) {
      if (!service) newErrors.pricing = 'Please choose the type of paper.';
      else if (!subject) newErrors.pricing = 'Please choose a subject.';
      else if (pages < 1) newErrors.pricing = 'Enter at least 1 page.';
    }
    if (!topicTitle.trim()) {
      newErrors.topicTitle = 'Topic title is required';
    } else if (topicTitle.length < 5) {
      newErrors.topicTitle = 'Topic title must be at least 5 characters';
    }

    if (!instructions.trim()) {
      newErrors.instructions = 'Instructions are required';
    } else if (instructions.length < 10) {
      newErrors.instructions = 'Please provide more detailed instructions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (!quoteReady && (catMode || (service && subject && pages >= 1))) return;
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleCompleteOrder = async () => {
    if (!user) {
      alert("Please login first to place an order.");
      return;
    }

    if (!transactionId || transactionId.trim().length < 5) {
      alert("Please enter a valid Transaction ID / UTR Number to confirm your payment.");
      return;
    }

    // The order is placed at exactly the quoted price; never without a complete quote.
    if (!quoteReady || (!catMode && (!stdQuote || stdQuote.pages !== pages))) {
      alert('Please wait for the price to finish updating, then try again.');
      return;
    }

    setIsSubmitting(true);
    let uploadedFileNames: string[] = [];

    try {
      const token = authToken;

      // 1. Upload files first if any
      if (actualFileObjects.length > 0) {
        const formData = new FormData();
        actualFileObjects.forEach(f => formData.append('files', f));

        const uploadRes = await fetch(`${API}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }, // if upload needs auth
          body: formData
        });

        if (uploadRes.ok) {
          const uData = await uploadRes.json();
          uploadedFileNames = uData.files || [];
        }
      }

      // 2. Submit order to backend
      const payload = {
        service: orderService,
        subject: orderSubject,
        pages: catMode && catQuote ? catQuote.pages : stdQuote!.pages,
        deadline,
        topicTitle,
        instructions,
        academicLevel,
        files: uploadedFileNames,
        turnitinReport,
        topExpert: catMode ? false : topExpert,
        abstractPage: catMode ? false : abstractPage,
        totalAmount: catMode ? catTotal : stdQuote!.total, // display only: the server prices every order
        transactionId: transactionId.trim(),
        // The accepted quote: the server re-prices and refuses (409) if it no longer matches.
        ...(!catMode && stdQuote && { quote: { currency: stdQuote.currency, total: stdQuote.total, pages: stdQuote.pages } }),
        ...(catMode && catIds && catQuote && { catalog: { ...catIds, words: catWords, spacing: catSpacing, currency: catCurrency, quotedTotalMinor: catQuote.totalMinor } }),
      };

      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 401) {
          logout();
          alert("Session expired. Please log out and sign in again.");
          navigate('/');
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data.quote) {
          // Prices changed since the quote: show the new one and let the customer confirm again.
          if (catMode) setCatQuote(data.quote); else std.replace(data.quote);
          alert(data.error || 'The price has changed. Please review the new price and confirm again.');
          return;
        }
        throw new Error(data.error || 'Failed to place order');
      }

      const data = await res.json();
      setOrderNumber(data.order?.orderId || 'Order Placed');

      // Update local store as fallback display
      addOrder(data.order);

      setStep(3);

      // Send EmailJS Notification for the Order
      try {
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
            name: user.name,
            email: user.email,
            subject: `New Order Placed: ${data.order?.orderId}`,
            message: `User ${user.name} placed a new order for ${orderService} (${orderSubject}). Topic: ${topicTitle}. Total: ${totalLabel}\n\nTransaction ID (Payment Reference): ${transactionId}`
          },
          EmailJSConfig.publicKey as string
        );
      } catch (err) {
        console.error("Order EmailJS trigger failed", err);
      }
    } catch (e: any) {
      const errDetail = e instanceof Error ? e.message : JSON.stringify(e);
      alert(`[Debug Error] Failed to place order. Details: ${errDetail}. Please screenshot this and send it.`);
      console.error("Order completion failed:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    onClose();
    if (user) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#000a1e]/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-white/80 w-full max-w-3xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#000a1e] text-white p-6 sm:p-8 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002147] flex items-center justify-center text-[#fea520]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Start Your Order</h3>
              <p className="text-xs text-white/70">Get customized help with your assignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        {step < 3 && (
          <div className="bg-[#eef4ff] px-8 py-3.5 border-b border-[#d1e4ff] flex justify-between items-center text-xs font-semibold text-[#44474e]">
            <div className={`flex items-center gap-2 ${step === 1 ? 'text-[#000a1e] font-bold' : 'text-emerald-700'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-[#000a1e] text-white' : 'bg-emerald-600 text-white'}`}>
                {step > 1 ? '✓' : '1'}
              </span>
              <span>1. Order Details</span>
            </div>
            <div className="h-0.5 w-12 bg-[#d1e4ff]" />
            <div className={`flex items-center gap-2 ${step === 2 ? 'text-[#000a1e] font-bold' : 'text-[#74777f]'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-[#000a1e] text-white' : 'bg-[#d1e4ff] text-[#000a1e]'}`}>
                2
              </span>
              <span>2. Review & Payment</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {step === 1 && (
            <div className="space-y-6">
              {catMode ? (
                <div className="rounded-xl border border-[#d1e4ff] bg-[#eef4ff] p-4" data-testid="order-catalog-summary">
                  <span className="block text-xs font-bold text-[#44474e] uppercase">Your selection</span>
                  <p className="mt-1 text-sm font-bold text-[#000a1e]">{[catalog!.subjectName, catalog!.serviceName, catalog!.projectTitle].filter(Boolean).join(' › ')}</p>
                  {catState === 'loading' && <p className="mt-1 text-xs text-[#708ab5]">Loading pricing…</p>}
                  {catState === 'error' && (
                    <p role="alert" className="mt-1 text-xs font-semibold text-red-600">
                      Pricing couldn’t be loaded. <button type="button" onClick={() => setCatAttempt(a => a + 1)} className="underline">Try again</button>
                    </p>
                  )}
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Type of Paper</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value as ServiceType)}
                    className={`w-full bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-semibold ${!service ? 'text-[#74777f]' : 'text-[#000a1e]'}`}
                  >
                    <option value="" disabled>Select a Service</option>
                    {[
                      'Academic Writing', 'Dissertation & Thesis', 'Editing & Proofreading', 'Data Analysis & SPSS', 'Literature Review', 'Case Study Analysis',
                      'Essay Editing Service', 'MBA Essay Writing Service', 'Essay Help', 'Research Proposal Writing Service', 'Research Paper Writing',
                      'Ghost Writer', 'Programming Assignment Help', 'Assessment Help', 'Pay Someone To Do My Homework', 'Take My Online Class',
                      'Take My Online Exam', 'Dissertation Help', 'Term Paper Help', 'Homework Help', 'Coursework Help', 'Thesis Help',
                      'Powerpoint Presentation Services'
                    ].map(srv => <option key={srv} value={srv}>{srv}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as SubjectType)}
                    className={`w-full bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-semibold ${!subject ? 'text-[#74777f]' : 'text-[#000a1e]'}`}
                  >
                    <option value="" disabled>Select a Subject</option>
                    <option value="Business & Mgt">Business & Management</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Literature & Humanities">Literature & Humanities</option>
                    <option value="Finance & Economics">Finance & Economics</option>
                    <option value="Law & Legal Studies">Law & Legal Studies</option>
                    <option value="Medical & Healthcare">Medical & Healthcare</option>
                    <option value="Engineering & STEM">Engineering & STEM</option>
                  </select>
                </div>
              </div>
              )}
              {errors.pricing && <p role="alert" className="text-red-500 text-[10px] uppercase font-bold tracking-wider -mt-3">{errors.pricing}</p>}
              {!catMode && std.error && pages >= 1 && <p role="alert" className="text-red-500 text-[10px] uppercase font-bold tracking-wider -mt-3">{std.error}</p>}

              {catMode && catState === 'ready' && catPricing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {catPricing.spacingOptions.length > 1 && (
                    <div>
                      <label htmlFor="order-spacing" className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Spacing</label>
                      <select id="order-spacing" value={catSpacing} onChange={(e) => setCatSpacing(e.target.value)}
                        className="w-full bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-semibold text-[#000a1e]">
                        {catPricing.spacingOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </div>
                  )}
                  {catPricing.rates.length > 1 && (
                    <div>
                      <label htmlFor="order-currency" className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Currency</label>
                      <select id="order-currency" value={catCurrency} onChange={(e) => setCatCurrency(e.target.value)}
                        className="w-full bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-semibold text-[#000a1e]">
                        {catPricing.rates.map(r => <option key={r.currency} value={r.currency}>{r.currency}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">{catMode ? 'Length (Words)' : 'Length (Pages / Words)'}</label>
                  {catMode ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        aria-label="Word count"
                        value={catWords || ''}
                        disabled={catState !== 'ready'}
                        onChange={(e) => setCatWords(Math.max(0, Math.min(1000000, parseInt(e.target.value) || 0)))}
                        className="w-32 bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-bold text-[#000a1e]"
                      />
                      <span className="text-xs text-[#708ab5] font-semibold" data-testid="order-pages">
                        {catQuote ? `= ${catQuote.pages} ${catQuote.pages === 1 ? 'page' : 'pages'} × ${formatMoney(catQuote.unitPriceMinor, catQuote.currency)}` : catQuoteError || ' '}
                      </span>
                    </div>
                  ) : (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={pages}
                      onChange={(e) => setPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-bold text-[#000a1e]"
                    />
                    <span className="text-xs text-[#708ab5] font-semibold">{shownStd ? `≈ ${pages * shownStd.wordsPerPage} Words` : ''}</span>
                  </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-semibold text-[#000a1e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Topic</label>
                <input
                  type="text"
                  value={topicTitle}
                  onChange={(e) => { setTopicTitle(e.target.value); if (errors.topicTitle) setErrors(prev => ({ ...prev, topicTitle: undefined })) }}
                  placeholder="e.g. Critical Analysis of Monetary Policy"
                  className={`w-full bg-[#eef4ff] border ${errors.topicTitle ? 'border-red-500' : 'border-[#d1e4ff]'} rounded-xl p-3 text-sm font-semibold text-[#000a1e]`}
                />
                {errors.topicTitle && <p className="text-red-500 text-[10px] uppercase font-bold tracking-wider mt-1">{errors.topicTitle}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Instructions & Guidelines</label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => { setInstructions(e.target.value); if (errors.instructions) setErrors(prev => ({ ...prev, instructions: undefined })) }}
                  className={`w-full bg-[#eef4ff] border ${errors.instructions ? 'border-red-500' : 'border-[#d1e4ff]'} rounded-xl p-3 text-sm text-[#000a1e] leading-relaxed`}
                />
                {errors.instructions && <p className="text-red-500 text-[10px] uppercase font-bold tracking-wider mt-1">{errors.instructions}</p>}
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Upload Files (Rubrics, Prompts)</label>
                <label className={`border-2 border-dashed ${errors.files ? 'border-red-500' : 'border-[#d1e4ff]'} hover:border-[#002147] bg-[#f8f9ff] rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors`}>
                  <UploadCloud className="w-8 h-8 text-[#708ab5] mb-2" />
                  <span className="text-xs font-bold text-[#000a1e]">Click to upload or drag files here</span>
                  <span className="text-[11px] text-[#708ab5]">PDF, DOCX, XLSX, ZIP up to 50MB (max 5)</span>
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                </label>
                {errors.files && <p className="text-red-500 text-[10px] uppercase font-bold tracking-wider mt-1 mb-2">{errors.files}</p>}
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {files.map((file, idx) => (
                      <div key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e4efff] text-[#002147] rounded-lg text-xs font-semibold group border border-[#d1e4ff]">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{file}</span>
                        <button
                          onClick={(e) => { e.preventDefault(); removeFile(idx); }}
                          className="ml-1 text-[#708ab5] hover:text-red-500 p-0.5 rounded-full transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Academic Level */}
              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-2">Select Target Academic Level</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['Undergraduate', 'Master\'s', 'PhD / Doctoral', 'Professional'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setAcademicLevel(lvl)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${academicLevel === lvl
                        ? 'bg-[#000a1e] text-white border-[#000a1e] shadow-sm'
                        : 'bg-[#eef4ff] text-[#44474e] border-[#d1e4ff] hover:bg-white'
                        }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add-ons List */}
              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-2">Optional Extras</label>
                <div className="space-y-3">
                  <div
                    onClick={() => setTurnitinReport(!turnitinReport)}
                    className="p-3.5 rounded-xl border border-[#d1e4ff] bg-[#f8f9ff] flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${turnitinReport ? 'bg-[#000a1e] text-white' : 'border border-[#d1e4ff]'}`}>
                        {turnitinReport && '✓'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#000a1e] block">Plagiarism Report</span>
                        <span className="text-[11px] text-[#708ab5]">Detailed originality verification report</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">FREE</span>
                  </div>

                  {!catMode && (<>
                  <div
                    onClick={() => setTopExpert(!topExpert)}
                    className="p-3.5 rounded-xl border border-[#d1e4ff] bg-[#f8f9ff] flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${topExpert ? 'bg-[#000a1e] text-white' : 'border border-[#d1e4ff]'}`}>
                        {topExpert && '✓'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#000a1e] block">Premium Writer Match</span>
                        <span className="text-[11px] text-[#708ab5]">Assign your task to a top-rated expert</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#000a1e]">{addOnLabel('topExpert')}</span>
                  </div>

                  <div
                    onClick={() => setAbstractPage(!abstractPage)}
                    className="p-3.5 rounded-xl border border-[#d1e4ff] bg-[#f8f9ff] flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${abstractPage ? 'bg-[#000a1e] text-white' : 'border border-[#d1e4ff]'}`}>
                        {abstractPage && '✓'}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#000a1e] block">Summary & Abstract</span>
                        <span className="text-[11px] text-[#708ab5]">Standalone abstract and relevant keywords</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#000a1e]">{addOnLabel('abstractPage')}</span>
                  </div>
                  </>)}
                </div>
              </div>

              {/* Payment Info Section */}
              <div className="bg-[#f8f9ff] rounded-xl p-5 border border-[#d1e4ff] space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#002147] flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-[#002147] leading-relaxed">
                    <strong>Secure Manual Payment:</strong> {showUpi && showPaypal ? 'Scan the UPI QR code (India) OR use PayPal (International).' : showUpi ? 'Scan the UPI QR code or pay to the UPI ID.' : 'Pay with PayPal.'} Enter your Transaction/Reference ID below to instantly verify your order.
                  </div>
                </div>

                <div className={`grid grid-cols-1 gap-4 ${showUpi && showPaypal ? 'md:grid-cols-2' : ''}`}>
                  {/* UPI Block (India) */}
                  {showUpi && (
                  <div className="bg-white p-4 rounded-xl border border-[#d1e4ff] flex flex-col items-center text-center shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-50 text-emerald-700 text-[9px] font-extrabold px-2 py-1 rounded-bl-xl border-b border-l border-emerald-100 uppercase tracking-wider">India</div>

                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Scan to Pay (UPI)</p>
                    <div className="p-1 border border-gray-100 rounded-xl bg-white shadow-sm mb-3">
                      <img loading="lazy" decoding="async"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(`upi://pay?pa=academiapro@ybl&pn=AcademiaPro&am=${upiAmount}&cu=INR`)}`}
                        alt="UPI QR Code"
                        className="w-24 h-24 object-contain"
                      />
                    </div>
                    <p className="text-xl font-extrabold text-[#000a1e] mb-1">₹ {upiAmount.toLocaleString('en-IN')}</p>
                    {!catMode && shownStd && <p className="text-[10px] text-emerald-600 font-bold mb-3">{sym} {grandTotal} Converted (1{sym} = ₹{shownStd.upi.rate})</p>}

                    <div className="w-full">
                      <span className="text-[10px] font-semibold text-gray-500 block mb-1">Or Send to Direct UPI ID:</span>
                      <span className="font-mono text-xs bg-[#eef4ff] text-[#002147] px-2 py-1 rounded-md border border-[#d1e4ff] select-all w-full block truncate">academiapro@ybl</span>
                    </div>
                  </div>
                  )}

                  {/* PayPal Block (International) */}
                  {showPaypal && (
                  <div className="bg-[#f0f8ff] p-4 rounded-xl border border-[#b8daff] flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-100 text-[#003087] text-[9px] font-extrabold px-2 py-1 rounded-bl-xl border-b border-l border-blue-200 uppercase tracking-wider">Global</div>

                    <svg className="w-8 h-8 mb-3" fill="#003087" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"></path><path d="M21.573 6.534c.03-.15.054-.294.077-.437a3.84 3.84 0 0 0-.022-.246c-1.353 6.942-5.467 8.357-10.428 8.357H9.01c-.524 0-.968.382-1.05.9l-1.12 7.106-.057.362A.64.64 0 0 0 7.416 23.3h3.585c.524 0 .968-.382 1.05-.9l.865-5.473a1.055 1.055 0 0 1 1.05-.888h.619c2.868 0 5.253-.434 6.79-1.921 1.4-1.353 2.062-3.411 1.704-5.836a5.534 5.534 0 0 0-1.506-1.748z" fill="#009cde"></path></svg>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Pay via PayPal</p>
                    <p className="text-2xl font-extrabold text-[#003087] mb-3">{totalLabel}</p>

                    <a href={`https://paypal.me/yourusername/${paypalAmount}`} target="_blank" rel="noopener noreferrer"
                      className="bg-[#003087] hover:bg-[#001c52] text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer w-full mb-3 inline-block">
                      Pay Automatically ↗
                    </a>

                    <div className="w-full">
                      <span className="text-[10px] font-semibold text-gray-500 block mb-1">Or manual transfer to:</span>
                      <span className="font-mono text-xs bg-white text-[#003087] px-2 py-1 rounded-md border border-[#b8daff] select-all w-full block truncate">your.email@gmail.com</span>
                    </div>
                  </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Enter Transaction ID / UTR Number / PayPal Ref *</label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. 123456789012 or PAY-1234..."
                    className="w-full bg-white border border-[#d1e4ff] rounded-xl p-3 text-sm font-semibold text-[#000a1e] focus:border-[#fea520] outline-none transition-colors shadow-sm"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-2xl font-bold text-[#000a1e]">Academic Order Placed Successfully!</h4>
              <p className="text-sm text-[#44474e] max-w-md mx-auto">
                Your brief has been matched with our top verified academic team. An institutional coordinator has been assigned.
              </p>

              <div className="bg-[#eef4ff] rounded-2xl p-5 border border-[#d1e4ff] max-w-md mx-auto text-left space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#708ab5]">Reference Order ID:</span>
                  <strong className="text-[#000a1e] font-mono">{orderNumber}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#708ab5]">Discipline:</span>
                  <strong className="text-[#000a1e]">{orderSubject} ({orderService})</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#708ab5]">Pages / Words:</span>
                  <strong className="text-[#000a1e]">{catMode && catQuote ? `${catQuote.pages} Pages (${catQuote.words} Words)` : `${shownStd?.pages ?? pages} Pages (${shownStd?.words ?? '—'} Words)`}</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#708ab5]">Target Delivery:</span>
                  <strong className="text-[#000a1e]">{deadline}</strong>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-[#d1e4ff]">
                  <span className="text-[#000a1e] font-bold">Total Escrow Amount:</span>
                  <strong className="text-lg font-extrabold text-[#000a1e]">{totalLabel}</strong>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="bg-[#000a1e] text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-[#002147] transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Navigation Actions */}
        {step < 3 && (
          <div className="bg-[#f8f9ff] px-6 sm:px-8 py-4 border-t border-[#d1e4ff] flex justify-between items-center">
            <div>
              <span className="text-xs text-[#708ab5] block uppercase font-semibold">Total Price</span>
              <span className="text-2xl font-extrabold text-[#000a1e]" data-testid="order-total">{totalLabel}</span>
            </div>

            <div className="flex gap-3">
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#44474e] hover:bg-[#eef4ff] transition-colors"
                >
                  Back
                </button>
              )}
              {step === 1 ? (
                <button
                  onClick={handleNextStep}
                  disabled={!quoteReady && (catMode || (!!service && !!subject && pages >= 1))}
                  className="bg-[#000a1e] text-white hover:bg-[#002147] px-6 py-3 rounded-xl text-sm font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 text-[#fea520]" />
                </button>
              ) : (
                <button
                  onClick={handleCompleteOrder}
                  disabled={isSubmitting || !quoteReady}
                  className="bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] hover:text-white px-7 py-3 rounded-xl text-sm font-bold shadow-soft flex items-center gap-1.5 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processing...</>
                  ) : (
                    <><Lock className="w-4 h-4" /> Place Request</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
