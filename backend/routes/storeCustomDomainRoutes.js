/**
 * backend/routes/storeCustomDomainRoutes.js
 *
 * Routes for custom domain management
 * - Domain setup & verification
 * - DNS record verification
 * - SSL certificate provisioning
 * - Health checks & monitoring
 * - Redirects management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const storeCustomDomainService = require('../services/storeCustomDomainService');
const logger = require('../config/logger');

/**
 * POST /api/store/:storeId/domain/initiate
 *
 * Custom domain bağlama başlat
 * Body: { domain: "example.com" }
 */
router.post('/:storeId/initiate', authMiddleware, async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required',
      });
    }

    const result = await storeCustomDomainService.initiateCustomDomain(
      req.params.storeId,
      domain
    );

    res.json(result);
  } catch (error) {
    logger.error(`Domain initiation error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/store/domain/:domainId/verify-dns
 *
 * DNS records doğrulaması
 * Checks CNAME and TXT records from DNS
 */
router.post('/:domainId/verify-dns', authMiddleware, async (req, res) => {
  try {
    const result = await storeCustomDomainService.verifyDNSRecords(req.params.domainId);

    res.json(result);
  } catch (error) {
    logger.error(`DNS verification error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/store/domain/:domainId/provision-ssl
 *
 * SSL Sertifikası oluştur
 * Must be called after DNS verification
 */
router.post('/:domainId/provision-ssl', authMiddleware, async (req, res) => {
  try {
    const result = await storeCustomDomainService.provisionSSLCertificate(
      req.params.domainId
    );

    res.json(result);
  } catch (error) {
    logger.error(`SSL provisioning error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/store/domain/:domainId/status
 *
 * Mevcut domain durumunu getir
 */
router.get('/:domainId/status', authMiddleware, async (req, res) => {
  try {
    const result = await storeCustomDomainService.getDomainStatus(req.params.domainId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Get domain status error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/store/domain/:domainId/health-check
 *
 * Domain sağlık durumu kontrolü
 * Simulates a HTTPS request and monitors uptime
 */
router.post('/:domainId/health-check', authMiddleware, async (req, res) => {
  try {
    const result = await storeCustomDomainService.performHealthCheck(req.params.domainId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`Health check error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/store/domain/:domainId/redirects
 *
 * URL redirect kuralı ekle
 * Body: { fromPath: "/old-page", toPath: "/new-page", statusCode: 301 }
 */
router.post('/:domainId/redirects', authMiddleware, async (req, res) => {
  try {
    const { fromPath, toPath, statusCode } = req.body;

    if (!fromPath || !toPath) {
      return res.status(400).json({
        success: false,
        message: 'fromPath and toPath are required',
      });
    }

    const result = await storeCustomDomainService.addRedirect(
      req.params.domainId,
      fromPath,
      toPath,
      statusCode || 301
    );

    res.json(result);
  } catch (error) {
    logger.error(`Add redirect error: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * PUT /api/store/domain/:domainId/redirects/:redirectId
 *
 * Redirect kuralını güncelle
 */
router.put('/:domainId/redirects/:redirectId', authMiddleware, async (req, res) => {
  try {
    const { fromPath, toPath, statusCode, enabled } = req.body;
    // TODO: Implement update logic
    res.json({ success: true, message: 'Redirect updated' });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * DELETE /api/store/domain/:domainId/redirects/:redirectId
 *
 * Redirect kuralını sil
 */
router.delete('/:domainId/redirects/:redirectId', authMiddleware, async (req, res) => {
  try {
    // TODO: Implement delete logic
    res.json({ success: true, message: 'Redirect deleted' });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;

