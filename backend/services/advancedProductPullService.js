const axios = require("axios");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceCategory = require("../models/MarketplaceCategory");
const Marketplace = require("../models/Marketplace");
const AsyncJob = require("../models/AsyncJob");
const logger = require("../config/logger");
// ✅ FIX: Credential'ları decrypt ederek kullan
const { decryptCredentials } = require("../utils/encryption");

/**
 * GELİŞMİŞ ÜRÜN ÇEKME SERVİSİ
 *
 * Tüm pazaryerlerinden ürünleri asenkron olarak çeker
 * Kullanıcı bazlı saklar ve karşılaştırma yapar
 */

// Trendyol kategorilerini çek
const fetchTrendyolCategories = async (credentials) => {
    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
    const actualSellerId = sellerId || supplierId;

    if (!apiKey || !apiSecret || !actualSellerId) {
        throw new Error("Trendyol credentials eksik");
    }

    const authHeader = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    try {
        const response = await axios.get(
            `https://apigw.trendyol.com/integration/product/sellers/${actualSellerId}/categories`,
            {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "User-Agent": `${actualSellerId} - LysiaETIC`,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            }
        );

        return response.data || [];
    } catch (error) {
        logger.error("Trendyol kategori çekme hatası:", error.message);
        throw error;
    }
};

// N11 kategorilerini çek
const fetchN11Categories = async (credentials) => {
    const { apiKey, secretKey } = credentials;

    if (!apiKey || !secretKey) {
        throw new Error("N11 credentials eksik");
    }

    try {
        // Doğru N11 REST API endpoint
        const response = await axios.get(
            "https://api.n11.com/ms/categories",
            {
                headers: {
                    appkey: String(apiKey || "").replace(/[^\x20-\x7E]/g, ""),
                    appsecret: String(secretKey || "").replace(/[^\x20-\x7E]/g, ""),
                    "Content-Type": "application/json",
                    "User-Agent": "LysiaETIC"
                },
                timeout: 30000
            }
        );

        // N11 farklı yanıt yapıları
        const data = response.data;
        if (Array.isArray(data)) return data;
        if (data?.categories) return data.categories;
        if (data?.data) return Array.isArray(data.data) ? data.data : [];
        return [];
    } catch (error) {
        logger.error("N11 kategori çekme hatası:", error.response?.data || error.message);
        throw error;
    }
};

// Hepsiburada kategorilerini çek
const fetchHepsiburadaCategories = async (credentials) => {
    const { merchantId, apiKey } = credentials;

    if (!merchantId || !apiKey) {
        throw new Error("Hepsiburada credentials eksik");
    }

    try {
        const response = await axios.get(
            `https://listing-external.hepsiburada.com/categories`,
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            }
        );

        return response.data || [];
    } catch (error) {
        logger.error("Hepsiburada kategori çekme hatası:", error.message);
        throw error;
    }
};

// Pazaryerinden kategorileri çek ve kaydet
const pullCategoriesFromMarketplace = async (userId, marketplaceId, marketplaceName) => {
    const marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
    if (!marketplace) {
        throw new Error("Pazaryeri bulunamadı");
    }

    let categories = [];
    // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
    const credentials = decryptCredentials(marketplace.credentials);

    try {
        switch (marketplaceName) {
            case "Trendyol":
                categories = await fetchTrendyolCategories(credentials);
                break;
            case "N11":
            case "n11":
                categories = await fetchN11Categories(credentials);
                break;
            case "Hepsiburada":
                categories = await fetchHepsiburadaCategories(credentials);
                break;
            default:
                throw new Error(`${marketplaceName} için kategori çekme desteklenmiyor`);
        }

        // Kategorileri kaydet
        const savedCategories = [];
        for (const cat of categories) {
            const categoryData = {
                userId,
                marketplaceName,
                categoryId: cat.id || cat.categoryId,
                categoryName: cat.name || cat.categoryName,
                categoryPath: cat.categoryPath || [],
                attributes: cat.attributes || [],
                subCategories: cat.subCategories || []
            };

            const existing = await MarketplaceCategory.findOneAndUpdate(
                { userId, marketplaceName, categoryId: categoryData.categoryId },
                categoryData,
                { upsert: true, new: true }
            );

            savedCategories.push(existing);
        }

        return {
            success: true,
            total: savedCategories.length,
            categories: savedCategories
        };
    } catch (error) {
        logger.error(`[${marketplaceName}] Kategori çekme hatası:`, error.message);
        throw error;
    }
};

