/**
 * payoutReportService.js — Sipariş bazlı "Hak Ediş / Payout" raporu
 *
 * Amaç: Satıcının her siparişten pazaryerinden GERÇEKTE alacağı net tutarı (hak ediş)
 * komisyon + kargo + diğer kesintiler düşülerek hesaplamak; kâr değil, TAHSİLAT odağı.
 *
 *   netHakEdis = brütSatış − komisyon − kargoKesinti − digerKesinti
 *
 * Sıfır-hata yaklaşımı:
 *   - Komisyon kaynağı GERÇEK (Trendyol commissionFee / Hepsiburada commission.amount)
 *     ya da TAHMİN (oran) olarak satır bazında etiketlenir (dataQuality).
 *   - Eksik veriler (komisyon yok vb.) gizlenmez; audit bloğunda raporlanır.
 *   - Trendyol için gerçek settlement verisiyle mutabakat (reconcile) yapılabilir.
 */

const axios = require("axios");
const Order = require("../models/Order");
const Marketplace = require("../models/Marketplace");
const { decryptCredentials } = require("../utils/encryption");
const { buildProductEconomicsIndex, resolveLineEconomics } = require("../utils/productEconomicsLookup");
const {
    buildMarketplaceFinanceMaps,
    getFinanceForOrder,
    getTrendyolAuth,
} = require("./marketplaceFinanceEnrichmentService");
const logger = require("../config/logger");

const round2 = (n) => parseFloat((Number(n) || 0).toFixed(2));

const normMp = (name) =>
    String(name || "")
        .toLowerCase()
        .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c")
        .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ğ/g, "g")
        .replace(/\s+/g, "");

const platformKeyOf = (name) => {
    const k = normMp(name);
    if (k.includes("trendyol")) return "trendyol";
    if (k.includes("hepsi")) return "hepsiburada";
    if (k.includes("n11")) return "n11";
    if (k.includes("cicek")) return "ciceksepeti";
    if (k.includes("amazon")) return "amazon";
    if (k.includes("pazarama")) return "pazarama";
    if (k.includes("ptt")) return "pttavm";
    return k || "diger";
};

const platformLabelOf = (name) => {
    switch (platformKeyOf(name)) {
        case "trendyol": return "Trendyol";
        case "hepsiburada": return "Hepsiburada";
        case "n11": return "N11";
        case "ciceksepeti": return "ÇiçekSepeti";
        case "amazon": return "Amazon";
        case "pazarama": return "Pazarama";
        case "pttavm": return "PTT AVM";
        default: return name || "Diğer";
    }
};

/** Türkiye pazaryeri stopaj tahmini — gerçek kayıt yoksa brüt satışın %1'i */
const DEFAULT_STOPAJ_RATE = 0.01;
const STOPAJ_PLATFORMS = new Set(["trendyol", "hepsiburada", "n11", "ciceksepeti", "amazon", "pazarama"]);

const estimateStopaj = (grossSale, platformKey) => {
    if (grossSale <= 0 || !STOPAJ_PLATFORMS.has(platformKey)) return { amount: 0, estimated: false };
    return { amount: round2(grossSale * DEFAULT_STOPAJ_RATE), estimated: true };
};

const CHUNK_MS = 15 * 24 * 60 * 60 * 1000;

const hasApiCommissionSource = (sources = []) =>
    sources.some((s) => /settlement|commission|n11_commission|hb_commission|cs_commission/.test(s));

const hasApiRevenueSource = (sources = []) =>
    sources.some((s) => /settlement_revenue|ty_settlement_revenue|n11_commission|hb_commission|cs_commission/.test(s));

const hasTyOfficialDeductions = (sources = []) =>
    sources.some((s) => /ty_cargo_invoice|ty_platform_fee|ty_international_fee|ty_stoppage/.test(s));

/**
 * Hak ediş satırı için eksik alanları belirler (ürün maliyeti hariç — o kâr hesabına aittir)
 */
