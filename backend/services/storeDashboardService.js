const Store = require("../models/Store");
const storeService = require("./storeService");
const StoreOrder = require("../models/StoreOrder");
const StorePaymentSettings = require("../models/StorePaymentSettings");
const storePaytr = require("./storePaytrService");

const TR_DAY = ["Paz", "Pts", "Sal", "Çar", "Per", "Cum", "Cts"];

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

function startOfWeekMonday(d) {
    const x = startOfDay(d);
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(x, diff);
}

function resolveDateRange({ preset = "last_7_days", startDate, endDate } = {}) {
    const now = new Date();
    let start;
    let end = endOfDay(now);

    switch (preset) {
        case "today":
            start = startOfDay(now);
            break;
        case "yesterday": {
            const y = addDays(now, -1);
            start = startOfDay(y);
            end = endOfDay(y);
            break;
        }
        case "this_week":
            start = startOfWeekMonday(now);
            break;
        case "last_week": {
            const thisMon = startOfWeekMonday(now);
            start = addDays(thisMon, -7);
            end = endOfDay(addDays(thisMon, -1));
            break;
        }
        case "this_month":
            start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
            break;
        case "last_month": {
            start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
            end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
            break;
        }
        case "last_30_days":
            start = startOfDay(addDays(now, -29));
            break;
        case "last_3_months":
            start = startOfDay(addDays(now, -89));
            break;
        case "last_6_months":
            start = startOfDay(addDays(now, -179));
            break;
        case "this_year":
            start = startOfDay(new Date(now.getFullYear(), 0, 1));
            break;
        case "custom":
            if (startDate && endDate) {
                start = startOfDay(new Date(startDate));
                end = endOfDay(new Date(endDate));
            } else {
                start = startOfDay(addDays(now, -6));
            }
            break;
        case "last_7_days":
        default:
            start = startOfDay(addDays(now, -6));
            break;
    }

    const msPerDay = 86400000;
    const dayCount = Math.max(1, Math.round((end - start) / msPerDay) + 1);
    const prevEnd = endOfDay(addDays(start, -1));
    const prevStart = startOfDay(addDays(prevEnd, -(dayCount - 1)));

    return { preset, start, end, prevStart, prevEnd, dayCount };
}

function pctChange(current, previous) {
    const c = Number(current) || 0;
    const p = Number(previous) || 0;
    if (p === 0) return c === 0 ? 0 : 100;
    return ((c - p) / p) * 100;
}

function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function orderMatchesChannel(order, channel) {
    if (!channel || channel === "all") return true;
    const src = order.source || "website";
    return src === channel;
}

function orderMatchesCurrency(order, currencyMode) {
    if (!currencyMode || currencyMode === "store") return true;
    const cur = String(order.currency || "TRY").toUpperCase();
    if (currencyMode === "try") return cur === "TRY";
    if (currencyMode === "eur") return cur === "EUR";
    return true;
}

async function aggregatePeriod(storeId, start, end, { channel, currencyMode } = {}) {
    const orders = await StoreOrder.find({
        storeId,
        createdAt: { $gte: start, $lte: end },
    }).lean();

    let totalSales = 0;
    let paidOrders = 0;
    let cancelledOrders = 0;
    let cancelledAmount = 0;
    let itemCount = 0;
    let productRevenue = 0;
    const dailyMap = {};
    const productMap = {};
    let websiteSales = 0;
    let manualSales = 0;

    for (const o of orders) {
        if (!orderMatchesChannel(o, channel)) continue;
        if (!orderMatchesCurrency(o, currencyMode)) continue;

        const dayKey = startOfDay(o.createdAt).toISOString().slice(0, 10);
        if (!dailyMap[dayKey]) dailyMap[dayKey] = { sales: 0, orders: 0 };
        const isPaid = o.payment?.status === "paid";
        const isCancelled = o.status === "cancelled" || o.status === "failed";
        const src = o.source || "website";

        if (isPaid) {
            const total = Number(o.total) || 0;
            totalSales += total;
            paidOrders += 1;
            dailyMap[dayKey].sales += total;
            dailyMap[dayKey].orders += 1;
            if (src === "manual") manualSales += total;
            else websiteSales += total;
            for (const li of o.lineItems || []) {
                const qty = Number(li.quantity) || 0;
                const price = Number(li.unitPrice) || 0;
                itemCount += qty;
                productRevenue += qty * price;
                const key = String(li.storeProductId || li.title || "unknown");
                if (!productMap[key]) {
                    productMap[key] = { title: li.title || "Ürün", qty: 0, revenue: 0 };
                }
                productMap[key].qty += qty;
                productMap[key].revenue += qty * price;
            }
        }
        if (isCancelled) {
            cancelledOrders += 1;
            cancelledAmount += Number(o.total) || 0;
        }
    }

    const topSellers = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((p) => ({
            title: p.title,
            quantity: p.qty,
            revenue: round2(p.revenue),
        }));

    const avgOrderAmount = paidOrders > 0 ? totalSales / paidOrders : 0;
    const avgBasketSize = paidOrders > 0 ? itemCount / paidOrders : 0;
    const avgProductPrice = itemCount > 0 ? productRevenue / itemCount : 0;
    const returnRate = orders.length > 0 ? (cancelledOrders / orders.length) * 100 : 0;

    return {
        totalSales: round2(totalSales),
        orderCount: paidOrders,
        returns: round2(cancelledAmount),
        avgOrderAmount: round2(avgOrderAmount),
        avgBasketSize: round2(avgBasketSize),
        avgProductPrice: round2(avgProductPrice),
        returnRate: round2(returnRate),
        dailyMap,
        topSellers,
        websiteSales: round2(websiteSales),
        manualSales: round2(manualSales),
    };
}

