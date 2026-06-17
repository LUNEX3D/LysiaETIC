const mongoose = require("mongoose");

const clientErrorLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    source: { type: String, default: "api" },
    statusCode: { type: Number, default: 0 },
    path: { type: String, default: "" },
    method: { type: String, default: "GET" },
    message: { type: String, required: true, maxlength: 500 },
    stack: { type: String, default: "", maxlength: 4000 },
    userAgent: { type: String, default: "", maxlength: 500 },
    pageUrl: { type: String, default: "", maxlength: 500 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, {
    timestamps: true
});

// 30 günden eski istemci hatalarını otomatik sil (Atlas kotası)
clientErrorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("ClientErrorLog", clientErrorLogSchema);
