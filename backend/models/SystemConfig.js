/**
 * SystemConfig Model — LysiaETIC
 *
 * Platform genelinde key-value yapıda ayar saklama.
 * Kullanım: Paket tanımları, global limitler, feature flags vb.
 *
 * Örnek:
 *   { key: "planDefinitions", value: { trial: {...}, basic: {...}, ... } }
 *   { key: "maintenanceMode", value: false }
 */

const mongoose = require("mongoose");

const systemConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        unique: true,
        required: true,
        index: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
}, { timestamps: true });

module.exports = mongoose.models.SystemConfig || mongoose.model("SystemConfig", systemConfigSchema);
