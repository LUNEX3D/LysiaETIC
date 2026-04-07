/**
 * Auto Invoice Controller — LysiaETIC
 *
 * Otomatik fatura kesme ayarları CRUD + manuel tetikleme + fatura listesi
 */

const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const { processManualBatchInvoice, processAllUninvoiced } = require("../services/autoInvoiceService");
const qnbService = require("../services/qnbEInvoiceService");
const logger = require("../config/logger");

// ═══════════════════════════════════════════════════════════════════════════
//  AYAR YÖNETİMİ (Config CRUD)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auto-invoice/config
 * Kullanıcının otomatik fatura ayarlarını getir
 */
exports.getConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            // Varsayılan config oluştur (kaydetme — sadece döndür)
            config = {
                enabled: false,
                provider: "qnb",
                enabledMarketplaces: [],
                triggerStatuses: ["Shipped", "Delivered"],
                documentType: "EARSIVFATURA",
                invoiceTypeCode: "SATIS",
                invoiceSeriesCode: "LYS",
                currency: "TRY",
                sendingType: "ELEKTRONIK",
                supplier: { vkn: "", name: "", taxOffice: "", street: "", district: "", city: "", country: "Turkiye", phone: "", email: "" },
                defaultCustomer: { vkn: "11111111111", name: "Nihai Tüketici", firstName: "Nihai", lastName: "Tüketici", city: "Istanbul", district: "Merkez", country: "Turkiye" },
                qnbCredentials: { username: "", password: "", env: "test" },
                defaultVatRate: 20,
                defaultNote: "",
                stats: { totalInvoicesCreated: 0, consecutiveErrors: 0 },
            };
        }

        res.json({ success: true, data: config });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getConfig hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * PUT /api/auto-invoice/config
 * Kullanıcının otomatik fatura ayarlarını kaydet/güncelle
 */
exports.saveConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            enabled, provider, enabledMarketplaces, triggerStatuses,
            documentType, invoiceTypeCode, invoiceSeriesCode, currency, sendingType,
            supplier, defaultCustomer, qnbCredentials,
            defaultVatRate, defaultNote
        } = req.body;

        // Validasyon
        if (enabled && (!supplier || !supplier.vkn)) {
            return res.status(400).json({
                success: false,
                message: "Otomatik fatura aktif edilmek için satıcı VKN bilgisi zorunludur."
            });
        }

        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            config = new AutoInvoiceConfig({ userId });
        }

        // Alanları güncelle
        if (enabled !== undefined) config.enabled = enabled;
        if (provider) config.provider = provider;
        if (enabledMarketplaces) config.enabledMarketplaces = enabledMarketplaces;
        if (triggerStatuses) config.triggerStatuses = triggerStatuses;
        if (documentType) config.documentType = documentType;
        if (invoiceTypeCode) config.invoiceTypeCode = invoiceTypeCode;
        if (invoiceSeriesCode !== undefined) config.invoiceSeriesCode = invoiceSeriesCode;
        if (currency) config.currency = currency;
        if (sendingType) config.sendingType = sendingType;
        if (supplier) config.supplier = { ...config.supplier.toObject?.() || config.supplier, ...supplier };
        if (defaultCustomer) config.defaultCustomer = { ...config.defaultCustomer.toObject?.() || config.defaultCustomer, ...defaultCustomer };
        if (qnbCredentials) config.qnbCredentials = { ...config.qnbCredentials.toObject?.() || config.qnbCredentials, ...qnbCredentials };
        if (defaultVatRate !== undefined) config.defaultVatRate = defaultVatRate;
        if (defaultNote !== undefined) config.defaultNote = defaultNote;

        // Aktif edilirken ardışık hata sayacını sıfırla
        if (enabled === true) {
            config.stats.consecutiveErrors = 0;
        }

        await config.save();

        logger.info("[AutoInvoice] Config güncellendi — userId=" + userId + " enabled=" + config.enabled);
        res.json({ success: true, data: config, message: "Ayarlar kaydedildi." });
    } catch (error) {
        logger.error("[AutoInvoice Controller] saveConfig hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/toggle
 * Otomatik faturayı aç/kapat (hızlı toggle)
 */
exports.toggleEnabled = async (req, res) => {
    try {
        const userId = req.user._id;
        const config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            return res.status(404).json({ success: false, message: "Önce ayarları kaydedin." });
        }

        // Açılırken satıcı VKN kontrolü
        if (!config.enabled && (!config.supplier || !config.supplier.vkn)) {
            return res.status(400).json({
                success: false,
                message: "Satıcı VKN bilgisi eksik. Lütfen önce ayarlardan firma bilgilerinizi girin."
            });
        }

        config.enabled = !config.enabled;
        if (config.enabled) {
            config.stats.consecutiveErrors = 0; // Açılırken hata sayacını sıfırla
        }
        await config.save();

        logger.info("[AutoInvoice] Toggle — userId=" + userId + " enabled=" + config.enabled);
        res.json({
            success: true,
            enabled: config.enabled,
            message: config.enabled ? "Otomatik fatura aktif edildi." : "Otomatik fatura devre dışı bırakıldı."
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] toggle hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  MANUEL TETİKLEME
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auto-invoice/process
 * Seçili siparişler için manuel fatura kes
 * Body: { orderIds: ["id1", "id2", ...] }
 */
exports.processOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderIds } = req.body;

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ success: false, message: "Sipariş ID listesi gerekli." });
        }

        if (orderIds.length > 50) {
            return res.status(400).json({ success: false, message: "Tek seferde en fazla 50 sipariş faturalanabilir." });
        }

        logger.info("[AutoInvoice] Manuel tetikleme — userId=" + userId + " siparişSayısı=" + orderIds.length);

        const result = await processManualBatchInvoice(userId, orderIds);

        if (result.error) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            data: result,
            message: result.invoiced + " fatura kesildi, " + result.skipped + " atlandı" +
                (result.errors > 0 ? ", " + result.errors + " hata" : "")
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] processOrders hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/process-single/:orderId
 * Tek sipariş için fatura kes
 */
