/**
 * Category Center Controller — LysiaETIC
 *
 * ✅ v5 — Tam Yeniden Yazım
 *
 * Düzeltmeler:
 *   1. CACHE SİSTEMİ: Kategori ağaçları MongoDB'de 24 saat cache'lenir.
 *      Her arama/tree isteğinde canlı API çağrısı YAPILMAZ.
 *   2. DRY: flat→tree, path hesaplama, platform fetch tek helper'da.
 *   3. HTML DECODE: &gt; &amp; &lt; gibi entity'ler temizlenir.
 *   4. KOD TEKRARI: 3 yerde copy-paste olan catMap/sortTree/getPath → tek fonksiyon.
 *
 * Desteklenen platformlar:
 *   - Trendyol (apigw.trendyol.com)  — master
 *   - N11 (api.n11.com/cdn/categories)
 *   - ÇiçekSepeti (apis.ciceksepeti.com)
 *   - Hepsiburada (listing-external.hepsiburada.com)
 *   - Amazon (SP-API) — henüz desteklenmiyor
 */

const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const xlsx = require("xlsx");
const Marketplace = require("../models/Marketplace");
const MasterCategoryMapping = require("../models/MasterCategoryMapping");
const CategoryCache = require("../models/CategoryCache");
const ProductMapping = require("../models/ProductMapping");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { ok, badRequest, notFound, serverError, paginated } = require("../utils/apiResponse");
const {
    filterHepsiburadaProductCategories,
    isHepsiburadaCampaignOrNonProductCategory,
    loadHepsiburadaListableCategoryIdSet,
    normalizeCredentials: normalizeHbCredentials,
    validateCredentials: validateHbCredentials,
    getEndpoints: getHbEndpoints,
    HB_SIT_ENDPOINTS
} = require("../services/hepsiburadaService");
const {
    getMasterPathText,
    findBestMatches,
    buildTargetIndex,
    isPlatformMappingEmpty,
    coerceCategoryId,
    DEFAULT_MATCH_OPTIONS,
    validateMappingQuality
} = require("../services/categoryAutoMatchService");
const { repairInvalidCategoryMappings } = require("../services/categoryMappingRepairService");

const PLATFORM_AUDIT_FIELDS = [
    { key: "n11", idField: "n11Id", pathField: "n11Path", label: "N11" },
    { key: "ciceksepeti", idField: "ciceksepetiId", pathField: "ciceksepetiPath", label: "ÇiçekSepeti" },
    { key: "hepsiburada", idField: "hepsiburadaId", pathField: "hepsiburadaPath", label: "Hepsiburada" },
    { key: "amazon", idField: "amazonId", pathField: "amazonPath", label: "Amazon" },
    { key: "ozon", idField: "ozonId", pathField: "ozonPath", label: "Ozon" },
];

/** Cache / ağaç: kampanya (HC) ve promosyon reyonlarını çıkar; üst düğümler kalır */
const sanitizeHbCategoriesForCache = (categories) => {
    if (!Array.isArray(categories) || categories.length === 0) return categories || [];
    return filterHepsiburadaProductCategories(categories, { requireListable: false, includeHx: true });
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: HTML Entity Decode
// ═══════════════════════════════════════════════════════════════
const HTML_ENTITIES = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
    "&#39;": "'", "&apos;": "'", "&#x27;": "'", "&#x2F;": "/",
    "&nbsp;": " ", "&#38;": "&", "&#60;": "<", "&#62;": ">"
};
const ENTITY_REGEX = new RegExp(Object.keys(HTML_ENTITIES).join("|"), "gi");

/**
 * HTML entity'leri decode et
 * "&gt;" → ">", "&amp;" → "&" vb.
 */
const decodeHtmlEntities = (str) => {
    if (!str || typeof str !== "string") return str || "";
    return str.replace(ENTITY_REGEX, (match) => HTML_ENTITIES[match.toLowerCase()] || match);
};

/**
 * Bir objenin tüm string alanlarını HTML decode et (shallow)
 */
const decodeObjectStrings = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    const result = { ...obj };
    for (const key of Object.keys(result)) {
        if (typeof result[key] === "string") {
            result[key] = decodeHtmlEntities(result[key]);
        }
    }
    return result;
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Cache Sabitleri
// ═══════════════════════════════════════════════════════════════
const CACHE_TTL_HOURS = 24;
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

/** Aynı kullanıcı+platform için eşzamanlı tam çekimleri tekilleştir (HB ~50k kategori × 3 istek önleme) */
const categoryTreeFetchInflight = new Map();

/** Büyük HB ağaçları tek Mongo dokümanına sığmaz (~16MB BSON); disk cache kullan */
const CATEGORY_FILE_CACHE_DIR = path.join(__dirname, "..", "cache", "category-cache");
const MONGO_CATEGORY_MAX_BYTES = 14 * 1024 * 1024;
const MONGO_CATEGORY_MAX_ITEMS = 12000;

const getCategoryFilePath = (userId, cacheKey) => {
    const safeUser = String(userId).replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeKey = String(cacheKey).replace(/[^a-zA-Z0-9-_]/g, "_");
    return path.join(CATEGORY_FILE_CACHE_DIR, `${safeUser}_${safeKey}.json`);
};

const shouldUseFileOnlyCategoryCache = (categories) => {
    if (!categories || categories.length > MONGO_CATEGORY_MAX_ITEMS) return true;
    try {
        const approx = Buffer.byteLength(JSON.stringify(categories), "utf8");
        if (approx > MONGO_CATEGORY_MAX_BYTES) return true;
    } catch {
        /* ignore */
    }
    return false;
};

const readCategoryFileCache = async (userId, cacheKey) => {
    const fp = getCategoryFilePath(userId, cacheKey);
    try {
        const raw = await fs.readFile(fp, "utf8");
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.categories) || data.categories.length === 0) return null;
        const ageMs = Date.now() - new Date(data.cachedAt).getTime();
        if (Number.isNaN(ageMs) || ageMs >= CACHE_TTL_MS) return null;
        return { categories: data.categories, cachedAt: data.cachedAt };
    } catch (e) {
        if (e.code !== "ENOENT") logger.warn(`[CATEGORY CACHE] Dosya okuma hatası: ${e.message}`);
        return null;
    }
};

