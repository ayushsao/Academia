import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { OrderModal } from '../components/OrderModal';
import { SignInModal } from '../components/SignInModal';
import { FileText, CheckCircle, ShieldCheck, BookOpen, ChevronRight, Eye } from 'lucide-react';

const samples = [
    {
        id: 'essay',
        title: 'Master\'s Level Business Essay',
        category: 'Academic Writing',
        icon: <BookOpen className="w-5 h-5" />,
        grade: 'A+ / Distinction',
        desc: 'A comprehensive 2,500-word critical analysis of modern supply chain resilience, properly cited in APA 7th Edition.',
        preview: `The intersection of globalization and localized supply chain disruptions has necessitated a paradigm shift in how multinational corporate entities approach inventory resilience. Moving away from the traditional Just-In-Time (JIT) models, this paper critically examines the efficacy of buffer-oriented supply structures in mitigating geopolitical shocks.

1. Strategic Vulnerabilities in Lean Supply Chains
As empirically demonstrated during the logistics bottlenecks of the early 2020s, over-reliance on single-source offshore manufacturing creates a cascading fragility...

[Preview truncated for sample display]`,
        features: ['Impeccable Harvard/APA Referencing', 'Critical PhD-level Analysis', 'Zero Grammatical Errors']
    },
    {
        id: 'plagiarism',
        title: 'Turnitin / Originality Report',
        category: 'Quality Assurance',
        icon: <ShieldCheck className="w-5 h-5" />,
        grade: '0% Similarity',
        desc: 'Every document comes with an industry-standard originality scan to guarantee your work is 100% uniquely crafted.',
        preview: `--- ORIGINALITY REPORT SUMMARY ---

Submission ID: 948271032
Title: The Socio-Economic Impact of AI

Originality Score: 0% / 100% Unique

Breakdown:
- Internet Sources: 0%
- Publications: 0%
- Student Papers: 0%

Remarks: This thesis has been fully vetted against 99+ billion active and archived web pages, university repositories, and published journals. No matching strings exceeding 5 adjacent words were identified.`,
        features: ['Full Turnitin-style scanning', 'Verifiable originality', 'Exclusion of proper quotes']
    },
];

export const ResourcesPage = () => {
    const [isOrderModalOpen, setOrderModalOpen] = useState(false);
    const [isSignInModalOpen, setSignInModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('essay');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <Navbar
                onOpenOrder={() => setOrderModalOpen(true)}
                onOpenSignIn={() => setSignInModalOpen(true)}
            />

            {/* Hero Section */}
            <div className="relative bg-[#000a1e] pt-32 pb-24 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#002147] via-[#000a1e] to-[#000a1e] opacity-80"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#fea520]/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative max-w-7xl mx-auto px-6 lg:px-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
                        Academic Excellence, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fea520] to-yellow-300">Showcased.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto font-medium">
                        Explore our sample database of premium essays, perfectly formatted dissertations, and flawless originality reports. This is the quality you can expect.
                    </p>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-8 py-16 -mt-10 relative z-10">
                <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden flex flex-col lg:flex-row min-h-[600px]">

                    {/* Sidebar / Tabs */}
                    <div className="w-full lg:w-80 bg-gray-50/50 border-r border-gray-100 p-6 flex flex-col gap-3">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 mb-2">Available Samples</p>
                        {samples.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setActiveTab(s.id)}
                                className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 border ${activeTab === s.id
                                    ? 'bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] border-gray-200 text-[#000a1e]'
                                    : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                                    }`}
                            >
                                <div className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${activeTab === s.id ? 'bg-[#000a1e] text-white' : 'bg-gray-200 text-gray-600'}`}>
                                    {s.icon}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center h-10 mt-0.5">
                                    <h3 className="font-bold text-sm truncate">{s.title}</h3>
                                    <p className="text-xs font-medium opacity-70 truncate">{s.category}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 p-8 lg:p-12 relative overflow-hidden bg-white">
                        {samples.map((s) => (
                            <div
                                key={s.id}
                                className={`absolute inset-0 p-8 lg:p-12 transition-all duration-500 transform ${activeTab === s.id
                                    ? 'opacity-100 translate-y-0 relative z-10 pointer-events-auto'
                                    : 'opacity-0 translate-y-8 absolute z-0 pointer-events-none hidden'
                                    }`}
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-extrabold tracking-wide border border-emerald-100">
                                        {s.grade}
                                    </span>
                                    <span className="text-gray-400 text-sm font-medium flex items-center gap-1">
                                        <Eye className="w-4 h-4" /> Verified Quality
                                    </span>
                                </div>

                                <h2 className="text-3xl font-extrabold text-[#000a1e] mb-4">{s.title}</h2>
                                <p className="text-gray-600 font-medium leading-relaxed mb-8 max-w-2xl">{s.desc}</p>

                                {/* Mock Document Window */}
                                <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-inner mb-8">
                                    <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                                        <div className="ml-4 font-mono text-xs font-bold text-gray-400">{s.id}_sample_document.pdf</div>
                                    </div>
                                    <div className="p-6 md:p-8">
                                        <pre className="whitespace-pre-wrap font-sans text-sm md:text-base text-gray-700 leading-loose">
                                            {s.preview}
                                        </pre>
                                    </div>
                                </div>

                                {/* Features */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {s.features.map((feat, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <CheckCircle className="w-4 h-4 text-[#fea520] flex-shrink-0" />
                                            {feat}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setOrderModalOpen(true)}
                                    className="mt-10 bg-[#000a1e] hover:bg-[#fea520] text-white hover:text-[#000a1e] px-8 py-4 rounded-xl font-extrabold transition-all duration-300 shadow-lg flex items-center gap-2 group"
                                >
                                    Order A Similar Paper
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        ))}
                    </div>

                </div>
            </div>

            <Footer />

            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setOrderModalOpen(false)}
            />
            {isSignInModalOpen && (
                <SignInModal
                    isOpen={isSignInModalOpen}
                    onClose={() => setSignInModalOpen(false)}
                />
            )}
        </div>
    );
};
