const mongoose = require("mongoose");

const fileMetaSchema = {
    fileName: { type: String, default: "" },
    url: { type: String, default: "" },
    uploadedAt: { type: Date },
};

const StoreSellerVerificationSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        businessType: {
            type: String,
            enum: ["none", "sole", "corporate"],
            required: false,
        },
        status: {
            type: String,
            enum: ["draft", "pending_review", "approved", "rejected"],
            default: "draft",
        },
        currentStep: { type: Number, default: 1, min: 1, max: 5 },
        general: {
            firstName: { type: String, default: "" },
            lastName: { type: String, default: "" },
            identityNumber: { type: String, default: "" },
            birthDate: { type: String, default: "" },
            address: { type: String, default: "" },
            country: { type: String, default: "TR" },
            postalCode: { type: String, default: "" },
            city: { type: String, default: "" },
            district: { type: String, default: "" },
        },
        documents: {
            idFront: fileMetaSchema,
            idBack: fileMetaSchema,
            residence: fileMetaSchema,
            taxPlate: fileMetaSchema,
            taxExemption: fileMetaSchema,
            hasTaxExemption: { type: Boolean, default: false },
        },
        iban: {
            iban: { type: String, default: "" },
            holderName: { type: String, default: "" },
            currency: { type: String, default: "TRY" },
        },
        submittedAt: { type: Date },
        reviewNote: { type: String, default: "" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("StoreSellerVerification", StoreSellerVerificationSchema);
