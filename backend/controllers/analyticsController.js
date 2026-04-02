/**
 * Analytics Controller — LysiaETIC
 * ✅ Tam yeniden yazım — Kâr/Maliyet/Komisyon/Stok/Aksiyon analizi
 *
 * Endpoint'ler:
 *   GET /api/analytics/overview          — KPI verileri
 *   GET /api/analytics/sales-trend       — Satış trendi (günlük)
 *   GET /api/analytics/marketplace-distribution — Pazaryeri dağılımı
 *   GET /api/analytics/top-products      — En çok satan ürünler
 *   GET /api/analytics/category-distribution — Kategori dağılımı
 *   GET /api/analytics/hourly-sales      — Saatlik satış deseni
 *   GET /api/analytics/profit-overview   — Kâr/Maliyet özeti
 *   GET /api/analytics/product-performance — Ürün performans tablosu
 *   GET /api/analytics/marketplace-comparison — Pazaryeri karşılaştırma
 *   GET /api/analytics/commission-analysis — Komisyon & gider analizi
 *   GET /api/analytics/stock-velocity    — Stok devir hızı & talep
 *   GET /api/analytics/actions           — Akıllı aksiyon önerileri
 *   GET /api/analytics/daily-summary     — Günlük özet rapor
 */
const Order = require("../models/Order");
const Product = require("../models/Product");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");

// ─── Yardımcı: Tarih aralığı oluştur ───
const buildDateRange = (query) => {
    const { startDate, endDate } = query;
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);
    return { start, end };
};

// ─── Yardımcı: Önceki dönem ───
const getPreviousPeriod = (start, end) => {
    const diff = end.getTime() - start.getTime();
    return {
        start: new Date(start.getTime() - diff),
        end: new Date(start.getTime() - 1)
    };
};

