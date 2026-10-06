import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import { REVIEW_STATS } from '../data/mockData';

interface FooterProps {
  onOpenOrder?: () => void;
  onOpenSignIn?: () => void;
  onNavigate?: (sectionId: string) => void;
}

const PHONE_DISPLAY = '+91 92636 06941';
const PHONE_TEL = 'tel:+919263606941';
const WHATSAPP_URL = 'https://wa.me/919263606941';
const SUPPORT_EMAIL = 'support@assignmentminds.com';

// Paste each profile URL here; icons without a URL stay visible but do nothing.
const SOCIAL_LINKS = {
  facebook: '',
  x: '',
  instagram: 'https://www.instagram.com/assignmentminds_/',
  pinterest: '',
  youtube: '',
  linkedin: '',
};

const SERVICE_LINKS = [
  { label: 'Assignment Help', to: '/p/assignment-help' },
  { label: 'Do My Assignment', to: '/p/do-my-assignment' },
  { label: 'Essay Writing Services', to: '/p/essay-help' },
  { label: 'University Assignment', to: '/p/university-assignment-help' },
  { label: 'Do My Homework', to: '/p/homework-help' },
  { label: 'Dissertation Writing Services', to: '/p/dissertation-help' },
  { label: 'Write My Assignment', to: '/p/write-my-assignment' },
  { label: 'Coursework Help', to: '/p/coursework-help' },
  { label: 'Thesis Help', to: '/p/thesis-help' },
  { label: "Master's Dissertation Help", to: '/p/masters-dissertation-help' },
  { label: 'College Assignment Help', to: '/p/college-assignment-help' },
];

const COMPANY_LINKS = [
  { label: 'About Us', to: '/about' },
  { label: 'Reviews', to: '/reviews' },
  { label: 'Contact Us', to: '/#contact-us' },
  { label: 'Blogs', to: '/blog' },
  { label: 'Experts', to: '/hire-writers' },
  { label: 'Samples', to: '/#samples' },
  { label: 'Find a Writer', to: '/hire-writers' },
];

const COUNTRY_LINKS = [
  { label: 'United Kingdom', to: '/p/uk-assignment-help' },
  { label: 'United States', to: '/p/assignment-help-usa' },
  { label: 'Malaysia', to: '/p/assignment-help-malaysia' },
  { label: 'Canada', to: '/p/assignment-help-canada' },
  { label: 'New Zealand', to: '/p/assignment-help-new-zealand' },
  { label: 'United Arab Emirates', to: '/p/assignment-help-uae' },
];

// Student guides for individual universities (independent; not affiliated).
const UNIVERSITY_LINKS = [
  { label: 'University of Salford', to: '/p/assignment-help-university-of-salford' },
  { label: 'University of East London', to: '/p/assignment-help-university-of-east-london' },
  { label: 'University of West London', to: '/p/assignment-help-university-of-west-london' },
  { label: 'University of Bedfordshire', to: '/p/assignment-help-university-of-bedfordshire' },
];

const POLICY_LINKS = [
  { label: 'Refund Policy', to: '/refund-policy' },
  { label: 'Cancellation Policy', to: '/cancellation-policy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Usage Policy', to: '/usage-policy' },
];

const linkClass = 'hover:text-white transition-colors';

const SocialIcon: React.FC<{ href: string; label: string; className: string; children: React.ReactNode }> = ({ href, label, className, children }) => {
  const base = `w-7 h-7 text-white flex items-center justify-center rounded-[3px] ${className}`;
  return href
    ? <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={`${base} hover:opacity-90`}>{children}</a>
    : <span aria-label={label} className={base}>{children}</span>;
};

