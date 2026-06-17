const mongoose = require("mongoose");

const CHANNEL_IDS = [
    "instagram",
    "whatsapp",
    "facebook",
    "form",
    "email",
    "livechat",
    "amazon",
    "trendyol",
];

const InboxChannelSchema = new mongoose.Schema(
    {
        channelId: { type: String, required: true },
        connected: { type: Boolean, default: false },
        accountLabel: { type: String, default: "" },
        connectedAt: { type: Date, default: null },
        pageId: { type: String, default: "" },
        igUserId: { type: String, default: "" },
        externalRef: { type: String, default: "" },
        marketplaceId: { type: String, default: "" },
        accessToken: { type: String, default: "", select: false },
        tokenExpiresAt: { type: Date, default: null },
    },
    { _id: false }
);

const CannedResponseSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        text: { type: String, default: "" },
        order: { type: Number, default: 0 },
    },
    { _id: false }
);

const DEFAULT_CANNED = [
    { id: "c1", text: "Hoş geldiniz! Size nasıl yardımcı olabilirim?", order: 0 },
    { id: "c2", text: "Ürününüz hakkında detaylı bilgi almak ister misiniz?", order: 1 },
    { id: "c3", text: "Kargonuzun durumunu öğrenmek için adınızı ve sipariş numaranızı rica edebilir miyim?", order: 2 },
    { id: "c4", text: "İade veya değişim talebiniz varsa size hızlıca yardımcı olabilirim.", order: 3 },
    { id: "c5", text: "Ödeme ve teslimat seçenekleri hakkında bilgi ister misiniz?", order: 4 },
];

const StoreInboxSettingsSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        onboardingStep: {
            type: String,
            enum: ["welcome", "channels", "done"],
            default: "welcome",
        },
        channels: { type: [InboxChannelSchema], default: [] },
        cannedResponses: { type: [CannedResponseSchema], default: () => DEFAULT_CANNED },
    },
    { timestamps: true }
);

StoreInboxSettingsSchema.statics.CHANNEL_IDS = CHANNEL_IDS;
StoreInboxSettingsSchema.statics.DEFAULT_CANNED = DEFAULT_CANNED;

module.exports = mongoose.model("StoreInboxSettings", StoreInboxSettingsSchema);
