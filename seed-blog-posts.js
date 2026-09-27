import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogPost, connectDB } from './server/db.js';
import { cleanRichText } from './server/services/contentBlocks.js';

// Adds ten starter blog posts as PUBLISHED. Safe to run again: a post whose
// slug already exists is skipped, so edits made in Admin → Blog are kept.
// Run: node seed-blog-posts.js

const AUTHOR = 'AssignmentMinds Editorial';

const POSTS = [
    {
        slug: 'how-to-write-a-strong-essay-introduction',
        title: 'How to Write a Strong Essay Introduction',
        category: 'Writing Tips',
        tags: ['essay writing', 'introduction', 'structure'],
        excerpt: 'Your introduction decides how a marker reads the rest of your essay. Here is a simple four-part structure that works for almost any topic.',
        content: `
<p>Markers often form a view of an essay within its first paragraph. A clear introduction tells them what you are arguing and how you will get there, so everything that follows is easier to follow and easier to reward.</p>
<h2>A four-part structure</h2>
<ol>
<li><strong>Context.</strong> One or two sentences that place the topic in its wider field. Skip grand openings like "Since the dawn of time"; start close to your subject.</li>
<li><strong>The problem or question.</strong> Say what is debated, unclear or important about the topic.</li>
<li><strong>Your thesis.</strong> One sentence that answers the question. This is your argument, not a list of topics.</li>
<li><strong>Roadmap.</strong> Briefly say how the essay is organised: "First… then… finally…".</li>
</ol>
<h2>Keep it in proportion</h2>
<p>For most essays the introduction should be around 10% of the word count. In a 2,000-word essay that is roughly 200 words. Anything longer usually means you have started the main discussion too early.</p>
<h2>Write it last</h2>
<p>Your argument often sharpens while you write the body. Draft a rough introduction to get started, then rewrite it once the essay is finished so it matches what you actually argued.</p>
<h2>Common mistakes</h2>
<ul>
<li>Repeating the question word for word instead of answering it.</li>
<li>Defining terms from a general dictionary instead of from academic sources.</li>
<li>Promising points in the roadmap that never appear in the essay.</li>
</ul>
<p>Read your introduction and conclusion side by side before you submit. If they describe the same argument, your essay holds together.</p>`,
    },
    {
        slug: 'harvard-apa-mla-referencing-guide',
        title: 'Harvard, APA or MLA? A Quick Referencing Guide',
        category: 'Referencing',
        tags: ['referencing', 'harvard', 'apa', 'mla', 'citations'],
        excerpt: 'The three most common referencing styles side by side, with examples of in-text citations and reference list entries.',
        content: `
<p>Your module handbook tells you which referencing style to use. If it does not, ask your tutor: using the wrong style can cost marks even when your sources are excellent.</p>
<h2>In-text citations</h2>
<table>
<thead><tr><th>Style</th><th>Example</th></tr></thead>
<tbody>
<tr><td>Harvard</td><td>(Smith, 2021, p. 14)</td></tr>
<tr><td>APA 7th</td><td>(Smith, 2021, p. 14)</td></tr>
<tr><td>MLA 9th</td><td>(Smith 14)</td></tr>
</tbody>
</table>
<h2>Book in the reference list</h2>
<ul>
<li><strong>Harvard:</strong> Smith, J. (2021) <em>Understanding Research</em>. London: Sage.</li>
<li><strong>APA:</strong> Smith, J. (2021). <em>Understanding research</em>. Sage.</li>
<li><strong>MLA:</strong> Smith, John. <em>Understanding Research</em>. Sage, 2021.</li>
</ul>
<h2>Key differences</h2>
<ul>
<li>APA uses sentence case for titles; Harvard and MLA usually use title case.</li>
<li>MLA puts the date near the end and does not show it in the in-text citation.</li>
<li>Harvard is a family of styles, so universities often publish their own version. Follow your university's guide exactly.</li>
</ul>
<h2>Save time</h2>
<p>Record full details of every source as you read: author, year, title, publisher, page numbers and URL. A reference manager such as Zotero or Mendeley can then format the list for you, but always check its output against your style guide.</p>`,
    },
    {
        slug: 'how-to-structure-a-dissertation',
        title: 'How to Structure a Dissertation, Chapter by Chapter',
        category: 'Dissertation',
        tags: ['dissertation', 'structure', 'thesis'],
        excerpt: 'What goes in each chapter of a typical dissertation, and how long each one should be.',
        content: `
<p>Most empirical dissertations follow the same broad shape. Your department may use different chapter names, so check the handbook, but the job each chapter does stays the same.</p>
<h2>1. Introduction</h2>
<p>Set out the topic, why it matters, your research aim and your research questions. End with an outline of the chapters.</p>
<h2>2. Literature review</h2>
<p>Show what is already known, where scholars disagree and what is missing. The gap you identify should lead directly to your research questions.</p>
<h2>3. Methodology</h2>
<p>Explain how you collected and analysed your data, and why those methods suit your questions. Cover sampling, ethics and limitations.</p>
<h2>4. Findings or results</h2>
<p>Present what you found, clearly and without interpretation. Use tables and figures where they help.</p>
<h2>5. Discussion</h2>
<p>Interpret the findings: what do they mean, how do they compare with the literature, and what are their limits?</p>
<h2>6. Conclusion</h2>
<p>Answer your research questions directly, state your contribution and suggest further research.</p>
<h2>A rough word split</h2>
<p>For a 10,000-word dissertation, a common split is: introduction 10%, literature review 25%, methodology 15%, findings 20%, discussion 20% and conclusion 10%. Adjust it to your subject and your supervisor's advice.</p>
<p>Write the methodology early, while your decisions are fresh, and leave the introduction and abstract until the end.</p>`,
    },
    {
        slug: 'writing-a-critical-literature-review',
        title: 'Writing a Literature Review That Is Critical, Not Descriptive',
        category: 'Research',
        tags: ['literature review', 'critical thinking', 'research'],
        excerpt: 'A literature review is more than a list of summaries. Learn how to group sources by theme and evaluate them.',
        content: `
<p>The most common feedback on literature reviews is "too descriptive". That usually means each paragraph summarises one source, one after another, without comparing them.</p>
<h2>Organise by theme, not by author</h2>
<p>Instead of "Smith (2019) found… Jones (2020) found…", group sources around the ideas they share or dispute: "Several studies link X to Y (Smith, 2019; Jones, 2020), but these rely on small samples…".</p>
<h2>Questions to ask of every source</h2>
<ul>
<li>What is the main claim, and what evidence supports it?</li>
<li>How was the study done, and does the method fit the claim?</li>
<li>Who was studied, where and when? Would the findings apply elsewhere?</li>
<li>Do other studies agree or disagree, and why might that be?</li>
</ul>
<h2>Use a synthesis matrix</h2>
<p>Make a table with sources as rows and themes as columns. Filling it in shows you which themes are well covered, where sources conflict and where the gaps are.</p>
<h2>Lead to your research</h2>
<p>End the review by stating the gap your own work addresses. The reader should finish the chapter already expecting your research questions.</p>
<h2>Useful phrases</h2>
<ul>
<li>"In contrast to…, … argues that…"</li>
<li>"While these findings are consistent, they are limited by…"</li>
<li>"Less attention has been paid to…"</li>
</ul>`,
    },
    {
        slug: 'how-to-avoid-plagiarism',
        title: 'How to Avoid Plagiarism: Paraphrasing and Citing Properly',
        category: 'Study Skills',
        tags: ['plagiarism', 'paraphrasing', 'academic integrity'],
        excerpt: 'Most plagiarism is accidental. These habits help you use sources confidently and credit them correctly.',
        content: `
<p>Plagiarism means presenting someone else's words or ideas as your own. Most cases in student work are accidental, caused by rushed note-taking or weak paraphrasing, but the penalties can still be serious.</p>
<h2>Take notes you can trust</h2>
<p>When you copy text into your notes, put it in quotation marks and record the page number straight away. Write your own thoughts in a different colour so you never mix them up later.</p>
<h2>Paraphrase properly</h2>
<ol>
<li>Read the passage until you understand it.</li>
<li>Close the source and explain the idea in your own words.</li>
<li>Compare with the original: if you kept its sentence structure or key phrases, rewrite it.</li>
<li>Cite the source. A paraphrase still needs a citation.</li>
</ol>
<h2>When to quote</h2>
<p>Quote only when the exact wording matters, such as a definition or a striking phrase. Keep quotations short and explain them in your own words afterwards.</p>
<h2>Common knowledge</h2>
<p>Facts that are widely known and easily checked, such as the year of a major historical event, usually need no citation. Statistics, interpretations and arguments always do. If in doubt, cite.</p>
<h2>Check before you submit</h2>
<p>Many universities let you run a draft through their similarity checker. A high score does not always mean plagiarism, but it shows you where to check your citations and paraphrasing.</p>`,
    },
    {
        slug: 'time-management-for-assignment-deadlines',
        title: 'Time Management for Assignment Deadlines',
        category: 'Study Skills',
        tags: ['time management', 'deadlines', 'productivity'],
        excerpt: 'A practical way to plan an assignment backwards from the deadline, so the last few days are for polishing, not panic.',
        content: `
<p>Most deadline stress comes from starting the writing too late, not from the amount of work. Planning backwards from the due date makes the workload visible early.</p>
<h2>Plan backwards</h2>
<p>Take the deadline and work back:</p>
<ul>
<li><strong>Last 2 days:</strong> proofreading, referencing and formatting.</li>
<li><strong>Before that:</strong> editing the full draft.</li>
<li><strong>Middle of the period:</strong> writing the first draft.</li>
<li><strong>First third:</strong> understanding the brief, research and outlining.</li>
</ul>
<h2>Break the task into small steps</h2>
<p>"Write essay" is hard to start. "Find five sources on topic X" or "Draft the second body paragraph" are easy to start and easy to finish.</p>
<h2>Work in focused blocks</h2>
<p>Try 25 to 50 minutes of focused work followed by a short break. Put your phone in another room and close tabs you do not need.</p>
<h2>Handle clashing deadlines</h2>
<p>List all your deadlines in one calendar. Rank tasks by due date and by the share of the module mark they carry. If you are genuinely overloaded, speak to your tutor early; extensions are much easier to agree before the deadline than after it.</p>
<h2>Protect your sleep</h2>
<p>Late nights feel productive but usually lead to slower work the next day. A steady routine gets more done over a week.</p>`,
    },
    {
        slug: 'how-to-write-a-thesis-statement',
        title: 'How to Write a Clear Thesis Statement',
        category: 'Writing Tips',
        tags: ['thesis statement', 'argument', 'essay writing'],
        excerpt: 'A good thesis statement is specific, arguable and answers the question. Here is how to build one, with examples.',
        content: `
<p>The thesis statement is the one sentence your whole essay sets out to prove. If you can state it clearly, the rest of the essay becomes easier to plan.</p>
<h2>Three tests of a good thesis</h2>
<ul>
<li><strong>It answers the question.</strong> Not a restatement of the topic, but a position on it.</li>
<li><strong>It is arguable.</strong> A reasonable person could disagree, so you need evidence to convince them.</li>
<li><strong>It is specific.</strong> It names what, how or why, not just "there are many factors".</li>
</ul>
<h2>From weak to strong</h2>
<p><strong>Weak:</strong> "Social media has advantages and disadvantages for students."</p>
<p><strong>Better:</strong> "Social media harms students' concentration."</p>
<p><strong>Strong:</strong> "Although social media helps students collaborate, frequent notifications reduce their ability to concentrate on long reading tasks, which lowers the quality of independent study."</p>
<h2>A simple formula</h2>
<p>Try: <em>Although [counter-view], [your claim] because [main reasons].</em> The "although" shows you have considered the other side, and the reasons give you the plan for your body paragraphs.</p>
<h2>Where to put it</h2>
<p>In most essays the thesis goes at the end of the introduction. Refer back to it in each topic sentence and restate it, in new words, in the conclusion.</p>`,
    },
    {
        slug: 'how-to-write-a-case-study-analysis',
        title: 'How to Write a Case Study Analysis',
        category: 'Writing Tips',
        tags: ['case study', 'business', 'analysis'],
        excerpt: 'A step-by-step method for business, nursing and law case studies: identify the problem, apply theory, recommend action.',
        content: `
<p>Case studies ask you to apply theory to a real or realistic situation. Markers look for clear analysis and practical recommendations, not a retelling of the case.</p>
<h2>1. Read the case twice</h2>
<p>Read once for the story and once with a pen, noting facts, figures, people and problems. Separate facts from opinions voiced by characters in the case.</p>
<h2>2. Identify the core problem</h2>
<p>Cases often show many symptoms of one underlying problem. Falling sales, staff turnover and complaints might all come from poor management communication.</p>
<h2>3. Apply relevant theory</h2>
<p>Use the models from your module, for example SWOT, PESTLE or Porter's Five Forces in business, or a reflective model in nursing. Explain what the model reveals about this case rather than describing the model in general.</p>
<h2>4. Consider alternatives</h2>
<p>Set out two or three possible solutions and weigh the advantages, disadvantages and costs of each.</p>
<h2>5. Recommend and plan</h2>
<p>Choose the best option and explain why. Say who should do what, by when, and how success will be measured.</p>
<h2>A typical structure</h2>
<ul>
<li>Introduction and summary of the case</li>
<li>Problem identification</li>
<li>Analysis using theory</li>
<li>Alternative solutions</li>
<li>Recommendations and implementation</li>
<li>Conclusion</li>
</ul>`,
    },
    {
        slug: 'qualitative-vs-quantitative-research',
        title: 'Qualitative vs Quantitative Research: Which Should You Use?',
        category: 'Research',
        tags: ['research methods', 'methodology', 'qualitative', 'quantitative'],
        excerpt: 'How the two main research approaches differ, when each fits, and how to justify your choice in a methodology chapter.',
        content: `
<p>Your research question should decide your method, not the other way round. Start by asking what kind of answer you need.</p>
<h2>Quantitative research</h2>
<p>Works with numbers to measure, compare and test relationships.</p>
<ul>
<li><strong>Good for:</strong> "How many?", "How much?", "Is there a relationship between X and Y?"</li>
<li><strong>Typical methods:</strong> surveys with closed questions, experiments, analysis of existing datasets.</li>
<li><strong>Strengths:</strong> larger samples, findings that can be generalised, statistical testing.</li>
</ul>
<h2>Qualitative research</h2>
<p>Works with words, images and observations to understand experiences and meanings.</p>
<ul>
<li><strong>Good for:</strong> "How?", "Why?", "What is it like to…?"</li>
<li><strong>Typical methods:</strong> interviews, focus groups, observation, document analysis.</li>
<li><strong>Strengths:</strong> depth, context and the participants' own perspectives.</li>
</ul>
<h2>Mixed methods</h2>
<p>Combining both can give breadth and depth, for example a survey followed by interviews. It also takes more time, so make sure your project timeline allows for it.</p>
<h2>Justifying your choice</h2>
<p>In your methodology chapter, link the method to your research questions, cite methods textbooks that support your approach, and acknowledge its limitations honestly.</p>`,
    },
    {
        slug: 'proofreading-checklist-before-submission',
        title: 'The Proofreading Checklist to Use Before You Submit',
        category: 'Writing Tips',
        tags: ['proofreading', 'editing', 'checklist'],
        excerpt: 'Small errors cost marks. Work through this checklist in three passes: structure, sentences, then details.',
        content: `
<p>Proofreading is easier and more thorough when you check one thing at a time. Leave at least a few hours, ideally a day, between finishing your draft and proofreading it.</p>
<h2>Pass 1: Structure</h2>
<ul>
<li>Does the essay answer the exact question set?</li>
<li>Does each paragraph have one clear point, stated in its first sentence?</li>
<li>Does the conclusion match the argument in the introduction?</li>
<li>Are you within the word limit?</li>
</ul>
<h2>Pass 2: Sentences</h2>
<ul>
<li>Read aloud. Anything you stumble over needs rewriting.</li>
<li>Split sentences longer than about three lines.</li>
<li>Cut filler words such as "very", "really" and "in order to".</li>
<li>Check that each paragraph links to the next.</li>
</ul>
<h2>Pass 3: Details</h2>
<ul>
<li>Spelling, including names of theorists and places.</li>
<li>Consistent spelling convention (UK or US English).</li>
<li>Every in-text citation has a reference list entry, and the other way round.</li>
<li>Headings, page numbers, font and spacing follow the brief.</li>
<li>Tables and figures are numbered and referred to in the text.</li>
</ul>
<h2>Tips</h2>
<p>Change the font or print the document: seeing it differently helps you spot errors. Spell checkers miss correctly spelled wrong words, such as "their" for "there", so never rely on them alone.</p>`,
    },
];

const words = (html) => String(html).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

async function seed() {
    await connectDB();
    const start = Date.now();
    let added = 0;
    for (const [i, p] of POSTS.entries()) {
        if (await BlogPost.exists({ slug: p.slug })) { console.log(`- skipped (exists): ${p.slug}`); continue; }
        const content = cleanRichText(p.content);
        await BlogPost.create({
            ...p,
            content,
            author: AUTHOR,
            status: 'PUBLISHED',
            // One minute apart so the list keeps this order (first post newest).
            publishedAt: new Date(start - i * 60_000),
            readingMinutes: Math.max(1, Math.round(words(content) / 200)),
            seo: { metaTitle: `${p.title} | AssignmentMinds`, metaDescription: p.excerpt },
            createdBy: 'seed-blog-posts',
            updatedBy: 'seed-blog-posts',
        });
        added++;
        console.log(`+ added: ${p.slug}`);
    }
    console.log(`Done. ${added} added, ${POSTS.length - added} skipped.`);
    await mongoose.disconnect();
}

seed().catch(async (err) => { console.error(err); await mongoose.disconnect(); process.exit(1); });
