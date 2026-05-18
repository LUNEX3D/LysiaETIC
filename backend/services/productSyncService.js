const axios = require("axios");
const ProductMapping         = require("../models/ProductMapping");
const StockSyncLog           = require("../models/StockSyncLog");
const Marketplace            = require("../models/Marketplace");
const PendingDeletion        = require("../models/PendingDeletion");
const User                   = require("../models/User");
const logger                 = require("../config/logger");
const n11Service             = require("./n11Service");
const masterProductAdapter   = require("./masterProductAdapter");
// ✅ FIX: Credential'ları decrypt ederek kullan
const { decryptCredentials } = require("../utils/encryption");
const { resolveProductBrandName, isPlaceholderBrand } = require("../utils/resolveProductBrandName");
const { prepareCrossListingProduct } = require("../utils/crossListingCanonicalProduct");
const {
    applyFieldDriftToMarketplaceMapping,
    alignPlatformSnapshotFromMaster
} = require("../utils/productFieldCompare");

/** Kritik alan farkını Stok Defteri'ne yaz */
const logFieldDriftToStockSyncLog = async (userId, mapping, marketplaceName, driftResult) => {
    if (!driftResult?.hasCritical || !mapping?._id) return;
    try {
        const critical = (driftResult.drifts || []).filter((d) => d.severity === "critical");
        await StockSyncLog.create({
            userId,
            actionType: "product_field_drift",
            product: {
                productMappingId: mapping._id,
                barcode: mapping.masterProduct?.barcode,
                sku: mapping.masterProduct?.sku,
                name: mapping.masterProduct?.name
            },
            marketplace: { name: marketplaceName },
            status: "error",
            error: {
                message: critical.map((d) => `${d.label}: master="${d.masterValue}" platform="${d.platformValue}"`).join("; "),
                code: "FIELD_DRIFT_CRITICAL"
            },
            notification: { priority: "critical" }
        });
    } catch (e) {
        logger.warn(`[FIELD DRIFT] Log yazılamadı: ${e.message}`);
    }
};

/** Trendyol GET /integration/product/brands — markaId → görünen ad (çekme başına önbellek) */
let _tyBrandLookupCache = { key: "", map: /** @type {Map<number, string>|null} */ (null), at: 0 };
const TY_BRAND_MAP_TTL_MS = 6 * 60 * 60 * 1000;
const TY_BRAND_MAP_MAX_PAGES = Math.min(30, Math.max(1, parseInt(process.env.TRENDYOL_BRAND_CACHE_PAGES || "12", 10) || 12));

const fetchTrendyolBrandIdLookupMap = async (credentials, sellerId) => {
    const { apiKey, apiSecret } = credentials || {};
    const sid = sellerId || credentials?.supplierId;
    if (!apiKey || !apiSecret || !sid) return new Map();
    const cacheKey = `${String(apiKey).slice(0, 16)}:${sid}`;
    const now = Date.now();
    if (_tyBrandLookupCache.map && _tyBrandLookupCache.key === cacheKey && now - _tyBrandLookupCache.at < TY_BRAND_MAP_TTL_MS) {
        return _tyBrandLookupCache.map;
    }
    const map = new Map();
    try {
        const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
        let page = 0;
        while (page < TY_BRAND_MAP_MAX_PAGES) {
            const response = await axios.get("https://apigw.trendyol.com/integration/product/brands", {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "User-Agent": `${sid} - LysiaETIC`,
                    "Content-Type": "application/json"
                },
                params: { page, size: 1000 },
                timeout: 25000
            });
            const list = response.data?.brands || response.data?.content || response.data || [];
            const arr = Array.isArray(list) ? list : [];
            for (const b of arr) {
                const id = Number(b?.id);
                const name = String(b?.name ?? "").trim();
                if (Number.isFinite(id) && id > 0 && id !== 7651 && name) map.set(id, name);
            }
            if (arr.length < 1000) break;
            page++;
        }
        logger.info(`[TRENDYOL BRANDS] Marka sözlüğü: ${map.size} kayıt (sayfa 0–${page})`);
    } catch (e) {
        logger.warn(`[TRENDYOL BRANDS] Marka sözlüğü alınamadı: ${e.message}`);
    }
    _tyBrandLookupCache = { key: cacheKey, map, at: now };
    return map;
};

/**
 * Kullanıcının ürün eşleştirme öncelik sırasını getir
 * @param {ObjectId} userId
 * @returns {Object} { primary: "sku"|"barcode"|"name", secondary: ..., tertiary: ... }
 */
const getUserMatchPriority = async (userId) => {
    try {
        const user = await User.findById(userId).select("preferences.productMatchPriority").lean();
        const p = user?.preferences?.productMatchPriority;
        if (p?.primary && p?.secondary && p?.tertiary) return p;
    } catch (e) {
        logger.warn(`[SYNC] Kullanıcı eşleştirme önceliği okunamadı: ${e.message}`);
    }
    return { primary: "sku", secondary: "barcode", tertiary: "name" };
};

/** Barkod/SKU için NFC + trim — Türkçe karakterli SKU’larda (ör. OÇ) çift kayıt / eşleşme hatalarını azaltır */
const normalizeSyncLookupKey = (v) => {
    if (v == null) return "";
    return String(v).trim().normalize("NFC");
};

/** Mongoose ValidationError bazen boş message ile gelir — logda gerçek alan hatasını göster */
const formatProductSyncSaveError = (error) => {
    const m = String(error?.message || "").trim();
    if (m) return m;
    if (error?.name === "ValidationError" && error.errors) {
        try {
            return Object.entries(error.errors)
                .map(([path, e]) => `${path}: ${e?.message || e}`)
                .join("; ");
        } catch (_) {
            return "ValidationError";
        }
    }
    return error?.toString?.() || "Bilinmeyen hata";
};

const buildMarketplacePullPayload = (product, normalizedMarketplaceName) => {
    const crRaw = product.commissionRate;
    const crNum =
        crRaw !== undefined && crRaw !== null && crRaw !== "" ? Number(crRaw) : NaN;
    const catIdRaw = product.categoryId != null ? String(product.categoryId).trim() : "";
    return {
        marketplaceName: normalizedMarketplaceName,
        marketplaceProductId: product.marketplaceProductId || "",
        marketplaceSku: product.sku || "",
        marketplaceBarcode: product.barcode || "",
        price: product.price || 0,
        listPrice: product.listPrice || product.price || 0,
        stock: product.stock || 0,
        categoryName: product.category || "",
        ...(catIdRaw !== "" ? { categoryId: catIdRaw } : {}),
        ...(Number.isFinite(crNum) && crNum >= 0 ? { commissionRate: crNum } : {}),
        pulledFromMarketplace: true,
        pullDate: new Date(),
        lastSyncDate: new Date(),
        // ⚠️ Pull = pazaryeri anlık görüntüsü; master stok değişmez.
        // isSynced/syncStatus burada SET EDİLMEZ — yoksa stok 0 master + TY'de stok>0 iken UI "satışta" sanılır.
    };
};

/**
 * Öncelik sırasına göre ürün eşleştirme yap
 * @param {Object} product - { sku, barcode, name, marketplaceProductId }
 * @param {Object} maps - { mappingBySku, mappingByBarcode, mappingByName, mappingByMpId }
 * @param {Object} priority - { primary, secondary, tertiary }
 * @returns {Object|null} - Eşleşen ProductMapping veya null
 */
const matchProductByPriority = (product, maps, priority) => {
    const fieldMap = {
        sku:     (p) => [
            p.sku ? maps.mappingBySku.get(p.sku) : null,
            p.sku ? maps.mappingByBarcode.get(p.sku) : null   // cross-match
        ],
        barcode: (p) => [
            p.barcode ? maps.mappingByBarcode.get(p.barcode) : null,
            p.barcode ? maps.mappingBySku.get(p.barcode) : null  // cross-match
        ],
        name:    (p) => [
            p.name ? maps.mappingByName.get(p.name.trim().toLowerCase()) : null
        ]
    };

    // Öncelik sırasına göre dene
    for (const level of [priority.primary, priority.secondary, priority.tertiary]) {
        const lookups = fieldMap[level]?.(product) || [];
        for (const result of lookups) {
            if (result) return result;
        }
    }

    // Son çare: MarketplaceProductId
    if (product.marketplaceProductId) {
        return maps.mappingByMpId.get(product.marketplaceProductId) || null;
    }

    return null;
};

/**
 * ÜRÜN SENKRONİZASYON SERVİSİ
 *
 * Ürünleri pazaryerlerinden çeker, eşleştirir ve senkronize eder
 */

// Pazaryeri isimlerini normalize et (büyük/küçük harf, boşluk farkı)
const normalizeMarketplaceName = (name) => {
    if (!name) return "";
    const n = name.trim().toLowerCase();
    if (n === "trendyol")                          return "Trendyol";
    if (n === "hepsiburada")                       return "Hepsiburada";
    if (n === "n11")                               return "N11";
    if (n === "amazon" || n === "amazon türkiye" || n === "amazon europe" || n === "amazon usa") return "Amazon";
    if (n === "çiçeksepeti" || n === "ciceksepeti") return "ÇiçekSepeti";
    return name.trim();
};

// Pazaryerinden ürünleri çek
const fetchProductsFromMarketplace = async (marketplace) => {
    const rawName = marketplace.marketplaceName;
    const marketplaceName = normalizeMarketplaceName(rawName);
    // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
    const credentials = decryptCredentials(marketplace.credentials);

    if (!credentials || Object.keys(credentials).length === 0) {
        throw new Error(`${marketplaceName} için API bilgileri (credentials) tanımlı değil. Lütfen entegrasyon ayarlarını kontrol edin.`);
    }

    try {
        switch (marketplaceName) {
            case "Trendyol":
                return await fetchTrendyolProducts(credentials);
            case "Hepsiburada":
                return await fetchHepsiburadaProducts(credentials);
            case "N11":
                return await fetchN11Products(credentials);
            case "ÇiçekSepeti":
                return await fetchCicekSepetiProducts(credentials);
            default:
                throw new Error(`Desteklenmeyen pazaryeri: ${marketplaceName}. Desteklenen pazaryerleri: Trendyol, Hepsiburada, N11, ÇiçekSepeti`);
        }
    } catch (error) {
        const statusCode = error.response?.status;
        let userMessage = `${marketplaceName} ürün çekme hatası: `;

        if (statusCode === 401 || statusCode === 403) {
            userMessage += "API bilgileri geçersiz veya yetkisiz erişim. Lütfen API Key/Secret bilgilerinizi kontrol edin.";
        } else if (statusCode === 404) {
            userMessage += "Mağaza bulunamadı. Satıcı ID bilginizi kontrol edin.";
        } else if (statusCode === 429) {
            userMessage += "Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.";
        } else if (statusCode >= 500) {
            userMessage += `${marketplaceName} sunucusunda geçici bir sorun var. Lütfen daha sonra tekrar deneyin.`;
        } else if (error.code === "ECONNABORTED") {
            userMessage += "Bağlantı zaman aşımına uğradı. İnternet bağlantınızı kontrol edin.";
        } else {
            userMessage += error.message || "Bilinmeyen hata";
        }

        logger.error(`[${marketplaceName}] Ürün çekme hatası:`, {
            status: statusCode,
            message: error.message,
            responseData: error.response?.data
        });

        const enrichedError = new Error(userMessage);
        enrichedError.originalError = error;
        enrichedError.statusCode = statusCode;
        throw enrichedError;
    }
};

// Trendyol ürünlerini çek — masterProductAdapter.fromTrendyol() ile normalize edilir
const fetchTrendyolProducts = async (credentials) => {
    const { apiKey, apiSecret, supplierId, sellerId } = credentials;

    const actualSellerId = sellerId || supplierId;

    if (!apiKey || !apiSecret || !actualSellerId) {
        throw new Error("Trendyol credentials eksik: apiKey, apiSecret ve sellerId gerekli");
    }

    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const products = [];
    let page = 0;
    let hasMore = true;

    const tyBrandIdMap = await fetchTrendyolBrandIdLookupMap(credentials, actualSellerId);

    while (hasMore) {
        try {
            const response = await axios.get(
                `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/products`,
                {
                    headers: {
                        Authorization: `Basic ${authHeader}`,
                        "User-Agent": `${actualSellerId} - LysiaETIC`,
                        "Content-Type": "application/json"
                    },
                    params: { page, size: 200, approved: true },
                    timeout: 20000
                }
            );

            const content = response.data?.content || [];
            if (content.length === 0) {
                hasMore = false;
            } else {
                // masterProductAdapter.fromTrendyol() ile normalize et
                // Bu sayede tüm fiyat/görsel/attribute normalizasyonu tek yerde yapılır
                products.push(...content.map(p => {
                    const master = masterProductAdapter.fromTrendyol(p, tyBrandIdMap);
                    // syncProductsFromMarketplace'in beklediği alanlara map et
                    return {
                        marketplaceProductId: master.marketplaceProductId,
                        barcode:    master.barcode,
                        sku:        master.sku,
                        name:       master.title,
                        description: master.description,
                        price:      master.price,
                        listPrice:  master.listPrice,
                        stock:      master.stock,
                        category:   master.category,
                        categoryId: master.categoryId != null && `${master.categoryId}`.trim() !== ""
                            ? String(master.categoryId).trim()
                            : "",
                        brand:      master.brand,
                        images:     master.images,
                        attributes: master.attributes,
                        ...(master.garantiSuresi != null ? { garantiSuresi: master.garantiSuresi } : {}),
                        ...(master.vatRate != null ? { vatRate: master.vatRate } : {})
                    };
                }));
                page++;
            }
        } catch (error) {
            logger.error("Trendyol ürün çekme hatası:", error.response?.data || error.message);
            hasMore = false;
            if (page === 0 && products.length === 0) throw error;
        }
    }

    return products;
};

// Hepsiburada ürünlerini çek
const fetchHepsiburadaProducts = async (credentials) => {
    const {
        normalizeCredentials,
        getHeaders,
        getEndpoints,
        validateCredentials,
        buildHepsiburadaCategoryNameMap,
        isHepsiburadaListingUnavailableError,
        buildHepsiburadaSyncProductsFromMpopMap
    } = require("./hepsiburadaService");
    const hbCreds = normalizeCredentials(credentials);
    const { merchantId, secretKey, userAgent } = hbCreds;

    // Credential doğrulama
    const validation = validateCredentials(hbCreds, "ürün çekme");
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const ep = getEndpoints(hbCreds);
    const hbHeaders = getHeaders(merchantId, secretKey, userAgent);
    logger.info(
        `[Hepsiburada] Ürün çekme başlatılıyor — merchantId: ${merchantId.substring(0, 8)}...`
    );

    // ── Adım 0: Kategori API — HB+HX+HC (type birleşik), Kategori Merkezi ile aynı kaynak
    let categoryMap = new Map();
    try {
        categoryMap = await buildHepsiburadaCategoryNameMap(merchantId, secretKey, userAgent, {
            onlyLeaf: true,
            useSit: hbCreds.useSit
        });
        logger.info(`[Hepsiburada CAT] ${categoryMap.size} kategori çekildi`);
    } catch (catErr) {
        logger.warn(`[Hepsiburada CAT] Kategori çekme hatası: ${catErr.message}`);
    }

    // ── Adım 1: MPOP API'den toplu ürün detaylarını çek ──
    const mpopDetailMap = new Map();
    for (const status of ["CREATED", "MATCHED", "WAITING", "IN_EXTERNAL_PROGRESS", "PRE_MATCHED"]) {
        try {
            let page = 0;
            let hasMorePages = true;
            while (hasMorePages) {
                const mpopUrl = `${ep.MPOP}/product/api/products/products-by-merchant-and-status` +
                    `?merchantId=${merchantId}&productStatus=${status}&version=1&page=${page}&size=1000`;
                const mpopResp = await axios.get(mpopUrl, { headers: hbHeaders, timeout: 20000 });
                const mpopData = mpopResp.data;
                const items = Array.isArray(mpopData) ? mpopData : (mpopData?.data || mpopData?.products || mpopData?.content || []);
                for (const item of items) {
                    if (item.merchantSku) mpopDetailMap.set(item.merchantSku, item);
                    if (item.hepsiburadaSku) mpopDetailMap.set(item.hepsiburadaSku, item);
                }
                hasMorePages = items.length >= 1000;
                page++;
            }
        } catch (mpopErr) {
            logger.warn(`[Hepsiburada MPOP] status=${status} hatası: ${mpopErr.message}`);
        }
    }
    logger.info(`[Hepsiburada MPOP] Toplu detay: ${mpopDetailMap.size} ürün detayı çekildi`);

    // ── Adım 2: Listing API'den fiyat/stok çek ve MPOP detaylarıyla birleştir ──
    const products = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await axios.get(
                `${ep.LISTING}/listings/merchantid/${merchantId}`,
                {
                    headers: hbHeaders,
                    params: { offset, limit },
                    timeout: 15000
                }
            );

            const items = response.data?.listings || [];
            if (items.length === 0) {
                hasMore = false;
            } else {
                products.push(...items.map(p => {
                    const detail = mpopDetailMap.get(p.merchantSku) || mpopDetailMap.get(p.hepsiburadaSku) || null;
                    const matched = detail?.matchedHbProductInfo?.[0] || {};
                    const rawImg = matched?.images?.[0] || detail?.defaultImageUrl || "";
                    const imgUrl = rawImg ? rawImg.replace("{size}", "550") : "";
                    const rawCatId = detail?.categoryId || matched?.categoryId || "";
                    const catName = (rawCatId ? categoryMap.get(String(rawCatId)) : "") || detail?.categoryName || matched?.categoryName || "";
                    return {
                        marketplaceProductId: p.hepsiburadaSku,
                        barcode: p.merchantSku,
                        sku: p.merchantSku,
                        name: detail?.productName || matched?.productName || p.merchantSku || "",
                        price: p.price,
                        listPrice: p.listPrice || p.price,
                        stock: p.availableStock,
                        category: catName,
                        categoryId: rawCatId != null && String(rawCatId).trim() !== "" ? String(rawCatId).trim() : "",
                        brand: matched?.brand || detail?.brand || "",
                        images: imgUrl ? [imgUrl] : [],
                        attributes: {}
                    };
                }));
                offset += limit;
            }
        } catch (error) {
            logger.error("Hepsiburada ürün çekme hatası:", error.response?.data || error.message);
            if (
                offset === 0 &&
                products.length === 0 &&
                mpopDetailMap.size > 0 &&
                isHepsiburadaListingUnavailableError(error)
            ) {
                logger.warn(
                    `[Hepsiburada] Listing API hata/404 — MPOP’tan ${mpopDetailMap.size} kayıt ile senkron ` +
                    `(fiyat/stok listing açılınca güncellenir).`
                );
                return buildHepsiburadaSyncProductsFromMpopMap(mpopDetailMap, categoryMap);
            }
            hasMore = false;
            if (offset === 0 && products.length === 0) {
                throw error;
            }
        }
    }

    if (products.length === 0 && mpopDetailMap.size > 0) {
        logger.warn(
            `[Hepsiburada] Listing’de satır yok — MPOP’tan ${mpopDetailMap.size} kayıt ile senkron ` +
            `(ürünler henüz satışa açılmamış olabilir).`
        );
        return buildHepsiburadaSyncProductsFromMpopMap(mpopDetailMap, categoryMap);
    }

    return products;
};

