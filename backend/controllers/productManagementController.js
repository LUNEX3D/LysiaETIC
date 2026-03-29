/**
 * ÜRÜN YÖNETİM CONTROLLER
 *
 * Ürün yükleme, eşitleme, dağıtım, stok senkronizasyonu ve Excel import/export
 */

const ProductMapping = require("../models/ProductMapping");
const CategoryMapping = require("../models/CategoryMapping");
const StockSyncLog = require("../models/StockSyncLog");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");
const { syncProductsFromMarketplace, distributeProductToMarketplaces } = require("../services/productSyncService");
const { manualStockSync, autoStockSync } = require("../services/stockSyncService");
const n11Service = require("../services/n11Service");
const xlsx = require("xlsx");
const multer = require("multer");

// Multer — memory storage (dosyayı diske yazmadan RAM'de tut)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "text/csv"
        ];
        if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error("Sadece .xlsx, .xls veya .csv dosyaları kabul edilir"), false);
        }
    }
});
exports.uploadMiddleware = upload.single("file");

// ═══════════════════════════════════════════════════════════════
// 📦 ÜRÜN YÜKLEME
// ═══════════════════════════════════════════════════════════════

/**
 * Yeni ürün oluştur (Master Product)
 */
exports.createProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const {
            name, barcode, sku, description, images,
            price, listPrice, stock, category, brand,
            attributes, marketplaceMappings
        } = req.body;

        // Zorunlu alan kontrolü
        if (!name || !barcode || !sku || !price) {
            return res.status(400).json({
                error: "Zorunlu alanlar eksik",
                required: ["name", "barcode", "sku", "price"]
            });
        }

        // Barkod benzersizlik kontrolü
        const existing = await ProductMapping.findOne({ userId, "masterProduct.barcode": barcode });
        if (existing) {
            return res.status(409).json({
                error: "Bu barkoda sahip bir ürün zaten mevcut",
                existingProduct: {
                    id: existing._id,
                    name: existing.masterProduct.name,
                    barcode: existing.masterProduct.barcode
                }
            });
        }

        // Ürün oluştur
        const productMapping = new ProductMapping({
            userId,
            masterProduct: {
                name,
                barcode,
                sku,
                description: description || "",
                images: images || [],
                price,
                listPrice: listPrice || price,
                stock: stock || 0,
                category: category || "",
                brand: brand || "",
                attributes: attributes || {}
            },
            marketplaceMappings: marketplaceMappings || [],
            stockTracking: {
                totalStock: stock || 0,
                availableStock: stock || 0,
                lowStockThreshold: 10
            }
        });

        productMapping.updateStockStatus();
        await productMapping.save();

        // Log oluştur
        await StockSyncLog.create({
            userId,
            actionType: "product_created",
            product: {
                productMappingId: productMapping._id,
                barcode,
                sku,
                name
            },
            status: "success",
            notification: { priority: "low" }
        });

        logger.info(`[PRODUCT] Yeni ürün oluşturuldu: ${name} (${barcode})`);

        return res.status(201).json({
            success: true,
            message: "Ürün başarıyla oluşturuldu",
            product: productMapping
        });

    } catch (error) {
        logger.error("[PRODUCT CREATE] Hata:", error.message);
        return res.status(500).json({ error: "Ürün oluşturulamadı", details: error.message });
    }
};

/**
 * userId'yi güvenli şekilde ObjectId'ye çevir
 */
const toObjectId = (id) => {
    const mongoose = require("mongoose");
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; }
};

/**
 * Tüm ürünleri listele
 */
exports.getProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, limit = 20, search, category, marketplace, stockStatus } = req.query;

        const filter = { userId };

        // Arama filtresi
        if (search) {
            filter.$or = [
                { "masterProduct.name": { $regex: search, $options: "i" } },
                { "masterProduct.barcode": { $regex: search, $options: "i" } },
                { "masterProduct.sku": { $regex: search, $options: "i" } }
            ];
        }

        // Kategori filtresi
        if (category) {
            filter["masterProduct.category"] = { $regex: category, $options: "i" };
        }

        // Pazaryeri filtresi
        if (marketplace) {
            filter["marketplaceMappings.marketplaceName"] = marketplace;
        }

        // Stok durumu filtresi
        if (stockStatus === "outOfStock") {
            filter["stockTracking.isOutOfStock"] = true;
        } else if (stockStatus === "lowStock") {
            filter["stockTracking.isLowStock"] = true;
        }

        const total = await ProductMapping.countDocuments(filter);
        const products = await ProductMapping.find(filter)
            .sort({ updatedAt: -1 })
            .skip(Number(page) * Number(limit))
            .limit(Number(limit))
            .lean();

        return res.status(200).json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit)),
            products
        });

    } catch (error) {
        logger.error("[PRODUCT LIST] Hata:", error.message);
        return res.status(500).json({ error: "Ürünler alınamadı", details: error.message });
    }
};

/**
 * Tek ürün detayı
 */
exports.getProductDetail = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;

        const product = await ProductMapping.findOne({ _id: productId, userId });
        if (!product) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        return res.status(200).json({ success: true, product });

    } catch (error) {
        logger.error("[PRODUCT DETAIL] Hata:", error.message);
        return res.status(500).json({ error: "Ürün detayı alınamadı", details: error.message });
    }
};

/**
 * Ürün güncelle
 */
exports.updateProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;
        const updates = req.body;

        const product = await ProductMapping.findOne({ _id: productId, userId });
        if (!product) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        // Master product alanlarını güncelle
        if (updates.name) product.masterProduct.name = updates.name;
        if (updates.description) product.masterProduct.description = updates.description;
        if (updates.images) product.masterProduct.images = updates.images;
        if (updates.price) product.masterProduct.price = updates.price;
        if (updates.listPrice) product.masterProduct.listPrice = updates.listPrice;
        if (updates.category) product.masterProduct.category = updates.category;
        if (updates.brand) product.masterProduct.brand = updates.brand;
        if (updates.attributes) product.masterProduct.attributes = { ...product.masterProduct.attributes, ...updates.attributes };

        // Stok güncelleme
        if (updates.stock !== undefined) {
            const oldStock = product.stockTracking.totalStock;
            product.masterProduct.stock = updates.stock;
            product.stockTracking.totalStock = updates.stock;
            product.updateStockStatus();

            // Log oluştur
            await StockSyncLog.create({
                userId,
                actionType: "stock_update",
                product: {
                    productMappingId: product._id,
                    barcode: product.masterProduct.barcode,
                    sku: product.masterProduct.sku,
                    name: product.masterProduct.name
                },
                changes: {
                    field: "stock",
                    oldValue: oldStock,
                    newValue: updates.stock,
                    difference: updates.stock - oldStock
                },
                status: "success",
                notification: {
                    priority: updates.stock === 0 ? "critical" : updates.stock <= product.stockTracking.lowStockThreshold ? "high" : "low"
                }
            });
        }

        await product.save();

        return res.status(200).json({
            success: true,
            message: "Ürün güncellendi",
            product
        });

    } catch (error) {
        logger.error("[PRODUCT UPDATE] Hata:", error.message);
        return res.status(500).json({ error: "Ürün güncellenemedi", details: error.message });
    }
};

/**
 * Ürün sil
 */
