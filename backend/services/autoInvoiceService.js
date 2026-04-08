/**
 * Auto Invoice Service — LysiaETIC
 *
 * Pazaryerinden sipariş sync edildiğinde otomatik fatura keser.
 *
 * ─── e-Fatura vs e-Arşiv Karar Mekanizması ──────────────────────────────
 *   Türk mevzuatına göre:
 *   • Alıcı e-Fatura mükellefi ise → e-Fatura (connectorService.belgeGonderExt)
 *   • Alıcı e-Fatura mükellefi değilse → e-Arşiv (EarsivWebService.faturaOlusturExt)
 *
 *   Pazaryeri siparişlerinde alıcı genelde bireysel tüketicidir (VKN/TCKN yok).
 *   Bu durumda otomatik olarak e-Arşiv kesilir (Nihai Tüketici, TCKN: 11111111111).
 *   Eğer alıcının VKN'si varsa (B2B sipariş), e-Fatura mükellefi sorgulanır.
 *
 * ─── Akış ────────────────────────────────────────────────────────────────
 *   1. syncOrdersBackground → sipariş DB'ye kaydedilir
 *   2. processAutoInvoice çağrılır (arka planda, async)
 *   3. AutoInvoiceConfig kontrol edilir (enabled? marketplace aktif mi?)
 *   4. Sipariş durumu triggerStatuses'a uyuyor mu?
 *   5. Daha önce fatura kesilmiş mi? (Order.invoiceId kontrolü)
 *   6. Alıcı VKN kontrolü → e-Fatura mükellefi mi? → e-Fatura / e-Arşiv karar
 *   7. QNB Login → Fatura No Üret → UBL XML → QNB'ye Gönder
 *   8. Invoice kaydı oluştur → Order'a bağla
 *   9. QNB Logout
 *
 * Hata yönetimi:
 *   - Her sipariş bağımsız try/catch ile sarılır
 *   - Ardışık hata sayısı takip edilir (consecutiveErrors)
 *   - 5 ardışık hatada otomatik fatura devre dışı bırakılır
 */

const logger = require("../config/logger");
const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const qnbService = require("./qnbEInvoiceService");

// Ardışık hata limiti — bu kadar hatadan sonra otomatik fatura devre dışı kalır
const MAX_CONSECUTIVE_ERRORS = 5;

// ═══════════════════════════════════════════════════════════════════════════════
//  PAZARYERI BAZLI DURUM HARİTALARI
//  Her pazaryerinin sipariş durumu farklı terminoloji kullanır.
//  Bu harita, hangi durumların fatura kesilebilir olduğunu belirler.
// ═══════════════════════════════════════════════════════════════════════════════

const MARKETPLACE_STATUS_MAP = {
    // Trendyol: İngilizce durum kodları
    Trendyol: [
        "Created", "Picking", "Invoiced", "Shipped", "Delivered",
        "UnDelivered", "Returned", "Repack", "UnSupplied",
        // Fatura kesilecek durumlar (varsayılan)
    ],
    // Hepsiburada: İngilizce büyük harf durum kodları
    Hepsiburada: [
        "Open", "New", "Approved", "OPEN", "NEW", "APPROVED",
        "Shipped", "SHIPPED", "Delivered", "DELIVERED",
        "Processing", "PROCESSING", "InTransit", "IN_TRANSIT",
        "Packed", "PACKED", "ReadyToShip", "READY_TO_SHIP",
    ],
    // N11: İngilizce durum kodları (REST API v1)
    N11: [
        "New", "Approved", "Rejected", "Shipped", "Delivered",
        "Completed", "COMPLETED", "APPROVED", "SHIPPED", "DELIVERED",
        "CancelRequested", "CancelApproved",
    ],
    // ÇiçekSepeti: Türkçe durum kodları
    "ÇiçekSepeti": [
        "Yeni", "Hazırlanıyor", "Onaylandı", "Kargoda", "Kargoya Verildi",
        "Teslim Edildi", "Teslim", "Sipariş Alındı", "Hazırlandı",
        "Gönderildi", "Tamamlandı",
    ],
    // Amazon: İngilizce durum kodları (SP-API)
    Amazon: [
        "Pending", "Unshipped", "PartiallyShipped", "Shipped",
        "InTransit", "Delivered", "Complete",
    ],
    "Amazon Türkiye": [
        "Pending", "Unshipped", "PartiallyShipped", "Shipped",
        "InTransit", "Delivered", "Complete",
    ],
    "Amazon Europe": [
        "Pending", "Unshipped", "PartiallyShipped", "Shipped",
        "InTransit", "Delivered", "Complete",
    ],
    "Amazon USA": [
        "Pending", "Unshipped", "PartiallyShipped", "Shipped",
        "InTransit", "Delivered", "Complete",
    ],
    // eBay
    eBay: [
        "Active", "Completed", "Shipped", "Delivered", "Paid",
    ],
    // Diğer platformlar
    Morhipo: ["New", "Approved", "Shipped", "Delivered", "Processing"],
    PttAVM: ["New", "Approved", "Shipped", "Delivered", "Processing"],
    Teknosa: ["New", "Approved", "Shipped", "Delivered", "Processing"],
    ePttAVM: ["New", "Approved", "Shipped", "Delivered", "Processing"],
};

