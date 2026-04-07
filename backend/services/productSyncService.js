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
    if (n === "amazon")                            return "Amazon";
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
                    const master = masterProductAdapter.fromTrendyol(p);
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
                        brand:      master.brand,
                        images:     master.images,
                        attributes: master.attributes
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
    // Hepsiburada API Format:
    // merchantId: Mağaza ID (sayısal, örn: "123456")
    // username: API kullanıcı adı (UUID formatında, örn: "825f9afd-e1c5-4416-9dbd-632f70730568")
    // password: API şifresi (UUID formatında)
    // Authorization: Basic base64(username:password)
    const { merchantId, username, password, apiKey } = credentials;

    // Geriye dönük uyumluluk: apiKey varsa username olarak kullan
    const actualUsername = username || apiKey;
    const actualPassword = password || credentials.apiSecret || credentials.secretKey;

    if (!merchantId || !actualUsername || !actualPassword) {
        throw new Error(
            "Hepsiburada credentials eksik. Gerekli alanlar:\n" +
            "- merchantId: Mağaza ID (sayısal)\n" +
            "- username: API kullanıcı adı (UUID)\n" +
            "- password: API şifresi (UUID)\n" +
            "Hepsiburada Paneli → Entegrasyonlar → API Bilgileri'nden alabilirsiniz."
        );
    }

    const authHeader = `Basic ${Buffer.from(`${actualUsername}:${actualPassword}`).toString("base64")}`;

    logger.info(
        `[Hepsiburada] Ürün çekme başlatılıyor — merchantId: ${merchantId}, ` +
        `username: ${actualUsername.substring(0, 8)}...`
    );

    const products = [];
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await axios.get(
                `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}`,
                {
                    headers: {
                        Authorization: authHeader,
                        "User-Agent": "LysiaETIC",
                        "Content-Type": "application/json"
                    },
                    params: { offset, limit },
                    timeout: 15000
                }
            );

            const items = response.data?.listings || [];
            if (items.length === 0) {
                hasMore = false;
            } else {
                products.push(...items.map(p => ({
                    marketplaceProductId: p.hepsiburadaSku,
                    barcode: p.merchantSku,
                    sku: p.merchantSku,
                    name: p.productName,
                    price: p.price,
                    listPrice: p.listPrice || p.price,
                    stock: p.availableStock,
                    category: p.categoryName,
                    images: p.imageUrl ? [p.imageUrl] : [],
                    attributes: {}
                })));
                offset += limit;
            }
        } catch (error) {
            logger.error("Hepsiburada ürün çekme hatası:", error.response?.data || error.message);
            hasMore = false;
            if (offset === 0 && products.length === 0) {
                throw error;
            }
        }
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
const syncProductsFromMarketplace = async (userId, marketplaceId, marketplaceName) => {
    const normalizedName = normalizeMarketplaceName(marketplaceName);
    try {
        logger.info(`[SYNC] ${normalizedName} ürünleri çekiliyor...`);

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

        // Pazaryerinden ürünleri çek
        const marketplaceProducts = await fetchProductsFromMarketplace(marketplace);

        if (!marketplaceProducts || marketplaceProducts.length === 0) {
            logger.info(`[SYNC] ${normalizedName} - Hiç ürün bulunamadı`);
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
            // Marketplace product ID ile de eşleştir
            for (const mp of (m.marketplaceMappings || [])) {
                if (mp.marketplaceProductId) mappingByMpId.set(mp.marketplaceProductId, m);
            }
        }

        // 🔧 Kullanıcının eşleştirme öncelik sırasını getir
        const matchPriority = await getUserMatchPriority(userId);
        logger.info(`[SYNC] Eşleştirme önceliği: 1) ${matchPriority.primary} 2) ${matchPriority.secondary} 3) ${matchPriority.tertiary}`);

        const lookupMaps = { mappingBySku, mappingByBarcode, mappingByName, mappingByMpId };

        // ── Adım 2: Ürünleri işle ve kaydet (batch paralel) ──
        const logEntries = []; // Toplu log için biriktir
        const BATCH_SIZE = 20;

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

                    const mpData = {
                        marketplaceName: normalizedName,
                        marketplaceProductId: product.marketplaceProductId || "",
                        marketplaceSku: product.sku || "",
                        marketplaceBarcode: product.barcode || "",
                        price: product.price || 0,
                        listPrice: product.listPrice || product.price || 0,
                        stock: product.stock || 0,
                        categoryName: product.category || "",
                        pulledFromMarketplace: true,
                        pullDate: new Date(),
                        isSynced: true,
                        lastSyncDate: new Date(),
                        syncStatus: "synced"
                    };

                    if (mapping) {
                        // Mevcut ürün — pazaryeri mapping'ini güncelle
                        const mpIndex = mapping.marketplaceMappings.findIndex(
                            m => normalizeMarketplaceName(m.marketplaceName) === normalizedName
                        );

                        if (mpIndex >= 0) {
                            Object.assign(mapping.marketplaceMappings[mpIndex], mpData);
                        } else {
                            mapping.marketplaceMappings.push(mpData);
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

                        // 🛡️ Eksik master verileri marketplace'ten doldur (kategorisi boş ise güncelle)
                        if (!mapping.masterProduct.category && product.category) {
                            mapping.masterProduct.category = product.category;
                        }

                        await mapping.save();

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
                                Object.assign(finalCheck.marketplaceMappings[mpIdx], mpData);
                            } else {
                                finalCheck.marketplaceMappings.push(mpData);
                            }
                            if (product.price) finalCheck.masterProduct.price = product.price;
                            if (product.listPrice) finalCheck.masterProduct.listPrice = product.listPrice;
                            if (!finalCheck.masterProduct.category && product.category) {
                                finalCheck.masterProduct.category = product.category;
                            }
                            await finalCheck.save();

                            // Map'e ekle
                            if (finalCheck.masterProduct.barcode) mappingByBarcode.set(finalCheck.masterProduct.barcode, finalCheck);
                            if (finalCheck.masterProduct.sku) mappingBySku.set(finalCheck.masterProduct.sku, finalCheck);

                            logger.info(`[SYNC] Duplike önlendi — mevcut ürün güncellendi: ${finalCheck.masterProduct.name} (SKU: ${finalCheck.masterProduct.sku})`);
                            return { status: "updated" };
                        }

                        // Gerçekten yeni ürün — oluştur
                        const stockVal = product.stock || 0;
                        const productCategory = (product.category || "").trim();

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
                                attributes: product.attributes || {}
                            },
                            marketplaceMappings: [mpData],
                            stockTracking: {
                                totalStock: stockVal,
                                availableStock: stockVal,
                                lowStockThreshold: 10
                            }
                        });

                        newMapping.updateStockStatus();
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
                    logger.error(`[SYNC] Ürün eşleştirme hatası (${product.barcode || product.name}):`, error.message);
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
        }

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

        return stats;
    } catch (error) {
        logger.error(`[SYNC] Genel hata:`, error.message);
        throw error;
    }
};

