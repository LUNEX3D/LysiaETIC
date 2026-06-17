const mongoose = require("mongoose");

const StoreInboxMessageSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StoreInboxConversation",
            required: true,
            index: true,
        },
        externalId: { type: String, default: "" },
        direction: { type: String, enum: ["in", "out"], required: true },
        text: { type: String, default: "" },
        sentAt: { type: Date, default: Date.now },
        fromName: { type: String, default: "" },
    },
    { timestamps: true }
);

StoreInboxMessageSchema.index({ conversationId: 1, sentAt: 1 });

module.exports = mongoose.model("StoreInboxMessage", StoreInboxMessageSchema);
