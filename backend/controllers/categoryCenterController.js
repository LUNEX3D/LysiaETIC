/**
 * Category Center Controller — LysiaETIC
 *
 * 1) Master kategori eşleştirme tablosu (Excel'den import edilmiş)
 * 2) Tüm pazaryerlerinden canlı kategori ağaçları
 *
 * Desteklenen platformlar:
 *   - Trendyol (apigw.trendyol.com)  — master
 *   - N11 (api.n11.com/cdn/categories)
 *   - ÇiçekSepeti (apis.ciceksepeti.com)
 *   - Hepsiburada (listing-external.hepsiburada.com)
 *   - Amazon (SP-API)
 */

const axios = require("axios");
const xlsx = require("xlsx");
const Marketplace = require("../models/Marketplace");
const MasterCategoryMapping = require("../models/MasterCategoryMapping");
const logger = require("../config/logger");
const { decryptCredentials } = require("../utils/encryption");
const { ok, badRequest, notFound, serverError, paginated } = require("../utils/apiResponse");

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Trendyol Kategori Ağacı
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

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: N11 Kategori Ağacı
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: ÇiçekSepeti Kategori Ağacı
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Hepsiburada Kategori Ağacı
// ═══════════════════════════════════════════════════════════════
const fetchHepsiburadaCategoryTree = async (credentials) => {
    const { merchantId, apiKey, serviceKey } = credentials;
    const actualKey = serviceKey || apiKey;

    if (!merchantId || !actualKey) {
        throw new Error("Hepsiburada credentials eksik (merchantId, apiKey/serviceKey)");
    }

    const authHeader = `Basic ${Buffer.from(`${merchantId}:${actualKey}`).toString("base64")}`;

    const endpoints = [
        "https://listing-external.hepsiburada.com/categories/get-all-categories",
        "https://listing-external.hepsiburada.com/categories"
    ];

    for (const url of endpoints) {
        try {
            const response = await axios.get(url, {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                    "User-Agent": "LysiaETIC"
                },
                timeout: 30000
            });

            const data = response.data;
            if (Array.isArray(data)) return data;
            if (data?.categories) return data.categories;
            if (data?.data) return Array.isArray(data.data) ? data.data : [];
            return [];
        } catch (err) {
            logger.warn(`[CATEGORY CENTER] Hepsiburada endpoint başarısız: ${url} — ${err.message}`);
        }
    }

    throw new Error("Hepsiburada kategori API'sine erişilemedi");
};

// ═══════════════════════════════════════════════════════════════
// 🔧 YARDIMCI: Amazon Kategori Ağacı (Product Types)
// ═══════════════════════════════════════════════════════════════
const fetchAmazonCategoryTree = async () => {
    return [];
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
            // Regex arama — text index'ten daha esnek (Türkçe karakter desteği)
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

        return paginated(res, "Eşleştirmeler getirildi", rows, { page, limit, total });

    } catch (error) {
        logger.error("[CATEGORY CENTER] Mapping listeleme hatası:", error.message);
        return serverError(res, error);
    }
};

/**
 * Master eşleştirme istatistikleri
 * GET /api/category-center/mappings/stats
 */