const buildPayoutMissingFields = ({
    grossSale, commission, cargo, packaging, platformFee, internationalFee,
    lineCommissionActual, stopajEstimated, hasSettlement, hasApiCargo, hasApiStopaj,
}) => {
    const missing = [];
    if (grossSale <= 0) return missing;
    if (hasSettlement) {
        // settlement / resmi API — komisyon gerçek
    } else if (commission > 0.001 && !lineCommissionActual) {
        missing.push("tahmini komisyon");
    } else if (commission <= 0.001) {
        missing.push("komisyon");
    }
    if (cargo <= 0.001 && !hasApiCargo) missing.push("kargo");
    if (packaging <= 0.001) missing.push("paketleme");
    if (platformFee <= 0.001) missing.push("platform bedeli");
    if ((internationalFee || 0) <= 0.001 && grossSale > 0) {
        // uluslararası satış yoksa eksik sayma — sadece TY mikro ihracat için geçerli
    }
    if (stopajEstimated && !hasApiStopaj) missing.push("tahmini stopaj");
    return missing;
};

/**
 * Sipariş bazlı hak ediş raporu üretir.
 * @param {ObjectId|string} userId
 * @param {Date} start
 * @param {Date} end
 * @param {object} [opts] - { limit, marketplace }
 */
const buildPayoutReport = async (userId, start, end, opts = {}) => {
    const limit = parseInt(opts.limit, 10) || 2000;
    const marketplaceFilter = opts.marketplace ? platformKeyOf(opts.marketplace) : null;

    const orderQuery = {
        user: userId,
        orderDate: { $gte: start, $lte: end },
    };
    if (marketplaceFilter && marketplaceFilter !== "diger") {
        orderQuery.marketplaceName = new RegExp(marketplaceFilter.replace("hepsiburada", "hepsi"), "i");
    }

    const [orders, productMap, financeMaps] = await Promise.all([
        Order.find(orderQuery)
            .select(
                "marketplaceName totalPrice grossOrderAmount orderDate trackingNumber " +
                "customerName items costSummary status statusBucket isCancelled isReturned cargoCompany"
            )
            .sort({ orderDate: -1 })
            .limit(limit)
            .lean(),
        buildProductEconomicsIndex(userId),
        buildMarketplaceFinanceMaps(userId, start, end),
    ]);

    const rows = [];

    // Toplamlar (yalnızca aktif = iptal/iade olmayan siparişler hak edişe sayılır)
    const summary = {
        orders: 0,
        grossSale: 0,
        commission: 0,
        cargo: 0,
        packaging: 0,
        platformFee: 0,
        internationalFee: 0,
        stopaj: 0,
        totalDeductions: 0,
        otherDeduction: 0, // geriye dönük uyumluluk
        netPayout: 0,
        deliveredPayout: 0,
        pendingPayout: 0,
    };

    // İptal/iade (hak edişten düşülecek / geri alınacak)
    const voided = { count: 0, grossSale: 0, netPayout: 0 };

    const platformAgg = new Map();
    const audit = {
        totalOrders: orders.length,
        actualCount: 0,
        estimatedCount: 0,
        settlementCount: 0,
        missingCommissionCount: 0,
        missingCargoCount: 0,
        missingPackagingCount: 0,
        estimatedStopajCount: 0,
        apiEnrichedCount: 0,
        apiCargoCount: 0,
        apiPlatformFeeCount: 0,
        apiStopajCount: 0,
        cancelledCount: 0,
        returnedCount: 0,
        settlementEnriched: (financeMaps.trendyol?.size || 0) > 0,
        financeApiLoaded: {
            trendyol: financeMaps.trendyol?.size || 0,
            hepsiburada: financeMaps.hepsiburada?.size || 0,
            n11: financeMaps.n11?.size || 0,
            ciceksepeti: financeMaps.ciceksepeti?.size || 0,
        },
        samples: [],
    };

    for (const o of orders) {
        const items = Array.isArray(o.items) ? o.items : [];
        const itemCount = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || items.length;

        let grossSale = Number(o.totalPrice) || 0;
        if (grossSale <= 0) grossSale = Number(o.grossOrderAmount) || 0;
        if (grossSale <= 0) {
            grossSale = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
        }

        const pKey = platformKeyOf(o.marketplaceName);

        // Kalem bazlı ekonomi
        let commission = 0;
        let cargo = 0;
        let packaging = 0;
        let productCost = 0;
        let lineCommissionActual = true;
        let anyRevenueLine = false;
        let lineMissingCost = false;
        for (const it of items) {
            const econ = resolveLineEconomics(it, o.marketplaceName, productMap, {
                allowDefaultCommission: true,
            });
            commission += econ.commissionAmount || 0;
            cargo += econ.shippingCost || 0;
            packaging += econ.packagingTotal || 0;
            productCost += econ.productCostTotal || 0;
            if (econ.revenue > 0) {
                anyRevenueLine = true;
                if (!econ.sources.includes("siparis_kaydi")) lineCommissionActual = false;
            }
            if ((econ.missingFields || []).includes("maliyet")) lineMissingCost = true;
        }
        const storedCommission = Number(o.costSummary?.totalCommission) || 0;
        if (storedCommission > 0.001) commission = storedCommission;
        const storedShipping = Number(o.costSummary?.totalShipping) || 0;
        if (storedShipping > cargo) cargo = storedShipping;
        const storedPackaging = Number(o.costSummary?.totalPackaging) || 0;
        if (storedPackaging > packaging) packaging = storedPackaging;

        commission = round2(commission);
        cargo = round2(cargo);
        packaging = round2(packaging);
        let platformFee = round2(Number(o.costSummary?.totalOtherCost) || 0);
        let internationalFee = 0;

        // Resmi pazaryeri finans API'sinden zenginleştirme (Trendyol paneli ile uyumlu)
        let hasSettlement = false;
        let hasApiCargo = false;
        let hasApiStopaj = false;
        let commissionSource = lineCommissionActual ? "siparis" : "tahmin";
        let useSellerRevenue = false;

        const apiFin = getFinanceForOrder(financeMaps, pKey, o.trackingNumber);
        if (apiFin) {
            audit.apiEnrichedCount++;
            if (apiFin.grossCredit > 0) {
                grossSale = round2(apiFin.grossCredit);
            }
            if (apiFin.commission > 0.001) {
                commission = round2(apiFin.commission);
                lineCommissionActual = true;
                hasSettlement = hasApiCommissionSource(apiFin.sources);
                commissionSource = hasSettlement ? "settlement" : "api";
            }
            if (apiFin.cargo > 0.001) {
                cargo = round2(apiFin.cargo);
                hasApiCargo = true;
                audit.apiCargoCount++;
            }
            if (apiFin.platformFee > 0.001) {
                platformFee = round2(apiFin.platformFee);
                audit.apiPlatformFeeCount++;
            }
            if (apiFin.internationalFee > 0.001) {
                internationalFee = round2(apiFin.internationalFee);
            }
            if (apiFin.stopaj > 0.001) {
                hasApiStopaj = true;
                audit.apiStopajCount++;
            }
            if (apiFin.sellerRevenue > 0 && hasApiRevenueSource(apiFin.sources)) {
                useSellerRevenue = true;
            } else if (pKey === "trendyol" && hasTyOfficialDeductions(apiFin.sources) && apiFin.sellerRevenue > 0) {
                useSellerRevenue = true;
            }
        }

        let stopajInfo = estimateStopaj(grossSale, pKey);
        let stopaj = stopajInfo.amount;
        if (apiFin?.stopaj > 0.001) {
            stopaj = round2(apiFin.stopaj);
            stopajInfo = { amount: stopaj, estimated: false };
        }

        let totalDeductions;
        let netPayout;
        if (useSellerRevenue && apiFin?.sellerRevenue > 0) {
            // Trendyol: sellerRevenue (komisyon sonrası) − kargo − platform − uluslararası − stopaj
            totalDeductions = round2(cargo + packaging + platformFee + internationalFee + stopaj);
            netPayout = round2(apiFin.sellerRevenue - totalDeductions);
        } else {
            totalDeductions = round2(commission + cargo + packaging + platformFee + internationalFee + stopaj);
            netPayout = round2(grossSale - totalDeductions);
        }
        const commissionRate = grossSale > 0 ? (commission / grossSale) * 100 : 0;

        const hasCommission = commission > 0.001;
        const dataQuality = hasSettlement || (lineCommissionActual && hasCommission) ? "actual" : "estimated";

        const missingFields = buildPayoutMissingFields({
            grossSale, commission, cargo, packaging, platformFee, internationalFee,
            lineCommissionActual, stopajEstimated: stopajInfo.estimated, hasSettlement, hasApiCargo, hasApiStopaj,
        });

        const isCancelled = !!o.isCancelled;
        const isReturned = !!o.isReturned;
        const isVoid = isCancelled || isReturned;

        const row = {
            orderId: String(o._id),
            orderNo: o.trackingNumber || "—",
            platform: platformLabelOf(o.marketplaceName),
            platformKey: pKey,
            date: o.orderDate,
            customerName: o.customerName || "",
            itemCount,
            firstProduct: items[0]?.productName || items[0]?.name || "",
            grossSale: round2(grossSale),
            commission: round2(commission),
            commissionRate: round2(commissionRate),
            cargo: round2(cargo),
            packaging: round2(packaging),
            platformFee: round2(platformFee),
            internationalFee: round2(internationalFee),
            stopaj: round2(stopaj),
            stopajEstimated: stopajInfo.estimated,
            totalDeductions: round2(totalDeductions),
            otherDeduction: round2(packaging + platformFee + internationalFee + stopaj),
            netPayout: round2(netPayout),
            dataQuality,
            commissionSource,
            apiSources: apiFin?.sources || [],
            missingFields,
            status: o.status || "",
            statusBucket: o.statusBucket || "",
            cargoCompany: o.cargoCompany || "",
            isCancelled,
            isReturned,
        };
        rows.push(row);

        // Audit
        if (dataQuality === "actual") audit.actualCount++;
        else audit.estimatedCount++;
        if (hasSettlement) audit.settlementCount++;
        if (missingFields.includes("komisyon") || missingFields.includes("tahmini komisyon")) {
            audit.missingCommissionCount++;
            if (audit.samples.length < 10) {
                audit.samples.push({ orderNo: row.orderNo, platform: row.platform, grossSale: row.grossSale, missing: missingFields });
            }
        }
        if (missingFields.includes("kargo")) audit.missingCargoCount++;
        if (missingFields.includes("paketleme")) audit.missingPackagingCount++;
        if (missingFields.includes("tahmini stopaj")) audit.estimatedStopajCount++;
        if (isCancelled) audit.cancelledCount++;
        if (isReturned) audit.returnedCount++;

        if (isVoid) {
            voided.count++;
            voided.grossSale += grossSale;
            voided.netPayout += netPayout;
            continue; // iptal/iade aktif hak edişe katılmaz
        }

        // Aktif sipariş toplamları
        summary.orders++;
        summary.grossSale += grossSale;
        summary.commission += commission;
        summary.cargo += cargo;
        summary.packaging += packaging;
        summary.platformFee += platformFee;
        summary.internationalFee += internationalFee;
        summary.stopaj += stopaj;
        summary.totalDeductions += totalDeductions;
        summary.otherDeduction += packaging + platformFee + internationalFee + stopaj;
        summary.netPayout += netPayout;
        if (row.statusBucket === "delivered") summary.deliveredPayout += netPayout;
        else summary.pendingPayout += netPayout;

        // Platform kırılımı
        const agg = platformAgg.get(pKey) || {
            key: pKey, name: row.platform, orders: 0,
            grossSale: 0, commission: 0, cargo: 0, packaging: 0, platformFee: 0, internationalFee: 0, stopaj: 0,
            totalDeductions: 0, netPayout: 0,
            actualCount: 0, estimatedCount: 0,
        };
        agg.orders++;
        agg.grossSale += grossSale;
        agg.commission += commission;
        agg.cargo += cargo;
        agg.packaging += packaging;
        agg.platformFee += platformFee;
        agg.internationalFee += internationalFee;
        agg.stopaj += stopaj;
        agg.totalDeductions += totalDeductions;
        agg.netPayout += netPayout;
        if (dataQuality === "actual") agg.actualCount++;
        else agg.estimatedCount++;
        platformAgg.set(pKey, agg);
    }

    // Yuvarlama
    for (const k of Object.keys(summary)) summary[k] = round2(summary[k]);
    summary.commissionRate = summary.grossSale > 0
        ? round2((summary.commission / summary.grossSale) * 100)
        : 0;
    voided.grossSale = round2(voided.grossSale);
    voided.netPayout = round2(voided.netPayout);

    const platformBreakdown = Array.from(platformAgg.values())
        .map((p) => ({
            ...p,
            grossSale: round2(p.grossSale),
            commission: round2(p.commission),
            cargo: round2(p.cargo),
            packaging: round2(p.packaging),
            platformFee: round2(p.platformFee),
            internationalFee: round2(p.internationalFee || 0),
            stopaj: round2(p.stopaj),
            totalDeductions: round2(p.totalDeductions),
            netPayout: round2(p.netPayout),
            commissionRate: p.grossSale > 0 ? round2((p.commission / p.grossSale) * 100) : 0,
        }))
        .sort((a, b) => b.netPayout - a.netPayout);

    const distinctMpNames = await Order.distinct("marketplaceName", {
        user: userId,
        orderDate: { $gte: start, $lte: end },
    });
    const availableMarketplaces = [...new Map(
        distinctMpNames.filter(Boolean).map((name) => {
            const key = platformKeyOf(name);
            return [key, { key, name: platformLabelOf(name) }];
        })
    ).values()];

    return {
        range: { start, end },
        marketplaceFilter: marketplaceFilter || "all",
        availableMarketplaces,
        summary,
        voided,
        platformBreakdown,
        audit,
        rows,
    };
};

