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

    // 1) Ürün kartı / master — tek güvenilir kaynak (dağıtımda TY kategori listesindeki LC Waikiki vb. ezmesin)
    add(productData.brand);
    add(productData.marka);
    add(productData.brandName);

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

    if (out.length > 0) return out[0];

    // 2) Yalnızca master boşsa: HB öznitelik blob'u (pazaryeri enum id değil, metin alanları)
    for (const key of ["hepsiburadaCatalogAttributes", "hbCatalogAttributes", "hbAttributes"]) {
        const o = productData[key];
        if (o && typeof o === "object" && !Array.isArray(o)) {
            add(o.Marka);
            add(o.marka);
            add(o.brand);
        }
    }

    const a = productData.attributes;
    if (a && typeof a === "object" && !Array.isArray(a)) {
        add(a.brand);
        add(a.marka);
        add(a.Marka);
        add(a.Brand);
    }

    if (Array.isArray(a)) {
        for (const row of a) {
            const n = String(row?.name || row?.attributeName || row?.label || "").toLowerCase();
            if (/^marka$|^brand$|marka\b|üretici|uretici|manufacturer/i.test(n)) {
                add(row?.value ?? row?.attributeValue ?? row?.customAttributeValue ?? row?.text);
            }
        }
    }

    // Trendyol trendyolAttributeRows / mapping customAttributes marka satırı KULLANILMAZ —
    // kategori enum'undaki ilk marka (ör. LC Waikiki) yanlışlıkla ürün markası sanılıyordu.

    return out[0] || "";
};

module.exports = { resolveProductBrandName, isPlaceholderBrand };
