/**
 * MasterCategoryMapping Model — LysiaETIC
 *
 * Excel'den import edilen master kategori eşleştirme tablosu.
 * Trendyol (master) → N11, ÇiçekSepeti, Hepsiburada, Amazon eşleştirmeleri.
 *
 * ✅ FIX: Her masterId için TEK satır — duplike satırlar artık oluşmaz
 * ✅ FIX: Text index'e hepsiburadaPath ve amazonPath eklendi
 * ✅ FIX: Unique index masterId bazlı (1 master = 1 satır)
 *
 * Kaynak: master_kategori_eslestirme.xlsx
 */

const mongoose = require("mongoose");

const MasterCategoryMappingSchema = new mongoose.Schema({
    masterId: {
        type: Number,
        required: true,
        unique: true,   // ✅ FIX: Her masterId TEK satır
        index: true
    },
    masterName: {
        type: String,
        required: true
    },
    masterPath: {
        type: String,
        required: true
    },
    trendyolId: {
        type: Number,
        default: null
    },
    trendyolPath: {
        type: String,
        default: ""
    },
    n11Id: {
        type: Number,
        default: null
    },
    n11Path: {
        type: String,
        default: ""
    },
    ciceksepetiId: {
        type: Number,
        default: null
    },
    ciceksepetiPath: {
        type: String,
        default: ""
    },
    hepsiburadaId: {
        type: Number,
        default: null
    },
    hepsiburadaPath: {
        type: String,
        default: ""
    },
    amazonId: {
        type: String,
        default: null
    },
    amazonPath: {
        type: String,
        default: ""
    }
}, {
    timestamps: true,
    collection: "mastercategorymappings"
});

// ✅ FIX: Arama için text index — tüm path alanları dahil
MasterCategoryMappingSchema.index({
    masterName: "text",
    masterPath: "text",
    trendyolPath: "text",
    n11Path: "text",
    ciceksepetiPath: "text",
    hepsiburadaPath: "text",
    amazonPath: "text"
});

module.exports = mongoose.model("MasterCategoryMapping", MasterCategoryMappingSchema);