/**
 * Trendyol "Sale" settlements üzerinden GERÇEK komisyon toplamını çeker.
 */
const fetchTrendyolSaleCommission = async (auth, startMs, endMs) => {
    const baseUrl =
        "https://apigw.trendyol.com/integration/finance/che/sellers/" + auth.sellerId + "/settlements";
    const hdrs = { Authorization: auth.authHeader, "Content-Type": "application/json" };
    let totalCommission = 0;
    let totalSellerRevenue = 0;
    let recordCount = 0;

    let cur = startMs;
    while (cur < endMs) {
        const chunkEnd = Math.min(cur + CHUNK_MS, endMs);
        let page = 0;
        let totalPages = 1;
        while (page < totalPages) {
            const resp = await axios.get(baseUrl, {
                headers: hdrs,
                params: { startDate: cur, endDate: chunkEnd, transactionType: "Sale", page, size: 500 },
                timeout: 30000,
            });
            const content = resp.data?.content || [];
            for (const rec of content) {
                totalCommission += Number(rec.commissionAmount) || 0;
                totalSellerRevenue += Number(rec.sellerRevenue ?? rec.credit ?? 0) || 0;
                recordCount++;
            }
            totalPages = resp.data?.totalPages || 1;
            page++;
        }
        cur = chunkEnd + 1;
    }

    return { totalCommission: round2(totalCommission), totalSellerRevenue: round2(totalSellerRevenue), recordCount };
};

