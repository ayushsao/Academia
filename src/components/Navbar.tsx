import React, { useState } from 'react';
import { Search, ShoppingCart, Menu, ChevronDown, User, LogOut } from 'lucide-react';
import { AcademiaLogo } from './AcademiaLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useNavigate, Link } from 'react-router-dom';
import { WriterModal, WriterData } from './WriterModal';

const WRITERS: WriterData[] = [
  { name: 'Dr. Sarah Jenkins', deg: 'Ph.D. Literature', img: '1', rating: '4.9/5', completed: 450, experience: '8 Years', about: 'I specialize in structuring profound academic essays and dissertations in English Literature and Humanities. Let me help you achieve highest grades with zero plagiarism.', subjects: ['Literature', 'History'] },
  { name: 'Prof. Michael C.', deg: 'MSc. Finance', img: '11', rating: '5.0/5', completed: 830, experience: '12 Years', about: 'Former corporate financial analyst turned academic mentor. I solve complex accounting/finance tasks, balance sheets, and create rigorous corporate financial analyses.', subjects: ['Finance', 'Accounting'] },
  { name: 'Dr. Emily Carter', deg: 'Ph.D. Nursing', img: '5', rating: '4.8/5', completed: 310, experience: '6 Years', about: 'Passionate about medical writing. I provide robust clinical case studies, nursing reflection papers, and evidence-based practice research articles.', subjects: ['Nursing', 'Healthcare'] },
  { name: 'Robert Davis', deg: 'MSc. Data Sci.', img: '13', rating: '4.9/5', completed: 520, experience: '7 Years', about: 'Data is my language. I handle SPSS, R, Python, and complex statistical analysis modules for master-level dissertations.', subjects: ['Data Science', 'Statistics'] },
  { name: 'Dr. Alan Greene', deg: 'Ph.D. History', img: '3', rating: '4.7/5', completed: 410, experience: '10 Years', about: 'I write deep, heavily-researched historical papers with perfect Turabian/Chicago citations.', subjects: ['History', 'Political Science'] },
  { name: 'Alice Smith', deg: 'MBA Business', img: '9', rating: '4.9/5', completed: 620, experience: '5 Years', about: 'I excel in writing winning Business Management assignments, SWOT analyses, and strategic corporate reports.', subjects: ['Business', 'Management'] },
  { name: 'John Doe', deg: 'MSc. Engineering', img: '15', rating: '4.8/5', completed: 290, experience: '4 Years', about: 'Electrical and Mechanical engineering assignments mapped out with perfect calculations and CAD integrations.', subjects: ['Engineering', 'Physics'] },
  { name: 'Jane Roe', deg: 'MA Psychology', img: '21', rating: '4.9/5', completed: 480, experience: '6 Years', about: 'Behavioral analysis and psychological research papers structured according to strict APA 7 guidelines.', subjects: ['Psychology', 'Counseling'] },
  { name: 'Dr. Peter Parker', deg: 'Ph.D. Physics', img: '12', rating: '5.0/5', completed: 610, experience: '9 Years', about: 'Quantum mechanics to basic kinematics, I solve physics lab reports and theory papers effortlessly.', subjects: ['Physics', 'Mathematics'] },
  { name: 'Mary Jane', deg: 'MA Journalism', img: '25', rating: '4.8/5', completed: 200, experience: '3 Years', about: 'Creative writing and media studies essays with strong analytical arguments and perfect grammar.', subjects: ['Media Studies', 'Journalism'] },
  { name: 'Dr. Bruce Wayne', deg: 'Ph.D. Econ.', img: '14', rating: '4.9/5', completed: 780, experience: '15 Years', about: 'Macro/Micro economics graphs, elasticity computations, and econometric modeling expert.', subjects: ['Economics', 'Statistics'] },
  { name: 'Clark Kent', deg: 'MSc. Sociology', img: '29', rating: '4.7/5', completed: 340, experience: '5 Years', about: 'Cultural studies, sociological theory, and deep societal impact research papers are my favorite subjects.', subjects: ['Sociology', 'Theology'] }
];

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
  const [selectedWriter, setSelectedWriter] = useState<WriterData | null>(null);

  const user = useStore(state => state.user);
  const orders = useStore(state => state.orders);
  const logout = useStore(state => state.logout);
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
    { label: 'Blogs', hasDropdown: false, to: '/p/blogs' },
    { label: 'Academic Tools', hasDropdown: true },
  ];

  return (
    <nav className={`w-full z-50 transition-all duration-500 sticky top-0 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-[0_4px_30px_rgb(0,0,0,0.05)] py-3 border-b border-gray-100/50' : 'bg-white py-5 border-b border-gray-100'}`}>
      <div className="w-full px-4 md:px-8 lg:px-12 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-0 cursor-pointer group" onClick={() => navigate('/')}>
          <AcademiaLogo className="h-11 w-auto z-10 transition-transform duration-300 group-hover:scale-105" />
          <div className="flex flex-col z-0 ml-0.5">
            <span className="text-2xl font-black text-[#000a1e] uppercase tracking-tight leading-none">ssignment<span className="text-[#fea520]">Minds</span></span>
            <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 tracking-wider pl-1.5 uppercase">Achieve Your Potential</span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map((link, idx) => (
            <div key={idx} className="group relative flex items-center gap-1 text-[#2d2d2d] hover:text-[#fea520] font-medium text-sm transition-colors py-4">
              <span onClick={() => { if (!link.hasDropdown) navigate(link.to || `/p/${link.label.toLowerCase().replace(/ /g, '-')}`); }} className="cursor-pointer">{link.label}</span>
              {link.hasDropdown && <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-[#fea520] transition-colors cursor-pointer" />}

              {/* SERVICES MEGA MENU */}
              {link.hasDropdown && link.label === 'Services' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-[800px] bg-white rounded-b-xl rounded-t-sm shadow-[0_10px_40px_rgba(0,0,0,0.1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-6 border border-gray-100">
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
                      <h3 className="font-extrabold text-[#000a1e] text-lg">Top Academic Experts Available Now</h3>
                      <p className="text-xs text-gray-500 font-medium">Select from our vetted pool of master's and Ph.D. graduates</p>
                    </div>
                    <button onClick={onOpenOrder} className="text-xs font-bold bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] px-4 py-2 rounded shadow-sm transition-colors cursor-pointer">
                      Hire Any Writer
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {WRITERS.map((writer, i) => (
                      <div key={i} onClick={() => setSelectedWriter(writer)} className="group/writer flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all cursor-pointer">
                        <div className="relative">
                          <img loading="lazy" decoding="async" src={`https://i.pravatar.cc/150?img=${writer.img}`} alt={writer.name} className="w-10 h-10 rounded-full object-cover shadow-sm bg-gray-200" />
                          <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white"></div>
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-[#000a1e] text-[13px] group-hover/writer:text-[#fea520] transition-colors truncate">{writer.name}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400">
                            <span>{writer.deg}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-[#fea520] flex items-center gap-0.5">★ {writer.rating}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <Link to="/hire-writers" className="text-xs font-bold text-[#002147] hover:text-[#e36100] transition-colors">Browse all verified writers →</Link>
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
        <div className="hidden lg:flex items-center gap-4">
          <button className="text-[#2d2d2d] hover:text-[#fea520] transition-colors p-2">
            <Search className="w-5 h-5" />
          </button>

          <button onClick={onOpenOrder} className="bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] font-bold px-5 py-2.5 rounded text-sm shadow-sm transition-colors">
            Order Now
          </button>

          {user ? (
            <div className="relative group cursor-pointer">
              <button onClick={() => navigate('/dashboard')} className="bg-[#000a1e] hover:bg-[#002147] text-white font-bold px-4 py-2.5 rounded text-sm shadow-sm transition-colors flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="max-w-[80px] truncate">{user.name.split(' ')[0]}</span>
              </button>

              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-xs text-gray-500 font-semibold mb-0.5">Signed in as</p>
                  <p className="text-sm font-bold text-[#000a1e] truncate">{user.email}</p>
                </div>
                <div onClick={() => navigate('/dashboard')} className="px-4 py-3 text-sm font-medium hover:bg-[#fea520]/10 hover:text-[#e36100] transition-colors cursor-pointer border-b border-gray-100">
                  My Dashboard
                </div>
                <div onClick={() => { logout(); navigate('/'); }} className="px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Log out
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
        <div className="flex lg:hidden items-center gap-3">
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
            className="lg:hidden absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-100 overflow-hidden"
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
                  {link.hasDropdown && mobileExpandedMenu === link.label && link.label === 'Hire Writers' && (
                    <div className="flex flex-col gap-2 mt-2 bg-gray-50/50 p-3 rounded-lg border border-gray-100 max-h-[300px] overflow-y-auto">
                      {[
                        { name: 'Dr. Sarah Jenkins', deg: 'Ph.D. Literature', img: '1', rating: '4.9/5' },
                        { name: 'Prof. Michael C.', deg: 'MSc. Finance', img: '11', rating: '5.0/5' },
                        { name: 'Dr. Emily Carter', deg: 'Ph.D. Nursing', img: '5', rating: '4.8/5' },
                        { name: 'Robert Davis', deg: 'MSc. Data Sci.', img: '13', rating: '4.9/5' },
                        { name: 'Dr. Alan Greene', deg: 'Ph.D. History', img: '3', rating: '4.7/5' },
                        { name: 'Alice Smith', deg: 'MBA Business', img: '9', rating: '4.9/5' },
                      ].map((writer, i) => (
                        <div key={i} onClick={() => { setMobileMenuOpen(false); onOpenOrder(); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <img loading="lazy" decoding="async" src={`https://i.pravatar.cc/150?img=${writer.img}`} alt={writer.name} className="w-8 h-8 rounded-full border border-gray-200" />
                          <div>
                            <p className="font-bold text-[#000a1e] text-xs leading-none">{writer.name}</p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{writer.deg} <span className="text-[#fea520]">★ {writer.rating}</span></p>
                          </div>
                        </div>
                      ))}
                      <div onClick={() => { setMobileMenuOpen(false); navigate('/become-a-writer'); }} className="mt-1 p-2.5 rounded-lg bg-[#002147] text-white text-xs font-bold text-center cursor-pointer">
                        Join as a writer
                      </div>
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
                      {WRITERS.map((writer, i) => (
                        <div key={i} onClick={() => { setMobileMenuOpen(false); setSelectedWriter(writer); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                          <img loading="lazy" decoding="async" src={`https://i.pravatar.cc/150?img=${writer.img}`} alt={writer.name} className="w-8 h-8 rounded-full border border-gray-200 object-cover" />
                          <div>
                            <p className="font-bold text-[#000a1e] text-xs leading-none">{writer.name}</p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{writer.deg} <span className="text-[#fea520]">★ {writer.rating}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex flex-col gap-3 pt-2">
                <button onClick={onOpenOrder} className="bg-[#fea520] text-[#000a1e] font-bold py-3 rounded text-center w-full shadow-sm">Order Now</button>
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

      {/* Embedded Writer Profile Modal */}
      <WriterModal
        writer={selectedWriter}
        isOpen={!!selectedWriter}
        onClose={() => setSelectedWriter(null)}
        onHire={() => {
          setSelectedWriter(null);
          onOpenOrder();
        }}
      />
    </nav>
  );
};
