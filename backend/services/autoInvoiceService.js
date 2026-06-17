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
const User = require("../models/User");
const qnbService = require("./qnbEInvoiceService");
const sovosService = require("./sovosEInvoiceService");
const sovosEArchiveService = require("./sovosEArchiveService");
const { isValidGbIdentifier } = require("../utils/sovosApiGuard");

// Ardışık hata limiti — bu kadar hatadan sonra otomatik fatura devre dışı kalır
const MAX_CONSECUTIVE_ERRORS = 5;
const STALE_PENDING_MS = 15 * 60 * 1000;
const PLACEHOLDER_CUSTOMER_VKNS = new Set(["11111111111", "22222222222", "12345678901"]);

const resolvePublicAssetUrl = (url) => {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    const base = String(
        process.env.PUBLIC_API_URL ||
        process.env.API_PUBLIC_URL ||
        process.env.APP_URL ||
        "http://localhost:5000"
    ).replace(/\/$/, "");
    return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`;
};

const normalizeEArchiveVisuals = (visuals = {}) => ({
    logoUrl: resolvePublicAssetUrl(visuals.logoUrl),
    signatureUrl: resolvePublicAssetUrl(visuals.signatureUrl),
    signatureName: String(visuals.signatureName || "").trim(),
    invoiceDescription: String(visuals.invoiceDescription || "").trim(),
});

/** Takılı kalmış pending siparişleri serbest bırak (çökme/yarım işlem sonrası) */
const releaseStalePendingOrders = async (userId) => {
    const cutoff = new Date(Date.now() - STALE_PENDING_MS);
    const result = await Order.updateMany(
        {
            user: userId,
            invoiceStatus: "pending",
            invoiceId: { $exists: false },
            updatedAt: { $lt: cutoff },
        },
        { invoiceStatus: "" }
    );
    const n = result.modifiedCount || 0;
    if (n > 0) {
        logger.info("[AutoInvoice] " + n + " takılı pending sipariş sıfırlandı — userId=" + userId);
    }
    return n;
};

const getUninvoicedStartDate = (config) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return config?.autoInvoiceStartDate ? new Date(config.autoInvoiceStartDate) : thirtyDaysAgo;
};

/** Manuel test listesi — son 90 gün (otomatik cron autoInvoiceStartDate kullanır) */
const getUninvoicedListStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d;
};

/** Faturasız / işlenebilir sipariş sorgusu (pending hariç — aktif kilit) */
const buildUninvoicedOrderFilter = (userId, config, { includeError = true, includePending = false } = {}) => {
    const excludedStatuses = ["created"];
    if (!includePending) excludedStatuses.push("pending");
    if (!includeError) excludedStatuses.push("error");

    const filter = {
        user: userId,
        invoiceId: { $exists: false },
        invoiceStatus: { $nin: excludedStatuses },
        isCancelled: false,
        isReturned: false,
        totalPrice: { $gt: 0 },
        orderDate: { $gte: getUninvoicedStartDate(config) },
    };
    return filter;
};

/** UI sipariş listesi — 90 gün, pending dahil (test ekranı) */
const buildUninvoicedListFilter = (userId, config) => {
    const excludedStatuses = ["created"];
    return {
        user: userId,
        invoiceId: { $exists: false },
        invoiceStatus: { $nin: excludedStatuses },
        isCancelled: false,
        isReturned: false,
        totalPrice: { $gt: 0 },
        orderDate: { $gte: getUninvoicedListStartDate() },
    };
};

/**
 * Tetikleme listesi boşken kullanılacak dar varsayılan (erken sipariş durumlarında otomatik kesim yok)
 */
const SAFE_DEFAULT_TRIGGER_STATUSES = [
    "Shipped", "SHIPPED", "Delivered", "DELIVERED", "Complete", "Completed", "COMPLETED",
    "InTransit", "IN_TRANSIT", "Kargoda", "Kargoya Verildi", "Teslim Edildi", "Teslim",
    "Tamamlandı", "Packed", "PACKED", "ReadyToShip", "READY_TO_SHIP",
    "PartiallyShipped", "Gönderildi",
];

/**
 * Sipariş tarihinin üzerinden en az `delayDays` tam takvim günü geçti mi (yerel tarih)
 * @param {Date|string} orderDate
 * @param {number} delayDays
 */
const isOrderPastInvoiceDelay = (orderDate, delayDays, now = new Date()) => {
    if (delayDays == null || delayDays <= 0) return true;
    const od = orderDate instanceof Date ? orderDate : new Date(orderDate);
    if (isNaN(od.getTime())) return true;
    const startOd = new Date(od.getFullYear(), od.getMonth(), od.getDate());
    const deadline = new Date(startOd);
    deadline.setDate(deadline.getDate() + Math.min(90, Math.floor(Number(delayDays) || 0)));
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startNow >= deadline;
};

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
    PttAVM: ["New", "Approved", "Shipped", "Delivered", "Processing"],
    Ozon: [
        "awaiting_packaging",
        "awaiting_deliver",
        "awaiting_approval",
        "delivering",
        "delivered",
        "cancelled",
    ],
};

/**
 * Ülke adının Türkiye olup olmadığını kontrol et
 * Farklı yazım biçimlerini destekler (TR, Turkey, Türkiye, Turkiye vb.)
 * @param {string} country
 * @returns {boolean} Türkiye ise true
 */
const isTurkeyCountry = (country) => {
    if (!country) return true; // Ülke bilgisi yoksa Türkiye varsay
    const c = country.toLowerCase().trim();
    return [
        "tr", "tur", "turkey", "turkiye", "türkiye", "turkei",
        "republic of turkey", "republic of türkiye",
    ].includes(c);
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
        "pttavm": "PttAVM",
        "ozon": "Ozon",
    };
    return MAP[lower] || name;
};

/**
 * Verilen pazaryeri ve config için geçerli tetikleme durumlarını döndür
 * Öncelik: config.triggerStatuses (doluysa) > güvenli varsayılan (Shipped benzeri)
 */
const getEffectiveTriggerStatuses = (config, marketplaceName) => {
    if (config.triggerStatuses && config.triggerStatuses.length > 0) {
        return config.triggerStatuses;
    }
    void marketplaceName;
    return SAFE_DEFAULT_TRIGGER_STATUSES;
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
        invoiceDelayDays: mpSettings?.invoiceDelayDays,
    };
};

/**
 * Genel veya pazaryeri özel fatura gecikmesi (tam gün, 0–90)
 */
const getEffectiveInvoiceDelayDays = (config, marketplaceName) => {
    const mp = getMarketplaceSpecificSettings(config, marketplaceName);
    if (typeof mp.invoiceDelayDays === "number" && mp.invoiceDelayDays >= 0) {
        return Math.min(90, Math.floor(mp.invoiceDelayDays));
    }
    const g = config.invoiceDelayDays;
    if (typeof g === "number" && g >= 0) return Math.min(90, Math.floor(g));
    return 0;
};

/**
 * Sipariş listesi için otomatik fatura kesme işlemini başlat
 *
 * @param {string} userId - Kullanıcı ID
 * @param {string} marketplaceName - Pazaryeri adı (Trendyol, Hepsiburada...)
 * @param {Array} newOrderIds - Yeni kaydedilen sipariş MongoDB _id'leri
 * @param {object} [options]
 * @param {boolean} [options.skipDelayCheck] - Manuel tetikte gecikme filtresini atla
 * @param {boolean} [options.bypassStatusFilter] - Durum filtresini atla (ör. seçili siparişleri faturala)
 * @param {boolean} [options.ignoreEnabled] - Otomatik kapalı olsa da çalış (manuel tetik)
 * @returns {Object} { processed, invoiced, skipped, errors }
 */
const processAutoInvoice = async (userId, marketplaceName, newOrderIds, options = {}) => {
    const skipDelayCheck = !!options.skipDelayCheck;
    const bypassStatusFilter = !!options.bypassStatusFilter;
    const ignoreEnabled = !!options.ignoreEnabled;

    const stats = { processed: 0, invoiced: 0, skipped: 0, errors: 0 };

    if (!newOrderIds || newOrderIds.length === 0) {
        return stats;
    }

    try {
        // ── 1. Config kontrol ─────────────────────────────────────────────
        const config = await AutoInvoiceConfig.findOne({ userId });
        if (!config) {
            logger.info("[AutoInvoice] Ayar bulunamadı — userId=" + userId);
            return stats;
        }
        if (!ignoreEnabled && !config.enabled) {
            logger.info("[AutoInvoice] Devre dışı — userId=" + userId);
            return stats;
        }

        // Ardışık hata limiti aşıldıysa otomatik devre dışı — manuel tetikle bypass etme
        if (!ignoreEnabled && config.stats.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            logger.warn("[AutoInvoice] Ardışık hata limiti aşıldı (" + MAX_CONSECUTIVE_ERRORS + "), devre dışı — userId=" + userId);
            config.enabled = false;
            config.stats.lastError = "Ardışık hata limiti aşıldı, otomatik fatura devre dışı bırakıldı.";
            config.stats.lastErrorDate = new Date();
            await config.save();
            return stats;
        }

        // Pazaryeri aktif mi? (normalize ederek karşılaştır) — manuel tetikte atla
        const normalizedMp = normalizeMarketplaceName(marketplaceName);
        if (!ignoreEnabled && config.enabledMarketplaces.length > 0) {
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

        const provider = config.provider || "qnb";

        // ── 3. Sağlayıcı oturumu (QNB veya Sovos) ─────────────────────────
        let earsivSessionId = null;
        let efaturaSessionId = null;
        let sovosSessionId = null;
        const env = provider === "sovos"
            ? (config.sovosCredentials?.env || "test")
            : (config.qnbCredentials?.env || "test");

        if (provider === "sovos") {
            const sc = config.sovosCredentials || {};
            const username = sc.username || "";
            const password = sc.password || "";
            const vknTckn = sc.vknTckn || config.supplier?.vkn || "";
            const senderIdentifier = sc.senderIdentifier || "";

            if (!username || !password || !vknTckn) {
                logger.error("[AutoInvoice] Sovos credentials eksik — userId=" + userId);
                config.stats.lastError = "Sovos web servis bilgileri eksik. Faturalandırma → Sovos bağlantısını tamamlayın.";
                config.stats.lastErrorDate = new Date();
                await config.save();
                return stats;
            }

            const gbValid = isValidGbIdentifier(senderIdentifier);
            const sovosLogin = await sovosService.login({
                username,
                password,
                vknTckn,
                senderIdentifier,
                receiverIdentifier: sc.receiverIdentifier || "",
                branch: sc.branch || "default",
                env,
                loginMode: gbValid ? "auto" : "earsiv",
            });

            if (!sovosLogin.success) {
                logger.error("[AutoInvoice] Sovos login başarısız: " + sovosLogin.error);
                config.stats.lastError = "Sovos login başarısız: " + sovosLogin.error;
                config.stats.lastErrorDate = new Date();
                config.stats.consecutiveErrors += 1;
                await config.save();
                return stats;
            }

            sovosSessionId = sovosLogin.sessionId;
            const caps = sovosLogin.capabilities || {};
            if (caps.efatura && gbValid) {
                efaturaSessionId = sovosLogin.sessionId;
            }
            if (gbValid && !caps.efatura) {
                logger.warn(
                    "[AutoInvoice] GB etiketi geçerli (" + senderIdentifier +
                    ") ancak e-Fatura WS doğrulaması başarısız — ortam=test ve Sovos WS kullanıcısını kontrol edin"
                );
            }
            if (caps.earsiv && !caps.efatura) {
                logger.info("[AutoInvoice] Sovos yalnızca e-Arşiv — e-Fatura oturumu açılmadı");
            }
            logger.info("[AutoInvoice] Sovos oturum açıldı — sessionId=" + sovosSessionId.substring(0, 8) + "...");
        }

        // ── 2. Siparişleri getir ─────────────────────────────────────────
        const orderFilter = {
            _id: { $in: newOrderIds },
            invoiceId: { $exists: false },
            invoiceStatus: { $nin: ["created", "pending"] },
            isCancelled: false,
            isReturned: false,
            totalPrice: { $gt: 0 },
        };

        if (config.autoInvoiceStartDate && !ignoreEnabled) {
            orderFilter.orderDate = { $gte: config.autoInvoiceStartDate };
        }

        const orders = await Order.find(orderFilter).lean();

        if (orders.length === 0) {
            if (ignoreEnabled) {
                logger.warn(
                    "[AutoInvoice] Manuel tetik — sipariş bulunamadı (pending/kilit veya iptal?) userId=" + userId
                );
            } else {
                logger.info("[AutoInvoice] Fatura kesilecek sipariş yok — userId=" + userId);
            }
            return stats;
        }

        const triggerStatuses = getEffectiveTriggerStatuses(config, normalizedMp);

        let eligibleOrders = orders;
        if (!bypassStatusFilter) {
            eligibleOrders = eligibleOrders.filter(order => {
                const status = (order.status || "").toLowerCase();
                return triggerStatuses.some(ts => status.includes(ts.toLowerCase()));
            });
        }

        if (!skipDelayCheck) {
            const delayDays = getEffectiveInvoiceDelayDays(config, normalizedMp);
            eligibleOrders = eligibleOrders.filter(order => isOrderPastInvoiceDelay(order.orderDate, delayDays));
        }

        if (eligibleOrders.length === 0) {
            logger.info("[AutoInvoice] Durum/gecikme filtresi sonrası fatura kesilecek sipariş yok — userId=" + userId);
            stats.skipped = orders.length;
            return stats;
        }

        logger.info("[AutoInvoice] " + eligibleOrders.length + " sipariş için fatura kesilecek — userId=" + userId + " marketplace=" + marketplaceName + " provider=" + provider);

        if (provider === "qnb" || !config.provider) {
            // ⚠️ e-Arşiv ve e-Fatura FARKLI ortamlar — FARKLI credentials!
            //   Her kullanıcı QNB'den aldığı kullanıcı adı/şifreyi olduğu gibi girer.
            //   Öncelik: AutoInvoiceConfig.qnbCredentials > User.companyInfo.qnb
            //   .env fallback KULLANILMAZ — credential yoksa hata verilir.

            // User.companyInfo.qnb'den de oku (tek kaynak fallback)
            let userQnb = {};
            try {
                const user = await User.findById(userId).select("companyInfo.qnb").lean();
                userQnb = user?.companyInfo?.qnb || {};
            } catch (e) { /* ignore */ }

            // ── Credential çözümleme ──────────────────────────────────────
            // Öncelik: config.qnbCredentials > User.companyInfo.qnb
            // Her kaynak loglanır — debug kolaylığı için
            let earsivUsername = "";
            let earsivPassword = "";
            let credSource = "";

            if (config.qnbCredentials.earsivUsername && config.qnbCredentials.earsivPassword) {
                earsivUsername = config.qnbCredentials.earsivUsername;
                earsivPassword = config.qnbCredentials.earsivPassword;
                credSource = "AutoInvoiceConfig";
            } else if (userQnb.earsivUsername && userQnb.earsivPassword) {
                earsivUsername = userQnb.earsivUsername;
                earsivPassword = userQnb.earsivPassword;
                credSource = "User.companyInfo.qnb";
            }

            // e-Fatura credentials — eski username alanı e-Fatura'ya ait
            const efaturaUsername = config.qnbCredentials.efaturaUsername || userQnb.efaturaUsername || config.qnbCredentials.username || config.supplier.vkn || "";
            const efaturaPassword = config.qnbCredentials.efaturaPassword || userQnb.efaturaPassword || config.qnbCredentials.password || "";

            if (!earsivUsername || !earsivPassword) {
                logger.error("[AutoInvoice] QNB e-Arşiv credentials eksik — userId=" + userId +
                    " — config.earsivUsername=" + (config.qnbCredentials.earsivUsername ? "'" + config.qnbCredentials.earsivUsername + "'" : "(boş)") +
                    " user.earsivUsername=" + (userQnb.earsivUsername ? "'" + userQnb.earsivUsername + "'" : "(boş)"));
                config.stats.lastError = "QNB e-Arşiv kullanıcı adı veya şifre eksik. Lütfen Faturalandırma ayarlarından QNB bağlantı bilgilerinizi girin.";
                config.stats.lastErrorDate = new Date();
                await config.save();
                return stats;
            }

            logger.info("[AutoInvoice] QNB credentials — kaynak: " + credSource +
                " earsivUser=" + earsivUsername + " env=" + env);

            // e-Arşiv login (her zaman gerekli — çoğu pazaryeri müşterisi bireysel)
            const earsivLogin = await qnbService.login({
                username: earsivUsername,
                password: earsivPassword,
                env: env,
                service: "earsiv"
            });

            if (!earsivLogin.success) {
                logger.error("[AutoInvoice] QNB e-Arşiv login başarısız: " + earsivLogin.error +
                    " — user=" + earsivUsername + " kaynak=" + credSource);
                config.stats.lastError = "QNB e-Arşiv login başarısız (" + earsivUsername + "): " + earsivLogin.error;
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
                // 0. Pazaryerinde zaten fatura kesilmiş mi kontrolü
                if (order.marketplaceInvoiced) {
                    logger.info("[AutoInvoice] ⏭️ Pazaryerinde zaten faturalı — orderNumber=" + order.trackingNumber + " marketplace=" + normalizedMp);
                    stats.skipped++;
                    continue;
                }

                // 1. Invoice tablosunda orderId kontrolü
                const existingInvoice = await Invoice.findOne({ orderId: order._id });
                if (existingInvoice) {
                    logger.info("[AutoInvoice] ⏭️ Sipariş zaten faturalandı (Invoice var) — orderNumber=" + order.trackingNumber + " faturaNo=" + existingInvoice.invoiceNumber);
                    stats.skipped++;
                    continue;
                }

                // 1.5. Aynı sipariş numarası + marketplace ile başka fatura var mı?
                // (farklı Order _id ama aynı sipariş numarası olabilir)
                if (order.trackingNumber) {
                    const dupInvoice = await Invoice.findOne({
                        userId: userId,
                        orderNumber: order.trackingNumber,
                        marketplaceName: { $regex: new RegExp("^" + normalizedMp + "$", "i") },
                    });
                    if (dupInvoice) {
                        logger.info("[AutoInvoice] ⏭️ Aynı sipariş numarası ile fatura mevcut — orderNumber=" + order.trackingNumber + " faturaNo=" + dupInvoice.invoiceNumber);
                        stats.skipped++;
                        continue;
                    }
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

                // ── Mikro İhracat Tespiti ──────────────────────────────────
                // Teslimat ülkesi Türkiye dışı ise → İhracat Kayıtlı fatura
                // KDV %0, invoiceTypeCode: IHRACKAYITLI
                const shipCountry = (order.shippingCountry || order.customerAddress?.country || "Turkiye").trim();
                const isMicroExport = shipCountry && !isTurkeyCountry(shipCountry);

                if (isMicroExport) {
                    logger.info("[AutoInvoice] 🌍 Mikro ihracat tespit edildi — ülke: " + shipCountry +
                        " orderNumber=" + order.trackingNumber + " marketplace=" + normalizedMp);
                }

                // Fatura kalemlerini oluştur (pazaryerine özel KDV oranı)
                // Mikro ihracat ise KDV %0 zorla
                const invoiceLines = isMicroExport
                    ? buildInvoiceLinesFromOrder(order, config, normalizedMp).map(l => ({ ...l, vatRate: 0 }))
                    : buildInvoiceLinesFromOrder(order, config, normalizedMp);

                // Müşteri bilgilerini hazırla (pazaryerine özel VKN çıkarma)
                const customer = buildCustomerFromOrder(order, config, normalizedMp);

                // Mikro ihracat ise müşteri ülkesini güncelle
                if (isMicroExport) {
                    customer.country = shipCountry;
                }

                // invoiceData oluştur
                const baseInvoiceTypeCode = isMicroExport ? "IHRACKAYITLI" : (config.invoiceTypeCode || "SATIS");
                const visuals = config.eArchiveVisuals || {};
                const baseDescription = String(visuals.invoiceDescription || "").trim();
                const invoiceNote = isMicroExport
                    ? ("Mikro İhracat — " + normalizedMp + " Sipariş: " + (order.trackingNumber || "") + " — Ülke: " + shipCountry)
                    : (mpSpecific.note || baseDescription || ("Otomatik fatura — " + normalizedMp + " Sipariş: " + (order.trackingNumber || "")));
                const supplierVkn = provider === "sovos"
                    ? (config.sovosCredentials?.vknTckn || config.supplier.vkn)
                    : config.supplier.vkn;
                const invoiceData = {
                    faturaKodu: provider === "sovos"
                        ? (mpSpecific.invoiceSeriesCode || config.invoiceSeriesCode || "FA")
                        : (mpSpecific.invoiceSeriesCode || config.invoiceSeriesCode || "LYS"),
                    custInvId: String(order.trackingNumber || order.orderNumber || order._id || ""),
                    orderNumber: String(order.trackingNumber || order.orderNumber || ""),
                    invoiceTypeCode: baseInvoiceTypeCode,
                    issueDate: new Date().toISOString().split("T")[0],
                    currency: config.currency || "TRY",
                    note: invoiceNote,
                    sendingType: config.sendingType || "ELEKTRONIK",
                    eArchiveVisuals: normalizeEArchiveVisuals({
                        logoUrl: visuals.logoUrl || "",
                        signatureUrl: visuals.signatureUrl || "",
                        signatureName: visuals.signatureName || "",
                        invoiceDescription: baseDescription,
                    }),
                    supplier: {
                        vkn: supplierVkn,
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
                // Pazaryeri bireysel müşterileri → e-Arşiv (VKN yok veya placeholder)
                let useEFatura = false;
                let resolvedProfileId = "EARSIVFATURA";

                const customerVkn = customer.vkn || "";
                const isNihaiTuketici = !customerVkn || PLACEHOLDER_CUSTOMER_VKNS.has(customerVkn);

                let sovosReceiverPk = "";
                let result;

                if (!isNihaiTuketici && efaturaSessionId) {
                    try {
                        const checkResult = provider === "sovos"
                            ? await sovosService.checkEInvoiceUser({ sessionId: efaturaSessionId, vkn: customerVkn })
                            : await qnbService.checkEInvoiceUser({ sessionId: efaturaSessionId, vkn: customerVkn, env });
                        if (checkResult.success && checkResult.isRegistered) {
                            useEFatura = true;
                            resolvedProfileId = config.documentType || "TICARIFATURA";
                            sovosReceiverPk = checkResult.receiverIdentifier || config.sovosCredentials?.receiverIdentifier || "";
                            logger.info("[AutoInvoice] Alıcı e-Fatura mükellefi — VKN: " + customerVkn + " → e-Fatura kesilecek");
                        } else {
                            logger.info("[AutoInvoice] Alıcı e-Fatura mükellefi değil — VKN: " + customerVkn + " → e-Arşiv kesilecek");
                        }
                    } catch (checkErr) {
                        logger.warn("[AutoInvoice] e-Fatura mükellef sorgusu başarısız, e-Arşiv ile devam: " + checkErr.message);
                    }
                } else if (!isNihaiTuketici && !efaturaSessionId) {
                    if (provider === "sovos") {
                        const sellerEfatura = config.sovosCredentials?.capabilities?.efatura;
                        if (!sellerEfatura) {
                            logger.error(
                                "[AutoInvoice] Alıcı e-Fatura mükellefi olabilir (VKN=" + customerVkn +
                                ") ancak Sovos hesabınızda e-Fatura yetkisi yok — fatura kesilemedi"
                            );
                            result = {
                                success: false,
                                error: "Alıcı kurumsal/mükellef görünüyor; Sovos hesabınızda yalnızca e-Arşiv yetkisi var. e-Fatura lisansı ve GB etiketi gerekir.",
                            };
                        } else {
                            logger.warn("[AutoInvoice] Alıcı VKN=" + customerVkn + " — e-Fatura oturumu yok, mükellef sorgusu yapılamadı");
                            customer.vkn = "11111111111";
                            customer.firstName = customer.firstName || "Nihai";
                            customer.lastName = customer.lastName || "Tuketici";
                            if (invoiceData.customer) invoiceData.customer.vkn = "11111111111";
                        }
                    } else {
                        logger.warn("[AutoInvoice] Alıcı VKN=" + customerVkn +
                            " ama e-Fatura oturumu yok — Nihai Tüketici (11111111111) olarak e-Arşiv kesilecek");
                        customer.vkn = "11111111111";
                        customer.firstName = customer.firstName || "Nihai";
                        customer.lastName = customer.lastName || "Tuketici";
                        if (invoiceData.customer) {
                            invoiceData.customer.vkn = "11111111111";
                        }
                    }
                }

                if (useEFatura && provider === "sovos" && !config.sovosCredentials?.capabilities?.efatura) {
                    result = {
                        success: false,
                        error: "Alıcı e-Fatura mükellefi; Sovos hesabınızda e-Fatura yetkisi yok. GB etiketi ve e-Fatura lisansı gerekir.",
                    };
                }

                if (!result) {
                const { buildInvoiceXml } = require("../utils/ublBuilder");

                if (provider === "sovos") {
                    if (useEFatura && efaturaSessionId) {
                        const invoiceNumber = sovosService.buildSovosInvoiceNumber(
                            invoiceData.faturaKodu || "LYS",
                            stats.processed
                        );
                        const { xml, uuid, totals } = buildInvoiceXml({
                            profileId: resolvedProfileId,
                            invoiceTypeCode: invoiceData.invoiceTypeCode || "SATIS",
                            invoiceNumber,
                            issueDate: invoiceData.issueDate,
                            currency: invoiceData.currency || "TRY",
                            note: invoiceData.note || "",
                            sendingType: invoiceData.sendingType || "ELEKTRONIK",
                            eArchiveVisuals: invoiceData.eArchiveVisuals || {},
                            supplier: invoiceData.supplier || {},
                            customer: invoiceData.customer || {},
                            lines: invoiceData.lines || [],
                        });

                        const receiverId = sovosReceiverPk || config.sovosCredentials?.receiverIdentifier;
                        if (!receiverId) {
                            result = { success: false, error: "Alıcı PK etiketi bulunamadı — Sovos ayarlarından PK etiketi tanımlayın" };
                        } else {
                            const sendResult = await sovosService.sendUBL({
                                sessionId: sovosSessionId,
                                ublXml: xml,
                                fileName: uuid,
                                docType: "INVOICE",
                                receiverIdentifier: receiverId,
                                senderIdentifier: config.sovosCredentials?.senderIdentifier,
                            });
                            result = sendResult.success
                                ? {
                                    success: true,
                                    uuid: sendResult.uuid || uuid,
                                    invoiceNumber: sendResult.invoiceNumber || invoiceNumber,
                                    totals,
                                    data: sendResult.raw,
                                }
                                : sendResult;
                        }
                        logger.info("[AutoInvoice] Sovos e-Fatura gönderildi — " + (result.invoiceNumber || ""));
                    } else {
                        resolvedProfileId = "EARSIVFATURA";
                        const custInvId = String(order.trackingNumber || order.orderNumber || order._id || "");
                        const supplierVkn = config.sovosCredentials?.vknTckn || config.supplier.vkn;

                        // Sovos'a gönderilmiş ama DB kaydı oluşmamış siparişleri kurtar (mükerrer gönderim önlenir)
                        if (custInvId) {
                            try {
                                const existingStatus = await sovosEArchiveService.getStatus({
                                    sessionId: sovosSessionId,
                                    vkn: supplierVkn,
                                    custInvID: custInvId,
                                    custInvId,
                                    orderNumber: custInvId,
                                });
                                const statusUuid = existingStatus.success && existingStatus.data?.uuid;
                                if (statusUuid) {
                                    logger.info(
                                        "[AutoInvoice] Sovos'ta mevcut e-Arşiv bulundu — DB'ye kurtarılıyor custInvId=" + custInvId +
                                        " UUID=" + statusUuid
                                    );
                                    result = {
                                        success: true,
                                        uuid: statusUuid,
                                        invoiceNumber: existingStatus.data.invoiceNumber || "",
                                        custInvId,
                                        totals: {
                                            payableAmount: Number(order.totalPrice || 0),
                                            lineExtensionAmount: 0,
                                            totalTax: 0,
                                            taxInclusiveAmount: Number(order.totalPrice || 0),
                                        },
                                        recovered: true,
                                    };
                                }
                            } catch (recoverErr) {
                                logger.warn("[AutoInvoice] Sovos e-Arşiv kurtarma sorgusu atlandı: " + recoverErr.message);
                            }
                        }

                        if (!result) {
                            result = await sovosEArchiveService.createEArchiveFromForm({
                                sessionId: sovosSessionId,
                                vkn: supplierVkn,
                                invoiceData: {
                                    ...invoiceData,
                                    faturaKodu: invoiceData.faturaKodu || config.sovosCredentials?.faturaKodu || config.invoiceSeriesCode || "FA",
                                },
                                branch: config.sovosCredentials?.branch || "default",
                            });
                        }
                    }
                } else if (useEFatura && efaturaSessionId) {
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
                        eArchiveVisuals: invoiceData.eArchiveVisuals || {},
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
                }

                if (result.success) {
                    // Invoice kaydı oluştur
                    const invoice = new Invoice({
                        userId: userId,
                        orderId: order._id,
                        orderNumber: order.trackingNumber || "",
                        custInvId: String(order.trackingNumber || order.orderNumber || order._id || ""),
                        marketplaceName: marketplaceName,
                        invoiceNumber: result.invoiceNumber,
                        uuid: result.uuid,
                        profileId: resolvedProfileId,
                        invoiceTypeCode: baseInvoiceTypeCode,
                        issueDate: new Date(),
                        currency: config.currency || "TRY",
                        provider: provider === "sovos" ? "sovos" : "qnb",
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

                    // Pazaryeri yüklemesi henüz uygulanmıyor — yalnızca tercih kaydı (açıkken debug)
                    if (config.autoUploadInvoiceToMarketplace) {
                        logger.debug("[AutoInvoice] Pazaryeri yükleme tercihi açık (henüz API yok) — mp=" +
                            marketplaceName + " order=" + order.trackingNumber);
                    }
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

                try {
                    await Order.updateOne({ _id: order._id }, { invoiceStatus: "error" });
                } catch (updateErr) {
                    logger.warn("[AutoInvoice] invoiceStatus güncellenemedi — " + order.trackingNumber + ": " + updateErr.message);
                }

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
        if (sovosSessionId) {
            try {
                await sovosService.logout({ sessionId: sovosSessionId });
                logger.info("[AutoInvoice] Sovos logout başarılı");
            } catch (logoutErr) {
                logger.warn("[AutoInvoice] Sovos logout hatası: " + logoutErr.message);
            }
        }
        if (provider === "qnb" || !config.provider) {
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
        "PttAVM": "PTT",
        "Ozon": "OZ",
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

    if (possibleVkn && possibleVkn.length >= 10 && !PLACEHOLDER_CUSTOMER_VKNS.has(possibleVkn)) {
        extractedVkn = possibleVkn;
        extractedTaxOffice = rawInvoiceAddr.taxOffice || addr.taxOffice || "";
        extractedCompany = rawInvoiceAddr.company || rawInvoiceAddr.companyName || "";
        logger.info("[AutoInvoice] B2B müşteri tespit edildi — VKN: " + extractedVkn +
            " Firma: " + extractedCompany + " Marketplace: " + (marketplaceName || order.marketplaceName));
    }

    // VKN belirleme: çıkarılan VKN > defaultCustomer VKN > Nihai Tüketici
    // ⚠️ Eski schema default "12345678901" QNB test ortamında e-Fatura mükellefi olarak kayıtlı
    //    Bu yüzden defaultCustomer.vkn olarak gelirse Nihai Tüketici'ye düş
    const defaultVkn = defaultCustomer.vkn && !PLACEHOLDER_CUSTOMER_VKNS.has(defaultCustomer.vkn)
        ? defaultCustomer.vkn
        : "11111111111";
    const finalVkn = extractedVkn || defaultVkn;

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

    // Manuel tetik — ardışık hata kilidini kaldır (kullanıcı bilinçli deniyor)
    if (config.stats.consecutiveErrors > 0) {
        config.stats.consecutiveErrors = 0;
        if (String(config.stats.lastError || "").includes("Ardışık hata limiti")) {
            config.stats.lastError = "";
        }
        await config.save();
        logger.info("[AutoInvoice] Manuel tetik — hata sayacı sıfırlandı userId=" + userId);
    }

    // Takılı pending siparişleri serbest bırak
    await releaseStalePendingOrders(userId);
    // Hatalı siparişleri yeniden denenebilir yap
    await Order.updateMany(
        {
            user: userId,
            _id: { $in: orderIds },
            invoiceId: { $exists: false },
            invoiceStatus: "error",
        },
        { invoiceStatus: "" }
    );

    // Siparişleri getir (Order modelinde alan adı "user", "userId" değil)
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

    // Her marketplace grubu için processAutoInvoice çağır (otomatik kapalı / gecikme / durum: manuel bypass)
    for (const [mp, ids] of Object.entries(byMarketplace)) {
        const result = await processAutoInvoice(userId, mp, ids, {
            skipDelayCheck: true,
            bypassStatusFilter: true,
            ignoreEnabled: true,
        });
        stats.processed += result.processed;
        stats.invoiced += result.invoiced;
        stats.skipped += result.skipped;
        stats.errors += result.errors;
    }

    return stats;
};

/**
 * Faturası olmayan TÜM siparişler için toplu fatura kes
 * (Frontend "Tümünü Faturala" butonu için)
 *
 * ✅ FIX: "error" durumundaki siparişleri önce sıfırla (tekrar denenebilsin)
 *         "pending" siparişleri hariç tut (başka işlem tarafından kilitli)
 *         totalPrice > 0 filtresi ekle (0 TL siparişler faturalanmaz)
 *
 * @param {string} userId
 * @param {number} limit - Tek seferde max sipariş (güvenlik)
 * @returns {Object} { processed, invoiced, skipped, errors, totalEligible }
 */
const processAllUninvoiced = async (userId, limit = 50) => {
    // ── 0. Kullanıcının auto-invoice config'ini yükle ────────────────────
    const config = await AutoInvoiceConfig.findOne({ userId });
    if (!config) {
        return { processed: 0, invoiced: 0, skipped: 0, errors: 0, error: "Otomatik fatura ayarları bulunamadı." };
    }

    if (config.stats.consecutiveErrors > 0) {
        config.stats.consecutiveErrors = 0;
        if (String(config.stats.lastError || "").includes("Ardışık hata limiti")) {
            config.stats.lastError = "";
        }
        await config.save();
        logger.info("[AutoInvoice] Toplu manuel tetik — hata sayacı sıfırlandı userId=" + userId);
    }

    await releaseStalePendingOrders(userId);

    // ── 1. Daha önce hata almış siparişleri sıfırla (tekrar denenebilsin) ──
    // "error" durumundaki siparişlerin invoiceStatus'unu "" yap
    const resetResult = await Order.updateMany(
        {
            user: userId,
            invoiceId: { $exists: false },
            invoiceStatus: "error",
            isCancelled: false,
            isReturned: false,
            totalPrice: { $gt: 0 },
        },
        { invoiceStatus: "" }
    );
    if (resetResult.modifiedCount > 0) {
        logger.info("[AutoInvoice] " + resetResult.modifiedCount + " hatalı sipariş sıfırlandı — userId=" + userId);
    }

    // ── 2. Faturasız siparişleri getir ──────────────────────────────────────
    const allFilter = buildUninvoicedOrderFilter(userId, config, { includeError: true, includePending: false });

    const orders = await Order.find(allFilter)
        .sort({ orderDate: -1 }).limit(limit).lean();

    if (orders.length === 0) {
        const [pendingCount, errorCount, totalInRange] = await Promise.all([
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                invoiceStatus: "pending",
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: getUninvoicedStartDate(config) },
            }),
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                invoiceStatus: "error",
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: getUninvoicedStartDate(config) },
            }),
            Order.countDocuments({
                user: userId,
                invoiceId: { $exists: false },
                isCancelled: false,
                isReturned: false,
                totalPrice: { $gt: 0 },
                orderDate: { $gte: getUninvoicedStartDate(config) },
            }),
        ]);
        let hint = "Seçili tarih aralığında faturalanabilir sipariş bulunamadı.";
        if (pendingCount > 0) {
            hint = pendingCount + " sipariş işlem kilidinde (pending). 15 dk sonra otomatik açılır veya yenileyin.";
        } else if (errorCount > 0) {
            hint = errorCount + " hatalı sipariş var — 'Tekrar Dene' ile yeniden deneyin.";
        } else if (totalInRange === 0) {
            hint = "Başlangıç tarihinden (" + getUninvoicedStartDate(config).toISOString().slice(0, 10) + ") sonra sipariş yok.";
        }
        return { processed: 0, invoiced: 0, skipped: 0, errors: 0, totalEligible: 0, hint };
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
    releaseStalePendingOrders,
    buildUninvoicedOrderFilter,
    buildUninvoicedListFilter,
    getUninvoicedStartDate,
    getUninvoicedListStartDate,
    buildInvoiceLinesFromOrder,
    buildCustomerFromOrder,
    normalizeMarketplaceName,
    getEffectiveTriggerStatuses,
    getMarketplaceSpecificSettings,
    getEffectiveInvoiceDelayDays,
    isOrderPastInvoiceDelay,
    MARKETPLACE_STATUS_MAP,
};
