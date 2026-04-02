const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const eInvoiceController = require("../controllers/eInvoiceController");

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
router.post("/partner-login", authMiddleware, eInvoiceController.partnerLogin);
router.post("/customer-login", authMiddleware, eInvoiceController.customerLogin);
router.post("/trendyol/partner-login", authMiddleware, eInvoiceController.partnerLogin);
router.post("/trendyol/customer-login", authMiddleware, eInvoiceController.customerLogin);

// E-Arşiv
router.post("/earchive/create", authMiddleware, eInvoiceController.createEArchive);
router.post("/earchive/:invoiceId/status", authMiddleware, eInvoiceController.getEArchiveStatus);
router.post("/earchive/:invoiceId/cancel", authMiddleware, eInvoiceController.cancelEArchive);
router.post("/trendyol/earchive/create", authMiddleware, eInvoiceController.createEArchive);

// E-Fatura (Giden)
router.post("/outgoing/create", authMiddleware, eInvoiceController.createOutgoingEInvoice);
router.post("/trendyol/outgoing/create", authMiddleware, eInvoiceController.createOutgoingEInvoice);

// E-Fatura (Gelen)
router.post("/incoming/search", authMiddleware, eInvoiceController.searchIncomingEInvoices);
router.post("/trendyol/incoming/search", authMiddleware, eInvoiceController.searchIncomingEInvoices);

// E-İrsaliye
router.post("/despatch/create", authMiddleware, eInvoiceController.createDespatchAdvice);
router.post("/trendyol/despatch/create", authMiddleware, eInvoiceController.createDespatchAdvice);

// Mükellef & Firma
router.post("/taxpayers", authMiddleware, eInvoiceController.getTaxpayers);
router.post("/corporate-info", authMiddleware, eInvoiceController.getCorporateInfo);

// Genel Belge Arama (Trendyol)
router.post("/documents/search", authMiddleware, eInvoiceController.searchDocuments);
router.post("/trendyol/documents/search", authMiddleware, eInvoiceController.searchDocuments);

// ═══════════════════════════════════════════════════════════════════════════
//  QNB eSolutions
// ═══════════════════════════════════════════════════════════════════════════

// Auth
router.post("/qnb/login", authMiddleware, eInvoiceController.qnbLogin);

// e-Fatura
router.post("/qnb/einvoice/send", authMiddleware, eInvoiceController.qnbSendEInvoice);
router.post("/qnb/einvoice/user-check", authMiddleware, eInvoiceController.qnbCheckUser);

// e-Arşiv
router.post("/qnb/earchive/send", authMiddleware, eInvoiceController.qnbSendEArchive);

// e-İrsaliye
router.post("/qnb/despatch/send", authMiddleware, eInvoiceController.qnbSendDespatch);

// Belge Arama
router.post("/qnb/documents/search", authMiddleware, eInvoiceController.qnbSearchDocuments);

// ═══════════════════════════════════════════════════════════════════════════
//  SOVOS (Foriba)
// ═══════════════════════════════════════════════════════════════════════════

// Auth (OAuth 2.0)
router.post("/sovos/token", authMiddleware, eInvoiceController.sovosGetToken);

// Belge İşlemleri
router.post("/sovos/documents/send", authMiddleware, eInvoiceController.sovosSendDocument);
router.post("/sovos/documents/:referenceId/status", authMiddleware, eInvoiceController.sovosGetDocumentStatus);

// e-Arşiv
router.post("/sovos/earchive/send", authMiddleware, eInvoiceController.sovosSendEArchive);

// API Durumu
router.post("/sovos/status", authMiddleware, eInvoiceController.sovosCheckStatus);

// Belge Arama
router.post("/sovos/documents/search", authMiddleware, eInvoiceController.sovosSearchDocuments);

// ═══════════════════════════════════════════════════════════════════════════
//  PARAŞÜT
// ═══════════════════════════════════════════════════════════════════════════

// Auth (OAuth 2.0 — grant_type=password)
router.post("/parasut/token", authMiddleware, eInvoiceController.parasutGetToken);
router.post("/parasut/refresh-token", authMiddleware, eInvoiceController.parasutRefreshToken);
router.post("/parasut/me", authMiddleware, eInvoiceController.parasutGetUserInfo);

// Satış Faturaları
router.post("/parasut/invoices/list", authMiddleware, eInvoiceController.parasutListInvoices);
router.post("/parasut/invoices/create", authMiddleware, eInvoiceController.parasutCreateInvoice);

// Resmileştirme (e-Fatura / e-Arşiv)
router.post("/parasut/einvoice-inbox", authMiddleware, eInvoiceController.parasutCheckEInvoiceInbox);
router.post("/parasut/earchive/create", authMiddleware, eInvoiceController.parasutCreateEArchive);
router.post("/parasut/einvoice/create", authMiddleware, eInvoiceController.parasutCreateEInvoice);

// Trackable Job (asenkron işlem takibi)
router.post("/parasut/jobs/:jobId/status", authMiddleware, eInvoiceController.parasutGetJobStatus);

// Müşteri/Tedarikçi & Ürün
router.post("/parasut/contacts/list", authMiddleware, eInvoiceController.parasutListContacts);
router.post("/parasut/products/list", authMiddleware, eInvoiceController.parasutListProducts);

// Belge Arama (Genel)
router.post("/parasut/documents/search", authMiddleware, eInvoiceController.parasutSearchDocuments);

// ═══════════════════════════════════════════════════════════════════════════
//  ÖDEAL (E-FaturaPos / SadePos)
// ═══════════════════════════════════════════════════════════════════════════

// Auth (Servis Anahtarı Doğrulama)
router.post("/odeal/validate-key", authMiddleware, eInvoiceController.odealValidateKey);

// Birim Servisi
router.post("/odeal/units", authMiddleware, eInvoiceController.odealGetUnits);

// Sepet İşlemleri
router.post("/odeal/basket/create", authMiddleware, eInvoiceController.odealCreateBasket);
router.post("/odeal/basket/list", authMiddleware, eInvoiceController.odealListBaskets);
router.delete("/odeal/basket/:basketId", authMiddleware, eInvoiceController.odealDeleteBasket);

// Konfigürasyon
router.post("/odeal/configuration", authMiddleware, eInvoiceController.odealSaveConfig);

// Raporlama
router.post("/odeal/report/transactions", authMiddleware, eInvoiceController.odealGetReport);
router.post("/odeal/report/transactions/:transactionId", authMiddleware, eInvoiceController.odealGetTransactionDetail);

// Belge Arama (BillingPage uyumlu)
router.post("/odeal/documents/search", authMiddleware, eInvoiceController.odealSearchDocuments);

// Webhook Callback (auth gerektirmez — Ödeal'dan gelir)
router.post("/odeal/callback", eInvoiceController.odealCallback);

module.exports = router;
