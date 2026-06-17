const mongoose = require("mongoose");

const StoreInboxConversationSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        channelId: { type: String, required: true, default: "instagram" },
        externalId: { type: String, required: true },
        participantName: { type: String, default: "" },
        participantUsername: { type: String, default: "" },
        participantAvatar: { type: String, default: "" },
        lastMessageText: { type: String, default: "" },
        lastMessageAt: { type: Date, default: null },
        unreadCount: { type: Number, default: 0 },
        /** Kanal özel bağlam (Trendyol: ürün görseli, link, durum vb.) */
        context: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    { timestamps: true }
);

StoreInboxConversationSchema.index({ storeId: 1, channelId: 1, externalId: 1 }, { unique: true });
StoreInboxConversationSchema.index({ storeId: 1, lastMessageAt: -1 });

module.exports = mongoose.model("StoreInboxConversation", StoreInboxConversationSchema);
