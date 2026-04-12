/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI ENGINE SERVICE — LysiaETIC AI Decision Engine (v2 — Full Rewrite)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Production-ready AI business intelligence layer.
 * Data source: ProductMapping (primary), Order (persisted), Product (legacy fallback)
 *
 * MODULES:
 *  1.  Data Collection (ProductMapping + Order + Goals + Past Recs)
 *  2.  Product Analysis (health score, velocity, margin, depletion)
 *  3.  Recommendation Generator (7 types)
 *  4.  AI Score Calculator (pricing, stock, performance)
 *  5.  Timing AI (best hours/days)
 *  6.  Profit Heatmap (by category, marketplace, product)
 *  7.  Simulation Engine (what-if)
 *  8.  Daily Report / Journal
 *  9.  Strategy Engine (auto-detect + manual)
 * 10.  Retro Analysis (past mistakes, lost profit)
 * 11.  ROI Tracker
 * 12.  Goal Tracker
 * 13.  User Learning (accept/reject patterns)
 * 14.  Action Engine (execute on ProductMapping, idempotent)
 * 15.  Save Recommendations (deduplicated)
 * 16.  Order Sync Helper (persist marketplace orders to DB)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const Product = require("../models/Product");
const ProductMapping = require("../models/ProductMapping");
const Order = require("../models/Order");
const Recommendation = require("../models/Recommendation");
const AIGoal = require("../models/AIGoal");
const logger = require("../config/logger");

// ─── HELPERS ────────────────────────────────────────────────────────────────

const dayMs = 24 * 60 * 60 * 1000;

function calcProfit(price, costPrice, commissionRate, shippingCost, packagingCost, otherCost) {
    const commission = price * ((commissionRate || 0) / 100);
    return price - (costPrice || 0) - commission - (shippingCost || 0) - (packagingCost || 0) - (otherCost || 0);
}

