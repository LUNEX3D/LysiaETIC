const mongoose = require("mongoose");
const { Schema } = mongoose;

const VariableSchemaItemSchema = new Schema(
    {
        key: { type: String, required: true },
        label: { type: String, required: true },
        group: { type: String, default: "general" },
        type: { type: String, enum: ["color", "font", "size", "select", "boolean", "text", "number"], required: true },
        defaultValue: { type: Schema.Types.Mixed },
        options: [{ value: Schema.Types.Mixed, label: String }],
        description: { type: String, default: "" },
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        unit: { type: String, default: "" },
    },
    { _id: false }
);

const WBThemeVersionSchema = new Schema(
    {
        themeId: { type: Schema.Types.ObjectId, ref: "WBTheme", required: true, index: true },

        version: { type: String, required: true, trim: true },
        releaseType: { type: String, enum: ["major", "minor", "patch", "beta", "rc"], default: "patch" },
        changelog: { type: String, default: "" },

        compatibility: {
            minPlanRequired: { type: String, enum: ["free", "trial", "basic", "pro", "enterprise"], default: "basic" },
            requiredFeatures: [{ type: String }],
            breakingChanges: { type: Boolean, default: false },
            breakingChangesDescription: { type: String, default: "" },
        },

        variableSchema: { type: [VariableSchemaItemSchema], default: [] },

        defaultSettings: {
            variables: { type: Schema.Types.Mixed, default: () => ({}) },
            headerConfig: { type: Schema.Types.Mixed, default: () => ({}) },
            footerConfig: { type: Schema.Types.Mixed, default: () => ({}) },
        },

        defaultHomeLayout: { type: [Schema.Types.Mixed], default: [] },

        status: { type: String, enum: ["draft", "published", "deprecated"], default: "draft", index: true },
        publishedAt: { type: Date, default: null },
        deprecatedAt: { type: Date, default: null },
        deprecationMessage: { type: String, default: "" },
        migrationGuideUrl: { type: String, default: "" },

        fileSizeKb: { type: Number, default: 0 },
        checksumHash: { type: String, default: "" },

        publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

WBThemeVersionSchema.index({ themeId: 1, version: 1 }, { unique: true });
WBThemeVersionSchema.index({ themeId: 1, status: 1 });

module.exports = mongoose.model("WBThemeVersion", WBThemeVersionSchema);
