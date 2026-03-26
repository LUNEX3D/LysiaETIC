const mongoose = require("mongoose");

const BrandSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

module.exports = mongoose.model("Brand", BrandSchema);
