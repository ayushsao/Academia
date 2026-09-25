import React, { useState } from 'react';
import {
  X,
  Calculator,
  FileText,
  GraduationCap,
  Calendar,
  ChevronRight,
  ArrowRight,
  Minus,
  Plus,
  Check
} from 'lucide-react';
import { ServiceType, SubjectType } from '../types';
import { useOrderQuote, fetchRateCard, type OrderQuote, type RateCard } from '../lib/orderQuote';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToOrder: (config: {
    service: ServiceType;
    subject: SubjectType;
    pages: number;
    deadline: string;
    quote?: OrderQuote;
  }) => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  onProceedToOrder,
}) => {
  const getNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  const [activeTab, setActiveTab] = useState<'services' | 'subjects' | 'deadlines' | 'overview'>('overview');
  const [selectedService, setSelectedService] = useState<ServiceType | ''>('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectType | ''>('');
  const [pages, setPages] = useState<number>(0);
  const [deadline, setDeadline] = useState<string>(getNextWeek());

  const servicesList: { name: ServiceType; desc: string }[] = [
    { name: 'Academic Writing', desc: 'Original essays, research papers, and assignments' },
    { name: 'Dissertation & Thesis', desc: 'Doctoral chapters, proposals, and methodology' },
    { name: 'Editing & Proofreading', desc: 'Style polishing, syntax, and institutional compliance' },
    { name: 'Data Analysis & SPSS', desc: 'Quantitative modeling, R, Python, and statistical tests' },
    { name: 'Literature Review', desc: 'Comprehensive scholarly synthesis with citations' },
    { name: 'Case Study Analysis', desc: 'IRAC methodology and practical frameworks' },
    { name: 'Essay Editing Service', desc: 'Comprehensive grammatical checks and structural refinement' },
    { name: 'MBA Essay Writing Service', desc: 'Premium executive-level admissions and business essays' },
    { name: 'Essay Help', desc: 'General guidance, structuring, and academic essay assistance' },
    { name: 'Research Proposal Writing Service', desc: 'Drafting convincing research frameworks for university approval' },
    { name: 'Research Paper Writing', desc: 'In-depth academic exploration and citation formatting' },
    { name: 'Ghost Writer', desc: 'Completely anonymous, transfer-of-rights premium manuscript writing' },
    { name: 'Programming Assignment Help', desc: 'Code implementation, debugging, and software architecture' },
    { name: 'Assessment Help', desc: 'Targeted support for ongoing university assessments' },
    { name: 'Pay Someone To Do My Homework', desc: 'Delegate your general weekly homework and coursework' },
    { name: 'Take My Online Class', desc: 'End-to-end continuous support for a full academic module' },
    { name: 'Take My Online Exam', desc: 'Live proxy attendance and precise problem solving' },
    { name: 'Dissertation Help', desc: 'Targeted chapter construction and academic formatting' },
    { name: 'Term Paper Help', desc: 'End-of-semester comprehensive report structuring' },
    { name: 'Homework Help', desc: 'Quick-turnaround solutions and instructional tutoring' },
    { name: 'Coursework Help', desc: 'Semester-long continuous assignment integration' },
    { name: 'Thesis Help', desc: 'Master\'s and PhD level thesis development and defense prep' },
    { name: 'Powerpoint Presentation Services', desc: 'Visually stunning, academically structured slide decks' }
  ];

  const subjectsList: SubjectType[] = [
    'Business & Mgt',
    'Computer Science',
    'Literature & Humanities',
    'Finance & Economics',
    'Law & Legal Studies',
    'Medical & Healthcare',
    'Engineering & STEM',
    'Psychology & Sociology',
  ];

  // Rates and totals come from the server; the same quote is handed to the order form.
  const [rateCard, setRateCard] = useState<RateCard | null>(null);
  React.useEffect(() => {
    if (isOpen && !rateCard) fetchRateCard().then(setRateCard).catch(() => { /* labels stay blank */ });
  }, [isOpen, rateCard]);
  const rateLabel = (name: string) => (rateCard ? `${rateCard.currencies[rateCard.baseCurrency]?.symbol ?? ''}${rateCard.rates[name] ?? rateCard.defaultRate}` : '…');
  const { quote, lastQuote, ensure } = useOrderQuote(
    { service: selectedService, pages, academicLevel: 'Undergraduate', currency: rateCard?.baseCurrency || 'GBP' },
    { enabled: isOpen && pages > 0 },
  );
  const totalPrice = pages > 0 ? (quote || lastQuote)?.total ?? 0 : 0;

  const handleProceed = async () => {
    let finalQuote: OrderQuote | undefined;
    if (pages > 0) { try { finalQuote = await ensure(); } catch { finalQuote = undefined; } }
    onProceedToOrder({
      service: selectedService,
      subject: selectedSubject,
      pages,
      deadline,
      quote: finalQuote,
    });
    onClose();
  };

  return (
    <>
      {/* Drawer Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-[#000a1e]/50 backdrop-blur-sm z-[55] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      />

      {/* Drawer Panel */}
      <div
        id="sideNavDrawer"
        className={`fixed right-0 top-0 h-screen w-full sm:w-[420px] z-[60] bg-[#dbe9ff] transition-transform duration-500 ease-out flex flex-col ${isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'
          }`}
      >
        <div className="flex flex-col h-full p-6 sm:p-8 overflow-y-auto relative bg-mesh">
          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close cost calculator drawer"
            className="absolute top-6 right-6 text-[#44474e] hover:text-[#000a1e] bg-white/70 hover:bg-white rounded-full p-2 backdrop-blur-sm transition-all shadow-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Drawer Header */}
          <div className="mb-6 mt-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#e4efff] shadow-inner mb-3 text-[#865300]">
              <Calculator className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-[#000a1e] tracking-tight">Instant Quote</h3>
            <p className="text-sm text-[#44474e] mt-0.5">Configure your academic needs</p>
          </div>

          {/* Navigation / Step Config Buttons */}
          <nav className="flex flex-col gap-2.5 mb-6">
            {/* Services Tab */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'services' ? 'overview' : 'services')}
              className={`flex items-center justify-between rounded-xl p-3.5 shadow-sm border transition-all text-left cursor-pointer ${activeTab === 'services'
                ? 'bg-white border-[#fea520] ring-2 ring-[#fea520]/20'
                : 'bg-white/80 text-[#000a1e] border-[#d1e4ff] hover:bg-white'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#fea520]/20 p-2 rounded-lg text-[#865300]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-[#708ab5] font-semibold uppercase block">Service</span>
                  <span className={`text-sm font-bold ${!selectedService ? 'text-[#74777f] italic text-xs' : 'text-[#000a1e]'}`}>{selectedService || 'Select a Service'}</span>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-[#74777f] transition-transform ${activeTab === 'services' ? 'rotate-90 text-[#fea520]' : ''}`} />
            </button>

            {/* Drilldown options for Services */}
            {activeTab === 'services' && (
              <div className="bg-white/90 rounded-xl p-3 border border-[#d1e4ff] space-y-1.5 animate-in slide-in-from-top duration-200">
                {servicesList.map((srv) => (
                  <div
                    key={srv.name}
                    onClick={() => {
                      setSelectedService(srv.name);
                      setActiveTab('overview');
                    }}
                    className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${selectedService === srv.name
                      ? 'bg-[#e4efff] text-[#000a1e] font-bold'
                      : 'hover:bg-[#f8f9ff] text-[#44474e]'
                      }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{srv.name}</div>
                      <div className="text-[10px] text-[#708ab5]">{srv.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#865300]">{rateLabel(srv.name)}/p</span>
                      {selectedService === srv.name && <Check className="w-3.5 h-3.5 text-[#002147]" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Subjects Tab */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'subjects' ? 'overview' : 'subjects')}
              className={`flex items-center justify-between rounded-xl p-3.5 border transition-all text-left cursor-pointer ${activeTab === 'subjects'
                ? 'bg-white border-[#002147] ring-2 ring-[#002147]/20 shadow-sm'
                : 'bg-white/60 text-[#44474e] border-transparent hover:bg-white hover:border-[#d1e4ff]'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#d1e4ff] p-2 rounded-lg text-[#000a1e]">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-[#708ab5] font-semibold uppercase block">Subject</span>
                  <span className={`text-sm font-bold ${!selectedSubject ? 'text-[#74777f] italic text-xs' : 'text-[#000a1e]'}`}>{selectedSubject || 'Select a Subject'}</span>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-[#74777f] transition-transform ${activeTab === 'subjects' ? 'rotate-90' : ''}`} />
            </button>

            {/* Drilldown options for Subjects */}
            {activeTab === 'subjects' && (
              <div className="bg-white/90 rounded-xl p-3 border border-[#d1e4ff] grid grid-cols-1 gap-1.5 animate-in slide-in-from-top duration-200">
                {subjectsList.map((subj) => (
                  <div
                    key={subj}
                    onClick={() => {
                      setSelectedSubject(subj);
                      setActiveTab('overview');
                    }}
                    className={`p-2 rounded-lg flex items-center justify-between text-xs cursor-pointer ${selectedSubject === subj
                      ? 'bg-[#e4efff] text-[#000a1e] font-bold'
                      : 'hover:bg-[#f8f9ff] text-[#44474e]'
                      }`}
                  >
                    <span>{subj}</span>
                    {selectedSubject === subj && <Check className="w-3.5 h-3.5 text-[#002147]" />}
                  </div>
                ))}
              </div>
            )}

            {/* Deadlines Tab */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'deadlines' ? 'overview' : 'deadlines')}
              className={`flex items-center justify-between rounded-xl p-3.5 border transition-all text-left cursor-pointer ${activeTab === 'deadlines'
                ? 'bg-white border-[#002147] ring-2 ring-[#002147]/20 shadow-sm'
                : 'bg-white/60 text-[#44474e] border-transparent hover:bg-white hover:border-[#d1e4ff]'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#d1e4ff] p-2 rounded-lg text-[#000a1e]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs text-[#708ab5] font-semibold uppercase block">Deadline</span>
                  <span className="text-sm font-bold text-[#000a1e]">{deadline}</span>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-[#74777f] transition-transform ${activeTab === 'deadlines' ? 'rotate-90' : ''}`} />
            </button>

            {/* Drilldown options for Deadlines */}
            {activeTab === 'deadlines' && (
              <div className="bg-white/90 rounded-xl p-4 border border-[#d1e4ff] space-y-3 animate-in slide-in-from-top duration-200">
                <label className="text-xs font-bold text-[#44474e] block">Select Target Completion Date</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border border-[#d1e4ff] rounded-lg p-2.5 text-xs font-semibold bg-[#eef4ff]"
                />
                <div className="flex gap-2">
                  {['24h Rush', '3 Days', '7 Days', '14 Days'].map((preset, i) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + (i === 0 ? 1 : i === 1 ? 3 : i === 2 ? 7 : 14));
                        setDeadline(d.toISOString().split('T')[0]);
                      }}
                      className="px-2.5 py-1.5 bg-[#eef4ff] hover:bg-[#d1e4ff] rounded-md text-[11px] font-semibold text-[#002147]"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>

          {/* Length (Pages) adjuster */}
          <div className="bg-white/80 rounded-2xl p-4 border border-[#d1e4ff] mb-6 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-[#44474e] uppercase">Length (Pages)</span>
              <span className="text-xs font-semibold text-[#865300]">{pages * 250} Words</span>
            </div>
            <div className="flex items-center justify-between bg-[#eef4ff] p-2 rounded-xl">
              <button
                onClick={() => setPages(p => Math.max(1, p - 1))}
                className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-[#000a1e] hover:bg-[#d1e4ff] font-bold shadow-sm"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="text-center">
                <span className="text-xl font-bold text-[#000a1e]">{pages}</span>
                <span className="text-[11px] text-[#708ab5] block">Pages</span>
              </div>
              <button
                onClick={() => setPages(p => p + 1)}
                className="w-9 h-9 bg-[#000a1e] rounded-lg flex items-center justify-center text-white hover:bg-[#002147] font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="mt-auto pt-4 border-t border-[#c4c6cf]/40">
            <div className="flex justify-between items-baseline mb-4 bg-white/70 p-3.5 rounded-xl border border-white">
              <div>
                <span className="text-xs text-[#708ab5] font-semibold block uppercase">Estimated Quote</span>
                <span className="text-[11px] text-emerald-700 font-medium">Includes Unlimited Revisions</span>
              </div>
              <span className="text-3xl font-extrabold text-[#000a1e]">
                £ {totalPrice}
              </span>
            </div>

            <button
              onClick={handleProceed}
              className="w-full bg-[#000a1e] text-white hover:bg-[#002147] py-4 rounded-xl font-bold shadow-ambient hover:shadow-soft transition-all flex justify-center items-center gap-2 group cursor-pointer"
            >
              <span>Proceed to Order</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
