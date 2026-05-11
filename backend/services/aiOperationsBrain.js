/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI OPERATIONS BRAIN — LysiaETIC (v3 — Complete 50-Engine System)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Bu dosya mevcut aiEngineService.js'in ÜSTÜNE ek motorlar ekler.
 * aiEngineService zaten: Data Collection, Product Analysis, Recommendations,
 * AI Score, Timing, Profit Heatmap, Simulation, Daily Report, Strategy,
 * Retro Analysis, ROI Tracker, Goal Tracker, User Learning, Action Engine,
 * Save Recommendations, Order Sync sağlıyor.
 *
 * BU DOSYA EKLİYOR:
 *  - Business Health Engine (#18)
 *  - Loss Hunter (#19)
 *  - Focus Engine (#40)
 *  - Opportunity Radar (#41)
 *  - Cause Engine (#37)
 *  - Chain Reasoning (#38)
 *  - Competitor Analysis (#24)
 *  - Segmentation Engine (#33)
 *  - Decision History (#34)
 *  - Context-Aware AI (#48)
 *  - Emotional UX AI (#49)
 *  - Teaching AI (#46)
 *  - Explainable AI (#42)
 *  - Daily AI Journal (#29)
 *  - Self-Evaluation AI (#45)
 *  - Scenario Engine (#47)
 *  - Auto Strategy Switch (#28)
 *  - Quick Decision Mode (#43)
 *  - Multi-Objective Optimization (#44)
 *  - Product Launch AI (#32)
 *  - Funnel Analysis (#23)
 *  - Predictive Engine (#12)
 *  - Risk Engine (#13)
 *  - Decision Comparison (#14)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const User = require("../models/User");
const Recommendation = require("../models/Recommendation");
const AIGoal = require("../models/AIGoal");
const Order = require("../models/Order");
const logger = require("../config/logger");

const dayMs = 24 * 60 * 60 * 1000;
function round2(v) { return Math.round(v * 100) / 100; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** FNV-1a — günlük fırsat sırası / metin varyantı için deterministik tuz */
function hashString32(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function opportunityRotationSalt(userId) {
    const dayKey = Math.floor(Date.now() / dayMs);
    const uid = userId != null ? String(userId) : "anon";
    return hashString32(`${uid}:${dayKey}`);
}

function shortenProductLabel(name, maxLen = 42) {
    if (!name || typeof name !== "string") return "";
    const t = name.trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen - 1)}…`;
}

function formatSampleNames(products, maxItems = 2) {
    if (!products?.length) return "";
    const parts = products.slice(0, maxItems).map(p => shortenProductLabel(p.name || "", 36));
    const more = products.length > maxItems ? ` +${products.length - maxItems}` : "";
    return parts.filter(Boolean).join(", ") + more;
}

// ═════════════════════════════════════════════════════════════════════════════
// #18 BUSINESS HEALTH ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function calculateBusinessHealth(analyzedProducts, data, aiScore) {
    const { orders30, orders7, ordersToday, ordersYesterday, hasOrderData } = data;

    const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const yesterdayRevenue = ordersYesterday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const weekRevenue = orders7.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const monthRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const avgDailyRevenue = monthRevenue / 30;

    // Profit health
    const productsWithCost = analyzedProducts.filter(p => p.costPrice > 0);
    const avgMargin = productsWithCost.length > 0
        ? productsWithCost.reduce((s, p) => s + p.profitMargin, 0) / productsWithCost.length : -1;
    const lossProducts = analyzedProducts.filter(p => (p.profit < 0 || p.avgSnapshotProfit < 0) && p.costPrice > 0);
    const totalLoss = lossProducts.reduce((s, p) => {
        const unitLoss = p.avgSnapshotProfit < 0 ? Math.abs(p.avgSnapshotProfit) : Math.abs(p.profit);
        return s + (unitLoss * p.totalSold);
    }, 0);

    let profitHealth = 50;
    if (avgMargin === -1) profitHealth = 50;
    else if (avgMargin > 25) profitHealth = 90;
    else if (avgMargin > 15) profitHealth = 75;
    else if (avgMargin > 8) profitHealth = 55;
    else profitHealth = 30;
    profitHealth -= Math.min(lossProducts.length * 3, 25);
    profitHealth = clamp(profitHealth, 0, 100);

    // Stock health
    const inStock = analyzedProducts.filter(p => p.stock > 0).length;
    const outOfStock = analyzedProducts.filter(p => p.stock === 0 || p.isOutOfStock).length;
    const lowStock = analyzedProducts.filter(p => p.isLowStock).length;
    const total = analyzedProducts.length || 1;
    let stockHealth = Math.round((inStock / total) * 70);
    if (outOfStock === 0) stockHealth += 30;
    else stockHealth -= Math.min(outOfStock * 2, 20);
    stockHealth -= Math.min(lowStock, 10);
    stockHealth = clamp(stockHealth, 0, 100);

    // Sales health
    let salesHealth = 50;
    let revenueTrend = 0;
    if (hasOrderData) {
        if (todayRevenue > avgDailyRevenue * 1.2) salesHealth += 25;
        else if (todayRevenue > avgDailyRevenue * 0.8) salesHealth += 15;
        else if (todayRevenue > 0) salesHealth += 5;
        else salesHealth -= 15;

        const weeklyAvg = weekRevenue / 7;
        const monthlyAvg = avgDailyRevenue;
        if (monthlyAvg > 0) {
            revenueTrend = Math.round(((weeklyAvg - monthlyAvg) / monthlyAvg) * 100);
            if (revenueTrend > 10) salesHealth += 15;
            else if (revenueTrend > 0) salesHealth += 5;
            else if (revenueTrend < -15) salesHealth -= 15;
            else if (revenueTrend < 0) salesHealth -= 5;
        }
    }
    salesHealth = clamp(salesHealth, 0, 100);

    // Operations health
    const avgHealth = analyzedProducts.reduce((s, p) => s + p.healthScore, 0) / total;
    const deadProducts = hasOrderData ? analyzedProducts.filter(p => p.daysSinceLastSale > 30 && p.stock > 0).length : 0;
    let operationsHealth = Math.round(avgHealth * 0.6);
    operationsHealth += Math.round((inStock / total) * 20);
    operationsHealth -= Math.min(deadProducts * 2, 20);
    operationsHealth = clamp(operationsHealth, 0, 100);

    const overallScore = Math.round(
        profitHealth * 0.3 + stockHealth * 0.25 + salesHealth * 0.25 + operationsHealth * 0.2
    );

    return {
        overallScore: clamp(overallScore, 0, 100),
        rating: overallScore >= 80 ? "excellent" : overallScore >= 60 ? "good" : overallScore >= 40 ? "warning" : "critical",
        profitHealth: clamp(profitHealth, 0, 100),
        stockHealth: clamp(stockHealth, 0, 100),
        salesHealth: clamp(salesHealth, 0, 100),
        operationsHealth: clamp(operationsHealth, 0, 100),
        metrics: {
            todayRevenue: round2(todayRevenue),
            yesterdayRevenue: round2(yesterdayRevenue),
            weekRevenue: round2(weekRevenue),
            monthRevenue: round2(monthRevenue),
            avgDailyRevenue: round2(avgDailyRevenue),
            revenueTrend, // ✅ Trend ekledik
            avgMargin: avgMargin >= 0 ? round2(avgMargin) : null,
            totalProducts: total,
            inStock, outOfStock, lowStock, deadProducts,
            lossProductCount: lossProducts.length,
            totalLoss: round2(totalLoss),
        },
        trend: {
            revenueChange: yesterdayRevenue > 0 ? round2(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : 0,
            direction: todayRevenue >= yesterdayRevenue ? "up" : "down",
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #19 LOSS HUNTER
// ═════════════════════════════════════════════════════════════════════════════

function huntLosses(analyzedProducts, data) {
    const losses = [];
    let totalLostProfit = 0;
    let totalMissedRevenue = 0;

    // 1. Zararda satılan ürünler
    const lossProducts = analyzedProducts.filter(p => (p.profit < 0 || p.avgSnapshotProfit < 0) && p.totalSold > 0 && p.costPrice > 0);
    for (const p of lossProducts) {
        const unitLoss = p.avgSnapshotProfit < 0 ? Math.abs(p.avgSnapshotProfit) : Math.abs(p.profit);
        const lost = unitLoss * p.totalSold;
        totalLostProfit += lost;
        losses.push({
            type: "negative_profit",
            severity: "critical",
            icon: "🔴",
            product: p.name,
            barcode: p.barcode,
            amount: round2(lost),
            description: `${p.name.slice(0, 40)} satış başına ${unitLoss.toFixed(0)}₺ zarar — toplam ${lost.toFixed(0)}₺`,
            action: `Fiyatı en az ${Math.ceil(p.costPrice * 1.15)}₺ yapın`,
        });
    }

    // 2. Stok tükenen yüksek satışlı ürünler
    const missedSales = analyzedProducts.filter(p => p.stock === 0 && p.avgDailySales > 0.3 && p.profit > 0);
    for (const p of missedSales) {
        const missedDays = Math.min(p.daysSinceLastSale || 7, 30);
        const missedProfit = p.profit * p.avgDailySales * missedDays;
        const missedRev = p.price * p.avgDailySales * missedDays;
        totalLostProfit += missedProfit;
        totalMissedRevenue += missedRev;
        losses.push({
            type: "missed_sales",
            severity: "high",
            icon: "📦",
            product: p.name,
            barcode: p.barcode,
            amount: round2(missedProfit),
            missedRevenue: round2(missedRev),
            description: `${p.name.slice(0, 40)} stok tükendi — tahmini ${missedDays} gün × ${p.avgDailySales.toFixed(1)} adet/gün kaçırıldı`,
            action: `Acil ${Math.ceil(p.avgDailySales * 30)} adet tedarik edin`,
        });
    }

    // 3. Düşük marjlı yüksek satışlı ürünler (fırsat kaçırma)
    const lowMarginHighSales = analyzedProducts.filter(p =>
        p.profitMargin > 0 && p.profitMargin < 8 && p.totalSold > 10 && p.costPrice > 0
    );
    for (const p of lowMarginHighSales) {
        const potentialExtraProfit = (p.price * 0.05) * p.totalSold;
        totalMissedRevenue += potentialExtraProfit;
        losses.push({
            type: "margin_opportunity",
            severity: "medium",
            icon: "💸",
            product: p.name,
            barcode: p.barcode,
            amount: round2(potentialExtraProfit),
            description: `${p.name.slice(0, 40)} marjı çok düşük (%${p.profitMargin.toFixed(1)}) — %5 artışla +${potentialExtraProfit.toFixed(0)}₺`,
            action: `Fiyatı %5 artırın`,
        });
    }

    losses.sort((a, b) => b.amount - a.amount);

    return {
        losses: losses.slice(0, 20),
        totalLostProfit: round2(totalLostProfit),
        totalMissedRevenue: round2(totalMissedRevenue),
        totalImpact: round2(totalLostProfit + totalMissedRevenue),
        summary: totalLostProfit > 0
            ? `${losses.length} kayıp noktası tespit edildi — toplam ${(totalLostProfit + totalMissedRevenue).toFixed(0)}₺ etki`
            : "Tespit edilen kayıp yok ✅",
        counts: {
            negativeProfitProducts: lossProducts.length,
            missedSalesProducts: missedSales.length,
            lowMarginProducts: lowMarginHighSales.length,
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #40 FOCUS ENGINE — "En önemli 3 şey"
// ═════════════════════════════════════════════════════════════════════════════

function generateFocusItems(analyzedProducts, data, businessHealth, lossHunter) {
    const items = [];
    const { hasOrderData, ordersToday, orders30 } = data;
    const totalProducts = analyzedProducts.length;

    // ── 1. Stok tükenmiş ürünler ───────────────────────────────────────────
    const outOfStock = analyzedProducts.filter(p => p.stock === 0 && p.avgDailySales > 0.3);
    if (outOfStock.length > 0) {
        const sorted = [...outOfStock].sort((a, b) => (b.price * b.avgDailySales) - (a.price * a.avgDailySales));
        items.push({
            priority: 1,
            icon: "🚨",
            title: `${outOfStock.length} ürünün stoğu TÜKENDİ`,
            description: `${fmtMarketplaces(sorted[0]?.marketplaces, 1)} dahil, günde toplam ${outOfStock.reduce((s, p) => s + p.avgDailySales, 0).toFixed(1)} adet satış kaçırılıyor`,
            impact: `−${outOfStock.reduce((s, p) => s + p.price * p.avgDailySales, 0).toFixed(0)}₺/gün`,
            action: "Tedarikçiye sipariş ver",
            category: "stock",
            urgency: "critical",
            cta: { tab: "advisor", filter: { outOfStock: true }, label: "Stoksuz Ürünleri Aç" },
            topProducts: sorted.slice(0, 5).map(p => detailProduct(p, {
                suggestion: `${Math.ceil(p.avgDailySales * 30)} adet sipariş`,
                dailyImpact: round2(p.price * p.avgDailySales),
            })),
        });
    }

    // ── 2. Zararda satılan ürünler ─────────────────────────────────────────
    const lossProducts = analyzedProducts.filter(p => (p.profit < 0 || p.avgSnapshotProfit < 0) && p.totalSold > 0 && p.costPrice > 0);
    if (lossProducts.length > 0) {
        const sorted = [...lossProducts].sort((a, b) => (Math.abs(b.profit) * b.avgDailySales) - (Math.abs(a.profit) * a.avgDailySales));
        const totalDailyLoss = lossProducts.reduce((s, p) => {
            const unitLoss = p.avgSnapshotProfit < 0 ? Math.abs(p.avgSnapshotProfit) : Math.abs(p.profit);
            return s + (unitLoss * p.avgDailySales);
        }, 0);
        items.push({
            priority: 2,
            icon: "🔴",
            title: `${lossProducts.length} ürün ZARARDA satılıyor`,
            description: `En çok kaybettiren: ${(sorted[0]?.name || "?").slice(0, 35)} — birim zarar ${Math.abs(sorted[0]?.profit || 0).toFixed(0)}₺`,
            impact: `−${totalDailyLoss.toFixed(0)}₺/gün`,
            action: "Min fiyatları %15 kar marjıyla güncelle",
            category: "pricing",
            urgency: "critical",
            cta: { tab: "recommendations", filter: { type: "loss_detection,price_optimization" }, label: "Fiyat Önerileri" },
            topProducts: sorted.slice(0, 5).map(p => detailProduct(p, {
                unitLoss: round2(Math.abs(p.profit)),
                minSafePrice: Math.ceil((p.costPrice || 0) * 1.15),
                suggestion: `Min ${Math.ceil((p.costPrice || 0) * 1.15)}₺ — %15 kar marjı için`,
            })),
        });
    }

    // ── 3. Düşük stok, hızlı satan ─────────────────────────────────────────
    const criticalLowStock = analyzedProducts.filter(p => p.stock > 0 && p.daysOfStock < 3 && p.avgDailySales > 0.5);
    if (criticalLowStock.length > 0) {
        const sorted = [...criticalLowStock].sort((a, b) => a.daysOfStock - b.daysOfStock);
        items.push({
            priority: 3,
            icon: "⚠️",
            title: `${criticalLowStock.length} ürün 3 gün içinde TÜKENECEK`,
            description: `En kritik: ${(sorted[0]?.name || "?").slice(0, 30)} — ${sorted[0]?.daysOfStock} gün kaldı (${sorted[0]?.stock} adet)`,
            impact: `${criticalLowStock.reduce((s, p) => s + p.price * p.avgDailySales * 30, 0).toFixed(0)}₺ risk`,
            action: "Stok siparişi ver",
            category: "stock",
            urgency: "high",
            cta: { tab: "advisor", filter: { lowStock: true }, label: "Düşük Stok Ürünleri" },
            topProducts: sorted.slice(0, 5).map(p => detailProduct(p, {
                suggestion: `${Math.max(Math.ceil(p.avgDailySales * 30) - p.stock, 1)} adet ek sipariş`,
                projectedLoss: round2(p.price * p.avgDailySales * 30),
            })),
        });
    }

    // ── 4. Satış trendi ────────────────────────────────────────────────────
    if (hasOrderData) {
        const todayRev = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const avgDaily = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0) / 30;
        const hourTR = (new Date().getUTCHours() + 3) % 24;
        if (todayRev > avgDaily * 1.5 && todayRev > 0) {
            const todayBest = [...ordersToday]
                .sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0))
                .slice(0, 3)
                .map(o => ({ orderId: o.trackingNumber, marketplace: o.marketplaceName, amount: round2(o.totalPrice || 0) }));
            items.push({
                priority: 4,
                icon: "🎉",
                title: "Satışlar bugün ortalamanın ÜSTÜNDE!",
                description: `Bugün: ${todayRev.toFixed(0)}₺ vs günlük ortalama: ${avgDaily.toFixed(0)}₺ (+%${Math.round((todayRev / avgDaily - 1) * 100)})`,
                impact: `+${(todayRev - avgDaily).toFixed(0)}₺`,
                action: "Hızlı satanların stoklarını koru",
                category: "opportunity",
                urgency: "info",
                cta: { tab: "advisor", label: "Hızlı Satanları Aç" },
                topProducts: [],
                kpis: todayBest,
            });
        } else if (avgDaily > 50 && hourTR >= 14 && todayRev < avgDaily * 0.5) {
            items.push({
                priority: 4,
                icon: "📉",
                title: "Satışlar bugün DÜŞÜK",
                description: `Bugün ${todayRev.toFixed(0)}₺ — günlük ortalama ${avgDaily.toFixed(0)}₺ (%${Math.round((1 - todayRev / avgDaily) * 100)} düşüş)`,
                impact: `−${(avgDaily - todayRev).toFixed(0)}₺`,
                action: "Kanal performansını incele veya kampanya başlat",
                category: "sales",
                urgency: "high",
                cta: { tab: "platforms", label: "Pazaryeri Karşılaştırma" },
            });
        }
    }

    // ── 5. Ölü ürünler ─────────────────────────────────────────────────────
    // Yeni eklenmiş ve henüz satılmamış ürünleri "ölü" sayma
    const deadProducts = analyzedProducts.filter(p =>
        p.daysSinceLastSale !== null &&
        p.daysSinceLastSale !== undefined &&
        p.daysSinceLastSale > 60 &&
        p.stock > 10 &&
        !p.isNewProduct
    );
    if (deadProducts.length > 5) {
        const sorted = [...deadProducts].sort((a, b) => (b.price * b.stock) - (a.price * a.stock));
        const deadValue = deadProducts.reduce((s, p) => s + p.price * p.stock, 0);
        items.push({
            priority: 5,
            icon: "💀",
            title: `${deadProducts.length} ürün 60+ GÜNDÜR satılmıyor`,
            description: `Top ürün: ${(sorted[0]?.name || "?").slice(0, 30)} — ${sorted[0]?.daysSinceLastSale} gün önce satıldı, ${sorted[0]?.stock} adet stokta`,
            impact: `${deadValue.toFixed(0)}₺ bağlı sermaye`,
            action: "Her ürüne ayrı indirim önerisi hazır",
            category: "performance",
            urgency: "medium",
            cta: { tab: "recommendations", filter: { type: "dead_product,dynamic_pricing" }, label: "İndirim Önerileri" },
            topProducts: sorted.slice(0, 5).map(p => detailProduct(p, {
                capitalLocked: round2(p.price * p.stock),
                suggestion: `%20 indirim → ${Math.round(p.price * 0.8)}₺`,
                daysIdle: p.daysSinceLastSale,
            })),
        });
    }

    // ── 6. Maliyet eksik ───────────────────────────────────────────────────
    const noCost = analyzedProducts.filter(p => (p.costPrice || 0) === 0);
    const noCostSelling = noCost.filter(p => p.totalSold > 0);
    if (noCost.length > Math.max(5, totalProducts * 0.5)) {
        const sorted = [...(noCostSelling.length > 0 ? noCostSelling : noCost)].sort((a, b) => b.totalRevenue - a.totalRevenue);
        items.push({
            priority: 6,
            icon: "📝",
            title: `${noCost.length} üründe MALİYET EKSİK${noCostSelling.length > 0 ? ` (${noCostSelling.length}'i satıyor!)` : ""}`,
            description: noCostSelling.length > 0
                ? `Bu ürünlerin son 90 günlük cirosu ${noCostSelling.reduce((s, p) => s + p.totalRevenue, 0).toFixed(0)}₺ — kâr/zarar bilemiyoruz`
                : "AI kâr analizi yapamıyor — doğru öneriler için maliyet girin",
            impact: "AI doğruluğu düşük",
            action: "Önce satan ürünlerin maliyetini gir",
            category: "data",
            urgency: noCostSelling.length > 0 ? "high" : "medium",
            cta: { tab: "costs", label: "Maliyet Sayfasını Aç" },
            topProducts: sorted.slice(0, 5).map(p => detailProduct(p, {
                suggestion: "Maliyet gir → AI öneri açar",
                priority: p.totalSold > 0 ? "Yüksek (satıyor)" : "Düşük",
            })),
        });
    }

    items.sort((a, b) => a.priority - b.priority);
    return items.slice(0, 5);
}

// ═════════════════════════════════════════════════════════════════════════════
// #41 OPPORTUNITY RADAR
// ═════════════════════════════════════════════════════════════════════════════

function scanOpportunities(analyzedProducts, data, userId) {
    const salt = opportunityRotationSalt(userId);
    const seasonalVariant = salt % 2;
    const opportunities = [];

    // High margin + high stock = push marketing
    const highMarginHighStock = analyzedProducts.filter(p => p.profitMargin > 20 && p.stock > 20 && p.costPrice > 0);
    if (highMarginHighStock.length > 0) {
        const totalPotential = highMarginHighStock.reduce((s, p) => s + p.profit * p.stock * 0.3, 0);
        const byPush = [...highMarginHighStock].sort((a, b) => (b.profit * b.stock) - (a.profit * a.stock));
        const pickOffset = salt % Math.max(1, Math.min(3, byPush.length));
        const rotatedTop = [...byPush.slice(pickOffset), ...byPush.slice(0, pickOffset)];
        const samples = formatSampleNames(rotatedTop);
        const avgM = highMarginHighStock.reduce((s, p) => s + p.profitMargin, 0) / highMarginHighStock.length;
        opportunities.push({
            type: "high_margin_push",
            icon: "💰",
            title: `${highMarginHighStock.length} yüksek marjlı ürün pazarlamaya hazır`,
            potential: round2(totalPotential),
            description: samples
                ? `Örnekler: ${samples}. Ortalama marj %${avgM.toFixed(1)} — bu kalemlerde görünürlük artırılabilir.`
                : `Ortalama marj %${avgM.toFixed(1)} — pazarlama artırarak satışları katlayın`,
            action: "Reklam bütçesini bu ürünlere yönlendirin",
            confidence: 85,
        });
    }

    // Single marketplace products = expand
    const singleMp = analyzedProducts.filter(p => p.marketplaceCount === 1 && p.stock > 0 && p.totalSold > 3);
    if (singleMp.length > 10) {
        const avgRevenue = singleMp.reduce((s, p) => s + p.totalRevenue, 0) / singleMp.length;
        const byRev = [...singleMp].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
        const off = salt % Math.max(1, Math.min(4, byRev.length));
        const samples = formatSampleNames([...byRev.slice(off), ...byRev.slice(0, off)]);
        opportunities.push({
            type: "marketplace_expansion",
            icon: "🚀",
            title: `${singleMp.length} ürün tek pazaryerinde — genişletin`,
            potential: round2(avgRevenue * singleMp.length * 0.3),
            description: samples
                ? `Öncelik adayları: ${samples}. Kanal çeşitlendirmesi ile talep artışı hedefleyin.`
                : "Bu ürünleri diğer pazaryerlerine açarak satışları %30 artırabilirsiniz",
            action: "Ürünleri diğer kanallara dağıtın",
            confidence: 72,
        });
    }

    // Trending up products = increase stock
    const trending = analyzedProducts.filter(p => {
        if (!p.dailySales || Object.keys(p.dailySales).length < 7) return false;
        const entries = Object.entries(p.dailySales).sort((a, b) => a[0].localeCompare(b[0]));
        const recent = entries.slice(-7);
        const prev = entries.slice(-14, -7);
        if (recent.length < 5 || prev.length < 3) return false;
        const recentAvg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
        const prevAvg = prev.reduce((s, [, v]) => s + v, 0) / prev.length;
        return prevAvg > 0 && recentAvg > prevAvg * 1.3;
    });
    if (trending.length > 0) {
        const byMom = [...trending].sort((a, b) => (b.avgDailySales || 0) - (a.avgDailySales || 0));
        const off = salt % Math.max(1, Math.min(4, byMom.length));
        const samples = formatSampleNames([...byMom.slice(off), ...byMom.slice(0, off)]);
        opportunities.push({
            type: "trending_products",
            icon: "📈",
            title: `${trending.length} ürün yükseliş trendinde`,
            potential: round2(trending.reduce((s, p) => s + p.profit * p.avgDailySales * 30, 0)),
            description: samples
                ? `Hızlı ivme: ${samples}. Stok ve fiyatı bu ürünler için güncel tutun.`
                : "Bu ürünlerin stokunu artırın ve fiyat optimizasyonu yapın",
            action: "Stok artırın, fiyat gözden geçirin",
            confidence: 78,
        });
    }

    // Seasonal opportunity (basic) — aynı ayda iki metin varyantı (gün/kullanıcı tuzuna bağlı)
    const month = new Date().getMonth();
    const seasonalTip = getSeasonalTip(month, seasonalVariant);
    if (seasonalTip) {
        opportunities.push({
            type: "seasonal",
            icon: "🗓️",
            title: seasonalTip.title,
            potential: 0,
            description: seasonalTip.description,
            action: seasonalTip.action,
            confidence: 65,
        });
    }

    opportunities.sort((a, b) => {
        const tieA = (hashString32(`${salt}:${a.type}`) % 400);
        const tieB = (hashString32(`${salt}:${b.type}`) % 400);
        const sa = (a.potential || 0) * 1000 + (a.confidence || 0) + tieA;
        const sb = (b.potential || 0) * 1000 + (b.confidence || 0) + tieB;
        return sb - sa;
    });
    return opportunities.slice(0, 10);
}

function getSeasonalTip(month, variant = 0) {
    const v = variant % 2;
    const tips = {
        0: [
            { title: "Ocak — Yeni yıl indirimleri", description: "Yılbaşı sonrası stok eritme dönemi", action: "Kış ürünlerinde indirim kampanyası başlatın" },
            { title: "Ocak — Sepet ortalamasını yükseltin", description: "İndirimli ürünleri çapraz satışla paketleyin", action: "2. üründe ek indirim veya ücretsiz kargo eşiği deneyin" },
        ],
        1: [
            { title: "Şubat — Sevgililer Günü yaklaşıyor", description: "Hediye kategorisinde talep artışı bekleniyor", action: "Hediye ürünlerini öne çıkarın" },
            { title: "Şubat — Hediye paketi ve hızlı kargo vurgusu", description: "Son günlük siparişlerde dönüşümü kargo ve paketleme mesajıyla artırın", action: "Ürün görsellerine 'hediye paketi' notu ekleyin" },
        ],
        2: [
            { title: "Mart — Bahar sezonu başlıyor", description: "Mevsim geçişi ürünlerinde hareketlenme", action: "Bahar koleksiyonunu hazırlayın" },
            { title: "Mart — Mevsimsel envanter değişimi", description: "Kış stoklarını eritirken bahar ürünlerini listeye alın", action: "Düşük hareketli kış kalemlerinde net indirim verin" },
        ],
        3: [
            { title: "Nisan — 23 Nisan kampanyaları", description: "Çocuk ürünlerinde talep artışı", action: "Çocuk kategorisinde kampanya planlayın" },
            { title: "Nisan — Tatil ve etkinlik alışverişi", description: "Aile ve çocuk segmentinde arama artışı", action: "Set ürün ve kampanya başlıklarını güncelleyin" },
        ],
        4: [
            { title: "Mayıs — Anneler Günü", description: "Hediye ve kişisel bakım ürünlerinde artış", action: "Anneler Günü özel kampanyası oluşturun" },
            { title: "Mayıs — Hediye rehberi ve son gönderim tarihi", description: "Teslimat süresini net gösteren ürünler daha çok satıyor", action: "Kargoya veriliş tarihini vitrinde belirtin" },
        ],
        5: [
            { title: "Haziran — Yaz sezonu", description: "Yaz ürünlerinde yoğun talep dönemi", action: "Yaz ürünlerinin stoklarını artırın" },
            { title: "Haziran — Tatil ve outdoor talebi", description: "Hafif ve hızlı sevk edilen ürünler öne çıkar", action: "Yaz ürünlerinde paket boyutunu ve iade politikasını netleştirin" },
        ],
        6: [
            { title: "Temmuz — Yaz indirimleri", description: "Sezon ortası indirim dönemi", action: "Yaz ürünlerinde agresif fiyatlama yapın" },
            { title: "Temmuz — Sezon ortası temiz stok", description: "Yavaş hareket eden yaz kalemlerinde fiyat adımı planlayın", action: "Kademeli indirim veya paket fiyatı uygulayın" },
        ],
        7: [
            { title: "Ağustos — Okul dönemi yaklaşıyor", description: "Kırtasiye ve okul ürünlerinde artış", action: "Okul ürünlerini hazırlayın" },
            { title: "Ağustos — Okul alışverişi erken kuş", description: "Liste ürünlerinde stok ve fiyat rekabeti artar", action: "Çok satan okul kalemlerinde stok uyarısı açın" },
        ],
        8: [
            { title: "Eylül — Sonbahar sezonu", description: "Mevsim geçişi ve okul dönemi", action: "Sonbahar koleksiyonunu öne çıkarın" },
            { title: "Eylül — Katmanlı giyim ve ev tekstili", description: "Geçiş mevsiminde talep geniş ürün grubuna yayılır", action: "Sonbahar anahtar kelimeleriyle başlıkları güncelleyin" },
        ],
        9: [
            { title: "Ekim — Kış hazırlığı", description: "Kış ürünlerine talep başlıyor", action: "Kış ürünlerinin stoklarını kontrol edin" },
            { title: "Ekim — Erken kış kampanyası", description: "Isıtma ve konfor ürünlerinde ilk dalga", action: "Kış ürünlerinde erken sipariş indirimi deneyin" },
        ],
        10: [
            { title: "Kasım — Black Friday / 11.11", description: "Yılın en büyük indirim dönemi", action: "Kampanya stratejinizi şimdi belirleyin" },
            { title: "Kasım — Kampanya takvimi ve stok tavanı", description: "Yoğun trafikte stoksuz kalma riski yüksek", action: "Kritik SKUlarda güvenlik stoğu ve yedek tedarik planı yapın" },
        ],
        11: [
            { title: "Aralık — Yılbaşı sezonu", description: "Hediye alışverişi zirve dönemi", action: "Hediye paketleri ve kampanyalar hazırlayın" },
            { title: "Aralık — Son teslimat günleri", description: "Kargo cutoff tarihleri dönüşümü belirler", action: "Ürün sayfalarında son kargoya veriliş tarihini vurgulayın" },
        ],
    };
    const pair = tips[month];
    if (!pair) return null;
    return pair[v] || pair[0];
}

// ═════════════════════════════════════════════════════════════════════════════
// #37 CAUSE ENGINE + #38 CHAIN REASONING
// ═════════════════════════════════════════════════════════════════════════════

function analyzeCauses(analyzedProducts, data) {
    const causes = [];

    // Sales drop causes
    const droppingProducts = analyzedProducts.filter(p => {
        if (!p.dailySales || Object.keys(p.dailySales).length < 10) return false;
        const entries = Object.entries(p.dailySales).sort((a, b) => a[0].localeCompare(b[0]));
        const recent = entries.slice(-3);
        const prev = entries.slice(-10, -3);
        if (recent.length < 2 || prev.length < 3) return false;
        const recentAvg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
        const prevAvg = prev.reduce((s, [, v]) => s + v, 0) / prev.length;
        return prevAvg > 1 && recentAvg < prevAvg * 0.5;
    });

    for (const p of droppingProducts.slice(0, 5)) {
        const chain = [];
        const rootCauses = [];

        // Analyze possible causes
        if (p.stock < 5 && p.stock > 0) {
            rootCauses.push("Düşük stok seviyesi");
            chain.push({ event: "Stok azaldı", effect: "Pazaryeri listede geri düştü", time: "Son 7 gün" });
            chain.push({ event: "Görünürlük azaldı", effect: "Satışlar düştü", time: "Son 3 gün" });
        }
        if (p.profitMargin < 5 && p.costPrice > 0) {
            rootCauses.push("Düşük kâr marjı — fiyat rekabeti");
            chain.push({ event: "Fiyat baskısı", effect: "Marj düştü", time: "Son 14 gün" });
        }
        if (p.daysSinceLastSale > 14) {
            rootCauses.push("Uzun süredir satış yok — talep düşüşü");
            chain.push({ event: "Talep azaldı", effect: "Satış durdu", time: `${p.daysSinceLastSale} gün` });
        }
        if (rootCauses.length === 0) {
            rootCauses.push("Pazar koşulları veya rekabet değişimi");
        }

        causes.push({
            product: p.name,
            barcode: p.barcode,
            issue: "Satış düşüşü",
            rootCauses,
            chain,
            recommendation: rootCauses[0].includes("stok") ? "Stok artırın" : rootCauses[0].includes("fiyat") ? "Fiyat stratejisini gözden geçirin" : "Ürünü analiz edin",
        });
    }

    // Stock depletion causes
    const depletedProducts = analyzedProducts.filter(p => p.stock === 0 && p.totalSold > 5);
    for (const p of depletedProducts.slice(0, 3)) {
        causes.push({
            product: p.name,
            barcode: p.barcode,
            issue: "Stok tükenmesi",
            rootCauses: [
                p.avgDailySales > 2 ? "Yüksek satış hızı — tedarik yetersiz" : "Tedarik planlaması eksik",
                "Stok takip sistemi uyarı vermedi",
            ],
            chain: [
                { event: "Stok azaldı", effect: "Uyarı verilmedi", time: "Geçmiş" },
                { event: "Stok sıfırlandı", effect: "Satış durdu", time: "Şimdi" },
                { event: "Satış kaybı", effect: `Günlük ~${(p.avgDailySales * p.price).toFixed(0)}₺ kayıp`, time: "Devam ediyor" },
            ],
            recommendation: "Otomatik stok uyarısı kurun ve tedarik planlayın",
        });
    }

    return causes.slice(0, 10);
}

// ═════════════════════════════════════════════════════════════════════════════
// #33 SEGMENTATION ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function segmentProducts(analyzedProducts) {
    const segments = {
        stars: [],       // High sales + High margin
        cashCows: [],    // Steady sales + Good margin
        questionMarks: [],// Low sales + High margin (potential)
        dogs: [],        // Low sales + Low margin
        newProducts: [], // Recently added, no data yet
    };

    for (const p of analyzedProducts) {
        const hasSales = p.totalSold > 0;
        const highSales = p.avgDailySales > 1;
        const goodMargin = p.profitMargin > 15;
        const hasData = p.costPrice > 0;

        if (!hasSales && p.isNewProduct) {
            segments.newProducts.push(p);
        } else if (highSales && goodMargin) {
            segments.stars.push(p);
        } else if (hasSales && p.avgDailySales > 0.3 && p.profitMargin > 5) {
            segments.cashCows.push(p);
        } else if (!highSales && goodMargin && p.stock > 0) {
            segments.questionMarks.push(p);
        } else {
            segments.dogs.push(p);
        }
    }

    const mapSegment = (arr) => arr.slice(0, 15).map(p => ({
        name: p.name, barcode: p.barcode, category: p.category,
        price: p.price, stock: p.stock, profitMargin: p.profitMargin,
        totalSold: p.totalSold, avgDailySales: p.avgDailySales,
        healthScore: p.healthScore, revenue: p.totalRevenue,
    }));

    return {
        stars: { count: segments.stars.length, products: mapSegment(segments.stars), strategy: "Stok artırın, fiyatı koruyun, pazarlamayı artırın" },
        cashCows: { count: segments.cashCows.length, products: mapSegment(segments.cashCows), strategy: "Mevcut durumu koruyun, marjı optimize edin" },
        questionMarks: { count: segments.questionMarks.length, products: mapSegment(segments.questionMarks), strategy: "Pazarlama ile satışları artırın veya fiyat indirin" },
        dogs: { count: segments.dogs.length, products: mapSegment(segments.dogs), strategy: "Agresif indirim yapın, kampanya/vitrine ekleyin, set oluşturun, reklam verin — satış stratejisi uygulayın" },
        newProducts: { count: segments.newProducts.length, products: mapSegment(segments.newProducts), strategy: "Veri toplanmasını bekleyin, ilk satışları takip edin" },
        summary: {
            total: analyzedProducts.length,
            starsPercent: round2((segments.stars.length / (analyzedProducts.length || 1)) * 100),
            dogsPercent: round2((segments.dogs.length / (analyzedProducts.length || 1)) * 100),
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #34 DECISION HISTORY
// ═════════════════════════════════════════════════════════════════════════════

async function getDecisionHistory(userId) {
    const [all, executed, approved, rejected, pending, expired] = await Promise.all([
        Recommendation.countDocuments({ userId }),
        Recommendation.find({ userId, status: "executed" }).sort({ executedAt: -1 }).limit(20).lean(),
        Recommendation.find({ userId, status: "approved" }).sort({ updatedAt: -1 }).limit(10).lean(),
        Recommendation.find({ userId, status: "rejected" }).sort({ updatedAt: -1 }).limit(10).lean(),
        Recommendation.countDocuments({ userId, status: "pending" }),
        Recommendation.countDocuments({ userId, status: "expired" }),
    ]);

    const successfulExecutions = executed.filter(r => r.executionResult?.success);
    const failedExecutions = executed.filter(r => !r.executionResult?.success);
    const totalProfitFromActions = successfulExecutions.reduce((s, r) => s + (r.impact?.profitChange || 0), 0);

    return {
        totalDecisions: all,
        pending,
        expired,
        executed: executed.length,
        successRate: executed.length > 0 ? round2((successfulExecutions.length / executed.length) * 100) : 0,
        totalProfitFromActions: round2(totalProfitFromActions),
        recentExecuted: executed.slice(0, 10).map(r => ({
            id: r._id, type: r.type, title: r.title,
            executedAt: r.executedAt, success: r.executionResult?.success,
            message: r.executionResult?.message,
            profitChange: r.impact?.profitChange || 0,
        })),
        recentRejected: rejected.slice(0, 5).map(r => ({
            id: r._id, type: r.type, title: r.title,
            rejectedAt: r.updatedAt,
        })),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #48 CONTEXT-AWARE AI
// ═════════════════════════════════════════════════════════════════════════════

function getContextAwareness() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const month = now.getMonth();
    const date = now.getDate();

    // Time context
    const timeOfDay = hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const isWeekend = day === 0 || day === 6;
    const isBusinessHours = hour >= 9 && hour <= 18 && !isWeekend;

    // Season
    const season = month < 3 ? "winter" : month < 6 ? "spring" : month < 9 ? "summer" : "fall";

    // Special dates (Turkish e-commerce)
    const specialDates = [];
    if (month === 10 && date >= 20) specialDates.push("Black Friday yaklaşıyor");
    if (month === 10 && date === 11) specialDates.push("11.11 İndirim Günü");
    if (month === 11 && date >= 20) specialDates.push("Yılbaşı alışveriş sezonu");
    if (month === 4 && date >= 1 && date <= 14) specialDates.push("Anneler Günü yaklaşıyor");
    if (month === 5 && date >= 1 && date <= 21) specialDates.push("Babalar Günü yaklaşıyor");
    if (month === 1 && date >= 7 && date <= 14) specialDates.push("Sevgililer Günü yaklaşıyor");

    // Seasonal tip
    const seasonalTip = getSeasonalTip(month);

    return {
        timeOfDay,
        isWeekend,
        isBusinessHours,
        season,
        month: month + 1,
        dayOfWeek: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][day],
        specialDates,
        seasonalTip,
        greeting: timeOfDay === "morning" ? "Günaydın" : timeOfDay === "afternoon" ? "İyi günler" : timeOfDay === "evening" ? "İyi akşamlar" : "İyi geceler",
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #49 EMOTIONAL UX AI
// ═════════════════════════════════════════════════════════════════════════════

function getEmotionalTone(businessHealth, focusItems) {
    const score = businessHealth.overallScore;
    const criticalCount = focusItems.filter(f => f.urgency === "critical").length;

    if (score >= 80 && criticalCount === 0) {
        return {
            tone: "positive",
            emoji: "🎉",
            message: "İşler harika gidiyor! Büyüme fırsatlarına odaklanın.",
            motivation: "Bu performansı sürdürün — AI sizin için fırsatları takip ediyor.",
            color: "#22c55e",
        };
    } else if (score >= 60) {
        return {
            tone: "encouraging",
            emoji: "💪",
            message: "İyi gidiyorsunuz! Birkaç iyileştirme ile mükemmele ulaşabilirsiniz.",
            motivation: "Aşağıdaki önerileri uygulayarak skorunuzu yükseltin.",
            color: "#3b82f6",
        };
    } else if (score >= 40) {
        return {
            tone: "cautious",
            emoji: "⚠️",
            message: "Dikkat edilmesi gereken noktalar var. Önceliklere odaklanın.",
            motivation: "Adım adım ilerleyin — en kritik sorunlardan başlayın.",
            color: "#f59e0b",
        };
    } else {
        return {
            tone: "urgent",
            emoji: "🚨",
            message: "Acil müdahale gerektiren sorunlar var!",
            motivation: "Panik yapmayın — AI size tam olarak ne yapmanız gerektiğini söylüyor.",
            color: "#ef4444",
        };
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// #46 TEACHING AI
// ═════════════════════════════════════════════════════════════════════════════

function generateTeachingTips(analyzedProducts, data, businessHealth) {
    const tips = [];
    const { hasOrderData } = data;

    const noCost = analyzedProducts.filter(p => p.costPrice === 0).length;
    if (noCost > analyzedProducts.length * 0.3) {
        tips.push({
            icon: "📚",
            title: "Maliyet Bilgisi Neden Önemli?",
            content: "Ürün maliyetlerini girdiğinizde AI gerçek kâr marjınızı hesaplayabilir, zarar eden ürünleri tespit edebilir ve doğru fiyat önerileri sunabilir.",
            action: "Ürün Merkezi → Maliyet Bilgileri bölümünden maliyetleri girin",
            category: "data_quality",
        });
    }

    if (!hasOrderData) {
        tips.push({
            icon: "📦",
            title: "Sipariş Verisi Neden Gerekli?",
            content: "Siparişler DB'ye kaydedildiğinde AI satış trendlerini, en iyi saatleri, ürün performansını ve tahminleri hesaplayabilir.",
            action: "Pazaryeri entegrasyonlarınızı kontrol edin — siparişler otomatik çekilecek",
            category: "integration",
        });
    }

    if (businessHealth.stockHealth < 50) {
        tips.push({
            icon: "📊",
            title: "Stok Yönetimi İpuçları",
            content: "Düşük stok, pazaryerlerinde ürün sıralamanızı düşürür. AI'ın stok uyarılarını takip ederek satış kaybını önleyin.",
            action: "Stok uyarı eşiklerini ayarlayın ve tedarik süreçlerinizi planlayın",
            category: "stock",
        });
    }

    if (businessHealth.profitHealth < 50) {
        tips.push({
            icon: "💡",
            title: "Kârlılık Nasıl Artırılır?",
            content: "Düşük marjlı ürünlerde fiyat artışı, yüksek marjlı ürünlerde pazarlama artışı yapın. AI her ürün için özel öneriler sunar.",
            action: "AI Öneriler sekmesinden fiyat optimizasyonu önerilerini inceleyin",
            category: "pricing",
        });
    }

    tips.push({
        icon: "🤖",
        title: "AI Önerilerini Nasıl Kullanmalısınız?",
        content: "AI önerileri onayladığınızda veya reddettiğinizde, sistem tercihlerinizi öğrenir ve gelecekte daha kişiselleştirilmiş öneriler sunar.",
        action: "Önerileri düzenli olarak inceleyin — onaylayın veya reddedin",
        category: "ai_usage",
    });

    return tips.slice(0, 5);
}

// ═════════════════════════════════════════════════════════════════════════════
// #42 EXPLAINABLE AI
// ═════════════════════════════════════════════════════════════════════════════

function explainDecision(recommendation) {
    const explanations = [];
    const { type, actionPayload, impact, confidenceScore, title, description: recDesc } = recommendation;
    const profitCh = Number(impact?.profitChange);
    const pc = Number.isFinite(profitCh) ? profitCh : 0;
    const profitStr = `${pc >= 0 ? "+" : ""}${pc.toFixed(0)}₺`;

    explanations.push({
        step: 1,
        title: "Veri Analizi",
        description: `${actionPayload?.targetName || "Ürün"} için sipariş, stok, fiyat ve marj verileri bir arada değerlendirildi.${title ? ` Özet: ${title}` : ""}`,
    });

    switch (type) {
        case "price_optimization":
        case "loss_detection":
            explanations.push({
                step: 2,
                title: "Sorun Tespiti",
                description: `Kâr marjı düşük veya negatif tespit edildi. Mevcut fiyat maliyeti karşılamıyor olabilir.`,
            });
            explanations.push({
                step: 3,
                title: "Çözüm Hesaplama",
                description: `Önerilen fiyat: ${actionPayload?.params?.oldPrice ?? "—"}₺ → ${actionPayload?.params?.newPrice ?? "—"}₺ (marj iyileştirmesi).`,
            });
            break;
        case "inventory_pressure":
            explanations.push({
                step: 2,
                title: "Stok & Devir",
                description: "Yüksek stok ve yavaş devir tespit edildi; indirimle devir hızlandırması önerilir.",
            });
            break;
        case "dynamic_pricing":
            explanations.push({
                step: 2,
                title: "Dinamik Fiyat",
                description: "Talep, rekabet ve maliyet sinyallerine göre fiyat ayarı önerildi.",
            });
            explanations.push({
                step: 3,
                title: "Önerilen Seviye",
                description: `Hedef fiyat: ${actionPayload?.params?.newPrice ?? "—"}₺ (önceki: ${actionPayload?.params?.oldPrice ?? "—"}₺).`,
            });
            break;
        case "stock_optimization":
        case "smart_restock":
            explanations.push({
                step: 2,
                title: "Stok Analizi",
                description: `Mevcut stok ${actionPayload?.params?.currentStock ?? 0} adet. Günlük satış hızına göre yaklaşık ${actionPayload?.params?.daysOfStock ?? 0} gün yeter.`,
            });
            explanations.push({
                step: 3,
                title: "Tedarik Hesaplama",
                description: `Önerilen tedarik: ${actionPayload?.params?.restockQuantity ?? 0} adet (tahmine dayalı).`,
            });
            break;
        case "dead_product":
        case "trend_detection":
        case "anomaly_detection":
            explanations.push({
                step: 2,
                title: "Performans Sinyali",
                description: recDesc || "Satış hızı veya görünürlükte anormallik / durgunluk tespit edildi.",
            });
            break;
        case "tax_warning":
            explanations.push({
                step: 2,
                title: "Maliyet / Vergi",
                description: "KDV veya maliyet varsayımları satış fiyatı ile uyumsuz olabilir; marj kontrolü önerilir.",
            });
            break;
        default:
            explanations.push({
                step: 2,
                title: "Analiz",
                description: recDesc || "Ürün performansı, stok durumu ve pazar koşulları değerlendirildi.",
            });
    }

    explanations.push({
        step: explanations.length + 1,
        title: "Etki Tahmini",
        description: `Tahmini kâr etkisi: ${profitStr} | Güven: %${confidenceScore ?? 0}`,
    });

    return explanations;
}

// ═════════════════════════════════════════════════════════════════════════════
// #12 PREDICTIVE ENGINE (Enhanced v2)
// ═════════════════════════════════════════════════════════════════════════════

function generatePredictions(analyzedProducts, data) {
    const predictions = [];
    const { orders7, orders30, ordersToday, ordersYesterday, hasOrderData } = data;

    if (!hasOrderData) return { predictions: [], summary: {}, trendData: {}, message: "Tahmin için sipariş verisi gerekli" };

    // ── 1. Stock depletion predictions ──
    const depletingSoon = analyzedProducts
        .filter(p => p.stock > 0 && p.daysOfStock < 14 && p.avgDailySales > 0.3)
        .sort((a, b) => a.daysOfStock - b.daysOfStock);

    for (const p of depletingSoon.slice(0, 10)) {
        const depletionDate = new Date(Date.now() + p.daysOfStock * dayMs);
        predictions.push({
            type: "stock_depletion",
            icon: "📦",
            severity: p.daysOfStock < 3 ? "critical" : p.daysOfStock < 7 ? "high" : "medium",
            product: p.name,
            barcode: p.barcode,
            prediction: `${p.daysOfStock} gün içinde tükenecek`,
            detail: `Günlük satış: ${p.avgDailySales.toFixed(1)} adet | Mevcut stok: ${p.stock}`,
            date: depletionDate.toISOString().slice(0, 10),
            confidence: clamp(Math.round(70 + p.avgDailySales * 5), 50, 95),
            impact: `−${(p.profit * p.avgDailySales * 30).toFixed(0)}₺/ay kayıp riski`,
            action: `${Math.ceil(p.avgDailySales * 30)} adet tedarik edin`,
            financialImpact: round2(p.profit * p.avgDailySales * 30),
        });
    }

    // ── 2. Revenue forecast (weekly + monthly) ──
    const weekRevenue = orders7.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const monthRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const yesterdayRevenue = ordersYesterday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const weeklyAvg = weekRevenue / 7;
    const monthlyAvg = monthRevenue / 30;

    if (monthlyAvg > 0) {
        const trend = ((weeklyAvg - monthlyAvg) / monthlyAvg) * 100;
        const nextWeekEstimate = weeklyAvg * 7 * (1 + trend / 200);
        const nextMonthEstimate = monthlyAvg * 30 * (1 + trend / 300);
        predictions.push({
            type: "revenue_forecast",
            icon: trend > 0 ? "📈" : "📉",
            severity: Math.abs(trend) > 20 ? "high" : "medium",
            prediction: `Gelecek hafta tahmini ciro: ${nextWeekEstimate.toFixed(0)}₺`,
            detail: `Haftalık ort: ${weeklyAvg.toFixed(0)}₺/gün | Aylık ort: ${monthlyAvg.toFixed(0)}₺/gün | Trend: ${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`,
            trend: round2(trend),
            direction: trend > 0 ? "up" : "down",
            confidence: clamp(Math.round(55 + Math.min(orders30.length, 30)), 40, 85),
            impact: trend > 0 ? `+%${trend.toFixed(1)} büyüme` : `%${trend.toFixed(1)} düşüş`,
            financialImpact: round2(nextWeekEstimate - weekRevenue),
            nextMonthEstimate: round2(nextMonthEstimate),
        });
    }

    // ── 3. Margin erosion detection ──
    const productsWithCost = analyzedProducts.filter(p => p.costPrice > 0 && p.totalSold > 3);
    const lowMarginTrending = productsWithCost.filter(p => p.profitMargin > 0 && p.profitMargin < 8 && p.avgDailySales > 0.5);
    if (lowMarginTrending.length > 0) {
        const totalAtRisk = lowMarginTrending.reduce((s, p) => s + p.price * p.avgDailySales * 30, 0);
        predictions.push({
            type: "margin_erosion",
            icon: "💸",
            severity: lowMarginTrending.length > 5 ? "high" : "medium",
            prediction: `${lowMarginTrending.length} ürünün marjı tehlikeli seviyede düşük`,
            detail: `Ortalama marj: %${(lowMarginTrending.reduce((s, p) => s + p.profitMargin, 0) / lowMarginTrending.length).toFixed(1)} | Aylık ciro riski: ${totalAtRisk.toFixed(0)}₺`,
            confidence: 80,
            impact: `${totalAtRisk.toFixed(0)}₺ aylık ciro risk altında`,
            action: "Fiyatları %5-10 artırın veya maliyetleri düşürün",
            financialImpact: round2(-totalAtRisk * 0.05),
            products: lowMarginTrending.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, margin: round2(p.profitMargin), dailySales: round2(p.avgDailySales) })),
        });
    }

    // ── 4. Seasonal demand prediction ──
    const month = new Date().getMonth();
    const seasonalPredictions = [];
    if (month === 10) seasonalPredictions.push({ event: "Black Friday / 11.11", daysAway: Math.max(0, 25 - new Date().getDate()), impact: "+%40-80 satış artışı bekleniyor" });
    if (month === 11) seasonalPredictions.push({ event: "Yılbaşı Sezonu", daysAway: Math.max(0, 31 - new Date().getDate()), impact: "+%30-60 hediye kategorisinde artış" });
    if (month === 4) seasonalPredictions.push({ event: "Anneler Günü", daysAway: Math.max(0, 14 - new Date().getDate()), impact: "+%25 kişisel bakım/hediye artışı" });
    if (month === 7 || month === 8) seasonalPredictions.push({ event: "Okula Dönüş", daysAway: month === 7 ? 30 : 15, impact: "+%35 kırtasiye/okul ürünleri artışı" });
    for (const sp of seasonalPredictions) {
        predictions.push({
            type: "seasonal_demand",
            icon: "🗓️",
            severity: sp.daysAway < 14 ? "high" : "medium",
            prediction: `${sp.event} — ${sp.daysAway} gün kaldı`,
            detail: sp.impact,
            confidence: 70,
            impact: sp.impact,
            action: "Stokları artırın ve kampanya hazırlayın",
            financialImpact: 0,
        });
    }

    // ── 5. Product lifecycle predictions ──
    const risingStars = analyzedProducts.filter(p => {
        if (!p.dailySales || Object.keys(p.dailySales).length < 7) return false;
        const entries = Object.entries(p.dailySales).sort((a, b) => a[0].localeCompare(b[0]));
        const recent = entries.slice(-7);
        const prev = entries.slice(-14, -7);
        if (recent.length < 5 || prev.length < 3) return false;
        const recentAvg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
        const prevAvg = prev.reduce((s, [, v]) => s + v, 0) / prev.length;
        return prevAvg > 0 && recentAvg > prevAvg * 1.3;
    });
    if (risingStars.length > 0) {
        predictions.push({
            type: "rising_products",
            icon: "🚀",
            severity: "info",
            prediction: `${risingStars.length} ürün yükseliş trendinde`,
            detail: `Bu ürünlerin satışları son 7 günde %30+ arttı`,
            confidence: 75,
            impact: `+${risingStars.reduce((s, p) => s + p.profit * p.avgDailySales * 30, 0).toFixed(0)}₺/ay potansiyel`,
            action: "Stok artırın ve pazarlamayı güçlendirin",
            financialImpact: round2(risingStars.reduce((s, p) => s + p.profit * p.avgDailySales * 30, 0)),
            products: risingStars.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, dailySales: round2(p.avgDailySales), stock: p.stock })),
        });
    }

    // ── 6. Declining products ──
    const declining = analyzedProducts.filter(p => {
        if (!p.dailySales || Object.keys(p.dailySales).length < 10) return false;
        const entries = Object.entries(p.dailySales).sort((a, b) => a[0].localeCompare(b[0]));
        const recent = entries.slice(-5);
        const prev = entries.slice(-12, -5);
        if (recent.length < 3 || prev.length < 3) return false;
        const recentAvg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
        const prevAvg = prev.reduce((s, [, v]) => s + v, 0) / prev.length;
        return prevAvg > 0.5 && recentAvg < prevAvg * 0.5;
    });
    if (declining.length > 0) {
        predictions.push({
            type: "declining_products",
            icon: "📉",
            severity: "high",
            prediction: `${declining.length} ürünün satışları düşüyor`,
            detail: `Bu ürünlerin satışları son dönemde %50+ azaldı`,
            confidence: 72,
            impact: `−${declining.reduce((s, p) => s + p.profit * p.avgDailySales * 15, 0).toFixed(0)}₺ kayıp riski`,
            action: "Fiyat indirimi veya kampanya düşünün",
            financialImpact: round2(-declining.reduce((s, p) => s + p.profit * p.avgDailySales * 15, 0)),
            products: declining.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, dailySales: round2(p.avgDailySales), daysSinceLastSale: p.daysSinceLastSale })),
        });
    }

    // ── 7. Cost data missing warning ──
    const noCost = analyzedProducts.filter(p => p.costPrice === 0);
    if (noCost.length > analyzedProducts.length * 0.3 && analyzedProducts.length > 0) {
        predictions.push({
            type: "data_quality",
            icon: "📝",
            severity: "medium",
            prediction: `${noCost.length} üründe maliyet bilgisi eksik — tahmin doğruluğu düşük`,
            detail: `Maliyet bilgisi girildiğinde AI kâr tahminleri %40 daha doğru olur`,
            confidence: 95,
            impact: "AI doğruluğu düşük",
            action: "Ürün Merkezi → Ürünlerim → Maliyet Bilgileri bölümünden girin",
            financialImpact: 0,
        });
    }

    // ── Summary stats ──
    const summary = {
        totalPredictions: predictions.length,
        criticalCount: predictions.filter(p => p.severity === "critical").length,
        highCount: predictions.filter(p => p.severity === "high").length,
        totalFinancialImpact: round2(predictions.reduce((s, p) => s + (p.financialImpact || 0), 0)),
        stockAtRisk: depletingSoon.length,
        revenueDirection: weeklyAvg >= monthlyAvg ? "up" : "down",
        revenueTrend: monthlyAvg > 0 ? round2(((weeklyAvg - monthlyAvg) / monthlyAvg) * 100) : 0,
    };

    // ── Trend data for charts ──
    const dailyRevenues = {};
    for (const o of orders30) {
        const dk = new Date(o.orderDate).toISOString().slice(0, 10);
        dailyRevenues[dk] = (dailyRevenues[dk] || 0) + (o.totalPrice || 0);
    }
    const trendData = {
        dailyRevenues: Object.entries(dailyRevenues).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([date, revenue]) => ({ date: date.slice(5), revenue: round2(revenue) })),
        todayRevenue: round2(todayRevenue),
        yesterdayRevenue: round2(yesterdayRevenue),
        weekRevenue: round2(weekRevenue),
        monthRevenue: round2(monthRevenue),
        avgDailyRevenue: round2(monthlyAvg),
        avgOrderValue: orders30.length > 0 ? round2(monthRevenue / orders30.length) : 0,
        totalOrders30: orders30.length,
        totalOrdersToday: ordersToday.length,
    };

    return {
        predictions,
        summary,
        trendData,
        message: predictions.length > 0 ? `${predictions.length} tahmin oluşturuldu` : "Yeterli veri toplandığında tahminler oluşacak",
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #29 DAILY AI JOURNAL
// ═════════════════════════════════════════════════════════════════════════════

function generateDailyJournal(analyzedProducts, data, businessHealth, lossHunter, focusItems) {
    const { ordersToday, ordersYesterday, orders30, hasOrderData } = data;
    const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const yesterdayRevenue = ordersYesterday.reduce((s, o) => s + (o.totalPrice || 0), 0);

    const problems = focusItems.filter(f => f.urgency === "critical" || f.urgency === "high").slice(0, 3);
    const opportunities = [];
    const actions = [];

    // Opportunities
    const highMargin = analyzedProducts.filter(p => p.profitMargin > 20 && p.stock > 10 && p.costPrice > 0);
    if (highMargin.length > 0) opportunities.push({ icon: "💰", text: `${highMargin.length} yüksek marjlı ürün pazarlamaya hazır` });

    if (hasOrderData && todayRevenue > yesterdayRevenue * 1.2 && todayRevenue > 0) {
        opportunities.push({ icon: "📈", text: `Bugün satışlar dünden %${((todayRevenue - yesterdayRevenue) / (yesterdayRevenue || 1) * 100).toFixed(0)} yüksek` });
    }

    const trending = analyzedProducts.filter(p => p.velocity > p.avgDailySales * 1.3 && p.totalSold > 5);
    if (trending.length > 0) opportunities.push({ icon: "🔥", text: `${trending.length} ürün yükseliş trendinde` });

    if (opportunities.length < 3) opportunities.push({ icon: "🚀", text: "Yeni pazaryeri kanalları açarak satışları artırın" });

    // Actions
    const outOfStock = analyzedProducts.filter(p => p.stock === 0 && p.avgDailySales > 0.3);
    if (outOfStock.length > 0) actions.push({ icon: "📦", text: `${outOfStock[0].name.slice(0, 35)} için acil stok tedarik edin`, impact: "high" });

    const lossProds = analyzedProducts.filter(p => p.profit < 0 && p.totalSold > 0 && p.costPrice > 0);
    if (lossProds.length > 0) actions.push({ icon: "💰", text: `${lossProds[0].name.slice(0, 35)} fiyatını güncelleyin`, impact: "high" });

    const lowStock = analyzedProducts.filter(p => p.daysOfStock < 5 && p.daysOfStock > 0 && p.avgDailySales > 0.3);
    if (lowStock.length > 0) actions.push({ icon: "⚠️", text: `${lowStock.length} düşük stoklu ürün için tedarik planlayın`, impact: "medium" });

    if (actions.length < 3) actions.push({ icon: "📊", text: "Ürün fiyatlarını ve marjları gözden geçirin", impact: "medium" });

    return {
        date: new Date().toISOString().slice(0, 10),
        healthScore: businessHealth.overallScore,
        todayRevenue: round2(todayRevenue),
        todayOrders: ordersToday.length,
        problems: problems.slice(0, 3).map(p => ({ icon: p.icon, text: p.title + " — " + p.description })),
        opportunities: opportunities.slice(0, 3),
        actions: actions.slice(0, 3),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #45 SELF-EVALUATION AI
// ═════════════════════════════════════════════════════════════════════════════

async function selfEvaluate(userId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * dayMs);
    const [totalRecs, executed, approved, rejected] = await Promise.all([
        Recommendation.countDocuments({ userId, createdAt: { $gte: thirtyDaysAgo } }),
        Recommendation.find({ userId, status: "executed", createdAt: { $gte: thirtyDaysAgo } }).lean(),
        Recommendation.countDocuments({ userId, status: "approved", createdAt: { $gte: thirtyDaysAgo } }),
        Recommendation.countDocuments({ userId, status: "rejected", createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    const successfulExec = executed.filter(r => r.executionResult?.success);
    const totalProfit = successfulExec.reduce((s, r) => s + (r.impact?.profitChange || 0), 0);
    const acceptanceRate = (approved + executed.length) > 0 && totalRecs > 0
        ? round2(((approved + executed.length) / totalRecs) * 100) : 0;

    let aiPerformanceScore = 50;
    if (acceptanceRate > 70) aiPerformanceScore += 20;
    else if (acceptanceRate > 40) aiPerformanceScore += 10;
    if (successfulExec.length > 5) aiPerformanceScore += 15;
    else if (successfulExec.length > 0) aiPerformanceScore += 5;
    if (totalProfit > 1000) aiPerformanceScore += 15;
    else if (totalProfit > 0) aiPerformanceScore += 5;
    aiPerformanceScore = clamp(aiPerformanceScore, 0, 100);

    return {
        aiPerformanceScore,
        totalRecommendations: totalRecs,
        executed: executed.length,
        successfulExecutions: successfulExec.length,
        acceptanceRate,
        totalProfitGenerated: round2(totalProfit),
        evaluation: aiPerformanceScore >= 80 ? "AI önerileri yüksek oranda kabul ediliyor ve kâr sağlıyor"
            : aiPerformanceScore >= 60 ? "AI iyi performans gösteriyor — daha fazla öneri onaylayarak iyileştirin"
            : aiPerformanceScore >= 40 ? "AI öğrenmeye devam ediyor — önerileri inceleyerek AI'ı eğitin"
            : "Daha fazla veri ve etkileşim gerekli — önerileri onaylayın veya reddedin",
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #13 RISK ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function assessRisks(analyzedProducts, data, businessHealth) {
    const risks = [];
    const { hasOrderData } = data;

    // Stock risk
    const outOfStock = analyzedProducts.filter(p => p.stock === 0 && p.avgDailySales > 0);
    if (outOfStock.length > 0) {
        const dailyLoss = outOfStock.reduce((s, p) => s + p.price * p.avgDailySales, 0);
        risks.push({
            type: "stock_depletion",
            level: outOfStock.length > 5 ? "high" : "medium",
            icon: "📦",
            title: `${outOfStock.length} ürün stokta yok`,
            impact: `Günlük ~${dailyLoss.toFixed(0)}₺ kayıp`,
            monthlyImpact: round2(dailyLoss * 30),
            probability: 100,
            mitigation: "Acil tedarik başlatın",
            affectedProducts: outOfStock.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, dailySales: round2(p.avgDailySales) })),
        });
    }

    // Profit risk
    const lossProducts = analyzedProducts.filter(p => p.profit < 0 && p.totalSold > 0 && p.costPrice > 0);
    if (lossProducts.length > 0) {
        const totalLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);
        risks.push({
            type: "negative_profit",
            level: "high",
            icon: "🔴",
            title: `${lossProducts.length} ürün zararda`,
            impact: `Toplam ${totalLoss.toFixed(0)}₺ kayıp`,
            monthlyImpact: round2(totalLoss),
            probability: 100,
            mitigation: "Fiyatları hemen güncelleyin",
            affectedProducts: lossProducts.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, profit: round2(p.profit), margin: round2(p.profitMargin) })),
        });
    }

    // Low stock risk (about to deplete)
    const criticalStock = analyzedProducts.filter(p => p.stock > 0 && p.daysOfStock < 5 && p.avgDailySales > 0.3);
    if (criticalStock.length > 0) {
        const potentialLoss = criticalStock.reduce((s, p) => s + p.profit * p.avgDailySales * 30, 0);
        risks.push({
            type: "low_stock_critical",
            level: criticalStock.length > 3 ? "high" : "medium",
            icon: "⚠️",
            title: `${criticalStock.length} ürün 5 gün içinde tükenecek`,
            impact: `${potentialLoss.toFixed(0)}₺/ay kayıp riski`,
            monthlyImpact: round2(potentialLoss),
            probability: 85,
            mitigation: "Acil stok siparişi verin",
            affectedProducts: criticalStock.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, stock: p.stock, daysLeft: p.daysOfStock })),
        });
    }

    // Concentration risk
    const marketplaces = [...new Set(analyzedProducts.flatMap(p => p.marketplaces || []))];
    if (marketplaces.length === 1) {
        risks.push({
            type: "channel_concentration",
            level: "medium",
            icon: "🏪",
            title: "Tek kanal riski",
            impact: "Tüm satışlar tek pazaryerine bağımlı",
            monthlyImpact: 0,
            probability: 30,
            mitigation: "Ürünleri diğer pazaryerlerine de açın",
        });
    }

    // Sales decline risk
    if (businessHealth.trend.direction === "down" && businessHealth.trend.revenueChange < -20) {
        risks.push({
            type: "sales_decline",
            level: "high",
            icon: "📉",
            title: "Satışlarda ciddi düşüş",
            impact: `%${Math.abs(businessHealth.trend.revenueChange).toFixed(0)} düşüş`,
            monthlyImpact: round2(businessHealth.metrics.monthRevenue * Math.abs(businessHealth.trend.revenueChange) / 100),
            probability: 75,
            mitigation: "Kampanya başlatın veya fiyatları gözden geçirin",
        });
    }

    // Dead stock risk
    const deadProducts = analyzedProducts.filter(p => p.daysSinceLastSale > 60 && p.stock > 5);
    if (deadProducts.length > 0) {
        const deadValue = deadProducts.reduce((s, p) => s + p.price * p.stock, 0);
        risks.push({
            type: "dead_stock",
            level: deadProducts.length > 10 ? "high" : "medium",
            icon: "💀",
            title: `${deadProducts.length} satış bekleyen ürün — ${deadValue.toFixed(0)}₺ bağlı sermaye`,
            impact: `${deadValue.toFixed(0)}₺ sermaye riski`,
            monthlyImpact: round2(deadValue),
            probability: 90,
            mitigation: "Agresif indirim kampanyası başlatın, ürünleri vitrine/kampanya sayfasına ekleyin, set/kombin oluşturun",
            affectedProducts: deadProducts.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, stock: p.stock, daysSinceLastSale: p.daysSinceLastSale })),
        });
    }

    // Return rate risk
    const highReturnProducts = analyzedProducts.filter(p => p.returnRate > 10 && p.totalSold > 5);
    if (highReturnProducts.length > 0) {
        const returnLoss = highReturnProducts.reduce((s, p) => s + p.price * p.totalSold * (p.returnRate / 100), 0);
        risks.push({
            type: "high_returns",
            level: highReturnProducts.length > 3 ? "high" : "medium",
            icon: "↩️",
            title: `${highReturnProducts.length} ürünün iade oranı yüksek`,
            impact: `Tahmini ${returnLoss.toFixed(0)}₺ iade kaybı`,
            monthlyImpact: round2(returnLoss),
            probability: 70,
            mitigation: "Ürün açıklamalarını ve kaliteyi gözden geçirin",
            affectedProducts: highReturnProducts.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode, returnRate: round2(p.returnRate) })),
        });
    }

    // Cost data missing risk
    const noCost = analyzedProducts.filter(p => p.costPrice === 0);
    if (noCost.length > analyzedProducts.length * 0.4 && analyzedProducts.length > 0) {
        risks.push({
            type: "missing_cost_data",
            level: "medium",
            icon: "📝",
            title: `${noCost.length} üründe maliyet bilgisi eksik`,
            impact: "AI kâr analizi yapamıyor — yanlış kararlar riski",
            monthlyImpact: 0,
            probability: 100,
            mitigation: "Ürün Merkezi'nden maliyet bilgilerini girin",
        });
    }

    // Margin dependency risk (too many products with thin margins)
    const thinMargin = analyzedProducts.filter(p => p.costPrice > 0 && p.profitMargin > 0 && p.profitMargin < 10);
    if (thinMargin.length > analyzedProducts.filter(p => p.costPrice > 0).length * 0.5 && thinMargin.length > 5) {
        risks.push({
            type: "thin_margin_dependency",
            level: "medium",
            icon: "⚖️",
            title: `Ürünlerin %${Math.round(thinMargin.length / (analyzedProducts.filter(p => p.costPrice > 0).length || 1) * 100)}'i düşük marjlı`,
            impact: "Küçük maliyet artışları kârlılığı yok edebilir",
            monthlyImpact: round2(thinMargin.reduce((s, p) => s + p.price * p.avgDailySales * 30, 0) * 0.05),
            probability: 60,
            mitigation: "Fiyat optimizasyonu yapın veya tedarikçi maliyetlerini düşürün",
        });
    }

    risks.sort((a, b) => {
        const levelOrder = { high: 0, medium: 1, low: 2 };
        return (levelOrder[a.level] || 2) - (levelOrder[b.level] || 2);
    });

    // Risk score calculation
    const riskScore = clamp(100 - (
        risks.filter(r => r.level === "high").length * 20 +
        risks.filter(r => r.level === "medium").length * 8 +
        risks.filter(r => r.level === "low").length * 3
    ), 0, 100);

    return {
        risks: risks.slice(0, 15),
        overallRiskLevel: risks.some(r => r.level === "high") ? "high" : risks.some(r => r.level === "medium") ? "medium" : "low",
        riskScore,
        riskCount: { high: risks.filter(r => r.level === "high").length, medium: risks.filter(r => r.level === "medium").length, low: risks.filter(r => r.level === "low").length },
        totalMonthlyRiskImpact: round2(risks.reduce((s, r) => s + (r.monthlyImpact || 0), 0)),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #14 DECISION COMPARISON ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function compareDecisions(analyzedProducts, simulateFn) {
    // Pick a representative product for comparison
    const candidates = analyzedProducts.filter(p => p.totalSold > 3 && p.costPrice > 0 && p.stock > 5);
    if (candidates.length === 0) return { comparisons: [], message: "Karşılaştırma için yeterli veri yok" };

    const target = candidates.sort((a, b) => b.totalRevenue - a.totalRevenue)[0];

    const scenarios = [
        { name: "A: Fiyat %5 Artır", params: { barcode: target.barcode, priceChangePct: 5, stockChange: 0, campaignDiscountPct: 0 } },
        { name: "B: Fiyat %10 Artır", params: { barcode: target.barcode, priceChangePct: 10, stockChange: 0, campaignDiscountPct: 0 } },
        { name: "C: %15 İndirim Kampanyası", params: { barcode: target.barcode, priceChangePct: 0, stockChange: 0, campaignDiscountPct: 15 } },
    ];

    const results = scenarios.map(s => {
        const sim = simulateFn(analyzedProducts, s.params);
        const product = sim.products?.[0];
        return {
            name: s.name,
            revenueChange: product?.changes?.revenueChange || 0,
            profitChange: product?.changes?.profitChange || 0,
            salesChange: product?.changes?.salesChange || 0,
            risk: sim.summary?.overallRisk || "low",
        };
    });

    const best = results.reduce((b, r) => r.profitChange > (b?.profitChange || -Infinity) ? r : b, null);

    return {
        product: { name: target.name, barcode: target.barcode, currentPrice: target.price, profitMargin: target.profitMargin },
        comparisons: results,
        recommended: best?.name || "N/A",
        message: best ? `En iyi seçenek: ${best.name} (+${best.profitChange.toFixed(0)}₺ kâr)` : "Karşılaştırma yapılamadı",
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #50 "BENİM YERİME KARAR VER" — Auto Decision Engine
// ═════════════════════════════════════════════════════════════════════════════

async function autoDecide(userId, analyzedProducts, data, businessHealth, lossHunterResult) {
    const decisions = [];
    const { hasOrderData } = data;

    // ── Kullanıcı otonomi kurallarını yükle (autoDecide içinde önerileri kurala göre üretmek için) ──
    let userG = null;
    try {
        const AutonomyConfig = require("../models/AutonomyConfig");
        const cfg = await AutonomyConfig.getOrCreate(userId);
        userG = {
            targetMargin: cfg.targetProfitMarginPercent ?? 15,
            minMargin: cfg.minProfitMarginPercent ?? 5,
            maxDiscount: cfg.maxDiscountPercent ?? 30,
            categoryRules: cfg.categoryRules || [],
            whitelist: cfg.productWhitelist || [],
            blacklist: cfg.productBlacklist || [],
        };
    } catch (e) {
        userG = { targetMargin: 15, minMargin: 5, maxDiscount: 30, categoryRules: [], whitelist: [], blacklist: [] };
    }

    // Yardımcı: ürün AI'ya açık mı?
    const isAllowed = (p) => {
        if (!p?.barcode) return true;
        if (userG.blacklist.includes(p.barcode)) return false;
        if (userG.whitelist.length > 0 && !userG.whitelist.includes(p.barcode)) return false;
        return true;
    };
    // Yardımcı: kategori bazlı efektif marj/indirim
    const effectiveLimits = (category) => {
        const rule = userG.categoryRules.find(r => r.category === category);
        return {
            minMargin: rule?.minProfitMarginPercent ?? userG.minMargin,
            targetMargin: rule?.targetProfitMarginPercent ?? userG.targetMargin,
            maxDiscount: rule?.maxDiscountPercent ?? userG.maxDiscount,
        };
    };

    // ── Whitelist/blacklist'i en başta uygula ──
    const allowedProducts = analyzedProducts.filter(isAllowed);

    // 1. Fix loss products — price increase
    const lossProducts = allowedProducts.filter(p => p.profit < 0 && p.totalSold > 0 && p.costPrice > 0);
    for (const p of lossProducts.slice(0, 5)) {
        const lim = effectiveLimits(p.category);
        // Kategori kuralına göre min marj hedefli yeni fiyat (default: maliyet * (1 + min%/100))
        const minPrice = Math.ceil(p.costPrice / (1 - lim.targetMargin / 100));
        decisions.push({
            priority: 1,
            type: "price_fix",
            icon: "🔴",
            title: `${p.name.slice(0, 35)} — Fiyat Düzelt`,
            description: `Zararda satılıyor. Fiyat ${p.price.toFixed(0)}₺ → ${minPrice}₺ (kategori hedef marjı %${lim.targetMargin})`,
            impact: round2((minPrice - p.price) * p.avgDailySales * 30),
            impactLabel: `+${((minPrice - p.price) * p.avgDailySales * 30).toFixed(0)}₺/ay`,
            urgency: "critical",
            action: "price_update",
            barcode: p.barcode,
            params: { oldPrice: p.price, newPrice: minPrice },
            confidence: 92,
            autoExecutable: true,
            _ruleTrace: { source: lim.minMargin !== userG.minMargin ? "category" : "global", targetMargin: lim.targetMargin },
        });
    }

    // 2. Restock critical products
    const criticalStock = allowedProducts.filter(p => p.stock > 0 && p.daysOfStock < 3 && p.avgDailySales > 0.5 && p.profit > 0);
    for (const p of criticalStock.slice(0, 5)) {
        const restockQty = Math.ceil(p.avgDailySales * 30);
        decisions.push({
            priority: 2,
            type: "restock",
            icon: "📦",
            title: `${p.name.slice(0, 35)} — Acil Stok`,
            description: `${p.daysOfStock} gün sonra tükenecek. ${restockQty} adet sipariş verin`,
            impact: round2(p.profit * p.avgDailySales * 30),
            impactLabel: `${(p.profit * p.avgDailySales * 30).toFixed(0)}₺/ay kurtarılır`,
            urgency: "critical",
            action: "restock",
            barcode: p.barcode,
            params: { currentStock: p.stock, restockQty, daysOfStock: p.daysOfStock },
            confidence: 88,
            autoExecutable: false,
        });
    }

    // 3. Push high-margin products
    const highMarginLowSales = allowedProducts.filter(p => p.profitMargin > 20 && p.avgDailySales < 1 && p.stock > 10 && p.costPrice > 0);
    for (const p of highMarginLowSales.slice(0, 3)) {
        decisions.push({
            priority: 3,
            type: "marketing_push",
            icon: "🚀",
            title: `${p.name.slice(0, 35)} — Pazarlama Artır`,
            description: `%${p.profitMargin.toFixed(0)} marj ama düşük satış. Reklam/kampanya ile satışları katlayın`,
            impact: round2(p.profit * 3 * 30),
            impactLabel: `+${(p.profit * 3 * 30).toFixed(0)}₺/ay potansiyel`,
            urgency: "high",
            action: "marketing",
            barcode: p.barcode,
            params: { margin: p.profitMargin, currentSales: p.avgDailySales },
            confidence: 72,
            autoExecutable: false,
        });
    }

    // 4. Kill dead products — TEKİL ürün başına ayrı karar üret (her birinde barcode + güvenli %20 indirim önerisi)
    const deadProducts = allowedProducts.filter(p => p.daysSinceLastSale > 60 && p.stock > 10 && !p.isNewProduct);
    if (deadProducts.length > 3) {
        const deadValue = deadProducts.reduce((s, p) => s + p.price * p.stock, 0);
        // Özet "öneri" — bilgi amaçlı, otomatik uygulanmaz
        decisions.push({
            priority: 4,
            type: "liquidate_summary",
            icon: "💀",
            title: `${deadProducts.length} Satış Bekleyen Ürün — Satış Stratejisi`,
            description: `60+ gündür satılmayan ${deadProducts.length} ürün ${deadValue.toFixed(0)}₺ sermaye bağlıyor. Aşağıdaki ürün başına önerileri inceleyin.`,
            impact: round2(deadValue * 0.3),
            impactLabel: `${(deadValue * 0.3).toFixed(0)}₺ sermaye kurtarılabilir`,
            urgency: "medium",
            action: "review_strategy",
            params: { productCount: deadProducts.length, totalValue: deadValue },
            confidence: 80,
            autoExecutable: false,
        });
        // İlk 5 ölü ürün için tekil indirim kararı (her biri ayrı barcode + safe %20)
        const top5Dead = [...deadProducts]
            .sort((a, b) => (b.price * b.stock) - (a.price * a.stock))
            .slice(0, 5);
        for (const p of top5Dead) {
            const lim = effectiveLimits(p.category);
            // Kullanıcı maks indirim kuralı ile clamp (default %20 öneri)
            const proposedDisc = Math.min(20, lim.maxDiscount);
            decisions.push({
                priority: 4,
                type: "dead_product_discount",
                icon: "🏷️",
                title: `${p.name.slice(0, 35)} — %${proposedDisc} İndirim Öner`,
                description: `${p.daysSinceLastSale} gündür satışı yok, ${p.stock} adet stok bağlı. Kuralına göre güvenli %${proposedDisc} indirim.`,
                impact: round2(p.price * (proposedDisc / 100) * p.stock * 0.5),
                impactLabel: `~${(p.price * (proposedDisc / 100) * p.stock * 0.5).toFixed(0)}₺ etki`,
                urgency: "medium",
                action: "apply_discount",
                barcode: p.barcode,
                params: { discountPercent: proposedDisc, currentPrice: p.price, currentStock: p.stock, daysSinceLastSale: p.daysSinceLastSale },
                confidence: 70,
                autoExecutable: false,
                _ruleTrace: { source: lim.maxDiscount !== userG.maxDiscount ? "category" : "global", maxDiscount: lim.maxDiscount },
            });
        }
    }

    // 5. Price optimization for thin margins
    const thinMargin = allowedProducts.filter(p => p.profitMargin > 0 && p.profitMargin < (userG.minMargin + 3) && p.totalSold > 10 && p.costPrice > 0);
    for (const p of thinMargin.slice(0, 3)) {
        const lim = effectiveLimits(p.category);
        // Kategori hedef marjına çekmeye çalış
        const targetPrice = Math.ceil(p.costPrice / (1 - lim.targetMargin / 100));
        const newPrice = Math.min(targetPrice, Math.ceil(p.price * 1.05));
        decisions.push({
            priority: 5,
            type: "margin_optimize",
            icon: "💸",
            title: `${p.name.slice(0, 35)} — Marj Artır`,
            description: `Marj %${p.profitMargin.toFixed(1)} (hedef: %${lim.targetMargin}). Fiyat ${p.price.toFixed(0)}₺ → ${newPrice}₺`,
            impact: round2((newPrice - p.price) * p.avgDailySales * 30),
            impactLabel: `+${((newPrice - p.price) * p.avgDailySales * 30).toFixed(0)}₺/ay`,
            urgency: "medium",
            action: "price_update",
            barcode: p.barcode,
            params: { oldPrice: p.price, newPrice },
            confidence: 78,
            autoExecutable: true,
            _ruleTrace: { source: lim.targetMargin !== userG.targetMargin ? "category" : "global", targetMargin: lim.targetMargin },
        });
    }

    // 6. Expand to new marketplaces
    const singleChannel = allowedProducts.filter(p => p.marketplaceCount === 1 && p.totalSold > 5 && p.stock > 0);
    if (singleChannel.length > 10) {
        decisions.push({
            priority: 6,
            type: "expand_channels",
            icon: "🏪",
            title: `${singleChannel.length} Ürün — Yeni Kanal Aç`,
            description: `Tek pazaryerinde satılan ${singleChannel.length} ürünü diğer kanallara açarak satışları %30 artırın`,
            impact: round2(singleChannel.reduce((s, p) => s + p.totalRevenue * 0.3, 0)),
            impactLabel: `+${singleChannel.reduce((s, p) => s + p.totalRevenue * 0.3, 0).toFixed(0)}₺ potansiyel`,
            urgency: "medium",
            action: "expand",
            params: { productCount: singleChannel.length },
            confidence: 68,
            autoExecutable: false,
        });
    }

    decisions.sort((a, b) => a.priority - b.priority);

    const totalPotentialImpact = decisions.reduce((s, d) => s + (d.impact || 0), 0);
    const criticalCount = decisions.filter(d => d.urgency === "critical").length;

    return {
        decisions: decisions.slice(0, 15),
        totalPotentialImpact: round2(totalPotentialImpact),
        criticalCount,
        totalDecisions: decisions.length,
        summary: criticalCount > 0
            ? `🚨 ${criticalCount} acil karar var! Toplam ${totalPotentialImpact.toFixed(0)}₺ etki`
            : decisions.length > 0
                ? `${decisions.length} karar hazır — toplam ${totalPotentialImpact.toFixed(0)}₺ potansiyel`
                : "Şu an acil karar gerektiren durum yok ✅",
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #51 "BENİ ANLA" — Full Business Diagnosis
// ═════════════════════════════════════════════════════════════════════════════

function generateDiagnosis(analyzedProducts, data, businessHealth, lossHunterResult, predictions) {
    const diagnosis = {
        mistakes: [],
        leaks: [],
        opportunities: [],
        verdict: "",
        verdictEmoji: "",
        healthGrade: "",
        score: 0,
    };

    // ── Mistakes (Nerede hata yapıyorum?) ──
    const lossProducts = analyzedProducts.filter(p => p.profit < 0 && p.totalSold > 0 && p.costPrice > 0);
    if (lossProducts.length > 0) {
        const totalLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);
        diagnosis.mistakes.push({
            icon: "🔴",
            title: `${lossProducts.length} ürünü zararda satıyorsun`,
            detail: `Toplam ${totalLoss.toFixed(0)}₺ kaybettin. Fiyatları maliyetin altında bırakmışsın.`,
            fix: "Hemen fiyatları güncelle — en az %15 marj hedefle",
            severity: "critical",
            amount: round2(totalLoss),
        });
    }

    const deadProducts = analyzedProducts.filter(p => p.daysSinceLastSale > 60 && p.stock > 10);
    if (deadProducts.length > 5) {
        const deadValue = deadProducts.reduce((s, p) => s + p.price * p.stock, 0);
        diagnosis.mistakes.push({
            icon: "💀",
            title: `${deadProducts.length} ürün 60+ gündür satış bekliyor`,
            detail: `${deadValue.toFixed(0)}₺ sermaye bu ürünlerde kilitli. İndirim, kampanya, set/kombin ve reklam ile satışa dönüştürebilirsin.`,
            fix: "Agresif indirim uygula, kampanya/vitrin sayfasına ekle, set/kombin oluştur, sosyal medyada tanıt",
            severity: "high",
            amount: round2(deadValue),
        });
    }

    const noCost = analyzedProducts.filter(p => p.costPrice === 0);
    if (noCost.length > analyzedProducts.length * 0.4) {
        diagnosis.mistakes.push({
            icon: "📝",
            title: `${noCost.length} ürünün maliyetini girmemişsin`,
            detail: "AI kör uçuyor — gerçek kârını bilmiyorsun. Belki zararda satıyorsun haberin yok.",
            fix: "Ürünlerim sekmesinden maliyetleri gir",
            severity: "high",
            amount: 0,
        });
    }

    // ── Money Leaks (Nerede para kaçırıyorum?) ──
    const outOfStock = analyzedProducts.filter(p => p.stock === 0 && p.avgDailySales > 0.3 && p.profit > 0);
    if (outOfStock.length > 0) {
        const dailyLeak = outOfStock.reduce((s, p) => s + p.profit * p.avgDailySales, 0);
        diagnosis.leaks.push({
            icon: "📦",
            title: `Stok tükenen ${outOfStock.length} ürün — her gün para kaçırıyorsun`,
            detail: `Günlük ${dailyLeak.toFixed(0)}₺, aylık ${(dailyLeak * 30).toFixed(0)}₺ kaçırıyorsun`,
            fix: "Acil tedarik et — her gün geç kalıyorsun",
            severity: "critical",
            amount: round2(dailyLeak * 30),
        });
    }

    const thinMargin = analyzedProducts.filter(p => p.profitMargin > 0 && p.profitMargin < 8 && p.totalSold > 10 && p.costPrice > 0);
    if (thinMargin.length > 0) {
        const potentialGain = thinMargin.reduce((s, p) => s + p.price * 0.05 * p.avgDailySales * 30, 0);
        diagnosis.leaks.push({
            icon: "💸",
            title: `${thinMargin.length} ürünü çok ucuza satıyorsun`,
            detail: `Marjı %8'in altında. %5 fiyat artışıyla aylık +${potentialGain.toFixed(0)}₺ kazanırsın`,
            fix: "Fiyatları %5 artır — müşteri kaybetmezsin",
            severity: "high",
            amount: round2(potentialGain),
        });
    }

    const singleChannel = analyzedProducts.filter(p => p.marketplaceCount === 1 && p.totalSold > 5);
    if (singleChannel.length > 10) {
        const potential = singleChannel.reduce((s, p) => s + p.totalRevenue * 0.3, 0);
        diagnosis.leaks.push({
            icon: "🏪",
            title: `${singleChannel.length} ürün tek kanalda — potansiyelin %30'unu kaçırıyorsun`,
            detail: `Diğer pazaryerlerine açarak +${potential.toFixed(0)}₺ ciro potansiyeli var`,
            fix: "En çok satan 10 ürünü diğer kanallara aç",
            severity: "medium",
            amount: round2(potential),
        });
    }

    // ── Opportunities (Nerede fırsat var?) ──
    const highMarginHighStock = analyzedProducts.filter(p => p.profitMargin > 20 && p.stock > 20 && p.costPrice > 0);
    if (highMarginHighStock.length > 0) {
        const potential = highMarginHighStock.reduce((s, p) => s + p.profit * p.stock * 0.3, 0);
        diagnosis.opportunities.push({
            icon: "💰",
            title: `${highMarginHighStock.length} altın ürünün var — pazarlamaya bas`,
            detail: `Yüksek marjlı, stoklu ürünler. Reklam artırarak +${potential.toFixed(0)}₺ kazanabilirsin`,
            action: "Bu ürünlere reklam bütçesi ayır",
            amount: round2(potential),
        });
    }

    const trending = analyzedProducts.filter(p => {
        if (!p.dailySales || Object.keys(p.dailySales).length < 7) return false;
        const entries = Object.entries(p.dailySales).sort((a, b) => a[0].localeCompare(b[0]));
        const recent = entries.slice(-7);
        const prev = entries.slice(-14, -7);
        if (recent.length < 5 || prev.length < 3) return false;
        const recentAvg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
        const prevAvg = prev.reduce((s, [, v]) => s + v, 0) / prev.length;
        return prevAvg > 0 && recentAvg > prevAvg * 1.3;
    });
    if (trending.length > 0) {
        diagnosis.opportunities.push({
            icon: "📈",
            title: `${trending.length} ürün yükselişte — dalga yakala`,
            detail: "Bu ürünlerin satışları %30+ arttı. Stok artır, fiyat koru",
            action: "Stok artır ve pazarlamayı güçlendir",
            amount: round2(trending.reduce((s, p) => s + p.profit * p.avgDailySales * 30, 0)),
        });
    }

    const lowCompetition = analyzedProducts.filter(p => p.profitMargin > 25 && p.avgDailySales > 1 && p.costPrice > 0);
    if (lowCompetition.length > 0) {
        diagnosis.opportunities.push({
            icon: "🏆",
            title: `${lowCompetition.length} ürün çok iyi performans gösteriyor`,
            detail: "Yüksek marj + yüksek satış. Bu ürünlerin stokunu asla bitirme",
            action: "Stok güvenlik seviyesini artır",
            amount: round2(lowCompetition.reduce((s, p) => s + p.profit * p.avgDailySales * 30, 0)),
        });
    }

    // ── Verdict ──
    const totalMistakeAmount = diagnosis.mistakes.reduce((s, m) => s + (m.amount || 0), 0);
    const totalLeakAmount = diagnosis.leaks.reduce((s, l) => s + (l.amount || 0), 0);
    const totalOppAmount = diagnosis.opportunities.reduce((s, o) => s + (o.amount || 0), 0);
    const bhScore = businessHealth.overallScore;

    if (bhScore >= 80 && diagnosis.mistakes.length === 0) {
        diagnosis.verdict = "İşin sağlam. Küçük optimizasyonlarla daha da büyüyebilirsin.";
        diagnosis.verdictEmoji = "🏆";
        diagnosis.healthGrade = "A";
        diagnosis.score = 90;
    } else if (bhScore >= 60) {
        diagnosis.verdict = `İyi gidiyorsun ama ${totalLeakAmount.toFixed(0)}₺ para kaçırıyorsun. Aşağıdaki adımları uygula.`;
        diagnosis.verdictEmoji = "💪";
        diagnosis.healthGrade = "B";
        diagnosis.score = 70;
    } else if (bhScore >= 40) {
        diagnosis.verdict = `Dikkat! ${totalMistakeAmount.toFixed(0)}₺ hata + ${totalLeakAmount.toFixed(0)}₺ kaçak var. Acil müdahale gerekiyor.`;
        diagnosis.verdictEmoji = "⚠️";
        diagnosis.healthGrade = "C";
        diagnosis.score = 50;
    } else {
        diagnosis.verdict = `ALARM! İşletmen ciddi sorunlar yaşıyor. ${totalMistakeAmount.toFixed(0)}₺ zarar, ${totalLeakAmount.toFixed(0)}₺ kaçak. Hemen harekete geç!`;
        diagnosis.verdictEmoji = "🚨";
        diagnosis.healthGrade = "D";
        diagnosis.score = 25;
    }

    diagnosis.totalMistakeAmount = round2(totalMistakeAmount);
    diagnosis.totalLeakAmount = round2(totalLeakAmount);
    diagnosis.totalOppAmount = round2(totalOppAmount);

    return diagnosis;
}

// ═════════════════════════════════════════════════════════════════════════════
// #52 "PARA NEREDE?" — Money Tracker
// ═════════════════════════════════════════════════════════════════════════════

function trackMoney(analyzedProducts, data) {
    const { orders30, orders7, ordersToday, hasOrderData } = data;

    // Top earners
    const topEarners = analyzedProducts
        .filter(p => p.costPrice > 0 && p.totalSold > 0)
        .sort((a, b) => (b.profit * b.totalSold) - (a.profit * a.totalSold))
        .slice(0, 5)
        .map(p => ({
            name: p.name, barcode: p.barcode,
            totalProfit: round2(p.profit * p.totalSold),
            totalRevenue: round2(p.totalRevenue),
            margin: round2(p.profitMargin),
            sold: p.totalSold,
            icon: "💰",
        }));

    // Top losers
    const topLosers = analyzedProducts
        .filter(p => p.costPrice > 0 && p.totalSold > 0 && p.profit < 0)
        .sort((a, b) => (a.profit * a.totalSold) - (b.profit * b.totalSold))
        .slice(0, 5)
        .map(p => ({
            name: p.name, barcode: p.barcode,
            totalLoss: round2(Math.abs(p.profit) * p.totalSold),
            totalRevenue: round2(p.totalRevenue),
            margin: round2(p.profitMargin),
            sold: p.totalSold,
            icon: "🔴",
        }));

    // Marketplace performance
    const mpMap = {};
    for (const p of analyzedProducts) {
        for (const mp of (p.marketplaces || [])) {
            if (!mpMap[mp]) mpMap[mp] = { name: mp, revenue: 0, profit: 0, products: 0, sold: 0 };
            mpMap[mp].revenue += p.totalRevenue / (p.marketplaces?.length || 1);
            mpMap[mp].profit += (p.profit * p.totalSold) / (p.marketplaces?.length || 1);
            mpMap[mp].products++;
            mpMap[mp].sold += p.totalSold / (p.marketplaces?.length || 1);
        }
    }
    const marketplaces = Object.values(mpMap)
        .map(m => ({ ...m, revenue: round2(m.revenue), profit: round2(m.profit), sold: Math.round(m.sold), margin: m.revenue > 0 ? round2((m.profit / m.revenue) * 100) : 0 }))
        .sort((a, b) => b.profit - a.profit);

    // Revenue summary
    const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const weekRevenue = orders7.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const monthRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const totalProfit = analyzedProducts.filter(p => p.costPrice > 0).reduce((s, p) => s + p.profit * p.totalSold, 0);
    const totalLoss = analyzedProducts.filter(p => p.profit < 0 && p.costPrice > 0).reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);

    // Category performance
    const catMap = {};
    for (const p of analyzedProducts.filter(pp => pp.costPrice > 0)) {
        const cat = p.category || "Diğer";
        if (!catMap[cat]) catMap[cat] = { name: cat, revenue: 0, profit: 0, products: 0 };
        catMap[cat].revenue += p.totalRevenue;
        catMap[cat].profit += p.profit * p.totalSold;
        catMap[cat].products++;
    }
    const categories = Object.values(catMap)
        .map(c => ({ ...c, revenue: round2(c.revenue), profit: round2(c.profit), margin: c.revenue > 0 ? round2((c.profit / c.revenue) * 100) : 0 }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 8);

    return {
        topEarners,
        topLosers,
        marketplaces,
        categories,
        summary: {
            todayRevenue: round2(todayRevenue),
            weekRevenue: round2(weekRevenue),
            monthRevenue: round2(monthRevenue),
            totalProfit: round2(totalProfit),
            totalLoss: round2(totalLoss),
            netProfit: round2(totalProfit - totalLoss),
            profitableProducts: analyzedProducts.filter(p => p.profit > 0 && p.costPrice > 0).length,
            losingProducts: analyzedProducts.filter(p => p.profit < 0 && p.costPrice > 0).length,
        },
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// #53 "KIRMIZI ALARM" — Red Alert System
// ═════════════════════════════════════════════════════════════════════════════

// ── Yardımcılar: alert detaylandırma ────────────────────────────────────────

/** Marketplace listesinden insan okunabilir kısa string */
function fmtMarketplaces(arr, max = 2) {
    if (!Array.isArray(arr) || arr.length === 0) return "—";
    const names = arr.map(m => (typeof m === "string" ? m : m?.marketplaceName || m?.name)).filter(Boolean);
    if (names.length === 0) return "—";
    const shown = names.slice(0, max).join(", ");
    return names.length > max ? `${shown} +${names.length - max}` : shown;
}

/** Ürün listesini frekans bazlı kategori/pazaryeri dağılımına dönüştür */
function aggregateBreakdown(products, field) {
    const counts = new Map();
    for (const p of products) {
        let key;
        if (field === "marketplaces") {
            const ms = p.marketplaces || [];
            for (const m of ms) {
                const name = typeof m === "string" ? m : (m?.marketplaceName || m?.name);
                if (!name) continue;
                counts.set(name, (counts.get(name) || 0) + 1);
            }
            continue;
        }
        key = p[field] || "Diğer";
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
}

/** Ürünü alert listesi için detaylı, tıklanabilir hale getir */
function detailProduct(p, extras = {}) {
    return {
        barcode: p.barcode,
        name: (p.name || "İsimsiz ürün").slice(0, 60),
        category: p.category || "Kategorisiz",
        marketplaces: fmtMarketplaces(p.marketplaces),
        marketplaceCount: p.marketplaceCount || (Array.isArray(p.marketplaces) ? p.marketplaces.length : 0),
        price: round2(p.price || 0),
        costPrice: round2(p.costPrice || 0),
        stock: p.stock || 0,
        daysOfStock: p.daysOfStock,
        daysSinceLastSale: p.daysSinceLastSale, // null olabilir
        hasSalesHistory: !!p.hasSalesHistory,
        isNewProduct: !!p.isNewProduct,
        productAgeDays: p.productAgeDays ?? null,
        totalSold: p.totalSold || 0,
        avgDailySales: round2(p.avgDailySales || 0),
        profit: round2(p.profit || 0),
        profitMargin: round2(p.profitMargin || 0),
        returnRate: round2(p.returnRate || 0),
        healthScore: p.healthScore || 0,
        ...extras,
    };
}

function generateRedAlerts(analyzedProducts, data, businessHealth) {
    const alerts = [];
    const { hasOrderData, ordersToday, orders30 } = data;
    const totalProducts = analyzedProducts.length;

    // ── 1. ZARAR EDİYORSUN ─────────────────────────────────────────────────
    const lossProducts = analyzedProducts.filter(p => p.profit < 0 && p.totalSold > 0 && p.costPrice > 0);
    if (lossProducts.length > 0) {
        const sorted = [...lossProducts].sort((a, b) => (Math.abs(b.profit) * b.avgDailySales) - (Math.abs(a.profit) * a.avgDailySales));
        const monthlyLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.avgDailySales * 30, 0);
        const dailyLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.avgDailySales, 0);
        alerts.push({
            type: "loss",
            icon: "🔴",
            headline: "ZARAR EDİYORSUN!",
            message: `${lossProducts.length} ürün her satışta para kaybettiriyor. Aylık tahmini kayıp ${monthlyLoss.toFixed(0)}₺, günlük ${dailyLoss.toFixed(0)}₺.`,
            severity: "critical",
            amount: round2(monthlyLoss),
            amountLabel: "30 günlük tahmini kayıp",
            action: "Fiyatları HEMEN güncelle (öneriler hazır)",
            cta: { tab: "recommendations", filter: { type: "loss_detection,price_optimization" }, label: "Fiyat Önerilerini Aç" },
            products: sorted.slice(0, 8).map(p => detailProduct(p, {
                unitLoss: round2(Math.abs(p.profit)),
                monthlyImpact: round2(Math.abs(p.profit) * p.avgDailySales * 30),
                suggestion: `Min ${Math.ceil((p.costPrice || 0) * 1.15)}₺ — %15 kar marjı için`,
            })),
            breakdown: {
                byMarketplace: aggregateBreakdown(lossProducts, "marketplaces"),
                byCategory: aggregateBreakdown(lossProducts, "category"),
            },
            kpis: [
                { label: "Toplam ürün", value: lossProducts.length },
                { label: "Günlük kayıp", value: `${dailyLoss.toFixed(0)}₺` },
                { label: "Aylık kayıp", value: `${monthlyLoss.toFixed(0)}₺` },
            ],
        });
    }

    // ── 2. STOK TÜKENDİ / TÜKENİYOR ────────────────────────────────────────
    const outOfStock = analyzedProducts.filter(p => p.stock === 0 && p.avgDailySales > 0.3);
    const criticalStock = analyzedProducts.filter(p => p.stock > 0 && p.daysOfStock < 3 && p.avgDailySales > 0.5);
    if (outOfStock.length + criticalStock.length > 0) {
        const oosRev = outOfStock.reduce((s, p) => s + p.price * p.avgDailySales, 0);
        const csRev = criticalStock.reduce((s, p) => s + p.price * p.avgDailySales, 0);
        const dailyLossNow = oosRev;
        const projected30 = (oosRev + csRev) * 30;
        const all = [...outOfStock.map(p => ({ p, isOut: true })), ...criticalStock.map(p => ({ p, isOut: false }))]
            .sort((a, b) => (b.p.price * b.p.avgDailySales) - (a.p.price * a.p.avgDailySales));

        let message;
        if (outOfStock.length > 0 && criticalStock.length > 0) {
            message = `${outOfStock.length} ürün şu an STOKTA YOK, ${criticalStock.length} ürün 3 gün içinde tükenecek. Stoksuz olanlar günde ${dailyLossNow.toFixed(0)}₺ satış kaçırıyor.`;
        } else if (outOfStock.length > 0) {
            message = `${outOfStock.length} ürün şu an STOKTA YOK ve düzenli satıyordu — günde ${dailyLossNow.toFixed(0)}₺ kaçırıyorsun.`;
        } else {
            message = `${criticalStock.length} hızlı satan ürünün stoğu 3 gün içinde tükenecek. Hemen sipariş ver.`;
        }
        alerts.push({
            type: "stock",
            icon: "📦",
            headline: outOfStock.length > 0 ? "STOK TÜKENDİ!" : "STOK BİTİYOR!",
            message,
            severity: outOfStock.length > 3 ? "critical" : outOfStock.length > 0 ? "high" : "medium",
            amount: round2(projected30),
            amountLabel: "30 günlük risk",
            action: outOfStock.length > 0 ? "Tedarikçiye sipariş ver" : "Stok takvimi kur",
            cta: { tab: "advisor", filter: { lowStock: true }, label: "Stok Listesini Aç" },
            products: all.slice(0, 10).map(({ p, isOut }) => detailProduct(p, {
                status: isOut ? "Stokta yok" : `${p.daysOfStock} gün kaldı`,
                suggestion: isOut
                    ? `Acil ${Math.ceil(p.avgDailySales * 30)} adet sipariş`
                    : `${Math.max(Math.ceil(p.avgDailySales * 30) - p.stock, 1)} adet ek sipariş`,
                projectedLoss: round2(p.price * p.avgDailySales * 30),
            })),
            breakdown: {
                byMarketplace: aggregateBreakdown([...outOfStock, ...criticalStock], "marketplaces"),
                byCategory: aggregateBreakdown([...outOfStock, ...criticalStock], "category"),
            },
            kpis: [
                { label: "Stoğu biten", value: outOfStock.length },
                { label: "3 gün içinde bitecek", value: criticalStock.length },
                { label: "Günlük kayıp (stoksuz)", value: `${dailyLossNow.toFixed(0)}₺` },
            ],
        });
    }

    // ── 3. SATIŞ ÇÖKTÜ ─────────────────────────────────────────────────────
    if (hasOrderData) {
        const todayRev = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const avgDaily = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0) / 30;
        // Saat 10:00'dan önce uyarı atma (gün daha bitmedi)
        const now = new Date();
        const hourTR = (now.getUTCHours() + 3) % 24;
        if (avgDaily > 50 && hourTR >= 12 && todayRev < avgDaily * 0.4) {
            const dropPct = Math.round((1 - todayRev / avgDaily) * 100);
            // En çok düşen kanal: bugünkü siparişlerde olmayan ama 30 günde aktif olan pazaryerleri
            const mpToday = new Map();
            for (const o of ordersToday) mpToday.set(o.marketplaceName, (mpToday.get(o.marketplaceName) || 0) + (o.totalPrice || 0));
            const mp30 = new Map();
            for (const o of orders30) mp30.set(o.marketplaceName, (mp30.get(o.marketplaceName) || 0) + (o.totalPrice || 0) / 30);
            const mpDrops = [];
            for (const [mp, daily] of mp30.entries()) {
                const today = mpToday.get(mp) || 0;
                if (daily > 30) mpDrops.push({ label: mp, dailyAvg: round2(daily), today: round2(today), gap: round2(daily - today) });
            }
            mpDrops.sort((a, b) => b.gap - a.gap);
            alerts.push({
                type: "sales_crash",
                icon: "📉",
                headline: "SATIŞ ÇÖKTÜ!",
                message: `Bugün şu ana kadar ${todayRev.toFixed(0)}₺ ciro var, son 30 günün günlük ortalaması ${avgDaily.toFixed(0)}₺. %${dropPct} düşüş.`,
                severity: "critical",
                amount: round2(avgDaily - todayRev),
                amountLabel: "Bugünkü kayıp",
                action: "Kampanya başlat veya en düşen kanalı incele",
                cta: { tab: "platforms", label: "Kanal Analizini Aç" },
                products: [],
                breakdown: {
                    byMarketplaceDrops: mpDrops.slice(0, 5),
                },
                kpis: [
                    { label: "Bugün", value: `${todayRev.toFixed(0)}₺` },
                    { label: "Günlük ort. (30g)", value: `${avgDaily.toFixed(0)}₺` },
                    { label: "Düşüş", value: `-%${dropPct}` },
                ],
            });
        }
    }

    // ── 4. SERMAYE BAĞLI (Ölü ürünler) ─────────────────────────────────────
    // ⚠️ Yeni eklenmiş ürünleri dışla — daysSinceLastSale null ise ürün hiç satılmamış,
    //    productAgeDays < 21 ise henüz yeni → "ölü ürün" sayma (yalancı uyarı önlenir)
    const deadProducts = analyzedProducts.filter(p =>
        p.daysSinceLastSale !== null &&
        p.daysSinceLastSale !== undefined &&
        p.daysSinceLastSale > 60 &&
        p.stock > 5 &&
        !p.isNewProduct
    );
    if (deadProducts.length > 5) {
        const deadValue = deadProducts.reduce((s, p) => s + p.price * p.stock, 0);
        if (deadValue > 5000) {
            const sorted = [...deadProducts].sort((a, b) => (b.price * b.stock) - (a.price * a.stock));
            alerts.push({
                type: "dead_capital",
                icon: "💀",
                headline: "PARAN KİLİTLİ!",
                message: `${deadProducts.length} ürün 60+ gündür satılmıyor — toplam ${deadValue.toFixed(0)}₺ sermaye stokta bekliyor. Aşağıdaki ürünlere göz at, AI her birine ayrı indirim önerisi hazırladı.`,
                severity: "high",
                amount: round2(deadValue),
                amountLabel: "Bağlı sermaye",
                action: "Önerileri gör — her ürün için ayrı indirim hazır",
                cta: { tab: "recommendations", filter: { type: "dead_product,dynamic_pricing" }, label: "İndirim Önerilerini Gör" },
                products: sorted.slice(0, 10).map(p => detailProduct(p, {
                    capitalLocked: round2(p.price * p.stock),
                    suggestion: `%20 indirim → ${Math.round(p.price * 0.8)}₺ ile hareket başlatın`,
                    daysIdle: p.daysSinceLastSale,
                })),
                breakdown: {
                    byMarketplace: aggregateBreakdown(deadProducts, "marketplaces"),
                    byCategory: aggregateBreakdown(deadProducts, "category"),
                },
                kpis: [
                    { label: "Ürün sayısı", value: deadProducts.length },
                    { label: "Toplam stok", value: deadProducts.reduce((s, p) => s + p.stock, 0) },
                    { label: "Bağlı sermaye", value: `${deadValue.toFixed(0)}₺` },
                ],
            });
        }
    }

    // ── 5. MALİYET BİLGİSİ EKSİK ───────────────────────────────────────────
    const noCost = analyzedProducts.filter(p => (p.costPrice || 0) === 0);
    const noCostWithSales = noCost.filter(p => p.totalSold > 0);
    if (noCost.length > Math.max(5, totalProducts * 0.5)) {
        // Sat saten varsa öncelik onlar
        const focus = noCostWithSales.length > 0 ? noCostWithSales : noCost;
        const sortedFocus = [...focus].sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
        const revAtRisk = noCostWithSales.reduce((s, p) => s + p.totalRevenue, 0);
        alerts.push({
            type: "blind_flying",
            icon: "🙈",
            headline: "KÖR UÇUYORSUN!",
            message: noCostWithSales.length > 0
                ? `${noCost.length} ürünün maliyeti girilmemiş — bunlardan ${noCostWithSales.length} tanesi son 90 günde toplam ${revAtRisk.toFixed(0)}₺ satış yaptı, ama kâr/zarar bilemiyoruz.`
                : `${noCost.length} ürünün maliyeti girilmemiş. Bu ürünler satarsa kâr hesaplayamayız.`,
            severity: noCostWithSales.length > 0 ? "high" : "medium",
            amount: round2(revAtRisk),
            amountLabel: "Görmediğimiz ciro",
            action: noCostWithSales.length > 0 ? "Önce satan ürünlerin maliyetini gir" : "Ürünlerim sekmesinden toplu maliyet gir",
            cta: { tab: "costs", label: "Maliyet Girme Sayfasını Aç" },
            products: sortedFocus.slice(0, 10).map(p => detailProduct(p, {
                suggestion: "Maliyet gir → AI kâr önerisini açar",
                priority: p.totalSold > 0 ? "Yüksek (satıyor)" : "Düşük (henüz satılmadı)",
            })),
            breakdown: {
                byCategory: aggregateBreakdown(focus, "category"),
                byMarketplace: aggregateBreakdown(focus, "marketplaces"),
            },
            kpis: [
                { label: "Maliyetsiz toplam", value: noCost.length },
                { label: "Bunlardan satılan", value: noCostWithSales.length },
                { label: "Görmediğimiz ciro", value: `${revAtRisk.toFixed(0)}₺` },
            ],
        });
    }

    // ── 6. İADE ORANI YÜKSEK ───────────────────────────────────────────────
    const highReturn = analyzedProducts.filter(p => p.returnRate > 15 && p.totalSold > 5);
    if (highReturn.length > 0) {
        const sorted = [...highReturn].sort((a, b) => (b.price * b.totalSold * (b.returnRate / 100)) - (a.price * a.totalSold * (a.returnRate / 100)));
        const returnLoss = highReturn.reduce((s, p) => s + p.price * p.totalSold * (p.returnRate / 100), 0);
        alerts.push({
            type: "returns",
            icon: "↩️",
            headline: "İADELER ARTIYOR!",
            message: `${highReturn.length} ürünün iade oranı %15'in üzerinde. Tahmini iade kaybı ${returnLoss.toFixed(0)}₺. Açıklama/foto/beden tablosu yetersiz olabilir.`,
            severity: "high",
            amount: round2(returnLoss),
            amountLabel: "Tahmini iade kaybı (90g)",
            action: "Ürün açıklamalarını ve görsellerini gözden geçir",
            cta: { tab: "advisor", filter: { highReturn: true }, label: "Yüksek İadeli Ürünleri Aç" },
            products: sorted.slice(0, 10).map(p => detailProduct(p, {
                projectedLoss: round2(p.price * p.totalSold * (p.returnRate / 100)),
                suggestion: "Açıklama + beden/ölçü tablosu + ek görsel ekle",
            })),
            breakdown: {
                byCategory: aggregateBreakdown(highReturn, "category"),
                byMarketplace: aggregateBreakdown(highReturn, "marketplaces"),
            },
            kpis: [
                { label: "Sorunlu ürün", value: highReturn.length },
                { label: "Ort. iade oranı", value: `%${(highReturn.reduce((s, p) => s + p.returnRate, 0) / highReturn.length).toFixed(1)}` },
                { label: "Tahmini kayıp", value: `${returnLoss.toFixed(0)}₺` },
            ],
        });
    }

    // ── 7. TEK KANAL BAĞIMLILIĞI ───────────────────────────────────────────
    const singleChannel = analyzedProducts.filter(p => (p.marketplaceCount || 0) === 1 && p.totalSold > 5);
    if (singleChannel.length > 10) {
        const totalRev = singleChannel.reduce((s, p) => s + p.totalRevenue, 0);
        alerts.push({
            type: "single_channel_risk",
            icon: "🏪",
            headline: "TEK KANALDAN BESLENİYORSUN!",
            message: `${singleChannel.length} ürün sadece tek pazaryerinden satıyor. Bu kanal sorun yaşarsa ${totalRev.toFixed(0)}₺ ciro risk altında.`,
            severity: "medium",
            amount: round2(totalRev * 0.3),
            amountLabel: "Çapraz satış potansiyeli",
            action: "Diğer pazaryerlerine kopyala",
            cta: { tab: "platforms", label: "Pazaryeri Genişletme Aç" },
            products: [...singleChannel].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 8).map(p => detailProduct(p, {
                suggestion: "Diğer pazaryerlerine de listele",
                currentChannel: fmtMarketplaces(p.marketplaces),
            })),
            breakdown: {
                byMarketplace: aggregateBreakdown(singleChannel, "marketplaces"),
            },
            kpis: [
                { label: "Tek kanal ürün", value: singleChannel.length },
                { label: "Bağlı ciro", value: `${totalRev.toFixed(0)}₺` },
            ],
        });
    }

    alerts.sort((a, b) => {
        const sevOrder = { critical: 0, high: 1, medium: 2 };
        return (sevOrder[a.severity] || 2) - (sevOrder[b.severity] || 2);
    });

    return {
        alerts: alerts.slice(0, 8),
        hasAlerts: alerts.length > 0,
        criticalCount: alerts.filter(a => a.severity === "critical").length,
        totalAlertImpact: round2(alerts.reduce((s, a) => s + (a.amount || 0), 0)),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS — Statü bazlı çekim (tek limit(50) son tarih sırası, onaylıları dışarıda bırakıyordu)
// ═════════════════════════════════════════════════════════════════════════════

const BRAIN_REC_LIMITS = { pending: 120, approved: 60, executed: 60, rejected: 50 };

/**
 * Özet sayıları DB ile; liste her statüden yeterince kayıt içerir (UI sekmeleri boş kalmaz).
 */
async function fetchRecommendationsForBrainDashboard(userId, limits = BRAIN_REC_LIMITS) {
    const lim = { ...BRAIN_REC_LIMITS, ...limits };
    const [pending, approved, executed, rejected, pendingCount, executedCount, approvedCount, rejectedCount] = await Promise.all([
        Recommendation.find({ userId, status: "pending" }).sort({ createdAt: -1 }).limit(lim.pending).lean(),
        Recommendation.find({ userId, status: "approved" }).sort({ createdAt: -1 }).limit(lim.approved).lean(),
        Recommendation.find({ userId, status: "executed" }).sort({ createdAt: -1 }).limit(lim.executed).lean(),
        Recommendation.find({ userId, status: "rejected" }).sort({ createdAt: -1 }).limit(lim.rejected).lean(),
        Recommendation.countDocuments({ userId, status: "pending" }),
        Recommendation.countDocuments({ userId, status: "executed" }),
        Recommendation.countDocuments({ userId, status: "approved" }),
        Recommendation.countDocuments({ userId, status: "rejected" }),
    ]);

    const byId = new Map();
    for (const r of pending) byId.set(String(r._id), r);
    for (const r of approved) byId.set(String(r._id), r);
    for (const r of executed) byId.set(String(r._id), r);
    for (const r of rejected) byId.set(String(r._id), r);

    const allRecs = [...byId.values()];
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { pending: 0, approved: 1, executed: 2, rejected: 3 };
    allRecs.sort((a, b) => {
        const sd = (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4);
        if (sd !== 0) return sd;
        return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });

    return {
        allRecs,
        recSummary: { pending: pendingCount, executed: executedCount, approved: approvedCount, rejected: rejectedCount },
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// MASTER DASHBOARD — Combines all engines into single response
// ═════════════════════════════════════════════════════════════════════════════

async function getFullBrainDashboard(userId, aiEngine, strategyMode) {
    const data = await aiEngine.collectData(userId);
    const analyzed = aiEngine.analyzeProducts(data.products, data.orders90);
    const aiScore = aiEngine.calculateAIScore(analyzed, data);
    const report = aiEngine.generateDailyReport(analyzed, data, aiScore);
    const strategy = aiEngine.detectOptimalStrategy(analyzed, data);
    const roi = aiEngine.calculateROI(data.pastRecs);
    const timing = aiEngine.analyzeTimingPatterns(data.orders90);
    const heatmap = aiEngine.buildProfitHeatmap(analyzed);
    const retro = aiEngine.retroAnalysis(analyzed, data);
    const learning = aiEngine.analyzeUserPreferences(data.pastRecs);
    const goals = aiEngine.updateGoalProgress(data.goals, data);

    // Generate & save recommendations
    const recs = aiEngine.generateRecommendations(analyzed, data, strategyMode);
    aiEngine.saveRecommendations(userId, recs, strategyMode).catch(e => logger.error(`[AI Brain] bg save: ${e.message}`));

    // New engines
    const businessHealth = calculateBusinessHealth(analyzed, data, aiScore);
    const lossHunterResult = huntLosses(analyzed, data);
    const focusItems = generateFocusItems(analyzed, data, businessHealth, lossHunterResult);
    const opportunityRadar = scanOpportunities(analyzed, data, userId);
    const causeAnalysis = analyzeCauses(analyzed, data);
    const segmentation = segmentProducts(analyzed);
    const context = getContextAwareness();
    const emotionalTone = getEmotionalTone(businessHealth, focusItems);
    const teachingTips = generateTeachingTips(analyzed, data, businessHealth);
    const predictions = generatePredictions(analyzed, data);
    const journal = generateDailyJournal(analyzed, data, businessHealth, lossHunterResult, focusItems);
    const riskAssessment = assessRisks(analyzed, data, businessHealth);
    const decisionComparison = compareDecisions(analyzed, aiEngine.simulate);

    // New v5 engines
    const autoDecisions = await autoDecide(userId, analyzed, data, businessHealth, lossHunterResult);
    const diagnosisResult = generateDiagnosis(analyzed, data, businessHealth, lossHunterResult, predictions);
    const moneyTracker = trackMoney(analyzed, data);
    const redAlerts = generateRedAlerts(analyzed, data, businessHealth);

    // Agentic Thought Process — Proaktif AI Akıl Yürütme
    const thoughtProcess = generateThoughtProcess(analyzed, data, businessHealth, lossHunterResult, predictions, redAlerts);

    const [{ allRecs, recSummary }, selfEval, decisionHistory] = await Promise.all([
        fetchRecommendationsForBrainDashboard(userId),
        selfEvaluate(userId),
        getDecisionHistory(userId),
    ]);
    const { pending: pendingCount } = recSummary;

    // Product health segments
    const segments = {
        critical: analyzed.filter(p => p.healthScore < 30).length,
        warning: analyzed.filter(p => p.healthScore >= 30 && p.healthScore < 50).length,
        healthy: analyzed.filter(p => p.healthScore >= 50 && p.healthScore < 75).length,
        excellent: analyzed.filter(p => p.healthScore >= 75).length,
    };

    const sortedByHealth = [...analyzed].sort((a, b) => a.healthScore - b.healthScore);
    const mapProduct = (p) => ({
        name: p.name, barcode: p.barcode, category: p.category,
        healthScore: p.healthScore, profitMargin: p.profitMargin,
        stock: p.stock, totalSold: p.totalSold, daysOfStock: p.daysOfStock,
        daysSinceLastSale: p.daysSinceLastSale, avgDailySales: p.avgDailySales,
        price: p.price, profit: p.profit,
    });

    // Notifications
    const notifications = [];
    const outOfStock = analyzed.filter(p => p.stock === 0 || p.isOutOfStock);
    if (outOfStock.length > 0) notifications.push({ type: "stock_alert", severity: "critical", icon: "🚨", title: "Stok Tükendi", message: `${outOfStock.length} ürün stokta yok`, count: outOfStock.length });
    const lowStock = analyzed.filter(p => p.isLowStock || (p.stock > 0 && p.daysOfStock < 5 && p.avgDailySales > 0));
    if (lowStock.length > 0) notifications.push({ type: "stock_warning", severity: "high", icon: "⚠️", title: "Düşük Stok", message: `${lowStock.length} ürünün stoğu kritik`, count: lowStock.length });
    const lossProducts = analyzed.filter(p => p.profit < 0 && p.totalSold > 0);
    if (lossProducts.length > 0) {
        const totalLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);
        notifications.push({ type: "profit_alert", severity: "critical", icon: "🔴", title: "Zarar Tespiti", message: `${lossProducts.length} ürün zararda — ${totalLoss.toFixed(0)}₺ kayıp`, count: lossProducts.length });
    }
    if (pendingCount > 5) notifications.push({ type: "pending_actions", severity: "info", icon: "📋", title: "Bekleyen Öneriler", message: `${pendingCount} öneri onayınızı bekliyor`, count: pendingCount });

    return {
        success: true,

        // Core AI
        score: aiScore,
        report,
        strategy,
        roi,
        timing,
        heatmap,
        retro,
        learning,
        goals,

        // Recommendations — tüm statüler (pending, approved, executed, rejected)
        recommendations: allRecs,
        recSummary,

        // Product Health
        productHealth: {
            segments,
            avgHealthScore: Math.round(analyzed.reduce((s, p) => s + p.healthScore, 0) / (analyzed.length || 1)),
            worstProducts: sortedByHealth.slice(0, 10).map(mapProduct),
            bestProducts: sortedByHealth.slice(-10).reverse().map(mapProduct),
        },

        // New Brain Engines
        businessHealth,
        lossHunter: lossHunterResult,
        focusItems,
        opportunityRadar,
        causeAnalysis,
        segmentation,
        context,
        emotionalTone,
        teachingTips,
        predictions,
        journal,
        selfEvaluation: selfEval,
        riskAssessment,
        decisionComparison,
        decisionHistory,

        // v5 — New Panels
        autoDecisions,
        diagnosis: diagnosisResult,
        moneyTracker,
        redAlerts,
        thoughtProcess,

        // Notifications
        notifications,
        productCount: analyzed.length,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// #50 AGENTIC THOUGHT PROCESS
// ═════════════════════════════════════════════════════════════════════════════

function generateThoughtProcess(analyzed, data, health, loss, predictions, redAlerts) {
    const steps = [];
    const now = new Date();

    // 1. Data Perception (Veri Algılama)
    steps.push({
        stage: "perception",
        title: "Veri Kanallarını Tarıyorum",
        content: `${analyzed.length} ürün ve ${data.orders30.length} son siparişi analiz ettim. Pazaryeri API'lerinden gelen sinyalleri işledim.`,
        status: "completed",
        icon: "📡"
    });

    // 2. Anomaly Detection (Anomali Tespiti)
    if (redAlerts.criticalCount > 0) {
        steps.push({
            stage: "anomaly",
            title: "Kritik Anomaliler Tespit Edildi",
            content: `${redAlerts.criticalCount} ürün acil müdahale gerektiriyor. Özellikle stok ve kârlılık dengesinde sapmalar var.`,
            status: "warning",
            icon: "🚨"
        });
    } else {
        steps.push({
            stage: "anomaly",
            title: "Sistem Stabil",
            content: "Operasyonel verilerde büyük bir anomali rastlanmadı. İyileştirme fırsatlarına odaklanıyorum.",
            status: "success",
            icon: "✅"
        });
    }

    // 3. Reasoning (Akıl Yürütme)
    const topRisk = redAlerts.alerts?.find(a => a.severity === "critical");
    const reasoningContent = topRisk 
        ? `Önceliğim ${topRisk.title}. Bu durum çözülmezse tahmini ${topRisk.amount || 0}₺'lik bir risk oluşabilir.`
        : "Satış ivmesini artırmak için envanter devir hızını optimize etmeye çalışıyorum.";
    
    steps.push({
        stage: "reasoning",
        title: "Stratejik Akıl Yürütme",
        content: reasoningContent,
        status: "processing",
        icon: "🧠"
    });

    // 4. Decision Formulation (Karar Formülasyonu)
    steps.push({
        stage: "decision",
        title: "Aksiyon Planı Hazır",
        content: "Onayınızı bekleyen öneriler ve otonom kararlar hazırlandı. Stratejinizi 'Kârlılık Odaklı' olarak güncellemenizi öneririm.",
        status: "pending",
        icon: "⚡"
    });

    return {
        timestamp: now,
        steps,
        summary: topRisk ? `Dikkat: ${topRisk.title} için acil aksiyon planladım.` : "Her şey yolunda, optimizasyon devam ediyor.",
        agentStatus: redAlerts.criticalCount > 0 ? "busy" : "idle"
    };
}

module.exports = {
    calculateBusinessHealth,
    huntLosses,
    generateFocusItems,
    scanOpportunities,
    analyzeCauses,
    segmentProducts,
    getDecisionHistory,
    getContextAwareness,
    getEmotionalTone,
    generateTeachingTips,
    explainDecision,
    generatePredictions,
    generateDailyJournal,
    selfEvaluate,
    assessRisks,
    compareDecisions,
    autoDecide,
    generateDiagnosis,
    trackMoney,
    generateRedAlerts,
    generateThoughtProcess,
    getFullBrainDashboard,
    fetchRecommendationsForBrainDashboard,
};
