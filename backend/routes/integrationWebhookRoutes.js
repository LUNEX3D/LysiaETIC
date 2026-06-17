/**
 * integrationWebhookRoutes.js â€” Pazaryeri webhook abonelik yÃ¶netimi
 * TÃ¼m route'lar /api/integrations altÄ±nda Ã§alÄ±ÅŸÄ±r.
 */

const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const controller = require("../controllers/integrationWebhookController");

router.use(authMiddleware, subscriptionMiddleware);

router.get("/trendyol/webhooks", controller.listWebhooks);
router.post("/trendyol/webhooks", controller.createWebhook);
router.put("/trendyol/webhooks/:id", controller.updateWebhook);
router.delete("/trendyol/webhooks/:id", controller.deleteWebhook);
router.put("/trendyol/webhooks/:id/activate", controller.activateWebhook);
router.put("/trendyol/webhooks/:id/deactivate", controller.deactivateWebhook);

module.exports = router;

