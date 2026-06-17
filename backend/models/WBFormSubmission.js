const mongoose = require("mongoose");
const { Schema } = mongoose;

const WBFormSubmissionSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        pageId: { type: Schema.Types.ObjectId, ref: "WBPage", default: null },
        sectionId: { type: String, default: "" },
        formId: { type: String, default: "" },

        fields: { type: Schema.Types.Mixed, required: true },
        ipAddress: { type: String, default: "" },
        userAgent: { type: String, default: "" },
        referrer: { type: String, default: "" },
        language: { type: String, default: "tr" },

        status: { type: String, enum: ["new", "read", "replied", "spam", "archived"], default: "new", index: true },
        isRead: { type: Boolean, default: false },
        repliedAt: { type: Date, default: null },
        notes: { type: String, default: "" },
    },
    { timestamps: true }
);

WBFormSubmissionSchema.index({ siteId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("WBFormSubmission", WBFormSubmissionSchema);
