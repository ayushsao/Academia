// Runs after `vite build`. The site is a single-page app, so every URL gets the
// same dist/index.html and the home page's title until JavaScript runs. This
// writes dist/<path>/index.html for each page in src/data/seoPages.json with
// that page's own title, description, canonical link and Open Graph tags, so
// search engines see the right values in the raw HTML. Vercel serves these
// files before the catch-all rewrite to /index.html.
import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://www.assignmentminds.com';
const dist = path.resolve('dist');
const pages = JSON.parse(fs.readFileSync(path.resolve('src/data/seoPages.json'), 'utf8'));
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(pagePath, { title, description }) {
    const url = `${SITE_URL}${pagePath === '/' ? '/' : pagePath}`;
    const replacements = [
        [/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`],
        [/<meta name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${esc(description)}" />`],
        [/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${esc(title)}" />`],
        [/<meta property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${esc(description)}" />`],
        [/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${url}" />`],
        [/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}" />`],
    ];
    let html = template;
    for (const [pattern, value] of replacements) {
        if (!pattern.test(html)) throw new Error(`prerender-meta: index.html is missing ${pattern}`);
        html = html.replace(pattern, value);
    }
    return html;
}

// Fallback for every other URL (blog posts, subjects, writer profiles…): the
// same app without a canonical link or the home page's title, so search
// engines never read those pages as copies of the home page. The page sets
// its own title and canonical once it loads. vercel.json rewrites to it.
const fallback = template
    .replace(/<title>[\s\S]*?<\/title>/, '<title>AssignmentMinds</title>')
    .replace(/\s*<link rel="canonical" href="[^"]*"\s*\/>/, '')
    .replace(/\s*<meta property="og:url" content="[^"]*"\s*\/>/, '');
if (fallback.includes('rel="canonical"')) throw new Error('prerender-meta: could not remove the canonical link from app.html');
fs.writeFileSync(path.join(dist, 'app.html'), fallback);

let count = 0;
for (const [pagePath, meta] of Object.entries(pages)) {
    const file = pagePath === '/' ? path.join(dist, 'index.html') : path.join(dist, pagePath, 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, render(pagePath, meta));
    count++;
}
console.log(`prerender-meta: wrote ${count} pages with their own title and description.`);