exports.processSingleOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Sipariş ID gerekli." });
        }

        // Siparişin bu kullanıcıya ait olduğunu doğrula
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Sipariş bulunamadı." });
        }

        if (order.invoiceId) {
            return res.status(400).json({ success: false, message: "Bu sipariş zaten faturalandı." });
        }

        logger.info("[AutoInvoice] Tek sipariş faturalama — orderId=" + orderId);

        const result = await processManualBatchInvoice(userId, [orderId]);

        if (result.error) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            data: result,
            message: result.invoiced > 0 ? "Fatura başarıyla kesildi." : "Fatura kesilemedi."
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] processSingleOrder hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  FATURA LİSTESİ & DETAY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auto-invoice/invoices
 * Kullanıcının kesilen faturalarını listele
 * Query: ?page=1&limit=20&status=created&marketplace=Trendyol&startDate=2026-01-01&endDate=2026-12-31
 */
exports.listInvoices = async (req, res) => {
    try {
        const userId = req.user._id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        // Filtreler
        const filter = { userId };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.marketplace) filter.marketplaceName = req.query.marketplace;
        if (req.query.createdBy) filter.createdBy = req.query.createdBy;
        if (req.query.startDate || req.query.endDate) {
            filter.issueDate = {};
            if (req.query.startDate) filter.issueDate.$gte = new Date(req.query.startDate);
            if (req.query.endDate) filter.issueDate.$lte = new Date(req.query.endDate + "T23:59:59.999Z");
        }

        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Invoice.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: invoices,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] listInvoices hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/invoices/:invoiceId
 * Tek fatura detayı
 */
