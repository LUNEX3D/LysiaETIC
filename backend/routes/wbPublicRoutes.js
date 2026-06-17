"use strict";

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/wbPublicController");

// ─── Görev 2: düz path alias (siteSlug) ───────────────────────────────────────
router.get("/site/:siteSlug", ctrl.getSiteConfig);
router.get("/page/:siteSlug/:pageSlug", ctrl.getPage);
router.get("/page/:siteSlug", ctrl.getPage);
router.get("/product/:siteSlug/:productSlug", ctrl.getProduct);
router.get("/blog/:siteSlug", ctrl.getBlogPosts);
router.get("/blog/:siteSlug/:postSlug", ctrl.getBlogPost);
router.get("/theme/:siteSlug", ctrl.getTheme);
router.get("/navigation/:siteSlug", ctrl.getNavigation);
router.get("/seo/:siteSlug/:pageSlug", ctrl.getSeo);

// ─── Legacy nested paths (geriye uyum) ─────────────────────────────────────────
router.get("/site/:slug/page/:pageSlug", ctrl.getPage);
router.get("/site/:slug/page", ctrl.getPage);
router.get("/site/:slug/blog", ctrl.getBlogPosts);
router.get("/site/:slug/blog/:postSlug", ctrl.getBlogPost);
router.get("/site/:slug/sitemap.xml", ctrl.getSitemap);
router.get("/site/:slug/robots.txt", ctrl.getRobots);
router.post("/site/:slug/form", ctrl.submitForm);
router.get("/site/:slug/form-captcha", ctrl.getFormCaptcha);

// ─── Custom domain (Host header) ───────────────────────────────────────────────
router.get("/domain/config", ctrl.getSiteConfig);
router.get("/domain/theme", ctrl.getTheme);
router.get("/domain/navigation", ctrl.getNavigation);
router.get("/domain/page/:pageSlug", ctrl.getPage);
router.get("/domain/page", ctrl.getPage);
router.get("/domain/product/:productSlug", ctrl.getProduct);
router.get("/domain/blog", ctrl.getBlogPosts);
router.get("/domain/blog/:postSlug", ctrl.getBlogPost);
router.get("/domain/seo/:pageSlug", ctrl.getSeo);
router.get("/domain/sitemap.xml", ctrl.getSitemap);
router.get("/domain/robots.txt", ctrl.getRobots);
router.post("/domain/form", ctrl.submitForm);
router.get("/domain/form-captcha", ctrl.getFormCaptcha);

module.exports = router;
