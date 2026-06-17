/**
 * backend/controllers/webStoreManagerController.js
 *
 * Web Mağaza Yönetim Kontrolörü
 */

const webStoreManagerService = require('../services/webStoreManagerService');
const logger = require('../config/logger');

class WebStoreManagerController {
  /**
   * Store kurulumunu başlat
   */
  async setupStore(req, res) {
    try {
      const { storeId } = req.params;
      const storeData = req.body;

      const result = await webStoreManagerService.setupWebStore(storeId, storeData);

      res.json(result);
    } catch (error) {
      logger.error(`Setup store error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Dashboard verileri
   */
  async getDashboard(req, res) {
    try {
      const { storeId } = req.params;
      const { dateRange } = req.query;

      const data = await webStoreManagerService.getDashboardData(
        storeId,
        dateRange || '30'
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error(`Get dashboard error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Pazaryeri senkronizasyonu
   */
  async syncMarketplace(req, res) {
    try {
      const { storeId } = req.params;
      const { marketplace } = req.body;

      const result = await webStoreManagerService.syncMarketplace(
        storeId,
        marketplace
      );

      res.json(result);
    } catch (error) {
      logger.error(`Sync marketplace error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Ödeme ayarları
   */
  async updatePaymentSettings(req, res) {
    try {
      const { storeId } = req.params;
      const paymentSettings = req.body;

      const result = await webStoreManagerService.updatePaymentSettings(
        storeId,
        paymentSettings
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Kargo ayarları
   */
  async updateShippingSettings(req, res) {
    try {
      const { storeId } = req.params;
      const shippingSettings = req.body;

      const result = await webStoreManagerService.updateShippingSettings(
        storeId,
        shippingSettings
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Vergi ayarları
   */
  async updateTaxSettings(req, res) {
    try {
      const { storeId } = req.params;
      const taxSettings = req.body;

      const result = await webStoreManagerService.updateTaxSettings(
        storeId,
        taxSettings
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Rapor oluştur
   */
  async generateReport(req, res) {
    try {
      const { storeId } = req.params;
      const { reportType, dateRange } = req.query;

      const result = await webStoreManagerService.generateReport(
        storeId,
        reportType,
        dateRange || '30'
      );

      res.json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new WebStoreManagerController();

