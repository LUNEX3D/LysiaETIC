const axios = require("axios");
const logger = require("../config/logger");

/**
 * PARAŞÜT API V4 SERVİSİ — LysiaETIC
 *
 * Paraşüt muhasebe ve e-Fatura entegrasyonu.
 * API Docs: https://apidocs.parasut.com/
 *
 * Auth: OAuth 2.0 (grant_type=password)
 *   - client_id + client_secret + email + password → access_token (2 saat) + refresh_token
 *
 * Base URL: https://api.parasut.com/v4/{company_id}
 * Rate Limit: 10 istek / 10 saniye
 * Format: JSONAPI (http://jsonapi.org/)
 */

const BASE_URL = "https://api.parasut.com";

// ═══════════════════════════════════════════════════════════════════════════
//  YARDIMCI FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Paraşüt API isteği gönder
 */
const makeRequest = async ({ method, url, token, data, params }) => {
    try {
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        };
        if (token) {
            headers["Authorization"] = "Bearer " + token;
        }

        const response = await axios({
            method,
            url,
            headers,
            data,
            params,
            timeout: 30000,
        });

        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        const status = error.response ? error.response.status : 500;
        const errData = error.response ? error.response.data : null;
        const errMsg = errData && errData.errors
            ? errData.errors.map(e => e.detail || e.title).join(", ")
            : error.message;

        logger.error("[Parasut Service] API Hatası: " + method.toUpperCase() + " " + url + " → " + status + " " + errMsg);

        return {
            success: false,
            error: errMsg,
            status,
            data: errData,
        };
    }
};

// ═══════════════════════════════════════════════════════════════════════════
//  1. KİMLİK DOĞRULAMA (OAuth 2.0)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * OAuth 2.0 ile access_token al (grant_type=password)
 * @param {Object} params
 * @param {string} params.clientId - Paraşüt Client ID
 * @param {string} params.clientSecret - Paraşüt Client Secret
 * @param {string} params.email - Kullanıcı e-posta
 * @param {string} params.password - Kullanıcı şifre
 * @returns {Object} { success, accessToken, refreshToken, expiresIn, tokenType, companyId }
 */
const getAccessToken = async ({ clientId, clientSecret, email, password }) => {
    logger.info("[Parasut] OAuth token alınıyor: " + email);

    const result = await makeRequest({
        method: "post",
        url: BASE_URL + "/oauth/token",
        data: {
            grant_type: "password",
            client_id: clientId,
            client_secret: clientSecret,
            username: email,
            password: password,
            redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
        },
    });

    if (!result.success) {
        return { success: false, error: result.error || "OAuth token alınamadı", status: result.status };
    }

    const tokenData = result.data;
    logger.info("[Parasut] OAuth token başarıyla alındı. Expires in: " + tokenData.expires_in + "s");

    return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        createdAt: tokenData.created_at,
    };
};

/**
 * Refresh token ile yeni access_token al
 * @param {Object} params
 * @param {string} params.clientId
 * @param {string} params.clientSecret
 * @param {string} params.refreshToken
 * @returns {Object} { success, accessToken, refreshToken, expiresIn }
 */
const refreshAccessToken = async ({ clientId, clientSecret, refreshToken }) => {
    logger.info("[Parasut] Token yenileniyor...");

    const result = await makeRequest({
        method: "post",
        url: BASE_URL + "/oauth/token",
        data: {
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
        },
    });

    if (!result.success) {
        return { success: false, error: result.error || "Token yenilenemedi", status: result.status };
    }

    const tokenData = result.data;
    logger.info("[Parasut] Token başarıyla yenilendi.");

    return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
    };
};

/**
 * Kullanıcı bilgilerini al (/me endpoint)
 * @param {Object} params
 * @param {string} params.token - Access token
 * @returns {Object} { success, data } — kullanıcı bilgileri ve firma listesi
 */
const getUserInfo = async ({ token }) => {
    logger.info("[Parasut] Kullanıcı bilgileri alınıyor...");

    const result = await makeRequest({
        method: "get",
        url: BASE_URL + "/me",
        token,
    });

    if (!result.success) {
        return { success: false, error: result.error, status: result.status };
    }

    // Firma ID'lerini çıkar
    const userData = result.data;
    let companies = [];
    if (userData && userData.data && userData.data.relationships && userData.data.relationships.companies) {
        companies = (userData.data.relationships.companies.data || []).map(c => ({
            id: c.id,
            type: c.type,
        }));
    }

    return {
        success: true,
        data: userData.data,
        companies,
        userId: userData.data ? userData.data.id : null,
    };
};

