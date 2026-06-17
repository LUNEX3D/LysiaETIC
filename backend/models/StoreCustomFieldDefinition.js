const mongoose = require("mongoose");

const CUSTOM_FIELD_TYPES = [
    "boolean",
    "choice",
    "color",
    "date",
    "datetime",
    "html",
    "image",
    "multiselect",
    "number",
    "product",
    "table",
    "text",
];

const StoreCustomFieldDefinitionSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true },
        key: { type: String, required: true, trim: true, lowercase: true },
        type: { type: String, enum: CUSTOM_FIELD_TYPES, default: "html" },
        options: [{ type: String, trim: true }],
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

StoreCustomFieldDefinitionSchema.index({ storeId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("StoreCustomFieldDefinition", StoreCustomFieldDefinitionSchema);
module.exports.CUSTOM_FIELD_TYPES = CUSTOM_FIELD_TYPES;
