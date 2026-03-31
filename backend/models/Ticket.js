const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    ticketNumber: {
        type: String,
        unique: true,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ["technical", "billing", "feature_request", "bug", "general"],
        default: "general"
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high", "urgent"],
        default: "medium"
    },
    status: {
        type: String,
        enum: ["open", "in_progress", "waiting_customer", "resolved", "closed"],
        default: "open"
    },
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        senderType: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },
        message: String,
        attachments: [String],
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    resolvedAt: Date,
    closedAt: Date,
    tags: [String]
}, { timestamps: true });

TicketSchema.index({ status: 1, createdAt: -1 });
TicketSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("Ticket", TicketSchema);
