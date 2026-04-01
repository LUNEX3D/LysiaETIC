const Order = require("../models/Order");
const Product = require("../models/Product");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");


// Get analytics overview (KPI data)
exports.getAnalyticsOverview = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { startDate, endDate } = req.query;

        logger.info("📊 Analytics overview isteği:", {
            userId: userId.toString(),
            startDate,
            endDate,
            userType: typeof userId
        });

        // Date range setup
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        // Build query - Order model uses 'user' field
        const query = { user: userId };
        if (startDate || endDate) {
            query.orderDate = { $gte: start, $lte: end };
        }

        logger.info("🔍 Query:", JSON.stringify(query, null, 2));

        // Check if any orders exist for this user
        const allUserOrders = await Order.countDocuments({ user: userId });
        logger.info(`📦 Kullanıcının toplam siparişi: ${allUserOrders}`);

        // Get total orders
        const totalOrders = await Order.countDocuments(query);
        logger.info(`📊 Filtrelenmiş sipariş sayısı: ${totalOrders}`);

        // Get total revenue - Order model uses 'totalPrice' field
        const revenueData = await Order.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: "$totalPrice" } } }
        ]);
        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        // Get active products - count unique products from orders
        const uniqueProducts = await Order.aggregate([
            { $match: query },
            { $unwind: "$items" },
            { $group: { _id: "$items.barcode" } },
            { $count: "total" }
        ]);
        const activeProducts = uniqueProducts.length > 0 ? uniqueProducts[0].total : 0;

        // Calculate growth (compare with previous period)
        const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
        const previousQuery = { user: userId, orderDate: { $gte: previousStart, $lt: start } };
        const previousOrders = await Order.countDocuments(previousQuery);
        const growth = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders * 100).toFixed(1) : 0;

        // Average order value
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

        // Mock conversion rate (would need visitor data in real scenario)
        const conversionRate = 3.8;

        logger.info("✅ Analytics overview başarılı:", { totalOrders, totalRevenue, activeProducts, growth });

        res.json({
            success: true,
            data: {
                totalOrders,
                totalRevenue,
                activeProducts,
                growth: parseFloat(growth),
                avgOrderValue: parseFloat(avgOrderValue),
                conversionRate
            }
        });

    } catch (error) {
        logger.error("❌ Analytics overview hatası:", error);
        res.status(500).json({
            success: false,
            message: "Analytics verileri alınamadı",
            error: error.message
        });
    }
};

// Get sales trend data
exports.getSalesTrend = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { startDate, endDate } = req.query;

        logger.info("📈 Sales trend isteği:", { userId, startDate, endDate });

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const query = { user: userId, orderDate: { $gte: start, $lte: end } };

        // Aggregate by day
        const trendData = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$orderDate" }
                    },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        logger.info("✅ Sales trend başarılı:", trendData.length, "gün");

        res.json({
            success: true,
            data: trendData.map(item => ({
                date: item._id,
                orders: item.orders,
                revenue: item.revenue
            }))
        });

    } catch (error) {
        logger.error("❌ Sales trend hatası:", error);
        res.status(500).json({
            success: false,
            message: "Satış trendi alınamadı",
            error: error.message
        });
    }
};

// Get marketplace distribution
exports.getMarketplaceDistribution = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { startDate, endDate } = req.query;

        logger.info("🏪 Marketplace distribution isteği:", { userId, startDate, endDate });

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const query = { user: userId, orderDate: { $gte: start, $lte: end } };

        // Get total orders for percentage calculation
        const totalOrders = await Order.countDocuments(query);

        if (totalOrders === 0) {
            return res.json({ success: true, data: [] });
        }

        // Aggregate by marketplace - REAL DATA
        const marketplaceData = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$marketplaceName",
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { orders: -1 } }
        ]);

        // Calculate percentages
        const distribution = marketplaceData.map(mp => ({
            name: mp._id || "Diğer",
            orders: mp.orders,
            revenue: mp.revenue,
            percentage: ((mp.orders / totalOrders) * 100).toFixed(1)
        }));

        logger.info("✅ Marketplace distribution başarılı:", distribution.length, "pazaryeri");

        res.json({
            success: true,
            data: distribution
        });

    } catch (error) {
        logger.error("❌ Marketplace distribution hatası:", error);
        res.status(500).json({
            success: false,
            message: "Pazaryeri dağılımı alınamadı",
            error: error.message
        });
    }
};

