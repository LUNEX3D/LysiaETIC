/**
 * MasterCategoryMapping Model — LysiaETIC
 *
 * Excel'den import edilen master kategori eşleştirme tablosu.
 * Trendyol (master) → N11, ÇiçekSepeti, Hepsiburada, Amazon eşleştirmeleri.
 *
 * Kaynak: master_kategori_eslestirme.xlsx
 */

const mongoose = require("mongoose");

const MasterCategoryMappingSchema = new mongoose.Schema({
    masterId: {
        type: Number,
        required: true,
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

// Arama için text index
MasterCategoryMappingSchema.index({
    masterName: "text",
    masterPath: "text",
    trendyolPath: "text",
    n11Path: "text",
    ciceksepetiPath: "text"
});

// Composite index — aynı satırın tekrar eklenmesini önle
MasterCategoryMappingSchema.index(
    { masterId: 1, trendyolId: 1, n11Id: 1, ciceksepetiId: 1 },
    { unique: true }
);

module.exports = mongoose.model("MasterCategoryMapping", MasterCategoryMappingSchema);