// ═══════════════════════════════════════════════════════════════════════════
//  2. SATIŞ FATURASI İŞLEMLERİ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Satış faturalarını listele
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.companyId - Firma ID
 * @param {Object} params.filters - { archived, query, invoice_status, status }
 * @param {number} params.page - Sayfa numarası
 * @param {string} params.sort - Sıralama (id, issue_date, description, net_total_in_trl)
 * @param {string} params.include - İlişkiler (contact, details, payments, active_e_document)
 */
const listSalesInvoices = async ({ token, companyId, filters, page, sort, include }) => {
    logger.info("[Parasut] Satış faturaları listeleniyor. Firma: " + companyId);

    const params = {};
    if (filters) {
        if (filters.archived !== undefined) params["filter[archived]"] = filters.archived;
        if (filters.query) params["filter[query]"] = filters.query;
        if (filters.invoice_status) params["filter[invoice_status]"] = filters.invoice_status;
        if (filters.status) params["filter[status]"] = filters.status;
        if (filters.issue_date) params["filter[issue_date]"] = filters.issue_date;
        if (filters.due_date) params["filter[due_date]"] = filters.due_date;
    }
    if (page) params["page[number]"] = page;
    if (sort) params["sort"] = sort;
    if (include) params["include"] = include;

    const result = await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/sales_invoices",
        token,
        params,
    });

    return result;
};

/**
 * Satış faturası detayını getir
 */
const getSalesInvoice = async ({ token, companyId, invoiceId, include }) => {
    logger.info("[Parasut] Satış faturası detayı: " + invoiceId);

    const params = {};
    if (include) params["include"] = include;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/sales_invoices/" + invoiceId,
        token,
        params,
    });
};

/**
 * Satış faturası oluştur
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.companyId
 * @param {Object} params.invoiceData - JSONAPI formatında fatura verisi
 */
const createSalesInvoice = async ({ token, companyId, invoiceData }) => {
    logger.info("[Parasut] Satış faturası oluşturuluyor. Firma: " + companyId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/sales_invoices",
        token,
        data: invoiceData,
    });
};

/**
 * Satış faturası güncelle
 */
const updateSalesInvoice = async ({ token, companyId, invoiceId, invoiceData }) => {
    logger.info("[Parasut] Satış faturası güncelleniyor: " + invoiceId);

    return await makeRequest({
        method: "put",
        url: BASE_URL + "/v4/" + companyId + "/sales_invoices/" + invoiceId,
        token,
        data: invoiceData,
    });
};

/**
 * Satış faturası sil
 */
const deleteSalesInvoice = async ({ token, companyId, invoiceId }) => {
    logger.info("[Parasut] Satış faturası siliniyor: " + invoiceId);

    return await makeRequest({
        method: "delete",
        url: BASE_URL + "/v4/" + companyId + "/sales_invoices/" + invoiceId,
        token,
    });
};

/**
 * Satış faturasına tahsilat ekle
 */
const addPaymentToInvoice = async ({ token, companyId, invoiceId, paymentData }) => {
    logger.info("[Parasut] Faturaya tahsilat ekleniyor: " + invoiceId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/sales_invoices/" + invoiceId + "/payments",
        token,
        data: paymentData,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  3. RESMİLEŞTİRME (e-Fatura / e-Arşiv / e-SMM)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * e-Fatura gelen kutusunu kontrol et (müşterinin e-Fatura kullanıcısı olup olmadığını öğren)
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.companyId
 * @param {string} params.vkn - Vergi kimlik numarası
 */
const checkEInvoiceInbox = async ({ token, companyId, vkn }) => {
    logger.info("[Parasut] e-Fatura gelen kutusu kontrol: VKN " + vkn);

    const params = {};
    if (vkn) params["filter[vkn]"] = vkn;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/e_invoice_inboxes",
        token,
        params,
    });
};

/**
 * e-Arşiv oluştur
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.companyId
 * @param {Object} params.eArchiveData - e-Arşiv verisi (sales_invoice ilişkisi ile)
 * @returns {Object} { success, data } — trackable_job id döner
 */