// Get top products
exports.getTopProducts = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { limit = 5, startDate, endDate } = req.query;

        logger.info("🔥 Top products isteği:", { userId, limit, startDate, endDate });

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const query = { user: userId, orderDate: { $gte: start, $lte: end } };

        // Aggregate by product with trend calculation
        const topProducts = await Order.aggregate([
            { $match: query },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productName",
                    sales: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                    barcode: { $first: "$items.barcode" }
                }
            },
            { $sort: { sales: -1 } },
            { $limit: parseInt(limit) }
        ]);

        // Calculate trend for each product (compare with previous period)
        const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const previousStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
        const previousQuery = { user: userId, orderDate: { $gte: previousStart, $lt: start } };

        const productsWithTrend = await Promise.all(topProducts.map(async (product) => {
            const previousSales = await Order.aggregate([
                { $match: previousQuery },
                { $unwind: "$items" },
                { $match: { "items.productName": product._id } },
                { $group: { _id: null, sales: { $sum: "$items.quantity" } } }
            ]);

            const prevSales = previousSales.length > 0 ? previousSales[0].sales : 0;
            const trend = prevSales > 0 ? ((product.sales - prevSales) / prevSales * 100).toFixed(1) : 100;

            return {
                name: product._id,
                sales: product.sales,
                revenue: product.revenue,
                trend: parseFloat(trend)
            };
        }));

        logger.info("✅ Top products başarılı:", productsWithTrend.length, "ürün");

        res.json({
            success: true,
            data: productsWithTrend
        });

    } catch (error) {
        logger.error("❌ Top products hatası:", error);
        res.status(500).json({
            success: false,
            message: "En çok satan ürünler alınamadı",
            error: error.message
        });
    }
};

// Get category distribution
exports.getCategoryDistribution = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { startDate, endDate } = req.query;

        logger.info("📊 Category distribution isteği:", { userId, startDate, endDate });

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const query = { user: userId, orderDate: { $gte: start, $lte: end } };

        // Aggregate by category
        const categoryData = await Order.aggregate([
            { $match: query },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.category",
                    sales: { $sum: "$items.quantity" },
                    revenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                }
            },
            { $sort: { sales: -1 } }
        ]);

        // Calculate total for percentages
        const totalSales = categoryData.reduce((sum, cat) => sum + cat.sales, 0);

        const colors = ["#4ecdc4", "#3b82f6", "#f59e0b", "#ec4899", "#94a3b8", "#10b981", "#8b5cf6"];

        const formattedData = categoryData.map((item, index) => ({
            name: item._id || "Diğer",
            value: totalSales > 0 ? parseFloat(((item.sales / totalSales) * 100).toFixed(1)) : 0,
            sales: item.sales,
            revenue: item.revenue,
            color: colors[index % colors.length]
        }));

        logger.info("✅ Category distribution başarılı:", formattedData.length, "kategori");

        res.json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        logger.error("❌ Category distribution hatası:", error);
        res.status(500).json({
            success: false,
            message: "Kategori dağılımı alınamadı",
            error: error.message
        });
    }
};

// Get hourly sales data
exports.getHourlySales = async (req, res) => {
    try {
        const userId = req.user._id || req.userId;
        const { startDate, endDate } = req.query;

        logger.info("⏰ Hourly sales isteği:", { userId, startDate, endDate });

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const query = { user: userId, orderDate: { $gte: start, $lte: end } };

        // Aggregate by hour
        const hourlyData = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: { $hour: "$orderDate" },
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalPrice" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill in missing hours with 0
        const fullHourlyData = [];
        for (let i = 0; i < 24; i++) {
            const hourData = hourlyData.find(h => h._id === i);
            fullHourlyData.push({
                hour: `${i.toString().padStart(2, '0')}:00`,
                orders: hourData ? hourData.orders : 0,
                revenue: hourData ? hourData.revenue : 0
            });
        }

        logger.info("✅ Hourly sales başarılı");

        res.json({
            success: true,
            data: fullHourlyData
        });

    } catch (error) {
        logger.error("❌ Hourly sales hatası:", error);
        res.status(500).json({
            success: false,
            message: "Saatlik satış verileri alınamadı",
            error: error.message
        });
    }
};

module.exports = exports;
