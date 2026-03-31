const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: ["user", "subscription", "payment", "product", "order", "marketplace", "system", "security"],
        default: "system"
    },
    severity: {
        type: String,
        enum: ["info", "warning", "error", "critical"],
        default: "info"
    },
    description: String,
    metadata: {
        type: Object,
        default: {}
    },
    ipAddress: String,
    userAgent: String,
    success: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
