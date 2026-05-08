/**
 * Marketplace Controller — LysiaETIC
 * ✅ FIX H11: Indentation düzeltildi (fazla 4 boşluk kaldırıldı)
 * ✅ FIX H5: Credential şifreleme aktifleştirildi
 */
const Marketplace = require("../models/Marketplace");
const AutoOrderConfig = require("../models/AutoOrderConfig");
const logger = require("../config/logger");
const { encryptCredentials, decryptCredentials } = require("../utils/encryption");

/** Hepsiburada useSit — DB/string/boolean karışığını tek tip boolean yap (normalizeCredentials ile uyumlu) */
const coerceHbUseSitIncoming = (val) => {
    if (val === true || val === 1) return true;
    if (val === false || val === 0) return false;
    if (typeof val === "string") {
        const s = val.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
        if (s === "false" || s === "0" || s === "no" || s === "off" || s === "") return false;
    }
    return false;
};

/**
 * İstemciden gelen boş / maskeli placeholder değerleri — DB'deki mevcut anahtarı korumak için.
 * (getUserMarketplaces masked "••••••abcd" döner; yanlışlıkla şifrelenip saklanmasın.)
 */
const isMaskedOrEmptyCredentialValue = (val) => {
    if (val === undefined || val === null) return true;
    if (typeof val === "boolean") return false;
    const s = String(val).trim();
    if (s === "") return true;
    if (/^[\u2022•.⋯]+$/.test(s)) return true;
    if (s.startsWith("••") || s.startsWith("...")) return true;
    return false;
};

/**
 * POST/PUT ile gelen credential'ı mevcut kullanıcı kaydıyla birleştir — tek kaynak DB.
 * @param {object|null} storedDecrypted — decryptCredentials çıktısı
 * @param {object} incoming — req.body.credentials
 */
const mergeIncomingCredentialsWithStored = (storedDecrypted, incoming) => {
    const base =
        storedDecrypted && typeof storedDecrypted === "object" && !Array.isArray(storedDecrypted)
            ? { ...storedDecrypted }
            : {};
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return base;
    for (const [key, val] of Object.entries(incoming)) {
        if (key === "useSit") {
            base.useSit = coerceHbUseSitIncoming(val);
            continue;
        }
        if (typeof val === "boolean") {
            base[key] = val;
            continue;
        }
        if (isMaskedOrEmptyCredentialValue(val)) continue;
        base[key] = val;
    }
    return base;
};

