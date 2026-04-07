const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const eInvoiceController = require("../controllers/eInvoiceController");

// ✅ Tüm route'lara auth + subscription kontrolü uygula (callback hariç)
router.use((req, res, next) => {
    // Ödeal callback endpoint'i auth gerektirmez
    if (req.path === "/odeal/callback" && req.method === "POST") return next();
    authMiddleware(req, res, (err) => {
        if (err) return;
        subscriptionMiddleware(req, res, next);
    });
});

/**
 * E-FATURA ROUTES — LysiaETIC
 * Prefix: /api/e-invoice
 *
 * Çoklu sağlayıcı desteği:
 *   - Trendyol E-Faturam  → /api/e-invoice/trendyol/*
 *   - QNB eSolutions      → /api/e-invoice/qnb/*
 *   - Sovos (Foriba)      → /api/e-invoice/sovos/*
 *   - Genel (eski uyum)   → /api/e-invoice/*
 */

// ═══════════════════════════════════════════════════════════════════════════
//  TRENDYOL E-FATURAM (mevcut + yeni prefix)
// ═══════════════════════════════════════════════════════════════════════════

// Auth
router.post("/partner-login", eInvoiceController.partnerLogin);
router.post("/customer-login", eInvoiceController.customerLogin);
router.post("/trendyol/partner-login", eInvoiceController.partnerLogin);
router.post("/trendyol/customer-login", eInvoiceController.customerLogin);

// E-Arşiv
router.post("/earchive/create", eInvoiceController.createEArchive);
router.post("/earchive/:invoiceId/status", eInvoiceController.getEArchiveStatus);
router.post("/earchive/:invoiceId/cancel", eInvoiceController.cancelEArchive);
router.post("/trendyol/earchive/create", eInvoiceController.createEArchive);

// E-Fatura (Giden)
router.post("/outgoing/create", eInvoiceController.createOutgoingEInvoice);
router.post("/trendyol/outgoing/create", eInvoiceController.createOutgoingEInvoice);

// E-Fatura (Gelen)
router.post("/incoming/search", eInvoiceController.searchIncomingEInvoices);
router.post("/trendyol/incoming/search", eInvoiceController.searchIncomingEInvoices);

// E-İrsaliye
router.post("/despatch/create", eInvoiceController.createDespatchAdvice);
router.post("/trendyol/despatch/create", eInvoiceController.createDespatchAdvice);

// Mükellef & Firma
router.post("/taxpayers", eInvoiceController.getTaxpayers);
router.post("/corporate-info", eInvoiceController.getCorporateInfo);

// Genel Belge Arama (Trendyol)
router.post("/documents/search", eInvoiceController.searchDocuments);
router.post("/trendyol/documents/search", eInvoiceController.searchDocuments);

// ═══════════════════════════════════════════════════════════════════════════
//  QNB eSolutions (SOAP API)
//  connectorService → e-Fatura & e-İrsaliye
//  EarsivWebService → e-Arşiv
//  userService      → Oturum (wsLogin / logout)
// ═══════════════════════════════════════════════════════════════════════════

// Oturum
router.post("/qnb/login", eInvoiceController.qnbLogin);
router.post("/qnb/logout", eInvoiceController.qnbLogout);

// e-Fatura — Kullanıcı & Mükellef Sorgulama
router.post("/qnb/einvoice/user-check", eInvoiceController.qnbCheckUser);
router.post("/qnb/einvoice/user-info", eInvoiceController.qnbGetUserInfo);
router.post("/qnb/einvoice/etiket-list", eInvoiceController.qnbGetEtiketList);

// e-Fatura — Numara Üretme & Gönderme
router.post("/qnb/einvoice/generate-no", eInvoiceController.qnbGenerateInvoiceNo);
router.post("/qnb/einvoice/send", eInvoiceController.qnbSendEInvoice);

// e-Fatura — Durum Sorgulama
router.post("/qnb/einvoice/status", eInvoiceController.qnbGetOutgoingStatus);
router.post("/qnb/einvoice/status-ettn", eInvoiceController.qnbGetOutgoingStatusByEttn);
router.post("/qnb/einvoice/history", eInvoiceController.qnbGetInvoiceHistory);

// e-Fatura — Listeleme
router.post("/qnb/einvoice/outgoing/list", eInvoiceController.qnbListOutgoing);
router.post("/qnb/einvoice/incoming/list", eInvoiceController.qnbListIncoming);
router.post("/qnb/einvoice/incoming/fetch", eInvoiceController.qnbFetchIncoming);

// e-Fatura — İndirme
router.post("/qnb/einvoice/outgoing/download", eInvoiceController.qnbDownloadOutgoing);
router.post("/qnb/einvoice/incoming/download", eInvoiceController.qnbDownloadIncoming);
router.post("/qnb/einvoice/outgoing/download-ettn", eInvoiceController.qnbDownloadOutgoingByEttn);
router.post("/qnb/einvoice/incoming/download-ettn", eInvoiceController.qnbDownloadIncomingByEttn);

// e-Fatura — Kontör & Mail & Alındı
router.post("/qnb/einvoice/kontor", eInvoiceController.qnbGetKontorInfo);
router.post("/qnb/einvoice/mail", eInvoiceController.qnbSendInvoiceMail);
router.post("/qnb/einvoice/mark-received", eInvoiceController.qnbMarkReceived);

