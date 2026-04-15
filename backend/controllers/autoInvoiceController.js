/**
 * Auto Invoice Controller — LysiaETIC
 *
 * Otomatik fatura kesme ayarları CRUD + manuel tetikleme + fatura listesi
 */

const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const { processManualBatchInvoice, processAllUninvoiced, normalizeMarketplaceName, MARKETPLACE_STATUS_MAP } = require("../services/autoInvoiceService");
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
                pricesIncludeVat: true,
                defaultNote: "",
                marketplaceSettings: {},
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
            defaultVatRate, pricesIncludeVat, defaultNote,
            marketplaceSettings
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
        if (pricesIncludeVat !== undefined) config.pricesIncludeVat = pricesIncludeVat;
        if (defaultNote !== undefined) config.defaultNote = defaultNote;
        if (marketplaceSettings && typeof marketplaceSettings === "object") {
            if (!config.marketplaceSettings) config.marketplaceSettings = new Map();
            Object.entries(marketplaceSettings).forEach(([mp, settings]) => {
                const normalized = normalizeMarketplaceName(mp);
                config.marketplaceSettings.set(normalized, settings);
            });
        }

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
 * Tek fatura detayı — zengin bilgi döndürür
 * invoiceId: MongoDB _id VEYA UUID (ETTN) olabilir
 */