// ✅ Kullanıcının tüm pazaryeri entegrasyonlarını getir
// ✅ FIX #2: IDOR — req.user._id kullanılıyor
// ✅ FIX H5: Credential'lar decrypt edilerek döndürülüyor
exports.getUserMarketplaces = async (req, res) => {
    try {
        const marketplaces = await Marketplace.find({ userId: req.user._id });

        // Entegrasyon yoksa boş array döndür (404 yerine)
        if (!marketplaces || marketplaces.length === 0) {
            return res.status(200).json([]);
        }

        // 🛡️ FIX #9: Credential'ları maskeleyerek döndür — frontend'e tam credential gönderme
        // integrationHints: şifre sızdırmadan ürün yükleme önkoşulları (ör. N11 kargo şablonu)
        const maskedMarketplaces = marketplaces.map(mp => {
            const mpObj = mp.toObject();
            let integrationHints = {};
            const lowName = (mp.marketplaceName || "").trim().toLowerCase();

            if (mpObj.credentials) {
                try {
                    const decrypted = decryptCredentials(mpObj.credentials);
                    const masked = {};
                    for (const [key, value] of Object.entries(decrypted)) {
                        if (typeof value === "string" && value.length > 4) {
                            masked[key] = "••••••" + value.slice(-4);
                        } else {
                            masked[key] = value ? "••••" : "";
                        }
                    }
                    mpObj.credentials = masked;
                    mpObj.hasCredentials = true;

                    if (lowName === "n11") {
                        integrationHints = {
                            requiresShipmentTemplate: true,
                            shipmentTemplateConfigured: !!String(decrypted.shipmentTemplate || "").trim()
                        };
                    } else if (lowName === "trendyol") {
                        integrationHints = {
                            apiConfigured: !!(
                                decrypted.apiKey &&
                                decrypted.apiSecret &&
                                (decrypted.sellerId || decrypted.supplierId)
                            )
                        };
                    } else if (lowName === "hepsiburada") {
                        const mid = decrypted.merchantId || decrypted.sellerId;
                        const sec = decrypted.secretKey || decrypted.serviceKey || decrypted.apiSecret;
                        const useSit = coerceHbUseSitIncoming(decrypted.useSit);
                        integrationHints = {
                            apiConfigured: !!mid && !!sec,
                            useSit,
                            environment: useSit ? "SIT" : "PROD"
                        };
                    } else if (lowName === "çiçeksepeti" || lowName === "ciceksepeti") {
                        integrationHints = { apiConfigured: !!decrypted.apiKey };
                    }
                } catch {
                    mpObj.credentials = {};
                    mpObj.hasCredentials = false;
                    if (lowName === "n11") {
                        integrationHints = { requiresShipmentTemplate: true, shipmentTemplateConfigured: false };
                    }
                }
            } else if (lowName === "n11") {
                integrationHints = { requiresShipmentTemplate: true, shipmentTemplateConfigured: false };
            }

            mpObj.integrationHints = integrationHints;
            return mpObj;
        });

        res.status(200).json(maskedMarketplaces);
    } catch (error) {
        logger.error("Pazaryeri bilgileri alınırken hata", { error: error.message });
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ✅ Yeni pazaryeri ekleme veya güncelleme (POST)
// ✅ FIX #2: IDOR — body'deki userId yerine req.user._id
// ✅ FIX H5: Credential'lar encrypt edilerek kaydediliyor
exports.addMarketplace = async (req, res) => {
    try {
        const userId = req.user._id;
        const { marketplaceName, credentials } = req.body;

        // **Zorunlu alan kontrolü**
        if (!marketplaceName || !credentials || Object.keys(credentials).length === 0) {
            return res.status(400).json({ message: "❌ Lütfen tüm alanları doldurun! API bilgileri eksik olabilir." });
        }

        // Aynı kullanıcı ve pazaryeri için mevcut entegrasyon var mı kontrol et
        const existingMarketplace = await Marketplace.findOne({ userId, marketplaceName });

        let payloadToEncrypt = credentials;

        if (existingMarketplace) {
            let decrypted = {};
            try {
                decrypted = decryptCredentials(existingMarketplace.credentials);
            } catch (e) {
                logger.error("Pazaryeri credential decrypt hatası (güncelleme)", {
                    userId: String(userId),
                    marketplaceName,
                    error: e.message
                });
                return res.status(500).json({ message: "❌ Kayıtlı API bilgileri okunamadı. Destek ile iletişime geçin." });
            }
            payloadToEncrypt = mergeIncomingCredentialsWithStored(decrypted, credentials);
            if (!payloadToEncrypt || Object.keys(payloadToEncrypt).length === 0) {
                return res.status(400).json({
                    message: "❌ Güncelleme için geçerli API bilgisi kalmadı; en az bir alanı gerçek değeriyle gönderin."
                });
            }
        }

        let payloadForEncrypt = payloadToEncrypt;
        if (
            String(marketplaceName || "").trim().toLowerCase() === "hepsiburada" &&
            payloadForEncrypt &&
            typeof payloadForEncrypt === "object"
        ) {
            payloadForEncrypt = {
                ...payloadForEncrypt,
                useSit: coerceHbUseSitIncoming(payloadForEncrypt.useSit)
            };
        }

        const encryptedCreds = encryptCredentials(payloadForEncrypt);

        if (existingMarketplace) {
            // Mevcut entegrasyonu güncelle
            existingMarketplace.credentials = encryptedCreds;
            existingMarketplace.updatedAt = Date.now();
            await existingMarketplace.save();

            logger.info(`Mevcut entegrasyon güncellendi: ${marketplaceName} — kullanıcı: ${userId}`);
            return res.status(200).json({
                message: "✅ Entegrasyon güncellendi!",
                marketplace: existingMarketplace,
                isUpdate: true
            });
        }

        // Yeni entegrasyon oluştur
        const newMarketplace = new Marketplace({
            userId,
            marketplaceName,
            credentials: encryptedCreds
        });

        await newMarketplace.save();

        logger.info(`Yeni entegrasyon eklendi: ${marketplaceName} — kullanıcı: ${userId}`);
        res.status(201).json({
            message: "✅ Entegrasyon başarılı!",
            marketplace: newMarketplace,
            isUpdate: false
        });
    } catch (error) {
        logger.error("Pazaryeri eklenirken hata", { error: error.message });
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ✅ Pazaryeri Güncelleme (PUT)
// ✅ FIX H5: Credential'lar encrypt edilerek güncelleniyor
exports.updateMarketplace = async (req, res) => {
    try {
        const { credentials } = req.body;

        // Gerekli alanların kontrolü
        if (!credentials || Object.keys(credentials).length === 0) {
            return res.status(400).json({ message: "❌ Lütfen API bilgilerini doldurun!" });
        }

        const existing = await Marketplace.findOne({ _id: req.params.id, userId: req.user._id });
        if (!existing) {
            return res.status(404).json({ message: "❌ Pazaryeri bulunamadı veya yetkiniz yok!" });
        }

        let decrypted = {};
        try {
            decrypted = decryptCredentials(existing.credentials);
        } catch (e) {
            logger.error("Pazaryeri credential decrypt hatası (PUT)", {
                userId: String(req.user._id),
                id: String(req.params.id),
                error: e.message
            });
            return res.status(500).json({ message: "❌ Kayıtlı API bilgileri okunamadı." });
        }

        let merged = mergeIncomingCredentialsWithStored(decrypted, credentials);
        if (!merged || Object.keys(merged).length === 0) {
            return res.status(400).json({
                message: "❌ Geçerli API bilgisi kalmadı; maskeli/boş alanlar korunamadı."
            });
        }
        if (String(existing.marketplaceName || "").trim().toLowerCase() === "hepsiburada") {
            merged = { ...merged, useSit: coerceHbUseSitIncoming(merged.useSit) };
        }

        const encryptedCreds = encryptCredentials(merged);

        // ✅ FIX #4: IDOR kapatıldı — sadece kendi kaydını güncelleyebilir
        const updatedMarketplace = await Marketplace.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { credentials: encryptedCreds, updatedAt: Date.now() },
            { new: true }
        );

        if (!updatedMarketplace) {
            return res.status(404).json({ message: "❌ Pazaryeri bulunamadı veya yetkiniz yok!" });
        }

        logger.info(`Pazaryeri güncellendi: ${updatedMarketplace.marketplaceName} — kullanıcı: ${req.user._id}`);
        res.status(200).json({ message: "✅ Güncelleme başarılı!", marketplace: updatedMarketplace });
    } catch (error) {
        logger.error("Pazaryeri güncelleme hatası", { error: error.message });
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// ✅ Pazaryeri Silme (DELETE)
exports.deleteMarketplace = async (req, res) => {
    try {
        // ✅ FIX #4: IDOR kapatıldı — sadece kendi kaydını silebilir
        const deletedMarketplace = await Marketplace.findOneAndDelete({
            _id    : req.params.id,
            userId : req.user._id
        });

        if (!deletedMarketplace) {
            return res.status(404).json({ message: "❌ Pazaryeri bulunamadı veya yetkiniz yok!" });
        }

        const orphanAo = await AutoOrderConfig.deleteMany({
            user: req.user._id,
            marketplace: deletedMarketplace._id
        });
        if (orphanAo.deletedCount > 0) {
            logger.info(
                `Pazaryeri silindi — otomatik sipariş yetim config temizlendi: ${orphanAo.deletedCount} — kullanıcı: ${req.user._id}`
            );
        }

        logger.info(`Pazaryeri silindi: ${deletedMarketplace.marketplaceName} — kullanıcı: ${req.user._id}`);
        res.status(200).json({ message: "✅ Entegrasyon başarıyla silindi!" });
    } catch (error) {
        logger.error("Pazaryeri silme hatası", { error: error.message });
        res.status(500).json({ message: "❌ Sunucu hatası!" });
    }
};

// 🧪 Hepsiburada Credential Test (POST)
// Hepsiburada Auth: Basic base64(merchantId:secretKey) + User-Agent header
exports.testHepsiburadaCredentials = async (req, res) => {
    try {
        const { merchantId, secretKey, serviceKey, apiKey, userAgent } = req.body;

        // Geriye dönük uyumluluk: secretKey, serviceKey veya apiKey kabul et
        const actualSecretKey = secretKey || serviceKey || apiKey;
        const actualUserAgent = userAgent || "LysiaETIC";

        if (!merchantId || !actualSecretKey) {
            return res.status(400).json({
                success: false,
                message: "❌ Merchant ID ve Secret Key (Servis Anahtarı) gerekli!"
            });
        }

        const axios = require("axios");
        const { getAuthHeader, getEndpoints } = require("../services/hepsiburadaService");
        const authHeader = getAuthHeader(merchantId, actualSecretKey);

        // SIT/Production ortamına göre dinamik endpoint
        const useSit = req.body.useSit === true || req.body.useSit === "true";
        const ep = getEndpoints({ useSit });

        // Test endpoint: Listing API'den 1 ürün çekmeyi dene
        const testUrl = `${ep.LISTING}/listings/merchantid/${merchantId}?offset=0&limit=1`;

        try {
            const response = await axios.get(testUrl, {
                headers: {
                    "Authorization": authHeader,
                    "User-Agent": actualUserAgent,
                    "Content-Type": "application/json"
                },
                timeout: 10000
            });

            return res.status(200).json({
                success: true,
                message: "✅ Credential'lar geçerli!",
                status: response.status,
                endpoint: "listing-external.hepsiburada.com"
            });

        } catch (error) {
            logger.warn("Hepsiburada credential test failed", {
                status: error.response?.status,
                merchantId: merchantId.substring(0, 8) + "..."
            });

            // 401 = credentials hatalı, diğer hatalar farklı sebeplerden olabilir
            const isAuthError = error.response?.status === 401 || error.response?.status === 403;
            return res.status(200).json({
                success: false,
                message: isAuthError
                    ? "❌ Credential'lar geçersiz! Merchant ID ve Secret Key'i kontrol edin."
                    : `❌ API hatası (${error.response?.status || "bağlantı hatası"})`,
                error: {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    message: error.response?.data?.message || error.response?.data || error.message
                }
            });
        }

    } catch (error) {
        logger.error(`Hepsiburada test hatası: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "❌ Sunucu hatası!"
        });
    }
};