// N11 ürünlerini çek — yeni REST API servisi kullanılıyor
// N11 resmi API: GET https://api.n11.com/ms/product-query?page=0&size=250
// Yanıt: { content: [...], totalElements, totalPages, number, size, numberOfElements, empty, last }
const fetchN11Products = async (credentials) => {
    const { apiKey, secretKey } = credentials;

    if (!apiKey || !secretKey) {
        throw new Error("N11 credentials eksik: apiKey ve secretKey gerekli");
    }

    const allProducts = [];
    let page = 0;
    const pageSize = 250; // N11 max size: 250
    let hasMore = true;
    let totalExpected = null;

    logger.info(`[N11 FETCH] N11 ürün çekme başlatılıyor (apiKey: ${apiKey.substring(0, 6)}...)`);

    while (hasMore) {
        // n11Service.getProducts hiç throw etmez, her zaman { success, ... } döndürür
        const result = await n11Service.getProducts(credentials, { page, size: pageSize });

        // API hatası — ilk sayfada hata varsa fırlat, sonraki sayfalarda dur
        if (!result.success) {
            logger.error(`[N11 FETCH] Sayfa ${page} hatası: ${result.error}`);
            if (page === 0) {
                throw new Error(result.error || "N11 ürün listesi alınamadı");
            }
            hasMore = false;
            break;
        }

        const items = result.products || [];

        // İlk sayfada toplam bilgisini kaydet
        if (page === 0) {
            totalExpected = result.total || null;
            logger.info(`[N11 FETCH] N11 toplam ürün sayısı: ${totalExpected || "bilinmiyor"}, totalPages: ${result.totalPages || "bilinmiyor"}`);
        }

        logger.info(`[N11 FETCH] Sayfa ${page}: ${items.length} ürün alındı (şu ana kadar: ${allProducts.length + items.length}/${totalExpected || "?"})`);

        if (items.length === 0) {
            // İlk sayfada hiç ürün yoksa — mağaza boş veya API farklı yanıt döndü
            if (page === 0) {
                logger.warn("[N11 FETCH] İlk sayfada ürün bulunamadı.");
                logger.warn("[N11 FETCH] Lütfen backend loglarında '[N11 GET PRODUCTS]' satırlarını kontrol edin.");
                logger.warn("[N11 FETCH] N11 mağazanızda ürün olduğundan emin olun ve API bilgilerini kontrol edin.");
            }
            hasMore = false;
        } else {
            allProducts.push(...items);
            page++;

            // Durdurma koşulları:
            // 1. totalPages biliniyorsa ve son sayfaya ulaştıysak
            if (result.totalPages && page >= result.totalPages) {
                hasMore = false;
            }
            // 2. totalElements biliniyorsa ve tümü çekildiyse
            else if (totalExpected && allProducts.length >= totalExpected) {
                hasMore = false;
            }
            // 3. Gelen sayı istenen size'dan azsa son sayfadayız
            else if (items.length < pageSize) {
                hasMore = false;
            }
            // 4. Güvenlik limiti — 50 sayfadan fazla çekme (250*50 = 12500 ürün)
            else if (page >= 50) {
                logger.warn(`[N11 FETCH] Güvenlik limiti: ${page} sayfa çekildi, durduruluyor.`);
                hasMore = false;
            }
        }
    }

    logger.info(`[N11 FETCH] Tamamlandı — Toplam ${allProducts.length} ürün çekildi (beklenen: ${totalExpected || "?"})`);
    return allProducts;
};

// ÇiçekSepeti ürünlerini çek
const fetchCicekSepetiProducts = async (credentials) => {
    // ✅ FIX: DB'de apiKey/sellerId olarak saklanıyor — doğru alan adlarını kullan
    const apiKey       = credentials.apiKey       || credentials.apiSecret;
    const sellerId     = credentials.sellerId     || credentials.supplierId;
    const integratorName = credentials.integratorName || "";

    if (!apiKey) {
        throw new Error("ÇiçekSepeti credentials eksik: apiKey gerekli");
    }

    // ÇiçekSepeti API header'ları: x-api-key + user-agent (ASCII only)
    const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
    const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
    const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : (cleanSellerId || "CicekSepetiIntegration");

    const products = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await axios.get(
                `https://apis.ciceksepeti.com/api/v1/Products`,
                {
                    headers: {
                        "x-api-key": apiKey,
                        "user-agent": userAgent,
                        "Content-Type": "application/json"
                    },
                    params: { Page: page, PageSize: 60 },
                    timeout: 20000
                }
            );

            const items = response.data?.products || [];
            if (items.length === 0) {
                hasMore = false;
            } else {
                products.push(...items.map(p => ({
                    marketplaceProductId: p.productCode,
                    barcode: p.barcode,
                    sku: p.stockCode,
                    name: p.productName,
                    price: p.salesPrice,
                    listPrice: p.listPrice || p.salesPrice,
                    stock: p.stockQuantity,
                    category: p.categoryName,
                    categoryId:
                        p.categoryId != null && String(p.categoryId).trim() !== ""
                            ? String(p.categoryId).trim()
                            : "",
                    brand: String(p.brandName || p.brand || p.manufacturer || p.tradeMark || "").trim(),
                    images: p.images || [],
                    attributes: {}
                })));
                page++;
            }
        } catch (error) {
            logger.error("ÇiçekSepeti ürün çekme hatası:", error.response?.data || error.message);
            hasMore = false;
            if (page === 1 && products.length === 0) {
                throw error;
            }
        }
    }

    return products;
};

// Ürünleri eşleştir ve kaydet
/** @param {(p: { phase?: string, progressPercent?: number, current?: number, total?: number, message?: string }) => void} [onProgress] */
const syncProductsFromMarketplace = async (userId, marketplaceId, marketplaceName, onProgress) => {
    const normalizedName = normalizeMarketplaceName(marketplaceName);
    const report = (partial) => {
        try {
            onProgress?.(partial);
        } catch (e) {
            /* ignore */
        }
    };
    try {
        logger.info(`[SYNC] ${normalizedName} ürünleri çekiliyor...`);
        report({ phase: "init", progressPercent: 2, message: `${normalizedName}: bağlanıyor...` });

        // Önce ID ile bul, bulamazsan isimle bul
        let marketplace = null;
        if (marketplaceId && marketplaceId !== "undefined" && marketplaceId !== "null") {
            try {
                marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
            } catch (e) {
                // Geçersiz ObjectId — isimle ara
            }
        }
        if (!marketplace) {
            marketplace = await Marketplace.findOne({
                userId,
                marketplaceName: { $regex: new RegExp(`^${normalizedName}$`, "i") }
            });
        }
        if (!marketplace) {
            throw new Error(`${normalizedName} pazaryeri bulunamadı. Lütfen entegrasyon ayarlarınızı kontrol edin.`);
        }

        report({ phase: "fetch", progressPercent: 8, message: `${normalizedName}: ürün listesi indiriliyor...` });
        // Pazaryerinden ürünleri çek
        const marketplaceProducts = await fetchProductsFromMarketplace(marketplace);

        if (!marketplaceProducts || marketplaceProducts.length === 0) {
            logger.info(`[SYNC] ${normalizedName} - Hiç ürün bulunamadı`);
            report({ phase: "done", progressPercent: 100, message: "Listede ürün yok", total: 0, current: 0 });
            return {
                total: 0,
                new: 0,
                updated: 0,
                skipped: 0,
                errors: 0,
                message: `${normalizedName} mağazanızda henüz ürün bulunmuyor.`
            };
        }

        logger.info(`[SYNC] ${marketplaceProducts.length} ürün çekildi`);
        for (const p of marketplaceProducts) {
            if (p.barcode != null && String(p.barcode).trim() !== "") {
                p.barcode = normalizeSyncLookupKey(p.barcode);
            }
            if (p.sku != null && String(p.sku).trim() !== "") {
                p.sku = normalizeSyncLookupKey(p.sku);
            }
            if (p.marketplaceProductId != null && String(p.marketplaceProductId).trim() !== "") {
                p.marketplaceProductId = normalizeSyncLookupKey(p.marketplaceProductId);
            }
        }
        report({
            phase: "process",
            progressPercent: 14,
            current: 0,
            total: marketplaceProducts.length,
            message: `${marketplaceProducts.length} ürün alındı — işleniyor...`
        });

        const stats = {
            total: marketplaceProducts.length,
            new: 0,
            updated: 0,
            skipped: 0,
            errors: 0
        };

        /**
         * ⚡ PERFORMANS OPTİMİZASYONU:
         *
         * ESKİ YÖNTEM (yavaş):
         *   Her ürün için: findOne + save + StockSyncLog.create = 3 DB işlemi × N ürün
         *   500 ürün × 3 × ~30ms = ~45 saniye → HTTP yanıtı bu süre boyunca gönderilmez
         *
         * YENİ YÖNTEM (hızlı):
         *   1. Tüm mevcut ürünleri tek sorguda çek (bulk findOne yerine find + Map)
         *   2. Ürünleri 20'li batch'ler halinde paralel kaydet
         *   3. Logları toplu tek insertMany ile yaz (500 create → 1 insertMany)
         *
         *   500 ürün: ~3-5 saniye (10x hızlanma)
         */

        // ── Adım 1: Tüm mevcut eşleştirmeleri tek sorguda çek ──
        // 🛡️ GELİŞTİRİLMİŞ LOOKUP: Barkod + SKU + MarketplaceProductId ile eşleştir
        const allBarcodes = marketplaceProducts.map(p => p.barcode).filter(Boolean);
        const allSkus = marketplaceProducts.map(p => p.sku).filter(Boolean);
        const allMpIds = marketplaceProducts.map(p => p.marketplaceProductId).filter(Boolean);
        const allLookupKeys = [...new Set([...allBarcodes, ...allSkus, ...allMpIds])];

        const existingMappings = await ProductMapping.find({
            userId,
            $or: [
                { "masterProduct.barcode": { $in: allLookupKeys } },
                { "masterProduct.sku": { $in: allLookupKeys } },
                { "masterProduct.sku": { $in: allSkus } },
                { "marketplaceMappings.marketplaceProductId": { $in: allMpIds } }
            ]
        });

        // 🛡️ Hızlı lookup için 4 Map oluştur (barcode, sku, name, marketplaceProductId)
        const mappingByBarcode = new Map();
        const mappingBySku = new Map();
        const mappingByName = new Map();
        const mappingByMpId = new Map();
        for (const m of existingMappings) {
            if (m.masterProduct.barcode) mappingByBarcode.set(m.masterProduct.barcode, m);
            if (m.masterProduct.sku) mappingBySku.set(m.masterProduct.sku, m);
            if (m.masterProduct.name) mappingByName.set(m.masterProduct.name.trim().toLowerCase(), m);
            // Pazaryeri kimlik alanları ile de eşleştir (platformda SKU/barkod değişmiş olabilir)
            for (const mp of (m.marketplaceMappings || [])) {
                if (mp.marketplaceProductId) {
                    mappingByMpId.set(normalizeSyncLookupKey(mp.marketplaceProductId), m);
                }
                if (mp.marketplaceSku) {
                    const k = normalizeSyncLookupKey(mp.marketplaceSku);
                    if (k && !mappingBySku.has(k)) mappingBySku.set(k, m);
                }
                if (mp.marketplaceBarcode) {
                    const k = normalizeSyncLookupKey(mp.marketplaceBarcode);
                    if (k && !mappingByBarcode.has(k)) mappingByBarcode.set(k, m);
                }
            }
        }

        // 🔧 Kullanıcının eşleştirme öncelik sırasını getir
        const matchPriority = await getUserMatchPriority(userId);
        logger.info(`[SYNC] Eşleştirme önceliği: 1) ${matchPriority.primary} 2) ${matchPriority.secondary} 3) ${matchPriority.tertiary}`);

        const lookupMaps = { mappingBySku, mappingByBarcode, mappingByName, mappingByMpId };

        // ── Adım 2: Ürünleri işle ve kaydet (batch paralel) ──
        const logEntries = []; // Toplu log için biriktir
        const BATCH_SIZE = 20;

        /** Aynı ProductMapping birden fazla TY varyantı/satırıyla aynı batch'te güncellenirse paralel save() Mongoose hatası: "Can't save() the same doc multiple times in parallel" */
        const mappingSaveTailById = new Map();
        const saveProductMappingSerialized = (doc) => {
            if (!doc?._id) return doc.save();
            const id = String(doc._id);
            const prev = mappingSaveTailById.get(id) || Promise.resolve();
            const next = prev.then(
                () => doc.save(),
                () => doc.save()
            );
            mappingSaveTailById.set(id, next);
            return next;
        };

        for (let i = 0; i < marketplaceProducts.length; i += BATCH_SIZE) {
            const batch = marketplaceProducts.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (product) => {
                try {
                    if (!product.barcode && !product.sku && !product.marketplaceProductId) {
                        return { status: "skipped" };
                    }

                    // 🛡️ GELİŞTİRİLMİŞ EŞLEŞTIRME — Kullanıcı öncelik sırasına göre
                    // Öncelik: Kullanıcı ayarından gelir (default: 1) SKU  2) Barkod  3) Ürün Adı)
                    let mapping = matchProductByPriority(product, lookupMaps, matchPriority);

                    const mpData = buildMarketplacePullPayload(product, normalizedName);

                    if (mapping) {
                        // Mevcut ürün — pazaryeri mapping'ini güncelle
                        const mpIndex = mapping.marketplaceMappings.findIndex(
                            m => normalizeMarketplaceName(m.marketplaceName) === normalizedName
                        );

                        if (mpIndex >= 0) {
                            const prevMp = mapping.marketplaceMappings[mpIndex];
                            Object.assign(mapping.marketplaceMappings[mpIndex], mpData, {
                                // Pull ile gelen pazaryeri stoku yalnızca snapshot — senkron tamamlandı sayma
                                isSynced: prevMp.isSynced,
                                syncStatus: prevMp.syncStatus || "pending",
                            });
                        } else {
                            mapping.marketplaceMappings.push({
                                ...mpData,
                                isSynced: false,
                                syncStatus: "pulled",
                            });
                        }

                        const mpTarget =
                            mpIndex >= 0
                                ? mapping.marketplaceMappings[mpIndex]
                                : mapping.marketplaceMappings[mapping.marketplaceMappings.length - 1];
                        const driftResult = applyFieldDriftToMarketplaceMapping(
                            mpTarget,
                            mapping.masterProduct,
                            product,
                            mapping.stockTracking
                        );
                        if (driftResult.hasDrift) {
                            if (driftResult.hasCritical) {
                                logger.warn(
                                    `[SYNC] Kritik alan farkı — ${product.barcode || product.sku} @ ${normalizedName}: ` +
                                    driftResult.drifts.filter((d) => d.severity === "critical").map((d) => d.label).join(", ")
                                );
                                await logFieldDriftToStockSyncLog(userId, mapping, normalizedName, driftResult);
                            }
                        }

                        // ⚠️ Master product stok/fiyat güncelleme — DİKKAT!
                        // Master stoka DOKUNMA — sadece marketplace mapping stoku güncellenir
                        //   Master stok sadece şu durumlarda değişir:
                        //   1. Sipariş geldiğinde (stockCronService → reserveStock)
                        //   2. Manuel güncelleme (kullanıcı UI'dan değiştirdiğinde)
                        //   3. İlk kez oluşturulan ürünlerde (aşağıdaki else bloğu)
                        // Fiyat güncelleme ise güvenli — master fiyatı pazaryerinden güncelleyebiliriz
                        if (product.price) mapping.masterProduct.price = product.price;
                        if (product.listPrice) mapping.masterProduct.listPrice = product.listPrice;
                        {
                            const gSync = masterProductAdapter.clampMasterGarantiSuresi(product.garantiSuresi);
                            if (gSync !== null) mapping.masterProduct.garantiSuresi = gSync;
                        }
                        if (product.vatRate != null && product.vatRate !== "") {
                            const vr = Number(product.vatRate);
                            if (Number.isFinite(vr) && vr >= 0) mapping.masterProduct.vatRate = vr;
                        }

                        // 🛡️ Eksik master verileri marketplace'ten doldur (kategorisi boş ise güncelle)
                        if (!mapping.masterProduct.category && product.category) {
                            mapping.masterProduct.category = product.category;
                        }
                        if (product.brand && !isPlaceholderBrand(product.brand)) {
                            mapping.masterProduct.brand = product.brand;
                        }
                        if (product.attributes && typeof product.attributes === "object") {
                            const prev =
                                mapping.masterProduct.attributes &&
                                typeof mapping.masterProduct.attributes === "object"
                                    ? mapping.masterProduct.attributes
                                    : {};
                            mapping.masterProduct.attributes = { ...prev, ...product.attributes };
                        }

                        await saveProductMappingSerialized(mapping);

                        // Log entry biriktir (sonra toplu yazılacak)
                        logEntries.push({
                            userId,
                            actionType: "product_synced",
                            product: {
                                productMappingId: mapping._id,
                                barcode: product.barcode || product.sku || "",
                                sku: product.sku || "",
                                name: product.name || ""
                            },
                            marketplace: { name: normalizedName, productId: product.marketplaceProductId || "" },
                            status: "success",
                            notification: { priority: "low" }
                        });

                        return { status: "updated" };
                    } else {
                        // 🛡️ Yeni ürün oluşturmadan önce DB'de son kontrol (batch arası race condition)
                        const finalCheck = await ProductMapping.findOne({
                            userId,
                            $or: [
                                ...(product.sku ? [{ "masterProduct.sku": product.sku }] : []),
                                ...(product.barcode ? [{ "masterProduct.barcode": product.barcode }] : []),
                                ...(product.sku ? [{ "masterProduct.barcode": product.sku }] : []),
                                ...(product.barcode ? [{ "masterProduct.sku": product.barcode }] : [])
                            ]
                        });

                        if (finalCheck) {
                            // DB'de bulundu — güncelle (duplike oluşturma!)
                            const mpIdx = finalCheck.marketplaceMappings.findIndex(
                                m => normalizeMarketplaceName(m.marketplaceName) === normalizedName
                            );
                            if (mpIdx >= 0) {
                                const prevMp = finalCheck.marketplaceMappings[mpIdx];
                                Object.assign(finalCheck.marketplaceMappings[mpIdx], mpData, {
                                    isSynced: prevMp.isSynced,
                                    syncStatus: prevMp.syncStatus || "pending",
                                });
                            } else {
                                finalCheck.marketplaceMappings.push({
                                    ...mpData,
                                    isSynced: false,
                                    syncStatus: "pulled",
                                });
                            }
                            const fcMp =
                                mpIdx >= 0
                                    ? finalCheck.marketplaceMappings[mpIdx]
                                    : finalCheck.marketplaceMappings[finalCheck.marketplaceMappings.length - 1];
                            applyFieldDriftToMarketplaceMapping(
                                fcMp,
                                finalCheck.masterProduct,
                                product,
                                finalCheck.stockTracking
                            );
                            if (product.price) finalCheck.masterProduct.price = product.price;
                            if (product.listPrice) finalCheck.masterProduct.listPrice = product.listPrice;
                            {
                                const gSync = masterProductAdapter.clampMasterGarantiSuresi(product.garantiSuresi);
                                if (gSync !== null) finalCheck.masterProduct.garantiSuresi = gSync;
                            }
                            if (product.vatRate != null && product.vatRate !== "") {
                                const vr = Number(product.vatRate);
                                if (Number.isFinite(vr) && vr >= 0) finalCheck.masterProduct.vatRate = vr;
                            }
                            if (!finalCheck.masterProduct.category && product.category) {
                                finalCheck.masterProduct.category = product.category;
                            }
                            if (product.brand && !isPlaceholderBrand(product.brand)) {
                                finalCheck.masterProduct.brand = product.brand;
                            }
                            if (product.attributes && typeof product.attributes === "object") {
                                const prev =
                                    finalCheck.masterProduct.attributes &&
                                    typeof finalCheck.masterProduct.attributes === "object"
                                        ? finalCheck.masterProduct.attributes
                                        : {};
                                finalCheck.masterProduct.attributes = { ...prev, ...product.attributes };
                            }
                            await saveProductMappingSerialized(finalCheck);

                            // Map'e ekle
                            if (finalCheck.masterProduct.barcode) mappingByBarcode.set(finalCheck.masterProduct.barcode, finalCheck);
                            if (finalCheck.masterProduct.sku) mappingBySku.set(finalCheck.masterProduct.sku, finalCheck);

                            logger.info(`[SYNC] Duplike önlendi — mevcut ürün güncellendi: ${finalCheck.masterProduct.name} (SKU: ${finalCheck.masterProduct.sku})`);
                            return { status: "updated" };
                        }

                        // Gerçekten yeni ürün — oluştur
                        const stockVal = product.stock || 0;
                        const productCategory = (product.category || "").trim();
                        const pulledGaranti = masterProductAdapter.clampMasterGarantiSuresi(product.garantiSuresi);
                        const pulledVat =
                            product.vatRate != null && product.vatRate !== "" ? Number(product.vatRate) : NaN;

                        const newMapping = new ProductMapping({
                            userId,
                            masterProduct: {
                                name: product.name || "İsimsiz Ürün",
                                barcode: product.barcode || product.sku || product.marketplaceProductId || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                sku: product.sku || product.barcode || product.marketplaceProductId || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                description: product.description || "",
                                images: Array.isArray(product.images) ? product.images : [],
                                price: product.price || 0,
                                listPrice: product.listPrice || product.price || 0,
                                stock: stockVal,
                                category: productCategory,
                                brand: product.brand && !isPlaceholderBrand(product.brand) ? product.brand : "",
                                attributes: product.attributes || {},
                                ...(pulledGaranti !== null ? { garantiSuresi: pulledGaranti } : {}),
                                ...(Number.isFinite(pulledVat) && pulledVat >= 0 ? { vatRate: pulledVat } : {})
                            },
                            marketplaceMappings: [mpData],
                            stockTracking: {
                                totalStock: stockVal,
                                availableStock: stockVal,
                                lowStockThreshold: 10
                            }
                        });

                        newMapping.updateStockStatus();
                        if (newMapping.marketplaceMappings[0]) {
                            applyFieldDriftToMarketplaceMapping(
                                newMapping.marketplaceMappings[0],
                                newMapping.masterProduct,
                                product,
                                newMapping.stockTracking
                            );
                        }
                        await newMapping.save();

                        // Map'e ekle (aynı batch'teki sonraki ürünler için)
                        if (product.barcode) mappingByBarcode.set(product.barcode, newMapping);
                        if (product.sku) mappingBySku.set(product.sku, newMapping);
                        if (product.marketplaceProductId) mappingByMpId.set(product.marketplaceProductId, newMapping);

                        logEntries.push({
                            userId,
                            actionType: "product_synced",
                            product: {
                                productMappingId: newMapping._id,
                                barcode: product.barcode || product.sku || "",
                                sku: product.sku || "",
                                name: product.name || ""
                            },
                            marketplace: { name: normalizedName, productId: product.marketplaceProductId || "" },
                            status: "success",
                            notification: { priority: "low" }
                        });

                        return { status: "new" };
                    }
                } catch (error) {
                    const msg = String(error?.message || "");
                    const dupKey = error?.code === 11000 || msg.includes("E11000");
                    if (dupKey) {
                        const mpDataRecover = buildMarketplacePullPayload(product, normalizedName);
                        try {
                            const dupDoc = await ProductMapping.findOne({
                                userId,
                                $or: [
                                    ...(product.barcode ? [{ "masterProduct.barcode": product.barcode }] : []),
                                    ...(product.sku ? [{ "masterProduct.sku": product.sku }] : []),
                                    ...(product.barcode && product.sku && product.barcode !== product.sku
                                        ? [
                                            { "masterProduct.barcode": product.sku },
                                            { "masterProduct.sku": product.barcode }
                                        ]
                                        : [])
                                ]
                            });
                            if (dupDoc) {
                                const mpIdx = dupDoc.marketplaceMappings.findIndex(
                                    (m) => normalizeMarketplaceName(m.marketplaceName) === normalizedName
                                );
                                if (mpIdx >= 0) {
                                    Object.assign(dupDoc.marketplaceMappings[mpIdx], mpDataRecover);
                                } else {
                                    dupDoc.marketplaceMappings.push(mpDataRecover);
                                }
                                if (product.price) dupDoc.masterProduct.price = product.price;
                                if (product.listPrice) dupDoc.masterProduct.listPrice = product.listPrice;
                                {
                                    const gSync = masterProductAdapter.clampMasterGarantiSuresi(product.garantiSuresi);
                                    if (gSync !== null) dupDoc.masterProduct.garantiSuresi = gSync;
                                }
                                if (product.vatRate != null && product.vatRate !== "") {
                                    const vr = Number(product.vatRate);
                                    if (Number.isFinite(vr) && vr >= 0) dupDoc.masterProduct.vatRate = vr;
                                }
                                if (!dupDoc.masterProduct.category && product.category) {
                                    dupDoc.masterProduct.category = product.category;
                                }
                                if (product.brand && !isPlaceholderBrand(product.brand)) {
                                    dupDoc.masterProduct.brand = product.brand;
                                }
                                if (product.attributes && typeof product.attributes === "object") {
                                    const prev =
                                        dupDoc.masterProduct.attributes &&
                                        typeof dupDoc.masterProduct.attributes === "object"
                                            ? dupDoc.masterProduct.attributes
                                            : {};
                                    dupDoc.masterProduct.attributes = { ...prev, ...product.attributes };
                                }
                                await saveProductMappingSerialized(dupDoc);
                                if (dupDoc.masterProduct.barcode) {
                                    mappingByBarcode.set(dupDoc.masterProduct.barcode, dupDoc);
                                }
                                if (dupDoc.masterProduct.sku) {
                                    mappingBySku.set(dupDoc.masterProduct.sku, dupDoc);
                                }
                                logEntries.push({
                                    userId,
                                    actionType: "product_synced",
                                    product: {
                                        productMappingId: dupDoc._id,
                                        barcode: product.barcode || product.sku || "",
                                        sku: product.sku || "",
                                        name: product.name || ""
                                    },
                                    marketplace: {
                                        name: normalizedName,
                                        productId: product.marketplaceProductId || ""
                                    },
                                    status: "success",
                                    notification: { priority: "low" }
                                });
                                logger.info(
                                    `[SYNC] E11000 çözüldü — mevcut kayıt güncellendi: ` +
                                        `${dupDoc.masterProduct?.name || "-"} (${product.barcode || product.sku})`
                                );
                                return { status: "updated" };
                            }
                        } catch (recoverErr) {
                            logger.warn(`[SYNC] E11000 kurtarma başarısız (${product.barcode || product.sku}): ${recoverErr.message}`);
                        }
                    }
                    logger.error(
                        `[SYNC] Ürün eşleştirme hatası (${product.barcode || product.sku || product.name || "?"}): ` +
                            `${formatProductSyncSaveError(error)}` +
                            (error?.code != null ? ` | code=${error.code}` : "")
                    );
                    return { status: "error" };
                }
            }));

            // Batch sonuçlarını say
            for (const r of batchResults) {
                if (r.status === "new")     stats.new++;
                if (r.status === "updated") stats.updated++;
                if (r.status === "skipped") stats.skipped++;
                if (r.status === "error")   stats.errors++;
            }
            const done = Math.min(i + BATCH_SIZE, marketplaceProducts.length);
            const pct = 14 + Math.floor((done / marketplaceProducts.length) * 72);
            report({
                phase: "process",
                progressPercent: Math.min(86, pct),
                current: done,
                total: marketplaceProducts.length,
                message: `İşleniyor ${done}/${marketplaceProducts.length}`
            });
        }

        report({ phase: "finalize", progressPercent: 88, message: "Loglar ve temizlik..." });
        // ── Adım 3: Logları toplu yaz (500 ayrı create → 1 insertMany) ──
        if (logEntries.length > 0) {
            try {
                await StockSyncLog.insertMany(logEntries, { ordered: false });
            } catch (logError) {
                // Log yazma hatası senkronizasyonu engellemez
                logger.warn(`[SYNC] Toplu log yazma hatası (${logEntries.length} log): ${logError.message}`);
            }
        }

        // ── Adım 4: Hayalet (phantom) mapping temizliği ──
        // Pazaryerinden çekilen ürün listesinde OLMAYAN ama DB'de bu pazaryeri mapping'i
        // bulunan ürünleri tespit et ve mapping'lerini "error" olarak işaretle.
        // Bu sayede N11'den silinen ürün programda hâlâ "var" görünmez.
        let staleRemoved = 0;
        try {
            // Pazaryerinden gelen tüm barcode/sku'ları topla
            const liveBarcodes = new Set();
            const liveSkus = new Set();
            for (const mp of marketplaceProducts) {
                if (mp.barcode) liveBarcodes.add(mp.barcode);
                if (mp.sku)     liveSkus.add(mp.sku);
                if (mp.marketplaceProductId) liveBarcodes.add(mp.marketplaceProductId);
            }

            // DB'de bu pazaryeri mapping'i olan tüm ürünleri bul
            const dbProductsWithMapping = await ProductMapping.find({
                userId,
                "marketplaceMappings": {
                    $elemMatch: {
                        marketplaceName: { $regex: new RegExp(`^${normalizedName}$`, "i") },
                        syncStatus: { $in: ["synced", "pending"] }
                    }
                }
            });

            for (const dbProduct of dbProductsWithMapping) {
                const mpMapping = dbProduct.marketplaceMappings.find(
                    m => normalizeMarketplaceName(m.marketplaceName) === normalizedName &&
                         (m.syncStatus === "synced" || m.syncStatus === "pending")
                );
                if (!mpMapping) continue;

                // Bu ürünün barcode/sku'su pazaryerinden gelen listede var mı?
                const masterBc = dbProduct.masterProduct?.barcode;
                const masterSku = dbProduct.masterProduct?.sku;
                const mpBc = mpMapping.marketplaceBarcode;
                const mpSku = mpMapping.marketplaceSku;
                const mpPid = mpMapping.marketplaceProductId;

                const existsOnPlatform =
                    (masterBc && (liveBarcodes.has(masterBc) || liveSkus.has(masterBc))) ||
                    (masterSku && (liveBarcodes.has(masterSku) || liveSkus.has(masterSku))) ||
                    (mpBc && liveBarcodes.has(mpBc)) ||
                    (mpSku && liveSkus.has(mpSku)) ||
                    (mpPid && liveBarcodes.has(mpPid));

                if (!existsOnPlatform) {
                    // Ürün pazaryerinde artık yok — mapping'i "error" olarak işaretle
                    // ⚠️ save() yerine updateOne kullanıyoruz — Mongoose middleware bazen save'i engelliyor
                    await ProductMapping.updateOne(
                        { _id: dbProduct._id },
                        {
                            $set: {
                                "marketplaceMappings.$[elem].syncStatus": "error",
                                "marketplaceMappings.$[elem].syncError": `${normalizedName} platformunda bu ürün artık bulunamadı (son kontrol: ${new Date().toLocaleString("tr-TR")})`,
                                "marketplaceMappings.$[elem].isSynced": false
                            }
                        },
                        {
                            arrayFilters: [{
                                "elem.marketplaceName": { $regex: new RegExp(`^${normalizedName}$`, "i") },
                                "elem.syncStatus": { $ne: "error" }
                            }]
                        }
                    );
                    staleRemoved++;
                    logger.info(`[SYNC CLEANUP] 🧹 "${dbProduct.masterProduct?.name}" — ${normalizedName} mapping'i kaldırıldı (platformda bulunamadı)`);
                }
            }

            if (staleRemoved > 0) {
                logger.info(`[SYNC CLEANUP] ${normalizedName}: ${staleRemoved} hayalet mapping temizlendi`);
            }
        } catch (cleanupErr) {
            logger.warn(`[SYNC CLEANUP] Hayalet mapping temizleme hatası: ${cleanupErr.message}`);
        }

        stats.staleRemoved = staleRemoved;
        logger.info(`[SYNC] ${normalizedName} tamamlandı — Yeni: ${stats.new}, Güncellenen: ${stats.updated}, Atlanan: ${stats.skipped}, Hata: ${stats.errors}, Hayalet temizlenen: ${staleRemoved}`);

        report({
            phase: "done",
            progressPercent: 100,
            current: marketplaceProducts.length,
            total: marketplaceProducts.length,
            message: `Bitti — yeni: ${stats.new}, güncellenen: ${stats.updated}`
        });
        return stats;
    } catch (error) {
        logger.error(`[SYNC] Genel hata:`, error.message);
        throw error;
    }
};

