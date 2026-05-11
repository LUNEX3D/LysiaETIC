/**
 * ═════════════════════════════════════════════════════════════════════════════
 * AutonomyConfig — Kullanıcı bazlı AI otonomi kuralları
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * AI Operator'ün hareket alanını şekillendiren, kullanıcı tarafından düzenlenebilen
 * tüm parametreleri tek bir document'te tutar. Hard-coded GUARDRAILS yerine
 * buradan okunur; her aksiyon kullanıcı kurallarına göre clamp/blok edilir.
 *
 * Modlar:
 *   - manual     : AI sadece öneri üretir, hiçbir aksiyonu otomatik yapmaz
 *   - supervised : Onay gerektiren aksiyonları "approved" beklemeye atar (default)
 *   - autonomous : Limitler dahilinde tam otonom — eşik altı her şeyi otomatik yapar
 * ═════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const CategoryRuleSchema = new mongoose.Schema({
    category: { type: String, required: true, trim: true },
    maxDiscountPercent: { type: Number, min: 0, max: 90 },
    minProfitMarginPercent: { type: Number, min: 0, max: 100 },
    targetProfitMarginPercent: { type: Number, min: 0, max: 200 },
    notes: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const WorkHoursSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    startHour: { type: Number, min: 0, max: 23, default: 9 },
    endHour: { type: Number, min: 0, max: 23, default: 22 },
    daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5, 6, 0] }, // 0=Pazar, 1=Pzt ... 6=Cmt
    timezone: { type: String, default: "Europe/Istanbul" },
}, { _id: false });

const AutonomyConfigSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

    // ── Genel Mod ───────────────────────────────────────────────────────────
    mode: { type: String, enum: ["manual", "supervised", "autonomous"], default: "supervised" },

    // ── Kâr & Marj Kuralları ────────────────────────────────────────────────
    targetProfitMarginPercent: { type: Number, min: 0, max: 200, default: 15 },  // hedef kâr marjı (öneriler bu hedefi gözetir)
    minProfitMarginPercent:    { type: Number, min: 0, max: 100, default: 5 },   // bu marjın altına asla düşme (zarar koruması)

    // ── Fiyat Aksiyonları ───────────────────────────────────────────────────
    maxPriceChangePercent: { type: Number, min: 1, max: 100, default: 20 },  // tek seferde max %X fiyat değişimi
    maxPriceIncreasePercent: { type: Number, min: 0, max: 100, default: 15 }, // fiyat ARTIŞINDA daha sıkı limit
    maxDiscountPercent: { type: Number, min: 0, max: 90, default: 30 },       // tek seferde max %X indirim
    minDiscountPercent: { type: Number, min: 0, max: 50, default: 3 },        // bu kadarın altı uygulanmaz

    // ── Stok Aksiyonları ────────────────────────────────────────────────────
    maxStockOrderQuantity: { type: Number, min: 1, max: 100000, default: 500 },
    enableAutoRestock: { type: Boolean, default: false },                     // otomatik tedarik siparişi

    // ── Hız & Rate Limiting ─────────────────────────────────────────────────
    maxActionsPerHour: { type: Number, min: 1, max: 1000, default: 50 },
    cooldownMinutes: { type: Number, min: 0, max: 720, default: 5 },          // aynı ürüne tekrar müdahale arası min süre

    // ── Onay Politikası ─────────────────────────────────────────────────────
    requireApprovalForCritical: { type: Boolean, default: true },
    autoApproveBelowImpactTRY: { type: Number, min: 0, max: 100000, default: 100 }, // bu TRY etkinin altındaki aksiyonlar otomatik onay
    autoApproveOnlyIfConfidence: { type: Number, min: 0, max: 100, default: 75 },   // bu güven puanı altında oto onay yok

    // ── Aksiyon İzinleri ────────────────────────────────────────────────────
    allowedActions: {
        type: [String],
        default: ["update_price", "apply_discount", "create_stock_order", "review_strategy", "investigate"],
    },

    // ── Ürün Whitelist / Blacklist ──────────────────────────────────────────
    productWhitelist: { type: [String], default: [] }, // boş = tüm ürünler. dolu = sadece bu barkodlar
    productBlacklist: { type: [String], default: [] }, // bu barkodlara asla müdahale yok

    // ── Kategori Kuralları ──────────────────────────────────────────────────
    categoryRules: { type: [CategoryRuleSchema], default: [] },

    // ── Çalışma Saatleri ────────────────────────────────────────────────────
    workHours: { type: WorkHoursSchema, default: () => ({}) },

    // ── Pazaryeri Kuralları ─────────────────────────────────────────────────
    marketplaceBlacklist: { type: [String], default: [] }, // bu pazaryerinde asla otomatik aksiyon yok
    requireSyncedMarketplace: { type: Boolean, default: true }, // sadece sync edilmiş pazaryeri ürünlerine müdahale

    // ── Bildirim Tercihleri ─────────────────────────────────────────────────
    notifyOnExecute: { type: Boolean, default: true },
    notifyOnBlocked: { type: Boolean, default: true },
    notifyOnError: { type: Boolean, default: true },

    // ── Audit ───────────────────────────────────────────────────────────────
    lastEditedAt: { type: Date, default: Date.now },
    lastEditedBy: { type: String, default: "user" },
    presetUsed: { type: String, enum: ["conservative", "balanced", "aggressive", "custom"], default: "balanced" },
}, { timestamps: true });

/* ─── Hazır preset şablonları (kullanıcı butona basınca uygular) ─── */
AutonomyConfigSchema.statics.PRESETS = {
    conservative: {
        mode: "supervised",
        targetProfitMarginPercent: 25,
        minProfitMarginPercent: 12,
        maxPriceChangePercent: 10,
        maxPriceIncreasePercent: 8,
        maxDiscountPercent: 15,
        maxStockOrderQuantity: 200,
        maxActionsPerHour: 20,
        cooldownMinutes: 30,
        requireApprovalForCritical: true,
        autoApproveBelowImpactTRY: 50,
        autoApproveOnlyIfConfidence: 85,
        enableAutoRestock: false,
    },
    balanced: {
        mode: "supervised",
        targetProfitMarginPercent: 15,
        minProfitMarginPercent: 5,
        maxPriceChangePercent: 20,
        maxPriceIncreasePercent: 15,
        maxDiscountPercent: 30,
        maxStockOrderQuantity: 500,
        maxActionsPerHour: 50,
        cooldownMinutes: 5,
        requireApprovalForCritical: true,
        autoApproveBelowImpactTRY: 100,
        autoApproveOnlyIfConfidence: 75,
        enableAutoRestock: false,
    },
    aggressive: {
        mode: "autonomous",
        targetProfitMarginPercent: 10,
        minProfitMarginPercent: 3,
        maxPriceChangePercent: 30,
        maxPriceIncreasePercent: 25,
        maxDiscountPercent: 50,
        maxStockOrderQuantity: 1000,
        maxActionsPerHour: 100,
        cooldownMinutes: 2,
        requireApprovalForCritical: false,
        autoApproveBelowImpactTRY: 500,
        autoApproveOnlyIfConfidence: 60,
        enableAutoRestock: true,
    },
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
AutonomyConfigSchema.statics.getOrCreate = async function (userId) {
    let cfg = await this.findOne({ userId }).lean();
    if (!cfg) {
        cfg = await this.create({ userId });
        cfg = cfg.toObject();
    }
    return cfg;
};

/** Belirli bir kategori için efektif kuralı döndür (kategori kuralı > genel kural) */
AutonomyConfigSchema.statics.getEffectiveCategoryRule = function (config, category) {
    if (!config || !category) return null;
    const rule = (config.categoryRules || []).find(r => r.category === category);
    if (!rule) return null;
    return {
        maxDiscountPercent: rule.maxDiscountPercent ?? config.maxDiscountPercent,
        minProfitMarginPercent: rule.minProfitMarginPercent ?? config.minProfitMarginPercent,
        targetProfitMarginPercent: rule.targetProfitMarginPercent ?? config.targetProfitMarginPercent,
    };
};

/** Şu an çalışma saatleri içindeyiz mi? */
AutonomyConfigSchema.statics.isWithinWorkHours = function (config, now = new Date()) {
    const wh = config?.workHours;
    if (!wh?.enabled) return true; // disable ise her zaman izinli
    try {
        const tzNow = new Date(now.toLocaleString("en-US", { timeZone: wh.timezone || "Europe/Istanbul" }));
        const day = tzNow.getDay();
        const hour = tzNow.getHours();
        if (!(wh.daysOfWeek || []).includes(day)) return false;
        const start = wh.startHour ?? 0;
        const end = wh.endHour ?? 24;
        if (start <= end) return hour >= start && hour < end;
        // 22 -> 06 gibi gece aşan aralık
        return hour >= start || hour < end;
    } catch {
        return true;
    }
};

/** Ürün bu config'e göre AI'ya açık mı? */
AutonomyConfigSchema.statics.isProductAllowed = function (config, barcode) {
    if (!config || !barcode) return true;
    if ((config.productBlacklist || []).includes(barcode)) return false;
    if ((config.productWhitelist || []).length > 0 && !config.productWhitelist.includes(barcode)) return false;
    return true;
};

/** Bu aksiyon tipi izinli mi? */
AutonomyConfigSchema.statics.isActionAllowed = function (config, actionType) {
    if (!config || !actionType) return true;
    if (!Array.isArray(config.allowedActions) || config.allowedActions.length === 0) return true;
    return config.allowedActions.includes(actionType);
};

module.exports = mongoose.model("AutonomyConfig", AutonomyConfigSchema);
