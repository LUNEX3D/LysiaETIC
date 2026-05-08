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

module.exports = mongoose.model("ClientErrorLog", clientErrorLogSchema);
