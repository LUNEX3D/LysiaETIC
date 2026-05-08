/**
 * Çapraz listeleme: Ana pazaryeri Trendyol — TY eşlemesindeki zengin veriyi
 * HB / N11 / ÇiçekSepeti yükleme payload'ına taşır (özellikle trendyolAttributes satırları).
 */

const logger = require("../config/logger");

const CANONICAL_SOURCE = "Trendyol";

const normMp = (name) => {
    if (!name) return "";
    const n = String(name).trim().toLowerCase();
    if (n === "trendyol") return "Trendyol";
    if (n === "hepsiburada") return "Hepsiburada";
    if (n === "n11") return "N11";
    if (n === "amazon") return "Amazon";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    return String(name).trim();
};

/** @param {unknown} m */
const customAttributesToPlain = (m) => {
    if (!m) return {};
    if (m instanceof Map) {
        const o = {};
        for (const [k, v] of m.entries()) o[k] = v;
        return o;
    }
    if (typeof m === "object" && !Array.isArray(m)) return { ...m };
    return {};
};

/**
 * En iyi Trendyol mapping: hata dışı; önce synced, sonra pending, sonra diğer.
 * @param {Array<Record<string, unknown>>} mappings
 */
const pickTrendyolMapping = (mappings) => {
    if (!Array.isArray(mappings)) return null;
    const candidates = mappings.filter((m) => m && normMp(m.marketplaceName) === "Trendyol" && m.syncStatus !== "error");
    if (candidates.length === 0) return null;
    const rank = (s) => {
        const x = String(s || "").toLowerCase();
        if (x === "synced") return 0;
        if (x === "pending") return 1;
        if (x === "syncing") return 2;
        return 3;
    };
    candidates.sort((a, b) => rank(a.syncStatus) - rank(b.syncStatus));
    return candidates[0];
};

/**
 * @param {Record<string, unknown>} product — master alanları + marketplaceMappings
 * @param {{ targetMarketplace?: string }} [opts]
 * @returns {Record<string, unknown>}
 */
const prepareCrossListingProduct = (product, opts = {}) => {
    if (!product || typeof product !== "object") return product;
    const target = normMp(opts.targetMarketplace || "");
    const attrs =
        product.attributes && typeof product.attributes === "object" && !Array.isArray(product.attributes)
            ? { ...product.attributes }
            : {};
    const mappings = Array.isArray(product.marketplaceMappings)
        ? product.marketplaceMappings.map((m) => {
              if (!m || typeof m !== "object") return m;
              const plain = { ...m };
              if (plain.customAttributes != null) {
                  plain.customAttributes = customAttributesToPlain(plain.customAttributes);
              }
              return plain;
          })
        : [];

    let out = {
        ...product,
        attributes: attrs,
        marketplaceMappings: mappings
    };

    const tyMap = pickTrendyolMapping(mappings);
    if (!tyMap) {
        if (target && target !== "Trendyol") {
            logger.debug(
                `[CROSS-LIST] ${target}: Trendyol eşlemesi yok — yalnızca master verisi kullanılıyor (barkod=${out.barcode || out.sku || "-"})`
            );
        }
        return out;
    }

    const ca = customAttributesToPlain(tyMap.customAttributes);
    const tyAttrs = ca.trendyolAttributes;
    if (Array.isArray(tyAttrs) && tyAttrs.length > 0) {
        const rows = out.attributes.trendyolAttributeRows;
        const missingRows = !Array.isArray(rows) || rows.length === 0;
        if (missingRows) {
            out = {
                ...out,
                attributes: {
                    ...out.attributes,
                    trendyolAttributeRows: tyAttrs
                }
            };
            logger.info(
                `[CROSS-LIST] Trendyol kanonik: trendyolAttributes (${tyAttrs.length} satır) → attributes.trendyolAttributeRows ` +
                    `(hedef=${target || "—"} sku=${out.sku || out.barcode || "-"})`
            );
        }
    }

    if (ca.brandId != null && `${ca.brandId}`.trim() !== "" && (out.attributes.brandId == null || out.attributes.brandId === "")) {
        const bid = Number(ca.brandId);
        if (Number.isFinite(bid)) {
            out = {
                ...out,
                attributes: {
                    ...out.attributes,
                    brandId: bid
                }
            };
        }
    }

    // Fiyat / stok: master sıfırsa TY satırından doldur (kullanıcı master'ı güncellediyse ezme)
    const p = Number(out.price);
    const tyPrice = Number(tyMap.price);
    if ((!Number.isFinite(p) || p <= 0) && Number.isFinite(tyPrice) && tyPrice > 0) {
        out = { ...out, price: tyPrice };
    }
    const lp = Number(out.listPrice);
    const tyLp = Number(tyMap.listPrice);
    if ((!Number.isFinite(lp) || lp <= 0) && Number.isFinite(tyLp) && tyLp > 0) {
        out = { ...out, listPrice: tyLp };
    }
    const st = Number(out.stock);
    const tySt = Number(tyMap.stock);
    if ((!Number.isFinite(st) || st < 0) && Number.isFinite(tySt) && tySt >= 0) {
        out = { ...out, stock: tySt };
    }

    if (target && target !== "Trendyol") {
        out._crossListingCanonicalSource = CANONICAL_SOURCE;
    }

    return out;
};

module.exports = {
    prepareCrossListingProduct,
    pickTrendyolMapping,
    CANONICAL_SOURCE_MARKETPLACE: CANONICAL_SOURCE
};
