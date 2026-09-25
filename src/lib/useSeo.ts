import { useEffect } from 'react';
import type { CatalogPageData } from './catalogContent';

// Applies database-driven SEO to the document head: title, description,
// keywords, robots, canonical, Open Graph/Twitter tags and JSON-LD
// (BreadcrumbList + FAQPage). Everything it adds is removed on unmount.
export function useSeo(page: CatalogPageData | null) {
    useEffect(() => {
        if (!page) return;
        const { seo } = page;
        const previousTitle = document.title;
        const added: Element[] = [];
        const touched: { el: Element; attr: string; value: string | null }[] = [];

        const meta = (key: string, value: string | null | undefined, attr: 'name' | 'property' = 'name') => {
            if (!value) return;
            let el = document.head.querySelector(`meta[${attr}="${key}"]`);
            if (el) touched.push({ el, attr: 'content', value: el.getAttribute('content') });
            else { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); added.push(el); }
            el.setAttribute('content', value);
        };

        document.title = seo.title;
        meta('description', seo.description);
        meta('keywords', seo.keywords.join(', '));
        meta('robots', seo.robots);
        meta('og:title', seo.og.title, 'property');
        meta('og:description', seo.og.description, 'property');
        meta('og:type', seo.og.type, 'property');
        meta('og:url', seo.og.url, 'property');
        meta('og:image', seo.og.image, 'property');
        meta('twitter:card', seo.og.image ? 'summary_large_image' : 'summary');
        meta('twitter:title', seo.og.title);
        meta('twitter:description', seo.og.description);
        meta('twitter:image', seo.og.image);

        let canonical = document.head.querySelector('link[rel="canonical"]');
        if (canonical) touched.push({ el: canonical, attr: 'href', value: canonical.getAttribute('href') });
        else { canonical = document.createElement('link'); canonical.setAttribute('rel', 'canonical'); document.head.appendChild(canonical); added.push(canonical); }
        canonical.setAttribute('href', seo.canonical.startsWith('http') ? seo.canonical : `${window.location.origin}${seo.canonical}`);

        const origin = window.location.origin;
        const ld: object[] = [{
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: page.breadcrumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${origin}${c.path}` })),
        }];
        if (page.faqs.length) ld.push({
            '@context': 'https://schema.org', '@type': 'FAQPage',
            mainEntity: page.faqs.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
        });
        for (const data of ld) {
            const s = document.createElement('script');
            s.type = 'application/ld+json';
            s.text = JSON.stringify(data).replace(/</g, '\\u003c');
            document.head.appendChild(s); added.push(s);
        }

        return () => {
            document.title = previousTitle;
            added.forEach(el => el.remove());
            touched.forEach(({ el, attr, value }) => (value === null ? el.removeAttribute(attr) : el.setAttribute(attr, value)));
        };
    }, [page]);
}
