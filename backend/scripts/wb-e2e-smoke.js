"use strict";

/**
 * Website Builder API smoke — auth token gerekir.
 * WB_SMOKE_TOKEN=<jwt> WB_SMOKE_SITE_ID=<id> node scripts/wb-e2e-smoke.js
 * Opsiyonel vitrin: WB_SMOKE_SITE_SLUG=<slug> (form captcha + submit + track + SEO bundle)
 */
const axios = require("axios");

const BASE = process.env.WB_SMOKE_API || "http://localhost:5000";
const API = BASE + "/api/website-builder";
const PUBLIC = BASE + "/api/public/wb";
const TRACK = BASE + "/api/wb/track";
const TOKEN = process.env.WB_SMOKE_TOKEN;
const SITE = process.env.WB_SMOKE_SITE_ID;
const SLUG = process.env.WB_SMOKE_SITE_SLUG;

if (!TOKEN || !SITE) {
    console.log("Atla: WB_SMOKE_TOKEN ve WB_SMOKE_SITE_ID tanımlayın.");
    process.exit(0);
}

const client = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${TOKEN}` },
    validateStatus: () => true,
});

async function step(name, fn) {
    try {
        const r = await fn();
        if (r.status >= 200 && r.status < 300) {
            console.log(`[ok] ${name}`);
            return true;
        }
        console.log(`[fail] ${name} — HTTP ${r.status}`, r.data?.error || "");
        return false;
    } catch (e) {
        console.log(`[fail] ${name} —`, e.message);
        return false;
    }
}

(async () => {
    const checks = [
        ["getSite", () => client.get(`/sites/${SITE}`)],
        ["getNavigation", () => client.get(`/sites/${SITE}/navigation`)],
        ["getThemes", () => client.get("/themes")],
        ["seoCenter", () => client.get(`/sites/${SITE}/seo-center`)],
        ["listPopups", () => client.get(`/sites/${SITE}/popups`)],
        ["listForms", () => client.get(`/sites/${SITE}/forms`)],
        ["listRedirects", () => client.get(`/sites/${SITE}/redirects`)],
        ["formAnalytics", () => client.get(`/sites/${SITE}/form-analytics`)],
        ["popupAnalytics", () => client.get(`/sites/${SITE}/popup-analytics`)],
    ];
    let ok = 0;
    let total = checks.length;
    for (const [name, fn] of checks) {
        if (await step(name, fn)) ok += 1;
    }

    if (SLUG) {
        const pub = axios.create({ validateStatus: () => true });
        const publicChecks = [
            ["publicSiteBundle", () => pub.get(`${PUBLIC}/site/${SLUG}`)],
            ["publicSeo", () => pub.get(`${PUBLIC}/seo/${SLUG}/home`)],
            ["formCaptcha", () => pub.get(`${PUBLIC}/site/${SLUG}/form-captcha`)],
            ["trackPageview", () => pub.post(`${TRACK}/${SLUG}/pageview`, {
                pageSlug: "home",
                sessionId: "smoke_sess",
                visitorId: "smoke_vis",
            })],
            ["trackPopupEvent", () => pub.post(`${TRACK}/${SLUG}/event`, {
                eventType: "popup_view",
                sessionId: "smoke_sess",
                visitorId: "smoke_vis",
            })],
        ];
        total += publicChecks.length;
        for (const [name, fn] of publicChecks) {
            if (await step(name, fn)) ok += 1;
        }

        const capRes = await pub.get(`${PUBLIC}/site/${SLUG}/form-captcha`);
        if (capRes.status >= 200 && capRes.status < 300 && capRes.data?.question) {
            const m = String(capRes.data.question).match(/(\d+)\s*\+\s*(\d+)/);
            const answer = m ? Number(m[1]) + Number(m[2]) : null;
            total += 1;
            if (answer != null) {
                const submitRes = await pub.post(`${PUBLIC}/site/${SLUG}/form`, {
                    fields: { name: "Smoke", email: "smoke@test.local", message: "P0 test" },
                    captchaId: capRes.data.captchaId,
                    captchaAnswer: answer,
                    _hp: "",
                });
                if (submitRes.status >= 200 && submitRes.status < 300) {
                    console.log("[ok] formSubmit");
                    ok += 1;
                } else {
                    console.log("[fail] formSubmit — HTTP", submitRes.status, submitRes.data?.error || "");
                }
            } else {
                console.log("[fail] formSubmit — captcha parse");
            }
        } else {
            total += 1;
            console.log("[fail] formSubmit — captcha alınamadı");
        }

        const spam = await pub.post(`${TRACK}/${SLUG}/event`, { eventType: "not_a_real_event" });
        total += 1;
        if (spam.status === 400) {
            console.log("[ok] trackInvalidEventRejected");
            ok += 1;
        } else {
            console.log("[fail] trackInvalidEventRejected — HTTP", spam.status);
        }
    } else {
        console.log("\n(public atlandı — WB_SMOKE_SITE_SLUG ile vitrin testleri çalışır)");
    }

    console.log(`\n${ok}/${total} geçti`);
    process.exit(ok === total ? 0 : 1);
})();
