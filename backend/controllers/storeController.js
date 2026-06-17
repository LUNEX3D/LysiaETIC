const mongoose = require("mongoose");
const Store = require("../models/Store");
const StoreOrder = require("../models/StoreOrder");
const storeOrderService = require("../services/storeOrderService");
const storeGiftCardService = require("../services/storeGiftCardService");
const storeCustomerService = require("../services/storeCustomerService");
const storeCustomerGroupService = require("../services/storeCustomerGroupService");
const storeCampaignService = require("../services/storeCampaignService");
const storeService = require("../services/storeService");
const storeProductService = require("../services/storeProductService");
const storeCustomFieldService = require("../services/storeCustomFieldService");
const googleProductTaxonomyService = require("../services/googleProductTaxonomyService");
const storeCategoryService = require("../services/storeCategoryService");
const storeBrandService = require("../services/storeBrandService");
const storeVariantTypeService = require("../services/storeVariantTypeService");
const storeProductGroupService = require("../services/storeProductGroupService");
const storeSupplierService = require("../services/storeSupplierService");
const storeTagService = require("../services/storeTagService");
const storeUnitService = require("../services/storeUnitService");
const storeCartLinkService = require("../services/storeCartLinkService");
const storeProductPersonalizationService = require("../services/storeProductPersonalizationService");
const storeDashboardService = require("../services/storeDashboardService");
const storeProductImportExportService = require("../services/storeProductImportExportService");
const storeProductBulkService = require("../services/storeProductBulkService");
const storePurchaseService = require("../services/storePurchaseService");
const storeTransferService = require("../services/storeTransferService");
const storeStockCountService = require("../services/storeStockCountService");
const multer = require("multer");
const logger = require("../config/logger");

const productImportUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
exports.productImportUploadMiddleware = productImportUpload.single("file");

function toUserId(req) {
    const id = req.user?._id || req.user?.id;
    if (!id) return null;
    try {
        return new mongoose.Types.ObjectId(String(id));
    } catch {
        return null;
    }
}

async function resolveUserStore(req) {
    const userId = toUserId(req);
    if (!userId) return { userId: null, store: null };
    const siteId = req.query?.siteId || req.headers["x-ec-site-id"];
    const store = siteId
        ? await storeService.resolveStoreForUser(userId, { siteId })
        : await storeService.getStoreByUserId(userId);
    return { userId, store };
}

