/**
 * Amazon SP-API — Resmi kimlik bilgisi modeli
 * @see https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api
 * @see https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials
 *
 * Satıcıdan istenen (LWA + IAM + Selling Partner ID):
 *   - LWA Client ID, Client Secret, Refresh Token (yetkilendirme sonrası)
 *   - AWS Access Key ID, Secret Access Key (IAM kullanıcı — execute-api imzası)
 *   - Selling Partner ID (sellerId)
 *
 * Sistem tarafından türetilen (kullanıcıdan istenmez):
 *   - marketplaceId (entegrasyon kartına göre)
 *   - region, host (marketplaceId → SP-API endpoint)
 */

const MARKETPLACE_IDS = {
    TR: "A33AVAJ2PDY3EV",
    DE: "A1PA6795UKMFR9",
    UK: "A1F83G8C2ARO7P",
    FR: "A13V1IB3VIYZZH",
    IT: "APJ6JRA9NG5V4",
    ES: "A1RKKUPIHCS9HS",
    NL: "A1805IZSGTT6HS",
    SE: "A2NODRKZP88ZB9",
    PL: "A1C3SOZRARQ6R3",
    US: "ATVPDKIKX0DER"
};

const MARKETPLACE_REGION_MAP = {
    A33AVAJ2PDY3EV: "eu-west-1",
    A1PA6795UKMFR9: "eu-west-1",
    A1F83G8C2ARO7P: "eu-west-1",
    A13V1IB3VIYZZH: "eu-west-1",
    APJ6JRA9NG5V4: "eu-west-1",
    A1RKKUPIHCS9HS: "eu-west-1",
    A1805IZSGTT6HS: "eu-west-1",
    A2NODRKZP88ZB9: "eu-west-1",
    A1C3SOZRARQ6R3: "eu-west-1",
    ATVPDKIKX0DER: "us-east-1"
};

const REGION_HOST_MAP = {
    "eu-west-1": "sellingpartnerapi-eu.amazon.com",
    "us-east-1": "sellingpartnerapi-na.amazon.com",
    "us-west-2": "sellingpartnerapi-na.amazon.com"
};

/** Resmi SP-API — kullanıcıdan zorunlu alanlar */
const SP_API_USER_REQUIRED_FIELDS = [
    "sellerId",
    "clientId",
    "clientSecret",
    "refreshToken",
    "accessKeyId",
    "secretAccessKey"
];

const FIELD_LABELS_TR = {
    sellerId: "Selling Partner ID (Satıcı ID)",
    clientId: "LWA Client ID",
    clientSecret: "LWA Client Secret",
    refreshToken: "LWA Refresh Token",
    accessKeyId: "AWS Access Key ID",
    secretAccessKey: "AWS Secret Access Key",
    marketplaceId: "Hedef Marketplace ID"
};

const INTEGRATION_DEFAULT_MARKETPLACE = {
    "amazon türkiye": MARKETPLACE_IDS.TR,
    "amazon turkiye": MARKETPLACE_IDS.TR,
    "amazon europe": MARKETPLACE_IDS.DE,
    "amazon usa": MARKETPLACE_IDS.US,
    amazon: MARKETPLACE_IDS.TR
};

const EU_MARKETPLACE_OPTIONS = [
    { id: MARKETPLACE_IDS.DE, label: "Almanya (DE)" },
    { id: MARKETPLACE_IDS.UK, label: "Birleşik Krallık (UK)" },
    { id: MARKETPLACE_IDS.FR, label: "Fransa (FR)" },
    { id: MARKETPLACE_IDS.IT, label: "İtalya (IT)" },
    { id: MARKETPLACE_IDS.ES, label: "İspanya (ES)" },
    { id: MARKETPLACE_IDS.NL, label: "Hollanda (NL)" },
    { id: MARKETPLACE_IDS.SE, label: "İsveç (SE)" },
    { id: MARKETPLACE_IDS.PL, label: "Polonya (PL)" },
    { id: MARKETPLACE_IDS.TR, label: "Türkiye (TR)" }
];

