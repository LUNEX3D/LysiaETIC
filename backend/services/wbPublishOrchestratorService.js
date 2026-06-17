"use strict";

const mongoose = require("mongoose");
const WBSite = require("../models/WBSite");
const WBPage = require("../models/WBPage");
const WBBlogPost = require("../models/WBBlogPost");
const WBRedirect = require("../models/WBRedirect");
const StoreProduct = require("../models/StoreProduct");
const StoreCategory = require("../models/StoreCategory");
const wbDomainService = require("./wbDomainService");
const wbSeoService = require("./wbSeoService");
const wbService = require("./websiteBuilderService");
const logger = require("../config/logger");

function toObjectId(id) {
    try {
        return new mongoose.Types.ObjectId(String(id));
    } catch {
        return null;
    }
}

function resolveBaseUrl(site) {
    if (site.customDomain && ["verified", "ssl_pending", "active"].includes(site.domainStatus)) {
        return `https://${site.customDomain}`;
    }
    const appDomain = process.env.WB_APP_DOMAIN || "dashtock.com";
    return `https://${site.slug}.${appDomain}`;
}

function sslDaysRemaining(domainDoc) {
    const validTo = domainDoc?.ssl?.validTo;
    if (!validTo) return null;
    const diff = new Date(validTo).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function domainStatusLabel(status, sslStatus) {
    if (status === "active" && sslStatus === "active") return { code: "live", label: "Canlı", tone: "success" };
    if (status === "ssl_provisioning" || sslStatus === "pending") return { code: "ssl", label: "SSL hazırlanıyor", tone: "info" };
    if (status === "dns_verified") return { code: "dns_partial", label: "DNS kısmen doğrulandı", tone: "warning" };
    if (status === "pending_dns") return { code: "dns_pending", label: "DNS bekleniyor", tone: "warning" };
    if (status === "failed") return { code: "failed", label: "Bağlantı hatası", tone: "error" };
    return { code: "none", label: "Özel domain yok", tone: "muted" };
}

async function countSeoGaps(site) {
    const siteId = site._id;
    const gaps = {
        draftPages: 0,
        draftBlogPosts: 0,
        productsMissingSeo: 0,
        categoriesMissingSeo: 0,
        siteMetaIncomplete: false,
    };

    gaps.draftPages = await WBPage.countDocuments({ siteId, status: "draft" });
    gaps.draftBlogPosts = await WBBlogPost.countDocuments({ siteId, status: "draft" });

    const seo = site.seo || {};
    gaps.siteMetaIncomplete = !seo.title?.trim() || !seo.description?.trim();

    if (site.storeId) {
        const storeOid = toObjectId(site.storeId);
        if (storeOid) {
            gaps.productsMissingSeo = await StoreProduct.countDocuments({
                storeId: storeOid,
                visible: { $ne: false },
                $or: [
                    { "seo.metaTitle": { $in: ["", null] } },
                    { "seo.metaDescription": { $in: ["", null] } },
                    { "seo.slug": { $in: ["", null] } },
                ],
            });
            gaps.categoriesMissingSeo = await StoreCategory.countDocuments({
                storeId: storeOid,
                $or: [
                    { "seo.metaTitle": { $in: ["", null] } },
                    { "seo.slug": { $in: ["", null] } },
                ],
            });
        }
    }

    return gaps;
}

function computePendingChanges(gaps) {
    return (
        gaps.draftPages
        + gaps.draftBlogPosts
        + (gaps.siteMetaIncomplete ? 1 : 0)
        + Math.min(gaps.productsMissingSeo, 99)
    );
}

function computeSeoScore(site, gaps) {
    let score = 100;
    if (gaps.siteMetaIncomplete) score -= 15;
    if (!site.seo?.ogImage) score -= 5;
    if (gaps.productsMissingSeo > 0) score -= Math.min(30, Math.ceil(gaps.productsMissingSeo / 5) * 3);
    if (gaps.categoriesMissingSeo > 0) score -= Math.min(15, gaps.categoriesMissingSeo * 2);
    if (gaps.draftPages > 0) score -= Math.min(10, gaps.draftPages);
    return Math.max(0, Math.min(100, score));
}

/**
 * Yayın durumu özeti — admin paneli için.
 */
async function getPublishStatus(siteId, userId) {
    const oid = toObjectId(siteId);
    const uid = toObjectId(userId);
    if (!oid || !uid) return { error: "Geçersiz kimlik" };

    const site = await WBSite.findOne({ _id: oid, userId: uid }).lean();
    if (!site) return { error: "Site bulunamadı" };

    const [domainDoc, redirectCount, gaps] = await Promise.all([
        wbDomainService.getDomainBySite(oid),
        WBRedirect.countDocuments({ siteId: oid }),
        countSeoGaps(site),
    ]);

    const baseUrl = resolveBaseUrl(site);
    const pendingChanges = computePendingChanges(gaps);
    const seoScore = computeSeoScore(site, gaps);
    const domainInfo = domainDoc
        ? {
            domain: domainDoc.domain,
            status: domainDoc.status,
            sslStatus: domainDoc.sslStatus,
            lastCheckedAt: domainDoc.lastVerificationAttempt || domainDoc.updatedAt,
            nextCheckAt: domainDoc.nextCheckAt,
            sslDaysRemaining: sslDaysRemaining(domainDoc),
            errorMessage: domainDoc.errorMessage || "",
            autoPolling: ["pending_dns", "dns_verified", "ssl_provisioning"].includes(domainDoc.status),
            ...domainStatusLabel(domainDoc.status, domainDoc.sslStatus),
        }
        : {
            domain: null,
            status: "none",
            sslStatus: "none",
            autoPolling: false,
            ...domainStatusLabel("none", "none"),
        };

    const defaultSubdomain = `${site.slug}.${process.env.WB_APP_DOMAIN || "dashtock.com"}`;

    return {
        site: {
            id: site._id,
            name: site.displayName || site.name,
            slug: site.slug,
            status: site.status,
            publishedAt: site.publishedAt,
            publishMeta: site.publishMeta || {},
        },
        urls: {
            primary: site.status === "published" ? baseUrl : null,
            preview: `${baseUrl}?preview=1`,
            defaultSubdomain: `https://${defaultSubdomain}`,
            sitemap: `${baseUrl}/sitemap.xml`,
            robots: `${baseUrl}/robots.txt`,
        },
        domain: domainInfo,
        seo: {
            score: seoScore,
            gaps,
            hasCustomRobots: !!site.seo?.customRobots?.trim(),
            redirectCount,
        },
        technicalSeo: {
            sitemap: true,
            robots: true,
            organizationSchema: true,
            productSchema: !!site.storeId,
            breadcrumbSchema: true,
            articleSchema: (site.stats?.totalBlogPosts || 0) > 0,
        },
        pendingChanges,
        canPublish: site.status === "draft" || pendingChanges > 0,
        isLive: site.status === "published",
    };
}

/**
 * Tek tıkla yayın — build, deploy, cache, sitemap adımları.
 */
async function deploySite(siteId, userId) {
    const oid = toObjectId(siteId);
    const uid = toObjectId(userId);
    if (!oid || !uid) return { error: "Geçersiz kimlik" };

    const site = await WBSite.findOne({ _id: oid, userId: uid });
    if (!site) return { error: "Site bulunamadı" };

    const steps = [];
    const runStep = async (key, label, fn) => {
        steps.push({ key, label, status: "running" });
        try {
            const detail = await fn();
            steps[steps.length - 1] = { key, label, status: "done", detail: detail || null };
            return true;
        } catch (err) {
            logger.error(`[PublishOrchestrator] ${key}:`, err.message);
            steps[steps.length - 1] = { key, label, status: "failed", error: err.message };
            throw err;
        }
    };

    await WBSite.updateOne(
        { _id: oid },
        { $set: { "publishMeta.lastDeployStatus": "running", "publishMeta.lastDeployError": "" } }
    );

    try {
        await runStep("build", "İçerik derleniyor", async () => {
            const draftCount = await WBPage.countDocuments({ siteId: oid, status: "draft" });
            return `${draftCount} taslak sayfa`;
        });

        await runStep("publish", "Sayfalar yayınlanıyor", async () => {
            const result = await wbService.publishSite(siteId, userId);
            if (result.error) throw new Error(result.error);
            return "Site ve sayfalar yayında";
        });

        await runStep("domain", "Domain doğrulanıyor", async () => {
            const domainDoc = await wbDomainService.getDomainBySite(oid);
            if (!domainDoc) return "Özel domain yok — atlandı";
            if (domainDoc.status === "active") return "Domain zaten aktif";
            const verify = await wbDomainService.verifyDomain(oid);
            return verify.message || verify.status;
        });

        await runStep("sitemap", "Sitemap güncelleniyor", async () => {
            const fresh = await WBSite.findById(oid).lean();
            const baseUrl = resolveBaseUrl(fresh);
            const xml = await wbSeoService.generateSitemap(oid, baseUrl);
            return `${Math.max(0, (xml.match(/<url>/g) || []).length)} URL`;
        });

        await runStep("cache", "Önbellek temizleniyor", async () => {
            // CDN purge hook — env ile genişletilebilir
            if (process.env.WB_CDN_PURGE_URL) {
                logger.info(`[PublishOrchestrator] CDN purge queued for site ${siteId}`);
                try {
                    const axios = require("axios");
                    await axios.post(process.env.WB_CDN_PURGE_URL, {
                        siteId,
                        domain: site.customDomain || site.slug,
                        paths: ["/*"]
                    });
                    return "CDN önbelleği temizlendi";
                } catch (e) {
                    logger.warn(`[PublishOrchestrator] CDN purge failed: ${e.message}`);
                    return "Önbellek temizleme hatası (atlandı)";
                }
            }
            return "Edge önbellek yenilenecek";
        });

        const version = (site.publishMeta?.version || 0) + 1;
        await WBSite.updateOne(
            { _id: oid },
            {
                $set: {
                    "publishMeta.version": version,
                    "publishMeta.lastDeployAt": new Date(),
                    "publishMeta.lastDeployStatus": "success",
                    "publishMeta.lastDeployError": "",
                },
            }
        );

        const status = await getPublishStatus(siteId, userId);
        return { success: true, steps, version, status };
    } catch (err) {
        await WBSite.updateOne(
            { _id: oid },
            {
                $set: {
                    "publishMeta.lastDeployStatus": "failed",
                    "publishMeta.lastDeployError": err.message || "Yayın başarısız",
                },
            }
        );
        return { error: err.message || "Yayın başarısız", steps };
    }
}

module.exports = {
    getPublishStatus,
    deploySite,
    resolveBaseUrl,
};