// Trendyol ürünlerini çek (gelişmiş)
const fetchTrendyolProductsAdvanced = async (credentials, jobId) => {
    const { apiKey, apiSecret, sellerId, supplierId } = credentials;
    const actualSellerId = sellerId || supplierId;

    if (!apiKey || !apiSecret || !actualSellerId) {
        throw new Error("Trendyol credentials eksik");
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
                    params: {
                        page,
                        size: 200,
                        approved: true
                    },
                    timeout: 20000
                }
            );

            const content = response.data?.content || [];
            if (content.length === 0) {
                hasMore = false;
            } else {
                products.push(...content);
                page++;

                // Job ilerlemesini güncelle
                if (jobId) {
                    const job = await AsyncJob.findById(jobId);
                    if (job) {
                        await job.updateProgress(products.length, products.length, 0);
                    }
                }
            }
        } catch (error) {
            logger.error("Trendyol ürün çekme hatası:", error.response?.data || error.message);
            if (page === 0 && products.length === 0) {
                throw error;
            }
            hasMore = false;
        }
    }

    return products;
};

// N11 ürünlerini çek (gelişmiş - düzeltilmiş)
const fetchN11ProductsAdvanced = async (credentials, jobId) => {
    const { apiKey, secretKey } = credentials;

    if (!apiKey || !secretKey) {
        throw new Error("N11 credentials eksik");
    }

    const products = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            // N11'in ürün listeleme API'si
            const response = await axios.get(
                "https://api.n11.com/ms/product-query",
                {
                    headers: {
                        appkey: String(apiKey || "").replace(/[^\x20-\x7E]/g, ""),
                        appsecret: String(secretKey || "").replace(/[^\x20-\x7E]/g, ""),
                        "Content-Type": "application/json"
                    },
                    params: {
                        page,
                        size: 100
                    },
                    timeout: 20000
                }
            );

            // N11 API farklı yanıt yapıları döndürebilir — tüm olası alanları kontrol et
            const items = response.data?.products
                || response.data?.productList
                || response.data?.content
                || response.data?.data?.products
                || response.data?.result?.productList
                || [];

            if (items.length === 0) {
                hasMore = false;
            } else {
                products.push(...items);
                page++;

                // Job ilerlemesini güncelle
                if (jobId) {
                    const job = await AsyncJob.findById(jobId);
                    if (job) {
                        await job.updateProgress(products.length, products.length, 0);
                    }
                }
            }
        } catch (error) {
            logger.error("N11 ürün çekme hatası:", error.response?.data || error.message);
            if (page === 0 && products.length === 0) {
                throw error;
            }
            hasMore = false;
        }
    }

    return products;
};

// Hepsiburada ürünlerini çek (gelişmiş)
const fetchHepsiburadaProductsAdvanced = async (credentials, jobId) => {
    const { merchantId, apiKey } = credentials;

    if (!merchantId || !apiKey) {
        throw new Error("Hepsiburada credentials eksik");
    }

    const authHeader = `Basic ${Buffer.from(`${merchantId}:${apiKey}`).toString("base64")}`;

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
                    timeout: 20000
                }
            );

            const items = response.data?.listings || [];
            if (items.length === 0) {
                hasMore = false;
            } else {
                products.push(...items);
                offset += limit;

                // Job ilerlemesini güncelle
                if (jobId) {
                    const job = await AsyncJob.findById(jobId);
                    if (job) {
                        await job.updateProgress(products.length, products.length, 0);
                    }
                }
            }
        } catch (error) {
            logger.error("Hepsiburada ürün çekme hatası:", error.response?.data || error.message);
            if (offset === 0 && products.length === 0) {
                throw error;
            }
            hasMore = false;
        }
    }

    return products;
};

// ÇiçekSepeti ürünlerini çek (gelişmiş)
const fetchCicekSepetiProductsAdvanced = async (credentials, jobId) => {
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
                products.push(...items);
                page++;

                // Job ilerlemesini güncelle
                if (jobId) {
                    const job = await AsyncJob.findById(jobId);
                    if (job) {
                        await job.updateProgress(products.length, products.length, 0);
                    }
                }
            }
        } catch (error) {
            logger.error("ÇiçekSepeti ürün çekme hatası:", error.response?.data || error.message);
            if (page === 1 && products.length === 0) {
                throw error;
            }
            hasMore = false;
        }
    }

    return products;
};