exports.deleteProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;

        const product = await ProductMapping.findOneAndDelete({ _id: productId, userId });
        if (!product) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        return res.status(200).json({
            success: true,
            message: "Ürün silindi"
        });

    } catch (error) {
        logger.error("[PRODUCT DELETE] Hata:", error.message);
        return res.status(500).json({ error: "Ürün silinemedi", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 ÜRÜN EŞİTLEME & DAĞITIM
// ═══════════════════════════════════════════════════════════════

/**
 * Pazaryerinden ürünleri çek ve eşleştir
 */
exports.syncFromMarketplace = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { marketplaceId, marketplaceName } = req.body;

        if (!marketplaceId || !marketplaceName) {
            return res.status(400).json({ error: "Pazaryeri bilgisi eksik" });
        }

        logger.info(`[SYNC] ${marketplaceName} senkronizasyonu başlatılıyor...`);

        const stats = await syncProductsFromMarketplace(userId, marketplaceId, marketplaceName);

        return res.status(200).json({
            success: true,
            message: `${marketplaceName} senkronizasyonu tamamlandı`,
            stats
        });

    } catch (error) {
        logger.error("[SYNC FROM MARKETPLACE] Hata:", error.message);

        // Kullanıcı dostu hata mesajı
        const statusCode = error.statusCode || 500;
        const errorMessage = error.message || "Senkronizasyon başarısız";

        return res.status(statusCode).json({
            error: errorMessage,
            details: process.env.NODE_ENV === "development" ? error.originalError?.message : undefined
        });
    }
};

/**
 * Ürünü seçili pazaryerlerine dağıt
 */
exports.distributeProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productMappingId, targetMarketplaces } = req.body;

        if (!productMappingId || !targetMarketplaces || targetMarketplaces.length === 0) {
            return res.status(400).json({ error: "Ürün ID ve hedef pazaryerleri gerekli" });
        }

        const results = await distributeProductToMarketplaces(userId, productMappingId, targetMarketplaces);

        return res.status(200).json({
            success: true,
            message: "Dağıtım tamamlandı",
            results
        });

    } catch (error) {
        logger.error("[DISTRIBUTE] Hata:", error.message);
        return res.status(500).json({ error: "Dağıtım başarısız", details: error.message });
    }
};

/**
 * Toplu ürün dağıtımı - Bir pazaryerindeki tüm ürünleri diğerlerine dağıt
 */
exports.bulkDistribute = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { sourceMarketplace, targetMarketplaces } = req.body;

        if (!sourceMarketplace || !targetMarketplaces || targetMarketplaces.length === 0) {
            return res.status(400).json({ error: "Kaynak ve hedef pazaryerleri gerekli" });
        }

        logger.info(`[BULK DISTRIBUTE] ${sourceMarketplace} -> ${targetMarketplaces.join(", ")}`);

        // Kaynak pazaryerindeki ürünleri bul
        const products = await ProductMapping.find({
            userId,
            "marketplaceMappings.marketplaceName": sourceMarketplace
        });

        const results = {
            total: products.length,
            distributed: 0,
            skipped: 0,
            errors: 0,
            details: []
        };

        for (const product of products) {
            try {
                // Her hedef pazaryeri için kontrol et
                const missingMarketplaces = targetMarketplaces.filter(target => {
                    const existing = product.marketplaceMappings.find(
                        m => m.marketplaceName === target && m.marketplaceProductId
                    );
                    return !existing;
                });

                if (missingMarketplaces.length === 0) {
                    results.skipped++;
                    results.details.push({
                        barcode: product.masterProduct.barcode,
                        name: product.masterProduct.name,
                        status: "skipped",
                        message: "Tüm hedef pazaryerlerinde mevcut"
                    });
                    continue;
                }

                // Eksik pazaryerlerine dağıt
                const distResults = await distributeProductToMarketplaces(
                    userId,
                    product._id,
                    missingMarketplaces
                );

                const successCount = distResults.filter(r => r.status === "success").length;
                if (successCount > 0) results.distributed++;
                if (distResults.some(r => r.status === "error")) results.errors++;

                results.details.push({
                    barcode: product.masterProduct.barcode,
                    name: product.masterProduct.name,
                    status: successCount > 0 ? "success" : "error",
                    marketplaces: distResults
                });

            } catch (error) {
                results.errors++;
                results.details.push({
                    barcode: product.masterProduct.barcode,
                    name: product.masterProduct.name,
                    status: "error",
                    message: error.message
                });
            }
        }

        // Toplu log oluştur
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: {
                barcode: "BULK",
                name: `Toplu dağıtım: ${sourceMarketplace} -> ${targetMarketplaces.join(", ")}`
            },
            changes: {
                field: "distribution",
                oldValue: sourceMarketplace,
                newValue: targetMarketplaces
            },
            status: results.errors > 0 ? "partial" : "success",
            notification: {
                priority: "high"
            }
        });

        return res.status(200).json({
            success: true,
            message: "Toplu dağıtım tamamlandı",
            results
        });

    } catch (error) {
        logger.error("[BULK DISTRIBUTE] Hata:", error.message);
        return res.status(500).json({ error: "Toplu dağıtım başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 STOK SENKRONİZASYON
// ═══════════════════════════════════════════════════════════════

/**
 * Manuel stok senkronizasyonu (fiyat güncelleme opsiyonel)
 */
exports.syncStock = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productMappingId, newStock, salePrice, listPrice } = req.body;

        if (!productMappingId || newStock === undefined) {
            return res.status(400).json({ error: "Ürün ID ve yeni stok miktarı gerekli" });
        }
        if (newStock < 0) {
            return res.status(400).json({ error: "Stok miktarı 0 veya üzeri olmalıdır" });
        }

        // Fiyat güncelleme varsa hazırla
        const priceUpdate = (salePrice !== undefined || listPrice !== undefined)
            ? {
                salePrice: salePrice !== undefined ? parseFloat(salePrice) : undefined,
                listPrice: listPrice !== undefined ? parseFloat(listPrice) : undefined
              }
            : null;

        const result = await manualStockSync(userId, productMappingId, Number(newStock), priceUpdate);

        const mpSuccess = (result.marketplaces || []).filter(m => m.syncStatus === "success").length;
        const mpError   = (result.marketplaces || []).filter(m => m.syncStatus === "error").length;

        return res.status(200).json({
            success: true,
            message: `Stok ${newStock} olarak güncellendi${priceUpdate?.salePrice ? `, fiyat ${priceUpdate.salePrice} TL olarak güncellendi` : ""}. ${mpSuccess} pazaryerinde senkronize edildi${mpError > 0 ? `, ${mpError} hata` : ""}.`,
            result
        });

    } catch (error) {
        logger.error("[STOCK SYNC] Hata:", error.message);
        return res.status(500).json({ error: "Stok senkronizasyonu başarısız", details: error.message });
    }
};

/**
 * Fiyat senkronizasyonu — tüm pazaryerlerine fiyat güncelle
 */
exports.syncPrice = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productMappingId, salePrice, listPrice } = req.body;

        if (!productMappingId) {
            return res.status(400).json({ error: "Ürün ID gerekli" });
        }
        if (!salePrice || parseFloat(salePrice) <= 0) {
            return res.status(400).json({ error: "Geçerli bir satış fiyatı girin" });
        }

        const mapping = await ProductMapping.findOne({ _id: productMappingId, userId });
        if (!mapping) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        const oldPrice     = mapping.masterProduct.price;
        const oldListPrice = mapping.masterProduct.listPrice;
        const newSalePrice = parseFloat(salePrice);
        const newListPrice = listPrice ? parseFloat(listPrice) : newSalePrice;

        const priceUpdate = { salePrice: newSalePrice, listPrice: newListPrice };

        // Mevcut stok ile birlikte fiyatı güncelle
        const result = await manualStockSync(
            userId,
            productMappingId,
            mapping.stockTracking.totalStock,
            priceUpdate
        );

        return res.status(200).json({
            success: true,
            message: `Fiyat ${newSalePrice} TL olarak güncellendi. ${(result.marketplaces || []).filter(m => m.syncStatus === "success").length} pazaryerinde senkronize edildi.`,
            oldPrice,
            newPrice: newSalePrice,
            oldListPrice,
            newListPrice,
            result
        });

    } catch (error) {
        logger.error("[PRICE SYNC] Hata:", error.message);
        return res.status(500).json({ error: "Fiyat senkronizasyonu başarısız", details: error.message });
    }
};

