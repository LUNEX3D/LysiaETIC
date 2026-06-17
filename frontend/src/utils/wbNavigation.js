/**
 * Website Builder — ERP'den ayrı çalışma alanı navigasyonu.
 * Son ziyaret edilen site localStorage ile hızlı kısayollar.
 */

const LS_SITE_ID = "wb_last_site_id";
const LS_PUBLIC_URL = "wb_last_public_url";

export function getWbAbsoluteUrl(path = "/website-builder") {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${window.location.origin}${normalized}`;
}

export function openWebsiteBuilder(path = "/website-builder") {
    const url = getWbAbsoluteUrl(path);
    window.open(url, "_blank", "noopener,noreferrer");
}

export function rememberWbSite(site) {
    if (!site?._id) return;
    try {
        localStorage.setItem(LS_SITE_ID, site._id);
        if (site.publicUrl) {
            localStorage.setItem(LS_PUBLIC_URL, site.publicUrl);
        }
    } catch {
        /* ignore */
    }
}

export function rememberWbSiteContext(siteId, publicUrl) {
    if (!siteId) return;
    try {
        localStorage.setItem(LS_SITE_ID, siteId);
        if (publicUrl) localStorage.setItem(LS_PUBLIC_URL, publicUrl);
    } catch {
        /* ignore */
    }
}

export function getLastWbSiteId() {
    try {
        return localStorage.getItem(LS_SITE_ID) || null;
    } catch {
        return null;
    }
}

export function getLastWbPublicUrl() {
    try {
        return localStorage.getItem(LS_PUBLIC_URL) || null;
    } catch {
        return null;
    }
}

/** ERP sidebar hover kısayolları */
/** Kurulum sihirbazından site özetine — otomatik onboarding yönlendirmesini atla */
export function goToSiteOverview(navigate, siteId) {
    if (!siteId) {
        navigate("/website-builder");
        return;
    }
    try {
        sessionStorage.setItem(`wb_allow_overview_${siteId}`, "1");
    } catch {
        /* ignore */
    }
    navigate(`/website-builder/${siteId}`);
}

export function shouldSkipOnboardingRedirect(siteId) {
    if (!siteId) return false;
    try {
        const key = `wb_allow_overview_${siteId}`;
        if (sessionStorage.getItem(key) === "1") {
            sessionStorage.removeItem(key);
            return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

export function getWbSidebarQuickActions() {
    const siteId = getLastWbSiteId();
    const publicUrl = getLastWbPublicUrl();
    const base = siteId ? `/website-builder/${siteId}` : null;

    return [
        {
            id: "open-storefront",
            label: "Siteyi Aç",
            disabled: !publicUrl,
            external: true,
            href: publicUrl || undefined,
            title: publicUrl ? "Canlı siteyi yeni sekmede aç" : "Önce bir site yayınlayın veya WB'de site açın",
        },
        {
            id: "open-wb",
            label: "Website Builder",
            path: base || "/website-builder",
            title: "Website Builder çalışma alanı",
        },
        {
            id: "theme",
            label: "Tema",
            path: base ? `${base}/themes/customize` : "/website-builder",
            disabled: !siteId,
            title: siteId ? "Tema özelleştirici" : "Son site bulunamadı — önce WB'yi açın",
        },
        {
            id: "analytics",
            label: "Analytics",
            path: base ? `${base}/analytics` : "/website-builder",
            disabled: !siteId,
            title: siteId ? "Site analitiği" : "Son site bulunamadı",
        },
    ];
}
