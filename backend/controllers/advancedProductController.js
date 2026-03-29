const advancedProductPullService = require("../services/advancedProductPullService");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceCategory = require("../models/MarketplaceCategory");
const Marketplace = require("../models/Marketplace");
const AsyncJob = require("../models/AsyncJob");
const logger = require("../config/logger");

/**
 * GELİŞMİŞ ÜRÜN YÖNETİMİ CONTROLLER
 */

// Tüm pazaryerlerinden ürünleri çek (asenkron)
exports.pullAllProducts = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceIds } = req.body;

        if (!marketplaceIds || !Array.isArray(marketplaceIds) || marketplaceIds.length === 0) {
            return res.status(400).json({ error: "Pazaryeri ID'leri gerekli" });
        }

        // Asenkron işlemi başlat
        const job = await advancedProductPullService.pullProductsFromAllMarketplaces(userId, marketplaceIds);

        return res.status(200).json({
            success: true,
            message: "Ürün çekme işlemi başlatıldı",
            jobId: job._id,
            status: job.status
        });

    } catch (error) {
        logger.error("[PULL ALL PRODUCTS] Hata:", error.message);
        return res.status(500).json({ error: "Ürün çekme başlatılamadı", details: error.message });
    }
};

// Tek bir pazaryerinden ürünleri çek
exports.pullProductsFromMarketplace = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceId, marketplaceName } = req.body;

        if (!marketplaceId || !marketplaceName) {
            return res.status(400).json({ error: "Pazaryeri bilgisi eksik" });
        }

        // Job oluştur
        const job = new AsyncJob({
            userId,
            jobType: "pull_products",
            status: "pending",
            params: { marketplaceId, marketplaceName },
            progress: { total: 1, processed: 0, success: 0, failed: 0, percentage: 0 }
        });

        await job.save();
        await job.start();

        // Asenkron olarak çalıştır
        advancedProductPullService.pullProductsFromMarketplace(userId, marketplaceId, marketplaceName, job._id)
            .then(result => {
                job.complete("Ürün çekme tamamlandı", result);
            })
            .catch(error => {
                job.fail(error);
            });

        return res.status(200).json({
            success: true,
            message: "Ürün çekme işlemi başlatıldı",
            jobId: job._id,
            status: job.status
        });

    } catch (error) {
        logger.error("[PULL PRODUCTS FROM MARKETPLACE] Hata:", error.message);
        return res.status(500).json({ error: "Ürün çekme başlatılamadı", details: error.message });
    }
};

// Kategorileri çek
exports.pullCategories = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceId, marketplaceName } = req.body;

        if (!marketplaceId || !marketplaceName) {
            return res.status(400).json({ error: "Pazaryeri bilgisi eksik" });
        }

        const result = await advancedProductPullService.pullCategoriesFromMarketplace(userId, marketplaceId, marketplaceName);

        return res.status(200).json({
            success: true,
            message: "Kategoriler çekildi",
            ...result
        });

    } catch (error) {
        logger.error("[PULL CATEGORIES] Hata:", error.message);
        return res.status(500).json({ error: "Kategori çekme başarısız", details: error.message });
    }
};

// İşlem durumunu sorgula
exports.getJobStatus = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { jobId } = req.params;

        const job = await AsyncJob.findOne({ _id: jobId, userId });
        if (!job) {
            return res.status(404).json({ error: "İşlem bulunamadı" });
        }

        return res.status(200).json({
            success: true,
            job: {
                id: job._id,
                jobType: job.jobType,
                status: job.status,
                progress: job.progress,
                result: job.result,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                createdAt: job.createdAt
            }
        });

    } catch (error) {
        logger.error("[GET JOB STATUS] Hata:", error.message);
        return res.status(500).json({ error: "İşlem durumu alınamadı", details: error.message });
    }
};

// Kullanıcının aktif işlemlerini listele
exports.getActiveJobs = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const jobs = await AsyncJob.findActiveJobs(userId);

        return res.status(200).json({
            success: true,
            jobs: jobs.map(job => ({
                id: job._id,
                jobType: job.jobType,
                status: job.status,
                progress: job.progress,
                startedAt: job.startedAt,
                createdAt: job.createdAt
            }))
        });

    } catch (error) {
        logger.error("[GET ACTIVE JOBS] Hata:", error.message);
        return res.status(500).json({ error: "Aktif işlemler alınamadı", details: error.message });
    }
};

