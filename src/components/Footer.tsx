import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MessageCircle, ArrowUp } from 'lucide-react';

interface FooterProps {
  onOpenOrder?: () => void;
  onOpenSignIn?: () => void;
  onNavigate?: (sectionId: string) => void;
}

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
              <li><a className="hover:text-white transition-colors" href="#">Do My Assignment</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Essay Writing Services</a></li>
              <li><a className="hover:text-white transition-colors" href="#">University Assignment</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Do My Homework</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Dissertation Writing Services</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Write My Assignment</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Coursework Help</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Thesis Help</a></li>
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mb-6">Our Company</h4>
            <ul className="flex flex-col gap-3.5 text-[13.5px] font-medium">
              <li><a className="hover:text-white transition-colors" href="#">About Us</a></li>
              <li><Link className="hover:text-white transition-colors" to="/reviews">Reviews</Link></li>
              <li><a className="hover:text-white transition-colors" href="#">Contact Us</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Blogs</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Experts</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Samples</a></li>
              <li><a className="hover:text-white transition-colors" href="/hire-writers">Find a Writer</a></li>
              <li><a className="hover:text-white transition-colors text-[#fea520]" href="/become-a-writer">Become a Writer</a></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mb-6">Assignment by Countries</h4>
            <ul className="flex flex-col gap-3.5 text-[13.5px] font-medium">
              <li><a className="hover:text-white transition-colors" href="#">United States</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Malaysia</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Canada</a></li>
              <li><a className="hover:text-white transition-colors" href="#">New Zealand</a></li>
              <li><a className="hover:text-white transition-colors" href="#">United Arab Emirates</a></li>
            </ul>
          </div>

          {/* Column 4 */}
          <div>
            <h4 className="font-bold text-white text-[15px] uppercase tracking-wide mb-6">Contact Us</h4>

            <ul className="flex flex-col gap-3.5 text-[13.5px] mb-6">
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 shrink-0 text-white" />
                <span className="hover:text-white cursor-pointer">+91 92636 06941</span>
              </li>
              <li className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 shrink-0 text-white" />
                <span className="hover:text-white cursor-pointer">+91 92636 06941</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 shrink-0 text-white" />
                <span className="hover:text-white cursor-pointer">assignmentminds@gmail.com</span>
              </li>
            </ul>

            {/* Social Block */}
            <div className="flex gap-2 mb-8">
              <a href="#" className="w-7 h-7 bg-[#1877F2] text-white flex items-center justify-center rounded-[3px] hover:opacity-90">f</a>
              <a href="#" className="w-7 h-7 bg-black text-white flex items-center justify-center rounded-[3px] hover:opacity-90 text-[12px] font-bold">X</a>
              <a href="#" className="w-7 h-7 bg-gradient-to-tr from-[#fbc2eb] via-[#a18cd1] to-[#e44d26] text-white flex items-center justify-center rounded-[3px] hover:opacity-90 leading-none">ig</a>
              <a href="#" className="w-7 h-7 bg-[#E60023] text-white flex items-center justify-center rounded-[3px] hover:opacity-90 text-[13px] font-semibold">P</a>
              <a href="#" className="w-7 h-7 bg-[#FF0000] text-white flex items-center justify-center rounded-[3px] hover:opacity-90 text-[15px]">▶</a>
              <a href="#" className="w-7 h-7 bg-[#0A66C2] text-white flex items-center justify-center rounded-[3px] hover:opacity-90 text-[12px] font-bold">in</a>
            </div>

            {/* App Block */}
            <h5 className="font-bold text-white text-[14px] mb-3">Download App</h5>
            <div className="flex gap-3">
              <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" className="h-[30px] border border-gray-600 rounded bg-black cursor-pointer" />
              <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-[30px] rounded cursor-pointer border border-[#888]" />
            </div>
          </div>

        </div>

        {/* Divider */}
        <hr className="border-t border-[#444] my-10" />

        {/* Bottom Part 1: Links & Payments */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="text-[13px] text-white font-medium flex flex-wrap gap-2.5">
            <a href="#" className="hover:text-gray-300 transition-colors">Refund Policy</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Cancellation Policy</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms & Conditions</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Usage Policy</a>
            <span className="text-gray-600">|</span>
            <a href="#" className="hover:text-gray-300 transition-colors">Sitemap</a>
          </div>

          {/* Payment & Trust Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Simulated DMCA */}
            <div className="flex mr-2">
              <div className="bg-[#8ec252] text-white text-[10px] font-bold px-1.5 py-1 rounded-l border border-[#8ec252]">DMCA</div>
              <div className="bg-[#222222] text-white text-[10px] font-bold px-1.5 py-1 rounded-r border border-l-0 border-[#222]">PROTECTED</div>
            </div>
            {/* Emulated Payment Icons */}
            <div className="bg-white h-[22px] px-2 rounded-[2px] flex items-center justify-center font-bold text-[#003087] text-[10px] italic">PayPal</div>
            <div className="bg-white h-[22px] px-2 rounded-[2px] flex items-center justify-center font-bold text-[#1a1f71] text-[10px] italic">VISA</div>
            <div className="bg-white h-[22px] px-1.5 rounded-[2px] flex items-center justify-center">
              <div className="flex relative items-center justify-center w-6 overflow-hidden">
                <div className="w-3 h-3 bg-red-600 rounded-full opacity-90 absolute left-0"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full opacity-90 absolute left-2"></div>
              </div>
            </div>
            <div className="bg-white h-[22px] px-2 rounded-[2px] flex items-center justify-center font-bold text-[#231f20] tracking-tighter text-[10px]">Maestro</div>
            <div className="bg-white h-[22px] px-2 rounded-[2px] flex flex-col items-center justify-center font-bold text-[#006fcf] text-[6px] leading-[7px]"><span>AMERICAN</span><span>EXPRESS</span></div>
          </div>
        </div>

        {/* Bottom Part 2: Disclaimer & Copyright */}
        <div className="flex flex-col gap-4 text-[#888] text-[12px] pr-0 xl:pr-32">
          <p className="leading-relaxed">
            Disclaimer : Instant Assignment help offers custom assignment writing help to the students along with proofreading and editing services. We provide references of reliable resources which are for knowledge purpose only and cannot be used for direct submission in university.
          </p>
          <div className="flex flex-col md:flex-row justify-between pt-2 items-start md:items-center">
            <p className="text-white">
              © Copyright 2026 @ AssignmentMinds. All Rights Reserved
            </p>
            <p className="text-white font-medium mt-2 md:mt-0">
              Assignment Help Rated <span className="font-bold">4.8/5</span> based on <Link to="/reviews" className="underline decoration-yellow-500 underline-offset-2 hover:text-[#fea520] transition-colors">5768 Reviews</Link>
            </p>
          </div>
        </div>

      </div>

    </footer>
  );
};