// Pazaryerinden ürünleri çek ve kaydet (asenkron)
const pullProductsFromMarketplace = async (userId, marketplaceId, marketplaceName, jobId) => {
    const marketplace = await Marketplace.findOne({ _id: marketplaceId, userId });
    if (!marketplace) {
        throw new Error("Pazaryeri bulunamadı");
    }

    let rawProducts = [];
    // ✅ FIX: Credential'ları decrypt et (DB'de şifreli saklanıyor)
    const credentials = decryptCredentials(marketplace.credentials);

    try {
        switch (marketplaceName) {
            case "Trendyol":
                rawProducts = await fetchTrendyolProductsAdvanced(credentials, jobId);
                break;
            case "N11":
            case "n11":
                rawProducts = await fetchN11ProductsAdvanced(credentials, jobId);
                break;
            case "Hepsiburada":
                rawProducts = await fetchHepsiburadaProductsAdvanced(credentials, jobId);
                break;
            case "ÇiçekSepeti":
                rawProducts = await fetchCicekSepetiProductsAdvanced(credentials, jobId);
                break;
            default:
                throw new Error(`${marketplaceName} için ürün çekme desteklenmiyor`);
        }

        // Ürünleri normalize et ve kaydet
        const savedProducts = [];
        const errors = [];

        for (const rawProduct of rawProducts) {
            try {
                const normalizedProduct = normalizeProduct(rawProduct, marketplaceName);

                const existing = await MarketplaceProduct.findOneAndUpdate(
                    {
                        userId,
                        marketplaceName,
                        barcode: normalizedProduct.barcode
                    },
                    {
                        ...normalizedProduct,
                        pullInfo: {
                            pulledAt: new Date(),
                            lastSyncAt: new Date(),
                            syncCount: 1
                        }
                    },
                    { upsert: true, new: true }
                );

                savedProducts.push(existing);
            } catch (error) {
                errors.push({
                    productId: rawProduct.id || rawProduct.productId,
                    error: error.message
                });
                logger.error(`Ürün kaydetme hatası (${marketplaceName}):`, error.message);
            }
        }

        return {
            success: true,
            total: savedProducts.length,
            errors: errors.length,
            products: savedProducts,
            errorDetails: errors
        };
    } catch (error) {
        logger.error(`[${marketplaceName}] Ürün çekme hatası:`, error.message);
        throw error;
    }
};

