import { API } from './api';

// Dynamic catalogue pages (GET /api/catalog/pages/…, admin preview).
export type EntityType = 'SUBJECT' | 'SERVICE' | 'PROJECT';
export type BlockType = 'HEADING' | 'RICH_TEXT' | 'INTRODUCTION' | 'FEATURES' | 'AVAILABLE_PROJECTS' | 'PROGRAMMING_LANGUAGES' | 'FAQ' | 'CTA' | 'IMAGE' | 'CUSTOM_HTML' | 'SEO_CONTENT';

export type PageMedia = { url: string; name: string; kind: 'IMAGE' | 'FILE'; alt: string };
export type PageProject = { id: string; title: string; slug: string; summary: string; url: string | null; image: { url: string; alt: string } | null };
export type PageFaq = { id: string; question: string; answer: string };
export type PageBlock = { id: string; type: BlockType; title: string; content: Record<string, any>; media: PageMedia[]; projects?: PageProject[]; faqs?: PageFaq[] };
export type PageSeo = { title: string; description: string; keywords: string[]; canonical: string; robots: string; og: { title: string; description: string; type: string; url: string; image: string | null } };
export type CatalogPageData = {
    entity: { type: EntityType; id: string; name: string; slug: string; description: string; path: string; live: boolean; image: { url: string; alt: string } | null; files: { url: string; name: string; kind: 'IMAGE' | 'FILE' }[]; ids: { subjectId: string; serviceId: string | null; projectId: string | null } };
    breadcrumbs: { name: string; path: string }[];
    children: { name: string; path: string; summary: string }[];
    blocks: PageBlock[];
    faqs: PageFaq[];
    seo: PageSeo;
};

// Public pricing (GET /api/catalog/pricing): the active rule per currency, all amounts in minor units.
export type SpacingOption = { key: string; label: string; factor: number };
export type PricingRate = { currency: string; currencyDigits: number; wordsPerPage: number; basePriceMinor: number; multiplier: number; unitPriceMinor: number; formula: string; formulaLabel: string; effectiveDate: string };
export type PublicPricing = { rounding: string; minPages: number; maxPages: number; spacingOptions: SpacingOption[]; defaultSpacing: string; rates: PricingRate[] };
export type PublicQuote = { pages: number; words: number; wordsPerPage: number; spacing: string; unitPriceMinor: number; totalMinor: number; currency: string; currencyDigits: number };

// What a catalogue page hands the order form (it loads the pricing itself; the server re-prices on submit).
export type CatalogOrderContext = {
    subjectId: string; serviceId: string | null; projectId: string | null;
    subjectName: string; serviceName: string; projectTitle: string;
    currency?: string; words?: number; spacing?: string;
};

// Published hierarchy (GET /api/catalog/tree).
export type CatalogTree = { subjects: { id: string; name: string; slug: string; description: string; image: { url: string } | null; services: { id: string; name: string; slug: string; description: string; projects: { id: string; title: string; slug: string }[] }[] }[] };

// API paths are returned relative to the API origin (e.g. /api/catalog/media/x.png).
export const API_ORIGIN = API.replace(/\/api$/, '');
export const absoluteMedia = (url: string) => (/^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`);

// Block catalogue for the admin: label, one-line help and a starting payload.
export const BLOCK_META: Record<BlockType, { label: string; help: string; defaults: Record<string, any>; titlePlaceholder: string }> = {
    HEADING: { label: 'Heading', help: 'A section title with an optional subtitle.', defaults: { level: 'h2', subtitle: '' }, titlePlaceholder: 'Section heading (required)' },
    RICH_TEXT: { label: 'Rich text', help: 'Formatted paragraphs, lists and links.', defaults: { html: '' }, titlePlaceholder: 'Optional heading' },
    INTRODUCTION: { label: 'Introduction', help: 'A lead paragraph with an optional highlight line.', defaults: { html: '', highlight: '' }, titlePlaceholder: 'Optional heading' },
    FEATURES: { label: 'Features', help: 'A grid of benefits or selling points.', defaults: { columns: 3, items: [{ title: '', text: '' }] }, titlePlaceholder: 'e.g. Why choose us' },
    AVAILABLE_PROJECTS: { label: 'Available projects', help: 'Cards linking to projects under this page.', defaults: { mode: 'AUTO', projectIds: [], limit: 12 }, titlePlaceholder: 'e.g. Sample projects' },
    PROGRAMMING_LANGUAGES: { label: 'Programming languages', help: 'A list of languages or tools you cover.', defaults: { items: [{ name: '', note: '' }] }, titlePlaceholder: 'e.g. Languages we cover' },
    FAQ: { label: 'FAQ', help: 'Shows this page’s FAQs (managed in the FAQ tab).', defaults: { limit: 20 }, titlePlaceholder: 'e.g. Frequently asked questions' },
    CTA: { label: 'Call to action', help: 'A banner with a button (order form or a link).', defaults: { text: '', buttonLabel: 'Get a quote', buttonUrl: '', action: 'ORDER' }, titlePlaceholder: 'e.g. Ready to get started?' },
    IMAGE: { label: 'Image', help: 'A single image with caption.', defaults: { caption: '', alt: '', size: 'wide' }, titlePlaceholder: 'Optional heading' },
    CUSTOM_HTML: { label: 'Custom HTML', help: 'Your own markup (scripts and styles are removed for safety).', defaults: { html: '' }, titlePlaceholder: 'Optional heading' },
    SEO_CONTENT: { label: 'SEO content', help: 'Long-form text for search engines, optionally collapsed.', defaults: { html: '', collapsible: true }, titlePlaceholder: 'e.g. About this service' },
};
export const BLOCK_TYPES = Object.keys(BLOCK_META) as BlockType[];
