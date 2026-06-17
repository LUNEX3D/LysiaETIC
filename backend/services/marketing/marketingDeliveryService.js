const { Resend } = require("resend");
const logger = require("../../config/logger");
const { FROM_EMAIL, BRAND_NAME } = require("../../config/brand");
const { formatResendError } = require("../emailService");
const { getOrCreateSettings, isQuietHour } = require("./marketingSettingsService");
const { decrypt } = require("../../utils/storeCredentialCrypto");
const MarketingEvent = require("../../models/MarketingEvent");
const Store = require("../../models/Store");
const { normalizePhone } = require("./marketingRecipientService");

let _resend = null;
function getResend() {
    if (!_resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) return null;
        _resend = new Resend(apiKey);
    }
    return _resend;
}

function personalize(text, vars = {}) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const v = vars[key];
        return v !== undefined && v !== null ? String(v) : "";
    });
}

function buildMarketingHtml(storeName, bodyText) {
    const safe = String(bodyText || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    return `<!DOCTYPE html><html lang="tr"><body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:28px 32px;">
<tr><td style="font-size:13px;color:#64748b;font-weight:600;margin-bottom:16px;">${storeName || BRAND_NAME}</td></tr>
<tr><td style="font-size:16px;line-height:1.6;color:#0f172a;">${safe}</td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#94a3b8;">Bu mesaj ${storeName || BRAND_NAME} mağazasından gönderilmiştir.</td></tr>
</table></td></tr></table></body></html>`;
}

async function countRecentChannelSends(storeId, channel, recipientKey, hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const types = channel === "SMS" ? ["sms_sent", "automation_step"] : ["campaign_sent", "automation_step"];
    return MarketingEvent.countDocuments({
        storeId,
        type: { $in: types },
        customerEmail: recipientKey,
        createdAt: { $gte: since },
    });
}

async function canSendToRecipient(storeId, channel, recipientKey, limits) {
    const max = channel === "SMS" ? limits?.smsPer24h ?? 3 : limits?.emailPer24h ?? 2;
    const n = await countRecentChannelSends(storeId, channel, recipientKey);
    return n < max;
}

async function sendMarketingEmail(storeId, { to, subject, text, html, name, storeName }) {
    const settings = await getOrCreateSettings(storeId);
    if (isQuietHour(settings)) {
        return { ok: false, error: "Sessiz saatlerde e-posta gönderilemez." };
    }
    if (!(await canSendToRecipient(storeId, "EMAIL", to, settings.limits))) {
        return { ok: false, error: "24 saatlik e-posta limiti aşıldı." };
    }

    const resend = getResend();
    if (!resend) {
        return { ok: false, error: "RESEND_API_KEY tanımlı değil. Sunucu .env dosyasına ekleyin." };
    }

    const fromName = settings.emailFromName || storeName || BRAND_NAME;
    const fromAddr = settings.emailFromAddress?.trim();
    const from = fromAddr ? `${fromName} <${fromAddr}>` : FROM_EMAIL;

    const bodyText = personalize(text, { name: name || "Müşterimiz", coupon: "HOSGELDIN" });
    const htmlBody = html || buildMarketingHtml(storeName || fromName, bodyText);

    try {
        const { data, error } = await resend.emails.send({
            from,
            to: [to],
            subject: personalize(subject, { name: name || "" }),
            html: htmlBody,
            text: bodyText,
        });
        if (error) {
            return { ok: false, error: formatResendError(error) };
        }
        return { ok: true, id: data?.id };
    } catch (e) {
        logger.warn("[Marketing email]", e.message);
        return { ok: false, error: e.message };
    }
}

async function sendNetgsm({ user, pass, header, phone, message }) {
    const gsm = normalizePhone(phone);
    if (!gsm || gsm.length < 10) return { ok: false, error: "Geçersiz telefon numarası" };

    const params = new URLSearchParams({
        usercode: user,
        password: pass,
        gsmno: gsm,
        message: String(message).slice(0, 612),
        msgheader: header || user,
        dil: "TR",
    });

    const res = await fetch(`https://api.netgsm.com.tr/sms/send/get/?${params.toString()}`);
    const body = (await res.text()).trim();
    const code = body.split(/\s+/)[0];
    if (code === "00" || code === "01" || code === "02" || /^20\d{2}$/.test(code)) {
        return { ok: true, id: body };
    }
    return { ok: false, error: body || "Netgsm gönderim hatası" };
}

async function sendMarketingSms(storeId, { phone, text, name }) {
    const settings = await getOrCreateSettings(storeId);
    if (isQuietHour(settings)) {
        return { ok: false, error: "Sessiz saatlerde SMS gönderilemez." };
    }
    const normalized = normalizePhone(phone);
    if (!(await canSendToRecipient(storeId, "SMS", normalized, settings.limits))) {
        return { ok: false, error: "24 saatlik SMS limiti aşıldı." };
    }

    const prov = settings.smsProvider?.provider;
    if (!prov) {
        return { ok: false, error: "SMS sağlayıcısı ayarlanmamış. Pazarlama → Ayarlar." };
    }

    const apiUser = settings.smsProvider?.apiUser || "";
    const apiPass = decrypt(settings.smsProvider?.apiKeyEnc || "");
    if (!apiUser || !apiPass) {
        return { ok: false, error: "SMS API kullanıcı adı ve şifre gerekli." };
    }

    const msg = personalize(text, { name: name || "Müşterimiz", coupon: "HOSGELDIN" });

    if (prov === "netgsm") {
        return sendNetgsm({
            user: apiUser,
            pass: apiPass,
            header: settings.smsProvider?.senderId || apiUser,
            phone: normalized,
            message: msg,
        });
    }

    return { ok: false, error: `SMS sağlayıcısı henüz desteklenmiyor: ${prov}` };
}

async function getStoreName(storeId) {
    const store = await Store.findById(storeId).select("name").lean();
    return store?.name || BRAND_NAME;
}

module.exports = {
    personalize,
    sendMarketingEmail,
    sendMarketingSms,
    getStoreName,
    buildMarketingHtml,
};