/**
 * Pazaryeri adını normalize et (case-insensitive eşleştirme)
 * "çiçeksepeti" → "ÇiçekSepeti", "amazon türkiye" → "Amazon Türkiye" vb.
 */
const normalizeMarketplaceName = (name) => {
    if (!name) return "Diğer";
    const lower = name.toLowerCase().trim();
    const MAP = {
        "trendyol": "Trendyol",
        "hepsiburada": "Hepsiburada",
        "n11": "N11",
        "çiçeksepeti": "ÇiçekSepeti",
        "ciceksepeti": "ÇiçekSepeti",
        "amazon": "Amazon",
        "amazon türkiye": "Amazon Türkiye",
        "amazon turkey": "Amazon Türkiye",
        "amazon europe": "Amazon Europe",
        "amazon usa": "Amazon USA",
        "ebay": "eBay",
        "morhipo": "Morhipo",
        "pttavm": "PttAVM",
        "teknosa": "Teknosa",
        "epttavm": "ePttAVM",
    };
    return MAP[lower] || name;
};

/**
 * Verilen pazaryeri ve config için geçerli tetikleme durumlarını döndür
 * Öncelik: config.triggerStatuses > MARKETPLACE_STATUS_MAP > geniş varsayılan
 */
const getEffectiveTriggerStatuses = (config, marketplaceName) => {
    // Kullanıcı özel durum listesi tanımladıysa onu kullan
    if (config.triggerStatuses && config.triggerStatuses.length > 0) {
        return config.triggerStatuses;
    }

    const normalized = normalizeMarketplaceName(marketplaceName);

    // Pazaryerine özel durum haritası
    if (MARKETPLACE_STATUS_MAP[normalized]) {
        return MARKETPLACE_STATUS_MAP[normalized];
    }

    // Geniş varsayılan — tüm bilinen durumları kapsar
    return [
        "Created", "New", "Yeni", "Approved", "Onaylandı",
        "Processing", "İşlemde", "Picking", "Hazırlanıyor",
        "Shipped", "Kargoda", "Kargoya Verildi", "InTransit",
        "Delivered", "Teslim Edildi", "Teslim", "Complete", "Completed",
        "Tamamlandı", "Packed", "ReadyToShip", "Unshipped",
        "PartiallyShipped", "Open", "OPEN", "Paid",
        "Invoiced", "Gönderildi", "Hazırlandı", "Sipariş Alındı",
    ];
};

/**
 * Pazaryerine özel ayarları al (KDV oranı, not, seri kodu vb.)
 * marketplaceSettings Map'inden alır, yoksa genel config'e düşer
 */
const getMarketplaceSpecificSettings = (config, marketplaceName) => {
    const normalized = normalizeMarketplaceName(marketplaceName);
    const mpSettings = config.marketplaceSettings instanceof Map
        ? config.marketplaceSettings.get(normalized)
        : (config.marketplaceSettings && config.marketplaceSettings[normalized]);

    return {
        vatRate: mpSettings?.vatRate ?? config.defaultVatRate ?? 20,
        note: mpSettings?.note || config.defaultNote || "",
        pricesIncludeVat: mpSettings?.pricesIncludeVat ?? (config.pricesIncludeVat !== false),
        invoiceSeriesCode: mpSettings?.invoiceSeriesCode || config.invoiceSeriesCode || "LYS",
    };
};

/**
 * Sipariş listesi için otomatik fatura kesme işlemini başlat
 *
 * @param {string} userId - Kullanıcı ID
 * @param {string} marketplaceName - Pazaryeri adı (Trendyol, Hepsiburada...)
 * @param {Array} newOrderIds - Yeni kaydedilen sipariş MongoDB _id'leri
 * @returns {Object} { processed, invoiced, skipped, errors }
 */
