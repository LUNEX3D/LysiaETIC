const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    platform: { type: String, required: true }, // Trendyol, N11 vb.
});

module.exports = mongoose.model("Category", categorySchema);