const createEArchive = async ({ token, companyId, eArchiveData }) => {
    logger.info("[Parasut] e-Arşiv oluşturuluyor. Firma: " + companyId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/e_archives",
        token,
        data: eArchiveData,
    });
};

/**
 * e-Arşiv bilgilerini getir
 */
const getEArchive = async ({ token, companyId, eArchiveId }) => {
    logger.info("[Parasut] e-Arşiv bilgileri: " + eArchiveId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/e_archives/" + eArchiveId,
        token,
    });
};

/**
 * e-Arşiv PDF URL'ini al
 */
const getEArchivePdf = async ({ token, companyId, eArchiveId }) => {
    logger.info("[Parasut] e-Arşiv PDF: " + eArchiveId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/e_archives/" + eArchiveId + "/pdf",
        token,
    });
};

/**
 * e-Fatura oluştur
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.companyId
 * @param {Object} params.eInvoiceData - e-Fatura verisi
 * @returns {Object} { success, data } — trackable_job id döner
 */
const createEInvoice = async ({ token, companyId, eInvoiceData }) => {
    logger.info("[Parasut] e-Fatura oluşturuluyor. Firma: " + companyId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/e_invoices",
        token,
        data: eInvoiceData,
    });
};

/**
 * e-Fatura bilgilerini getir
 */
const getEInvoice = async ({ token, companyId, eInvoiceId }) => {
    logger.info("[Parasut] e-Fatura bilgileri: " + eInvoiceId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/e_invoices/" + eInvoiceId,
        token,
    });
};

/**
 * e-Fatura PDF URL'ini al
 */
const getEInvoicePdf = async ({ token, companyId, eInvoiceId }) => {
    logger.info("[Parasut] e-Fatura PDF: " + eInvoiceId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/e_invoices/" + eInvoiceId + "/pdf",
        token,
    });
};

/**
 * e-SMM oluştur
 */
const createESmm = async ({ token, companyId, eSmmData }) => {
    logger.info("[Parasut] e-SMM oluşturuluyor. Firma: " + companyId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/e_smms",
        token,
        data: eSmmData,
    });
};

/**
 * e-SMM bilgilerini getir
 */
const getESmm = async ({ token, companyId, eSmmId }) => {
    logger.info("[Parasut] e-SMM bilgileri: " + eSmmId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/e_smms/" + eSmmId,
        token,
    });
};

/**
 * e-SMM PDF URL'ini al
 */
const getESmmPdf = async ({ token, companyId, eSmmId }) => {
    logger.info("[Parasut] e-SMM PDF: " + eSmmId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/e_smms/" + eSmmId + "/pdf",
        token,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  4. MÜŞTERİ / TEDARİKÇİ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Müşteri/Tedarikçi listele
 */
const listContacts = async ({ token, companyId, filters, page, include }) => {
    logger.info("[Parasut] Müşteri/Tedarikçi listeleniyor. Firma: " + companyId);

    const params = {};
    if (filters) {
        if (filters.name) params["filter[name]"] = filters.name;
        if (filters.email) params["filter[email]"] = filters.email;
        if (filters.tax_number) params["filter[tax_number]"] = filters.tax_number;
        if (filters.tax_office) params["filter[tax_office]"] = filters.tax_office;
        if (filters.city) params["filter[city]"] = filters.city;
        if (filters.account_type) params["filter[account_type]"] = filters.account_type;
    }
    if (page) params["page[number]"] = page;
    if (include) params["include"] = include;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/contacts",
        token,
        params,
    });
};

/**
 * Müşteri/Tedarikçi oluştur
 */
const createContact = async ({ token, companyId, contactData }) => {
    logger.info("[Parasut] Müşteri/Tedarikçi oluşturuluyor. Firma: " + companyId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/contacts",
        token,
        data: contactData,
    });
};

/**
 * Müşteri/Tedarikçi detayı
 */
const getContact = async ({ token, companyId, contactId, include }) => {
    const params = {};
    if (include) params["include"] = include;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/contacts/" + contactId,
        token,
        params,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  5. ÜRÜN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ürün listele
 */
const listProducts = async ({ token, companyId, filters, page }) => {
    logger.info("[Parasut] Ürünler listeleniyor. Firma: " + companyId);

    const params = {};
    if (filters) {
        if (filters.name) params["filter[name]"] = filters.name;
        if (filters.code) params["filter[code]"] = filters.code;
    }
    if (page) params["page[number]"] = page;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/products",
        token,
        params,
    });
};

