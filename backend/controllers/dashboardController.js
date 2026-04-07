const { getDashboardData } = require("../services/dashboardService");
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

        const data = await getDashboardData(userId);
        return ok(res, "Dashboard verileri.", data);
    } catch (error) {
        logger.error("Dashboard summary error", { error: error.message });
        return serverError(res, error, "Dashboard verileri yüklenemedi.");
    }
};
