import React, { useState, useMemo } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { OrderModal } from '../components/OrderModal';
import { SignInModal } from '../components/SignInModal';
import { REVIEWS } from '../data/mockData';
import type { Review } from '../types';
import {
  Star, ShieldCheck, CheckCircle2, Search, Filter, ThumbsUp, MessageSquarePlus, Award, GraduationCap, MapPin, Calendar, FileText, Check, X, ChevronDown, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const SUBJECT_CATEGORIES = [
    'All Subjects',
    'Business & Finance',
    'Nursing & Healthcare',
    'Computer Science',
    'Law & Criminal Justice',
    'Economics',
    'Psychology',
    'Mechanical Engineering',
    'Biomedical Sciences',
    'English & Literature',
    'Cybersecurity'
];

const SERVICE_TYPES = [
    'All Types',
    'DISSERTATION',
    'CAPSTONE REPORT',
    'TECHNICAL PROJECT & REPORT',
    'LEGAL MEMORANDUM',
    'DOCTORAL RESEARCH PAPER',
    'SYSTEMATIC REVIEW',
    'CASE STUDY ANALYSIS',
    'CRITICAL ESSAY',
    'RESEARCH PROPOSAL'
];

export const ReviewsPage: React.FC = () => {
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [signInModalOpen, setSignInModalOpen] = useState(false);
    const [reviewsList, setReviewsList] = useState<Review[]>(REVIEWS);

    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('All Subjects');
    const [selectedRating, setSelectedRating] = useState<number | 'all'>('all');
    const [selectedService, setSelectedService] = useState('All Types');
    const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'pages'>('recent');

    // Review submission modal state
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        author: '',
        location: '',
        title: '',
        subject: 'Business & Finance',
        type: 'ESSAY',
        level: 'Undergraduate',
        rating: 5,
        grade: 'A+ / Distinction',
        pages: 5,
        text: ''
    });

    const filteredReviews = useMemo(() => {
        return reviewsList.filter(review => {
            const matchesSearch =
                review.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                review.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                review.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (review.subject && review.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (review.location && review.location.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesSubject = selectedSubject === 'All Subjects' || review.subject === selectedSubject;
            const matchesRating = selectedRating === 'all' || review.rating === selectedRating;
            const matchesService = selectedService === 'All Types' || review.type === selectedService;

            return matchesSearch && matchesSubject && matchesRating && matchesService;
        }).sort((a, b) => {
            if (sortBy === 'rating') return b.rating - a.rating;
            if (sortBy === 'pages') return b.pages - a.pages;
            return 0; // default recent order
        });
    }, [reviewsList, searchQuery, selectedSubject, selectedRating, selectedService, sortBy]);

    const handleNewReviewSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.author.trim() || !formData.text.trim()) return;

        const newReview: Review = {
            id: `r-${Date.now()}`,
            author: formData.author,
            location: formData.location || 'Verified Student',
            title: formData.title || 'Academic Support Review',
            subject: formData.subject,
            type: formData.type,
            level: formData.level,
            rating: formData.rating,
            grade: formData.grade,
            pages: Number(formData.pages) || 5,
            date: 'Just now',
            text: formData.text,
            platform: 'STUDENT CHOICE',
            verified: true
        };

        setReviewsList([newReview, ...reviewsList]);
        setFormSubmitted(true);
        setTimeout(() => {
            setIsSubmitModalOpen(false);
            setFormSubmitted(false);
            setFormData({
                author: '',
                location: '',
                title: '',
                subject: 'Business & Finance',
                type: 'ESSAY',
                level: 'Undergraduate',
                rating: 5,
                grade: 'A+ / Distinction',
                pages: 5,
                text: ''
            });
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#fafbfc] font-sans">
            <Navbar
                onOpenOrder={() => setOrderModalOpen(true)}
                onOpenSignIn={() => setSignInModalOpen(true)}
                onOpenDrawer={() => {}}
            />

            {/* Hero Header */}
            <header className="relative bg-gradient-to-b from-[#000a1e] to-[#041a3a] text-white pt-16 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fea520_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
                <div className="max-w-6xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-bold uppercase tracking-wider mb-6 border border-white/10">
                        <ShieldCheck className="w-4 h-4 text-[#fea520]" />
                        100% Verified Student Reviews
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                        Real Feedback From <br className="hidden sm:inline" />
                        <span className="text-[#fea520]">Real Students Worldwide</span>
                    </h1>

                    <p className="mt-4 text-slate-300 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
                        Read unedited experiences from students at Oxford, Harvard, Melbourne, Toronto, and 120+ top institutions who achieved high grades with AssignmentMinds.
                    </p>

                    {/* Stats Ribbon */}
                    <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center">
                            <div className="flex items-center justify-center gap-1 text-[#fea520] mb-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 fill-current" />
                                ))}
                            </div>
                            <div className="text-3xl font-extrabold text-white">4.9 / 5.0</div>
                            <div className="text-xs text-slate-400 font-medium mt-1">Based on 4,850+ ratings</div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center">
                            <div className="text-3xl font-extrabold text-white">98.4%</div>
                            <div className="text-xs text-[#fea520] font-bold uppercase tracking-wider mt-1">On-Time Delivery</div>
                            <div className="text-xs text-slate-400 font-medium mt-1">Zero missed deadlines</div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center">
                            <div className="text-3xl font-extrabold text-white">0.0%</div>
                            <div className="text-xs text-[#fea520] font-bold uppercase tracking-wider mt-1">Turnitin Plagiarism</div>
                            <div className="text-xs text-slate-400 font-medium mt-1">100% human scholarly work</div>
                        </div>

                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center">
                            <div className="text-3xl font-extrabold text-white">94.7%</div>
                            <div className="text-xs text-[#fea520] font-bold uppercase tracking-wider mt-1">Distinction Rate</div>
                            <div className="text-xs text-slate-400 font-medium mt-1">A & A+ grades achieved</div>
                        </div>
                    </div>

                    {/* Platform badges */}
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-300">
                        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
                            <span className="text-emerald-400">★</span> Trustpilot 4.9/5
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
                            <span className="text-amber-400">★</span> SiteJabber 4.8/5
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
                            <span className="text-blue-400">★</span> REVIEWS.io 4.9/5
                        </span>
                        <button
                            onClick={() => setIsSubmitModalOpen(true)}
                            className="flex items-center gap-1.5 bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] font-bold px-4 py-1.5 rounded-full transition shadow-sm ml-2"
                        >
                            <MessageSquarePlus className="w-4 h-4" />
                            Write a Review
                        </button>
                    </div>
                </div>
            </header>

            {/* Filter & Search Bar */}
            <div className="max-w-6xl mx-auto px-4 -mt-8 relative z-20">
                <div className="bg-white rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.06)] border border-slate-200/80 p-5 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by topic, discipline, university, or keyword (e.g., dissertation, nursing, dcf)..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#fea520] focus:bg-white transition"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Subject Selector */}
                        <div className="w-full md:w-60">
                            <select
                                value={selectedSubject}
                                onChange={e => setSelectedSubject(e.target.value)}
                                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#fea520] focus:bg-white transition"
                            >
                                {SUBJECT_CATEGORIES.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>

                        {/* Service Type Selector */}
                        <div className="w-full md:w-56">
                            <select
                                value={selectedService}
                                onChange={e => setSelectedService(e.target.value)}
                                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#fea520] focus:bg-white transition"
                            >
                                {SERVICE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sort */}
                        <div className="w-full md:w-48">
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as any)}
                                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#fea520] focus:bg-white transition"
                            >
                                <option value="recent">Sort: Most Recent</option>
                                <option value="rating">Sort: Highest Rating</option>
                                <option value="pages">Sort: Comprehensive (Pages)</option>
                            </select>
                        </div>
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                        <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5" /> Rating:
                        </span>
                        {(['all', 5, 4] as const).map(rate => (
                            <button
                                key={rate}
                                onClick={() => setSelectedRating(rate)}
                                className={`px-3 py-1 rounded-full font-medium transition ${selectedRating === rate ? 'bg-[#000a1e] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {rate === 'all' ? 'All Ratings' : `${rate} Stars ★`}
                            </button>
                        ))}

                        <div className="ml-auto text-xs text-slate-500">
                            Showing <span className="font-bold text-slate-800">{filteredReviews.length}</span> verified reviews
                        </div>
                    </div>
                </div>
            </div>

            {/* Reviews Grid */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {filteredReviews.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-800">No reviews found matching your filters</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Try clearing your search query or selecting "All Subjects" to see student testimonials.</p>
                        <button
                            onClick={() => { setSearchQuery(''); setSelectedSubject('All Subjects'); setSelectedRating('all'); setSelectedService('All Types'); }}
                            className="mt-4 px-4 py-2 bg-[#000a1e] text-white text-xs font-bold rounded-lg hover:bg-[#fea520] hover:text-[#000a1e] transition"
                        >
                            Reset All Filters
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredReviews.map((rev) => (
                            <div
                                key={rev.id}
                                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                            >
                                <div>
                                    {/* Top Metadata Row */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-extrabold text-[#000a1e] text-base leading-snug">{rev.author}</h3>
                                                {rev.verified && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified Order
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                                {rev.location && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-slate-400" /> {rev.location}
                                                    </span>
                                                )}
                                                {rev.level && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1 font-medium text-slate-600">
                                                            <GraduationCap className="w-3 h-3 text-slate-400" /> {rev.level}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Star Rating Badge */}
                                        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/70 px-2.5 py-1 rounded-lg shrink-0">
                                            <div className="flex text-[#ff8c00]">
                                                {[...Array(rev.rating)].map((_, i) => (
                                                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                                                ))}
                                            </div>
                                            <span className="text-xs font-extrabold text-[#b86e00] ml-1">{rev.rating}.0</span>
                                        </div>
                                    </div>

                                    {/* Project Pill Tags */}
                                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-bold text-[#002147] bg-[#002147]/5 px-2.5 py-1 rounded-md">
                                            {rev.type}
                                        </span>
                                        {rev.subject && (
                                            <span className="font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                                                {rev.subject}
                                            </span>
                                        )}
                                        {rev.grade && (
                                            <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-md flex items-center gap-1">
                                                <Award className="w-3 h-3" /> Grade: {rev.grade}
                                            </span>
                                        )}
                                    </div>

                                    {/* Paper Title */}
                                    <h4 className="mt-3.5 font-bold text-slate-900 text-sm leading-snug">
                                        "{rev.title}"
                                    </h4>

                                    {/* Review Body */}
                                    <p className="mt-2.5 text-sm text-slate-600 leading-relaxed font-normal">
                                        {rev.text}
                                    </p>
                                </div>

                                {/* Footer of Review Card */}
                                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5 text-slate-400" /> {rev.pages} pages
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> {rev.date}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                                        via {rev.platform}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Trust Guarantee Banner */}
                <div className="mt-16 bg-gradient-to-r from-[#000a1e] to-[#041a3a] rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl">
                    <div className="relative z-10 max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fea520]/20 text-[#fea520] text-xs font-bold uppercase tracking-wider mb-4">
                            <Award className="w-4 h-4" /> Guaranteed Excellence
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Every Paper Comes With Guaranteed Turnitin Clearance & Distinction Support
                        </h2>
                        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                            Join thousands of students who submit with complete confidence. All assignments include free Turnitin similarity verification, unlimited revisions, and complete confidentiality.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4">
                            <button
                                onClick={() => setOrderModalOpen(true)}
                                className="bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] font-extrabold px-6 py-3 rounded-xl transition shadow-md flex items-center gap-2 text-sm"
                            >
                                Order Your Assignment Now <ArrowRight className="w-4 h-4" />
                            </button>
                            <Link
                                to="/hire-writers"
                                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition border border-white/20 text-sm flex items-center gap-2"
                            >
                                Browse Verified Experts
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            {/* Leave a Review Modal */}
            {isSubmitModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
                        <button
                            onClick={() => setIsSubmitModalOpen(false)}
                            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#b86e00]">
                                <MessageSquarePlus className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-black text-[#000a1e]">Share Your Experience</h3>
                            <p className="text-xs text-slate-500 mt-1">Help fellow students know what it’s like to work with our academic team.</p>
                        </div>

                        {formSubmitted ? (
                            <div className="text-center py-8">
                                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Check className="w-7 h-7 stroke-[3]" />
                                </div>
                                <h4 className="text-xl font-bold text-slate-900">Thank You!</h4>
                                <p className="text-sm text-slate-500 mt-1">Your review has been verified and added to the testimonials list.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleNewReviewSubmit} className="space-y-4 text-left">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.author}
                                            onChange={e => setFormData({ ...formData, author: e.target.value })}
                                            placeholder="e.g. Jordan S."
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#fea520] focus:bg-white outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">University / City</label>
                                        <input
                                            type="text"
                                            value={formData.location}
                                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="e.g. London, UK"
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#fea520] focus:bg-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Discipline</label>
                                        <select
                                            value={formData.subject}
                                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#fea520] focus:bg-white outline-none"
                                        >
                                            {SUBJECT_CATEGORIES.filter(s => s !== 'All Subjects').map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">Rating</label>
                                        <div className="flex gap-1 py-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    type="button"
                                                    key={star}
                                                    onClick={() => setFormData({ ...formData, rating: star })}
                                                    className={`p-1 text-lg transition ${star <= formData.rating ? 'text-amber-500' : 'text-slate-300'}`}
                                                >
                                                    ★
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Assignment / Project Topic</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Comparative Analysis of Machine Learning Models"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#fea520] focus:bg-white outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Detailed Review & Feedback</label>
                                    <textarea
                                        rows={4}
                                        required
                                        value={formData.text}
                                        onChange={e => setFormData({ ...formData, text: e.target.value })}
                                        placeholder="Share how the expert helped you, delivery timeliness, quality of research, referencing, and grade received..."
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#fea520] focus:bg-white outline-none resize-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-3 bg-[#000a1e] hover:bg-[#fea520] hover:text-[#000a1e] text-white font-bold rounded-xl transition text-sm shadow-md"
                                >
                                    Submit Verified Review
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <Footer />

            <OrderModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} />
            <SignInModal isOpen={signInModalOpen} onClose={() => setSignInModalOpen(false)} />
        </div>
    );
};

export default ReviewsPage;
