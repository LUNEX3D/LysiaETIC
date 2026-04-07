const soap = require("soap");
const axios = require("axios");
const crypto = require("crypto");
const logger = require("../config/logger");
const { buildInvoiceXml } = require("../utils/ublBuilder");

/**
 * QNB eSolutions E-FATURA SERVİSİ — LysiaETIC
 *
 * QNB eSolutions (eski adıyla QNB eFinans) SOAP API entegrasyonu
 * Desteklenen belgeler: e-Fatura, e-Arşiv, e-İrsaliye
 *
 * ─── SERVİSLER ──────────────────────────────────────────────────────────────
 *   connectorService  → e-Fatura & e-İrsaliye gönderme/sorgulama/indirme
 *   userService       → Oturum yönetimi (wsLogin / logout)
 *   EarsivWebService  → e-Arşiv fatura oluşturma/sorgulama/iptal
 *
 * ─── KİMLİK DOĞRULAMA ──────────────────────────────────────────────────────
 *   Cookie-based session (CSAPSESSIONID)
 *   wsLogin → userId, password, lang
 *   ERP Kodu: belgeGonderExt parametreler objesi içinde
 *
 * ─── WSDL METOT PARAMETRELERİ (describe'dan keşfedildi) ────────────────────
 *
 *   connectorService:
 *     belgeGonderExt(parametreler)
 *     belgeGonder(vergiTcKimlikNo, belgeTuru, belgeNo, veri, belgeHash, mimeType, belgeVersiyon)
 *     faturaNoUret(vknTckn, faturaKodu)
 *     irsaliyeNoUret(vknTckn, irsaliyeKodu)
 *     efaturaKullanicisi(vergiTcKimlikNo)
 *     eIrsaliyeKullanicisi(vergiTcKimlikNo)
 *     gidenBelgeDurumSorgula(vergiTcKimlikNo, belgeOid)
 *     gidenBelgeDurumSorgulaEttn(vergiTcKimlikNo, ettn)
 *     gelenBelgeleriListele(vergiTcKimlikNo, sonAlinanBelgeSiraNumarasi, belgeTuru)
 *     gidenBelgeleriListele(parametreler)
 *     gidenBelgeleriIndir(vergiTcKimlikNo, belgeOidListesi[], belgeTuru, belgeFormati)
 *     gelenBelgeleriIndir(vergiTcKimlikNo, ettnler[], belgeTuru, belgeFormati, tekPdfDosya)
 *     kontorBilgisiGetir(vknTckn, kontorTipi, kontorBirimi)
 *     faturaTarihcesiSorgula(ettn, faturaYonu, vknTckn)
 *
 *   EarsivWebService:
 *     faturaOlustur(input, fatura)
 *     faturaOlusturExt(input, fatura)
 *     faturaNoUret(input)
 *     faturaSorgula(input)
 *     faturaIptalEt(input)
 *     faturaListeSorgula(input)
 *     faturaOnizleme(input, fatura)
 *     faturaZipiAl(input)
 *     ePostaGonder(input, ilaveEposta, tanimliEpostayaGonder)
 *     smsGonder(input, ilaveTelefonNo, tanimliTelefonNoyaGonder)
 *     efaturaKullanicisi(vergiTcKimlikNo)
 *     kontorBilgisiGetir(vknTckn, kontorTipi, kontorBirimi)
 */

// ─── WSDL Endpoint Yapılandırması ───────────────────────────────────────────
const WSDL = {
    test: {
        efatura: process.env.QNB_EFATURA_TEST_WSDL || "https://erpefaturatest1.qnbesolutions.com.tr/efatura/ws/connectorService?wsdl",
        efatura2: process.env.QNB_EFATURA_TEST2_WSDL || "https://erpefaturatest2.qnbesolutions.com.tr/efatura/ws/connectorService?wsdl",
        user: process.env.QNB_USER_TEST_WSDL || "https://erpefaturatest1.qnbesolutions.com.tr/efatura/ws/userService?wsdl",
        earsiv: process.env.QNB_EARSIV_TEST_WSDL || "https://earsivtest.qnbesolutions.com.tr/earsiv/ws/EarsivWebService?wsdl",
        earsivUser: process.env.QNB_EARSIV_USER_TEST_WSDL || "https://connectortest.qnbesolutions.com.tr/connector/ws/userService?wsdl",
        portal: "https://portaltest.qnbesolutions.com.tr/yonetim",
    },
    production: {
        efatura: process.env.QNB_EFATURA_PROD_WSDL || "",
        user: process.env.QNB_USER_PROD_WSDL || "",
        earsiv: process.env.QNB_EARSIV_PROD_WSDL || "",
        earsivUser: process.env.QNB_EARSIV_USER_PROD_WSDL || "",
        portal: "https://portal.qnbesolutions.com.tr/yonetim",
    }
};

// ERP Kodu — QNB eSolutions tarafından firmanıza tanımlanan sabit değer
const ERP_CODE = process.env.QNB_ERP_CODE || "ESC31309";

// Test VKN'leri (QNB tarafından sağlanan)
// ⚠️ e-Fatura ve e-Arşiv FARKLI ortamlar — farklı credentials!
// e-Fatura: erpefaturatest1 → VKN / ***REDACTED***@
// e-Arşiv:  connectortest   → VKN.portaltest / ***REDACTED***
const TEST_ACCOUNTS = {
    test1: { vkn: "7610650466", userCode: "7610650466", password: process.env.QNB_EFATURA_PASSWORD || "***REDACTED***@" },
    test2: { vkn: "7610650467", userCode: "7610650467", password: process.env.QNB_EFATURA2_PASSWORD || "***REDACTED***@" },
    earsiv: { vkn: "7610650466", userCode: "7610650466.portaltest", password: process.env.QNB_EARSIV_PASSWORD || "***REDACTED***" }
};

// ─── Session Yönetimi ───────────────────────────────────────────────────────
// Oturum bazlı cookie string'lerini tut
// QNB test ortamında TEST_CSAPSESSIONID, prod'da CSAPSESSIONID kullanır
// Domain: qnbesolutions.com.tr — tüm subdomain'lerde geçerli
const sessionStore = {};