const processAutoInvoice = async (userId, marketplaceName, newOrderIds) => {
    const stats = { processed: 0, invoiced: 0, skipped: 0, errors: 0 };

    if (!newOrderIds || newOrderIds.length === 0) {
        return stats;
    }

    try {
        // ── 1. Config kontrol ─────────────────────────────────────────────
        const config = await AutoInvoiceConfig.findOne({ userId });
        if (!config || !config.enabled) {
            logger.info("[AutoInvoice] Devre dışı — userId=" + userId);
            return stats;
        }

        // Ardışık hata limiti aşıldıysa otomatik devre dışı
        if (config.stats.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            logger.warn("[AutoInvoice] Ardışık hata limiti aşıldı (" + MAX_CONSECUTIVE_ERRORS + "), devre dışı — userId=" + userId);
            config.enabled = false;
            config.stats.lastError = "Ardışık hata limiti aşıldı, otomatik fatura devre dışı bırakıldı.";
            config.stats.lastErrorDate = new Date();
            await config.save();
            return stats;
        }

        // Pazaryeri aktif mi? (normalize ederek karşılaştır)
        const normalizedMp = normalizeMarketplaceName(marketplaceName);
        if (config.enabledMarketplaces.length > 0) {
            const enabledNormalized = config.enabledMarketplaces.map(m => normalizeMarketplaceName(m));
            if (!enabledNormalized.includes(normalizedMp)) {
                logger.info("[AutoInvoice] " + normalizedMp + " bu kullanıcı için aktif değil — userId=" + userId);
                return stats;
            }
        }

        // Satıcı bilgisi zorunlu
        if (!config.supplier || !config.supplier.vkn) {
            logger.warn("[AutoInvoice] Satıcı VKN bilgisi eksik — userId=" + userId);
            return stats;
        }

        // ── 2. Siparişleri getir ─────────────────────────────────────────
        const orders = await Order.find({
            _id: { $in: newOrderIds },
            invoiceId: { $exists: false },
            invoiceStatus: { $ne: "created" },
            isCancelled: false,
            isReturned: false,
            totalPrice: { $gt: 0 }, // ✅ FIX: 0 TL siparişleri atla (KDV validasyon hatası önlenir)
        }).lean();

        if (orders.length === 0) {
            logger.info("[AutoInvoice] Fatura kesilecek sipariş yok — userId=" + userId);
            return stats;
        }

        // Durum filtresi — pazaryerine özel durum haritası kullanılır
        const triggerStatuses = getEffectiveTriggerStatuses(config, normalizedMp);

        const eligibleOrders = orders.filter(order => {
            const status = (order.status || "").toLowerCase();
            return triggerStatuses.some(ts => status.includes(ts.toLowerCase()));
        });

        if (eligibleOrders.length === 0) {
            logger.info("[AutoInvoice] Durum filtresi sonrası fatura kesilecek sipariş yok — userId=" + userId);
            stats.skipped = orders.length;
            return stats;
        }

        logger.info("[AutoInvoice] " + eligibleOrders.length + " sipariş için fatura kesilecek — userId=" + userId + " marketplace=" + marketplaceName);

        // ── 3. QNB Login (e-Arşiv + e-Fatura ayrı oturumlar) ────────────
        // ⚠️ QNB'de e-Fatura ve e-Arşiv FARKLI ortamlar — FARKLI credentials!
        //   e-Arşiv:  connectortest   → VKN.portaltest / ayrı şifre
        //   e-Fatura: erpefaturatest1 → VKN / ayrı şifre
        //
        // ⚠️ ÖNEMLİ: Eski config.qnbCredentials.username alanı e-Fatura credential'ıdır!
        //   Bu alan e-Arşiv için KULLANILMAMALI — ayrı ortam, ayrı şifre.
        //   e-Arşiv fallback: earsivUsername > .env QNB_EARSIV_USERNAME
        //   e-Fatura fallback: efaturaUsername > eski username > supplier.vkn > .env QNB_EFATURA_USERNAME
        let earsivSessionId = null;
        let efaturaSessionId = null;
        const env = config.qnbCredentials.env || "test";

        if (config.provider === "qnb") {
            // e-Arşiv credentials — SADECE earsiv-specific alanlardan al, eski username'i KULLANMA!
            const earsivUsername = config.qnbCredentials.earsivUsername || process.env.QNB_EARSIV_USERNAME;
            const earsivPassword = config.qnbCredentials.earsivPassword || process.env.QNB_EARSIV_PASSWORD;

            // e-Fatura credentials — eski username alanı e-Fatura'ya ait
            const efaturaUsername = config.qnbCredentials.efaturaUsername || config.qnbCredentials.username || config.supplier.vkn || process.env.QNB_EFATURA_USERNAME;
            const efaturaPassword = config.qnbCredentials.efaturaPassword || config.qnbCredentials.password || process.env.QNB_EFATURA_PASSWORD;

            if (!earsivUsername || !earsivPassword) {
                logger.error("[AutoInvoice] QNB e-Arşiv credentials eksik — userId=" + userId);
                config.stats.lastError = "QNB e-Arşiv kullanıcı adı veya şifre eksik";
                config.stats.lastErrorDate = new Date();
                await config.save();
                return stats;
            }

            // e-Arşiv login (her zaman gerekli — çoğu pazaryeri müşterisi bireysel)
            const earsivLogin = await qnbService.login({
                username: earsivUsername,
                password: earsivPassword,
                env: env,
                service: "earsiv"
            });

            if (!earsivLogin.success) {
                logger.error("[AutoInvoice] QNB e-Arşiv login başarısız: " + earsivLogin.error);
                config.stats.lastError = "QNB e-Arşiv login başarısız: " + earsivLogin.error;
                config.stats.lastErrorDate = new Date();
                config.stats.consecutiveErrors += 1;
                await config.save();
                return stats;
            }

            earsivSessionId = earsivLogin.sessionId;
            logger.info("[AutoInvoice] QNB e-Arşiv login başarılı — sessionId=" + earsivSessionId.substring(0, 8) + "...");

            // e-Fatura login (opsiyonel — sadece B2B müşteriler için gerekir)
            // e-Fatura FARKLI ortamda çalışır (erpefaturatest — farklı credentials)
            if (efaturaUsername && efaturaPassword) {
                try {
                    const efaturaLogin = await qnbService.login({
                        username: efaturaUsername,
                        password: efaturaPassword,
                        env: env,
                        service: "efatura"
                    });
                    if (efaturaLogin.success) {
                        efaturaSessionId = efaturaLogin.sessionId;
                        logger.info("[AutoInvoice] QNB e-Fatura login başarılı — sessionId=" + efaturaSessionId.substring(0, 8) + "...");
                    } else {
                        logger.warn("[AutoInvoice] QNB e-Fatura login başarısız (e-Arşiv ile devam edilecek): " + efaturaLogin.error);
                    }
                } catch (efErr) {
                    logger.warn("[AutoInvoice] e-Fatura login atlandı: " + efErr.message);
                }
            } else {
                logger.info("[AutoInvoice] e-Fatura credentials yok, sadece e-Arşiv kullanılacak");
            }
        }

        // ── 4. Her sipariş için fatura kes ────────────────────────────────
        for (const order of eligibleOrders) {
            stats.processed++;

            try {
                // ── ÇOKLU KORUMA: Aynı faturayı 2 kere kesmeyelim ──────────
                // 1. Invoice tablosunda orderId kontrolü
                const existingInvoice = await Invoice.findOne({ orderId: order._id });
                if (existingInvoice) {
                    logger.info("[AutoInvoice] ⏭️ Sipariş zaten faturalandı (Invoice var) — orderNumber=" + order.trackingNumber + " faturaNo=" + existingInvoice.invoiceNumber);
                    stats.skipped++;
                    continue;
                }

                // 2. Order'da invoiceId veya invoiceStatus=created kontrolü
                const freshOrder = await Order.findById(order._id).lean();
                if (freshOrder && (freshOrder.invoiceId || freshOrder.invoiceStatus === "created")) {
                    logger.info("[AutoInvoice] ⏭️ Sipariş zaten faturalandı (Order flag) — orderNumber=" + order.trackingNumber);
                    stats.skipped++;
                    continue;
                }

                // 3. Atomik olarak "pending" yap — sadece henüz faturalanmamışsa
                // Bu, race condition'ı önler: iki paralel işlem aynı siparişi alamaz
                const lockResult = await Order.updateOne(
                    { _id: order._id, invoiceStatus: { $nin: ["created", "pending"] }, invoiceId: { $exists: false } },
                    { invoiceStatus: "pending" }
                );
                if (lockResult.modifiedCount === 0) {
                    logger.info("[AutoInvoice] ⏭️ Sipariş başka bir işlem tarafından kilitlendi — orderNumber=" + order.trackingNumber);
                    stats.skipped++;
                    continue;
                }

                // Pazaryerine özel ayarları al
                const mpSpecific = getMarketplaceSpecificSettings(config, normalizedMp);

                // Fatura kalemlerini oluştur (pazaryerine özel KDV oranı)
                const invoiceLines = buildInvoiceLinesFromOrder(order, config, normalizedMp);

                // Müşteri bilgilerini hazırla (pazaryerine özel VKN çıkarma)
                const customer = buildCustomerFromOrder(order, config, normalizedMp);

                // invoiceData oluştur
                const invoiceNote = mpSpecific.note
                    || ("Otomatik fatura — " + normalizedMp + " Sipariş: " + (order.trackingNumber || ""));
                const invoiceData = {
                    faturaKodu: mpSpecific.invoiceSeriesCode,
                    invoiceTypeCode: config.invoiceTypeCode || "SATIS",
                    issueDate: new Date().toISOString().split("T")[0],
                    currency: config.currency || "TRY",
                    note: invoiceNote,
                    sendingType: config.sendingType || "ELEKTRONIK",
                    supplier: {
                        vkn: config.supplier.vkn,
                        name: config.supplier.name,
                        taxOffice: config.supplier.taxOffice || "",
                        street: config.supplier.street || "",
                        district: config.supplier.district || "",
                        city: config.supplier.city || "",
                        country: config.supplier.country || "Turkiye",
                        phone: config.supplier.phone || "",
                        email: config.supplier.email || "",
                        firstName: config.supplier.firstName || "",
                        lastName: config.supplier.lastName || "",
                    },
                    customer: customer,
                    lines: invoiceLines,
                };

                // ── e-Fatura / e-Arşiv Karar Mekanizması ─────────────────
                // Türk mevzuatı: Alıcı e-Fatura mükellefi ise e-Fatura zorunlu
                // Pazaryeri bireysel müşterileri → e-Arşiv (VKN yok veya 11111111111)
                let useEFatura = false;
                let resolvedProfileId = "EARSIVFATURA";

                const customerVkn = customer.vkn || "";
                const isNihaiTuketici = !customerVkn || customerVkn === "11111111111";

                if (!isNihaiTuketici && efaturaSessionId) {
                    // Alıcının VKN'si var — e-Fatura mükellefi mi kontrol et
                    try {
                        const checkResult = await qnbService.checkEInvoiceUser({
                            sessionId: efaturaSessionId,
                            vkn: customerVkn,
                            env
                        });
                        if (checkResult.success && checkResult.isRegistered) {
                            useEFatura = true;
                            resolvedProfileId = config.documentType || "TICARIFATURA";
                            logger.info("[AutoInvoice] Alıcı e-Fatura mükellefi — VKN: " + customerVkn + " → e-Fatura kesilecek");
                        } else {
                            logger.info("[AutoInvoice] Alıcı e-Fatura mükellefi değil — VKN: " + customerVkn + " → e-Arşiv kesilecek");
                        }
                    } catch (checkErr) {
                        logger.warn("[AutoInvoice] e-Fatura mükellef sorgusu başarısız, e-Arşiv ile devam: " + checkErr.message);
                    }
                }

                let result;

                if (useEFatura && efaturaSessionId) {
                    // ── e-Fatura gönder (connectorService.belgeGonder) ────
                    const { buildInvoiceXml } = require("../utils/ublBuilder");

                    // Fatura numarası üret (e-Fatura için connectorService.faturaNoUret)
                    const noResult = await qnbService.generateInvoiceNumber({
                        sessionId: efaturaSessionId,
                        vkn: config.supplier.vkn,
                        faturaKodu: invoiceData.faturaKodu || "LYS",
                        env
                    });
                    const invoiceNumber = (noResult.success && noResult.invoiceNumber) ? noResult.invoiceNumber : "";

                    // UBL XML oluştur — fatura numarasını dahil et
                    const { xml, uuid, totals } = buildInvoiceXml({
                        profileId: resolvedProfileId,
                        invoiceTypeCode: invoiceData.invoiceTypeCode || "SATIS",
                        invoiceNumber: invoiceNumber,
                        issueDate: invoiceData.issueDate,
                        currency: invoiceData.currency || "TRY",
                        note: invoiceData.note || "",
                        sendingType: invoiceData.sendingType || "ELEKTRONIK",
                        supplier: invoiceData.supplier || {},
                        customer: invoiceData.customer || {},
                        lines: invoiceData.lines || [],
                    });

                    // QNB'ye gönder — belgeGonderExt (ERP kodu ile)
                    // ⚠️ QNB resmi dokümantasyon: SOAP Header kullanılamadığı için
                    //    belgeGonderExt metodu kullanılmalı (erpKodu parametresi ile)
                    const sendResult = await qnbService.sendEInvoiceExt({
                        sessionId: efaturaSessionId,
                        invoiceXml: xml,
                        vkn: config.supplier.vkn,
                        belgeTuru: "FATURA_UBL",
                        belgeNo: invoiceNumber,
                        env
                    });

                    result = sendResult.success
                        ? { ...sendResult, uuid, invoiceNumber, totals }
                        : sendResult;

                    logger.info("[AutoInvoice] e-Fatura gönderildi — " + invoiceNumber + " UUID: " + uuid);
                } else {
                    // ── e-Arşiv gönder (EarsivWebService.faturaOlustur) ───
                    resolvedProfileId = "EARSIVFATURA";
                    result = await qnbService.createEArchiveFromForm({
                        sessionId: earsivSessionId,
                        vkn: config.supplier.vkn,
                        invoiceData,
                        env
                    });
                }

                if (result.success) {
                    // Invoice kaydı oluştur
                    const invoice = new Invoice({
                        userId: userId,
                        orderId: order._id,
                        orderNumber: order.trackingNumber || "",
                        marketplaceName: marketplaceName,
                        invoiceNumber: result.invoiceNumber,
                        uuid: result.uuid,
                        profileId: resolvedProfileId,
                        invoiceTypeCode: config.invoiceTypeCode || "SATIS",
                        issueDate: new Date(),
                        currency: config.currency || "TRY",
                        provider: "qnb",
                        env: env,
                        supplier: {
                            vkn: config.supplier.vkn,
                            name: config.supplier.name,
                            taxOffice: config.supplier.taxOffice || "",
                        },
                        customer: {
                            vkn: customer.vkn || "",
                            name: customer.name || "",
                            taxOffice: customer.taxOffice || "",
                        },
                        totals: result.totals || {},
                        lines: invoiceLines.map(l => ({
                            name: l.name,
                            quantity: l.quantity,
                            unit: l.unit || "adet",
                            unitPrice: l.unitPrice,
                            vatRate: l.vatRate,
                            discountAmount: l.discountAmount || 0,
                            lineTotal: (l.quantity * l.unitPrice) - (l.discountAmount || 0),
                            vatAmount: ((l.quantity * l.unitPrice) - (l.discountAmount || 0)) * (l.vatRate / 100),
                        })),
                        status: "created",
                        createdBy: "auto",
                        faturaURL: result.faturaURL || "",
                        providerResponse: {
                            resultCode: result.data ? result.data.resultCode : "",
                            resultText: result.data ? result.data.resultText : "",
                            islemId: result.islemId || "",
                            signedDocument: !!(result.output),
                        },
                        note: invoiceData.note,
                    });

                    await invoice.save();

                    // Order'ı güncelle
                    await Order.updateOne({ _id: order._id }, {
                        invoiceId: invoice._id,
                        invoiceNumber: result.invoiceNumber,
                        invoiceStatus: "created"
                    });

                    stats.invoiced++;
                    config.stats.consecutiveErrors = 0; // Başarılı → hata sayacı sıfırla

                    logger.info("[AutoInvoice] ✅ Fatura kesildi — Sipariş: " + order.trackingNumber +
                        " FaturaNo: " + result.invoiceNumber + " UUID: " + result.uuid);
                } else {
                    // Hata
                    await Order.updateOne({ _id: order._id }, {
                        invoiceStatus: "error"
                    });

                    stats.errors++;
                    config.stats.consecutiveErrors += 1;
                    config.stats.lastError = result.error || "Bilinmeyen hata";
                    config.stats.lastErrorDate = new Date();

                    logger.error("[AutoInvoice] ❌ Fatura hatası — Sipariş: " + order.trackingNumber +
                        " Hata: " + (result.error || "Bilinmeyen"));

                    // ⚠️ Kontör hatası → döngüyü kır (tüm siparişler aynı hatayı alacak)
                    // Gereksiz fatura numarası üretimini ve QNB yükünü önle
                    const errLower = (result.error || "").toLowerCase();
                    if (errLower.includes("kontör") || errLower.includes("kontor") || errLower.includes("kredit") || errLower.includes("credit")) {
                        logger.warn("[AutoInvoice] ⛔ Kontör/kredi hatası tespit edildi — kalan " + (eligibleOrders.length - stats.processed) + " sipariş atlanıyor");
                        stats.skipped += (eligibleOrders.length - stats.processed);
                        break;
                    }
                }

            } catch (orderErr) {
                stats.errors++;
                config.stats.consecutiveErrors += 1;
                config.stats.lastError = orderErr.message;
                config.stats.lastErrorDate = new Date();

                await Order.updateOne({ _id: order._id }, { invoiceStatus: "error" }).catch(() => {});

                logger.error("[AutoInvoice] ❌ Sipariş işleme hatası — " + order.trackingNumber + ": " + orderErr.message);
            }
        }

        // ── 5. İstatistikleri güncelle ────────────────────────────────────
        config.stats.totalInvoicesCreated += stats.invoiced;
        if (stats.invoiced > 0) {
            config.stats.lastInvoiceDate = new Date();
        }
        await config.save();

        // ── 6. QNB Logout (her iki oturum) ─────────────────────────────
        if (earsivSessionId) {
            try {
                await qnbService.logout({ sessionId: earsivSessionId, env, service: "earsiv" });
                logger.info("[AutoInvoice] QNB e-Arşiv logout başarılı");
            } catch (logoutErr) {
                logger.warn("[AutoInvoice] QNB e-Arşiv logout hatası: " + logoutErr.message);
            }
        }
        if (efaturaSessionId) {
            try {
                await qnbService.logout({ sessionId: efaturaSessionId, env, service: "efatura" });
                logger.info("[AutoInvoice] QNB e-Fatura logout başarılı");
            } catch (logoutErr) {
                logger.warn("[AutoInvoice] QNB e-Fatura logout hatası: " + logoutErr.message);
            }
        }

        logger.info("[AutoInvoice] Tamamlandı — " + JSON.stringify(stats));
        return stats;

    } catch (error) {
        logger.error("[AutoInvoice] Genel hata: " + error.message);
        // Config'i güncellemeye çalış
        try {
            await AutoInvoiceConfig.updateOne({ userId }, {
                "stats.lastError": error.message,
                "stats.lastErrorDate": new Date(),
                $inc: { "stats.consecutiveErrors": 1 }
            });
        } catch (e) { /* ignore */ }
        return stats;
    }
};

