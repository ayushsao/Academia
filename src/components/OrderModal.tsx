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

const API = ((import.meta as any).env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api')).replace(/\/+$/, '');

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: {
    service?: ServiceType;
    subject?: SubjectType;
    pages?: number;
    deadline?: string;
  };
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  initialConfig,
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
  const [academicLevel, setAcademicLevel] = useState<'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional'>('Undergraduate');
  const [topicTitle, setTopicTitle] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [files, setFiles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actualFileObjects, setActualFileObjects] = useState<File[]>([]);

  const [errors, setErrors] = useState<{ topicTitle?: string; instructions?: string; files?: string }>({});

  // Add-ons (Start unselected to match base quote accurately)
  const [turnitinReport, setTurnitinReport] = useState<boolean>(true); // Free anyway
  const [topExpert, setTopExpert] = useState<boolean>(false);
  const [abstractPage, setAbstractPage] = useState<boolean>(false);

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
      setStep(1);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const getBaseRate = (srv: ServiceType | ''): number => {
    switch (srv) {
      case 'Take My Online Exam': return 50;
      case 'Take My Online Class': return 45;
      case 'Ghost Writer': return 30;
      case 'MBA Essay Writing Service': return 28;
      case 'Data Analysis & SPSS':
      case 'Programming Assignment Help':
        return 25;
      case 'Dissertation & Thesis':
      case 'Dissertation Help':
      case 'Thesis Help':
        return 22;
      case 'Research Proposal Writing Service': return 20;
      case 'Literature Review':
      case 'Research Paper Writing':
      case 'Assessment Help':
        return 18;
      case 'Case Study Analysis':
      case 'Term Paper Help':
        return 16;
      case 'Academic Writing':
      case 'Pay Someone To Do My Homework':
      case 'Coursework Help':
        return 15;
      case 'Essay Help': return 14;
      case 'Homework Help':
      case 'Powerpoint Presentation Services':
        return 12;
      case 'Editing & Proofreading':
      case 'Essay Editing Service':
        return 10;
      default: return 15;
    }
  };

  const basePricePerPage = getBaseRate(service);
  const levelMultiplier = academicLevel === 'PhD / Doctoral' ? 1.35 : academicLevel === 'Master\'s' ? 1.15 : 1.0;
  const subtotal = Math.round(pages * basePricePerPage * levelMultiplier);
  const addOnsTotal = (turnitinReport ? 0 : 0) + (topExpert ? 15 : 0) + (abstractPage ? 10 : 0);
  const grandTotal = subtotal + addOnsTotal;

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
    const newErrors: { topicTitle?: string; instructions?: string; files?: string } = {};
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
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleCompleteOrder = async () => {
    if (!user) {
      alert("Please login first to place an order.");
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
        service,
        subject,
        pages,
        deadline,
        topicTitle,
        instructions,
        academicLevel,
        files: uploadedFileNames,
        turnitinReport,
        topExpert,
        abstractPage,
        totalAmount: grandTotal,
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
            message: `User ${user.name} placed a new order for ${service} (${subject}). Topic: ${topicTitle}. Total: £${grandTotal}`
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">Length (Pages / Words)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={pages}
                      onChange={(e) => setPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-sm font-bold text-[#000a1e]"
                    />
                    <span className="text-xs text-[#708ab5] font-semibold">≈ {pages * 250} Words</span>
                  </div>
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
                    <span className="text-xs font-bold text-[#000a1e]">£ 15</span>
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
                    <span className="text-xs font-bold text-[#000a1e]">£ 10</span>
                  </div>
                </div>
              </div>

              {/* Escrow Guarantee Notice */}
              <div className="bg-[#dbe9ff]/70 rounded-xl p-4 border border-[#d1e4ff] flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#002147] flex-shrink-0 mt-0.5" />
                <div className="text-xs text-[#002147] leading-relaxed">
                  <strong>Protected Payment:</strong> Your payment is held securely and only released to the writer once you approve the final paper.
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
                  <strong className="text-[#000a1e]">{subject} ({service})</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#708ab5]">Pages / Words:</span>
                  <strong className="text-[#000a1e]">{pages} Pages ({pages * 250} Words)</strong>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#708ab5]">Target Delivery:</span>
                  <strong className="text-[#000a1e]">{deadline}</strong>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-[#d1e4ff]">
                  <span className="text-[#000a1e] font-bold">Total Escrow Amount:</span>
                  <strong className="text-lg font-extrabold text-[#000a1e]">£ {grandTotal}</strong>
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
              <span className="text-2xl font-extrabold text-[#000a1e]">£ {grandTotal}</span>
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
                  className="bg-[#000a1e] text-white hover:bg-[#002147] px-6 py-3 rounded-xl text-sm font-bold shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 text-[#fea520]" />
                </button>
              ) : (
                <button
                  onClick={handleCompleteOrder}
                  disabled={isSubmitting}
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
