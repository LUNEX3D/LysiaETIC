/**
 * backend/models/WebStoreManager.js
 *
 * Web Mağaza Yönetim Sistemi
 * IKAS, Ticimax, IdeaSoft, Shopify tarzı
 *
 * Özelliki:
 * - Mağaza kurulumu (adres, ödeme, kargo, vergi)
 * - Dashboard (satış, siparişler, ürünler)
 * - Pazaryeri senkronizasyonu
 * - Raporlar ve analitikler
 */

const mongoose = require('mongoose');

const webStoreManagerSchema = new mongoose.Schema(
  {
    // Store referansı
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      unique: true,
    },

    // ─── TEMEL BİLGİLER ───────────────────────────────────────────
    storeInfo: {
      storeName: String,
      storeTagline: String,
      description: String,
      logo: String,
      banner: String,
      phone: String,
      email: String,

      // İşletme Bilgileri
      businessName: String,
      businessType: {
        type: String,
        enum: ['bireysel', 'şirket', 'kooperatif'],
      },
      taxId: String, // KDV no veya Vergi no
      registryNumber: String, // Ticaret Registry
    },

    // ─── ADRES BİLGİLERİ ───────────────────────────────────────────
    addresses: {
      billing: {
        name: String,
        street: String,
        city: String,
        province: String,
        postalCode: String,
        country: String,
      },
      shipping: {
        name: String,
        street: String,
        city: String,
        province: String,
        postalCode: String,
        country: String,
        isDefault: Boolean,
      },
      warehouse: [{
        name: String,
        street: String,
        city: String,
        country: String,
      }],
    },

    // ─── ÖDEME AYARLARI ───────────────────────────────────────────
    paymentSettings: {
      providers: [
        {
          name: {
            type: String,
            enum: ['paytr', 'iyzipay', 'stripe', 'pagseguro'],
          },
          enabled: Boolean,
          credentials: Object, // encrypted
          testMode: Boolean,
          successUrl: String,
          failureUrl: String,
        },
      ],

      // Bank Transfers
      bankAccounts: [
        {
          bankName: String,
          accountHolder: String,
          accountNumber: String,
          iban: String,
          swift: String,
          enabled: Boolean,
        },
      ],

      // Invoice Settings
      invoicePrefix: String, // INV-2026-
      invoiceStartNumber: Number,
      invoiceType: {
        type: String,
        enum: ['tax', 'receipt', 'packing'],
      },
    },

    // ─── KARGO/SHIPPING AYARLARI ───────────────────────────────────
    shippingSettings: {
      providers: [
        {
          name: {
            type: String,
            enum: ['trendyol', 'hepsiburada', 'n11', 'aras', 'mng', 'ups'],
          },
          enabled: Boolean,
          credentials: Object,
          defaultCarrier: Boolean,
          rates: [
            {
              weightFrom: Number, // kg
              weightTo: Number,
              pricePerKg: Number,
              fixedPrice: Number,
              estimatedDays: Number,
            },
          ],
        },
      ],

      // Free Shipping
      freeShippingThreshold: Number, // Bedava kargo minimumu
      internationalShipping: Boolean,

      // Return Address
      returnAddress: {
        name: String,
        street: String,
        city: String,
        country: String,
      },
    },

    // ─── TAX AYARLARI ───────────────────────────────────────────
    taxSettings: {
      defaultTaxRate: Number, // %
      taxByProduct: Boolean,

      regions: [
        {
          country: String,
          state: String,
          taxRate: Number,
        },
      ],

      // E-Fatura
      eFatura: {
        enabled: Boolean,
        provider: {
          type: String,
          enum: ['qnb', 'sovos', 'odeal'],
        },
        credentials: Object,
      },
    },

    // ─── PAZARYERI ENTEGRASYONLARı ───────────────────────────────────
    marketplaceIntegrations: [
      {
        marketplace: {
          type: String,
          enum: ['trendyol', 'hepsiburada', 'n11', 'amazon', 'noon', 'instagram'],
        },
        enabled: Boolean,
        connected: Boolean,
        credentials: Object,

        syncSettings: {
          autoSync: Boolean,
          syncInterval: Number, // minutes
          lastSync: Date,

          // Mapping
          categoryMapping: [{
            webStoreCategory: mongoose.Schema.Types.ObjectId,
            marketplaceCategory: String,
          }],

          // Sync Limits
          maxSyncProducts: Number,
          syncSchedule: String, // cron expression
        },

        stats: {
          productsSynced: Number,
          lastError: String,
          errorCount: Number,
        },
      },
    ],

    // ─── MUHASEBE & RAPORLAR ───────────────────────────────────────
    accounting: {
      currency: { type: String, default: 'TRY' },

      financialSettings: {
        fiscalYear: Number,
        accountingMethod: {
          type: String,
          enum: ['accrual', 'cash'],
        },
        taxFilingPeriod: {
          type: String,
          enum: ['monthly', 'quarterly', 'annually'],
        },
      },

      // Cost Categories
      costCategories: [
        {
          name: String, // "Kargo Ücreti", "Paketleme", "İşçilik"
          category: String,
          percentage: Number,
        },
      ],
    },

    // ─── KAMPANYA & PAZARLAMA ───────────────────────────────────────
    marketing: {
      campaigns: [{
        name: String,
        type: {
          type: String,
          enum: ['discount', 'flash_sale', 'bundle'],
        },
        startDate: Date,
        endDate: Date,
        discount: Number, // % or flat amount
        minOrderAmount: Number,
        applicableProducts: [mongoose.Schema.Types.ObjectId],
      }],

      // Email Marketing
      emailSettings: {
        automatedEmails: {
          orderConfirmation: Boolean,
          shipmentNotification: Boolean,
          deliveryNotification: Boolean,
          customerReview: Boolean,
        },
      },

      // SEO
      seoSettings: {
        metaTitle: String,
        metaDescription: String,
        robots: String,
        sitemap: {
          enabled: Boolean,
          lastGenerated: Date,
        },
      },
    },

    // ─── AYARLAR & KONFİGÜRASYON ───────────────────────────────────
    settings: {
      // Display Settings
      currency: String,
      timeZone: String,
      language: String,

      // Cart & Checkout
      enableGuestCheckout: Boolean,
      minimumOrderAmount: Number,
      maximumOrderAmount: Number,
      cartTimeout: Number, // minutes

      // Product Settings
      enableProductReviews: Boolean,
      requireReviewApproval: Boolean,
      enableWishlist: Boolean,

      // Security
      twoFactorAuth: Boolean,
      ipRestriction: [String],
      maintenanceMode: Boolean,
      maintenanceMessage: String,
    },

    // ─── DASHBOARD & ANALYTICS ───────────────────────────────────────
    analytics: {
      totalOrders: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
      totalProducts: {
        type: Number,
        default: 0,
      },
      averageOrderValue: {
        type: Number,
        default: 0,
      },
      conversionRate: {
        type: Number,
        default: 0,
      },

      // Trends
      monthlySales: [
        {
          month: Date,
          orders: Number,
          revenue: Number,
          visitors: Number,
        },
      ],

      // Top Products
      topProducts: [
        {
          product: mongoose.Schema.Types.ObjectId,
          sales: Number,
          revenue: Number,
        },
      ],
    },

    // ─── MÜŞTERI YÖNETİMİ ───────────────────────────────────────────
    customerManagement: {
      totalCustomers: {
        type: Number,
        default: 0,
      },

      segments: [
        {
          name: String, // VIP, Regular, At-Risk
          criteria: Object,
          customers: [mongoose.Schema.Types.ObjectId],
        },
      ],

      // Communication
      automatedMessages: {
        welcomeEmail: {
          enabled: Boolean,
          delay: Number,
          content: String,
        },
        abandonedCart: {
          enabled: Boolean,
          delay: Number,
          reminderCount: Number,
        },
      },
    },

    // ─── İÇERİK YÖNETİMİ ───────────────────────────────────────────
    contentManagement: {
      pages: [
        {
          title: String,
          slug: String,
          content: String,
          published: Boolean,
        },
      ],

      blog: [
        {
          title: String,
          slug: String,
          content: String,
          author: String,
          publishedAt: Date,
          tags: [String],
        },
      ],

      faqItems: [
        {
          question: String,
          answer: String,
          category: String,
          order: Number,
        },
      ],
    },

    // ─── STOKs / INVENTORY ───────────────────────────────────────────
    inventory: {
      lowStockAlert: Number, // Alert when < this amount
      outOfStockAction: {
        type: String,
        enum: ['hide', 'preorder', 'notify'],
      },

      // Automat İnventory Management
      autoReorder: {
        enabled: Boolean,
        reorderPoint: Number,
        reorderQuantity: Number,
        supplier: String,
      },

      // Stock Locations
      stockLocations: [
        {
          warehouse: mongoose.Schema.Types.ObjectId,
          stock: Number,
        },
      ],
    },

    // ─── AUDIT LOG ───────────────────────────────────────────────────
    auditLog: [
      {
        action: String,
        performedBy: mongoose.Schema.Types.ObjectId,
        details: Object,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ─── TIMESTAMPS ───────────────────────────────────────────────────
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: 'web_store_managers' }
);

// Indexes
webStoreManagerSchema.index({ store: 1 });
webStoreManagerSchema.index({ 'storeInfo.storeName': 1 });
webStoreManagerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WebStoreManager', webStoreManagerSchema);

