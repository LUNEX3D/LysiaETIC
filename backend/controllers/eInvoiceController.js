const eInvoiceService = require("../services/eInvoiceService");
const qnbService = require("../services/qnbEInvoiceService");
const sovosService = require("../services/sovosEInvoiceService");
const parasutService = require("../services/parasutEInvoiceService");
const odealService = require("../services/odealEInvoiceService");
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
//  QNB eSolutions
// ═══════════════════════════════════════════════════════════════════════════

// ─── QNB Login ──────────────────────────────────────────────────────────────
exports.qnbLogin = async (req, res) => {
    try {
        const { username, password, env } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Kullanıcı adı ve şifre gerekli" });
        }

        const result = await qnbService.login({ username, password, env });
        if (!result.success) {
            return res.status(result.status || 401).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("[QNB Controller] Login hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Fatura Gönder ────────────────────────────────────────────────────
exports.qnbSendEInvoice = async (req, res) => {
    try {
        const { token, invoiceData, env } = req.body;
        if (!token || !invoiceData) {
            return res.status(400).json({ success: false, message: "Token ve fatura verisi gerekli" });
        }

        const result = await qnbService.sendEInvoice({ token, invoiceData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[QNB Controller] e-Fatura gönderme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-Arşiv Gönder ────────────────────────────────────────────────────
exports.qnbSendEArchive = async (req, res) => {
    try {
        const { token, invoiceData, env } = req.body;
        if (!token || !invoiceData) {
            return res.status(400).json({ success: false, message: "Token ve fatura verisi gerekli" });
        }

        const result = await qnbService.sendEArchive({ token, invoiceData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[QNB Controller] e-Arşiv gönderme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB e-İrsaliye Gönder ─────────────────────────────────────────────────
exports.qnbSendDespatch = async (req, res) => {
    try {
        const { token, despatchData, env } = req.body;
        if (!token || !despatchData) {
            return res.status(400).json({ success: false, message: "Token ve irsaliye verisi gerekli" });
        }

        const result = await qnbService.sendDespatch({ token, despatchData, env });
        if (!result.success) {
            return res.status(result.status || 400).json({ success: false, message: result.error });
        }

        res.json({ success: true, data: result.data });
    } catch (error) {
        logger.error("[QNB Controller] e-İrsaliye gönderme hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Kullanıcı Sorgula ─────────────────────────────────────────────────
exports.qnbCheckUser = async (req, res) => {
    try {
        const { token, vkn, env } = req.body;
        if (!token || !vkn) {
            return res.status(400).json({ success: false, message: "Token ve VKN gerekli" });
        }

        const result = await qnbService.checkEInvoiceUser({ token, vkn, env });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Kullanıcı sorgu hatası:", error.message);
        res.status(500).json({ success: false, message: "Sunucu hatası" });
    }
};

// ─── QNB Belge Arama ────────────────────────────────────────────────────────
exports.qnbSearchDocuments = async (req, res) => {
    try {
        const { token, searchParams, documentType, env } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token gerekli" });
        }

        const result = await qnbService.searchDocuments({
            token, searchParams: searchParams || {}, documentType, env
        });
        res.json(result);
    } catch (error) {
        logger.error("[QNB Controller] Belge arama hatası:", error.message);
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
