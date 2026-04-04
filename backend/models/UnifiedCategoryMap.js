const mongoose = require("mongoose");

/**
 * BİRLEŞİK KATEGORİ HARİTASI — Unified Category Map
 *
 * 5 pazaryerinin (Trendyol, N11, ÇiçekSepeti, Hepsiburada, Amazon) kategorilerini
 * TEK bir ortak isim altında birleştiren merkezi eşleştirme tablosu.
 *
 * matchType:
 *   "exact"   — Tüm platformlarda birebir aynı isim
 *   "2of3"    — 2+ platformda eşleşme var
 *   "single"  — Sadece 1 platformda var
 *   "manual"  — Kullanıcı tarafından manuel eşleştirilmiş
 */
const PlatformCategorySchema = new mongoose.Schema({
    categoryId:   { type: String, default: null },
    categoryName: { type: String, default: null },
    categoryPath: { type: String, default: null },
    depth:        { type: Number, default: 0 },
    parentId:     { type: String, default: null },
    parentName:   { type: String, default: null },
    isLeaf:       { type: Boolean, default: true }
}, { _id: false });

const UnifiedCategoryMapSchema = new mongoose.Schema({
    canonicalName: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    normalizedKey: {
        type: String,
        required: true,
        index: true
    },

    canonicalPath: {
        type: String,
        default: ""
    },

    rootCategory: {
        type: String,
        default: ""
    },

    trendyol:    { type: PlatformCategorySchema, default: null },
    n11:         { type: PlatformCategorySchema, default: null },
    ciceksepeti: { type: PlatformCategorySchema, default: null },
    hepsiburada: { type: PlatformCategorySchema, default: null },
    amazon:      { type: PlatformCategorySchema, default: null },

    platformCount: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
        index: true
    },

    matchType: {
        type: String,
        enum: ["exact", "2of3", "single", "manual"],
        default: "single",
        index: true
    },

    isLeaf: {
        type: Boolean,
        default: true,
        index: true
    },

    notes: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

UnifiedCategoryMapSchema.index({ normalizedKey: 1 }, { unique: true });
UnifiedCategoryMapSchema.index({ canonicalName: "text", canonicalPath: "text" });
UnifiedCategoryMapSchema.index({ matchType: 1, platformCount: 1 });
UnifiedCategoryMapSchema.index({ rootCategory: 1 });

module.exports = mongoose.model("UnifiedCategoryMap", UnifiedCategoryMapSchema);