// Ürünü tüm pazaryerlerine dağıt
// distributeOptions.marketplaceExtras — örn. { Trendyol: { brandId, cargoCompanyId, trendyolAttributes: [...] } }
const distributeProductToMarketplaces = async (userId, productMappingId, targetMarketplaces, category = null, distributeOptions = null) => {
    try {
        const mapping = await ProductMapping.findOne({ _id: productMappingId, userId });
        if (!mapping) {
            throw new Error("Ürün eşleştirmesi bulunamadı");
        }

        const results = [];

        for (const rawMarketplaceName of targetMarketplaces) {
            const marketplaceName = normalizeMarketplaceName(rawMarketplaceName);
            try {
                // Pazaryeri entegrasyonunu kontrol et (isim normalize edilerek aranır)
                const marketplace = await Marketplace.findOne({
                    userId,
                    marketplaceName: { $regex: new RegExp(`^${marketplaceName}$`, "i") }
                });
                if (!marketplace) {
                    results.push({
                        marketplace: marketplaceName,
                        status: "error",
                        message: `${marketplaceName} entegrasyonu bulunamadı. Lütfen entegrasyon ayarlarını kontrol edin.`
                    });
                    continue;
                }

                // Ürün zaten bu pazaryerinde var mı? (case-insensitive)
                const existingMapping = mapping.marketplaceMappings.find(
                    m => normalizeMarketplaceName(m.marketplaceName) === marketplaceName
                );

                // Kategori bilgisi geldiyse mapping'e işle (yükleme öncesi)
                if (category && category.id) {
                    const mpDataForUpload = {
                        categoryId: category.id.toString(),
                        categoryName: category.name,
                        categoryPath: category.path ? category.path.split(" > ") : [category.name]
                    };

                    if (existingMapping) {
                        Object.assign(existingMapping, mpDataForUpload);
                    } else {
                        mapping.marketplaceMappings.push({
                            marketplaceName,
                            marketplaceSku: mapping.masterProduct.sku,
                            marketplaceBarcode: mapping.masterProduct.barcode,
                            price: mapping.masterProduct.price,
                            listPrice: mapping.masterProduct.listPrice,
                            stock: mapping.masterProduct.stock,
                            ...mpDataForUpload,
                            syncStatus: "pending"
                        });
                    }
                }

                const mpEntry = mapping.marketplaceMappings.find(
                    (m) => normalizeMarketplaceName(m.marketplaceName) === marketplaceName
                );
                const extras =
                    distributeOptions?.marketplaceExtras &&
                    (distributeOptions.marketplaceExtras[rawMarketplaceName] ||
                        distributeOptions.marketplaceExtras[marketplaceName] ||
                        (marketplaceName === "Trendyol" ? distributeOptions.marketplaceExtras.Trendyol : null));
                if (mpEntry && extras && typeof extras === "object") {
                    if (!mpEntry.customAttributes || !(mpEntry.customAttributes instanceof Map)) {
                        const plain =
                            mpEntry.customAttributes &&
                            typeof mpEntry.customAttributes === "object" &&
                            !(mpEntry.customAttributes instanceof Map)
                                ? { ...mpEntry.customAttributes }
                                : {};
                        mpEntry.customAttributes = new Map(Object.entries(plain));
                    }
                    if (extras.brandId != null && `${extras.brandId}`.trim() !== "") {
                        mpEntry.customAttributes.set("brandId", Number(extras.brandId));
                    }
                    if (Array.isArray(extras.trendyolAttributes) && extras.trendyolAttributes.length > 0) {
                        mpEntry.customAttributes.set("trendyolAttributes", extras.trendyolAttributes);
                    }
                    if (extras.cargoCompanyId != null && `${extras.cargoCompanyId}`.trim() !== "") {
                        mpEntry.customAttributes.set("cargoCompanyId", Number(extras.cargoCompanyId));
                    }
                }

                // Sadece başarıyla yüklenmiş (syncStatus: "synced") ürünleri atla
                // syncStatus: "error" veya "skipped" olanlar yeniden denenebilir
                let alreadySynced = existingMapping &&
                    existingMapping.marketplaceProductId &&
                    existingMapping.syncStatus === "synced" &&
                    !category; // Kategori değişikliği varsa zorla yükle

                if (
                    alreadySynced &&
                    normalizeMarketplaceName(marketplaceName) === "Hepsiburada"
                ) {
                    const { isHepsiburadaMappingListedForUi } = require("./hepsiburadaService");
                    alreadySynced = isHepsiburadaMappingListedForUi({
                        marketplaceName: "Hepsiburada",
                        ...existingMapping,
                        syncStatus: existingMapping.syncStatus,
                        isSynced: existingMapping.isSynced
                    });
                }

                if (alreadySynced) {
                    results.push({
                        marketplace: marketplaceName,
                        status:      "skipped",
                        message:     "Ürün zaten bu pazaryerinde başarıyla yüklenmiş",
                        productId:   existingMapping.marketplaceProductId
                    });
                    continue;
                }

                // Pazaryerine ürün yükle — master + mappings (Map düzleştirme); TY kanonik veri upload içinde birleştirilir
                const docPlain = mapping.toObject ? mapping.toObject({ flattenMaps: true }) : mapping;
                const mp = docPlain.masterProduct || {};
                const productWithMappings = {
                    ...mp,
                    marketplaceMappings: docPlain.marketplaceMappings || []
                };
                const uploadResult = await uploadProductToMarketplace(
                    marketplace,
                    productWithMappings,
                    userId
                );

                if (uploadResult.success) {
                    // ✅ pending kontrolü — N11 task / Trendyol batch henüz kesinleşmediyse "synced" değil "pending" yaz
                    let isPending = uploadResult.pending === true;
                    const normMp = normalizeMarketplaceName(marketplaceName);
                    // Hepsiburada: MPOP'ta "İncelenecek" vb. olsa bile yayında sayma — yalnızca listingReady
                    if (normMp === "Hepsiburada" && uploadResult.success) {
                        isPending = uploadResult.listingReady !== true;
                    }
                    let pendingNote;
                    if (isPending) {
                        if (normMp === "N11" && uploadResult.taskId) {
                            pendingNote = "N11 task henüz işleniyor — otomatik kontrol edilecek";
                        } else if (normMp === "Trendyol" && uploadResult.batchId) {
                            pendingNote = "Trendyol ürün oluşturma kuyruğunda (batch) — sonuç otomatik kontrol edilecek";
                        } else {
                            pendingNote = uploadResult.message || "Yükleme kuyruğa alındı — sonuç bekleniyor";
                        }
                    }
                    const mpData = {
                        marketplaceProductId:
                            normMp === "Hepsiburada" && uploadResult.hepsiburadaSku
                                ? uploadResult.hepsiburadaSku
                                : uploadResult.productId,
                        isSynced:             !isPending,
                        lastSyncDate:         new Date(),
                        syncStatus:           isPending ? "pending" : "synced",
                        syncError:            isPending ? pendingNote : undefined
                    };

                    // Kategori bilgisini de kalıcı olarak güncelle (eğer yükleme sırasında geldiyse)
                    if (category && category.id) {
                        mpData.categoryId = category.id.toString();
                        mpData.categoryName = category.name;
                        mpData.categoryPath = category.path ? category.path.split(" > ") : [category.name];
                    }
                    // N11 task ID varsa kaydet
                    if (uploadResult.taskId) {
                        mpData.n11TaskId     = uploadResult.taskId;
                        mpData.n11TaskStatus = isPending ? "IN_QUEUE" : "COMPLETED";
                    }
                    // Trendyol batch (ürün create) — sonucu ayrı endpoint ile doğrulanır
                    if (normMp === "Trendyol" && uploadResult.batchId) {
                        mpData.trendyolBatchRequestId = String(uploadResult.batchId);
                        mpData.trendyolBatchStatus = "SUBMITTED";
                    }
                    // Hepsiburada tracking (import/listing kuyruğu)
                    if (normMp === "Hepsiburada") {
                        mpData.hepsiburadaListingReady = uploadResult.listingReady === true;
                        if (uploadResult.trackingId) {
                            mpData.hepsiburadaTrackingId = String(uploadResult.trackingId);
                            mpData.hepsiburadaTrackingStatus = !isPending
                                ? String(uploadResult.hbMpopProductStatus || uploadResult.status || "COMPLETED")
                                : String(
                                      uploadResult.hbMpopProductStatus ||
                                          uploadResult.status ||
                                          uploadResult.trackingSummary?.productStatus ||
                                          "QUEUED"
                                  );
                        }
                    }

                    if (existingMapping) {
                        Object.assign(existingMapping, mpData);
                    } else {
                        mapping.marketplaceMappings.push({
                            marketplaceName,
                            marketplaceSku:      mapping.masterProduct.sku,
                            marketplaceBarcode:  mapping.masterProduct.barcode,
                            price:               mapping.masterProduct.price,
                            listPrice:           mapping.masterProduct.listPrice,
                            stock:               mapping.masterProduct.stock,
                            ...mpData
                        });
                    }
                    
                    // ✅ FIX: "Ürün zaten var" hatasını önlemek için mapping içindeki 
                    // aynı pazaryerine ait eski (error/skipped) kayıtları temizle (opsiyonel ama güvenli)
                    if (!existingMapping) {
                        mapping.marketplaceMappings = mapping.marketplaceMappings.filter((m, idx) => {
                            if (idx === mapping.marketplaceMappings.length - 1) return true;
                            return normalizeMarketplaceName(m.marketplaceName) !== marketplaceName;
                        });
                    }

                    const uploadedMp = mapping.marketplaceMappings.find(
                        (m) => normalizeMarketplaceName(m.marketplaceName) === marketplaceName
                    );
                    if (uploadedMp && !isPending) {
                        alignPlatformSnapshotFromMaster(uploadedMp, mapping);
                    }

                    await mapping.save();

                    let pendingMsg = "Yükleme kuyruğunda — henüz kesinleşmedi, otomatik kontrol edilecek";
                    if (isPending) {
                        if (normMp === "N11") pendingMsg = "Ürün N11 kuyruğunda — henüz kesinleşmedi, otomatik kontrol edilecek";
                        else if (normMp === "Trendyol") pendingMsg = "Trendyol batch kuyruğunda — ürün Trendyol tarafında işleniyor; sonuç otomatik kontrol edilecek";
                        else if (normMp === "Hepsiburada") {
                            pendingMsg = uploadResult.message || "Hepsiburada import kuyruğunda — tracking/MPOP otomatik kontrol edilecek";
                        }
                    }
                    results.push({
                        marketplace: marketplaceName,
                        status:      isPending ? "pending" : "success",
                        productId:
                            normMp === "Hepsiburada" && uploadResult.hepsiburadaSku
                                ? uploadResult.hepsiburadaSku
                                : uploadResult.productId,
                        taskId:      uploadResult.taskId,
                        batchId:     uploadResult.batchId,
                        message:     isPending
                            ? pendingMsg
                            : (uploadResult.message || "Ürün başarıyla yüklendi")
                    });

                    // Log oluştur
                    await StockSyncLog.create({
                        userId,
                        actionType: isPending ? "product_pending" : "product_created",
                        product: {
                            productMappingId: mapping._id,
                            barcode: mapping.masterProduct.barcode,
                            sku: mapping.masterProduct.sku,
                            name: mapping.masterProduct.name
                        },
                        marketplace: {
                            name: marketplaceName,
                            productId: uploadResult.productId
                        },
                        status: isPending ? "pending" : "success",
                        notification: {
                            priority: isPending ? "low" : "medium"
                        }
                    });
                } else {
                    // Hata — mevcut eşlemeyi güncelle veya ilk denemede hata satırı oluştur (UI / tekrar deneme için)
                    const errMsg = uploadResult.error || "Yükleme başarısız";
                    const errBase = {
                        syncStatus: "error",
                        syncError: errMsg,
                        isSynced: false,
                        lastSyncDate: new Date()
                    };
                    if (uploadResult.taskId) {
                        errBase.n11TaskId = uploadResult.taskId;
                        errBase.n11TaskStatus = uploadResult.status || "FAILED";
                    }
                    if (category && category.id) {
                        errBase.categoryId = category.id.toString();
                        errBase.categoryName = category.name;
                        errBase.categoryPath = Array.isArray(category.path)
                            ? category.path
                            : category.path
                              ? String(category.path).split(" > ")
                              : [category.name];
                    }
                    if (existingMapping) {
                        Object.assign(existingMapping, errBase);
                    } else {
                        mapping.marketplaceMappings.push({
                            marketplaceName,
                            marketplaceSku: mapping.masterProduct.sku,
                            marketplaceBarcode: mapping.masterProduct.barcode,
                            price: mapping.masterProduct.price,
                            listPrice: mapping.masterProduct.listPrice,
                            stock: mapping.masterProduct.stock,
                            ...errBase
                        });
                        mapping.marketplaceMappings = mapping.marketplaceMappings.filter((m, idx) => {
                            if (idx === mapping.marketplaceMappings.length - 1) return true;
                            return normalizeMarketplaceName(m.marketplaceName) !== marketplaceName;
                        });
                    }
                    await mapping.save();

                    results.push({
                        marketplace: marketplaceName,
                        status: "error",
                        taskId: uploadResult.taskId,
                        message: errMsg
                    });
                }

            } catch (error) {
                logger.error(`[DISTRIBUTE] ${marketplaceName} hatası:`, error.message);
                results.push({
                    marketplace: marketplaceName,
                    status: "error",
                    message: error.message
                });
            }
        }

        return results;
    } catch (error) {
        logger.error("[DISTRIBUTE] Genel hata:", error.message);
        throw error;
    }
};

