const mongoose = require("mongoose");
const { Schema } = mongoose;

const PopupSectionSchema = new Schema(
    {
        id: { type: String, required: true },
        type: { type: String, required: true },
        order: { type: Number, default: 0 },
        settings: { type: Schema.Types.Mixed, default: () => ({}) },
        content: { type: Schema.Types.Mixed, default: () => ({}) },
    },
    { _id: false }
);

const WBPopupSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },

        name: { type: String, required: true, trim: true, maxlength: 200 },

        status: {
            type: String,
            enum: ["draft", "active", "paused", "archived", "scheduled"],
            default: "draft",
            index: true,
        },

        type: {
            type: String,
            enum: ["popup", "banner_top", "banner_bottom", "slide_in", "fullscreen", "drawer"],
            default: "popup",
        },

        trigger: {
            type: { type: String, enum: ["time_delay", "scroll_depth", "exit_intent", "page_view_count", "click", "immediate"], default: "time_delay" },
            delaySeconds: { type: Number, default: 3 },
            scrollDepthPercent: { type: Number, default: 50 },
            pageViewCount: { type: Number, default: 3 },
            targetSelector: { type: String, default: "" },
        },

        targeting: {
            pages: { type: String, enum: ["all", "specific", "except"], default: "all" },
            pageIds: [{ type: Schema.Types.ObjectId, ref: "WBPage" }],
            devices: { type: String, enum: ["all", "desktop", "mobile", "tablet"], default: "all" },
            newVisitors: { type: Boolean, default: true },
            returningVisitors: { type: Boolean, default: true },
            frequency: { type: String, enum: ["once_per_session", "once_per_day", "once_per_week", "always"], default: "once_per_session" },
            cookieDurationDays: { type: Number, default: 30 },
        },

        design: {
            sections: { type: [PopupSectionSchema], default: [] },
            width: { type: String, default: "480px" },
            maxWidth: { type: String, default: "90vw" },
            borderRadius: { type: String, default: "12px" },
            overlay: { type: Boolean, default: true },
            overlayColor: { type: String, default: "rgba(0,0,0,0.5)" },
            overlayClickClose: { type: Boolean, default: true },
            showCloseButton: { type: Boolean, default: true },
            closeButtonPosition: { type: String, enum: ["top-right", "top-left", "inside"], default: "top-right" },
            animation: { type: String, enum: ["fade", "slide-up", "slide-down", "scale", "none"], default: "fade" },
            position: { type: String, enum: ["center", "top", "bottom", "left", "right"], default: "center" },
        },

        schedule: {
            startAt: { type: Date, default: null },
            endAt: { type: Date, default: null },
        },

        stats: {
            views: { type: Number, default: 0 },
            clicks: { type: Number, default: 0 },
            closes: { type: Number, default: 0 },
            conversions: { type: Number, default: 0 },
            conversionRate: { type: Number, default: 0 },
        },

        abTestVariantOf: { type: Schema.Types.ObjectId, ref: "WBPopup", default: null },
    },
    { timestamps: true }
);

WBPopupSchema.index({ siteId: 1, status: 1 });

module.exports = mongoose.model("WBPopup", WBPopupSchema);