/**
 * Sipariş kalemlerinden fatura kalemleri oluştur
 * Pazaryeri siparişlerinde ürün bilgisi items[] içinde gelir
 *
 * ── KDV Dahil / Hariç Hesaplama ──────────────────────────────────────
 * Türkiye'deki pazaryerlerinde fiyatlar genelde KDV DAHİLDİR.
 * config.pricesIncludeVat = true ise:
 *   Marketplace fiyatı (229,99 TL) KDV dahildir → ters hesaplama yapılır
 *   KDV hariç = 229,99 / 1.20 = 191,66 TL
 *   KDV      = 229,99 - 191,66 = 38,33 TL
 *   Toplam   = 191,66 + 38,33 = 229,99 TL ✓
 *
 * config.pricesIncludeVat = false ise:
 *   Marketplace fiyatı (229,99 TL) KDV hariçtir → üzerine KDV eklenir
 *   KDV hariç = 229,99 TL
 *   KDV      = 229,99 * 0.20 = 46,00 TL
 *   Toplam   = 229,99 + 46,00 = 275,99 TL
 *
 * ── Pazaryerine Özel Davranışlar ─────────────────────────────────────
 *   Trendyol:     grossAmount KDV dahil, line.amount KDV dahil
 *   Hepsiburada:  totalPrice KDV dahil, item.price KDV dahil
 *   N11:          sellerInvoiceAmount KDV dahil
 *   ÇiçekSepeti:  totalPrice KDV dahil, itemPrice KDV dahil
 *   Amazon:       OrderTotal KDV dahil (TR), KDV hariç (US/EU — ülkeye göre)
 *
 * @param {Object} order - Sipariş belgesi (Order model)
 * @param {Object} config - AutoInvoiceConfig belgesi
 * @param {string} [marketplaceName] - Pazaryeri adı (normalize edilmiş)
 */
