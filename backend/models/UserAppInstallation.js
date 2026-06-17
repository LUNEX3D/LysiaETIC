const mongoose = require("mongoose");

const UserAppInstallationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        appKey: { type: String, required: true, trim: true },
        config: { type: mongoose.Schema.Types.Mixed, default: {} },
        installedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

UserAppInstallationSchema.index({ userId: 1, appKey: 1 }, { unique: true });

module.exports = mongoose.model("UserAppInstallation", UserAppInstallationSchema);
