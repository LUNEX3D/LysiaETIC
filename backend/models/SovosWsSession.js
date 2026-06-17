/**
 * Sovos e-Fatura WS oturumları — sunucu yeniden başlatıldığında sessionId geçerliliği
 */
const mongoose = require("mongoose");

const SovosWsSessionSchema = new mongoose.Schema(
    {
        sessionId: { type: String, required: true, unique: true, index: true },
        vknTckn: { type: String, default: "" },
        env: { type: String, enum: ["test", "production"], default: "test" },
        username: { type: String, default: "" },
        password: { type: String, default: "" },
        senderIdentifier: { type: String, default: "" },
        receiverIdentifier: { type: String, default: "" },
        expiresAt: { type: Date, required: true, index: true },
    },
    { timestamps: true, collection: "sovoswssessions" }
);

module.exports = mongoose.model("SovosWsSession", SovosWsSessionSchema);
