/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { ScrollReveal } from '../components/ScrollReveal';
import { Hero } from '../components/Hero';
import { StatsBar } from '../components/StatsBar';
import { Disciplines } from '../components/Disciplines';
import { TimelineJourney } from '../components/TimelineJourney';
import { ConsultantsSection } from '../components/ConsultantsSection';
import { WhyChooseUs } from '../components/WhyChooseUs';
import { CtaBanner } from '../components/CtaBanner';
import { AssistanceBanner } from '../components/AssistanceBanner';
import { FaqSection } from '../components/FaqSection';
import { ToolType } from '../components/AcademicToolsSection';
import { ReviewsSection } from '../components/ReviewsSection';
import { ContactSection } from '../components/ContactSection';
import { Footer } from '../components/Footer';
import { SideDrawer } from '../components/SideDrawer';
import { AcademicToolsSection } from '../components/AcademicToolsSection';
import { TopUtilityBar } from '../components/TopUtilityBar';
import { ServicesTabs } from '../components/ServicesTabs';
import { SubjectsSection } from '../components/catalog/SubjectsDirectory';
import { TrustLogosMarquee } from '../components/TrustLogosMarquee';
import { SamplesShowcase } from '../components/SamplesShowcase';
import { BlogGrid } from '../components/BlogGrid';
import { FloatingElements } from '../components/FloatingElements';
import { PopupFunnel } from '../components/PopupFunnel';
import { JoinAsWriterSection } from '../components/JoinAsWriterSection';
import { Consultant, Discipline, ServiceType, SubjectType } from '../types';
import type { OrderQuote } from '../lib/orderQuote';

// Modals are only downloaded when first opened (they render nothing while closed).
const OrderModal = lazy(() => import('../components/OrderModal').then(m => ({ default: m.OrderModal })));
const ConsultantModal = lazy(() => import('../components/ConsultantModal').then(m => ({ default: m.ConsultantModal })));
const ToolModal = lazy(() => import('../components/ToolModal').then(m => ({ default: m.ToolModal })));
const DisciplineModal = lazy(() => import('../components/DisciplineModal').then(m => ({ default: m.DisciplineModal })));
const SignInModal = lazy(() => import('../components/SignInModal').then(m => ({ default: m.SignInModal })));

