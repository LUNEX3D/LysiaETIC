/**
 * backend/services/webStoreManagerService.js
 *
 * Web Mağaza Yönetim Servisi
 * IKAS, Ticimax, IdeaSoft, Shopify tarzı
 *
 * Fonksiyonlar:
 * - Mağaza kurulumu
 * - Dashboard verisi
 * - Pazaryeri senkronizasyonu
 * - Raporlar
 */

const logger = require('../config/logger');
const WebStoreManager = require('../models/WebStoreManager');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const StoreOrder = require('../models/StoreOrder');

class WebStoreManagerService {
  /**
   * 1. Mağaza Kurul
   */
  async setupWebStore(storeId, storeData) {
    try {
      let webStore = await WebStoreManager.findOne({ store: storeId });

      if (!webStore) {
        webStore = new WebStoreManager({
          store: storeId,
        });
      }

      // Mağaza bilgileri
      webStore.storeInfo = {
        storeName: storeData.storeName,
        storeTagline: storeData.storeTagline || '',
        description: storeData.description || '',
        phone: storeData.phone || '',
        email: storeData.email || '',
        businessName: storeData.businessName,
        businessType: storeData.businessType || 'bireysel',
        taxId: storeData.taxId,
        registryNumber: storeData.registryNumber,
      };

      // Adres bilgileri
      if (storeData.addresses) {
        webStore.addresses = storeData.addresses;
      }

      // Ayarlar
      if (storeData.settings) {
        webStore.settings = {
          ...webStore.settings,
          ...storeData.settings,
        };
      }

      await webStore.save();

      this.addAuditLog(webStore, 'store_setup_completed', storeData);

      logger.info(`Web store setup completed for store ${storeId}`);

      return {
        success: true,
        webStore: webStore,
        message: 'Mağaza kurulumu başarıyla tamamlandı',
      };
    } catch (error) {
      logger.error(`Web store setup error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 2. Dashboard Verileri
   */
  async getDashboardData(storeId, dateRange = '30') {
    try {
      const webStore = await WebStoreManager.findOne({ store: storeId });
      if (!webStore) {
        throw new Error('Web store not found');
      }

      // Tarih aralığı
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      // Siparişler
      const orders = await StoreOrder.find({
        store: storeId,
        createdAt: { $gte: startDate },
      });

      // Ürünler
      const products = await StoreProduct.find({ store: storeId });

      // Hesaplamalar
      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Top ürünler
      const topProducts = products
        .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
        .slice(0, 10);

      // Günlük satışlar
      const dailySales = this.calculateDailySales(orders);

      // Kategori dağılımı
      const categoryBreakdown = this.calculateCategoryBreakdown(products);

      // Ödeme yöntemi dağılımı
      const paymentMethods = this.calculatePaymentMethods(orders);

      // Kargo yöntemi dağılımı
      const shippingMethods = this.calculateShippingMethods(orders);

      return {
        summary: {
          totalOrders,
          totalRevenue,
          averageOrderValue,
          totalCustomers: webStore.customerManagement.totalCustomers,
          totalProducts: products.length,
        },

        charts: {
          dailySales,
          topProducts: topProducts.map(p => ({
            name: p.name,
            sales: p.salesCount || 0,
            revenue: (p.price || 0) * (p.salesCount || 0),
          })),
          categoryBreakdown,
          paymentMethods,
          shippingMethods,
        },

        recentOrders: orders
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 5)
          .map(o => ({
            id: o._id,
            number: o.orderNumber,
            customer: o.customerEmail,
            amount: o.total,
            status: o.status,
            date: o.createdAt,
          })),

        alerts: this.generateAlerts(webStore, products, orders),
      };
    } catch (error) {
      logger.error(`Dashboard data error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 3. Pazaryeri Senkronizasyonu
   */
  async syncMarketplace(storeId, marketplace) {
    try {
      const webStore = await WebStoreManager.findOne({ store: storeId });
      if (!webStore) {
        throw new Error('Web store not found');
      }

      const integration = webStore.marketplaceIntegrations.find(
        m => m.marketplace === marketplace && m.enabled
      );

      if (!integration) {
        throw new Error(`Marketplace ${marketplace} not configured`);
      }

      logger.info(`Starting sync for ${marketplace}...`);

      // Get products to sync
      const products = await StoreProduct.find({ store: storeId });

      let syncedCount = 0;
      let errorCount = 0;

      for (const product of products) {
        try {
          // Get marketplace service
          const marketplaceService = require(`./${marketplace}Service`);

          // Sync product
          const result = await marketplaceService.syncProduct(
            product,
            integration.credentials
          );

          if (result.success) {
            syncedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          logger.warn(`Product sync error: ${error.message}`);
          errorCount++;
        }
      }

      // Update integration stats
      integration.stats.productsSynced = syncedCount;
      integration.stats.errorCount = errorCount;
      integration.syncSettings.lastSync = new Date();

      await webStore.save();

      this.addAuditLog(webStore, 'marketplace_sync', {
        marketplace,
        syncedCount,
        errorCount,
      });

      return {
        success: true,
        marketplace,
        syncedCount,
        errorCount,
        totalProducts: products.length,
      };
    } catch (error) {
      logger.error(`Marketplace sync error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 4. Ödeme Ayarlarını Güncelle
   */
  async updatePaymentSettings(storeId, paymentSettings) {
    try {
      const webStore = await WebStoreManager.findOne({ store: storeId });
      if (!webStore) {
        throw new Error('Web store not found');
      }

      webStore.paymentSettings = {
        ...webStore.paymentSettings,
        ...paymentSettings,
      };

      await webStore.save();

      this.addAuditLog(webStore, 'payment_settings_updated', paymentSettings);

      return {
        success: true,
        paymentSettings: webStore.paymentSettings,
      };
    } catch (error) {
      logger.error(`Update payment settings error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 5. Kargo Ayarlarını Güncelle
   */
  async updateShippingSettings(storeId, shippingSettings) {
    try {
      const webStore = await WebStoreManager.findOne({ store: storeId });
      if (!webStore) {
        throw new Error('Web store not found');
      }

      webStore.shippingSettings = {
        ...webStore.shippingSettings,
        ...shippingSettings,
      };

      await webStore.save();

      this.addAuditLog(webStore, 'shipping_settings_updated', shippingSettings);

      return {
        success: true,
        shippingSettings: webStore.shippingSettings,
      };
    } catch (error) {
      logger.error(`Update shipping settings error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 6. Vergi Ayarlarını Güncelle
   */
  async updateTaxSettings(storeId, taxSettings) {
    try {
      const webStore = await WebStoreManager.findOne({ store: storeId });
      if (!webStore) {
        throw new Error('Web store not found');
      }

      webStore.taxSettings = {
        ...webStore.taxSettings,
        ...taxSettings,
      };

      await webStore.save();

      this.addAuditLog(webStore, 'tax_settings_updated', taxSettings);

      return {
        success: true,
        taxSettings: webStore.taxSettings,
      };
    } catch (error) {
      logger.error(`Update tax settings error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 7. Rapor Oluştur
   */
  async generateReport(storeId, reportType, dateRange) {
    try {
      const webStore = await WebStoreManager.findOne({ store: storeId });
      if (!webStore) {
        throw new Error('Web store not found');
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      const orders = await StoreOrder.find({
        store: storeId,
        createdAt: { $gte: startDate },
      });

      let report = {};

      switch (reportType) {
        case 'sales':
          report = this.generateSalesReport(orders, webStore);
          break;

        case 'products':
          report = await this.generateProductsReport(storeId, dateRange);
          break;

        case 'customers':
          report = await this.generateCustomersReport(storeId, dateRange);
          break;

        case 'financial':
          report = this.generateFinancialReport(orders, webStore);
          break;

        case 'inventory':
          report = await this.generateInventoryReport(storeId);
          break;

        default:
          throw new Error('Unknown report type');
      }

      return {
        success: true,
        reportType,
        dateRange,
        generatedAt: new Date(),
        report,
      };
    } catch (error) {
      logger.error(`Generate report error: ${error.message}`);
      throw error;
    }
  }

  // ─── Helper Methods ───────────────────────────────────────────────

  calculateDailySales(orders) {
    const daily = {};

    orders.forEach(order => {
      const date = new Date(order.createdAt).toISOString().split('T')[0];
      if (!daily[date]) {
        daily[date] = { orders: 0, revenue: 0 };
      }
      daily[date].orders += 1;
      daily[date].revenue += order.total || 0;
    });

    return Object.entries(daily)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date,
        ...data,
      }));
  }

  calculateCategoryBreakdown(products) {
    const breakdown = {};

    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      breakdown[category] = (breakdown[category] || 0) + 1;
    });

    return Object.entries(breakdown).map(([name, value]) => ({
      name,
      value,
    }));
  }

  calculatePaymentMethods(orders) {
    const methods = {};

    orders.forEach(order => {
      const method = order.paymentMethod || 'Unknown';
      methods[method] = (methods[method] || 0) + 1;
    });

    return Object.entries(methods).map(([name, value]) => ({
      name,
      value,
    }));
  }

  calculateShippingMethods(orders) {
    const methods = {};

    orders.forEach(order => {
      const method = order.shippingCarrier || 'Unknown';
      methods[method] = (methods[method] || 0) + 1;
    });

    return Object.entries(methods).map(([name, value]) => ({
      name,
      value,
    }));
  }

  generateAlerts(webStore, products, orders) {
    const alerts = [];

    // Low stock alert
    const lowStockProducts = products.filter(
      p => (p.stock || 0) < (webStore.inventory.lowStockAlert || 10)
    );

    if (lowStockProducts.length > 0) {
      alerts.push({
        type: 'warning',
        message: `${lowStockProducts.length} ürün düşük stokta`,
        action: 'Stok Yönetimi',
      });
    }

    // No orders alert
    if (orders.length === 0) {
      alerts.push({
        type: 'info',
        message: 'Bu dönemde sipariş yok',
        action: 'Pazarlama',
      });
    }

    return alerts;
  }

  generateSalesReport(orders, webStore) {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      currency: webStore.accounting.currency,
      orders: orders.map(o => ({
        orderNumber: o.orderNumber,
        customer: o.customerEmail,
        amount: o.total,
        date: o.createdAt,
      })),
    };
  }

  async generateProductsReport(storeId, dateRange) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(dateRange));

    const products = await StoreProduct.find({ store: storeId });

    return {
      totalProducts: products.length,
      activeProducts: products.filter(p => p.status === 'active').length,
      inactiveProducts: products.filter(p => p.status === 'inactive').length,
      lowStockProducts: products.filter(p => (p.stock || 0) < 10).length,
    };
  }

  async generateCustomersReport(storeId, dateRange) {
    // Implementation
    return { totalCustomers: 0 };
  }

  generateFinancialReport(orders, webStore) {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Calculate costs (simplified)
    const totalCost = orders.reduce((sum, o) => {
      const cost = (o.total || 0) * 0.3; // assume 30% cost
      return sum + cost;
    }, 0);

    const profit = totalRevenue - totalCost;

    return {
      totalRevenue,
      totalCost,
      profit,
      profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
      currency: webStore.accounting.currency,
    };
  }

  async generateInventoryReport(storeId) {
    const products = await StoreProduct.find({ store: storeId });

    const totalStockValue = products.reduce((sum, p) => {
      return sum + ((p.stock || 0) * (p.price || 0));
    }, 0);

    return {
      totalProducts: products.length,
      totalStockItems: products.reduce((sum, p) => sum + (p.stock || 0), 0),
      totalStockValue,
      averageStockPerProduct: products.length > 0
        ? products.reduce((sum, p) => sum + (p.stock || 0), 0) / products.length
        : 0,
    };
  }

  addAuditLog(webStore, action, details) {
    webStore.auditLog.push({
      action,
      details,
      timestamp: new Date(),
    });
  }
}

module.exports = new WebStoreManagerService();