// Ürünü normalize et (tüm pazaryerleri için ortak formata)
const normalizeProduct = (rawProduct, marketplaceName) => {
    const normalized = {
        marketplaceName,
        marketplaceProductId: "",
        barcode: "",
        sku: "",
        name: "",
        description: "",
        price: 0,
        listPrice: 0,
        stock: 0,
        category: { id: "", name: "", path: [] },
        images: [],
        attributes: { color: "", size: "", weight: 0, brand: "", custom: new Map() },
        marketplaceData: new Map()
    };

    switch (marketplaceName) {
        case "Trendyol":
            normalized.marketplaceProductId = rawProduct.productCode || rawProduct.id;
            normalized.barcode = rawProduct.barcode || "";
            normalized.sku = rawProduct.stockCode || "";
            normalized.name = rawProduct.title || "";
            normalized.description = rawProduct.description || "";
            normalized.price = rawProduct.salePrice || 0;
            normalized.listPrice = rawProduct.listPrice || 0;
            normalized.stock = rawProduct.quantity || 0;
            normalized.category = {
                id: rawProduct.categoryId || "",
                name: rawProduct.categoryName || "",
                path: rawProduct.categoryPath || []
            };
            normalized.images = (rawProduct.images || []).map(img => ({
                url: img.url || img,
                order: img.order || 0
            }));
            normalized.attributes = {
                color: rawProduct.attributes?.find(a => a.attributeName === "Renk")?.attributeValue || "",
                size: rawProduct.attributes?.find(a => a.attributeName === "Beden")?.attributeValue || "",
                weight: rawProduct.weight || 0,
                brand: rawProduct.brand || "",
                custom: new Map()
            };
            break;

        case "N11":
        case "n11":
            // N11 API farklı yanıt yapıları döndürebilir — tüm olası alanları kontrol et
            const n11Id = rawProduct.id || rawProduct.productId || rawProduct.productSellerCode || rawProduct.productCode || "";
            const n11Barcode = rawProduct.barcode || rawProduct.stockCode || rawProduct.productSellerCode || rawProduct.sku || "";
            const n11Sku = rawProduct.stockCode || rawProduct.productSellerCode || rawProduct.barcode || rawProduct.sku || "";
            const n11Name = rawProduct.title || rawProduct.productName || rawProduct.name || "İsimsiz N11 Ürün";

            // Eğer tüm ID alanları boşsa, timestamp ile unique ID oluştur
            const uniqueId = n11Id || n11Barcode || n11Sku || `N11-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            normalized.marketplaceProductId = uniqueId;
            normalized.barcode = n11Barcode || uniqueId;
            normalized.sku = n11Sku || uniqueId;
            normalized.name = n11Name;
            normalized.description = rawProduct.description || rawProduct.desc || "";
            normalized.price = parseFloat(rawProduct.salePrice || rawProduct.sellingPrice || rawProduct.price || 0);
            normalized.listPrice = parseFloat(rawProduct.listPrice || rawProduct.salePrice || rawProduct.sellingPrice || rawProduct.price || 0);
            normalized.stock = parseInt(rawProduct.quantity || rawProduct.stock || rawProduct.stockQuantity || 0);
            normalized.category = {
                id: String(rawProduct.categoryId || rawProduct.category?.id || ""),
                name: rawProduct.categoryName || rawProduct.category?.name || rawProduct.category || "",
                path: rawProduct.categoryPath || rawProduct.category?.path || []
            };

            // Görseller — farklı formatları destekle
            let n11Images = [];
            if (Array.isArray(rawProduct.images)) {
                n11Images = rawProduct.images.map((img, idx) => ({
                    url: typeof img === "string" ? img : (img.url || img.imageUrl || ""),
                    order: idx
                })).filter(img => img.url);
            } else if (rawProduct.imageUrl) {
                n11Images = [{ url: rawProduct.imageUrl, order: 0 }];
            } else if (rawProduct.image) {
                n11Images = [{ url: rawProduct.image, order: 0 }];
            }
            normalized.images = n11Images;

            // Özellikler
            const attrs = rawProduct.attributes || rawProduct.productAttributes || [];
            normalized.attributes = {
                color: rawProduct.color || attrs.find(a => a.attributeName === "Renk" || a.name === "Renk")?.attributeValue || attrs.find(a => a.attributeName === "Renk" || a.name === "Renk")?.value || "",
                size: rawProduct.size || attrs.find(a => a.attributeName === "Beden" || a.name === "Beden")?.attributeValue || attrs.find(a => a.attributeName === "Beden" || a.name === "Beden")?.value || "",
                weight: rawProduct.weight || rawProduct.productWeight || 0,
                brand: rawProduct.brand || rawProduct.brandName || "",
                custom: new Map()
            };
            break;

        case "Hepsiburada":
            normalized.marketplaceProductId = rawProduct.hepsiburadaSku || rawProduct.id;
            normalized.barcode = rawProduct.merchantSku || rawProduct.barcode || "";
            normalized.sku = rawProduct.merchantSku || "";
            normalized.name = rawProduct.productName || "";
            normalized.description = rawProduct.description || "";
            normalized.price = rawProduct.price || 0;
            normalized.listPrice = rawProduct.listPrice || rawProduct.price || 0;
            normalized.stock = rawProduct.availableStock || 0;
            normalized.category = {
                id: rawProduct.categoryId || "",
                name: rawProduct.categoryName || "",
                path: rawProduct.categoryPath || []
            };
            normalized.images = rawProduct.imageUrl ? [{ url: rawProduct.imageUrl, order: 0 }] : [];
            normalized.attributes = {
                color: "",
                size: "",
                weight: 0,
                brand: rawProduct.brand || "",
                custom: new Map()
            };
            break;

        case "ÇiçekSepeti":
            normalized.marketplaceProductId = rawProduct.productCode || rawProduct.id;
            normalized.barcode = rawProduct.barcode || "";
            normalized.sku = rawProduct.stockCode || "";
            normalized.name = rawProduct.productName || "";
            normalized.description = rawProduct.description || "";
            normalized.price = rawProduct.salesPrice || 0;
            normalized.listPrice = rawProduct.listPrice || rawProduct.salesPrice || 0;
            normalized.stock = rawProduct.stockQuantity || 0;
            normalized.category = {
                id: rawProduct.categoryId || "",
                name: rawProduct.categoryName || "",
                path: rawProduct.categoryPath || []
            };
            normalized.images = (rawProduct.images || []).map((img, idx) => ({
                url: typeof img === "string" ? img : img.url,
                order: idx
            }));
            normalized.attributes = {
                color: "",
                size: "",
                weight: 0,
                brand: rawProduct.brand || "",
                custom: new Map()
            };
            break;
    }

    // Ham veriyi sakla
    normalized.marketplaceData = new Map(Object.entries(rawProduct));

    return normalized;
};

// Tüm pazaryerlerinden ürünleri çek (asenkron)
const pullProductsFromAllMarketplaces = async (userId, marketplaceIds) => {
    const job = new AsyncJob({
        userId,
        jobType: "pull_products",
        status: "pending",
        params: {
            marketplaceIds
        },
        progress: {
            total: marketplaceIds.length,
            processed: 0,
            success: 0,
            failed: 0,
            percentage: 0
        }
    });

    await job.save();
    await job.start();

    const results = [];

    for (const marketplaceId of marketplaceIds) {
        let marketplace = null;
        try {
            marketplace = await Marketplace.findById(marketplaceId);
            if (!marketplace) {
                throw new Error("Pazaryeri bulunamadı");
            }

            const result = await pullProductsFromMarketplace(
                userId,
                marketplaceId,
                marketplace.marketplaceName,
                job._id
            );

            results.push({
                marketplaceName: marketplace.marketplaceName,
                success: true,
                ...result
            });

            job.progress.success++;
        } catch (error) {
            results.push({
                marketplaceName: marketplace?.marketplaceName || "Bilinmeyen",
                success: false,
                error: error.message
            });

            job.progress.failed++;
            if (!job.result.errors) job.result.errors = [];
            job.result.errors.push({
                marketplace: marketplace?.marketplaceName || "Bilinmeyen",
                error: error.message
            });
        }

        job.progress.processed++;
        await job.calculateProgress();
        await job.save();
    }

    await job.complete("Ürün çekme işlemi tamamlandı", {
        results,
        summary: {
            totalMarketplaces: marketplaceIds.length,
            success: job.progress.success,
            failed: job.progress.failed
        }
    });

    return job;
};

// Pazaryerleri karşılaştır
const compareMarketplaces = async (userId) => {
    const marketplaces = await Marketplace.find({ userId });
    const comparison = {
        marketplaces: [],
        commonProducts: [],
        uniqueProducts: {},
        missingProducts: {}
    };

    // Her pazaryeri için ürünleri al
    for (const mp of marketplaces) {
        const products = await MarketplaceProduct.findByUserAndMarketplace(userId, mp.marketplaceName);
        comparison.marketplaces.push({
            name: mp.marketplaceName,
            productCount: products.length
        });
        comparison.uniqueProducts[mp.marketplaceName] = products.map(p => p.barcode);
    }

    // Ortak ürünleri bul
    if (comparison.marketplaces.length > 1) {
        const firstMp = comparison.marketplaces[0].name;
        const firstMpProducts = comparison.uniqueProducts[firstMp];

        for (const barcode of firstMpProducts) {
            const isCommon = comparison.marketplaces.every(mp => {
                if (mp.name === firstMp) return true;
                return comparison.uniqueProducts[mp.name].includes(barcode);
            });

            if (isCommon) {
                comparison.commonProducts.push(barcode);
            }
        }

        // Her pazaryerinde eksik ürünleri bul
        for (const mp of comparison.marketplaces) {
            comparison.missingProducts[mp.name] = comparison.commonProducts.filter(
                barcode => !comparison.uniqueProducts[mp.name].includes(barcode)
            );
        }
    }

    return comparison;
};

module.exports = {
    pullProductsFromMarketplace,
    pullProductsFromAllMarketplaces,
    pullCategoriesFromMarketplace,
    compareMarketplaces,
    normalizeProduct
};
