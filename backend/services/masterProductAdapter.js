/**
 * MASTER PRODUCT ADAPTER
 *
 * 3 Katmanlı Mimari:
 *   Katman 1 — fromTrendyol()   : Trendyol ham verisini → Master Product'a çevirir
 *   Katman 2 — autoFix()        : Master Product'u doğrular ve eksikleri tamamlar
 *   Katman 3 — toN11()          : Master Product'u → N11 payload'ına çevirir (n11MappingService ile)
 *
 * Kullanım:
 *   const master  = fromTrendyol(rawTrendyolProduct)
 *   const fixed   = autoFix(master)
 *   const payload = await toN11(fixed, userId, credentials)
 */

const logger = require("../config/logger");
const n11Service = require("./n11Service");
const { resolveProductBrandName, isPlaceholderBrand } = require("../utils/resolveProductBrandName");

/** Pazaryeri / HB katalog ile uyumlu üst sınır (ay) — şema ve ham API sapmalarını keser */
const MASTER_GARANTI_MAX_MONTHS = 120;

/**
 * @param {unknown} n
 * @returns {number|null} 0..120 veya bilinmiyorsa null
 */
const clampMasterGarantiSuresi = (n) => {
    if (n == null || n === "") return null;
    const x = Math.round(Number(n));
    if (!Number.isFinite(x) || x < 0) return null;
    return Math.min(MASTER_GARANTI_MAX_MONTHS, x);
};

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Fiyat normalize
// ─────────────────────────────────────────────────────────────────────────────
const parsePrice = (val) => {
    if (!val && val !== 0) return 0;
    const str = val.toString().trim();
    // "1.999,99" → Türkçe format
    if (str.includes(".") && str.includes(",")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (str.includes(",")) {
        return parseFloat(str.replace(",", ".")) || 0;
    }
    return parseFloat(str) || 0;
};

const pickDefaultCustomValue = (attributeName, master) => {
    const name = (attributeName || "").toLowerCase();
    const a = master?.attributes || {};
    if (name.includes("cinsiyet")) {
        return a.gender || "Unisex";
    }
    if (name.includes("web") && (name.includes("color") || name.includes("renk") || name.includes("colour"))) {
        return a.webColor || a.color || "Diğer";
    }
    if (name.includes("renk") || name.includes("colour") || (name.includes("color") && !name.includes("web"))) {
        return a.color || a.webColor || "Diğer";
    }
    if (name.includes("materyal") || name.includes("malzeme")) {
        return a.material || "Plastik";
    }
    if (name.includes("tema") || name.includes("stil") || name.includes("theme")) {
        return a.themeStyle || "Standart";
    }
    if (name.includes("parça") || name.includes("parca") || name.includes("piece")) {
        return a.pieceCount || "1";
    }
    if (name.includes("menşei") || name.includes("mensei")) {
        return a.origin || a.mensei || "TR";
    }
    if (name.includes("üretici") || name.includes("uretici") || name.includes("manufacturer")) {
        return a.manufacturer || master?.brand || "Standart";
    }
    if (name.includes("boyut") || name.includes("ebat")) {
        return a.boyutEbat || a.size || "Tek Ebat";
    }
    if (name.includes("model")) {
        return a.model || "Standart";
    }
    return "Standart";
};

const buildN11Attributes = (master, categoryAttributes = []) => {
    const BRAND_ATTRIBUTE_ID = 1;
    const attrs = [];
    const brand = (resolveProductBrandName(master) || master.brand || "Genel").toString().trim();

    // Marka attribute'u her zaman gönder.
    attrs.push({
        id: BRAND_ATTRIBUTE_ID,
        valueId: null,
        customValue: brand
    });

    for (const attr of categoryAttributes) {
        const attrId = Number(attr.attributeId || attr.id);
        if (!attrId || attrId === BRAND_ATTRIBUTE_ID) continue;
        if (!attr.isMandatory) continue;

        const values = Array.isArray(attr.attributeValues) ? attr.attributeValues : [];
        const name = attr.attributeName || attr.name || "";
        const isCustom = Boolean(attr.isCustomValue);

        if (isCustom) {
            attrs.push({
                id: attrId,
                valueId: null,
                customValue: pickDefaultCustomValue(name, master)
            });
            continue;
        }

        const firstVal = values.find((v) => Number(v.id || v.valueId) > 0);
        if (firstVal) {
            attrs.push({
                id: attrId,
                valueId: Number(firstVal.id || firstVal.valueId),
                customValue: "null"
            });
        }
    }

    return attrs;
};

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 1 — fromTrendyol()
// Trendyol ham ürün verisini → Master Product formatına çevirir
// ─────────────────────────────────────────────────────────────────────────────

/** @param {unknown} a */
const trendyolRowName = (a) =>
    String(a?.attributeName ?? a?.name ?? "")
        .replace(/\s+/g, " ")
        .trim();

/** @param {unknown} a */
const trendyolRowValue = (a) => {
    let v = a?.attributeValue ?? a?.value ?? a?.customAttributeValue;
    if (v && typeof v === "object") {
        v = v.name ?? v.value ?? v.text ?? v.attributeValue ?? "";
    }
    if (v == null) return "";
    return String(v).replace(/\s+/g, " ").trim();
};

/** Trendyol özellik adını karşılaştırma için normalize eder (*, /, fazla boşluk) */
const normTyAttrKey = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/\*/g, "")
        .replace(/\//g, " ")
        .replace(/\s+/g, " ")
        .trim();

/**
 * attributes + variantAttributes satırlarını tek liste; tekrarlayan isimlerde ilk dolu değer.
 * @param {Object} raw
 * @returns {{ attributeId: number|null, attributeName: string, attributeValue: string }[]}
 */
const collectTrendyolAttributeRows = (raw) => {
    const lists = [...(raw.attributes || []), ...(raw.variantAttributes || [])];
    /** @type {Map<string, { attributeId: number|null, attributeName: string, attributeValue: string }>} */
    const byNorm = new Map();
    for (const a of lists) {
        const attributeName = trendyolRowName(a);
        const attributeValue = trendyolRowValue(a);
        if (!attributeName && !attributeValue) continue;
        const idRaw = a?.attributeId;
        const attributeId = idRaw != null && `${idRaw}`.trim() !== "" ? Number(idRaw) : null;
        const row = {
            attributeId: Number.isFinite(attributeId) ? attributeId : null,
            attributeName,
            attributeValue
        };
        const key = normTyAttrKey(attributeName);
        if (!key) continue;
        const prev = byNorm.get(key);
        if (!prev || (!prev.attributeValue && attributeValue)) {
            byNorm.set(key, row);
        }
    }
    return [...byNorm.values()];
};

/**
 * @param {{ attributeName: string, attributeValue: string }[]} rows
 * @param {(kn: string) => boolean} pred
 */
const firstRowValueWhere = (rows, pred) => {
    for (const r of rows) {
        const kn = normTyAttrKey(r.attributeName);
        if (!kn) continue;
        if (pred(kn)) return r.attributeValue || "";
    }
    return "";
};

/**
 * Trendyol çoğu zaman garantiyi kök alanda değil "Garanti Süresi" vb. özellik satırında gönderir.
 * @param {{ attributeName?: string, attributeValue?: string }[]} rows
 * @returns {number|null} ay cinsinden; bilinmiyorsa null
 */
const parseGarantiMonthsFromTyAttributeRows = (rows) => {
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
        const kn = normTyAttrKey(r.attributeName || r.name || "");
        if (!kn.includes("garanti") && !kn.includes("warranty")) continue;
        let vRaw = r.attributeValue ?? r.value ?? r.customAttributeValue;
        if (vRaw && typeof vRaw === "object") {
            vRaw = vRaw.name ?? vRaw.value ?? vRaw.text ?? vRaw.attributeValue ?? "";
        }
        if (vRaw === 0 || vRaw === "0") return 0;
        const v = String(vRaw ?? "").trim().toLowerCase();
        if (!v) continue;
        if (
            v.includes("garantisiz") ||
            v.includes("garanti yok") ||
            v === "yok" ||
            v === "hayır" ||
            v === "hayir" ||
            v === "none" ||
            v === "no warranty" ||
            v === "0"
        ) {
            return 0;
        }
        const m = v.match(/(\d+)\s*(ay|month|mo\b)/i);
        if (m) return Math.min(120, parseInt(m[1], 10));
        const y = v.match(/(\d+)\s*(yıl|yil|year|yr\b)/i);
        if (y) return Math.min(120, parseInt(y[1], 10) * 12);
        const plain = v.match(/^(\d{1,3})$/);
        if (plain) {
            const num = parseInt(plain[1], 10);
            if (num >= 0 && num <= 120) return num;
        }
    }
    return null;
};

