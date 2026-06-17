"use strict";

const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");
const { requirePlanFeature } = require("../middlewares/planFeatureMiddleware");
const ctrl = require("../controllers/websiteBuilderController");
const toolsCtrl = require("../controllers/wbBuilderToolsController");

router.use(authMiddleware);
router.use(subscriptionMiddleware);

const wbFeature = requirePlanFeature("website_builder");
const domainFeature = requirePlanFeature("custom_domain");

// GET /themes → wbThemeRoutes (wbThemeController + theme version engine)

// ─── SITES ────────────────────────────────────────────────────────────────────
router.get("/sites", wbFeature, ctrl.getSites);
router.post("/sites", wbFeature, ctrl.createSite);
router.get("/sites/:siteId", wbFeature, ctrl.getSite);
router.patch("/sites/:siteId", wbFeature, ctrl.updateSite);
router.delete("/sites/:siteId", wbFeature, ctrl.deleteSite);
router.post("/sites/:siteId/publish", wbFeature, ctrl.publishSite);
router.post("/sites/:siteId/unpublish", wbFeature, ctrl.unpublishSite);
router.get("/sites/:siteId/publish-status", wbFeature, toolsCtrl.getPublishStatus);
router.post("/sites/:siteId/deploy", wbFeature, toolsCtrl.deploySite);

router.get("/sites/:siteId/seo-entities/:entityType", wbFeature, toolsCtrl.listSeoEntities);
router.patch("/sites/:siteId/seo-entities/:entityType/:entityId", wbFeature, toolsCtrl.updateSeoEntity);
router.post("/sites/:siteId/seo-generate", wbFeature, toolsCtrl.generateSeoAi);
router.post("/sites/:siteId/seo-bulk-generate", wbFeature, toolsCtrl.bulkGenerateSeo);

router.get("/sites/:siteId/performance", wbFeature, toolsCtrl.getPerformance);
router.get("/sites/:siteId/email-domain", wbFeature, toolsCtrl.getEmailDomainStatus);
router.post("/sites/:siteId/email-domain/verify", wbFeature, toolsCtrl.verifyEmailDomain);
router.post("/sites/:siteId/preview-token", wbFeature, ctrl.createPreviewToken);

// ─── THEME APPLY ──────────────────────────────────────────────────────────────
router.post("/sites/:siteId/theme", wbFeature, ctrl.applyTheme);

// ─── PAGES ────────────────────────────────────────────────────────────────────
router.get("/sites/:siteId/pages", wbFeature, ctrl.getPages);
router.post("/sites/:siteId/pages", wbFeature, ctrl.createPage);
router.get("/sites/:siteId/pages/:pageId", wbFeature, ctrl.getPage);
router.patch("/sites/:siteId/pages/:pageId", wbFeature, ctrl.updatePage);
router.delete("/sites/:siteId/pages/:pageId", wbFeature, ctrl.deletePage);
router.post("/sites/:siteId/pages/:pageId/publish", wbFeature, ctrl.publishPage);
router.get("/sites/:siteId/pages/:pageId/revisions", wbFeature, ctrl.getPageRevisions);
router.post("/sites/:siteId/pages/:pageId/revisions/:revisionId/restore", wbFeature, ctrl.restorePageRevision);

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
router.post("/sites/:siteId/pages/:pageId/sections", wbFeature, ctrl.addSection);
router.put("/sites/:siteId/pages/:pageId/sections", wbFeature, ctrl.reorderSections);
router.patch("/sites/:siteId/pages/:pageId/sections/:sectionId", wbFeature, ctrl.updateSection);
router.delete("/sites/:siteId/pages/:pageId/sections/:sectionId", wbFeature, ctrl.deleteSection);

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
router.get("/sites/:siteId/navigation", wbFeature, ctrl.getNavigation);
router.put("/sites/:siteId/navigation/:position", wbFeature, ctrl.updateNavigation);

// ─── BLOG ─────────────────────────────────────────────────────────────────────
router.get("/sites/:siteId/blog/posts", wbFeature, ctrl.getBlogPosts);
router.post("/sites/:siteId/blog/posts", wbFeature, ctrl.createBlogPost);
router.get("/sites/:siteId/blog/posts/:postId", wbFeature, ctrl.getBlogPost);
router.patch("/sites/:siteId/blog/posts/:postId", wbFeature, ctrl.updateBlogPost);
router.delete("/sites/:siteId/blog/posts/:postId", wbFeature, ctrl.deleteBlogPost);
router.get("/sites/:siteId/blog/categories", wbFeature, ctrl.getBlogCategories);
router.post("/sites/:siteId/blog/categories", wbFeature, ctrl.createBlogCategory);
router.delete("/sites/:siteId/blog/categories/:categoryId", wbFeature, ctrl.deleteBlogCategory);

