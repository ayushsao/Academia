import React, { useState } from 'react';
import {
  X,
  SpellCheck,
  ShieldAlert,
  Quote,
  Copy,
  Check,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { ToolType } from './AcademicToolsSection';

interface ToolModalProps {
  toolType: ToolType | null;
  onClose: () => void;
  onSwitchTool: (type: ToolType) => void;
}

export const ToolModal: React.FC<ToolModalProps> = ({
  toolType,
  onClose,
  onSwitchTool,
}) => {
  // Essay Grader state
  const [essayText, setEssayText] = useState<string>(
    `The integration of instructional technology in higher education presents both disruptive pedagogical challenges and unprecedented opportunities for bespoke personalization. While critics argue that widespread accessibility to digital resources threatens traditional methods of assessing student comprehension, this inquiry posits that incorporating advanced analytics into scaffolded critical inquiry fundamentally elevates analytical synthesis and academic rigor when governed by transparent ethical frameworks.`
  );
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradeResult, setGradeResult] = useState<boolean>(true);

  // Plagiarism state
  const [plagText, setPlagText] = useState<string>(
    `Empirical findings from the multi-center longitudinal trial demonstrate a statistically significant correlation (p < 0.01) between regular cognitive behavioral interventions and reduced biomarker levels of chronic systemic inflammation among participants aged 45–65.`
  );
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [plagResult, setPlagResult] = useState<{ originality: number; matches: { text: string; source: string; similarity: number }[] } | null>({
    originality: 98.4,
    matches: [
      {
        text: 'statistically significant correlation (p < 0.01) between regular cognitive behavioral interventions',
        source: 'Journal of Psychosomatic Medicine (Vol 42, 2024)',
        similarity: 1.6
      }
    ]
  });

  // Citation Generator state
  const [citationStyle, setCitationStyle] = useState<'APA' | 'MLA' | 'Harvard' | 'Chicago'>('APA');
  const [sourceType, setSourceType] = useState<'Journal' | 'Book' | 'Website'>('Journal');
  const [author, setAuthor] = useState<string>('Vanderbilt, E. R. & Chen, L.');
  const [year, setYear] = useState<string>('2025');
  const [title, setTitle] = useState<string>('Algorithmic governance and institutional integrity in European higher education');
  const [journal, setJournal] = useState<string>('Higher Education Quarterly Review');
  const [volume, setVolume] = useState<string>('48(2), 112–129');
  const [doi, setDoi] = useState<string>('https://doi.org/10.1016/j.hedq.2025.04.012');
  const [copied, setCopied] = useState<boolean>(false);

  if (!toolType) return null;

  const handleGradeEssay = () => {
    setIsGrading(true);
    setTimeout(() => {
      setIsGrading(false);
      setGradeResult(true);
    }, 600);
  };

  const handleScanPlagiarism = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setPlagResult({
        originality: 97.8,
        matches: [
          {
            text: 'demonstrate a statistically significant correlation between regular cognitive behavioral interventions',
            source: 'Oxford Clinical Archives (2025)',
            similarity: 2.2
          }
        ]
      });
    }, 800);
  };

  const generateCitation = () => {
    if (citationStyle === 'APA') {
      return `${author} (${year}). ${title}. ${journal}, ${volume}. ${doi}`;
    } else if (citationStyle === 'MLA') {
      return `${author}. "${title}." ${journal}, vol. ${volume}, ${year}, ${doi}.`;
    } else if (citationStyle === 'Harvard') {
      return `${author}, ${year}. ${title}. ${journal}, ${volume}. Available at: <${doi}>.`;
    } else {
      return `${author}. "${title}." ${journal} ( ${year} ): ${volume}.`;
    }
  };

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(generateCitation());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#000a1e]/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-white/80 w-full max-w-3xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#000a1e] text-white p-6 sm:p-8 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002147] flex items-center justify-center text-[#fea520]">
              {toolType === 'essay-grader' && <SpellCheck className="w-5 h-5" />}
              {toolType === 'plagiarism-checker' && <ShieldAlert className="w-5 h-5" />}
              {toolType === 'citation-generator' && <Quote className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {toolType === 'essay-grader' && 'Essay Grader & Rubric Auditor'}
                {toolType === 'plagiarism-checker' && 'Deep-Scan Plagiarism & Originality Checker'}
                {toolType === 'citation-generator' && 'Scholarly Citation & Bibliography Generator'}
              </h3>
              <p className="text-xs text-white/70">Institutional-grade instant academic utilities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tool Switcher Tabs */}
        <div className="bg-[#eef4ff] px-6 py-2.5 border-b border-[#d1e4ff] flex gap-2 overflow-x-auto">
          <button
            onClick={() => onSwitchTool('essay-grader')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${toolType === 'essay-grader'
                ? 'bg-[#000a1e] text-white shadow-sm'
                : 'text-[#44474e] hover:text-[#000a1e] hover:bg-white/60'
              }`}
          >
            <SpellCheck className="w-3.5 h-3.5" />
            <span>Essay Grader</span>
          </button>
          <button
            onClick={() => onSwitchTool('plagiarism-checker')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${toolType === 'plagiarism-checker'
                ? 'bg-[#000a1e] text-white shadow-sm'
                : 'text-[#44474e] hover:text-[#000a1e] hover:bg-white/60'
              }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Plagiarism Checker</span>
          </button>
          <button
            onClick={() => onSwitchTool('citation-generator')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${toolType === 'citation-generator'
                ? 'bg-[#000a1e] text-white shadow-sm'
                : 'text-[#44474e] hover:text-[#000a1e] hover:bg-white/60'
              }`}
          >
            <Quote className="w-3.5 h-3.5" />
            <span>Citation Generator</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto space-y-6">
          {/* 1. Essay Grader View */}
          {toolType === 'essay-grader' && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-[#44474e] uppercase">
                    Paste Your Essay Draft or Excerpt
                  </label>
                  <span className="text-[11px] text-[#708ab5]">{essayText.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <textarea
                  rows={5}
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                  placeholder="Paste your essay draft here for an instantaneous rubric breakdown..."
                  className="w-full bg-[#f8f9ff] border border-[#d1e4ff] rounded-2xl p-4 text-xs sm:text-sm text-[#000a1e] font-sans leading-relaxed focus:bg-white focus:ring-2 focus:ring-[#002147] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => setEssayText(`The integration of instructional technology in higher education presents both disruptive pedagogical challenges and unprecedented opportunities for bespoke personalization. While critics argue that widespread accessibility to digital resources threatens traditional methods of assessing student comprehension, this inquiry posits that incorporating advanced analytics into scaffolded critical inquiry fundamentally elevates analytical synthesis and academic rigor when governed by transparent ethical frameworks.`)}
                    className="text-[11px] font-semibold text-[#708ab5] hover:text-[#000a1e] underline cursor-pointer"
                  >
                    Sample: Tech in Higher Ed
                  </button>
                  <span className="text-[#c4c6cf]">•</span>
                  <button
                    onClick={() => setEssayText(`Corporate governance mechanisms within multinational conglomerates must effectively balance shareholder primacy against emerging ESG (Environmental, Social, and Governance) stakeholder expectations. Through an analysis of European board structures, this paper explores the fiduciary friction between short-term quarterly EBITDA targets and multi-decade decarbonization mandates.`)}
                    className="text-[11px] font-semibold text-[#708ab5] hover:text-[#000a1e] underline cursor-pointer"
                  >
                    Sample: Corporate Governance
                  </button>
                </div>

                <button
                  onClick={handleGradeEssay}
                  disabled={isGrading}
                  className="bg-[#000a1e] text-white hover:bg-[#002147] px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  <span>{isGrading ? 'Auditing Rubric...' : 'Grade Essay'}</span>
                </button>
              </div>

              {gradeResult && (
                <div className="bg-[#eef4ff] rounded-2xl p-6 border border-[#d1e4ff] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#d1e4ff] pb-4">
                    <div>
                      <span className="text-xs font-bold text-[#865300] uppercase tracking-wider">Estimated Score</span>
                      <h4 className="text-3xl font-extrabold text-[#000a1e]">First Class (88 / 100)</h4>
                      <p className="text-xs text-[#708ab5] mt-0.5">High distinction range • Strong scholarly diction</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center font-extrabold text-xl text-emerald-700 shadow-sm border border-[#d1e4ff]">
                      A
                    </div>
                  </div>

                  {/* Rubric Breakdown Progress */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-[#000a1e] mb-1">
                        <span>Thesis & Argument Strength</span>
                        <span>92%</span>
                      </div>
                      <div className="w-full bg-white h-2 rounded-full overflow-hidden">
                        <div className="bg-[#000a1e] h-full rounded-full w-[92%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-[#000a1e] mb-1">
                        <span>Academic Diction & Tone</span>
                        <span>95%</span>
                      </div>
                      <div className="w-full bg-white h-2 rounded-full overflow-hidden">
                        <div className="bg-[#fea520] h-full rounded-full w-[95%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-[#000a1e] mb-1">
                        <span>Synthesizing Counter-arguments</span>
                        <span>82%</span>
                      </div>
                      <div className="w-full bg-white h-2 rounded-full overflow-hidden">
                        <div className="bg-[#002147] h-full rounded-full w-[82%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-[#000a1e] mb-1">
                        <span>Citation Depth & Precedent</span>
                        <span>85%</span>
                      </div>
                      <div className="w-full bg-white h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full w-[85%]" />
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-white rounded-xl p-4 border border-[#d1e4ff] text-xs space-y-1.5">
                    <span className="font-bold text-[#000a1e] block">Actionable Peer Recommendations:</span>
                    <p className="text-[#44474e] flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      Add 2-3 specific empirical case studies in paragraph 2 to ground the theoretical claims.
                    </p>
                    <p className="text-[#44474e] flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      Strengthen the transition before the conclusion with a clear institutional policy recommendation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Plagiarism Checker View */}
          {toolType === 'plagiarism-checker' && (
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-[#44474e] uppercase">
                    Scan Manuscript / Excerpt for Academic Similarity
                  </label>
                  <span className="text-[11px] text-[#708ab5]">Cross-checked with 95B+ academic pages</span>
                </div>
                <textarea
                  rows={5}
                  value={plagText}
                  onChange={(e) => setPlagText(e.target.value)}
                  placeholder="Paste research text or abstract to test originality..."
                  className="w-full bg-[#f8f9ff] border border-[#d1e4ff] rounded-2xl p-4 text-xs sm:text-sm text-[#000a1e] font-sans leading-relaxed focus:bg-white focus:ring-2 focus:ring-[#002147] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-[#708ab5] font-semibold">Zero-storage policy (Not saved to Turnitin repo)</span>
                <button
                  onClick={handleScanPlagiarism}
                  disabled={isScanning}
                  className="bg-[#000a1e] text-white hover:bg-[#002147] px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ShieldAlert className="w-4 h-4 text-[#fea520]" />
                  <span>{isScanning ? 'Querying Academic Repos...' : 'Run Deep Scan'}</span>
                </button>
              </div>

              {plagResult && (
                <div className="bg-[#eef4ff] rounded-2xl p-6 border border-[#d1e4ff] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#d1e4ff] pb-4">
                    <div>
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Originality Score</span>
                      <h4 className="text-3xl font-extrabold text-[#000a1e]">{plagResult.originality}% Original</h4>
                      <p className="text-xs text-[#708ab5] mt-0.5">Complies with strict university originality thresholds (&lt; 5% similarity)</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-center font-bold text-emerald-700">
                      <FileCheck className="w-8 h-8" />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-[#000a1e] block mb-2">Simulated Match Breakdown:</span>
                    {plagResult.matches.map((match, i) => (
                      <div key={i} className="bg-white p-3.5 rounded-xl border border-[#d1e4ff] text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#000a1e]">{match.source}</span>
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            {match.similarity}% Match
                          </span>
                        </div>
                        <p className="text-[#74777f] italic bg-[#f8f9ff] p-2 rounded">
                          &ldquo;{match.text}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Citation Generator View */}
          {toolType === 'citation-generator' && (
            <div className="space-y-6">
              {/* Style selector */}
              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-2">
                  Referencing Standard
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['APA', 'MLA', 'Harvard', 'Chicago'] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setCitationStyle(style)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${citationStyle === style
                          ? 'bg-[#000a1e] text-white border-[#000a1e]'
                          : 'bg-[#eef4ff] text-[#44474e] border-[#d1e4ff] hover:bg-white'
                        }`}
                    >
                      {style} 7th/9th
                    </button>
                  ))}
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1">Author(s)</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#d1e4ff] rounded-xl p-2.5 text-xs text-[#000a1e] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1">Publication Year</label>
                  <input
                    type="text"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#d1e4ff] rounded-xl p-2.5 text-xs text-[#000a1e] font-semibold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1">Article / Book Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#d1e4ff] rounded-xl p-2.5 text-xs text-[#000a1e] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1">Journal / Publisher</label>
                  <input
                    type="text"
                    value={journal}
                    onChange={(e) => setJournal(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#d1e4ff] rounded-xl p-2.5 text-xs text-[#000a1e] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1">Volume / Pages / Issue</label>
                  <input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="w-full bg-[#f8f9ff] border border-[#d1e4ff] rounded-xl p-2.5 text-xs text-[#000a1e] font-semibold"
                  />
                </div>
              </div>

              {/* Formatted Citation Output */}
              <div className="bg-[#eef4ff] rounded-2xl p-5 border border-[#d1e4ff] space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#000a1e] uppercase">
                    Formatted {citationStyle} Reference
                  </span>
                  <button
                    onClick={handleCopyCitation}
                    className="flex items-center gap-1 text-xs font-bold text-[#000a1e] bg-white px-3 py-1.5 rounded-lg border border-[#d1e4ff] hover:bg-[#fea520] hover:border-[#fea520] transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Citation'}</span>
                  </button>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#d1e4ff] text-xs sm:text-sm font-serif text-[#000a1e] leading-relaxed shadow-sm">
                  {generateCitation()}
                </div>

                <div className="text-[11px] text-[#708ab5] flex justify-between">
                  <span><strong>In-text citation:</strong> ({author.split(',')[0]}, {year})</span>
                  <span>Direct Export to BibTeX / EndNote</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