const buildInvoiceLinesFromOrder = (order, config, marketplaceName) => {
    const mpSpecific = getMarketplaceSpecificSettings(config, marketplaceName || order.marketplaceName);
    const defaultVatRate = mpSpecific.vatRate;
    const pricesIncludeVat = mpSpecific.pricesIncludeVat;
    const items = order.items || [];

    /**
     * Fiyatı KDV hariç'e çevir (eğer KDV dahilse)
     * Formül: kdvHariç = kdvDahilFiyat / (1 + kdvOranı/100)
     */
    const toExVat = (price, vatRate) => {
        if (!pricesIncludeVat || vatRate === 0) return price;
        return price / (1 + vatRate / 100);
    };

    // ── Pazaryerine özel kalem adı prefix'i ──
    const normalized = normalizeMarketplaceName(marketplaceName || order.marketplaceName);
    const mpPrefix = {
        "Trendyol": "TY",
        "Hepsiburada": "HB",
        "N11": "N11",
        "ÇiçekSepeti": "CS",
        "Amazon": "AMZ",
        "Amazon Türkiye": "AMZ-TR",
        "Amazon Europe": "AMZ-EU",
        "Amazon USA": "AMZ-US",
        "eBay": "EBAY",
        "Morhipo": "MRH",
        "PttAVM": "PTT",
        "Teknosa": "TKN",
        "ePttAVM": "EPTT",
    }[normalized] || "";

    if (items.length === 0) {
        // Tek kalem — sipariş toplamı
        const rawPrice = Number(order.totalPrice || 0);
        const label = mpPrefix
            ? (mpPrefix + " Sipariş #" + (order.trackingNumber || ""))
            : ("Sipariş #" + (order.trackingNumber || ""));
        return [{
            name: label,
            quantity: 1,
            unit: "adet",
            unitPrice: toExVat(rawPrice, defaultVatRate),
            vatRate: defaultVatRate,
            discountAmount: 0,
        }];
    }

    return items.map(item => {
        const rawPrice = Number(item.price || 0);
        const itemName = item.productName || "Ürün";
        return {
            name: itemName,
            quantity: Number(item.quantity || 1),
            unit: "adet",
            unitPrice: toExVat(rawPrice, defaultVatRate),
            vatRate: defaultVatRate,
            discountAmount: 0,
        };
    });
};

