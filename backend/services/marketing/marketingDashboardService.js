const StoreOrder = require("../../models/StoreOrder");
const MarketingCampaign = require("../../models/MarketingCampaign");
const MarketingEvent = require("../../models/MarketingEvent");
const MarketingAutomation = require("../../models/MarketingAutomation");
const MarketingSegment = require("../../models/MarketingSegment");
const MarketingPopup = require("../../models/MarketingPopup");
const MarketingAffiliate = require("../../models/MarketingAffiliate");

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"];

function rangeToSince(range) {
    const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function dayKey(d) {
    return d.toISOString().slice(0, 10);
}

function rangeDays(range) {
    return range === "90d" ? 90 : range === "30d" ? 30 : 7;
}

function buildChartSeries(range, chartMap) {
    const days = rangeDays(range);
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const k = dayKey(d);
        const found = chartMap.get(k);
        out.push({
            date: k,
            label: d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
            total: found?.total ?? 0,
            marketing: found?.marketing ?? 0,
        });
    }
    return out;
}

function buildChannelBreakdown(totals) {
    const channels = [
        { id: "EMAIL", label: "E-posta", revenue: totals.emailRevenue || 0 },
        { id: "SMS", label: "SMS", revenue: totals.smsRevenue || 0 },
        { id: "AUTOMATION", label: "Otomasyon", revenue: totals.automationRevenue || 0 },
        { id: "POPUP", label: "Popup", revenue: totals.popupRevenue || 0 },
        { id: "AFFILIATE", label: "Affiliate", revenue: totals.affiliateRevenue || 0 },
    ];
    const max = Math.max(...channels.map((c) => c.revenue), 1);
    return channels.map((c) => ({
        ...c,
        pct: totals.marketingRevenue > 0 ? Math.round((c.revenue / totals.marketingRevenue) * 100) : 0,
        barPct: Math.round((c.revenue / max) * 100),
    }));
}

async function getDashboard(storeId, range = "7d") {
    const since = rangeToSince(range);
    const orders = await StoreOrder.find({
        storeId,
        isDraft: { $ne: true },
        status: { $in: PAID_STATUSES },
        createdAt: { $gte: since },
    })
        .select("total marketingSource createdAt")
        .lean();

    let totalRevenue = 0;
    let marketingRevenue = 0;
    let emailRevenue = 0;
    let smsRevenue = 0;
    let automationRevenue = 0;
    let popupRevenue = 0;
    let affiliateRevenue = 0;
    let marketingOrders = 0;

    const chartMap = new Map();

    for (const o of orders) {
        const t = Number(o.total) || 0;
        totalRevenue += t;
        const src = o.marketingSource?.channel || "";
        if (src) {
            marketingRevenue += t;
            marketingOrders += 1;
            if (src === "EMAIL") emailRevenue += t;
            if (src === "SMS") smsRevenue += t;
            if (src === "AUTOMATION") automationRevenue += t;
            if (src === "POPUP") popupRevenue += t;
            if (src === "AFFILIATE") affiliateRevenue += t;
        }
        const k = dayKey(new Date(o.createdAt));
        if (!chartMap.has(k)) {
            chartMap.set(k, { date: k, total: 0, marketing: 0 });
        }
        const row = chartMap.get(k);
        row.total += t;
        if (src) row.marketing += t;
    }

    const chart = buildChartSeries(range, chartMap);

    const [emailsSent, smsSent, activeCampaigns, recentCampaigns, modules] = await Promise.all([
        MarketingEvent.countDocuments({
            storeId,
            type: { $in: ["campaign_sent", "email_open"] },
            channel: "EMAIL",
            createdAt: { $gte: since },
        }),
        MarketingEvent.countDocuments({ storeId, type: "sms_sent", channel: "SMS", createdAt: { $gte: since } }),
        MarketingCampaign.countDocuments({
            storeId,
            status: { $in: ["scheduled", "sending", "sent"] },
        }),
        MarketingCampaign.find({ storeId }).sort({ updatedAt: -1 }).limit(5).select("name type status stats updatedAt").lean(),
        Promise.all([
            MarketingAutomation.countDocuments({ storeId, status: "active" }),
            MarketingSegment.countDocuments({ storeId }),
            MarketingPopup.countDocuments({ storeId, status: "active" }),
            MarketingAffiliate.countDocuments({ storeId, status: "active" }),
        ]),
    ]);

    const conversionRate = orders.length ? Math.round((marketingOrders / orders.length) * 1000) / 10 : 0;
    const marketingShare =
        totalRevenue > 0 ? Math.round((marketingRevenue / totalRevenue) * 1000) / 10 : 0;

    const channelBreakdown = buildChannelBreakdown({
        emailRevenue,
        smsRevenue,
        automationRevenue,
        popupRevenue,
        affiliateRevenue,
        marketingRevenue,
    });

    const hasActivity =
        totalRevenue > 0 ||
        emailsSent > 0 ||
        smsSent > 0 ||
        recentCampaigns.length > 0 ||
        modules.some((n) => n > 0);

    return {
        range,
        hasActivity,
        cards: {
            totalRevenue,
            marketingRevenue,
            emailRevenue,
            smsRevenue,
            automationRevenue,
            popupRevenue,
            affiliateRevenue,
            conversionRate,
            marketingShare,
            emailsSent,
            smsSent,
            totalOrders: orders.length,
            marketingOrders,
            activeCampaigns,
        },
        chart,
        channelBreakdown,
        recentCampaigns: recentCampaigns.map((c) => ({
            id: c._id,
            name: c.name,
            type: c.type,
            status: c.status,
            sent: c.stats?.sent ?? 0,
            updatedAt: c.updatedAt,
        })),
        modules: {
            automationsActive: modules[0],
            segments: modules[1],
            popupsActive: modules[2],
            affiliatesActive: modules[3],
        },
    };
}

async function getReports(storeId, range = "30d") {
    const since = rangeToSince(range);
    const campaigns = await MarketingCampaign.find({ storeId, createdAt: { $gte: since } })
        .select("name type status stats createdAt")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    const eventsByType = await MarketingEvent.aggregate([
        { $match: { storeId, createdAt: { $gte: since } } },
        { $group: { _id: "$type", count: { $sum: 1 }, revenue: { $sum: "$revenue" } } },
    ]);

    return { campaigns, eventsByType, since };
}

module.exports = { getDashboard, getReports, rangeToSince };