const writeCategoryFileCache = async (userId, cacheKey, categories) => {
    await fs.mkdir(CATEGORY_FILE_CACHE_DIR, { recursive: true });
    const fp = getCategoryFilePath(userId, cacheKey);
    const payload = JSON.stringify({
        cachedAt: new Date().toISOString(),
        totalCount: categories.length,
        categories
    });
    await fs.writeFile(fp, payload, "utf8");
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Flat Liste → Ağaç Dönüşümü (TEK YER — DRY)
// ═══════════════════════════════════════════════════════════════

/**
 * HB flat kategori listesini normalize et (id, name, parentId, leaf, available)
 * + HTML entity decode uygula
 * + API'den gelen `paths` array'i ve `type` alanı korunuyor (v6)
 */
const normalizeHBCategory = (cat) => {
    const id = String(cat.categoryId || cat.id || "").trim();
    const hbTreeType = String(cat.hbTreeType || cat.type || "").trim() || null;
    /** HB/HX/HC aynı categoryId ile çakışmasın diye dahili anahtar */
    const nodeKey = hbTreeType && id ? `${hbTreeType}|${id}` : id;

    let apiPaths = null;
    if (Array.isArray(cat.paths) && cat.paths.length > 0) {
        apiPaths = cat.paths
            .map((p) => {
                if (p == null) return "";
                const s =
                    typeof p === "string"
                        ? p
                        : String(p.name || p.categoryName || p.title || p.id || "");
                return decodeHtmlEntities(s);
            })
            .filter(Boolean);
    }

    const parentRaw =
        cat.parentCategoryId != null && String(cat.parentCategoryId).trim() !== ""
            ? String(cat.parentCategoryId).trim()
            : null;
    const parentKey = parentRaw && hbTreeType ? `${hbTreeType}|${parentRaw}` : parentRaw;

    const name = decodeHtmlEntities(cat.name || cat.categoryName || "");
    const hbDisplayTitle =
        cat.hbDisplayTitle ||
        (hbTreeType ? `[${hbTreeType}] ${id}${name ? ` — ${name}` : ""}` : name || id);
    const leaf = cat.leaf === true || cat.leaf === "true";
    const available = cat.available === true || cat.available === "true";
    const status = cat.status || "ACTIVE";
    const canListProduct =
        cat.canListProduct === true ||
        (leaf && available && String(status).toUpperCase() === "ACTIVE" &&
            !isHepsiburadaCampaignOrNonProductCategory(cat));

    return {
        nodeKey,
        id,
        categoryId: id,
        hbTreeType,
        hbDisplayTitle,
        hbSearchBlob: String(cat.hbSearchBlob || "").toLowerCase(),
        name,
        displayName: decodeHtmlEntities(cat.displayName || cat.name || cat.categoryName || ""),
        parentCategoryId: parentRaw,
        parentKey,
        leaf,
        available,
        status,
        type: cat.type || hbTreeType,
        pathDisplay: cat.pathDisplay || "",
        apiPaths,
        canListProduct
    };
};

/**
 * Flat kategori listesinden Map oluştur
 * @returns {Map<string, object>}
 */
const buildCategoryMap = (categories) => {
    const catMap = new Map();
    for (const cat of categories) {
        const normalized = normalizeHBCategory(cat);
        if (normalized.nodeKey) {
            catMap.set(normalized.nodeKey, normalized);
        }
    }
    return catMap;
};

/**
 * catMap'ten ağaç yapısı oluştur (children alanıyla)
 * @param {Map} catMap
 * @param {string} childrenKey - "children" veya "subCategories"
 * @returns {Array} root node'lar
 */
const buildTree = (catMap, childrenKey = "children") => {
    const roots = [];
    for (const [, node] of catMap) {
        node[childrenKey] = [];
        node.hasChildren = false;
    }
    for (const [, node] of catMap) {
        if (node.parentKey && catMap.has(node.parentKey)) {
            const parent = catMap.get(node.parentKey);
            parent[childrenKey].push(node);
            parent.hasChildren = true;
        } else {
            roots.push(node);
        }
    }
    // Recursive sıralama
    const sortTree = (nodes) => {
        nodes.sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"));
        for (const n of nodes) {
            if (n[childrenKey] && n[childrenKey].length > 0) sortTree(n[childrenKey]);
        }
    };
    sortTree(roots);
    return roots;
};

/**
 * catMap'ten path hesapla (recursive, circular korumalı, cache'li)
 *
 * v6: API'den gelen `apiPaths` varsa onu kullan (daha güvenilir).
 *     Yoksa parentCategoryId ile recursive hesapla.
 *     HC/HX kategorilerinde parent farklı type'ta olabilir — apiPaths bunu çözer.
 *
 * @returns {function(id): string[]}
 */
const createPathResolver = (catMap) => {
    const pathCache = new Map();
    const getPath = (mapKey, visited = new Set()) => {
        if (pathCache.has(mapKey)) return pathCache.get(mapKey);
        if (visited.has(mapKey)) return [];
        visited.add(mapKey);
        const node = catMap.get(mapKey);
        if (!node) return [];

        // v6: API'den gelen paths array'i varsa onu kullan
        if (node.apiPaths && node.apiPaths.length > 0) {
            const result = [...node.apiPaths];
            pathCache.set(mapKey, result);
            return result;
        }

        // Fallback: parentKey (aynı hbTreeType) ile recursive hesapla
        if (!node.parentKey || !catMap.has(node.parentKey)) {
            const result = [node.name];
            pathCache.set(mapKey, result);
            return result;
        }
        const result = [...getPath(node.parentKey, visited), node.name];
        pathCache.set(mapKey, result);
        return result;
    };
    return getPath;
};

/**
 * Hangi ID'lerin child'ı var tespit et
 */
const findParentIds = (catMap) => {
    const parentIds = new Set();
    for (const [, node] of catMap) {
        if (node.parentKey && catMap.has(node.parentKey)) {
            parentIds.add(node.parentKey);
        }
    }
    return parentIds;
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Platform Kategori Fetch Fonksiyonları
// ═══════════════════════════════════════════════════════════════

const fetchTrendyolCategoryTree = async (credentials) => {
    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
    const actualSellerId = sellerId || supplierId;
    if (!apiKey || !apiSecret || !actualSellerId) {
        throw new Error("Trendyol credentials eksik (apiKey, apiSecret, sellerId)");
    }
    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await axios.get(
        "https://apigw.trendyol.com/integration/product/product-categories",
        {
            headers: {
                Authorization: `Basic ${authHeader}`,
                "User-Agent": `${actualSellerId} - LysiaETIC`,
                "Content-Type": "application/json"
            },
            timeout: 30000
        }
    );
    return response.data?.categories || [];
};

const fetchN11CategoryTree = async (credentials) => {
    const { apiKey, secretKey } = credentials;
    if (!apiKey || !secretKey) {
        throw new Error("N11 credentials eksik (apiKey, secretKey)");
    }
    const cleanAscii = (str) => String(str || "").replace(/[^\x20-\x7E]/g, "");
    const response = await axios.get(
        "https://api.n11.com/cdn/categories",
        {
            headers: {
                appkey: cleanAscii(apiKey),
                appsecret: cleanAscii(secretKey),
                "Content-Type": "application/json",
                "User-Agent": "LysiaETIC"
            },
            timeout: 30000
        }
    );
    return response.data?.categories || response.data || [];
};

const fetchCiceksepetiCategoryTree = async (credentials) => {
    const { apiKey, sellerId, integratorName, isTestMode } = credentials;
    if (!apiKey) {
        throw new Error("ÇiçekSepeti credentials eksik (apiKey)");
    }
    const cleanSellerId = String(sellerId || "").replace(/[^\x00-\x7F]/g, "");
    const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, "") : "";
    const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : cleanSellerId || "CicekSepetiIntegration";
    const baseUrl = isTestMode
        ? "https://sandbox-apis.ciceksepeti.com/api/v1"
        : "https://apis.ciceksepeti.com/api/v1";
    const response = await axios.get(
        `${baseUrl}/Categories`,
        {
            headers: {
                "x-api-key": apiKey,
                "user-agent": userAgent,
                "Content-Type": "application/json"
            },
            timeout: 30000
        }
    );
    const data = response.data;
    const categories =
        data?.categories ||
        data?.data?.categories ||
        data?.data ||
        (Array.isArray(data) ? data : []);
    if (!Array.isArray(categories) || categories.length === 0) {
        const msg = data?.message || data?.error || response.statusText || "boş yanıt";
        throw new Error(
            `ÇiçekSepeti kategori listesi alınamadı (${msg}). ` +
            `Entegrasyonda API anahtarı, Satıcı ID ve User-Agent (integrator) alanlarını kontrol edin.`
        );
    }
    return categories;
};

/**
 * Hepsiburada kategori ağacı — tek kaynak: hepsiburadaService.fetchHepsiburadaCategories
 *
 * - HB + HX katalog çekilir (HC kampanya ağacı hariç); satırda hbTreeType ile işaretlenir.
 * - Birleştirme: hbTreeType|categoryId (aynı kaydın API tekrarı elenir; farklı ağaç aynı ID ile çakışırsa ikisi de kalır).
 * - listing-external isteklerinde merchantId query parametresi eklenir.
 * - UI alanları: categoryId (resmi), hbDisplayTitle, pathDisplay, leaf, available
 */
const fetchHepsiburadaCategoryTree = async (credentials, options = {}) => {
    const hb = require("../services/hepsiburadaService");
    const hbCreds = hb.normalizeCredentials(credentials);
    const validation = hb.validateCredentials(hbCreds, "kategori ağacı çekme");
    if (!validation.valid) {
        throw new Error(validation.error);
    }
    const { merchantId, secretKey, userAgent } = hbCreds;
    const userEp = hb.getEndpoints(hbCreds);
    const useSit = userEp.MPOP === hb.HB_SIT_ENDPOINTS.MPOP;
    const onlyLeaf = options.onlyLeaf === true;

    logger.info(
        `[HB CATEGORIES] Ortam: ${useSit ? "SIT" : "Production"}, merchantId: ${merchantId ? String(merchantId).substring(0, 8) + "..." : "YOK"}, onlyLeaf=${onlyLeaf} — HB+HX katalog (kampanya/HC hariç)`
    );

    const categories = await hb.fetchHepsiburadaCategories(merchantId, secretKey, userAgent, {
        onlyLeaf,
        useSit,
        forUi: true
    });

    if (!categories.length) {
        throw new Error("Hepsiburada kategori API'sinden veri alınamadı. Lütfen entegrasyon bilgilerinizi kontrol edin.");
    }
    return categories;
};

const fetchAmazonCategoryTree = async (credentials) => {
    try {
        const {
            normalizeAmazonCredentials,
            validateAmazonCredentials
        } = require("../services/amazon/amazonCredentialService");
        const amazonSpApi = require("../services/amazon/amazonSpApiService");

        const creds = normalizeAmazonCredentials(credentials);
        const validation = validateAmazonCredentials(creds);
        if (!validation.valid) {
            logger.warn(`[Amazon CAT] Credential eksik: ${validation.message}`);
            return [];
        }

        const result = await amazonSpApi.searchProductTypes(creds, " ");
        const types = result?.productTypes || [];
        return types.map((pt) => ({
            id: pt.name,
            categoryId: pt.name,
            name: pt.displayName || pt.name,
            categoryName: pt.displayName || pt.name,
            leaf: true,
            available: true
        }));
    } catch (err) {
        logger.warn(`[Amazon CAT] Ürün tipi listesi alınamadı: ${err.message}`);
        return [];
    }
};

// ═══════════════════════════════════════════════════════════════
// 🗄️ CACHE: Kategorileri Çek veya Cache'den Oku
// ═══════════════════════════════════════════════════════════════

/**
 * Platform adını normalize et
 */
const normalizePlatformName = (name) => {
    return (name || "").toLowerCase().replace(/[\s\u00e7\u00f6\u00fc\u011f\u0131\u015f]/g, (m) => {
        const map = { "ç": "c", "ö": "o", "ü": "u", "ğ": "g", "ı": "i", "ş": "s", " ": "" };
        return map[m] || "";
    });
};

/**
 * Hepsiburada: SIT ve PROD kategori ağaçları farklı ID’ler kullanır; MPOP import ortamı ile aynı
 * listing host’undan gelen liste kullanılmalı. Cache anahtarına ortam eklenir (dosya + Mongo).
 */
const resolveHepsiburadaCategoryCacheKey = (normalizedName, marketplace) => {
    if (!normalizedName.includes("hepsiburada") || !marketplace?.credentials) {
        return normalizedName;
    }
    try {
        const creds = decryptCredentials(marketplace.credentials);
        const { normalizeCredentials } = require("../services/hepsiburadaService");
        if (normalizeCredentials(creds).useSit) {
            return `${normalizedName}_sit`;
        }
    } catch (e) {
        logger.warn(`[CATEGORY CACHE] Hepsiburada ortam anahtarı okunamadı: ${e.message}`);
    }
    return normalizedName;
};

/**
 * Belirli bir platform için kategori ağacını çek — CACHE'Lİ
 *
 * 1. Önce MongoDB cache'e bak (24 saat geçerli)
 * 2. Cache yoksa veya süresi dolmuşsa → canlı API'den çek
 * 3. Çekilen veriyi cache'e yaz
 *
 * @param {string} userId
 * @param {object} marketplace - DB'den gelen marketplace dokümanı
 * @param {object} options - { forceRefresh: bool, onlyLeaf: bool }
 * @returns {Array} Flat kategori listesi
 */
const getOrFetchCategories = async (userId, marketplace, options = {}) => {
    const { forceRefresh = false, onlyLeaf = false } = options;
    const mpName = marketplace.marketplaceName;
    const normalizedBase = normalizePlatformName(mpName);
    const cacheKey = resolveHepsiburadaCategoryCacheKey(normalizedBase, marketplace);

    // ── 1. Cache'e bak (dosya → Mongo; büyük listeler sadece dosyada) ──
    if (!forceRefresh) {
        try {
            const fromFile = await readCategoryFileCache(userId, cacheKey);
            if (fromFile) {
                const ageMs = Date.now() - new Date(fromFile.cachedAt).getTime();
                const fromFileCats =
                    normalizedBase.includes("hepsiburada")
                        ? sanitizeHbCategoriesForCache(fromFile.categories)
                        : fromFile.categories;
                logger.info(
                    `[CATEGORY CACHE] ✅ ${mpName} — dosya cache'den okundu (${fromFileCats.length} kategori, yaş: ${Math.round(ageMs / 60000)}dk, key=${cacheKey})`
                );
                return fromFileCats;
            }
        } catch (err) {
            logger.warn(`[CATEGORY CACHE] Dosya cache kontrolü: ${err.message}`);
        }
        try {
            const cached = await CategoryCache.findOne({
                userId,
                marketplaceName: cacheKey
            });
            if (cached && cached.categories && cached.categories.length > 0) {
                const ageMs = Date.now() - new Date(cached.cachedAt).getTime();
                if (ageMs < CACHE_TTL_MS) {
                    logger.info(
                        `[CATEGORY CACHE] ✅ ${mpName} — cache'den okundu (${cached.categories.length} kategori, yaş: ${Math.round(ageMs / 60000)}dk, key=${cacheKey})`
                    );
                    return normalizedBase.includes("hepsiburada")
                        ? sanitizeHbCategoriesForCache(cached.categories)
                        : cached.categories;
                }
                logger.info(`[CATEGORY CACHE] ⏰ ${mpName} — cache süresi dolmuş (${Math.round(ageMs / 3600000)}sa), yenileniyor...`);
            }
        } catch (err) {
            logger.warn(`[CATEGORY CACHE] Cache okuma hatası: ${err.message}`);
        }
    }

    const inflightKey = `${String(userId)}|${cacheKey}|ol:${onlyLeaf}|fr:${forceRefresh}`;
    const inflight = categoryTreeFetchInflight.get(inflightKey);
    if (inflight) {
        logger.info(`[CATEGORY CACHE] ⏳ ${mpName} — eşzamanlı çekim birleştiriliyor (key=${cacheKey})`);
        return inflight;
    }

    const fetchPromise = (async () => {
        try {
            // ── 2. Canlı API'den çek ──
            const credentials = decryptCredentials(marketplace.credentials);
            let categories = [];
            const normalizedName = normalizePlatformName(mpName);

            if (normalizedName.includes("trendyol")) {
                categories = await fetchTrendyolCategoryTree(credentials);
            } else if (normalizedName === "n11") {
                categories = await fetchN11CategoryTree(credentials);
            } else if (normalizedName.includes("ciceksepeti")) {
                categories = await fetchCiceksepetiCategoryTree(credentials);
            } else if (normalizedName.includes("hepsiburada")) {
                categories = await fetchHepsiburadaCategoryTree(credentials, { onlyLeaf });
            } else if (normalizedName.includes("amazon")) {
                categories = await fetchAmazonCategoryTree(credentials);
            } else if (normalizedName.includes("ozon")) {
                const { fetchOzonCategoryTree } = require("../services/ozon/ozonService");
                categories = await fetchOzonCategoryTree(credentials);
            } else {
                throw new Error(`${mpName} için kategori çekme desteklenmiyor`);
            }

            // ── 3. HTML entity decode uygula ──
            categories = categories.map((cat) => decodeObjectStrings(cat));

            if (normalizedName.includes("hepsiburada")) {
                const before = categories.length;
                categories = sanitizeHbCategoriesForCache(categories);
                if (before !== categories.length) {
                    logger.info(
                        `[CATEGORY CACHE] HB kampanya/HC filtresi: ${before - categories.length} satır elendi (kalan: ${categories.length})`
                    );
                }
            }

            // ── 4. Cache'e yaz (büyük listeler Mongo BSON sınırını aşar → disk) ──
            if (categories.length > 0) {
                const fileOnly = shouldUseFileOnlyCategoryCache(categories);
                if (fileOnly) {
                    try {
                        await writeCategoryFileCache(userId, cacheKey, categories);
                        logger.info(
                            `[CATEGORY CACHE] 💾 ${mpName} — ${categories.length} kategori dosyaya cache'lendi (Mongo atlandı: boyut, TTL: ${CACHE_TTL_HOURS}sa, key=${cacheKey})`
                        );
                    } catch (err) {
                        logger.warn(`[CATEGORY CACHE] Dosya cache yazma hatası: ${err.message}`);
                    }
                } else {
                    try {
                        await CategoryCache.findOneAndUpdate(
                            { userId, marketplaceName: cacheKey },
                            {
                                categories,
                                totalCount: categories.length,
                                cachedAt: new Date(),
                                expiresAt: new Date(Date.now() + CACHE_TTL_MS)
                            },
                            { upsert: true, new: true }
                        );
                        logger.info(
                            `[CATEGORY CACHE] 💾 ${mpName} — ${categories.length} kategori cache'lendi (TTL: ${CACHE_TTL_HOURS}sa, key=${cacheKey})`
                        );
                    } catch (err) {
                        logger.warn(`[CATEGORY CACHE] Cache yazma hatası: ${err.message}`);
                        try {
                            await writeCategoryFileCache(userId, cacheKey, categories);
                            logger.info(`[CATEGORY CACHE] 💾 ${mpName} — yedek: ${categories.length} kategori dosyaya yazıldı`);
                        } catch (e2) {
                            logger.warn(`[CATEGORY CACHE] Dosya cache yedek yazma hatası: ${e2.message}`);
                        }
                    }
                }
            }

            return categories;
        } finally {
            categoryTreeFetchInflight.delete(inflightKey);
        }
    })();

    categoryTreeFetchInflight.set(inflightKey, fetchPromise);
    return fetchPromise;
};

/**
 * Kullanıcının marketplace dokümanını bul
 */
const findMarketplace = async (userId, marketplaceName) => {
    return Marketplace.findOne({
        userId,
        marketplaceName: { $regex: new RegExp(`^${marketplaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
    });
};

/**
 * HB flat listesini ağaç yapısına dönüştür + istatistik
 */
const buildHBTreeResponse = (categories, marketplaceName) => {
    const cleaned = sanitizeHbCategoriesForCache(categories);
    const catMap = buildCategoryMap(cleaned);
    const roots = buildTree(catMap, "subCategories");
    return {
        marketplaceName,
        categories: roots,
        total: categories.length,
        treeRootCount: roots.length,
        fetchedAt: new Date().toISOString()
    };
};

// ═══════════════════════════════════════════════════════════════
// 📊 MASTER EŞLEŞTİRME TABLOSU
// ═══════════════════════════════════════════════════════════════

/**
 * Master eşleştirme tablosunu getir (sayfalı)
 * GET /api/category-center/mappings?page=1&limit=50&q=telefon
 */
exports.getMappings = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(10, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        const q = (req.query.q || "").trim();

        let filter = {};
        if (q.length >= 2) {
            // ✅ v6: Türkçe karakter normalize — "kolye" ve "Kolye" ve "KOLYE" hepsini bulsun
            const turkishVariant = q
                .replace(/ç/gi, "[çc]").replace(/ğ/gi, "[ğg]").replace(/ı/gi, "[ıi]")
                .replace(/ö/gi, "[öo]").replace(/ş/gi, "[şs]").replace(/ü/gi, "[üu]")
                .replace(/i/gi, "[iİı]").replace(/c/gi, "[cç]").replace(/g/gi, "[gğ]")
                .replace(/o/gi, "[oö]").replace(/s/gi, "[sş]").replace(/u/gi, "[uü]");
            const escaped = turkishVariant.replace(/[.*+?^${}()|\\]/g, "\\$&");
            const regex = new RegExp(escaped, "i");
            filter = {
                $or: [
                    { masterName: regex },
                    { masterPath: regex },
                    { trendyolPath: regex },
                    { n11Path: regex },
                    { ciceksepetiPath: regex },
                    { hepsiburadaPath: regex },
                    { amazonPath: regex }
                ]
            };
        }

        const [rows, total] = await Promise.all([
            MasterCategoryMapping.find(filter)
                .sort({ masterPath: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MasterCategoryMapping.countDocuments(filter)
        ]);

        // ✅ FIX: HTML entity decode uygula
        const decodedRows = rows.map(row => ({
            ...row,
            masterName: decodeHtmlEntities(row.masterName),
            masterPath: decodeHtmlEntities(row.masterPath),
            trendyolPath: decodeHtmlEntities(row.trendyolPath),
            n11Path: decodeHtmlEntities(row.n11Path),
            ciceksepetiPath: decodeHtmlEntities(row.ciceksepetiPath),
            hepsiburadaPath: decodeHtmlEntities(row.hepsiburadaPath),
            amazonPath: decodeHtmlEntities(row.amazonPath)
        }));

        return paginated(res, "Eşleştirmeler getirildi", decodedRows, { page, limit, total });
    } catch (error) {
        logger.error("[CATEGORY CENTER] Mapping listeleme hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * Dağıtım öncesi: ürünün Kategori Merkezi satırını bulup hedef platformdaki ID/yolu döndür
 * GET /api/category-center/resolve-for-distribute?productId=&targetPlatform=Trendyol
 */
const mapTargetPlatformToMappingFields = (platformName) => {
    const n = normalizePlatformName(platformName || "");
    if (n.includes("trendyol")) return { idKey: "trendyolId", pathKey: "trendyolPath", label: "Trendyol" };
    if (n === "n11") return { idKey: "n11Id", pathKey: "n11Path", label: "N11" };
    if (n.includes("cicek")) return { idKey: "ciceksepetiId", pathKey: "ciceksepetiPath", label: "ÇiçekSepeti" };
    if (n.includes("hepsiburada")) return { idKey: "hepsiburadaId", pathKey: "hepsiburadaPath", label: "Hepsiburada" };
    if (n.includes("amazon")) return { idKey: "amazonId", pathKey: "amazonPath", label: "Amazon" };
    if (n.includes("ozon")) return { idKey: "ozonId", pathKey: "ozonPath", label: "Ozon" };
    return null;
};

const buildMappingSearchRegex = (q) => {
    const turkishVariant = q
        .replace(/ç/gi, "[çc]").replace(/ğ/gi, "[ğg]").replace(/ı/gi, "[ıi]")
        .replace(/ö/gi, "[öo]").replace(/ş/gi, "[şs]").replace(/ü/gi, "[üu]")
        .replace(/i/gi, "[iİı]").replace(/c/gi, "[cç]").replace(/g/gi, "[gğ]")
        .replace(/o/gi, "[oö]").replace(/s/gi, "[sş]").replace(/u/gi, "[uü]");
    const escaped = turkishVariant.replace(/[.*+?^${}()|\\]/g, "\\$&");
    return new RegExp(escaped, "i");
};

exports.resolveForDistribute = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const productId = (req.query.productId || "").trim();
        const targetPlatform = (req.query.targetPlatform || "").trim();
        if (!productId || !targetPlatform) {
            return badRequest(res, "productId ve targetPlatform gerekli");
        }

        const product = await ProductMapping.findOne({ _id: productId, userId }).lean();
        if (!product) return notFound(res, "Ürün bulunamadı");

        const { resolveCategoryForDistribute } = require("../services/categoryCenterResolveService");
        const resolution = await resolveCategoryForDistribute(product, targetPlatform);

        if (!resolution.resolved) {
            return ok(res, resolution.message || "Kategori merkezinde eşleşme bulunamadı", {
                resolved: false,
                matchedBy: null,
                master: null,
                hint: resolution.hint || null,
                platformCategory: null,
            });
        }

        return ok(res, "Kategori merkezi eşlemesi hazır", {
            resolved: true,
            matchedBy: resolution.matchedBy,
            master: resolution.master,
            platformCategory: resolution.platformCategory,
        });
    } catch (error) {
        logger.error("[CATEGORY CENTER] resolve-for-distribute hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * Master eşleştirme istatistikleri
 * GET /api/category-center/mappings/stats
 */
exports.getMappingStats = async (req, res) => {
    try {
        const [total, uniqueMasters, withN11, withCiceksepeti, withHepsiburada, withAmazon] = await Promise.all([
            MasterCategoryMapping.countDocuments(),
            MasterCategoryMapping.distinct("masterId"),
            MasterCategoryMapping.countDocuments({ n11Id: { $ne: null } }),
            MasterCategoryMapping.countDocuments({ ciceksepetiId: { $ne: null } }),
            MasterCategoryMapping.countDocuments({ hepsiburadaId: { $ne: null } }),
            MasterCategoryMapping.countDocuments({ amazonId: { $ne: null } })
        ]);

        return ok(res, "İstatistikler", {
            totalRows: total,
            uniqueMasters: uniqueMasters.length,
            coverage: {
                trendyol: total,
                n11: withN11,
                ciceksepeti: withCiceksepeti,
                hepsiburada: withHepsiburada,
                amazon: withAmazon
            }
        });
    } catch (error) {
        logger.error("[CATEGORY CENTER] Stats hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * Eşleştirme kalite denetimi — şüpheli / çelişkili platform kategorileri
 * GET /api/category-center/mappings/audit?q=organizer&limit=80
 */
exports.auditMappings = async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 80));
        const platformFilter = (req.query.platform || "").trim().toLowerCase();

        let filter = {};
        if (q.length >= 2) {
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escaped, "i");
            filter = {
                $or: [
                    { masterPath: regex },
                    { masterName: regex },
                    { trendyolPath: regex },
                    { n11Path: regex },
                    { ciceksepetiPath: regex },
                    { hepsiburadaPath: regex },
                    { amazonPath: regex },
                ],
            };
        }

        const rows = await MasterCategoryMapping.find(filter)
            .sort({ masterPath: 1 })
            .limit(Math.min(5000, limit * 20))
            .lean();

        const issues = [];
        for (const row of rows) {
            const masterPath = getMasterPathText(row);
            if (!masterPath) continue;

            for (const pl of PLATFORM_AUDIT_FIELDS) {
                if (platformFilter && pl.key !== platformFilter) continue;
                const idVal = row[pl.idField];
                const pathVal = row[pl.pathField];
                if (idVal == null || idVal === "" || idVal === 0) continue;
                if (!pathVal || !String(pathVal).trim()) continue;

                const quality = validateMappingQuality(masterPath, String(pathVal));
                if (quality.ok) continue;

                issues.push({
                    mappingId: row._id,
                    masterId: row.masterId,
                    masterName: row.masterName,
                    masterPath: row.masterPath || masterPath,
                    platform: pl.key,
                    platformLabel: pl.label,
                    platformCategoryId: idVal,
                    platformPath: pathVal,
                    score: quality.score,
                    confidence: quality.confidence,
                    warning: quality.warning,
                    manual: !!row.manual,
                });
                if (issues.length >= limit) break;
            }
            if (issues.length >= limit) break;
        }

        return ok(res, `${issues.length} şüpheli eşleştirme`, {
            issues,
            total: issues.length,
            query: q || null,
            platform: platformFilter || null,
        });
    } catch (error) {
        logger.error("[CATEGORY CENTER] Audit hatası:", error.message);
        return serverError(res, error, "Kategori denetimi başarısız");
    }
};

/**
 * Hatalı platform eşleştirmelerini otomatik onar
 * POST /api/category-center/mappings/repair
 * Body: { dryRun: true, platforms: ["n11"], includeManual: true }
 */
exports.repairMappings = async (req, res) => {
    try {
        const dryRun = req.body?.dryRun !== false;
        const platforms = Array.isArray(req.body?.platforms) ? req.body.platforms : undefined;
        const includeManual = req.body?.includeManual !== false;

        const result = await repairInvalidCategoryMappings({
            dryRun,
            platforms,
            includeManual,
        });

        return ok(
            res,
            dryRun
                ? `${result.repairCount} eşleştirme onarılabilir (önizleme)`
                : `${result.updated} eşleştirme güncellendi`,
            result
        );
    } catch (error) {
        logger.error("[CATEGORY CENTER] Repair hatası:", error.message);
        return serverError(res, error, "Kategori onarımı başarısız");
    }
};

/**
 * Tek bir master eşleştirmeyi güncelle
 * PUT /api/category-center/mappings/:id
 */
exports.updateMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = {};
        const allowed = [
            "n11Id", "n11Path",
            "ciceksepetiId", "ciceksepetiPath",
            "hepsiburadaId", "hepsiburadaPath",
            "amazonId", "amazonPath"
        ];

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return badRequest(res, "Güncellenecek alan bulunamadı");
        }

        // ✅ Elle yapılan her düzenlemeyi işaretle — Excel re-import bu satırı ezmesin
        updates.manual = true;
        updates.source = "manual";

        const doc = await MasterCategoryMapping.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, lean: true }
        );

        if (!doc) return notFound(res, "Eşleştirme bulunamadı");

        logger.info(`[CATEGORY CENTER] Mapping güncellendi: ${doc.masterPath} — ${JSON.stringify(updates)}`);
        return ok(res, "Eşleştirme güncellendi", doc);
    } catch (error) {
        logger.error("[CATEGORY CENTER] Mapping güncelleme hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * Eşleştirme tablosunu Excel olarak dışa aktar
 * GET /api/category-center/mappings/export?q=telefon
 */
exports.exportMappings = async (req, res) => {
    try {
        const q = (req.query.q || "").trim();

        let filter = {};
        if (q.length >= 2) {
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escaped, "i");
            filter = {
                $or: [
                    { masterName: regex }, { masterPath: regex },
                    { trendyolPath: regex }, { n11Path: regex },
                    { ciceksepetiPath: regex }, { hepsiburadaPath: regex },
                    { amazonPath: regex }
                ]
            };
        }

        const rows = await MasterCategoryMapping.find(filter).sort({ masterPath: 1 }).lean();

        const excelRows = rows.map((r, idx) => ({
            "#": idx + 1,
            "Master ID": r.masterId || "",
            "Master Kategori": decodeHtmlEntities(r.masterName || ""),
            "Master Yol": decodeHtmlEntities(r.masterPath || ""),
            "Trendyol ID": r.trendyolId || "",
            "Trendyol Yol": decodeHtmlEntities(r.trendyolPath || ""),
            "N11 ID": r.n11Id || "",
            "N11 Yol": decodeHtmlEntities(r.n11Path || ""),
            "ÇiçekSepeti ID": r.ciceksepetiId || "",
            "ÇiçekSepeti Yol": decodeHtmlEntities(r.ciceksepetiPath || ""),
            "Hepsiburada ID": r.hepsiburadaId || "",
            "Hepsiburada Yol": decodeHtmlEntities(r.hepsiburadaPath || ""),
            "Amazon ID": r.amazonId || "",
            "Amazon Yol": decodeHtmlEntities(r.amazonPath || "")
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(excelRows);
        ws["!cols"] = [
            { wch: 6 }, { wch: 12 }, { wch: 25 }, { wch: 50 },
            { wch: 12 }, { wch: 50 }, { wch: 12 }, { wch: 50 },
            { wch: 14 }, { wch: 50 }, { wch: 14 }, { wch: 50 },
            { wch: 12 }, { wch: 50 }
        ];
        xlsx.utils.book_append_sheet(wb, ws, "Kategori Eşleştirme");

        // İstatistik sayfası
        const totalRows = rows.length;
        const withN11 = rows.filter(r => r.n11Id).length;
        const withCS = rows.filter(r => r.ciceksepetiId).length;
        const withHB = rows.filter(r => r.hepsiburadaId).length;
        const withAZ = rows.filter(r => r.amazonId).length;
        const uniqueMasters = new Set(rows.map(r => r.masterId)).size;

        const statsData = [
            { "Metrik": "Toplam Satır", "Değer": totalRows },
            { "Metrik": "Benzersiz Master Kategori", "Değer": uniqueMasters },
            { "Metrik": "Trendyol Eşleşme", "Değer": totalRows },
            { "Metrik": "N11 Eşleşme", "Değer": withN11 },
            { "Metrik": "ÇiçekSepeti Eşleşme", "Değer": withCS },
            { "Metrik": "Hepsiburada Eşleşme", "Değer": withHB },
            { "Metrik": "Amazon Eşleşme", "Değer": withAZ },
            { "Metrik": "---", "Değer": "---" },
            { "Metrik": "Dışa Aktarma Tarihi", "Değer": new Date().toISOString() },
            { "Metrik": "Arama Filtresi", "Değer": q || "(tümü)" }
        ];
        const wsStats = xlsx.utils.json_to_sheet(statsData);
        wsStats["!cols"] = [{ wch: 30 }, { wch: 25 }];
        xlsx.utils.book_append_sheet(wb, wsStats, "İstatistikler");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = q
            ? `kategori_eslestirme_${q}_${dateStr}.xlsx`
            : `kategori_eslestirme_${dateStr}.xlsx`;

        res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Length", buffer.length);

        logger.info(`[CATEGORY CENTER] Excel export: ${totalRows} satır${q ? ` (filtre: ${q})` : ""}`);
        return res.status(200).send(buffer);
    } catch (error) {
        logger.error("[CATEGORY CENTER] Excel export hatası:", error.message);
        return serverError(res, error, "Excel dışa aktarma başarısız");
    }
};

// ═══════════════════════════════════════════════════════════════
// 🌳 CANLI KATEGORİ AĞACI (CACHE'Lİ)
// ═══════════════════════════════════════════════════════════════

/**
 * Belirli bir pazaryerinin kategori ağacını çek
 * GET /api/category-center/:marketplaceName/tree
 *
 * ✅ v5: Cache'li — ilk çekimde API'ye gider, sonraki 24 saat cache'den okur
 */
exports.getCategoryTree = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const { marketplaceName } = req.params;
        if (!marketplaceName) return badRequest(res, "Pazaryeri adı gerekli");

        const marketplace = await findMarketplace(userId, marketplaceName);
        if (!marketplace) {
            return notFound(res, `${marketplaceName} entegrasyonu bulunamadı. Lütfen önce entegrasyonu ekleyin.`);
        }

        const forceRefresh = req.query.refresh === "true";
        const searchOnly = req.query.searchOnly === "true" || req.query.mode === "search";

        // Hızlı mod: tam ağaç çekme — arama endpoint'i cache'i doldurur
        if (searchOnly) {
            return ok(res, `${marketplaceName} — kategori araması için hazır`, {
                marketplaceName: marketplace.marketplaceName,
                categories: [],
                searchOnly: true,
                hint: "Kategori seçmek için en az 2 karakter yazarak arama kutusunu kullanın. Tam ağaç: ?refresh=true parametresi ile /tree çağrısı."
            });
        }

        const categories = await getOrFetchCategories(userId, marketplace, { forceRefresh, onlyLeaf: false });

        // HB: flat → tree dönüşümü
        const normalizedName = normalizePlatformName(marketplaceName);
        if (normalizedName.includes("hepsiburada") && Array.isArray(categories) && categories.length > 0) {
            const data = buildHBTreeResponse(categories, marketplace.marketplaceName);
            return ok(res, `${marketplaceName} kategorileri başarıyla çekildi`, data);
        }

        logger.info(`[CATEGORY CENTER] ${marketplaceName} — ${Array.isArray(categories) ? categories.length : 0} üst kategori`);
        return ok(res, `${marketplaceName} kategorileri başarıyla çekildi`, {
            marketplaceName: marketplace.marketplaceName,
            categories,
            total: Array.isArray(categories) ? categories.length : 0,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        logger.error("[CATEGORY CENTER] Kategori çekme hatası:", error.message);
        return serverError(res, error, "Kategoriler alınamadı: " + error.message);
    }
};

/**
 * Kullanıcının tüm entegre pazaryerlerini listele
 * GET /api/category-center/marketplaces
 */
exports.getMarketplaces = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const marketplaces = await Marketplace.find({ userId, isActive: true })
            .select("marketplaceName isActive createdAt")
            .lean();

        const allPlatforms = ["Trendyol", "N11", "ÇiçekSepeti", "Hepsiburada", "Amazon"];
        const result = allPlatforms.map(name => {
            const found = marketplaces.find(m =>
                normalizePlatformName(m.marketplaceName) === normalizePlatformName(name)
            );
            return {
                name,
                integrated: !!found,
                marketplaceId: found?._id || null,
                createdAt: found?.createdAt || null
            };
        });

        return ok(res, "Pazaryerleri listelendi", { platforms: result });
    } catch (error) {
        logger.error("[CATEGORY CENTER] Pazaryeri listeleme hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * Hepsiburada Kategori Ağacı — Tree yapısında döndür
 * GET /api/category-center/hepsiburada/categories?q=telefon
 *
 * ✅ v5: Cache'li + DRY helper'lar kullanılıyor
 */
exports.getHepsiburadaCategoryTree = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const q = (req.query.q || "").trim().toLowerCase();

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /hepsiburada/i }
        });

        if (!marketplace) {
            return notFound(res, "Hepsiburada entegrasyonu bulunamadı. Lütfen önce entegrasyonu ekleyin.");
        }

        const forceRefresh = req.query.refresh === "true";
        let allCategories;
        try {
            allCategories = await getOrFetchCategories(userId, marketplace, { forceRefresh, onlyLeaf: false });
        } catch (fetchErr) {
            logger.warn(`[HB CAT TREE] Tüm kategoriler çekilemedi, sadece leaf deneniyor: ${fetchErr.message}`);
            try {
                allCategories = await getOrFetchCategories(userId, marketplace, { forceRefresh: true, onlyLeaf: true });
            } catch (leafErr) {
                return ok(res, "Hepsiburada kategorileri alınamadı: " + leafErr.message, { tree: [], flatCount: 0, fetchedAt: new Date().toISOString() });
            }
        }

        if (!allCategories || allCategories.length === 0) {
            return ok(res, "Hepsiburada kategorileri boş döndü", { tree: [], flatCount: 0, fetchedAt: new Date().toISOString() });
        }

        // ✅ DRY: Tek helper ile ağaç oluştur
        const catMap = buildCategoryMap(allCategories);
        const roots = buildTree(catMap, "children");

        // Arama filtresi (opsiyonel) — ✅ v6: Türkçe normalize + kelime bazlı
        let resultTree = roots;
        if (q.length >= 2) {
            const matchedIds = new Set();
            const markAncestors = (mapKey) => {
                if (matchedIds.has(mapKey)) return;
                matchedIds.add(mapKey);
                const node = catMap.get(mapKey);
                if (node?.parentKey && catMap.has(node.parentKey)) {
                    markAncestors(node.parentKey);
                }
            };
            for (const [mapKey, node] of catMap) {
                const blob = (node.hbSearchBlob || `${node.name} ${node.hbDisplayTitle || ""} ${node.pathDisplay || ""}`).toLowerCase();
                if (
                    matchesAllWords(node.name || "", q) ||
                    matchesAllWords(node.displayName || "", q) ||
                    matchesAllWords(node.hbDisplayTitle || "", q) ||
                    matchesAllWords(blob, q)
                ) {
                    markAncestors(mapKey);
                }
            }
            const filterTree = (nodes) => {
                return nodes
                    .filter((n) => matchedIds.has(n.nodeKey))
                    .map((n) => ({ ...n, children: filterTree(n.children || []) }));
            };
            resultTree = filterTree(roots);
        }

        return ok(res, "Hepsiburada kategori ağacı başarıyla oluşturuldu", {
            tree: resultTree,
            flatCount: allCategories.length,
            treeRootCount: resultTree.length,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        logger.error("[HB CAT TREE] Hata:", error.message);
        return serverError(res, error, "Hepsiburada kategori ağacı alınamadı: " + error.message);
    }
};

/**
 * Hepsiburada Kategorilerini Excel olarak dışa aktar
 * GET /api/category-center/hepsiburada/categories/export?q=telefon
 */
exports.exportHepsiburadaCategoriesExcel = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const q = (req.query.q || "").trim().toLowerCase();

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /hepsiburada/i }
        });

        if (!marketplace) {
            return notFound(res, "Hepsiburada entegrasyonu bulunamadı");
        }

        let allCategories;
        try {
            allCategories = await getOrFetchCategories(userId, marketplace, { onlyLeaf: false });
        } catch (fetchErr) {
            logger.warn(`[HB CAT EXPORT] Tüm kategoriler çekilemedi: ${fetchErr.message}`);
            try {
                allCategories = await getOrFetchCategories(userId, marketplace, { forceRefresh: true, onlyLeaf: true });
            } catch (leafErr) {
                return serverError(res, leafErr, "HB kategorileri alınamadı: " + leafErr.message);
            }
        }

        if (!allCategories || allCategories.length === 0) {
            return badRequest(res, "Hepsiburada kategorileri boş döndü, export yapılamıyor");
        }

        // ✅ DRY: Tek helper ile catMap + path
        const catMap = buildCategoryMap(allCategories);
        const getPath = createPathResolver(catMap);

        let rows = [];
        for (const [mapKey, node] of catMap) {
            const pathArr = getPath(mapKey);
            const pathStr = pathArr.join(" > ");
            rows.push({
                hbTreeType: node.hbTreeType || "",
                categoryId: node.categoryId,
                name: node.name,
                hbDisplayTitle: node.hbDisplayTitle || "",
                path: pathStr,
                depth: pathArr.length,
                parentCategoryId: node.parentCategoryId || "",
                leaf: node.leaf,
                available: node.available,
                status: node.status
            });
        }

        if (q.length >= 2) {
            rows = rows.filter(
                (r) =>
                    r.name.toLowerCase().includes(q) ||
                    r.path.toLowerCase().includes(q) ||
                    String(r.categoryId).includes(q) ||
                    (r.hbDisplayTitle && r.hbDisplayTitle.toLowerCase().includes(q)) ||
                    (r.hbTreeType && r.hbTreeType.toLowerCase().includes(q))
            );
        }

        rows.sort((a, b) => a.path.localeCompare(b.path, "tr"));

        const excelRows = rows.map((r, idx) => ({
            "#": idx + 1,
            "Ağaç Tipi": r.hbTreeType || "",
            "Kategori ID": r.categoryId,
            "Kategori Adı": r.name,
            "HB Görünen": r.hbDisplayTitle || "",
            "Tam Yol": r.path,
            "Derinlik": r.depth,
            "Üst Kategori ID": r.parentCategoryId,
            "Yaprak (Leaf)": r.leaf ? "Evet" : "Hayır",
            "Kullanılabilir": r.available ? "Evet" : "Hayır",
            "Durum": r.status
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(excelRows);
        ws["!cols"] = [
            { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 35 }, { wch: 55 }, { wch: 70 },
            { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }
        ];
        xlsx.utils.book_append_sheet(wb, ws, "HB Kategoriler");

        const totalCats = rows.length;
        const leafCats = rows.filter(r => r.leaf).length;
        const rootCats = rows.filter(r => !r.parentCategoryId).length;
        const maxDepth = rows.reduce((max, r) => Math.max(max, r.depth), 0);

        const statsData = [
            { "Metrik": "Toplam Kategori", "Değer": totalCats },
            { "Metrik": "Yaprak (Leaf) Kategori", "Değer": leafCats },
            { "Metrik": "Kök Kategori", "Değer": rootCats },
            { "Metrik": "Maksimum Derinlik", "Değer": maxDepth },
            { "Metrik": "---", "Değer": "---" },
            { "Metrik": "Dışa Aktarma Tarihi", "Değer": new Date().toISOString() },
            { "Metrik": "Arama Filtresi", "Değer": q || "(tümü)" }
        ];
        const wsStats = xlsx.utils.json_to_sheet(statsData);
        wsStats["!cols"] = [{ wch: 30 }, { wch: 25 }];
        xlsx.utils.book_append_sheet(wb, wsStats, "İstatistikler");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        const dateStr = new Date().toISOString().slice(0, 10);
        const filename = q ? `hb_kategoriler_${q}_${dateStr}.xlsx` : `hb_kategoriler_${dateStr}.xlsx`;

        res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Length", buffer.length);

        logger.info(`[HB CAT EXPORT] Excel export: ${totalCats} kategori${q ? ` (filtre: ${q})` : ""}`);
        return res.status(200).send(buffer);
    } catch (error) {
        logger.error("[HB CAT EXPORT] Excel export hatası:", error.message);
        return serverError(res, error, "HB kategori Excel dışa aktarma başarısız");
    }
};

/**
 * Türkçe karakter normalizasyonu (arama için)
 * "Kolye Ucu" → "kolye ucu", "İstanbul" → "istanbul"
 */
const normalizeTurkish = (str) => {
    if (!str) return "";
    return str.toLowerCase()
        .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
        .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
        .replace(/İ/g, "i");
};

/**
 * Kelime bazlı arama — tüm kelimeler metinde var mı?
 * "kolye ucu" → ["kolye", "ucu"] → her ikisi de metinde olmalı
 */
const matchesAllWords = (text, query) => {
    const normalizedText = normalizeTurkish(text);
    const words = normalizeTurkish(query).split(/\s+/).filter(w => w.length > 0);
    return words.every(word => normalizedText.includes(word));
};

/**
 * Kategori ağacında arama yap (CACHE'Lİ)
 * GET /api/category-center/:marketplaceName/search?q=telefon
 *
 * ✅ v6: Türkçe karakter normalizasyonu + kelime bazlı arama
 * ✅ v6: "kolye ucu" → hem "kolye" hem "ucu" içeren kategorileri bulur
 * ✅ v5: Cache'den okur — her aramada canlı API çağrısı YAPMAZ
 * ✅ v5: DRY helper'lar — kod tekrarı yok
 */
exports.searchCategories = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const { marketplaceName } = req.params;
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return badRequest(res, "Arama terimi en az 2 karakter olmalı");
        }

        const marketplace = await findMarketplace(userId, marketplaceName);
        if (!marketplace) {
            return notFound(res, `${marketplaceName} entegrasyonu bulunamadı`);
        }

        // ✅ CACHE'den oku — canlı API çağrısı yapmaz (24 saat geçerli)
        const categories = await getOrFetchCategories(userId, marketplace, { onlyLeaf: false });

        let searchResults = [];
        const normalizedName = normalizePlatformName(marketplaceName);
        const query = q.trim();

        if (normalizedName.includes("hepsiburada") && Array.isArray(categories) && categories.length > 0) {
            // ── HB: flat liste → path hesapla → gelişmiş arama ──
            const catMap = buildCategoryMap(categories);
            const getPath = createPathResolver(catMap);
            const parentIds = findParentIds(catMap);

            for (const [mapKey, node] of catMap) {
                if (isHepsiburadaCampaignOrNonProductCategory(node)) continue;

                const pathArr = getPath(mapKey);
                const pathStr = pathArr.join(" > ");
                const name = node.name || "";
                const blob = (node.hbSearchBlob || `${name} ${node.hbDisplayTitle || ""} ${pathStr}`).toLowerCase();

                const nameMatch = matchesAllWords(name, query);
                const pathMatch = matchesAllWords(pathStr, query);
                const titleMatch = matchesAllWords(node.hbDisplayTitle || "", query);
                const blobMatch = matchesAllWords(blob, query);

                if (nameMatch || pathMatch || titleMatch || blobMatch) {
                    const canListProduct = node.leaf && node.available && node.status === "ACTIVE";
                    searchResults.push({
                        id: node.categoryId,
                        categoryId: node.categoryId,
                        nodeKey: node.nodeKey,
                        hbTreeType: node.hbTreeType || null,
                        hbDisplayTitle: node.hbDisplayTitle || "",
                        name: node.name,
                        path: pathStr,
                        leaf: node.leaf,
                        available: node.available,
                        type: node.type || null,
                        canListProduct,
                        hasChildren: parentIds.has(node.nodeKey)
                    });
                }
            }

            // Sıralama: ürün açılabilir (leaf+available+active) önce, sonra leaf, sonra diğerleri
            searchResults.sort((a, b) => {
                const aScore = a.canListProduct ? 0 : (a.leaf && a.available) ? 1 : a.leaf ? 2 : 3;
                const bScore = b.canListProduct ? 0 : (b.leaf && b.available) ? 1 : b.leaf ? 2 : 3;
                if (aScore !== bScore) return aScore - bScore;
                return (a.path || "").localeCompare(b.path || "", "tr");
            });

            const listingOnly = req.query.listingOnly !== "false";
            if (listingOnly) {
                searchResults = searchResults.filter((r) => r.canListProduct === true);
                try {
                    const hbCreds = normalizeHbCredentials(decryptCredentials(marketplace.credentials));
                    const hbVal = validateHbCredentials(hbCreds, "kategori arama");
                    if (hbVal.valid && typeof loadHepsiburadaListableCategoryIdSet === "function") {
                        const useSit = getHbEndpoints(hbCreds).MPOP === HB_SIT_ENDPOINTS.MPOP;
                        const listableIds = await loadHepsiburadaListableCategoryIdSet(
                            hbCreds.merchantId,
                            hbCreds.secretKey,
                            hbCreds.userAgent,
                            useSit
                        );
                        if (listableIds instanceof Set && listableIds.size > 0) {
                            searchResults = searchResults.filter((r) =>
                                listableIds.has(String(r.id || r.categoryId || "").trim())
                            );
                        }
                    }
                } catch (hbListErr) {
                    logger.warn(`[CATEGORY SEARCH] HB listelenebilir filtre atlandı: ${hbListErr?.message || hbListErr}`);
                }
            }
        } else if (normalizedName.includes("ozon") && Array.isArray(categories)) {
            for (const cat of categories) {
                const name = cat.name || "";
                const pathStr = cat.path || "";
                if (matchesAllWords(name, query) || matchesAllWords(pathStr, query)) {
                    searchResults.push({
                        id: cat.id,
                        categoryId: cat.categoryId,
                        typeId: cat.typeId,
                        name,
                        path: pathStr,
                        leaf: true,
                    });
                }
            }
            searchResults.sort((a, b) => (a.path || "").localeCompare(b.path || "", "tr"));
        } else {
            // ── Diğer pazaryerleri: nested tree → recursive flatten + gelişmiş arama ──
            const flattenAndSearch = (cats, parentPath = []) => {
                let results = [];
                if (!Array.isArray(cats)) return results;
                for (const cat of cats) {
                    const name = decodeHtmlEntities(cat.name || cat.categoryName || cat.title || "");
                    const id = cat.id || cat.categoryId || "";
                    const catPath = [...parentPath, name];
                    const pathStr = catPath.join(" > ");
                    const subs = cat.subCategories || cat.children || cat.subCats || [];

                    // ✅ Gelişmiş arama
                    const nameMatch = matchesAllWords(name, query);
                    const pathMatch = matchesAllWords(pathStr, query);

                    if (nameMatch || pathMatch) {
                        results.push({
                            id, name, path: pathStr,
                            hasChildren: Array.isArray(subs) && subs.length > 0
                        });
                    }
                    if (Array.isArray(subs) && subs.length > 0) {
                        results = results.concat(flattenAndSearch(subs, catPath));
                    }
                }
                return results;
            };
            searchResults = flattenAndSearch(categories);
            // Trendyol: yaprak sonuçları önce göster (ürün yalnızca leaf categoryId ile açılır)
            if (normalizedName.includes("trendyol") && searchResults.length > 1) {
                searchResults.sort((a, b) => {
                    const aLeaf = !a.hasChildren;
                    const bLeaf = !b.hasChildren;
                    if (aLeaf !== bLeaf) return aLeaf ? -1 : 1;
                    return (a.path || "").localeCompare(b.path || "", "tr");
                });
            }
        }

        logger.info(`[CATEGORY SEARCH] ${marketplaceName} — "${query}" → ${searchResults.length} sonuç`);

        return ok(res, `${searchResults.length} kategori bulundu`, {
            marketplaceName: marketplace.marketplaceName,
            query: q,
            results: searchResults.slice(0, 200),
            total: searchResults.length
        });
    } catch (error) {
        logger.error("[CATEGORY CENTER] Kategori arama hatası:", error.message);
        return serverError(res, error, "Kategori araması başarısız");
    }
};

// ═══════════════════════════════════════════════════════════════
// 🤖 AKILLI OTOMATİK EŞLEŞTİRME
// ═══════════════════════════════════════════════════════════════

/**
 * Segment bazlı benzerlik skoru hesapla.
 * Master path segmentlerini hedef path segmentleriyle karşılaştırır.
 *
 * Strateji:
 *   1. Tam path eşleşmesi → 1000 puan (mükemmel)
 *   2. Son segment (yaprak isim) eşleşmesi → +50 puan
 *   3. Her eşleşen üst segment (sondan başa) → +20 puan
 *   4. Segment sayısı benzerliği → +5 puan
 *   5. Kısmi kelime eşleşmesi → +5 puan
 *
 * Örnek:
 *   master: "Giyim > Kadın > Elbise"
 *   target1: "Giyim > Kadın > Elbise"       → 1000 (tam eşleşme)
 *   target2: "Moda > Kadın > Elbise"         → 50+20+5 = 75
 *   target3: "Ev > Tekstil > Elbise"         → 50+5 = 55
 *   target4: "Motosiklet > Aksesuar"          → 0 (yaprak kelimeleri uyuşmaz)
 * Skorlama: services/categoryAutoMatchService.js (kelime bazlı yaprak zorunluluğu)
 */

/**
 * Canlı API'den çekilen kategorileri flat listeye dönüştür (path ile)
 * Hem HB flat format hem de N11/CS nested tree format destekler
 */
const flattenCategoriesWithPath = (categories, isFlat = false) => {
    const result = [];

    if (isFlat) {
        // HB: flat liste → catMap → path hesapla
        const catMap = buildCategoryMap(categories);
        const getPath = createPathResolver(catMap);
        for (const [id, node] of catMap) {
            const pathArr = getPath(id);
            // HB Dokümantasyon: Ürün açılabilecek = leaf:true + available:true + status:ACTIVE
            const canListProduct = node.leaf && node.available && (node.status === "ACTIVE");
            result.push({
                id: node.id,
                name: node.name,
                path: pathArr.join(" > "),
                leaf: node.leaf,
                available: node.available,
                type: node.type || null,
                canListProduct
            });
        }
    } else {
        // N11/CS: nested tree → recursive flatten
        const flatten = (cats, parentPath = []) => {
            if (!Array.isArray(cats)) return;
            for (const cat of cats) {
                const name = decodeHtmlEntities(cat.name || cat.categoryName || cat.title || "");
                const id = String(cat.id || cat.categoryId || "");
                const catPath = [...parentPath, name];
                const pathStr = catPath.join(" > ");
                const subs = cat.subCategories || cat.children || cat.subCats || [];
                const hasChildren = Array.isArray(subs) && subs.length > 0;

                result.push({
                    id,
                    name,
                    path: pathStr,
                    leaf: !hasChildren,
                    available: true
                });

                if (hasChildren) {
                    flatten(subs, catPath);
                }
            }
        };
        flatten(categories);
    }

    return result;
};

/**
 * Ürün açmaya uygun hedef kategoriler — otomatik eşleştirmede üst düğüm / kapalı HB reyonu hatasını engeller.
 * - HB: leaf + available + ACTIVE (canListProduct)
 * - N11/ÇiçekSepeti: ağaçta çocuğu olmayan düğüm (leaf)
 */
const filterListingEligibleTargets = (flatList, isFlatHb) => {
    if (!Array.isArray(flatList)) return [];
    if (isFlatHb) {
        return flatList.filter((t) => t.canListProduct === true);
    }
    return flatList.filter((t) => t.leaf === true);
};

/** Otomatik eşleştirme: sadece listelenebilir yapraklar (HB'de tüm ağacı düzleştirme) */
const flattenEligibleTargetsForAutoMatch = (categories, isFlatHb) => {
    if (!Array.isArray(categories) || categories.length === 0) return [];

    if (isFlatHb) {
        const catMap = buildCategoryMap(categories);
        const getPath = createPathResolver(catMap);
        const result = [];
        for (const [nodeKey, node] of catMap) {
            if (node.canListProduct !== true) continue;
            let pathStr = (node.pathDisplay && String(node.pathDisplay).trim()) || "";
            if (!pathStr) {
                const pathArr = getPath(nodeKey);
                pathStr = pathArr.length ? pathArr.join(" > ") : (node.name || "");
            }
            if (!pathStr) continue;
            result.push({
                id: node.id,
                name: node.name,
                path: pathStr,
                leaf: true,
                available: true,
                canListProduct: true
            });
        }
        return result;
    }

    const flat = flattenCategoriesWithPath(categories, false);
    return filterListingEligibleTargets(flat, false);
};

const AUTO_MATCH_BULK_CHUNK = 400;

const bulkWriteMappingOpsChunked = async (bulkOps) => {
    if (!bulkOps.length) return;
    for (let i = 0; i < bulkOps.length; i += AUTO_MATCH_BULK_CHUNK) {
        await MasterCategoryMapping.bulkWrite(bulkOps.slice(i, i + AUTO_MATCH_BULK_CHUNK), { ordered: false });
    }
};

// Trendyol master taksonomisidir (masterPath = trendyolPath) → kendisiyle eşleştirilmez.
// Diğer tüm platformlar master kategoriye göre otomatik eşleştirilir.
const AUTO_MATCH_PLATFORM_CONFIGS = [
    { key: "n11", name: "N11", idField: "n11Id", pathField: "n11Path", isFlat: false },
    { key: "ciceksepeti", name: "ÇiçekSepeti", idField: "ciceksepetiId", pathField: "ciceksepetiPath", isFlat: false },
    { key: "hepsiburada", name: "Hepsiburada", idField: "hepsiburadaId", pathField: "hepsiburadaPath", isFlat: true },
    { key: "amazon", name: "Amazon", idField: "amazonId", pathField: "amazonPath", isFlat: false },
    { key: "ozon", name: "Ozon", idField: "ozonId", pathField: "ozonPath", isFlat: true },
];

const runAutoMatchForPlatform = async ({
    userId,
    platform,
    allMappings,
    minScore,
    minGap,
    dryRun,
    aggressive = false
}) => {
    const marketplace = await Marketplace.findOne({
        userId,
        marketplaceName: { $regex: new RegExp(platform.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    });

    if (!marketplace) {
        return {
            key: platform.key,
            matched: 0,
            skipped: 0,
            noMatch: 0,
            ambiguous: 0,
            result: { status: "skipped", reason: "Entegrasyon bulunamadı" }
        };
    }

    let categories;
    try {
        categories = await getOrFetchCategories(userId, marketplace, {
            onlyLeaf: false
        });
    } catch (fetchErr) {
        return {
            key: platform.key,
            matched: 0,
            skipped: 0,
            noMatch: 0,
            ambiguous: 0,
            result: { status: "error", reason: fetchErr.message }
        };
    }

    if (!categories || categories.length === 0) {
        return {
            key: platform.key,
            matched: 0,
            skipped: 0,
            noMatch: 0,
            ambiguous: 0,
            result: { status: "skipped", reason: "Kategori listesi boş" }
        };
    }

    const eligibleTargets = flattenEligibleTargetsForAutoMatch(categories, platform.isFlat);
    logger.info(
        `[AUTO-MATCH] ${platform.name} — ${categories.length} kaynak düğüm, ` +
        `${eligibleTargets.length} listelenebilir yaprak`
    );

    if (eligibleTargets.length === 0) {
        return {
            key: platform.key,
            matched: 0,
            skipped: 0,
            noMatch: 0,
            ambiguous: 0,
            result: { status: "skipped", reason: "Listelenebilir yaprak kategori yok" }
        };
    }

    const targetIndex = buildTargetIndex(eligibleTargets);
    const matchOpts = { minScore, minGap, _index: targetIndex };

    let matched = 0;
    let skipped = 0;
    let noMatch = 0;
    let ambiguous = 0;
    const bulkOps = [];
    const samples = [];

    for (const mapping of allMappings) {
        if (!isPlatformMappingEmpty(mapping, platform.idField)) {
            skipped++;
            continue;
        }

        const masterPath = getMasterPathText(mapping);
        if (!masterPath) {
            noMatch++;
            continue;
        }

        const matchResult = findBestMatches(masterPath, eligibleTargets, {
            ...matchOpts,
            bestEffort: true,
            aggressive
        });
        if (!matchResult.best) {
            if (matchResult.ambiguous) ambiguous++;
            noMatch++;
            continue;
        }

        const bestMatch = matchResult.best;
        const categoryId = coerceCategoryId(bestMatch.id);
        if (!categoryId) {
            noMatch++;
            continue;
        }

        if (samples.length < 8) {
            samples.push({
                masterPath,
                targetPath: bestMatch.path,
                score: bestMatch.score,
                confidence: matchResult.confidence
            });
        }

        bulkOps.push({
            updateOne: {
                filter: { _id: mapping._id },
                update: {
                    $set: {
                        [platform.idField]: categoryId,
                        [platform.pathField]: bestMatch.path || bestMatch.name || ""
                    }
                }
            }
        });
        matched++;
    }

    if (!dryRun && bulkOps.length > 0) {
        await bulkWriteMappingOpsChunked(bulkOps);
    }

    return {
        key: platform.key,
        matched,
        skipped,
        noMatch,
        ambiguous,
        result: {
            status: dryRun ? "preview" : "completed",
            sourceCategories: categories.length,
            listingEligible: eligibleTargets.length,
            matched,
            skipped,
            noMatch,
            ambiguous,
            minScore,
            minGap,
            wouldWrite: bulkOps.length,
            samples
        }
    };
};

/**
 * Manuel Onaylı Otomatik Eşleştirme — Tek tek eşleştirme önerileri sun
 * POST /api/category-center/auto-match/prepare
 *
 * Tüm boş eşleştirmeler için öneri listesi hazırlar.
 * Frontend bu listeyi tek tek kullanıcıya gösterir.
 *
 * Body: { platforms: ["n11", "ciceksepeti", "hepsiburada"] }
 *
 * Response: {
 *   suggestions: [
 *     {
 *       mappingId: "...",
 *       masterPath: "Giyim > Kadın > Elbise",
 *       platform: "n11",
 *       suggestion: { id: "123", path: "Moda > Kadın > Elbise", score: 75 },
 *       alternatives: [...]
 *     }
 *   ]
 * }
 */
exports.autoMatchPrepare = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const requestedPlatforms = req.body?.platforms || [];
        const minScore = Number(req.body?.minScore) || DEFAULT_MATCH_OPTIONS.minScore;
        const minGap = Number(req.body?.minGap) || DEFAULT_MATCH_OPTIONS.minGap;

        // ── 1. Tüm master eşleştirmeleri çek ──
        const allMappings = await MasterCategoryMapping.find({}).lean();
        if (allMappings.length === 0) {
            return badRequest(res, "Master eşleştirme tablosu boş. Önce Excel import yapın.");
        }

        logger.info(`[AUTO-MATCH PREPARE] Başlatılıyor — ${allMappings.length} master kategori`);

        const activePlatforms = requestedPlatforms.length > 0
            ? AUTO_MATCH_PLATFORM_CONFIGS.filter((p) => requestedPlatforms.includes(p.key))
            : AUTO_MATCH_PLATFORM_CONFIGS;

        const allSuggestions = [];

        await Promise.all(activePlatforms.map(async (platform) => {
            logger.info(`[AUTO-MATCH PREPARE] ${platform.name} işleniyor...`);

            const marketplace = await Marketplace.findOne({
                userId,
                marketplaceName: { $regex: new RegExp(platform.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
            });

            if (!marketplace) {
                logger.warn(`[AUTO-MATCH PREPARE] ${platform.name} — entegrasyon bulunamadı, atlanıyor`);
                return;
            }

            let categories;
            try {
                categories = await getOrFetchCategories(userId, marketplace, { onlyLeaf: false });
            } catch (fetchErr) {
                logger.error(`[AUTO-MATCH PREPARE] ${platform.name} — kategori çekme hatası: ${fetchErr.message}`);
                return;
            }

            if (!categories || categories.length === 0) return;

            const eligibleTargets = flattenEligibleTargetsForAutoMatch(categories, platform.isFlat);
            logger.info(
                `[AUTO-MATCH PREPARE] ${platform.name} — ${eligibleTargets.length} listelenebilir yaprak`
            );

            if (eligibleTargets.length === 0) return;

            const targetIndex = buildTargetIndex(eligibleTargets);
            const matchOpts = { minScore, minGap, topN: 5, _index: targetIndex };

            for (const mapping of allMappings) {
                if (!isPlatformMappingEmpty(mapping, platform.idField)) continue;

                const masterPath = getMasterPathText(mapping);
                if (!masterPath) continue;

                const result = findBestMatches(masterPath, eligibleTargets, matchOpts);
                const pick = result.best || (result.scored?.length === 1 ? result.scored[0] : null);
                if (!pick) continue;

                allSuggestions.push({
                    mappingId: mapping._id,
                    masterId: mapping.masterId,
                    masterName: mapping.masterName,
                    masterPath: mapping.masterPath || masterPath,
                    platform: platform.key,
                    platformLabel: platform.name,
                    idField: platform.idField,
                    pathField: platform.pathField,
                    suggestion: pick,
                    alternatives: (result.scored || []).filter((s) => s.id !== pick.id),
                    confidence: result.confidence || (result.ambiguous ? "review" : "medium"),
                    ambiguous: !!result.ambiguous
                });
            }
        }));

        logger.info(`[AUTO-MATCH PREPARE] Tamamlandı — ${allSuggestions.length} öneri hazırlandı`);

        return ok(res, `${allSuggestions.length} eşleştirme önerisi hazırlandı`, {
            suggestions: allSuggestions,
            total: allSuggestions.length
        });
    } catch (error) {
        logger.error("[AUTO-MATCH PREPARE] Hata:", error.message);
        return serverError(res, error, "Eşleştirme önerileri hazırlanamadı");
    }
};

/**
 * Tek bir eşleştirme önerisini onayla ve kaydet
 * POST /api/category-center/auto-match/approve
 *
 * Body: {
 *   mappingId: "...",
 *   platform: "n11",
 *   categoryId: "123",
 *   categoryPath: "Moda > Kadın > Elbise"
 * }
 */
exports.autoMatchApprove = async (req, res) => {
    try {
        const { mappingId, platform, categoryId, categoryPath } = req.body;

        if (!mappingId || !platform || !categoryId || !categoryPath) {
            return badRequest(res, "mappingId, platform, categoryId ve categoryPath gerekli");
        }

        const platformFieldMap = {
            n11: { idField: "n11Id", pathField: "n11Path" },
            ciceksepeti: { idField: "ciceksepetiId", pathField: "ciceksepetiPath" },
            hepsiburada: { idField: "hepsiburadaId", pathField: "hepsiburadaPath" },
            amazon: { idField: "amazonId", pathField: "amazonPath" }
        };

        const fields = platformFieldMap[platform];
        if (!fields) {
            return badRequest(res, "Geçersiz platform");
        }

        const updated = await MasterCategoryMapping.findByIdAndUpdate(
            mappingId,
            {
                $set: {
                    [fields.idField]: Number(categoryId) || categoryId,
                    [fields.pathField]: categoryPath
                }
            },
            { new: true, lean: true }
        );

        if (!updated) {
            return notFound(res, "Eşleştirme bulunamadı");
        }

        logger.info(`[AUTO-MATCH APPROVE] ${platform} — ${updated.masterPath} → ${categoryPath}`);

        return ok(res, "Eşleştirme kaydedildi", updated);
    } catch (error) {
        logger.error("[AUTO-MATCH APPROVE] Hata:", error.message);
        return serverError(res, error, "Eşleştirme kaydedilemedi");
    }
};

/**
 * Akıllı Otomatik Eşleştirme — Tüm platformlar için en iyi eşleşmeleri bul (TOPLU)
 * POST /api/category-center/auto-match
 *
 * Canlı API'lerden çekilen kategorileri master (Trendyol) kategorileriyle
 * segment bazlı benzerlik skoru ile eşleştirir.
 *
 * Body: { platforms: ["n11", "ciceksepeti", "hepsiburada"] }
 *       platforms boş ise tüm entegre platformlar için çalışır
 *
 * ✅ Sadece boş olan eşleştirmeleri doldurur (mevcut eşleşmeleri BOZMAZ)
 * ✅ Minimum skor eşiği: 50 (sadece son segment eşleşmesi yetmez, üst segment de lazım)
 */
/**
 * Auto-match çekirdeği — HTTP'den bağımsız, script'ten de çağrılabilir.
 * @param {object} params
 * @param {string|ObjectId} params.userId  - kategori entegrasyonlarının sahibi kullanıcı
 * @param {string[]} [params.platforms]    - boş ise tüm platformlar
 * @param {number} [params.minScore]
 * @param {number} [params.minGap]
 * @param {boolean} [params.dryRun]
 * @returns {Promise<{ results: object, summary: object }>}
 */
const runAutoMatchCore = async ({ userId, platforms = [], minScore, minGap, dryRun = false, aggressive = false }) => {
    const ms = Number(minScore) || DEFAULT_MATCH_OPTIONS.minScore;
    const mg = Number(minGap) || DEFAULT_MATCH_OPTIONS.minGap;

    const allMappings = await MasterCategoryMapping.find({}).lean();
    if (allMappings.length === 0) {
        throw new Error("Master eşleştirme tablosu boş. Önce Excel import yapın.");
    }

    logger.info(`[AUTO-MATCH] Başlatılıyor — ${allMappings.length} master kategori${dryRun ? " (önizleme)" : ""}`);

    const activePlatforms = platforms.length > 0
        ? AUTO_MATCH_PLATFORM_CONFIGS.filter((p) => platforms.includes(p.key))
        : AUTO_MATCH_PLATFORM_CONFIGS;

    const results = {};
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalNoMatch = 0;
    let totalAmbiguous = 0;

    const platformRuns = await Promise.all(
        activePlatforms.map((platform) =>
            runAutoMatchForPlatform({ userId, platform, allMappings, minScore: ms, minGap: mg, dryRun, aggressive })
        )
    );

    for (const run of platformRuns) {
        results[run.key] = run.result;
        totalUpdated += run.matched;
        totalSkipped += run.skipped;
        totalNoMatch += run.noMatch;
        totalAmbiguous += run.ambiguous;

        if (run.result.status === "completed" || run.result.status === "preview") {
            logger.info(
                `[AUTO-MATCH] ${run.key} ✅ — eşleşen: ${run.matched}, atlanan: ${run.skipped}, ` +
                `eşleşmeyen: ${run.noMatch}, belirsiz: ${run.ambiguous}`
            );
        } else {
            logger.info(`[AUTO-MATCH] ${run.key} ⏭️  — ${run.result.status}: ${run.result.reason || ""}`);
        }
    }

    logger.info(
        `[AUTO-MATCH] Tamamlandı — güncellenen: ${totalUpdated}, atlanan: ${totalSkipped}, ` +
        `eşleşmeyen: ${totalNoMatch}, belirsiz: ${totalAmbiguous}`
    );

    return {
        results,
        summary: {
            totalUpdated: dryRun ? 0 : totalUpdated,
            totalWouldUpdate: totalUpdated,
            totalSkipped,
            totalNoMatch,
            totalAmbiguous,
            minScore: ms,
            minGap: mg
        }
    };
};

exports.runAutoMatchCore = runAutoMatchCore;

exports.autoMatch = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const dryRun = req.body?.dryRun === true;
        const { results, summary } = await runAutoMatchCore({
            userId,
            platforms: req.body?.platforms || [],
            minScore: req.body?.minScore,
            minGap: req.body?.minGap,
            dryRun
        });

        return ok(res, dryRun ? "Önizleme hazır" : "Otomatik eşleştirme tamamlandı", {
            dryRun,
            results,
            summary
        });
    } catch (error) {
        logger.error("[AUTO-MATCH] Hata:", error.message);
        if (/tablosu boş/.test(error.message)) return badRequest(res, error.message);
        return serverError(res, error, "Otomatik eşleştirme başarısız");
    }
};

/**
 * Mevcut eşleştirmeleri sıfırla ve yeniden eşleştir
 * POST /api/category-center/auto-match/reset
 *
 * Body: { platforms: ["n11", "ciceksepeti", "hepsiburada"] }
 *
 * ⚠️ DİKKAT: Seçilen platformların TÜM eşleştirmelerini siler ve yeniden yapar
 */
exports.autoMatchReset = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const requestedPlatforms = req.body?.platforms || [];
        if (requestedPlatforms.length === 0) {
            return badRequest(res, "En az bir platform belirtmelisiniz: n11, ciceksepeti, hepsiburada");
        }

        const platformFieldMap = {
            n11: { idField: "n11Id", pathField: "n11Path" },
            ciceksepeti: { idField: "ciceksepetiId", pathField: "ciceksepetiPath" },
            hepsiburada: { idField: "hepsiburadaId", pathField: "hepsiburadaPath" },
            amazon: { idField: "amazonId", pathField: "amazonPath" }
        };

        // Seçilen platformların eşleştirmelerini sıfırla
        const resetOps = {};
        for (const key of requestedPlatforms) {
            const fields = platformFieldMap[key];
            if (fields) {
                resetOps[fields.idField] = null;
                resetOps[fields.pathField] = "";
            }
        }

        if (Object.keys(resetOps).length === 0) {
            return badRequest(res, "Geçersiz platform adı");
        }

        const resetResult = await MasterCategoryMapping.updateMany({}, { $set: resetOps });
        logger.info(`[AUTO-MATCH RESET] ${requestedPlatforms.join(", ")} sıfırlandı — ${resetResult.modifiedCount} satır`);

        // Şimdi auto-match'i çalıştır
        req.body.platforms = requestedPlatforms;
        return exports.autoMatch(req, res);
    } catch (error) {
        logger.error("[AUTO-MATCH RESET] Hata:", error.message);
        return serverError(res, error, "Eşleştirme sıfırlama başarısız");
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 CACHE YÖNETİMİ
// ═══════════════════════════════════════════════════════════════

/**
 * Belirli bir pazaryerinin cache'ini temizle (yeniden çekmeye zorla)
 * Bu fonksiyon route'a bağlı değil, internal kullanım için export edilir.
 */
exports.invalidateCache = async (userId, marketplaceName) => {
    try {
        const base = normalizePlatformName(marketplaceName);
        const keys = base.includes("hepsiburada") ? [base, `${base}_sit`] : [base];
        for (const cacheKey of keys) {
            await CategoryCache.deleteOne({ userId, marketplaceName: cacheKey });
            try {
                await fs.unlink(getCategoryFilePath(userId, cacheKey));
            } catch (e) {
                if (e.code !== "ENOENT") {
                    logger.warn(`[CATEGORY CACHE] Dosya silinemedi (${cacheKey}): ${e.message}`);
                }
            }
        }
        logger.info(`[CATEGORY CACHE] 🗑️ ${marketplaceName} cache temizlendi (userId: ${userId}, keys: ${keys.join(", ")})`);
    } catch (err) {
        logger.warn(`[CATEGORY CACHE] Cache temizleme hatası: ${err.message}`);
    }
};
