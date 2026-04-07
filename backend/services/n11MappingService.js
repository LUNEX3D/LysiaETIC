/**
 * N11 MAPPING & TRANSFORM SERVİSİ
 *
 * Pipeline:
 *   mapCategoryToN11()           → DB'den N11 kategori ID'si bul (fallback YOK — bulamazsa null)
 *   getCategoryAttributesCached() → N11 attribute'larını çek (DB cache + API)
 *   transformAttribute()          → Tek attribute'u valueId / customValue'ya çevir
 *   transformProductForN11()      → Tam pipeline — kategori + attribute + marka
 *   saveCategoryMapping()         → Kullanıcının kategori eşleştirmesini DB'ye kaydet
 *
 * ÖNEMLİ KURALLAR:
 *   - Kategori mapping bulunamazsa → null döner, ÇAĞIRAN throw eder (1000476 fallback YOK)
 *   - isCustomValue: false → SADECE valueId gönderilebilir
 *     → valueId bulunamazsa → ilk geçerli valueId kullanılır
 *     → attributeValues tamamen boşsa → attribute ATLANIR (customValue gönderilmez)
 *   - isCustomValue: true → customValue ile gönderilir
 *   - Marka (id:1) → her zaman customValue ile, tüm kategorilerde sabit
 */

const CategoryMapping        = require("../models/CategoryMapping");
const MarketplaceCategory    = require("../models/MarketplaceCategory");
const n11Service             = require("./n11Service");
const logger                 = require("../config/logger");
// categoryMappingService lazy-require ile alınır (circular dependency önlemi)
// mapCategoryToN11() içinde kullanılır

// ─────────────────────────────────────────────────────────────────────────────
// 1. KATEGORİ MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ürünün kategori adından N11 kategori ID'sini bul.
 * Bulunamazsa { categoryId: null, source: "none" } döner — FALLBACK UYGULANMAZ.
 *
 * @param {string} userId
 * @param {string} categoryName  - Ürünün kategori adı (örn: "Küpe", "Kadın > Aksesuar > Küpe")
 * @returns {Promise<{ categoryId: number|null, categoryName: string|null, source: string }>}
 */
