const mongoose = require("mongoose");

const StorePaymentSettingsSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, unique: true },
        paytr: {
            enabled: { type: Boolean, default: false },
            merchantId: { type: String, default: "" },
            merchantKeyEnc: { type: String, default: "" },
            merchantSaltEnc: { type: String, default: "" },
            testMode: { type: Boolean, default: true },
            /** Satıcının PayTR panelinde tanımlayacağı bildirim URL */
            notifyUrlHint: { type: String, default: "" },
        },
        bankTransfer: {
            enabled: { type: Boolean, default: false },
            instructions: { type: String, default: "" },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("StorePaymentSettings", StorePaymentSettingsSchema);