/**
 * Sipariş bilgilerinden müşteri (alıcı) bilgisi oluştur
 *
 * Pazaryerlerinde müşteri VKN/TCKN bilgisi genelde gelmez.
 * Ancak isim ve adres bilgisi siparişte mevcuttur.
 * e-Arşiv faturalarda "Nihai Tüketici" TCKN: 11111111111 kullanılır
 * ama isim/adres bilgisi siparişten alınır — böylece her fatura
 * doğru müşteriye kesilmiş olur.
 *
 * Öncelik sırası:
 *   1. Siparişten gelen müşteri bilgileri (customerName, customerAddress)
 *   2. Config'deki defaultCustomer (fallback)
 *
 * ── Pazaryerine Özel VKN/TCKN Çıkarma ───────────────────────────────
 *   Trendyol:     invoiceAddress.taxNumber (B2B siparişlerde)
 *   Hepsiburada:  invoiceAddress.taxNumber / vkn (B2B siparişlerde)
 *   N11:          invoiceAddress.taxNumber (B2B siparişlerde)
 *   ÇiçekSepeti:  accountCode (bazen VKN içerir)
 *   Amazon:       BuyerTaxInfo (B2B siparişlerde — SP-API)
 *
 * ✅ FIX: Artık her sipariş için gerçek müşteri adı ve adresi kullanılıyor.
 *   ordersService.js'deki fetch fonksiyonları shipmentAddress/invoiceAddress
 *   bilgisini rawOrders'a aktarıyor, syncOrdersBackground DB'ye kaydediyor.
 *
 * @param {Object} order - Sipariş belgesi (Order model)
 * @param {Object} config - AutoInvoiceConfig belgesi
 * @param {string} [marketplaceName] - Pazaryeri adı (normalize edilmiş)
 */