/** Trendyol bazen `brand: "TYBRxx"` kodu döner; görünen ad marka listesinde veya özellik satırındadır. */
const looksLikeTrendyolBrandSkuCode = (s) => {
    const t = String(s || "").trim();
    if (t.length < 4 || t.length > 32) return false;
    return /^TY[A-Z]{2,}[A-Z0-9]*$/i.test(t);
};

/**
 * @param {Object} raw - Trendyol API'den gelen ham ürün
 * @param {Map<number, string>|null} [brandIdToName] - GET /brands ile doldurulan id→ad (7651 hariç tutulur)
 * @returns {Object} masterProduct
 */
const fromTrendyol = (raw, brandIdToName = null) => {
    // Fiyat normalize: Trendyol bazen kuruş gönderir.
    // Güvenli eşik: 100.000 TL üzeri TAM SAYI ise kuruş olarak yorumla.
    // (Eski eşik 10.000 idi — 10.500 TL gibi gerçek fiyatları yanlış bölüyordu)
    const rawSale = parsePrice(raw.salePrice || raw.price || 0);
    const rawList = parsePrice(raw.listPrice || raw.salePrice || raw.price || 0);
    const isKurus = Number.isInteger(rawSale) && rawSale > 100000;
    const salePrice = isKurus ? rawSale / 100 : rawSale;
    const listPrice = isKurus ? rawList / 100 : rawList;

    const rows = collectTrendyolAttributeRows(raw);

    const boyutEbat = firstRowValueWhere(
        rows,
        (kn) =>
            (kn.includes("boyut") && kn.includes("ebat")) ||
            kn === "boyut ebat" ||
            kn.includes("ebat") ||
            (kn.includes("boyut") && !kn.includes("beden"))
    );

    const beden = firstRowValueWhere(
        rows,
        (kn) => kn === "beden" || kn.startsWith("beden ") || kn.includes("beden")
    );

    const webColor = firstRowValueWhere(
        rows,
        (kn) =>
            (kn.includes("web") && (kn.includes("color") || kn.includes("renk") || kn.includes("colour"))) ||
            kn === "web color" ||
            kn === "web renk"
    );

    const mainColor = firstRowValueWhere(
        rows,
        (kn) =>
            (kn === "renk" || kn.startsWith("renk ")) &&
            !kn.includes("web")
    );

    const themeStyle = firstRowValueWhere(
        rows,
        (kn) =>
            kn.includes("tema / stil") ||
            kn.includes("tema stil") ||
            (kn.includes("tema") && kn.includes("stil")) ||
            (kn.includes("theme") && kn.includes("style")) ||
            kn === "stil"
    );

    const pieceCount = firstRowValueWhere(
        rows,
        (kn) =>
            (kn.includes("parça") && kn.includes("say")) ||
            kn.includes("parça sayısı") ||
            kn.includes("parca sayisi") ||
            kn === "parça" ||
            kn.includes("piece")
    );

    const origin = firstRowValueWhere(
        rows,
        (kn) =>
            kn.includes("menşei") ||
            kn.includes("mensei") ||
            kn.includes("menşe") ||
            (kn.includes("origin") && kn.includes("country")) ||
            kn === "ülke" ||
            kn === "ulke"
    );

    const manufacturer = firstRowValueWhere(
        rows,
        (kn) =>
            kn.includes("üretici") ||
            kn.includes("uretici") ||
            kn.includes("imalatçı") ||
            kn.includes("imalatci") ||
            kn.includes("manufacturer")
    );

    const material = firstRowValueWhere(
        rows,
        (kn) =>
            kn.includes("materyal") ||
            kn.includes("malzeme") ||
            kn.includes("material") ||
            kn.includes("malzeme türü")
    );

    const gender = firstRowValueWhere(
        rows,
        (kn) => kn.includes("cinsiyet") || kn.includes("gender")
    );

    const model = firstRowValueWhere(
        rows,
        (kn) => kn === "model" || kn.startsWith("model ") || (kn.includes("model") && !kn.includes("numara"))
    );

    // Görseller — { url } objesi veya string olabilir
    const images = (raw.images || raw.media || [])
        .map(img => typeof img === "string" ? img : img?.url)
        .filter(url => url && typeof url === "string" && url.startsWith("https://"));

    const rowMarka = firstRowValueWhere(
        rows,
        (kn) =>
            kn === "marka" ||
            kn === "brand" ||
            (kn.includes("marka") &&
                !kn.includes("model") &&
                !kn.includes("numara") &&
                !kn.includes("tescil") &&
                !kn.includes("patent"))
    );

    // Marka: nesne / düz metin / brandName — "Diğer" ve TY kodlarını tek başına gösterim olarak kullanma
    let brand = "";
    if (typeof raw.brand === "string") {
        const b = raw.brand.trim();
        if (b && !isPlaceholderBrand(b) && !looksLikeTrendyolBrandSkuCode(b)) brand = b;
    } else if (raw.brand && typeof raw.brand === "object") {
        brand = String(raw.brand.name || raw.brand.brandName || raw.brand.title || "").trim();
        if (isPlaceholderBrand(brand)) brand = "";
    }
    if (!brand && raw.brandName) {
        const b = String(raw.brandName).trim();
        if (b && !isPlaceholderBrand(b)) brand = b;
    }
    if (!brand && rowMarka && !isPlaceholderBrand(rowMarka)) {
        brand = rowMarka;
    }

    const bid = raw.brandId != null && `${raw.brandId}`.trim() !== "" ? Number(raw.brandId) : NaN;
    if (
        (!brand || isPlaceholderBrand(brand)) &&
        Number.isFinite(bid) &&
        bid > 0 &&
        bid !== 7651 &&
        brandIdToName instanceof Map &&
        brandIdToName.has(bid)
    ) {
        const nm = String(brandIdToName.get(bid) || "").trim();
        if (nm && !isPlaceholderBrand(nm)) brand = nm;
    }

    if (!brand && typeof raw.brand === "string") {
        const b = raw.brand.trim();
        if (b && !isPlaceholderBrand(b)) brand = b;
    }

    const colorVal =
        mainColor ||
        (typeof raw.color === "string" ? raw.color.trim() : "") ||
        webColor ||
        "";

    const sizeVal = beden || boyutEbat || firstRowValueWhere(rows, (kn) => kn.includes("size")) || "";

    /** Trendyol API kök alanları (0 = garantisiz); `||` ile okunmaz — HB tarafında aynı mantık */
    const pickGarantiSuresiFromRaw = () => {
        const keys = [
            "garantiSuresi",
            "warrantyDuration",
            "warrantyMonths",
            "warranty",
            "warrantyDurationInMonth",
            "warrantyDurationInMonths",
            "productWarrantyDuration"
        ];
        for (const k of keys) {
            const v = raw[k];
            if (v == null || v === "") continue;
            const n = parseInt(String(v).trim(), 10);
            if (Number.isFinite(n) && n >= 0) return n;
        }
        return null;
    };
    const garantiFromRaw = pickGarantiSuresiFromRaw();
    const garantiFromRows = parseGarantiMonthsFromTyAttributeRows(rows);
    const garantiSuresi = clampMasterGarantiSuresi(
        garantiFromRaw !== null ? garantiFromRaw : garantiFromRows
    );

    return {
        // Kimlik
        barcode:              raw.barcode || raw.stockCode || "",
        sku:                  raw.stockCode || raw.barcode || "",
        marketplaceProductId: raw.productCode || raw.id || "",

        // İçerik
        title:       (raw.title || raw.name || "").trim(),
        description: (raw.description || "").trim(),
        images,

        // Fiyat & Stok
        price:     salePrice,
        listPrice: listPrice,
        stock:     parseInt(raw.quantity || 0),
        vatRate:   parseInt(raw.vatRate || 20),

        // Kategori & Marka (API leaf categoryId — kategori özellikleri / özet için gerekli)
        category: raw.categoryName || raw.category?.name || "",
        categoryId:
            raw.categoryId ??
            raw.pimCategoryId ??
            raw.productCategoryId ??
            raw.leafCategoryId ??
            raw.category?.id ??
            raw.category?.categoryId ??
            raw.category?.category_id ??
            (typeof raw.category === "number" ? raw.category : null) ??
            null,
        brand,

        ...(garantiSuresi !== null ? { garantiSuresi } : {}),

        // Attribute'lar + Trendyol satır özeti (kategori zorunluları / tekrar yükleme için)
        attributes: {
            color:    colorVal || null,
            size:     sizeVal || null,
            gender:   gender || raw.gender || null,
            material: material || null,
            model:    model || null,
            webColor: webColor || null,
            themeStyle: themeStyle || null,
            pieceCount: pieceCount || null,
            origin: origin || null,
            mensei: origin || null,
            manufacturer: manufacturer || null,
            boyutEbat: boyutEbat || null,
            trendyolAttributeRows: rows
        },

        // Kaynak bilgisi
        source: "Trendyol"
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 2 — autoFix()
// Master Product'u doğrular, eksikleri tamamlar, N11 kurallarını uygular
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} master - fromTrendyol() çıktısı
 * @returns {Object} fixed masterProduct
 */
const autoFix = (master) => {
    const fixed = { ...master, attributes: { ...(master.attributes || {}) } };
    const fixes = [];

    // ── Marka ────────────────────────────────────────────────────────────────
    if (!fixed.brand || fixed.brand.trim() === "") {
        fixed.brand = "Genel";
        fixes.push("brand → 'Genel'");
    }

    // ── Model ─────────────────────────────────────────────────────────────────
    if (!fixed.attributes.model || String(fixed.attributes.model).trim() === "") {
        fixed.attributes.model = "Standart";
        fixes.push("model → 'Standart'");
    }

    // ── Başlık ────────────────────────────────────────────────────────────────
    if (!fixed.title || fixed.title.trim() === "") {
        fixed.title = fixed.sku || fixed.barcode || "Ürün";
        fixes.push(`title → '${fixed.title}'`);
    }

    // ── Açıklama ──────────────────────────────────────────────────────────────
    if (!fixed.description || fixed.description.trim() === "") {
        fixed.description = fixed.title;
        fixes.push("description → title");
    }

    // ── Fiyat ────────────────────────────────────────────────────────────────
    // Fiyat hiçbir zaman değiştirilmez — kaynak platformdaki orijinal fiyat
    // tüm hedef platformlara aynen gönderilir.
    // listPrice her zaman >= salePrice olmalı
    if (fixed.listPrice < fixed.price) {
        fixed.listPrice = fixed.price;
    }

    // ── Stok ──────────────────────────────────────────────────────────────────
    if (!fixed.stock || fixed.stock < 0) {
        fixed.stock = 0;
    }

    // ── SKU / Barkod ──────────────────────────────────────────────────────────
    if (!fixed.sku && fixed.barcode) {
        fixed.sku = fixed.barcode;
        fixes.push("sku → barcode");
    }
    if (!fixed.barcode && fixed.sku) {
        fixed.barcode = fixed.sku;
    }

    if (fixes.length > 0) {
        logger.info(`[AUTO-FIX] "${fixed.title}": ${fixes.join(", ")}`);
    }

    return fixed;
};

// ─────────────────────────────────────────────────────────────────────────────
// KATMAN 3 — toN11()
// Master Product'u → N11 API payload'ına çevirir
// Ürünün marketplaceMappings'inden categoryId alır
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} master       - autoFix() çıktısı
 * @param {string} userId
 * @param {Object} credentials  - { apiKey, secretKey, shipmentTemplate? }
 * @returns {Promise<Object>}   - N11 sku payload objesi
 * @throws {Error}              - categoryId yoksa hata fırlatır (ürün gönderilmez)
 */