exports.getInvoiceDetail = async (req, res) => {
    try {
        const userId = req.user._id;
        const { invoiceId } = req.params;

        const invoice = await Invoice.findOne({ _id: invoiceId, userId }).lean();
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }

        // İlişkili siparişi de getir
        let order = null;
        if (invoice.orderId) {
            order = await Order.findById(invoice.orderId).lean();
        }

        res.json({ success: true, data: { invoice, order } });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getInvoiceDetail hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/stats
 * Fatura istatistikleri (dashboard için)
 */
exports.getStats = async (req, res) => {
    try {
        const userId = req.user._id;

        const [config, totalInvoices, todayInvoices, totalAmount, byMarketplace, byStatus] = await Promise.all([
            AutoInvoiceConfig.findOne({ userId }).lean(),
            Invoice.countDocuments({ userId }),
            Invoice.countDocuments({
                userId,
                createdAt: { $gte: new Date(new Date().toISOString().split("T")[0]) }
            }),
            Invoice.aggregate([
                { $match: { userId: req.user._id, status: "created" } },
                { $group: { _id: null, total: { $sum: "$totals.payableAmount" } } }
            ]),
            Invoice.aggregate([
                { $match: { userId: req.user._id } },
                { $group: { _id: "$marketplaceName", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Invoice.aggregate([
                { $match: { userId: req.user._id } },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
        ]);

        // Faturasız sipariş sayısı
        const uninvoicedOrders = await Order.countDocuments({
            user: userId,
            invoiceId: { $exists: false },
            isCancelled: false,
            isReturned: false,
        });

        res.json({
            success: true,
            data: {
                config: config ? {
                    enabled: config.enabled,
                    provider: config.provider,
                    stats: config.stats,
                } : null,
                totalInvoices,
                todayInvoices,
                totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
                uninvoicedOrders,
                byMarketplace: byMarketplace.map(m => ({ marketplace: m._id || "Diğer", count: m.count })),
                byStatus: byStatus.map(s => ({ status: s._id, count: s.count })),
            }
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getStats hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/reset-errors
 * Ardışık hata sayacını sıfırla (kullanıcı tarafından)
 */
exports.resetErrors = async (req, res) => {
    try {
        const userId = req.user._id;
        const config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            return res.status(404).json({ success: false, message: "Ayar bulunamadı." });
        }

        config.stats.consecutiveErrors = 0;
        config.stats.lastError = "";
        await config.save();

        res.json({ success: true, message: "Hata sayacı sıfırlandı." });
    } catch (error) {
        logger.error("[AutoInvoice Controller] resetErrors hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * POST /api/auto-invoice/cleanup-ghost-invoices
 * QNB portalında oluşturulamamış "hayalet" faturaları temizle.
 * Eski numaraVerilsinMi:0 veya kontör hatası nedeniyle DB'de "created" görünen
 * ama QNB'de aslında var olmayan faturaları siler ve siparişleri tekrar faturalanabilir yapar.
 */
exports.cleanupGhostInvoices = async (req, res) => {
    try {
        const userId = req.user._id;

        // Kullanıcının tüm "created" durumundaki faturalarını bul
        const ghostInvoices = await Invoice.find({
            userId,
            status: "created",
            createdBy: "auto"
        }).lean();

        if (ghostInvoices.length === 0) {
            return res.json({ success: true, message: "Temizlenecek fatura bulunamadı.", cleaned: 0 });
        }

        // Her birini sil ve ilgili siparişin invoiceStatus'unu sıfırla
        let cleaned = 0;
        const cleanedList = [];

        for (const inv of ghostInvoices) {
            // Faturayı sil
            await Invoice.deleteOne({ _id: inv._id });

            // Siparişin fatura durumunu sıfırla (tekrar faturalanabilir)
            if (inv.orderId) {
                await Order.updateOne(
                    { _id: inv.orderId },
                    { $unset: { invoiceId: 1, invoiceNumber: 1 }, invoiceStatus: "none" }
                );
            }

            cleaned++;
            cleanedList.push({
                invoiceNumber: inv.invoiceNumber || "",
                uuid: inv.uuid || "",
                orderNumber: inv.orderNumber || "",
            });
        }

        // Hata sayacını da sıfırla
        await AutoInvoiceConfig.updateOne({ userId }, {
            "stats.consecutiveErrors": 0,
            "stats.lastError": ""
        });

        logger.info("[AutoInvoice] 🧹 Hayalet fatura temizliği — " + cleaned + " fatura silindi, siparişler sıfırlandı — userId=" + userId);

        res.json({
            success: true,
            message: cleaned + " hayalet fatura temizlendi. Siparişler tekrar faturalanabilir durumda.",
            cleaned,
            invoices: cleanedList
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] cleanupGhostInvoices hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  TOPLU FATURALAMA & PDF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auto-invoice/process-all
 * Faturası olmayan tüm siparişler için toplu fatura kes
 * Body: { limit: 50 } (opsiyonel)
 */
exports.processAllOrders = async (req, res) => {
    try {
        const userId = req.user._id;
        const limit = Math.min(50, Math.max(1, parseInt(req.body.limit) || 50));

        logger.info("[AutoInvoice] Toplu faturalama başlatıldı — userId=" + userId + " limit=" + limit);

        const result = await processAllUninvoiced(userId, limit);

        if (result.error) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            data: result,
            message: result.invoiced + " fatura kesildi" +
                (result.skipped > 0 ? ", " + result.skipped + " atlandı" : "") +
                (result.errors > 0 ? ", " + result.errors + " hata" : "") +
                " (toplam " + result.totalEligible + " sipariş işlendi)"
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] processAllOrders hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/invoices/:invoiceId/pdf
 * Fatura PDF'ini QNB e-Arşiv'den indir ve döndür
 *
 * Credential öncelik sırası:
 *   1. Kullanıcının AutoInvoiceConfig'deki qnbCredentials
 *   2. .env'deki QNB_EARSIV_USERNAME / QNB_EARSIV_PASSWORD
 *   3. TEST_ACCOUNTS (son çare)
 *
 * İndirme stratejisi:
 *   1. faturaZipiAl (ZIP içinde PDF + XML)
 *   2. Başarısızsa → faturaOnizleme (HTML önizleme)
 */
exports.getInvoicePdf = async (req, res) => {
    try {
        const userId = req.user._id;
        const { invoiceId } = req.params;

        // Faturayı bul
        const invoice = await Invoice.findOne({ _id: invoiceId, userId }).lean();
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }

        if (!invoice.uuid && !invoice.invoiceNumber) {
            return res.status(400).json({ success: false, message: "Fatura UUID veya numarası eksik." });
        }

        // ── Credential'ları belirle ─────────────────────────────────────
        const env = invoice.env || "test";

        // Önce kullanıcının kendi config'inden al
        const config = await AutoInvoiceConfig.findOne({ userId }).lean();
        const configCreds = config?.qnbCredentials || {};

        const earsivUsername = configCreds.username || process.env.QNB_EARSIV_USERNAME || "";
        const earsivPassword = configCreds.password || process.env.QNB_EARSIV_PASSWORD || "";

        if (!earsivUsername || !earsivPassword) {
            return res.status(400).json({
                success: false,
                message: "e-Arşiv bağlantı bilgileri eksik. Lütfen Faturalandırma ayarlarından QNB kullanıcı adı ve şifrenizi girin."
            });
        }

        // ── QNB Login ───────────────────────────────────────────────────
        const loginResult = await qnbService.login({
            username: earsivUsername,
            password: earsivPassword,
            env,
            service: "earsiv"
        });

        if (!loginResult.success) {
            return res.status(502).json({ success: false, message: "e-Arşiv oturumu açılamadı: " + loginResult.error });
        }

        const sessionId = loginResult.sessionId;
        const vkn = invoice.supplier?.vkn || config?.supplier?.vkn || earsivUsername.split(".")[0] || "";

        try {
            // ── Strateji 1: faturaZipiAl ile ZIP indir ──────────────────
            const result = await qnbService.downloadEArchiveZip({
                sessionId,
                uuid: invoice.uuid,
                env
            });

            if (result.success && result.data) {
                const zipData = result.data;

                // Doğrudan base64 string ise
                if (typeof zipData === "string") {
                    const buffer = Buffer.from(zipData, "base64");

                    // Logout
                    try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                    res.setHeader("Content-Type", "application/zip");
                    res.setHeader("Content-Disposition", "attachment; filename=\"" + (invoice.invoiceNumber || "fatura") + ".zip\"");
                    return res.send(buffer);
                }

                // Object ise (zipIcerigi / belgeIcerigi alanı olabilir)
                const zipContent = zipData.zipIcerigi || zipData.belgeIcerigi || zipData.content;
                if (typeof zipContent === "string") {
                    const buffer = Buffer.from(zipContent, "base64");

                    // Logout
                    try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                    res.setHeader("Content-Type", "application/zip");
                    res.setHeader("Content-Disposition", "attachment; filename=\"" + (invoice.invoiceNumber || "fatura") + ".zip\"");
                    return res.send(buffer);
                }
            }

            // ── Strateji 2: faturaOnizleme ile HTML önizleme ────────────
            logger.warn("[AutoInvoice] ZIP indirilemedi, önizleme deneniyor — invoiceId=" + invoiceId);

            const previewResult = await qnbService.previewEArchiveInvoice({
                sessionId,
                vkn,
                uuid: invoice.uuid,
                faturaNo: invoice.invoiceNumber,
                env
            });

            // Logout
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

            if (previewResult.success && previewResult.data) {
                const htmlData = previewResult.data;

                // HTML string ise doğrudan döndür
                if (typeof htmlData === "string") {
                    // Base64 encoded HTML olabilir
                    try {
                        const decoded = Buffer.from(htmlData, "base64").toString("utf-8");
                        if (decoded.includes("<html") || decoded.includes("<HTML") || decoded.includes("<!DOCTYPE")) {
                            res.setHeader("Content-Type", "text/html; charset=utf-8");
                            res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                            return res.send(decoded);
                        }
                    } catch (e) { /* not base64 */ }

                    // Düz HTML
                    if (htmlData.includes("<html") || htmlData.includes("<HTML") || htmlData.includes("<!DOCTYPE")) {
                        res.setHeader("Content-Type", "text/html; charset=utf-8");
                        res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                        return res.send(htmlData);
                    }
                }
            }

            // Her iki strateji de başarısız
            return res.status(404).json({
                success: false,
                message: "PDF/ZIP alınamadı. Fatura QNB portalında mevcut olmayabilir. " +
                    (result.error || "Lütfen QNB test portalını kontrol edin.")
            });

        } catch (downloadErr) {
            // Logout dene
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }
            throw downloadErr;
        }

    } catch (error) {
        logger.error("[AutoInvoice Controller] getInvoicePdf hatası: " + error.message);
        res.status(500).json({ success: false, message: "PDF indirme hatası: " + error.message });
    }
};
