const mongoose = require("mongoose");
const { Schema } = mongoose;

const FormFieldSchema = new Schema(
    {
        id: { type: String, required: true },
        type: {
            type: String,
            enum: ["text", "email", "phone", "textarea", "select", "checkbox", "number", "date"],
            default: "text",
        },
        label: { type: String, required: true, trim: true },
        placeholder: { type: String, default: "" },
        required: { type: Boolean, default: false },
        options: { type: [String], default: [] },
        order: { type: Number, default: 0 },
    },
    { _id: false }
);

const WBFormSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 200 },
        slug: { type: String, required: true, trim: true, lowercase: true },
        status: { type: String, enum: ["draft", "active", "archived"], default: "draft", index: true },
        fields: { type: [FormFieldSchema], default: [] },
        settings: {
            submitButtonText: { type: String, default: "Gönder" },
            successMessage: { type: String, default: "Teşekkürler! Mesajınız alındı." },
            notifyEmail: { type: String, default: "" },
            redirectUrl: { type: String, default: "" },
            honeypotField: { type: String, default: "_hp" },
        },
        stats: { submissions: { type: Number, default: 0 } },
    },
    { timestamps: true }
);

WBFormSchema.index({ siteId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model("WBForm", WBFormSchema);
