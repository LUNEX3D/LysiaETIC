/**
 * Pazaryeri yüklemelerinde marka: ürün kartındaki tüm olası alanlardan tek metin üretir.
 * (brand / marka / attributes / özellik dizisi / HB öznitelik objeleri)
 */

const IGNORE = new Set(
    [
        "belirtilmedi",
        "bilinmeyen",
        "yok",
        "-",
        "n/a",
        "na",
        "markasız",
        "markasiz",
        "tanımsız",
        "tanimsiz",
        // Trendyol / pazaryeri "genel marka" etiketleri — gerçek marka adı değil
        "diğer",
        "diger",
        "other",
        "genel",
        "diğer marka",
        "diger marka"
    ].map((s) => s.toLowerCase())
);

const isPlaceholderBrand = (s) => {
    const t = String(s ?? "").trim();
    if (!t) return true;
    if (IGNORE.has(t.toLowerCase())) return true;
    return false;
};

/**
 * @param {object} productData
 * @returns {string} İlk geçerli marka metni veya ""
 */
const readCustomAttributesBrand = (ca, add) => {
    if (!ca) return;
    if (ca instanceof Map) {
        for (const key of ["marka", "Marka", "brand", "brandName", "hbMarka", "hb_brand"]) {
            add(ca.get(key));
        }
    } else if (typeof ca === "object" && !Array.isArray(ca)) {
        add(ca.marka);
        add(ca.Marka);
        add(ca.brand);
        add(ca.brandName);
        add(ca.hbMarka);
    }
};

const resolveProductBrandName = (productData) => {
    if (!productData || typeof productData !== "object") return "";
    const out = [];
    const add = (v) => {
        if (isPlaceholderBrand(v)) return;
        const s = String(v).trim();
        if (!s) return;
        if (!out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    };

    add(productData.brand);
    add(productData.marka);
    add(productData.brandName);

    // ProductMapping: bazen iç içe masterProduct (veya sadece bu alt alan dolu)
    const mp = productData.masterProduct;
    if (mp && typeof mp === "object") {
        add(mp.brand);
        add(mp.marka);
        add(mp.brandName);
        const ma = mp.attributes;
        if (ma && typeof ma === "object" && !Array.isArray(ma)) {
            add(ma.brand);
            add(ma.marka);
            add(ma.Marka);
        }
    }

    const a = productData.attributes;
    if (a && typeof a === "object" && !Array.isArray(a)) {
        add(a.brand);
        add(a.marka);
        add(a.Marka);
        add(a.Brand);
        const tyRows = a.trendyolAttributeRows;
        if (Array.isArray(tyRows)) {
            for (const row of tyRows) {
                const n = String(row?.attributeName || row?.name || "").toLowerCase();
                if (
                    /^marka$|^brand$/i.test(n) ||
                    (n.includes("marka") && !n.includes("model") && !n.includes("numara"))
                ) {
                    add(row?.attributeValue ?? row?.value);
                }
            }
        }
    }

    for (const key of ["hepsiburadaCatalogAttributes", "hbCatalogAttributes", "hbAttributes"]) {
        const o = productData[key];
        if (o && typeof o === "object" && !Array.isArray(o)) {
            add(o.Marka);
            add(o.marka);
            add(o.brand);
        }
    }

    if (Array.isArray(a)) {
        for (const row of a) {
            const n = String(row?.name || row?.attributeName || row?.label || "").toLowerCase();
            if (/^marka$|^brand$|marka\b|üretici|uretici|manufacturer/i.test(n)) {
                add(row?.value ?? row?.attributeValue ?? row?.customAttributeValue ?? row?.text);
            }
        }
    }

    const maps = productData.marketplaceMappings;
    if (Array.isArray(maps)) {
        for (const m of maps) {
            if (!m) continue;
            readCustomAttributesBrand(m.customAttributes, add);
        }
    }

    return out[0] || "";
};

module.exports = { resolveProductBrandName, isPlaceholderBrand };
