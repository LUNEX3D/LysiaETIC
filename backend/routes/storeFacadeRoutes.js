const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/storeFacadeController");

router.use(authMiddleware);
router.use(subscriptionMiddleware);
router.use(requirePlanFeature("own_storefront"));

router.get("/catalog", ctrl.getCatalog);
router.get("/stores", ctrl.listStores);
router.post("/stores", ctrl.createStore);
router.post("/stores/generate", ctrl.generateAi);
router.get("/stores/:siteId/setup-progress", ctrl.getSetupProgress);
router.post("/stores/:siteId/apply-kit", ctrl.applyKit);
router.post("/stores/:siteId/publish", ctrl.publish);

module.exports = router;