// ── Trendyol: resmi getCategoryAttributes → createProducts attributes dizisi
// Ref: https://developers.trendyol.com/v2.0/docs/trendyol-category-attribute-list-getcategoryattributes
// createProducts "attributes" satırı: Required — kategori özellikleri bu servisten alınmalıdır.

const trendyolAttrHeaders = (authHeader, actualSellerId) => ({
    Authorization: `Basic ${authHeader}`,
    "User-Agent": `${actualSellerId} - LysiaETIC`,
    "Content-Type": "application/json",
    storeFrontCode: process.env.TRENDYOL_STOREFRONT_CODE || "TR",
    "Accept-Language": "tr"
});

/** N11 katalog önerisi: ürün adında/açıklamada yasaklanan ifadeler (ör. "stres") — otomatik eş anlamlıya çevrilir */
const applyN11CatalogBannedPhrases = (raw) => {
    let s = String(raw ?? "");
    const orig = s;
    const steps = [
        [/\bantistress\b/gi, "Rahatlatıcı"],
        [/\bantistres\b/gi, "Rahatlatıcı"],
        [/\bstress\b/gi, "Rahatlatıcı"],
        [/\bstres\b/gi, "Rahatlatıcı"],
        [/stres/gi, "rahatlatıcı"]
    ];
    for (const [re, to] of steps) s = s.replace(re, to);
    s = s.replace(/\s{2,}/g, " ").trim();
    return { text: s, modified: s !== orig };
};

const normalizeTyMappingCustomAttrs = (customAttributes) => {
    if (!customAttributes) return {};
    if (customAttributes instanceof Map) {
        const o = {};
        for (const [k, v] of customAttributes) o[String(k)] = v;
        return o;
    }
    if (typeof customAttributes === "object") return { ...customAttributes };
    return {};
};

/**
 * Trendyol kategori özellik listesi (leaf categoryId olmalı).
 */
const fetchTrendyolCategoryAttributes = async (credentials, categoryId, actualSellerId) => {
    const { apiKey, apiSecret } = credentials;
    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const url =
        `https://apigw.trendyol.com/integration/product/product-categories/${encodeURIComponent(categoryId)}/attributes`;
    const resp = await axios.get(url, {
        headers: trendyolAttrHeaders(authHeader, actualSellerId),
        timeout: 20000
    });
    return resp.data || {};
};

/**
 * Trendyol marka listesi — createProducts brandId için.
 * @see https://developers.trendyol.com/v2.0/docs/trendyol-brand-list-getbrands
 * @param {{ name?: string, page?: number, size?: number }} opts name ≥2 karakter ise /brands/by-name
 */
const fetchTrendyolBrands = async (credentials, actualSellerId, opts = {}) => {
    const { apiKey, apiSecret } = credentials;
    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const headers = trendyolAttrHeaders(authHeader, actualSellerId);
    const name = String(opts.name || "").trim();
    const page = Number.isFinite(Number(opts.page)) ? Math.max(0, Number(opts.page)) : 0;
    const sizeRaw = Number(opts.size);
    const size = Math.min(1000, Math.max(1, Number.isFinite(sizeRaw) ? sizeRaw : 50));

    const normalizeList = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr
            .map((b) => ({ id: b.id, name: b.name != null ? String(b.name) : "" }))
            .filter((b) => b.id != null && !Number.isNaN(Number(b.id)));
    };

    if (name.length >= 2) {
        const url = `https://apigw.trendyol.com/integration/product/brands/by-name?name=${encodeURIComponent(name)}`;
        const resp = await axios.get(url, { headers, timeout: 20000 });
        return normalizeList(Array.isArray(resp.data) ? resp.data : []);
    }

    const url = `https://apigw.trendyol.com/integration/product/brands?page=${page}&size=${size}`;
    const resp = await axios.get(url, { headers, timeout: 25000 });
    const raw = resp.data?.brands || resp.data?.content || resp.data;
    return normalizeList(Array.isArray(raw) ? raw : []);
};

