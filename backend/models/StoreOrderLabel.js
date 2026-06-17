const mongoose = require("mongoose");

const StoreOrderLabelSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

StoreOrderLabelSchema.index({ storeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("StoreOrderLabel", StoreOrderLabelSchema);