const buildCustomerFromOrder = (order, config, marketplaceName) => {
    const defaultCustomer = config.defaultCustomer || {};
    const addr = order.customerAddress || {};

    // Müşteri adını parçala (Ad Soyad)
    const fullName = (order.customerName || "").trim();
    let firstName = "";
    let lastName = "";
    if (fullName) {
        const parts = fullName.split(/\s+/);
        if (parts.length >= 2) {
            lastName = parts.pop();
            firstName = parts.join(" ");
        } else {
            firstName = fullName;
            lastName = ".";
        }
    }

    // Siparişte müşteri adı varsa onu kullan, yoksa defaultCustomer'a düş
    const hasOrderCustomer = !!fullName;

    // Fallback isim: defaultCustomer'da name boş olabilir → firstName+lastName'den oluştur
    const defaultFullName = (defaultCustomer.name || "").trim()
        || ((defaultCustomer.firstName || "") + " " + (defaultCustomer.lastName || "")).trim()
        || "Nihai Tuketici";

    // ── Pazaryerine özel VKN/TCKN çıkarma ──────────────────────────────
    // Bazı pazaryerlerinde B2B siparişlerde fatura adresinde VKN bilgisi gelir
    // Bu bilgi varsa e-Fatura mükellefi sorgusu yapılabilir
    let extractedVkn = "";
    let extractedTaxOffice = "";
    let extractedCompany = "";

    // Order model'de customerAddress.taxNumber alanı yok ama
    // ordersService.js sync sırasında invoiceAddress bilgisini
    // rawOrders'dan çıkarıp customerAddress'e aktarıyor.
    // Ek olarak, Order model'e kaydedilmemiş olabilecek raw alanları kontrol et
    const rawInvoiceAddr = order._rawInvoiceAddress || {};

    // Tüm platformlar için ortak VKN çıkarma
    const possibleVkn = rawInvoiceAddr.taxNumber
        || rawInvoiceAddr.vkn
        || addr.taxNumber
        || addr.vkn
        || "";

    if (possibleVkn && possibleVkn.length >= 10 && possibleVkn !== "11111111111") {
        extractedVkn = possibleVkn;
        extractedTaxOffice = rawInvoiceAddr.taxOffice || addr.taxOffice || "";
        extractedCompany = rawInvoiceAddr.company || rawInvoiceAddr.companyName || "";
        logger.info("[AutoInvoice] B2B müşteri tespit edildi — VKN: " + extractedVkn +
            " Firma: " + extractedCompany + " Marketplace: " + (marketplaceName || order.marketplaceName));
    }

    // VKN belirleme: çıkarılan VKN > defaultCustomer VKN > Nihai Tüketici
    const finalVkn = extractedVkn || defaultCustomer.vkn || "11111111111";

    // Firma adı varsa müşteri adı olarak kullan (B2B)
    const customerName = extractedCompany
        ? extractedCompany
        : (hasOrderCustomer ? fullName : defaultFullName);

    return {
        // VKN/TCKN
        vkn: finalVkn,
        taxOffice: extractedTaxOffice || "",

        // İsim
        name: customerName,
        firstName: hasOrderCustomer ? firstName : (defaultCustomer.firstName || "Nihai"),
        lastName: hasOrderCustomer ? lastName : (defaultCustomer.lastName || "Tuketici"),

        // Adres: Siparişten gelen adres bilgileri
        city: addr.city || defaultCustomer.city || "Istanbul",
        district: addr.district || defaultCustomer.district || "Merkez",
        street: addr.street || defaultCustomer.street || "",
        country: addr.country || defaultCustomer.country || "Turkiye",
        phone: addr.phone || defaultCustomer.phone || "",
        email: addr.email || defaultCustomer.email || "",
    };
};

