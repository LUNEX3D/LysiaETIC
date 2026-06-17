/**
 * Website Builder kurulum adımları — Onboarding Wizard, WBLayout, Site Overview tek kaynak.
 */

import * as wbApi from "../../../services/websiteBuilderApi";

export const SETUP_STEP_META = [
    { id: "site_info", label: "Site bilgileri", href: "onboarding" },
    { id: "theme", label: "Tema seçimi", href: "themes" },
    { id: "products", label: "Ürün senkronizasyonu", href: "settings" },
    { id: "homepage", label: "Ana sayfa yayınlandı", href: "editor" },
    { id: "domain", label: "Domain bağlı", href: "domain" },
    { id: "publish", label: "Site yayında", href: "onboarding" },
];

export const ONBOARDING_STEP_LABELS = [
    "Site bilgileri",
    "Tema seçimi",
    "Ürün senkronizasyonu",
    "Ana sayfa oluşturma",
    "Domain bağlama",
    "Yayınlama",
];

function hasThemeSelected(site, themeInstall) {
    return Boolean(
        (themeInstall && themeInstall.status === "active")
        || themeInstall?.themeVersionId
        || themeInstall?._id
    );
}

function hasProductSync(site) {
    if (!site) return false;
    return site.syncProductsFromLysia !== false;
}

function hasHomepagePublished(pages) {
    return (pages || []).some((p) => p.isHomePage && p.status === "published");
}

function hasHomepageWithContent(pages) {
    const home = (pages || []).find((p) => p.isHomePage);
    return Boolean(home && (home.sections || []).length > 0);
}

function hasDomainLinked(site, domainRecord) {
    if (site?.customDomain) return true;
    if (domainRecord?.domain) return true;
    return false;
}

function isSitePublished(site) {
    return site?.status === "published";
}

/**
 * @param {object} params
 * @param {object} params.site
 * @param {object[]} params.pages
 * @param {object|null} params.themeInstall
 * @param {object|null} params.domainRecord — getDomain().domain
 */
export function computeSiteSetupProgress({ site, pages = [], themeInstall, domainRecord }) {
    const checks = {
        site_info: Boolean(site?.name && site?.slug),
        theme: hasThemeSelected(site, themeInstall),
        products: hasProductSync(site),
        homepage: hasHomepagePublished(pages),
        domain: hasDomainLinked(site, domainRecord),
        publish: isSitePublished(site),
    };

    const steps = SETUP_STEP_META.map((meta) => ({
        ...meta,
        done: Boolean(checks[meta.id]),
    }));

    const completed = steps.filter((s) => s.done).length;
    const percent = Math.round((completed / steps.length) * 100);

    return {
        steps,
        checks,
        completed,
        total: steps.length,
        percent,
        homePage: (pages || []).find((p) => p.isHomePage) || null,
        hasHomepageContent: hasHomepageWithContent(pages),
    };
}

/** Onboarding wizard için ilk tamamlanmamış adım indeksi (0–5) */
export function getFirstIncompleteOnboardingStep(progress) {
    const order = SETUP_STEP_META.map((s) => s.id);
    for (let i = 0; i < order.length; i++) {
        if (!progress.checks[order[i]]) return i;
    }
    return order.length - 1;
}

/** Sihirbaz hedefi: site yayında (domain opsiyonel) */
export function isOnboardingComplete(progress) {
    return Boolean(progress?.checks?.publish);
}

/** Site Özeti uyarı bandı — yayınlanana kadar göster */
export function shouldShowSetupReminder(progress) {
    return !isOnboardingComplete(progress);
}

/** Zorunlu adımlar (domain hariç) yüzdesi */
export function computeEssentialPercent(progress) {
    const essential = ["site_info", "theme", "products", "homepage", "publish"];
    const done = essential.filter((id) => progress.checks[id]).length;
    return Math.round((done / essential.length) * 100);
}

const OPTIONAL_STEP_IDS = ["domain"];

/** Tamamlanmamış adımlar (varsayılan: domain hariç — banner sayısı için) */
export function getIncompleteSteps(progress, { includeOptional = false } = {}) {
    if (!progress?.steps) return [];
    return progress.steps.filter((s) => {
        if (s.done) return false;
        if (!includeOptional && OPTIONAL_STEP_IDS.includes(s.id)) return false;
        return true;
    });
}

export function getIncompleteStepCount(progress, options) {
    return getIncompleteSteps(progress, options).length;
}

/** Mevcut API'lerle kurulum verisini yükle */
export async function loadSiteSetupBundle(siteId) {
    const [siteRes, pagesRes, themeRes, domainRes] = await Promise.all([
        wbApi.getSite(siteId),
        wbApi.getPages(siteId),
        wbApi.getThemeInstall(siteId).catch(() => ({ install: null })),
        wbApi.getDomain(siteId).catch(() => ({ domain: null })),
    ]);

    const site = siteRes.site;
    const pages = pagesRes.pages || [];
    const themeInstall = themeRes.install || null;
    const domainRecord = domainRes.domain || null;
    const progress = computeSiteSetupProgress({ site, pages, themeInstall, domainRecord });

    return { site, pages, themeInstall, domainRecord, progress };
}

export function isOverviewIndexPath(pathname, siteId) {
    if (!siteId) return false;
    const base = `/website-builder/${siteId}`;
    return pathname === base || pathname === `${base}/`;
}

export function isOnboardingPath(pathname) {
    return pathname.includes("/onboarding");
}
