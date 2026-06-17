"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/themeStudioController");

const wbFeature = requirePlanFeature("website_builder");

router.get("/theme-studio/sections/registry", authMiddleware, ctrl.getSectionRegistry);
router.get("/theme-studio/marketplace", authMiddleware, ctrl.getMarketplace);
router.get("/theme-studio/my-themes", authMiddleware, ctrl.getMyThemes);
router.post("/theme-studio/seed-starter", authMiddleware, ctrl.seedStarterTheme);

const siteStudioRouter = express.Router({ mergeParams: true });
siteStudioRouter.get("/dawn/manifest", ctrl.getDawnManifest);
siteStudioRouter.get("/document", ctrl.getDocument);
siteStudioRouter.patch("/document", ctrl.patchDocument);
siteStudioRouter.post("/publish", ctrl.publish);
siteStudioRouter.post("/undo", ctrl.undo);
siteStudioRouter.post("/redo", ctrl.redo);
siteStudioRouter.post("/install", ctrl.installTheme);
siteStudioRouter.post("/duplicate", ctrl.duplicateTheme);
siteStudioRouter.get("/export", ctrl.exportTheme);
siteStudioRouter.post("/import", ctrl.importTheme);

router.use(
    "/sites/:siteId/theme-studio",
    authMiddleware,
    subscriptionMiddleware,
    wbFeature,
    siteStudioRouter
);

module.exports = router;