/** Trendyol attribute adı karşılaştırması (Türkçe karakter / boşluk toleransı) */
const normalizeTyAttrCompare = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/İ/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[\s\-_'.]+/g, "");

/** Kategori "Marka" zorunlu özelliği (Web Color vb. hariç) */
const isTrendyolMarkaAttributeName = (attrName) => {
    const n = String(attrName || "").toLowerCase().trim();
    if (!n) return false;
    if (n.includes("web color") || n.includes("webcolor")) return false;
    if (n.includes("garanti") || n.includes("patent")) return false;
    if (n === "marka" || n === "brand") return true;
    if (n.includes("marka")) return true;
    return false;
};

/** Listede "Diğer" / genel marka seçeneği — ilk sıradaki büyük markayı (ör. LC Waikiki) kullanmaktan güvenli */
const pickFallbackTrendyolMarkaValue = (values) => {
    if (!Array.isArray(values) || values.length === 0) return null;
    const scored = [];
    for (const v of values) {
        if (!v || Number(v.id) <= 0) continue;
        const nn = normalizeTyAttrCompare(v.name || "");
        let score = 0;
        if (nn === "diger" || nn === "other") score = 100;
        else if (nn.includes("diger")) score = 85;
        else if (nn.includes("other") || nn.includes("genel")) score = 70;
        else if (nn.includes("bilinmeyen") || nn.includes("markasiniz") || nn.includes("markasiz")) score = 55;
        if (score > 0) scored.push({ v, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.v || null;
};

const pickTrendyolCustomDefault = (attrName, product) => {
    const n = (attrName || "").toLowerCase();
    if (isTrendyolMarkaAttributeName(attrName)) {
        const b = resolveProductBrandName(product) || String(product.brand || "").trim();
        if (b) return b;
    }
    const a = product.attributes || {};
    const str = (v) => (v != null ? String(v).trim() : "");
    if (n.includes("web") && (n.includes("color") || n.includes("renk") || n.includes("colour"))) {
        return str(a.webColor) || str(a.color) || "Diğer";
    }
    if (n.includes("renk") || n.includes("colour") || (n.includes("color") && !n.includes("web"))) {
        return str(a.color) || str(a.webColor) || "Diğer";
    }
    if (n.includes("beden") || (n.includes("boyut") && n.includes("ebat"))) {
        return str(a.size) || str(a.boyutEbat) || "Tek Ebat";
    }
    if (n.includes("boyut") || n.includes("ebat")) {
        return str(a.boyutEbat) || str(a.size) || "Tek Ebat";
    }
    if (n.includes("cinsiyet")) return str(a.gender) || "Unisex";
    if (n.includes("materyal") || n.includes("malzeme")) return str(a.material) || "Plastik";
    if (n.includes("tema") || n.includes("stil") || n.includes("theme")) return str(a.themeStyle) || "Standart";
    if (n.includes("parça") || n.includes("parca") || n.includes("piece")) return str(a.pieceCount) || "1";
    if (n.includes("üretici") || n.includes("uretici") || n.includes("manufacturer")) {
        return (
            str(a.manufacturer) ||
            resolveProductBrandName(product) ||
            str(product.brand) ||
            "Belirtilmedi"
        );
    }
    if (n.includes("yaş") || n.includes("yas")) return "3 Yaş ve Üzeri";
    if (n.includes("menşei") || n.includes("mensei")) return str(a.origin) || str(a.mensei) || "TR";
    return "Diğer";
};

/**
 * createProducts gövdesi için attributes[] üretir.
 * Öncelik: marketplaceMappings[].customAttributes.trendyolAttributes veya attributeId anahtarları;
 * eksik zorunlular için allowCustom → metin, değil → ilk attributeValue (log uyarılı).
 */
const buildTrendyolAttributesForCreate = (categoryData, product, tyMapping) => {
    const rows = Array.isArray(categoryData?.categoryAttributes) ? categoryData.categoryAttributes : [];
    const plain = tyMapping ? normalizeTyMappingCustomAttrs(tyMapping.customAttributes) : {};
    const warnings = [];
    const byId = new Map();

    const pushAttr = (obj) => {
        const aid = Number(obj.attributeId);
        if (!aid) return;
        byId.set(aid, obj);
    };

    const presetList = plain.trendyolAttributes;
    if (Array.isArray(presetList)) {
        for (const p of presetList) {
            if (!p || p.attributeId == null) continue;
            const aid = Number(p.attributeId);
            if (p.customAttributeValue != null && String(p.customAttributeValue).trim() !== "") {
                pushAttr({ attributeId: aid, customAttributeValue: String(p.customAttributeValue).trim() });
            } else if (p.attributeValueId != null) {
                pushAttr({ attributeId: aid, attributeValueId: Number(p.attributeValueId) });
            }
        }
    }

    for (const [k, v] of Object.entries(plain)) {
        if (k === "brandId" || k === "trendyolAttributes") continue;
        const aid = parseInt(k, 10);
        if (Number.isNaN(aid)) continue;
        if (byId.has(aid)) continue;
        if (v != null && typeof v === "object") {
            if (v.attributeValueId != null) pushAttr({ attributeId: aid, attributeValueId: Number(v.attributeValueId) });
            else if (v.customAttributeValue != null)
                pushAttr({ attributeId: aid, customAttributeValue: String(v.customAttributeValue) });
        } else if (typeof v === "number" && v > 0) {
            pushAttr({ attributeId: aid, attributeValueId: v });
        }
    }

    const missing = [];

    for (const row of rows) {
        const attr = row.attribute || {};
        const attrId = Number(attr.id);
        if (!attrId) continue;
        if (byId.has(attrId)) continue;

        const required = Boolean(row.required);
        const allowCustom = Boolean(row.allowCustom);
        const values = Array.isArray(row.attributeValues) ? row.attributeValues : [];
        const attrName = attr.name || String(attrId);

        if (!required) continue;

        // Marka: ürün formundaki marka adına göre doldur. Liste eşleşmezse ASLA listenin ilk değerini (ör. LC Waikiki) kullanma.
        if (isTrendyolMarkaAttributeName(attrName)) {
            const brandText = resolveProductBrandName(product) || String(product.brand || "").trim();
            if (brandText) {
                if (allowCustom) {
                    pushAttr({ attributeId: attrId, customAttributeValue: brandText });
                    warnings.push(
                        `Trendyol zorunlu özellik "${attrName}" (${attrId}): ürün markası metin olarak gönderildi: "${brandText}"`
                    );
                    continue;
                }
                const nb = normalizeTyAttrCompare(brandText);
                let match = null;
                if (nb.length >= 1) {
                    const exact = values.find(
                        (x) => x && Number(x.id) > 0 && normalizeTyAttrCompare(x.name || "") === nb
                    );
                    // Kısa metinlerde .includes() yanlış eşleşmeyi artırır (ör. "lc" → LC Waikiki)
                    const sub =
                        nb.length >= 4
                            ? values.find(
                                (x) =>
                                    x &&
                                    Number(x.id) > 0 &&
                                    normalizeTyAttrCompare(x.name || "").includes(nb)
                            )
                            : null;
                    const subRev =
                        nb.length >= 4
                            ? values.find(
                                (x) =>
                                    x &&
                                    Number(x.id) > 0 &&
                                    normalizeTyAttrCompare(x.name || "").length >= 4 &&
                                    nb.includes(normalizeTyAttrCompare(x.name || ""))
                            )
                            : null;
                    match = exact || sub || subRev;
                }
                if (match) {
                    pushAttr({ attributeId: attrId, attributeValueId: Number(match.id) });
                    warnings.push(
                        `Trendyol zorunlu özellik "${attrName}" (${attrId}): ürün markası "${brandText}" → ` +
                            `liste eşleşmesi "${match.name}" (id=${match.id})`
                    );
                    continue;
                }
                const fallbackMarka = pickFallbackTrendyolMarkaValue(values);
                if (fallbackMarka && Number(fallbackMarka.id) > 0) {
                    pushAttr({ attributeId: attrId, attributeValueId: Number(fallbackMarka.id) });
                    warnings.push(
                        `Trendyol Marka "${attrName}" (${attrId}): "${brandText}" listede yok — ` +
                            `yedek liste değeri "${fallbackMarka.name}" (id=${fallbackMarka.id}). ` +
                            `Doğru görünüm için Trendyol onaylı markanızı sihirbazda "Marka"dan seçin veya marka ID kullanın.`
                    );
                    continue;
                }
                missing.push(
                    `${attrName} (attributeId=${attrId}): "${brandText}" Trendyol marka listesinde yok; ` +
                        `liste-only kategori — sihirbazda "Marka" satırından uygun değeri seçin veya onaylı Trendyol marka ID kullanın.`
                );
                continue;
            }
            const fallbackEmpty = pickFallbackTrendyolMarkaValue(values);
            if (fallbackEmpty && Number(fallbackEmpty.id) > 0) {
                pushAttr({ attributeId: attrId, attributeValueId: Number(fallbackEmpty.id) });
                warnings.push(
                    `Trendyol zorunlu özellik "${attrName}" (${attrId}): ürün markası boş — "${fallbackEmpty.name}" (id=${fallbackEmpty.id}).`
                );
                continue;
            }
            if (allowCustom) {
                const text = pickTrendyolCustomDefault(attrName, product);
                pushAttr({ attributeId: attrId, customAttributeValue: text });
                warnings.push(`Trendyol zorunlu özellik "${attrName}" (${attrId}) için otomatik metin: "${text}"`);
                continue;
            }
            const firstBrand = values.find((x) => x && Number(x.id) > 0);
            if (firstBrand) {
                pushAttr({ attributeId: attrId, attributeValueId: Number(firstBrand.id) });
                warnings.push(
                    `Trendyol zorunlu özellik "${attrName}" (${attrId}): marka bilgisi yok — son çare "${firstBrand.name}" (id=${firstBrand.id}).`
                );
            }
            continue;
        }

        if (allowCustom) {
            const text = pickTrendyolCustomDefault(attrName, product);
            pushAttr({ attributeId: attrId, customAttributeValue: text });
            warnings.push(`Trendyol zorunlu özellik "${attrName}" (${attrId}) için otomatik metin: "${text}"`);
            continue;
        }

        const first = values.find((x) => x && Number(x.id) > 0);
        if (first) {
            pushAttr({ attributeId: attrId, attributeValueId: Number(first.id) });
            warnings.push(
                `Trendyol zorunlu özellik "${attrName}" (${attrId}) için varsayılan değer kullanıldı: ` +
                    `"${first.name}" (id=${first.id}) — panelden doğrulayın`
            );
            continue;
        }

        missing.push(`${attrName} (attributeId=${attrId})`);
    }

    if (missing.length > 0) {
        return {
            error:
                `Trendyol bu kategori için doldurulamayan zorunlu özellikler: ${missing.join(", ")}. ` +
                `Satıcı panelinden veya ürün mapping'de customAttributes.trendyolAttributes ile ` +
                `{ attributeId, attributeValueId } veya { attributeId, customAttributeValue } gönderin. ` +
                `Kategori leaf (en alt seviye) olmalıdır — ara kategori seçtiyseniz özellik listesi boş/eksik kalır.`,
            attributes: [],
            warnings
        };
    }

    let attrs = [...byId.values()];
    if (attrs.length === 0 && rows.length > 0) {
        const candidate = rows.find((r) => {
            const vals = r.attributeValues;
            return r.attribute?.id && Array.isArray(vals) && vals.length > 0;
        });
        if (candidate) {
            const aid = Number(candidate.attribute.id);
            const first = candidate.attributeValues.find((x) => x && Number(x.id) > 0);
            if (aid && first) {
                attrs.push({ attributeId: aid, attributeValueId: Number(first.id) });
                warnings.push(
                    `Trendyol: zorunlu özellik satırı yoktu; createProducts için ilk özellikten varsayılan eklendi ` +
                        `(${candidate.attribute.name}=${first.name}).`
                );
            }
        }
    }

    return { attributes: attrs, warnings };
};

// Trendyol'a ürün yükle
// ✅ FIX: brandId ve categoryId artık dinamik çözümleniyor (eskisi hardcoded 1 idi → 400 hata)
// ✅ FIX: marketplaceMappings'ten Trendyol-specific categoryId alınıyor
// ✅ FIX: UnifiedCategoryMap'ten Trendyol categoryId fallback
// ✅ FIX: Hata logu detaylı — raw response yazdırılıyor
// ✅ Resmi API: getCategoryAttributes + zorunlu attributes (boş [] çoğu kategoride batch FAILED)
const uploadProductToTrendyol = async (credentials, product) => {
    const productName = product.name || product.title || "İsimsiz Ürün";
    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
    const actualSellerId = sellerId || supplierId;
    if (!apiKey || !apiSecret || !actualSellerId) {
        logger.warn(`[UPLOAD TRENDYOL] Atlandı — credentials eksik | ürün: "${productName}"`);
        return { success: false, error: "Trendyol credentials eksik" };
    }
    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const tyMapping = Array.isArray(product.marketplaceMappings)
        ? product.marketplaceMappings.find((m) => (m.marketplaceName || "").toLowerCase() === "trendyol")
        : null;

    // ── categoryId çözümleme ──
    let categoryId = null;
    if (tyMapping && tyMapping.categoryId) {
        categoryId = parseInt(String(tyMapping.categoryId), 10);
    }
    if (!categoryId && product.categoryId) {
        categoryId = parseInt(String(product.categoryId), 10);
    }
    if (!categoryId && product.category && !isNaN(product.category)) {
        categoryId = parseInt(String(product.category), 10);
    }

    if (!categoryId || Number.isNaN(categoryId)) {
        const msg =
            `Trendyol yükleme başarısız: "${productName}" için categoryId bulunamadı. ` +
            `Lütfen ürünün Trendyol categoryId bilgisini kontrol edin. ` +
            `(Mevcut kategori: "${product.category || "yok"}")`;
        logger.warn(`[UPLOAD TRENDYOL] ${msg}`);
        return { success: false, error: msg };
    }

    // ── brandId — Map veya düz obje customAttributes.brandId ──
    let brandId = 7651;
    const caBrand = normalizeTyMappingCustomAttrs(tyMapping?.customAttributes);
    if (caBrand.brandId != null && String(caBrand.brandId).trim() !== "") {
        const b = parseInt(String(caBrand.brandId), 10);
        if (!Number.isNaN(b)) brandId = b;
    }
    const masterBrandName = resolveProductBrandName(product) || String(product.brand || "").trim();
    if (brandId === 7651 && masterBrandName) {
        logger.warn(
            `[UPLOAD TRENDYOL] createProducts brandId=7651 (varsayılan "Diğer"); ürün marka adı: "${masterBrandName}". ` +
                `Panelde üst marka yanlışsa sihirbazda "Trendyol marka ID" alanına Trendyol’daki sayısal marka kodunu girin.`
        );
    }

    let cargoCompanyId = 10;
    if (caBrand.cargoCompanyId != null && String(caBrand.cargoCompanyId).trim() !== "") {
        const cc = parseInt(String(caBrand.cargoCompanyId), 10);
        if (!Number.isNaN(cc)) cargoCompanyId = cc;
    }

    // Görseller — Trendyol dokümantasyonu: https; http gelirse https'e çevrilir
    const images = (product.images || [])
        .map((url, i) => {
            let raw = null;
            if (typeof url === "string") raw = url.trim();
            else if (url && typeof url === "object" && url.url) raw = url.url.toString().trim();
            if (!raw) return null;
            let u = raw;
            if (u.startsWith("http://")) {
                u = `https://${u.slice(7)}`;
                logger.warn(`[UPLOAD TRENDYOL] Görsel http→https: ${u.substring(0, 96)}`);
            }
            if (!u.startsWith("https://")) return null;
            return { url: u, order: i + 1 };
        })
        .filter(Boolean);

    if (images.length === 0) {
        const msg =
            `Trendyol yükleme başarısız: "${productName}" için en az 1 geçerli https görsel gerekli`;
        logger.warn(`[UPLOAD TRENDYOL] ${msg}`);
        return { success: false, error: msg };
    }

    let categoryData;
    try {
        categoryData = await fetchTrendyolCategoryAttributes(credentials, categoryId, actualSellerId);
    } catch (catErr) {
        const st = catErr.response?.status;
        const body = catErr.response?.data;
        const msg = body?.errors?.[0]?.message || body?.message || catErr.message;
        logger.error(`[UPLOAD TRENDYOL] getCategoryAttributes başarısız (${st}) categoryId=${categoryId}: ${msg}`);
        return {
            success: false,
            error:
                `Trendyol kategori özellikleri alınamadı (categoryId=${categoryId}). ` +
                `Leaf kategori ve geçerli API bilgileri gerekir. Detay: ${msg}`
        };
    }

    const attrBuilt = buildTrendyolAttributesForCreate(categoryData, product, tyMapping);
    if (attrBuilt.error) {
        logger.warn(`[UPLOAD TRENDYOL] ${attrBuilt.error}`);
        return { success: false, error: attrBuilt.error };
    }
    (attrBuilt.warnings || []).forEach((w) => logger.warn(`[UPLOAD TRENDYOL] ${w}`));

    const rowsLen = Array.isArray(categoryData?.categoryAttributes) ? categoryData.categoryAttributes.length : 0;
    if (rowsLen === 0 && process.env.TRENDYOL_ALLOW_EMPTY_CATEGORY_ATTRS !== "true") {
        const msg =
            `Trendyol: categoryId=${categoryId} için kategori özellik listesi boş. ` +
            `Bu genelde üst seviye (leaf olmayan) kategori seçildiğinde olur; batch kabul edilse bile ürün reddedilebilir. ` +
            `Sihirbazda en alt seviye (ürün bağlanabilir) Trendyol kategorisini seçin. ` +
            `İstisna için: TRENDYOL_ALLOW_EMPTY_CATEGORY_ATTRS=true`;
        logger.warn(`[UPLOAD TRENDYOL] ${msg}`);
        return { success: false, error: msg };
    }
    if (rowsLen === 0) {
        logger.warn(
            `[UPLOAD TRENDYOL] ⚠️ categoryId=${categoryId} özellik listesi boş — TRENDYOL_ALLOW_EMPTY_CATEGORY_ATTRS ile yükleme izni verildi.`
        );
    }

    let listPrice = parseFloat(product.listPrice || product.price) || 0;
    const salePrice = parseFloat(product.price) || 0;
    if (salePrice <= 0) {
        return { success: false, error: `Trendyol: "${productName}" satış fiyatı 0'dan büyük olmalıdır` };
    }
    if (listPrice < salePrice) listPrice = salePrice;

    const vatParsed = parseInt(product.vatRate, 10);
    const vatRateFinal = Number.isNaN(vatParsed) ? 20 : vatParsed;

    try {
        const payload = {
            items: [{
                barcode:          product.barcode,
                title:            productName,
                productMainId:    product.sku,
                brandId:          brandId,
                categoryId:       categoryId,
                quantity:         parseInt(product.stock) || 0,
                stockCode:        product.sku,
                dimensionalWeight: product.attributes?.weight || 1,
                description:      product.description || productName,
                currencyType:     "TRY",
                listPrice:        listPrice,
                salePrice:        salePrice,
                vatRate:          vatRateFinal,
                cargoCompanyId:   cargoCompanyId,
                images:           images,
                attributes:       attrBuilt.attributes
            }]
        };

        logger.info(
            `[UPLOAD TRENDYOL] Ürün yükleniyor — "${productName}" | barcode: ${product.barcode} | ` +
            `categoryId: ${categoryId} | brandId: ${brandId} | attributes: ${attrBuilt.attributes.length} | ` +
            `fiyat: ${salePrice} TL | stok: ${parseInt(product.stock) || 0} | görsel: ${images.length}`
        );

        const response = await axios.post(
            `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/products`,
            payload,
            {
                headers: trendyolAttrHeaders(authHeader, actualSellerId),
                timeout: 15000
            }
        );

        const data = response.data || {};
        const batchId = data.batchRequestId;
        const syncErrors = Array.isArray(data.errors) ? data.errors : [];
        const errText = syncErrors.length
            ? syncErrors.map((e) => (e && e.message) || JSON.stringify(e)).join(" | ")
            : "";

        logger.info(
            `[UPLOAD TRENDYOL] API yanıt — batchRequestId: ${batchId || "yok"}, errors: ${syncErrors.length}` +
            (Object.keys(data).length ? ` | ham(600): ${JSON.stringify(data).slice(0, 600)}` : "")
        );

        if (syncErrors.length > 0) {
            logger.warn(
                `[UPLOAD TRENDYOL] ⚠️ Yanıtta errors[] var — "${productName}": ${errText} ` +
                `(batchId olsa bile kuyruk sonucu ayrıca [TY BATCH CHECK] ile doğrulanmalı)`
            );
        }

        if (!batchId) {
            const msg = errText || "Trendyol batchRequestId dönmedi — ürün kuyruğa alınmamış olabilir";
            logger.warn(`[UPLOAD TRENDYOL] ❌ ${msg} | ürün: "${productName}"`);
            return { success: false, error: msg, response: data };
        }

        logger.info(
            `[UPLOAD TRENDYOL] ✅ İstek kuyruğa alındı (asenkron) — "${productName}" | batchId: ${batchId}. ` +
            `Ürün Trendyol panelinde ancak batch COMPLETED + SUCCESS sonrası görünür; reddedilirse logda [TY BATCH CHECK] ve mapping syncError'da nedeni yazar.`
        );
        return {
            success: true,
            pending: true,
            productId: product.barcode,
            batchId,
            message:
                "Trendyol ürün oluşturma kuyruğunda. Sonuç birkaç dk içinde batch kontrolüyle kesinleşir; " +
                "kategori zorunlu özellikleri eksikse Trendyol reddeder (panelde ürün görünmeyebilir).",
            response: data
        };
    } catch (error) {
        const errData = error.response?.data;
        const errCode = error.response?.status;
        let errMsg = error.message;
        if (errData) {
            if (errData.errors && Array.isArray(errData.errors)) {
                errMsg = errData.errors.map(e => e.message || JSON.stringify(e)).join(" | ");
            } else if (errData.message) errMsg = errData.message;
            else if (typeof errData === "string") errMsg = errData;
            else errMsg = JSON.stringify(errData);
        }
        logger.error(
            `[UPLOAD TRENDYOL] ❌ Hata — "${productName}" | status: ${errCode} | error: ${errMsg}` +
            (errData ? ` | raw: ${JSON.stringify(errData).substring(0, 500)}` : "")
        );
        return { success: false, error: errMsg };
    }
};

// Hepsiburada'ya ürün yükle (katalog import + status takibi)
const uploadProductToHepsiburada = async (credentials, product) => {
    const hb = require("./hepsiburadaService");
    const hbPayload = {
        ...product,
        name: product.name || product.title,
        stock: product.stock ?? 0,
        price: product.price ?? 0
    };
    return await hb.uploadProductToHepsiburada(credentials, hbPayload);
};

// N11 task sonucunu polling ile sorgula (asenkron işlem)
// ⚡ Performans: maxAttempts=3, intervalMs=2000 — toplu dağıtımda her ürün max 6-8s bekler
//    Eski: 8 deneme × (3+4+5+6+7+8+9+10)s = 52s/ürün → 10 ürün = 520s (8.5 dk!)
//    Yeni: 3 deneme × (2+3+4)s = 9s/ürün → 10 ürün = 90s (1.5 dk)
//    Task hâlâ IN_QUEUE ise "başarılı kabul" edilir — N11 arka planda işler
const pollN11TaskResult = async (credentials, taskId, maxAttempts = 3, intervalMs = 2000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Bekleme süresi: her denemede biraz artar (2s, 3s, 4s)
        const waitMs = intervalMs + (attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitMs));

        const taskResult = await n11Service.getTaskDetails(credentials, taskId);

        if (!taskResult.success) {
            logger.warn(`[N11 POLL] Deneme ${attempt}/${maxAttempts} — task sorgulanamadı: ${taskResult.error}`);
            continue;
        }

        const status  = taskResult.data?.status;
        const reasons = taskResult.data?.reasons || [];

        logger.info(`[N11 POLL] Deneme ${attempt}/${maxAttempts} — taskId: ${taskId}, status: ${status}`);

        // N11 "PROCESSED" döndürür — getTaskDetails içinde "COMPLETED"'a normalize edilir
        // Her iki değeri de kabul et (güvenlik için)
        if (status === "COMPLETED" || status === "PROCESSED") {
            logger.info(`[N11 POLL] ✅ Task tamamlandı — taskId: ${taskId}, status: ${status}`);
            // SKU bazlı hata kontrolü — task tamamlandı ama bazı SKU'lar başarısız olabilir
            const failedSkus = taskResult.data?.failedSkus || [];
            if (failedSkus.length > 0) {
                const failReasons = failedSkus.map(s => `${s.itemCode}: ${(s.reasons || []).join(", ")}`).join(" | ");
                logger.warn(`[N11 POLL] ⚠️ Task tamamlandı ama ${failedSkus.length} SKU başarısız — ${failReasons}`);
                return { done: true, success: false, status, error: failReasons, reasons };
            }
            return { done: true, success: true, status, reasons };
        }

        if (status === "REJECT" || status === "FAILED" || status === "ERROR") {
            const reason = Array.isArray(reasons) && reasons.length > 0
                ? reasons.join(", ")
                : (taskResult.data?.message || `N11 task reddedildi (${status})`);
            logger.warn(`[N11 POLL] ❌ Task reddedildi — taskId: ${taskId}, sebep: ${reason}`);
            return { done: true, success: false, status, error: reason, reasons };
        }

        // IN_QUEUE veya PROCESSING — son denemede "pending" olarak döndür
        // ❌ ESKİ: success: true döndürüyordu → ürün "synced" olarak kaydediliyordu ama N11'de yoktu
        // ✅ YENİ: success: true ama pending: true → çağıran "pending" durumunu ayrıca kontrol eder
        if (attempt === maxAttempts) {
            logger.warn(`[N11 POLL] ⏳ Task hâlâ ${status} — pending olarak döndürülüyor (kesinleşmedi) — taskId: ${taskId}`);
            return { done: false, success: true, status, pending: true, message: `Task kuyruğa alındı (${status}), N11 arka planda işleyecek` };
        }
    }
    return { done: false, success: true, pending: true, message: "Task kuyruğa alındı, N11 arka planda işleyecek" };
};

/** N11 resmi: ürün adı en az 15 karakter (Mağaza Destek — API hata mesajları) */
const N11_TITLE_MIN_LEN = 15;

/**
 * Liste başlığı — masterProductAdapter.fromTrendyol ile uyum: önce title, sonra productName, en sonda name.
 * ESKİ hata: name || title önce kısa name'i seçip uzun title'ı yok sayabiliyordu.
 */
const pickListingTitleForUpload = (product) => {
    if (!product || typeof product !== "object") return "";
    const title = product.title != null ? String(product.title).trim() : "";
    const productName = product.productName != null ? String(product.productName).trim() : "";
    const name = product.name != null ? String(product.name).trim() : "";
    if (title) return title;
    if (productName) return productName;
    return name;
};

/**
 * N11 min uzunluk — kısa başlığı marka / kategori / stok kodu ile güvenli şekilde uzatır (yalnızca API'ye giden metin).
 */
const ensureN11TitleMinLength = (baseTitle, ctx = {}) => {
    let t = String(baseTitle || "").replace(/\s+/g, " ").trim();
    if (t.length >= N11_TITLE_MIN_LEN) return t;
    const brand = String(ctx.brand || "").trim();
    if (brand && !/^genel$/i.test(brand)) {
        const merged = t ? `${t} · ${brand}` : brand;
        if (merged.length >= N11_TITLE_MIN_LEN) return merged.slice(0, 255);
        t = merged;
    }
    const path = String(ctx.category || ctx.categoryName || "");
    const catLeaf = path
        .split(/[>|/]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .pop();
    if (catLeaf && catLeaf.length >= 2) {
        const c = catLeaf.slice(0, 50);
        const merged = t ? `${t} · ${c}` : c;
        if (merged.length >= N11_TITLE_MIN_LEN) return merged.slice(0, 255);
        t = merged;
    }
    const code = String(ctx.sku || ctx.barcode || "").replace(/\s+/g, "").slice(-12);
    if (code) {
        const merged = t ? `${t} · ${code}` : code;
        if (merged.length >= N11_TITLE_MIN_LEN) return merged.slice(0, 255);
        t = merged;
    }
    const pad = " Ürün";
    while (t.length < N11_TITLE_MIN_LEN) t += pad;
    return t.slice(0, 255);
};

// N11'e ürün yükle — 3 katmanlı mimari: autoFix → toN11 → createProduct
const uploadProductToN11 = async (credentials, product, userId = null) => {
    const { apiKey, secretKey } = credentials;
    if (!apiKey || !secretKey) {
        return { success: false, error: "N11 credentials eksik: apiKey ve secretKey gerekli" };
    }

    // ── 1. SKU kontrolü ──────────────────────────────────────────────────────
    const stockCode = (product.sku || product.barcode || "").toString().trim();
    const productName =
        pickListingTitleForUpload(product) ||
        product.name ||
        product.title ||
        product.sku ||
        "?";

    if (!stockCode) {
        return {
            success: false,
            error: `N11 yükleme başarısız: "${productName}" için SKU/barkod eksik (stockCode zorunlu)`
        };
    }

    // ── 2. Başlık (N11 min. 15 karakter) ─────────────────────────────────────
    let titleBase = pickListingTitleForUpload(product);
    if (!titleBase) titleBase = stockCode;
    const titleForN11 = ensureN11TitleMinLength(titleBase, {
        brand: resolveProductBrandName(product) || product.brand,
        category: product.category || product.categoryName,
        sku: stockCode,
        barcode: product.barcode
    });
    if (titleForN11.length < N11_TITLE_MIN_LEN) {
        logger.warn(
            `[UPLOAD N11] ⚠️ Başlık N11 için yeterince uzatılamadı — "${productName}" (${titleForN11.length} karakter).`
        );
        return {
            success: false,
            skipped: true,
            reason: "TITLE_TOO_SHORT",
            error:
                `N11 yükleme atlandı: başlık en az ${N11_TITLE_MIN_LEN} karakter olmalı (resmi kural). ` +
                `Lütfen ürün adını uzatın veya marka/kategori bilgisini ekleyin.`
        };
    }
    if (titleForN11 !== titleBase) {
        logger.info(
            `[UPLOAD N11] Başlık N11 kuralına uygun uzatıldı (${titleBase.length}→${titleForN11.length} karakter): "${titleBase}" → "${titleForN11}"`
        );
    }

    // ── 3. Fiyat kontrolü ─────────────────────────────────────────────────────
    // N11 kuralı: Fiyat çok düşük olamaz (fahiş fiyat düşüklüğü kontrolü)
    // N11 minimum fiyat eşiği kategoriye göre değişir ama genel olarak ~1 TL altı reddedilir
    const salePrice = parseFloat(product.price || product.salePrice || 0);
    if (salePrice <= 0) {
        logger.warn(`[UPLOAD N11] ⚠️ Fiyat 0 veya negatif — "${productName}" (${salePrice} TL)`);
        return {
            success: false,
            skipped: true,
            reason:  "INVALID_PRICE",
            error:   `N11 yükleme atlandı: "${productName}" fiyatı geçersiz (${salePrice} TL). ` +
                     `Fiyat 0'dan büyük olmalıdır.`
        };
    }

    // ── 4. Görsel kontrolü ───────────────────────────────────────────────────
    const validImages = (product.images || [])
        .map(img => {
            if (typeof img === "string") return img.trim();
            if (img && typeof img === "object" && img.url) return img.url.toString().trim();
            return null;
        })
        .filter(url => url && url.startsWith("https://"));

    if (validImages.length === 0) {
        logger.error(`[UPLOAD N11] ❌ Geçerli görsel yok — "${productName}"`);
        return {
            success: false,
            error: `N11 yükleme başarısız: "${productName}" için geçerli görsel bulunamadı. ` +
                   `N11 en az 1 görsel zorunlu kılar ve URL https:// ile başlamalıdır.`
        };
    }

    // ── 5. Master Product oluştur + Auto-fix uygula ──────────────────────────
    // product zaten masterProduct formatında gelebilir (syncProductsFromMarketplace'ten)
    // ya da ham Trendyol verisi olabilir — her iki durumu da destekle
    const masterRaw = {
        // masterProductAdapter.fromTrendyol() alanlarına map et — başlık pickListingTitle + N11 min uzunluk ile uyumlu
        title:       titleForN11,
        description: product.description || "",
        barcode:     product.barcode || "",
        sku:         product.sku    || product.barcode || "",
        price:       product.price  || product.salePrice || 0,
        listPrice:   product.listPrice || product.price || 0,
        stock:       product.stock  || product.quantity || 0,
        vatRate:     product.vatRate || 20,
        category:    product.category || product.categoryName || "",
        brand:       resolveProductBrandName(product) || product.brand || "",
        images:      validImages,   // zaten filtrelenmiş
        attributes:  product.attributes || {},
        // N11 category mapping bilgisini adapter katmanına taşı
        marketplaceMappings: Array.isArray(product.marketplaceMappings) ? product.marketplaceMappings : [],
        categoryId: (() => {
            const n11Map = Array.isArray(product.marketplaceMappings)
                ? product.marketplaceMappings.find(
                    (m) => normalizeMarketplaceName(m.marketplaceName) === "N11" && m.categoryId
                )
                : null;
            return n11Map?.categoryId || product.categoryId || null;
        })(),
        shipmentTemplate: String(product.shipmentTemplate || "").trim() || undefined
    };

    // autoFix: fiyat değiştirilmez — kaynak platformdaki orijinal fiyat korunur.
    // Marka, model, başlık, açıklama gibi eksik alanlar tamamlanır.
    const fixed = masterProductAdapter.autoFix(masterRaw);

    // ── 6. N11 payload oluştur ──────────────────────────────────────────────────
    let n11Payload;
    try {
        n11Payload = await masterProductAdapter.toN11(fixed, userId, credentials);
    } catch (mappingErr) {
        logger.warn(`[UPLOAD N11] ⚠️ Payload hatası — "${productName}": ${mappingErr.message}`);

        return {
            success: false,
            skipped: true,
            reason:  "MAPPING_ERROR",
            error:   mappingErr.message
        };
    }

    const titleFix = applyN11CatalogBannedPhrases(n11Payload.title);
    if (titleFix.modified) {
        logger.warn(
            `[UPLOAD N11] Başlık N11 katalog yasaklı ifade düzeltmesi: "${n11Payload.title}" → "${titleFix.text}"`
        );
        n11Payload.title = titleFix.text;
    }
    if (n11Payload.title.length < N11_TITLE_MIN_LEN) {
        const repaired = ensureN11TitleMinLength(n11Payload.title, {
            brand: n11Payload.brand || fixed.brand,
            category: fixed.category,
            sku: stockCode,
            barcode: product.barcode
        });
        if (repaired !== n11Payload.title) {
            logger.info(`[UPLOAD N11] Yasaklı ifade sonrası başlık tekrar min. ${N11_TITLE_MIN_LEN} karaktere tamamlandı.`);
            n11Payload.title = repaired;
        }
    }
    const descFix = applyN11CatalogBannedPhrases(n11Payload.description || "");
    if (descFix.modified) {
        logger.warn(`[UPLOAD N11] Açıklama N11 katalog yasaklı ifade düzeltmesi uygulandı (özet).`);
        n11Payload.description = descFix.text;
    }

    logger.info(
        `[UPLOAD N11] Yükleniyor — "${productName}" | ` +
        `stockCode: ${stockCode} | categoryId: ${n11Payload.categoryId} | ` +
        `shipmentTemplate: "${n11Payload.shipmentTemplate}" | marka: "${n11Payload.brand}" | ` +
        `fiyat: ${n11Payload.salePrice} TL | stok: ${n11Payload.quantity} | ` +
        `görsel: ${validImages.length} adet | attribute: ${n11Payload.attributes.length} adet`
    );

    const isCatalogSuggestionMismatch = (msg = "") =>
        /kataloğa ürün önerme başarısız/i.test(msg) ||
        /ürün grubu bilgisiyle uyumlu değil/i.test(msg);

    const submitN11Payload = async (payload, attemptLabel = "ilk deneme") => {
        const result = await n11Service.createProduct(credentials, [payload], "LysiaETIC");
        if (!result.success) {
            return { success: false, error: result.error || "N11 ürün yükleme başarısız" };
        }

        const taskId = result.taskId;
        if (result.status === "REJECT") {
            const reason = Array.isArray(result.reasons) && result.reasons.length > 0
                ? result.reasons.join(", ")
                : "Ürün reddedildi";
            return { success: false, taskId, error: reason };
        }

        if (result.status === "IN_QUEUE" || result.status === "PROCESSING") {
            logger.info(`[UPLOAD N11] ⏳ Task kuyruğa alındı (${attemptLabel}) — taskId: ${taskId}, ürün: "${productName}"`);
            const pollResult = await pollN11TaskResult(credentials, taskId);
            if (pollResult.success && !pollResult.pending) {
                return { success: true, productId: stockCode, taskId, message: "Ürün N11'e başarıyla yüklendi" };
            }
            if (pollResult.success && pollResult.pending) {
                return { success: true, pending: true, productId: stockCode, taskId, message: pollResult.message || "N11 task işleniyor" };
            }
            return { success: false, taskId, error: pollResult.error || "N11 task başarısız", status: pollResult.status };
        }

        if (result.status === "COMPLETED") {
            return { success: true, productId: stockCode, taskId, message: "Ürün N11'e başarıyla yüklendi" };
        }

        return { success: false, taskId, error: `Beklenmedik N11 task durumu: ${result.status}`, status: result.status };
    };

    // ── 7. N11 API'ye gönder ─────────────────────────────────────────────────
    try {
        const firstAttempt = await submitN11Payload(n11Payload, "ilk deneme");
        if (firstAttempt.success || firstAttempt.pending) {
            logger.info(`[UPLOAD N11] ✅ Başarıyla yüklendi — "${productName}" | taskId: ${firstAttempt.taskId}`);
            return firstAttempt;
        }

        if (isCatalogSuggestionMismatch(firstAttempt.error) && n11Payload.catalogId) {
            logger.warn(
                `[UPLOAD N11] ⚠️ Katalog eşleştirme uyumsuzluğu — catalogId kaldırılarak tekrar deneniyor: "${productName}" | ` +
                `eski catalogId: ${n11Payload.catalogId}`
            );
            const retryPayload = { ...n11Payload };
            delete retryPayload.catalogId;

            const secondAttempt = await submitN11Payload(retryPayload, "catalogId fallback");
            if (secondAttempt.success || secondAttempt.pending) {
                logger.info(`[UPLOAD N11] ✅ Fallback ile yüklendi — "${productName}" | taskId: ${secondAttempt.taskId}`);
                return secondAttempt;
            }
            logger.error(
                `[UPLOAD N11] ❌ Fallback sonrası da başarısız — "${productName}" | ` +
                `sebep: ${secondAttempt.error}`
            );
            return secondAttempt;
        }

        logger.error(
            `[UPLOAD N11] ❌ Yüklenemedi — "${productName}" | taskId: ${firstAttempt.taskId || "-"} | sebep: ${firstAttempt.error}`
        );
        return firstAttempt;

    } catch (error) {
        logger.error(`[UPLOAD N11] ❌ Beklenmedik hata — "${productName}":`, error.message);
        return { success: false, error: error.message };
    }
};

// ÇiçekSepeti'ne ürün yükle
// ÇiçekSepeti POST /api/v1/Products zorunlu alanlar:
//   productName, mainProductCode, stockCode, categoryId, description,
//   deliveryMessageType (numeric), deliveryType (numeric),
//   stockQuantity, salesPrice, listPrice, images (min 1)
//
// deliveryType enum:        1=with_service, 2=with_cargo, 3=with_service_and_cargo
// deliveryMessageType enum: 1=cicek_service, 4=gift_cargo_same_day, 5=gift_cargo_1_3_days, 18=gift_cargo_1_2_days
const uploadProductToCicekSepeti = async (credentials, product) => {
    // ✅ FIX: DB'de apiKey/sellerId olarak saklanıyor — doğru alan adlarını kullan
    const apiKey       = credentials.apiKey       || credentials.apiSecret;
    const sellerId     = credentials.sellerId     || credentials.supplierId;
    const integratorName = credentials.integratorName || "";
    if (!apiKey) {
        return { success: false, error: "ÇiçekSepeti credentials eksik: apiKey gerekli" };
    }

    // ÇiçekSepeti API header'ları: x-api-key + user-agent (ASCII only)
    const cleanSellerId = String(sellerId || '').replace(/[^\x00-\x7F]/g, '');
    const cleanIntegrator = integratorName ? String(integratorName).replace(/[^\x00-\x7F]/g, '') : '';
    const userAgent = cleanIntegrator ? `${cleanSellerId} - ${cleanIntegrator}` : (cleanSellerId || "CicekSepetiIntegration");

    const productName = product.name || product.title || "İsimsiz Ürün";
    const stockCode   = product.sku || product.barcode || "";
    const barcode     = product.barcode || product.sku || "";

    // Zorunlu alan kontrolleri
    if (!stockCode) {
        return { success: false, error: `ÇiçekSepeti yükleme başarısız: "${productName}" için SKU/barkod eksik (stockCode zorunlu)` };
    }

    const salesPrice = parseFloat(product.price) || 0;
    if (salesPrice <= 0) {
        return { success: false, error: `ÇiçekSepeti yükleme başarısız: "${productName}" fiyatı geçersiz (${salesPrice} TL)` };
    }

    // Görselleri string array formatına çevir (ÇiçekSepeti string[] bekler, {url} değil)
    const images = (product.images || [])
        .map(img => {
            if (typeof img === "string") return img.trim();
            if (img && typeof img === "object" && img.url) return img.url.toString().trim();
            return null;
        })
        .filter(url => url && (url.startsWith("http://") || url.startsWith("https://")));

    // ✅ FIX: Görsel zorunlu — en az 1 görsel olmalı
    if (images.length === 0) {
        return { success: false, error: `ÇiçekSepeti yükleme başarısız: "${productName}" için en az 1 görsel gerekli` };
    }

    // ✅ FIX: categoryId zorunlu — marketplace mapping'den veya ürün verisinden al
    // Öncelik: marketplaceMappings.categoryId > product.categoryId > product.category (sayısal ise)
    let categoryId = null;

    // 1. marketplaceMappings içinden ÇiçekSepeti categoryId'yi ara
    if (product.marketplaceMappings && Array.isArray(product.marketplaceMappings)) {
        const csMapping = product.marketplaceMappings.find(
            m => (m.marketplaceName || "").toLowerCase().includes("cicek") ||
                 (m.marketplaceName || "").toLowerCase().includes("çiçek")
        );
        if (csMapping && csMapping.categoryId) {
            categoryId = parseInt(csMapping.categoryId);
        }
    }

    // 2. Doğrudan product üzerindeki categoryId
    if (!categoryId && product.categoryId) {
        categoryId = parseInt(product.categoryId);
    }

    // 3. product.category sayısal bir değerse kullan
    if (!categoryId && product.category && !isNaN(product.category)) {
        categoryId = parseInt(product.category);
    }



    if (!categoryId) {
        return {
            success: false,
            error: `ÇiçekSepeti yükleme başarısız: "${productName}" için categoryId bulunamadı. ` +
                   `Lütfen ürünün ÇiçekSepeti categoryId bilgisini kontrol edin. ` +
                   `(Mevcut kategori: "${product.category || "yok"}")`
        };
    }

    // ✅ FIX: attributes — ÇiçekSepeti kategoriye özel zorunlu attribute'lar isteyebilir
    // marketplaceMappings.customAttributes veya boş array gönder
    let attributes = [];
    if (product.marketplaceMappings && Array.isArray(product.marketplaceMappings)) {
        const csMapping = product.marketplaceMappings.find(
            m => (m.marketplaceName || "").toLowerCase().includes("cicek") ||
                 (m.marketplaceName || "").toLowerCase().includes("çiçek")
        );
        if (csMapping && csMapping.customAttributes) {
            // customAttributes Map → Array dönüşümü
            const attrs = csMapping.customAttributes;
            if (attrs instanceof Map) {
                for (const [key, val] of attrs) {
                    if (val && typeof val === "object" && val.id) {
                        attributes.push(val);
                    }
                }
            } else if (typeof attrs === "object") {
                Object.values(attrs).forEach(val => {
                    if (val && typeof val === "object" && val.id) {
                        attributes.push(val);
                    }
                });
            }
        }
    }

    const csVatParsed = parseInt(product.vatRate, 10);
    const csVatRate = Number.isNaN(csVatParsed) ? 20 : Math.max(0, Math.min(100, csVatParsed));

    try {
        const productPayload = {
            productName:        productName,
            mainProductCode:    barcode || stockCode,           // ✅ Zorunlu: Ana ürün kodu (gruplayıcı)
            stockCode:          stockCode,                      // ✅ Zorunlu: Stok kodu (varyant bazlı)
            categoryId:         categoryId,                     // ✅ FIX: Zorunlu — eksikti, 400 hatası veriyordu
            barcode:            barcode,
            description:        product.description || productName,
            salesPrice:         salesPrice,
            listPrice:          parseFloat(product.listPrice || product.price) || salesPrice,
            stockQuantity:      parseInt(product.stock) || 0,
            vatRate:            csVatRate,                      // ✅ Kategori KDV / ürün KDV — API "Kategori KDV değeri bulunamadı" önlemi
            deliveryMessageType: 5,                             // ✅ FIX: Sayısal değer — 5 = "gift_cargo_1_3_days" (kargo ile 1-3 gün)
            deliveryType:       2,                              // ✅ FIX: Sayısal değer — 2 = "with_cargo"
            isActive:           true,
            images:             images                          // ✅ FIX: string[] formatı, min 1 adet zorunlu
        };

        // Attribute varsa ekle
        if (attributes.length > 0) {
            productPayload.attributes = attributes;
        }

        const payload = { products: [productPayload] };

        logger.info(
            `[UPLOAD CİÇEKSEPETİ] Ürün yükleniyor — "${productName}" | stockCode: ${stockCode} | ` +
            `categoryId: ${categoryId} | vatRate: ${csVatRate} | fiyat: ${salesPrice} TL | stok: ${parseInt(product.stock) || 0} | ` +
            `görsel: ${images.length} adet | attribute: ${attributes.length} adet`
        );

        const response = await axios.post(
            "https://apis.ciceksepeti.com/api/v1/Products",
            payload,
            {
                headers: {
                    "x-api-key":    apiKey,
                    "user-agent":   userAgent,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            }
        );

        // ÇiçekSepeti başarılı yanıtta batchId döndürür
        const batchId = response.data?.batchId;
        if (batchId) {
            logger.info(`[UPLOAD CİÇEKSEPETİ] ✅ Ürün kuyruğa alındı — "${productName}" | batchId: ${batchId}`);
            return { success: true, productId: barcode || stockCode, batchId, response: response.data };
        }

        logger.info(`[UPLOAD CİÇEKSEPETİ] ✅ Ürün yüklendi — "${productName}" | response: ${JSON.stringify(response.data)}`);
        return { success: true, productId: barcode || stockCode, response: response.data };
    } catch (error) {
        // ✅ FIX: Hata detayını düzgün logla — tüm olası hata formatlarını yakala
        const errData = error.response?.data;
        const errCode = error.response?.status;

        // ÇiçekSepeti farklı hata formatları döndürebilir
        let errMsg = error.message;
        if (errData) {
            if (errData.message)      errMsg = errData.message;
            else if (errData.Message) errMsg = errData.Message;
            else if (errData.errorMessage) errMsg = errData.errorMessage;
            else if (errData.errors && Array.isArray(errData.errors)) errMsg = errData.errors.map(e => e.message || e.Message || JSON.stringify(e)).join(" | ");
            else if (typeof errData === "string") errMsg = errData;
            else errMsg = JSON.stringify(errData);
        }

        logger.error(
            `[UPLOAD CİÇEKSEPETİ] ❌ Hata — "${productName}" | status: ${errCode} | error: ${errMsg}` +
            (errData ? ` | raw: ${JSON.stringify(errData).substring(0, 500)}` : "")
        );
        return { success: false, error: errMsg };
    }
};

// Pazaryerine ürün yükle
const uploadProductToMarketplace = async (marketplace, product, userId = null) => {
    const marketplaceName = normalizeMarketplaceName(marketplace.marketplaceName);
    // Ana kaynak Trendyol: TY mapping'deki özellik satırları / brandId diğer platform payload'larına taşınır
    const productForUpload = prepareCrossListingProduct(product, { targetMarketplace: marketplaceName });
    // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
    const credentials = decryptCredentials(marketplace.credentials);
    try {
        const logTitle =
            productForUpload.name ||
            productForUpload.title ||
            productForUpload.productName ||
            product.name ||
            "?";
        logger.info(`[UPLOAD] ${marketplaceName}'a ürün yükleniyor: ${logTitle}`);
        switch (marketplaceName) {
            case "Trendyol":
                return await uploadProductToTrendyol(credentials, productForUpload);
            case "Hepsiburada":
                return await uploadProductToHepsiburada(credentials, productForUpload);
            case "N11":
                // userId — N11 ürün yükleme için gerekli
                return await uploadProductToN11(credentials, productForUpload, userId);
            case "ÇiçekSepeti":
                return await uploadProductToCicekSepeti(credentials, productForUpload);
            default:
                logger.warn(`[UPLOAD] ${marketplaceName} için ürün oluşturma API'si yok — yükleme yapılmadı`);
                return {
                    success: false,
                    error:
                        `${marketplaceName}: Bu pazaryeri için ürün yükleme entegrasyonu henüz yok. ` +
                        `Desteklenenler: Trendyol, Hepsiburada, N11, ÇiçekSepeti.`
                };
        }
    } catch (error) {
        logger.error(`[UPLOAD] ${marketplaceName} yükleme hatası:`, error.message);
        return { success: false, error: error.message };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TRENDYOL BATCH SONUÇ KONTROLÜ
// Ürün create sonrası dönen batchRequestId ile GET batch-requests/{id} — kesin başarı / red
// Dokümantasyon: storeFrontCode header + Accept-Language
// ─────────────────────────────────────────────────────────────────────────────
const extractTrendyolBatchItemBarcode = (item) => {
    const ri = item?.requestItem;
    if (!ri) return "";
    if (ri.product?.barcode) return String(ri.product.barcode).trim();
    if (ri.barcode) return String(ri.barcode).trim();
    if (ri.updateRequest?.barcode) return String(ri.updateRequest.barcode).trim();
    return "";
};

/** @param {string|object|null} userId - null ise tüm kullanıcılar */
const checkPendingTrendyolBatches = async (userId = null) => {
    try {
        const elemMatch = {
            marketplaceName: { $regex: /^trendyol$/i },
            syncStatus: "pending",
            trendyolBatchRequestId: { $exists: true, $nin: [null, ""] }
        };
        const query = userId
            ? { userId, marketplaceMappings: { $elemMatch: elemMatch } }
            : { marketplaceMappings: { $elemMatch: elemMatch } };

        const pendingProducts = await ProductMapping.find(query);

        if (pendingProducts.length === 0) {
            logger.info("[TY BATCH CHECK] Bekleyen Trendyol batch yok");
            return { checked: 0, updated: 0, failed: 0, inProgress: 0 };
        }

        logger.info(`[TY BATCH CHECK] ${pendingProducts.length} ürün kontrol ediliyor...`);

        const credCache = new Map();
        let updated = 0;
        let failed = 0;
        let inProgress = 0;

        const getTyCreds = async (uid) => {
            const key = uid.toString();
            if (credCache.has(key)) return credCache.get(key);
            const mp = await Marketplace.findOne({
                userId: uid,
                marketplaceName: { $regex: /^trendyol$/i }
            });
            if (!mp) {
                credCache.set(key, null);
                return null;
            }
            const c = decryptCredentials(mp.credentials);
            credCache.set(key, c);
            return c;
        };

        for (const product of pendingProducts) {
            const tyMapping = product.marketplaceMappings.find(
                (m) =>
                    normalizeMarketplaceName(m.marketplaceName) === "Trendyol" &&
                    m.syncStatus === "pending" &&
                    m.trendyolBatchRequestId
            );
            if (!tyMapping) continue;

            const creds = await getTyCreds(product.userId);
            if (!creds) {
                logger.warn(`[TY BATCH CHECK] Trendyol entegrasyonu yok — userId=${product.userId}`);
                continue;
            }

            const { apiKey, apiSecret, sellerId, supplierId } = creds;
            const actualSellerId = sellerId || supplierId;
            if (!apiKey || !apiSecret || !actualSellerId) continue;

            const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
            const headers = {
                Authorization: `Basic ${authHeader}`,
                "User-Agent": `${actualSellerId} - LysiaETIC`,
                "Content-Type": "application/json",
                storeFrontCode: process.env.TRENDYOL_STOREFRONT_CODE || "TR",
                "Accept-Language": "tr"
            };

            try {
                const batchId = tyMapping.trendyolBatchRequestId;
                const url =
                    `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}` +
                    `/products/batch-requests/${encodeURIComponent(batchId)}`;
                const resp = await axios.get(url, { headers, timeout: 20000 });
                const data = resp.data || {};
                const batchStatus = (data.status || "").toString().toUpperCase();
                tyMapping.trendyolBatchStatus = data.status;

                const btype = data.batchRequestType || "";

                if (["PRODUCTINVENTORYUPDATE", "PRODUCTUNLOCKUPDATE", "PRODUCTDELETION", "PRODUCTARCHIVEUPDATE"].includes(String(btype).replace(/\s/g, "").toUpperCase())) {
                    tyMapping.trendyolBatchRequestId = undefined;
                    await product.save();
                    await new Promise((r) => setTimeout(r, 150));
                    continue;
                }

                if (batchStatus === "IN_PROGRESS" || batchStatus === "INPROGRESS") {
                    inProgress++;
                    await product.save();
                    await new Promise((r) => setTimeout(r, 150));
                    continue;
                }

                if (batchStatus === "COMPLETED") {
                    const targetBarcode = String(product.masterProduct?.barcode || "").trim();
                    const items = Array.isArray(data.items) ? data.items : [];
                    let relevant = items.filter((it) => extractTrendyolBatchItemBarcode(it) === targetBarcode);
                    if (relevant.length === 0 && items.length === 1) relevant = items;

                    const isProductCreateBatch =
                        /onboard|productv2|create|onboarding/i.test(btype) ||
                        items.some((it) => it?.requestItem?.product);

                    if (!isProductCreateBatch) {
                        logger.info(
                            `[TY BATCH CHECK] Batch ürün oluşturma değil (${btype}) — atlandı: ${product.masterProduct?.name}`
                        );
                        tyMapping.trendyolBatchRequestId = undefined;
                        await product.save();
                        await new Promise((r) => setTimeout(r, 150));
                        continue;
                    }

                    if (relevant.length === 0) {
                        tyMapping.syncStatus = "error";
                        tyMapping.syncError =
                            `Trendyol batch tamamlandı ancak barkod eşleşmedi (batchRequestType=${btype}). Trendyol panelinden kontrol edin.`;
                        tyMapping.isSynced = false;
                        failed++;
                        await product.save();
                        await new Promise((r) => setTimeout(r, 150));
                        continue;
                    }

                    const failedItems = relevant.filter((it) => String(it.status || "").toUpperCase() === "FAILED");
                    const successItems = relevant.filter((it) => String(it.status || "").toUpperCase() === "SUCCESS");
                    const stillWorking = relevant.some((it) => {
                        const s = String(it.status || "").toUpperCase();
                        return s === "IN_PROGRESS" || s === "INPROGRESS";
                    });

                    if (stillWorking) {
                        inProgress++;
                        await product.save();
                        await new Promise((r) => setTimeout(r, 150));
                        continue;
                    }

                    if (failedItems.length > 0) {
                        const reasons = failedItems
                            .map((it) => (Array.isArray(it.failureReasons) ? it.failureReasons.join("; ") : "") || "Bilinmeyen")
                            .join(" | ");
                        tyMapping.syncStatus = "error";
                        tyMapping.syncError = `Trendyol reddetti: ${reasons}`;
                        tyMapping.isSynced = false;
                        tyMapping.lastSyncDate = new Date();
                        failed++;
                        logger.warn(
                            `[TY BATCH CHECK] ❌ "${product.masterProduct?.name}" barkod=${targetBarcode} batch=${batchId} — ${reasons}`
                        );
                    } else if (successItems.length > 0) {
                        tyMapping.syncStatus = "synced";
                        tyMapping.syncError = undefined;
                        tyMapping.isSynced = true;
                        tyMapping.marketplaceProductId = tyMapping.marketplaceProductId || targetBarcode;
                        tyMapping.trendyolBatchRequestId = undefined;
                        tyMapping.lastSyncDate = new Date();
                        updated++;
                        logger.info(`[TY BATCH CHECK] ✅ "${product.masterProduct?.name}" Trendyol'da kesinleşti`);
                    }
                    await product.save();
                } else {
                    tyMapping.syncStatus = "error";
                    tyMapping.syncError = `Trendyol batch durumu: ${data.status || "bilinmiyor"}`;
                    tyMapping.isSynced = false;
                    failed++;
                    await product.save();
                }
            } catch (err) {
                const st = err.response?.status;
                const body = err.response?.data;
                const msg = body?.errors?.[0]?.message || body?.message || err.message;
                logger.warn(`[TY BATCH CHECK] API hatası (${st}) batch=${tyMapping.trendyolBatchRequestId}: ${msg}`);
            }
            await new Promise((r) => setTimeout(r, 200));
        }

        logger.info(
            `[TY BATCH CHECK] Bitti — kontrol: ${pendingProducts.length}, kesinleşen: ${updated}, başarısız: ${failed}, işlemde: ${inProgress}`
        );
        return { checked: pendingProducts.length, updated, failed, inProgress };
    } catch (error) {
        logger.error("[TY BATCH CHECK] Genel hata:", error.message);
        return { checked: 0, updated: 0, failed: 0, inProgress: 0, error: error.message };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// N11 PENDING TASK CHECKER
// "pending" durumundaki ürünlerin N11 task sonuçlarını kontrol edip günceller
// Cron veya manuel tetiklenebilir
// ─────────────────────────────────────────────────────────────────────────────
const checkPendingN11Tasks = async (userId) => {
    try {
        // pending durumundaki N11 mapping'leri bul
        const pendingProducts = await ProductMapping.find({
            userId,
            "marketplaceMappings": {
                $elemMatch: {
                    marketplaceName: { $regex: /^n11$/i },
                    syncStatus: "pending",
                    n11TaskId: { $exists: true, $ne: null }
                }
            }
        });

        if (pendingProducts.length === 0) {
            logger.info("[N11 PENDING CHECK] Bekleyen task yok");
            return { checked: 0, updated: 0, failed: 0 };
        }

        logger.info(`[N11 PENDING CHECK] ${pendingProducts.length} ürün kontrol ediliyor...`);

        // N11 credentials'ı al
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            logger.warn("[N11 PENDING CHECK] N11 entegrasyonu bulunamadı");
            return { checked: 0, updated: 0, failed: 0, error: "N11 entegrasyonu bulunamadı" };
        }
        // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
        const credentials = decryptCredentials(marketplace.credentials);

        let updated = 0, failed = 0;

        for (const product of pendingProducts) {
            const n11Mapping = product.marketplaceMappings.find(
                m => normalizeMarketplaceName(m.marketplaceName) === "N11" && m.syncStatus === "pending" && m.n11TaskId
            );
            if (!n11Mapping) continue;

            try {
                const taskResult = await n11Service.getTaskDetails(credentials, n11Mapping.n11TaskId);
                if (!taskResult.success) continue;

                const status = taskResult.data?.status;
                const failedSkus = taskResult.data?.failedSkus || [];

                if (status === "COMPLETED" || status === "PROCESSED") {
                    if (failedSkus.length > 0) {
                        // Task tamamlandı ama SKU başarısız
                        const reason = failedSkus.map(s => `${s.itemCode}: ${(s.reasons || []).join(", ")}`).join(" | ");
                        n11Mapping.syncStatus = "error";
                        n11Mapping.syncError = reason;
                        n11Mapping.n11TaskStatus = "FAILED";
                        n11Mapping.isSynced = false;
                        failed++;
                        logger.warn(`[N11 PENDING CHECK] ❌ Task başarısız — "${product.masterProduct?.name}" | sebep: ${reason}`);
                    } else {
                        // Başarılı!
                        n11Mapping.syncStatus = "synced";
                        n11Mapping.syncError = undefined;
                        n11Mapping.n11TaskStatus = "COMPLETED";
                        n11Mapping.isSynced = true;
                        updated++;
                        logger.info(`[N11 PENDING CHECK] ✅ Kesinleşti — "${product.masterProduct?.name}"`);
                    }
                    await product.save();
                } else if (status === "REJECT" || status === "FAILED" || status === "ERROR") {
                    const reasons = taskResult.data?.reasons || [];
                    n11Mapping.syncStatus = "error";
                    n11Mapping.syncError = reasons.length > 0 ? reasons.join(", ") : `N11 task reddedildi (${status})`;
                    n11Mapping.n11TaskStatus = status;
                    n11Mapping.isSynced = false;
                    await product.save();
                    failed++;
                    logger.warn(`[N11 PENDING CHECK] ❌ Task reddedildi — "${product.masterProduct?.name}" | status: ${status}`);
                }
                // IN_QUEUE/PROCESSING → hâlâ bekliyor, bir sonraki kontrolde tekrar denenecek
            } catch (err) {
                logger.warn(`[N11 PENDING CHECK] Task kontrol hatası — taskId: ${n11Mapping.n11TaskId}: ${err.message}`);
            }
        }

        logger.info(`[N11 PENDING CHECK] Tamamlandı — kontrol: ${pendingProducts.length}, kesinleşen: ${updated}, başarısız: ${failed}`);
        return { checked: pendingProducts.length, updated, failed };
    } catch (error) {
        logger.error("[N11 PENDING CHECK] Genel hata:", error.message);
        return { checked: 0, updated: 0, failed: 0, error: error.message };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// HEPSIBURADA PENDING TRACKING CHECKER
// "pending" durumundaki HB yüklemelerin tracking sonuçlarını kontrol eder
// ─────────────────────────────────────────────────────────────────────────────
const checkPendingHepsiburadaUploads = async (userId) => {
    try {
        const pendingProducts = await ProductMapping.find({
            userId,
            marketplaceMappings: {
                $elemMatch: {
                    marketplaceName: { $regex: /^hepsiburada$/i },
                    hepsiburadaTrackingId: { $exists: true, $nin: [null, ""] },
                    $or: [
                        { syncStatus: "pending" },
                        { syncStatus: "synced", hepsiburadaListingReady: false }
                    ]
                }
            }
        });

        if (pendingProducts.length === 0) {
            logger.info("[HB PENDING CHECK] Bekleyen tracking yok");
            return { checked: 0, updated: 0, failed: 0, inProgress: 0 };
        }

        const hbService = require("./hepsiburadaService");
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^hepsiburada$/i }
        });
        if (!marketplace) {
            logger.warn("[HB PENDING CHECK] Hepsiburada entegrasyonu bulunamadı");
            return { checked: 0, updated: 0, failed: 0, inProgress: 0, error: "Hepsiburada entegrasyonu bulunamadı" };
        }
        const hbCreds = hbService.normalizeCredentials(decryptCredentials(marketplace.credentials));
        if (!hbCreds.merchantId || !hbCreds.secretKey) {
            logger.warn("[HB PENDING CHECK] Hepsiburada credentials eksik");
            return { checked: 0, updated: 0, failed: 0, inProgress: 0, error: "Hepsiburada credentials eksik" };
        }

        let updated = 0;
        let failed = 0;
        let inProgress = 0;
        for (const product of pendingProducts) {
            const hbMapping = product.marketplaceMappings.find(
                (m) => normalizeMarketplaceName(m.marketplaceName) === "Hepsiburada" &&
                    m.hepsiburadaTrackingId &&
                    (m.syncStatus === "pending" ||
                        (m.syncStatus === "synced" && m.hepsiburadaListingReady === false))
            );
            if (!hbMapping) continue;

            try {
                const trId = String(hbMapping.hepsiburadaTrackingId);
                const statusRes = await hbService.checkProductStatus(
                    hbCreds.merchantId,
                    hbCreds.secretKey,
                    trId,
                    hbCreds.userAgent,
                    hbCreds
                );
                if (!statusRes.success) {
                    inProgress++;
                    continue;
                }
                const poll = hbService.classifyHepsiburadaTrackingPoll(statusRes.data || {}, { strictListing: true });

                if (poll.kind === "success") {
                    const st = poll.detail || poll.sum.importStatus || poll.sum.productStatus || "COMPLETED";
                    hbMapping.syncStatus = "synced";
                    hbMapping.isSynced = true;
                    hbMapping.syncError = undefined;
                    hbMapping.hepsiburadaListingReady = true;
                    hbMapping.hepsiburadaTrackingStatus = st;
                    updated++;
                    await product.save();
                    logger.info(
                        `[HB PENDING CHECK] ✅ Kesinleşti — "${product.masterProduct?.name}" | trackingId=${trId} ` +
                        `importStatus=${poll.sum.importStatus || "-"} productStatus=${poll.sum.productStatus || "-"}`
                    );
                    continue;
                }

                if (poll.kind === "failed") {
                    const detail = poll.detail || "Hepsiburada tracking sonucu başarısız";
                    hbMapping.syncStatus = "error";
                    hbMapping.isSynced = false;
                    hbMapping.hepsiburadaListingReady = false;
                    hbMapping.syncError = String(detail).substring(0, 500);
                    hbMapping.hepsiburadaTrackingStatus = poll.sum.importStatus || poll.sum.productStatus || "FAILED";
                    failed++;
                    await product.save();
                    logger.warn(`[HB PENDING CHECK] ❌ Başarısız — "${product.masterProduct?.name}" | trackingId=${trId} | ${detail}`);
                    continue;
                }

                const emptyTrack = hbService.isHepsiburadaTrackingPayloadEmpty(statusRes.data || {});
                if (emptyTrack) {
                    const ms = String(hbMapping.marketplaceSku || product.masterProduct?.sku || "").trim();
                    if (ms) {
                        const probe = await hbService.probeMpopProductByMerchantSku(
                            hbCreds.merchantId,
                            hbCreds.secretKey,
                            hbCreds.userAgent,
                            ms,
                            hbCreds
                        );
                        const mpRes = hbService.buildUploadResultFromMpopProbe(probe, ms, trId, null);
                        if (mpRes) {
                            if (!mpRes.success) {
                                hbMapping.syncStatus = "error";
                                hbMapping.isSynced = false;
                                hbMapping.hepsiburadaListingReady = false;
                                hbMapping.syncError = String(mpRes.error || "MPOP REJECTED").substring(0, 500);
                                hbMapping.hepsiburadaTrackingStatus = "REJECTED";
                                failed++;
                                await product.save();
                                logger.warn(
                                    `[HB PENDING CHECK] ❌ MPOP reddi — "${product.masterProduct?.name}" | ${mpRes.error}`
                                );
                                continue;
                            }
                            if (mpRes.listingReady === true) {
                                hbMapping.syncStatus = "synced";
                                hbMapping.isSynced = true;
                                hbMapping.syncError = undefined;
                                hbMapping.hepsiburadaListingReady = true;
                                hbMapping.hepsiburadaTrackingStatus = mpRes.hbMpopProductStatus || "MPOP_OK";
                                if (mpRes.hepsiburadaSku) hbMapping.marketplaceProductId = String(mpRes.hepsiburadaSku);
                                updated++;
                                await product.save();
                                logger.info(
                                    `[HB PENDING CHECK] ✅ MPOP doğrulandı (tracking boş) — "${product.masterProduct?.name}" | ` +
                                    `sku=${ms} status=${mpRes.hbMpopProductStatus}`
                                );
                                continue;
                            }
                            hbMapping.syncStatus = "pending";
                            hbMapping.isSynced = false;
                            hbMapping.hepsiburadaListingReady = false;
                            hbMapping.hepsiburadaTrackingStatus = mpRes.hbMpopProductStatus || "MPOP_PIPELINE";
                            hbMapping.syncError =
                                "Hepsiburada: ürün MPOP’ta — henüz satışa açılmadı (onay bekleniyor)";
                            inProgress++;
                            await product.save();
                            continue;
                        }
                    }
                }

                const st = poll.detail || poll.sum.importStatus || "PROCESSING";
                hbMapping.hepsiburadaTrackingStatus = st || "PROCESSING";
                inProgress++;
                await product.save();
            } catch (err) {
                inProgress++;
                logger.warn(`[HB PENDING CHECK] Tracking kontrol hatası: ${err.message}`);
            }
        }

        logger.info(`[HB PENDING CHECK] Tamamlandı — kontrol: ${pendingProducts.length}, kesinleşen: ${updated}, başarısız: ${failed}, işlemde: ${inProgress}`);
        return { checked: pendingProducts.length, updated, failed, inProgress };
    } catch (error) {
        logger.error("[HB PENDING CHECK] Genel hata:", error.message);
        return { checked: 0, updated: 0, failed: 0, inProgress: 0, error: error.message };
    }
};

// ═══════════════════════════════════════════════════════════════
// 🗑️ PAZARYERLERINDEN ÜRÜN SİLME / DEVRE DIŞI BIRAKMA
// ═══════════════════════════════════════════════════════════════

/**
 * Ürünü pazaryerlerinden sil/devre dışı bırak
 *
 * Strateji (platform bazlı):
 *   - Trendyol:     Stok=0 gönder (Trendyol API'de ürün silme yok, stok 0 = satışa kapalı)
 *   - N11:          Stok=0 gönder (N11 REST API'de ürün silme yok)
 *   - Hepsiburada:  Stok=0 gönder
 *   - ÇiçekSepeti:  Stok=0 gönder
 *   - Amazon:       DELETE /listings API ile listing'i kaldır
 *
 * @param {String} userId
 * @param {Object} productMapping — Mongoose document (masterProduct + marketplaceMappings)
 * @param {Array}  targetPlatforms — Silinecek platform isimleri (boş = tümü)
 * @returns {Array} — Her platform için { name, status, message }
 */
const deleteProductFromMarketplaces = async (userId, productMapping, targetPlatforms = []) => {
    const results = [];
    const mappings = productMapping.marketplaceMappings || [];

    if (mappings.length === 0) {
        return [{ name: "—", status: "skipped", message: "Ürün hiçbir pazaryerinde yok" }];
    }

    for (const mp of mappings) {
        const mpName = normalizeMarketplaceName(mp.marketplaceName);

        // Hedef platform filtresi (boş array = tümü)
        if (targetPlatforms.length > 0) {
            const normalizedTargets = targetPlatforms.map(t => normalizeMarketplaceName(t));
            if (!normalizedTargets.includes(mpName)) {
                results.push({ name: mpName, status: "skipped", message: "Hedef listesinde değil" });
                continue;
            }
        }

        try {
            // Pazaryeri entegrasyonunu bul
            const marketplace = await Marketplace.findOne({
                userId,
                marketplaceName: { $regex: new RegExp(`^${mpName}$`, "i") }
            });

            if (!marketplace) {
                results.push({ name: mpName, status: "error", message: `${mpName} entegrasyonu bulunamadı` });
                continue;
            }

            const credentials = decryptCredentials(marketplace.credentials);

            // Ürün tanımlayıcıları (platform bazlı farklı ID'ler gerekebilir)
            const barcode = mp.marketplaceBarcode || mp.marketplaceSku ||
                            productMapping.masterProduct?.barcode ||
                            productMapping.masterProduct?.sku;
            const sku = mp.marketplaceSku || mp.marketplaceBarcode ||
                        productMapping.masterProduct?.sku ||
                        productMapping.masterProduct?.barcode;
            const n11ProductId = mp.marketplaceProductId; // N11 silme için n11ProductId gerekli

            const productId = sku || barcode || n11ProductId;

            if (!productId) {
                results.push({ name: mpName, status: "error", message: "Ürün tanımlayıcı (SKU/barcode) bulunamadı" });
                continue;
            }

            logger.info(`[PRODUCT DELETE] ${mpName} — ürün siliniyor: ${productId}${n11ProductId ? ` (n11Id: ${n11ProductId})` : ""}`);

            let deleteResult;

            switch (mpName) {
                case "Trendyol": {
                    // ✅ Trendyol: 3 aşamalı silme stratejisi
                    // 1) Stok=0 yap (hemen satıştan kaldır)
                    // 2) Arşive al (PUT /archive-state → archived: true)
                    // 3) DELETE ile tamamen sil (sadece 1+ gün arşivde olan ürünler silinebilir)
                    //    DELETE başarısız olursa → PendingDeletion kaydı oluştur, cron 25 saat sonra tekrar dener
                    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
                    const actualSellerId = sellerId || supplierId;
                    if (!apiKey || !apiSecret || !actualSellerId) {
                        deleteResult = { success: false, error: "Trendyol credentials eksik" };
                        break;
                    }
                    const trendyolBarcode = mp.marketplaceBarcode || mp.marketplaceSku ||
                                            productMapping.masterProduct?.barcode ||
                                            productMapping.masterProduct?.sku;
                    if (!trendyolBarcode) {
                        deleteResult = { success: false, error: "Trendyol barcode bulunamadı" };
                        break;
                    }
                    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
                    const trendyolHeaders = {
                        Authorization: `Basic ${authHeader}`,
                        "User-Agent": `${actualSellerId} - LysiaETIC`,
                        "Content-Type": "application/json"
                    };
                    const barcodeStr = String(trendyolBarcode).trim();

                    // Adım 1: Stok=0 yap — ürünü hemen satıştan kaldır
                    try {
                        await axios.post(
                            `https://apigw.trendyol.com/integration/inventory/sellers/${actualSellerId}/products/price-and-inventory`,
                            { items: [{ barcode: barcodeStr, quantity: 0 }] },
                            { headers: trendyolHeaders, timeout: 15000 }
                        );
                        logger.info(`[PRODUCT DELETE] Trendyol Adım 1/3 ✅ Stok=0 yapıldı: ${barcodeStr}`);
                    } catch (stockErr) {
                        logger.warn(`[PRODUCT DELETE] Trendyol Adım 1/3 ⚠️ Stok=0 başarısız: ${stockErr.response?.data?.errors?.[0]?.message || stockErr.message}`);
                    }

                    // Adım 2: Arşive al — ürünü Trendyol'da görünmez yap
                    let archiveSuccess = false;
                    try {
                        const archiveResp = await axios.put(
                            `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/products/archive-state`,
                            { items: [{ barcode: barcodeStr, archived: true }] },
                            { headers: trendyolHeaders, timeout: 15000 }
                        );
                        archiveSuccess = true;
                        logger.info(`[PRODUCT DELETE] Trendyol Adım 2/3 ✅ Arşive alındı: ${barcodeStr} (batchId: ${archiveResp.data?.batchRequestId})`);
                    } catch (archiveErr) {
                        logger.warn(`[PRODUCT DELETE] Trendyol Adım 2/3 ⚠️ Arşive alma başarısız: ${archiveErr.response?.data?.errors?.[0]?.message || archiveErr.message}`);
                    }

                    // Adım 3: DELETE ile tamamen sil
                    // Trendyol kuralı: Sadece 1+ gün arşivde olan ürünler silinebilir
                    // Yeni arşivlenen ürünler için DELETE başarısız olacak → PendingDeletion'a kaydet
                    try {
                        const deleteResp = await axios.delete(
                            `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/products`,
                            {
                                data: { items: [{ barcode: barcodeStr }] },
                                headers: trendyolHeaders,
                                timeout: 15000
                            }
                        );
                        deleteResult = { success: true, batchId: deleteResp.data?.batchRequestId };
                        logger.info(`[PRODUCT DELETE] Trendyol Adım 3/3 ✅ Ürün tamamen silindi: ${barcodeStr} (batchId: ${deleteResp.data?.batchRequestId})`);
                        // Eğer PendingDeletion kaydı varsa tamamlandı olarak işaretle
                        await PendingDeletion.findOneAndUpdate(
                            { userId, marketplace: "Trendyol", barcode: barcodeStr },
                            { status: "completed", completedAt: new Date() }
                        ).catch(() => {});
                    } catch (deleteErr) {
                        const errMsg = deleteErr.response?.data?.errors?.[0]?.message || deleteErr.message;
                        logger.warn(`[PRODUCT DELETE] Trendyol Adım 3/3 ⚠️ DELETE başarısız (${errMsg}) — 25 saat sonra otomatik silinecek`);

                        // PendingDeletion kaydı oluştur — cron job 25 saat sonra tekrar deneyecek
                        try {
                            await PendingDeletion.findOneAndUpdate(
                                { userId, marketplace: "Trendyol", barcode: barcodeStr },
                                {
                                    userId,
                                    marketplace: "Trendyol",
                                    barcode: barcodeStr,
                                    sku: sku || barcodeStr,
                                    productName: productMapping.masterProduct?.name || barcodeStr,
                                    marketplaceId: marketplace._id,
                                    archivedAt: new Date(),
                                    status: "pending",
                                    lastAttemptAt: new Date(),
                                    lastError: errMsg
                                },
                                { upsert: true, new: true }
                            );
                            logger.info(`[PRODUCT DELETE] Trendyol — PendingDeletion kaydı oluşturuldu: ${barcodeStr} (25 saat sonra otomatik silinecek)`);
                        } catch (pdErr) {
                            logger.error(`[PRODUCT DELETE] PendingDeletion kayıt hatası: ${pdErr.message}`);
                        }

                        // Ürün arşivde ve stok=0 — satışta değil, ama henüz tamamen silinmedi
                        deleteResult = { success: true, pendingFullDelete: true };
                    }
                    break;
                }

                case "N11": {
                    // ✅ N11: Gerçek DELETE — SOAP DeleteProductById ile tamamen siler
                    // n11ProductId gerekli (marketplaceProductId alanında saklanıyor)
                    const { apiKey: n11Key, secretKey } = credentials;
                    if (!n11Key || !secretKey) {
                        deleteResult = { success: false, error: "N11 credentials eksik" };
                        break;
                    }
                    if (n11ProductId) {
                        // n11ProductId varsa gerçek silme yap
                        deleteResult = await n11Service.deleteProductById(credentials, n11ProductId);
                        if (!deleteResult.success) {
                            // Gerçek silme başarısız → fallback: stok=0
                            logger.warn(`[PRODUCT DELETE] N11 DELETE başarısız (${deleteResult.error}), stok=0 fallback deneniyor...`);
                            deleteResult = await n11Service.updateProductPriceAndStock(
                                credentials,
                                [{ stockCode: sku, quantity: 0 }],
                                "LysiaETIC"
                            );
                            if (deleteResult.success) deleteResult.fallback = true;
                        }
                    } else {
                        // n11ProductId yoksa sadece stok=0 yapabiliriz
                        logger.warn(`[PRODUCT DELETE] N11 — n11ProductId yok, stok=0 fallback kullanılıyor`);
                        deleteResult = await n11Service.updateProductPriceAndStock(
                            credentials,
                            [{ stockCode: sku, quantity: 0 }],
                            "LysiaETIC"
                        );
                        if (deleteResult.success) deleteResult.fallback = true;
                    }
                    break;
                }

                case "Amazon": {
                    // ✅ Amazon: Listing'i tamamen sil (DELETE API)
                    const amazonService = require("./amazon/amazonSpApiService");
                    deleteResult = await amazonService.deleteListingsItem(credentials, productId);
                    break;
                }

                case "Hepsiburada": {
                    // ✅ Hepsiburada: 3 aşamalı silme stratejisi
                    // 1) Listing Deactivate — satıştan kaldır
                    // 2) Stok=0 gönder — satışı tamamen kapat
                    // 3) Listing Silme (DELETE) — tamamen sil
                    const {
                        normalizeCredentials: normHbCreds,
                        getHeaders: getHbHeaders,
                        getEndpoints: getHbEndpoints,
                        postInventoryUploadListing: hbPostInventory,
                        normalizeHbMerchantSku: normHbSku
                    } = require("./hepsiburadaService");
                    const hbDelCreds = normHbCreds(credentials);
                    if (!hbDelCreds.merchantId || !hbDelCreds.secretKey) {
                        deleteResult = { success: false, error: "Hepsiburada credentials eksik" };
                        break;
                    }
                    const hbEp = getHbEndpoints(hbDelCreds);
                    const hbHeaders = getHbHeaders(hbDelCreds.merchantId, hbDelCreds.secretKey, hbDelCreds.userAgent);

                    const hbSku = mp.marketplaceBarcode || mp.marketplaceSku || productMapping.masterProduct?.barcode || productMapping.masterProduct?.sku;
                    const merchantSku = mp.marketplaceSku || mp.marketplaceBarcode || productMapping.masterProduct?.sku || productMapping.masterProduct?.barcode;

                    if (!hbSku) {
                        deleteResult = { success: false, error: "Hepsiburada SKU bulunamadı" };
                        break;
                    }

                    // Adım 1: Listing Deactivate — satıştan kaldır
                    try {
                        await axios.post(
                            `${hbEp.LISTING}/listings/merchantid/${hbDelCreds.merchantId}/sku/${hbSku}/deactivate`,
                            {},
                            { headers: hbHeaders, timeout: 15000 }
                        );
                        logger.info(`[PRODUCT DELETE] Hepsiburada Adım 1/3 ✅ Listing deactivate: ${hbSku}`);
                    } catch (deactErr) {
                        logger.warn(`[PRODUCT DELETE] Hepsiburada Adım 1/3 ⚠️ Deactivate başarısız: ${deactErr.response?.data?.message || deactErr.response?.data || deactErr.message}`);
                    }

                    // Adım 2: Stok=0 gönder — satışı tamamen kapat
                    try {
                        await hbPostInventory({
                            ep: hbEp,
                            merchantId: hbDelCreds.merchantId,
                            secretKey: hbDelCreds.secretKey,
                            userAgent: hbDelCreds.userAgent,
                            rows: [{
                                hepsiburadaSku: String(hbSku).trim(),
                                merchantSku: normHbSku(merchantSku) || String(merchantSku || hbSku).trim(),
                                availableStock: 0
                            }]
                        });
                        logger.info(`[PRODUCT DELETE] Hepsiburada Adım 2/3 ✅ Stok=0 yapıldı: ${hbSku}`);
                    } catch (stockErr) {
                        logger.warn(`[PRODUCT DELETE] Hepsiburada Adım 2/3 ⚠️ Stok=0 başarısız: ${stockErr.response?.data?.message || stockErr.message}`);
                    }

                    // Adım 3: Listing Silme (DELETE) — tamamen sil
                    try {
                        await axios.delete(
                            `${hbEp.LISTING}/listings/merchantid/${hbDelCreds.merchantId}/sku/${hbSku}/merchantsku/${merchantSku}`,
                            { headers: hbHeaders, timeout: 15000 }
                        );
                        deleteResult = { success: true };
                        logger.info(`[PRODUCT DELETE] Hepsiburada Adım 3/3 ✅ Listing tamamen silindi: ${hbSku}`);
                    } catch (delErr) {
                        const errMsg = delErr.response?.data?.message || delErr.response?.data || delErr.message;
                        logger.warn(`[PRODUCT DELETE] Hepsiburada Adım 3/3 ⚠️ DELETE başarısız (${errMsg}) — listing deaktif ve stok=0`);
                        deleteResult = { success: true, archived: true };
                    }
                    break;
                }

                case "ÇiçekSepeti": {
                    // ✅ ÇiçekSepeti: 2 aşamalı silme stratejisi
                    // 1) Stok=0 + Fiyat=0 → ürün "Satışa Kapalı" / "Stoğu Tükenen" durumuna geçer
                    // 2) Ürün bilgilerini güncelle — isActive: false (varsa)
                    // Not: ÇiçekSepeti'nin gerçek silme API'si yok, ama stok=0 ürünü satıştan kaldırır
                    const csApiKey = credentials.apiKey || credentials.apiSecret;
                    const csSellerId = credentials.sellerId || credentials.supplierId;
                    const csIntegrator = credentials.integratorName || "";
                    if (!csApiKey) {
                        deleteResult = { success: false, error: "ÇiçekSepeti credentials eksik" };
                        break;
                    }
                    const cleanSid = String(csSellerId || "").replace(/[^\x00-\x7F]/g, "");
                    const cleanInt = csIntegrator ? String(csIntegrator).replace(/[^\x00-\x7F]/g, "") : "";
                    const ua = cleanInt ? `${cleanSid} - ${cleanInt}` : (cleanSid || "CicekSepetiIntegration");
                    const csHeaders = { "x-api-key": csApiKey, "user-agent": ua, "Content-Type": "application/json" };

                    const csStockCode = mp.marketplaceSku || mp.marketplaceBarcode ||
                                        productMapping.masterProduct?.sku ||
                                        productMapping.masterProduct?.barcode;

                    if (!csStockCode) {
                        deleteResult = { success: false, error: "ÇiçekSepeti stok kodu bulunamadı" };
                        break;
                    }

                    // Adım 1: Stok=0 + Fiyat=0 → satıştan kaldır
                    try {
                        await axios.put(
                            `https://apis.ciceksepeti.com/api/v1/Products/price-and-stock`,
                            { items: [{ stockCode: csStockCode, stockQuantity: 0, salesPrice: 0, listPrice: 0 }] },
                            { headers: csHeaders, timeout: 15000 }
                        );
                        logger.info(`[PRODUCT DELETE] ÇiçekSepeti Adım 1/2 ✅ Stok=0 + Fiyat=0 yapıldı: ${csStockCode}`);
                    } catch (stockErr) {
                        logger.warn(`[PRODUCT DELETE] ÇiçekSepeti Adım 1/2 ⚠️ Stok/fiyat sıfırlama başarısız: ${stockErr.response?.data?.message || stockErr.message}`);
                    }

                    // Adım 2: Ürünü güncelle — açıklamayı "[SİLİNDİ]" yap, satışa kapalı olarak işaretle
                    try {
                        await axios.put(
                            `https://apis.ciceksepeti.com/api/v1/Products`,
                            { products: [{ stockCode: csStockCode, isActive: false }] },
                            { headers: csHeaders, timeout: 15000 }
                        );
                        deleteResult = { success: true };
                        logger.info(`[PRODUCT DELETE] ÇiçekSepeti Adım 2/2 ✅ Ürün deaktif edildi: ${csStockCode}`);
                    } catch (updateErr) {
                        const errMsg = updateErr.response?.data?.message || updateErr.message;
                        logger.warn(`[PRODUCT DELETE] ÇiçekSepeti Adım 2/2 ⚠️ Deaktif başarısız (${errMsg}) — stok=0 ile satışta değil`);
                        // Stok=0 yapıldıysa ürün zaten satışta değil
                        deleteResult = { success: true, archived: true };
                    }
                    break;
                }

                default:
                    deleteResult = { success: false, error: `${mpName} için silme API'si desteklenmiyor` };
            }

            if (deleteResult.success) {
                let method;
                if (deleteResult.fallback) {
                    method = "Stok 0'a çekildi (satışa kapalı)";
                } else if (deleteResult.pendingFullDelete) {
                    // Trendyol: Arşive alındı, 25 saat sonra otomatik silinecek
                    method = "Ürün arşive alındı ve satıştan kaldırıldı — 25 saat içinde otomatik olarak tamamen silinecek";
                } else if (deleteResult.archived) {
                    // Platform bazlı açıklayıcı mesajlar
                    if (mpName === "Hepsiburada") method = "Listing deaktif edildi ve stok sıfırlandı (satışta değil)";
                    else if (mpName === "ÇiçekSepeti") method = "Ürün deaktif edildi ve stok/fiyat sıfırlandı (satışta değil)";
                    else method = "Ürün satıştan kaldırıldı ve deaktif edildi";
                } else {
                    method = "Ürün tamamen silindi";
                }
                logger.info(`[PRODUCT DELETE] ✅ ${mpName} — ${method}: ${productId}`);
                results.push({ name: mpName, status: "success", message: method });
            } else {
                logger.error(`[PRODUCT DELETE] ❌ ${mpName} — hata: ${deleteResult.error}`);
                results.push({ name: mpName, status: "error", message: deleteResult.error });
            }

        } catch (error) {
            logger.error(`[PRODUCT DELETE] ${mpName} beklenmedik hata:`, error.message);
            results.push({ name: mpName, status: "error", message: error.message });
        }
    }

    return results;
};

module.exports = {
    fetchProductsFromMarketplace,
    syncProductsFromMarketplace,
    distributeProductToMarketplaces,
    uploadProductToMarketplace,
    normalizeMarketplaceName,
    checkPendingN11Tasks,
    checkPendingHepsiburadaUploads,
    checkPendingTrendyolBatches,
    deleteProductFromMarketplaces,
    fetchTrendyolCategoryAttributes,
    fetchTrendyolBrands,
    buildTrendyolAttributesForCreate
};
