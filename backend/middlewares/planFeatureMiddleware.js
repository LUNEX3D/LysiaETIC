/**
 * Paket bazlı özellik kilidi
 */
const {
    getEffectivePlan,
    hasFeature,
    featureDeniedPayload
} = require("../services/planFeatureService");

const requirePlanFeature = (featureId) => async (req, res, next) => {
    try {
        if (req.user && ["admin", "dev"].includes(req.user.role)) {
            req.subscriptionPlan = "enterprise";
            return next();
        }

        const plan = req.subscriptionPlan || getEffectivePlan(req.user);
        req.subscriptionPlan = plan;

        if (!hasFeature(plan, featureId)) {
            return res.status(403).json(featureDeniedPayload(featureId, plan));
        }
        return next();
    } catch (err) {
        return res.status(500).json({
            success: false,
            code: "PLAN_FEATURE_CHECK_ERROR",
            message: err.message || "Özellik kontrolü başarısız"
        });
    }
};

/** İstek sonrası plan bağlamı (entitlements API vb.) */
const attachPlanContext = async (req, res, next) => {
    try {
        const { getPlanContext } = require("../services/planFeatureService");
        if (req.user) {
            req.planContext = await getPlanContext(req.user);
            if (!req.subscriptionPlan) {
                req.subscriptionPlan = req.planContext.plan;
            }
        }
        next();
    } catch {
        next();
    }
};

module.exports = { requirePlanFeature, attachPlanContext };