const getWsdlUrl = (env, service) => {
    const envConfig = WSDL[env] || WSDL.test;
    return envConfig[service] || "";
};

/**
 * SOAP Client oluştur (her zaman yeni — cookie isolation için)
 */
const createSoapClient = async (wsdlUrl, options = {}) => {
    if (!wsdlUrl) {
        throw new Error("WSDL URL tanımlanmamış. .env dosyasını kontrol edin.");
    }

    try {
        const client = await soap.createClientAsync(wsdlUrl, {
            wsdl_options: { timeout: 30000 },
            ...options
        });
        logger.info("[QNB] SOAP client oluşturuldu: " + wsdlUrl.split("?")[0]);
        return client;
    } catch (error) {
        logger.error("[QNB] SOAP client oluşturma hatası (" + wsdlUrl + "): " + error.message);
        throw new Error("QNB eSolutions servisine bağlanılamadı: " + error.message);
    }
};

/** Oturum cookie string'ini sakla */
const storeSession = (sessionId, cookieStr) => {
    sessionStore[sessionId] = { cookieStr, createdAt: Date.now() };
};

/** Oturum cookie string'ini getir */
const getSessionCookies = (sessionId) => {
    const entry = sessionStore[sessionId];
    if (!entry) return null;
    // 25 dakikadan eski session'ları temizle (QNB timeout ~30dk)
    if (Date.now() - entry.createdAt > 25 * 60 * 1000) {
        delete sessionStore[sessionId];
        return null;
    }
    return entry.cookieStr;
};

// Eski API uyumluluğu için alias'lar
const sessionClients = {};
const getSessionClient = (sessionId) => {
    const entry = sessionClients[sessionId];
    if (!entry) return null;
    if (Date.now() - entry.createdAt > 25 * 60 * 1000) {
        delete sessionClients[sessionId];
        return null;
    }
    return entry.client;
};
const storeSessionClient = (sessionId, client) => {
    sessionClients[sessionId] = { client, createdAt: Date.now() };
};

/** Oturum client'ını temizle */
const clearSessionClient = (sessionId) => {
    if (sessionId) {
        delete sessionClients[sessionId];
        delete sessionStore[sessionId];
    } else {
        Object.keys(sessionClients).forEach(key => delete sessionClients[key]);
        Object.keys(sessionStore).forEach(key => delete sessionStore[key]);
    }
};

/** Cookie string'ini client'a set et */
const applyCookiesToClient = (client, cookies) => {
    if (!cookies || !cookies.length) return;
    const cookieStr = cookies.map(c => c.split(";")[0]).join("; ");
    if (!client.httpHeaders) client.httpHeaders = {};
    client.httpHeaders.Cookie = cookieStr;
    return cookieStr;
};

/** Session cookie'sini HTTP header olarak ekle — tüm cookie string'ini kullan */
const setCookieHeader = (client, sessionId) => {
    if (!sessionId) return;
    if (!client.httpHeaders) client.httpHeaders = {};
    // Önce tam cookie string'ini dene (cross-domain uyumluluk)
    const fullCookies = getSessionCookies(sessionId);
    if (fullCookies) {
        client.httpHeaders.Cookie = fullCookies;
    } else {
        // Fallback: sadece CSAPSESSIONID
        client.httpHeaders.Cookie = "CSAPSESSIONID=" + sessionId;
    }
};

/**
 * Oturum cookie'si ile authenticate edilmiş client getir
 * Login sırasında saklanan cookie string'ini kullanır
 * Farklı servis (connectorService, earsiv) için yeni client oluşturup cookie ekler
 */
const getAuthenticatedClient = async (sessionId, env, service) => {
    const wsdlUrl = getWsdlUrl(env, service);
    const client = await createSoapClient(wsdlUrl);
    setCookieHeader(client, sessionId);
    return client;
};

/** SOAP hata mesajını çıkar */
const extractSoapError = (error) => {
    if (error.root && error.root.Envelope && error.root.Envelope.Body && error.root.Envelope.Body.Fault) {
        const fault = error.root.Envelope.Body.Fault;
        return fault.faultstring || fault.detail || "SOAP Fault";
    }
    if (error.body) {
        return typeof error.body === "string" ? error.body : JSON.stringify(error.body);
    }
    return error.message || "Bilinmeyen hata";
};

// ═══════════════════════════════════════════════════════════════════════════
//  1. OTURUM YÖNETİMİ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SOAP Login — userService.wsLogin
 * Parametreler: userId, password, lang
 * Oturum: Cookie-based (CSAPSESSIONID)
 */
const login = async ({ username, password, env = "test", service = "efatura" }) => {
    try {
        const wsdlUrl = service === "earsiv"
            ? getWsdlUrl(env, "earsivUser")
            : getWsdlUrl(env, "user");

        const client = await createSoapClient(wsdlUrl);

        logger.info("[QNB] Login deneniyor — Servis: " + service + ", Kullanıcı: " + username);

        const [result] = await client.wsLoginAsync({
            userId: username,
            password: password,
            lang: "tr"
        });

        // QNB cookie-based session kullanır
        // Test ortamında TEST_CSAPSESSIONID, prod'da CSAPSESSIONID
        const cookies = client.lastResponseHeaders && client.lastResponseHeaders["set-cookie"];

        // Session cookie'sini çıkar (TEST_CSAPSESSIONID veya CSAPSESSIONID)
        let sessionId = null;
        if (cookies && cookies.length) {
            for (const cookie of cookies) {
                const match = cookie.match(/(?:TEST_)?CSAPSESSIONID=([^;]+)/);
                if (match) {
                    sessionId = match[1];
                    break;
                }
            }
        }

        if (!sessionId) {
            sessionId = result && result.return && result.return.sessionID
                ? result.return.sessionID
                : (result && result.return ? String(result.return) : null);
        }

        if (!sessionId) {
            logger.warn("[QNB] Login yanıtında session bilgisi bulunamadı");
            return { success: false, error: "Oturum bilgisi alınamadı.", status: 401 };
        }

        // Tüm cookie string'ini sakla (cross-domain uyumluluk)
        const cookieStr = applyCookiesToClient(client, cookies);
        storeSession(sessionId, cookieStr || "");
        storeSessionClient(sessionId, client);

        logger.info("[QNB] Login başarılı — Servis: " + service + ", Kullanıcı: " + username + ", SessionID: " + sessionId.substring(0, 8) + "...");
        return {
            success: true,
            sessionId: sessionId,
            cookies: cookies || [],
            data: result ? result.return : null
        };
    } catch (error) {
        const errMsg = extractSoapError(error);
        logger.error("[QNB] Login hatası: " + errMsg);
        return { success: false, error: errMsg, status: 401 };
    }
};

