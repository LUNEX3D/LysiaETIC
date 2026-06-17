const eInvoiceService = require("../services/eInvoiceService");
const qnbService = require("../services/qnbEInvoiceService");
const sovosService = require("../services/sovosEInvoiceService");
const sovosEArchiveService = require("../services/sovosEArchiveService");
const sovosEDespatchService = require("../services/sovosEDespatchService");
const sovosESmmService = require("../services/sovosESmmService");
const parasutService = require("../services/parasutEInvoiceService");
const odealService = require("../services/odealEInvoiceService");
const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const logger = require("../config/logger");

/**
 * E-FATURA CONTROLLER — LysiaETIC
 * Çoklu sağlayıcı desteği: Trendyol E-Faturam, QNB eSolutions, Sovos (Foriba), Paraşüt, Ödeal
 */

// ═══════════════════════════════════════════════════════════════════════════
//  TRENDYOL E-FATURAM
// ═══════════════════════════════════════════════════════════════════════════

// ─── Partner Login ──────────────────────────────────────────────────────────
exports.partnerLogin = async (req, res) => {
    try {
        const { username, password, env } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Kullanıcı adı ve şifre gerekli" });
        }

        const result = await eInvoiceService.partnerLogin({ username, password, env });
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[E-Fatura Controller] Partner login hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Customer Login ─────────────────────────────────────────────────────────
exports.customerLogin = async (req, res) => {
    try {
        const { partnerToken, customerUsername, customerPassword, env } = req.body;
        if (!partnerToken || !customerUsername || !customerPassword) {
            return res.status(400).json({ success: false, message: "Tüm alanlar gerekli" });
        }

        const result = await eInvoiceService.customerLogin({
            partnerToken, customerUsername, customerPassword, env
        });

        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[E-Fatura Controller] Customer login hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── E-Arşiv Oluştur ───────────────────────────────────────────────────────
exports.createEArchive = async (req, res) => {
    try {
        const { token, invoiceData, env } = req.body;
        if (!token || !invoiceData) {
            return res.status(400).json({ success: false, message: "Token ve fatura verisi gerekli" });
        }

        const result = await eInvoiceService.createEArchiveInvoice({ token, invoiceData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[E-Fatura Controller] E-Arşiv oluşturma hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── E-Arşiv Durum Sorgula ─────────────────────────────────────────────────
exports.getEArchiveStatus = async (req, res) => {
    try {
        const { token, env } = req.body;
        const { invoiceId } = req.params;
        if (!token || !invoiceId) {
            return res.status(400).json({ success: false, message: "Token ve fatura ID gerekli" });
        }

        const result = await eInvoiceService.getEArchiveStatus({ token, invoiceId, env });
        res.json(result);
    } catch (error) {
        logger.error("[E-Fatura Controller] E-Arşiv durum hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── E-Arşiv İptal ─────────────────────────────────────────────────────────
exports.cancelEArchive = async (req, res) => {
    try {
        const { token, env } = req.body;
        const { invoiceId } = req.params;
        if (!token || !invoiceId) {
            return res.status(400).json({ success: false, message: "Token ve fatura ID gerekli" });
        }

        const result = await eInvoiceService.cancelEArchiveInvoice({ token, invoiceId, env });
        res.json(result);
    } catch (error) {
        logger.error("[E-Fatura Controller] E-Arşiv iptal hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Giden E-Fatura Oluştur ─────────────────────────────────────────────────
exports.createOutgoingEInvoice = async (req, res) => {
    try {
        const { token, invoiceData, env } = req.body;
        if (!token || !invoiceData) {
            return res.status(400).json({ success: false, message: "Token ve fatura verisi gerekli" });
        }

        const result = await eInvoiceService.createOutgoingEInvoice({ token, invoiceData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[E-Fatura Controller] Giden e-Fatura hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Gelen E-Fatura Ara ─────────────────────────────────────────────────────
exports.searchIncomingEInvoices = async (req, res) => {
    try {
        const { token, searchParams, env } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token gerekli" });
        }

        const result = await eInvoiceService.searchIncomingEInvoices({
            token, searchParams: searchParams || {}, env
        });
        res.json(result);
    } catch (error) {
        logger.error("[E-Fatura Controller] Gelen e-Fatura arama hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── E-İrsaliye Oluştur ────────────────────────────────────────────────────
exports.createDespatchAdvice = async (req, res) => {
    try {
        const { token, despatchData, env } = req.body;
        if (!token || !despatchData) {
            return res.status(400).json({ success: false, message: "Token ve irsaliye verisi gerekli" });
        }

        const result = await eInvoiceService.createDespatchAdvice({ token, despatchData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[E-Fatura Controller] E-İrsaliye hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Mükellef Sorgula ──────────────────────────────────────────────────────
exports.getTaxpayers = async (req, res) => {
    try {
        const { token, env } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token gerekli" });
        }

        const result = await eInvoiceService.getTaxpayerList({ token, env });
        res.json(result);
    } catch (error) {
        logger.error("[E-Fatura Controller] Mükellef sorgu hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Firma Bilgileri ────────────────────────────────────────────────────────
exports.getCorporateInfo = async (req, res) => {
    try {
        const { token, env } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token gerekli" });
        }

        const result = await eInvoiceService.getCorporateInfo({ token, env });
        res.json(result);
    } catch (error) {
        logger.error("[E-Fatura Controller] Firma bilgi hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Belge Arama (Genel — Trendyol) ────────────────────────────────────────
exports.searchDocuments = async (req, res) => {
    try {
        const { token, searchParams, documentType, env } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token gerekli" });
        }

        const result = await eInvoiceService.searchDocuments({
            token, searchParams: searchParams || {}, documentType, env
        });
        res.json(result);
    } catch (error) {
        logger.error("[E-Fatura Controller] Belge arama hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  QNB eSolutions (SOAP API)
//  connectorService → e-Fatura & e-İrsaliye
//  EarsivWebService → e-Arşiv
//  userService      → Oturum (wsLogin / logout)
// ═══════════════════════════════════════════════════════════════════════════

// ─── QNB Login (SOAP wsLogin) ───────────────────────────────────────────────
// ✅ Başarılı login sonrası credential'lar AutoInvoiceConfig + User.companyInfo.qnb'ye kaydedilir.
//    Böylece kullanıcı frontend'den bağlandığında otomatik fatura da aynı credential'ı kullanır.
exports.qnbLogin = async (req, res) => {
    try {
        const { username, password, env, service } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Kullanıcı adı ve şifre gerekli" });
        }

        const result = await qnbService.login({ username, password, env, service });
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        // ── Başarılı login → credential'ları DB'ye kaydet ────────────────
        // Kullanıcı frontend'den QNB'ye bağlandığında, aynı credential'lar
        // otomatik fatura (AutoInvoiceConfig) tarafından da kullanılsın.
        if (req.user?._id) {
            const userId = req.user._id;
            const svc = service || "efatura";
            try {
                // 1. AutoInvoiceConfig güncelle
                const configUpdate = {
                    provider: "qnb",
                    "qnbCredentials.env": env || "test",
                    "sovosCredentials.username": "",
                    "sovosCredentials.password": "",
                    "sovosCredentials.vknTckn": "",
                    "sovosCredentials.senderIdentifier": "",
                    "sovosCredentials.receiverIdentifier": "",
                };
                if (svc === "earsiv") {
                    configUpdate["qnbCredentials.earsivUsername"] = username;
                    configUpdate["qnbCredentials.earsivPassword"] = password;
                } else {
                    configUpdate["qnbCredentials.efaturaUsername"] = username;
                    configUpdate["qnbCredentials.efaturaPassword"] = password;
                }
                await AutoInvoiceConfig.updateOne(
                    { userId },
                    { $set: configUpdate },
                    { upsert: true }
                );

                // 2. User.companyInfo.qnb güncelle
                const userUpdate = { "companyInfo.qnb.env": env || "test" };
                if (svc === "earsiv") {
                    userUpdate["companyInfo.qnb.earsivUsername"] = username;
                    userUpdate["companyInfo.qnb.earsivPassword"] = password;
                } else {
                    userUpdate["companyInfo.qnb.efaturaUsername"] = username;
                    userUpdate["companyInfo.qnb.efaturaPassword"] = password;
                }
                await User.updateOne({ _id: userId }, { $set: userUpdate });

                logger.info("[QNB Controller] Login credential'ları DB'ye kaydedildi — userId=" + userId + " service=" + svc + " user=" + username);
            } catch (dbErr) {
                // DB kayıt hatası login'i engellemez — sadece logla
                logger.warn("[QNB Controller] Credential DB kayıt hatası: " + dbErr.message);
            }
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[QNB Controller] Login hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Logout ─────────────────────────────────────────────────────────────
exports.qnbLogout = async (req, res) => {
    try {
        const { sessionId, env, service } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.logout({ sessionId, env, service });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Logout hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Fatura Kullanıcı Sorgula ────────────────────────────────────────
exports.qnbCheckUser = async (req, res) => {
    try {
        const { sessionId, vkn, env } = req.body;
        if (!sessionId || !vkn) {
            return res.status(400).json({ success: false, message: "Session ID ve VKN gerekli" });
        }

        const result = await qnbService.checkEInvoiceUser({ sessionId, vkn, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Kullanıcı sorgu hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Fatura Kullanıcı Bilgisi (detaylı) ──────────────────────────────
exports.qnbGetUserInfo = async (req, res) => {
    try {
        const { sessionId, vkn, env } = req.body;
        if (!sessionId || !vkn) {
            return res.status(400).json({ success: false, message: "Session ID ve VKN gerekli" });
        }

        const result = await qnbService.getEInvoiceUserInfo({ sessionId, vkn, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Kullanıcı bilgi hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Alıcı VKN/TCKN sorgu (otomatik doldurma) ───────────────────────────────
exports.lookupCustomer = async (req, res) => {
    try {
        const { provider, sessionId, token, vkn, env } = req.body;
        const vknClean = String(vkn || "").replace(/\D/g, "");
        if (!vknClean || (vknClean.length !== 10 && vknClean.length !== 11)) {
            return res.status(400).json({ success: false, message: "Geçerli VKN (10) veya TCKN (11) girin" });
        }

        const authType = String(provider || "").toLowerCase();
        const sid = sessionId || token;

        if (authType === "sovos") {
            const resolved = await resolveSovosSessionForRequest(req, sid);
            if (!resolved.sessionId) {
                return res.status(401).json({ success: false, message: resolved.error || "Sovos oturumu gerekli" });
            }
            const result = await sovosService.lookupCustomer({ sessionId: resolved.sessionId, vkn: vknClean });
            if (!result.success && result.rateLimited) {
                return res.status(429).json({ success: false, message: result.error || "Çok sık sorgu" });
            }
            const payload = { ...result };
            if (resolved.restored && result.success) {
                payload.sessionId = resolved.sessionId;
                payload.accessToken = resolved.sessionId;
            }
            return res.json(payload);
        }

        if (!sid) {
            return res.status(400).json({ success: false, message: "Oturum gerekli — sağlayıcıyı yeniden bağlayın" });
        }

        const result = await qnbService.lookupCustomer({ sessionId: sid, vkn: vknClean, env });
        res.json(result);
    } catch (error) {
        logger.error("[eInvoice] Alıcı sorgu hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Mükellef Etiket Listesi ────────────────────────────────────────────
exports.qnbGetEtiketList = async (req, res) => {
    try {
        const { sessionId, vkn, env } = req.body;
        if (!sessionId || !vkn) {
            return res.status(400).json({ success: false, message: "Session ID ve VKN gerekli" });
        }

        const result = await qnbService.getMukellefEtiketList({ sessionId, vkn, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Etiket listesi hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Fatura Numarası Üret ───────────────────────────────────────────────
exports.qnbGenerateInvoiceNo = async (req, res) => {
    try {
        const { sessionId, vkn, faturaKodu, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.generateInvoiceNumber({ sessionId, vkn, faturaKodu, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Fatura no üretme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Fatura Gönder ────────────────────────────────────────────────────
exports.qnbSendEInvoice = async (req, res) => {
    try {
        const { sessionId, invoiceXml, vkn, belgeTuru, belgeNo, env } = req.body;
        if (!sessionId || !invoiceXml) {
            return res.status(400).json({ success: false, message: "Session ID ve fatura XML'i gerekli" });
        }

        const result = await qnbService.sendEInvoice({ sessionId, invoiceXml, vkn, belgeTuru, belgeNo, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[QNB Controller] e-Fatura gönderme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Fatura Gönder (ERP Kodu ile — belgeGonderExt) ─────────────────────
exports.qnbSendEInvoiceExt = async (req, res) => {
    try {
        const { sessionId, invoiceXml, vkn, belgeTuru, belgeNo, env } = req.body;
        if (!sessionId || !invoiceXml) {
            return res.status(400).json({ success: false, message: "Session ID ve fatura XML'i gerekli" });
        }

        const result = await qnbService.sendEInvoiceExt({ sessionId, invoiceXml, vkn, belgeTuru, belgeNo, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[QNB Controller] e-Fatura (Ext) gönderme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Giden Belge Durum Sorgula (belgeOid) ──────────────────────────────
exports.qnbGetOutgoingStatus = async (req, res) => {
    try {
        const { sessionId, vkn, belgeOid, env } = req.body;
        if (!sessionId || !belgeOid) {
            return res.status(400).json({ success: false, message: "Session ID ve belge OID gerekli" });
        }

        const result = await qnbService.getOutgoingStatus({ sessionId, vkn, belgeOid, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Giden belge durum hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Giden Belge Durum Sorgula (ETTN) ───────────────────────────────────
exports.qnbGetOutgoingStatusByEttn = async (req, res) => {
    try {
        const { sessionId, vkn, ettn, env } = req.body;
        if (!sessionId || !ettn) {
            return res.status(400).json({ success: false, message: "Session ID ve ETTN gerekli" });
        }

        const result = await qnbService.getOutgoingStatusByEttn({ sessionId, vkn, ettn, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Giden belge durum (ETTN) hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Fatura Tarihçesi ───────────────────────────────────────────────────
exports.qnbGetInvoiceHistory = async (req, res) => {
    try {
        const { sessionId, vkn, ettn, faturaYonu, env } = req.body;
        if (!sessionId || !ettn) {
            return res.status(400).json({ success: false, message: "Session ID ve ETTN gerekli" });
        }

        const result = await qnbService.getInvoiceHistory({ sessionId, vkn, ettn, faturaYonu, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Fatura tarihçesi hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Giden Belgeleri Listele ────────────────────────────────────────────
exports.qnbListOutgoing = async (req, res) => {
    try {
        const { sessionId, vkn, searchParams, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.listOutgoingDocuments({ sessionId, vkn, searchParams: searchParams || {}, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Giden belge listeleme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Gelen Belgeleri Listele ────────────────────────────────────────────
exports.qnbListIncoming = async (req, res) => {
    try {
        const { sessionId, vkn, belgeTuru, sonSiraNo, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.listIncomingDocuments({ sessionId, vkn, belgeTuru, sonSiraNo, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Gelen belge listeleme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Gelen Belgeleri Al (İndir) ────────────────────────────────────────
exports.qnbFetchIncoming = async (req, res) => {
    try {
        const { sessionId, vkn, belgeTuru, sonSiraNo, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.fetchIncomingDocuments({ sessionId, vkn, belgeTuru, sonSiraNo, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Gelen belge alma hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Giden Belge İndir (belgeOid listesi) ──────────────────────────────
exports.qnbDownloadOutgoing = async (req, res) => {
    try {
        const { sessionId, vkn, belgeOidListesi, belgeTuru, belgeFormati, env } = req.body;
        if (!sessionId || !belgeOidListesi) {
            return res.status(400).json({ success: false, message: "Session ID ve belge OID listesi gerekli" });
        }

        const result = await qnbService.downloadOutgoingDocuments({ sessionId, vkn, belgeOidListesi, belgeTuru, belgeFormati, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Giden belge indirme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Gelen Belge İndir (ETTN listesi) ──────────────────────────────────
exports.qnbDownloadIncoming = async (req, res) => {
    try {
        const { sessionId, vkn, ettnler, belgeTuru, belgeFormati, env } = req.body;
        if (!sessionId || !ettnler) {
            return res.status(400).json({ success: false, message: "Session ID ve ETTN listesi gerekli" });
        }

        const result = await qnbService.downloadIncomingDocuments({ sessionId, vkn, ettnler, belgeTuru, belgeFormati, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Gelen belge indirme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Tek Belge İndir (ETTN ile — giden) ────────────────────────────────
exports.qnbDownloadOutgoingByEttn = async (req, res) => {
    try {
        const { sessionId, vkn, ettn, belgeTuru, belgeFormati, env } = req.body;
        if (!sessionId || !ettn) {
            return res.status(400).json({ success: false, message: "Session ID ve ETTN gerekli" });
        }

        const result = await qnbService.downloadOutgoingByEttn({ sessionId, vkn, ettn, belgeTuru, belgeFormati, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Giden belge indirme (ETTN) hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Tek Belge İndir (ETTN ile — gelen) ────────────────────────────────
exports.qnbDownloadIncomingByEttn = async (req, res) => {
    try {
        const { sessionId, vkn, ettn, belgeTuru, belgeFormati, env } = req.body;
        if (!sessionId || !ettn) {
            return res.status(400).json({ success: false, message: "Session ID ve ETTN gerekli" });
        }

        const result = await qnbService.downloadIncomingByEttn({ sessionId, vkn, ettn, belgeTuru, belgeFormati, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Gelen belge indirme (ETTN) hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Kontör Bilgisi ─────────────────────────────────────────────────────
exports.qnbGetKontorInfo = async (req, res) => {
    try {
        const { sessionId, vkn, kontorTipi, kontorBirimi, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.getKontorInfo({ sessionId, vkn, kontorTipi, kontorBirimi, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Kontör bilgisi hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Fatura Mail Gönder ─────────────────────────────────────────────────
exports.qnbSendInvoiceMail = async (req, res) => {
    try {
        const { sessionId, vkn, inOut, uuid, faturaNo, alicilar, belgeFormati, env } = req.body;
        if (!sessionId || !uuid || !alicilar) {
            return res.status(400).json({ success: false, message: "Session ID, UUID ve alıcılar gerekli" });
        }

        const result = await qnbService.sendInvoiceMail({ sessionId, vkn, inOut, uuid, faturaNo, alicilar, belgeFormati, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Fatura mail hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Belgeleri Alındı İşaretle ──────────────────────────────────────────
exports.qnbMarkReceived = async (req, res) => {
    try {
        const { sessionId, vkn, ettnList, belgeTuru, env } = req.body;
        if (!sessionId || !ettnList) {
            return res.status(400).json({ success: false, message: "Session ID ve ETTN listesi gerekli" });
        }

        const result = await qnbService.markDocumentsReceived({ sessionId, vkn, ettnList, belgeTuru, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Belge alındı işaretleme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-İrsaliye Kullanıcı Sorgula ──────────────────────────────────────
exports.qnbCheckDespatchUser = async (req, res) => {
    try {
        const { sessionId, vkn, env } = req.body;
        if (!sessionId || !vkn) {
            return res.status(400).json({ success: false, message: "Session ID ve VKN gerekli" });
        }

        const result = await qnbService.checkDespatchUser({ sessionId, vkn, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-İrsaliye kullanıcı sorgu hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB İrsaliye Numarası Üret ─────────────────────────────────────────────
exports.qnbGenerateDespatchNo = async (req, res) => {
    try {
        const { sessionId, vkn, irsaliyeKodu, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.generateDespatchNumber({ sessionId, vkn, irsaliyeKodu, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] İrsaliye no üretme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-İrsaliye Gönder ─────────────────────────────────────────────────
exports.qnbSendDespatch = async (req, res) => {
    try {
        const { sessionId, despatchXml, vkn, belgeNo, env } = req.body;
        if (!sessionId || !despatchXml) {
            return res.status(400).json({ success: false, message: "Session ID ve irsaliye XML'i gerekli" });
        }

        const result = await qnbService.sendDespatch({ sessionId, despatchXml, vkn, belgeNo, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[QNB Controller] e-İrsaliye gönderme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Fatura No Üret ────────────────────────────────────────────
exports.qnbGenerateEArchiveNo = async (req, res) => {
    try {
        const { sessionId, vkn, faturaKodu, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.generateEArchiveNumber({ sessionId, vkn, faturaKodu, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv fatura no hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Fatura Oluştur (XML ile) ───────────────────────────────────
exports.qnbCreateEArchive = async (req, res) => {
    try {
        const { sessionId, vkn, invoiceXml, sube, kasa, faturaTipi, env } = req.body;
        if (!sessionId || !invoiceXml) {
            return res.status(400).json({ success: false, message: "Session ID ve fatura XML'i gerekli" });
        }

        const result = await qnbService.createEArchiveInvoice({ sessionId, vkn, invoiceXml, sube, kasa, faturaTipi, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv oluşturma hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Fatura Oluştur (Form Verileri ile) ─────────────────────────
exports.qnbCreateEArchiveFromForm = async (req, res) => {
    try {
        const { sessionId, vkn, invoiceData, env } = req.body;
        if (!sessionId || !invoiceData) {
            return res.status(400).json({ success: false, message: "Session ID ve fatura verileri gerekli" });
        }
        if (!invoiceData.lines || invoiceData.lines.length === 0) {
            return res.status(400).json({ success: false, message: "En az bir fatura kalemi gerekli" });
        }
        if (!invoiceData.supplier || !invoiceData.supplier.vkn) {
            return res.status(400).json({ success: false, message: "Satıcı VKN bilgisi gerekli" });
        }
        if (!invoiceData.customer || (!invoiceData.customer.vkn && !invoiceData.customer.name)) {
            return res.status(400).json({ success: false, message: "Alıcı bilgileri gerekli" });
        }

        const result = await qnbService.createEArchiveFromForm({ sessionId, vkn, invoiceData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        try {
            await saveManualInvoiceRecord(req.user._id, {
                invoiceData,
                result,
                provider: "qnb",
                env: env || "test",
            });
        } catch (saveErr) {
            logger.warn("[QNB Controller] Manuel fatura DB kaydı başarısız: " + saveErr.message);
        }

        res.json({
            success: true,
            data: {
                ...result,
                message: "e-Arşiv fatura başarıyla oluşturuldu"
            }
        });
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv form oluşturma hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Fatura Oluştur (ERP Kodu ile — faturaOlusturExt) ─────────────
exports.qnbCreateEArchiveExt = async (req, res) => {
    try {
        const { sessionId, vkn, invoiceXml, sube, kasa, faturaTipi, faturaSeri, env } = req.body;
        if (!sessionId || !invoiceXml) {
            return res.status(400).json({ success: false, message: "Session ID ve fatura XML'i gerekli" });
        }

        const result = await qnbService.createEArchiveInvoiceExt({ sessionId, vkn, invoiceXml, sube, kasa, faturaTipi, faturaSeri, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv (Ext) oluşturma hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Fatura Sorgula ────────────────────────────────────────────
exports.qnbQueryEArchive = async (req, res) => {
    try {
        const { sessionId, vkn, uuid, faturaNo, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.queryEArchiveInvoice({ sessionId, vkn, uuid, faturaNo, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv sorgu hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Fatura Listele ────────────────────────────────────────────
exports.qnbListEArchive = async (req, res) => {
    try {
        const { sessionId, vkn, searchParams, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.listEArchiveInvoices({ sessionId, vkn, searchParams: searchParams || {}, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv listeleme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Fatura İptal ──────────────────────────────────────────────
exports.qnbCancelEArchive = async (req, res) => {
    try {
        const { sessionId, vkn, uuid, faturaNo, env } = req.body;
        if (!sessionId || (!uuid && !faturaNo)) {
            return res.status(400).json({ success: false, message: "Session ID ve UUID veya fatura numarası gerekli" });
        }

        const result = await qnbService.cancelEArchiveInvoice({ sessionId, vkn, uuid, faturaNo, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv iptal hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Önizleme ──────────────────────────────────────────────────
exports.qnbPreviewEArchive = async (req, res) => {
    try {
        const { sessionId, vkn, invoiceXml, env } = req.body;
        if (!sessionId || !invoiceXml) {
            return res.status(400).json({ success: false, message: "Session ID ve fatura XML'i gerekli" });
        }

        const result = await qnbService.previewEArchiveInvoice({ sessionId, vkn, invoiceXml, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv önizleme hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv ZIP İndir ─────────────────────────────────────────────────
exports.qnbDownloadEArchiveZip = async (req, res) => {
    try {
        const { sessionId, vkn, uuid, faturaNo, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.downloadEArchiveZip({ sessionId, vkn, uuid, faturaNo, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv ZIP hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv E-Posta Gönder ────────────────────────────────────────────
exports.qnbSendEArchiveEmail = async (req, res) => {
    try {
        const { sessionId, vkn, uuid, faturaNo, ilaveEposta, tanimliEpostayaGonder, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.sendEArchiveEmail({ sessionId, vkn, uuid, faturaNo, ilaveEposta, tanimliEpostayaGonder, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv e-posta hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv SMS Gönder ────────────────────────────────────────────────
exports.qnbSendEArchiveSms = async (req, res) => {
    try {
        const { sessionId, vkn, uuid, faturaNo, ilaveTelefonNo, tanimliTelefonNoyaGonder, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        const result = await qnbService.sendEArchiveSms({ sessionId, vkn, uuid, faturaNo, ilaveTelefonNo, tanimliTelefonNoyaGonder, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv SMS hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Belge Arama (Genel) ────────────────────────────────────────────────
exports.qnbSearchDocuments = async (req, res) => {
    try {
        const { sessionId, vkn, searchParams, documentType, env } = req.body;
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID gerekli" });
        }

        logger.info(`[QNB Search] type=${documentType}, vkn=${vkn}, params=${JSON.stringify(searchParams || {})}`);

        const result = await qnbService.searchDocuments({
            sessionId, vkn, searchParams: searchParams || {}, documentType, env
        });

        logger.info(`[QNB Search] type=${documentType}, success=${result.success}, hasData=${!!result.data}, dataType=${typeof result.data}`);
        if (result.data) {
            const d = result.data;
            const preview = typeof d === "string" ? d.substring(0, 200) : JSON.stringify(d).substring(0, 300);
            logger.info(`[QNB Search] type=${documentType}, dataPreview=${preview}`);
        }

        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Belge arama hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Servis Durumu ──────────────────────────────────────────────────────
exports.qnbCheckServiceStatus = async (req, res) => {
    try {
        const { env } = req.body;
        const result = await qnbService.checkServiceStatus({ env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Servis durum hatası: " + error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  SOVOS (Foriba)
// ═══════════════════════════════════════════════════════════════════════════

const getSovosCredentialsForUser = async (userId) => {
    if (!userId) return null;
    const config = await AutoInvoiceConfig.findOne({ userId }).select("sovosCredentials");
    const creds = config?.sovosCredentials;
    if (!creds?.username || !creds?.password || !creds?.vknTckn) {
        return null;
    }
    return creds;
};

const resolveSovosSessionForRequest = async (req, sessionId) => {
    const creds = await getSovosCredentialsForUser(req.user?._id);
    return sovosService.resolveSessionId(sessionId, creds);
};

/** getPartialUserList toplu liste indirimi içindir; normal mükellef sorgusunda kullanılmamalı */
const rejectUnsafeSovosPartialUserList = (req, res) => {
    const role = (req.user?.role || "").toLowerCase();
    const bulkEnabled = process.env.SOVOS_ALLOW_BULK_USER_LIST === "true";
    const names = Array.isArray(req.body?.fileNameList) ? req.body.fileNameList : [];
    const hasFileNames = names.some((f) => String(f || "").trim());

    if (!bulkEnabled) {
        return res.status(403).json({
            success: false,
            message:
                "getPartialUserList devre dışı. Tekil alıcı sorgusu için POST /api/e-invoice/sovos/customer/lookup kullanın " +
                "(getRAWUserList). Toplu liste indirimi gerekirse SOVOS_ALLOW_BULK_USER_LIST=true ayarlayın.",
        });
    }

    if (!["admin", "dev"].includes(role)) {
        return res.status(403).json({
            success: false,
            message: "Toplu kullanıcı listesi indirimi yalnızca admin hesapları tarafından kullanılabilir.",
        });
    }

    if (!hasFileNames) {
        return res.status(400).json({
            success: false,
            message: "fileNameList zorunludur (ör. GB_USER_LIST_ZIP_PART_1). Boş çağrılar Sovos tarafından hatalı sayılır.",
        });
    }

    return null;
};

// ─── Sovos OAuth Token (legacy alias → WS login) ─────────────────────────────
exports.sovosGetToken = async (req, res) => {
    return exports.sovosLogin(req, res);
};

// ─── Sovos Bulut e-Fatura WS Login ───────────────────────────────────────────
exports.sovosLogin = async (req, res) => {
    try {
        const {
            username,
            password,
            vknTckn,
            senderIdentifier,
            receiverIdentifier,
            branch,
            faturaKodu,
            env,
            loginMode,
            serviceMode,
            // legacy OAuth field names
            apiKey,
            apiSecret,
        } = req.body;

        const wsUser = String(username || apiKey || "").trim();
        const wsPass = password != null && String(password).length ? String(password) : String(apiSecret || "");
        const gbEtiketi = String(senderIdentifier || "").trim();
        const mode = String(loginMode || serviceMode || "auto").toLowerCase();

        if (!wsUser || !wsPass || !vknTckn) {
            return res.status(400).json({
                success: false,
                message: "Web servis kullanıcı adı, şifre ve VKN/TCKN gerekli",
            });
        }

        if (mode === "efatura" && !gbEtiketi) {
            return res.status(400).json({
                success: false,
                message: "e-Fatura bağlantısı için GB etiketi gerekli",
            });
        }

        const vknClean = String(vknTckn).replace(/\D/g, "");
        if (vknClean.length !== 10 && vknClean.length !== 11) {
            return res.status(400).json({
                success: false,
                message: "VKN/TCKN 10 veya 11 haneli olmalıdır",
            });
        }

        const result = await sovosService.login({
            username: wsUser,
            password: wsPass,
            vknTckn: vknClean,
            senderIdentifier: gbEtiketi,
            receiverIdentifier: String(receiverIdentifier || "").trim(),
            branch: String(branch || "default").trim() || "default",
            faturaKodu: String(faturaKodu || "").trim(),
            env,
            loginMode: mode,
        });

        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        if (req.user?._id) {
            const userId = req.user._id;
            try {
                await AutoInvoiceConfig.updateOne(
                    { userId },
                    {
                        $set: {
                            provider: "sovos",
                            "sovosCredentials.username": wsUser,
                            "sovosCredentials.password": wsPass,
                            "sovosCredentials.vknTckn": vknClean,
                            "sovosCredentials.senderIdentifier": senderIdentifier,
                            "sovosCredentials.receiverIdentifier": receiverIdentifier || "",
                            "sovosCredentials.branch": String(branch || "default").trim() || "default",
                            "sovosCredentials.env": env || "test",
                            "sovosCredentials.capabilities": result.capabilities || { efatura: false, earsiv: false },
                            "sovosCredentials.verifiedAt": new Date(),
                            "qnbCredentials.username": "",
                            "qnbCredentials.password": "",
                            "qnbCredentials.earsivUsername": "",
                            "qnbCredentials.earsivPassword": "",
                            "qnbCredentials.efaturaUsername": "",
                            "qnbCredentials.efaturaPassword": "",
                        },
                    },
                    { upsert: true }
                );
                if (faturaKodu) {
                    await AutoInvoiceConfig.updateOne(
                        { userId },
                        { $set: { invoiceSeriesCode: String(faturaKodu).slice(0, 3).toUpperCase() } }
                    );
                }
                await User.updateOne(
                    { _id: userId },
                    {
                        $set: {
                            "companyInfo.qnb.earsivUsername": "",
                            "companyInfo.qnb.earsivPassword": "",
                            "companyInfo.qnb.efaturaUsername": "",
                            "companyInfo.qnb.efaturaPassword": "",
                        },
                    }
                );
                logger.info("[Sovos Controller] WS credential'ları DB'ye kaydedildi — userId=" + userId);
            } catch (dbErr) {
                logger.warn("[Sovos Controller] Credential DB kayıt hatası: " + dbErr.message);
            }
        }

        res.json({
            success: true,
            message: result.warning,
            data: {
                sessionId: result.sessionId,
                accessToken: result.accessToken,
                env: result.env,
                vknTckn: result.vknTckn,
                senderIdentifier: result.senderIdentifier,
                capabilities: result.capabilities,
                verifiedVia: result.verifiedVia,
            },
        });
    } catch (error) {
        logger.error("[Sovos Controller] Login hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos oturumu DB'den yenile ─────────────────────────────────────────────
exports.sovosRestoreSession = async (req, res) => {
    try {
        const creds = await getSovosCredentialsForUser(req.user?._id);
        if (!creds) {
            return res.status(404).json({ success: false, message: "Kayıtlı Sovos bağlantı bilgisi bulunamadı" });
        }

        const result = await sovosService.restoreSession(creds);
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            data: {
                sessionId: result.sessionId,
                accessToken: result.accessToken,
                env: result.env,
                vknTckn: result.vknTckn,
                senderIdentifier: result.senderIdentifier,
            },
        });
    } catch (error) {
        logger.error("[Sovos Controller] Oturum yenileme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos mükellef sorgu ────────────────────────────────────────────────────
exports.sovosQueryTaxpayer = async (req, res) => {
    try {
        const { sessionId, token, filterVknTckn, role } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosService.queryTaxpayer({
            sessionId: resolved.sessionId,
            filterVknTckn,
            role: role || "PK",
        });
        if (!result.success && result.rateLimited) {
            return res.status(429).json({ success: false, message: result.error });
        }
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] Mükellef sorgu hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Logout ────────────────────────────────────────────────────────────
exports.sovosLogout = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const result = await sovosService.logout({ sessionId });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] Logout hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Belge Gönder ─────────────────────────────────────────────────────
exports.sovosSendDocument = async (req, res) => {
    try {
        const {
            sessionId,
            token,
            docType,
            docDataBase64,
            ublXml,
            fileName,
            receiverIdentifier,
            senderIdentifier,
            parameters,
        } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        if (!docDataBase64 && !ublXml) {
            return res.status(400).json({ success: false, message: "Belge verisi gerekli (docDataBase64 veya ublXml)" });
        }

        const result = await sovosService.sendUBL({
            sessionId: resolved.sessionId,
            docType,
            docDataBase64,
            ublXml,
            fileName,
            receiverIdentifier,
            senderIdentifier,
            parameters,
        });
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Sovos Controller] Belge gönderme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Belge Durumu ─────────────────────────────────────────────────────
exports.sovosGetDocumentStatus = async (req, res) => {
    try {
        const { sessionId, token, includeDocData } = req.body;
        const { referenceId } = req.params;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId || !referenceId) {
            return res.status(400).json({ success: false, message: "Oturum ve UUID gerekli" });
        }

        const result = await sovosService.getEnvelopeStatus({
            sessionId: resolved.sessionId,
            uuid: referenceId,
            includeDocData: Boolean(includeDocData),
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] Belge durum hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos UBL İndir ─────────────────────────────────────────────────────────
exports.sovosDownloadDocument = async (req, res) => {
    try {
        const { sessionId, token, uuid, uuids, docType, type, identifierKey, parameters } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosService.getUBL({
            sessionId: resolved.sessionId,
            uuid,
            uuids,
            docType,
            type,
            identifierKey,
            parameters,
        });
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] UBL indirme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Fatura Görüntü (PDF/HTML) ─────────────────────────────────────────
exports.sovosViewDocument = async (req, res) => {
    try {
        const { sessionId, token, uuid, custInvId, type, viewFormat, identifierKey } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosService.getInvoiceView({
            sessionId: resolved.sessionId,
            uuid,
            custInvId,
            type,
            viewFormat,
            identifierKey,
        });
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] Fatura görüntü hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Uygulama Yanıtları ─────────────────────────────────────────────────
exports.sovosGetInvoiceResponses = async (req, res) => {
    try {
        const { sessionId, token, uuid, uuids, type, identifierKey, parameters, includeDocData } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosService.getInvResponses({
            sessionId: resolved.sessionId,
            uuid,
            uuids,
            type,
            identifierKey,
            parameters,
            includeDocData,
        });
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] Uygulama yanıtı hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

const validateSovosEArchiveForm = (invoiceData) => {
    if (!invoiceData) return "Fatura verileri gerekli";
    if (!invoiceData.lines || invoiceData.lines.length === 0) return "En az bir fatura kalemi gerekli";
    if (!invoiceData.supplier || !invoiceData.supplier.vkn) return "Satıcı VKN bilgisi gerekli";
    if (!invoiceData.customer || (!invoiceData.customer.vkn && !invoiceData.customer.name)) {
        return "Alıcı bilgileri gerekli";
    }
    return null;
};

const saveManualInvoiceRecord = async (userId, { invoiceData, result, provider, env, profileId = "EARSIVFATURA", direction = "outgoing" }) => {
    if (!userId || !result?.uuid || !result?.invoiceNumber) return null;

    const custInvId = String(
        invoiceData?.custInvId ||
        invoiceData?.orderNumber ||
        invoiceData?.trackingNumber ||
        ""
    ).trim();

    const existing = await Invoice.findOne({ userId, uuid: result.uuid }).lean();
    if (existing) return existing;

    const config = await AutoInvoiceConfig.findOne({ userId }).lean();
    const supplier = invoiceData?.supplier || config?.supplier || {};
    const customer = invoiceData?.customer || {};

    const invoice = await Invoice.create({
        userId,
        invoiceNumber: result.invoiceNumber,
        uuid: result.uuid,
        envUuid: result.envUuid || "",
        custInvId,
        orderNumber: custInvId,
        profileId,
        direction,
        invoiceTypeCode: invoiceData?.invoiceTypeCode || "SATIS",
        issueDate: invoiceData?.issueDate ? new Date(invoiceData.issueDate) : new Date(),
        currency: invoiceData?.currency || "TRY",
        provider,
        env: env || "test",
        supplier: {
            vkn: supplier.vkn || "",
            name: supplier.name || "",
            taxOffice: supplier.taxOffice || "",
        },
        customer: {
            vkn: customer.vkn || "",
            name: customer.name || customer.firstName
                ? [customer.firstName, customer.lastName].filter(Boolean).join(" ")
                : "",
            taxOffice: customer.taxOffice || "",
        },
        totals: result.totals || {},
        lines: (invoiceData?.lines || []).map((line) => ({
            name: line.name || "",
            quantity: line.quantity || 1,
            unit: line.unit || "adet",
            unitPrice: line.unitPrice || 0,
            vatRate: line.vatRate || 20,
            discountAmount: line.discountAmount || 0,
            lineTotal: line.lineTotal || ((line.quantity || 1) * (line.unitPrice || 0)),
            vatAmount: line.vatAmount || 0,
        })),
        status: "sent",
        createdBy: "manual",
        faturaURL: result.faturaURL || "",
        note: invoiceData?.note || "",
    });

    return invoice;
};

// ─── Sovos e-Arşiv Gönder ──────────────────────────────────────────────────
exports.sovosSendEArchive = async (req, res) => {
    try {
        const { sessionId, token, vkn, invoiceData, branch } = req.body;
        const formError = validateSovosEArchiveForm(invoiceData);
        if (formError) {
            return res.status(400).json({ success: false, message: formError });
        }

        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosEArchiveService.createEArchiveFromForm({
            sessionId: resolved.sessionId,
            vkn,
            invoiceData,
            branch,
        });

        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error || "e-Arşiv gönderilemedi" });
        }

        try {
            const config = await AutoInvoiceConfig.findOne({ userId: req.user._id }).lean();
            await saveManualInvoiceRecord(req.user._id, {
                invoiceData,
                result,
                provider: "sovos",
                env: config?.sovosCredentials?.env || "test",
            });
        } catch (saveErr) {
            logger.warn("[Sovos Controller] Manuel fatura DB kaydı başarısız: " + saveErr.message);
        }

        const response = {
            success: true,
            data: {
                uuid: result.uuid,
                invoiceNumber: result.invoiceNumber,
                custInvId: result.custInvId || "",
                totals: result.totals,
                faturaURL: result.faturaURL,
                message: "e-Arşiv fatura başarıyla oluşturuldu",
            },
        };
        if (resolved.restored) {
            response.sessionId = resolved.sessionId;
            response.accessToken = resolved.sessionId;
        }
        res.json(response);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv gönderme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-Arşiv Oluştur (Form — QNB uyumlu yanıt) ───────────────────────
exports.sovosCreateEArchiveFromForm = exports.sovosSendEArchive;

// ─── Sovos e-Fatura Oluştur (Form) ───────────────────────────────────────────
exports.sovosCreateEInvoiceFromForm = async (req, res) => {
    try {
        const { sessionId, token, invoiceData, receiverIdentifier, profileId } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const pk = String(receiverIdentifier || invoiceData?.receiverIdentifier || "").trim();
        const result = await sovosService.createEInvoiceFromForm({
            sessionId: resolved.sessionId,
            invoiceData,
            receiverIdentifier: pk,
            profileId: profileId || "TICARIFATURA",
        });

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error || "e-Fatura gönderilemedi" });
        }

        try {
            const config = await AutoInvoiceConfig.findOne({ userId: req.user._id }).lean();
            await saveManualInvoiceRecord(req.user._id, {
                invoiceData,
                result,
                provider: "sovos",
                env: config?.sovosCredentials?.env || "test",
                profileId: profileId || "TICARIFATURA",
            });
        } catch (saveErr) {
            logger.warn("[Sovos Controller] Manuel e-Fatura DB kaydı başarısız: " + saveErr.message);
        }

        const response = {
            success: true,
            data: {
                uuid: result.uuid,
                invoiceNumber: result.invoiceNumber,
                totals: result.totals,
                message: "e-Fatura başarıyla gönderildi",
            },
        };
        if (resolved.restored) {
            response.sessionId = resolved.sessionId;
            response.accessToken = resolved.sessionId;
        }
        res.json(response);
    } catch (error) {
        logger.error("[Sovos Controller] e-Fatura oluşturma hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Gelen e-Fatura Kabul / Red ────────────────────────────────────────
exports.sovosRespondToInvoice = async (req, res) => {
    try {
        const {
            sessionId,
            token,
            invoiceNumber,
            invoiceIssueDate,
            responseCode,
            counterpartyVkn,
            counterpartyName,
            counterpartyGb,
            ourParty,
        } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosService.sendApplicationResponse({
            sessionId: resolved.sessionId,
            invoiceNumber,
            invoiceIssueDate,
            responseCode,
            counterpartyVkn,
            counterpartyName,
            counterpartyGb,
            ourParty,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        const payload = {
            success: true,
            data: {
                uuid: result.uuid,
                responseCode: result.responseCode,
                invoiceNumber: result.invoiceNumber,
                message: result.responseCode === "KABUL" ? "Fatura kabul edildi" : "Fatura reddedildi",
            },
        };
        if (resolved.restored) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] Uygulama yanıtı hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-Arşiv Durum ───────────────────────────────────────────────────
exports.sovosGetEArchiveStatus = async (req, res) => {
    try {
        const { sessionId, token, vkn, uuid, invoiceNumber, custInvID, custInvId, orderNumber } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosEArchiveService.getStatus({
            sessionId: resolved.sessionId,
            vkn,
            uuid,
            invoiceNumber,
            custInvID,
            custInvId,
            orderNumber,
        });

        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv durum hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-Arşiv Listele ─────────────────────────────────────────────────
exports.sovosListEArchive = async (req, res) => {
    try {
        const { sessionId, token, vkn, startDate, endDate, receiverId } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosEArchiveService.detailedInvoiceQuery({
            sessionId: resolved.sessionId,
            vkn,
            startDate,
            endDate,
            receiverId,
        });

        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv listeleme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-Arşiv Önizleme (HTML/PDF) ─────────────────────────────────────
exports.sovosPreviewEArchive = async (req, res) => {
    try {
        const { sessionId, token, vkn, uuid, invoiceNumber, custInvID, custInvId, orderNumber, outputType } = req.body;
        if (!uuid && !invoiceNumber && !custInvID && !custInvId && !orderNumber) {
            return res.status(400).json({
                success: false,
                message: "UUID, fatura numarası veya müşteri fatura ID (sipariş no) gerekli",
            });
        }

        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const format = String(outputType || "HTML").toUpperCase();
        const result = await sovosEArchiveService.getInvoiceDocument({
            sessionId: resolved.sessionId,
            vkn,
            uuid,
            invoiceNumber,
            custInvID,
            custInvId,
            orderNumber,
            outputType: format,
        });

        if (!result.success || !result.data?.base64) {
            return res.status(404).json({
                success: false,
                message: result.error || "Sovos e-Arşiv belgesi alınamadı",
            });
        }

        const buf = Buffer.from(result.data.base64, "base64");
        if (format === "PDF" || result.data.contentType === "application/pdf") {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", "inline; filename=\"fatura.pdf\"");
            return res.send(buf);
        }

        const html = buf.toString("utf8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv önizleme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-Arşiv İptal ───────────────────────────────────────────────────
exports.sovosCancelEArchive = async (req, res) => {
    try {
        const {
            sessionId, token, vkn, invoiceNumber, totalAmount, branch,
            custInvID, custInvId, orderNumber, uuid, cancelDate,
        } = req.body;
        if (!invoiceNumber) {
            return res.status(400).json({ success: false, message: "Fatura numarası gerekli" });
        }
        if (!(Number(totalAmount) > 0)) {
            return res.status(400).json({ success: false, message: "Geçerli totalAmount gerekli" });
        }

        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosEArchiveService.cancelInvoice({
            sessionId: resolved.sessionId,
            vkn,
            invoiceNumber,
            uuid,
            totalAmount,
            cancelDate,
            branch,
            custInvID,
            custInvId,
            orderNumber,
        });

        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv iptal hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos API Durumu ───────────────────────────────────────────────────────
exports.sovosCheckStatus = async (req, res) => {
    try {
        const { sessionId, token } = req.body;
        const sid = sessionId || token;
        if (!sid) {
            return res.status(400).json({ success: false, message: "Oturum gerekli" });
        }

        const result = await sovosService.checkApiStatus({ sessionId: sid });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] API durum hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Belge Arama ─────────────────────────────────────────────────────
exports.sovosSearchDocuments = async (req, res) => {
    try {
        const { sessionId, token, searchParams, documentType, env } = req.body;
        const sid = sessionId || token;
        const resolved = await resolveSovosSessionForRequest(req, sid);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }

        const result = await sovosService.searchDocuments({
            sessionId: resolved.sessionId,
            searchParams: searchParams || {},
            documentType,
            env,
        });

        if (result.inactiveModule && result.capabilityKey && req.user?._id) {
            await AutoInvoiceConfig.updateOne(
                { userId: req.user._id },
                { $set: { [`sovosCredentials.capabilities.${result.capabilityKey}`]: false } }
            ).catch(() => {});
            sovosService.patchSessionCapabilities(resolved.sessionId, { [result.capabilityKey]: false });
        }

        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] Belge arama hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-Arşiv Rapor & İmzalı Belge ────────────────────────────────────
exports.sovosGetEArchiveReportList = async (req, res) => {
    try {
        const { sessionId, token, vkn, startDate, endDate, approved } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.getReportList({
            sessionId: resolved.sessionId,
            vkn,
            startDate,
            endDate,
            approved,
        });
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv rapor listesi hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosGetEArchiveReportData = async (req, res) => {
    try {
        const { sessionId, token, vkn, reportId, uuid, reportUuid } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.getReportData({
            sessionId: resolved.sessionId,
            vkn,
            uuid: uuid || reportUuid || reportId,
        });
        if (!result.success || !result.data?.base64) {
            return res.status(404).json({ success: false, message: result.error || "Rapor alınamadı" });
        }
        const buf = Buffer.from(result.data.base64, "base64");
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", "attachment; filename=\"earsiv-rapor-" + String(uuid || reportUuid || reportId).slice(0, 12) + ".zip\"");
        return res.send(buf);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv rapor indirme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosGetSignedEArchive = async (req, res) => {
    try {
        const { sessionId, token, vkn, uuid, invoiceNumber, custInvID, custInvId, orderNumber } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.getSignedInvoice({
            sessionId: resolved.sessionId,
            vkn,
            uuid,
            invoiceNumber,
            custInvID,
            custInvId,
            orderNumber,
        });
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] İmzalı e-Arşiv hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-İrsaliye ────────────────────────────────────────────────────────
exports.sovosDespatchSearch = async (req, res) => {
    try {
        const { sessionId, token, searchParams, documentType } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEDespatchService.searchDocuments({
            sessionId: resolved.sessionId,
            documentType: documentType || "despatch-advice",
            searchParams: searchParams || {},
        });
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] e-İrsaliye arama hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosDespatchView = async (req, res) => {
    try {
        const { sessionId, token, uuid, custInvId, type, viewFormat, identifierKey } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEDespatchService.getDesView({
            sessionId: resolved.sessionId,
            uuid,
            custInvId,
            type,
            viewFormat,
            identifierKey,
        });
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-İrsaliye görüntü hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosDespatchDownload = async (req, res) => {
    try {
        const { sessionId, token, uuid, type, identifierKey } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEDespatchService.getDesUBL({
            sessionId: resolved.sessionId,
            uuid,
            type,
            identifierKey,
        });
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-İrsaliye indirme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-SMM ───────────────────────────────────────────────────────────
exports.sovosSmmSend = async (req, res) => {
    try {
        const { sessionId, token, uuid, documentBase64, branch, viewType, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        if (!documentBase64) {
            return res.status(400).json({ success: false, message: "documentBase64 (SMM XML zip) gerekli" });
        }
        const result = await sovosESmmService.sendDocument({
            sessionId: resolved.sessionId,
            uuid,
            zipBuffer: Buffer.from(documentBase64, "base64"),
            branch,
            viewType,
            parameters,
        });
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] e-SMM gönderme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosSmmGetDocument = async (req, res) => {
    try {
        const { sessionId, token, uuid, documentId, custDocId, viewType, docType } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosESmmService.getDocument({
            sessionId: resolved.sessionId,
            uuid,
            documentId,
            custDocId,
            viewType,
            docType,
        });
        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-SMM belge hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosSmmCancel = async (req, res) => {
    try {
        const { sessionId, token, uuid, documentId, branch, cancelDate, totalAmount } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosESmmService.cancelDocument({
            sessionId: resolved.sessionId,
            uuid,
            documentId,
            branch,
            cancelDate,
            totalAmount,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-SMM iptal hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosSmmReportList = async (req, res) => {
    try {
        const { sessionId, token, startDate, endDate, approved } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosESmmService.getReportList({
            sessionId: resolved.sessionId,
            startDate,
            endDate,
            approved,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-SMM rapor listesi hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosEArchiveActionService = async (req, res) => {
    try {
        const { sessionId, token, senderId, branch, invoiceId, actionType, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.actionService({
            sessionId: resolved.sessionId,
            senderId,
            branch,
            invoiceId,
            actionType,
            parameters,
        });
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv actionService hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosSendEnvelope = async (req, res) => {
    try {
        const { sessionId, token, senderId, receiverId, zipBase64, fileName, hash, branch, outputType } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        if (!zipBase64) {
            return res.status(400).json({ success: false, message: "zipBase64 gerekli" });
        }
        const result = await sovosEArchiveService.sendEnvelope({
            sessionId: resolved.sessionId,
            senderId,
            receiverId,
            zipBuffer: Buffer.from(zipBase64, "base64"),
            fileName,
            hash,
            branch,
            outputType,
        });
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] sendEnvelope hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosRetriggerOperation = async (req, res) => {
    try {
        const { sessionId, token, vkn, branch, invoiceId, invoiceUUID, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.retriggerOperation({
            sessionId: resolved.sessionId,
            vkn,
            branch,
            invoiceId,
            invoiceUUID,
            parameters,
        });
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] retriggerOperation hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosSmmActionService = async (req, res) => {
    try {
        const { sessionId, token, senderId, branch, documentId, actionType, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosESmmService.actionService({
            sessionId: resolved.sessionId,
            senderId,
            branch,
            documentId,
            actionType,
            parameters,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-SMM actionService hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosGetEArchiveReportStatus = async (req, res) => {
    try {
        const { sessionId, token, vkn, uuid, reportUuid } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.getReportStatus({
            sessionId: resolved.sessionId,
            vkn,
            uuid: uuid || reportUuid,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv rapor durumu hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosSendEArchiveReport = async (req, res) => {
    try {
        const { sessionId, token, senderId, receiverId, zipBase64, fileName, hash, branch } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        if (!zipBase64) return res.status(400).json({ success: false, message: "zipBase64 gerekli" });
        const result = await sovosEArchiveService.sendReport({
            sessionId: resolved.sessionId,
            senderId,
            receiverId,
            zipBuffer: Buffer.from(zipBase64, "base64"),
            fileName,
            hash,
            branch,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] sendReport hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosGetEArchiveUserList = async (req, res) => {
    try {
        const { sessionId, token, vknTckn } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.getUserList({
            sessionId: resolved.sessionId,
            vknTckn,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv getUserList hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosGetEArchivePartialUserList = async (req, res) => {
    try {
        const blocked = rejectUnsafeSovosPartialUserList(req, res);
        if (blocked) return blocked;

        const { sessionId, token, vknTckn, includeBinary, fileNameList, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEArchiveService.getPartialUserList({
            sessionId: resolved.sessionId,
            vknTckn,
            includeBinary,
            fileNameList,
            parameters,
        });
        if (!result.success && result.rateLimited) {
            return res.status(429).json({ success: false, message: result.error });
        }
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv getPartialUserList hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosGetPartialUserList = async (req, res) => {
    try {
        const blocked = rejectUnsafeSovosPartialUserList(req, res);
        if (blocked) return blocked;

        const { sessionId, token, identifier, vknTckn, role, includeBinary, fileNameList, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosService.getPartialUserList({
            sessionId: resolved.sessionId,
            identifier,
            vknTckn,
            role,
            includeBinary,
            fileNameList,
            parameters,
        });
        if (!result.success && result.rateLimited) {
            return res.status(429).json({ success: false, message: result.error });
        }
        const payload = { ...result };
        if (resolved.restored && result.success) {
            payload.sessionId = resolved.sessionId;
            payload.accessToken = resolved.sessionId;
        }
        res.json(payload);
    } catch (error) {
        logger.error("[Sovos Controller] getPartialUserList hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosDespatchReceipts = async (req, res) => {
    try {
        const { sessionId, token, identifier, vknTckn, uuid, uuids, type, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEDespatchService.getDesReceipts({
            sessionId: resolved.sessionId,
            identifier,
            vknTckn,
            uuid,
            uuids,
            type,
            parameters,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] getDesReceipts hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosDespatchUserList = async (req, res) => {
    try {
        const { sessionId, token, identifier, vknTckn, role, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEDespatchService.getDesUserList({
            sessionId: resolved.sessionId,
            identifier,
            vknTckn,
            role,
            parameters,
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] getDesUserList hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

exports.sovosDespatchPartialUserList = async (req, res) => {
    try {
        const blocked = rejectUnsafeSovosPartialUserList(req, res);
        if (blocked) return blocked;

        const { sessionId, token, identifier, vknTckn, role, includeBinary, fileNameList, parameters } = req.body;
        const resolved = await resolveSovosSessionForRequest(req, sessionId || token);
        if (!resolved.sessionId) {
            return res.status(401).json({ success: false, message: resolved.error || "Oturum gerekli" });
        }
        const result = await sovosEDespatchService.getDesPartialUserList({
            sessionId: resolved.sessionId,
            identifier,
            vknTckn,
            role,
            includeBinary,
            fileNameList,
            parameters,
        });
        if (!result.success && result.rateLimited) {
            return res.status(429).json({ success: false, message: result.error });
        }
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] getDesPartialUserList hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  PARAŞÜT
// ═══════════════════════════════════════════════════════════════════════════

// ─── Paraşüt OAuth Token ─────────────────────────────────────────────────────
exports.parasutGetToken = async (req, res) => {
    try {
        const { clientId, clientSecret, email, password } = req.body;
        if (!clientId || !clientSecret || !email || !password) {
            return res.status(400).json({ success: false, message: "Client ID, Client Secret, E-posta ve Şifre gerekli" });
        }

        const result = await parasutService.getAccessToken({ clientId, clientSecret, email, password });
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        // Kullanıcı bilgilerini al (firma ID'si için)
        let userInfo = null;
        let companies = [];
        try {
            const meResult = await parasutService.getUserInfo({ token: result.accessToken });
            if (meResult.success) {
                userInfo = meResult.data;
                companies = meResult.companies || [];
            }
        } catch (meErr) {
            logger.warn("[Parasut Controller] /me bilgisi alınamadı:", meErr.message);
        }

        res.json({
            success: true,
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn,
                tokenType: result.tokenType,
                companies,
                userId: userInfo ? userInfo.id : null,
            }
        });
    } catch (error) {
        logger.error("[Parasut Controller] Token hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Token Yenile ────────────────────────────────────────────────────
exports.parasutRefreshToken = async (req, res) => {
    try {
        const { clientId, clientSecret, refreshToken } = req.body;
        if (!clientId || !clientSecret || !refreshToken) {
            return res.status(400).json({ success: false, message: "Client ID, Client Secret ve Refresh Token gerekli" });
        }

        const result = await parasutService.refreshAccessToken({ clientId, clientSecret, refreshToken });
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[Parasut Controller] Token yenileme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Kullanıcı Bilgisi ──────────────────────────────────────────────
exports.parasutGetUserInfo = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token gerekli" });
        }

        const result = await parasutService.getUserInfo({ token });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[Parasut Controller] Kullanıcı bilgisi hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Satış Faturaları Listele ────────────────────────────────────────
exports.parasutListInvoices = async (req, res) => {
    try {
        const { token, companyId, filters, page, sort } = req.body;
        if (!token || !companyId) {
            return res.status(400).json({ success: false, message: "Token ve Firma ID gerekli" });
        }

        const result = await parasutService.listSalesInvoices({
            token, companyId, filters, page, sort,
            include: "contact,active_e_document",
        });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] Fatura listeleme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Satış Faturası Oluştur ─────────────────────────────────────────
exports.parasutCreateInvoice = async (req, res) => {
    try {
        const { token, companyId, invoiceData } = req.body;
        if (!token || !companyId || !invoiceData) {
            return res.status(400).json({ success: false, message: "Token, Firma ID ve fatura verisi gerekli" });
        }

        const result = await parasutService.createSalesInvoice({ token, companyId, invoiceData });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] Fatura oluşturma hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt e-Fatura Gelen Kutusu (Mükellef Sorgulama) ─────────────────────
exports.parasutCheckEInvoiceInbox = async (req, res) => {
    try {
        const { token, companyId, vkn } = req.body;
        if (!token || !companyId || !vkn) {
            return res.status(400).json({ success: false, message: "Token, Firma ID ve VKN gerekli" });
        }

        const result = await parasutService.checkEInvoiceInbox({ token, companyId, vkn });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] e-Fatura gelen kutusu hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt e-Arşiv Oluştur ────────────────────────────────────────────────
exports.parasutCreateEArchive = async (req, res) => {
    try {
        const { token, companyId, eArchiveData } = req.body;
        if (!token || !companyId || !eArchiveData) {
            return res.status(400).json({ success: false, message: "Token, Firma ID ve e-Arşiv verisi gerekli" });
        }

        const result = await parasutService.createEArchive({ token, companyId, eArchiveData });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] e-Arşiv oluşturma hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt e-Fatura Oluştur ───────────────────────────────────────────────
exports.parasutCreateEInvoice = async (req, res) => {
    try {
        const { token, companyId, eInvoiceData } = req.body;
        if (!token || !companyId || !eInvoiceData) {
            return res.status(400).json({ success: false, message: "Token, Firma ID ve e-Fatura verisi gerekli" });
        }

        const result = await parasutService.createEInvoice({ token, companyId, eInvoiceData });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] e-Fatura oluşturma hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Trackable Job Durumu ────────────────────────────────────────────
exports.parasutGetJobStatus = async (req, res) => {
    try {
        const { token, companyId } = req.body;
        const { jobId } = req.params;
        if (!token || !companyId || !jobId) {
            return res.status(400).json({ success: false, message: "Token, Firma ID ve Job ID gerekli" });
        }

        const result = await parasutService.getTrackableJob({ token, companyId, jobId });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] Job durumu hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Müşteri/Tedarikçi Listele ──────────────────────────────────────
exports.parasutListContacts = async (req, res) => {
    try {
        const { token, companyId, filters, page } = req.body;
        if (!token || !companyId) {
            return res.status(400).json({ success: false, message: "Token ve Firma ID gerekli" });
        }

        const result = await parasutService.listContacts({ token, companyId, filters, page });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] Müşteri listeleme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Ürün Listele ───────────────────────────────────────────────────
exports.parasutListProducts = async (req, res) => {
    try {
        const { token, companyId, filters, page } = req.body;
        if (!token || !companyId) {
            return res.status(400).json({ success: false, message: "Token ve Firma ID gerekli" });
        }

        const result = await parasutService.listProducts({ token, companyId, filters, page });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Parasut Controller] Ürün listeleme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Paraşüt Belge Arama (Genel) ────────────────────────────────────────────
exports.parasutSearchDocuments = async (req, res) => {
    try {
        const { token, companyId, searchParams, documentType } = req.body;
        if (!token || !companyId) {
            return res.status(400).json({ success: false, message: "Token ve Firma ID gerekli" });
        }

        const result = await parasutService.searchDocuments({
            token, companyId, documentType, searchParams: searchParams || {}
        });
        res.json(result);
    } catch (error) {
        logger.error("[Parasut Controller] Belge arama hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ÖDEAL (E-FaturaPos / SadePos)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Ödeal Servis Anahtarı Doğrulama (Bağlantı) ─────────────────────────────
exports.odealValidateKey = async (req, res) => {
    try {
        const { serviceKey, merchantKey, env } = req.body;
        if (!serviceKey) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı gerekli" });
        }

        const result = await odealService.validateServiceKey({ serviceKey, merchantKey, env });
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        res.json({
            success: true,
            data: {
                serviceKey: result.serviceKey,
                merchantKey: result.merchantKey,
                env: result.env,
                units: result.units,
            }
        });
    } catch (error) {
        logger.error("[Odeal Controller] Anahtar doğrulama hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal Birim Listesi ─────────────────────────────────────────────────────
exports.odealGetUnits = async (req, res) => {
    try {
        const { serviceKey, merchantKey, env } = req.body;
        if (!serviceKey) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı gerekli" });
        }

        const result = await odealService.getUnits({ serviceKey, merchantKey, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] Birim listesi hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal Sepet Oluştur ────────────────────────────────────────────────────
exports.odealCreateBasket = async (req, res) => {
    try {
        const { serviceKey, merchantKey, basketData, env } = req.body;
        if (!serviceKey || !basketData) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı ve sepet verisi gerekli" });
        }

        const result = await odealService.createBasket({ serviceKey, merchantKey, basketData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] Sepet oluşturma hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal Sepet Listele ────────────────────────────────────────────────────
exports.odealListBaskets = async (req, res) => {
    try {
        const { serviceKey, merchantKey, filters, env } = req.body;
        if (!serviceKey) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı gerekli" });
        }

        const result = await odealService.listBaskets({ serviceKey, merchantKey, filters, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] Sepet listeleme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal Sepet Sil ────────────────────────────────────────────────────────
exports.odealDeleteBasket = async (req, res) => {
    try {
        const { serviceKey, merchantKey, env } = req.body;
        const { basketId } = req.params;
        if (!serviceKey || !basketId) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı ve Sepet ID gerekli" });
        }

        const result = await odealService.deleteBasket({ serviceKey, merchantKey, basketId, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] Sepet silme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal Konfigürasyon Kaydet ─────────────────────────────────────────────
exports.odealSaveConfig = async (req, res) => {
    try {
        const { serviceKey, merchantKey, configData, env } = req.body;
        if (!serviceKey || !configData) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı ve konfigürasyon verisi gerekli" });
        }

        const result = await odealService.saveConfiguration({ serviceKey, merchantKey, configData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] Konfigürasyon hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal İşlem Raporu ─────────────────────────────────────────────────────
exports.odealGetReport = async (req, res) => {
    try {
        const { serviceKey, merchantKey, filters, page, pageSize, env } = req.body;
        if (!serviceKey) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı gerekli" });
        }

        const result = await odealService.getTransactionReport({ serviceKey, merchantKey, filters, page, pageSize, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] Rapor hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal İşlem Detayı ─────────────────────────────────────────────────────
exports.odealGetTransactionDetail = async (req, res) => {
    try {
        const { serviceKey, merchantKey, env } = req.body;
        const { transactionId } = req.params;
        if (!serviceKey || !transactionId) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı ve İşlem ID gerekli" });
        }

        const result = await odealService.getTransactionDetail({ serviceKey, merchantKey, transactionId, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] İşlem detayı hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal Belge Arama (BillingPage uyumlu) ──────────────────────────────────
exports.odealSearchDocuments = async (req, res) => {
    try {
        const { token, searchParams, documentType, env } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Servis Anahtarı (token) gerekli" });
        }

        const result = await odealService.searchDocuments({
            token, searchParams: searchParams || {}, documentType, env
        });
        res.json(result);
    } catch (error) {
        logger.error("[Odeal Controller] Belge arama hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Ödeal Webhook Callback ──────────────────────────────────────────────────
exports.odealCallback = async (req, res) => {
    try {
        const result = await odealService.processCallback({
            payload: req.body,
            webhookSecret: req.headers["x-webhook-secret"] || null,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        logger.info("[Odeal Controller] Callback işlendi: " + result.event);
        res.json({ success: true, event: result.event, data: result.data });
    } catch (error) {
        logger.error("[Odeal Controller] Callback hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};
