/**
 * Auto Invoice Routes — LysiaETIC
 * Prefix: /api/auto-invoice
 *
 * Otomatik fatura kesme ayarları, manuel tetikleme, fatura listesi
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const autoInvoiceController = require("../controllers/autoInvoiceController");

const eArchiveVisualUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype || "");
        cb(ok ? null : new Error("Yalnızca görsel dosyaları yüklenebilir."), ok);
    },
});

// ── Admin/Debug (localhost only, auth gerektirmez) ────────────────────────
router.post("/admin/cleanup-all-ghost-invoices", async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;
        if (!clientIp.includes("127.0.0.1") && !clientIp.includes("::1") && !clientIp.includes("localhost")) {
            return res.status(403).json({ success: false, message: "Bu endpoint sadece localhost'tan erişilebilir." });
        }

        const Invoice = require("../models/Invoice");
        const Order = require("../models/Order");

        const ghosts = await Invoice.find({ status: "created", createdBy: "auto" }).lean();

        if (ghosts.length === 0) {
            return res.json({ success: true, message: "Temizlenecek fatura bulunamadı.", cleaned: 0 });
        }

        let cleaned = 0;
        const cleanedList = [];

        for (const inv of ghosts) {
            await Invoice.deleteOne({ _id: inv._id });
            if (inv.orderId) {
                await Order.updateOne(
                    { _id: inv.orderId },
                    { $unset: { invoiceId: 1, invoiceNumber: 1 }, $set: { invoiceStatus: "" } }
                );
            }
            cleaned++;
            cleanedList.push({
                invoiceNumber: inv.invoiceNumber || "",
                uuid: inv.uuid || "",
                orderNumber: inv.orderNumber || "",
                userId: inv.userId
            });
        }

        res.json({
            success: true,
            message: cleaned + " hayalet fatura temizlendi (TÜM KULLANICILAR).",
            cleaned,
            invoices: cleanedList
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Tüm route'lar auth + subscription gerektirir
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
router.use(authMiddleware);
router.use(subscriptionMiddleware);
router.use(requirePlanFeature("e_invoice"));

// ── Ayar Yönetimi ─────────────────────────────────────────────────────────
router.get("/config", autoInvoiceController.getConfig);
router.put("/config", autoInvoiceController.saveConfig);
router.post(
    "/e-archive-visuals/upload",
    (req, res, next) => {
        eArchiveVisualUpload.single("file")(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message || "Görsel yüklenemedi.",
                });
            }
            next();
        });
    },
    autoInvoiceController.uploadEArchiveVisual
);
router.post("/disconnect-provider", autoInvoiceController.disconnectProvider);
router.post("/toggle", autoInvoiceController.toggleEnabled);
router.post("/reset-errors", autoInvoiceController.resetErrors);
router.post("/cleanup-ghost-invoices", autoInvoiceController.cleanupGhostInvoices);

// ── Pazaryeri Bazlı Ayarlar ───────────────────────────────────────────────
router.post("/toggle-marketplace", autoInvoiceController.toggleMarketplace);
router.put("/marketplace-settings", autoInvoiceController.saveMarketplaceSettings);
router.get("/marketplace-stats", autoInvoiceController.getMarketplaceStats);

// ── Manuel Tetikleme ──────────────────────────────────────────────────────
router.post("/process", autoInvoiceController.processOrders);
router.post("/process-all", autoInvoiceController.processAllOrders);
router.post("/process-single/:orderId", autoInvoiceController.processSingleOrder);
router.get("/uninvoiced-orders", autoInvoiceController.getUninvoicedOrders);

// ── Fatura Listesi & Detay & PDF ──────────────────────────────────────────
router.post("/sync-sovos", autoInvoiceController.syncSovosInvoices);
router.get("/invoices", autoInvoiceController.listInvoices);
router.get("/invoices/:invoiceId", autoInvoiceController.getInvoiceDetail);
router.get("/invoices/:invoiceId/pdf", autoInvoiceController.getInvoicePdf);
router.post("/invoices/:invoiceId/refresh-status", autoInvoiceController.refreshInvoiceStatus);
router.post("/invoices/:invoiceId/cancel", autoInvoiceController.cancelInvoiceRecord);
router.post("/invoices/:invoiceId/respond", autoInvoiceController.respondInvoiceRecord);
router.get("/invoices/:invoiceId/signed-xml", autoInvoiceController.downloadSignedInvoiceXml);
router.post("/invoices/:invoiceId/retrigger", autoInvoiceController.retriggerEArchiveInvoice);
router.post("/invoices/:invoiceId/detailed-query", autoInvoiceController.detailedEArchiveQuery);
router.delete("/invoices/:invoiceId", autoInvoiceController.deleteInvoiceRecord);

// ── Belge listesi (tüm sağlayıcılar — DB) ─────────────────────────────────
router.get("/documents", autoInvoiceController.listBillingDocuments);
router.get("/documents/:documentId/preview", autoInvoiceController.getBillingDocumentPreview);

// ── Geriye uyumluluk (eski QNB route adları) ──────────────────────────────
router.get("/qnb-invoices", autoInvoiceController.getQnbInvoices);
router.get("/qnb-invoices/:uuid/preview", autoInvoiceController.getQnbInvoicePreview);

// ── İstatistikler ─────────────────────────────────────────────────────────
router.get("/stats", autoInvoiceController.getStats);

module.exports = router;
