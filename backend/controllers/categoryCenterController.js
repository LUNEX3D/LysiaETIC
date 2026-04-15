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
// 🔧 YARDIMCI: Hepsiburada Kategori Çekme (Sayfalı + Detaylı)
// ═══════════════════════════════════════════════════════════════
/**
 * HB Kategori API'sinden kategorileri çeker.
 * @param {object} credentials - DB'den gelen credential objesi
 * @param {object} options - { onlyLeaf: true/false }
 *
 * v4 Düzeltmeler:
 *   1. SIT kullanıcıları için SIT endpoint'leri ÖNCE deneniyor (SIT creds production'da 403 alır)
 *   2. listing-external endpoint'lerine merchantId query parametresi eklendi
 *      (bu endpoint "Merchant ID is not specified" hatası veriyordu)
 *   3. Kullanıcının kendi ortam endpoint'i (getEndpoints) her zaman ilk sırada
 *   4. Daha az gereksiz istek — ilk başarılı endpoint'te dur
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

    // ═══════════════════════════════════════════════════════════════
    // ENDPOINT STRATEJİSİ (v4):
    // 1. Kullanıcının kendi ortamı ÖNCE (SIT user → SIT önce, Prod user → Prod önce)
    // 2. Diğer ortam SONRA (fallback)
    // 3. listing-external URL'lerine merchantId ekleniyor
    // ═══════════════════════════════════════════════════════════════
    const userEp = getEndpoints(hbCreds);
    const prodEp = HB_ENDPOINTS;
    const sitEp  = HB_SIT_ENDPOINTS;
    const isSitUser = (userEp.MPOP === sitEp.MPOP);

    // URL oluşturucu — listing-external URL'lerine merchantId ekle
    const buildBaseUrls = (ep) => {
        const urls = [];
        // MPOP endpoint (merchantId auth header'da yeterli)
        urls.push(`${ep.MPOP}/product/api/categories/get-all-categories`);
        // CATEGORY (listing-external) endpoint — merchantId query param olarak da gerekli
        if (ep.CATEGORY !== ep.MPOP) {
            urls.push(`${ep.CATEGORY}/product/api/categories/get-all-categories`);
        }
        return urls;
    };

    // SIT user → SIT önce, sonra production fallback
    // Production user → Production önce (SIT eklenmez)
    const allBaseUrls = isSitUser
        ? [...buildBaseUrls(sitEp), ...buildBaseUrls(prodEp)]
        : [...buildBaseUrls(prodEp), ...buildBaseUrls(sitEp)];

    // Duplikasyon temizle
    const baseUrls = [...new Set(allBaseUrls)];

    logger.info(`[HB CATEGORIES] Ortam: ${isSitUser ? "SIT (SIT öncelikli)" : "Production"}, merchantId: ${merchantId ? merchantId.substring(0, 8) + "..." : "YOK"}, onlyLeaf=${onlyLeaf}, ${baseUrls.length} URL denenecek`);

    /**
     * Tek bir parametre seti ile sayfalı kategori çekme
     */
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
                    status: "ACTIVE",
                    version: "1",
                    page: String(page),
                    size: String(size)
                });

                // listing-external endpoint'lerine merchantId ekle
                if (merchantId && baseUrl.includes("listing-external")) {
                    params.set("merchantId", merchantId);
                }

                if (queryOpts.leaf === true || queryOpts.leaf === "true") {
                    params.set("leaf", "true");
                } else if (queryOpts.leaf === false || queryOpts.leaf === "false") {
                    params.set("leaf", "false");
                }

                if (queryOpts.available === true || queryOpts.available === "true") {
                    params.set("available", "true");
                }

                if (queryOpts.type) {
                    params.set("type", queryOpts.type);
                }

                const url = `${baseUrl}?${params.toString()}`;

                try {
                    if (page === 0) {
                        logger.info(`[HB CATEGORIES${label}] Deneniyor: ${url}`);
                    }
                    const response = await axios.get(url, { headers, timeout: 45000 });
                    const data = response.data;

                    if (page === 0) {
                        const dataType = Array.isArray(data) ? "array" : typeof data;
                        const keys = data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).join(", ") : "-";
                        logger.info(`[HB CATEGORIES${label}] Response tipi: ${dataType}, keys: ${keys}, status: ${response.status}`);
                    }

                    let cats = [];
                    if (Array.isArray(data)) {
                        cats = data;
                    } else if (data && typeof data === "object") {
                        const inner = data.data || data.content || data.categories;
                        if (Array.isArray(inner)) {
                            cats = inner;
                        } else if (inner && typeof inner === "object" && !Array.isArray(inner)) {
                            cats = [];
                        }
                    }

                    if (cats.length > 0) {
                        categories.push(...cats);
                        workingBaseUrl = baseUrl;
                        page++;
                        pageSuccess = true;
                        if (cats.length < size) hasMore = false;

                        if (page === 1 && cats[0]) {
                            logger.info(`[HB CATEGORIES${label}] ✅ ${cats.length} kategori bulundu. Örnek: ${JSON.stringify(cats[0]).substring(0, 200)}`);
                        }
                        break;
                    } else {
                        if (workingBaseUrl === baseUrl) {
                            hasMore = false;
                            pageSuccess = true;
                            break;
                        }
                        logger.warn(`[HB CATEGORIES${label}] ${baseUrl} boş sonuç, sonraki URL deneniyor...`);
                    }
                } catch (err) {
                    const errDetail = err.response
                        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || "").substring(0, 200)}`
                        : err.message;
                    logger.warn(`[HB CATEGORIES${label}] ${baseUrl} başarısız: ${errDetail}`);
                }
            }

            if (!pageSuccess) {
                logger.error(`[HB CATEGORIES${label}] Hiçbir endpoint çalışmadı (sayfa ${page})`);
                hasMore = false;
            }
        }

        if (categories.length > 0) {
            logger.info(`[HB CATEGORIES${label}] ✅ Toplam ${categories.length} kategori çekildi`);
        } else {
            logger.warn(`[HB CATEGORIES${label}] ⚠ 0 kategori çekildi`);
        }
        return categories;
    };

    // ═══════════════════════════════════════════════════════════════
    // ANA ÇEKME STRATEJİSİ (v4 — Optimize)
    // ═══════════════════════════════════════════════════════════════
    let allCategories = [];

    if (onlyLeaf) {
        allCategories = await fetchPaginated({ leaf: true, available: true }, " leaf");

        if (allCategories.length === 0) {
            logger.info("[HB CATEGORIES] Type'sız boş döndü, type parametreli deneniyor (HB, HX, HC)...");
            for (const type of ["HB", "HX", "HC"]) {
                try {
                    const cats = await fetchPaginated({ leaf: true, available: true, type }, ` ${type}-leaf`);
                    if (cats.length > 0) allCategories.push(...cats);
                } catch (e) { logger.warn(`[HB CATEGORIES] ${type} leaf hatası: ${e.message}`); }
            }
        }
    } else {
        allCategories = await fetchPaginated({}, " all");

        if (allCategories.length === 0) {
            logger.info("[HB CATEGORIES] Type'sız boş döndü, type parametreli deneniyor (HB, HX, HC)...");
            for (const type of ["HB", "HX", "HC"]) {
                try {
                    const cats = await fetchPaginated({ type }, ` ${type}-all`);
                    if (cats.length > 0) allCategories.push(...cats);
                } catch (e) { logger.warn(`[HB CATEGORIES] ${type} all hatası: ${e.message}`); }
            }
        }

        if (allCategories.length === 0) {
            logger.warn("[HB CATEGORIES] Hâlâ boş, available=true ile deneniyor...");
            allCategories = await fetchPaginated({ available: true }, " fallback-available");
        }
    }

    // ── Duplikasyon temizliği ──
    const seenIds = new Set();
    const uniqueCategories = [];
    for (const cat of allCategories) {
        const id = String(cat.categoryId || cat.id || "");
        if (id && !seenIds.has(id)) {
            seenIds.add(id);
            uniqueCategories.push(cat);
        }
    }

    logger.info(`[HB CATEGORIES] Toplam ${uniqueCategories.length} benzersiz kategori (ham: ${allCategories.length}, onlyLeaf=${onlyLeaf})`);

    if (uniqueCategories.length === 0) {
        throw new Error("Hepsiburada kategori API'sinden veri alınamadı. Lütfen entegrasyon bilgilerinizi kontrol edin.");
    }

    return uniqueCategories;
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
                categories = await fetchHepsiburadaCategoryTree(credentials, { onlyLeaf: false });
                break;
            case normalizedName.includes("amazon"):
                categories = await fetchAmazonCategoryTree(credentials);
                break;
            default:
                return badRequest(res, `${marketplaceName} için kategori çekme desteklenmiyor`);
        }

        // ── Hepsiburada: flat liste → ağaç yapısına dönüştür ──
        // HB API flat liste döndürür (parentCategoryId ile ilişki).
        // Frontend TreeNode bileşeni nested children bekler, bu yüzden burada dönüştürüyoruz.
        if (normalizedName.includes("hepsiburada") && Array.isArray(categories) && categories.length > 0) {
            const catMap = new Map();
            for (const cat of categories) {
                const id = String(cat.categoryId || cat.id || "");
                if (!id) continue;
                catMap.set(id, {
                    id,
                    categoryId: id,
                    name: cat.name || cat.categoryName || "",
                    parentCategoryId: cat.parentCategoryId ? String(cat.parentCategoryId) : null,
                    leaf: cat.leaf === true || cat.leaf === "true",
                    available: cat.available === true || cat.available === "true",
                    status: cat.status || "ACTIVE",
                    hasChildren: false,
                    subCategories: []
                });
            }

            // Parent-child ilişkilerini kur
            const roots = [];
            for (const [id, node] of catMap) {
                if (node.parentCategoryId && catMap.has(node.parentCategoryId)) {
                    const parent = catMap.get(node.parentCategoryId);
                    parent.subCategories.push(node);
                    parent.hasChildren = true;
                } else {
                    roots.push(node);
                }
            }

            // İsimlere göre sırala (recursive)
            const sortTree = (nodes) => {
                nodes.sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"));
                for (const n of nodes) {
                    if (n.subCategories.length > 0) sortTree(n.subCategories);
                }
            };
            sortTree(roots);

            logger.info(`[CATEGORY CENTER] ${marketplaceName} — ${categories.length} flat → ${roots.length} kök kategori (ağaç)`);

            return ok(res, `${marketplaceName} kategorileri başarıyla çekildi`, {
                marketplaceName: marketplace.marketplaceName,
                categories: roots,
                total: categories.length,
                treeRootCount: roots.length,
                fetchedAt: new Date().toISOString()
            });
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
 * Hepsiburada Kategori Ağacı — Tree yapısında döndür
 * GET /api/category-center/hepsiburada/categories?q=telefon
 *
 * Flat listeyi parentCategoryId ilişkisiyle ağaç yapısına dönüştürür.
 * Opsiyonel q parametresi ile filtreleme yapılabilir (eşleşen dallar + üst dalları gösterilir).
 */
exports.getHepsiburadaCategoryTree = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const q = (req.query.q || "").trim().toLowerCase();

        // Hepsiburada entegrasyonunu bul
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /hepsiburada/i }
        });

        if (!marketplace) {
            return notFound(res, "Hepsiburada entegrasyonu bulunamadı. Lütfen önce entegrasyonu ekleyin.");
        }

        const credentials = decryptCredentials(marketplace.credentials);

        // Tüm kategorileri çek (ağaç için leaf+non-leaf hepsi lazım)
        let allCategories;
        try {
            allCategories = await fetchHepsiburadaCategoryTree(credentials, { onlyLeaf: false });
        } catch (fetchErr) {
            logger.warn(`[HB CAT TREE] Tüm kategoriler çekilemedi, sadece leaf deneniyor: ${fetchErr.message}`);
            try {
                allCategories = await fetchHepsiburadaCategoryTree(credentials, { onlyLeaf: true });
            } catch (leafErr) {
                return ok(res, "Hepsiburada kategorileri alınamadı: " + leafErr.message, { tree: [], flatCount: 0, fetchedAt: new Date().toISOString() });
            }
        }

        if (!allCategories || allCategories.length === 0) {
            return ok(res, "Hepsiburada kategorileri boş döndü", { tree: [], flatCount: 0, fetchedAt: new Date().toISOString() });
        }

        // ── Flat listeyi ağaç yapısına dönüştür ──
        const catMap = new Map();
        for (const cat of allCategories) {
            const id = String(cat.categoryId || cat.id || "");
            if (!id) continue;
            catMap.set(id, {
                categoryId: id,
                name: cat.name || cat.categoryName || "",
                parentCategoryId: cat.parentCategoryId ? String(cat.parentCategoryId) : null,
                leaf: cat.leaf === true || cat.leaf === "true",
                available: cat.available === true || cat.available === "true",
                status: cat.status || "ACTIVE",
                displayName: cat.displayName || cat.name || cat.categoryName || "",
                children: []
            });
        }

        // Parent-child ilişkilerini kur
        const roots = [];
        for (const [id, node] of catMap) {
            if (node.parentCategoryId && catMap.has(node.parentCategoryId)) {
                catMap.get(node.parentCategoryId).children.push(node);
            } else {
                roots.push(node);
            }
        }

        // İsimlere göre sırala (recursive)
        const sortTree = (nodes) => {
            nodes.sort((a, b) => (a.name || "").localeCompare(b.name || "", "tr"));
            for (const n of nodes) {
                if (n.children.length > 0) sortTree(n.children);
            }
        };
        sortTree(roots);

        // ── Arama filtresi (opsiyonel) ──
        let resultTree = roots;
        if (q.length >= 2) {
            // Eşleşen node'ları ve üst dallarını bul
            const matchedIds = new Set();
            const markAncestors = (id) => {
                if (matchedIds.has(id)) return;
                matchedIds.add(id);
                const node = catMap.get(id);
                if (node?.parentCategoryId && catMap.has(node.parentCategoryId)) {
                    markAncestors(node.parentCategoryId);
                }
            };

            // Eşleşen node'ları bul
            for (const [id, node] of catMap) {
                if ((node.name || "").toLowerCase().includes(q) ||
                    (node.displayName || "").toLowerCase().includes(q)) {
                    markAncestors(id);
                }
            }

            // Filtrelenmiş ağacı oluştur
            const filterTree = (nodes) => {
                return nodes
                    .filter(n => matchedIds.has(n.categoryId))
                    .map(n => ({
                        ...n,
                        children: filterTree(n.children)
                    }));
            };
            resultTree = filterTree(roots);
        }

        return ok(res, `Hepsiburada kategori ağacı başarıyla oluşturuldu`, {
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
 *
 * Tüm kategorileri flat + path bilgisiyle Excel'e yazar.
 */
exports.exportHepsiburadaCategoriesExcel = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) return badRequest(res, "Yetkilendirme hatası");

        const q = (req.query.q || "").trim().toLowerCase();

        // Hepsiburada entegrasyonunu bul
        const marketplace = await Marketplace.findOne({
            userId,
            marketplaceName: { $regex: /hepsiburada/i }
        });

        if (!marketplace) {
            return notFound(res, "Hepsiburada entegrasyonu bulunamadı");
        }

        const credentials = decryptCredentials(marketplace.credentials);

        // Tüm kategorileri çek (export için leaf+non-leaf hepsi lazım)
        let allCategories;
        try {
            allCategories = await fetchHepsiburadaCategoryTree(credentials, { onlyLeaf: false });
        } catch (fetchErr) {
            logger.warn(`[HB CAT EXPORT] Tüm kategoriler çekilemedi, sadece leaf deneniyor: ${fetchErr.message}`);
            try {
                allCategories = await fetchHepsiburadaCategoryTree(credentials, { onlyLeaf: true });
            } catch (leafErr) {
                return serverError(res, leafErr, "HB kategorileri alınamadı: " + leafErr.message);
            }
        }

        if (!allCategories || allCategories.length === 0) {
            return badRequest(res, "Hepsiburada kategorileri boş döndü, export yapılamıyor");
        }

        // Ağaç yapısını oluştur (path hesaplamak için)
        const catMap = new Map();
        for (const cat of allCategories) {
            const id = String(cat.categoryId || cat.id || "");
            if (!id) continue;
            catMap.set(id, {
                categoryId: id,
                name: cat.name || cat.categoryName || "",
                parentCategoryId: cat.parentCategoryId ? String(cat.parentCategoryId) : null,
                leaf: cat.leaf === true || cat.leaf === "true",
                available: cat.available === true || cat.available === "true",
                status: cat.status || "ACTIVE"
            });
        }

        // Path hesapla
        const getPath = (id, visited = new Set()) => {
            if (visited.has(id)) return [];
            visited.add(id);
            const node = catMap.get(id);
            if (!node) return [];
            if (!node.parentCategoryId || !catMap.has(node.parentCategoryId)) {
                return [node.name];
            }
            return [...getPath(node.parentCategoryId, visited), node.name];
        };

        // Excel satırlarını oluştur
        let rows = [];
        for (const [id, node] of catMap) {
            const pathArr = getPath(id);
            const pathStr = pathArr.join(" > ");
            const depth = pathArr.length;

            rows.push({
                categoryId: id,
                name: node.name,
                path: pathStr,
                depth,
                parentCategoryId: node.parentCategoryId || "",
                leaf: node.leaf,
                available: node.available,
                status: node.status
            });
        }

        // Arama filtresi
        if (q.length >= 2) {
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.path.toLowerCase().includes(q)
            );
        }

        // Path'e göre sırala
        rows.sort((a, b) => a.path.localeCompare(b.path, "tr"));

        // Excel oluştur
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
            { wch: 6 },   // #
            { wch: 14 },  // Kategori ID
            { wch: 35 },  // Kategori Adı
            { wch: 70 },  // Tam Yol
            { wch: 10 },  // Derinlik
            { wch: 16 },  // Üst Kategori ID
            { wch: 14 },  // Yaprak
            { wch: 14 },  // Kullanılabilir
            { wch: 12 },  // Durum
        ];

        xlsx.utils.book_append_sheet(wb, ws, "HB Kategoriler");

        // İstatistik sayfası
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
        const filename = q
            ? `hb_kategoriler_${q}_${dateStr}.xlsx`
            : `hb_kategoriler_${dateStr}.xlsx`;

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
 * Kategori ağacında arama yap (flat list + search)
 * GET /api/category-center/:marketplaceName/search?q=telefon
 *
 * Hepsiburada flat liste döndürdüğü için özel işlem:
 *   flat → parentCategoryId ile path hesapla → arama yap
 *
 * v2 Düzeltmeler:
 *   - HB için onlyLeaf:false ile TÜM kategoriler çekiliyor (parent'lar dahil)
 *     böylece path hesaplaması doğru yapılıyor (ör: Takı > Kolye > Kolye Ucu)
 *   - Arama sonuçlarında sadece leaf + available kategoriler gösteriliyor
 *     (ürün açılabilir olanlar) ama path hesaplaması parent'lardan yapılıyor
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
        let isHepsiburada = false;

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
                // v2: TÜM kategorileri çek (parent'lar dahil) — path hesaplaması için şart
                // Eski: onlyLeaf:true → parent'lar gelmiyordu → path bozuktu → alt kategoriler bulunamıyordu
                categories = await fetchHepsiburadaCategoryTree(credentials, { onlyLeaf: false });
                isHepsiburada = true;
                break;
            case normalizedName.includes("amazon"):
                categories = await fetchAmazonCategoryTree(credentials);
                break;
            default:
                return badRequest(res, `${marketplaceName} için kategori arama desteklenmiyor`);
        }

        let searchResults = [];

        if (isHepsiburada && Array.isArray(categories) && categories.length > 0) {
            // ── Hepsiburada: flat liste → path hesapla → arama ──
            // HB API flat liste döndürür (parentCategoryId ile ilişki)
            const catMap = new Map();
            for (const cat of categories) {
                const id = String(cat.categoryId || cat.id || "");
                if (!id) continue;
                catMap.set(id, {
                    id,
                    name: cat.name || cat.categoryName || "",
                    parentCategoryId: cat.parentCategoryId ? String(cat.parentCategoryId) : null,
                    leaf: cat.leaf === true || cat.leaf === "true",
                    available: cat.available === true || cat.available === "true",
                });
            }

            // Hangi ID'lerin child'ı var tespit et
            const hasChildrenSet = new Set();
            for (const [, node] of catMap) {
                if (node.parentCategoryId && catMap.has(node.parentCategoryId)) {
                    hasChildrenSet.add(node.parentCategoryId);
                }
            }

            // Path hesapla (recursive, circular referans korumalı)
            const pathCache = new Map();
            const getPath = (id, visited = new Set()) => {
                if (pathCache.has(id)) return pathCache.get(id);
                if (visited.has(id)) return [];
                visited.add(id);
                const node = catMap.get(id);
                if (!node) return [];
                if (!node.parentCategoryId || !catMap.has(node.parentCategoryId)) {
                    const result = [node.name];
                    pathCache.set(id, result);
                    return result;
                }
                const result = [...getPath(node.parentCategoryId, visited), node.name];
                pathCache.set(id, result);
                return result;
            };

            // Tüm kategorilerde arama yap
            const query = q.trim().toLowerCase();
            for (const [id, node] of catMap) {
                const pathArr = getPath(id);
                const pathStr = pathArr.join(" > ");
                const nameLC = (node.name || "").toLowerCase();
                const pathLC = pathStr.toLowerCase();

                if (nameLC.includes(query) || pathLC.includes(query)) {
                    searchResults.push({
                        id: node.id,
                        name: node.name,
                        path: pathStr,
                        leaf: node.leaf,
                        available: node.available,
                        hasChildren: hasChildrenSet.has(id)
                    });
                }
            }

            // Sıralama: leaf+available önce (ürün açılabilir), sonra leaf, sonra diğerleri
            searchResults.sort((a, b) => {
                const aScore = (a.leaf && a.available) ? 0 : a.leaf ? 1 : 2;
                const bScore = (b.leaf && b.available) ? 0 : b.leaf ? 1 : 2;
                if (aScore !== bScore) return aScore - bScore;
                return (a.path || "").localeCompare(b.path || "", "tr");
            });
        } else {
            // ── Diğer pazaryerleri: nested tree → recursive flatten + search ──
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

            searchResults = flattenAndSearch(categories);
        }

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
