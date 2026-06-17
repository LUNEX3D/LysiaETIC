const mongoose = require("mongoose");
const { Schema } = mongoose;

const SettingFieldSchema = new Schema(
    {
        id: { type: String, required: true },
        label: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: [
                "text", "textarea", "richtext", "number", "range", "select",
                "radio", "checkbox", "color", "font", "image_picker",
                "video_url", "url", "product", "collection", "blog",
                "article", "page", "html",
            ],
        },
        defaultValue: { type: Schema.Types.Mixed },
        info: { type: String, default: "" },
        placeholder: { type: String, default: "" },
        options: [{ value: Schema.Types.Mixed, label: String }],
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        step: { type: Number, default: 1 },
        unit: { type: String, default: "" },
        conditions: { type: [Schema.Types.Mixed], default: [] },
    },
    { _id: false }
);

const BlockSchemaDefSchema = new Schema(
    {
        type: { type: String, required: true },
        name: { type: String, required: true },
        limit: { type: Number, default: null },
        settings: [SettingFieldSchema],
    },
    { _id: false }
);

const PresetSchema = new Schema(
    {
        name: { type: String, required: true },
        settings: { type: Schema.Types.Mixed, default: () => ({}) },
        blocks: [{ type: Schema.Types.Mixed }],
    },
    { _id: false }
);

const WBThemeSectionSchema = new Schema(
    {
        themeVersionId: { type: Schema.Types.ObjectId, ref: "WBThemeVersion", required: true, index: true },
        themeId: { type: Schema.Types.ObjectId, ref: "WBTheme", required: true, index: true },

        key: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },

        type: { type: String, enum: ["static", "dynamic"], default: "dynamic" },

        settingsSchema: { type: [SettingFieldSchema], default: [] },
        blocksSchema: { type: [BlockSchemaDefSchema], default: [] },
        presets: { type: [PresetSchema], default: [] },

        maxBlocks: { type: Number, default: null },
        minBlocks: { type: Number, default: 0 },

        tag: { type: String, default: "section" },
        class: { type: String, default: "" },

        allowedTemplates: [{ type: String }],

        isGlobal: { type: Boolean, default: false },
    },
    { timestamps: true }
);

WBThemeSectionSchema.index({ themeVersionId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("WBThemeSection", WBThemeSectionSchema);
