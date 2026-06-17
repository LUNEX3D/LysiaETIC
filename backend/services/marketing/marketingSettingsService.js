const MarketingSettings = require("../../models/MarketingSettings");

const { encrypt, decrypt, maskSecret } = require("../../utils/storeCredentialCrypto");



function sanitizeForClient(doc) {

    if (!doc) return doc;

    const out = { ...doc };

    if (out.smsProvider) {

        out.smsProvider = { ...out.smsProvider };

        out.smsProvider.hasApiKey = !!(out.smsProvider.apiKeyEnc && decrypt(out.smsProvider.apiKeyEnc));

        out.smsProvider.apiKeyMasked = out.smsProvider.apiKeyEnc

            ? maskSecret(decrypt(out.smsProvider.apiKeyEnc))

            : "";

        delete out.smsProvider.apiKeyEnc;

    }

    return out;

}



async function getOrCreateSettings(storeId) {

    let doc = await MarketingSettings.findOne({ storeId }).lean();

    if (!doc) {

        doc = (await MarketingSettings.create({ storeId })).toObject();

    }

    return doc;

}



async function updateSettings(storeId, body) {

    const existing = await MarketingSettings.findOne({ storeId }).lean();

    const patch = {};

    if (body.attributionModel) patch.attributionModel = body.attributionModel;

    if (body.quietHours) patch.quietHours = body.quietHours;

    if (body.limits) patch.limits = body.limits;

    if (body.emailFromName !== undefined) patch.emailFromName = body.emailFromName;

    if (body.emailFromAddress !== undefined) patch.emailFromAddress = body.emailFromAddress;



    if (body.smsProvider) {

        const prev = existing?.smsProvider || {};

        const next = { ...prev, ...body.smsProvider };

        if (body.smsProvider.apiKey && String(body.smsProvider.apiKey).trim()) {

            next.apiKeyEnc = encrypt(String(body.smsProvider.apiKey).trim());

        }

        delete next.apiKey;

        patch.smsProvider = next;

    }



    const doc = await MarketingSettings.findOneAndUpdate(

        { storeId },

        { $set: patch },

        { new: true, upsert: true }

    ).lean();

    return doc;

}



function isQuietHour(settings) {

    if (!settings?.quietHours?.enabled) return false;

    const now = new Date();

    const mins = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = String(settings.quietHours.start || "22:00").split(":").map(Number);

    const [eh, em] = String(settings.quietHours.end || "09:00").split(":").map(Number);

    const start = sh * 60 + (sm || 0);

    const end = eh * 60 + (em || 0);

    if (start > end) return mins >= start || mins < end;

    return mins >= start && mins < end;

}



module.exports = { getOrCreateSettings, updateSettings, isQuietHour, sanitizeForClient };

