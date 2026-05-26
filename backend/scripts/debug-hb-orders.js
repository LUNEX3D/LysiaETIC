/**
 * Hepsiburada sipariş API teşhisi — marketplaceId ile DB credential + tüm OMS uçları
 * Kullanım: node scripts/debug-hb-orders.js [marketplaceId]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const axios = require("axios");
const moment = require("moment");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "debug-hb-orders-out.json");
const mpId = process.argv[2] || "69fb72e41eff1b56754c6536";

const summarize = (data) => {
    if (!data) return { type: "null" };
    if (Array.isArray(data)) return { type: "array", len: data.length, sampleKeys: data[0] ? Object.keys(data[0]).slice(0, 12) : [] };
    if (typeof data === "object") {
        const keys = Object.keys(data);
        const out = { type: "object", keys };
        for (const k of ["items", "orders", "packages", "content", "data"]) {
            if (Array.isArray(data[k])) out[k] = data[k].length;
        }
        return out;
    }
    return { type: typeof data, preview: String(data).slice(0, 120) };
};

(async () => {
    const report = { marketplaceId: mpId, at: new Date().toISOString(), steps: [], creds: {} };
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Marketplace = require("../models/Marketplace");
        const { decryptCredentials } = require("../utils/encryption");
        const {
            normalizeCredentials,
            getHeadersForGet,
            getEndpoints,
            resolveHbUseSitAuto,
            resolveHepsiburadaOrderKey,
            formatHbOmsDateTime,
            splitHbDateRange,
            HB_OMS_PACKAGES_MAX_DAYS,
        } = require("../services/hepsiburadaService");

        const mp = await Marketplace.findById(mpId);
        if (!mp) {
            report.error = "Marketplace not found";
            fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
            console.log("NOT FOUND");
            process.exit(1);
        }

        const raw = decryptCredentials(mp.credentials || {});
        const hb = normalizeCredentials(raw);
        report.creds = {
            merchantIdPrefix: String(hb.merchantId || "").slice(0, 8),
            merchantIdLen: String(hb.merchantId || "").length,
            secretKeyLen: String(hb.secretKey || "").length,
            secretLooksEncrypted: /^[0-9a-f]{32}:[0-9a-f]+:[0-9a-f]{32}$/i.test(String(hb.secretKey || "")),
            userAgent: hb.userAgent,
            useSitStored: raw?.useSit,
            useSitNorm: hb.useSit,
        };

        const effectiveSit = await resolveHbUseSitAuto({ ...hb, useSitRaw: raw?.useSit });
        report.effectiveSit = effectiveSit;
        const ep = getEndpoints({ useSit: effectiveSit });
        const headers = getHeadersForGet(hb.merchantId, hb.secretKey, hb.userAgent);

        const start = moment("2026-05-19");
        const end = moment("2026-05-26").endOf("day");
        const encStart = encodeURIComponent(formatHbOmsDateTime(start));
        const encEnd = encodeURIComponent(formatHbOmsDateTime(end));

        const probes = [
            { label: "orders-open", url: `${ep.OMS}/orders/merchantid/${hb.merchantId}?offset=0&limit=10` },
            { label: "orders-dated", url: `${ep.OMS}/orders/merchantid/${hb.merchantId}?begindate=${encStart}&enddate=${encEnd}&offset=0&limit=10` },
            { label: "packages-timespan720", url: `${ep.OMS}/packages/merchantid/${hb.merchantId}?timespan=720&offset=0&limit=10` },
            { label: "unpacked", url: `${ep.OMS}/packages/merchantid/${hb.merchantId}/unpacked?begindate=${encStart}&enddate=${encEnd}&offset=0&limit=10` },
            { label: "shipped", url: `${ep.OMS}/packages/merchantid/${hb.merchantId}/shipped?begindate=${encStart}&enddate=${encEnd}&offset=0&limit=10` },
            { label: "delivered", url: `${ep.OMS}/packages/merchantid/${hb.merchantId}/delivered?begindate=${encStart}&enddate=${encEnd}&offset=0&limit=10` },
            { label: "listing-smoke", url: `https://listing-external.hepsiburada.com/listings/merchantid/${hb.merchantId}?offset=0&limit=1` },
        ];

        // Alt ortam: SIT de dene
        if (!effectiveSit) {
            const sitEp = getEndpoints({ useSit: true });
            probes.push({ label: "sit-orders-open", url: `${sitEp.OMS}/orders/merchantid/${hb.merchantId}?offset=0&limit=5` });
        }

        for (const p of probes) {
            const row = { label: p.label, url: p.url.replace(hb.secretKey || "x", "***") };
            try {
                const res = await axios.get(p.url, { headers, timeout: 20000, validateStatus: () => true });
                row.status = res.status;
                row.body = summarize(res.data);
                let list = [];
                if (Array.isArray(res.data)) list = res.data;
                else if (res.data?.items) list = res.data.items;
                else if (res.data?.packages) list = res.data.packages;
                else if (res.data?.orders) list = res.data.orders;
                row.rawCount = list.length;
                if (list.length) {
                    const keys = resolveHepsiburadaOrderKey(list[0], null);
                    row.firstResolveKey = keys;
                    row.firstSample = {
                        orderNumber: list[0].orderNumber,
                        merchantOrderNumber: list[0].merchantOrderNumber,
                        packageNumber: list[0].packageNumber,
                        status: list[0].status,
                        hasItems: Array.isArray(list[0].items) ? list[0].items.length : 0,
                    };
                }
            } catch (e) {
                row.error = e.message;
                row.status = e.response?.status;
                row.body = summarize(e.response?.data);
            }
            report.steps.push(row);
            console.log(JSON.stringify(row));
        }

        // ordersService tam akış
        const { fetchHepsiburadaOrders } = require("../services/ordersService");
        const msStart = start.valueOf();
        const msEnd = end.valueOf();
        const orders = await fetchHepsiburadaOrders(
            hb.merchantId,
            hb.secretKey,
            msStart,
            msEnd,
            hb.userAgent,
            effectiveSit
        );
        report.ordersServiceCount = orders.length;
        if (orders[0]) report.ordersServiceSample = { orderNumber: orders[0].orderNumber, status: orders[0].status };

        fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
        console.log("\nWrote", OUT);
        console.log("ordersServiceCount:", orders.length);
    } catch (e) {
        report.fatal = e.message;
        fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
        console.error(e);
        process.exit(1);
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
})();
