/** Pazaryeri adını tek tip anahtara çevirir (UI ↔ API eşleşmesi) */
export const marketplaceKey = (name) => {
    if (!name) return "";
    return String(name)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ı/g, "i");
};

export const normalizeMarketplaceDisplayName = (name) => {
    const k = marketplaceKey(name);
    if (k === "n11") return "N11";
    if (k === "trendyol") return "Trendyol";
    if (k === "hepsiburada") return "Hepsiburada";
    if (k === "ciceksepeti") return "ÇiçekSepeti";
    if (k === "amazon") return "Amazon";
    return String(name || "").trim();
};

export const isSameMarketplace = (a, b) => marketplaceKey(a) === marketplaceKey(b);

export const findMarketplaceIntegration = (integrations, platformName) =>
    (integrations || []).find((i) => isSameMarketplace(i.marketplaceName, platformName));

export const isMarketplaceConnected = (integrations, platformName) =>
    !!findMarketplaceIntegration(integrations, platformName);
