const KEY = "lysia_wb_theme_favorites";

export function getThemeFavorites() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function toggleThemeFavorite(slug) {
    const list = getThemeFavorites();
    const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        /* ignore */
    }
    return next;
}

export function isThemeFavorite(slug) {
    return getThemeFavorites().includes(slug);
}
