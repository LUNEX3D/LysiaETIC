const { getShippingLabelForOrder } = require("../services/shippingLabelService");
const logger = require("../config/logger");

exports.getShippingLabel = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            marketplace,
            marketplaceName,
            marketplaceId,
            orderNumber,
            orderId,
            cargoTrackingNumber,
            trackingNumber,
            packageNumber,
            shipmentPackageId,
            cargoTrackingLink,
            orderItemId,
        } = req.query;

        const data = await getShippingLabelForOrder(userId, {
            marketplaceName: marketplaceName || marketplace,
            marketplaceId,
            orderNumber,
            orderId,
            cargoTrackingNumber,
            trackingNumber,
            packageNumber,
            shipmentPackageId,
            cargoTrackingLink,
            orderItemId,
        });

        return res.json({ success: true, data });
    } catch (error) {
        const msg =
            (error?.message && String(error.message) !== "[object Object]"
                ? String(error.message)
                : null) ||
            (typeof error === "string" ? error : null) ||
            "Kargo etiketi alınamadı.";
        logger.warn(`[ShippingLabel] ${msg}`);
        let status = 400;
        if (error.message && error.message.includes("bulunamadı")) status = 404;
        else if (error.status >= 400 && error.status < 500) status = error.status;
        return res.status(status).json({
            success: false,
            message: msg,
        });
    }
};
