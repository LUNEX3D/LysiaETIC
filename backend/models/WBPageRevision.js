const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBPageRevisionSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        pageId: { type: Schema.Types.ObjectId, ref: "WBPage", required: true, index: true },
        revisionNumber: { type: Number, required: true },
        label: { type: String, default: "", trim: true, maxlength: 120 },
        sections: { type: Schema.Types.Mixed, default: [] },
        seo: { type: Schema.Types.Mixed, default: null },
        themeVariablesSnapshot: { type: Schema.Types.Mixed, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

WBPageRevisionSchema.index({ siteId: 1, pageId: 1, revisionNumber: -1 }, { unique: true });
WBPageRevisionSchema.index({ siteId: 1, pageId: 1, createdAt: -1 });

module.exports = mongoose.model("WBPageRevision", WBPageRevisionSchema);