// ─── MEDIA ────────────────────────────────────────────────────────────────────
router.get("/sites/:siteId/media", wbFeature, ctrl.getMedia);
router.post("/sites/:siteId/media", wbFeature, ctrl.mediaUploadMiddleware, ctrl.uploadMedia);
router.delete("/sites/:siteId/media/:mediaId", wbFeature, ctrl.deleteMedia);

// ─── POPUPS ───────────────────────────────────────────────────────────────────
router.get("/sites/:siteId/popups", wbFeature, toolsCtrl.listPopups);
router.post("/sites/:siteId/popups", wbFeature, toolsCtrl.createPopup);
router.patch("/sites/:siteId/popups/:popupId", wbFeature, toolsCtrl.updatePopup);
router.delete("/sites/:siteId/popups/:popupId", wbFeature, toolsCtrl.deletePopup);

// ─── FORMS ────────────────────────────────────────────────────────────────────
router.get("/sites/:siteId/forms", wbFeature, toolsCtrl.listForms);
router.post("/sites/:siteId/forms", wbFeature, toolsCtrl.createForm);
router.patch("/sites/:siteId/forms/:formId", wbFeature, toolsCtrl.updateForm);
router.delete("/sites/:siteId/forms/:formId", wbFeature, toolsCtrl.deleteForm);
router.get("/sites/:siteId/form-submissions", wbFeature, toolsCtrl.listFormSubmissions);
router.patch("/sites/:siteId/form-submissions/:submissionId", wbFeature, toolsCtrl.updateFormSubmission);
router.get("/sites/:siteId/form-analytics", wbFeature, toolsCtrl.getFormAnalytics);
router.get("/sites/:siteId/form-submissions/export.csv", wbFeature, toolsCtrl.exportFormSubmissions);
router.get("/sites/:siteId/popup-analytics", wbFeature, toolsCtrl.getPopupAnalytics);

// ─── SEO CENTER ───────────────────────────────────────────────────────────────
router.get("/sites/:siteId/seo-center", wbFeature, toolsCtrl.getSeoCenter);
router.get("/sites/:siteId/redirects", wbFeature, toolsCtrl.listRedirects);
router.post("/sites/:siteId/redirects", wbFeature, toolsCtrl.createRedirect);
router.patch("/sites/:siteId/redirects/:redirectId", wbFeature, toolsCtrl.updateRedirect);
router.delete("/sites/:siteId/redirects/:redirectId", wbFeature, toolsCtrl.deleteRedirect);

// ─── DOMAIN ───────────────────────────────────────────────────────────────────
router.get("/sites/:siteId/domain", wbFeature, ctrl.getDomain);
router.get("/sites/:siteId/domains", wbFeature, ctrl.listDomains);
router.post("/sites/:siteId/domain", domainFeature, ctrl.addDomain);
router.post("/sites/:siteId/domain/verify", domainFeature, ctrl.verifyDomain);
router.post("/sites/:siteId/domain/:domainId/primary", domainFeature, ctrl.setPrimaryDomain);
router.delete("/sites/:siteId/domain", domainFeature, ctrl.removeDomain);
router.delete("/sites/:siteId/domain/:domainId", domainFeature, ctrl.removeDomainById);

// ─── OSS THEMES & GRAPESJS ────────────────────────────────────────────────────
const ossCtrl = require("../controllers/ossThemeController");
router.get("/oss-themes", wbFeature, ossCtrl.listOssThemes);
router.get("/oss-themes/:slug", wbFeature, ossCtrl.getOssTheme);
router.post("/sites/:siteId/oss-themes/:slug/install", wbFeature, ossCtrl.installOssTheme);
router.post("/sites/:siteId/grapes-editor/bootstrap", wbFeature, ossCtrl.bootstrapGrapesEditor);
router.get("/sites/:siteId/visual-editor", wbFeature, ossCtrl.getVisualEditor);
router.post("/sites/:siteId/editor-engine", wbFeature, ossCtrl.setEditorEngine);
router.get("/sites/:siteId/puck-editor", wbFeature, ossCtrl.getPuckEditor);
router.put("/sites/:siteId/puck-editor", wbFeature, ossCtrl.savePuckEditor);
router.post("/sites/:siteId/puck-editor/bootstrap", wbFeature, ossCtrl.bootstrapPuckEditor);
router.get("/sites/:siteId/grapes-editor", wbFeature, ossCtrl.getGrapesEditor);
router.put("/sites/:siteId/grapes-editor", wbFeature, ossCtrl.saveGrapesEditor);

module.exports = router;