/**
 * SOAP Logout — userService.logout
 */
const logout = async ({ sessionId, env = "test", service = "efatura" }) => {
    try {
        let client = getSessionClient(sessionId);
        if (!client) {
            const wsdlUrl = service === "earsiv"
                ? getWsdlUrl(env, "earsivUser")
                : getWsdlUrl(env, "user");
            client = await createSoapClient(wsdlUrl);
            setCookieHeader(client, sessionId);
        }

        await client.logoutAsync({});
        clearSessionClient(sessionId);
        logger.info("[QNB] Logout başarılı");
        return { success: true };
    } catch (error) {
        clearSessionClient(sessionId);
        logger.error("[QNB] Logout hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  2. e-FATURA İŞLEMLERİ (connectorService)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * e-Fatura mükellefi sorgulama
 * connectorService.efaturaKullanicisi(vergiTcKimlikNo) → boolean
 */
const checkEInvoiceUser = async ({ sessionId, vkn, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.efaturaKullanicisiAsync({ vergiTcKimlikNo: vkn });

        return {
            success: true,
            isRegistered: !!(result && result.return),
            data: result ? result.return : null
        };
    } catch (error) {
        logger.error("[QNB] e-Fatura kullanıcı sorgu hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Fatura kullanıcı bilgisi (detaylı)
 * connectorService.efaturaKullaniciBilgisi(vergiTcKimlikNo)
 */
const getEInvoiceUserInfo = async ({ sessionId, vkn, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.efaturaKullaniciBilgisiAsync({ vergiTcKimlikNo: vkn });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] e-Fatura kullanıcı bilgi hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Mükellef aktif etiket listesi
 * connectorService.getMukellefAktifEtiketList(VKN)
 */
const getMukellefEtiketList = async ({ sessionId, vkn, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.getMukellefAktifEtiketListAsync({ VKN: vkn });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Mükellef etiket listesi hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Fatura numarası üret
 * connectorService.faturaNoUret(vknTckn, faturaKodu)
 * @param {string} faturaKodu - Fatura seri kodu (örn: "ABC")
 */
const generateInvoiceNumber = async ({ sessionId, vkn, faturaKodu, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.faturaNoUretAsync({
            vknTckn: vkn,
            faturaKodu: faturaKodu
        });

        logger.info("[QNB] Fatura numarası üretildi");
        return { success: true, invoiceNumber: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Fatura no üretme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Fatura gönderme (belgeGonderExt — ERP kodu ile)
 * connectorService.belgeGonderExt(parametreler)
 *
 * parametreler objesi içinde:
 *   - vergiTcKimlikNo, belgeTuru, belgeNo, veri, belgeHash, mimeType, belgeVersiyon, erpKodu
 *
 * @param {string} invoiceXml - UBL 2.1 formatında fatura XML'i (Base64)
 * @param {string} vkn - Gönderen VKN
 * @param {string} belgeTuru - FATURA, IRSALIYE
 * @param {string} belgeNo - Fatura numarası (faturaNoUret ile üretilmiş)
 */
const sendEInvoice = async ({ sessionId, invoiceXml, vkn, belgeTuru = "FATURA", belgeNo = "", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");

        const [result] = await client.belgeGonderExtAsync({
            parametreler: {
                vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
                belgeTuru: belgeTuru,
                belgeNo: belgeNo,
                veri: invoiceXml,
                belgeHash: "",
                mimeType: "application/xml",
                belgeVersiyon: "",
                erpKodu: ERP_CODE
            }
        });

        logger.info("[QNB] e-Fatura gönderildi — BelgeNo: " + belgeNo);
        return {
            success: true,
            belgeOid: result && result.return ? result.return : null,
            data: result ? result.return : null
        };
    } catch (error) {
        logger.error("[QNB] e-Fatura gönderme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error), status: 400 };
    }
};

/**
 * Giden belge durum sorgulama (belgeOid ile)
 * connectorService.gidenBelgeDurumSorgula(vergiTcKimlikNo, belgeOid)
 */
const getOutgoingStatus = async ({ sessionId, vkn, belgeOid, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gidenBelgeDurumSorgulaAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            belgeOid: belgeOid
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Giden belge durum hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Giden belge durum sorgulama (ETTN/UUID ile)
 * connectorService.gidenBelgeDurumSorgulaEttn(vergiTcKimlikNo, ettn)
 */
const getOutgoingStatusByEttn = async ({ sessionId, vkn, ettn, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gidenBelgeDurumSorgulaEttnAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            ettn: ettn
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Giden belge durum (ETTN) hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Giden belge durum sorgulama (belge numarası ile)
 * connectorService.gidenBelgeDurumSorgulaBelgeNo(vergiTcKimlikNo, belgeNo, urun)
 */
const getOutgoingStatusByBelgeNo = async ({ sessionId, vkn, belgeNo, urun = "EFATURA", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gidenBelgeDurumSorgulaBelgeNoAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            belgeNo: belgeNo,
            urun: urun
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Giden belge durum (BelgeNo) hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Fatura tarihçesi sorgulama
 * connectorService.faturaTarihcesiSorgula(ettn, faturaYonu, vknTckn)
 * @param {string} faturaYonu - "GELEN" veya "GIDEN"
 */
const getInvoiceHistory = async ({ sessionId, vkn, ettn, faturaYonu = "GIDEN", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.faturaTarihcesiSorgulaAsync({
            ettn: ettn,
            faturaYonu: faturaYonu,
            vknTckn: vkn || TEST_ACCOUNTS.test1.vkn
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Fatura tarihçesi hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Giden belgeleri listele
 * connectorService.gidenBelgeleriListele(parametreler)
 */
const listOutgoingDocuments = async ({ sessionId, vkn, searchParams = {}, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const resolvedVkn = vkn || TEST_ACCOUNTS.test1.vkn;
        const [result] = await client.gidenBelgeleriListeleAsync({
            parametreler: {
                vkn: resolvedVkn,
                belgeTuru: searchParams.belgeTuru || "FATURA",
                baslangicGonderimTarihi: searchParams.startDate || "",
                bitisGonderimTarihi: searchParams.endDate || "",
                baslangicBelgeTarihi: searchParams.startBelgeDate || "",
                bitisBelgeTarihi: searchParams.endBelgeDate || ""
            }
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Giden belge listeleme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Gelen belgeleri listele
 * connectorService.gelenBelgeleriListele(vergiTcKimlikNo, sonAlinanBelgeSiraNumarasi, belgeTuru)
 */
const listIncomingDocuments = async ({ sessionId, vkn, belgeTuru = "FATURA", sonSiraNo = "0", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gelenBelgeleriListeleAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            sonAlinanBelgeSiraNumarasi: sonSiraNo,
            belgeTuru: belgeTuru
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Gelen belge listeleme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Gelen belgeleri al (indir)
 * connectorService.gelenBelgeleriAl(vergiTcKimlikNo, sonAlinanBelgeSiraNumarasi, belgeTuru)
 */
const fetchIncomingDocuments = async ({ sessionId, vkn, belgeTuru = "FATURA", sonSiraNo = "0", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gelenBelgeleriAlAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            sonAlinanBelgeSiraNumarasi: sonSiraNo,
            belgeTuru: belgeTuru
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Gelen belge alma hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Giden belgeleri indir (belgeOid listesi ile)
 * connectorService.gidenBelgeleriIndir(vergiTcKimlikNo, belgeOidListesi[], belgeTuru, belgeFormati)
 * @param {string} belgeFormati - "PDF", "XML", "HTML"
 */
const downloadOutgoingDocuments = async ({ sessionId, vkn, belgeOidListesi, belgeTuru = "FATURA", belgeFormati = "PDF", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gidenBelgeleriIndirAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            belgeOidListesi: belgeOidListesi,
            belgeTuru: belgeTuru,
            belgeFormati: belgeFormati
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Giden belge indirme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Gelen belgeleri indir (ETTN listesi ile)
 * connectorService.gelenBelgeleriIndir(vergiTcKimlikNo, ettnler[], belgeTuru, belgeFormati, tekPdfDosya)
 */
const downloadIncomingDocuments = async ({ sessionId, vkn, ettnler, belgeTuru = "FATURA", belgeFormati = "PDF", tekPdfDosya = false, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gelenBelgeleriIndirAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            ettnler: ettnler,
            belgeTuru: belgeTuru,
            belgeFormati: belgeFormati,
            tekPdfDosya: tekPdfDosya
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Gelen belge indirme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Giden belge indir (tek belge, ETTN ile)
 * connectorService.gidenBelgeIndirExt(vergiTcKimlikNo, belgeEttn, belgeTuru, belgeFormati)
 */
const downloadOutgoingByEttn = async ({ sessionId, vkn, ettn, belgeTuru = "FATURA", belgeFormati = "PDF", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gidenBelgeIndirExtAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            belgeEttn: ettn,
            belgeTuru: belgeTuru,
            belgeFormati: belgeFormati
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Giden belge indirme (ETTN) hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Gelen belge indir (tek belge, ETTN ile)
 * connectorService.gelenBelgeIndirExt(vergiTcKimlikNo, belgeEttn, belgeTuru, belgeFormati)
 */
const downloadIncomingByEttn = async ({ sessionId, vkn, ettn, belgeTuru = "FATURA", belgeFormati = "PDF", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.gelenBelgeIndirExtAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            belgeEttn: ettn,
            belgeTuru: belgeTuru,
            belgeFormati: belgeFormati
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Gelen belge indirme (ETTN) hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Kontör bilgisi sorgulama
 * connectorService.kontorBilgisiGetir(vknTckn, kontorTipi, kontorBirimi)
 */
const getKontorInfo = async ({ sessionId, vkn, kontorTipi = "EFATURA", kontorBirimi = "ADET", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.kontorBilgisiGetirAsync({
            vknTckn: vkn || TEST_ACCOUNTS.test1.vkn,
            kontorTipi: kontorTipi,
            kontorBirimi: kontorBirimi
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Kontör bilgisi hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Kayıtlı e-Fatura kullanıcı listesi
 * connectorService.eFaturaKayitliKullaniciListele(kayitZamani)
 */
const listRegisteredEInvoiceUsers = async ({ sessionId, kayitZamani = "", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.eFaturaKayitliKullaniciListeleAsync({
            kayitZamani: kayitZamani
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Kayıtlı kullanıcı listesi hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Fatura mail gönder
 * connectorService.faturaMailGonder(vknTckn, inOut, UUID, faturaNo, alicilar, belgeFormati)
 */
const sendInvoiceMail = async ({ sessionId, vkn, inOut = "OUT", uuid, faturaNo, alicilar, belgeFormati = "PDF", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.faturaMailGonderAsync({
            vknTckn: vkn || TEST_ACCOUNTS.test1.vkn,
            inOut: inOut,
            UUID: uuid,
            faturaNo: faturaNo,
            alicilar: alicilar,
            belgeFormati: belgeFormati
        });

        logger.info("[QNB] Fatura mail gönderildi: " + faturaNo);
        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Fatura mail hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Gelen belgeleri alındı olarak işaretle
 * connectorService.belgelerAlindi(vergiTcKimlikNo, ettn[], belgeTuru)
 */
const markDocumentsReceived = async ({ sessionId, vkn, ettnList, belgeTuru = "FATURA", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.belgelerAlindiAsync({
            vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
            ettn: ettnList,
            belgeTuru: belgeTuru
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] Belge alındı işaretleme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  3. e-İRSALİYE İŞLEMLERİ (connectorService — belgeTuru: IRSALIYE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * e-İrsaliye mükellefi sorgulama
 * connectorService.eIrsaliyeKullanicisi(vergiTcKimlikNo)
 */
const checkDespatchUser = async ({ sessionId, vkn, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.eIrsaliyeKullanicisiAsync({ vergiTcKimlikNo: vkn });

        return {
            success: true,
            isRegistered: !!(result && result.return),
            data: result ? result.return : null
        };
    } catch (error) {
        logger.error("[QNB] e-İrsaliye kullanıcı sorgu hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * İrsaliye numarası üret
 * connectorService.irsaliyeNoUret(vknTckn, irsaliyeKodu)
 */
const generateDespatchNumber = async ({ sessionId, vkn, irsaliyeKodu, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.irsaliyeNoUretAsync({
            vknTckn: vkn || TEST_ACCOUNTS.test1.vkn,
            irsaliyeKodu: irsaliyeKodu
        });

        logger.info("[QNB] İrsaliye numarası üretildi");
        return { success: true, despatchNumber: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] İrsaliye no üretme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-İrsaliye gönderme
 * connectorService.belgeGonderExt(parametreler) — belgeTuru: IRSALIYE
 */
const sendDespatch = async ({ sessionId, despatchXml, vkn, belgeNo = "", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");

        const [result] = await client.belgeGonderExtAsync({
            parametreler: {
                vergiTcKimlikNo: vkn || TEST_ACCOUNTS.test1.vkn,
                belgeTuru: "IRSALIYE",
                belgeNo: belgeNo,
                veri: despatchXml,
                belgeHash: "",
                mimeType: "application/xml",
                belgeVersiyon: "",
                erpKodu: ERP_CODE
            }
        });

        logger.info("[QNB] e-İrsaliye gönderildi — BelgeNo: " + belgeNo);
        return {
            success: true,
            belgeOid: result && result.return ? result.return : null,
            data: result ? result.return : null
        };
    } catch (error) {
        logger.error("[QNB] e-İrsaliye gönderme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error), status: 400 };
    }
};

/**
 * İrsaliye tarihçesi sorgulama
 * connectorService.irsaliyeTarihcesiSorgula(ettn, irasliyeYonu, vknTckn)
 */
const getDespatchHistory = async ({ sessionId, vkn, ettn, irsaliyeYonu = "GIDEN", env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "efatura");
        const [result] = await client.irsaliyeTarihcesiSorgulaAsync({
            ettn: ettn,
            irasliyeYonu: irsaliyeYonu,  // WSDL'de "irasliye" (typo QNB'de)
            vknTckn: vkn || TEST_ACCOUNTS.test1.vkn
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] İrsaliye tarihçesi hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  4. e-ARŞİV İŞLEMLERİ (EarsivWebService)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * e-Arşiv fatura numarası üret
 * EarsivWebService.faturaNoUret(input)
 * input: JSON string — FaturaData alanları: vkn, faturaSeri, islemId
 */
const generateEArchiveNumber = async ({ sessionId, vkn, faturaKodu, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const [result] = await client.faturaNoUretAsync({
            input: JSON.stringify({
                vkn: vkn || TEST_ACCOUNTS.earsiv.vkn,
                faturaSeri: faturaKodu || "",
                islemId: crypto.randomUUID()
            })
        });

        // Başarılı: resultCode=AE00000, fatura numarası "output" alanında
        const ret = result ? result.return : null;
        const faturaNo = result ? result.output : null;
        if (ret && ret.resultCode === "AE00000" && faturaNo) {
            logger.info("[QNB] e-Arşiv fatura numarası üretildi: " + faturaNo);
            return { success: true, invoiceNumber: faturaNo };
        }
        // Hata durumu
        const errMsg = ret ? (ret.resultText || ret.resultCode) : "Bilinmeyen hata";
        logger.error("[QNB] e-Arşiv fatura no üretme hatası: " + errMsg);
        return { success: false, error: errMsg };
    } catch (error) {
        logger.error("[QNB] e-Arşiv fatura no üretme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv fatura oluştur
 * EarsivWebService.faturaOlusturExt(input, fatura)
 *
 * input: JSON string — FaturaData alanları:
 *   vkn, sube, kasa, faturaTipi, numaraVerilsinMi (0/1),
 *   faturaImzalansinMi (0/1), islemId (UUID)
 *
 * fatura: { belgeFormati: "UBL", belgeIcerigi: base64XML }
 *
 * @param {string} invoiceXml - UBL XML (Base64 encoded)
 */
const createEArchiveInvoice = async ({ sessionId, vkn, invoiceXml, sube, kasa, faturaTipi, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const islemId = crypto.randomUUID();

        const inputData = {
            vkn: vkn || TEST_ACCOUNTS.earsiv.vkn,
            sube: sube || "DFLT",
            kasa: kasa || "DFLT",
            faturaTipi: faturaTipi || "SATIS",
            numaraVerilsinMi: 1,
            faturaImzalansinMi: 1,
            islemId: islemId
        };

        // ERP kodu her zaman gönderilir (test + production)
        // QNB test ortamında da ERP kodu kayıtlı olmalı — yoksa [AE00147] kontör hatası alınır
        // ERP kodu kayıtlı değilse [AE00001] hatası alınır → QNB'ye tanımlatılmalı
        inputData.erpKodu = ERP_CODE;

        logger.info("[QNB] faturaOlusturExt input: " + JSON.stringify(inputData));
        const [result] = await client.faturaOlusturExtAsync({
            input: JSON.stringify(inputData),
            fatura: {
                belgeFormati: "UBL",
                belgeIcerigi: invoiceXml
            }
        });

        const ret = result ? result.return : null;
        if (ret && ret.resultCode === "AE00000") {
            logger.info("[QNB] e-Arşiv fatura oluşturuldu — islemId: " + islemId);
            return {
                success: true,
                data: ret,
                islemId: islemId,
                output: result.output || null
            };
        }

        const errMsg = ret ? (ret.resultText || ret.resultCode) : "Bilinmeyen hata";
        logger.error("[QNB] e-Arşiv fatura oluşturma hatası: " + errMsg);
        return { success: false, error: errMsg, status: 400 };
    } catch (error) {
        logger.error("[QNB] e-Arşiv fatura oluşturma hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error), status: 400 };
    }
};

/**
 * e-Arşiv fatura oluştur — FORM VERİLERİNDEN
 * Frontend'den gelen form verilerini UBL-TR XML'e çevirip QNB'ye gönderir
 *
 * Akış:
 *   1. Fatura numarası üret (faturaNoUret) veya mevcut numarayı kullan
 *   2. UBL-TR XML oluştur (ublBuilder)
 *   3. QNB'ye gönder (faturaOlusturExt)
 */
const createEArchiveFromForm = async ({ sessionId, vkn, invoiceData, env = "test" }) => {
    try {
        const resolvedVkn = vkn || (invoiceData.supplier && invoiceData.supplier.vkn) || TEST_ACCOUNTS.earsiv.vkn;
        let invoiceNumber = invoiceData.invoiceNumber || "";

        // Fatura numarası yoksa QNB'den üret
        if (!invoiceNumber) {
            const faturaKodu = invoiceData.faturaKodu || "LYS";
            logger.info("[QNB] Fatura numarası üretiliyor — seri: " + faturaKodu);
            const noResult = await generateEArchiveNumber({
                sessionId, vkn: resolvedVkn, faturaKodu, env
            });
            if (noResult.success && noResult.invoiceNumber) {
                invoiceNumber = noResult.invoiceNumber;
                logger.info("[QNB] Fatura numarası üretildi: " + invoiceNumber);
            } else {
                // Numara üretilemezse otomatik oluştur (ABC2026000000001 formatı)
                const seri = faturaKodu.substring(0, 3).toUpperCase().padEnd(3, "A");
                const yil = new Date().getFullYear();
                const sira = String(Math.floor(Math.random() * 999999999)).padStart(9, "0");
                invoiceNumber = seri + yil + sira;
                logger.warn("[QNB] Fatura no üretilemedi, otomatik oluşturuldu: " + invoiceNumber);
            }
        }

        // UBL-TR XML oluştur
        const { base64, uuid, totals } = buildInvoiceXml({
            profileId: "EARSIVFATURA",
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

        logger.info("[QNB] e-Arşiv UBL XML oluşturuldu — UUID: " + uuid + " FaturaNo: " + invoiceNumber);

        // QNB'ye gönder
        const result = await createEArchiveInvoice({
            sessionId,
            vkn: resolvedVkn,
            invoiceXml: base64,
            faturaTipi: invoiceData.invoiceTypeCode || "SATIS",
            env
        });

        if (result.success) {
            // ✅ FIX: QNB'nin döndürdüğü gerçek fatura numarasını ve URL'yi çıkar
            // QNB numaraVerilsinMi=1 olduğunda kendi numarasını atar (EAA... formatı)
            // resultExtra.entry[] içinde faturaNo, uuid, faturaURL döner
            let qnbFaturaNo = invoiceNumber;
            let qnbUuid = uuid;
            let faturaURL = "";

            const entries = result.data?.resultExtra?.entry;
            if (Array.isArray(entries)) {
                entries.forEach(entry => {
                    const key = entry.key?.$value || entry.key || "";
                    const val = entry.value?.$value || entry.value || "";
                    if (key === "faturaNo" && val) qnbFaturaNo = val;
                    if (key === "uuid" && val) qnbUuid = val;
                    if (key === "faturaURL" && val) faturaURL = val;
                });
            }

            if (qnbFaturaNo !== invoiceNumber) {
                logger.info("[QNB] QNB fatura numarası atadı: " + qnbFaturaNo + " (gönderilen: " + invoiceNumber + ")");
            }
            if (faturaURL) {
                logger.info("[QNB] Fatura URL: " + faturaURL);
            }

            return { ...result, uuid: qnbUuid, invoiceNumber: qnbFaturaNo, totals, faturaURL };
        }
        return result;
    } catch (error) {
        logger.error("[QNB] e-Arşiv form oluşturma hatası: " + error.message);
        return { success: false, error: error.message, status: 400 };
    }
};

/**
 * e-Arşiv fatura sorgula
 * EarsivWebService.faturaSorgula(input)
 */
const queryEArchiveInvoice = async ({ sessionId, vkn, uuid, faturaNo, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const [result] = await client.faturaSorgulaAsync({
            input: JSON.stringify({
                vkn: vkn || TEST_ACCOUNTS.earsiv.vkn,
                faturaUuid: uuid || "",
                faturaNo: faturaNo || "",
                islemId: crypto.randomUUID()
            })
        });

        const ret = result ? result.return : null;
        if (ret && ret.resultCode === "AE00000") {
            return { success: true, data: ret };
        }
        return { success: true, data: ret };
    } catch (error) {
        logger.error("[QNB] e-Arşiv fatura sorgu hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv fatura listesi sorgula
 * EarsivWebService.faturaListeSorgula(input)
 */
const listEArchiveInvoices = async ({ sessionId, vkn, searchParams = {}, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const resolvedVkn = vkn || TEST_ACCOUNTS.earsiv.vkn;

        // faturaListeSorgula input: JSON string
        // Bilinen alanlar: vkn, faturaUuid, faturaNo, baslangicTarih, bitisTarih,
        // maxTutar, dovizCinsi, yazdirildi, yalnizIptalEdilenFaturalar, siralamaYonu
        const inputObj = {
            vkn: resolvedVkn,
            islemId: crypto.randomUUID()
        };

        // Tarih aralığı — yyyyMMdd formatında
        if (searchParams.startDate) inputObj.baslangicTarih = searchParams.startDate;
        if (searchParams.endDate) inputObj.bitisTarih = searchParams.endDate;
        if (searchParams.faturaNo) inputObj.faturaNo = searchParams.faturaNo;
        if (searchParams.faturaUuid) inputObj.faturaUuid = searchParams.faturaUuid;

        logger.info("[QNB] e-Arşiv faturaListeSorgula input: " + JSON.stringify(inputObj));

        const [result] = await client.faturaListeSorgulaAsync({
            input: JSON.stringify(inputObj)
        });

        const ret = result ? result.return : null;
        const output = result ? result.output : null;

        return { success: true, data: output || ret };
    } catch (error) {
        logger.error("[QNB] e-Arşiv fatura listesi hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv fatura iptal et
 * EarsivWebService.faturaIptalEt(input)
 */
const cancelEArchiveInvoice = async ({ sessionId, vkn, uuid, faturaNo, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const [result] = await client.faturaIptalEtAsync({
            input: JSON.stringify({
                vkn: vkn || TEST_ACCOUNTS.earsiv.vkn,
                faturaUuid: uuid || "",
                faturaNo: faturaNo || "",
                islemId: crypto.randomUUID()
            })
        });

        const ret = result ? result.return : null;
        if (ret && ret.resultCode === "AE00000") {
            logger.info("[QNB] e-Arşiv fatura iptal edildi: " + (uuid || faturaNo));
            return { success: true, data: ret };
        }
        return { success: false, error: ret ? (ret.resultText || ret.resultCode) : "Bilinmeyen hata" };
    } catch (error) {
        logger.error("[QNB] e-Arşiv iptal hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv fatura önizleme (HTML/PDF)
 * EarsivWebService.faturaOnizleme(input, fatura)
 *
 * faturaOnizleme iki parametre alır:
 *   input: JSON string — { faturaUuid, faturaNo, vkn, islemId }
 *   fatura: opsiyonel — { belgeFormati, belgeIcerigi } (yeni fatura önizlemesi için)
 *
 * Mevcut faturayı önizlemek için sadece input yeterli (UUID ile).
 */
const previewEArchiveInvoice = async ({ sessionId, vkn, invoiceXml, uuid, faturaNo, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const resolvedVkn = vkn || TEST_ACCOUNTS.earsiv.vkn;

        // ✅ FIX: sube ve kasa alanları zorunlu — eksik olunca QNB hata veriyor
        // Hata: "Eksik alanlar: sube, kasa, bu alan(lar)ın boş olmadığından emin olunuz!"
        const inputData = {
            vkn: resolvedVkn,
            sube: "DFLT",
            kasa: "DFLT",
            islemId: crypto.randomUUID()
        };
        if (uuid) inputData.faturaUuid = uuid;
        if (faturaNo) inputData.faturaNo = faturaNo;

        const args = {
            input: JSON.stringify(inputData)
        };

        // Eğer ham XML verilmişse (yeni fatura önizlemesi), fatura parametresini de ekle
        if (invoiceXml && !uuid) {
            args.fatura = {
                belgeFormati: "UBL",
                belgeIcerigi: invoiceXml
            };
        }

        logger.info("[QNB] faturaOnizleme input: " + JSON.stringify(inputData));
        const [result] = await client.faturaOnizlemeAsync(args);

        const ret = result ? result.return : null;
        const output = result ? result.output : null;

        if (output) {
            return { success: true, data: output };
        }
        if (ret && ret.resultCode === "AE00000") {
            return { success: true, data: ret };
        }

        const errMsg = ret ? (ret.resultText || ret.resultCode || "Bilinmeyen hata") : "Yanıt alınamadı";
        logger.error("[QNB] e-Arşiv önizleme hatası: " + errMsg);
        return { success: false, error: errMsg };
    } catch (error) {
        logger.error("[QNB] e-Arşiv önizleme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv fatura ZIP indir
 * EarsivWebService.faturaZipiAl(input)
 *
 * QNB FaturaZipiAlInputData yalnızca 3 alan kabul eder:
 *   uuidList       — indirilecek faturaların UUID listesi (virgülle ayrılmış string)
 *   tasinanFaturalar — taşınan faturalar bayrağı (boolean/int, genelde 0)
 *   donenBelgeFormati — dönen belge formatı ("ZIP", "PDF" vb.)
 */
const downloadEArchiveZip = async ({ sessionId, uuid, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");

        if (!uuid) {
            return { success: false, error: "UUID gerekli — faturaZipiAl için fatura UUID'si belirtilmeli." };
        }

        // ✅ FIX: QNB FaturaZipiAlInputData alanları:
        //   uuidList: ArrayList<String> → JSON array olmalı
        //   tasinanFaturalar: Integer → 0 veya 1
        //   donenBelgeFormati: Integer → 0=ZIP, 1=PDF (String "ZIP" değil!)
        const inputData = {
            uuidList: [uuid],
            tasinanFaturalar: 0,
            donenBelgeFormati: 0
        };

        logger.info("[QNB] faturaZipiAl input: " + JSON.stringify(inputData));
        const [result] = await client.faturaZipiAlAsync({
            input: JSON.stringify(inputData)
        });

        // Yanıt yapısı: result.return (resultCode/resultText) + result.output (base64 ZIP)
        const ret = result ? result.return : null;
        const output = result ? result.output : null;

        if (ret && ret.resultCode === "AE00000" && output) {
            logger.info("[QNB] e-Arşiv ZIP indirildi: " + uuid);
            return { success: true, data: output };
        }

        // resultCode başarılı ama output yoksa, return'ü data olarak dön
        if (ret && ret.resultCode === "AE00000") {
            return { success: true, data: ret };
        }

        // Hata durumu
        const errMsg = ret ? (ret.resultText || ret.resultCode || "Bilinmeyen hata") : "Yanıt alınamadı";
        logger.error("[QNB] e-Arşiv ZIP indirme hatası: " + errMsg);
        return { success: false, error: errMsg };
    } catch (error) {
        logger.error("[QNB] e-Arşiv ZIP indirme hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv fatura e-posta gönder
 * EarsivWebService.ePostaGonder(input, ilaveEposta, tanimliEpostayaGonder)
 */
const sendEArchiveEmail = async ({ sessionId, vkn, uuid, faturaNo, ilaveEposta = "", tanimliEpostayaGonder = true, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const [result] = await client.ePostaGonderAsync({
            input: {
                vergiTcKimlikNo: vkn || TEST_ACCOUNTS.earsiv.vkn,
                uuid: uuid || "",
                faturaNo: faturaNo || ""
            },
            ilaveEposta: ilaveEposta,
            tanimliEpostayaGonder: tanimliEpostayaGonder
        });

        logger.info("[QNB] e-Arşiv e-posta gönderildi: " + (uuid || faturaNo));
        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] e-Arşiv e-posta hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv fatura SMS gönder
 * EarsivWebService.smsGonder(input, ilaveTelefonNo, tanimliTelefonNoyaGonder)
 */
const sendEArchiveSms = async ({ sessionId, vkn, uuid, faturaNo, ilaveTelefonNo = "", tanimliTelefonNoyaGonder = true, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const [result] = await client.smsGonderAsync({
            input: {
                vergiTcKimlikNo: vkn || TEST_ACCOUNTS.earsiv.vkn,
                uuid: uuid || "",
                faturaNo: faturaNo || ""
            },
            ilaveTelefonNo: ilaveTelefonNo,
            tanimliTelefonNoyaGonder: tanimliTelefonNoyaGonder
        });

        logger.info("[QNB] e-Arşiv SMS gönderildi: " + (uuid || faturaNo));
        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] e-Arşiv SMS hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * e-Arşiv yapılandırma ayarları
 * EarsivWebService.yapilandirmaAyarlariAl(input)
 */
const getEArchiveConfig = async ({ sessionId, vkn, env = "test" }) => {
    try {
        const client = await getAuthenticatedClient(sessionId, env, "earsiv");
        const [result] = await client.yapilandirmaAyarlariAlAsync({
            input: {
                vergiTcKimlikNo: vkn || TEST_ACCOUNTS.earsiv.vkn
            }
        });

        return { success: true, data: result ? result.return : null };
    } catch (error) {
        logger.error("[QNB] e-Arşiv yapılandırma hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  5. GENEL ARAMA & DURUM
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genel belge arama — documentType'a göre ilgili servisi çağırır
 */
const searchDocuments = async ({ sessionId, vkn, searchParams = {}, documentType, env = "test" }) => {
    try {
        switch (documentType) {
            case "outgoing-einvoice":
                return listOutgoingDocuments({ sessionId, vkn, searchParams, env });
            case "incoming-einvoice":
                return listIncomingDocuments({ sessionId, vkn, belgeTuru: "FATURA", sonSiraNo: searchParams.sonSiraNo || "0", env });
            case "outgoing-despatch":
                return listOutgoingDocuments({ sessionId, vkn, searchParams: { ...searchParams, belgeTuru: "IRSALIYE" }, env });
            case "incoming-despatch":
                return listIncomingDocuments({ sessionId, vkn, belgeTuru: "IRSALIYE", sonSiraNo: searchParams.sonSiraNo || "0", env });
            case "earchive": {
                // e-Arşiv servisi farklı credentials ile ayrı login gerektirir
                // Frontend'den gelen sessionId e-Fatura'ya ait, e-Arşiv'de geçersiz
                const earsivCreds = {
                    username: process.env.QNB_EARSIV_USERNAME || TEST_ACCOUNTS.earsiv.userCode,
                    password: process.env.QNB_EARSIV_PASSWORD || TEST_ACCOUNTS.earsiv.password,
                };
                logger.info("[QNB] e-Arşiv sorgusu için ayrı login yapılıyor — user: " + earsivCreds.username);
                const loginResult = await login({ ...earsivCreds, env, service: "earsiv" });
                if (!loginResult.success) {
                    logger.error("[QNB] e-Arşiv login başarısız: " + loginResult.error);
                    return { success: false, error: "e-Arşiv oturumu açılamadı: " + loginResult.error };
                }
                const earsivSessionId = loginResult.sessionId;
                const result = await listEArchiveInvoices({ sessionId: earsivSessionId, vkn, searchParams, env });
                // Session'ı temizle (tek kullanımlık)
                try { await logout({ sessionId: earsivSessionId, env, service: "earsiv" }); } catch (e) { /* ignore */ }
                return result;
            }
            default:
                return listOutgoingDocuments({ sessionId, vkn, searchParams, env });
        }
    } catch (error) {
        logger.error("[QNB] Belge arama hatası: " + extractSoapError(error));
        return { success: false, error: extractSoapError(error) };
    }
};

/**
 * Servis durumunu kontrol et (WSDL erişilebilirlik testi)
 */
const checkServiceStatus = async ({ env = "test" }) => {
    const results = {};
    const services = {
        efatura: getWsdlUrl(env, "efatura"),
        user: getWsdlUrl(env, "user"),
        earsiv: getWsdlUrl(env, "earsiv"),
        earsivUser: getWsdlUrl(env, "earsivUser")
    };

    for (const [name, url] of Object.entries(services)) {
        if (!url) {
            results[name] = { status: "not_configured", url: "" };
            continue;
        }
        try {
            await axios.get(url, { timeout: 10000 });
            results[name] = { status: "ok", url: url.split("?")[0] };
        } catch (error) {
            results[name] = {
                status: error.response ? "error_" + error.response.status : "unreachable",
                url: url.split("?")[0],
                error: error.message
            };
        }
    }

    return { success: true, services: results, erpCode: ERP_CODE };
};

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
    // Oturum
    login,
    logout,

    // e-Fatura (connectorService)
    checkEInvoiceUser,
    getEInvoiceUserInfo,
    getMukellefEtiketList,
    generateInvoiceNumber,
    sendEInvoice,
    getOutgoingStatus,
    getOutgoingStatusByEttn,
    getOutgoingStatusByBelgeNo,
    getInvoiceHistory,
    listOutgoingDocuments,
    listIncomingDocuments,
    fetchIncomingDocuments,
    downloadOutgoingDocuments,
    downloadIncomingDocuments,
    downloadOutgoingByEttn,
    downloadIncomingByEttn,
    getKontorInfo,
    listRegisteredEInvoiceUsers,
    sendInvoiceMail,
    markDocumentsReceived,

    // e-İrsaliye (connectorService)
    checkDespatchUser,
    generateDespatchNumber,
    sendDespatch,
    getDespatchHistory,

    // e-Arşiv (EarsivWebService)
    generateEArchiveNumber,
    createEArchiveInvoice,
    createEArchiveFromForm,
    queryEArchiveInvoice,
    listEArchiveInvoices,
    cancelEArchiveInvoice,
    previewEArchiveInvoice,
    downloadEArchiveZip,
    sendEArchiveEmail,
    sendEArchiveSms,
    getEArchiveConfig,

    // Genel
    searchDocuments,
    checkServiceStatus,
    clearSessionClient,

    // Sabitler
    WSDL,
    ERP_CODE,
    TEST_ACCOUNTS
};
