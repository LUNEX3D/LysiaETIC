const mongoose = require("mongoose");

const StoreUnitSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

StoreUnitSchema.index({ storeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("StoreUnit", StoreUnitSchema);
