/**
 * Paket özellik ve limit kontrolü — admin planDefinitions + registry
 */
const SystemConfig = require("../models/SystemConfig");
const { DEFAULT_PLAN_DEFINITIONS, PLAN_LIMITS_BY_KEY } = require("../config/defaultPlanDefinitions");
const {
    PLAN_RANK,
    FEATURES,
    UPGRADE_HINT,
    isMarketplaceAllowedForPlan
} = require("../config/planFeatureRegistry");

let _planDefsCache = null;
let _planDefsCacheTime = 0;
const CACHE_TTL = 60 * 1000;

async function getPlanDefinitions() {
    const now = Date.now();
    if (_planDefsCache && now - _planDefsCacheTime < CACHE_TTL) {
        return _planDefsCache;
    }
    try {
        const doc = await SystemConfig.findOne({ key: "planDefinitions" }).lean();
        _planDefsCache = doc?.value && typeof doc.value === "object"
            ? doc.value
            : DEFAULT_PLAN_DEFINITIONS;
    } catch {
        _planDefsCache = DEFAULT_PLAN_DEFINITIONS;
    }
    _planDefsCacheTime = now;
    return _planDefsCache;
}

function invalidatePlanDefinitionsCache() {
    _planDefsCache = null;
    _planDefsCacheTime = 0;
}

function getEffectivePlan(user) {
    if (!user) return "trial";
    if (["admin", "dev"].includes(user.role)) return "enterprise";
    const sub = user.subscription || {};
    if (sub.status === "active" && sub.plan && sub.plan !== "trial") {
        return sub.plan;
    }
    if ((sub.status === "trial" || sub.plan === "trial") && sub.trialEndDate) {
        const end = new Date(sub.trialEndDate);
        if (end > new Date()) return "trial";
    }
    if (sub.status === "active" && sub.endDate && new Date(sub.endDate) > new Date()) {
        return sub.plan || "trial";
    }
    return sub.plan || "trial";
}

function getPlanRank(plan) {
    return PLAN_RANK[plan] ?? 0;
}

function hasFeature(plan, featureId) {
    const feat = FEATURES[featureId];
    if (!feat) return true;
    return getPlanRank(plan) >= getPlanRank(feat.minPlan);
}

function getUpgradePlanForFeature(featureId) {
    const feat = FEATURES[featureId];
    return feat?.minPlan || "pro";
}

function buildEntitlements(plan) {
    const entitlements = {};
    for (const id of Object.keys(FEATURES)) {
        entitlements[id] = hasFeature(plan, id);
    }
    return entitlements;
}

async function getLimitsForPlan(plan) {
    const defs = await getPlanDefinitions();
    return defs[plan]?.limits || PLAN_LIMITS_BY_KEY[plan] || PLAN_LIMITS_BY_KEY.trial;
}

async function getPlanContext(user) {
    const plan = getEffectivePlan(user);
    const limits = await getLimitsForPlan(plan);
    const definitions = await getPlanDefinitions();
    const planDef = definitions[plan] || {};
    return {
        plan,
        planRank: getPlanRank(plan),
        limits,
        entitlements: buildEntitlements(plan),
        features: planDef.features || [],
        planName: planDef.name || plan,
        upgradeHint: UPGRADE_HINT[plan] || "pro"
    };
}

function featureDeniedPayload(featureId, plan) {
    const feat = FEATURES[featureId] || { label: featureId, minPlan: "pro" };
    const required = feat.minPlan;
    const requiredName = DEFAULT_PLAN_DEFINITIONS[required]?.name || required;
    return {
        success: false,
        code: "PLAN_FEATURE_LOCKED",
        feature: featureId,
        currentPlan: plan,
        requiredPlan: required,
        requiredPlanName: requiredName,
        message: `Bu özellik "${requiredName}" paketi ve üzeri için kullanılabilir. Mevcut paketiniz: ${DEFAULT_PLAN_DEFINITIONS[plan]?.name || plan}.`
    };
}

function limitDeniedPayload(limitKey, plan, current, max) {
    return {
        success: false,
        code: "PLAN_LIMIT_REACHED",
        limitKey,
        currentPlan: plan,
        current,
        max,
        message: `Paket limitinize ulaştınız (${limitKey}: ${current}/${max}). Daha yüksek bir pakete geçin.`
    };
}

module.exports = {
    getPlanDefinitions,
    invalidatePlanDefinitionsCache,
    getEffectivePlan,
    getPlanRank,
    hasFeature,
    getUpgradePlanForFeature,
    buildEntitlements,
    getLimitsForPlan,
    getPlanContext,
    featureDeniedPayload,
    limitDeniedPayload,
    isMarketplaceAllowedForPlan
};
