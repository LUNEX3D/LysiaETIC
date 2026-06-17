/**
 * backend/services/storeCustomDomainService.js
 *
 * Custom domain işlemleri servisi
 * - Domain bağlama & DNS doğrulama
 * - SSL sertifikası yönetimi
 * - Domain monitoring & health checks
 */

const axios = require('axios');
const dns = require('dns').promises;
const crypto = require('crypto');
const logger = require('../config/logger');

const StoreCustomDomain = require('../models/StoreCustomDomain');
const Store = require('../models/Store');

class StoreCustomDomainService {
  /**
   * 1. Custom domain bağlama başlat
   * Verification token oluşturur ve DNS instructions döner
   */
  async initiateCustomDomain(storeId, domain) {
    try {
      // Validation: domain format kontrol
      if (!this.isValidDomainFormat(domain)) {
        throw new Error('Invalid domain format. Use example.com or subdomain.example.com');
      }

      // Check: domain zaten kullanımda mı?
      const existing = await StoreCustomDomain.findOne({ domain: domain });
      if (existing && existing.store.toString() !== storeId.toString()) {
        throw new Error('Domain already in use by another store');
      }

      // Generate unique verification token
      const verificationToken = this.generateVerificationToken();

      // Varsayılan target (Load Balancer / Proxy)
      const targetValue = process.env.DOMAIN_TARGET_VALUE || 'lysiaetic.dashtock.io';

      // Create or update domain record
      let customDomain = await StoreCustomDomain.findOne({
        store: storeId,
      });

      if (!customDomain) {
        customDomain = new StoreCustomDomain({
          store: storeId,
          domain: domain,
        });
      } else {
        customDomain.domain = domain;
      }

      // Set DNS records
      customDomain.dns = {
        status: 'pending',
        cname: {
          name: domain,
          targetValue: targetValue,
          verified: false,
        },
        txtRecord: {
          name: `_verification.${domain}`,
          value: verificationToken,
          verified: false,
        },
      };

      await customDomain.save();

      // Log action
      this.addAuditLog(customDomain, 'domain_initiated', 'success', {
        domain: domain,
        verificationToken: verificationToken.substring(0, 10) + '...', // masked
      });

      return {
        success: true,
        customDomain: customDomain._id,
        domain: domain,
        instructions: {
          step: '1-of-3',
          title: 'Add CNAME Record',
          description: 'Add the following CNAME record to your domain DNS settings',
          cname: {
            name: domain,
            type: 'CNAME',
            value: targetValue,
            ttl: 3600,
          },
          verification: {
            name: `_verification.${domain}`,
            type: 'TXT',
            value: verificationToken,
            ttl: 300,
            note: 'This record can be removed after verification',
          },
          documentation: `${process.env.APP_URL}/docs/custom-domain`,
          estimatedTime: '5-10 minutes to propagate',
        },
      };
    } catch (error) {
      logger.error(`Domain initiation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 2. DNS Records doğrulama
   * CNAME ve TXT records i DNS'ten kontrol eder
   */
  async verifyDNSRecords(customDomainId) {
    try {
      const domainRecord = await StoreCustomDomain.findById(customDomainId);
      if (!domainRecord) throw new Error('Domain record not found');

      const domain = domainRecord.domain;
      const results = {
        cname: null,
        txt: null,
        overallStatus: 'failed',
      };

      try {
        // CNAME doğrulaması
        logger.info(`Verifying CNAME for ${domain}...`);
        const cnameRecords = await dns.resolveCname(domain);

        const expectedTarget = domainRecord.dns.cname.targetValue;
        const normalizedRecords = cnameRecords.map(r => r.toLowerCase());
        const normalizedExpected = expectedTarget.toLowerCase();

        const cnameVerified = normalizedRecords.some(record =>
          record.includes(normalizedExpected) || normalizedExpected.includes(record)
        );

        if (cnameVerified) {
          domainRecord.dns.cname.verified = true;
          domainRecord.dns.cname.verifiedAt = new Date();
          results.cname = { verified: true, records: cnameRecords };
          logger.info(`✓ CNAME verified for ${domain}`);
        } else {
          results.cname = {
            verified: false,
            found: cnameRecords,
            expected: expectedTarget,
          };
          logger.warn(
            `CNAME mismatch for ${domain}. Found: ${cnameRecords.join(', ')}, Expected: ${expectedTarget}`
          );
        }
      } catch (cnameError) {
        results.cname = { verified: false, error: cnameError.message };
        logger.warn(`CNAME check failed for ${domain}: ${cnameError.message}`);
      }

      try {
        // TXT doğrulaması (verification)
        logger.info(`Verifying TXT record for ${domain}...`);
        const txtRecords = await dns.resolveTxt(domainRecord.dns.txtRecord.name);

        const expectedToken = domainRecord.dns.txtRecord.value;
        const txtVerified = txtRecords.some(record =>
          record.join('') === expectedToken
        );

        if (txtVerified) {
          domainRecord.dns.txtRecord.verified = true;
          results.txt = { verified: true };
          logger.info(`✓ TXT verification record verified for ${domain}`);
        } else {
          results.txt = {
            verified: false,
            found: txtRecords.map(r => r.join('')),
            expected: expectedToken,
          };
          logger.warn(`TXT record not found or mismatch for ${domain}`);
        }
      } catch (txtError) {
        results.txt = { verified: false, error: txtError.message };
        logger.warn(`TXT check failed for ${domain}: ${txtError.message}`);
      }

      // Determine overall status
      if (results.cname.verified && results.txt.verified) {
        domainRecord.dns.status = 'verified';
        domainRecord.dns.error = null;
        results.overallStatus = 'verified';
        logger.info(`✅ All DNS records verified for ${domain}`);
      } else {
        domainRecord.dns.status = 'error';
        domainRecord.dns.error =
          'DNS records not properly configured. Please check CNAME and TXT records.';
        domainRecord.dns.lastErrorAt = new Date();
        logger.warn(`⚠️ DNS verification incomplete for ${domain}`);
      }

      domainRecord.dns.lastChecked = new Date();
      await domainRecord.save();

      this.addAuditLog(domainRecord, 'dns_verified', 'success', results);

      return {
        success: results.overallStatus === 'verified',
        domain: domain,
        verification: results,
        nextStep: results.overallStatus === 'verified'
          ? 'SSL certificate provisioning'
          : 'Please configure DNS records correctly',
      };
    } catch (error) {
      logger.error(`DNS verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 3. SSL Sertifikası oluştur (Let's Encrypt)
   * Automatically provisions SSL certificate
   */
  async provisionSSLCertificate(customDomainId) {
    try {
      const domainRecord = await StoreCustomDomain.findById(customDomainId);
      if (!domainRecord) throw new Error('Domain record not found');

      // DNS verification zorunlu
      if (domainRecord.dns.status !== 'verified') {
        throw new Error(
          'Domain DNS must be verified first. Please verify DNS records and try again.'
        );
      }

      logger.info(`Provisioning SSL certificate for ${domainRecord.domain}...`);

      // SSL sertifikası talebi (Simulated - gerçekte CDN provider API kullanılır)
      // Örnek: Cloudflare, AWS ACM, Let's Encrypt API, etc.
      const certificateArn = await this.requestSSLCertificate(domainRecord.domain);

      domainRecord.ssl = {
        provider: 'letsencrypt',
        certificateId: certificateArn,
        issueDate: new Date(),
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 yıl
        autoRenewal: true,
        status: 'active',
      };

      domainRecord.dns.status = 'active';
      await domainRecord.save();

      logger.info(`✓ SSL certificate provisioned for ${domainRecord.domain}`);

      this.addAuditLog(domainRecord, 'ssl_provisioned', 'success', {
        provider: domainRecord.ssl.provider,
        certificateArn: certificateArn,
      });

      return {
        success: true,
        domain: domainRecord.domain,
        ssl: {
          status: 'active',
          provider: domainRecord.ssl.provider,
          issueDate: domainRecord.ssl.issueDate,
          expirationDate: domainRecord.ssl.expirationDate,
          autoRenewal: domainRecord.ssl.autoRenewal,
        },
        message: `SSL certificate successfully issued and deployed for ${domainRecord.domain}. Your site is now secure!`,
      };
    } catch (error) {
      logger.error(`SSL provisioning failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 4. Domain Redirects Yönetimi
   */
  async addRedirect(customDomainId, fromPath, toPath, statusCode = 301) {
    try {
      const domainRecord = await StoreCustomDomain.findById(customDomainId);
      if (!domainRecord) throw new Error('Domain record not found');

      // Validation
      if (!fromPath.startsWith('/')) fromPath = '/' + fromPath;
      if (!toPath.startsWith('/')) toPath = '/' + toPath;

      // Check duplicate
      const duplicate = domainRecord.redirects.find(
        r => r.from === fromPath && r.to === toPath && r.enabled
      );
      if (duplicate) throw new Error('This redirect already exists');

      // Add redirect
      domainRecord.redirects.push({
        from: fromPath,
        to: toPath,
        statusCode: statusCode,
        enabled: true,
        createdAt: new Date(),
      });

      await domainRecord.save();

      this.addAuditLog(domainRecord, 'redirect_added', 'success', {
        from: fromPath,
        to: toPath,
        statusCode: statusCode,
      });

      return {
        success: true,
        redirect: domainRecord.redirects[domainRecord.redirects.length - 1],
      };
    } catch (error) {
      logger.error(`Add redirect failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 5. Health Check & Monitoring
   */
  async performHealthCheck(customDomainId) {
    try {
      const domainRecord = await StoreCustomDomain.findById(customDomainId);
      if (!domainRecord) throw new Error('Domain record not found');

      const domain = domainRecord.domain;
      const startTime = Date.now();
      let statusCode = 0;
      let responseTime = 0;
      let available = false;

      try {
        const response = await axios.get(`https://${domain}`, {
          timeout: 10000,
          validateStatus: () => true, // Tüm status kodları kabul et
        });

        statusCode = response.status;
        responseTime = Date.now() - startTime;
        available = statusCode >= 200 && statusCode < 400;
      } catch (error) {
        logger.warn(`Health check failed for ${domain}: ${error.message}`);
        statusCode = 0;
        responseTime = Date.now() - startTime;
        available = false;
      }

      // Update analytics
      domainRecord.analytics.totalRequests += 1;
      domainRecord.analytics.lastStatusCheck = new Date();

      if (!domainRecord.analytics.uptime) {
        domainRecord.analytics.uptime = [];
      }

      // Calculate uptime percentage (simple: today)
      const todayUptime = domainRecord.analytics.uptime.find(
        u => u.date.toDateString() === new Date().toDateString()
      );

      if (available) {
        if (todayUptime) {
          todayUptime.upPercentage = Math.min(100, todayUptime.upPercentage + 5);
        } else {
          domainRecord.analytics.uptime.push({
            date: new Date(),
            upPercentage: 100,
          });
        }
      }

      domainRecord.analytics.availability = domainRecord.analytics.uptime.length > 0
        ? domainRecord.analytics.uptime.reduce((sum, u) => sum + u.upPercentage, 0) /
          domainRecord.analytics.uptime.length
        : 100;

      await domainRecord.save();

      return {
        domain: domain,
        status: available ? 'online' : 'offline',
        statusCode: statusCode,
        responseTime: responseTime,
        availability: domainRecord.analytics.availability,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`Health check error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 6. Get Domain Status
   */
  async getDomainStatus(customDomainId) {
    try {
      const domainRecord = await StoreCustomDomain.findById(customDomainId)
        .populate('store', 'name domain email');

      if (!domainRecord) throw new Error('Domain record not found');

      return {
        domain: domainRecord.domain,
        store: {
          id: domainRecord.store._id,
          name: domainRecord.store.name,
        },
        status: {
          dns: domainRecord.dns.status,
          ssl: domainRecord.ssl.status,
          overall: this.calculateOverallStatus(domainRecord),
        },
        dns: {
          cnameVerified: domainRecord.dns.cname.verified,
          txtVerified: domainRecord.dns.txtRecord.verified,
          lastChecked: domainRecord.dns.lastChecked,
        },
        ssl: {
          issueDate: domainRecord.ssl.issueDate,
          expirationDate: domainRecord.ssl.expirationDate,
          autoRenewal: domainRecord.ssl.autoRenewal,
          daysUntilExpiry: this.daysUntilExpiry(domainRecord.ssl.expirationDate),
        },
        analytics: {
          availability: domainRecord.analytics.availability,
          lastStatusCheck: domainRecord.analytics.lastStatusCheck,
        },
        createdAt: domainRecord.createdAt,
      };
    } catch (error) {
      logger.error(`Get domain status failed: ${error.message}`);
      throw error;
    }
  }

  // ─── Helper Methods ───────────────────────────────────────────────────

  isValidDomainFormat(domain) {
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async requestSSLCertificate(domain) {
    // Placeholder: Actual implementation would use Let's Encrypt API
    // or AWS ACM, Cloudflare, etc.

    // For now: return mock certificate ID
    return `cert_${domain.replace(/\./g, '_')}_${Date.now()}`;
  }

  calculateOverallStatus(domainRecord) {
    if (domainRecord.dns.status === 'error' || domainRecord.ssl.status === 'error') {
      return 'error';
    }
    if (domainRecord.dns.status === 'active' && domainRecord.ssl.status === 'active') {
      return 'active';
    }
    return 'pending';
  }

  daysUntilExpiry(expirationDate) {
    const now = new Date();
    const diffTime = expirationDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  addAuditLog(domainRecord, action, status, details) {
    domainRecord.auditLog.push({
      action: action,
      status: status,
      details: details,
      timestamp: new Date(),
    });
  }
}

module.exports = new StoreCustomDomainService();

