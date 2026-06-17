import { getLiveSiteUrls } from "../../../utils/wbStorefrontHost";

import { computeSiteSetupProgress } from "../setup/siteSetupProgress";



export { computeSiteSetupProgress };



export function formatOverviewNumber(n) {

    if (n == null || Number.isNaN(Number(n))) return "—";

    return new Intl.NumberFormat("tr-TR").format(Number(n));

}



export function formatOverviewDate(d) {

    if (!d) return "—";

    try {

        return new Date(d).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

    } catch {

        return "—";

    }

}



export function resolveThemeName(site, themeInstall, themesCatalog = []) {

    if (themeInstall?.themeId?.name) return themeInstall.themeId.name;

    if (themeInstall?.themeId?.slug) return themeInstall.themeId.slug;

    const slug = site?.themeId;

    if (!slug) return "Seçilmedi";

    const fromCatalog = themesCatalog.find((t) => t.slug === slug);

    return fromCatalog?.name || slug;

}



/** @deprecated Use computeSiteSetupProgress — geriye uyumluluk */

export function computeSetupProgress(site, pages = [], themeInstall, domainRecord = null) {

    return computeSiteSetupProgress({ site, pages, themeInstall, domainRecord });

}



export function getSitePublishLabel(status) {

    const map = {

        draft: "Taslak",

        published: "Yayında",

        suspended: "Askıda",

        archived: "Arşiv",

    };

    return map[status] || status || "—";

}



export function buildTrafficTrend(summary7d, summary30d) {

    return [

        { label: "7 gün", visitors: summary7d?.summary?.visitors?.value ?? 0, pageViews: summary7d?.summary?.pageViews?.value ?? 0 },

        { label: "30 gün", visitors: summary30d?.summary?.visitors?.value ?? 0, pageViews: summary30d?.summary?.pageViews?.value ?? 0 },

    ];

}



export function getOverviewOpenUrl(site) {

    const live = getLiveSiteUrls(site);

    return live.canOpen ? (live.path || live.primary) : null;

}