function pct(a, b) { return b > 0 ? ((a / b) * 100) : 0; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round2(v) { return Math.round(v * 100) / 100; }
function daysAgo(d) { return Math.floor((Date.now() - new Date(d).getTime()) / dayMs); }

// Strategy multipliers
const STRATEGY = {
    balanced:         { priceWeight: 1.0, stockWeight: 1.0, profitWeight: 1.0 },
    aggressive_sales: { priceWeight: 0.7, stockWeight: 1.3, profitWeight: 0.6 },
    high_profit:      { priceWeight: 1.4, stockWeight: 0.8, profitWeight: 1.5 },
    stock_clearance:  { priceWeight: 0.5, stockWeight: 1.5, profitWeight: 0.4 },
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. DATA COLLECTION
// ═════════════════════════════════════════════════════════════════════════════

async function collectData(userId) {
    const now = new Date();
    const d7  = new Date(now - 7 * dayMs);
    const d30 = new Date(now - 30 * dayMs);
    const d90 = new Date(now - 90 * dayMs);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart - dayMs);

    const [
        productMappings,
        legacyProducts,
        orders30,
        orders90,
        ordersToday,
        ordersYesterday,
        goals,
        pastRecs
    ] = await Promise.all([
        ProductMapping.find({ userId }).lean(),
        Product.find({ userId, status: "active" }).lean(),
        Order.find({ user: userId, orderDate: { $gte: d30 }, isCancelled: { $ne: true } }).lean(),
        Order.find({ user: userId, orderDate: { $gte: d90 }, isCancelled: { $ne: true } }).lean(),
        Order.find({ user: userId, orderDate: { $gte: todayStart }, isCancelled: { $ne: true } }).lean(),
        Order.find({ user: userId, orderDate: { $gte: yesterdayStart, $lt: todayStart }, isCancelled: { $ne: true } }).lean(),
        AIGoal.find({ userId, status: "active" }).lean(),
        Recommendation.find({ userId, createdAt: { $gte: d30 } }).lean(),
    ]);

    // Convert ProductMappings to analysis-ready objects
    const mappedProducts = productMappings.map(pm => {
        const mp = pm.masterProduct || {};
        const mappings = pm.marketplaceMappings || [];
        const st = pm.stockTracking || {};
        const ss = pm.salesStats || {};

        const commissionRates = mappings.filter(m => m.commissionRate > 0).map(m => m.commissionRate);
        const avgCommission = commissionRates.length > 0
            ? commissionRates.reduce((s, r) => s + r, 0) / commissionRates.length
            : 0;

        const activeMappings = mappings.filter(m => m.isActive);
        const syncedMappings = mappings.filter(m => m.isActive && m.isSynced);

        return {
            _id: pm._id,
            userId: pm.userId,
            name: mp.name || "Bilinmeyen Ürün",
            barcode: mp.barcode || "",
            sku: mp.sku || "",
            category: mp.category || "Kategorisiz",
            brand: mp.brand || "",
            price: mp.price || 0,
            salePrice: mp.price || 0,
            listPrice: mp.listPrice || mp.price || 0,
            stock: st.totalStock || st.availableStock || mp.stock || 0,
            costPrice: mp.costPrice || 0,
            commissionRate: avgCommission,
            shippingCost: mp.shippingCost || 0,
            packagingCost: mp.packagingCost || 0,
            otherCost: 0,
            status: st.isOutOfStock ? "passive" : "active",
            _marketplaceCount: activeMappings.length,
            _syncedCount: syncedMappings.length,
            _marketplaces: activeMappings.map(m => m.marketplaceName),
            _isLowStock: st.isLowStock || false,
            _isOutOfStock: st.isOutOfStock || false,
            _totalSales: ss.totalSales || 0,
            _totalRevenue: ss.totalRevenue || 0,
            _lastSaleDate: ss.lastSaleDate || null,
            _lowStockThreshold: st.lowStockThreshold || 10,
            _safetyStock: st.safetyStock || 0,
            _createdAt: pm.createdAt,
            _updatedAt: pm.updatedAt,
            _mappingId: pm._id, // for action engine
        };
    });

    const products = mappedProducts.length > 0 ? mappedProducts : legacyProducts;
    const orders7 = orders30.filter(o => new Date(o.orderDate) >= d7);
    const hasOrderData = orders30.length > 0 || ordersToday.length > 0;

    logger.info(`[AI] collectData userId=${userId}: ${mappedProducts.length} mapped, ${legacyProducts.length} legacy, ${orders90.length} orders(90d), hasOrders=${hasOrderData}`);

    return { products, orders30, orders90, orders7, ordersToday, ordersYesterday, goals, pastRecs, now, todayStart, hasOrderData };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. PRODUCT ANALYSIS
// ═════════════════════════════════════════════════════════════════════════════

function analyzeProducts(products, orders90) {
    // Build sales map from persisted orders: barcode → stats
    const salesMap = {};
    for (const order of orders90) {
        for (const item of (order.items || [])) {
            const bc = item.barcode;
            if (!bc) continue;
            if (!salesMap[bc]) salesMap[bc] = { totalSold: 0, totalRevenue: 0, totalCost: 0, totalCommission: 0, lastSoldAt: null, dailySales: {}, returnCount: 0 };
            const s = salesMap[bc];
            s.totalSold += (item.quantity || 1);
            s.totalRevenue += (item.price || 0) * (item.quantity || 1);
            s.totalCost += (item.costPrice || 0) * (item.quantity || 1);
            s.totalCommission += (item.commissionAmount || 0);
            const dateKey = new Date(order.orderDate).toISOString().slice(0, 10);
            s.dailySales[dateKey] = (s.dailySales[dateKey] || 0) + (item.quantity || 1);
            if (!s.lastSoldAt || new Date(order.orderDate) > new Date(s.lastSoldAt)) {
                s.lastSoldAt = order.orderDate;
            }
            if (order.isReturned) s.returnCount += (item.quantity || 1);
        }
    }

    const hasOrderData = orders90.length > 0;

    return products.map(p => {
        const sales = salesMap[p.barcode] || { totalSold: 0, totalRevenue: 0, totalCost: 0, totalCommission: 0, lastSoldAt: null, dailySales: {}, returnCount: 0 };

        // Fallback: use ProductMapping salesStats when no order data
        if (sales.totalSold === 0 && p._totalSales > 0) {
            sales.totalSold = p._totalSales;
            sales.totalRevenue = p._totalRevenue || 0;
            if (p._lastSaleDate) sales.lastSoldAt = p._lastSaleDate;
        }

        const price = p.salePrice || p.price || 0;
        const profit = calcProfit(price, p.costPrice, p.commissionRate, p.shippingCost, p.packagingCost, p.otherCost);
        const profitMargin = price > 0 ? (profit / price) * 100 : 0;

        const dailyKeys = Object.keys(sales.dailySales);
        const activeDays = Math.max(dailyKeys.length, 1);
        const avgDailySales = sales.totalSold / 30;
        const velocity = sales.totalSold > 0 ? sales.totalSold / activeDays : 0;
        const daysOfStock = avgDailySales > 0 ? Math.floor(p.stock / avgDailySales) : (p.stock > 0 ? 999 : 0);
        const daysSinceLastSale = sales.lastSoldAt ? daysAgo(sales.lastSoldAt) : 999;
        const returnRate = sales.totalSold > 0 ? (sales.returnCount / sales.totalSold) * 100 : 0;

        // Product health score (0-100)
        let healthScore = 50;

        // Sales performance (+30)
        if (sales.totalSold > 20) healthScore += 30;
        else if (sales.totalSold > 5) healthScore += 20;
        else if (sales.totalSold > 0) healthScore += 10;
        else if (hasOrderData) healthScore -= 15;

        // Profitability (+25)
        if (profitMargin > 20) healthScore += 25;
        else if (profitMargin > 10) healthScore += 15;
        else if (profitMargin > 0) healthScore += 5;
        else if (p.costPrice > 0) healthScore -= 15;

        // Stock health (+15)
        if (p.stock === 0 || p._isOutOfStock) healthScore -= 20;
        else if (p._isLowStock || daysOfStock < 7) healthScore -= 10;
        else if (daysOfStock > 30) healthScore += 15;
        else healthScore += 10;

        // Return rate
        if (returnRate > 10) healthScore -= 10;
        else if (returnRate > 5) healthScore -= 5;

        // Recency (only with order data)
        if (hasOrderData) {
            if (daysSinceLastSale < 7) healthScore += 10;
            else if (daysSinceLastSale > 30) healthScore -= 10;
        }

        // Marketplace presence bonus
        if (p._marketplaceCount > 2) healthScore += 5;
        else if (p._marketplaceCount > 0) healthScore += 2;

        healthScore = clamp(healthScore, 0, 100);

        return {
            _id: p._id,
            _mappingId: p._mappingId,
            name: p.name,
            barcode: p.barcode,
            sku: p.sku || "",
            category: p.category,
            brand: p.brand || "",
            price,
            listPrice: p.listPrice || price,
            costPrice: p.costPrice || 0,
            commissionRate: p.commissionRate || 0,
            shippingCost: p.shippingCost || 0,
            stock: p.stock || 0,
            profit: round2(profit),
            profitMargin: round2(profitMargin),
            totalSold: sales.totalSold,
            totalRevenue: round2(sales.totalRevenue),
            avgDailySales: round2(avgDailySales),
            velocity: round2(velocity),
            marketplaceCount: p._marketplaceCount || 0,
            marketplaces: p._marketplaces || [],
            isLowStock: p._isLowStock || false,
            isOutOfStock: p._isOutOfStock || false,
            daysOfStock,
            daysSinceLastSale,
            returnRate: round2(returnRate),
            healthScore,
            lastSoldAt: sales.lastSoldAt,
            dailySales: sales.dailySales,
        };
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. RECOMMENDATION GENERATOR
// ═════════════════════════════════════════════════════════════════════════════

function generateRecommendations(analyzedProducts, data, strategyMode) {
    const recs = [];
    const sw = STRATEGY[strategyMode] || STRATEGY.balanced;
    const hasOrderData = data.hasOrderData;

    for (const p of analyzedProducts) {
        // ── PRICE OPTIMIZATION (low margin) ──
        if (p.profitMargin < 5 && p.costPrice > 0 && p.totalSold > 0) {
            const suggestedIncrease = Math.max(5, Math.ceil((10 - p.profitMargin) / 100 * p.price));
            const newPrice = p.price + suggestedIncrease;
            const newProfit = calcProfit(newPrice, p.costPrice, p.commissionRate, p.shippingCost, 0, 0);
            recs.push({
                type: "price_optimization",
                title: `Fiyat Artışı Önerisi: ${p.name.slice(0, 50)}`,
                description: `Kâr marjı çok düşük (%${p.profitMargin.toFixed(1)}). Fiyatı ${p.price.toFixed(0)}₺ → ${newPrice.toFixed(0)}₺ yaparak marjı artırın.`,
                category: "pricing",
                priority: p.profitMargin < 0 ? "critical" : "high",
                confidenceScore: clamp(Math.round(70 + (p.totalSold * 0.5) * sw.priceWeight), 40, 95),
                impact: {
                    profitChange: round2((newProfit - p.profit) * Math.max(p.avgDailySales * 30, 1)),
                    revenueChange: round2(suggestedIncrease * Math.max(p.avgDailySales * 30, 1)),
                    salesChange: Math.round(-p.avgDailySales * 0.05 * 30),
                    riskLevel: "low"
                },
                actionPayload: {
                    actionType: "update_price",
                    targetId: p.barcode,
                    targetName: p.name,
                    params: { oldPrice: p.price, newPrice, reason: "low_margin" }
                },
                relatedProducts: [p.barcode],
                strategyMode,
            });
        }

        // ── DYNAMIC PRICING (high margin + high demand) ──
        if (p.profitMargin > 25 && p.avgDailySales > 1 && p.stock > 20 && sw.profitWeight > 1) {
            const suggestedIncrease = Math.ceil(p.price * 0.05);
            recs.push({
                type: "dynamic_pricing",
                title: `Dinamik Fiyat Artışı: ${p.name.slice(0, 50)}`,
                description: `Yüksek talep + yüksek marj. Fiyatı %5 artırarak kârı optimize edin.`,
                category: "pricing",
                priority: "medium",
                confidenceScore: clamp(Math.round(60 + p.avgDailySales * 5), 40, 90),
                impact: {
                    profitChange: round2(suggestedIncrease * p.avgDailySales * 30 * 0.8),
                    revenueChange: round2(suggestedIncrease * p.avgDailySales * 30),
                    salesChange: Math.round(-p.avgDailySales * 0.03 * 30),
                    riskLevel: "low"
                },
                actionPayload: {
                    actionType: "update_price",
                    targetId: p.barcode,
                    targetName: p.name,
                    params: { oldPrice: p.price, newPrice: p.price + suggestedIncrease, reason: "high_demand_profit" }
                },
                relatedProducts: [p.barcode],
                strategyMode,
            });
        }

        // ── STOCK OPTIMIZATION (low stock with sales) ──
        if (p.stock > 0 && p.daysOfStock < 10 && p.avgDailySales > 0.3) {
            const restockQty = Math.ceil(p.avgDailySales * 30);
            recs.push({
                type: "stock_optimization",
                title: `Stok Uyarısı: ${p.name.slice(0, 50)}`,
                description: `Stok ${p.stock} adet, tahmini ${p.daysOfStock} gün yeter. ${restockQty} adet sipariş önerilir.`,
                category: "stock",
                priority: p.daysOfStock < 3 ? "critical" : "high",
                confidenceScore: clamp(Math.round(75 + p.avgDailySales * 3), 50, 95),
                impact: {
                    profitChange: round2(p.profit * restockQty * 0.8),
                    revenueChange: round2(p.price * restockQty),
                    salesChange: restockQty,
                    riskLevel: "low"
                },
                actionPayload: {
                    actionType: "create_stock_order",
                    targetId: p.barcode,
                    targetName: p.name,
                    params: { currentStock: p.stock, restockQuantity: restockQty, daysOfStock: p.daysOfStock }
                },
                relatedProducts: [p.barcode],
                strategyMode,
            });
        }

        // ── SMART RESTOCK (out of stock with history) ──
        if (p.stock === 0 && p.totalSold > 0) {
            const restockQty = Math.max(Math.ceil(p.avgDailySales * 30), 10);
            recs.push({
                type: "smart_restock",
                title: `Stok Tükendi: ${p.name.slice(0, 50)}`,
                description: `Stok sıfır! Son 90 günde ${p.totalSold} adet satıldı. Acil ${restockQty} adet tedarik edin.`,
                category: "stock",
                priority: "critical",
                confidenceScore: 90,
                impact: {
                    profitChange: round2(p.profit * restockQty * 0.7),
                    revenueChange: round2(p.price * restockQty),
                    salesChange: restockQty,
                    riskLevel: "medium"
                },
                actionPayload: {
                    actionType: "create_stock_order",
                    targetId: p.barcode,
                    targetName: p.name,
                    params: { currentStock: 0, restockQuantity: restockQty, urgency: "critical" }
                },
                relatedProducts: [p.barcode],
                strategyMode,
            });
        }

        // ── DEAD PRODUCT RECOVERY — "Pasife al" DEĞİL → "Nasıl satılır?" ──
        if (hasOrderData && p.daysSinceLastSale > 30 && p.stock > 0) {
            // Kademeli indirim stratejisi: ne kadar uzun süredir satılmıyorsa o kadar agresif indirim
            const discountPct = p.daysSinceLastSale > 90 ? 40 : p.daysSinceLastSale > 60 ? 30 : 15;

            // Satış stratejisi önerileri oluştur
            const strategies = [];
            if (p.daysSinceLastSale > 60) {
                strategies.push(`%${discountPct} indirimle fiyatı ${Math.round(p.price * (1 - discountPct / 100))}₺ yapın`);
                strategies.push("Ürünü kampanya/vitrin sayfasına ekleyin");
                strategies.push("Başka ürünlerle kombin/set oluşturun");
            } else {
                strategies.push(`%${discountPct} indirim uygulayın`);
                strategies.push("Ürün başlığı ve açıklamasını SEO uyumlu güncelleyin");
            }
            if (p.stock > 20) strategies.push("Çoklu alıma özel ek indirim tanımlayın");
            strategies.push("Sosyal medya veya reklam ile görünürlüğü artırın");

            recs.push({
                type: "dead_product",
                title: `Satış Bekleyen Ürün: ${p.name.slice(0, 50)}`,
                description: `${p.daysSinceLastSale} gündür satış yok, ${p.stock} adet stokta. Satış stratejisi: ${strategies[0]}. Ayrıca: ${strategies.slice(1).join(", ")}.`,
                category: "performance",
                priority: p.daysSinceLastSale > 60 ? "high" : "medium",
                confidenceScore: clamp(Math.round(60 + p.daysSinceLastSale * 0.3), 50, 90),
                impact: {
                    profitChange: round2(p.price * (1 - discountPct / 100) * p.stock * 0.3 * 0.7),
                    revenueChange: round2(p.price * (1 - discountPct / 100) * p.stock * 0.3),
                    salesChange: Math.ceil(p.stock * 0.3),
                    riskLevel: "medium"
                },
                actionPayload: {
                    actionType: "apply_discount",
                    targetId: p.barcode,
                    targetName: p.name,
                    params: { daysSinceLastSale: p.daysSinceLastSale, stock: p.stock, discountPercent: discountPct }
                },
                relatedProducts: [p.barcode],
                strategyMode,
            });
        }

        // ── TREND DETECTION (sales spike) ──
        if (p.dailySales && Object.keys(p.dailySales).length >= 7) {
            const entries = Object.entries(p.dailySales).sort((a, b) => a[0].localeCompare(b[0]));
            const recent7 = entries.slice(-7);
            const prev7 = entries.slice(-14, -7);
            if (recent7.length >= 5 && prev7.length >= 3) {
                const recentAvg = recent7.reduce((s, [, v]) => s + v, 0) / recent7.length;
                const prevAvg = prev7.reduce((s, [, v]) => s + v, 0) / prev7.length;
                if (prevAvg > 0 && recentAvg > prevAvg * 1.5) {
                    recs.push({
                        type: "trend_detection",
                        title: `Satış Artışı: ${p.name.slice(0, 50)}`,
                        description: `Son 7 günde satışlar %${Math.round(((recentAvg - prevAvg) / prevAvg) * 100)} arttı! Stok ve fiyat stratejinizi gözden geçirin.`,
                        category: "performance",
                        priority: "high",
                        confidenceScore: clamp(Math.round(65 + (recentAvg - prevAvg) * 10), 50, 92),
                        impact: {
                            profitChange: round2(p.profit * (recentAvg - prevAvg) * 30),
                            revenueChange: round2(p.price * (recentAvg - prevAvg) * 30),
                            salesChange: Math.round((recentAvg - prevAvg) * 30),
                            riskLevel: "low"
                        },
                        actionPayload: {
                            actionType: "review_strategy",
                            targetId: p.barcode,
                            targetName: p.name,
                            params: { recentAvg: round2(recentAvg), prevAvg: round2(prevAvg), growthPct: round2(((recentAvg - prevAvg) / prevAvg) * 100) }
                        },
                        relatedProducts: [p.barcode],
                        strategyMode,
                    });
                }
            }
        }

        // ── LOSS DETECTION (negative profit) ──
        if (p.profit < 0 && p.totalSold > 0) {
            const totalLoss = Math.abs(p.profit) * p.totalSold;
            recs.push({
                type: "loss_detection",
                title: `Zarar Tespiti: ${p.name.slice(0, 50)}`,
                description: `Bu ürün satış başına ${Math.abs(p.profit).toFixed(2)}₺ zarar ettiriyor! Son 90 günde toplam ${totalLoss.toFixed(0)}₺ kayıp.`,
                category: "financial",
                priority: "critical",
                confidenceScore: 95,
                impact: {
                    profitChange: round2(totalLoss),
                    revenueChange: 0,
                    salesChange: 0,
                    riskLevel: "high"
                },
                actionPayload: {
                    actionType: "update_price",
                    targetId: p.barcode,
                    targetName: p.name,
                    params: { oldPrice: p.price, newPrice: Math.ceil(p.costPrice * 1.15 + (p.shippingCost || 0)), reason: "loss_prevention" }
                },
                relatedProducts: [p.barcode],
                strategyMode,
            });
        }

        // ── ANOMALY DETECTION (sudden drop) ──
        if (p.dailySales && Object.keys(p.dailySales).length >= 14) {
            const entries = Object.entries(p.dailySales).sort((a, b) => a[0].localeCompare(b[0]));
            const recent3 = entries.slice(-3);
            const prev10 = entries.slice(-13, -3);
            if (recent3.length >= 2 && prev10.length >= 5) {
                const recentAvg = recent3.reduce((s, [, v]) => s + v, 0) / recent3.length;
                const prevAvg = prev10.reduce((s, [, v]) => s + v, 0) / prev10.length;
                if (prevAvg > 1 && recentAvg < prevAvg * 0.4) {
                    recs.push({
                        type: "anomaly_detection",
                        title: `Satış Düşüşü: ${p.name.slice(0, 50)}`,
                        description: `Son 3 günde satışlar %${Math.round(((prevAvg - recentAvg) / prevAvg) * 100)} düştü! Fiyat, stok veya rekabet kontrol edin.`,
                        category: "performance",
                        priority: "high",
                        confidenceScore: clamp(Math.round(60 + (prevAvg - recentAvg) * 5), 50, 88),
                        impact: {
                            profitChange: round2(-p.profit * (prevAvg - recentAvg) * 30),
                            revenueChange: round2(-p.price * (prevAvg - recentAvg) * 30),
                            salesChange: -Math.round((prevAvg - recentAvg) * 30),
                            riskLevel: "high"
                        },
                        actionPayload: {
                            actionType: "investigate",
                            targetId: p.barcode,
                            targetName: p.name,
                            params: { recentAvg: round2(recentAvg), prevAvg: round2(prevAvg), dropPct: round2(((prevAvg - recentAvg) / prevAvg) * 100) }
                        },
                        relatedProducts: [p.barcode],
                        strategyMode,
                    });
                }
            }
        }
    }

    // Sort by priority then confidence
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recs.sort((a, b) => {
        const pd = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
        if (pd !== 0) return pd;
        return (b.confidenceScore || 0) - (a.confidenceScore || 0);
    });

    return recs;
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. AI SCORE CALCULATOR
// ═════════════════════════════════════════════════════════════════════════════

function calculateAIScore(analyzedProducts, data) {
    const { orders30, orders7, ordersToday, hasOrderData } = data;
    const products = analyzedProducts;
    const total = products.length || 1;

    // ── Pricing Score ──
    const productsWithCost = products.filter(p => p.costPrice > 0);
    const avgMargin = productsWithCost.length > 0
        ? productsWithCost.reduce((s, p) => s + p.profitMargin, 0) / productsWithCost.length
        : -1;
    const lossProducts = products.filter(p => p.profit < 0 && p.costPrice > 0).length;

    let pricingScore = 50;
    if (avgMargin === -1) {
        pricingScore = 50; // neutral — no cost data
    } else if (avgMargin > 20) pricingScore += 30;
    else if (avgMargin > 10) pricingScore += 20;
    else if (avgMargin > 5) pricingScore += 10;
    else pricingScore -= 10;
    pricingScore -= Math.min(lossProducts * 3, 30);
    pricingScore = clamp(pricingScore, 0, 100);

    // ── Stock Score ──
    const inStock = products.filter(p => p.stock > 0).length;
    const outOfStock = products.filter(p => p.stock === 0 || p.isOutOfStock).length;
    const lowStock = products.filter(p => p.isLowStock).length;
    const inStockRatio = inStock / total;
    const outOfStockRatio = outOfStock / total;
    const lowStockRatio = lowStock / total;

    let stockScore = Math.round(inStockRatio * 60);
    stockScore -= Math.round(outOfStockRatio * 20);
    stockScore -= Math.round(lowStockRatio * 10);
    if (inStockRatio > 0.9) stockScore += 30;
    else if (inStockRatio > 0.7) stockScore += 20;
    else if (inStockRatio > 0.5) stockScore += 15;
    else stockScore += 5;
    stockScore = clamp(stockScore, 0, 100);

    // ── Performance Score ──
    const avgHealth = products.reduce((s, p) => s + p.healthScore, 0) / total;
    let performanceScore;

    if (hasOrderData) {
        const sellingProducts = products.filter(p => p.totalSold > 0).length;
        const deadProducts = products.filter(p => p.daysSinceLastSale > 30 && p.stock > 0).length;
        performanceScore = Math.round(avgHealth * 0.6);
        performanceScore += Math.round((sellingProducts / total) * 25);
        performanceScore -= Math.min(deadProducts * 2, 20);
        const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
        const avgDailyRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0) / 30;
        if (todayRevenue > avgDailyRevenue * 1.2) performanceScore += 10;
    } else {
        performanceScore = Math.round(avgHealth * 0.7);
        const multiMarketplace = products.filter(p => p.marketplaceCount > 1).length;
        performanceScore += Math.round((multiMarketplace / total) * 20);
        if (total > 100) performanceScore += 10;
        else if (total > 50) performanceScore += 5;
    }
    performanceScore = clamp(performanceScore, 0, 100);

    // ── Overall ──
    const overall = Math.round(pricingScore * 0.3 + stockScore * 0.3 + performanceScore * 0.4);

    // ── Explanations ──
    const explanations = [];
    if (avgMargin === -1) explanations.push("Ürün maliyet bilgileri eksik — maliyet girişi yapın");
    else if (avgMargin < 10) explanations.push(`Ortalama kâr marjı düşük (%${avgMargin.toFixed(1)})`);
    if (outOfStock > 0) explanations.push(`${outOfStock} ürün stokta yok`);
    if (lowStock > 0) explanations.push(`${lowStock} ürün düşük stokta`);
    if (lossProducts > 0) explanations.push(`${lossProducts} ürün zararda`);
    if (!hasOrderData) explanations.push("Sipariş verisi henüz yok — satış başladığında analiz zenginleşecek");
    if (total > 0 && inStock === total) explanations.push("Tüm ürünler stokta ✅");

    const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const avgDailyRevenue = orders30.length > 0 ? orders30.reduce((s, o) => s + (o.totalPrice || 0), 0) / 30 : 0;
    if (todayRevenue > avgDailyRevenue * 1.5 && todayRevenue > 0) explanations.push("Bugün satışlar ortalamanın üstünde! 🎉");
    if (explanations.length === 0) explanations.push("Genel durum iyi görünüyor ✅");

    return {
        overall: clamp(overall, 0, 100),
        pricingScore: clamp(pricingScore, 0, 100),
        stockScore: clamp(stockScore, 0, 100),
        performanceScore: clamp(performanceScore, 0, 100),
        rating: overall >= 80 ? "excellent" : overall >= 60 ? "good" : overall >= 40 ? "warning" : "critical",
        explanations,
        productCount: total,
        hasOrderData,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. TIMING AI
// ═════════════════════════════════════════════════════════════════════════════

function analyzeTimingPatterns(orders90) {
    const hourly = new Array(24).fill(0);
    const daily = new Array(7).fill(0);
    const hourlyRevenue = new Array(24).fill(0);
    const dailyRevenue = new Array(7).fill(0);

    for (const o of orders90) {
        const d = new Date(o.orderDate);
        hourly[d.getHours()]++;
        daily[d.getDay()]++;
        hourlyRevenue[d.getHours()] += (o.totalPrice || 0);
        dailyRevenue[d.getDay()] += (o.totalPrice || 0);
    }

    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const bestHour = hourly.indexOf(Math.max(...hourly));
    const bestDay = daily.indexOf(Math.max(...daily));
    const worstHour = hourly.indexOf(Math.min(...hourly));
    const worstDay = daily.indexOf(Math.min(...daily));

    return {
        hourlyOrders: hourly,
        dailyOrders: daily.map((count, i) => ({ day: dayNames[i], orders: count, revenue: round2(dailyRevenue[i]) })),
        bestHour: `${String(bestHour).padStart(2, "0")}:00`,
        bestDay: dayNames[bestDay],
        worstHour: `${String(worstHour).padStart(2, "0")}:00`,
        worstDay: dayNames[worstDay],
        peakHours: hourly.map((c, i) => ({ hour: `${String(i).padStart(2, "0")}:00`, orders: c, revenue: round2(hourlyRevenue[i]) })),
        suggestions: orders90.length > 0 ? [
            `En yoğun saat: ${String(bestHour).padStart(2, "0")}:00 — Kampanyalarınızı bu saatte başlatın`,
            `En yoğun gün: ${dayNames[bestDay]} — Özel indirimler planlayın`,
            `En düşük saat: ${String(worstHour).padStart(2, "0")}:00 — Flash sale ile canlandırın`,
        ] : ["Sipariş verisi toplandıkça zamanlama önerileri oluşacak"]
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. PROFIT HEATMAP
// ═════════════════════════════════════════════════════════════════════════════

function buildProfitHeatmap(analyzedProducts) {
    // By category
    const catMap = {};
    for (const p of analyzedProducts) {
        const cat = p.category || "Diğer";
        if (!catMap[cat]) catMap[cat] = { category: cat, totalRevenue: 0, totalProfit: 0, productCount: 0 };
        catMap[cat].totalRevenue += p.totalRevenue;
        catMap[cat].totalProfit += p.profit * Math.max(p.totalSold, 0);
        catMap[cat].productCount++;
    }
    const byCategory = Object.values(catMap).map(c => ({
        ...c,
        totalProfit: round2(c.totalProfit),
        totalRevenue: round2(c.totalRevenue),
        avgMargin: c.totalRevenue > 0 ? round2((c.totalProfit / c.totalRevenue) * 100) : 0,
        zone: c.totalProfit > 0 ? (c.totalRevenue > 0 && (c.totalProfit / c.totalRevenue) > 0.15 ? "high_profit" : "moderate") : "loss"
    })).sort((a, b) => b.totalProfit - a.totalProfit);

    // By marketplace
    const mpMap = {};
    for (const p of analyzedProducts) {
        for (const mp of (p.marketplaces || [])) {
            if (!mpMap[mp]) mpMap[mp] = { marketplace: mp, productCount: 0, totalRevenue: 0, totalProfit: 0 };
            mpMap[mp].productCount++;
            mpMap[mp].totalRevenue += p.totalRevenue / Math.max(p.marketplaceCount, 1);
            mpMap[mp].totalProfit += (p.profit * Math.max(p.totalSold, 0)) / Math.max(p.marketplaceCount, 1);
        }
    }
    const byMarketplace = Object.values(mpMap).map(m => ({
        ...m,
        totalProfit: round2(m.totalProfit),
        totalRevenue: round2(m.totalRevenue),
        avgMargin: m.totalRevenue > 0 ? round2((m.totalProfit / m.totalRevenue) * 100) : 0,
        zone: m.totalProfit > 0 ? "high_profit" : "loss"
    }));

    // Top products
    const byProduct = analyzedProducts
        .filter(p => p.totalSold > 0 || p.costPrice > 0)
        .sort((a, b) => (b.profit * b.totalSold) - (a.profit * a.totalSold))
        .slice(0, 20)
        .map(p => ({
            name: p.name,
            barcode: p.barcode,
            totalProfit: round2(p.profit * p.totalSold),
            profitMargin: p.profitMargin,
            totalSold: p.totalSold,
            zone: p.profitMargin > 15 ? "high_profit" : p.profitMargin > 0 ? "moderate" : "loss"
        }));

    return { byCategory, byMarketplace, byProduct };
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. SIMULATION ENGINE
// ═════════════════════════════════════════════════════════════════════════════

// ── Price Elasticity by Category (Bug #8 fix — was hardcoded at -1.2) ──
const CATEGORY_ELASTICITY = {
    "Elektronik":     -0.8,   // Low elasticity — people need electronics
    "Telefon":        -0.7,
    "Bilgisayar":     -0.8,
    "Giyim":          -1.5,   // High elasticity — fashion is price-sensitive
    "Ayakkabı":       -1.4,
    "Kozmetik":       -1.3,
    "Kişisel Bakım":  -1.2,
    "Ev & Yaşam":     -1.1,
    "Mutfak":         -1.0,
    "Spor":           -1.2,
    "Oyuncak":        -1.3,
    "Kitap":          -0.6,   // Very low elasticity
    "Gıda":           -0.9,
    "Bebek":          -0.7,   // Parents buy regardless
    "Otomotiv":       -0.8,
    "Bahçe":          -1.1,
    "Pet":            -0.9,
    "Takı":           -1.6,   // Luxury = high elasticity
    "Saat":           -1.4,
    "default":        -1.1,   // Balanced default
};

function getElasticity(category) {
    if (!category) return CATEGORY_ELASTICITY.default;
    const cat = category.toLowerCase();
    for (const [key, val] of Object.entries(CATEGORY_ELASTICITY)) {
        if (key === "default") continue;
        if (cat.includes(key.toLowerCase())) return val;
    }
    return CATEGORY_ELASTICITY.default;
}

function simulate(analyzedProducts, params) {
    const { barcode, priceChangePct, stockChange, campaignDiscountPct } = params;

    let targets = analyzedProducts;
    if (barcode) targets = analyzedProducts.filter(p => p.barcode === barcode);
    if (targets.length === 0) return { error: "Ürün bulunamadı" };

    const results = targets.map(p => {
        const priceMult = 1 + ((priceChangePct || 0) / 100);
        const newPrice = p.price * priceMult;
        const discountedPrice = campaignDiscountPct ? newPrice * (1 - campaignDiscountPct / 100) : newPrice;

        // Category-based elasticity instead of hardcoded -1.2
        const elasticity = getElasticity(p.category);
        const salesMult = 1 + (elasticity * (priceChangePct || 0) / 100);
        const campaignBoost = campaignDiscountPct ? 1 + (campaignDiscountPct / 100) * 0.8 : 1;
        const newDailySales = Math.max(0, p.avgDailySales * salesMult * campaignBoost);

        const newProfit = calcProfit(discountedPrice, p.costPrice, p.commissionRate, p.shippingCost, 0, 0);
        const newStock = p.stock + (stockChange || 0);
        const newDaysOfStock = newDailySales > 0 ? Math.floor(newStock / newDailySales) : 999;

        const monthlyRevenueBefore = p.price * p.avgDailySales * 30;
        const monthlyRevenueAfter = discountedPrice * newDailySales * 30;
        const monthlyProfitBefore = p.profit * p.avgDailySales * 30;
        const monthlyProfitAfter = newProfit * newDailySales * 30;

        return {
            name: p.name,
            barcode: p.barcode,
            current: {
                price: round2(p.price), dailySales: round2(p.avgDailySales),
                monthlyRevenue: round2(monthlyRevenueBefore), monthlyProfit: round2(monthlyProfitBefore),
                profitMargin: round2(p.profitMargin), daysOfStock: p.daysOfStock,
            },
            simulated: {
                price: round2(discountedPrice), dailySales: round2(newDailySales),
                monthlyRevenue: round2(monthlyRevenueAfter), monthlyProfit: round2(monthlyProfitAfter),
                profitMargin: discountedPrice > 0 ? round2((newProfit / discountedPrice) * 100) : 0,
                daysOfStock: newDaysOfStock,
            },
            changes: {
                revenueChange: round2(monthlyRevenueAfter - monthlyRevenueBefore),
                profitChange: round2(monthlyProfitAfter - monthlyProfitBefore),
                salesChange: round2((newDailySales - p.avgDailySales) * 30),
            },
            riskLevel: Math.abs(priceChangePct || 0) > 20 ? "high" : Math.abs(priceChangePct || 0) > 10 ? "medium" : "low",
        };
    });

    return {
        products: results,
        summary: {
            totalRevenueChange: round2(results.reduce((s, r) => s + r.changes.revenueChange, 0)),
            totalProfitChange: round2(results.reduce((s, r) => s + r.changes.profitChange, 0)),
            productsAffected: results.length,
            overallRisk: results.some(r => r.riskLevel === "high") ? "high" : results.some(r => r.riskLevel === "medium") ? "medium" : "low",
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. DAILY REPORT / JOURNAL
// ═════════════════════════════════════════════════════════════════════════════

function generateDailyReport(analyzedProducts, data, aiScore) {
    const { ordersToday, ordersYesterday, orders30, orders7, hasOrderData } = data;

    const todayRevenue = ordersToday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const yesterdayRevenue = ordersYesterday.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const todayProfit = ordersToday.reduce((s, o) => s + (o.costSummary?.netProfit || 0), 0);
    const weekRevenue = orders7.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const monthRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const avgDailyRevenue = monthRevenue / 30;

    // Problems
    const problems = [];
    const outOfStock = analyzedProducts.filter(p => p.stock === 0 || p.isOutOfStock);
    if (outOfStock.length > 0) problems.push({ icon: "🚨", text: `${outOfStock.length} ürün stokta yok — satış kaybı riski`, severity: "critical" });
    const lossProducts = analyzedProducts.filter(p => p.profit < 0 && p.costPrice > 0);
    if (lossProducts.length > 0) problems.push({ icon: "🔴", text: `${lossProducts.length} ürün zararda satılıyor`, severity: "critical" });
    const lowStockProducts = analyzedProducts.filter(p => p.isLowStock && p.stock > 0);
    if (lowStockProducts.length > 0) problems.push({ icon: "⚠️", text: `${lowStockProducts.length} ürün düşük stokta`, severity: "high" });
    const deadProducts = hasOrderData ? analyzedProducts.filter(p => p.daysSinceLastSale > 30 && p.stock > 0) : [];
    if (deadProducts.length > 0) problems.push({ icon: "💀", text: `${deadProducts.length} ürün 30+ gündür satılmıyor — indirim + kampanya ile satışa dönüştürün`, severity: "high" });
    const noCostData = analyzedProducts.filter(p => p.costPrice === 0).length;
    if (noCostData > analyzedProducts.length * 0.5) problems.push({ icon: "📝", text: `${noCostData} üründe maliyet bilgisi eksik`, severity: "medium" });

    // Opportunities
    const opportunities = [];
    if (hasOrderData) {
        const trendingUp = analyzedProducts.filter(p => p.velocity > p.avgDailySales * 1.5 && p.totalSold > 5);
        if (trendingUp.length > 0) opportunities.push({ icon: "🔥", text: `${trendingUp.length} ürün yükseliş trendinde — stok artırın`, potential: "high" });
    }
    const highMargin = analyzedProducts.filter(p => p.profitMargin > 25 && p.costPrice > 0 && p.stock > 10);
    if (highMargin.length > 0) opportunities.push({ icon: "💰", text: `${highMargin.length} yüksek marjlı ürün — pazarlamayı artırın`, potential: "high" });
    if (todayRevenue > avgDailyRevenue * 1.3 && todayRevenue > 0) opportunities.push({ icon: "📈", text: `Bugün satışlar ortalamanın %${Math.round(((todayRevenue - avgDailyRevenue) / avgDailyRevenue) * 100)} üstünde!`, potential: "medium" });
    const singleMp = analyzedProducts.filter(p => p.marketplaceCount === 1 && p.stock > 0);
    if (singleMp.length > 50) opportunities.push({ icon: "🚀", text: `${singleMp.length} ürün tek pazaryerinde — diğer kanallara açın`, potential: "high" });

    // Actions
    const actions = [];
    if (outOfStock.length > 0) actions.push({ icon: "📦", text: `${outOfStock[0].name.slice(0, 40)} için acil stok tedarik edin`, impact: "high" });
    if (lossProducts.length > 0) actions.push({ icon: "💰", text: `${lossProducts[0].name.slice(0, 40)} fiyatını artırın (zarar: ${Math.abs(lossProducts[0].profit).toFixed(0)}₺/adet)`, impact: "high" });
    if (lowStockProducts.length > 0) actions.push({ icon: "⚠️", text: `${lowStockProducts.length} düşük stoklu ürün için tedarik planlayın`, impact: "high" });
    if (noCostData > 0) actions.push({ icon: "📝", text: `${noCostData} ürüne maliyet bilgisi girin`, impact: "medium" });
    if (singleMp.length > 50) actions.push({ icon: "🏪", text: `Tek kanaldaki ürünleri diğer pazaryerlerine dağıtın`, impact: "medium" });
    if (actions.length < 3) actions.push({ icon: "📊", text: "Ürün fiyatlarını ve marjları gözden geçirin", impact: "medium" });

    return {
        date: new Date().toISOString().slice(0, 10),
        summary: {
            todayRevenue: round2(todayRevenue),
            yesterdayRevenue: round2(yesterdayRevenue),
            todayOrders: ordersToday.length,
            yesterdayOrders: ordersYesterday.length,
            todayProfit: round2(todayProfit),
            weekRevenue: round2(weekRevenue),
            monthRevenue: round2(monthRevenue),
            revenueChange: yesterdayRevenue > 0 ? round2(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : 0,
        },
        aiScore,
        problems: problems.slice(0, 5),
        opportunities: opportunities.slice(0, 5),
        actions: actions.slice(0, 5),
        productStats: {
            total: analyzedProducts.length,
            active: analyzedProducts.filter(p => p.stock > 0).length,
            selling: analyzedProducts.filter(p => p.totalSold > 0).length,
            outOfStock: outOfStock.length,
            lowStock: lowStockProducts.length,
            dead: deadProducts.length,
            inLoss: lossProducts.length,
            noCostData,
            avgHealthScore: Math.round(analyzedProducts.reduce((s, p) => s + p.healthScore, 0) / (analyzedProducts.length || 1)),
            hasOrderData,
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. STRATEGY ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function detectOptimalStrategy(analyzedProducts, data) {
    const { orders7, orders30, hasOrderData } = data;
    const products = analyzedProducts;

    const avgStock = products.reduce((s, p) => s + p.stock, 0) / (products.length || 1);
    const productsWithCost = products.filter(p => p.costPrice > 0);
    const avgMargin = productsWithCost.length > 0
        ? productsWithCost.reduce((s, p) => s + p.profitMargin, 0) / productsWithCost.length
        : 50;
    const deadCount = hasOrderData ? products.filter(p => p.daysSinceLastSale > 30 && p.stock > 0).length : 0;
    const deadRatio = deadCount / (products.length || 1);

    const weekRevenue = orders7.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const monthRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const weeklyAvg = weekRevenue / 7;
    const monthlyAvg = monthRevenue / 30;
    const salesTrend = monthlyAvg > 0 ? ((weeklyAvg - monthlyAvg) / monthlyAvg) * 100 : 0;

    let recommended = "balanced";
    let reason = "Dengeli strateji uygulanıyor";

    if (avgStock > 50 && deadRatio > 0.3) {
        recommended = "stock_clearance";
        reason = `Yüksek stok (ort: ${Math.round(avgStock)}) ve %${Math.round(deadRatio * 100)} satış bekleyen ürün — indirim + kampanya ile stok eritme modu önerilir`;
    } else if (salesTrend > 20) {
        recommended = "high_profit";
        reason = `Satışlar yükselişte (+%${Math.round(salesTrend)}) — kâr maksimizasyonu modu önerilir`;
    } else if (salesTrend < -15) {
        recommended = "aggressive_sales";
        reason = `Satışlar düşüşte (%${Math.round(salesTrend)}) — agresif satış modu önerilir`;
    } else if (avgMargin > 20) {
        recommended = "high_profit";
        reason = `Yüksek marj (%${avgMargin.toFixed(1)}) — kâr odaklı strateji önerilir`;
    }

    return {
        current: "balanced",
        recommended,
        reason,
        options: [
            { id: "balanced", name: "Dengeli", icon: "⚖️", description: "Satış ve kâr dengesi" },
            { id: "aggressive_sales", name: "Agresif Satış", icon: "🚀", description: "Satış hacmini artır, marjı düşür" },
            { id: "high_profit", name: "Yüksek Kâr", icon: "💰", description: "Kâr marjını maksimize et" },
            { id: "stock_clearance", name: "Stok Eritme", icon: "📦", description: "İndirim + kampanya + set/kombin ile satış bekleyen stokları eritin" },
        ],
        metrics: { avgStock: Math.round(avgStock), avgMargin: round2(avgMargin), deadRatio: round2(deadRatio * 100), salesTrend: round2(salesTrend) }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. RETRO ANALYSIS
// ═════════════════════════════════════════════════════════════════════════════

function retroAnalysis(analyzedProducts, data) {
    const { pastRecs } = data;
    const mistakes = [];
    let totalLostProfit = 0;

    const lossProducts = analyzedProducts.filter(p => p.profit < 0 && p.totalSold > 0);
    for (const p of lossProducts) {
        const lost = Math.abs(p.profit) * p.totalSold;
        totalLostProfit += lost;
        mistakes.push({
            type: "pricing_mistake", product: p.name, barcode: p.barcode,
            lostAmount: round2(lost),
            description: `${p.name.slice(0, 40)} zararda satıldı — ${p.totalSold} adet × ${Math.abs(p.profit).toFixed(0)}₺ = ${lost.toFixed(0)}₺ kayıp`
        });
    }

    const missedSales = analyzedProducts.filter(p => p.stock === 0 && p.avgDailySales > 0.5);
    for (const p of missedSales) {
        const missedDays = Math.min(p.daysSinceLastSale, 30);
        const missedProfit = Math.max(p.profit, 0) * p.avgDailySales * missedDays;
        totalLostProfit += missedProfit;
        mistakes.push({
            type: "stock_mistake", product: p.name, barcode: p.barcode,
            lostAmount: round2(missedProfit),
            description: `${p.name.slice(0, 40)} stok tükendi — tahmini ${missedDays} gün kaçırılan satış`
        });
    }

    const approvedRecs = pastRecs.filter(r => r.status === "approved" || r.status === "executed");
    const rejectedRecs = pastRecs.filter(r => r.status === "rejected");

    return {
        mistakes: mistakes.slice(0, 10),
        totalLostProfit: round2(totalLostProfit),
        summary: totalLostProfit > 0 ? `Son 30 günde tahmini ${totalLostProfit.toFixed(0)}₺ kayıp tespit edildi` : "Tespit edilen kayıp yok",
        recStats: {
            total: pastRecs.length,
            approved: approvedRecs.length,
            rejected: rejectedRecs.length,
            pending: pastRecs.filter(r => r.status === "pending").length,
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. ROI TRACKER
// ═════════════════════════════════════════════════════════════════════════════

function calculateROI(pastRecs) {
    const executed = pastRecs.filter(r => r.status === "executed" && r.executionResult?.success);
    const totalProfitGenerated = executed.reduce((s, r) => s + (r.impact?.profitChange || 0), 0);
    const totalRevenueGenerated = executed.reduce((s, r) => s + (r.impact?.revenueChange || 0), 0);

    return {
        totalExecuted: executed.length,
        totalProfitGenerated: round2(totalProfitGenerated),
        totalRevenueGenerated: round2(totalRevenueGenerated),
        message: totalProfitGenerated > 0
            ? `AI bu ay +${totalProfitGenerated.toFixed(0)}₺ ek kâr sağladı`
            : "Henüz uygulanan öneri yok — önerileri onaylayarak kazanmaya başlayın",
        byType: executed.reduce((acc, r) => {
            acc[r.type] = (acc[r.type] || 0) + (r.impact?.profitChange || 0);
            return acc;
        }, {}),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. GOAL TRACKER
// ═════════════════════════════════════════════════════════════════════════════

function updateGoalProgress(goals, data) {
    const { orders30, ordersToday } = data;
    const monthRevenue = orders30.reduce((s, o) => s + (o.totalPrice || 0), 0);
    const monthProfit = orders30.reduce((s, o) => s + (o.costSummary?.netProfit || 0), 0);
    const monthSales = orders30.length;

    return goals.map(g => {
        let currentValue = 0;
        if (g.goalType === "revenue") currentValue = monthRevenue;
        else if (g.goalType === "profit") currentValue = monthProfit;
        else if (g.goalType === "sales") currentValue = monthSales;

        const progressPercent = g.targetValue > 0 ? clamp(Math.round((currentValue / g.targetValue) * 100), 0, 100) : 0;
        const daysLeft = Math.max(0, Math.ceil((new Date(g.endDate) - Date.now()) / dayMs));
        const remaining = Math.max(0, g.targetValue - currentValue);
        const dailyTarget = daysLeft > 0 ? round2(remaining / daysLeft) : remaining;

        return {
            ...g,
            currentValue: round2(currentValue),
            progressPercent,
            daysLeft,
            dailyTarget,
            onTrack: progressPercent >= (100 - (daysLeft / 30 * 100)),
            status: progressPercent >= 100 ? "completed" : g.status,
        };
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. USER LEARNING
// ═════════════════════════════════════════════════════════════════════════════

function analyzeUserPreferences(pastRecs) {
    const approved = pastRecs.filter(r => r.status === "approved" || r.status === "executed");
    const rejected = pastRecs.filter(r => r.status === "rejected");

    const typePrefs = {};
    for (const r of approved) {
        typePrefs[r.type] = (typePrefs[r.type] || { approved: 0, rejected: 0 });
        typePrefs[r.type].approved++;
    }
    for (const r of rejected) {
        typePrefs[r.type] = (typePrefs[r.type] || { approved: 0, rejected: 0 });
        typePrefs[r.type].rejected++;
    }

    const preferences = Object.entries(typePrefs).map(([type, counts]) => ({
        type,
        approved: counts.approved,
        rejected: counts.rejected,
        acceptanceRate: round2(pct(counts.approved, counts.approved + counts.rejected)),
    }));

    return {
        preferences,
        totalApproved: approved.length,
        totalRejected: rejected.length,
        overallAcceptanceRate: round2(pct(approved.length, approved.length + rejected.length)),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// 14. ACTION ENGINE — Execute on ProductMapping (idempotent)
// ═════════════════════════════════════════════════════════════════════════════

async function executeRecommendation(recId, userId) {
    const rec = await Recommendation.findOne({ _id: recId, userId });
    if (!rec) throw new Error("Öneri bulunamadı");
    if (rec.status === "executed") throw new Error("Bu öneri zaten uygulandı (idempotent)");
    if (rec.status !== "approved") throw new Error("Öneri henüz onaylanmadı");

    // Idempotency check
    if (rec.executionKey) {
        const existing = await Recommendation.findOne({ executionKey: rec.executionKey, status: "executed" });
        if (existing) throw new Error("Bu aksiyon zaten uygulandı (duplicate)");
    }

    const { actionType, targetId, params } = rec.actionPayload || {};
    let result = { success: false, message: "Bilinmeyen aksiyon tipi" };

    try {
        switch (actionType) {
            case "update_price": {
                // Try ProductMapping first, then legacy Product
                const pm = await ProductMapping.findOne({ userId, "masterProduct.barcode": targetId });
                if (pm) {
                    pm.masterProduct.price = params.newPrice;
                    pm.updatedAt = new Date();
                    pm.addSyncLog("price_update", "AI Engine", params.oldPrice, params.newPrice, "success", `AI fiyat güncelleme: ${params.oldPrice}₺ → ${params.newPrice}₺`);
                    await pm.save();
                    result = { success: true, message: `${pm.masterProduct.name} fiyatı ${params.oldPrice}₺ → ${params.newPrice}₺ güncellendi`, data: { oldPrice: params.oldPrice, newPrice: params.newPrice } };
                } else {
                    const product = await Product.findOne({ userId, barcode: targetId });
                    if (!product) { result = { success: false, message: "Ürün bulunamadı" }; break; }
                    product.salePrice = params.newPrice;
                    product.price = params.newPrice;
                    await product.save();
                    result = { success: true, message: `${product.name} fiyatı güncellendi`, data: { oldPrice: params.oldPrice, newPrice: params.newPrice } };
                }
                break;
            }
            case "apply_discount": {
                const pm = await ProductMapping.findOne({ userId, "masterProduct.barcode": targetId });
                if (pm) {
                    const discountedPrice = Math.round(pm.masterProduct.price * (1 - (params.discountPercent || 10) / 100));
                    const oldPrice = pm.masterProduct.price;
                    pm.masterProduct.price = discountedPrice;
                    pm.updatedAt = new Date();
                    pm.addSyncLog("price_update", "AI Engine", oldPrice, discountedPrice, "success", `AI indirim: %${params.discountPercent}`);
                    await pm.save();
                    result = { success: true, message: `${pm.masterProduct.name} fiyatı %${params.discountPercent} indirimle ${discountedPrice}₺ yapıldı` };
                } else {
                    result = { success: false, message: "Ürün bulunamadı" };
                }
                break;
            }
            case "mark_inactive": {
                // ✅ FIX: "Pasife al" yerine "Nasıl satılır?" felsefesi — artık pasife almıyoruz
                // Eski öneriler bu action type ile gelebilir, onları indirim olarak yönlendir
                const pm = await ProductMapping.findOne({ userId, "masterProduct.barcode": targetId });
                if (pm) {
                    const currentPrice = pm.masterProduct?.price || 0;
                    const discountPct = 15;
                    const discountedPrice = Math.round(currentPrice * (1 - discountPct / 100));
                    if (currentPrice > 0) {
                        pm.masterProduct.price = discountedPrice;
                        pm.updatedAt = new Date();
                        pm.addSyncLog("price_update", "AI Engine", String(currentPrice), String(discountedPrice), "success", `AI satış stratejisi: %${discountPct} indirim uygulandı`);
                        await pm.save();
                        result = { success: true, message: `${pm.masterProduct.name} için %${discountPct} indirim uygulandı (${currentPrice}₺ → ${discountedPrice}₺). Satış stratejisi aktif.` };
                    } else {
                        result = { success: true, message: `${pm.masterProduct.name} için satış stratejisi notu oluşturuldu. Fiyat bilgisi eksik — manuel kontrol edin.` };
                    }
                } else {
                    result = { success: false, message: "Ürün bulunamadı" };
                }
                break;
            }
            case "create_stock_order": {
                // Log the stock order request — actual ordering requires manual action
                logger.info(`🤖 [AI ACTION] Stok siparişi talebi: ${rec.actionPayload.targetName} — ${params.restockQuantity} adet`);
                result = {
                    success: true,
                    message: `${rec.actionPayload.targetName} için ${params.restockQuantity} adet stok siparişi notu oluşturuldu. ⚠️ Tedarikçiye manuel sipariş vermeniz gerekiyor.`,
                    data: { ...params, requiresManualAction: true },
                };
                break;
            }
            case "review_strategy": {
                // Mark as reviewed — no automated action possible
                logger.info(`🤖 [AI ACTION] Strateji inceleme notu: ${rec.actionPayload.targetName}`);
                result = {
                    success: true,
                    message: `${rec.actionPayload.targetName} strateji inceleme notu kaydedildi. Büyüme: %${params.growthPct?.toFixed(1) || "N/A"}. ⚠️ Manuel strateji değerlendirmesi önerilir.`,
                    data: { ...params, requiresManualAction: true },
                };
                break;
            }
            case "investigate": {
                // Mark as investigated — no automated action possible
                logger.info(`🤖 [AI ACTION] İnceleme notu: ${rec.actionPayload.targetName} — düşüş %${params.dropPct?.toFixed(1) || "N/A"}`);
                result = {
                    success: true,
                    message: `${rec.actionPayload.targetName} inceleme notu kaydedildi. Satış düşüşü: %${params.dropPct?.toFixed(1) || "N/A"}. ⚠️ Fiyat, stok ve rekabet durumunu manuel kontrol edin.`,
                    data: { ...params, requiresManualAction: true },
                };
                break;
            }
            default:
                result = { success: false, message: `Bilinmeyen aksiyon: ${actionType}` };
        }
    } catch (err) {
        result = { success: false, message: err.message };
    }

    // Update recommendation
    rec.status = result.success ? "executed" : "failed";
    rec.executedAt = new Date();
    rec.executionResult = result;
    if (!rec.executionKey) rec.executionKey = `${rec._id}_${Date.now()}`;
    await rec.save();

    logger.info(`🤖 [AI ACTION] ${result.success ? "✅" : "❌"} ${actionType} — ${result.message}`);
    return { recommendation: rec, result };
}

// ═════════════════════════════════════════════════════════════════════════════
// 15. SAVE RECOMMENDATIONS TO DB (deduplicated)
// ═════════════════════════════════════════════════════════════════════════════

async function saveRecommendations(userId, recs, strategyMode) {
    // Expire old pending (24 saatten eski)
    await Recommendation.updateMany(
        { userId, status: "pending", createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { $set: { status: "expired" } }
    );

    // ✅ Eski "pasife al" / "Ölü Ürün" önerilerini kalıcı olarak SİL — artık bu felsefe kullanılmıyor
    await Recommendation.deleteMany(
        { userId, $or: [
            { "actionPayload.actionType": "mark_inactive" },
            { description: { $regex: /[Pp]asife al/i } },
            { title: { $regex: /Ölü Ürün/i } },
        ]}
    );

    // Deduplicate
    const existingPending = await Recommendation.find({ userId, status: "pending" }).lean();
    const existingKeys = new Set(existingPending.map(r => `${r.type}_${r.actionPayload?.targetId}`));

    const toInsert = [];
    for (const rec of recs.slice(0, 50)) {
        const key = `${rec.type}_${rec.actionPayload?.targetId}`;
        if (existingKeys.has(key)) continue;
        toInsert.push({
            userId, ...rec,
            status: "pending",
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        });
    }

    if (toInsert.length > 0) {
        await Recommendation.insertMany(toInsert);
        logger.info(`🤖 [AI] ${toInsert.length} yeni öneri kaydedildi (userId: ${userId})`);
    }

    return toInsert.length;
}

// ═════════════════════════════════════════════════════════════════════════════
// 16. ORDER SYNC HELPER — Persist marketplace orders to local DB
// ═════════════════════════════════════════════════════════════════════════════

async function syncOrdersToDB(userId, marketplaceName, orders) {
    if (!orders || orders.length === 0) return { synced: 0, skipped: 0 };

    let synced = 0;
    let skipped = 0;

    for (const order of orders) {
        try {
            const orderNumber = order.orderNumber || order.id;
            if (!orderNumber) { skipped++; continue; }

            // Check if already exists (idempotent)
            const exists = await Order.findOne({ user: userId, "items.barcode": { $exists: true }, trackingNumber: String(orderNumber) });
            if (exists) { skipped++; continue; }

            // Normalize order data
            const items = (order.items || order.lines || []).map(item => ({
                productName: item.productName || item.title || item.name || "Bilinmeyen",
                quantity: item.quantity || 1,
                barcode: item.barcode || item.productBarcode || "",
                price: item.price || item.unitPrice || 0,
                category: item.category || "Bilinmiyor",
            }));

            if (items.length === 0) {
                items.push({
                    productName: order.productName || "Sipariş Ürünü",
                    quantity: 1,
                    barcode: order.barcode || "",
                    price: order.totalPrice || 0,
                    category: "Bilinmiyor",
                });
            }

            const newOrder = new Order({
                user: userId,
                marketplaceName,
                totalPrice: order.totalPrice || order.grossAmount || 0,
                orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
                status: order.status || "Created",
                trackingNumber: String(orderNumber),
                items,
            });

            await newOrder.save();
            synced++;
        } catch (err) {
            if (err.code === 11000) { skipped++; continue; } // duplicate
            logger.warn(`[AI] Order sync error: ${err.message}`);
            skipped++;
        }
    }

    if (synced > 0) {
        logger.info(`🤖 [AI] Order sync: ${synced} new, ${skipped} skipped for ${marketplaceName}`);
    }

    return { synced, skipped };
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    collectData,
    analyzeProducts,
    generateRecommendations,
    calculateAIScore,
    analyzeTimingPatterns,
    buildProfitHeatmap,
    simulate,
    generateDailyReport,
    detectOptimalStrategy,
    retroAnalysis,
    calculateROI,
    updateGoalProgress,
    analyzeUserPreferences,
    executeRecommendation,
    saveRecommendations,
    syncOrdersToDB,
};