// Kullanıcının tamamlanan işlemlerini listele
exports.getCompletedJobs = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { limit = 10 } = req.query;

        const jobs = await AsyncJob.findCompletedJobs(userId, parseInt(limit));

        return res.status(200).json({
            success: true,
            jobs: jobs.map(job => ({
                id: job._id,
                jobType: job.jobType,
                status: job.status,
                progress: job.progress,
                result: job.result,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                createdAt: job.createdAt
            }))
        });

    } catch (error) {
        logger.error("[GET COMPLETED JOBS] Hata:", error.message);
        return res.status(500).json({ error: "Tamamlanan işlemler alınamadı", details: error.message });
    }
};

// Pazaryerlerini karşılaştır
exports.compareMarketplaces = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const comparison = await advancedProductPullService.compareMarketplaces(userId);

        return res.status(200).json({
            success: true,
            comparison
        });

    } catch (error) {
        logger.error("[COMPARE MARKETPLACES] Hata:", error.message);
        return res.status(500).json({ error: "Pazaryeri karşılaştırması başarısız", details: error.message });
    }
};

// Kullanıcının ürünlerini listele
exports.getUserProducts = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceName, page = 1, limit = 50, search } = req.query;

        const query = { userId };
        if (marketplaceName) {
            query.marketplaceName = marketplaceName;
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { barcode: { $regex: search, $options: "i" } },
                { sku: { $regex: search, $options: "i" } }
            ];
        }

        const products = await MarketplaceProduct.find(query)
            .sort({ createdAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        const total = await MarketplaceProduct.countDocuments(query);

        return res.status(200).json({
            success: true,
            products,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        logger.error("[GET USER PRODUCTS] Hata:", error.message);
        return res.status(500).json({ error: "Ürünler alınamadı", details: error.message });
    }
};

// Kullanıcının kategorilerini listele
exports.getUserCategories = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceName } = req.query;

        const query = { userId };
        if (marketplaceName) {
            query.marketplaceName = marketplaceName;
        }

        const categories = await MarketplaceCategory.find(query)
            .sort({ categoryPath: 1 });

        return res.status(200).json({
            success: true,
            categories
        });

    } catch (error) {
        logger.error("[GET USER CATEGORIES] Hata:", error.message);
        return res.status(500).json({ error: "Kategoriler alınamadı", details: error.message });
    }
};

// Ürün detayını getir
exports.getProductDetail = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;

        const product = await MarketplaceProduct.findOne({ _id: productId, userId });
        if (!product) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        return res.status(200).json({
            success: true,
            product
        });

    } catch (error) {
        logger.error("[GET PRODUCT DETAIL] Hata:", error.message);
        return res.status(500).json({ error: "Ürün detayı alınamadı", details: error.message });
    }
};

// Kategori detayını getir
exports.getCategoryDetail = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { categoryId } = req.params;
        const { marketplaceName } = req.query;

        const category = await MarketplaceCategory.findOne({
            _id: categoryId,
            userId,
            marketplaceName
        });

        if (!category) {
            return res.status(404).json({ error: "Kategori bulunamadı" });
        }

        return res.status(200).json({
            success: true,
            category
        });

    } catch (error) {
        logger.error("[GET CATEGORY DETAIL] Hata:", error.message);
        return res.status(500).json({ error: "Kategori detayı alınamadı", details: error.message });
    }
};

// Dashboard verileri
exports.getDashboardData = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        // Pazaryerleri al
        const marketplaces = await Marketplace.find({ userId });

        // Her pazaryeri için ürün sayısı
        const marketplaceStats = [];
        for (const mp of marketplaces) {
            const count = await MarketplaceProduct.countByMarketplace(userId, mp.marketplaceName);
            marketplaceStats.push({
                name: mp.marketplaceName,
                productCount: count
            });
        }

        // Toplam ürün sayısı
        const totalProducts = await MarketplaceProduct.countDocuments({ userId });

        // Son çekilen ürünler
        const recentProducts = await MarketplaceProduct.find({ userId })
            .sort({ "pullInfo.pulledAt": -1 })
            .limit(10);

        // Aktif işlemler
        const activeJobs = await AsyncJob.findActiveJobs(userId);

        return res.status(200).json({
            success: true,
            data: {
                totalProducts,
                marketplaceStats,
                recentProducts,
                activeJobs: activeJobs.length
            }
        });

    } catch (error) {
        logger.error("[GET DASHBOARD DATA] Hata:", error.message);
        return res.status(500).json({ error: "Dashboard verileri alınamadı", details: error.message });
    }
};