/**
 * Otomatik stok senkronizasyonu tetikle
 */
exports.triggerAutoSync = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const results = await autoStockSync(userId);

        return res.status(200).json({
            success: true,
            message: "Otomatik senkronizasyon tamamlandı",
            results
        });

    } catch (error) {
        logger.error("[AUTO SYNC] Hata:", error.message);
        return res.status(500).json({ error: "Otomatik senkronizasyon başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📋 KATEGORİ YÖNETİMİ
// ═══════════════════════════════════════════════════════════════

/**
 * Kategori eşleştirmelerini listele
 */
exports.getCategoryMappings = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const categories = await CategoryMapping.find({ userId }).sort({ "masterCategory.name": 1 }).lean();

        return res.status(200).json({
            success: true,
            total: categories.length,
            categories
        });

    } catch (error) {
        logger.error("[CATEGORY LIST] Hata:", error.message);
        return res.status(500).json({ error: "Kategoriler alınamadı", details: error.message });
    }
};

/**
 * Kategori eşleştirmesi oluştur veya güncelle
 */
exports.upsertCategoryMapping = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { masterCategory, marketplaceCategories } = req.body;

        if (!masterCategory || !masterCategory.name) {
            return res.status(400).json({ error: "Kategori adı gerekli" });
        }

        const slug = masterCategory.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        let categoryMapping = await CategoryMapping.findOne({
            userId,
            "masterCategory.slug": slug
        });

        if (categoryMapping) {
            // Güncelle
            categoryMapping.masterCategory = { ...categoryMapping.masterCategory, ...masterCategory, slug };

            if (marketplaceCategories) {
                for (const mc of marketplaceCategories) {
                    categoryMapping.setMarketplaceCategory(mc.marketplaceName, mc);
                }
            }
        } else {
            // Oluştur
            categoryMapping = new CategoryMapping({
                userId,
                masterCategory: { ...masterCategory, slug },
                marketplaceCategories: marketplaceCategories || []
            });
        }

        await categoryMapping.save();

        return res.status(200).json({
            success: true,
            message: "Kategori eşleştirmesi kaydedildi",
            category: categoryMapping
        });

    } catch (error) {
        logger.error("[CATEGORY UPSERT] Hata:", error.message);
        return res.status(500).json({ error: "Kategori kaydedilemedi", details: error.message });
    }
};

/**
 * Ürünün pazaryeri kategori eşleştirmesini güncelle
 */
exports.updateProductCategoryMapping = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productId } = req.params;
        const { marketplaceName, categoryId, categoryName, categoryPath } = req.body;

        if (!marketplaceName || !categoryId) {
            return res.status(400).json({ error: "Pazaryeri adı ve kategori ID gerekli" });
        }

        const product = await ProductMapping.findOne({ _id: productId, userId });
        if (!product) {
            return res.status(404).json({ error: "Ürün bulunamadı" });
        }

        const mappingIndex = product.marketplaceMappings.findIndex(
            m => m.marketplaceName === marketplaceName
        );

        if (mappingIndex >= 0) {
            product.marketplaceMappings[mappingIndex].categoryId = categoryId;
            product.marketplaceMappings[mappingIndex].categoryName = categoryName;
            product.marketplaceMappings[mappingIndex].categoryPath = categoryPath || [];
        } else {
            product.marketplaceMappings.push({
                marketplaceName,
                categoryId,
                categoryName,
                categoryPath: categoryPath || []
            });
        }

        await product.save();

        return res.status(200).json({
            success: true,
            message: "Ürün kategori eşleştirmesi güncellendi",
            product
        });

    } catch (error) {
        logger.error("[PRODUCT CATEGORY UPDATE] Hata:", error.message);
        return res.status(500).json({ error: "Kategori güncellenemedi", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📢 BİLDİRİM & LOG SİSTEMİ
// ═══════════════════════════════════════════════════════════════

/**
 * Senkronizasyon loglarını getir
 */
exports.getSyncLogs = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, limit = 50, actionType, status, priority } = req.query;

        const filter = { userId };
        if (actionType) filter.actionType = actionType;
        if (status) filter.status = status;
        if (priority) filter["notification.priority"] = priority;

        const total = await StockSyncLog.countDocuments(filter);
        const logs = await StockSyncLog.find(filter)
            .sort({ timestamp: -1 })
            .skip(Number(page) * Number(limit))
            .limit(Number(limit))
            .lean();

        return res.status(200).json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            logs
        });

    } catch (error) {
        logger.error("[SYNC LOGS] Hata:", error.message);
        return res.status(500).json({ error: "Loglar alınamadı", details: error.message });
    }
};

/**
 * Okunmamış bildirimleri getir
 */
exports.getUnreadNotifications = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const notifications = await StockSyncLog.find({
            userId,
            "notification.read": false
        })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

        const counts = {
            total: notifications.length,
            critical: notifications.filter(n => n.notification.priority === "critical").length,
            high: notifications.filter(n => n.notification.priority === "high").length,
            medium: notifications.filter(n => n.notification.priority === "medium").length,
            low: notifications.filter(n => n.notification.priority === "low").length
        };

        return res.status(200).json({
            success: true,
            counts,
            notifications
        });

    } catch (error) {
        logger.error("[NOTIFICATIONS] Hata:", error.message);
        return res.status(500).json({ error: "Bildirimler alınamadı", details: error.message });
    }
};

/**
 * Bildirimi okundu olarak işaretle
 */