const isAmazonMarketplaceName = (name) => /^amazon/i.test(String(name || "").trim());

const trimStr = (v) => (v == null ? "" : String(v).trim());

const pickFirst = (obj, keys) => {
    for (const k of keys) {
        const v = trimStr(obj[k]);
        if (v) return v;
    }
    return "";
};

/**
 * Gelen credential anahtarlarını resmi modele eşle (eski / yanlış isimler).
 */
const normalizeAmazonCredentials = (raw, marketplaceName = "") => {
    const src = raw && typeof raw === "object" ? raw : {};

    const sellerId = pickFirst(src, [
        "sellerId",
        "sellingPartnerId",
        "SellingPartnerId",
        "merchantId",
        "merchantToken"
    ]);

    const clientId = pickFirst(src, ["clientId", "lwaClientId", "LWA_CLIENT_ID", "appClientId"]);
    const clientSecret = pickFirst(src, ["clientSecret", "lwaClientSecret", "LWA_CLIENT_SECRET"]);
    const refreshToken = pickFirst(src, ["refreshToken", "lwaRefreshToken", "LWA_REFRESH_TOKEN"]);
    const accessKeyId = pickFirst(src, ["accessKeyId", "awsAccessKeyId", "AWS_ACCESS_KEY_ID"]);
    const secretAccessKey = pickFirst(src, [
        "secretAccessKey",
        "awsSecretAccessKey",
        "AWS_SECRET_ACCESS_KEY"
    ]);
    const sessionToken = pickFirst(src, ["sessionToken", "awsSessionToken"]) || undefined;

    const mpKey = String(marketplaceName || "").trim().toLowerCase();
    let marketplaceId =
        pickFirst(src, ["marketplaceId", "MarketplaceId"]) ||
        INTEGRATION_DEFAULT_MARKETPLACE[mpKey] ||
        MARKETPLACE_IDS.TR;

    if (!MARKETPLACE_REGION_MAP[marketplaceId]) {
        marketplaceId = INTEGRATION_DEFAULT_MARKETPLACE[mpKey] || MARKETPLACE_IDS.TR;
    }

    const region =
        trimStr(src.region) ||
        MARKETPLACE_REGION_MAP[marketplaceId] ||
        process.env.AMAZON_REGION ||
        "eu-west-1";

    const host =
        trimStr(src.host) ||
        REGION_HOST_MAP[region] ||
        process.env.AMAZON_API_HOST ||
        "sellingpartnerapi-eu.amazon.com";

    return {
        sellerId,
        clientId,
        clientSecret,
        refreshToken,
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
        marketplaceId,
        region,
        host
    };
};

const validateAmazonCredentials = (credentials) => {
    const c = credentials || {};
    const missing = [];

    for (const field of SP_API_USER_REQUIRED_FIELDS) {
        if (!trimStr(c[field])) {
            missing.push(field);
        }
    }

    if (!c.marketplaceId || !MARKETPLACE_REGION_MAP[c.marketplaceId]) {
        missing.push("marketplaceId");
    }

    if (missing.length > 0) {
        const labels = missing.map((f) => FIELD_LABELS_TR[f] || f).join(", ");
        return {
            valid: false,
            missing,
            message: `Amazon SP-API için eksik alanlar: ${labels}`
        };
    }

    return { valid: true, missing: [], message: "OK" };
};

/** Avrupa entegrasyonunda hedef ülke seçimi zorunlu */
const requiresEuMarketplacePick = (marketplaceName) =>
    String(marketplaceName || "").trim().toLowerCase() === "amazon europe";

module.exports = {
    SP_API_USER_REQUIRED_FIELDS,
    FIELD_LABELS_TR,
    EU_MARKETPLACE_OPTIONS,
    INTEGRATION_DEFAULT_MARKETPLACE,
    isAmazonMarketplaceName,
    normalizeAmazonCredentials,
    validateAmazonCredentials,
    requiresEuMarketplacePick
};