const PaymentBadge: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-white h-[22px] px-2 rounded-[2px] flex items-center justify-center font-bold text-[10px] ${className}`}>{children}</div>
);

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="w-full bg-[#2a2a2a] text-[#c9c9c9] relative pt-16 pb-8 border-t-[8px] border-[#fea520]">

      <div className="max-w-[1360px] mx-auto px-6 md:px-12">

        {/* Top 4 Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">

          {/* Column 1 */}
          <div>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mb-6">Top Assignment Searches</h4>
            <ul className="flex flex-col gap-3.5 text-[13.5px] font-medium">
              {SERVICE_LINKS.map(l => <li key={l.to}><Link className={linkClass} to={l.to}>{l.label}</Link></li>)}
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mb-6">Our Company</h4>
            <ul className="flex flex-col gap-3.5 text-[13.5px] font-medium">
              {COMPANY_LINKS.map(l => <li key={l.label}><Link className={linkClass} to={l.to}>{l.label}</Link></li>)}
              <li><Link className={`${linkClass} text-[#fea520]`} to="/become-a-writer">Become a Writer</Link></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mb-6">Assignment by Countries</h4>
            <ul className="flex flex-col gap-3.5 text-[13.5px] font-medium">
              {COUNTRY_LINKS.map(l => <li key={l.to}><Link className={linkClass} to={l.to}>{l.label}</Link></li>)}
            </ul>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mt-8 mb-4">Popular Universities</h4>
            <ul className="flex flex-col gap-3.5 text-[13.5px] font-medium">
              {UNIVERSITY_LINKS.map(l => <li key={l.to}><Link className={linkClass} to={l.to}>{l.label}</Link></li>)}
            </ul>
          </div>

          {/* Column 4 */}
          <div>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mb-6">Contact Us</h4>

            <ul className="flex flex-col gap-3.5 text-[13.5px] mb-6">
              <li>
                <a href={PHONE_TEL} className={`flex items-center gap-3 ${linkClass}`}>
                  <Phone className="w-4 h-4 shrink-0 text-white" /> {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className={`flex items-center gap-3 ${linkClass}`}>
                  <MessageCircle className="w-4 h-4 shrink-0 text-white" /> {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className={`flex items-center gap-3 ${linkClass}`}>
                  <Mail className="w-4 h-4 shrink-0 text-white" /> {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>

            {/* Social Block */}
            <div className="flex gap-2">
              <SocialIcon href={SOCIAL_LINKS.facebook} label="Facebook" className="bg-[#1877F2]">f</SocialIcon>
              <SocialIcon href={SOCIAL_LINKS.x} label="X" className="bg-black text-[12px] font-bold">X</SocialIcon>
              <SocialIcon href={SOCIAL_LINKS.instagram} label="Instagram" className="bg-gradient-to-tr from-[#fbc2eb] via-[#a18cd1] to-[#e44d26] leading-none">ig</SocialIcon>
              <SocialIcon href={SOCIAL_LINKS.pinterest} label="Pinterest" className="bg-[#E60023] text-[13px] font-semibold">P</SocialIcon>
              <SocialIcon href={SOCIAL_LINKS.youtube} label="YouTube" className="bg-[#FF0000] text-[15px]">▶</SocialIcon>
              <SocialIcon href={SOCIAL_LINKS.linkedin} label="LinkedIn" className="bg-[#0A66C2] text-[12px] font-bold">in</SocialIcon>
            </div>
          </div>

        </div>

        {/* Divider */}
        <hr className="border-t border-[#444] my-10" />

        {/* Bottom Part 1: Links & Payments */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="text-[13px] text-white font-medium flex flex-wrap gap-2.5">
            {POLICY_LINKS.map(l => (
              <React.Fragment key={l.to}>
                <Link to={l.to} className="hover:text-gray-300 transition-colors">{l.label}</Link>
                <span className="text-gray-600">|</span>
              </React.Fragment>
            ))}
            <a href="/sitemap.xml" className="hover:text-gray-300 transition-colors">Sitemap</a>
          </div>

          {/* Payment methods accepted through Razorpay */}
          <div className="flex items-center gap-1.5 flex-wrap" aria-label="Accepted payment methods">
            <PaymentBadge className="text-[#097939]">UPI</PaymentBadge>
            <PaymentBadge className="text-[#1a1f71] italic">VISA</PaymentBadge>
            <PaymentBadge className="px-1.5" >
              <span className="flex relative items-center justify-center w-6 h-3 overflow-hidden" aria-label="Mastercard">
                <span className="w-3 h-3 bg-[#eb001b] rounded-full opacity-90 absolute left-0.5" />
                <span className="w-3 h-3 bg-[#f79e1b] rounded-full opacity-90 absolute left-2.5" />
              </span>
            </PaymentBadge>
            <PaymentBadge className="text-[#1b3281] italic">RuPay</PaymentBadge>
          </div>
        </div>

        {/* Bottom Part 2: Disclaimer & Copyright */}
        <div className="flex flex-col gap-4 text-[#888] text-[12px] pr-0 xl:pr-32">
          <p className="leading-relaxed">
            Disclaimer: AssignmentMinds offers custom assignment writing help to students along with proofreading and editing services. We provide references of reliable resources which are for knowledge purposes only and cannot be used for direct submission in university.
          </p>
          <div className="flex flex-col md:flex-row justify-between pt-2 items-start md:items-center">
            <p className="text-white">
              © Copyright {new Date().getFullYear()} @ AssignmentMinds. All Rights Reserved
            </p>
            {REVIEW_STATS.count > 0 && (
              <p className="text-white font-medium mt-2 md:mt-0">
                Assignment Help Rated <span className="font-bold">{REVIEW_STATS.average.toFixed(1)}/5</span> based on <Link to="/reviews" className="underline decoration-yellow-500 underline-offset-2 hover:text-[#fea520] transition-colors">{REVIEW_STATS.count} {REVIEW_STATS.count === 1 ? 'Review' : 'Reviews'}</Link>
              </p>
            )}
          </div>
        </div>

      </div>

    </footer>
  );
};
