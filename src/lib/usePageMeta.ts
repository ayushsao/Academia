import { useEffect } from 'react';
import seoPages from '../data/seoPages.json';

// The live site's address, used for canonical links so preview and
// non-www copies never compete with the real pages in search results.
export const SITE_URL = 'https://www.assignmentminds.com';

type PageMeta = { title: string; description: string };
const PAGES: Record<string, PageMeta> = seoPages;

// Sets the title, description, canonical link and Open Graph/Twitter tags
// for a public page. The values come from src/data/seoPages.json (also used
// to pre-render each page's HTML at build time); `fallback` covers pages
// that aren't listed there. Everything is restored on unmount.
export function usePageMeta(path: string, fallback?: PageMeta) {
    const meta = PAGES[path] || fallback;
    const title = meta?.title;
    const description = meta?.description;

    useEffect(() => {
        if (!title) return;
        const previousTitle = document.title;
        const restore: (() => void)[] = [];

        const set = (selector: string, create: () => Element, attr: string, value: string) => {
            let el = document.head.querySelector(selector);
            if (el) {
                const old = el.getAttribute(attr);
                restore.push(() => (old === null ? el!.removeAttribute(attr) : el!.setAttribute(attr, old)));
            } else {
                el = create();
                document.head.appendChild(el);
                const added = el;
                restore.push(() => added.remove());
            }
            el.setAttribute(attr, value);
        };
        const metaTag = (attr: 'name' | 'property', key: string, value: string) =>
            set(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }, 'content', value);

        const url = `${SITE_URL}${path === '/' ? '/' : path}`;
        document.title = title;
        if (description) {
            metaTag('name', 'description', description);
            metaTag('property', 'og:description', description);
            metaTag('name', 'twitter:description', description);
        }
        metaTag('property', 'og:title', title);
        metaTag('name', 'twitter:title', title);
        metaTag('property', 'og:url', url);
        set('link[rel="canonical"]', () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l; }, 'href', url);

        return () => {
            document.title = previousTitle;
            restore.reverse().forEach(fn => fn());
        };
    }, [path, title, description]);
}
