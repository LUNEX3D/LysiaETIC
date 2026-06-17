const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/storeController");
const sellerCtrl = require("../controllers/storeSellerVerificationController");

router.use(authMiddleware);
router.use(subscriptionMiddleware);

router.get("/", requirePlanFeature("own_storefront"), ctrl.getStore);
router.get("/stats", requirePlanFeature("own_storefront"), ctrl.getStats);
router.get("/dashboard", requirePlanFeature("own_storefront"), ctrl.getDashboard);
router.post("/", requirePlanFeature("own_storefront"), ctrl.createStore);
router.patch("/", requirePlanFeature("own_storefront"), ctrl.updateStore);
router.post("/domain/verify", requirePlanFeature("own_storefront"), ctrl.verifyDomain);
router.delete("/domain", requirePlanFeature("own_storefront"), ctrl.disconnectDomain);
router.post("/publish", requirePlanFeature("own_storefront"), ctrl.publishStore);
router.post("/unpublish", requirePlanFeature("own_storefront"), ctrl.unpublishStore);

router.get("/payments", requirePlanFeature("own_storefront"), ctrl.getPayments);
router.put("/payments", requirePlanFeature("own_storefront"), ctrl.savePayments);

router.post("/products/sync", requirePlanFeature("own_storefront"), ctrl.syncProducts);
router.get("/products", requirePlanFeature("own_storefront"), ctrl.listProducts);
router.patch("/products/bulk", requirePlanFeature("own_storefront"), ctrl.bulkUpdateProducts);
router.post("/products/bulk-delete", requirePlanFeature("own_storefront"), ctrl.bulkDeleteProducts);
router.get("/products/export", requirePlanFeature("own_storefront"), ctrl.exportProducts);
router.post(
    "/products/import",
    requirePlanFeature("own_storefront"),
    ctrl.productImportUploadMiddleware,
    ctrl.importProducts
);
router.post("/products", requirePlanFeature("own_storefront"), ctrl.createProduct);
router.get("/products/:id", requirePlanFeature("own_storefront"), ctrl.getProduct);
router.patch("/products/:id", requirePlanFeature("own_storefront"), ctrl.patchProduct);
router.delete("/products/:id", requirePlanFeature("own_storefront"), ctrl.deleteProduct);

router.get("/purchases", requirePlanFeature("own_storefront"), ctrl.listPurchases);
router.post("/purchases", requirePlanFeature("own_storefront"), ctrl.createPurchase);
router.get("/purchases/:id", requirePlanFeature("own_storefront"), ctrl.getPurchase);
router.patch("/purchases/:id", requirePlanFeature("own_storefront"), ctrl.patchPurchase);

router.get("/transfers", requirePlanFeature("own_storefront"), ctrl.listTransfers);
router.post("/transfers", requirePlanFeature("own_storefront"), ctrl.createTransfer);
router.get("/transfers/:id", requirePlanFeature("own_storefront"), ctrl.getTransfer);
router.patch("/transfers/:id", requirePlanFeature("own_storefront"), ctrl.patchTransfer);

router.get("/stock-counts", requirePlanFeature("own_storefront"), ctrl.listStockCounts);
router.post("/stock-counts", requirePlanFeature("own_storefront"), ctrl.createStockCount);
router.post("/stock-counts/bulk-delete", requirePlanFeature("own_storefront"), ctrl.bulkDeleteStockCounts);
router.get("/stock-counts/:id", requirePlanFeature("own_storefront"), ctrl.getStockCount);
router.patch("/stock-counts/:id", requirePlanFeature("own_storefront"), ctrl.patchStockCount);
router.delete("/stock-counts/:id", requirePlanFeature("own_storefront"), ctrl.deleteStockCount);