export default function App() {
  // Modal & Drawer visibility states
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false);
  const [signInModalOpen, setSignInModalOpen] = useState<boolean>(false);

  // Selected details
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null);

  // Prefill order data
  const [orderPrefill, setOrderPrefill] = useState<{
    service?: ServiceType;
    subject?: SubjectType;
    pages?: number;
    deadline?: string;
    academicLevel?: 'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional';
    topicTitle?: string;
    instructions?: string;
    files?: string[];
    fileObjects?: File[];
    quote?: OrderQuote;
  }>({});

  const [activeSection, setActiveSection] = useState<string>('academic-support');

  React.useEffect(() => {
    const handleGlobalOrder = () => handleOpenOrder();
    window.addEventListener('open-order-modal', handleGlobalOrder);
    return () => window.removeEventListener('open-order-modal', handleGlobalOrder);
  }, []);

  const handleOpenOrder = (prefill?: {
    service?: ServiceType;
    subject?: SubjectType;
    pages?: number;
    deadline?: string;
    academicLevel?: 'Undergraduate' | 'Master\'s' | 'PhD / Doctoral' | 'Professional';
    topicTitle?: string;
    instructions?: string;
    files?: string[];
    fileObjects?: File[];
    quote?: OrderQuote;
  }) => {
    if (prefill && Object.keys(prefill).length > 0) {
      setOrderPrefill(prefill);
    } else {
      setOrderPrefill({}); // Reset to empty if opened from general Nav button
    }
    setOrderModalOpen(true);
  };

  const handleScrollToTimeline = () => {
    const el = document.getElementById('how-it-works-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'academic-support') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionId === 'technical-support') {
      const el = document.getElementById('explore-disciplines');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionId === 'learning-support') {
      const el = document.getElementById('elite-consultants');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionId === 'academic-tools') {
      const el = document.getElementById('academic-tools-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (sectionId === 'elite-consultants') {
      const el = document.getElementById('elite-consultants');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDisciplineOrderStart = (disciplineTitle: string) => {
    let matchedSubj: SubjectType = 'Business & Mgt';
    if (disciplineTitle.includes('STEM')) matchedSubj = 'Engineering & STEM';
    else if (disciplineTitle.includes('Humanities')) matchedSubj = 'Literature & Humanities';
    else if (disciplineTitle.includes('Business')) matchedSubj = 'Business & Mgt';
    else if (disciplineTitle.includes('Medical')) matchedSubj = 'Medical & Healthcare';

    handleOpenOrder({
      service: 'Academic Writing',
      subject: matchedSubj,
      pages: 8,
      deadline: '2026-08-30'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative z-0">

      {/* --- Ambient Background Globs for Global Website Aesthetic --- */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] opacity-70">
        <div className="absolute top-[-5%] left-[-10%] w-[500px] h-[500px] bg-[#fea520] rounded-full blur-[200px] opacity-[0.12] mix-blend-multiply"></div>
        <div className="absolute top-[35%] right-[-10%] w-[600px] h-[600px] bg-[#fea520] rounded-full blur-[200px] opacity-[0.12] mix-blend-multiply"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[800px] h-[800px] bg-[#002147] rounded-full blur-[250px] opacity-[0.08] mix-blend-multiply"></div>
      </div>

      {/* Mobile rotate barrier */}
      <div className="hidden max-[768px]:landscape:flex fixed inset-0 z-[999] bg-[#000a1e] text-white flex-col items-center justify-center p-6 text-center">
        <div className="animate-bounce mb-4 text-[#fea520]">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Please Rotate Your Device</h2>
        <p className="text-sm text-gray-300">This website is best viewed in portrait mode on mobile devices.</p>
      </div>

      <TopUtilityBar />
      <Navbar
        onOpenOrder={() => handleOpenOrder()}
        onOpenSignIn={() => setSignInModalOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      <main className="flex-grow">
        {/* Intro sequence handled internally */}
        <Hero
          onOpenOrder={handleOpenOrder}
          onScrollToTimeline={handleScrollToTimeline}
        />

        <ScrollReveal>
          <AssistanceBanner onOpenOrder={() => handleOpenOrder()} />
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <StatsBar />
        </ScrollReveal>

        <ScrollReveal>
          <ConsultantsSection
            onConsult={(consultant) => setSelectedConsultant(consultant)}
          />
        </ScrollReveal>

        <ScrollReveal>
          <ServicesTabs />
        </ScrollReveal>

        {/* Subjects published in Admin → Catalog (hidden while there are none). */}
        <SubjectsSection />

        <ScrollReveal>
          <TimelineJourney
            onStartOrder={() => handleOpenOrder()}
          />
        </ScrollReveal>

        <ScrollReveal>
          <TrustLogosMarquee />
        </ScrollReveal>

        <ScrollReveal>
          <AcademicToolsSection
            onOpenTool={(tool) => setSelectedTool(tool)}
          />
        </ScrollReveal>

        <ScrollReveal>
          <SamplesShowcase onOpenAction={() => setSignInModalOpen(true)} />
        </ScrollReveal>

        <ScrollReveal>
          <Disciplines
            onSelectDiscipline={(disc) => setSelectedDiscipline(disc)}
            onViewAll={() => {
              const el = document.getElementById('explore-disciplines');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </ScrollReveal>

        <ScrollReveal>
          <WhyChooseUs />
        </ScrollReveal>

        <ScrollReveal>
          <BlogGrid />
        </ScrollReveal>

        <ScrollReveal>
          <FaqSection />
        </ScrollReveal>

        <ScrollReveal>
          <CtaBanner onOrderClick={() => handleOpenOrder()} />
        </ScrollReveal>

        <ScrollReveal>
          <ReviewsSection />
        </ScrollReveal>

        <ScrollReveal>
          <JoinAsWriterSection />
        </ScrollReveal>

        <ScrollReveal>
          <ContactSection />
        </ScrollReveal>
      </main>

      <Footer
        onOpenOrder={() => handleOpenOrder()}
        onOpenSignIn={() => setSignInModalOpen(true)}
        onNavigate={handleNavigate}
      />

      {/* Sticky Right "COST CALC" Trigger Button */}
      <button
        id="sideNavToggle"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open Cost Calculator Drawer"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] hover:text-white px-3 py-4 rounded-l-2xl shadow-soft font-bold flex flex-col items-center gap-1.5 transition-all duration-300 hover:pr-4 cursor-pointer group"
      >
        <Calculator className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="text-[10px] tracking-wider uppercase [writing-mode:vertical-lr] rotate-180 font-extrabold">
          COST CALC
        </span>
      </button>

      {/* Right Slide-out Drawer */}
      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onProceedToOrder={(cfg) => handleOpenOrder(cfg)}
      />

      {/* Interactive Modals (loaded on first open) */}
      <Suspense fallback={null}>
        {orderModalOpen && (
          <OrderModal
            isOpen={orderModalOpen}
            onClose={() => setOrderModalOpen(false)}
            initialConfig={orderPrefill}
          />
        )}

        {selectedConsultant && (
          <ConsultantModal
            consultant={selectedConsultant}
            onClose={() => setSelectedConsultant(null)}
          />
        )}

        {selectedTool && (
          <ToolModal
            toolType={selectedTool}
            onClose={() => setSelectedTool(null)}
            onSwitchTool={(type) => setSelectedTool(type)}
          />
        )}

        {selectedDiscipline && (
          <DisciplineModal
            discipline={selectedDiscipline}
            onClose={() => setSelectedDiscipline(null)}
            onStartOrderForDiscipline={handleDisciplineOrderStart}
          />
        )}

        {signInModalOpen && (
          <SignInModal
            isOpen={signInModalOpen}
            onClose={() => setSignInModalOpen(false)}
          />
        )}
      </Suspense>

      <PopupFunnel />
    </div>
  );
}