function buildChartSeries(start, end, dailyMap) {
    const points = [];
    const cursor = startOfDay(start);
    const last = startOfDay(end);
    while (cursor <= last) {
        const key = cursor.toISOString().slice(0, 10);
        const day = dailyMap[key] || { sales: 0, orders: 0 };
        points.push({
            date: key,
            label: TR_DAY[cursor.getDay()],
            sales: round2(day.sales),
            orders: day.orders,
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    return points;
}

async function getStoreDashboard(userId, opts = {}) {
    const {
        preset = "last_7_days",
        startDate,
        endDate,
        channel = "all",
        currencyMode = "store",
        compare = true,
    } = opts;

    const store = opts.siteId
        ? await storeService.resolveStoreForUser(userId, { siteId: opts.siteId })
        : await Store.findOne({ userId }).sort({ createdAt: 1 }).lean();
    if (!store) return { hasStore: false };

    const range = resolveDateRange({ preset, startDate, endDate });
    const filter = { channel, currencyMode };

    const current = await aggregatePeriod(store._id, range.start, range.end, filter);
    let previous = current;
    if (compare) {
        previous = await aggregatePeriod(store._id, range.prevStart, range.prevEnd, filter);
    }

    const chart = buildChartSeries(range.start, range.end, current.dailyMap);

    const paySettings = await StorePaymentSettings.findOne({ storeId: store._id }).lean();
    const paytrReady = storePaytr.hasValidCreds(paySettings) && paySettings?.paytr?.enabled;

    const awaitingShipment = await StoreOrder.countDocuments({
        storeId: store._id,
        status: { $in: ["paid", "processing"] },
        trackingNumber: { $in: ["", null] },
    });

    const displayDomain =
        store.customDomain && store.domainStatus === "verified"
            ? store.customDomain
            : store.subdomain || `${store.slug}.sites.dashtock.com`;

    const totalChannel = current.websiteSales + current.manualSales;
    const share = (part) => (totalChannel > 0 ? round2((part / totalChannel) * 100) : 0);
    const chFilter = channel === "all" ? null : channel;

    const websiteCurrent = chFilter === "manual" ? { totalSales: 0 } : await aggregatePeriod(store._id, range.start, range.end, { ...filter, channel: "website" });
    const manualCurrent = chFilter === "website" ? { totalSales: 0 } : await aggregatePeriod(store._id, range.start, range.end, { ...filter, channel: "manual" });
    let websitePrev = websiteCurrent;
    let manualPrev = manualCurrent;
    if (compare) {
        websitePrev = chFilter === "manual" ? { totalSales: 0 } : await aggregatePeriod(store._id, range.prevStart, range.prevEnd, { ...filter, channel: "website" });
        manualPrev = chFilter === "website" ? { totalSales: 0 } : await aggregatePeriod(store._id, range.prevStart, range.prevEnd, { ...filter, channel: "manual" });
    }

    const cmp = (c, p) => (compare ? round2(pctChange(c, p)) : 0);

    return {
        hasStore: true,
        store: {
            name: store.name,
            slug: store.slug,
            status: store.status,
            domain: displayDomain,
        },
        filters: {
            preset: range.preset,
            dayCount: range.dayCount,
            start: range.start.toISOString(),
            end: range.end.toISOString(),
            channel,
            currencyMode,
            compare: !!compare,
            currency: store.settings?.currency || "TRY",
        },
        account: {
            paytrReady,
            showVerifyBanner: !paytrReady,
        },
        visitors: {
            sessions: 0,
            hasTracking: false,
        },
        kpis: {
            totalSales: { value: current.totalSales, changePct: cmp(current.totalSales, previous.totalSales) },
            orderCount: { value: current.orderCount, changePct: cmp(current.orderCount, previous.orderCount) },
            sessions: { value: 0, changePct: 0 },
            conversionRate: { value: 0, changePct: 0 },
            returns: { value: current.returns, changePct: cmp(current.returns, previous.returns) },
        },
        chart,
        channels: [
            {
                id: "website",
                label: displayDomain,
                sales: websiteCurrent.totalSales,
                sharePct: share(websiteCurrent.totalSales),
                changePct: cmp(websiteCurrent.totalSales, websitePrev.totalSales),
            },
            {
                id: "manual",
                label: "Manuel Sipariş",
                sales: manualCurrent.totalSales,
                sharePct: share(manualCurrent.totalSales),
                changePct: cmp(manualCurrent.totalSales, manualPrev.totalSales),
            },
        ],
        topSellers: current.topSellers,
        growth: {
            avgReturnRate: { value: current.returnRate, changePct: cmp(current.returnRate, previous.returnRate) },
            avgProductPrice: { value: current.avgProductPrice, changePct: cmp(current.avgProductPrice, previous.avgProductPrice) },
            avgOrderAmount: { value: current.avgOrderAmount, changePct: cmp(current.avgOrderAmount, previous.avgOrderAmount) },
            avgBasketSize: { value: current.avgBasketSize, changePct: cmp(current.avgBasketSize, previous.avgBasketSize) },
        },
        operations: { awaitingShipment },
        publicUrl: storeService.getPublicStoreUrl(store),
    };
}

module.exports = { getStoreDashboard, resolveDateRange };
