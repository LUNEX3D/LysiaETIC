/**
 * Kullanıcı birim ekonomisi — tahmini aylık maliyet (canlı DB metrikleri + yapılandırılabilir oranlar)
 * AWS (compute/network) ve MongoDB (Atlas/DB) ayrı kalemler.
 */
const User = require("../models/User");
const Order = require("../models/Order");
const ProductMapping = require("../models/ProductMapping");
const Marketplace = require("../models/Marketplace");
const StockSyncLog = require("../models/StockSyncLog");
const AIConversation = require("../models/AIConversation");
const AIActionAudit = require("../models/AIActionAudit");
const Ticket = require("../models/Ticket");
const SystemConfig = require("../models/SystemConfig");

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_RATES = {
    /** EC2/ECS, ALB, S3, CloudWatch, egress vb. — aylık sabit (TRY) */
    monthlyAwsCostTry: 2500,
    /** MongoDB Atlas M10/M20 veya eşdeğeri — aylık sabit (TRY) */
    monthlyMongodbCostTry: 1500,
    /** Eski tek kalem; aws+mongo yoksa buna göre bölünür */
    monthlyInfraCostTry: 4000,
    /** Kullanıcı veri hacmine göre ek MongoDB (IO/storage proxy) — 1000 birim başı TRY */
    per1kMongodbUnitsTry: 4,
    paymentFeeRate: 0.03,
    perMarketplaceCronTry: 12,
    per1kSyncLogsTry: 10,
    per1kOrders30dTry: 4,
    per1kProductsTry: 2.5,
    perAiUserMessageTry: 0.2,
    perAiActionTry: 1.5,
    perOpenTicketTry: 25,
    ollamaAiMultiplier: 0.05,
};

const PLAN_MONTHLY_REVENUE = {
    free: 0,
    trial: 0,
    basic: 299,
    pro: 799,
    enterprise: 1999,
};

const DRIVER_LABELS = {
    aws: "AWS (sunucu, ağ, depolama)",
    mongodb: "MongoDB (Atlas + veri hacmi)",
    syncCron: "Stok / sipariş senkron",
    dataOps: "Veri & işlem hacmi",
    ai: "Yapay zeka",
    support: "Destek talepleri",
};

let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 45_000;

const toMap = (aggRows, key = "_id") => {
    const m = new Map();
    for (const row of aggRows || []) {
        if (row[key] == null) continue;
        m.set(String(row[key]), row.count ?? row.total ?? 0);
    }
    return m;
};

const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

function resolveCloudMonthlyRates(rates) {
    let aws = num(rates.monthlyAwsCostTry, 0);
    let mongodb = num(rates.monthlyMongodbCostTry, 0);
    const legacy = num(rates.monthlyInfraCostTry, 0);

    if (aws <= 0 && mongodb <= 0 && legacy > 0) {
        aws = roundTry(legacy * 0.625);
        mongodb = roundTry(legacy - aws);
    }
    if (aws <= 0) aws = DEFAULT_RATES.monthlyAwsCostTry;
    if (mongodb <= 0) mongodb = DEFAULT_RATES.monthlyMongodbCostTry;

    return {
        monthlyAwsCostTry: aws,
        monthlyMongodbCostTry: mongodb,
        monthlyCloudTotalTry: roundTry(aws + mongodb),
    };
}

async function loadRates() {
    const rates = { ...DEFAULT_RATES };
    if (process.env.UNIT_ECONOMICS_AWS_TRY) {
        rates.monthlyAwsCostTry = num(process.env.UNIT_ECONOMICS_AWS_TRY, rates.monthlyAwsCostTry);
    }
    if (process.env.UNIT_ECONOMICS_MONGODB_TRY) {
        rates.monthlyMongodbCostTry = num(process.env.UNIT_ECONOMICS_MONGODB_TRY, rates.monthlyMongodbCostTry);
    }
    if (process.env.UNIT_ECONOMICS_INFRA_TRY) {
        rates.monthlyInfraCostTry = num(process.env.UNIT_ECONOMICS_INFRA_TRY, rates.monthlyInfraCostTry);
    }

    try {
        const doc = await SystemConfig.findOne({ key: "unitEconomicsRates" }).lean();
        if (doc?.value && typeof doc.value === "object") {
            Object.assign(rates, doc.value);
        }
    } catch {
        /* ignore */
    }

    const cloud = resolveCloudMonthlyRates(rates);
    rates.monthlyAwsCostTry = cloud.monthlyAwsCostTry;
    rates.monthlyMongodbCostTry = cloud.monthlyMongodbCostTry;
    rates.monthlyInfraCostTry = cloud.monthlyCloudTotalTry;
    rates.cloud = cloud;
    return rates;
}

function resolveMonthlyRevenue(user) {
    const sub = user.subscription || {};
    const plan = String(sub.plan || "trial").toLowerCase();
    const fromSub = num(sub.price, 0);
    if (fromSub > 0) return fromSub;
    return PLAN_MONTHLY_REVENUE[plan] ?? 0;
}

