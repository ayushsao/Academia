import mongoose from 'mongoose';
import { SiteSettings, PricingRule, CatalogProject, CatalogService, CatalogSubject } from '../db.js';
import { currencyDigits } from './money.js';

// Catalogue pricing. Nothing here is a business constant: words-per-page,
// spacing factors and rounding come from the word config (Admin → Catalog →
// Word/Page config), and base price / multiplier / formula come from PricingRule.

// ── Word / page configuration ──────────────────────────────────────────────────

export const WORD_CONFIG_KEY = 'catalog_word_config';

// Initial values only (editable in the admin); the stored document always wins.
export const DEFAULT_WORD_CONFIG = {
    defaultWordsPerPage: 275,
    rounding: 'CEIL',            // how words convert to billable pages: CEIL | ROUND | EXACT
    minPages: 1,
    maxPages: 500,
    spacingOptions: [
        { key: 'DOUBLE', label: 'Double spaced', factor: 1 },
        { key: 'SINGLE', label: 'Single spaced', factor: 2 },   // twice the words on a page → counts as 2 pages
    ],
    defaultSpacing: 'DOUBLE',
};

export async function getWordConfig() {
    const row = await SiteSettings.findOne({ key: WORD_CONFIG_KEY }).lean();
    return { ...DEFAULT_WORD_CONFIG, ...(row?.value || {}) };
}

export async function saveWordConfig(config) {
    await SiteSettings.updateOne({ key: WORD_CONFIG_KEY }, { $set: { value: config } }, { upsert: true });
    return getWordConfig();
}

// ── Formulas ───────────────────────────────────────────────────────────────────
// Each formula returns the unit price (per billable page) in minor units. Add a
// new entry here (and it becomes selectable on pricing rules); nothing else changes.
export const FORMULAS = {
    BASE_X_MULTIPLIER: {
        label: 'Base price × multiplier',
        description: 'Final price per page = base price × multiplier.',
        unitPrice: (rule) => rule.basePriceMinor * rule.multiplier,
    },
};

export class PricingError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

export function unitPriceFor(rule) {
    const formula = FORMULAS[rule.formula] || FORMULAS.BASE_X_MULTIPLIER;
    return Math.round(formula.unitPrice(rule));
}

// ── Rule resolution ────────────────────────────────────────────────────────────

const oid = (v) => (v && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : null);

// The most specific ACTIVE rule already in effect for the currency wins:
// project-level, then service-level, then subject-level; latest effectiveDate first.
export async function resolveRule({ subjectId, serviceId, projectId, currency, at = new Date() }) {
    const subject = oid(subjectId);
    if (!subject) throw new PricingError('Choose a subject.');
    let service = oid(serviceId);
    const project = oid(projectId);
    if (project && !service) service = (await CatalogProject.findById(project).select('serviceId').lean())?.serviceId || null;

    const scopes = [
        ...(project ? [{ serviceId: service, projectId: project }, { serviceId: null, projectId: project }] : []),
        ...(service ? [{ serviceId: service, projectId: null }] : []),
        { serviceId: null, projectId: null },
    ];
    for (const scope of scopes) {
        const rule = await PricingRule.findOne({
            subjectId: subject, ...scope, status: 'ACTIVE', effectiveDate: { $lte: at }, ...(currency ? { currency } : {}),
        }).sort({ effectiveDate: -1, updatedAt: -1 }).lean();
        if (rule) return rule;
    }
    return null;
}

// A selection can be priced only while it and its parents are ACTIVE + published
// and the ids belong together (project → service → subject).
const LIVE = { status: 'ACTIVE', published: true };
export async function isLiveSelection({ subjectId, serviceId, projectId }) {
    const isId = (v) => mongoose.isValidObjectId(v);
    if (!isId(subjectId) || (serviceId && !isId(serviceId)) || (projectId && !isId(projectId))) return false;
    const project = projectId ? await CatalogProject.findOne({ ...LIVE, _id: projectId, subjectId }).select('serviceId').lean() : null;
    if (projectId && (!project || (serviceId && String(project.serviceId) !== String(serviceId)))) return false;
    const service = serviceId || project?.serviceId;
    const [subjectOk, serviceOk] = await Promise.all([
        CatalogSubject.exists({ ...LIVE, _id: subjectId }),
        service ? CatalogService.exists({ ...LIVE, _id: service, subjectId }) : true,
    ]);
    return Boolean(subjectOk && serviceOk);
}

