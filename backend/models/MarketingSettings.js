const mongoose = require("mongoose");

const MarketingSettingsSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, unique: true },
        attributionModel: { type: String, enum: ["click", "view"], default: "click" },
        quietHours: {
            enabled: { type: Boolean, default: true },
            start: { type: String, default: "22:00" },
            end: { type: String, default: "09:00" },
        },
        limits: {
            smsPer24h: { type: Number, default: 3 },
            emailPer24h: { type: Number, default: 2 },
        },
        smsProvider: {
            provider: {
                type: String,
                enum: ["", "netgsm", "iletimerkezi", "mutlucell", "vodafone"],
                default: "",
            },
            senderId: { type: String, default: "" },
            apiUser: { type: String, default: "" },
            apiKeyEnc: { type: String, default: "" },
        },
        emailFromName: { type: String, default: "" },
        emailFromAddress: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("MarketingSettings", MarketingSettingsSchema);