function roundTry(n) {
    return Math.round(n * 100) / 100;
}

/** MongoDB yük proxy: ürün + sipariş + sync log */
function mongodbUsageUnits(products, orders30d, syncLogs30d) {
    return products + orders30d + syncLogs30d * 0.15;
}

/**
 * @returns {Promise<object>}
 */
async function buildUnitEconomicsReport(options = {}) {
    const force = options.force === true;
    const now = Date.now();
    if (!force && _cache && now - _cacheAt < CACHE_MS) {
        return _cache;
    }

    const rates = await loadRates();
    const cloud = rates.cloud || resolveCloudMonthlyRates(rates);
    const since30 = new Date(now - 30 * DAY_MS);
    const llmOpenAi = String(process.env.OPENAI_API_KEY || "").trim().length > 10
        && String(process.env.LYSIA_LLM_PROVIDER || "auto").toLowerCase() !== "ollama"
        && process.env.USE_OLLAMA !== "true";

    const aiMsgMultiplier = llmOpenAi ? 1 : rates.ollamaAiMultiplier;

    const users = await User.find({ role: { $nin: ["admin", "dev"] } })
        .select("name email subscription role updatedAt createdAt")
        .lean();

    const [
        mpAgg,
        productsAgg,
        orders30Agg,
        sync30Agg,
        aiMsgAgg,
        aiActAgg,
        ticketsOpenAgg,
    ] = await Promise.all([
        Marketplace.aggregate([
            { $match: { isActive: { $ne: false } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
        ]),
        ProductMapping.aggregate([{ $group: { _id: "$userId", count: { $sum: 1 } } }]),
        Order.aggregate([
            { $match: { orderDate: { $gte: since30 }, isCancelled: { $ne: true } } },
            { $group: { _id: "$user", count: { $sum: 1 } } },
        ]),
        StockSyncLog.aggregate([
            { $match: { createdAt: { $gte: since30 } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
        ]),
        AIConversation.aggregate([
            { $match: { updatedAt: { $gte: since30 } } },
            {
                $project: {
                    userId: 1,
                    userMsgCount: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ["$messages", []] },
                                as: "m",
                                cond: { $eq: ["$$m.role", "user"] },
                            },
                        },
                    },
                },
            },
            { $group: { _id: "$userId", count: { $sum: "$userMsgCount" } } },
        ]),
        AIActionAudit.aggregate([
            { $match: { createdAt: { $gte: since30 } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
        ]),
        Ticket.aggregate([
            { $match: { status: { $in: ["open", "in_progress", "waiting_customer"] } } },
            { $group: { _id: "$userId", count: { $sum: 1 } } },
        ]),
    ]);

    const mpMap = toMap(mpAgg);
    const prodMap = toMap(productsAgg);
    const ordMap = toMap(orders30Agg);
    const syncMap = toMap(sync30Agg);
    const aiMsgMap = toMap(aiMsgAgg);
    const aiActMap = toMap(aiActAgg);
    const ticketMap = toMap(ticketsOpenAgg);

    const activeUsers = users.filter((u) => {
        const id = String(u._id);
        return (
            mpMap.get(id) > 0 ||
            syncMap.get(id) > 0 ||
            ordMap.get(id) > 0 ||
            (u.updatedAt && new Date(u.updatedAt) >= since30)
        );
    });
    const allocBase = Math.max(activeUsers.length, 1);
    const awsPerUser = cloud.monthlyAwsCostTry / allocBase;
    const mongoFixedPerUser = cloud.monthlyMongodbCostTry / allocBase;

    const driverTotals = {
        aws: 0,
        mongodb: 0,
        syncCron: 0,
        dataOps: 0,
        ai: 0,
        support: 0,
    };

    let platformMongoVariable = 0;

    const rows = users.map((user) => {
        const id = String(user._id);
        const marketplaces = mpMap.get(id) || 0;
        const products = prodMap.get(id) || 0;
        const orders30d = ordMap.get(id) || 0;
        const syncLogs30d = syncMap.get(id) || 0;
        const aiMessages30d = aiMsgMap.get(id) || 0;
        const aiActions30d = aiActMap.get(id) || 0;
        const openTickets = ticketMap.get(id) || 0;

        const syncActivity = marketplaces > 0 ? syncLogs30d / (marketplaces * 400) : syncLogs30d / 400;
        const activityMult = Math.min(2.5, 0.5 + syncActivity);

        const mongoUnits = mongodbUsageUnits(products, orders30d, syncLogs30d);
        const costMongoVariable = (mongoUnits / 1000) * rates.per1kMongodbUnitsTry;
        platformMongoVariable += costMongoVariable;

        const costAws = awsPerUser;
        const costMongodb = roundTry(mongoFixedPerUser + costMongoVariable);
        const costSync =
            marketplaces * rates.perMarketplaceCronTry * activityMult +
            (syncLogs30d / 1000) * rates.per1kSyncLogsTry;
        const costData =
            (products / 1000) * rates.per1kProductsTry +
            (orders30d / 1000) * rates.per1kOrders30dTry;
        const costAi =
            aiMessages30d * rates.perAiUserMessageTry * aiMsgMultiplier +
            aiActions30d * rates.perAiActionTry;
        const costSupport = openTickets * rates.perOpenTicketTry;

        const breakdown = {
            aws: roundTry(costAws),
            mongodb: costMongodb,
            mongodbFixed: roundTry(mongoFixedPerUser),
            mongodbVariable: roundTry(costMongoVariable),
            syncCron: roundTry(costSync),
            dataOps: roundTry(costData),
            ai: roundTry(costAi),
            support: roundTry(costSupport),
        };

        const totalCost = roundTry(
            breakdown.aws +
                breakdown.mongodb +
                breakdown.syncCron +
                breakdown.dataOps +
                breakdown.ai +
                breakdown.support
        );

        driverTotals.aws += breakdown.aws;
        driverTotals.mongodb += breakdown.mongodb;
        driverTotals.syncCron += breakdown.syncCron;
        driverTotals.dataOps += breakdown.dataOps;
        driverTotals.ai += breakdown.ai;
        driverTotals.support += breakdown.support;

        const plan = String(user.subscription?.plan || "trial").toLowerCase();
        const revenue = resolveMonthlyRevenue(user);
        const paymentFee = roundTry(revenue * rates.paymentFeeRate);
        const netRevenue = roundTry(revenue - paymentFee);
        const margin = roundTry(netRevenue - totalCost);
        const marginPct = revenue > 0 ? roundTry((margin / revenue) * 100) : null;

        const topDriver = Object.entries({
            aws: breakdown.aws,
            mongodb: breakdown.mongodb,
            syncCron: breakdown.syncCron,
            dataOps: breakdown.dataOps,
            ai: breakdown.ai,
            support: breakdown.support,
        }).sort((a, b) => b[1] - a[1])[0];

        return {
            userId: id,
            name: user.name || "—",
            email: user.email || "",
            plan,
            status: user.subscription?.status || "—",
            metrics: {
                marketplaces,
                products,
                orders30d,
                syncLogs30d,
                mongodbUnits: roundTry(mongoUnits),
                aiMessages30d,
                aiActions30d,
                openTickets,
                activityScore: roundTry(activityMult * 100),
            },
            revenue,
            paymentFee,
            netRevenue,
            estimatedCost: totalCost,
            margin,
            marginPct,
            breakdown,
            topCostDriver: topDriver ? { key: topDriver[0], amount: topDriver[1] } : null,
            isActive: activeUsers.some((a) => String(a._id) === id),
        };
    });

    rows.sort((a, b) => b.estimatedCost - a.estimatedCost);

    const totalCost = roundTry(rows.reduce((s, r) => s + r.estimatedCost, 0));
    const totalRevenue = roundTry(rows.reduce((s, r) => s + r.revenue, 0));
    const totalMargin = roundTry(rows.reduce((s, r) => s + r.margin, 0));

    const driverEntries = Object.entries(driverTotals)
        .map(([key, totalTry]) => ({ key, totalTry: roundTry(totalTry) }))
        .sort((a, b) => b.totalTry - a.totalTry);

    const driverGrand = driverEntries.reduce((s, d) => s + d.totalTry, 0) || 1;
    const costDrivers = driverEntries.map((d) => ({
        ...d,
        label: DRIVER_LABELS[d.key] || d.key,
        pct: roundTry((d.totalTry / driverGrand) * 100),
    }));

    const report = {
        generatedAt: new Date().toISOString(),
        periodDays: 30,
        llmMode: llmOpenAi ? "openai" : "ollama_or_rules",
        rates,
        cloudCosts: {
            awsMonthlyTry: cloud.monthlyAwsCostTry,
            mongodbMonthlyTry: cloud.monthlyMongodbCostTry,
            mongodbVariableMonthlyTry: roundTry(platformMongoVariable),
            cloudTotalMonthlyTry: roundTry(cloud.monthlyCloudTotalTry + platformMongoVariable),
            note: "AWS/MongoDB sabit tutarlar panelden veya env ile güncellenir; MongoDB değişken kısım kullanıcı veri hacmine göre tahminidir.",
        },
        summary: {
            totalUsers: users.length,
            activeUsers: activeUsers.length,
            totalEstimatedCost: totalCost,
            totalRevenue,
            totalMargin,
            avgCostPerUser: roundTry(totalCost / Math.max(users.length, 1)),
            avgCostActiveUser: roundTry(totalCost / allocBase),
            topCostDriver: costDrivers[0] || null,
            totalAwsAllocated: roundTry(driverTotals.aws),
            totalMongodbAllocated: roundTry(driverTotals.mongodb),
        },
        costDrivers,
        users: rows,
    };

    _cache = report;
    _cacheAt = now;
    return report;
}

function invalidateUnitEconomicsCache() {
    _cache = null;
    _cacheAt = 0;
}

module.exports = {
    buildUnitEconomicsReport,
    invalidateUnitEconomicsCache,
    DEFAULT_RATES,
    DRIVER_LABELS,
    resolveCloudMonthlyRates,
};