// e-İrsaliye
router.post("/qnb/despatch/user-check", eInvoiceController.qnbCheckDespatchUser);
router.post("/qnb/despatch/generate-no", eInvoiceController.qnbGenerateDespatchNo);
router.post("/qnb/despatch/send", eInvoiceController.qnbSendDespatch);

// e-Arşiv — Numara & Oluşturma
router.post("/qnb/earchive/generate-no", eInvoiceController.qnbGenerateEArchiveNo);
router.post("/qnb/earchive/create", eInvoiceController.qnbCreateEArchive);
router.post("/qnb/earchive/create-from-form", eInvoiceController.qnbCreateEArchiveFromForm);

// e-Arşiv — Sorgulama & Listeleme
router.post("/qnb/earchive/query", eInvoiceController.qnbQueryEArchive);
router.post("/qnb/earchive/list", eInvoiceController.qnbListEArchive);

// e-Arşiv — İptal & Önizleme & İndirme
router.post("/qnb/earchive/cancel", eInvoiceController.qnbCancelEArchive);
router.post("/qnb/earchive/preview", eInvoiceController.qnbPreviewEArchive);
router.post("/qnb/earchive/download-zip", eInvoiceController.qnbDownloadEArchiveZip);

// e-Arşiv — Bildirim (E-Posta & SMS)
router.post("/qnb/earchive/send-email", eInvoiceController.qnbSendEArchiveEmail);
router.post("/qnb/earchive/send-sms", eInvoiceController.qnbSendEArchiveSms);

// Genel Belge Arama & Servis Durumu
router.post("/qnb/documents/search", eInvoiceController.qnbSearchDocuments);
router.post("/qnb/status", eInvoiceController.qnbCheckServiceStatus);

// ═══════════════════════════════════════════════════════════════════════════
//  SOVOS (Foriba)
// ═══════════════════════════════════════════════════════════════════════════

// Auth (OAuth 2.0)
router.post("/sovos/token", eInvoiceController.sovosGetToken);

// Belge İşlemleri
router.post("/sovos/documents/send", eInvoiceController.sovosSendDocument);
router.post("/sovos/documents/:referenceId/status", eInvoiceController.sovosGetDocumentStatus);

// e-Arşiv
router.post("/sovos/earchive/send", eInvoiceController.sovosSendEArchive);

// API Durumu
router.post("/sovos/status", eInvoiceController.sovosCheckStatus);

// Belge Arama
router.post("/sovos/documents/search", eInvoiceController.sovosSearchDocuments);

// ═══════════════════════════════════════════════════════════════════════════
//  PARAŞÜT
// ═══════════════════════════════════════════════════════════════════════════

// Auth (OAuth 2.0 — grant_type=password)
router.post("/parasut/token", eInvoiceController.parasutGetToken);
router.post("/parasut/refresh-token", eInvoiceController.parasutRefreshToken);
router.post("/parasut/me", eInvoiceController.parasutGetUserInfo);

// Satış Faturaları
router.post("/parasut/invoices/list", eInvoiceController.parasutListInvoices);
router.post("/parasut/invoices/create", eInvoiceController.parasutCreateInvoice);

// Resmileştirme (e-Fatura / e-Arşiv)
router.post("/parasut/einvoice-inbox", eInvoiceController.parasutCheckEInvoiceInbox);
router.post("/parasut/earchive/create", eInvoiceController.parasutCreateEArchive);
router.post("/parasut/einvoice/create", eInvoiceController.parasutCreateEInvoice);

// Trackable Job (asenkron işlem takibi)
router.post("/parasut/jobs/:jobId/status", eInvoiceController.parasutGetJobStatus);

// Müşteri/Tedarikçi & Ürün
router.post("/parasut/contacts/list", eInvoiceController.parasutListContacts);
router.post("/parasut/products/list", eInvoiceController.parasutListProducts);

// Belge Arama (Genel)
router.post("/parasut/documents/search", eInvoiceController.parasutSearchDocuments);

// ═══════════════════════════════════════════════════════════════════════════
//  ÖDEAL (E-FaturaPos / SadePos)
// ═══════════════════════════════════════════════════════════════════════════

// Auth (Servis Anahtarı Doğrulama)
router.post("/odeal/validate-key", eInvoiceController.odealValidateKey);

// Birim Servisi
router.post("/odeal/units", eInvoiceController.odealGetUnits);

// Sepet İşlemleri
router.post("/odeal/basket/create", eInvoiceController.odealCreateBasket);
router.post("/odeal/basket/list", eInvoiceController.odealListBaskets);
router.delete("/odeal/basket/:basketId", eInvoiceController.odealDeleteBasket);

// Konfigürasyon
router.post("/odeal/configuration", eInvoiceController.odealSaveConfig);

// Raporlama
router.post("/odeal/report/transactions", eInvoiceController.odealGetReport);
router.post("/odeal/report/transactions/:transactionId", eInvoiceController.odealGetTransactionDetail);

// Belge Arama (BillingPage uyumlu)
router.post("/odeal/documents/search", eInvoiceController.odealSearchDocuments);

// Webhook Callback (auth gerektirmez — Ödeal'dan gelir — router.use middleware atlanır)
router.post("/odeal/callback", eInvoiceController.odealCallback);

module.exports = router;