/**
 * Hesaplanan Trendyol komisyonu ile gerçek settlement komisyonunu karşılaştırır.
 * @returns {Promise<object>} reconcile sonucu (available/delta/deltaPct...)
 */
const reconcileTrendyol = async (userId, start, end, report) => {
    try {
        const mp = await Marketplace.findOne({
            userId,
            marketplaceName: new RegExp("^trendyol$", "i"),
        });
        if (!mp) return { available: false, reason: "Trendyol entegrasyonu yok" };

        const credentials = mp.credentials ? decryptCredentials(mp.credentials) : null;
        const auth = getTrendyolAuth(credentials);
        if (!auth) return { available: false, reason: "Trendyol API kimlik bilgileri eksik" };

        const actual = await fetchTrendyolSaleCommission(auth, start.getTime(), end.getTime());

        const tyRow = (report.platformBreakdown || []).find((p) => p.key === "trendyol");
        const computedCommission = tyRow ? tyRow.commission : 0;
        const delta = round2(actual.totalCommission - computedCommission);
        const deltaPct = actual.totalCommission > 0
            ? round2((Math.abs(delta) / actual.totalCommission) * 100)
            : (computedCommission > 0 ? 100 : 0);

        return {
            available: true,
            actualCommission: actual.totalCommission,
            computedCommission,
            actualSellerRevenue: actual.totalSellerRevenue,
            settlementRecords: actual.recordCount,
            delta,
            deltaPct,
            // %2'den büyük sapma = dikkat (sipariş/settlement tarih kayması veya eksik veri)
            status: deltaPct <= 2 ? "ok" : deltaPct <= 10 ? "warning" : "mismatch",
        };
    } catch (err) {
        logger.warn(`[Payout] Trendyol mutabakat hatası: ${err.message}`);
        return { available: false, reason: err.message };
    }
};

module.exports = {
    buildPayoutReport,
    reconcileTrendyol,
    platformKeyOf,
    platformLabelOf,
};
