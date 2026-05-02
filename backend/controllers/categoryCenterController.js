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
    const id = String(cat.categoryId || cat.id || "");
    // API'den gelen paths array'i: ["Üst Kategori", "Alt Kategori", "Yaprak"]
    const apiPaths = Array.isArray(cat.paths) && cat.paths.length > 0
        ? cat.paths.map(p => decodeHtmlEntities(p))
        : null;
    return {
        id,
        categoryId: id,
        name: decodeHtmlEntities(cat.name || cat.categoryName || ""),
        displayName: decodeHtmlEntities(cat.displayName || cat.name || cat.categoryName || ""),
        parentCategoryId: cat.parentCategoryId ? String(cat.parentCategoryId) : null,
        leaf: cat.leaf === true || cat.leaf === "true",
        available: cat.available === true || cat.available === "true",
        status: cat.status || "ACTIVE",
        type: cat.type || null,           // HB, HX, HC
        apiPaths                           // API'den gelen yol bilgisi
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
        if (normalized.id) {
            catMap.set(normalized.id, normalized);
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
        if (node.parentCategoryId && catMap.has(node.parentCategoryId)) {
            const parent = catMap.get(node.parentCategoryId);
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
    const getPath = (id, visited = new Set()) => {
        if (pathCache.has(id)) return pathCache.get(id);
        if (visited.has(id)) return [];
        visited.add(id);
        const node = catMap.get(id);
        if (!node) return [];

        // v6: API'den gelen paths array'i varsa onu kullan
        if (node.apiPaths && node.apiPaths.length > 0) {
            const result = [...node.apiPaths];
            pathCache.set(id, result);
            return result;
        }

        // Fallback: parentCategoryId ile recursive hesapla
        if (!node.parentCategoryId || !catMap.has(node.parentCategoryId)) {
            const result = [node.name];
            pathCache.set(id, result);
            return result;
        }
        const result = [...getPath(node.parentCategoryId, visited), node.name];
        pathCache.set(id, result);
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
        if (node.parentCategoryId && catMap.has(node.parentCategoryId)) {
            parentIds.add(node.parentCategoryId);
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
    return response.data?.categories || [];
};

/**
 * Hepsiburada Kategori Çekme (Sayfalı + Detaylı)
 *
 * v6: HB API'de 3 farklı type var: HB (ana), HX (express), HC (global).
 *     Filtre yok çağrısı sadece HB type'ını döndürür (~6.500).
 *     HC tek başına ~48.000 kategori içerir.
 *     Bu yüzden HER ZAMAN 3 type'ı ayrı ayrı çekip birleştiriyoruz.
 *
 *     Ayrıca API'den gelen `paths` array'i (parent yol bilgisi) korunuyor.
 */
const fetchHepsiburadaCategoryTree = async (credentials, options = {}) => {
    const { normalizeCredentials, getHeaders, HB_ENDPOINTS, HB_SIT_ENDPOINTS, getEndpoints, validateCredentials } = require("../services/hepsiburadaService");
    const hbCreds = normalizeCredentials(credentials);

    const validation = validateCredentials(hbCreds, "kategori ağacı çekme");
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const { merchantId, secretKey, userAgent } = hbCreds;
    const headers = getHeaders(merchantId, secretKey, userAgent);
    const onlyLeaf = options.onlyLeaf === true;

    // Endpoint stratejisi
    const userEp = getEndpoints(hbCreds);
    const prodEp = HB_ENDPOINTS;
    const sitEp = HB_SIT_ENDPOINTS;
    const isSitUser = (userEp.MPOP === sitEp.MPOP);

    const buildBaseUrls = (ep) => {
        const urls = [`${ep.MPOP}/product/api/categories/get-all-categories`];
        if (ep.CATEGORY !== ep.MPOP) {
            urls.push(`${ep.CATEGORY}/product/api/categories/get-all-categories`);
        }
        return urls;
    };

    const allBaseUrls = isSitUser
        ? [...buildBaseUrls(sitEp), ...buildBaseUrls(prodEp)]
        : [...buildBaseUrls(prodEp), ...buildBaseUrls(sitEp)];
    const baseUrls = [...new Set(allBaseUrls)];

    logger.info(`[HB CATEGORIES] Ortam: ${isSitUser ? "SIT" : "Production"}, merchantId: ${merchantId ? merchantId.substring(0, 8) + "..." : "YOK"}, onlyLeaf=${onlyLeaf}`);

    const fetchPaginated = async (queryOpts = {}, label = "") => {
        const categories = [];
        let page = 0;
        let hasMore = true;
        const size = 2000;
        let workingBaseUrl = null;

        while (hasMore) {
            const urlsToTry = workingBaseUrl ? [workingBaseUrl] : baseUrls;
            let pageSuccess = false;

            for (const baseUrl of urlsToTry) {
                const params = new URLSearchParams({
                    status: "ACTIVE", version: "1",
                    page: String(page), size: String(size)
                });
                if (merchantId && baseUrl.includes("listing-external")) {
                    params.set("merchantId", merchantId);
                }
                if (queryOpts.leaf === true || queryOpts.leaf === "true") params.set("leaf", "true");
                else if (queryOpts.leaf === false || queryOpts.leaf === "false") params.set("leaf", "false");
                if (queryOpts.available === true || queryOpts.available === "true") params.set("available", "true");
                if (queryOpts.type) params.set("type", queryOpts.type);

                const url = `${baseUrl}?${params.toString()}`;
                try {
                    if (page === 0) logger.info(`[HB CATEGORIES${label}] Deneniyor: ${url}`);
                    const response = await axios.get(url, { headers, timeout: 45000 });
                    const data = response.data;

                    let cats = [];
                    if (Array.isArray(data)) {
                        cats = data;
                    } else if (data && typeof data === "object") {
                        const inner = data.data || data.content || data.categories;
                        if (Array.isArray(inner)) cats = inner;
                    }

                    if (cats.length > 0) {
                        categories.push(...cats);
                        workingBaseUrl = baseUrl;
                        page++;
                        pageSuccess = true;
                        if (cats.length < size) hasMore = false;
                        if (page === 1) {
                            logger.info(`[HB CATEGORIES${label}] ✅ ${cats.length} kategori bulundu`);
                        }
                        break;
                    } else {
                        if (workingBaseUrl === baseUrl) { hasMore = false; pageSuccess = true; break; }
                        logger.warn(`[HB CATEGORIES${label}] ${baseUrl} boş sonuç, sonraki deneniyor...`);
                    }
                } catch (err) {
                    const errDetail = err.response
                        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || "").substring(0, 200)}`
                        : err.message;
                    logger.warn(`[HB CATEGORIES${label}] ${baseUrl} başarısız: ${errDetail}`);
                }
            }
            if (!pageSuccess) { hasMore = false; }
        }

        if (categories.length > 0) logger.info(`[HB CATEGORIES${label}] ✅ Toplam ${categories.length} kategori`);
        return categories;
    };

    // ═══════════════════════════════════════════════════════════════
    // v6: Ana çekme stratejisi — HER ZAMAN 3 type'ı ayrı ayrı çek
    //
    // HB API Dokümantasyonu (developers.hepsiburada.com):
    //   - type parametresi olmadan sadece HB (~6.500) döndürür
    //   - HX (express ~400) ve HC (global ~48.000) ayrı type ile çekilmeli
    //   - ⚠️ leaf varsayılanı TRUE — parametre gönderilmezse sadece yaprak gelir
    //   - ⚠️ available varsayılanı TRUE — parametre gönderilmezse sadece aktif gelir
    //   - Parent kategorileri almak için leaf=false AÇIKÇA gönderilmeli
    //
    // Bu yüzden:
    //   1. Her zaman type bazlı (HB+HX+HC) çekiyoruz
    //   2. onlyLeaf=false ise: leaf=true + leaf=false ayrı ayrı çekip birleştiriyoruz
    //   3. onlyLeaf=true ise: leaf=true & available=true ile çekiyoruz
    // ═══════════════════════════════════════════════════════════════
    let allCategories = [];
    const TYPES = ["HB", "HX", "HC"];

    if (onlyLeaf) {
        // Sadece yaprak kategoriler — leaf=true (available filtresi KALDIRILDI — tüm leaf'ler gelsin)
        for (const type of TYPES) {
            try {
                const cats = await fetchPaginated({ leaf: true, type }, ` ${type}-leaf`);
                if (cats.length > 0) allCategories.push(...cats);
            } catch (e) { logger.warn(`[HB CATEGORIES] ${type} leaf hatası: ${e.message}`); }
        }
        // Hiçbir type sonuç vermediyse type'sız dene (fallback)
        if (allCategories.length === 0) {
            allCategories = await fetchPaginated({ leaf: true }, " leaf-fallback");
        }
    } else {
        // Tüm kategoriler — leaf=true + leaf=false ayrı ayrı çek
        // (API varsayılanı leaf=true olduğu için parametre göndermezsen parent gelmez!)
        // ✅ FIX: available filtresi KALDIRILDI — "kolye ucu" gibi kategoriler available=false
        //    olsa bile listeye dahil edilmeli (kategori ağacı tam görünsün)
        for (const type of TYPES) {
            try {
                // Yaprak kategoriler (leaf=true) — available filtresi YOK
                const leafCats = await fetchPaginated({ leaf: true, type }, ` ${type}-leaf`);
                if (leafCats.length > 0) allCategories.push(...leafCats);
                // Parent kategoriler (leaf=false)
                const parentCats = await fetchPaginated({ leaf: false, type }, ` ${type}-parent`);
                if (parentCats.length > 0) allCategories.push(...parentCats);
            } catch (e) { logger.warn(`[HB CATEGORIES] ${type} all hatası: ${e.message}`); }
        }
        // Hiçbir type sonuç vermediyse type'sız dene (fallback)
        if (allCategories.length === 0) {
            allCategories = await fetchPaginated({ leaf: true }, " leaf-fallback");
            const parentFallback = await fetchPaginated({ leaf: false }, " parent-fallback");
            if (parentFallback.length > 0) allCategories.push(...parentFallback);
        }
    }

    // Duplikasyon temizliği
    const seenIds = new Set();
    const uniqueCategories = [];
    for (const cat of allCategories) {
        const id = String(cat.categoryId || cat.id || "");
        if (id && !seenIds.has(id)) {
            seenIds.add(id);
            uniqueCategories.push(cat);
        }
    }

    logger.info(`[HB CATEGORIES] Toplam ${uniqueCategories.length} benzersiz kategori (ham: ${allCategories.length}, types: ${TYPES.join("+")})`);
    if (uniqueCategories.length === 0) {
        throw new Error("Hepsiburada kategori API'sinden veri alınamadı. Lütfen entegrasyon bilgilerinizi kontrol edin.");
    }
    return uniqueCategories;
};

const fetchAmazonCategoryTree = async () => {
    // Amazon SP-API henüz desteklenmiyor
    return [];
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
    const cacheKey = normalizePlatformName(mpName);

    // ── 1. Cache'e bak (dosya → Mongo; büyük listeler sadece dosyada) ──
    if (!forceRefresh) {
        try {
            const fromFile = await readCategoryFileCache(userId, cacheKey);
            if (fromFile) {
                const ageMs = Date.now() - new Date(fromFile.cachedAt).getTime();
                logger.info(
                    `[CATEGORY CACHE] ✅ ${mpName} — dosya cache'den okundu (${fromFile.categories.length} kategori, yaş: ${Math.round(ageMs / 60000)}dk)`
                );
                return fromFile.categories;
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
                    logger.info(`[CATEGORY CACHE] ✅ ${mpName} — cache'den okundu (${cached.categories.length} kategori, yaş: ${Math.round(ageMs / 60000)}dk)`);
                    return cached.categories;
                }
                logger.info(`[CATEGORY CACHE] ⏰ ${mpName} — cache süresi dolmuş (${Math.round(ageMs / 3600000)}sa), yenileniyor...`);
            }
        } catch (err) {
            logger.warn(`[CATEGORY CACHE] Cache okuma hatası: ${err.message}`);
        }
    }

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
    } else {
        throw new Error(`${mpName} için kategori çekme desteklenmiyor`);
    }

    // ── 3. HTML entity decode uygula ──
    categories = categories.map(cat => decodeObjectStrings(cat));

    // ── 4. Cache'e yaz (büyük listeler Mongo BSON sınırını aşar → disk) ──
    if (categories.length > 0) {
        const fileOnly = shouldUseFileOnlyCategoryCache(categories);
        if (fileOnly) {
            try {
                await writeCategoryFileCache(userId, cacheKey, categories);
                logger.info(
                    `[CATEGORY CACHE] 💾 ${mpName} — ${categories.length} kategori dosyaya cache'lendi (Mongo atlandı: boyut, TTL: ${CACHE_TTL_HOURS}sa)`
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
                logger.info(`[CATEGORY CACHE] 💾 ${mpName} — ${categories.length} kategori cache'lendi (TTL: ${CACHE_TTL_HOURS}sa)`);
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
    const catMap = buildCategoryMap(categories);
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

        const targetSpec = mapTargetPlatformToMappingFields(targetPlatform);
        if (!targetSpec) {
            return badRequest(res, "Desteklenmeyen hedef platform");
        }

        const product = await ProductMapping.findOne({ _id: productId, userId }).lean();
        if (!product) return notFound(res, "Ürün bulunamadı");

        let row = null;
        let matchedBy = null;

        const tyMap = (product.marketplaceMappings || []).find((m) => {
            const n = normalizePlatformName(m.marketplaceName || "");
            return n.includes("trendyol");
        });
        if (tyMap && tyMap.categoryId != null && String(tyMap.categoryId).trim() !== "") {
            const tid = parseInt(String(tyMap.categoryId).replace(/[^\d]/g, ""), 10);
            if (!Number.isNaN(tid)) {
                row = await MasterCategoryMapping.findOne({ trendyolId: tid }).lean();
                if (row) matchedBy = "trendyol_listing_category";
            }
        }

        const catHint = product.masterProduct && product.masterProduct.category
            ? String(product.masterProduct.category).trim()
            : "";
        if (!row && catHint.length >= 2) {
            const parts = catHint.split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean);
            const leafHint = parts.length ? parts[parts.length - 1] : catHint;
            const q = leafHint.length >= 2 ? leafHint : catHint;
            const regex = buildMappingSearchRegex(q);
            row = await MasterCategoryMapping.findOne({
                $or: [
                    { masterPath: regex },
                    { masterName: regex },
                    { trendyolPath: regex }
                ]
            })
                .sort({ masterPath: 1 })
                .lean();
            if (row) matchedBy = "master_product_category_text";
        }

        if (!row) {
            return ok(res, "Kategori merkezinde eşleşme bulunamadı", {
                resolved: false,
                matchedBy: null,
                master: null,
                hint: catHint || null,
                platformCategory: null
            });
        }

        const idVal = row[targetSpec.idKey];
        const pathVal = row[targetSpec.pathKey] || "";
        const platformCategory = {
            platform: targetSpec.label,
            categoryId: idVal != null && idVal !== "" ? String(idVal) : null,
            categoryPath: decodeHtmlEntities(String(pathVal || "")),
            isComplete: idVal != null && idVal !== ""
        };

        return ok(res, "Kategori merkezi eşlemesi hazır", {
            resolved: true,
            matchedBy,
            master: {
                masterId: row.masterId,
                masterName: decodeHtmlEntities(row.masterName),
                masterPath: decodeHtmlEntities(row.masterPath)
            },
            platformCategory
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
            const markAncestors = (id) => {
                if (matchedIds.has(id)) return;
                matchedIds.add(id);
                const node = catMap.get(id);
                if (node?.parentCategoryId && catMap.has(node.parentCategoryId)) {
                    markAncestors(node.parentCategoryId);
                }
            };
            for (const [id, node] of catMap) {
                if (matchesAllWords(node.name || "", q) ||
                    matchesAllWords(node.displayName || "", q)) {
                    markAncestors(id);
                }
            }
            const filterTree = (nodes) => {
                return nodes
                    .filter(n => matchedIds.has(n.categoryId || n.id))
                    .map(n => ({ ...n, children: filterTree(n.children || []) }));
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
        for (const [id, node] of catMap) {
            const pathArr = getPath(id);
            const pathStr = pathArr.join(" > ");
            rows.push({
                categoryId: id,
                name: node.name,
                path: pathStr,
                depth: pathArr.length,
                parentCategoryId: node.parentCategoryId || "",
                leaf: node.leaf,
                available: node.available,
                status: node.status
            });
        }

        if (q.length >= 2) {
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.path.toLowerCase().includes(q)
            );
        }

        rows.sort((a, b) => a.path.localeCompare(b.path, "tr"));

        const excelRows = rows.map((r, idx) => ({
            "#": idx + 1,
            "Kategori ID": r.categoryId,
            "Kategori Adı": r.name,
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
            { wch: 6 }, { wch: 14 }, { wch: 35 }, { wch: 70 },
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

            for (const [id, node] of catMap) {
                const pathArr = getPath(id);
                const pathStr = pathArr.join(" > ");
                const name = node.name || "";

                // ✅ Gelişmiş arama: Türkçe normalize + kelime bazlı
                const nameMatch = matchesAllWords(name, query);
                const pathMatch = matchesAllWords(pathStr, query);

                if (nameMatch || pathMatch) {
                    // HB Dokümantasyon: Ürün açılabilecek kategoriler = leaf:true + available:true + status:ACTIVE
                    const canListProduct = node.leaf && node.available && (node.status === "ACTIVE");
                    searchResults.push({
                        id: node.id,
                        name: node.name,
                        path: pathStr,
                        leaf: node.leaf,
                        available: node.available,
                        type: node.type || null,       // HB, HX, HC
                        canListProduct,                 // Ürün açılabilir mi?
                        hasChildren: parentIds.has(id)
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
 *   target4: "Motosiklet > Aksesuar"          → 0 (son segment farklı)
 */
const segmentSimilarityScore = (masterPath, targetPath) => {
    if (!masterPath || !targetPath) return 0;

    const normalize = (p) => normalizeTurkish(
        decodeHtmlEntities(p).replace(/\s*>\s*/g, ">").replace(/\s+/g, " ").trim()
    );

    const mp = normalize(masterPath);
    const tp = normalize(targetPath);

    // Tam eşleşme
    if (mp === tp) return 1000;

    const mParts = mp.split(">").map(s => s.trim()).filter(Boolean);
    const tParts = tp.split(">").map(s => s.trim()).filter(Boolean);

    if (mParts.length === 0 || tParts.length === 0) return 0;

    let score = 0;

    // Son segment (yaprak isim) eşleşmesi — EN ÖNEMLİ
    const mLast = mParts[mParts.length - 1];
    const tLast = tParts[tParts.length - 1];

    if (mLast === tLast) {
        score += 50;
    } else if (mLast.includes(tLast) || tLast.includes(mLast)) {
        score += 25;
    } else {
        // Son segment hiç eşleşmiyorsa bu eşleşme geçersiz
        return 0;
    }

    // Üst segmentleri karşılaştır (sondan başa)
    const minLen = Math.min(mParts.length, tParts.length);
    for (let i = 2; i <= minLen; i++) {
        const mSeg = mParts[mParts.length - i];
        const tSeg = tParts[tParts.length - i];
        if (mSeg === tSeg) {
            score += 20;
        } else if (mSeg && tSeg && (mSeg.includes(tSeg) || tSeg.includes(mSeg))) {
            score += 5;
        }
    }

    // Segment sayısı benzerliği
    const depthDiff = Math.abs(mParts.length - tParts.length);
    if (depthDiff === 0) score += 5;
    else if (depthDiff === 1) score += 2;

    return score;
};

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
        const MIN_SCORE = 50;

        // ── 1. Tüm master eşleştirmeleri çek ──
        const allMappings = await MasterCategoryMapping.find({}).lean();
        if (allMappings.length === 0) {
            return badRequest(res, "Master eşleştirme tablosu boş. Önce Excel import yapın.");
        }

        logger.info(`[AUTO-MATCH PREPARE] Başlatılıyor — ${allMappings.length} master kategori`);

        // ── 2. Platform konfigürasyonu ──
        const platformConfigs = [
            {
                key: "n11", name: "N11",
                idField: "n11Id", pathField: "n11Path",
                isFlat: false
            },
            {
                key: "ciceksepeti", name: "ÇiçekSepeti",
                idField: "ciceksepetiId", pathField: "ciceksepetiPath",
                isFlat: false
            },
            {
                key: "hepsiburada", name: "Hepsiburada",
                idField: "hepsiburadaId", pathField: "hepsiburadaPath",
                isFlat: true
            }
        ];

        const activePlatforms = requestedPlatforms.length > 0
            ? platformConfigs.filter(p => requestedPlatforms.includes(p.key))
            : platformConfigs;

        const allSuggestions = [];

        for (const platform of activePlatforms) {
            logger.info(`[AUTO-MATCH PREPARE] ${platform.name} işleniyor...`);

            // ── 3. Marketplace bul ──
            const marketplace = await Marketplace.findOne({
                userId,
                marketplaceName: { $regex: new RegExp(platform.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
            });

            if (!marketplace) {
                logger.warn(`[AUTO-MATCH PREPARE] ${platform.name} — entegrasyon bulunamadı, atlanıyor`);
                continue;
            }

            // ── 4. Canlı kategorileri çek ──
            let categories;
            try {
                categories = await getOrFetchCategories(userId, marketplace, { onlyLeaf: false });
            } catch (fetchErr) {
                logger.error(`[AUTO-MATCH PREPARE] ${platform.name} — kategori çekme hatası: ${fetchErr.message}`);
                continue;
            }

            if (!categories || categories.length === 0) continue;

            // ── 5. Flat listeye dönüştür ──
            const flatCategories = flattenCategoriesWithPath(categories, platform.isFlat);
            logger.info(`[AUTO-MATCH PREPARE] ${platform.name} — ${flatCategories.length} kategori (flat)`);

            // ── 6. Her boş eşleştirme için öneri bul ──
            for (const mapping of allMappings) {
                // Zaten eşleştirilmiş mi?
                if (mapping[platform.idField]) continue;

                const masterPath = mapping.masterPath || mapping.trendyolPath || "";
                if (!masterPath) continue;

                // En iyi 5 eşleşmeyi bul
                const scored = flatCategories.map(target => ({
                    ...target,
                    score: segmentSimilarityScore(masterPath, target.path)
                })).filter(s => s.score >= MIN_SCORE)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 5);

                if (scored.length > 0) {
                    allSuggestions.push({
                        mappingId: mapping._id,
                        masterId: mapping.masterId,
                        masterName: mapping.masterName,
                        masterPath: mapping.masterPath,
                        platform: platform.key,
                        platformLabel: platform.label || platform.name,
                        idField: platform.idField,
                        pathField: platform.pathField,
                        suggestion: scored[0], // En iyi eşleşme
                        alternatives: scored.slice(1) // Alternatifler
                    });
                }
            }
        }

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
exports.autoMatch = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const requestedPlatforms = req.body?.platforms || [];
        const MIN_SCORE = 50; // Minimum benzerlik skoru

        // ── 1. Tüm master eşleştirmeleri çek ──
        const allMappings = await MasterCategoryMapping.find({}).lean();
        if (allMappings.length === 0) {
            return badRequest(res, "Master eşleştirme tablosu boş. Önce Excel import yapın.");
        }

        logger.info(`[AUTO-MATCH] Başlatılıyor — ${allMappings.length} master kategori`);

        // ── 2. Platform konfigürasyonu ──
        const platformConfigs = [
            {
                key: "n11", name: "N11",
                idField: "n11Id", pathField: "n11Path",
                isFlat: false
            },
            {
                key: "ciceksepeti", name: "ÇiçekSepeti",
                idField: "ciceksepetiId", pathField: "ciceksepetiPath",
                isFlat: false
            },
            {
                key: "hepsiburada", name: "Hepsiburada",
                idField: "hepsiburadaId", pathField: "hepsiburadaPath",
                isFlat: true
            }
        ];

        // Filtreleme: sadece istenen platformlar
        const activePlatforms = requestedPlatforms.length > 0
            ? platformConfigs.filter(p => requestedPlatforms.includes(p.key))
            : platformConfigs;

        const results = {};
        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalNoMatch = 0;

        for (const platform of activePlatforms) {
            logger.info(`[AUTO-MATCH] ${platform.name} işleniyor...`);

            // ── 3. Marketplace bul ──
            const marketplace = await Marketplace.findOne({
                userId,
                marketplaceName: { $regex: new RegExp(platform.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
            });

            if (!marketplace) {
                results[platform.key] = { status: "skipped", reason: "Entegrasyon bulunamadı" };
                logger.warn(`[AUTO-MATCH] ${platform.name} — entegrasyon bulunamadı, atlanıyor`);
                continue;
            }

            // ── 4. Canlı kategorileri çek (cache'den) ──
            let categories;
            try {
                categories = await getOrFetchCategories(userId, marketplace, { onlyLeaf: false });
            } catch (fetchErr) {
                results[platform.key] = { status: "error", reason: fetchErr.message };
                logger.error(`[AUTO-MATCH] ${platform.name} — kategori çekme hatası: ${fetchErr.message}`);
                continue;
            }

            if (!categories || categories.length === 0) {
                results[platform.key] = { status: "skipped", reason: "Kategori listesi boş" };
                continue;
            }

            // ── 5. Flat listeye dönüştür ──
            const flatCategories = flattenCategoriesWithPath(categories, platform.isFlat);
            logger.info(`[AUTO-MATCH] ${platform.name} — ${flatCategories.length} kategori (flat)`);

            // ── 6. Her master kategori için en iyi eşleşmeyi bul ──
            let matched = 0;
            let skipped = 0;
            let noMatch = 0;
            const bulkOps = [];

            for (const mapping of allMappings) {
                // Zaten eşleştirilmiş mi?
                if (mapping[platform.idField]) {
                    skipped++;
                    continue;
                }

                const masterPath = mapping.masterPath || mapping.trendyolPath || "";
                if (!masterPath) {
                    noMatch++;
                    continue;
                }

                // En iyi eşleşmeyi bul
                let bestScore = 0;
                let bestMatch = null;

                for (const target of flatCategories) {
                    const score = segmentSimilarityScore(masterPath, target.path);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = target;
                    }
                }

                if (bestMatch && bestScore >= MIN_SCORE) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: mapping._id },
                            update: {
                                $set: {
                                    [platform.idField]: Number(bestMatch.id) || bestMatch.id,
                                    [platform.pathField]: bestMatch.path
                                }
                            }
                        }
                    });
                    matched++;
                } else {
                    noMatch++;
                }
            }

            // ── 7. Toplu güncelleme ──
            if (bulkOps.length > 0) {
                await MasterCategoryMapping.bulkWrite(bulkOps);
            }

            results[platform.key] = {
                status: "completed",
                totalCategories: flatCategories.length,
                matched,
                skipped,
                noMatch,
                minScore: MIN_SCORE
            };

            totalUpdated += matched;
            totalSkipped += skipped;
            totalNoMatch += noMatch;

            logger.info(`[AUTO-MATCH] ${platform.name} ✅ — eşleşen: ${matched}, atlanan: ${skipped}, eşleşmeyen: ${noMatch}`);
        }

        logger.info(`[AUTO-MATCH] Tamamlandı — toplam güncellenen: ${totalUpdated}, atlanan: ${totalSkipped}, eşleşmeyen: ${totalNoMatch}`);

        return ok(res, "Otomatik eşleştirme tamamlandı", {
            results,
            summary: {
                totalUpdated,
                totalSkipped,
                totalNoMatch,
                minScore: MIN_SCORE
            }
        });
    } catch (error) {
        logger.error("[AUTO-MATCH] Hata:", error.message);
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
        const cacheKey = normalizePlatformName(marketplaceName);
        await CategoryCache.deleteOne({ userId, marketplaceName: cacheKey });
        logger.info(`[CATEGORY CACHE] 🗑️ ${marketplaceName} cache temizlendi (userId: ${userId})`);
    } catch (err) {
        logger.warn(`[CATEGORY CACHE] Cache temizleme hatası: ${err.message}`);
    }
};
