/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { lazyPage } from '../lib/lazyPage';
import { usePageMeta } from '../lib/usePageMeta';
import { Calculator } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { ScrollReveal, mountAllSections } from '../components/ScrollReveal';
import { Hero } from '../components/Hero';
import { StatsBar } from '../components/StatsBar';
import { AssistanceBanner } from '../components/AssistanceBanner';
import type { ToolType } from '../components/AcademicToolsSection';
import { Footer } from '../components/Footer';
import { SideDrawer } from '../components/SideDrawer';
import { TopUtilityBar } from '../components/TopUtilityBar';
import { SubjectsSection } from '../components/catalog/SubjectsDirectory';
import { FloatingElements } from '../components/FloatingElements';
import { Consultant, Discipline, ServiceType, SubjectType } from '../types';
import type { OrderQuote } from '../lib/orderQuote';
import type { Coupon } from '../lib/charges';
import { MobileActionBar } from '../components/MobileActionBar';

// Modals are only downloaded when first opened (they render nothing while closed).
// Below-the-fold sections: their code loads when they come into view (see ScrollReveal).
const ConsultantsSection = React.lazy(() => import('../components/ConsultantsSection').then(m => ({ default: m.ConsultantsSection })));
const ServicesTabs = React.lazy(() => import('../components/ServicesTabs').then(m => ({ default: m.ServicesTabs })));
const TimelineJourney = React.lazy(() => import('../components/TimelineJourney').then(m => ({ default: m.TimelineJourney })));
const TrustLogosMarquee = React.lazy(() => import('../components/TrustLogosMarquee').then(m => ({ default: m.TrustLogosMarquee })));
const SamplesShowcase = React.lazy(() => import('../components/SamplesShowcase').then(m => ({ default: m.SamplesShowcase })));
const Disciplines = React.lazy(() => import('../components/Disciplines').then(m => ({ default: m.Disciplines })));
const WhyChooseUs = React.lazy(() => import('../components/WhyChooseUs').then(m => ({ default: m.WhyChooseUs })));
const BlogGrid = React.lazy(() => import('../components/BlogGrid').then(m => ({ default: m.BlogGrid })));
const FaqSection = React.lazy(() => import('../components/FaqSection').then(m => ({ default: m.FaqSection })));
const CtaBanner = React.lazy(() => import('../components/CtaBanner').then(m => ({ default: m.CtaBanner })));
const ReviewsSection = React.lazy(() => import('../components/ReviewsSection').then(m => ({ default: m.ReviewsSection })));
const JoinAsWriterSection = React.lazy(() => import('../components/JoinAsWriterSection').then(m => ({ default: m.JoinAsWriterSection })));
const ContactSection = React.lazy(() => import('../components/ContactSection').then(m => ({ default: m.ContactSection })));
const AcademicToolsSection = React.lazy(() => import('../components/AcademicToolsSection').then(m => ({ default: m.AcademicToolsSection })));
const OrderModal = lazyPage(() => import('../components/OrderModal').then(m => ({ default: m.OrderModal })));
const ConsultantModal = lazyPage(() => import('../components/ConsultantModal').then(m => ({ default: m.ConsultantModal })));
const ToolModal = lazyPage(() => import('../components/ToolModal').then(m => ({ default: m.ToolModal })));
const DisciplineModal = lazyPage(() => import('../components/DisciplineModal').then(m => ({ default: m.DisciplineModal })));
const SignInModal = lazyPage(() => import('../components/SignInModal').then(m => ({ default: m.SignInModal })));

// Renders every deferred section, waits for `id` to exist, then scrolls to it
// (below the sticky header). Sections above may still be filling in, so the
// position is corrected once more after they settle.
function scrollToSection(id: string) {
  mountAllSections();
  const go = (smooth: boolean) => {
    const el = document.getElementById(id);
    if (!el) return false;
    const header = (document.querySelector('.sticky.top-0') as HTMLElement | null)?.offsetHeight || 0;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header, behavior: smooth ? 'smooth' : 'auto' });
    return true;
  };
  let tries = 0;
  const timer = setInterval(() => {
    if (go(true) || ++tries > 40) {
      clearInterval(timer);
      setTimeout(() => go(false), 900);
    }
  }, 75);
}

export default function App() {
  usePageMeta('/');
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
    coupon?: Coupon;
    couponCode?: string;
  }>({});

  const [activeSection, setActiveSection] = useState<string>('academic-support');

  React.useEffect(() => {
    // Other components open the order form with this event (optionally with a coupon code).
    const handleGlobalOrder = (e: Event) => {
      const couponCode = (e as CustomEvent<{ couponCode?: string }>).detail?.couponCode;
      handleOpenOrder(couponCode ? { couponCode } : undefined);
    };
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
    coupon?: Coupon;
    couponCode?: string;
  }) => {
    if (prefill && Object.keys(prefill).length > 0) {
      setOrderPrefill(prefill);
    } else {
      setOrderPrefill({}); // Reset to empty if opened from general Nav button
    }
    setOrderModalOpen(true);
  };

  // Links like /#contact-us (e.g. from the footer on another page) scroll to
  // that section once it has rendered; lazy sections can take a moment.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) scrollToSection(decodeURIComponent(hash.slice(1)));
  }, [hash]);


  const handleScrollToTimeline = () => scrollToSection('how-it-works-section');

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'academic-support') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (sectionId === 'technical-support') {
      scrollToSection('explore-disciplines');
    } else if (sectionId === 'learning-support') {
      scrollToSection('elite-consultants');
    } else if (sectionId === 'academic-tools') {
      scrollToSection('academic-tools-section');
    } else if (sectionId === 'elite-consultants') {
      scrollToSection('elite-consultants');
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
    <div className="min-h-screen bg-white flex flex-col font-sans relative z-0">

      {/* Top bar and navbar stay pinned together while the page scrolls. */}
      <div className="sticky top-0 z-50">
        <TopUtilityBar />
        <Navbar
          onOpenOrder={() => handleOpenOrder()}
          onOpenSignIn={() => setSignInModalOpen(true)}
          onOpenDrawer={() => setDrawerOpen(true)}
          activeSection={activeSection}
          onNavigate={handleNavigate}
        />
      </div>

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
            onViewAll={() => scrollToSection('explore-disciplines')}
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

      {/* Phones: WhatsApp / quote / order always at the bottom. */}
      <MobileActionBar onQuote={() => setDrawerOpen(true)} onOrder={() => handleOpenOrder()} />

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
    </div>
  );
}