exports.getInvoiceDetail = async (req, res) => {
    try {
        const userId = req.user._id;
        const { invoiceId } = req.params;

        // Önce _id ile ara, bulamazsa UUID ile ara
        let invoice = null;
        if (invoiceId.match(/^[0-9a-fA-F]{24}$/)) {
            invoice = await Invoice.findOne({ _id: invoiceId, userId }).lean();
        }
        if (!invoice) {
            invoice = await Invoice.findOne({ uuid: invoiceId, userId }).lean();
        }
        if (!invoice) {
            invoice = await Invoice.findOne({ invoiceNumber: invoiceId, userId }).lean();
        }
        if (!invoice) {
            return res.status(404).json({ success: false, message: "Fatura bulunamadı." });
        }

        // İlişkili siparişi de getir
        let order = null;
        if (invoice.orderId) {
            order = await Order.findById(invoice.orderId)
                .select("orderNumber marketplaceName status totalPrice shippingAddress customerFirstName customerLastName customerEmail isCancelled isReturned createdAt")
                .lean();
        }

        // Fatura görüntüleme URL'si yoksa oluştur
        let viewUrl = invoice.faturaURL || "";
        if (!viewUrl && invoice.uuid && invoice.supplier?.vkn) {
            const env = invoice.env || "test";
            const envPrefix = env === "production" ? "earsiv" : "earsivtest";
            viewUrl = "https://" + envPrefix + ".qnbesolutions.com.tr/earsiv/goruntule.jsp?vkn=" + invoice.supplier.vkn + "&uuid=" + invoice.uuid;
        }

        // Zengin detay objesi
        const detail = {
            // Temel bilgiler
            _id: invoice._id,
            invoiceNumber: invoice.invoiceNumber || "",
            uuid: invoice.uuid || "",
            profileId: invoice.profileId || "EARSIVFATURA",
            invoiceTypeCode: invoice.invoiceTypeCode || "SATIS",
            issueDate: invoice.issueDate || invoice.createdAt,
            currency: invoice.currency || "TRY",
            status: invoice.status || "created",
            createdBy: invoice.createdBy || "manual",
            provider: invoice.provider || "qnb",
            env: invoice.env || "test",
            note: invoice.note || "",

            // Satıcı
            supplier: {
                vkn: invoice.supplier?.vkn || "",
                name: invoice.supplier?.name || "",
                taxOffice: invoice.supplier?.taxOffice || "",
            },

            // Alıcı
            customer: {
                vkn: invoice.customer?.vkn || "",
                name: invoice.customer?.name || "",
                taxOffice: invoice.customer?.taxOffice || "",
            },

            // Tutarlar
            totals: {
                lineExtensionAmount: invoice.totals?.lineExtensionAmount || 0,
                totalTax: invoice.totals?.totalTax || 0,
                taxInclusiveAmount: invoice.totals?.taxInclusiveAmount || 0,
                payableAmount: invoice.totals?.payableAmount || 0,
                totalDiscount: invoice.totals?.totalDiscount || 0,
            },

            // Kalemler
            lines: (invoice.lines || []).map((line, idx) => ({
                index: idx + 1,
                name: line.name || "",
                quantity: line.quantity || 1,
                unit: line.unit || "adet",
                unitPrice: line.unitPrice || 0,
                vatRate: line.vatRate || 0,
                discountAmount: line.discountAmount || 0,
                lineTotal: line.lineTotal || 0,
                vatAmount: line.vatAmount || 0,
            })),

            // Sipariş bilgisi
            orderNumber: invoice.orderNumber || "",
            marketplaceName: invoice.marketplaceName || "",

            // QNB yanıt bilgileri
            providerResponse: {
                resultCode: invoice.providerResponse?.resultCode || "",
                resultText: invoice.providerResponse?.resultText || "",
                islemId: invoice.providerResponse?.islemId || "",
                belgeOid: invoice.providerResponse?.belgeOid || "",
                signedDocument: invoice.providerResponse?.signedDocument || false,
            },

            // URL & hata
            faturaURL: viewUrl,
            qnbInvoiceNumber: invoice.qnbInvoiceNumber || "",
            errorMessage: invoice.errorMessage || "",

            // Zaman damgaları
            createdAt: invoice.createdAt,
            updatedAt: invoice.updatedAt,
        };

        res.json({ success: true, data: { invoice: detail, order: order || null } });
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

        // Faturasız sipariş sayısı (sadece son 30 gün — eski tarihsel siparişler hariç)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const uninvoicedOrders = await Order.countDocuments({
            user: userId,
            invoiceId: { $exists: false },
            invoiceStatus: { $nin: ["created", "pending"] },
            isCancelled: false,
            isReturned: false,
            totalPrice: { $gt: 0 },
            createdAt: { $gte: thirtyDaysAgo },
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
//  QNB'DEN FATURA LİSTESİ ÇEK (DB yerine doğrudan QNB'den)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/auto-invoice/qnb-invoices
 * Kesilen faturaları DB'den çeker (Invoice modeli).
 * QNB test ortamında faturaListeSorgula raporlama gecikmesi nedeniyle 0 dönebilir,
 * bu yüzden kendi DB'mizdeki kayıtları kullanıyoruz — her kesilen fatura zaten kaydediliyor.
 *
 * Query: ?search=...&page=1&limit=50&startDate=2026-01-01&endDate=2026-04-08
 * Arama: fatura numarası, müşteri adı, sipariş numarası
 */
exports.getQnbInvoices = async (req, res) => {
    try {
        const userId = req.user._id;

        // ── Filtre oluştur ──────────────────────────────────────────────
        const filter = { userId };

        // Tarih filtresi
        if (req.query.startDate || req.query.endDate) {
            filter.issueDate = {};
            if (req.query.startDate) {
                filter.issueDate.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                const end = new Date(req.query.endDate);
                end.setHours(23, 59, 59, 999);
                filter.issueDate.$lte = end;
            }
        }

        // Metin araması
        const search = (req.query.search || "").trim();
        if (search) {
            filter.$or = [
                { invoiceNumber: { $regex: search, $options: "i" } },
                { "customer.name": { $regex: search, $options: "i" } },
                { "customer.vkn": { $regex: search, $options: "i" } },
                { orderNumber: { $regex: search, $options: "i" } },
                { uuid: { $regex: search, $options: "i" } },
            ];
        }

        // Profil filtresi (opsiyonel)
        if (req.query.profileId) {
            filter.profileId = req.query.profileId;
        }

        // ── Sayfalama ───────────────────────────────────────────────────
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        // ── DB'den çek ──────────────────────────────────────────────────
        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Invoice.countDocuments(filter)
        ]);

        // ── Normalize et (frontend uyumlu format) ───────────────────────
        const data = invoices.map(inv => ({
            id: inv.uuid || inv._id.toString(),
            faturaNo: inv.invoiceNumber || "",
            uuid: inv.uuid || "",
            aliciAdi: inv.customer ? inv.customer.name : "",
            aliciVkn: inv.customer ? inv.customer.vkn : "",
            tarih: inv.issueDate || inv.createdAt,
            tutar: inv.totals ? inv.totals.payableAmount : 0,
            kdvHaric: inv.totals ? inv.totals.lineExtensionAmount : 0,
            kdv: inv.totals ? inv.totals.totalTax : 0,
            durum: inv.status || "created",
            profileId: inv.profileId || "EARSIVFATURA",
            marketplaceName: inv.marketplaceName || "",
            orderNumber: inv.orderNumber || "",
            faturaURL: inv.faturaURL || "",
            createdBy: inv.createdBy || "manual",
            provider: inv.provider || "qnb",
            currency: inv.currency || "TRY",
            _id: inv._id,
        }));

        logger.info("[AutoInvoice] DB'den " + total + " fatura bulundu, sayfa " + page + "/" + Math.ceil(total / limit));

        res.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });

    } catch (error) {
        logger.error("[AutoInvoice Controller] getQnbInvoices hatası: " + error.message);
        res.status(500).json({ success: false, message: "Fatura listesi alınamadı" });
    }
};

