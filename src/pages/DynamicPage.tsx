import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { OrderModal } from '../components/OrderModal';
import { SignInModal } from '../components/SignInModal';
import { SideDrawer } from '../components/SideDrawer';
import { Calculator, ArrowRight, CheckCircle2, FileText, Lock, Award } from 'lucide-react';
import { API } from '../lib/api';

export const DynamicPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    // Modal & Drawer visibility states
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
    const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false);
    const [signInModalOpen, setSignInModalOpen] = useState<boolean>(false);

    // Tool Processing States
    const [toolInput, setToolInput] = useState<string>('');
    const [toolOutput, setToolOutput] = useState<string>('');
    const [isToolProcessing, setIsToolProcessing] = useState<boolean>(false);
    const [toolError, setToolError] = useState<string>('');
    const [loadingText, setLoadingText] = useState<string>('Initializing AI engine...');

    useEffect(() => {
        if (!isToolProcessing) return;
        const messages = [
            "Initializing AI engine...",
            "Analyzing your prompt...",
            "Gathering academic structures...",
            "Checking university formatting...",
            "Drafting high-quality content...",
            "Finalizing output..."
        ];
        let i = 0;
        setLoadingText(messages[0]);
        const interval = setInterval(() => {
            i = (i + 1) % messages.length;
            setLoadingText(messages[i]);
        }, 1800);
        return () => clearInterval(interval);
    }, [isToolProcessing]);
    // Dynamic Data Dictionary for Services
    const serviceContent: Record<string, {
        title: string,
        desc: string,
        benefits: string[],
        inputPlaceholder?: string,
        actionButton?: string,
        outputMessage?: string,
        supportText?: string
    }> = {
        'essay-editing-service': {
            title: 'Professional Essay Editing Service',
            desc: 'Transform your rough drafts into polished masterpieces. Our PhD editors will refine your tone, structure, and academic phrasing to guarantee top distinction grades.',
            benefits: ['Flawless Grammar & Syntax', 'Structural Flow Enhancement', 'Citation & Formatting Check']
        },
        'mba-essay-writing-service': {
            title: 'MBA Essay Writing Service',
            desc: 'Secure your spot in top-tier business schools or ace your MBA coursework. Our elite business strategists craft compelling, critically analytical MBA essays.',
            benefits: ['Business-focused Terminology', 'Critical Analytical Approach', 'Authored by MBA Graduates']
        },
        'essay-help': {
            title: 'Expert Essay Help',
            desc: 'Struggling with a prompt? Get comprehensive essay assistance from outlining to the final draft. We cover all academic levels and subject matters.',
            benefits: ['Custom Original Content', 'Thorough Fact-checking', 'Unlimited Revisions']
        },
        'research-proposal-writing-service': {
            title: 'Research Proposal Writing',
            desc: 'Get your research approved on the first try. We develop comprehensive, hypothesis-driven proposals with robust methodologies and clear academic significance.',
            benefits: ['Strong Literature Review', 'Sound Methodology Design', 'Convincing Research Aims']
        },
        'research-paper-writing': {
            title: 'Research Paper Writing',
            desc: 'Extensive empirical or theoretical research papers written from scratch. We ensure deep analytical depth, proper references, and high academic rigor.',
            benefits: ['Deep Academic Research', 'Peer-Reviewed Sources', 'Flawless Referencing']
        },
        'ghost-writer': {
            title: 'Academic Ghost Writing',
            desc: '100% confidential ghostwriting for your academic or professional needs. You retain full copyright and ownership of the meticulously crafted content.',
            benefits: ['Strict NDA & Confidentiality', 'Tailored to Your Voice', 'Complete Transfer of Rights']
        },
        'programming-assignment-help': {
            title: 'Programming Assignment Help',
            desc: 'Stuck on a bug? Our senior developers provide fully commented, executable code files for Python, Java, C++, React, and more. 100% logic guaranteed.',
            benefits: ['Bug-free Executable Code', 'Detailed Inline Comments', 'Follows Best Practices']
        },
        'assessment-help': {
            title: 'Online Assessment Help',
            desc: 'Feeling overwhelmed by online portals? Let our experts guide you through complex university assessments and secure the grades you deserve.',
            benefits: ['High Score Guarantee', 'Step-by-Step Solutions', 'Fast Turnaround']
        },
        'pay-someone-to-do-my-homework': {
            title: 'Do My Homework For Me',
            desc: 'Offload your entire homework burden to us. We handle daily assignments, worksheets, and online portals across all subjects so you can finally breathe.',
            benefits: ['Covers All Subjects', 'Strict Deadline Adherence', 'Stress-free Academic Life']
        },
        'take-my-online-class': {
            title: 'Take My Online Class',
            desc: 'We manage your entire semester. From weekly discussions to quizzes and final finals—our experts will handle your online portal while you focus on life.',
            benefits: ['Full Portal Management', 'Weekly Progress Updates', 'Guaranteed Grade A or B']
        },
        'take-my-online-exam': {
            title: 'Take My Online Exam',
            desc: 'Facing a tough midterm or final? Our verified experts can securely log in and ace your timed online exams with guaranteed exceptional results.',
            benefits: ['Secure IP Masking', 'Subject-Matter Experts', 'High Exam Scores']
        },
        'dissertation-help': {
            title: 'Comprehensive Dissertation Help',
            desc: 'The ultimate academic milestone requires elite support. From proposal to conclusion, our PhD researchers will guide you through your entire dissertation.',
            benefits: ['PhD-Level Researchers', 'Free Turnitin Report', 'Data Analysis (SPSS/R)']
        },
        'term-paper-help': {
            title: 'End of Term Paper Help',
            desc: 'Finish your semester strong. We produce exhaustive, heavily researched term papers designed to impress your professors and boost your GPA.',
            benefits: ['Extensive Bibliography', 'Cohesively Structured', 'Proofread & Edited']
        },
        'homework-help': {
            title: 'General Homework Help',
            desc: 'From K-12 to post-grad, no task is too small or large. Get instant, accurate solutions to your daily homework assignments with clear explanations.',
            benefits: ['Accurate Solutions', 'Clear Explanations', 'Available 24/7']
        },
        'case-study-help': {
            title: 'Case Study Writing Help',
            desc: 'Business, Law, or Nursing? We dissect complex real-world scenarios and provide highly analytical, solution-oriented case study reports.',
            benefits: ['SWOT & PESTLE Analysis', 'Real-world Context framing', 'Solution-driven Conclusions']
        },
        'coursework-help': {
            title: 'Coursework Assistance',
            desc: 'Consistent excellence throughout the year. We assist with practicals, essays, and module-specific coursework to maintain your high academic standing.',
            benefits: ['Module-Specific Experts', 'Continuous Support', 'High Distinction Standard']
        },
        'thesis-help': {
            title: 'Master & PhD Thesis Help',
            desc: 'Rigorous academic writing for your thesis. We ensure your arguments are watertight, your data is robust, and your contribution to the field is evident.',
            benefits: ['Original Primary Research', 'Flawless Academic Tone', 'Ready for Defense']
        },
        'powerpoint-presentation-services': {
            title: 'PowerPoint Presentation Services',
            desc: 'Stand out in your seminars. We design visually striking, academically rigorous presentation slides complete with detailed speaker notes.',
            benefits: ['Stunning Visual Design', 'Detailed Speaker Notes', 'Data Visualization']
        },
        'free-paraphrasing-tool': {
            title: 'Free Paraphrasing Tool',
            desc: 'Instantly rewrite sentences, paragraphs, or entire essays. Enhance readability, improve flow, and maintain original meaning with our advanced AI paraphraser.',
            benefits: ['Flawless Flow', 'Vocabulary Enhancement', 'Bypass AI Detectors'],
            inputPlaceholder: 'Type or paste the text you want to paraphrase here...',
            actionButton: 'Paraphrase Now',
            outputMessage: 'paraphrased',
            supportText: 'Drag and drop the document or paste text to paraphrase'
        },
        'free-grammar-checker': {
            title: 'Free Grammar Checker',
            desc: 'Eliminate typos, syntax errors, and punctuation mistakes instantly. Ensure your academic papers are flawlessly proofread before submission.',
            benefits: ['Real-time Corrections', 'Context-aware Suggestions', 'One-click Fixes'],
            inputPlaceholder: 'Type or paste your text to check for grammar and spelling errors...',
            actionButton: 'Check Grammar',
            outputMessage: 'corrected',
            supportText: 'Upload or paste document to scan for errors'
        },
        'free-plagiarism-checker': {
            title: 'Free Plagiarism Checker',
            desc: 'Review the text and simulate an originality analysis. Provide an estimated similarity percentage and highlight phrases that are commonly used in public literature.',
            benefits: ['Originality Check', 'Fast Results', 'Detailed Similarity Report'],
            inputPlaceholder: 'Type or paste content here to check for originality...',
            actionButton: 'Scan Plagiarism',
            outputMessage: 'originality report',
            supportText: 'Drag & drop the document, or copy-paste text'
        },
        'free-essay-typer': {
            title: 'Free Essay Typer',
            desc: 'Stuck on a blank page? Give us your topic and watch our tool generate a well-structured essay draft in seconds to kickstart your writing process.',
            benefits: ['Instant Outlines', 'Academic Tone', 'Topic Auto-generation'],
            inputPlaceholder: 'Enter your essay topic or prompt here...',
            actionButton: 'Generate Essay',
            outputMessage: 'auto-generated essay',
            supportText: 'Enter a topic to start typing'
        },
        'free-dissertation-outline-generator': {
            title: 'Dissertation Outline Generator',
            desc: 'Organize your massive research project effortlessly. Generate a comprehensive, university-standard dissertation skeleton instantly.',
            benefits: ['Standard Chapter Structure', 'Research-focused', 'Customizable Headings'],
            inputPlaceholder: 'Enter your main research question or dissertation topic...',
            actionButton: 'Generate Outline',
            outputMessage: 'structured outline',
            supportText: 'Provide your research focus'
        },
        'free-thesis-statement-generator': {
            title: 'Thesis Statement Generator',
            desc: 'Craft a strong, arguable, and concise thesis statement. Answer a few structural questions and our tool formulates the core argument of your paper.',
            benefits: ['Arguable Statements', 'Concise Phrasing', 'Perfectly Formatted'],
            inputPlaceholder: 'Briefly state your topic, main argument, and 2-3 supporting points...',
            actionButton: 'Build Thesis',
            outputMessage: 'crafted thesis statement',
            supportText: 'Enter topic and main arguments'
        },
        'referencing-tool': {
            title: 'Citation & Referencing Tool',
            desc: 'Generate perfect APA, MLA, Harvard, or Chicago citations instantly. Never lose marks on improper bibliography formatting again.',
            benefits: ['Supports All Styles', 'Auto-fetch Metadata', 'Instant Copy-paste'],
            inputPlaceholder: 'Enter URL, DOI, ISBN or text to cite...',
            actionButton: 'Generate Citation',
            outputMessage: 'formatted citation',
            supportText: 'Select format and enter source details'
        },
        'ai-essay-writer': {
            title: 'Pro AI Essay Writer',
            desc: 'Harness the power of premium artificial intelligence. Generate extensive, contextually accurate, and well-researched essays tailored to your exact prompt.',
            benefits: ['High Originality', 'Advanced Phrasing', 'Rapid Generation'],
            inputPlaceholder: 'Provide detailed instructions for your essay (e.g., topic, length, specific points to cover)...',
            actionButton: 'Write Essay',
            outputMessage: 'AI-written essay',
            supportText: 'Provide comprehensive instructions'
        },
        'ai-humanizer': {
            title: 'AI Text Humanizer',
            desc: 'Refine the provided text to have a highly natural, engaging, and expressive human tone. Enhance the syntax to flow organically.',
            benefits: ['Engaging Tone', 'Natural Variations', 'Human-like Flow'],
            inputPlaceholder: 'Paste your generated text here to humanize it...',
            actionButton: 'Humanize Text',
            outputMessage: 'humanized',
            supportText: 'Upload text to enhance human tone and flow'
        },
        'turnitin-plagiarism-checker': {
            title: 'Turnitin Plagiarism & AI Checker',
            desc: 'Scan your draft against Turnitin-standard academic databases, 99+ billion archived web pages, and university repositories. Receive an estimated similarity breakdown and AI originality score.',
            benefits: ['Turnitin-Level Precision', 'AI Content Detection', 'Detailed Similarity Breakdown'],
            inputPlaceholder: 'Type or paste content here to run a Turnitin originality and similarity check, or upload a document...',
            actionButton: 'Scan with Turnitin',
            outputMessage: 'Turnitin originality report',
            supportText: 'Upload (.pdf, .docx, .txt) or copy-paste text to scan with Turnitin standards'
        },
        'turnitin': {
            title: 'Turnitin Plagiarism & AI Checker',
            desc: 'Scan your draft against Turnitin-standard academic databases, 99+ billion archived web pages, and university repositories. Receive an estimated similarity breakdown and AI originality score.',
            benefits: ['Turnitin-Level Precision', 'AI Content Detection', 'Detailed Similarity Breakdown'],
            inputPlaceholder: 'Type or paste content here to run a Turnitin originality and similarity check, or upload a document...',
            actionButton: 'Scan with Turnitin',
            outputMessage: 'Turnitin originality report',
            supportText: 'Upload (.pdf, .docx, .txt) or copy-paste text to scan with Turnitin standards'
        },
        'inception-ai-research-assistant': {
            title: 'Inception AI Research Assistant',
            desc: 'Harness the cutting-edge Inception Labs Mercury-2.5 academic AI model. Formulate thesis arguments, synthesize complex literature, evaluate research methodologies, and write publication-grade analyses.',
            benefits: ['Powered by Inception Labs Mercury-2.5', 'Doctoral-Standard Synthesis', 'Peer-Reviewed Literature Framing'],
            inputPlaceholder: 'Enter your research question, thesis topic, or assignment instructions for Inception AI...',
            actionButton: 'Generate with Inception AI',
            outputMessage: 'Inception AI academic analysis',
            supportText: 'Provide detailed instructions or research prompts for Inception AI'
        },
        'inception-ai-writer': {
            title: 'Inception AI Writer',
            desc: 'Harness the cutting-edge Inception Labs Mercury-2.5 academic AI model. Formulate thesis arguments, synthesize complex literature, evaluate research methodologies, and write publication-grade analyses.',
            benefits: ['Powered by Inception Labs Mercury-2.5', 'Doctoral-Standard Synthesis', 'Peer-Reviewed Literature Framing'],
            inputPlaceholder: 'Enter your research question, thesis topic, or assignment instructions for Inception AI...',
            actionButton: 'Generate with Inception AI',
            outputMessage: 'Inception AI academic analysis',
            supportText: 'Provide detailed instructions or research prompts for Inception AI'
        },
        'inception': {
            title: 'Inception AI Research Assistant',
            desc: 'Harness the cutting-edge Inception Labs Mercury-2.5 academic AI model. Formulate thesis arguments, synthesize complex literature, evaluate research methodologies, and write publication-grade analyses.',
            benefits: ['Powered by Inception Labs Mercury-2.5', 'Doctoral-Standard Synthesis', 'Peer-Reviewed Literature Framing'],
            inputPlaceholder: 'Enter your research question, thesis topic, or assignment instructions for Inception AI...',
            actionButton: 'Generate with Inception AI',
            outputMessage: 'Inception AI academic analysis',
            supportText: 'Provide detailed instructions or research prompts for Inception AI'
        }
    };

    const [customForm, setCustomForm] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fallback logic starts
    const formatTitle = (s: string) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const isProblemSolving = slug && (slug.includes('assignment') || slug.includes('homework') || slug.includes('exam') || slug.includes('class') || slug.includes('assessment'));
    const fallbackTitle = slug ? formatTitle(slug) : 'Page Not Found';
    const fallbackDesc = isProblemSolving
        ? `Struggling with your ${fallbackTitle.toLowerCase()}? Let our elite network of Master's and PhD experts take the pressure off. We guarantee accurate, high-scoring solutions delivered well before your deadline.`
        : `Looking for exceptional ${fallbackTitle.toLowerCase()}? Our academic team provides flawlessly researched, 100% original content matched perfectly to your strict university requirements and grading rubrics.`;

    const step1Title = isProblemSolving ? "Submit Your Task" : "Share Your Prompt";
    const step1Desc = isProblemSolving ? "Upload your problem statements, syllabus rubric, or live exam dates." : "Use our simple order form to share your rubric, total length, and topic.";
    const step2Title = isProblemSolving ? "Match with a Tutor" : "Secure Your Writer";
    const step2Desc = isProblemSolving ? "We assign a PhD specialist holding expertise exactly in your STEM or specific module." : "Process a safe payment while we assign a dedicated, discipline-specific academic author.";
    const step3Title = isProblemSolving ? "Score Top Grades" : "Download Masterpiece";
    const step3Desc = isProblemSolving ? "Sit back as we execute your proxy exam or complex homework with perfect precision." : "Your highly polished, plagiarism-free document arrives securely before the deadline.";

    const content = slug && serviceContent[slug]
        ? serviceContent[slug]
        : {
            title: fallbackTitle,
            desc: fallbackDesc,
            benefits: ['Guaranteed A+ Quality', 'Under 24-Hour Delivery Available', 'Direct Communication with Experts']
        };

    useEffect(() => {
        window.scrollTo(0, 0);
        setToolInput('');
        setToolOutput('');
        setToolError('');
        setCustomForm({});
        setIsToolProcessing(false);
    }, [slug]);

    const isToolPage = slug && (slug.includes('tool') || slug.includes('checker') || slug.includes('typer') || slug.includes('generator') || slug.includes('summarizer') || slug.includes('writer') || slug.includes('humanizer') || slug.includes('calculator') || slug.includes('turnitin') || slug.includes('inception'));

    const handleProcessTool = async () => {
        const isPlagiarismScan = slug === 'free-plagiarism-checker' || Boolean(slug?.includes('turnitin'));
        const isFormEmpty = !toolInput.trim() && Object.values(customForm).filter(v => typeof v === 'string' && v.trim()).length === 0;
        if (isFormEmpty && !isPlagiarismScan) return;

        setIsToolProcessing(true);
        setToolError('');
        setToolOutput('');

        try {
            if (slug === 'free-grammar-checker') {
                // Free grammar checker API using LanguageTool 
                const response = await fetch('https://api.languagetool.org/v2/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        text: toolInput,
                        language: 'en-US'
                    })
                });

                if (!response.ok) throw new Error('API Rate limit or connection issue. Please try again.');

                const data = await response.json();
                if (data.matches && data.matches.length > 0) {
                    let formattedOutput = 'Errors found:\n\n';
                    data.matches.forEach((match: any, index: number) => {
                        formattedOutput += `${index + 1}. "${match.context.text.slice(match.context.offset, match.context.offset + match.context.length)}" -> ${match.message}\n`;
                        if (match.replacements && match.replacements.length > 0) {
                            formattedOutput += `   Suggested Fix: ${match.replacements.slice(0, 3).map((r: any) => r.value).join(', ')}\n`;
                        }
                        formattedOutput += '\n';
                    });
                    setToolOutput(formattedOutput);
                } else {
                    setToolOutput('No grammar errors found. Your text looks great!');
                }
            } else if (slug !== 'free-grammar-checker') {

                const baseApi = API;
                let finalPrompt = toolInput;
                if (!finalPrompt.trim() && Object.keys(customForm).length > 0) {
                    finalPrompt = Object.entries(customForm)
                        .filter(([k, v]) => typeof v === 'string' && v.trim())
                        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                        .join('\n');
                } else if (Object.keys(customForm).length > 0) {
                    finalPrompt += '\n\n' + Object.entries(customForm)
                        .filter(([k, v]) => typeof v === 'string' && v.trim())
                        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
                        .join('\n');
                }

                let lengthInstruction = '';
                if (slug && (slug.includes('thesis') || slug.includes('dissertation') || slug.includes('essay-writing') || slug.includes('research') || slug.includes('case-study') || slug.includes('coursework')) && !slug.includes('outline') && !slug.includes('statement')) {
                    lengthInstruction = '\n- TARGET CONTENT LENGTH: The generated output must be extensively detailed, rigorously academic, and explicitly target ~2,500 words in length. Do not summarize; elaborate deeply on all arguments and findings to meet this requirement.';
                }

                if (slug && content.title) {
                    finalPrompt = `CRITICAL SYSTEM COMMAND:\nYou are strictly operating as the "${content.title}" digital tool. Your ONLY purpose is to execute the following function: "${content.desc}". \n\nYou MUST adhere strictly to this tool's specific purpose. Do NOT engage in conversation, do NOT say "Here is your result", and do NOT output anything outside of the exact tool operation. Just return the processed output.\n\nCRITICAL FORMATTING INSTRUCTIONS:\nEnsure all generated content is highly organized, systematic, and cleanly structured. You MUST use markdown formatting appropriately:\n- Use clear headings (###) for major sections.\n- Use bullet points (*) or numbered lists (1., 2.) for key points, steps, or features.\n- Use short paragraphs and blockquotes (>) where necessary to break up walls of text.\n- Maintain a highly professional and clearly logical flow.${lengthInstruction}\n\nUser Input:\n${finalPrompt}`;
                }

                let API_URL = baseApi.replace(/\/+$/, '');
                if (!API_URL.includes('localhost') && API_URL.startsWith('http://')) API_URL = API_URL.replace('http://', 'https://');
                const res = await fetch(`${API_URL}/tools/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: finalPrompt })
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.error || 'AI Processing Failed.');
                setToolOutput(resData.result);

            }
        } catch (error: any) {
            setToolError(error.message || 'Something went wrong.');
            console.error(error);
        } finally {
            setIsToolProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!toolOutput) return;
        const cleanText = toolOutput.replace(/\*\*/g, '').replace(/\*/g, '');
        const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug || 'document'}-result.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const parseBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-bold text-[#000a1e]">{part.slice(2, -2).replace(/\*/g, '')}</strong>;
            }
            if (typeof part === 'string') {
                return part.replace(/\*/g, '');
            }
            return part;
        });
    };

    const renderFormattedOutput = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, index) => {
            if (line.startsWith('### ')) {
                return <h3 key={index} className="text-xl font-black text-[#000a1e] mt-6 mb-2 border-b-2 border-gray-100 pb-2">{line.replace('### ', '').replace(/\*\*/g, '')}</h3>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={index} className="text-2xl font-black text-[#000a1e] mt-8 mb-3 border-b-2 border-gray-200 pb-2">{line.replace('## ', '').replace(/\*\*/g, '')}</h2>;
            }
            if (line.startsWith('#### ')) {
                return <h4 key={index} className="text-lg font-bold text-[#002147] mt-4 mb-2">{line.replace('#### ', '').replace(/\*\*/g, '')}</h4>;
            }
            if (line.startsWith('> ')) {
                return <blockquote key={index} className="border-l-4 border-[#fea520] pl-4 italic text-gray-700 my-4 bg-[#fff9f0] p-4 rounded-r-lg shadow-sm">{line.replace('> ', '').replace(/\*\*/g, '')}</blockquote>;
            }
            if (line.trim().startsWith('* ')) {
                return <li key={index} className="ml-6 mb-2 list-none relative before:content-['•'] before:text-[#fea520] before:font-bold before:absolute before:-left-4 text-gray-700 leading-relaxed">{parseBold(line.replace('* ', ''))}</li>;
            }
            if (line.trim().match(/^[0-9]+\./)) {
                return <li key={index} className="ml-8 mb-2 font-medium text-gray-800 list-none relative"><span className="absolute -left-6 font-bold text-[#fea520]">{line.trim().split('.')[0]}.</span> {parseBold(line.replace(/^[0-9]+\./, ''))}</li>;
            }
            if (line.trim() === '---') {
                return <hr key={index} className="my-8 border-t-2 border-gray-100 border-dashed" />;
            }
            if (line.trim() === '') {
                return <div key={index} className="h-2"></div>;
            }
            return <p key={index} className="mb-3 text-gray-600 leading-relaxed">{parseBold(line)}</p>;
        });
    };

    const mockBlogs = [
        { title: 'How to Write a First-Class Dissertation', category: 'Writing Guide', image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=600&auto=format&fit=crop', desc: 'A step-by-step masterclass on conquering your final year dissertation without burning out.' },
        { title: 'Understanding Advanced Qualitative Research', category: 'Methodology', image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600&auto=format&fit=crop', desc: 'Demystifying thematic analysis, coding, and grounded theory for your master\'s thesis project.' },
        { title: 'The 2026 Guide to Academic SEO', category: 'Tech & Research', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop', desc: 'How to utilize modern AI engines and Google Scholar natively to surface hidden academic journals.' },
        { title: 'Mastering Time Management as a Full-Time Student', category: 'Student Life', image: 'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?q=80&w=600&auto=format&fit=crop', desc: 'Balancing internships, academic coursework, and a social life using the time-block method.' },
        { title: 'Defending Your Thesis: What Examiners Actually Want', category: 'Graduation', image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=600&auto=format&fit=crop', desc: 'An insider look from university professors on what makes a thesis defense truly remarkable and flawless.' },
        { title: '10 Citations Mistakes That Instantly Drop Your Grade', category: 'Referencing', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600', desc: 'Are you confusing APA 7th Edition formats? Make sure you never make these critical referencing mistakes again.' }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative z-0">
            {/* Ambient Background Globs & Giant Text Watermark */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] opacity-70">
                <div className="absolute top-[-5%] left-[-10%] w-[500px] h-[500px] bg-[#fea520] rounded-full blur-[200px] opacity-[0.12] mix-blend-multiply"></div>
                <div className="absolute top-[35%] right-[-10%] w-[600px] h-[600px] bg-[#fea520] rounded-full blur-[200px] opacity-[0.12] mix-blend-multiply"></div>
            </div>

            <div className="fixed inset-0 z-[-1] pointer-events-none opacity-[0.02] text-[180px] md:text-[240px] font-black leading-none overflow-hidden flex flex-col justify-between whitespace-nowrap text-[#000a1e] select-none">
                <div className="flex justify-between gap-10 w-full"><span>{slug === 'blogs' ? 'ARTICLES' : content.title.toUpperCase()}</span><span>PREMIUM</span></div>
                <div className="flex justify-between gap-10 w-full ml-[-20%]"><span>ACADEMIC</span><span>{slug === 'blogs' ? 'JOURNALS' : content.title.toUpperCase()}</span></div>
                <div className="flex justify-between gap-10 w-full"><span>{slug === 'blogs' ? 'RESOURCES' : content.title.toUpperCase()}</span><span>GUARANTEE</span></div>
            </div>

            <Navbar
                onOpenOrder={() => setOrderModalOpen(true)}
                onOpenSignIn={() => setSignInModalOpen(true)}
                onOpenDrawer={() => setDrawerOpen(true)}
                activeSection=""
                onNavigate={() => { }}
            />

            <main className="flex-grow flex flex-col items-center pt-10 pb-24 px-6 relative z-10 w-full">
                {slug === 'blogs' ? (
                    <div className="w-full max-w-7xl">
                        <div className="text-center mb-16">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-[#fea520]/10 text-[#e37e25] font-bold text-sm tracking-wide mb-4 uppercase">
                                Resources & Articles
                            </span>
                            <h1 className="text-4xl md:text-5xl font-black text-[#000a1e] mb-4">
                                Assignment<span className="text-[#fea520]">Minds</span> Blog
                            </h1>
                            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                                Read our latest tips, academic guides, and comprehensive strategies to drastically improve your university grades and research methodology.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {mockBlogs.map((blog, idx) => (
                                <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col">
                                    <div className="h-56 overflow-hidden relative">
                                        <img loading="lazy" decoding="async" src={blog.image} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-[#000a1e] text-xs font-bold px-3 py-1.5 rounded-full">
                                            {blog.category}
                                        </div>
                                    </div>
                                    <div className="p-6 flex flex-col flex-grow">
                                        <h3 className="text-xl font-bold text-[#000a1e] mb-3 group-hover:text-[#fea520] transition-colors line-clamp-2 leading-tight">
                                            {blog.title}
                                        </h3>
                                        <p className="text-sm text-gray-500 mb-6 line-clamp-3">
                                            {blog.desc}
                                        </p>
                                        <div className="mt-auto flex items-center text-[#fea520] font-bold text-sm">
                                            Read Article <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : isToolPage ? (
                    <div className="w-full max-w-6xl">
                        <div className="text-center mb-12">
                            <h1 className="text-4xl md:text-5xl font-black text-[#000a1e] mb-4">
                                Effortless {content.title.replace('Free ', '').replace('Pro ', '')} <span className="text-[#002147]">for Students</span>
                            </h1>
                            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                                {content.desc}
                            </p>
                        </div>

                        {slug === 'free-plagiarism-checker' || slug?.includes('turnitin') ? (
                            <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] flex flex-col p-8 md:p-12 relative overflow-hidden">
                                <div className="flex flex-col md:flex-row items-center gap-6 mb-8 w-full border-b pb-8">
                                    <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[#000a1e] mb-1">{content.supportText}</h3>
                                        <p className="text-gray-500 text-sm">Supported formats: .doc, .docx, .pdf, .txt. Max file size: 50MB.</p>
                                    </div>
                                </div>

                                <textarea
                                    value={toolInput}
                                    onChange={(e) => setToolInput(e.target.value)}
                                    placeholder={content.inputPlaceholder || "Paste your document text here to check for plagiarism, or upload a file..."}
                                    className="w-full h-48 p-4 border border-gray-200 rounded-lg mb-6 resize-none outline-none focus:border-[#fea520]"
                                ></textarea>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".txt,.doc,.docx,.pdf,.csv,.json"
                                    onChange={async (e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0];
                                            const fileName = file.name;
                                            const fileExt = fileName.toLowerCase().split('.').pop() || '';

                                            try {
                                                setToolInput(`[System: Securely extracting text from ${fileName} on device. Please wait...]\n`);
                                                let extractedText = '';

                                                if (['txt', 'csv', 'json', 'md'].includes(fileExt)) {
                                                    extractedText = await file.text();
                                                } else if (fileExt === 'pdf') {
                                                    const pdfjsLib = await import('pdfjs-dist');
                                                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

                                                    const arrayBuffer = await file.arrayBuffer();
                                                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                                                    let textChunks = [];
                                                    for (let i = 1; i <= pdf.numPages; i++) {
                                                        const page = await pdf.getPage(i);
                                                        const content = await page.getTextContent();
                                                        textChunks.push(content.items.map((item: any) => item.str).join(' '));
                                                    }
                                                    extractedText = textChunks.join('\n');
                                                } else if (fileExt === 'docx') {
                                                    const mammoth = await import('mammoth');
                                                    const arrayBuffer = await file.arrayBuffer();
                                                    const result = await mammoth.extractRawText({ arrayBuffer });
                                                    extractedText = result.value;
                                                } else {
                                                    throw new Error('Unsupported format for deep text extraction.');
                                                }

                                                const safeText = extractedText.substring(0, 15000);
                                                const truncatedMsg = extractedText.length > 15000 ? '...(TRUNCATED_AT_15K_CHARS_FOR_AI_PROCESSING)' : '';

                                                setToolInput(`[Document Uploaded: ${fileName}]\n\nPlease review this uploaded document configuration and estimate its originality.\n\n=== START OF DOCUMENT: ${fileName} ===\n${safeText}${truncatedMsg}\n=== END OF DOCUMENT ===\n\n`);
                                            } catch (err: any) {
                                                setToolInput(`[Document Uploaded: ${fileName}]\n\nPlease review this uploaded document configuration and estimate its originality. Note: Full text extraction failed (${err.message}).\n\n`);
                                            }
                                        }
                                    }}
                                />

                                <div className="flex flex-col sm:flex-row gap-4 justify-end">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-8 py-3 rounded-lg font-bold transition-all shadow-sm"
                                    >
                                        Upload File
                                    </button>
                                    <button
                                        onClick={handleProcessTool}
                                        disabled={isToolProcessing}
                                        className="bg-[#000a1e] hover:bg-[#002147] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {isToolProcessing ? 'Scanning...' : (content.actionButton || 'Scan Plagiarism')}
                                    </button>
                                </div>

                                {toolError && (
                                    <div className="w-full mt-6 p-4 bg-red-50 text-red-500 font-bold border border-red-100 rounded-lg text-center break-words">
                                        {toolError}
                                    </div>
                                )}
                                {toolOutput && (
                                    <div className="w-full mt-6 p-6 bg-gray-50 border rounded-lg text-left whitespace-pre-wrap flex flex-col gap-4">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <h3 className="font-bold text-lg text-[#000a1e]">Result:</h3>
                                            <button onClick={handleDownload} className="text-xs font-bold bg-[#000a1e] text-white px-3 py-1.5 rounded hover:bg-[#fea520] hover:text-[#000a1e] shadow-sm transition-all">Download .TXT</button>
                                        </div>
                                        {renderFormattedOutput(toolOutput)}
                                    </div>
                                )}
                            </div>
                        ) : slug === 'referencing-tool' ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                                <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col gap-4">
                                    <h3 className="font-bold text-[#000a1e] border-b pb-2">Source Type</h3>
                                    <div className="flex flex-col gap-2">
                                        {['Website', 'Journal', 'Book', 'Video', 'Newspaper'].map(item => (
                                            <label key={item} className="flex items-center gap-3 p-3 border rounded cursor-pointer hover:bg-gray-50">
                                                <input type="radio" name="source" onChange={() => setCustomForm({ ...customForm, type: item })} className="accent-[#fea520]" defaultChecked={item === 'Website'} />
                                                <span className="text-sm font-medium">{item}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col relative">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <input type="text" value={customForm.authorFirst || ''} onChange={(e) => setCustomForm({ ...customForm, authorFirst: e.target.value })} placeholder="Author First Name" className="border rounded p-3 text-sm outline-none focus:border-[#fea520]" />
                                        <input type="text" value={customForm.authorLast || ''} onChange={(e) => setCustomForm({ ...customForm, authorLast: e.target.value })} placeholder="Author Last Name" className="border rounded p-3 text-sm outline-none focus:border-[#fea520]" />
                                        <input type="text" value={customForm.title || ''} onChange={(e) => setCustomForm({ ...customForm, title: e.target.value })} placeholder="Title of Source / Identifier" className="border rounded p-3 text-sm outline-none focus:border-[#fea520] md:col-span-2" />
                                        <input type="date" value={customForm.date || ''} onChange={(e) => setCustomForm({ ...customForm, date: e.target.value })} className="border rounded p-3 text-sm outline-none text-gray-500 focus:border-[#fea520]" />
                                        <input type="text" value={customForm.url || ''} onChange={(e) => setCustomForm({ ...customForm, url: e.target.value })} placeholder="Publisher / URL" className="border rounded p-3 text-sm outline-none focus:border-[#fea520]" />
                                    </div>
                                    <button
                                        onClick={handleProcessTool}
                                        disabled={isToolProcessing}
                                        className="bg-[#fea520] hover:bg-[#e36100] disabled:bg-gray-300 disabled:cursor-not-allowed text-[#000a1e] px-6 py-3 rounded font-bold transition-colors shadow-sm w-full mt-auto"
                                    >
                                        {isToolProcessing ? 'Generating...' : content.actionButton}
                                    </button>

                                    {toolError && (
                                        <div className="w-full mt-6 p-4 bg-red-50 text-red-500 font-bold border border-red-100 rounded-lg text-center break-words">
                                            {toolError}
                                        </div>
                                    )}
                                    {toolOutput && (
                                        <div className="w-full mt-6 p-6 bg-gray-50 border rounded-lg text-left whitespace-pre-wrap text-sm flex flex-col gap-4">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <h3 className="font-bold text-lg text-[#000a1e]">Generated Citation:</h3>
                                                <button onClick={handleDownload} className="text-xs font-bold bg-[#000a1e] text-white px-3 py-1.5 rounded hover:bg-[#fea520] hover:text-[#000a1e] shadow-sm transition-all">Download .TXT</button>
                                            </div>
                                            {renderFormattedOutput(toolOutput)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : slug === 'free-thesis-statement-generator' || slug === 'free-dissertation-outline-generator' ? (
                            <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col relative">
                                <div className="grid grid-cols-1 gap-6 mb-8">
                                    <div>
                                        <label className="text-sm font-bold text-[#000a1e] mb-2 block">1. What is the main topic of your paper?</label>
                                        <input type="text" value={customForm.topic || ''} onChange={(e) => setCustomForm({ ...customForm, topic: e.target.value })} placeholder="e.g., Climate Change" className="w-full border rounded p-3 text-sm outline-none focus:border-[#fea520]" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-[#000a1e] mb-2 block">2. What is your main argument/stance?</label>
                                        <input type="text" value={customForm.argument || ''} onChange={(e) => setCustomForm({ ...customForm, argument: e.target.value })} placeholder="e.g., It requires immediate legislative action" className="w-full border rounded p-3 text-sm outline-none focus:border-[#fea520]" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-sm font-bold text-gray-500 mb-2 block">Supporting Point 1</label>
                                            <input type="text" value={customForm.point1 || ''} onChange={(e) => setCustomForm({ ...customForm, point1: e.target.value })} className="w-full border rounded p-3 text-sm outline-none bg-gray-50 focus:border-[#fea520]" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold text-gray-500 mb-2 block">Supporting Point 2</label>
                                            <input type="text" value={customForm.point2 || ''} onChange={(e) => setCustomForm({ ...customForm, point2: e.target.value })} className="w-full border rounded p-3 text-sm outline-none bg-gray-50 focus:border-[#fea520]" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-bold text-gray-500 mb-2 block">Supporting Point 3</label>
                                            <input type="text" value={customForm.point3 || ''} onChange={(e) => setCustomForm({ ...customForm, point3: e.target.value })} className="w-full border rounded p-3 text-sm outline-none bg-gray-50 focus:border-[#fea520]" />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleProcessTool}
                                    disabled={isToolProcessing}
                                    className="bg-[#fea520] hover:bg-[#e36100] disabled:bg-gray-300 disabled:cursor-not-allowed text-[#000a1e] px-8 py-4 rounded font-black text-lg transition-colors shadow-md mx-auto"
                                >
                                    {isToolProcessing ? (
                                        <span className="flex items-center space-x-2">
                                            <svg className="animate-spin h-5 w-5 text-[#000a1e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            <span>{loadingText}</span>
                                        </span>
                                    ) : content.actionButton}
                                </button>

                                {toolError && (
                                    <div className="w-full mt-8 p-4 bg-red-50 text-red-500 font-bold border border-red-100 rounded-lg text-center break-words">
                                        {toolError}
                                    </div>
                                )}
                                {toolOutput && (
                                    <div className="w-full mt-8 p-8 bg-gray-50 border rounded-lg text-left whitespace-pre-wrap font-medium flex flex-col gap-4">
                                        <div className="flex justify-between items-center border-b pb-4">
                                            <h3 className="font-bold text-xl text-[#000a1e]">Your Generated Content:</h3>
                                            <button onClick={handleDownload} className="text-xs font-bold bg-[#000a1e] text-white px-4 py-2 rounded hover:bg-[#fea520] hover:text-[#000a1e] shadow-sm transition-all">Download .TXT</button>
                                        </div>
                                        {renderFormattedOutput(toolOutput)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                                {/* Default Split Input Box */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] flex flex-col relative overflow-hidden">
                                    <div className="p-4 border-b border-gray-100 flex items-center justify-between text-sm text-gray-500 font-medium bg-gray-50/50">
                                        <span>{content.supportText || 'Drag and drop the document or paste text'}</span>
                                        <span className="text-xs">(.tex, .txt, .doc, .docx, .pdf)</span>
                                    </div>
                                    <textarea
                                        value={toolInput}
                                        onChange={(e) => setToolInput(e.target.value)}
                                        placeholder={content.inputPlaceholder || 'Type or paste content here...'}
                                        className="flex-grow w-full border-none outline-none p-6 text-gray-700 resize-none font-medium bg-transparent"
                                    />
                                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                                        <div className="flex gap-2">
                                            <input
                                                type="file"
                                                className="hidden"
                                                id="tool-file-upload"
                                                accept=".txt,.doc,.docx,.pdf,.csv,.json"
                                                onChange={async (e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        const file = e.target.files[0];
                                                        const fileName = file.name;
                                                        const fileExt = fileName.toLowerCase().split('.').pop() || '';

                                                        try {
                                                            setToolInput(prev => prev + `\n[System: Securely extracting text from ${fileName} on device. Please wait...]\n`);
                                                            let extractedText = '';

                                                            if (['txt', 'csv', 'json', 'md'].includes(fileExt)) {
                                                                extractedText = await file.text();
                                                            } else if (fileExt === 'pdf') {
                                                                const pdfjsLib = await import('pdfjs-dist');
                                                                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

                                                                const arrayBuffer = await file.arrayBuffer();
                                                                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                                                                let textChunks = [];
                                                                for (let i = 1; i <= pdf.numPages; i++) {
                                                                    const page = await pdf.getPage(i);
                                                                    const content = await page.getTextContent();
                                                                    textChunks.push(content.items.map((item: any) => item.str).join(' '));
                                                                }
                                                                extractedText = textChunks.join('\n');
                                                            } else if (fileExt === 'docx') {
                                                                const mammoth = await import('mammoth');
                                                                const arrayBuffer = await file.arrayBuffer();
                                                                const result = await mammoth.extractRawText({ arrayBuffer });
                                                                extractedText = result.value;
                                                            } else {
                                                                throw new Error('Unsupported format for deep text extraction.');
                                                            }

                                                            // Truncate massively large documents to prevent token overflow, giving priority to beginning.
                                                            const safeText = extractedText.substring(0, 15000);
                                                            const truncatedMsg = extractedText.length > 15000 ? '...(TRUNCATED_AT_15K_CHARS_FOR_AI_PROCESSING)' : '';

                                                            setToolInput(prev => {
                                                                let newText = prev.replace(`\n[System: Securely extracting text from ${fileName} on device. Please wait...]\n`, '');
                                                                return newText + `\n\n=== START OF DOCUMENT: ${fileName} ===\n${safeText}${truncatedMsg}\n=== END OF DOCUMENT ===\n\n`;
                                                            });
                                                        } catch (err: any) {
                                                            setToolInput(prev => {
                                                                let newText = prev.replace(`\n[System: Securely extracting text from ${fileName} on device. Please wait...]\n`, '');
                                                                return newText + `\n[Attached File: ${fileName} - Note: Full text extraction failed (${err.message})]\n`;
                                                            });
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => document.getElementById('tool-file-upload')?.click()}
                                                className="px-4 py-2 border border-gray-200 rounded text-xs font-bold hover:bg-gray-100 transition shadow-sm bg-white"
                                            >
                                                Upload File
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const link = prompt("Enter the URL to import context from:");
                                                    if (link) {
                                                        setToolInput(prev => prev + `\n[Imported Link: ${link}]\n`);
                                                    }
                                                }}
                                                className="px-4 py-2 border border-gray-200 rounded text-xs font-bold hover:bg-gray-100 transition shadow-sm bg-white"
                                            >
                                                Import Link
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleProcessTool}
                                            disabled={isToolProcessing || !toolInput.trim()}
                                            className="bg-[#fea520] hover:bg-[#e36100] disabled:bg-gray-300 disabled:cursor-not-allowed text-[#000a1e] px-6 py-2 rounded font-bold text-sm transition-colors shadow-sm"
                                        >
                                            {isToolProcessing ? (
                                                <span className="flex items-center space-x-2">
                                                    <svg className="animate-spin h-4 w-4 text-[#000a1e]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    <span>{loadingText}</span>
                                                </span>
                                            ) : content.actionButton || 'Process'}
                                        </button>
                                    </div>
                                </div>

                                {/* Default Output Box */}
                                <div className="bg-[#f9fafb] rounded-xl border border-gray-200 shadow-inner min-h-[400px] flex flex-col items-center justify-center p-8 text-center relative text-gray-400">
                                    {toolError ? (
                                        <div className="w-full h-full flex items-center justify-center text-red-500 font-medium whitespace-pre-wrap text-left px-8">
                                            {toolError}
                                        </div>
                                    ) : toolOutput ? (
                                        <div className="w-full h-full flex flex-col text-[#000a1e] font-medium whitespace-pre-wrap text-left text-sm overflow-y-auto">
                                            {renderFormattedOutput(toolOutput)}
                                        </div>
                                    ) : (
                                        <div>
                                            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                            <p className="text-lg font-medium">You will get <span className="text-[#000a1e] font-bold">{content.outputMessage || 'processed'}</span> text here.</p>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        {toolOutput && (
                                            <button onClick={handleDownload} className="text-xs font-bold bg-[#000a1e] text-white px-3 py-1.5 rounded hover:bg-[#fea520] hover:text-[#000a1e] shadow-sm transition-all focus:outline-none">Download .TXT</button>
                                        )}
                                        <button aria-label="copy" className="p-2 hover:bg-gray-200 rounded transition"><ArrowRight className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full max-w-6xl flex flex-col items-center gap-16">
                        <div className="max-w-4xl w-full bg-white/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-[0_20px_50px_rgba(0,10,30,0.05)] border border-white text-center mt-8">
                            <span className="inline-block px-4 py-1.5 rounded-full bg-[#fea520]/10 text-[#e37e25] font-bold text-sm tracking-wide mb-4 uppercase">
                                Premium Service
                            </span>
                            <h1 className="text-4xl md:text-5xl font-black text-[#000a1e] mb-4 leading-tight">
                                {content.title}
                            </h1>
                            <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto mb-8">
                                {content.desc}
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button
                                    onClick={() => setDrawerOpen(true)}
                                    className="bg-[#000a1e] hover:bg-[#002147] text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 w-full sm:w-auto"
                                >
                                    <Calculator className="w-5 h-5" /> Calculate Instant Quote
                                </button>
                                <button
                                    onClick={() => navigate('/')}
                                    className="bg-white hover:bg-gray-50 border border-gray-200 text-[#000a1e] font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition-all w-full sm:w-auto"
                                >
                                    Return to Homepage
                                </button>
                            </div>

                            <div className="mt-10 pt-8 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                                {content.benefits.map((benefit, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <CheckCircle2 className="w-6 h-6 text-[#1d1d1f] shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-[#000a1e]">{benefit}</h3>
                                            <p className="text-sm text-gray-500 mt-1">Guaranteed feature for your success.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3 Simple Steps Section */}
                        <div className="w-full text-center max-w-6xl pb-16">
                            <h2 className="text-3xl md:text-5xl font-black text-[#000a1e] mb-16 px-4">
                                Our Proven {content.title}: <span className="text-[#fea520]">3 Simple Steps</span>
                            </h2>

                            <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 px-4 md:px-0">
                                {/* Step 1 */}
                                <div className="flex-1 flex flex-col items-center text-center p-10 bg-white rounded-3xl shadow-[0_15px_40px_rgba(0,10,30,0.06)] border-t-4 border-[#000a1e] transform transition-transform hover:-translate-y-2 hover:shadow-2xl">
                                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-blue-100/50">
                                        <FileText className="w-10 h-10 text-[#000a1e]" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-[#000a1e] mb-4 leading-tight">{step1Title}</h3>
                                    <p className="text-base text-gray-500 leading-relaxed">
                                        {step1Desc}
                                    </p>
                                </div>

                                {/* Step 2 */}
                                <div className="flex-1 flex flex-col items-center text-center p-10 bg-white rounded-3xl shadow-[0_15px_40px_rgba(0,10,30,0.06)] border-t-4 border-[#fea520] transform transition-transform hover:-translate-y-2 hover:shadow-2xl">
                                    <div className="w-20 h-20 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-orange-100/50">
                                        <Lock className="w-10 h-10 text-[#fea520]" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-[#000a1e] mb-4 leading-tight">{step2Title}</h3>
                                    <p className="text-base text-gray-500 leading-relaxed">
                                        {step2Desc}
                                    </p>
                                </div>

                                {/* Step 3 */}
                                <div className="flex-1 flex flex-col items-center text-center p-10 bg-white rounded-3xl shadow-[0_15px_40px_rgba(0,10,30,0.06)] border-t-4 border-[#002147] transform transition-transform hover:-translate-y-2 hover:shadow-2xl">
                                    <div className="w-20 h-20 bg-[#f5f5f7] rounded-2xl flex items-center justify-center mb-8 border border-[#e5e5ea]">
                                        <Award className="w-10 h-10 text-[#1d1d1f]" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-[#000a1e] mb-4 leading-tight">{step3Title}</h3>
                                    <p className="text-base text-gray-500 leading-relaxed">
                                        {step3Desc}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-16 flex justify-center px-4">
                                <button onClick={() => setOrderModalOpen(true)} className="bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] font-black text-lg py-5 px-12 rounded-2xl shadow-xl transition-all hover:scale-105 border-b-4 border-[#c95400] active:border-b-0 active:mt-1">
                                    Get Urgent Help in 5 Hours!
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <Footer
                onOpenOrder={() => setOrderModalOpen(true)}
                onOpenSignIn={() => setSignInModalOpen(true)}
                onNavigate={() => { }}
            />

            <button
                id="sideNavToggle"
                onClick={() => setDrawerOpen(true)}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] hover:text-white px-3 py-4 rounded-l-2xl shadow-soft font-bold flex flex-col items-center gap-1.5 transition-all duration-300 hover:pr-4 cursor-pointer group"
            >
                <Calculator className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] tracking-wider uppercase [writing-mode:vertical-lr] rotate-180 font-extrabold">
                    COST CALC
                </span>
            </button>

            <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onProceedToOrder={() => setOrderModalOpen(true)} />
            <OrderModal isOpen={orderModalOpen} onClose={() => setOrderModalOpen(false)} />
            <SignInModal isOpen={signInModalOpen} onClose={() => setSignInModalOpen(false)} />
        </div>
    );
};
