const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["info", "warning", "maintenance", "feature", "update"],
        default: "info"
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium"
    },
    targetUsers: {
        type: String,
        enum: ["all", "active", "trial", "specific_plan"],
        default: "all"
    },
    targetPlan: String,
    isActive: {
        type: Boolean,
        default: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

AnnouncementSchema.index({ isActive: 1, startDate: -1 });

module.exports = mongoose.model("Announcement", AnnouncementSchema);
