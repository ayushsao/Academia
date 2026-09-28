import React, { useState } from 'react';
import { Search, ShoppingCart, Menu, ChevronDown, User, LogOut, BadgeCheck, PenLine } from 'lucide-react';
import { BrandLogo } from './AcademiaLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useNavigate, Link } from 'react-router-dom';
import { useFeaturedWriters, FeaturedWriterLink, SampleWriterItem, SAMPLE_WRITERS } from './writer/FeaturedWriters';

interface NavbarProps {
  onOpenOrder: () => void;
  onOpenSignIn: () => void;
  onOpenDrawer: () => void;
  activeSection: string;
  onNavigate: (section: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenOrder, onOpenSignIn, onOpenDrawer }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedMenu, setMobileExpandedMenu] = useState<string | null>(null);
  const featuredWriters = useFeaturedWriters();

  const user = useStore(state => state.user);
  const orders = useStore(state => state.orders);
  const logout = useStore(state => state.logout);
  // The writer portal is a separate sign-in: it never shows as the account here, only as a link.
  const writerSignedIn = useStore(state => Boolean(state.writer));
  const navigate = useNavigate();

  const activeOrderCount = orders ? orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length : 0;

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Services', hasDropdown: true },
    { label: 'Resources', hasDropdown: false, to: '/resources' },
    { label: 'Hire Writers', hasDropdown: true },
    { label: 'Reviews', hasDropdown: false, to: '/reviews' },
    { label: 'Blogs', hasDropdown: false, to: '/blog' },
    { label: 'Academic Tools', hasDropdown: true },
  ];

  return (
    <nav className={`w-full z-50 transition-all duration-300 sticky top-0 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-[0_2px_16px_rgba(30,58,95,0.08)] py-3 border-b border-[#e5e7eb]/60' : 'bg-white py-4 border-b border-[#f0f2f5]'}`}>
      <div className="w-full pl-2 pr-4 md:pl-4 md:pr-8 2xl:pl-6 2xl:pr-12 flex items-center justify-between gap-4">

        {/* Logo */}
        <div className="flex shrink-0 items-center cursor-pointer" onClick={() => navigate('/')}>
          <BrandLogo iconClassName="h-9 sm:h-10" textClassName="text-[20px] sm:text-[24px]" />
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden xl:flex items-center gap-4 2xl:gap-8">
          {navLinks.map((link, idx) => (
            <div key={idx} className="group relative flex items-center gap-1 whitespace-nowrap text-[#374151] hover:text-[#eb6200] font-medium text-sm transition-colors py-4">
              <span onClick={() => { if (!link.hasDropdown) navigate(link.to || `/p/${link.label.toLowerCase().replace(/ /g, '-')}`); }} className="cursor-pointer">{link.label}</span>
              {link.hasDropdown && <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-[#fea520] transition-colors cursor-pointer" />}

              {/* SERVICES MEGA MENU */}
              {link.hasDropdown && link.label === 'Services' && (
                <div className="absolute top-full -left-6 mt-0 w-[800px] max-w-[calc(100vw-2rem)] bg-white rounded-b-xl rounded-t-sm shadow-[0_10px_40px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-6 border border-gray-100">
                  <div className="grid grid-cols-3 gap-8">

                    {/* Column 1: Writing */}
                    <div className="flex flex-col gap-3">
                      <h3 className="font-bold text-[#000a1e] text-[15px] mb-2 border-b border-gray-100 pb-2">Writing</h3>
                      {[
                        'Essay Editing Service',
                        'MBA Essay Writing Service',
                        'Essay Help',
                        'Research Proposal Writing Service',
                        'Research Paper Writing',
                        'Ghost Writer'
                      ].map((item, i) => (
                        <div
                          key={i}
                          onClick={() => navigate(`/p/${item.toLowerCase().replace(/ /g, '-')}`)}
                          className="text-[13px] text-[#555] hover:text-[#fea520] cursor-pointer transition-colors"
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    {/* Column 2: Problem Solving */}
                    <div className="flex flex-col gap-3">
                      <h3 className="font-bold text-[#000a1e] text-[15px] mb-2 border-b border-gray-100 pb-2">Problem Solving</h3>
                      {[
                        'Programming Assignment Help',
                        'Assessment Help',
                        'Pay Someone To Do My Homework',
                        'Take My Online Class'
                      ].map((item, i) => (
                        <div
                          key={i}
                          onClick={() => navigate(`/p/${item.toLowerCase().replace(/ /g, '-')}`)}
                          className="text-[13px] text-[#555] hover:text-[#fea520] cursor-pointer transition-colors"
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    {/* Column 3: More Services */}
                    <div className="flex flex-col gap-3">
                      <h3 className="font-bold text-[#000a1e] text-[15px] mb-2 border-b border-gray-100 pb-2">More Services</h3>
                      {[
                        'Take My Online Exam',
                        'Dissertation Help',
                        'Term Paper Help',
                        'Homework Help',
                        'Case Study Help',
                        'Coursework Help',
                        'Thesis Help',
                        'Powerpoint Presentation Services'
                      ].map((item, i) => (
                        <Link
                          key={i}
                          to={`/p/${item.toLowerCase().replace(/ /g, '-')}`}
                          className="text-[13px] text-[#555] hover:text-[#fea520] cursor-pointer transition-colors block"
                        >
                          {item}
                        </Link>
                      ))}
                    </div>

                  </div>
                </div>
              )}

              {/* Academic Tools Dropdown Menu */}
              {link.hasDropdown && link.label === 'Academic Tools' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-80 bg-white rounded-b-xl rounded-t-sm shadow-[0_10px_40px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="w-full flex flex-col pt-1 bg-white rounded-b-xl border border-gray-100 overflow-hidden">
                    {[
                      'Free Paraphrasing Tool',
                      'Free Grammar Checker',
                      'Free Plagiarism Checker',
                      'Turnitin Plagiarism Checker',
                      'Inception AI Research Assistant',
                      'Free Essay Typer',
                      'Free Dissertation Outline\nGenerator',
                      'Free Thesis Statement Generator',
                      'Referencing Tool',
                      'AI Essay Writer',
                      'AI Humanizer'
                    ].map((item, i, arr) => (
                      <Link
                        key={i}
                        to={`/p/${item.replace(/\n/g, ' ').toLowerCase().replace(/ /g, '-')}`}
                        className={`block px-5 py-3 hover:bg-[#fff9f0] hover:text-[#fea520] text-[#2d2d2d] text-[14px] font-medium transition-colors cursor-pointer ${i !== arr.length - 1 ? 'border-b border-[#fea520]/20' : ''}`}
                      >
                        {item.includes('\n') ? item.split('\n').map((line, j) => <span key={j} className="block">{line}</span>) : item}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {/* HIRE WRITERS MEGA MENU */}
              {link.hasDropdown && link.label === 'Hire Writers' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-[950px] bg-white rounded-b-xl rounded-t-sm shadow-[0_10px_40px_rgba(0,0,0,0.15)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-6 border border-gray-100">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="font-extrabold text-[#000a1e] text-lg">Academic writers</h3>
                      <p className="text-xs text-gray-500 font-medium">{featuredWriters?.length === 0 ? <>Sample profiles for now — our writers appear here as they join.</> : <>Writers from our network. <BadgeCheck className="inline h-3 w-3 text-[#b86e00]" aria-label="verified" /> marks writers who passed our review.</>}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {featuredWriters === null
                      ? Array.from({ length: 8 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" />)
                      : featuredWriters.length === 0
                        ? SAMPLE_WRITERS.map(sw => <React.Fragment key={sw.slug}><SampleWriterItem s={sw} onClick={() => navigate(`/hire-writers#sample-${sw.slug}`)} /></React.Fragment>)
                        : featuredWriters.map(w => <React.Fragment key={w.id}><FeaturedWriterLink w={w} /></React.Fragment>)}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <Link to="/hire-writers" className="text-xs font-bold text-[#002147] hover:text-[#e36100] transition-colors">Browse all writers →</Link>
                    <Link to="/become-a-writer" className="flex items-center gap-2 text-xs font-bold text-[#002147] bg-[#002147]/5 hover:bg-[#002147]/10 px-3 py-2 rounded-lg transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#fea520]" /> Are you an academic expert? Join as a writer
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Side Tools */}
        <div className="hidden xl:flex shrink-0 items-center gap-3 2xl:gap-4">
          <button className="hidden 2xl:block text-[#2d2d2d] hover:text-[#fea520] transition-colors p-2">
            <Search className="w-5 h-5" />
          </button>

          <button onClick={onOpenOrder} className="bg-[#eb6200] hover:bg-[#d45600] text-white font-bold px-5 2xl:px-6 py-2.5 rounded-md text-sm shadow-[0_2px_10px_rgba(235,98,0,0.30)] transition-all whitespace-nowrap">
            Order Now
          </button>

          {writerSignedIn && (
            <Link to="/writer/dashboard" title="Writer Dashboard" aria-label="Writer Dashboard" className="flex items-center gap-1.5 p-2 2xl:p-0 text-sm font-semibold text-[#002147] hover:text-[#e36100] transition-colors whitespace-nowrap">
              <PenLine className="w-5 h-5 2xl:hidden" /><span className="hidden 2xl:inline">Writer Dashboard</span>
            </Link>
          )}

          {user ? (
            <div className="relative group cursor-pointer">
              <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/70 backdrop-blur-xl border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] hover:bg-white hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)] active:scale-[0.97] transition-all duration-300 ease-out">
                <span className="w-8 h-8 rounded-full bg-gradient-to-b from-[#1d2b45] to-[#000a1e] text-white text-[13px] font-semibold flex items-center justify-center ring-2 ring-white shadow-inner">
                  {user.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[90px] truncate text-[14px] font-medium tracking-[-0.01em] text-[#1d1d1f]">{user.name.split(' ')[0]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#86868b] transition-transform duration-300 group-hover:rotate-180" />
              </button>

              <div className="absolute top-full right-0 pt-2.5 w-64 opacity-0 invisible translate-y-1 scale-[0.98] origin-top-right group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:scale-100 transition-all duration-300 ease-out z-50">
                <div className="bg-white/80 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-black/[0.06] shadow-[0_12px_48px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden p-1.5">
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-b from-[#1d2b45] to-[#000a1e] text-white text-[15px] font-semibold flex items-center justify-center">
                      {user.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#1d1d1f] truncate">{user.name}</p>
                      <p className="text-[12px] text-[#86868b] truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="h-px bg-black/[0.06] mx-2 my-1" />
                  <div onClick={() => navigate('/dashboard')} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14px] text-[#1d1d1f] hover:bg-black/[0.04] transition-colors cursor-pointer">
                    <User className="w-4 h-4 text-[#86868b]" /> My Dashboard
                  </div>
                  <div onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14px] text-[#ff3b30] hover:bg-[#ff3b30]/[0.06] transition-colors cursor-pointer">
                    <LogOut className="w-4 h-4" /> Log out
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={onOpenSignIn} className="bg-[#000a1e] hover:bg-[#002147] text-white font-bold px-5 py-2.5 rounded text-sm shadow-sm transition-colors flex items-center gap-2">
              Login
            </button>
          )}

          <button onClick={() => { if (user) { navigate('/dashboard'); } else { onOpenSignIn(); } }} className="text-[#2d2d2d] hover:text-[#fea520] transition-colors p-2 relative">
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute top-0 right-0 bg-[#fea520] text-[#000a1e] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center -translate-y-1 translate-x-1 shadow-sm">{activeOrderCount}</span>
          </button>

          <button onClick={onOpenDrawer} className="text-[#000a1e] hover:text-[#fea520] transition-colors p-2 ml-2">
            <Menu className="w-7 h-7" />
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex xl:hidden items-center gap-3">
          <button onClick={() => { if (user) { navigate('/dashboard'); } else { onOpenSignIn(); } }} className="text-[#2d2d2d] p-1 relative">
            <ShoppingCart className="w-5 h-5" />
            <span className="absolute top-0 right-0 bg-[#fea520] text-[#000a1e] text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center -translate-y-1 translate-x-1 shadow-sm">{activeOrderCount}</span>
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-[#000a1e] p-1">
            <Menu className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="xl:hidden absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-100 overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-4">
              {navLinks.map((link, idx) => (
                <div key={idx} className="flex flex-col border-b border-gray-100">
                  <div
                    onClick={() => {
                      if (!link.hasDropdown) {
                        setMobileMenuOpen(false);
                        navigate((link as any).to || `/p/${link.label.toLowerCase().replace(/ /g, '-')}`);
                      } else {
                        setMobileExpandedMenu(mobileExpandedMenu === link.label ? null : link.label);
                      }
                    }}
                    className="font-medium text-[#2d2d2d] pb-2 cursor-pointer pt-1 flex justify-between items-center"
                  >
                    {link.label}
                    {link.hasDropdown && <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${mobileExpandedMenu === link.label ? 'rotate-180' : ''}`} />}
                  </div>
                  {link.hasDropdown && mobileExpandedMenu === link.label && link.label === 'Academic Tools' && (
                    <div className="flex flex-col gap-2 pl-4 pb-3">
                      {[
                        'Free Paraphrasing Tool',
                        'Free Grammar Checker',
                        'Free Plagiarism Checker',
                        'Turnitin Plagiarism Checker',
                        'Inception AI Research Assistant',
                        'Free Essay Typer',
                        'Free Dissertation Outline\nGenerator',
                        'Free Thesis Statement Generator',
                        'Referencing Tool',
                        'AI Essay Writer',
                        'AI Humanizer'
                      ].map((item, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setMobileMenuOpen(false);
                            navigate(`/p/${item.replace(/\n/g, ' ').toLowerCase().replace(/ /g, '-')}`);
                          }}
                          className="text-sm font-medium text-gray-600 py-1.5 cursor-pointer"
                        >
                          {item.replace(/\n/g, ' ')}
                        </div>
                      ))}
                    </div>
                  )}

                  {link.hasDropdown && mobileExpandedMenu === link.label && link.label === 'Services' && (
                    <div className="flex flex-col gap-4 pl-4 pb-3">
                      <div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#000a1e]" /> Writing</div>
                        <div className="flex flex-col gap-1 pl-3.5">
                          {[
                            'Essay Editing Service', 'MBA Essay Writing Service', 'Essay Help',
                            'Research Proposal Writing Service', 'Research Paper Writing', 'Ghost Writer'
                          ].map((item, i) => (
                            <div key={`w-${i}`} onClick={() => { setMobileMenuOpen(false); navigate(`/p/${item.toLowerCase().replace(/ /g, '-')}`); }} className="text-sm font-medium text-gray-600 py-1 cursor-pointer">{item}</div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#fea520]" /> Problem Solving</div>
                        <div className="flex flex-col gap-1 pl-3.5">
                          {[
                            'Programming Assignment Help', 'Assessment Help',
                            'Pay Someone To Do My Homework', 'Take My Online Class'
                          ].map((item, i) => (
                            <div key={`ps-${i}`} onClick={() => { setMobileMenuOpen(false); navigate(`/p/${item.toLowerCase().replace(/ /g, '-')}`); }} className="text-sm font-medium text-gray-600 py-1 cursor-pointer">{item}</div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#000a1e]/50" /> More Services</div>
                        <div className="flex flex-col gap-1 pl-3.5">
                          {[
                            'Take My Online Exam', 'Dissertation Help', 'Term Paper Help', 'Homework Help',
                            'Case Study Help', 'Coursework Help', 'Thesis Help', 'Powerpoint Presentation Services'
                          ].map((item, i) => (
                            <div key={`ms-${i}`} onClick={() => { setMobileMenuOpen(false); navigate(`/p/${item.toLowerCase().replace(/ /g, '-')}`); }} className="text-sm font-medium text-gray-600 py-1 cursor-pointer">{item}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {link.hasDropdown && mobileExpandedMenu === link.label && link.label === 'Hire Writers' && (
                    <div className="flex flex-col gap-2 mt-2 bg-gray-50/50 p-3 rounded-lg border border-gray-100 max-h-[300px] overflow-y-auto">
                      {(featuredWriters || []).map(w => <React.Fragment key={w.id}><FeaturedWriterLink w={w} compact onNavigate={() => setMobileMenuOpen(false)} /></React.Fragment>)}
                      {featuredWriters?.length === 0 && SAMPLE_WRITERS.map(sw => <React.Fragment key={sw.slug}><SampleWriterItem s={sw} compact onClick={() => { setMobileMenuOpen(false); navigate(`/hire-writers#sample-${sw.slug}`); }} /></React.Fragment>)}
                      <Link to="/hire-writers" onClick={() => setMobileMenuOpen(false)} className="p-2 text-xs font-bold text-[#002147]">Browse all writers →</Link>
                      <Link to="/become-a-writer" onClick={() => setMobileMenuOpen(false)} className="mt-1 rounded-lg bg-[#002147] p-2.5 text-center text-xs font-bold text-white">Join as a writer</Link>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex flex-col gap-3 pt-2">
                <button onClick={onOpenOrder} className="bg-[#eb6200] hover:bg-[#d45600] text-white font-bold py-3 rounded-md text-center w-full shadow-[0_2px_10px_rgba(235,98,0,0.30)]">Order Now</button>
                {writerSignedIn && (
                  <Link to="/writer/dashboard" onClick={() => setMobileMenuOpen(false)} className="border border-[#002147]/20 text-[#002147] font-bold py-3 rounded text-center w-full">Writer Dashboard</Link>
                )}
                {user ? (
                  <>
                    <button onClick={() => { setMobileMenuOpen(false); navigate('/dashboard'); }} className="bg-[#000a1e] text-white font-bold py-3 rounded text-center w-full shadow-sm">Go to Dashboard</button>
                    <button onClick={() => { logout(); setMobileMenuOpen(false); navigate('/'); }} className="border border-red-200 text-red-500 hover:bg-red-50 font-bold py-3 rounded text-center w-full shadow-sm transition-colors">Log Out</button>
                  </>
                ) : (
                  <button onClick={() => { setMobileMenuOpen(false); onOpenSignIn(); }} className="bg-[#000a1e] text-white font-bold py-3 rounded text-center w-full shadow-sm">Login</button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