// Ürünü tüm pazaryerlerine dağıt
const distributeProductToMarketplaces = async (userId, productMappingId, targetMarketplaces) => {
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

                // Sadece başarıyla yüklenmiş (syncStatus: "synced") ürünleri atla
                // syncStatus: "error" veya "skipped" olanlar yeniden denenebilir
                const alreadySynced = existingMapping &&
                    existingMapping.marketplaceProductId &&
                    existingMapping.syncStatus === "synced";

                if (alreadySynced) {
                    results.push({
                        marketplace: marketplaceName,
                        status:      "skipped",
                        message:     "Ürün zaten bu pazaryerinde başarıyla yüklenmiş",
                        productId:   existingMapping.marketplaceProductId
                    });
                    continue;
                }

                // Pazaryerine ürün yükle — userId mapping servisi için gerekli
                // ✅ FIX: masterProduct + marketplaceMappings birleştir
                // ÇiçekSepeti upload'u categoryId için marketplaceMappings'e ihtiyaç duyar
                const productWithMappings = {
                    ...mapping.masterProduct.toObject ? mapping.masterProduct.toObject() : mapping.masterProduct,
                    marketplaceMappings: mapping.marketplaceMappings
                };
                const uploadResult = await uploadProductToMarketplace(
                    marketplace,
                    productWithMappings,
                    userId
                );

                if (uploadResult.success) {
                    // ✅ pending kontrolü — N11 task henüz kesinleşmediyse "synced" değil "pending" yaz
                    // ESKİ: pending durumda bile "synced" yazılıyordu → ürün N11'de yok ama sistemde "senkron" görünüyordu
                    const isPending = uploadResult.pending === true;
                    const mpData = {
                        marketplaceProductId: uploadResult.productId,
                        isSynced:             !isPending,
                        lastSyncDate:         new Date(),
                        syncStatus:           isPending ? "pending" : "synced",
                        syncError:            isPending ? "N11 task henüz işleniyor — otomatik kontrol edilecek" : undefined
                    };
                    // N11 task ID varsa kaydet
                    if (uploadResult.taskId) {
                        mpData.n11TaskId     = uploadResult.taskId;
                        mpData.n11TaskStatus = isPending ? "IN_QUEUE" : "COMPLETED";
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

                    await mapping.save();

                    results.push({
                        marketplace: marketplaceName,
                        status:      isPending ? "pending" : "success",
                        productId:   uploadResult.productId,
                        taskId:      uploadResult.taskId,
                        message:     isPending
                            ? "Ürün N11 kuyruğunda — henüz kesinleşmedi, otomatik kontrol edilecek"
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
                    // Hata durumunda mapping'e hata bilgisini yaz
                    if (existingMapping) {
                        existingMapping.syncStatus = "error";
                        existingMapping.syncError  = uploadResult.error || "Yükleme başarısız";
                        if (uploadResult.taskId) {
                            existingMapping.n11TaskId     = uploadResult.taskId;
                            existingMapping.n11TaskStatus = uploadResult.status || "FAILED";
                        }
                        await mapping.save();
                    }

                    const errMsg = uploadResult.error || "Yükleme başarısız";

                    results.push({
                        marketplace: marketplaceName,
                        status:      "error",
                        taskId:      uploadResult.taskId,
                        message:     errMsg
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

// Trendyol'a ürün yükle
// ✅ FIX: brandId ve categoryId artık dinamik çözümleniyor (eskisi hardcoded 1 idi → 400 hata)
// ✅ FIX: marketplaceMappings'ten Trendyol-specific categoryId alınıyor
// ✅ FIX: UnifiedCategoryMap'ten Trendyol categoryId fallback
// ✅ FIX: Hata logu detaylı — raw response yazdırılıyor
const uploadProductToTrendyol = async (credentials, product) => {
    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
    const actualSellerId = sellerId || supplierId;
    if (!apiKey || !apiSecret || !actualSellerId) {
        return { success: false, error: "Trendyol credentials eksik" };
    }
    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const productName = product.name || product.title || "İsimsiz Ürün";

    // ── categoryId çözümleme ──
    let categoryId = null;

    // 1. marketplaceMappings'ten Trendyol categoryId
    if (product.marketplaceMappings && Array.isArray(product.marketplaceMappings)) {
        const tyMapping = product.marketplaceMappings.find(
            m => (m.marketplaceName || "").toLowerCase() === "trendyol"
        );
        if (tyMapping && tyMapping.categoryId) {
            categoryId = parseInt(tyMapping.categoryId);
        }
    }

    // 2. product.categoryId doğrudan
    if (!categoryId && product.categoryId) {
        categoryId = parseInt(product.categoryId);
    }

    // 3. product.category sayısal ise
    if (!categoryId && product.category && !isNaN(product.category)) {
        categoryId = parseInt(product.category);
    }



    if (!categoryId) {
        return {
            success: false,
            error: `Trendyol yükleme başarısız: "${productName}" için categoryId bulunamadı. ` +
                   `Lütfen ürünün Trendyol categoryId bilgisini kontrol edin. ` +
                   `(Mevcut kategori: "${product.category || "yok"}")`
        };
    }

    // ── brandId çözümleme ──
    // Trendyol API brandId zorunlu — varsayılan olarak "Diğer" markası (id: 7651) kullanılır
    // Gerçek marka eşleştirmesi için Trendyol brand API'si kullanılmalı
    let brandId = 7651; // "Diğer" / "Other" — Trendyol'un genel marka ID'si

    // marketplaceMappings'ten brand bilgisi varsa kullan
    if (product.marketplaceMappings && Array.isArray(product.marketplaceMappings)) {
        const tyMapping = product.marketplaceMappings.find(
            m => (m.marketplaceName || "").toLowerCase() === "trendyol"
        );
        if (tyMapping?.customAttributes?.brandId) {
            brandId = parseInt(tyMapping.customAttributes.brandId) || brandId;
        }
    }

    // Görselleri filtrele — geçerli URL'ler
    const images = (product.images || [])
        .map((url, i) => {
            if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
                return { url: url.trim(), order: i + 1 };
            }
            if (url && typeof url === "object" && url.url) {
                return { url: url.url.toString().trim(), order: i + 1 };
            }
            return null;
        })
        .filter(Boolean);

    if (images.length === 0) {
        return { success: false, error: `Trendyol yükleme başarısız: "${productName}" için en az 1 görsel gerekli` };
    }

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
                listPrice:        parseFloat(product.listPrice || product.price) || 0,
                salePrice:        parseFloat(product.price) || 0,
                vatRate:          18,
                cargoCompanyId:   10,
                images:           images,
                attributes:       []
            }]
        };

        logger.info(
            `[UPLOAD TRENDYOL] Ürün yükleniyor — "${productName}" | barcode: ${product.barcode} | ` +
            `categoryId: ${categoryId} | brandId: ${brandId} | fiyat: ${product.price} TL | ` +
            `stok: ${parseInt(product.stock) || 0} | görsel: ${images.length} adet`
        );

        const response = await axios.post(
            `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/products`,
            payload,
            {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "User-Agent": `${actualSellerId} - LysiaETIC`,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        const batchId = response.data?.batchRequestId;
        if (batchId) {
            logger.info(`[UPLOAD TRENDYOL] ✅ Ürün kuyruğa alındı — "${productName}" | batchId: ${batchId}`);
        }

        return { success: true, productId: product.barcode, batchId, response: response.data };
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

// Hepsiburada'ya ürün yükle
// ✅ FIX: Doğru endpoint — inventory-uploads stok/fiyat güncelleme içindir, ürün oluşturma değil
// Hepsiburada ürün oluşturma: POST /listings/merchantid/{merchantId}/inventory-uploads
//   → Bu endpoint aslında hem yeni listing oluşturur hem de mevcut listing günceller
//   → hepsiburadaSku (katalog SKU) zorunlu — ürün Hepsiburada kataloğunda olmalı
//   → Eğer ürün katalogda yoksa, önce Hepsiburada Seller Panel'den ürün eşleştirmesi yapılmalı
// ✅ FIX: Detaylı hata logu eklendi
const uploadProductToHepsiburada = async (credentials, product) => {
    const { merchantId, apiKey } = credentials;
    if (!merchantId || !apiKey) {
        return { success: false, error: "Hepsiburada credentials eksik: merchantId ve apiKey gerekli" };
    }
    const authHeader = `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`;
    const productName = product.name || product.title || "İsimsiz Ürün";

    // Hepsiburada SKU — katalog eşleştirmesi için gerekli
    const merchantSku    = product.sku || product.barcode;
    const hepsiburadaSku = product.barcode || product.sku;

    if (!merchantSku) {
        return { success: false, error: `Hepsiburada yükleme başarısız: "${productName}" için SKU/barkod eksik` };
    }

    try {
        const payload = {
            listings: [{
                merchantSku:    merchantSku,
                hepsiburadaSku: hepsiburadaSku,
                availableStock: parseInt(product.stock) || 0,
                price:          parseFloat(product.price) || 0,
                listPrice:      parseFloat(product.listPrice || product.price) || 0
            }]
        };

        logger.info(
            `[UPLOAD HEPSIBURADA] Ürün yükleniyor — "${productName}" | merchantSku: ${merchantSku} | ` +
            `hbSku: ${hepsiburadaSku} | fiyat: ${product.price} TL | stok: ${parseInt(product.stock) || 0}`
        );

        const response = await axios.post(
            `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}/inventory-uploads`,
            payload,
            {
                headers: {
                    Authorization:  authHeader,
                    "User-Agent":   "LysiaETIC",
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );

        const trackingId = response.data?.id || response.data?.trackingId;
        if (trackingId) {
            logger.info(`[UPLOAD HEPSIBURADA] ✅ Listing kuyruğa alındı — "${productName}" | trackingId: ${trackingId}`);
        }

        return { success: true, productId: merchantSku, trackingId, response: response.data };
    } catch (error) {
        const errData = error.response?.data;
        const errCode = error.response?.status;
        let errMsg = error.message;
        if (errData) {
            if (errData.errors && Array.isArray(errData.errors)) {
                errMsg = errData.errors.map(e => e.message || e.code || JSON.stringify(e)).join(" | ");
            } else if (errData.message) errMsg = errData.message;
            else if (typeof errData === "string") errMsg = errData;
            else errMsg = JSON.stringify(errData);
        }
        logger.error(
            `[UPLOAD HEPSIBURADA] ❌ Hata — "${productName}" | status: ${errCode} | error: ${errMsg}` +
            (errData ? ` | raw: ${JSON.stringify(errData).substring(0, 500)}` : "")
        );
        return { success: false, error: errMsg };
    }
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

// N11'e ürün yükle — 3 katmanlı mimari: autoFix → toN11 → createProduct
const uploadProductToN11 = async (credentials, product, userId = null) => {
    const { apiKey, secretKey } = credentials;
    if (!apiKey || !secretKey) {
        return { success: false, error: "N11 credentials eksik: apiKey ve secretKey gerekli" };
    }

    const productName = product.name || product.title || product.sku || "?";

    // ── 1. SKU kontrolü ──────────────────────────────────────────────────────
    const stockCode = (product.sku || product.barcode || "").toString().trim();
    if (!stockCode) {
        return {
            success: false,
            error: `N11 yükleme başarısız: "${productName}" için SKU/barkod eksik (stockCode zorunlu)`
        };
    }

    // ── 2. Başlık uzunluğu kontrolü ──────────────────────────────────────────
    // N11 kuralı: Ürün adı en az 15 karakter olmalı
    const title = (product.name || product.title || "").toString().trim();
    if (title.length < 15) {
        logger.warn(
            `[UPLOAD N11] ⚠️ Başlık çok kısa — "${productName}" (${title.length} karakter). ` +
            `N11 en az 15 karakter zorunlu kılar.`
        );
        return {
            success: false,
            skipped: true,
            reason:  "TITLE_TOO_SHORT",
            error:   `N11 yükleme atlandı: "${productName}" başlığı çok kısa (${title.length} karakter). ` +
                     `N11 en az 15 karakter zorunlu kılar. Lütfen ürün başlığını uzatın.`
        };
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
        // masterProductAdapter.fromTrendyol() alanlarına map et
        title:       product.name  || product.title || "",
        description: product.description || "",
        barcode:     product.barcode || "",
        sku:         product.sku    || product.barcode || "",
        price:       product.price  || product.salePrice || 0,
        listPrice:   product.listPrice || product.price || 0,
        stock:       product.stock  || product.quantity || 0,
        vatRate:     product.vatRate || 10,
        category:    product.category || product.categoryName || "",
        brand:       product.brand || "",
        images:      validImages,   // zaten filtrelenmiş
        attributes:  product.attributes || {}
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

    logger.info(
        `[UPLOAD N11] Yükleniyor — "${productName}" | ` +
        `stockCode: ${stockCode} | categoryId: ${n11Payload.categoryId} | ` +
        `shipmentTemplate: "${n11Payload.shipmentTemplate}" | marka: "${n11Payload.brand}" | ` +
        `fiyat: ${n11Payload.salePrice} TL | stok: ${n11Payload.quantity} | ` +
        `görsel: ${validImages.length} adet | attribute: ${n11Payload.attributes.length} adet`
    );

    // ── 7. N11 API'ye gönder ─────────────────────────────────────────────────
    try {
        const result = await n11Service.createProduct(credentials, [n11Payload], "LysiaETIC");

        if (!result.success) {
            logger.error(`[UPLOAD N11] ❌ createProduct başarısız — "${productName}": ${result.error}`);
            return { success: false, error: result.error || "N11 ürün yükleme başarısız" };
        }

        const taskId = result.taskId;

        if (result.status === "REJECT") {
            const reason = Array.isArray(result.reasons) && result.reasons.length > 0
                ? result.reasons.join(", ")
                : "Ürün reddedildi";
            logger.warn(`[UPLOAD N11] ⚠️ Task anında reddedildi — "${productName}": ${reason}`);
            return { success: false, taskId, error: reason };
        }

        if (result.status === "IN_QUEUE" || result.status === "PROCESSING") {
            logger.info(`[UPLOAD N11] ⏳ Task kuyruğa alındı — taskId: ${taskId}, ürün: "${productName}"`);
            const pollResult = await pollN11TaskResult(credentials, taskId);

            if (pollResult.success && !pollResult.pending) {
                // ✅ Kesinleşmiş başarı — N11'de ürün oluşturuldu
                logger.info(`[UPLOAD N11] ✅ Başarıyla yüklendi — "${productName}" | taskId: ${taskId}`);
                return { success: true, productId: stockCode, taskId, message: "Ürün N11'e başarıyla yüklendi" };
            } else if (pollResult.success && pollResult.pending) {
                // ⏳ Task hâlâ işleniyor — pending olarak döndür
                // distributeProductToMarketplaces "pending" syncStatus yazacak ("synced" DEĞİL)
                logger.warn(`[UPLOAD N11] ⏳ Task henüz kesinleşmedi — "${productName}" | taskId: ${taskId} | status: ${pollResult.status}`);
                return { success: true, pending: true, productId: stockCode, taskId, message: pollResult.message || "N11 task işleniyor" };
            } else {
                logger.error(`[UPLOAD N11] ❌ Yüklenemedi — "${productName}" | taskId: ${taskId} | sebep: ${pollResult.error}`);
                return { success: false, taskId, error: pollResult.error || "N11 task başarısız", status: pollResult.status };
            }
        }

        if (result.status === "COMPLETED") {
            logger.info(`[UPLOAD N11] ✅ Anında tamamlandı — "${productName}" | taskId: ${taskId}`);
            return { success: true, productId: stockCode, taskId, message: "Ürün N11'e başarıyla yüklendi" };
        }

        logger.warn(`[UPLOAD N11] ⚠️ Beklenmedik task status: ${result.status} — "${productName}" | taskId: ${taskId}`);
        return { success: false, taskId, error: `Beklenmedik N11 task durumu: ${result.status}`, status: result.status };

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
            `categoryId: ${categoryId} | fiyat: ${salesPrice} TL | stok: ${parseInt(product.stock) || 0} | ` +
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
    // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
    const credentials = decryptCredentials(marketplace.credentials);
    try {
        logger.info(`[UPLOAD] ${marketplaceName}'a ürün yükleniyor: ${product.name}`);
        switch (marketplaceName) {
            case "Trendyol":
                return await uploadProductToTrendyol(credentials, product);
            case "Hepsiburada":
                return await uploadProductToHepsiburada(credentials, product);
            case "N11":
                // userId — N11 ürün yükleme için gerekli
                return await uploadProductToN11(credentials, product, userId);
            case "ÇiçekSepeti":
                return await uploadProductToCicekSepeti(credentials, product);
            default:
                logger.warn(`[UPLOAD] ${marketplaceName} için API henüz eklenmedi, simüle ediliyor`);
                return {
                    success:   true,
                    productId: `${marketplaceName}-${product.barcode}-${Date.now()}`,
                    message:   "Ürün kuyruğa alındı (simüle)"
                };
        }
    } catch (error) {
        logger.error(`[UPLOAD] ${marketplaceName} yükleme hatası:`, error.message);
        return { success: false, error: error.message };
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
                    // 2) Listing Silme (DELETE) — tamamen sil
                    // 3) Fallback: stok=0 gönder
                    const { merchantId, username, password, apiKey: hbKey } = credentials;
                    const authUser = username || merchantId;
                    const authPass = password || hbKey;
                    if (!merchantId || !authUser || !authPass) {
                        deleteResult = { success: false, error: "Hepsiburada credentials eksik" };
                        break;
                    }
                    const hbAuth = `Basic ${Buffer.from(`${authUser}:${authPass}`).toString("base64")}`;
                    const hbHeaders = { Authorization: hbAuth, "Content-Type": "application/json", "User-Agent": "LysiaETIC" };

                    const hbSku = mp.marketplaceBarcode || mp.marketplaceSku || productMapping.masterProduct?.barcode || productMapping.masterProduct?.sku;
                    const merchantSku = mp.marketplaceSku || mp.marketplaceBarcode || productMapping.masterProduct?.sku || productMapping.masterProduct?.barcode;

                    if (!hbSku) {
                        deleteResult = { success: false, error: "Hepsiburada SKU bulunamadı" };
                        break;
                    }

                    // Adım 1: Listing Deactivate — satıştan kaldır
                    try {
                        await axios.post(
                            `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}/sku/${hbSku}/deactivate`,
                            {},
                            { headers: hbHeaders, timeout: 15000 }
                        );
                        logger.info(`[PRODUCT DELETE] Hepsiburada Adım 1/3 ✅ Listing deactivate: ${hbSku}`);
                    } catch (deactErr) {
                        logger.warn(`[PRODUCT DELETE] Hepsiburada Adım 1/3 ⚠️ Deactivate başarısız: ${deactErr.response?.data?.message || deactErr.response?.data || deactErr.message}`);
                    }

                    // Adım 2: Stok=0 gönder — satışı tamamen kapat
                    try {
                        await axios.post(
                            `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}/inventory-uploads`,
                            { listings: [{ hepsiburadaSku: hbSku, merchantSku: merchantSku, availableStock: 0 }] },
                            { headers: hbHeaders, timeout: 15000 }
                        );
                        logger.info(`[PRODUCT DELETE] Hepsiburada Adım 2/3 ✅ Stok=0 yapıldı: ${hbSku}`);
                    } catch (stockErr) {
                        logger.warn(`[PRODUCT DELETE] Hepsiburada Adım 2/3 ⚠️ Stok=0 başarısız: ${stockErr.response?.data?.message || stockErr.message}`);
                    }

                    // Adım 3: Listing Silme (DELETE) — tamamen sil
                    // Not: Satışta olan listing silinemez, bu yüzden önce deactivate + stok=0 yapıyoruz
                    try {
                        await axios.delete(
                            `https://listing-external.hepsiburada.com/listings/merchantid/${merchantId}/sku/${hbSku}/merchantsku/${merchantSku}`,
                            { headers: hbHeaders, timeout: 15000 }
                        );
                        deleteResult = { success: true };
                        logger.info(`[PRODUCT DELETE] Hepsiburada Adım 3/3 ✅ Listing tamamen silindi: ${hbSku}`);
                    } catch (delErr) {
                        const errMsg = delErr.response?.data?.message || delErr.response?.data || delErr.message;
                        logger.warn(`[PRODUCT DELETE] Hepsiburada Adım 3/3 ⚠️ DELETE başarısız (${errMsg}) — listing deaktif ve stok=0`);
                        // DELETE başarısız olsa bile listing deaktif ve stok=0 — satışta değil
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
    deleteProductFromMarketplaces
};
