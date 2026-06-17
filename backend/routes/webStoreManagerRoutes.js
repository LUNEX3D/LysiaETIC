/**
 * backend/routes/webStoreManagerRoutes.js
 *
 * Web Mağaza Yönetim Route'ları
 * IKAS, Ticimax, IdeaSoft, Shopify tarzı
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const webStoreManagerController = require('../controllers/webStoreManagerController');
const logger = require('../config/logger');

/**
 * POST /api/web-store/:storeId/setup
 *
 * Mağaza kurulumunu başlat
 */
router.post('/:storeId/setup', authMiddleware, async (req, res, next) => {
  try {
    await webStoreManagerController.setupStore(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/web-store/:storeId/dashboard
 *
 * Dashboard verileri
 * Query: dateRange=30 (days)
 */
router.get('/:storeId/dashboard', authMiddleware, async (req, res, next) => {
  try {
    await webStoreManagerController.getDashboard(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/web-store/:storeId/sync-marketplace
 *
 * Pazaryeri senkronizasyonu
 * Body: { marketplace: "trendyol" / "hepsiburada" / "n11" / etc. }
 */
router.post('/:storeId/sync-marketplace', authMiddleware, async (req, res, next) => {
  try {
    await webStoreManagerController.syncMarketplace(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/web-store/:storeId/payment-settings
 *
 * Ödeme ayarlarını güncelle
 */
router.put('/:storeId/payment-settings', authMiddleware, async (req, res, next) => {
  try {
    await webStoreManagerController.updatePaymentSettings(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/web-store/:storeId/shipping-settings
 *
 * Kargo ayarlarını güncelle
 */
router.put('/:storeId/shipping-settings', authMiddleware, async (req, res, next) => {
  try {
    await webStoreManagerController.updateShippingSettings(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/web-store/:storeId/tax-settings
 *
 * Vergi ayarlarını güncelle
 */
router.put('/:storeId/tax-settings', authMiddleware, async (req, res, next) => {
  try {
    await webStoreManagerController.updateTaxSettings(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/web-store/:storeId/report
 *
 * Rapor oluştur
 * Query: reportType=sales/products/customers/financial/inventory
 *        dateRange=30 (days)
 */
router.get('/:storeId/report', authMiddleware, async (req, res, next) => {
  try {
    await webStoreManagerController.generateReport(req, res);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

