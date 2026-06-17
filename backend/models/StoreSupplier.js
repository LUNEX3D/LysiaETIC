const mongoose = require("mongoose");

const StoreSupplierSchema = new mongoose.Schema(
    {
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        email: { type: String, default: "", trim: true },
        phoneCountryCode: { type: String, default: "+90", trim: true },
        phone: { type: String, default: "", trim: true },
        company: { type: String, default: "", trim: true },
        contactName: { type: String, default: "", trim: true },
        taxNumber: { type: String, default: "", trim: true },
        taxOffice: { type: String, default: "", trim: true },
        address: { type: String, default: "", trim: true },
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

StoreSupplierSchema.index({ storeId: 1, name: 1 });

module.exports = mongoose.model("StoreSupplier", StoreSupplierSchema);
