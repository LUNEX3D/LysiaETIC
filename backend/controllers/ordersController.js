const {
    fetchTrendyolOrders,
    fetchHepsiburadaOrders,
    fetchN11Orders,
    fetchCicekSepetiOrders
} = require("../services/ordersService");

const amazonService = require("../services/amazon/amazonSpApiService");
const Marketplace = require("../models/Marketplace");
const logger = require("../config/logger");

const getIstanbulTimestamp = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getTime();
};

const convertToGMT3Timestamp = (dateStr, isStart = true) => {
    if (!dateStr) return NaN;
    const timePart = isStart ? "T00:00:00+03:00" : "T23:59:59+03:00";
    return new Date(`${dateStr}${timePart}`).getTime();
};

exports.getAllOrders = async (req, res) => {
    try {
        // ✅ FIX #2: IDOR — URL'deki userId yerine token'dan gelen kullanıcı ID'si
        const userId = req.user._id;
        let { startDate, endDate, marketplaceId } = req.query;

        const now = getIstanbulTimestamp();
        const defaultStartDate = now - 90 * 24 * 60 * 60 * 1000;
        const convertedStartDate = startDate ? convertToGMT3Timestamp(startDate, true) : defaultStartDate;
        const convertedEndDate = endDate ? convertToGMT3Timestamp(endDate, false) : now;

        const integration = await Marketplace.findOne({ _id: marketplaceId, userId });
        if (!integration) {
            logger.warn(`Integration not found for user ${userId}: ${marketplaceId}`);
            return res.status(404).json({
                error: "Integration not found!",
                details: "Please check your integration settings."
            });
        }

        let rawOrders = [];
        let orders = [];
        const { marketplaceName, credentials } = integration;

        switch (marketplaceName.toLowerCase()) {
            case "trendyol":
                rawOrders = await fetchTrendyolOrders(
                    credentials.sellerId,
                    credentials.apiKey,
                    credentials.apiSecret,
                    convertedStartDate,
                    convertedEndDate
                );
                break;

            case "hepsiburada":
                rawOrders = await fetchHepsiburadaOrders(
                    credentials.merchantId,
                    credentials.apiKey,
                    convertedStartDate,
                    convertedEndDate
                );
                break;

            case "n11":
                rawOrders = await fetchN11Orders(
                    credentials.apiKey,
                    credentials.secretKey,
                    convertedStartDate,
                    convertedEndDate
                );
                break;

            case "çiçeksepeti":
            case "ciceksepeti":
                rawOrders = await fetchCicekSepetiOrders(
                    credentials.apiKey,
                    credentials.sellerId,
                    credentials.integratorName
                );
                break;

            case "amazon":
            case "amazon türkiye":
            case "amazon europe":
            case "amazon usa":
                const amazonResult = await amazonService.getAllOrders(credentials, {
                    createdAfter: new Date(convertedStartDate).toISOString(),
                    createdBefore: new Date(convertedEndDate).toISOString()
                });
                rawOrders = (amazonResult.orders || []).map(order => ({
                    orderNumber: order.AmazonOrderId,
                    orderDate: new Date(order.PurchaseDate).toLocaleString("tr-TR"),
                    customerName: order.BuyerInfo?.BuyerName || "Amazon Müşteri",
                    totalPrice: order.OrderTotal?.Amount || "0.00",
                    status: order.OrderStatus,
                    trackingNumber: order.FulfillmentInstruction?.FulfillmentSupplySourceId || "Yok",
                    cargoCompany: order.ShipServiceLevel || "Amazon",
                    products: []
                }));
                break;

            default:
                logger.warn(`Unsupported marketplace: ${marketplaceName}`);
                return res.status(400).json({
                    error: "Unsupported marketplace!",
                    supportedMarketplaces: ["trendyol", "hepsiburada", "n11", "çiçeksepeti", "amazon"]
                });
        }

        orders = rawOrders.map(order => ({
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            customerName: order.customerName,
            totalPrice: order.totalPrice,
            status: order.status,
            trackingNumber: order.trackingNumber || "Yok",
            cargoCompany: order.cargoCompany || "Bilinmiyor",
            products: order.products
        }));

        return res.status(200).json({
            success: true,
            marketplace: marketplaceName,
            total: orders.length,
            orders: orders,
            timeframe: {
                start: new Date(convertedStartDate).toISOString(),
                end: new Date(convertedEndDate).toISOString()
            }
        });

    } catch (error) {
        logger.error("Order fetch error", { error: error.message });
        return res.status(500).json({
            error: "Failed to fetch orders!",
            details: process.env.NODE_ENV === "development" ? error.message : null
        });
    }
};
