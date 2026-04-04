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
//  QNB eSolutions
// ═══════════════════════════════════════════════════════════════════════════

// Auth
router.post("/qnb/login", eInvoiceController.qnbLogin);

// e-Fatura
router.post("/qnb/einvoice/send", eInvoiceController.qnbSendEInvoice);
router.post("/qnb/einvoice/user-check", eInvoiceController.qnbCheckUser);

// e-Arşiv
router.post("/qnb/earchive/send", eInvoiceController.qnbSendEArchive);

// e-İrsaliye
router.post("/qnb/despatch/send", eInvoiceController.qnbSendDespatch);

// Belge Arama
router.post("/qnb/documents/search", eInvoiceController.qnbSearchDocuments);

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
