const mongoose = require("mongoose");

const StoreCustomerGroupSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, enum: ["static", "dynamic"], default: "static" },
    },
    { timestamps: true }
);

StoreCustomerGroupSchema.index({ storeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("StoreCustomerGroup", StoreCustomerGroupSchema);
