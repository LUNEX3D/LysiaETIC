/**
 * backend/models/StoreCustomDomain.js
 *
 * Depo özel domain yönetimi modeli
 * Her magaza kendi custom domain'de çalışabilir
 *
 * Özellikler:
 * - Custom domain bağlama
 * - CNAME & DNS doğrulama
 * - SSL sertifikası otomatik yönetimi (Let's Encrypt)
 * - Domain redirects & SEO
 */

const mongoose = require('mongoose');

const storeCustomDomainSchema = new mongoose.Schema(
  {
    // Store referansı
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      unique: true,
      required: true,
    },

    // Domain bilgisi
    domain: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      // example: "mystore.com", "shop.example.com"
    },

    // DNS & Domain Verification
    dns: {
      status: {
        type: String,
        enum: ['pending', 'verified', 'active', 'error', 'expired'],
        default: 'pending',
      },

      // CNAME Record (domain pointing)
      cname: {
        name: String, // example.com
        targetValue: String, // lysiaetic.dashtock.io
        verified: {
          type: Boolean,
          default: false,
        },
        verifiedAt: Date,
        lastChecked: Date,
      },

      // A Record (opsiyonel IP pointing)
      aRecord: {
        ip: String,
        verified: Boolean,
        verifiedAt: Date,
      },

      // TXT Record (domain verification)
      txtRecord: {
        name: String, // _verification.example.com
        value: String, // random token
        verified: {
          type: Boolean,
          default: false,
        },
        verifiedAt: Date,
      },

      // Hata durumu
      error: String,
      errorDetails: Object,
      lastErrorAt: Date,
    },

    // SSL Sertifikası (Let's Encrypt / AWS ACM)
    ssl: {
      provider: {
        type: String,
        enum: ['letsencrypt', 'aws-acm'],
        default: 'letsencrypt',
      },

      certificateArn: String, // AWS ACM ARN
      certificateId: String, // Let's Encrypt cert ID

      issueDate: Date,
      expirationDate: Date,

      autoRenewal: {
        type: Boolean,
        default: true,
      },

      status: {
        type: String,
        enum: ['pending', 'provisioning', 'active', 'renewing', 'expired', 'failed'],
        default: 'pending',
      },

      lastRenewal: Date,
      error: String,
    },

    // Domain Redirects (301/302)
    redirects: [
      {
        from: String, // /old-page
        to: String, // /new-page
        statusCode: {
          type: Number,
          enum: [301, 302],
          default: 301,
        },
        enabled: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Security Settings
    security: {
      forceHttps: {
        type: Boolean,
        default: true,
      },

      hsts: {
        type: Boolean,
        default: true,
      },

      hstsMaxAge: {
        type: Number,
        default: 31536000, // 1 year
      },

      xframeOptions: {
        type: String,
        enum: ['DENY', 'SAMEORIGIN'],
        default: 'SAMEORIGIN',
      },

      corsEnabled: {
        type: Boolean,
        default: true,
      },

      corsOrigins: [String],
    },

    // Basic Auth (opsiyonel)
    basicAuth: {
      enabled: Boolean,
      username: String,
      passwordHash: String,
    },

    // WAF Rules (Web Application Firewall)
    wafRules: {
      enabled: Boolean,
      blockSuspiciousIPs: Boolean,
      rateLimit: {
        requests: Number, // per minute
        enabled: Boolean,
      },
    },

    // Analytics & Monitoring
    analytics: {
      totalHttps: {
        type: Number,
        default: 0,
      },

      totalRequests: {
        type: Number,
        default: 0,
      },

      availability: {
        type: Number,
        default: 100, // 0-100 %
      },

      lastStatusCheck: Date,

      uptime: [
        {
          date: Date,
          upPercentage: Number,
        },
      ],

      errorLogs: [
        {
          timestamp: Date,
          errorCode: String,
          message: String,
          count: Number,
        },
      ],
    },

    // Email Notifications
    notifications: {
      emailOnRenewal: {
        type: Boolean,
        default: true,
      },

      emailOnError: {
        type: Boolean,
        default: true,
      },

      emailOnExpiry: {
        type: Boolean,
        default: true,
      },

      notificationEmail: String,
    },

    // Audit Log
    auditLog: [
      {
        action: String, // 'created', 'verified', 'ssl_provisioned', etc.
        status: String,
        details: Object,
        performedBy: mongoose.Schema.Types.ObjectId,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    deletedAt: Date,
  },
  { collection: 'store_custom_domains' }
);

// Indexes
storeCustomDomainSchema.index({ store: 1 });
storeCustomDomainSchema.index({ domain: 1 });
storeCustomDomainSchema.index({ 'dns.status': 1 });
storeCustomDomainSchema.index({ 'ssl.status': 1 });
storeCustomDomainSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StoreCustomDomain', storeCustomDomainSchema);

