const eInvoiceService = require("../services/eInvoiceService");
const qnbService = require("../services/qnbEInvoiceService");
const sovosService = require("../services/sovosEInvoiceService");
const parasutService = require("../services/parasutEInvoiceService");
const odealService = require("../services/odealEInvoiceService");
const AutoInvoiceConfig = require("../models/AutoInvoiceConfig");
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
                const configUpdate = { "qnbCredentials.env": env || "test" };
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

// ─── Sovos OAuth Token ──────────────────────────────────────────────────────
exports.sovosGetToken = async (req, res) => {
    try {
        const { apiKey, apiSecret, env } = req.body;
        if (!apiKey || !apiSecret) {
            return res.status(400).json({ success: false, message: "API Key ve Secret gerekli" });
        }

        const result = await sovosService.getAccessToken({ apiKey, apiSecret, env });
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[Sovos Controller] Token hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Belge Gönder ─────────────────────────────────────────────────────
exports.sovosSendDocument = async (req, res) => {
    try {
        const { token, documentData, env } = req.body;
        if (!token || !documentData) {
            return res.status(400).json({ success: false, message: "Token ve belge verisi gerekli" });
        }

        const result = await sovosService.sendDocument({ token, documentData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
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
        const { token, env } = req.body;
        const { referenceId } = req.params;
        if (!token || !referenceId) {
            return res.status(400).json({ success: false, message: "Token ve referans ID gerekli" });
        }

        const result = await sovosService.getDocumentStatus({ token, referenceId, env });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] Belge durum hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos e-Arşiv Gönder ──────────────────────────────────────────────────
exports.sovosSendEArchive = async (req, res) => {
    try {
        const { token, invoiceData, env } = req.body;
        if (!token || !invoiceData) {
            return res.status(400).json({ success: false, message: "Token ve fatura verisi gerekli" });
        }

        const result = await sovosService.sendEArchive({ token, invoiceData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[Sovos Controller] e-Arşiv gönderme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos API Durumu ───────────────────────────────────────────────────────
exports.sovosCheckStatus = async (req, res) => {
    try {
        const { apiKey, env } = req.body;
        if (!apiKey) {
            return res.status(400).json({ success: false, message: "API Key gerekli" });
        }

        const result = await sovosService.checkApiStatus({ apiKey, env });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] API durum hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── Sovos Belge Arama ─────────────────────────────────────────────────────
exports.sovosSearchDocuments = async (req, res) => {
    try {
        const { token, searchParams, documentType, env } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token gerekli" });
        }

        const result = await sovosService.searchDocuments({
            token, searchParams: searchParams || {}, documentType, env
        });
        res.json(result);
    } catch (error) {
        logger.error("[Sovos Controller] Belge arama hatası:", error.message);
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