const toN11 = async (master, userId, credentials) => {
    // ── Kategori ID — ürünün marketplaceMappings'inden al ──
    let categoryId = null;
    if (master.marketplaceMappings && Array.isArray(master.marketplaceMappings)) {
        const n11Map = master.marketplaceMappings.find(
            m => (m.marketplaceName || "").toLowerCase() === "n11"
        );
        if (n11Map) categoryId = n11Map.categoryId;
    }
    // Fallback: master.categoryId doğrudan varsa
    if (!categoryId && master.categoryId) categoryId = master.categoryId;

    const categoryIdNum = parseInt(String(categoryId ?? "").trim(), 10);
    if (!categoryIdNum || Number.isNaN(categoryIdNum)) {
        throw new Error(
            `N11 categoryId bulunamadı veya geçersiz: "${master.category || "?"}" — ` +
            `Ürünün N11 marketplace mapping'inde sayısal yaprak kategori ID'si tanımlı olmalıdır.`
        );
    }
    categoryId = categoryIdNum;

    const catCheck = await n11Service.validateProductCategoryId(credentials, categoryId);
    if (catCheck.ok && catCheck.isLeaf === false) {
        throw new Error(
            `N11 categoryId ${categoryId}${catCheck.categoryName ? ` ("${catCheck.categoryName}")` : ""} üst kategori — ` +
                `ürün yüklemek için N11 kategori ağacında en alt (yaprak) düzey ID kullanılmalıdır. ` +
                `Kategori Merkezi'nde ürününüz için doğru alt kategoriyi seçip N11 mapping'ini güncelleyin; ` +
                `aksi halde N11 "category alanı geçersizdir" döner.`
        );
    }

    // Ürün / sihirbazda girilen şablon, entegrasyondaki varsayılanı geçersiz kılınır
    const shipmentTemplate = (
        master.shipmentTemplate ||
        credentials.shipmentTemplate ||
        ""
    ).toString().trim();

    if (!shipmentTemplate) {
        throw new Error(
            "N11 shipmentTemplate zorunlu. Sihirbazda kargo şablon adını girin veya " +
            "N11 Paneli > Hesabım > Teslimat Bilgilerim'den şablon adını pazaryeri entegrasyonuna kaydedin."
        );
    }

    const stockCode     = (master.sku || master.barcode || "").toString().trim();
    const productMainId = stockCode;
    const brand         = resolveProductBrandName(master) || master.brand || "Genel";

    logger.info(
        `[ADAPTER] toN11 tamamlandı — "${master.title}" | ` +
        `kategori: ${categoryId} | marka: "${brand}"`
    );

    let mappedAttributes = [];
    try {
        const attrRes = await n11Service.getCategoryAttributes(credentials, categoryId);
        if (attrRes?.success && Array.isArray(attrRes.attributes)) {
            mappedAttributes = buildN11Attributes(master, attrRes.attributes);
        }
    } catch (err) {
        logger.warn(`[ADAPTER] N11 category attributes alınamadı (${categoryId}): ${err.message}`);
    }

    return {
        // Zorunlu alanlar
        title:            master.title,
        description:      master.description || master.title,
        categoryId,
        currencyType:     "TL",
        productMainId,
        stockCode,
        shipmentTemplate,
        preparingDay:     parseInt(master.preparingDay) || 3,
        quantity:         parseInt(master.stock) || 0,
        salePrice:        master.price,
        listPrice:        master.listPrice,
        vatRate:          parseInt(master.vatRate) || 20,
        images:           master.images.map((url, i) => ({ url, order: i })),
        brand,
        attributes:       mappedAttributes,

        // Opsiyonel
        ...(master.barcode ? { barcode: master.barcode.toString().trim() } : {})
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// TAM PİPELİNE — pipeline()
// Trendyol ham verisi → N11 payload (tek fonksiyon)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} rawTrendyol  - Trendyol ham ürün
 * @param {string} userId
 * @param {Object} credentials  - N11 credentials
 * @returns {Promise<Object>}   - { master, fixed, n11Payload }
 * @throws {Error}              - Kategori mapping yoksa
 */
const pipeline = async (rawTrendyol, userId, credentials) => {
    const master    = fromTrendyol(rawTrendyol);
    const fixed     = autoFix(master);
    const n11Payload = await toN11(fixed, userId, credentials);
    return { master, fixed, n11Payload };
};

module.exports = {
    fromTrendyol,
    autoFix,
    toN11,
    pipeline,
    parsePrice,
    clampMasterGarantiSuresi,
    MASTER_GARANTI_MAX_MONTHS
};