router.get("/categories", requirePlanFeature("own_storefront"), ctrl.listStoreCategories);
router.get("/categories/export", requirePlanFeature("own_storefront"), ctrl.exportStoreCategories);
router.post("/categories/bulk-delete", requirePlanFeature("own_storefront"), ctrl.bulkDeleteStoreCategories);
router.post("/categories", requirePlanFeature("own_storefront"), ctrl.createStoreCategory);
router.get("/categories/:id", requirePlanFeature("own_storefront"), ctrl.getStoreCategory);
router.patch("/categories/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreCategory);
router.delete("/categories/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreCategory);

router.get("/brands", requirePlanFeature("own_storefront"), ctrl.listStoreBrands);
router.get("/brands/export", requirePlanFeature("own_storefront"), ctrl.exportStoreBrands);
router.post("/brands/bulk-delete", requirePlanFeature("own_storefront"), ctrl.bulkDeleteStoreBrands);
router.post("/brands", requirePlanFeature("own_storefront"), ctrl.createStoreBrand);
router.get("/brands/:id", requirePlanFeature("own_storefront"), ctrl.getStoreBrand);
router.patch("/brands/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreBrand);
router.delete("/brands/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreBrand);

router.get("/suppliers", requirePlanFeature("own_storefront"), ctrl.listStoreSuppliers);
router.post("/suppliers", requirePlanFeature("own_storefront"), ctrl.createStoreSupplier);
router.get("/suppliers/:id", requirePlanFeature("own_storefront"), ctrl.getStoreSupplier);
router.patch("/suppliers/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreSupplier);
router.delete("/suppliers/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreSupplier);

router.get("/tags", requirePlanFeature("own_storefront"), ctrl.listStoreTags);
router.post("/tags", requirePlanFeature("own_storefront"), ctrl.createStoreTag);
router.get("/tags/:id", requirePlanFeature("own_storefront"), ctrl.getStoreTag);
router.patch("/tags/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreTag);
router.delete("/tags/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreTag);

router.get("/units", requirePlanFeature("own_storefront"), ctrl.listStoreUnits);
router.post("/units", requirePlanFeature("own_storefront"), ctrl.createStoreUnit);
router.get("/units/:id", requirePlanFeature("own_storefront"), ctrl.getStoreUnit);
router.patch("/units/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreUnit);
router.delete("/units/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreUnit);

router.get("/cart-links", requirePlanFeature("own_storefront"), ctrl.listStoreCartLinks);
router.get("/cart-links/sales-channels", requirePlanFeature("own_storefront"), ctrl.getStoreCartLinkSalesChannels);
router.post("/cart-links", requirePlanFeature("own_storefront"), ctrl.createStoreCartLink);
router.get("/cart-links/:id", requirePlanFeature("own_storefront"), ctrl.getStoreCartLink);
router.patch("/cart-links/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreCartLink);
router.delete("/cart-links/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreCartLink);

router.get("/personalizations", requirePlanFeature("own_storefront"), ctrl.listStorePersonalizations);
router.post("/personalizations", requirePlanFeature("own_storefront"), ctrl.createStorePersonalization);
router.get("/personalizations/:id", requirePlanFeature("own_storefront"), ctrl.getStorePersonalization);
router.patch("/personalizations/:id", requirePlanFeature("own_storefront"), ctrl.updateStorePersonalization);
router.delete("/personalizations/:id", requirePlanFeature("own_storefront"), ctrl.deleteStorePersonalization);

router.get(
    "/google-product-categories",
    requirePlanFeature("own_storefront"),
    ctrl.listGoogleProductCategories
);

router.get("/custom-fields", requirePlanFeature("own_storefront"), ctrl.listCustomFields);
router.post("/custom-fields", requirePlanFeature("own_storefront"), ctrl.createCustomField);
router.patch("/custom-fields/:id", requirePlanFeature("own_storefront"), ctrl.updateCustomField);
router.delete("/custom-fields/:id", requirePlanFeature("own_storefront"), ctrl.deleteCustomField);

router.get("/variant-types", requirePlanFeature("own_storefront"), ctrl.listStoreVariantTypes);
router.get("/variant-types/export", requirePlanFeature("own_storefront"), ctrl.exportStoreVariantTypes);
router.post("/variant-types", requirePlanFeature("own_storefront"), ctrl.createStoreVariantType);
router.get("/variant-types/:id", requirePlanFeature("own_storefront"), ctrl.getStoreVariantType);
router.patch("/variant-types/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreVariantType);
router.delete("/variant-types/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreVariantType);

router.get("/product-groups", requirePlanFeature("own_storefront"), ctrl.listStoreProductGroups);
router.post("/product-groups", requirePlanFeature("own_storefront"), ctrl.createStoreProductGroup);
router.get("/product-groups/:id", requirePlanFeature("own_storefront"), ctrl.getStoreProductGroup);
router.patch("/product-groups/:id", requirePlanFeature("own_storefront"), ctrl.updateStoreProductGroup);
router.delete("/product-groups/:id", requirePlanFeature("own_storefront"), ctrl.deleteStoreProductGroup);

router.get("/orders", requirePlanFeature("own_storefront"), ctrl.listOrders);
router.post("/orders/bulk-labels", requirePlanFeature("own_storefront"), ctrl.bulkUpdateOrderLabels);
router.post("/orders", requirePlanFeature("own_storefront"), ctrl.createOrder);
router.get("/orders/:id", requirePlanFeature("own_storefront"), ctrl.getOrder);
router.patch("/orders/:id", requirePlanFeature("own_storefront"), ctrl.patchOrderStatus);
router.get("/order-labels", requirePlanFeature("own_storefront"), ctrl.listOrderLabels);
router.post("/order-labels", requirePlanFeature("own_storefront"), ctrl.createOrderLabel);
router.delete("/order-labels/:id", requirePlanFeature("own_storefront"), ctrl.deleteOrderLabel);

router.get("/customers", requirePlanFeature("own_storefront"), ctrl.listCustomers);
router.post("/customers", requirePlanFeature("own_storefront"), ctrl.createCustomer);
router.get("/customers/:id", requirePlanFeature("own_storefront"), ctrl.getCustomer);
router.patch("/customers/:id", requirePlanFeature("own_storefront"), ctrl.updateCustomer);
router.delete("/customers/:id", requirePlanFeature("own_storefront"), ctrl.deleteCustomer);

router.get("/customer-groups", requirePlanFeature("own_storefront"), ctrl.listCustomerGroups);
router.post("/customer-groups", requirePlanFeature("own_storefront"), ctrl.createCustomerGroup);
router.get("/customer-groups/:id", requirePlanFeature("own_storefront"), ctrl.getCustomerGroup);
router.patch("/customer-groups/:id", requirePlanFeature("own_storefront"), ctrl.updateCustomerGroup);
router.delete("/customer-groups/:id", requirePlanFeature("own_storefront"), ctrl.deleteCustomerGroup);

router.get("/campaigns", requirePlanFeature("own_storefront"), ctrl.listCampaigns);
router.post("/campaigns", requirePlanFeature("own_storefront"), ctrl.createCampaign);
router.get("/campaigns/:id", requirePlanFeature("own_storefront"), ctrl.getCampaign);
router.patch("/campaigns/:id", requirePlanFeature("own_storefront"), ctrl.updateCampaign);
router.delete("/campaigns/:id", requirePlanFeature("own_storefront"), ctrl.deleteCampaign);

const inboxCtrl = require("../controllers/storeInboxController");
const mktCtrl = require("../controllers/storeMarketingController");

router.get("/inbox/settings", requirePlanFeature("own_storefront"), inboxCtrl.getInboxSettings);
router.patch("/inbox/settings", requirePlanFeature("own_storefront"), inboxCtrl.patchInboxSettings);
router.post("/inbox/channels/:channelId/connect", requirePlanFeature("own_storefront"), inboxCtrl.connectInboxChannel);
router.post("/inbox/channels/:channelId/disconnect", requirePlanFeature("own_storefront"), inboxCtrl.disconnectInboxChannel);
router.get("/inbox/instagram/oauth/start", requirePlanFeature("own_storefront"), inboxCtrl.instagramOAuthStart);
router.get("/inbox/google/oauth/start", requirePlanFeature("own_storefront"), inboxCtrl.googleInboxOAuthStart);
router.get("/inbox/conversations", requirePlanFeature("own_storefront"), inboxCtrl.listInboxConversations);
router.get("/inbox/conversations/:conversationId/messages", requirePlanFeature("own_storefront"), inboxCtrl.getInboxMessages);
router.post("/inbox/conversations/:conversationId/messages", requirePlanFeature("own_storefront"), inboxCtrl.sendInboxMessage);
router.post("/inbox/sync", requirePlanFeature("own_storefront"), inboxCtrl.syncInbox);

router.get("/marketing/dashboard", requirePlanFeature("store_marketing"), mktCtrl.getDashboard);
router.get("/marketing/reports", requirePlanFeature("store_marketing"), mktCtrl.getReports);
router.get("/marketing/templates", requirePlanFeature("store_marketing"), mktCtrl.getTemplates);
router.get("/marketing/campaigns", requirePlanFeature("store_marketing"), mktCtrl.listCampaigns);
router.post("/marketing/campaigns", requirePlanFeature("store_marketing"), mktCtrl.createCampaign);
router.get("/marketing/campaigns/:id", requirePlanFeature("store_marketing"), mktCtrl.getCampaign);
router.patch("/marketing/campaigns/:id", requirePlanFeature("store_marketing"), mktCtrl.updateCampaign);
router.delete("/marketing/campaigns/:id", requirePlanFeature("store_marketing"), mktCtrl.deleteCampaign);
router.post("/marketing/campaigns/:id/send", requirePlanFeature("store_marketing"), mktCtrl.sendCampaign);
router.get("/marketing/automations", requirePlanFeature("store_marketing"), mktCtrl.listAutomations);
router.post("/marketing/automations", requirePlanFeature("store_marketing"), mktCtrl.createAutomation);
router.get("/marketing/automations/:id", requirePlanFeature("store_marketing"), mktCtrl.getAutomation);
router.patch("/marketing/automations/:id", requirePlanFeature("store_marketing"), mktCtrl.updateAutomation);
router.delete("/marketing/automations/:id", requirePlanFeature("store_marketing"), mktCtrl.deleteAutomation);
router.get("/marketing/segments", requirePlanFeature("store_marketing"), mktCtrl.listSegments);
router.post("/marketing/segments", requirePlanFeature("store_marketing"), mktCtrl.createSegment);
router.post("/marketing/segments/preview", requirePlanFeature("store_marketing"), mktCtrl.previewSegment);
router.patch("/marketing/segments/:id", requirePlanFeature("store_marketing"), mktCtrl.updateSegment);
router.delete("/marketing/segments/:id", requirePlanFeature("store_marketing"), mktCtrl.deleteSegment);
router.post("/marketing/segments/:id/refresh", requirePlanFeature("store_marketing"), mktCtrl.refreshSegment);
router.get("/marketing/popups", requirePlanFeature("store_marketing"), mktCtrl.listPopups);
router.post("/marketing/popups", requirePlanFeature("store_marketing"), mktCtrl.createPopup);
router.patch("/marketing/popups/:id", requirePlanFeature("store_marketing"), mktCtrl.updatePopup);
router.delete("/marketing/popups/:id", requirePlanFeature("store_marketing"), mktCtrl.deletePopup);
router.get("/marketing/affiliates", requirePlanFeature("store_marketing"), mktCtrl.listAffiliates);
router.post("/marketing/affiliates", requirePlanFeature("store_marketing"), mktCtrl.createAffiliate);
router.patch("/marketing/affiliates/:id", requirePlanFeature("store_marketing"), mktCtrl.updateAffiliate);
router.delete("/marketing/affiliates/:id", requirePlanFeature("store_marketing"), mktCtrl.deleteAffiliate);
router.get("/marketing/settings", requirePlanFeature("store_marketing"), mktCtrl.getSettings);
router.put("/marketing/settings", requirePlanFeature("store_marketing"), mktCtrl.updateSettings);

router.get("/gift-cards/suggest-code", requirePlanFeature("own_storefront"), ctrl.suggestGiftCardCode);
router.get("/gift-cards", requirePlanFeature("own_storefront"), ctrl.listGiftCards);
router.post("/gift-cards", requirePlanFeature("own_storefront"), ctrl.createGiftCard);
router.get("/gift-cards/:id", requirePlanFeature("own_storefront"), ctrl.getGiftCard);
router.patch("/gift-cards/:id", requirePlanFeature("own_storefront"), ctrl.updateGiftCard);
router.delete("/gift-cards/:id", requirePlanFeature("own_storefront"), ctrl.deleteGiftCard);

router.get("/seller-verification", requirePlanFeature("own_storefront"), sellerCtrl.getVerification);
router.put("/seller-verification", requirePlanFeature("own_storefront"), sellerCtrl.saveVerification);
router.post(
    "/seller-verification/documents/:docType",
    requirePlanFeature("own_storefront"),
    sellerCtrl.uploadMiddleware,
    sellerCtrl.uploadDocument
);
router.delete(
    "/seller-verification/documents/:docType",
    requirePlanFeature("own_storefront"),
    sellerCtrl.deleteDocument
);

module.exports = router;