exports.getStore = async (req, res) => {
    try {
        const { userId, store } = await resolveUserStore(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const payments = store ? await storeService.getPaymentSettings(store._id) : null;
        const dnsRecords = store ? storeService.buildDomainDnsRecords(store) : null;
        return res.json({
            success: true,
            store,
            payments,
            themes: storeService.THEMES,
            publicUrl: store ? storeService.getPublicStoreUrl(store) : null,
            dnsRecords,
            dnsCnameTarget: storeService.DNS_CNAME_TARGET,
        });
    } catch (e) {
        logger.error("[Store] get:", e.message);
        return res.status(500).json({ error: e.message });
    }
};

exports.createStore = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const { name, slug, themeId } = req.body || {};
        const out = await storeService.createStore(userId, { name, slug, themeId });
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, store: out.store });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStore = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const out = await storeService.updateStore(userId, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, store: out.store });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.publishStore = async (req, res) => {
    try {
        const userId = toUserId(req);
        const out = await storeService.publishStore(userId);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, store: out.store, publicUrl: storeService.getPublicStoreUrl(out.store) });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.unpublishStore = async (req, res) => {
    try {
        const userId = toUserId(req);
        const out = await storeService.unpublishStore(userId);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, store: out.store });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getPayments = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const payments = await storeService.getPaymentSettings(store._id);
        return res.json({ success: true, payments });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.savePayments = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Önce mağaza oluşturun" });
        const payments = await storeService.savePaymentSettings(store._id, req.body || {});
        return res.json({ success: true, payments });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.syncProducts = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const result = await storeProductService.syncProductsFromMapping(userId, store._id, {
            productIds: req.body?.productIds,
        });
        return res.json({ success: true, ...result });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listProducts = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const products = await storeProductService.listStoreProducts(store._id);
        return res.json({ success: true, products });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listPurchases = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const purchases = await storePurchaseService.listStorePurchases(store._id);
        return res.json({ success: true, purchases });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getPurchase = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storePurchaseService.getStorePurchase(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, purchase: out.purchase });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createPurchase = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storePurchaseService.createStorePurchase(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, purchase: out.purchase });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.patchPurchase = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storePurchaseService.updateStorePurchase(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, purchase: out.purchase });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listTransfers = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const transfers = await storeTransferService.listStoreTransfers(store._id);
        return res.json({ success: true, transfers });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getTransfer = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeTransferService.getStoreTransfer(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, transfer: out.transfer });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createTransfer = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeTransferService.createStoreTransfer(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, transfer: out.transfer });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.patchTransfer = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeTransferService.updateStoreTransfer(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, transfer: out.transfer });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStockCounts = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const stockCounts = await storeStockCountService.listStoreStockCounts(store._id);
        return res.json({ success: true, stockCounts });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStockCount = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeStockCountService.getStoreStockCount(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, stockCount: out.stockCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStockCount = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeStockCountService.createStoreStockCount(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, stockCount: out.stockCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.patchStockCount = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeStockCountService.updateStoreStockCount(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, stockCount: out.stockCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStockCount = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeStockCountService.deleteStoreStockCount(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.bulkDeleteStockCounts = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeStockCountService.bulkDeleteStoreStockCounts(
            store._id,
            req.body?.ids || []
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, deletedCount: out.deletedCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductService.getStoreProduct(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, product: out.product });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductService.createStoreProduct(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, product: out.product });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.patchProduct = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductService.patchStoreProduct(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, product: out.product });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductService.deleteStoreProduct(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.exportProducts = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });

        const format = req.query.format === "xls" ? "xls" : "csv";
        const scope = req.query.scope || "products";
        const out = await storeProductImportExportService.exportStoreProducts(store._id, {
            format,
            scope,
        });

        res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
        res.setHeader("Content-Type", out.contentType);
        return res.send(out.buffer);
    } catch (e) {
        logger.error("[Store] exportProducts:", e.message);
        return res.status(500).json({ error: e.message || "Dışa aktarma başarısız" });
    }
};

exports.bulkUpdateProducts = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });

        const result = await storeProductBulkService.bulkUpdateProducts(store._id, req.body || {});
        if (result.error) return res.status(400).json({ error: result.error });
        return res.json({ success: true, ...result });
    } catch (e) {
        logger.error("[Store] bulkUpdateProducts:", e.message);
        return res.status(500).json({ error: e.message || "Toplu güncelleme başarısız" });
    }
};

exports.bulkDeleteProducts = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });

        const result = await storeProductBulkService.bulkDeleteProducts(store._id, req.body || {});
        if (result.error) return res.status(400).json({ error: result.error });
        return res.json({ success: true, ...result });
    } catch (e) {
        logger.error("[Store] bulkDeleteProducts:", e.message);
        return res.status(500).json({ error: e.message || "Toplu silme başarısız" });
    }
};

exports.importProducts = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        if (!req.file?.buffer) return res.status(400).json({ error: "Dosya gerekli (.csv veya .xlsx)" });

        const scope = req.query.scope || "products";
        const result = await storeProductImportExportService.importStoreProducts(
            store._id,
            req.file.buffer,
            scope
        );
        if (result.error) return res.status(400).json({ error: result.error });
        return res.json({ success: true, ...result });
    } catch (e) {
        logger.error("[Store] importProducts:", e.message);
        return res.status(500).json({ error: e.message || "İçe aktarma başarısız" });
    }
};