/**
 * GET /api/auto-invoice/qnb-invoices/:uuid/preview
 * Tek faturanın HTML önizlemesini QNB'den çeker
 */
exports.getQnbInvoicePreview = async (req, res) => {
    try {
        const userId = req.user._id;
        const { uuid } = req.params;

        if (!uuid) {
            return res.status(400).json({ success: false, message: "Fatura UUID gerekli." });
        }

        const config = await AutoInvoiceConfig.findOne({ userId }).lean();
        const configCreds = config?.qnbCredentials || {};
        const env = configCreds.env || "test";

        // ⚠️ e-Arşiv credentials — eski "username" alanı e-Fatura'ya ait, e-Arşiv için KULLANMA!
        const earsivUsername = configCreds.earsivUsername || process.env.QNB_EARSIV_USERNAME || "";
        const earsivPassword = configCreds.earsivPassword || process.env.QNB_EARSIV_PASSWORD || "";
        const vkn = config?.supplier?.vkn || earsivUsername.split(".")[0] || "";

        if (!earsivUsername || !earsivPassword) {
            return res.status(400).json({ success: false, message: "e-Arşiv bağlantı bilgileri eksik." });
        }

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

        try {
            // faturaOnizleme ile HTML çek
            const previewResult = await qnbService.previewEArchiveInvoice({
                sessionId,
                vkn,
                uuid,
                env
            });

            // Logout
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

            if (previewResult.success && previewResult.data) {
                const htmlData = previewResult.data;
                if (typeof htmlData === "string" &&
                    (htmlData.includes("<html") || htmlData.includes("<HTML") || htmlData.includes("<!DOCTYPE"))) {
                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.setHeader("Content-Disposition", "inline; filename=\"fatura-" + uuid.substring(0, 8) + ".html\"");
                    return res.send(htmlData);
                }
            }

            return res.status(404).json({ success: false, message: "Fatura önizlemesi alınamadı." });

        } catch (err) {
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }
            throw err;
        }

    } catch (error) {
        logger.error("[AutoInvoice Controller] getQnbInvoicePreview hatası: " + error.message);
        res.status(500).json({ success: false, message: "Fatura önizleme hatası" });
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
 * ✅ FIX: Boş sayfa sorunu çözüldü — faturaOnizleme (HTML preview) kullanılıyor
 *
 * Credential öncelik sırası:
 *   1. Kullanıcının AutoInvoiceConfig'deki qnbCredentials
 *   2. .env'deki QNB_EARSIV_USERNAME / QNB_EARSIV_PASSWORD
 *   3. TEST_ACCOUNTS (son çare)
 *
 * İndirme stratejisi:
 *   1. faturaOnizleme (HTML preview) — EN GÜVENİLİR
 *   2. faturaURL (QNB'nin döndürdüğü direkt link)
 *   3. faturaZipiAl (ZIP içinde PDF + XML)
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

        // ⚠️ e-Arşiv credentials — eski "username" alanı e-Fatura'ya ait, e-Arşiv için KULLANMA!
        const earsivUsername = configCreds.earsivUsername || process.env.QNB_EARSIV_USERNAME || "";
        const earsivPassword = configCreds.earsivPassword || process.env.QNB_EARSIV_PASSWORD || "";

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
            // ── Strateji 1: faturaOnizleme (HTML Preview) — EN GÜVENİLİR ──
            // QNB'nin faturaOnizleme metodu mevcut faturayı HTML olarak döndürür
            logger.info("[AutoInvoice] faturaOnizleme deneniyor — uuid=" + invoice.uuid);
            const previewResult = await qnbService.previewEArchiveInvoice({
                sessionId,
                vkn,
                uuid: invoice.uuid,
                faturaNo: invoice.invoiceNumber,
                env
            });

            if (previewResult.success && previewResult.data) {
                const htmlData = previewResult.data;

                // HTML string ise doğrudan döndür
                if (typeof htmlData === "string" &&
                    (htmlData.includes("<html") || htmlData.includes("<HTML") || htmlData.includes("<!DOCTYPE"))) {

                    // Logout
                    try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                    res.setHeader("Content-Type", "text/html; charset=utf-8");
                    res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                    logger.info("[AutoInvoice] ✅ HTML preview başarıyla döndürüldü");
                    return res.send(htmlData);
                }
            }

            // ── Strateji 2: faturaURL ile doğrudan HTML çek ──
            const faturaURL = invoice.faturaURL || "";
            if (faturaURL) {
                try {
                    logger.info("[AutoInvoice] faturaURL ile HTML çekiliyor — " + faturaURL);
                    const axios = require("axios");
                    const htmlResp = await axios.get(faturaURL, { timeout: 15000, maxRedirects: 5 });

                    if (htmlResp.status === 200 && typeof htmlResp.data === "string" &&
                        (htmlResp.data.includes("<html") || htmlResp.data.includes("<HTML") || htmlResp.data.includes("<!DOCTYPE"))) {

                        // Logout
                        try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                        res.setHeader("Content-Type", "text/html; charset=utf-8");
                        res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                        logger.info("[AutoInvoice] ✅ faturaURL başarıyla döndürüldü");
                        return res.send(htmlResp.data);
                    }
                } catch (urlErr) {
                    logger.warn("[AutoInvoice] faturaURL erişim hatası: " + (urlErr.response?.status || urlErr.message));
                }
            }

            // ── Strateji 3: faturaZipiAl ile ZIP indir ──────────────────
            logger.info("[AutoInvoice] faturaZipiAl deneniyor — uuid=" + invoice.uuid);
            const zipResult = await qnbService.downloadEArchiveZip({
                sessionId,
                uuid: invoice.uuid,
                env
            });

            if (zipResult.success && zipResult.data) {
                const zipData = zipResult.data;

                // Doğrudan base64 string ise
                if (typeof zipData === "string") {
                    const buffer = Buffer.from(zipData, "base64");

                    // Logout
                    try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                    res.setHeader("Content-Type", "application/zip");
                    res.setHeader("Content-Disposition", "attachment; filename=\"" + (invoice.invoiceNumber || "fatura") + ".zip\"");
                    logger.info("[AutoInvoice] ✅ ZIP başarıyla döndürüldü");
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
                    logger.info("[AutoInvoice] ✅ ZIP başarıyla döndürüldü");
                    return res.send(buffer);
                }
            }

            // ── Strateji 4: faturaURL'yi UUID'den oluştur (fallback) ────
            if (!faturaURL && invoice.uuid && vkn) {
                const envPrefix = env === "production" ? "earsiv" : "earsivtest";
                const generatedURL = "https://" + envPrefix + ".qnbesolutions.com.tr/earsiv/goruntule.jsp?vkn=" + vkn + "&uuid=" + invoice.uuid;
                try {
                    logger.info("[AutoInvoice] Oluşturulan faturaURL deneniyor — " + generatedURL);
                    const axios = require("axios");
                    const htmlResp = await axios.get(generatedURL, { timeout: 15000, maxRedirects: 5 });

                    if (htmlResp.status === 200 && typeof htmlResp.data === "string" &&
                        (htmlResp.data.includes("<html") || htmlResp.data.includes("<HTML") || htmlResp.data.includes("<!DOCTYPE"))) {

                        // Logout
                        try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

                        // faturaURL'yi kaydet (gelecek sefere hızlı erişim)
                        await Invoice.updateOne({ _id: invoiceId }, { faturaURL: generatedURL }).catch(() => {});

                        res.setHeader("Content-Type", "text/html; charset=utf-8");
                        res.setHeader("Content-Disposition", "inline; filename=\"" + (invoice.invoiceNumber || "fatura") + ".html\"");
                        logger.info("[AutoInvoice] ✅ Oluşturulan URL başarıyla döndürüldü");
                        return res.send(htmlResp.data);
                    }
                } catch (urlErr) {
                    logger.warn("[AutoInvoice] Oluşturulan faturaURL erişim hatası: " + (urlErr.response?.status || urlErr.message));
                }
            }

            // Logout
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }

            // Tüm stratejiler başarısız
            logger.error("[AutoInvoice] ❌ Tüm indirme stratejileri başarısız oldu");
            return res.status(404).json({
                success: false,
                message: "Fatura görüntülenemedi. Lütfen QNB portalını kontrol edin."
            });

        } catch (downloadErr) {
            // Logout dene
            try { await qnbService.logout({ sessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }
            throw downloadErr;
        }

    } catch (error) {
        logger.error("[AutoInvoice Controller] getInvoicePdf hatası: " + error.message);
        res.status(500).json({ success: false, message: "PDF indirme hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  PAZARYERI BAZLI İŞLEMLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auto-invoice/toggle-marketplace
 * Belirli bir pazaryerini otomatik fatura için aç/kapat
 * Body: { marketplace: "Trendyol" }
 */
exports.toggleMarketplace = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplace } = req.body;

        if (!marketplace) {
            return res.status(400).json({ success: false, message: "Pazaryeri adı gerekli." });
        }

        const normalized = normalizeMarketplaceName(marketplace);
        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            config = new AutoInvoiceConfig({ userId, enabledMarketplaces: [] });
        }

        const enabledList = config.enabledMarketplaces || [];
        const normalizedList = enabledList.map(m => normalizeMarketplaceName(m));
        const idx = normalizedList.indexOf(normalized);

        if (idx >= 0) {
            // Zaten aktif → kaldır
            enabledList.splice(idx, 1);
        } else {
            // Aktif değil → ekle
            enabledList.push(normalized);
        }

        config.enabledMarketplaces = enabledList;
        await config.save();

        const isEnabled = enabledList.map(m => normalizeMarketplaceName(m)).includes(normalized);

        logger.info("[AutoInvoice] Marketplace toggle — " + normalized + " " + (isEnabled ? "aktif" : "devre dışı") + " — userId=" + userId);
        res.json({
            success: true,
            marketplace: normalized,
            enabled: isEnabled,
            enabledMarketplaces: config.enabledMarketplaces,
            message: normalized + " otomatik fatura " + (isEnabled ? "aktif edildi." : "devre dışı bırakıldı.")
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] toggleMarketplace hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * PUT /api/auto-invoice/marketplace-settings
 * Belirli bir pazaryeri için özel ayarları kaydet
 * Body: { marketplace: "Trendyol", vatRate: 20, note: "...", pricesIncludeVat: true, invoiceSeriesCode: "TY" }
 */
exports.saveMarketplaceSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplace, vatRate, note, pricesIncludeVat, invoiceSeriesCode } = req.body;

        if (!marketplace) {
            return res.status(400).json({ success: false, message: "Pazaryeri adı gerekli." });
        }

        const normalized = normalizeMarketplaceName(marketplace);
        let config = await AutoInvoiceConfig.findOne({ userId });

        if (!config) {
            config = new AutoInvoiceConfig({ userId });
        }

        if (!config.marketplaceSettings) {
            config.marketplaceSettings = new Map();
        }

        const settings = {};
        if (vatRate !== undefined) settings.vatRate = Number(vatRate);
        if (note !== undefined) settings.note = note;
        if (pricesIncludeVat !== undefined) settings.pricesIncludeVat = pricesIncludeVat;
        if (invoiceSeriesCode !== undefined) settings.invoiceSeriesCode = invoiceSeriesCode;

        config.marketplaceSettings.set(normalized, settings);
        await config.save();

        logger.info("[AutoInvoice] Marketplace settings güncellendi — " + normalized + " — userId=" + userId);
        res.json({
            success: true,
            marketplace: normalized,
            settings: settings,
            message: normalized + " fatura ayarları kaydedildi."
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] saveMarketplaceSettings hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

/**
 * GET /api/auto-invoice/marketplace-stats
 * Pazaryeri bazlı fatura istatistikleri
 * Her pazaryeri için: toplam sipariş, faturalı, faturasız, hata sayısı
 */
exports.getMarketplaceStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Son 30 günlük siparişler
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Pazaryeri bazlı sipariş istatistikleri
        const [orderStats, invoiceStats, config] = await Promise.all([
            Order.aggregate([
                {
                    $match: {
                        user: userId,
                        createdAt: { $gte: thirtyDaysAgo },
                        isCancelled: false,
                        isReturned: false,
                    }
                },
                {
                    $group: {
                        _id: "$marketplaceName",
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: "$totalPrice" },
                        invoicedCount: {
                            $sum: { $cond: [{ $ifNull: ["$invoiceId", false] }, 1, 0] }
                        },
                        uninvoicedCount: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: [{ $ifNull: ["$invoiceId", null] }, null] },
                                            { $ne: ["$invoiceStatus", "created"] },
                                            { $gt: ["$totalPrice", 0] }
                                        ]
                                    },
                                    1, 0
                                ]
                            }
                        },
                        errorCount: {
                            $sum: { $cond: [{ $eq: ["$invoiceStatus", "error"] }, 1, 0] }
                        },
                        pendingCount: {
                            $sum: { $cond: [{ $eq: ["$invoiceStatus", "pending"] }, 1, 0] }
                        },
                    }
                },
                { $sort: { totalOrders: -1 } }
            ]),
            Invoice.aggregate([
                {
                    $match: {
                        userId: userId,
                        createdAt: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: "$marketplaceName",
                        totalInvoices: { $sum: 1 },
                        totalAmount: { $sum: "$totals.payableAmount" },
                        totalTax: { $sum: "$totals.totalTax" },
                    }
                }
            ]),
            AutoInvoiceConfig.findOne({ userId }).lean()
        ]);

        // İstatistikleri birleştir
        const enabledMps = (config?.enabledMarketplaces || []).map(m => normalizeMarketplaceName(m));
        const mpSettingsMap = config?.marketplaceSettings || {};

        const invoiceMap = {};
        invoiceStats.forEach(s => {
            invoiceMap[s._id || "Diğer"] = s;
        });

        const marketplaces = orderStats.map(os => {
            const mpName = os._id || "Diğer";
            const normalized = normalizeMarketplaceName(mpName);
            const invStat = invoiceMap[mpName] || {};
            const isEnabled = enabledMps.length === 0 || enabledMps.includes(normalized);
            const mpSettings = mpSettingsMap instanceof Map
                ? mpSettingsMap.get(normalized)
                : (mpSettingsMap[normalized] || null);

            return {
                marketplace: normalized,
                enabled: isEnabled,
                totalOrders: os.totalOrders,
                totalRevenue: os.totalRevenue,
                invoicedCount: os.invoicedCount,
                uninvoicedCount: os.uninvoicedCount,
                errorCount: os.errorCount,
                pendingCount: os.pendingCount,
                totalInvoices: invStat.totalInvoices || 0,
                totalInvoiceAmount: invStat.totalAmount || 0,
                totalTax: invStat.totalTax || 0,
                invoiceRate: os.totalOrders > 0
                    ? Math.round((os.invoicedCount / os.totalOrders) * 100)
                    : 0,
                settings: mpSettings || null,
                supportedStatuses: MARKETPLACE_STATUS_MAP[normalized] || [],
            };
        });

        // Desteklenen tüm pazaryerlerini listele (sipariş olmasa bile)
        const ALL_MARKETPLACES = [
            "Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti",
            "Amazon", "Amazon Türkiye", "Amazon Europe", "Amazon USA",
        ];
        const existingMps = marketplaces.map(m => m.marketplace);
        ALL_MARKETPLACES.forEach(mp => {
            if (!existingMps.includes(mp)) {
                const isEnabled = enabledMps.length === 0 || enabledMps.includes(mp);
                marketplaces.push({
                    marketplace: mp,
                    enabled: isEnabled,
                    totalOrders: 0,
                    totalRevenue: 0,
                    invoicedCount: 0,
                    uninvoicedCount: 0,
                    errorCount: 0,
                    pendingCount: 0,
                    totalInvoices: 0,
                    totalInvoiceAmount: 0,
                    totalTax: 0,
                    invoiceRate: 0,
                    settings: null,
                    supportedStatuses: MARKETPLACE_STATUS_MAP[mp] || [],
                });
            }
        });

        res.json({
            success: true,
            data: {
                marketplaces,
                config: config ? {
                    enabled: config.enabled,
                    provider: config.provider,
                    enabledMarketplaces: config.enabledMarketplaces || [],
                    stats: config.stats,
                } : null,
            }
        });
    } catch (error) {
        logger.error("[AutoInvoice Controller] getMarketplaceStats hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};
