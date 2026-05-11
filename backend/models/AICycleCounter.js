/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AICycleCounter — Kullanıcı bazlı atomic cycle sayacı
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * AICycleResult.cycleNumber için race-free atomic increment.
 * Bir kullanıcı için eş zamanlı iki cycle aynı sayıyı asla almaz.
 *
 * Kullanım:
 *   const n = await AICycleCounter.nextNumber(userId);
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");

const AICycleCounterSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
    },
    cycleNumber: { type: Number, default: 0 },
}, { timestamps: true });

AICycleCounterSchema.statics.nextNumber = async function (userId) {
    const doc = await this.findOneAndUpdate(
        { userId },
        { $inc: { cycleNumber: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc.cycleNumber;
};

module.exports = mongoose.model("AICycleCounter", AICycleCounterSchema);
