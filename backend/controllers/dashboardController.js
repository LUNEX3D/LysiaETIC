const { getDashboardData } = require("../services/dashboardService");
const logger = require("../config/logger");

exports.getDashboardSummary = async (req, res) => {
    try {
        // ✅ FIX H3: IDOR — req.user._id öncelikli, params.userId sadece geriye uyumluluk için
        const userId = req.user?._id || req.user?.id || req.params.userId;

        if (!userId) {
            logger.warn("Dashboard request without userId");
            return res.status(400).json({ error: "Missing userId." });
        }

        const data = await getDashboardData(userId);
        return res.status(200).json(data);
    } catch (error) {
        logger.error("Dashboard summary error", { error: error.message });
        return res.status(500).json({ error: "Failed to load dashboard summary." });
    }
};
