const { getDashboardData, invalidateDashboardCache } = require("../services/dashboardService");
const { getOrdersCardData } = require("../services/dashboardOrdersCardService");
const logger = require("../config/logger");
const { ok, badRequest, serverError } = require("../utils/apiResponse");

exports.getDashboardSummary = async (req, res) => {
    try {
        // ✅ FIX H3: IDOR — req.user._id öncelikli, params.userId sadece geriye uyumluluk için
        const userId = req.user?._id || req.user?.id || req.params.userId;

        if (!userId) {
            logger.warn("Dashboard request without userId");
            return badRequest(res, "Kullanıcı ID'si gerekli.");
        }

        if (req.query.refresh === "1" || req.query.refresh === "true") {
            invalidateDashboardCache(userId);
        }

        const live =
            req.query.refresh === "1" ||
            req.query.refresh === "true" ||
            req.query.live === "1" ||
            req.query.live === "true";
        const data = await getDashboardData(userId, { live });
        return ok(res, "Dashboard verileri.", data);
    } catch (error) {
        logger.error("Dashboard summary error", { error: error.message });
        return serverError(res, error, "Dashboard verileri yüklenemedi.");
    }
};

/** Ana sayfa siparişler kartı — canlı API, tek liste */
exports.getOrdersCard = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return badRequest(res, "Kullanıcı ID'si gerekli.");
        }
        const data = await getOrdersCardData(userId);
        return ok(res, "Sipariş kartı verileri.", data);
    } catch (error) {
        logger.error("Orders card error", { error: error.message });
        return serverError(res, error, "Sipariş kartı yüklenemedi.");
    }
};