exports.getMappingStats = async (req, res) => {
    try {
        const [
            total,
            uniqueMasters,
            withN11,
            withCiceksepeti,
            withHepsiburada,
            withAmazon
        ] = await Promise.all([
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
 * Tek bir master eşleştirmeyi güncelle (Hepsiburada/Amazon ekle)
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

        const rows = await MasterCategoryMapping.find(filter)
            .sort({ masterPath: 1 })
            .lean();

        // Excel satırlarını oluştur
        const excelRows = rows.map((r, idx) => ({
            "#": idx + 1,
            "Master ID": r.masterId || "",
            "Master Kategori": r.masterName || "",
            "Master Yol": r.masterPath || "",
            "Trendyol ID": r.trendyolId || "",
            "Trendyol Yol": r.trendyolPath || "",
            "N11 ID": r.n11Id || "",
            "N11 Yol": r.n11Path || "",
            "ÇiçekSepeti ID": r.ciceksepetiId || "",
            "ÇiçekSepeti Yol": r.ciceksepetiPath || "",
            "Hepsiburada ID": r.hepsiburadaId || "",
            "Hepsiburada Yol": r.hepsiburadaPath || "",
            "Amazon ID": r.amazonId || "",
            "Amazon Yol": r.amazonPath || ""
        }));

        // Workbook oluştur
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(excelRows);

        // Sütun genişlikleri
        ws["!cols"] = [
            { wch: 6 },   // #
            { wch: 12 },  // Master ID
            { wch: 25 },  // Master Kategori
            { wch: 50 },  // Master Yol
            { wch: 12 },  // Trendyol ID
            { wch: 50 },  // Trendyol Yol
            { wch: 12 },  // N11 ID
            { wch: 50 },  // N11 Yol
            { wch: 14 },  // ÇiçekSepeti ID
            { wch: 50 },  // ÇiçekSepeti Yol
            { wch: 14 },  // Hepsiburada ID
            { wch: 50 },  // Hepsiburada Yol
            { wch: 12 },  // Amazon ID
            { wch: 50 },  // Amazon Yol
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

        // Buffer oluştur ve gönder
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
// 🌳 CANLI KATEGORİ AĞACI
// ═══════════════════════════════════════════════════════════════

/**
 * Belirli bir pazaryerinin kategori ağacını çek
 * GET /api/category-center/:marketplaceName/tree
 */
exports.getCategoryTree = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const { marketplaceName } = req.params;
        if (!marketplaceName) return badRequest(res, "Pazaryeri adı gerekli");

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: new RegExp(`^${marketplaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
        });

        if (!marketplace) {
            return notFound(res, `${marketplaceName} entegrasyonu bulunamadı. Lütfen önce entegrasyonu ekleyin.`);
        }

        const credentials = decryptCredentials(marketplace.credentials);

        let categories = [];
        const normalizedName = marketplaceName.toLowerCase().replace(/\s+/g, "");

        switch (true) {
            case normalizedName.includes("trendyol"):
                categories = await fetchTrendyolCategoryTree(credentials);
                break;
            case normalizedName === "n11":
                categories = await fetchN11CategoryTree(credentials);
                break;
            case normalizedName.includes("ciceksepeti") || normalizedName.includes("çiçeksepeti"):
                categories = await fetchCiceksepetiCategoryTree(credentials);
                break;
            case normalizedName.includes("hepsiburada"):
                categories = await fetchHepsiburadaCategoryTree(credentials);
                break;
            case normalizedName.includes("amazon"):
                categories = await fetchAmazonCategoryTree(credentials);
                break;
            default:
                return badRequest(res, `${marketplaceName} için kategori çekme desteklenmiyor`);
        }

        logger.info(`[CATEGORY CENTER] ${marketplaceName} — ${Array.isArray(categories) ? categories.length : 0} üst kategori çekildi`);

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
                m.marketplaceName.toLowerCase().replace(/\s+/g, "") === name.toLowerCase().replace(/\s+/g, "")
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
 * Kategori ağacında arama yap (flat list + search)
 * GET /api/category-center/:marketplaceName/search?q=telefon
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

        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: new RegExp(`^${marketplaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
        });

        if (!marketplace) {
            return notFound(res, `${marketplaceName} entegrasyonu bulunamadı`);
        }

        const credentials = decryptCredentials(marketplace.credentials);
        let categories = [];
        const normalizedName = marketplaceName.toLowerCase().replace(/\s+/g, "");

        switch (true) {
            case normalizedName.includes("trendyol"):
                categories = await fetchTrendyolCategoryTree(credentials);
                break;
            case normalizedName === "n11":
                categories = await fetchN11CategoryTree(credentials);
                break;
            case normalizedName.includes("ciceksepeti") || normalizedName.includes("çiçeksepeti"):
                categories = await fetchCiceksepetiCategoryTree(credentials);
                break;
            case normalizedName.includes("hepsiburada"):
                categories = await fetchHepsiburadaCategoryTree(credentials);
                break;
            case normalizedName.includes("amazon"):
                categories = await fetchAmazonCategoryTree(credentials);
                break;
            default:
                return badRequest(res, `${marketplaceName} için kategori arama desteklenmiyor`);
        }

        const flattenAndSearch = (cats, parentPath = []) => {
            let results = [];
            if (!Array.isArray(cats)) return results;

            for (const cat of cats) {
                const name = cat.name || cat.categoryName || cat.title || "";
                const id = cat.id || cat.categoryId || "";
                const catPath = [...parentPath, name];
                const pathStr = catPath.join(" > ");
                const subs = cat.subCategories || cat.children || cat.subCats || [];

                const query = q.toLowerCase();
                if (name.toLowerCase().includes(query) || pathStr.toLowerCase().includes(query)) {
                    results.push({
                        id,
                        name,
                        path: pathStr,
                        hasChildren: Array.isArray(subs) && subs.length > 0
                    });
                }

                if (Array.isArray(subs) && subs.length > 0) {
                    results = results.concat(flattenAndSearch(subs, catPath));
                }
            }
            return results;
        };

        const searchResults = flattenAndSearch(categories);

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