// ═══════════════════════════════════════════════════════════
// 1. OVERVIEW — KPI verileri
// ═══════════════════════════════════════════════════════════
exports.getAnalyticsOverview = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);
        const prev = getPreviousPeriod(start, end);

        const query = { user: userId, orderDate: { $gte: start, $lte: end } };
        const prevQuery = { user: userId, orderDate: { $gte: prev.start, $lte: prev.end } };

        // Paralel sorgular
        const [
            currentAgg,
            prevAgg,
            activeProducts,
            totalProducts,
            returnedOrders,
            cancelledOrders
        ] = await Promise.all([
            Order.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: "$totalPrice" },
                        totalCost: { $sum: "$costSummary.totalCost" },
                        totalCommission: { $sum: "$costSummary.totalCommission" },
                        totalShipping: { $sum: "$costSummary.totalShipping" },
                        totalPackaging: { $sum: "$costSummary.totalPackaging" },
                        totalOtherCost: { $sum: "$costSummary.totalOtherCost" },
                        grossProfit: { $sum: "$costSummary.grossProfit" },
                        netProfit: { $sum: "$costSummary.netProfit" }
                    }
                }
            ]),
            Order.aggregate([
                { $match: prevQuery },
                {
                    $group: {
                        _id: null,
                        totalOrders: { $sum: 1 },
                        totalRevenue: { $sum: "$totalPrice" },
                        netProfit: { $sum: "$costSummary.netProfit" }
                    }
                }
            ]),
            Product.countDocuments({ userId, status: "active" }),
            Product.countDocuments({ userId }),
            Order.countDocuments({ ...query, isReturned: true }),
            Order.countDocuments({ ...query, isCancelled: true })
        ]);

        const current = currentAgg[0] || {};
        const previous = prevAgg[0] || {};

        const totalRevenue = current.totalRevenue || 0;
        const totalOrders = current.totalOrders || 0;
        const netProfit = current.netProfit || 0;
        const totalCommission = current.totalCommission || 0;
        const totalCost = current.totalCost || 0;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Büyüme hesapla
        const prevRevenue = previous.totalRevenue || 0;
        const prevOrders = previous.totalOrders || 0;
        const prevProfit = previous.netProfit || 0;

        const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
        const orderGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders * 100) : 0;
        const profitGrowth = prevProfit > 0 ? ((netProfit - prevProfit) / prevProfit * 100) : 0;

        res.json({
            success: true,
            data: {
                totalOrders,
                totalRevenue,
                netProfit,
                grossProfit: current.grossProfit || 0,
                totalCost,
                totalCommission,
                totalShipping: current.totalShipping || 0,
                totalPackaging: current.totalPackaging || 0,
                totalOtherCost: current.totalOtherCost || 0,
                avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
                profitMargin: parseFloat(profitMargin.toFixed(2)),
                activeProducts,
                totalProducts,
                returnedOrders,
                cancelledOrders,
                growth: {
                    revenue: parseFloat(revenueGrowth.toFixed(1)),
                    orders: parseFloat(orderGrowth.toFixed(1)),
                    profit: parseFloat(profitGrowth.toFixed(1))
                }
            }
        });
    } catch (error) {
        logger.error("❌ Analytics overview hatası:", error);
        res.status(500).json({ success: false, message: "Analytics verileri alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 2. SALES TREND — Günlük satış & kâr trendi
// ═══════════════════════════════════════════════════════════
exports.getSalesTrend = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);

        const trendData = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" },
                    cost: { $sum: "$costSummary.totalCost" },
                    commission: { $sum: "$costSummary.totalCommission" },
                    netProfit: { $sum: "$costSummary.netProfit" },
                    grossProfit: { $sum: "$costSummary.grossProfit" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            data: trendData.map(item => ({
                date: item._id,
                orders: item.orders,
                revenue: item.revenue,
                cost: item.cost,
                commission: item.commission,
                netProfit: item.netProfit,
                grossProfit: item.grossProfit,
                profitMargin: item.revenue > 0 ? parseFloat(((item.netProfit / item.revenue) * 100).toFixed(1)) : 0
            }))
        });
    } catch (error) {
        logger.error("❌ Sales trend hatası:", error);
        res.status(500).json({ success: false, message: "Satış trendi alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 3. MARKETPLACE DISTRIBUTION — Pazaryeri dağılımı
// ═══════════════════════════════════════════════════════════
exports.getMarketplaceDistribution = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);

        const query = { user: userId, orderDate: { $gte: start, $lte: end } };
        const totalOrders = await Order.countDocuments(query);

        if (totalOrders === 0) {
            return res.json({ success: true, data: [] });
        }

        const marketplaceData = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$marketplaceName",
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" },
                    netProfit: { $sum: "$costSummary.netProfit" },
                    totalCommission: { $sum: "$costSummary.totalCommission" },
                    totalCost: { $sum: "$costSummary.totalCost" },
                    avgOrderValue: { $avg: "$totalPrice" },
                    returnCount: { $sum: { $cond: ["$isReturned", 1, 0] } },
                    cancelCount: { $sum: { $cond: ["$isCancelled", 1, 0] } }
                }
            },
            { $sort: { revenue: -1 } }
        ]);

        const distribution = marketplaceData.map(mp => ({
            name: mp._id || "Diğer",
            orders: mp.orders,
            revenue: mp.revenue,
            netProfit: mp.netProfit,
            totalCommission: mp.totalCommission,
            totalCost: mp.totalCost,
            avgOrderValue: parseFloat((mp.avgOrderValue || 0).toFixed(2)),
            profitMargin: mp.revenue > 0 ? parseFloat(((mp.netProfit / mp.revenue) * 100).toFixed(1)) : 0,
            percentage: parseFloat(((mp.orders / totalOrders) * 100).toFixed(1)),
            returnRate: mp.orders > 0 ? parseFloat(((mp.returnCount / mp.orders) * 100).toFixed(1)) : 0,
            cancelRate: mp.orders > 0 ? parseFloat(((mp.cancelCount / mp.orders) * 100).toFixed(1)) : 0
        }));

        res.json({ success: true, data: distribution });
    } catch (error) {
        logger.error("❌ Marketplace distribution hatası:", error);
        res.status(500).json({ success: false, message: "Pazaryeri dağılımı alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 4. TOP PRODUCTS — En çok satan ürünler
// ═══════════════════════════════════════════════════════════
exports.getTopProducts = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { limit = 10, startDate, endDate } = req.query;
        const { start, end } = buildDateRange(req.query);
        const prev = getPreviousPeriod(start, end);

        const topProducts = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.barcode",
                    name: { $first: "$items.productName" },
                    sales: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                    totalCost: { $sum: { $multiply: ["$items.quantity", "$items.costPrice"] } },
                    totalCommission: { $sum: "$items.commissionAmount" },
                    netProfit: { $sum: "$items.netProfit" },
                    category: { $first: "$items.category" }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: parseInt(limit) }
        ]);

        // Trend hesapla
        const productsWithTrend = await Promise.all(topProducts.map(async (product) => {
            const prevSalesAgg = await Order.aggregate([
                { $match: { user: userId, orderDate: { $gte: prev.start, $lte: prev.end } } },
                { $unwind: "$items" },
                { $match: { "items.barcode": product._id } },
                { $group: { _id: null, sales: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } } } }
            ]);

            const prevSales = prevSalesAgg[0]?.sales || 0;
            const prevRevenue = prevSalesAgg[0]?.revenue || 0;
            const salesTrend = prevSales > 0 ? ((product.sales - prevSales) / prevSales * 100) : (product.sales > 0 ? 100 : 0);
            const revenueTrend = prevRevenue > 0 ? ((product.revenue - prevRevenue) / prevRevenue * 100) : (product.revenue > 0 ? 100 : 0);
            const profitMargin = product.revenue > 0 ? (product.netProfit / product.revenue) * 100 : 0;

            return {
                barcode: product._id,
                name: product.name,
                sales: product.sales,
                revenue: product.revenue,
                totalCost: product.totalCost,
                totalCommission: product.totalCommission,
                netProfit: product.netProfit,
                profitMargin: parseFloat(profitMargin.toFixed(1)),
                category: product.category,
                trend: parseFloat(salesTrend.toFixed(1)),
                revenueTrend: parseFloat(revenueTrend.toFixed(1))
            };
        }));

        res.json({ success: true, data: productsWithTrend });
    } catch (error) {
        logger.error("❌ Top products hatası:", error);
        res.status(500).json({ success: false, message: "En çok satan ürünler alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 5. CATEGORY DISTRIBUTION — Kategori dağılımı
// ═══════════════════════════════════════════════════════════
exports.getCategoryDistribution = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);

        const categoryData = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.category",
                    sales: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                    netProfit: { $sum: "$items.netProfit" },
                    totalCommission: { $sum: "$items.commissionAmount" },
                    productCount: { $addToSet: "$items.barcode" }
                }
            },
            { $sort: { revenue: -1 } }
        ]);

        const totalRevenue = categoryData.reduce((sum, cat) => sum + cat.revenue, 0);
        const colors = ["#4ecdc4", "#3b82f6", "#f59e0b", "#ec4899", "#94a3b8", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"];

        const formattedData = categoryData.map((item, index) => ({
            name: item._id || "Diğer",
            value: totalRevenue > 0 ? parseFloat(((item.revenue / totalRevenue) * 100).toFixed(1)) : 0,
            sales: item.sales,
            revenue: item.revenue,
            netProfit: item.netProfit,
            totalCommission: item.totalCommission,
            profitMargin: item.revenue > 0 ? parseFloat(((item.netProfit / item.revenue) * 100).toFixed(1)) : 0,
            productCount: item.productCount.length,
            color: colors[index % colors.length]
        }));

        res.json({ success: true, data: formattedData });
    } catch (error) {
        logger.error("❌ Category distribution hatası:", error);
        res.status(500).json({ success: false, message: "Kategori dağılımı alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 6. HOURLY SALES — Saatlik satış deseni
// ═══════════════════════════════════════════════════════════
exports.getHourlySales = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);

        const hourlyData = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $hour: "$orderDate" },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const fullHourlyData = [];
        for (let i = 0; i < 24; i++) {
            const hourData = hourlyData.find(h => h._id === i);
            fullHourlyData.push({
                hour: `${i.toString().padStart(2, '0')}:00`,
                orders: hourData ? hourData.orders : 0,
                revenue: hourData ? hourData.revenue : 0
            });
        }

        res.json({ success: true, data: fullHourlyData });
    } catch (error) {
        logger.error("❌ Hourly sales hatası:", error);
        res.status(500).json({ success: false, message: "Saatlik satış verileri alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 7. PROFIT OVERVIEW — Kâr/Maliyet özeti
// ═══════════════════════════════════════════════════════════
exports.getProfitOverview = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);

        // Günlük kâr trendi
        const dailyProfit = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end }, isCancelled: { $ne: true } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
                    revenue: { $sum: "$totalPrice" },
                    cost: { $sum: "$costSummary.totalCost" },
                    commission: { $sum: "$costSummary.totalCommission" },
                    shipping: { $sum: "$costSummary.totalShipping" },
                    packaging: { $sum: "$costSummary.totalPackaging" },
                    otherCost: { $sum: "$costSummary.totalOtherCost" },
                    grossProfit: { $sum: "$costSummary.grossProfit" },
                    netProfit: { $sum: "$costSummary.netProfit" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Gider dağılımı
        const expenseBreakdown = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end }, isCancelled: { $ne: true } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalPrice" },
                    productCost: { $sum: "$costSummary.totalCost" },
                    commission: { $sum: "$costSummary.totalCommission" },
                    shipping: { $sum: "$costSummary.totalShipping" },
                    packaging: { $sum: "$costSummary.totalPackaging" },
                    otherCost: { $sum: "$costSummary.totalOtherCost" },
                    grossProfit: { $sum: "$costSummary.grossProfit" },
                    netProfit: { $sum: "$costSummary.netProfit" }
                }
            }
        ]);

        const totals = expenseBreakdown[0] || {};
        const totalExpenses = (totals.productCost || 0) + (totals.commission || 0) + (totals.shipping || 0) + (totals.packaging || 0) + (totals.otherCost || 0);

        res.json({
            success: true,
            data: {
                dailyProfit: dailyProfit.map(d => ({
                    date: d._id,
                    revenue: d.revenue,
                    cost: d.cost,
                    commission: d.commission,
                    shipping: d.shipping,
                    grossProfit: d.grossProfit,
                    netProfit: d.netProfit,
                    profitMargin: d.revenue > 0 ? parseFloat(((d.netProfit / d.revenue) * 100).toFixed(1)) : 0,
                    orders: d.orders
                })),
                expenseBreakdown: {
                    totalRevenue: totals.totalRevenue || 0,
                    productCost: totals.productCost || 0,
                    commission: totals.commission || 0,
                    shipping: totals.shipping || 0,
                    packaging: totals.packaging || 0,
                    otherCost: totals.otherCost || 0,
                    totalExpenses,
                    grossProfit: totals.grossProfit || 0,
                    netProfit: totals.netProfit || 0,
                    profitMargin: (totals.totalRevenue || 0) > 0 ? parseFloat((((totals.netProfit || 0) / totals.totalRevenue) * 100).toFixed(1)) : 0
                }
            }
        });
    } catch (error) {
        logger.error("❌ Profit overview hatası:", error);
        res.status(500).json({ success: false, message: "Kâr analizi alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 8. PRODUCT PERFORMANCE — Ürün performans tablosu
// ═══════════════════════════════════════════════════════════
exports.getProductPerformance = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);
        const { sortBy = "revenue", limit = 50 } = req.query;

        // Sipariş bazlı ürün performansı
        const orderPerformance = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.barcode",
                    name: { $first: "$items.productName" },
                    category: { $first: "$items.category" },
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                    totalCost: { $sum: { $multiply: ["$items.quantity", "$items.costPrice"] } },
                    totalCommission: { $sum: "$items.commissionAmount" },
                    totalShipping: { $sum: "$items.shippingCost" },
                    netProfit: { $sum: "$items.netProfit" },
                    orderCount: { $sum: 1 },
                    avgPrice: { $avg: "$items.price" },
                    marketplaces: { $addToSet: "$marketplaceName" }
                }
            },
            { $sort: { [sortBy === "profit" ? "netProfit" : sortBy === "sales" ? "totalSold" : "totalRevenue"]: -1 } },
            { $limit: parseInt(limit) }
        ]);

        // Ürün stok bilgilerini ekle
        const barcodes = orderPerformance.map(p => p._id);
        const products = await Product.find({ userId, barcode: { $in: barcodes } })
            .select("barcode stock costPrice commissionRate salesMetrics")
            .lean();

        const productMap = new Map(products.map(p => [p.barcode, p]));

        // İade bilgisi
        const returnData = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end }, isReturned: true } },
            { $unwind: "$items" },
            { $group: { _id: "$items.barcode", returnCount: { $sum: "$items.quantity" } } }
        ]);
        const returnMap = new Map(returnData.map(r => [r._id, r.returnCount]));

        const result = orderPerformance.map(p => {
            const productInfo = productMap.get(p._id) || {};
            const returnCount = returnMap.get(p._id) || 0;
            const profitMargin = p.totalRevenue > 0 ? (p.netProfit / p.totalRevenue) * 100 : 0;

            return {
                barcode: p._id,
                name: p.name,
                category: p.category,
                totalSold: p.totalSold,
                totalRevenue: p.totalRevenue,
                totalCost: p.totalCost,
                totalCommission: p.totalCommission,
                netProfit: p.netProfit,
                profitMargin: parseFloat(profitMargin.toFixed(1)),
                avgPrice: parseFloat((p.avgPrice || 0).toFixed(2)),
                currentStock: productInfo.stock || 0,
                costPrice: productInfo.costPrice || 0,
                commissionRate: productInfo.commissionRate || 0,
                returnCount,
                returnRate: p.totalSold > 0 ? parseFloat(((returnCount / p.totalSold) * 100).toFixed(1)) : 0,
                orderCount: p.orderCount,
                marketplaces: p.marketplaces,
                daysOfStock: productInfo.salesMetrics?.daysOfStock || 0,
                avgDailySales: productInfo.salesMetrics?.avgDailySales || 0
            };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        logger.error("❌ Product performance hatası:", error);
        res.status(500).json({ success: false, message: "Ürün performansı alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 9. MARKETPLACE COMPARISON — Pazaryeri karşılaştırma
// ═══════════════════════════════════════════════════════════
exports.getMarketplaceComparison = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);
        const prev = getPreviousPeriod(start, end);

        // Mevcut dönem
        const currentData = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: "$marketplaceName",
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" },
                    netProfit: { $sum: "$costSummary.netProfit" },
                    totalCommission: { $sum: "$costSummary.totalCommission" },
                    totalCost: { $sum: "$costSummary.totalCost" },
                    totalShipping: { $sum: "$costSummary.totalShipping" },
                    avgOrderValue: { $avg: "$totalPrice" },
                    returnCount: { $sum: { $cond: ["$isReturned", 1, 0] } },
                    cancelCount: { $sum: { $cond: ["$isCancelled", 1, 0] } }
                }
            }
        ]);

        // Önceki dönem
        const prevData = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: prev.start, $lte: prev.end } } },
            {
                $group: {
                    _id: "$marketplaceName",
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" },
                    netProfit: { $sum: "$costSummary.netProfit" }
                }
            }
        ]);

        const prevMap = new Map(prevData.map(p => [p._id, p]));

        const comparison = currentData.map(mp => {
            const prevMp = prevMap.get(mp._id) || {};
            const revenueGrowth = (prevMp.revenue || 0) > 0 ? ((mp.revenue - prevMp.revenue) / prevMp.revenue * 100) : 0;
            const orderGrowth = (prevMp.orders || 0) > 0 ? ((mp.orders - prevMp.orders) / prevMp.orders * 100) : 0;
            const profitMargin = mp.revenue > 0 ? (mp.netProfit / mp.revenue) * 100 : 0;
            const commissionRate = mp.revenue > 0 ? (mp.totalCommission / mp.revenue) * 100 : 0;

            return {
                name: mp._id || "Diğer",
                orders: mp.orders,
                revenue: mp.revenue,
                netProfit: mp.netProfit,
                totalCommission: mp.totalCommission,
                totalCost: mp.totalCost,
                totalShipping: mp.totalShipping,
                avgOrderValue: parseFloat((mp.avgOrderValue || 0).toFixed(2)),
                profitMargin: parseFloat(profitMargin.toFixed(1)),
                commissionRate: parseFloat(commissionRate.toFixed(1)),
                returnRate: mp.orders > 0 ? parseFloat(((mp.returnCount / mp.orders) * 100).toFixed(1)) : 0,
                cancelRate: mp.orders > 0 ? parseFloat(((mp.cancelCount / mp.orders) * 100).toFixed(1)) : 0,
                growth: {
                    revenue: parseFloat(revenueGrowth.toFixed(1)),
                    orders: parseFloat(orderGrowth.toFixed(1))
                }
            };
        }).sort((a, b) => b.revenue - a.revenue);

        res.json({ success: true, data: comparison });
    } catch (error) {
        logger.error("❌ Marketplace comparison hatası:", error);
        res.status(500).json({ success: false, message: "Pazaryeri karşılaştırması alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 10. COMMISSION ANALYSIS — Komisyon & gider analizi
// ═══════════════════════════════════════════════════════════
exports.getCommissionAnalysis = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);

        // Pazaryeri bazlı komisyon
        const byMarketplace = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end }, isCancelled: { $ne: true } } },
            {
                $group: {
                    _id: "$marketplaceName",
                    revenue: { $sum: "$totalPrice" },
                    commission: { $sum: "$costSummary.totalCommission" },
                    shipping: { $sum: "$costSummary.totalShipping" },
                    packaging: { $sum: "$costSummary.totalPackaging" },
                    productCost: { $sum: "$costSummary.totalCost" },
                    otherCost: { $sum: "$costSummary.totalOtherCost" },
                    netProfit: { $sum: "$costSummary.netProfit" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { commission: -1 } }
        ]);

        // Kategori bazlı komisyon
        const byCategory = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end }, isCancelled: { $ne: true } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.category",
                    revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                    commission: { $sum: "$items.commissionAmount" },
                    avgCommissionRate: { $avg: "$items.commissionRate" }
                }
            },
            { $sort: { commission: -1 } },
            { $limit: 15 }
        ]);

        const marketplaceResult = byMarketplace.map(mp => {
            const totalExpense = (mp.commission || 0) + (mp.shipping || 0) + (mp.packaging || 0) + (mp.otherCost || 0) + (mp.productCost || 0);
            return {
                name: mp._id || "Diğer",
                revenue: mp.revenue,
                commission: mp.commission,
                commissionRate: mp.revenue > 0 ? parseFloat(((mp.commission / mp.revenue) * 100).toFixed(1)) : 0,
                shipping: mp.shipping,
                packaging: mp.packaging,
                productCost: mp.productCost,
                otherCost: mp.otherCost,
                totalExpense,
                netProfit: mp.netProfit,
                expenseRatio: mp.revenue > 0 ? parseFloat(((totalExpense / mp.revenue) * 100).toFixed(1)) : 0,
                orders: mp.orders
            };
        });

        const categoryResult = byCategory.map(cat => ({
            name: cat._id || "Diğer",
            revenue: cat.revenue,
            commission: cat.commission,
            commissionRate: parseFloat((cat.avgCommissionRate || 0).toFixed(1)),
            effectiveRate: cat.revenue > 0 ? parseFloat(((cat.commission / cat.revenue) * 100).toFixed(1)) : 0
        }));

        res.json({
            success: true,
            data: {
                byMarketplace: marketplaceResult,
                byCategory: categoryResult
            }
        });
    } catch (error) {
        logger.error("❌ Commission analysis hatası:", error);
        res.status(500).json({ success: false, message: "Komisyon analizi alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 11. STOCK VELOCITY — Stok devir hızı & talep analizi
// ═══════════════════════════════════════════════════════════
exports.getStockVelocity = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);
        const dayCount = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

        // Ürün bazlı satış hızı
        const salesVelocity = await Order.aggregate([
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.barcode",
                    name: { $first: "$items.productName" },
                    category: { $first: "$items.category" },
                    totalSold: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                    lastSaleDate: { $max: "$orderDate" }
                }
            },
            { $sort: { totalSold: -1 } }
        ]);

        // Ürün stok bilgileri
        const products = await Product.find({ userId })
            .select("barcode name stock costPrice salePrice salesMetrics status")
            .lean();

        const productMap = new Map(products.map(p => [p.barcode, p]));

        const velocityData = salesVelocity.map(item => {
            const product = productMap.get(item._id) || {};
            const avgDailySales = item.totalSold / dayCount;
            const currentStock = product.stock || 0;
            const daysOfStock = avgDailySales > 0 ? Math.round(currentStock / avgDailySales) : (currentStock > 0 ? 999 : 0);
            const stockValue = currentStock * (product.costPrice || product.salePrice || 0);

            // Stok devir hızı (yıllık bazda)
            const turnoverRate = currentStock > 0 ? (item.totalSold / currentStock) * (365 / dayCount) : 0;

            return {
                barcode: item._id,
                name: item.name || product.name,
                category: item.category,
                totalSold: item.totalSold,
                avgDailySales: parseFloat(avgDailySales.toFixed(2)),
                currentStock,
                daysOfStock,
                stockValue: parseFloat(stockValue.toFixed(2)),
                turnoverRate: parseFloat(turnoverRate.toFixed(1)),
                revenue: item.revenue,
                lastSaleDate: item.lastSaleDate,
                status: daysOfStock === 0 ? "outOfStock" : daysOfStock <= 7 ? "critical" : daysOfStock <= 30 ? "low" : "healthy"
            };
        });

        // Stok olan ama satılmayan ürünler (ölü stok)
        const soldBarcodes = new Set(salesVelocity.map(s => s._id));
        const deadStock = products
            .filter(p => !soldBarcodes.has(p.barcode) && (p.stock || 0) > 0)
            .map(p => ({
                barcode: p.barcode,
                name: p.name,
                currentStock: p.stock,
                stockValue: (p.stock || 0) * (p.costPrice || p.salePrice || 0),
                avgDailySales: 0,
                daysOfStock: 999,
                turnoverRate: 0,
                totalSold: 0,
                status: "deadStock"
            }));

        // Özet istatistikler
        const totalStockValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || p.salePrice || 0)), 0);
        const criticalCount = velocityData.filter(v => v.status === "critical").length;
        const outOfStockCount = velocityData.filter(v => v.status === "outOfStock").length;
        const deadStockValue = deadStock.reduce((sum, d) => sum + d.stockValue, 0);

        res.json({
            success: true,
            data: {
                items: [...velocityData, ...deadStock].sort((a, b) => a.daysOfStock - b.daysOfStock),
                summary: {
                    totalProducts: products.length,
                    totalStockValue: parseFloat(totalStockValue.toFixed(2)),
                    criticalCount,
                    outOfStockCount,
                    deadStockCount: deadStock.length,
                    deadStockValue: parseFloat(deadStockValue.toFixed(2)),
                    avgTurnoverRate: velocityData.length > 0
                        ? parseFloat((velocityData.reduce((s, v) => s + v.turnoverRate, 0) / velocityData.length).toFixed(1))
                        : 0
                }
            }
        });
    } catch (error) {
        logger.error("❌ Stock velocity hatası:", error);
        res.status(500).json({ success: false, message: "Stok devir analizi alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 12. ACTIONS — Akıllı aksiyon önerileri
// ═══════════════════════════════════════════════════════════
exports.getActions = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { start, end } = buildDateRange(req.query);
        const actions = [];

        // Paralel veri çekme
        const [
            products,
            recentOrders,
            returnedOrders,
            cancelledOrders
        ] = await Promise.all([
            Product.find({ userId }).select("barcode name stock costPrice salePrice commissionRate salesMetrics status").lean(),
            Order.find({ user: userId, orderDate: { $gte: start, $lte: end } })
                .select("totalPrice costSummary marketplaceName items isReturned isCancelled")
                .lean(),
            Order.countDocuments({ user: userId, orderDate: { $gte: start, $lte: end }, isReturned: true }),
            Order.countDocuments({ user: userId, orderDate: { $gte: start, $lte: end }, isCancelled: true })
        ]);

        // 1. Stok tükenen ürünler
        const outOfStock = products.filter(p => (p.stock || 0) === 0 && p.status === "active");
        if (outOfStock.length > 0) {
            actions.push({
                id: "restock-urgent",
                priority: "critical",
                category: "stock",
                title: "🚨 Stok Tükenen Ürünler",
                description: `${outOfStock.length} aktif ürünün stoğu tamamen tükenmiş. Her gün potansiyel satış kaybediyorsunuz.`,
                impact: "Yüksek — Satış kaybı",
                items: outOfStock.slice(0, 5).map(p => p.name),
                count: outOfStock.length
            });
        }

        // 2. Kritik stok (1-5 adet)
        const criticalStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5);
        if (criticalStock.length > 0) {
            actions.push({
                id: "restock-soon",
                priority: "warning",
                category: "stock",
                title: "⚠️ Kritik Stok Seviyesi",
                description: `${criticalStock.length} ürün 5 ve altı stokta. Yakında tükenebilir.`,
                impact: "Orta — Tedarik planlaması gerekli",
                items: criticalStock.slice(0, 5).map(p => `${p.name} (${p.stock} adet)`),
                count: criticalStock.length
            });
        }

        // 3. Maliyet girilmemiş ürünler
        const noCost = products.filter(p => !p.costPrice || p.costPrice === 0);
        if (noCost.length > 0) {
            actions.push({
                id: "add-costs",
                priority: "info",
                category: "profit",
                title: "💰 Maliyet Bilgisi Eksik",
                description: `${noCost.length} ürünün maliyet fiyatı girilmemiş. Kâr analizi doğru çalışması için maliyet bilgilerini girin.`,
                impact: "Orta — Kâr analizi eksik kalıyor",
                count: noCost.length
            });
        }

        // 4. Yüksek iade oranı
        const totalOrders = recentOrders.length;
        if (totalOrders > 0 && returnedOrders > 0) {
            const returnRate = (returnedOrders / totalOrders) * 100;
            if (returnRate > 5) {
                actions.push({
                    id: "high-returns",
                    priority: returnRate > 15 ? "critical" : "warning",
                    category: "quality",
                    title: "↩️ Yüksek İade Oranı",
                    description: `İade oranınız %${returnRate.toFixed(1)}. ${returnedOrders} sipariş iade edilmiş. Ürün kalitesi ve açıklamalarını kontrol edin.`,
                    impact: "Yüksek — Müşteri memnuniyeti ve maliyet",
                    count: returnedOrders
                });
            }
        }

        // 5. Düşük kâr marjlı ürünler
        const lowMarginProducts = [];
        recentOrders.forEach(order => {
            if (order.costSummary && order.totalPrice > 0) {
                const margin = ((order.costSummary.netProfit || 0) / order.totalPrice) * 100;
                if (margin < 5 && margin >= 0) {
                    lowMarginProducts.push({ margin, marketplace: order.marketplaceName });
                }
            }
        });
        if (lowMarginProducts.length > 5) {
            actions.push({
                id: "low-margin",
                priority: "warning",
                category: "profit",
                title: "📉 Düşük Kâr Marjı",
                description: `${lowMarginProducts.length} siparişte kâr marjı %5'in altında. Fiyatlandırma stratejinizi gözden geçirin.`,
                impact: "Yüksek — Kârlılık düşük",
                count: lowMarginProducts.length
            });
        }

        // 6. Ölü stok (satılmayan ürünler)
        const soldBarcodes = new Set();
        recentOrders.forEach(o => {
            (o.items || []).forEach(item => soldBarcodes.add(item.barcode));
        });
        const deadStock = products.filter(p => !soldBarcodes.has(p.barcode) && (p.stock || 0) > 10);
        if (deadStock.length > 0) {
            const deadStockValue = deadStock.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || p.salePrice || 0)), 0);
            actions.push({
                id: "dead-stock",
                priority: "info",
                category: "stock",
                title: "📦 Ölü Stok Uyarısı",
                description: `${deadStock.length} ürün son dönemde hiç satılmamış ama stokta bekliyor. Toplam değer: ₺${deadStockValue.toFixed(0)}`,
                impact: "Orta — Sermaye bağlı kalıyor",
                items: deadStock.slice(0, 5).map(p => p.name),
                count: deadStock.length
            });
        }

        // 7. İptal oranı yüksek
        if (totalOrders > 0 && cancelledOrders > 0) {
            const cancelRate = (cancelledOrders / totalOrders) * 100;
            if (cancelRate > 3) {
                actions.push({
                    id: "high-cancels",
                    priority: cancelRate > 10 ? "critical" : "warning",
                    category: "quality",
                    title: "❌ Yüksek İptal Oranı",
                    description: `İptal oranınız %${cancelRate.toFixed(1)}. ${cancelledOrders} sipariş iptal edilmiş.`,
                    impact: "Yüksek — Operasyonel sorun",
                    count: cancelledOrders
                });
            }
        }

        // Önceliğe göre sırala
        const priorityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
        actions.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

        res.json({ success: true, data: actions });
    } catch (error) {
        logger.error("❌ Actions hatası:", error);
        res.status(500).json({ success: false, message: "Aksiyon önerileri alınamadı", error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════
// 13. DAILY SUMMARY — Günlük özet rapor
// ═══════════════════════════════════════════════════════════
exports.getDailySummary = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;

        // Bugün
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Dün
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart.getTime() - 1);

        // Bu hafta
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Pazartesi

        const [todayAgg, yesterdayAgg, weekAgg, activeProducts, criticalStock, outOfStock] = await Promise.all([
            Order.aggregate([
                { $match: { user: userId, orderDate: { $gte: todayStart, $lte: todayEnd } } },
                {
                    $group: {
                        _id: null,
                        orders: { $sum: 1 },
                        revenue: { $sum: "$totalPrice" },
                        netProfit: { $sum: "$costSummary.netProfit" },
                        commission: { $sum: "$costSummary.totalCommission" }
                    }
                }
            ]),
            Order.aggregate([
                { $match: { user: userId, orderDate: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
                {
                    $group: {
                        _id: null,
                        orders: { $sum: 1 },
                        revenue: { $sum: "$totalPrice" },
                        netProfit: { $sum: "$costSummary.netProfit" }
                    }
                }
            ]),
            Order.aggregate([
                { $match: { user: userId, orderDate: { $gte: weekStart, $lte: todayEnd } } },
                {
                    $group: {
                        _id: null,
                        orders: { $sum: 1 },
                        revenue: { $sum: "$totalPrice" },
                        netProfit: { $sum: "$costSummary.netProfit" }
                    }
                }
            ]),
            Product.countDocuments({ userId, status: "active" }),
            Product.countDocuments({ userId, stock: { $gt: 0, $lte: 5 } }),
            Product.countDocuments({ userId, stock: 0, status: "active" })
        ]);

        const today = todayAgg[0] || {};
        const yesterday = yesterdayAgg[0] || {};
        const week = weekAgg[0] || {};

        res.json({
            success: true,
            data: {
                today: {
                    orders: today.orders || 0,
                    revenue: today.revenue || 0,
                    netProfit: today.netProfit || 0,
                    commission: today.commission || 0
                },
                yesterday: {
                    orders: yesterday.orders || 0,
                    revenue: yesterday.revenue || 0,
                    netProfit: yesterday.netProfit || 0
                },
                thisWeek: {
                    orders: week.orders || 0,
                    revenue: week.revenue || 0,
                    netProfit: week.netProfit || 0
                },
                comparison: {
                    revenueChange: (yesterday.revenue || 0) > 0
                        ? parseFloat((((today.revenue || 0) - yesterday.revenue) / yesterday.revenue * 100).toFixed(1))
                        : 0,
                    orderChange: (yesterday.orders || 0) > 0
                        ? parseFloat((((today.orders || 0) - yesterday.orders) / yesterday.orders * 100).toFixed(1))
                        : 0
                },
                stockHealth: {
                    activeProducts,
                    criticalStock,
                    outOfStock
                }
            }
        });
    } catch (error) {
        logger.error("❌ Daily summary hatası:", error);
        res.status(500).json({ success: false, message: "Günlük özet alınamadı", error: error.message });
    }
};

module.exports = exports;
