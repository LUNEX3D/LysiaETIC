/**
 * Kategori Merkezi → dağıtım için platform kategori çözümlemesi
 * (resolve-for-distribute ile aynı mantık)
 */
const MasterCategoryMapping = require("../models/MasterCategoryMapping");
const { normalizeMarketplaceName } = require("./productSyncService");

const decodeHtmlEntities = (str) => {
    if (!str || typeof str !== "string") return str;
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
};

const normalizePlatformName = (name) =>
    String(name || "")
        .toLowerCase()
        .replace(/[\s\u00e7\u00f6\u00fc\u011f\u0131\u015f]/g, (m) => {
            const map = { ç: "c", ö: "o", ü: "u", ğ: "g", ı: "i", ş: "s", " ": "" };
            return map[m] || "";
        });

const mapTargetPlatformToMappingFields = (platformName) => {
    const n = normalizePlatformName(platformName || "");
    if (n.includes("trendyol")) return { idKey: "trendyolId", pathKey: "trendyolPath", label: "Trendyol" };
    if (n === "n11") return { idKey: "n11Id", pathKey: "n11Path", label: "N11" };
    if (n.includes("cicek")) return { idKey: "ciceksepetiId", pathKey: "ciceksepetiPath", label: "ÇiçekSepeti" };
    if (n.includes("hepsiburada")) return { idKey: "hepsiburadaId", pathKey: "hepsiburadaPath", label: "Hepsiburada" };
    if (n.includes("amazon")) return { idKey: "amazonId", pathKey: "amazonPath", label: "Amazon" };
    return null;
};

const buildMappingSearchRegex = (q) => {
    const turkishVariant = q
        .replace(/ç/gi, "[çc]")
        .replace(/ğ/gi, "[ğg]")
        .replace(/ı/gi, "[ıi]")
        .replace(/ö/gi, "[öo]")
        .replace(/ş/gi, "[şs]")
        .replace(/ü/gi, "[üu]")
        .replace(/i/gi, "[iİı]")
        .replace(/c/gi, "[cç]")
        .replace(/g/gi, "[gğ]")
        .replace(/o/gi, "[oö]")
        .replace(/s/gi, "[sş]")
        .replace(/u/gi, "[uü]");
    const escaped = turkishVariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "i");
};

/**
 * @param {object} product — ProductMapping lean veya doc
 * @param {string} targetPlatform
 * @returns {Promise<{ resolved: boolean, matchedBy?: string, platformCategory?: object, message?: string, hint?: string }>}
 */
const resolveCategoryForDistribute = async (product, targetPlatform) => {
    const targetSpec = mapTargetPlatformToMappingFields(targetPlatform);
    if (!targetSpec) {
        return { resolved: false, message: "Desteklenmeyen hedef platform" };
    }

    let row = null;
    let matchedBy = null;

    const tyMap = (product.marketplaceMappings || []).find((m) => {
        const n = normalizePlatformName(m.marketplaceName || "");
        return n.includes("trendyol");
    });
    if (tyMap?.categoryId != null && String(tyMap.categoryId).trim() !== "") {
        const tid = parseInt(String(tyMap.categoryId).replace(/[^\d]/g, ""), 10);
        if (!Number.isNaN(tid)) {
            row = await MasterCategoryMapping.findOne({ trendyolId: tid }).lean();
            if (row) matchedBy = "trendyol_listing_category";
        }
    }

    const catHint =
        product.masterProduct?.category != null ? String(product.masterProduct.category).trim() : "";

    if (!row && catHint.length >= 2) {
        const parts = catHint.split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean);
        const leafHint = parts.length ? parts[parts.length - 1] : catHint;
        const q = leafHint.length >= 2 ? leafHint : catHint;
        const regex = buildMappingSearchRegex(q);
        row = await MasterCategoryMapping.findOne({
            $or: [{ masterPath: regex }, { masterName: regex }, { trendyolPath: regex }],
        })
            .sort({ masterPath: 1 })
            .lean();
        if (row) matchedBy = "master_product_category_text";
    }

    if (!row) {
        return {
            resolved: false,
            matchedBy: null,
            hint: catHint || null,
            message: "Kategori merkezinde eşleşme bulunamadı",
        };
    }

    const idVal = row[targetSpec.idKey];
    const pathVal = row[targetSpec.pathKey] || "";
    if (idVal == null || String(idVal).trim() === "") {
        return {
            resolved: false,
            matchedBy,
            hint: catHint || null,
            message: `${targetSpec.label} için kategori merkezinde ID tanımlı değil`,
        };
    }

    const platformCategory = {
        platform: targetSpec.label,
        categoryId: String(idVal).trim(),
        categoryPath: decodeHtmlEntities(String(pathVal || "")),
        isComplete: true,
    };

    return {
        resolved: true,
        matchedBy,
        platformCategory,
        master: {
            masterId: row.masterId,
            masterName: decodeHtmlEntities(row.masterName),
            masterPath: decodeHtmlEntities(row.masterPath),
        },
    };
};

/** Pazaryerinde gerçekten listelenmiş sayılır mı */
const isMarketplaceMappingListed = (mapping, marketplaceName) => {
    if (!mapping) return false;
    const norm = normalizeMarketplaceName(marketplaceName || mapping.marketplaceName);
    if (norm.includes("hepsi")) {
        try {
            const { isHepsiburadaMappingListedForUi } = require("./hepsiburadaService");
            return isHepsiburadaMappingListedForUi({
                marketplaceName: mapping.marketplaceName,
                ...mapping,
                syncStatus: mapping.syncStatus,
                isSynced: mapping.isSynced,
            });
        } catch {
            /* fallback */
        }
    }
    if (mapping.syncStatus === "error") return false;
    if (mapping.syncStatus === "synced" && mapping.marketplaceProductId) return true;
    if (mapping.syncStatus === "pending" && mapping.marketplaceProductId) return true;
    return false;
};

const getMissingPlatformsForProduct = (product, targets) => {
    const missing = [];
    for (const target of targets) {
        const wanted = normalizeMarketplaceName(target);
        const existing = (product.marketplaceMappings || []).find(
            (m) => normalizeMarketplaceName(m.marketplaceName) === wanted
        );
        if (!existing || !isMarketplaceMappingListed(existing, target)) {
            missing.push(target);
        }
    }
    return missing;
};

module.exports = {
    resolveCategoryForDistribute,
    getMissingPlatformsForProduct,
    isMarketplaceMappingListed,
    mapTargetPlatformToMappingFields,
};