exports.markNotificationRead = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { notificationId } = req.params;

        if (notificationId === "all") {
            await StockSyncLog.updateMany(
                { userId, "notification.read": false },
                { $set: { "notification.read": true, "notification.readAt": new Date() } }
            );
            return res.status(200).json({ success: true, message: "Tüm bildirimler okundu" });
        }

        const log = await StockSyncLog.findOne({ _id: notificationId, userId });
        if (!log) {
            return res.status(404).json({ error: "Bildirim bulunamadı" });
        }

        await log.markAsRead();

        return res.status(200).json({ success: true, message: "Bildirim okundu" });

    } catch (error) {
        logger.error("[MARK READ] Hata:", error.message);
        return res.status(500).json({ error: "İşlem başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD & İSTATİSTİKLER
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün yönetimi dashboard verilerini getir
 */
exports.getProductManagementDashboard = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        // Toplam ürün sayısı
        const totalProducts   = await ProductMapping.countDocuments({ userId });
        const outOfStock      = await ProductMapping.countDocuments({ userId, "stockTracking.isOutOfStock": true });
        const lowStock        = await ProductMapping.countDocuments({ userId, "stockTracking.isLowStock": true });
        const synced          = await ProductMapping.countDocuments({ userId, "marketplaceMappings.syncStatus": "synced" });

        // Pazaryeri bazlı istatistikler
        const mpAgg = await ProductMapping.aggregate([
            { $match: { userId: require("mongoose").Types.ObjectId.createFromHexString
                ? require("mongoose").Types.ObjectId.createFromHexString(userId.toString())
                : new (require("mongoose").Types.ObjectId)(userId.toString()) } },
            { $unwind: { path: "$marketplaceMappings", preserveNullAndEmptyArrays: false } },
            { $group: {
                _id: "$marketplaceMappings.marketplaceName",
                totalProducts:   { $sum: 1 },
                syncedProducts:  { $sum: { $cond: [{ $eq: ["$marketplaceMappings.syncStatus", "synced"] }, 1, 0] } },
                pendingProducts: { $sum: { $cond: [{ $eq: ["$marketplaceMappings.syncStatus", "pending"] }, 1, 0] } },
                errorProducts:   { $sum: { $cond: [{ $eq: ["$marketplaceMappings.syncStatus", "error"] }, 1, 0] } }
            }},
            { $project: { _id: 0, name: "$_id", totalProducts: 1, syncedProducts: 1, pendingProducts: 1, errorProducts: 1 } }
        ]);

        // Son 10 log
        const recentLogs = await StockSyncLog.find({ userId })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        // Okunmamış bildirim sayısı
        const unreadNotifications = await StockSyncLog.countDocuments({
            userId,
            "notification.read": false
        });

        return res.status(200).json({
            success: true,
            dashboard: {
                products: { total: totalProducts, outOfStock, lowStock, synced },
                marketplaces: mpAgg,
                recentLogs,
                unreadNotifications
            }
        });

    } catch (error) {
        logger.error("[DASHBOARD] Hata:", error.message);
        return res.status(500).json({ error: "Dashboard verisi alınamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🟠 N11 ÖZEL SERVİSLER
// ═══════════════════════════════════════════════════════════════

/**
 * N11 Ürün Yükleme (CreateProduct)
 * POST /product-management/n11/products
 */
exports.n11CreateProduct = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { products, integrator } = req.body;
        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }
        if (products.length > 1000) {
            return res.status(400).json({ error: "Tek seferde maksimum 1000 ürün yüklenebilir" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı. Lütfen önce N11 entegrasyonunu ekleyin." });
        }

        const result = await n11Service.createProduct(
            marketplace.credentials,
            products,
            integrator || "LysiaETIC"
        );

        // n11Service artık throw etmiyor — success kontrolü yap
        if (!result.success) {
            logger.error(`[N11 CREATE] Başarısız: ${result.error}`);
            return res.status(400).json({
                success: false,
                error: result.error || "N11 ürün yükleme başarısız"
            });
        }

        logger.info(`[N11 CREATE] ${products.length} ürün yükleme task'ı: ${result.taskId}`);

        return res.status(200).json({
            success: true,
            message: `${products.length} ürün N11 kuyruğuna alındı`,
            taskId: result.taskId,
            status: result.status,
            reasons: result.reasons
        });

    } catch (error) {
        logger.error("[N11 CREATE PRODUCT] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Fiyat & Stok Güncelleme (UpdateProductPriceAndStock)
 * POST /product-management/n11/stock-update
 */
exports.n11UpdateStock = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { updates, integrator } = req.body;
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: "Güncelleme listesi boş olamaz" });
        }
        if (updates.length > 1000) {
            return res.status(400).json({ error: "Tek seferde maksimum 1000 SKU güncellenebilir" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.updateProductPriceAndStock(
            marketplace.credentials,
            updates,
            integrator || "LysiaETIC"
        );

        // n11Service artık throw etmiyor — success kontrolü yap
        if (!result.success) {
            logger.error(`[N11 STOCK UPDATE] Başarısız: ${result.error}`);
            return res.status(400).json({
                success: false,
                error: result.error || "N11 stok güncelleme başarısız"
            });
        }

        logger.info(`[N11 STOCK UPDATE] ${updates.length} SKU güncelleme task'ı: ${result.taskId}`);

        return res.status(200).json({
            success: true,
            message: `${updates.length} SKU güncelleme kuyruğuna alındı`,
            taskId: result.taskId,
            status: result.status,
            reasons: result.reasons
        });

    } catch (error) {
        logger.error("[N11 STOCK UPDATE] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Task Detay Sorgulama (TaskDetails)
 * GET /product-management/n11/tasks/:taskId
 */
exports.n11GetTaskDetails = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { taskId } = req.params;
        if (!taskId) return res.status(400).json({ error: "Task ID gerekli" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getTaskDetails(marketplace.credentials, taskId);

        return res.status(200).json({
            success: true,
            taskId,
            data: result.data
        });

    } catch (error) {
        logger.error("[N11 TASK DETAILS] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Ürün Listesi (GetProductQuery)
 * GET /product-management/n11/products
 */
exports.n11GetProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, size = 100 } = req.query;

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getProducts(
            marketplace.credentials,
            { page: Number(page), size: Number(size) }
        );

        return res.status(200).json({
            success: true,
            total: result.total,
            products: result.products
        });

    } catch (error) {
        logger.error("[N11 GET PRODUCTS] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Kategori Ağacı (GetCategories)
 * GET /product-management/n11/categories
 */
exports.n11GetCategories = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getCategories(marketplace.credentials);

        return res.status(200).json({
            success: true,
            categories: result.categories
        });

    } catch (error) {
        logger.error("[N11 GET CATEGORIES] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Kategori Özellikleri (GetCategoryAttributesList)
 * GET /product-management/n11/categories/:categoryId/attributes
 */
exports.n11GetCategoryAttributes = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { categoryId } = req.params;
        if (!categoryId) return res.status(400).json({ error: "Kategori ID gerekli" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getCategoryAttributes(
            marketplace.credentials,
            categoryId
        );

        return res.status(200).json({
            success: true,
            categoryId,
            attributes: result.attributes
        });

    } catch (error) {
        logger.error("[N11 CATEGORY ATTRIBUTES] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Sipariş Listesi (GetShipmentPackages)
 * GET /product-management/n11/orders
 */
exports.n11GetOrders = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { status, startDate, endDate, page = 0, size = 100 } = req.query;

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.getOrders(
            marketplace.credentials,
            { status, startDate, endDate, page: Number(page), size: Number(size) }
        );

        return res.status(200).json({
            success: true,
            orders: result.orders
        });

    } catch (error) {
        logger.error("[N11 GET ORDERS] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Sipariş Güncelleme (UpdateOrder — Picking)
 * PUT /product-management/n11/orders/update
 */
exports.n11UpdateOrder = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { lineIds, status } = req.body;
        if (!lineIds || !Array.isArray(lineIds) || lineIds.length === 0) {
            return res.status(400).json({ error: "lineIds dizisi boş olamaz" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.updateOrderStatus(
            marketplace.credentials,
            lineIds,
            status || "Picking"
        );

        return res.status(200).json({
            success: true,
            message: `${lineIds.length} sipariş kalemi güncellendi`,
            results: result.results
        });

    } catch (error) {
        logger.error("[N11 UPDATE ORDER] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Paket Bölme (SplitPackages)
 * POST /product-management/n11/orders/split
 */
exports.n11SplitPackage = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { splitGroups } = req.body;
        if (!splitGroups || !Array.isArray(splitGroups) || splitGroups.length === 0) {
            return res.status(400).json({ error: "splitGroups dizisi boş olamaz" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.splitPackage(marketplace.credentials, splitGroups);

        return res.status(200).json({
            success: true,
            code: result.code,
            message: result.message || "Paket bölme işlemi başarılı"
        });

    } catch (error) {
        logger.error("[N11 SPLIT PACKAGE] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 Miktar Bazlı Paket Bölme & İptal (SplitPackagesByQuantity)
 * POST /product-management/n11/orders/split-by-quantity
 */
exports.n11SplitPackageByQuantity = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { splitPackages, cancelledItems } = req.body;
        if (!splitPackages || !Array.isArray(splitPackages) || splitPackages.length === 0) {
            return res.status(400).json({ error: "splitPackages dizisi boş olamaz" });
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.splitPackageByQuantity(
            marketplace.credentials,
            { splitPackages, cancelledItems: cancelledItems || [] }
        );

        return res.status(200).json({
            success: true,
            code: result.code,
            message: result.message || "Miktar bazlı paket bölme başarılı"
        });

    } catch (error) {
        logger.error("[N11 SPLIT BY QUANTITY] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

/**
 * N11 İşçilik Bedeli Ekleme
 * PUT /product-management/n11/orders/labor-costs
 */
exports.n11AddLaborCost = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { laborCostDetails } = req.body;
        if (!laborCostDetails || !Array.isArray(laborCostDetails) || laborCostDetails.length === 0) {
            return res.status(400).json({ error: "laborCostDetails dizisi boş olamaz" });
        }

        // Validasyon: her item için zorunlu alanlar
        for (const item of laborCostDetails) {
            if (!item.orderLineId) {
                return res.status(400).json({ error: "Her kalem için orderLineId zorunludur" });
            }
            if (item.totalLaborCostExcludingVAT === undefined || item.totalLaborCostExcludingVAT < 0) {
                return res.status(400).json({ error: "Geçerli bir işçilik bedeli girin" });
            }
            // laborVatRate: 0, 1, 10, 20 — default 20
            if (item.laborVatRate !== undefined && ![0, 1, 10, 20].includes(item.laborVatRate)) {
                return res.status(400).json({ error: "laborVatRate 0, 1, 10 veya 20 olmalıdır" });
            }
        }

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({ error: "N11 entegrasyonu bulunamadı" });
        }

        const result = await n11Service.addLaborCost(marketplace.credentials, laborCostDetails);

        return res.status(200).json({
            success: true,
            message: `${laborCostDetails.length} kaleme işçilik bedeli eklendi`,
            results: result.results
        });

    } catch (error) {
        logger.error("[N11 LABOR COST] Hata:", error.message);
        return res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔬 N11 DEBUG — Ham API Yanıtını Göster
// ═══════════════════════════════════════════════════════════════

/**
 * N11 API'den ham yanıtı döndür — hangi alanda ürünler geliyor görmek için
 * GET /product-management/n11/debug/raw-products
 */
exports.n11DebugRawProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /^n11$/i }
        });
        if (!marketplace) {
            return res.status(404).json({
                error: "N11 entegrasyonu bulunamadı",
                hint: "Entegrasyon ayarlarından N11 ekleyin. marketplaceName 'N11' veya 'n11' olmalı."
            });
        }

        const { apiKey, secretKey } = marketplace.credentials || {};
        if (!apiKey || !secretKey) {
            return res.status(400).json({
                error: "N11 credentials eksik",
                hint: "marketplace.credentials içinde 'apiKey' ve 'secretKey' alanları olmalı",
                credentialKeys: Object.keys(marketplace.credentials || {})
            });
        }

        // Axios ile doğrudan ham yanıtı al
        const axios = require("axios");
        let rawResponse = null;
        let rawError    = null;

        try {
            const response = await axios.get(
                "https://api.n11.com/ms/product-query",
                {
                    headers: {
                        appkey:           apiKey,
                        appsecret:        secretKey,
                        "Content-Type":   "application/json",
                        "User-Agent":     "LysiaETIC"
                    },
                    params: { page: 0, size: 10 },
                    timeout: 20000
                }
            );
            rawResponse = {
                status:   response.status,
                headers:  response.headers,
                dataType: typeof response.data,
                isArray:  Array.isArray(response.data),
                topLevelKeys: response.data && typeof response.data === "object"
                    ? Object.keys(response.data)
                    : null,
                // İlk 3 ürünü göster (varsa)
                sampleProducts: Array.isArray(response.data)
                    ? response.data.slice(0, 3)
                    : response.data?.products?.slice(0, 3)
                        || response.data?.productList?.slice(0, 3)
                        || response.data?.content?.slice(0, 3)
                        || response.data?.data?.products?.slice(0, 3)
                        || response.data?.result?.productList?.slice(0, 3)
                        || null,
                fullData: response.data   // Tüm ham yanıt
            };
        } catch (err) {
            rawError = {
                message:    err.message,
                statusCode: err.response?.status,
                data:       err.response?.data,
                code:       err.code
            };
        }

        return res.status(200).json({
            success:     !rawError,
            credentials: { apiKey: apiKey.substring(0, 6) + "***", secretKey: "***" },
            rawResponse,
            rawError,
            hint: rawError
                ? "API isteği başarısız. rawError alanını inceleyin."
                : "API isteği başarılı. topLevelKeys ve sampleProducts alanlarını inceleyin — ürünlerin hangi anahtar altında geldiğini göreceksiniz."
        });

    } catch (error) {
        logger.error("[N11 DEBUG] Hata:", error.message);
        return res.status(500).json({ error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 DASHBOARD & İSTATİSTİKLER
// ═══════════════════════════════════════════════════════════════

/**
 * Ürün yönetimi dashboard verileri
 */
exports.getProductManagementDashboard = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        // Toplam ürün sayıları
        const totalProducts = await ProductMapping.countDocuments({ userId });
        const outOfStock = await ProductMapping.countDocuments({ userId, "stockTracking.isOutOfStock": true });
        const lowStock = await ProductMapping.countDocuments({ userId, "stockTracking.isLowStock": true });

        // Pazaryeri bazlı dağılım
        const marketplaces = await Marketplace.find({ userId }).lean();
        const marketplaceStats = [];

        for (const mp of marketplaces) {
            const count = await ProductMapping.countDocuments({
                userId,
                "marketplaceMappings.marketplaceName": mp.marketplaceName
            });
            const syncedCount = await ProductMapping.countDocuments({
                userId,
                "marketplaceMappings": {
                    $elemMatch: {
                        marketplaceName: mp.marketplaceName,
                        isSynced: true
                    }
                }
            });

            marketplaceStats.push({
                name: mp.marketplaceName,
                totalProducts: count,
                syncedProducts: syncedCount,
                unsyncedProducts: count - syncedCount
            });
        }

        // Son senkronizasyon logları
        const recentLogs = await StockSyncLog.find({ userId })
            .sort({ timestamp: -1 })
            .limit(20)
            .lean();

        // Okunmamış bildirim sayısı
        const unreadNotifications = await StockSyncLog.countDocuments({
            userId,
            "notification.read": false
        });

        // Kategori sayısı
        const totalCategories = await CategoryMapping.countDocuments({ userId });

        return res.status(200).json({
            success: true,
            dashboard: {
                products: {
                    total: totalProducts,
                    outOfStock,
                    lowStock,
                    healthy: totalProducts - outOfStock - lowStock
                },
                marketplaces: marketplaceStats,
                recentLogs,
                unreadNotifications,
                totalCategories
            }
        });

    } catch (error) {
        logger.error("[PM DASHBOARD] Hata:", error.message);
        return res.status(500).json({ error: "Dashboard verileri alınamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔄 TÜM PAZARYERLERİNDEN TOPLU SYNC
// ═══════════════════════════════════════════════════════════════

/**
 * Kullanıcının tüm entegre pazaryerlerinden ürünleri arka planda çek
 * POST /product-management/sync/all
 */
exports.syncAllMarketplaces = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const marketplaces = await Marketplace.find({ userId }).lean();
        if (!marketplaces.length) {
            return res.status(404).json({ error: "Hiç pazaryeri entegrasyonu bulunamadı" });
        }

        logger.info(`[SYNC ALL] ${marketplaces.length} pazaryeri için senkronizasyon başlatılıyor...`);

        const results = [];
        for (const mp of marketplaces) {
            try {
                logger.info(`[SYNC ALL] ${mp.marketplaceName} senkronize ediliyor...`);
                const stats = await syncProductsFromMarketplace(userId, mp._id.toString(), mp.marketplaceName);
                results.push({ marketplace: mp.marketplaceName, success: true, stats });
                logger.info(`[SYNC ALL] ${mp.marketplaceName} tamamlandı — Yeni: ${stats.new}, Güncellenen: ${stats.updated}`);
            } catch (err) {
                logger.error(`[SYNC ALL] ${mp.marketplaceName} hatası: ${err.message}`);
                results.push({ marketplace: mp.marketplaceName, success: false, error: err.message });
            }
        }

        const totalNew     = results.reduce((s, r) => s + (r.stats?.new     || 0), 0);
        const totalUpdated = results.reduce((s, r) => s + (r.stats?.updated || 0), 0);
        const totalErrors  = results.filter(r => !r.success).length;

        return res.status(200).json({
            success: true,
            message: `${marketplaces.length} pazaryeri senkronize edildi — Yeni: ${totalNew}, Güncellenen: ${totalUpdated}`,
            results,
            summary: { totalNew, totalUpdated, totalErrors, marketplaceCount: marketplaces.length }
        });

    } catch (error) {
        logger.error("[SYNC ALL] Genel hata:", error.message);
        return res.status(500).json({ error: "Toplu senkronizasyon başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📊 ÜRÜN KARŞILAŞTIRMA MATRİSİ
// ═══════════════════════════════════════════════════════════════

/**
 * Hangi ürün hangi pazaryerinde var/yok — karşılaştırma matrisi
 * GET /product-management/comparison
 */
exports.getComparisonMatrix = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { page = 0, limit = 50, search, missingOnly } = req.query;

        // Kullanıcının tüm pazaryerlerini al
        const marketplaces = await Marketplace.find({ userId }).lean();
        const mpNames = marketplaces.map(m => m.marketplaceName);

        if (!mpNames.length) {
            return res.status(200).json({ success: true, matrix: [], marketplaces: [], total: 0 });
        }

        // Ürün filtresi
        const filter = { userId };
        if (search) {
            filter.$or = [
                { "masterProduct.name":    { $regex: search, $options: "i" } },
                { "masterProduct.barcode": { $regex: search, $options: "i" } },
                { "masterProduct.sku":     { $regex: search, $options: "i" } }
            ];
        }

        const allProducts = await ProductMapping.find(filter)
            .sort({ updatedAt: -1 })
            .lean();

        // Her ürün için hangi pazaryerinde var/yok hesapla
        const matrix = allProducts.map(product => {
            const presence = {};
            for (const mpName of mpNames) {
                const mapping = (product.marketplaceMappings || []).find(
                    m => m.marketplaceName?.toLowerCase() === mpName.toLowerCase()
                );
                presence[mpName] = mapping
                    ? { exists: true, syncStatus: mapping.syncStatus || "pending", stock: mapping.stock, price: mapping.price }
                    : { exists: false };
            }

            const existsCount  = Object.values(presence).filter(p => p.exists).length;
            const missingCount = mpNames.length - existsCount;

            return {
                _id:      product._id,
                name:     product.masterProduct?.name,
                barcode:  product.masterProduct?.barcode,
                sku:      product.masterProduct?.sku,
                price:    product.masterProduct?.price,
                stock:    product.stockTracking?.totalStock ?? product.masterProduct?.stock ?? 0,
                presence,
                existsCount,
                missingCount,
                missingMarketplaces: mpNames.filter(mp => !presence[mp]?.exists)
            };
        });

        // Sadece eksik olanları göster filtresi
        const filtered = missingOnly === "true"
            ? matrix.filter(p => p.missingCount > 0)
            : matrix;

        // Sayfalama
        const total    = filtered.length;
        const pageNum  = Number(page);
        const limitNum = Number(limit);
        const paged    = filtered.slice(pageNum * limitNum, (pageNum + 1) * limitNum);

        // Özet istatistikler
        const summary = {
            totalProducts:    allProducts.length,
            fullyDistributed: matrix.filter(p => p.missingCount === 0).length,
            partiallyMissing: matrix.filter(p => p.missingCount > 0 && p.existsCount > 0).length,
            notDistributed:   matrix.filter(p => p.existsCount === 0).length,
            perMarketplace:   {}
        };
        for (const mpName of mpNames) {
            summary.perMarketplace[mpName] = {
                present: matrix.filter(p => p.presence[mpName]?.exists).length,
                missing: matrix.filter(p => !p.presence[mpName]?.exists).length
            };
        }

        return res.status(200).json({
            success: true,
            marketplaces: mpNames,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            matrix: paged,
            summary
        });

    } catch (error) {
        logger.error("[COMPARISON MATRIX] Hata:", error.message);
        return res.status(500).json({ error: "Karşılaştırma matrisi alınamadı", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 TOPLU DAĞITIM (GELİŞMİŞ)
// ═══════════════════════════════════════════════════════════════

/**
 * Seçili ürünleri seçili pazaryerlerine toplu dağıt
 * POST /product-management/sync/bulk-distribute-selected
 */
exports.bulkDistributeSelected = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { productIds, targetMarketplaces } = req.body;

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({ error: "Ürün listesi boş olamaz" });
        }
        if (!targetMarketplaces || !Array.isArray(targetMarketplaces) || targetMarketplaces.length === 0) {
            return res.status(400).json({ error: "Hedef pazaryeri listesi boş olamaz" });
        }

        logger.info(`[BULK DIST SELECTED] ${productIds.length} ürün → ${targetMarketplaces.join(", ")}`);

        const results = { success: 0, skipped: 0, error: 0, details: [] };

        for (const productId of productIds) {
            try {
                const distResults = await distributeProductToMarketplaces(userId, productId, targetMarketplaces);
                const ok      = distResults.filter(r => r.status === "success").length;
                const skipped = distResults.filter(r => r.status === "skipped").length;
                const err     = distResults.filter(r => r.status === "error").length;

                if (ok > 0)      results.success++;
                if (skipped > 0) results.skipped++;
                if (err > 0)     results.error++;

                results.details.push({ productId, results: distResults });
            } catch (err) {
                results.error++;
                results.details.push({ productId, error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: `Toplu dağıtım tamamlandı — Başarılı: ${results.success}, Atlanan: ${results.skipped}, Hata: ${results.error}`,
            results
        });

    } catch (error) {
        logger.error("[BULK DIST SELECTED] Hata:", error.message);
        return res.status(500).json({ error: "Toplu dağıtım başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📥 EXCEL / CSV IMPORT
// ═══════════════════════════════════════════════════════════════

/**
 * Excel/CSV şablonu indir
 * GET /product-management/import/template
 */
exports.downloadTemplate = async (req, res) => {
    try {
        // Şablon sütunları
        const headers = [
            "Ürün Adı*", "Barkod*", "SKU*", "Açıklama",
            "Kategori", "Marka", "Fiyat*", "Liste Fiyatı",
            "Stok*", "KDV Oranı", "Renk", "Beden",
            "Görsel URL 1", "Görsel URL 2", "Görsel URL 3"
        ];

        // Örnek satırlar
        const sampleRows = [
            [
                "Örnek Ürün Adı", "1234567890123", "SKU-001", "Ürün açıklaması buraya",
                "Giyim > T-Shirt", "Nike", "299.90", "399.90",
                "50", "18", "Kırmızı", "M",
                "https://example.com/img1.jpg", "", ""
            ],
            [
                "İkinci Ürün", "9876543210987", "SKU-002", "İkinci ürün açıklaması",
                "Ayakkabı > Spor", "Adidas", "599.90", "799.90",
                "30", "18", "Siyah", "42",
                "https://example.com/img2.jpg", "https://example.com/img2b.jpg", ""
            ]
        ];

        const wb = xlsx.utils.book_new();
        const wsData = [headers, ...sampleRows];
        const ws = xlsx.utils.aoa_to_sheet(wsData);

        // Sütun genişlikleri
        ws["!cols"] = headers.map((h, i) => ({
            wch: [25, 18, 15, 30, 25, 15, 12, 12, 8, 10, 12, 8, 40, 40, 40][i] || 20
        }));

        // Başlık satırı stili (xlsx community edition'da sınırlı)
        xlsx.utils.book_append_sheet(wb, ws, "Ürünler");

        // Açıklama sayfası
        const infoData = [
            ["Alan", "Zorunlu", "Açıklama", "Örnek"],
            ["Ürün Adı*", "EVET", "Ürünün tam adı", "Nike Air Max 90"],
            ["Barkod*", "EVET", "Benzersiz barkod (EAN/GTIN)", "1234567890123"],
            ["SKU*", "EVET", "Stok kodu (benzersiz)", "SKU-001"],
            ["Açıklama", "Hayır", "Ürün açıklaması", "Rahat ve şık..."],
            ["Kategori", "Hayır", "Kategori yolu", "Giyim > T-Shirt"],
            ["Marka", "Hayır", "Marka adı", "Nike"],
            ["Fiyat*", "EVET", "Satış fiyatı (TL)", "299.90"],
            ["Liste Fiyatı", "Hayır", "Piyasa fiyatı (TL)", "399.90"],
            ["Stok*", "EVET", "Stok adedi", "50"],
            ["KDV Oranı", "Hayır", "KDV % (varsayılan: 18)", "18"],
            ["Renk", "Hayır", "Renk özelliği", "Kırmızı"],
            ["Beden", "Hayır", "Beden özelliği", "M / 42"],
            ["Görsel URL 1-3", "Hayır", "Ürün görseli URL'leri", "https://..."],
        ];
        const wsInfo = xlsx.utils.aoa_to_sheet(infoData);
        wsInfo["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 40 }, { wch: 30 }];
        xlsx.utils.book_append_sheet(wb, wsInfo, "Açıklama");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Disposition", "attachment; filename=urun_yukleme_sablonu.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buffer);

    } catch (error) {
        logger.error("[TEMPLATE DOWNLOAD] Hata:", error.message);
        return res.status(500).json({ error: "Şablon oluşturulamadı", details: error.message });
    }
};

/**
 * Excel/CSV dosyasını parse et — önizleme için (kaydetmez)
 * POST /product-management/import/preview
 */
exports.previewImport = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi" });

        const { rows, errors } = parseExcelBuffer(req.file.buffer);

        if (rows.length === 0 && errors.length > 0) {
            return res.status(400).json({ error: "Dosya okunamadı veya geçerli satır bulunamadı", errors });
        }

        // Barkod çakışma kontrolü
        const barcodes = rows.map(r => r.barcode).filter(Boolean);
        const existingProducts = await ProductMapping.find({
            userId,
            "masterProduct.barcode": { $in: barcodes }
        }).lean();
        const existingBarcodes = new Set(existingProducts.map(p => p.masterProduct.barcode));

        const preview = rows.map((row, idx) => ({
            rowNumber: idx + 2,
            ...row,
            status: existingBarcodes.has(row.barcode) ? "update" : "new",
            validationErrors: validateRow(row)
        }));

        const stats = {
            total:   preview.length,
            new:     preview.filter(r => r.status === "new").length,
            update:  preview.filter(r => r.status === "update").length,
            invalid: preview.filter(r => r.validationErrors.length > 0).length
        };

        return res.status(200).json({
            success: true,
            stats,
            preview,
            parseErrors: errors
        });

    } catch (error) {
        logger.error("[IMPORT PREVIEW] Hata:", error.message);
        return res.status(500).json({ error: "Dosya önizleme başarısız", details: error.message });
    }
};

/**
 * Excel/CSV dosyasını içe aktar ve kaydet
 * POST /product-management/import/execute
 */
exports.executeImport = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi" });

        const { skipErrors = "true", updateExisting = "true" } = req.body;
        const shouldSkipErrors    = skipErrors === "true";
        const shouldUpdateExisting = updateExisting === "true";

        const { rows, errors: parseErrors } = parseExcelBuffer(req.file.buffer);

        if (rows.length === 0) {
            return res.status(400).json({ error: "Dosyada geçerli ürün satırı bulunamadı", parseErrors });
        }

        const results = {
            total:   rows.length,
            created: 0,
            updated: 0,
            skipped: 0,
            errors:  0,
            details: []
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            // Validasyon
            const validationErrors = validateRow(row);
            if (validationErrors.length > 0) {
                if (shouldSkipErrors) {
                    results.skipped++;
                    results.details.push({ rowNumber: rowNum, status: "skipped", name: row.name, barcode: row.barcode, errors: validationErrors });
                    continue;
                } else {
                    results.errors++;
                    results.details.push({ rowNumber: rowNum, status: "error", name: row.name, barcode: row.barcode, errors: validationErrors });
                    continue;
                }
            }

            try {
                // Mevcut ürün kontrolü
                const existing = await ProductMapping.findOne({
                    userId,
                    "masterProduct.barcode": row.barcode
                });

                if (existing) {
                    if (!shouldUpdateExisting) {
                        results.skipped++;
                        results.details.push({ rowNumber: rowNum, status: "skipped", name: row.name, barcode: row.barcode, reason: "Barkod zaten mevcut, güncelleme devre dışı" });
                        continue;
                    }

                    // Güncelle
                    existing.masterProduct.name        = row.name;
                    existing.masterProduct.description = row.description || existing.masterProduct.description;
                    existing.masterProduct.price       = row.price;
                    existing.masterProduct.listPrice   = row.listPrice || row.price;
                    existing.masterProduct.category    = row.category || existing.masterProduct.category;
                    existing.masterProduct.brand       = row.brand || existing.masterProduct.brand;
                    if (row.images.length > 0) existing.masterProduct.images = row.images;
                    if (row.color || row.size) {
                        existing.masterProduct.attributes = {
                            ...existing.masterProduct.attributes,
                            color: row.color || existing.masterProduct.attributes?.color,
                            size:  row.size  || existing.masterProduct.attributes?.size
                        };
                    }
                    if (row.stock !== undefined) {
                        existing.masterProduct.stock         = row.stock;
                        existing.stockTracking.totalStock    = row.stock;
                        existing.stockTracking.availableStock = row.stock;
                        existing.updateStockStatus();
                    }

                    await existing.save();
                    results.updated++;
                    results.details.push({ rowNumber: rowNum, status: "updated", name: row.name, barcode: row.barcode, id: existing._id });

                } else {
                    // Yeni ürün oluştur
                    const stockVal = row.stock || 0;
                    const newProduct = new ProductMapping({
                        userId,
                        masterProduct: {
                            name:        row.name,
                            barcode:     row.barcode,
                            sku:         row.sku,
                            description: row.description || "",
                            images:      row.images,
                            price:       row.price,
                            listPrice:   row.listPrice || row.price,
                            stock:       stockVal,
                            category:    row.category || "",
                            brand:       row.brand || "",
                            attributes: {
                                color: row.color || "",
                                size:  row.size  || ""
                            }
                        },
                        marketplaceMappings: [],
                        stockTracking: {
                            totalStock:        stockVal,
                            availableStock:    stockVal,
                            lowStockThreshold: 10
                        }
                    });
                    newProduct.updateStockStatus();
                    await newProduct.save();

                    results.created++;
                    results.details.push({ rowNumber: rowNum, status: "created", name: row.name, barcode: row.barcode, id: newProduct._id });
                }

            } catch (err) {
                logger.error(`[IMPORT] Satır ${rowNum} hatası:`, err.message);
                results.errors++;
                results.details.push({ rowNumber: rowNum, status: "error", name: row.name, barcode: row.barcode, error: err.message });
            }
        }

        // Toplu import logu
        await StockSyncLog.create({
            userId,
            actionType: "bulk_update",
            product: { barcode: "IMPORT", name: `Excel import: ${results.created} yeni, ${results.updated} güncellendi` },
            changes:  { field: "import", oldValue: 0, newValue: results.created + results.updated },
            status:   results.errors > 0 ? "partial" : "success",
            notification: { priority: "medium" }
        });

        logger.info(`[IMPORT] Tamamlandı — Oluşturulan: ${results.created}, Güncellenen: ${results.updated}, Atlanan: ${results.skipped}, Hata: ${results.errors}`);

        return res.status(200).json({
            success: true,
            message: `İçe aktarma tamamlandı — ${results.created} yeni ürün, ${results.updated} güncellendi`,
            results,
            parseErrors
        });

    } catch (error) {
        logger.error("[IMPORT EXECUTE] Hata:", error.message);
        return res.status(500).json({ error: "İçe aktarma başarısız", details: error.message });
    }
};

/**
 * Ürünleri Excel olarak dışa aktar
 * GET /product-management/export
 */
exports.exportProducts = async (req, res) => {
    try {
        const userId = toObjectId(req.user?._id || req.user?.id);
        if (!userId) return res.status(401).json({ error: "Yetkilendirme hatası" });

        const { search, category, marketplace, stockStatus } = req.query;

        const filter = { userId };
        if (search) {
            filter.$or = [
                { "masterProduct.name":    { $regex: search, $options: "i" } },
                { "masterProduct.barcode": { $regex: search, $options: "i" } },
                { "masterProduct.sku":     { $regex: search, $options: "i" } }
            ];
        }
        if (category)    filter["masterProduct.category"]    = { $regex: category, $options: "i" };
        if (marketplace) filter["marketplaceMappings.marketplaceName"] = marketplace;
        if (stockStatus === "outOfStock") filter["stockTracking.isOutOfStock"] = true;
        if (stockStatus === "lowStock")   filter["stockTracking.isLowStock"]   = true;

        const products = await ProductMapping.find(filter).lean();

        // Pazaryeri listesi
        const allMarketplaces = await Marketplace.find({ userId }).lean();
        const mpNames = allMarketplaces.map(m => m.marketplaceName);

        // Başlık satırı
        const headers = [
            "Ürün Adı", "Barkod", "SKU", "Açıklama", "Kategori", "Marka",
            "Fiyat", "Liste Fiyatı", "Stok", "Renk", "Beden",
            "Görsel URL 1", "Görsel URL 2",
            "Stok Durumu", "Oluşturulma Tarihi",
            ...mpNames.map(mp => `${mp} Durumu`),
            ...mpNames.map(mp => `${mp} Stok`),
            ...mpNames.map(mp => `${mp} Fiyat`)
        ];

        const rows = products.map(p => {
            const mp = p.masterProduct || {};
            const st = p.stockTracking  || {};
            const attrs = mp.attributes || {};

            const stockLabel = st.isOutOfStock ? "Stok Yok" : st.isLowStock ? "Düşük Stok" : "Normal";

            const mpPresence = mpNames.map(mpName => {
                const m = (p.marketplaceMappings || []).find(x => x.marketplaceName?.toLowerCase() === mpName.toLowerCase());
                return m ? (m.syncStatus === "synced" ? "Aktif" : "Bekliyor") : "Yok";
            });
            const mpStock = mpNames.map(mpName => {
                const m = (p.marketplaceMappings || []).find(x => x.marketplaceName?.toLowerCase() === mpName.toLowerCase());
                return m?.stock ?? "";
            });
            const mpPrice = mpNames.map(mpName => {
                const m = (p.marketplaceMappings || []).find(x => x.marketplaceName?.toLowerCase() === mpName.toLowerCase());
                return m?.price ?? "";
            });

            return [
                mp.name || "", mp.barcode || "", mp.sku || "",
                mp.description || "", mp.category || "", mp.brand || "",
                mp.price || 0, mp.listPrice || 0, st.totalStock ?? mp.stock ?? 0,
                attrs.color || "", attrs.size || "",
                (mp.images || [])[0] || "", (mp.images || [])[1] || "",
                stockLabel,
                p.createdAt ? new Date(p.createdAt).toLocaleDateString("tr-TR") : "",
                ...mpPresence, ...mpStock, ...mpPrice
            ];
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
        ws["!cols"] = headers.map(() => ({ wch: 20 }));
        xlsx.utils.book_append_sheet(wb, ws, "Ürünler");

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
        const filename = `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buffer);

    } catch (error) {
        logger.error("[EXPORT] Hata:", error.message);
        return res.status(500).json({ error: "Dışa aktarma başarısız", details: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════

/**
 * Excel/CSV buffer'ı parse et
 */
const parseExcelBuffer = (buffer) => {
    const rows   = [];
    const errors = [];

    try {
        const wb = xlsx.read(buffer, { type: "buffer" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });

        if (raw.length < 2) {
            errors.push("Dosyada veri satırı bulunamadı (en az 1 başlık + 1 veri satırı gerekli)");
            return { rows, errors };
        }

        // Başlık satırını normalize et
        const headerRow = raw[0].map(h => String(h || "").trim().toLowerCase()
            .replace(/\*/g, "")
            .replace(/\s+/g, " ")
        );

        // Sütun indekslerini bul (esnek eşleştirme)
        const colMap = {
            name:        findCol(headerRow, ["ürün adı", "urun adi", "name", "title", "ad"]),
            barcode:     findCol(headerRow, ["barkod", "barcode", "ean", "gtin"]),
            sku:         findCol(headerRow, ["sku", "stok kodu", "stock code", "kod"]),
            description: findCol(headerRow, ["açıklama", "aciklama", "description", "desc"]),
            category:    findCol(headerRow, ["kategori", "category"]),
            brand:       findCol(headerRow, ["marka", "brand"]),
            price:       findCol(headerRow, ["fiyat", "price", "satış fiyatı", "satis fiyati"]),
            listPrice:   findCol(headerRow, ["liste fiyatı", "liste fiyati", "list price", "listprice"]),
            stock:       findCol(headerRow, ["stok", "stock", "adet", "quantity"]),
            vatRate:     findCol(headerRow, ["kdv", "vat", "kdv oranı", "vat rate"]),
            color:       findCol(headerRow, ["renk", "color", "colour"]),
            size:        findCol(headerRow, ["beden", "size", "numara"]),
            image1:      findCol(headerRow, ["görsel url 1", "gorsel url 1", "image1", "image url 1", "resim 1"]),
            image2:      findCol(headerRow, ["görsel url 2", "gorsel url 2", "image2", "image url 2", "resim 2"]),
            image3:      findCol(headerRow, ["görsel url 3", "gorsel url 3", "image3", "image url 3", "resim 3"])
        };

        // Veri satırlarını işle (satır 1'den başla, 0 başlık)
        for (let i = 1; i < raw.length; i++) {
            const row = raw[i];

            // Tamamen boş satırı atla
            if (row.every(cell => !cell && cell !== 0)) continue;

            const get = (col) => col !== -1 ? String(row[col] || "").trim() : "";
            const getNum = (col) => {
                if (col === -1) return undefined;
                const v = parseFloat(String(row[col] || "").replace(",", "."));
                return isNaN(v) ? undefined : v;
            };

            const images = [get(colMap.image1), get(colMap.image2), get(colMap.image3)].filter(Boolean);

            rows.push({
                name:        get(colMap.name),
                barcode:     get(colMap.barcode),
                sku:         get(colMap.sku) || get(colMap.barcode),
                description: get(colMap.description),
                category:    get(colMap.category),
                brand:       get(colMap.brand),
                price:       getNum(colMap.price) || 0,
                listPrice:   getNum(colMap.listPrice),
                stock:       getNum(colMap.stock) !== undefined ? Math.round(getNum(colMap.stock)) : 0,
                vatRate:     getNum(colMap.vatRate) || 18,
                color:       get(colMap.color),
                size:        get(colMap.size),
                images
            });
        }

    } catch (err) {
        errors.push(`Dosya okuma hatası: ${err.message}`);
    }

    return { rows, errors };
};

/**
 * Sütun adını esnek şekilde bul
 */
const findCol = (headers, candidates) => {
    for (const candidate of candidates) {
        const idx = headers.findIndex(h => h.includes(candidate));
        if (idx !== -1) return idx;
    }
    return -1;
};

/**
 * Satır validasyonu
 */
const validateRow = (row) => {
    const errors = [];
    if (!row.name || row.name.length < 2)    errors.push("Ürün adı en az 2 karakter olmalı");
    if (!row.barcode || row.barcode.length < 3) errors.push("Barkod en az 3 karakter olmalı");
    if (!row.sku || row.sku.length < 1)      errors.push("SKU boş olamaz");
    if (!row.price || row.price <= 0)        errors.push("Fiyat 0'dan büyük olmalı");
    if (row.stock < 0)                       errors.push("Stok negatif olamaz");
    return errors;
};
