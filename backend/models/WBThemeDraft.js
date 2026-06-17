"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBThemeDraftSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        revision: { type: Number, default: 1 },
        status: { type: String, enum: ["draft", "published", "superseded"], default: "draft", index: true },
        document: { type: Schema.Types.Mixed, default: () => ({}) },
        publishedAt: { type: Date, default: null },
        label: { type: String, default: "" },
    },
    { timestamps: true }
);

WBThemeDraftSchema.index({ siteId: 1, status: 1, revision: -1 });

module.exports = mongoose.model("WBThemeDraft", WBThemeDraftSchema);
