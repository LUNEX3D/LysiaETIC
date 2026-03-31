const axios = require("axios");
const ProductMapping         = require("../models/ProductMapping");
const StockSyncLog           = require("../models/StockSyncLog");
const Marketplace            = require("../models/Marketplace");
const logger                 = require("../config/logger");
const n11Service             = require("./n11Service");
const n11MappingService      = require("./n11MappingService");
const masterProductAdapter   = require("./masterProductAdapter");
const categoryMappingService = require("./categoryMappingService");

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
    const credentials = marketplace.credentials;

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
    // ÇiçekSepeti hem apiSecret hem apiKey adını kullanabilir
    const apiSecret  = credentials.apiSecret  || credentials.apiKey;
    const supplierId = credentials.supplierId || credentials.merchantId;

    if (!apiSecret || !supplierId) {
        throw new Error("ÇiçekSepeti credentials eksik: apiSecret ve supplierId gerekli");
    }

    const products = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await axios.get(
                `https://apis.ciceksepeti.com/api/v1/Products`,
                {
                    headers: {
                        "x-api-key": apiSecret,
                        "supplierId": supplierId,
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
        // Her ürün için ayrı findOne yerine, tüm barkodları toplayıp tek find ile çek
        const allLookupKeys = marketplaceProducts
            .map(p => p.barcode || p.sku || p.marketplaceProductId)
            .filter(Boolean);

        const existingMappings = await ProductMapping.find({
            userId,
            $or: [
                { "masterProduct.barcode": { $in: allLookupKeys } },
                { "masterProduct.sku": { $in: allLookupKeys } }
            ]
        });

        // Hızlı lookup için Map oluştur (barcode → mapping, sku → mapping)
        const mappingByBarcode = new Map();
        const mappingBySku = new Map();
        for (const m of existingMappings) {
            if (m.masterProduct.barcode) mappingByBarcode.set(m.masterProduct.barcode, m);
            if (m.masterProduct.sku) mappingBySku.set(m.masterProduct.sku, m);
        }

        // ── Adım 2: Ürünleri işle ve kaydet (batch paralel) ──
        const logEntries = []; // Toplu log için biriktir
        const BATCH_SIZE = 20;

        for (let i = 0; i < marketplaceProducts.length; i += BATCH_SIZE) {
            const batch = marketplaceProducts.slice(i, i + BATCH_SIZE);

            const batchResults = await Promise.all(batch.map(async (product) => {
                try {
                    const lookupBarcode = product.barcode || product.sku || product.marketplaceProductId;
                    if (!lookupBarcode) {
                        return { status: "skipped" };
                    }

                    // Map'ten hızlı lookup (O(1) — eskisi O(N) findOne idi)
                    let mapping = mappingByBarcode.get(lookupBarcode) || mappingBySku.get(lookupBarcode);

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

                        // Master product stok/fiyat güncelle
                        if (product.stock !== undefined && product.stock !== null) {
                            mapping.masterProduct.stock = product.stock;
                            mapping.stockTracking.totalStock = product.stock;
                            mapping.updateStockStatus();
                        }
                        if (product.price) mapping.masterProduct.price = product.price;
                        if (product.listPrice) mapping.masterProduct.listPrice = product.listPrice;

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
                        // Yeni ürün — oluştur
                        const stockVal = product.stock || 0;
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
                                category: product.category || "",
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

        logger.info(`[SYNC] ${normalizedName} tamamlandı — Yeni: ${stats.new}, Güncellenen: ${stats.updated}, Atlanan: ${stats.skipped}, Hata: ${stats.errors}`);

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
                const uploadResult = await uploadProductToMarketplace(
                    marketplace,
                    mapping.masterProduct,
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

                    results.push({
                        marketplace: marketplaceName,
                        status:      "error",
                        taskId:      uploadResult.taskId,
                        message:     uploadResult.error || "Yükleme başarısız"
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
const uploadProductToTrendyol = async (credentials, product) => {
    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
    const actualSellerId = sellerId || supplierId;
    if (!apiKey || !apiSecret || !actualSellerId) {
        return { success: false, error: "Trendyol credentials eksik" };
    }
    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    try {
        const payload = {
            items: [{
                barcode: product.barcode,
                title: product.name,
                productMainId: product.sku,
                brandId: 1,
                categoryId: parseInt(product.category) || 1,
                quantity: product.stock || 0,
                stockCode: product.sku,
                dimensionalWeight: product.attributes?.weight || 1,
                description: product.description || product.name,
                currencyType: "TRY",
                listPrice: product.listPrice || product.price,
                salePrice: product.price,
                vatRate: 18,
                cargoCompanyId: 10,
                images: (product.images || []).map((url, i) => ({ url, order: i + 1 })),
                attributes: []
            }]
        };
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
        return { success: true, productId: product.barcode, response: response.data };
    } catch (error) {
        logger.error("[UPLOAD TRENDYOL] Hata:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// Hepsiburada'ya ürün yükle
const uploadProductToHepsiburada = async (credentials, product) => {
    const { merchantId, apiKey } = credentials;
    if (!merchantId || !apiKey) {
        return { success: false, error: "Hepsiburada credentials eksik" };
    }
    const authHeader = `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`;
    try {
        // Hepsiburada Listing API — stok & fiyat güncelleme
        const payload = {
            listings: [{
                merchantSku:    product.sku || product.barcode,
                hepsiburadaSku: product.barcode,
                availableStock: parseInt(product.stock) || 0,
                price:          parseFloat(product.price) || 0,
                listPrice:      parseFloat(product.listPrice || product.price) || 0
            }]
        };
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
        return { success: true, productId: product.barcode, response: response.data };
    } catch (error) {
        logger.error("[UPLOAD HEPSIBURADA] Hata:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
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

    // ── 6. Kategori mapping + Attribute transform ─────────────────────────────
    // toN11() içinde n11MappingService.transformProductForN11() çağrılır
    // Kategori mapping yoksa → throw eder → ürün atlanır
    let n11Payload;
    try {
        n11Payload = await masterProductAdapter.toN11(fixed, userId, credentials);
    } catch (mappingErr) {
        // Kategori mapping bulunamadı — ürünü gönderme, structured log yaz
        const isCategoryMissing = mappingErr.message.includes("CATEGORY_MAPPING_MISSING");

        const skipResult = await categoryMappingService.skipProduct(
            fixed,
            isCategoryMissing ? "CATEGORY_MAPPING_MISSING" : "MAPPING_ERROR",
            userId
        );
        return {
            success: false,
            skipped: true,
            reason:  skipResult.reason,
            error:   mappingErr.message,
            suggestions: skipResult.suggestions
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
const uploadProductToCicekSepeti = async (credentials, product) => {
    const apiSecret  = credentials.apiSecret  || credentials.apiKey;
    const supplierId = credentials.supplierId || credentials.merchantId;
    if (!apiSecret || !supplierId) {
        return { success: false, error: "ÇiçekSepeti credentials eksik" };
    }
    try {
        const payload = {
            products: [{
                stockCode:     product.sku || product.barcode,
                barcode:       product.barcode,
                productName:   product.name,
                description:   product.description || product.name,
                salesPrice:    parseFloat(product.price) || 0,
                listPrice:     parseFloat(product.listPrice || product.price) || 0,
                stockQuantity: parseInt(product.stock) || 0,
                images:        (product.images || []).map(url => ({ url }))
            }]
        };
        const response = await axios.post(
            "https://apis.ciceksepeti.com/api/v1/Products",
            payload,
            {
                headers: {
                    "x-api-key":    apiSecret,
                    "supplierId":   supplierId,
                    "Content-Type": "application/json"
                },
                timeout: 15000
            }
        );
        return { success: true, productId: product.barcode, response: response.data };
    } catch (error) {
        logger.error("[UPLOAD CİÇEKSEPETİ] Hata:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

// Pazaryerine ürün yükle
const uploadProductToMarketplace = async (marketplace, product, userId = null) => {
    const marketplaceName = normalizeMarketplaceName(marketplace.marketplaceName);
    const credentials = marketplace.credentials;
    try {
        logger.info(`[UPLOAD] ${marketplaceName}'a ürün yükleniyor: ${product.name}`);
        switch (marketplaceName) {
            case "Trendyol":
                return await uploadProductToTrendyol(credentials, product);
            case "Hepsiburada":
                return await uploadProductToHepsiburada(credentials, product);
            case "N11":
                // userId — n11MappingService'in kategori/attribute mapping için gerekli
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
        const credentials = marketplace.credentials;

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

module.exports = {
    fetchProductsFromMarketplace,
    syncProductsFromMarketplace,
    distributeProductToMarketplaces,
    uploadProductToMarketplace,
    normalizeMarketplaceName,
    checkPendingN11Tasks
};
