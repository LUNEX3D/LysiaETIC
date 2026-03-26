import mongoose from "mongoose";

const UserMarketplaceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    marketplaceName: { type: String, required: true },
    apiKey: { type: String, required: true },
    apiSecret: { type: String, required: true },
    connectedAt: { type: Date, default: Date.now },
});

export default mongoose.model("UserMarketplace", UserMarketplaceSchema);