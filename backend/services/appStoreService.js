const UserAppInstallation = require("../models/UserAppInstallation");
const { CATEGORIES, APPS } = require("../config/appCatalog");
const { hasFeature } = require("./planFeatureService");

const CORE_APP_KEYS = APPS.filter((a) => a.isCore).map((a) => a.appKey);

async function ensureCoreApps(userId) {
    const count = await UserAppInstallation.countDocuments({ userId });
    if (count > 0) return;
    const docs = CORE_APP_KEYS.map((appKey) => ({ userId, appKey }));
    await UserAppInstallation.insertMany(docs, { ordered: false }).catch(() => {});
}

function getAppByKey(appKey) {
    return APPS.find((a) => a.appKey === appKey) || null;
}

function canInstallApp(plan, app) {
    if (!app) return { ok: false, reason: "Uygulama bulunamadı" };
    if (app.comingSoon) return { ok: false, reason: "Bu uygulama yakında" };
    if (app.featureId && !hasFeature(plan, app.featureId)) {
        return { ok: false, reason: "Paketiniz bu uygulamayı desteklemiyor", upgrade: true };
    }
    return { ok: true };
}

async function listCatalog(userId, plan, { categoryId, search } = {}) {
    await ensureCoreApps(userId);
    const installed = await UserAppInstallation.find({ userId }).lean();
    const installedSet = new Set(installed.map((i) => i.appKey));

    let apps = [...APPS];
    if (categoryId) apps = apps.filter((a) => a.categoryId === categoryId);
    if (search) {
        const q = String(search).toLowerCase();
        apps = apps.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                a.shortDescription.toLowerCase().includes(q)
        );
    }

    apps = apps.map((a) => ({
        ...a,
        installed: installedSet.has(a.appKey),
        canInstall: canInstallApp(plan, a).ok,
        installBlockedReason: canInstallApp(plan, a).ok ? null : canInstallApp(plan, a).reason,
    }));

    return { categories: CATEGORIES, apps, plan };
}

async function listInstalled(userId, plan) {
    await ensureCoreApps(userId);
    const rows = await UserAppInstallation.find({ userId }).sort({ installedAt: -1 }).lean();
    return rows
        .map((row) => {
            const app = getAppByKey(row.appKey);
            if (!app) return null;
            return {
                ...app,
                installedAt: row.installedAt,
                config: row.config,
                panelRoute: app.panelRoute,
                canOpen: !app.comingSoon && (!app.featureId || hasFeature(plan, app.featureId)),
            };
        })
        .filter(Boolean);
}

async function installApp(userId, plan, appKey) {
    const app = getAppByKey(appKey);
    const check = canInstallApp(plan, app);
    if (!check.ok) return { error: check.reason, upgrade: check.upgrade };

    const doc = await UserAppInstallation.findOneAndUpdate(
        { userId, appKey },
        { $setOnInsert: { userId, appKey, installedAt: new Date() } },
        { upsert: true, new: true }
    );
    return { installation: doc.toObject(), app };
}

async function uninstallApp(userId, appKey) {
    const app = getAppByKey(appKey);
    if (app?.isCore) {
        return { error: "Çekirdek uygulamalar kaldırılamaz" };
    }
    await UserAppInstallation.deleteOne({ userId, appKey });
    return { success: true };
}

module.exports = {
    listCatalog,
    listInstalled,
    installApp,
    uninstallApp,
    getAppByKey,
    ensureCoreApps,
};
