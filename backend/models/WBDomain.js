const mongoose = require("mongoose");
const { Schema } = mongoose;

const DnsRecordSchema = new Schema(
    {
        type: { type: String, enum: ["A", "CNAME", "TXT", "MX", "NS"], required: true },
        name: { type: String, required: true },
        value: { type: String, required: true },
        ttl: { type: Number, default: 3600 },
        priority: { type: Number, default: null },
        description: { type: String, default: "" },
    },
    { _id: false }
);

const SslCertSchema = new Schema(
    {
        issuer: { type: String, default: "" },
        validFrom: { type: Date, default: null },
        validTo: { type: Date, default: null },
        autoRenew: { type: Boolean, default: true },
        provider: { type: String, enum: ["letsencrypt", "cloudflare", "custom"], default: "letsencrypt" },
        certPath: { type: String, default: "" },
        keyPath: { type: String, default: "" },
    },
    { _id: false }
);

const WBDomainSchema = new Schema(
    {
        siteId: { type: Schema.Types.ObjectId, ref: "WBSite", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        domain: { type: String, required: true, unique: true, trim: true, lowercase: true },
        subdomain: { type: String, default: "" },

        domainType: {
            type: String,
            enum: ["primary", "alias", "subdomain"],
            default: "primary",
            index: true,
        },

        status: {
            type: String,
            enum: ["pending_dns", "dns_verified", "ssl_provisioning", "active", "failed", "expired"],
            default: "pending_dns",
            index: true,
        },

        verificationToken: { type: String, required: true },
        verificationMethod: { type: String, enum: ["dns_txt", "file"], default: "dns_txt" },
        verifiedAt: { type: Date, default: null },
        lastVerificationAttempt: { type: Date, default: null },
        verificationAttempts: { type: Number, default: 0 },

        requiredDnsRecords: { type: [DnsRecordSchema], default: [] },
        detectedDnsRecords: { type: [DnsRecordSchema], default: [] },

        ssl: { type: SslCertSchema, default: () => ({}) },
        sslStatus: {
            type: String,
            enum: ["none", "pending", "active", "renewing", "expired", "failed"],
            default: "none",
        },

        isPrimary: { type: Boolean, default: true },
        redirectWww: { type: Boolean, default: true },

        errorMessage: { type: String, default: "" },
        /** DNS worker (F1) — wbDomainWorker */
        nextCheckAt: { type: Date, default: null },
        /** SSL worker (F2) — wbSslWorker */
        nextSslCheckAt: { type: Date, default: null },
        provisionAttempts: { type: Number, default: 0 },
        lastSslAttemptAt: { type: Date, default: null },
    },
    { timestamps: true }
);

WBDomainSchema.index({ siteId: 1, domainType: 1 });
WBDomainSchema.index({ domain: 1 }, { unique: true });
WBDomainSchema.index({ status: 1, nextCheckAt: 1 });
WBDomainSchema.index({ status: 1, nextSslCheckAt: 1 });

module.exports = mongoose.model("WBDomain", WBDomainSchema);
