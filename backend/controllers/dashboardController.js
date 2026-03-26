const { getDashboardData } = require("../services/dashboardService");
const logger = require("../config/logger");

exports.getDashboardSummary = async (req, res) => {
    try {
        // userId'yi params'dan veya auth middleware'den al
        const userId = req.params.userId || req.user?._id || req.user?.id;

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