/**
 * Ürün oluştur
 */
const createProduct = async ({ token, companyId, productData }) => {
    logger.info("[Parasut] Ürün oluşturuluyor. Firma: " + companyId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/products",
        token,
        data: productData,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  6. İRSALİYE (STOK)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * İrsaliye listele
 */
const listShipmentDocuments = async ({ token, companyId, filters, page }) => {
    logger.info("[Parasut] İrsaliyeler listeleniyor. Firma: " + companyId);

    const params = {};
    if (filters) {
        if (filters.invoice_id) params["filter[invoice_id]"] = filters.invoice_id;
    }
    if (page) params["page[number]"] = page;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/shipment_documents",
        token,
        params,
    });
};

/**
 * İrsaliye oluştur
 */
const createShipmentDocument = async ({ token, companyId, shipmentData }) => {
    logger.info("[Parasut] İrsaliye oluşturuluyor. Firma: " + companyId);

    return await makeRequest({
        method: "post",
        url: BASE_URL + "/v4/" + companyId + "/shipment_documents",
        token,
        data: shipmentData,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  7. GİDER (FİŞ / FATURA)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gider faturalarını listele
 */
const listPurchaseBills = async ({ token, companyId, filters, page, include }) => {
    logger.info("[Parasut] Gider faturaları listeleniyor. Firma: " + companyId);

    const params = {};
    if (filters) {
        if (filters.archived !== undefined) params["filter[archived]"] = filters.archived;
        if (filters.query) params["filter[query]"] = filters.query;
    }
    if (page) params["page[number]"] = page;
    if (include) params["include"] = include;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/purchase_bills",
        token,
        params,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  8. KASA VE BANKA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kasa/Banka hesaplarını listele
 */
const listAccounts = async ({ token, companyId }) => {
    logger.info("[Parasut] Kasa/Banka hesapları listeleniyor. Firma: " + companyId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/accounts",
        token,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  9. TRACKABLE JOB (İşlem Takibi)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trackable job durumunu sorgula
 * e-Fatura/e-Arşiv/e-SMM oluşturma işlemleri asenkron çalışır.
 * Bu endpoint ile işlem durumunu takip edebilirsiniz.
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.companyId
 * @param {string} params.jobId - Trackable job ID
 * @returns {Object} { success, data } — status: pending | running | error | done
 */
const getTrackableJob = async ({ token, companyId, jobId }) => {
    logger.info("[Parasut] Trackable job durumu: " + jobId);

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/trackable_jobs/" + jobId,
        token,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  10. TEKLİF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Teklifleri listele
 */
const listSalesOffers = async ({ token, companyId, filters, page, sort, include }) => {
    logger.info("[Parasut] Teklifler listeleniyor. Firma: " + companyId);

    const params = {};
    if (filters) {
        if (filters.archived !== undefined) params["filter[archived]"] = filters.archived;
        if (filters.query) params["filter[query]"] = filters.query;
        if (filters.invoice_status) params["filter[invoice_status]"] = filters.invoice_status;
        if (filters.status) params["filter[status]"] = filters.status;
    }
    if (page) params["page[number]"] = page;
    if (sort) params["sort"] = sort;
    if (include) params["include"] = include;

    return await makeRequest({
        method: "get",
        url: BASE_URL + "/v4/" + companyId + "/sales_offers",
        token,
        params,
    });
};

// ═══════════════════════════════════════════════════════════════════════════
//  11. GENEL BELGE ARAMA (BillingPage uyumlu)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Belge arama — BillingPage'in fetchAllDocuments fonksiyonu ile uyumlu
 * documentType'a göre ilgili endpoint'e yönlendirir
 * @param {Object} params
 * @param {string} params.token
 * @param {string} params.companyId
 * @param {string} params.documentType - earchive | outgoing-einvoice | incoming-einvoice | despatch-advice
 * @param {Object} params.searchParams - Filtreler
 */
const searchDocuments = async ({ token, companyId, documentType, searchParams }) => {
    logger.info("[Parasut] Belge arama: " + documentType + " Firma: " + companyId);

    if (!companyId) {
        return { success: false, error: "Firma ID (companyId) gerekli", status: 400 };
    }

    const filters = searchParams || {};
    let result;

    switch (documentType) {
        case "earchive":
            // Satış faturalarını listele, e-Arşiv olanları filtrele
            result = await listSalesInvoices({
                token,
                companyId,
                filters: { ...filters, invoice_status: "archived" },
                include: "contact,active_e_document",
                sort: "-issue_date",
            });
            break;

        case "outgoing-einvoice":
            // Satış faturalarını listele
            result = await listSalesInvoices({
                token,
                companyId,
                filters: { ...filters },
                include: "contact,active_e_document",
                sort: "-issue_date",
            });
            break;

        case "incoming-einvoice":
            // Gider faturalarını listele (gelen faturalar)
            result = await listPurchaseBills({
                token,
                companyId,
                filters: { ...filters },
                include: "contact",
            });
            break;

        case "despatch-advice":
            // İrsaliyeleri listele
            result = await listShipmentDocuments({
                token,
                companyId,
                filters: { ...filters },
            });
            break;

        default:
            // Varsayılan: tüm satış faturaları
            result = await listSalesInvoices({
                token,
                companyId,
                filters: { ...filters },
                include: "contact",
                sort: "-issue_date",
            });
    }

    if (!result.success) {
        return result;
    }

    // JSONAPI formatından normalize et
    const rawData = result.data;
    const items = rawData && rawData.data ? (Array.isArray(rawData.data) ? rawData.data : [rawData.data]) : [];
    const included = rawData && rawData.included ? rawData.included : [];

    // Contact bilgilerini included'dan çıkar
    const contactMap = {};
    included.forEach(inc => {
        if (inc.type === "contacts") {
            contactMap[inc.id] = inc.attributes || {};
        }
    });

    const documents = items.map(item => {
        const attrs = item.attributes || {};
        const rels = item.relationships || {};

        // Contact bilgisini bul
        let contactName = "";
        let contactVkn = "";
        if (rels.contact && rels.contact.data && rels.contact.data.id) {
            const contact = contactMap[rels.contact.data.id];
            if (contact) {
                contactName = contact.name || contact.short_name || "";
                contactVkn = contact.tax_number || "";
            }
        }

        return {
            id: item.id,
            type: item.type,
            invoiceNumber: attrs.item_type === "refund" ? "İADE-" + item.id : (attrs.description || "PRŞ-" + item.id),
            documentNumber: item.id,
            invoiceDate: attrs.issue_date || "",
            receiverName: contactName,
            receiverTaxNumber: contactVkn,
            amount: Number(attrs.net_total || 0),
            taxAmount: Number(attrs.total_vat || 0),
            payableAmount: Number(attrs.gross_total || 0),
            currency: attrs.currency || "TRL",
            status: attrs.archived ? "archived" : (attrs.invoice_status || attrs.status || "active"),
            description: attrs.description || "",
        };
    });

    const meta = rawData && rawData.meta ? rawData.meta : {};

    return {
        success: true,
        data: documents,
        meta: {
            currentPage: meta.current_page || 1,
            totalPages: meta.total_pages || 1,
            totalCount: meta.total_count || documents.length,
        },
    };
};

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
    // Auth
    getAccessToken,
    refreshAccessToken,
    getUserInfo,

    // Satış Faturası
    listSalesInvoices,
    getSalesInvoice,
    createSalesInvoice,
    updateSalesInvoice,
    deleteSalesInvoice,
    addPaymentToInvoice,

    // Resmileştirme
    checkEInvoiceInbox,
    createEArchive,
    getEArchive,
    getEArchivePdf,
    createEInvoice,
    getEInvoice,
    getEInvoicePdf,
    createESmm,
    getESmm,
    getESmmPdf,

    // Müşteri/Tedarikçi
    listContacts,
    createContact,
    getContact,

    // Ürün
    listProducts,
    createProduct,

    // İrsaliye
    listShipmentDocuments,
    createShipmentDocument,

    // Gider
    listPurchaseBills,

    // Kasa/Banka
    listAccounts,

    // Trackable Job
    getTrackableJob,

    // Teklif
    listSalesOffers,

    // Genel Belge Arama
    searchDocuments,
};