// Every currency's active rule for a selection: what the public site shows.
export async function activePricing({ subjectId, serviceId, projectId }) {
    const at = new Date();
    const [config, currencies] = await Promise.all([
        getWordConfig(),
        PricingRule.distinct('currency', { subjectId: oid(subjectId), status: 'ACTIVE', effectiveDate: { $lte: at } }),
    ]);
    const rules = (await Promise.all(currencies.sort().map(currency => resolveRule({ subjectId, serviceId, projectId, currency, at })))).filter(Boolean);
    return {
        rounding: config.rounding, minPages: config.minPages, maxPages: config.maxPages,
        spacingOptions: config.spacingOptions, defaultSpacing: config.defaultSpacing,
        rates: rules.map(r => ({
            currency: r.currency,
            currencyDigits: currencyDigits(r.currency),
            wordsPerPage: r.wordsPerPage || config.defaultWordsPerPage,
            basePriceMinor: r.basePriceMinor,
            multiplier: r.multiplier,
            unitPriceMinor: unitPriceFor(r),
            formula: r.formula,
            formulaLabel: (FORMULAS[r.formula] || FORMULAS.BASE_X_MULTIPLIER).label,
            effectiveDate: r.effectiveDate,
        })),
    };
}

// ── Quote ──────────────────────────────────────────────────────────────────────

/**
 * Prices an order: words (or pages) → billable pages → rule → total.
 * @returns {{ pages, words, wordsPerPage, spacing, unitPriceMinor, totalMinor, currency, formula, ruleId }}
 */
export async function quote({ subjectId, serviceId, projectId, words, pages, spacing, currency, at }) {
    const [config, rule] = await Promise.all([getWordConfig(), resolveRule({ subjectId, serviceId, projectId, currency, at })]);
    if (!rule) throw new PricingError('No active price is set for this selection yet.', 404);

    const wordsPerPage = rule.wordsPerPage || config.defaultWordsPerPage;
    const spacingOpt = config.spacingOptions.find(s => s.key === (spacing || config.defaultSpacing)) || config.spacingOptions[0] || { key: 'DOUBLE', factor: 1 };
    let rawPages;
    if (Number.isFinite(Number(pages)) && Number(pages) > 0) rawPages = Number(pages);
    else if (Number.isFinite(Number(words)) && Number(words) > 0) rawPages = Number(words) / wordsPerPage;
    else throw new PricingError('Enter the number of words or pages.');

    const round = { CEIL: Math.ceil, ROUND: Math.round, EXACT: (x) => Math.round(x * 100) / 100 }[config.rounding] || Math.ceil;
    let billablePages = round(rawPages) * (spacingOpt.factor || 1);
    billablePages = Math.min(Math.max(billablePages, config.minPages || 0), config.maxPages || Infinity);

    const unitPriceMinor = unitPriceFor(rule);
    const totalMinor = Math.round(unitPriceMinor * billablePages);
    return {
        pages: billablePages,
        words: Number(words) || Math.round(billablePages * wordsPerPage / (spacingOpt.factor || 1)),
        wordsPerPage,
        spacing: spacingOpt.key,
        unitPriceMinor,
        totalMinor,
        currency: rule.currency,
        currencyDigits: currencyDigits(rule.currency),
        formula: rule.formula,
        ruleId: rule._id,
    };
}

// Validates that a rule's scope is consistent: a project must belong to the
// service and subject, a service to the subject. Returns normalised ids.
export async function normaliseRuleScope({ subjectId, serviceId, projectId }) {
    let service = serviceId || null;
    if (projectId) {
        const project = await CatalogProject.findById(projectId).select('subjectId serviceId').lean();
        if (!project) throw new PricingError('That project no longer exists.');
        if (String(project.subjectId) !== String(subjectId)) throw new PricingError('The project does not belong to the chosen subject.');
        if (service && String(project.serviceId) !== String(service)) throw new PricingError('The project does not belong to the chosen service.');
        service = project.serviceId;
    }
    if (service) {
        const svc = await CatalogService.findById(service).select('subjectId').lean();
        if (!svc) throw new PricingError('That service no longer exists.');
        if (String(svc.subjectId) !== String(subjectId)) throw new PricingError('The service does not belong to the chosen subject.');
    }
    return { subjectId, serviceId: service || null, projectId: projectId || null };
}