const mapCategoryToN11 = async (userId, categoryName) => {
    if (!categoryName) return { categoryId: null, categoryName: null, source: "none" };

    const normalizedInput = categoryName.trim().toLowerCase();

    // ── 1. CategoryMapping koleksiyonunda ara ────────────────────────────────
    try {
        const mappings = await CategoryMapping.find({ userId });

        for (const mapping of mappings) {
            const n11Cat = mapping.marketplaceCategories.find(
                mc => mc.marketplaceName === "N11" && mc.categoryId && mc.isActive !== false
            );
            if (!n11Cat) continue;

            // masterCategory.name ile eşleşme
            const masterName = (mapping.masterCategory?.name || "").toLowerCase();
            if (masterName && normalizedInput.includes(masterName)) {
                logger.info(
                    `[N11 MAPPING] Kategori eşleşti (masterName): ` +
                    `"${categoryName}" → N11 ID: ${n11Cat.categoryId} (${n11Cat.categoryName})`
                );
                return {
                    categoryId:   parseInt(n11Cat.categoryId),
                    categoryName: n11Cat.categoryName,
                    source:       "CategoryMapping"
                };
            }

            // masterCategory.path içinde eşleşme
            const pathMatch = (mapping.masterCategory?.path || []).some(
                p => normalizedInput.includes(p.toLowerCase())
            );
            if (pathMatch) {
                logger.info(
                    `[N11 MAPPING] Kategori eşleşti (path): ` +
                    `"${categoryName}" → N11 ID: ${n11Cat.categoryId} (${n11Cat.categoryName})`
                );
                return {
                    categoryId:   parseInt(n11Cat.categoryId),
                    categoryName: n11Cat.categoryName,
                    source:       "CategoryMapping"
                };
            }
        }
    } catch (err) {
        logger.warn(`[N11 MAPPING] CategoryMapping arama hatası: ${err.message}`);
    }

    // ── 2. MarketplaceCategory cache'inde ara ────────────────────────────────
    try {
        const leafName = normalizedInput.split(">").pop().trim();
        const cached = await MarketplaceCategory.findOne({
            userId,
            marketplaceName: "N11",
            categoryName: { $regex: new RegExp(leafName, "i") }
        });

        if (cached) {
            logger.info(
                `[N11 MAPPING] Kategori cache'den bulundu: ` +
                `"${categoryName}" → N11 ID: ${cached.categoryId} (${cached.categoryName})`
            );
            return {
                categoryId:   parseInt(cached.categoryId),
                categoryName: cached.categoryName,
                source:       "MarketplaceCategory"
            };
        }
    } catch (err) {
        logger.warn(`[N11 MAPPING] MarketplaceCategory arama hatası: ${err.message}`);
    }

    // ── 3. InternalCategoryMapping tablosunda ara (Ortak resolveForMarketplace) ──
    try {
        const categoryMappingService = require("./categoryMappingService");
        const resolved = await categoryMappingService.resolveForMarketplace(categoryName, "N11");

        if (resolved && resolved.categoryId) {
            logger.info(
                `[N11 MAPPING] ✅ InternalCategoryMapping'den bulundu: ` +
                `"${categoryName}" → N11 ID: ${resolved.categoryId} (${resolved.categoryName})`
            );
            return {
                categoryId:   parseInt(resolved.categoryId),
                categoryName: resolved.categoryName,
                source:       "InternalCategoryMapping"
            };
        }
    } catch (err) {
        logger.warn(`[N11 MAPPING] InternalCategoryMapping arama hatası: ${err.message}`);
    }

    // ── Bulunamadı — null döner, çağıran karar verir ─────────────────────────
    logger.warn(
        `[N11 MAPPING] ❌ Kategori eşleşmesi bulunamadı: "${categoryName}". ` +
        `Çözüm: Kategori Eşleştirme Merkezi'nden bu kategoriyi eşleştirin.`
    );
    return { categoryId: null, categoryName: null, source: "none" };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. ATTRIBUTE ÇEKME (DB CACHE + API FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * N11 kategori attribute'larını getir.
 * Önce MarketplaceCategory cache'ine bakar, yoksa N11 API'den çeker ve cache'e yazar.
 *
 * @param {string} userId
 * @param {Object} credentials  - { apiKey, secretKey }
 * @param {number} categoryId
 * @returns {Promise<Array>}    - categoryAttributes dizisi
 */
const getCategoryAttributesCached = async (userId, credentials, categoryId) => {
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

    // ── 1. DB cache'e bak ────────────────────────────────────────────────────
    try {
        const cached = await MarketplaceCategory.findOne({
            userId,
            marketplaceName: "N11",
            categoryId:      String(categoryId)
        });

        if (cached?.attributes?.length > 0) {
            const ageMs = Date.now() - new Date(cached.pullInfo?.pulledAt || 0).getTime();
            if (ageMs < CACHE_TTL_MS) {
                logger.info(
                    `[N11 MAPPING] Attribute cache hit — ` +
                    `kategori: ${categoryId}, ${cached.attributes.length} attribute`
                );
                return cached.attributes;
            }
        }
    } catch (err) {
        logger.warn(`[N11 MAPPING] Cache okuma hatası: ${err.message}`);
    }

    // ── 2. N11 API'den çek ───────────────────────────────────────────────────
    logger.info(`[N11 MAPPING] Attribute API'den çekiliyor — kategori: ${categoryId}`);
    const result = await n11Service.getCategoryAttributes(credentials, categoryId);

    if (!result.success || !Array.isArray(result.attributes)) {
        logger.warn(
            `[N11 MAPPING] Attribute çekme başarısız — ` +
            `kategori: ${categoryId}: ${result.error}`
        );
        return [];
    }

    const attrs = result.attributes;

    // ── 3. DB'ye cache'le ────────────────────────────────────────────────────
    try {
        await MarketplaceCategory.findOneAndUpdate(
            { userId, marketplaceName: "N11", categoryId: String(categoryId) },
            {
                $set: {
                    userId,
                    marketplaceName: "N11",
                    categoryId:      String(categoryId),
                    categoryName:    result.name || String(categoryId),
                    attributes:      attrs.map(a => ({
                        attributeId:     String(a.attributeId),
                        attributeName:   a.attributeName   || "",
                        isMandatory:     a.isMandatory     === true,
                        isVariant:       a.isVariant        === true,
                        isSlicer:        a.isSlicer         === true,
                        isCustomValue:   a.isCustomValue    === true,
                        attributeValues: (a.attributeValues || []).map(v => ({
                            id:    String(v.id),
                            value: v.value || ""
                        }))
                    })),
                    "pullInfo.pulledAt":   new Date(),
                    "pullInfo.lastSyncAt": new Date()
                }
            },
            { upsert: true, new: true }
        );
        logger.info(
            `[N11 MAPPING] ${attrs.length} attribute DB'ye cache'lendi — kategori: ${categoryId}`
        );
    } catch (err) {
        logger.warn(`[N11 MAPPING] Cache yazma hatası: ${err.message}`);
    }

    return attrs;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. ATTRIBUTE TRANSFORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renk eşanlamlıları — N11'de karşılığı olmayan renk değerlerini
 * tanınan renk adlarına eşler. Anahtar: küçük harf normalize edilmiş ürün değeri.
 * Değer: N11'de aranacak alternatif renk adları (öncelik sırasıyla).
 */
const COLOR_SYNONYMS = {
    "taş":          ["gri", "bej", "krem", "açık gri"],
    "stone":        ["gri", "bej", "krem", "açık gri"],
    "kum":          ["bej", "krem", "ten"],
    "sand":         ["bej", "krem", "ten"],
    "mint":         ["yeşil", "açık yeşil", "su yeşili"],
    "mercan":       ["turuncu", "pembe", "kırmızı"],
    "coral":        ["turuncu", "pembe", "kırmızı"],
    "mürdüm":       ["mor", "bordo"],
    "plum":         ["mor", "bordo"],
    "petrol":       ["mavi", "lacivert", "koyu mavi"],
    "petrol mavisi":["mavi", "lacivert", "koyu mavi"],
    "indigo":       ["lacivert", "mavi", "koyu mavi"],
    "lila":         ["mor", "pembe", "açık mor"],
    "lavanta":      ["mor", "lila", "açık mor"],
    "lavender":     ["mor", "lila", "açık mor"],
    "somon":        ["pembe", "turuncu", "açık pembe"],
    "salmon":       ["pembe", "turuncu", "açık pembe"],
    "haki":         ["yeşil", "koyu yeşil"],
    "khaki":        ["yeşil", "koyu yeşil"],
    "füme":         ["gri", "koyu gri", "siyah"],
    "antrasit":     ["gri", "koyu gri", "füme"],
    "anthracite":   ["gri", "koyu gri"],
    "ekru":         ["krem", "beyaz", "bej"],
    "ecru":         ["krem", "beyaz", "bej"],
    "ten":          ["bej", "krem"],
    "nude":         ["bej", "krem", "ten"],
    "altın":        ["sarı", "gold"],
    "gold":         ["sarı", "altın"],
    "gümüş":        ["gri", "silver"],
    "silver":       ["gri", "gümüş"],
    "bakır":        ["kahverengi", "turuncu"],
    "copper":       ["kahverengi", "turuncu"],
    "turkuaz":      ["mavi", "yeşil", "açık mavi"],
    "turquoise":    ["mavi", "yeşil", "açık mavi"],
    "bordo":        ["kırmızı", "koyu kırmızı"],
    "burgundy":     ["kırmızı", "koyu kırmızı"],
    "hardal":       ["sarı", "turuncu"],
    "mustard":      ["sarı", "turuncu"],
    "pudra":        ["pembe", "açık pembe", "krem"],
    "powder":       ["pembe", "açık pembe", "krem"],
    "rose":         ["pembe", "açık pembe"],
    "gül":          ["pembe", "açık pembe"],
    "gül kurusu":   ["pembe", "bordo", "kırmızı"],
    "kiremit":      ["turuncu", "kahverengi", "kırmızı"],
    "vizon":        ["kahverengi", "bej", "gri"],
    "mink":         ["kahverengi", "bej", "gri"],
    "camel":        ["kahverengi", "bej"],
    "deve tüyü":    ["kahverengi", "bej"],
    "taba":         ["kahverengi", "bej"],
    "tan":          ["kahverengi", "bej"],
    "safir":        ["mavi", "koyu mavi"],
    "zümrüt":       ["yeşil", "koyu yeşil"],
    "nar":          ["kırmızı", "pembe"],
    "çilek":        ["kırmızı", "pembe"],
    "leylak":       ["mor", "lila", "pembe"],
    "okyanus":      ["mavi", "koyu mavi"],
    "gökyüzü":      ["mavi", "açık mavi"],
    "kar":          ["beyaz"],
    "kömür":        ["siyah", "koyu gri"],
    "charcoal":     ["siyah", "koyu gri"],
    "navy":         ["lacivert", "koyu mavi"],
    "ivory":        ["krem", "beyaz", "bej"],
    "fildişi":      ["krem", "beyaz", "bej"],
    "magenta":      ["pembe", "mor", "kırmızı"],
    "fuşya":        ["pembe", "mor"],
    "fuchsia":      ["pembe", "mor"],
    "aqua":         ["mavi", "turkuaz", "açık mavi"],
    "şeftali":      ["turuncu", "pembe", "bej"],
    "peach":        ["turuncu", "pembe", "bej"],
    "çok renkli":   ["karışık", "renkli"],
    "multicolor":   ["karışık", "renkli"],
    "multi":        ["karışık", "renkli"],
};

/**
 * Renk attribute'u için eşanlamlı eşleşme dene.
 * @param {string} normalizedVal - Küçük harfe çevrilmiş ürün renk değeri
 * @param {Array} attrValues     - N11 attribute value listesi
 * @returns {Object|null}        - Eşleşen attrValue veya null
 */
const findColorSynonymMatch = (normalizedVal, attrValues) => {
    const synonyms = COLOR_SYNONYMS[normalizedVal];
    if (!synonyms) return null;
    for (const syn of synonyms) {
        const synLower = syn.toLowerCase();
        // Tam eşleşme
        const exact = attrValues.find(
            v => v.value && v.value.toString().toLowerCase() === synLower
        );
        if (exact) return exact;
        // Kısmi eşleşme (synonym N11 değerinin içinde veya tersi)
        const partial = attrValues.find(
            v => v.value && (
                v.value.toString().toLowerCase().includes(synLower) ||
                synLower.includes(v.value.toString().toLowerCase())
            )
        );
        if (partial) return partial;
    }
    return null;
};

/**
 * Tek bir N11 attribute'unu ürün değerinden dönüştür.
 *
 * KURAL:
 *   isCustomValue: true  → customValue ile gönder (serbest metin)
 *   isCustomValue: false → SADECE valueId ile gönder
 *     1. Tam eşleşme ara
 *     2. Kısmi eşleşme ara
 *     3. Renk eşanlamlı eşleşme (COLOR_SYNONYMS — sadece renk attribute'ları)
 *     4. Eşleşme yoksa:
 *        - Zorunlu attribute → ilk geçerli valueId kullan (güvenli fallback)
 *        - Opsiyonel attribute → null döner (attribute ATLANIR)
 *     5. attributeValues tamamen boşsa → null döner (attribute ATLANIR)
 *
 * @param {Object} catAttr      - N11 kategori attribute tanımı
 * @param {string|null} productValue - Ürünün bu attribute için değeri
 * @returns {Object|null}       - { id, valueId, customValue } veya null (atlanacak)
 *
 * NOT: Renk attribute'u (attrName "renk" içeriyorsa) için eşanlamlı eşleşme
 *      (COLOR_SYNONYMS) da denenir — tam/kısmi eşleşme bulunamazsa.
 */
const transformAttribute = (catAttr, productValue) => {
    const attrId        = Number(catAttr.attributeId || catAttr.id);
    const isCustomValue = catAttr.isCustomValue === true;
    const isMandatory   = catAttr.isMandatory   === true;
    const attrValues    = catAttr.attributeValues || [];
    const attrName      = catAttr.attributeName   || "";

    if (!attrId || isNaN(attrId)) return null;

    // Marka (id:1) — ayrıca işlenir, burada atla
    if (attrId === 1) return null;

    // ── Geçersiz değerleri filtrele ──────────────────────────────────────────
    // "null" string, boş string, undefined, null → hepsi geçersiz
    const rawValue = (productValue || "").toString().trim();
    const isInvalidValue = !rawValue ||
                          rawValue === "null" ||
                          rawValue === "undefined" ||
                          rawValue === "0";

    if (isInvalidValue) {
        if (isMandatory) {
            // Zorunlu attribute ama değer geçersiz → fallback kullanılacak
            // Warning yerine debug seviyesinde logla (çok fazla spam olmasın)
            logger.debug(
                `[N11 MAPPING] Zorunlu attr "${attrName}" (${attrId}): ` +
                `ürün değeri geçersiz ("${productValue}") — fallback kullanılacak`
            );
        } else {
            // Opsiyonel attribute + geçersiz değer → atla (log bile gereksiz)
            return null;
        }
    }

    // ── isCustomValue: true → serbest metin ──────────────────────────────────
    if (isCustomValue) {
        // Geçersiz değer varsa atla
        if (isInvalidValue) {
            logger.warn(
                `[N11 MAPPING] Attr "${attrName}" (${attrId}): ` +
                `isCustomValue:true ama değer geçersiz — attribute atlandı`
            );
            return null;
        }
        logger.debug(`[N11 MAPPING] ✅ Attr "${attrName}" (${attrId}): customValue="${rawValue}"`);
        return { id: attrId, valueId: null, customValue: rawValue };
    }

    // ── isCustomValue: false → SADECE valueId ────────────────────────────────

    // attributeValues tamamen boşsa → customValue GÖNDERİLMEZ, attribute ATLANIR
    if (attrValues.length === 0) {
        logger.warn(
            `[N11 MAPPING] Attr "${attrName}" (${attrId}): ` +
            `isCustomValue:false ama attributeValues boş — attribute atlandı ` +
            `(N11 bu attribute için valueId listesi döndürmüyor)`
        );
        return null;
    }

    const normalizedVal = rawValue.toLowerCase();
    let match = null;

    // Geçerli değer varsa eşleşme ara
    if (!isInvalidValue) {
        // 1. Tam eşleşme
        match = attrValues.find(
            v => v.value && v.value.toString().toLowerCase() === normalizedVal
        );

        // 2. Kısmi eşleşme
        if (!match) {
            match = attrValues.find(
                v => v.value && (
                    v.value.toString().toLowerCase().includes(normalizedVal) ||
                    normalizedVal.includes(v.value.toString().toLowerCase())
                )
            );
        }

        // 3. Renk eşanlamlı eşleşme (sadece renk attribute'ları için)
        if (!match && attrName.toLowerCase().includes("renk")) {
            match = findColorSynonymMatch(normalizedVal, attrValues);
            if (match) {
                logger.info(
                    `[N11 MAPPING] 🎨 Renk eşanlamlı eşleşme: "${rawValue}" → ` +
                    `"${match.value}" (valueId: ${match.id}) — attr "${attrName}" (${attrId})`
                );
            }
        }
    }

    // 4. Eşleşme yoksa → zorunlu attribute için fallback, opsiyonel için atla
    if (!match) {
        if (isMandatory) {
            // Zorunlu attribute → ilk geçerli valueId kullan
            match = attrValues.find(v => v.id && Number(v.id) > 0);
            if (match) {
                // Sadece geçersiz değer DEĞİLSE warning ver (gerçek veri eşleşmediyse önemli)
                if (!isInvalidValue) {
                    logger.warn(
                        `[N11 MAPPING] ⚠️ Zorunlu attr "${attrName}" (${attrId}): ` +
                        `"${productValue}" eşleşmedi — fallback kullanıldı: ` +
                        `"${match.value}" (valueId: ${match.id}). ` +
                        `Çözüm: Ürün Yönetimi'nden bu ürünün "${attrName}" alanını düzeltin.`
                    );
                } else {
                    // Geçersiz değer için fallback → debug seviyesinde
                    logger.debug(
                        `[N11 MAPPING] Zorunlu attr "${attrName}" (${attrId}): ` +
                        `fallback kullanıldı: "${match.value}" (valueId: ${match.id})`
                    );
                }
            }
        } else {
            // Opsiyonel attribute → sessizce atla (log gereksiz)
            return null;
        }
    }

    // 5. Hiç geçerli valueId yoksa → attribute atlanır
    if (!match || !match.id || Number(match.id) <= 0) {
        logger.warn(
            `[N11 MAPPING] Attr "${attrName}" (${attrId}): ` +
            `geçerli valueId bulunamadı — attribute atlandı`
        );
        return null;
    }

    // Başarılı eşleşme — sadece debug seviyesinde logla (spam olmasın)
    logger.debug(
        `[N11 MAPPING] ✅ Attr "${attrName}" (${attrId}): ` +
        `valueId=${match.id} ("${match.value}")`
    );
    return { id: attrId, valueId: Number(match.id), customValue: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. ANA TRANSFORM FONKSİYONU
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Master Product'u N11 payload'ına hazırlar.
 *
 * Pipeline:
 *   1. Kategori mapping → N11 categoryId (resolvedCategoryId varsa direkt kullan)
 *   2. Attribute'ları N11'den çek (cache + API)
 *   3. isMandatory attribute'ları dönüştür
 *   4. Marka (id:1) ekle
 *
 * @param {string} userId
 * @param {Object} credentials  - { apiKey, secretKey }
 * @param {Object} product      - masterProduct (autoFix() çıktısı)
 * @param {Object} [options]    - Opsiyonel ayarlar
 * @param {number|string} [options.resolvedCategoryId] - Dışarıdan çözülmüş categoryId (tekrar arama yapılmaz)
 * @returns {Promise<{ categoryId, categoryName, categorySource, attributes, brand }>}
 */
const transformProductForN11 = async (userId, credentials, product, options = {}) => {
    // ── 1. Kategori mapping ──────────────────────────────────────────────────
    // resolvedCategoryId varsa → dışarıda zaten çözülmüş, tekrar aramaya gerek yok
    let categoryId = options.resolvedCategoryId ? parseInt(options.resolvedCategoryId) : null;
    let catResult  = { categoryId, categoryName: options.resolvedCategoryName || null, source: "resolved_external" };

    if (!categoryId) {
        const categoryStr = (
            product.category     ||
            product.categoryName ||
            ""
        ).trim();

        catResult  = await mapCategoryToN11(userId, categoryStr);
        categoryId = catResult.categoryId;
    }

    // ── 2. Attribute'ları çek (sadece kategori bulunduysa) ───────────────────
    let categoryAttrs = [];
    if (categoryId) {
        categoryAttrs = await getCategoryAttributesCached(userId, credentials, categoryId);
    }

    // ── 3. Ürün attribute map'ini oluştur ────────────────────────────────────
    // product.attributes { color, size, model, ... } formatında (masterProductAdapter'dan)
    const productAttrMap = {};

    if (product.attributes && typeof product.attributes === "object" && !Array.isArray(product.attributes)) {
        // Türkçe/İngilizce anahtar normalizasyonu
        const keyMap = {
            color:    "renk",
            renk:     "renk",
            size:     "beden",
            beden:    "beden",
            brand:    "marka",
            marka:    "marka",
            material: "materyal",
            materyal: "materyal",
            gender:   "cinsiyet",
            cinsiyet: "cinsiyet",
            model:    "model"
        };
        for (const [key, val] of Object.entries(product.attributes)) {
            if (val !== null && val !== undefined) {
                // "null", "undefined" string değerlerini filtrele (Trendyol bazen bunları gönderir)
                const strVal = val.toString().trim();
                if (strVal === "null" || strVal === "undefined" || strVal === "") continue;
                const normalKey = keyMap[key.toLowerCase()] || key.toLowerCase();
                productAttrMap[normalKey] = val;
            }
        }
    }

    // ── 4. Attribute'ları dönüştür (zorunlu + ürün verisi olan opsiyoneller) ──
    // ESKİ: Sadece isMandatory attribute'lar işleniyordu → opsiyonel ama önemli
    //        attribute'lar (Renk, Model vb.) atlanıyordu → N11 ürünü eksik bilgiyle reddedebiliyordu
    // YENİ: Zorunlu attribute'lar HER ZAMAN işlenir + opsiyonel attribute'lar
    //        SADECE ürün verisinde değer varsa işlenir (gereksiz fallback yapılmaz)
    const safeAttributes = [];

    for (const catAttr of categoryAttrs) {
        const attrId      = Number(catAttr.attributeId || catAttr.id);
        const isMandatory = catAttr.isMandatory === true;
        const attrName    = (catAttr.attributeName || "").toLowerCase();

        // Marka (id:1) — ayrıca eklenir
        if (attrId === 1) continue;

        // Ürün verisinden bu attribute'a karşılık gelen değeri bul
        // Önce Türkçe adla, sonra attribute ID'siyle ara
        const productValue =
            productAttrMap[attrName] ||
            productAttrMap[String(attrId)] ||
            null;

        // Opsiyonel attribute — ürün verisinde geçerli değer YOKSA atla
        // (gereksiz fallback yapılmaz, sadece gerçek veri varsa gönderilir)
        if (!isMandatory) {
            const rawVal = (productValue || "").toString().trim();
            const isValid = rawVal && rawVal !== "null" && rawVal !== "undefined" && rawVal !== "0";
            if (!isValid) continue; // Opsiyonel + değer yok → atla
        }

        const transformed = transformAttribute(catAttr, productValue);

        if (transformed) {
            safeAttributes.push(transformed);
        } else if (isMandatory) {
            // Zorunlu attribute dönüştürülemedi — logla ama devam et
            // (N11 zaten reddedecek, ama hangi attribute olduğu log'da görünür)
            logger.warn(
                `[N11 MAPPING] ⚠️ Zorunlu attribute dönüştürülemedi: ` +
                `"${catAttr.attributeName}" (${attrId}) — ` +
                `ürün değeri: "${productValue}", ` +
                `isCustomValue: ${catAttr.isCustomValue}, ` +
                `attributeValues sayısı: ${(catAttr.attributeValues || []).length}`
            );
        }
    }

    // ── 5. Marka (id:1) — her zaman customValue ile ──────────────────────────
    let brand = (
        product.brand                                                          ||
        productAttrMap["marka"]                                                ||
        (typeof product.attributes === "object" && !Array.isArray(product.attributes)
            ? product.attributes?.brand
            : null)                                                            ||
        ""
    ).toString().trim();

    // N11 "Genel" markasını kabul etmiyor — geçersiz markaları "Diğer" yap
    const invalidBrands = ["genel", "generic", "no brand", "nobrand", "marka yok", "belirtilmemiş", ""];
    if (invalidBrands.includes(brand.toLowerCase())) {
        brand = "Diğer";
    }

    // Marka zaten yoksa başa ekle
    const hasBrand = safeAttributes.some(a => Number(a.id) === 1);
    if (!hasBrand) {
        safeAttributes.unshift({ id: 1, valueId: null, customValue: brand });
    }

    logger.info(
        `[N11 MAPPING] Transform tamamlandı — ` +
        `kategori: ${categoryId ?? "YOK"} (${catResult.source}), ` +
        `${safeAttributes.length} attribute, marka: "${brand}"`
    );

    return {
        categoryId,
        categoryName:   catResult.categoryName,
        categorySource: catResult.source,
        attributes:     safeAttributes,
        brand
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. KATEGORİ MAPPING KAYDET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kullanıcının kategori eşleştirmesini DB'ye kaydet.
 *
 * @param {string} userId
 * @param {string} sourceCategoryName  - Kaynak kategori adı (örn: "Küpe")
 * @param {number} n11CategoryId       - N11 kategori ID
 * @param {string} n11CategoryName     - N11 kategori adı
 */
const saveCategoryMapping = async (userId, sourceCategoryName, n11CategoryId, n11CategoryName) => {
    const slug = sourceCategoryName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");

    const doc = await CategoryMapping.findOneAndUpdate(
        { userId, "masterCategory.slug": slug },
        {
            $set: {
                userId,
                masterCategory: {
                    name:  sourceCategoryName,
                    slug,
                    path:  sourceCategoryName.split(">").map(s => s.trim()),
                    level: sourceCategoryName.split(">").length - 1
                }
            }
        },
        { upsert: true, new: true }
    );

    doc.setMarketplaceCategory("N11", {
        categoryId:   String(n11CategoryId),
        categoryName: n11CategoryName,
        isActive:     true
    });
    await doc.save();

    logger.info(
        `[N11 MAPPING] Kategori mapping kaydedildi: ` +
        `"${sourceCategoryName}" → N11 ${n11CategoryId} (${n11CategoryName})`
    );
};

module.exports = {
    mapCategoryToN11,
    getCategoryAttributesCached,
    transformAttribute,
    transformProductForN11,
    saveCategoryMapping
};
