const mongoose = require("mongoose");

/**
 * ASYNC JOB MODELİ
 *
 * Asenkron işlemlerin durumunu takip eder
 * Ürün çekme, dağıtım, senkronizasyon vb.
 */
const AsyncJobSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // İş tipi
    jobType: {
        type: String,
        required: true,
        enum: [
            "pull_products",
            "pull_categories",
            "distribute_products",
            "sync_stock",
            "sync_price",
            "bulk_operation"
        ]
    },

    // İş durumu
    status: {
        type: String,
        required: true,
        enum: ["pending", "running", "completed", "failed", "cancelled"],
        default: "pending"
    },

    // İş parametreleri
    params: {
        marketplaceName: String,
        marketplaceId: String,
        productIds: [String],
        targetMarketplaces: [String],
        // Diğer parametreler
        custom: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        }
    },

    // İlerleme bilgileri
    progress: {
        total: { type: Number, default: 0 },
        processed: { type: Number, default: 0 },
        success: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 }
    },

    // Sonuç bilgileri
    result: {
        message: String,
        data: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },
        errors: [{
            marketplace: String,
            productId: String,
            error: String
        }]
    },

    // Zaman bilgileri
    startedAt: { type: Date },
    completedAt: { type: Date },
    estimatedCompletionAt: { type: Date },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// İndeksler
AsyncJobSchema.index({ userId: 1, status: 1 });
AsyncJobSchema.index({ userId: 1, jobType: 1, createdAt: -1 });

// İlerleme yüzdesini hesapla
AsyncJobSchema.methods.calculateProgress = function() {
    const { total, processed } = this.progress;
    this.progress.percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    return this.progress.percentage;
};

// İşlemi başlat
AsyncJobSchema.methods.start = function() {
    this.status = "running";
    this.startedAt = new Date();
    return this.save();
};

// İşlemi tamamla
AsyncJobSchema.methods.complete = function(message, data) {
    this.status = "completed";
    this.completedAt = new Date();
    this.result.message = message;
    if (data) {
        this.result.data = data;
    }
    this.calculateProgress();
    return this.save();
};

// İşlemi başarısız olarak işaretle
AsyncJobSchema.methods.fail = function(error) {
    this.status = "failed";
    this.completedAt = new Date();
    this.result.message = error.message || "İşlem başarısız";
    return this.save();
};

// İlerleme güncelle
AsyncJobSchema.methods.updateProgress = function(processed, success, failed) {
    this.progress.processed = processed;
    if (success !== undefined) this.progress.success = success;
    if (failed !== undefined) this.progress.failed = failed;
    this.calculateProgress();
    return this.save();
};

// Kullanıcıya göre aktif işleri bul
AsyncJobSchema.statics.findActiveJobs = function(userId) {
    return this.find({
        userId,
        status: { $in: ["pending", "running"] }
    }).sort({ createdAt: -1 });
};

// Kullanıcıya göre tamamlanan işleri bul
AsyncJobSchema.statics.findCompletedJobs = function(userId, limit = 10) {
    return this.find({
        userId,
        status: { $in: ["completed", "failed"] }
    }).sort({ createdAt: -1 }).limit(limit);
};

module.exports = mongoose.model("AsyncJob", AsyncJobSchema);
