const mongoose = require("mongoose");

const StoreCustomerAddressSchema = new mongoose.Schema(
    {
        title: { type: String, default: "" },
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        identityNumber: { type: String, default: "" },
        line1: { type: String, default: "" },
        line2: { type: String, default: "" },
        zip: { type: String, default: "" },
        country: { type: String, default: "Türkiye" },
        city: { type: String, default: "" },
        district: { type: String, default: "" },
        phone: { type: String, default: "" },
        phoneCountryCode: { type: String, default: "+90" },
        isDefault: { type: Boolean, default: false },
        invoiceType: { type: String, enum: ["individual", "corporate"], default: "individual" },
        companyName: { type: String, default: "" },
        taxOffice: { type: String, default: "" },
        taxNumber: { type: String, default: "" },
    },
    { timestamps: true }
);

const StoreCustomerCustomFieldSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        value: { type: String, default: "" },
        fieldType: { type: String, default: "text" },
    },
    { _id: true }
);

const StoreCustomerSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        email: { type: String, default: "", trim: true, lowercase: true },
        phone: { type: String, default: "" },
        phoneCountryCode: { type: String, default: "+90" },
        preferredLanguage: { type: String, default: "tr" },
        marketingEmailConsent: { type: Boolean, default: false },
        groups: { type: [String], default: [] },
        tags: { type: [String], default: [] },
        addresses: { type: [StoreCustomerAddressSchema], default: [] },
        notes: { type: String, default: "" },
        customFields: { type: [StoreCustomerCustomFieldSchema], default: [] },
        hasAccount: { type: Boolean, default: false },
        registrationMethod: { type: String, default: "manual" },
        lastVisitAt: { type: Date },
        timeline: [
            {
                type: { type: String, default: "note" },
                actor: { type: String, default: "" },
                message: { type: String, default: "" },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

StoreCustomerSchema.index({ storeId: 1, email: 1 });
StoreCustomerSchema.index({ storeId: 1, createdAt: -1 });

StoreCustomerSchema.virtual("fullName").get(function fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(" ").trim();
});

StoreCustomerSchema.set("toJSON", { virtuals: true });
StoreCustomerSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("StoreCustomer", StoreCustomerSchema);
