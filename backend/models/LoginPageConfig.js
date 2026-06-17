const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        logoUrl: { type: String, default: "" },
        website: { type: String, default: "", trim: true },
        order: { type: Number, default: 0 },
        active: { type: Boolean, default: true },
    },
    { _id: true }
);

const loginPageConfigSchema = new mongoose.Schema(
    {
        key: { type: String, default: "default", unique: true, index: true },
        hero: {
            titleLine1: { type: String, default: "" },
            titleLine2: { type: String, default: "" },
            titleEmphasis: { type: String, default: "" },
            description1: { type: String, default: "" },
            description2: { type: String, default: "" },
        },
        partners: {
            enabled: { type: Boolean, default: true },
            kicker: { type: String, default: "Referanslarımız" },
            title: { type: String, default: "" },
            subtitle: { type: String, default: "" },
            useTemplateWhenEmpty: { type: Boolean, default: true },
            items: [partnerSchema],
        },
        sections: {
            features: { type: mongoose.Schema.Types.Mixed, default: {} },
            pricing: { type: mongoose.Schema.Types.Mixed, default: {} },
            about: { type: mongoose.Schema.Types.Mixed, default: {} },
            contact: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("LoginPageConfig", loginPageConfigSchema);