exports.listCustomFields = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const fields = await storeCustomFieldService.listDefinitions(store._id);
        return res.json({ success: true, fields });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createCustomField = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomFieldService.createDefinition(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, field: out.field });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateCustomField = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomFieldService.updateDefinition(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, field: out.field });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteCustomField = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomFieldService.deleteDefinition(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreVariantTypes = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const variantTypes = await storeVariantTypeService.listVariantTypes(store._id);
        return res.json({ success: true, variantTypes });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreVariantType = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeVariantTypeService.getVariantType(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, variantType: out.variantType });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.exportStoreVariantTypes = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const rows = await storeVariantTypeService.listVariantTypes(store._id);
        const csv = storeVariantTypeService.exportVariantTypesCsv(rows);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="varyant-turleri.csv"');
        return res.send(`\uFEFF${csv}`);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreVariantType = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeVariantTypeService.createVariantType(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, variantType: out.variantType });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreVariantType = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeVariantTypeService.updateVariantType(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, variantType: out.variantType });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreVariantType = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeVariantTypeService.deleteVariantType(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreProductGroups = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const groups = await storeProductGroupService.listGroups(store._id);
        return res.json({ success: true, groups });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreProductGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductGroupService.getGroup(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, group: out.group });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreProductGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const body = req.body || {};
        const out =
            body.groupType === "automatic" || body.mode === "automatic"
                ? await storeProductGroupService.createAutomaticGroups(store._id, body)
                : await storeProductGroupService.createManualGroup(store._id, body);
        if (out.error) return res.status(400).json({ error: out.error });
        if (out.groups) {
            return res.status(201).json({ success: true, groups: out.groups, createdCount: out.createdCount });
        }
        return res.status(201).json({ success: true, group: out.group });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreProductGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductGroupService.updateGroup(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, group: out.group });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreProductGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductGroupService.deleteGroup(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreCategories = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const data = await storeCategoryService.listTree(store._id);
        return res.json({ success: true, ...data });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreCategory = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCategoryService.getCategory(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, category: out.category });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.exportStoreCategories = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const flat = await storeCategoryService.listFlat(store._id);
        const csv = storeCategoryService.exportCategoriesCsv(flat);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="kategoriler.csv"');
        return res.send(`\uFEFF${csv}`);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.bulkDeleteStoreCategories = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCategoryService.bulkDeleteCategories(store._id, req.body?.ids || []);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, deletedCount: out.deletedCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreCategory = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCategoryService.createCategory(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, category: out.category });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreCategory = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCategoryService.updateCategory(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, category: out.category });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreCategory = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCategoryService.deleteCategory(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreBrands = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const brands = await storeBrandService.listBrands(store._id);
        return res.json({ success: true, brands });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreBrand = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeBrandService.getBrand(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, brand: out.brand });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.exportStoreBrands = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const brands = await storeBrandService.listBrands(store._id);
        const csv = storeBrandService.exportBrandsCsv(brands);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="markalar.csv"');
        return res.send(`\uFEFF${csv}`);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.bulkDeleteStoreBrands = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeBrandService.bulkDeleteBrands(store._id, req.body?.ids || []);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, deletedCount: out.deletedCount });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreBrand = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeBrandService.createBrand(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, brand: out.brand });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreBrand = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeBrandService.updateBrand(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, brand: out.brand });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreBrand = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeBrandService.deleteBrand(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreSuppliers = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const suppliers = await storeSupplierService.listSuppliers(store._id);
        return res.json({ success: true, suppliers });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreSupplier = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeSupplierService.getSupplier(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, supplier: out.supplier });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreSupplier = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeSupplierService.createSupplier(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, supplier: out.supplier });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreSupplier = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeSupplierService.updateSupplier(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, supplier: out.supplier });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreSupplier = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeSupplierService.deleteSupplier(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreTags = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const tags = await storeTagService.listTags(store._id);
        return res.json({ success: true, tags });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreTag = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeTagService.getTag(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, tag: out.tag });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreTag = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeTagService.createTag(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, tag: out.tag });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreTag = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeTagService.updateTag(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, tag: out.tag });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreTag = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeTagService.deleteTag(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreUnits = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const units = await storeUnitService.listUnits(store._id);
        return res.json({ success: true, units });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreUnit = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeUnitService.getUnit(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, unit: out.unit });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreUnit = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeUnitService.createUnit(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, unit: out.unit });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreUnit = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeUnitService.updateUnit(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, unit: out.unit });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreUnit = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeUnitService.deleteUnit(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStoreCartLinks = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const cartLinks = await storeCartLinkService.listCartLinks(store._id);
        return res.json({ success: true, cartLinks });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreCartLinkSalesChannels = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = storeCartLinkService.getSalesChannelsForStore(store);
        return res.json({ success: true, ...out });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStoreCartLink = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCartLinkService.getCartLink(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, cartLink: out.cartLink });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStoreCartLink = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCartLinkService.createCartLink(store._id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, cartLink: out.cartLink });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStoreCartLink = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCartLinkService.updateCartLink(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, cartLink: out.cartLink });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStoreCartLink = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCartLinkService.deleteCartLink(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listStorePersonalizations = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const personalizations = await storeProductPersonalizationService.listPersonalizations(store._id);
        const allowPaidPricing = storeProductPersonalizationService.allowPaidPricing(req.user);
        return res.json({ success: true, personalizations, allowPaidPricing });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getStorePersonalization = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductPersonalizationService.getPersonalization(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        const allowPaidPricing = storeProductPersonalizationService.allowPaidPricing(req.user);
        return res.json({ success: true, personalization: out.personalization, allowPaidPricing });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createStorePersonalization = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductPersonalizationService.createPersonalization(
            store._id,
            req.body || {},
            req.user
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({
            success: true,
            personalization: out.personalization,
            allowPaidPricing: out.allowPaidPricing,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateStorePersonalization = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductPersonalizationService.updatePersonalization(
            store._id,
            req.params.id,
            req.body || {},
            req.user
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({
            success: true,
            personalization: out.personalization,
            allowPaidPricing: out.allowPaidPricing,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteStorePersonalization = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeProductPersonalizationService.deletePersonalization(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listGoogleProductCategories = async (req, res) => {
    try {
        const q = req.query.q;
        if (q && String(q).trim().length >= 2) {
            const results = await googleProductTaxonomyService.searchCategories(q);
            return res.json({ success: true, mode: "search", results });
        }
        const parent = req.query.parent;
        const nodes = parent
            ? await googleProductTaxonomyService.getChildren(parent)
            : await googleProductTaxonomyService.getRoots();
        return res.json({ success: true, mode: "tree", nodes });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listOrders = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const draft =
            req.query.draft === "1" ? true : req.query.draft === "0" ? false : undefined;
        const orders = await storeOrderService.listOrders(store._id, {
            draft,
            q: req.query.q,
        });
        return res.json({ success: true, orders });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getOrder = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const order = await storeOrderService.getOrder(store._id, req.params.id);
        if (!order) return res.status(404).json({ error: "Sipariş yok" });
        const labels = await storeOrderService.listOrderLabels(store._id);
        return res.json({ success: true, order, labels });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeOrderService.createManualOrder(store._id, userId, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, order: out.order });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.patchOrderStatus = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeOrderService.patchOrder(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true, order: out.order });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listOrderLabels = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const labels = await storeOrderService.listOrderLabels(store._id);
        return res.json({ success: true, labels });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createOrderLabel = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeOrderService.createOrderLabel(store._id, userId, req.body?.name);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, label: out.label });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteOrderLabel = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeOrderService.deleteOrderLabel(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listCustomers = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const customers = await storeCustomerService.listCustomers(store._id, {
            q: req.query.q,
            marketingConsent: req.query.marketingConsent,
            hasAccount: req.query.hasAccount,
            group: req.query.group,
            tag: req.query.tag,
        });
        return res.json({ success: true, customers });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getCustomer = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerService.getCustomer(store._id, req.params.id);
        if (!out) return res.status(404).json({ error: "Müşteri bulunamadı" });
        return res.json({ success: true, customer: out.customer, orders: out.orders });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerService.createCustomer(
            store._id,
            userId,
            req.body || {},
            actorFromReq(req)
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, customer: out.customer });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateCustomer = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerService.updateCustomer(
            store._id,
            req.params.id,
            req.body || {},
            actorFromReq(req)
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, customer: out.customer });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteCustomer = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerService.deleteCustomer(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listCustomerGroups = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const groups = await storeCustomerGroupService.listGroups(store._id);
        return res.json({ success: true, groups });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getCustomerGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerGroupService.getGroup(store._id, req.params.id);
        if (!out) return res.status(404).json({ error: "Müşteri grubu bulunamadı" });
        return res.json({ success: true, group: out.group, members: out.members });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createCustomerGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerGroupService.createGroup(store._id, userId, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, group: out.group });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateCustomerGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerGroupService.updateGroup(store._id, req.params.id, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, group: out.group });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteCustomerGroup = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCustomerGroupService.deleteGroup(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.listCampaigns = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const campaigns = await storeCampaignService.listCampaigns(store._id, {
            kind: req.query.kind,
            q: req.query.q,
        });
        return res.json({ success: true, campaigns });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getCampaign = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const campaign = await storeCampaignService.getCampaign(store._id, req.params.id);
        if (!campaign) return res.status(404).json({ error: "Kampanya bulunamadı" });
        return res.json({ success: true, campaign });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createCampaign = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCampaignService.createCampaign(store._id, userId, req.body || {});
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, campaign: out.campaign });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateCampaign = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCampaignService.updateCampaign(
            store._id,
            req.params.id,
            req.body || {}
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, campaign: out.campaign });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteCampaign = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeCampaignService.deleteCampaign(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.bulkUpdateOrderLabels = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const { orderIds, labelIds, mode } = req.body || {};
        const out = await storeOrderService.bulkUpdateOrderLabels(
            store._id,
            orderIds,
            labelIds,
            mode || "add"
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, updated: out.updated });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

function actorFromReq(req) {
    const u = req.user;
    if (!u) return "Personel";
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    return name || u.email || "Personel";
}

exports.listGiftCards = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const cards = await storeGiftCardService.listGiftCards(store._id, { q: req.query.q });
        const enriched = cards.map((c) => ({
            ...c,
            salesChannelLabels: storeGiftCardService.resolveSalesChannelLabels(
                store,
                c.salesChannelIds
            ),
        }));
        return res.json({ success: true, giftCards: enriched });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getGiftCard = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const card = await storeGiftCardService.getGiftCard(store._id, req.params.id);
        if (!card) return res.status(404).json({ error: "Hediye kartı bulunamadı" });
        return res.json({
            success: true,
            giftCard: {
                ...card,
                salesChannelLabels: storeGiftCardService.resolveSalesChannelLabels(
                    store,
                    card.salesChannelIds
                ),
            },
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.suggestGiftCardCode = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeGiftCardService.suggestCode(store._id);
        return res.json({ success: true, code: out.code });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.createGiftCard = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeGiftCardService.createGiftCard(
            store._id,
            userId,
            req.body || {},
            actorFromReq(req)
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.status(201).json({ success: true, giftCard: out.giftCard });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.updateGiftCard = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeGiftCardService.updateGiftCard(
            store._id,
            req.params.id,
            req.body || {},
            actorFromReq(req)
        );
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, giftCard: out.giftCard });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.deleteGiftCard = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.status(404).json({ error: "Mağaza yok" });
        const out = await storeGiftCardService.deleteGiftCard(store._id, req.params.id);
        if (out.error) return res.status(404).json({ error: out.error });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.verifyDomain = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const out = await storeService.verifyStoreDomain(userId);
        if (out.error) {
            return res.status(400).json({
                error: out.error,
                dnsRecords: out.dnsRecords,
            });
        }
        return res.json({
            success: true,
            verified: out.verified,
            store: out.store,
            publicUrl: storeService.getPublicStoreUrl(out.store),
            dnsRecords: out.dnsRecords,
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.disconnectDomain = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const out = await storeService.disconnectStoreDomain(userId);
        if (out.error) return res.status(400).json({ error: out.error });
        return res.json({ success: true, store: out.store });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const userId = toUserId(req);
        if (!userId) return res.status(401).json({ error: "Yetkisiz" });
        const data = await storeDashboardService.getStoreDashboard(userId, {
            siteId: req.query.siteId,
            preset: req.query.preset || (req.query.days ? `last_${req.query.days}_days` : "last_7_days"),
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            channel: req.query.channel || "all",
            currencyMode: req.query.currencyMode || "store",
            compare: req.query.compare !== "0" && req.query.compare !== "false",
        });
        return res.json({ success: true, ...data });
    } catch (e) {
        logger.error("[Store] dashboard:", e.message);
        return res.status(500).json({ error: e.message });
    }
};

exports.getStats = async (req, res) => {
    try {
        const userId = toUserId(req);
        const store = await storeService.getStoreByUserId(userId);
        if (!store) return res.json({ success: true, hasStore: false });
        const pending = await StoreOrder.countDocuments({ storeId: store._id, status: "pending_payment" });
        const paid = await StoreOrder.countDocuments({ storeId: store._id, "payment.status": "paid" });
        return res.json({
            success: true,
            hasStore: true,
            store: { name: store.name, status: store.status, slug: store.slug },
            stats: store.stats,
            orders: { pending, paid },
            publicUrl: storeService.getPublicStoreUrl(store),
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