/**
 * Belirli siparişler için manuel otomatik fatura tetikle
 * (Frontend'den "Seçili siparişleri faturala" butonu için)
 *
 * @param {string} userId
 * @param {Array<string>} orderIds - MongoDB _id listesi
 * @returns {Object} { processed, invoiced, skipped, errors }
 */
const processManualBatchInvoice = async (userId, orderIds) => {
    const stats = { processed: 0, invoiced: 0, skipped: 0, errors: 0 };

    if (!orderIds || orderIds.length === 0) {
        return stats;
    }

    const config = await AutoInvoiceConfig.findOne({ userId });
    if (!config) {
        return { ...stats, error: "Otomatik fatura ayarları bulunamadı. Lütfen önce ayarları yapın." };
    }

    if (!config.supplier || !config.supplier.vkn) {
        return { ...stats, error: "Satıcı VKN bilgisi eksik. Lütfen ayarlardan firma bilgilerinizi girin." };
    }

    // Siparişleri getir (Order modelinde alan adı "user", "userId" değil)
    // ✅ FIX: "pending" durumundaki siparişleri de atla (başka işlem tarafından kilitlenmiş olabilir)
    const orders = await Order.find({
        _id: { $in: orderIds },
        user: userId,
        invoiceId: { $exists: false },
        invoiceStatus: { $nin: ["created", "pending"] },
    }).lean();

    if (orders.length === 0) {
        return { ...stats, error: "Fatura kesilecek uygun sipariş bulunamadı." };
    }

    // Marketplace'e göre grupla
    const byMarketplace = {};
    orders.forEach(o => {
        const mp = o.marketplaceName || "Diğer";
        if (!byMarketplace[mp]) byMarketplace[mp] = [];
        byMarketplace[mp].push(o._id);
    });

    // Her marketplace grubu için processAutoInvoice çağır
    // (config.enabled kontrolünü atla — manuel tetikleme)
    const origEnabled = config.enabled;
    config.enabled = true;
    // triggerStatuses'ı geçici olarak genişlet
    const origStatuses = config.triggerStatuses;
    config.triggerStatuses = [];
    await config.save();

    try {
        for (const [mp, ids] of Object.entries(byMarketplace)) {
            const result = await processAutoInvoice(userId, mp, ids);
            stats.processed += result.processed;
            stats.invoiced += result.invoiced;
            stats.skipped += result.skipped;
            stats.errors += result.errors;
        }
    } finally {
        // Orijinal ayarları geri yükle
        config.enabled = origEnabled;
        config.triggerStatuses = origStatuses;
        await config.save();
    }

    return stats;
};

/**
 * Faturası olmayan TÜM siparişler için toplu fatura kes
 * (Frontend "Tümünü Faturala" butonu için)
 *
 * @param {string} userId
 * @param {number} limit - Tek seferde max sipariş (güvenlik)
 * @returns {Object} { processed, invoiced, skipped, errors, totalEligible }
 */
const processAllUninvoiced = async (userId, limit = 50) => {
    const orders = await Order.find({
        user: userId,
        invoiceId: { $exists: false },
        invoiceStatus: { $ne: "created" },
        isCancelled: false,
        isReturned: false,
    }).sort({ orderDate: -1 }).limit(limit).lean();

    if (orders.length === 0) {
        return { processed: 0, invoiced: 0, skipped: 0, errors: 0, totalEligible: 0 };
    }

    const orderIds = orders.map(o => o._id);
    const result = await processManualBatchInvoice(userId, orderIds);
    result.totalEligible = orders.length;
    return result;
};

module.exports = {
    processAutoInvoice,
    processManualBatchInvoice,
    processAllUninvoiced,
    buildInvoiceLinesFromOrder,
    buildCustomerFromOrder,
    normalizeMarketplaceName,
    getEffectiveTriggerStatuses,
    getMarketplaceSpecificSettings,
    MARKETPLACE_STATUS_MAP,
};
