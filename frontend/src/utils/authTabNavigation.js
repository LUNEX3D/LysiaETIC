/** Auth landing (login/register) üst menü sekmeleri */
export const AUTH_MARKETING_TABS = new Set(["features", "pricing", "about", "contact"]);

export const isAuthMarketingTab = (tab) => AUTH_MARKETING_TABS.has(tab);

/**
 * Register veya login dışı sayfalardan pazarlama sekmelerine geçiş
 * @param {string} tab
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {{ onHome?: () => void }} options
 */
export function navigateAuthTab(tab, navigate, { onHome } = {}) {
    if (tab === "home") {
        onHome?.();
        return;
    }
    if (tab === "blog") {
        navigate("/blog");
        return;
    }
    if (AUTH_MARKETING_TABS.has(tab)) {
        navigate(`/login?tab=${tab}`);
        return;
    }
    navigate("/login");
}

export function resolveLoginTabFromSearch(searchParams) {
    const tab = String(searchParams.get("tab") || "").trim();
    if (tab === "blog") return null;
    if (tab === "home" || AUTH_MARKETING_TABS.has(tab)) return tab;
    return null;
}
