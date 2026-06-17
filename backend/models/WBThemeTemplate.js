const mongoose = require("mongoose");
const { Schema } = mongoose;

const DefaultLayoutItemSchema = new Schema(
    {
        id: { type: String, required: true },
        sectionSchemaKey: { type: String, default: "" },
        blockType: { type: String, required: true },
        settings: { type: Schema.Types.Mixed, default: () => ({}) },
        content: { type: Schema.Types.Mixed, default: () => ({}) },
        order: { type: Number, default: 0 },
        isRequired: { type: Boolean, default: false },
        isDraggable: { type: Boolean, default: true },
        isDeletable: { type: Boolean, default: true },
    },
    { _id: false }
);

const WBThemeTemplateSchema = new Schema(
    {
        themeVersionId: { type: Schema.Types.ObjectId, ref: "WBThemeVersion", required: true, index: true },
        themeId: { type: Schema.Types.ObjectId, ref: "WBTheme", required: true, index: true },

        templateType: {
            type: String,
            required: true,
            enum: [
                "index",
                "product",
                "collection",
                "blog",
                "article",
                "cart",
                "checkout",
                "account",
                "search",
                "404",
                "password",
                "gift_card",
                "custom",
            ],
        },

        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },

        defaultLayout: { type: [DefaultLayoutItemSchema], default: [] },

        allowedBlockTypes: [{ type: String }],
        restrictedBlockTypes: [{ type: String }],

        requiredBlockTypes: [{ type: String }],

        schema: { type: [Schema.Types.Mixed], default: [] },

        isDefault: { type: Boolean, default: true },
        isCustomizable: { type: Boolean, default: true },
    },
    { timestamps: true }
);

WBThemeTemplateSchema.index({ themeVersionId: 1, templateType: 1 });

module.exports = mongoose.model("WBThemeTemplate", WBThemeTemplateSchema);
