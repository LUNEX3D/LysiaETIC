/**
 * Gmail gelen kutusu — Google OAuth (offline refresh token) + Gmail API
 */
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const StoreInboxSettings = require("../../models/StoreInboxSettings");
const Store = require("../../models/Store");
const { encrypt, decrypt, encryptCredentials, decryptCredentials } = require("../../utils/encryption");
const { APP_URL } = require("../../config/domain");
const logger = require("../../config/logger");
const emailInbox = require("./emailInboxService");

const SYNC_DAYS = 7;
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

function isGoogleInboxConfigured() {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getOAuth2Client() {
    return new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        getRedirectUri()
    );
}

function getRedirectUri() {
    const base = (process.env.BACKEND_PUBLIC_URL || process.env.APP_URL || "http://localhost:5000").replace(
        /\/$/,
        ""
    );
    return `${base}/api/store/inbox/google/oauth/callback`;
}

function getDashboardRedirectUrl(query = {}) {
    const base = (APP_URL || "http://localhost:3000").replace(/\/$/, "");
    return `${base}/dashboard?${new URLSearchParams(query).toString()}`;
}

function signOAuthState(storeId, userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET tanımlı değil");
    return jwt.sign(
        { storeId: String(storeId), userId: String(userId), purpose: "inbox_gmail" },
        secret,
        { expiresIn: "30m" }
    );
}

function verifyOAuthState(state) {
    const secret = process.env.JWT_SECRET;
    const payload = jwt.verify(state, secret);
    if (payload.purpose !== "inbox_gmail") throw new Error("Geçersiz OAuth state");
    return payload;
}

function buildOAuthUrl(storeId, userId) {
    if (!isGoogleInboxConfigured()) {
        return {
            error: "GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET sunucuda tanımlı olmalıdır.",
        };
    }
    const client = getOAuth2Client();
    const state = signOAuthState(storeId, userId);
    const url = client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [GMAIL_SCOPE],
        state,
    });
    return { url };
}

function getGoogleRefreshToken(channel) {
    if (!channel?.accessToken || channel.externalRef !== "google") return "";
    try {
        const raw = decrypt(channel.accessToken);
        const creds = decryptCredentials(JSON.parse(raw));
        return creds.googleRefreshToken || creds.refreshToken || "";
    } catch {
        return "";
    }
}

async function getAccessTokenForChannel(channel) {
    const refreshToken = getGoogleRefreshToken(channel);
    if (!refreshToken) return { error: "Google yenileme anahtarı yok. Gmail'i yeniden bağlayın." };
    const client = getOAuth2Client();
    client.setCredentials({ refresh_token: refreshToken });
    try {
        const res = await client.getAccessToken();
        const token = typeof res === "string" ? res : res?.token;
        if (!token) return { error: "Google erişim jetonu alınamadı" };
        return { token };
    } catch (e) {
        return { error: e.message || "Google oturumu süresi doldu" };
    }
}

function decodeGmailBody(payload) {
    if (!payload) return "";
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, "base64url").toString("utf8");
    }
    const parts = payload.parts || [];
    for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
            return Buffer.from(part.body.data, "base64url").toString("utf8");
        }
    }
    for (const part of parts) {
        const nested = decodeGmailBody(part);
        if (nested) return nested;
    }
    return "";
}

function getGmailHeader(headers, name) {
    const h = (headers || []).find((x) => String(x.name || "").toLowerCase() === name.toLowerCase());
    return h?.value || "";
}

async function saveGoogleEmailChannel(storeId, userId, email, refreshToken) {
    const full = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken");
    if (!full) throw new Error("Gelen kutusu ayarları yok");

    const accessToken = encrypt(
        JSON.stringify(
            encryptCredentials({
                googleRefreshToken: refreshToken,
            })
        )
    );

    const existing = full.channels || [];
    full.channels = StoreInboxSettings.CHANNEL_IDS.map((id) => {
        const prev = existing.find((c) => c.channelId === id) || { channelId: id };
        if (id !== "email") return { ...prev, channelId: id };
        return {
            ...prev,
            channelId: "email",
            connected: true,
            accountLabel: email,
            connectedAt: new Date(),
            externalRef: "google",
            accessToken,
        };
    });
    full.onboardingStep = "done";
    await full.save();

    await Store.updateOne({ _id: storeId }, { $set: { "settings.contactEmail": email } });

    const { getOrCreateSettings } = require("../storeInboxService");
    return getOrCreateSettings(storeId, userId);
}

async function handleOAuthCallback(code, state) {
    if (!isGoogleInboxConfigured()) {
        return { error: "Google OAuth yapılandırılmamış" };
    }
    let payload;
    try {
        payload = verifyOAuthState(state);
    } catch (e) {
        return { error: e.message || "OAuth doğrulaması başarısız" };
    }

    const client = getOAuth2Client();
    let tokens;
    try {
        const { tokens: t } = await client.getToken(code);
        tokens = t;
    } catch (e) {
        return { error: e.message || "Google kodu değiştirilemedi" };
    }

    if (!tokens.refresh_token) {
        return {
            error: "Google yenileme anahtarı alınamadı. Google hesabınızda Dashtock erişimini kaldırıp tekrar bağlayın.",
        };
    }

    client.setCredentials(tokens);
    const access = tokens.access_token;
    if (!access) return { error: "Google erişim jetonu alınamadı" };

    let email = "";
    try {
        const { data: profile } = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
            headers: { Authorization: `Bearer ${access}` },
        });
        email = String(profile.emailAddress || "").trim().toLowerCase();
    } catch (e) {
        return { error: e.response?.data?.error?.message || "Gmail profili okunamadı" };
    }

    if (!email.includes("@")) {
        return { error: "Gmail adresi alınamadı" };
    }

    await saveGoogleEmailChannel(payload.storeId, payload.userId, email, tokens.refresh_token);

    let synced = 0;
    let syncError = "";
    try {
        const r = await syncGoogleInbox(payload.storeId);
        synced = r.synced || 0;
        syncError = r.error || "";
    } catch (e) {
        syncError = e.message;
        logger.warn("[Inbox Gmail] post-oauth sync:", syncError);
    }

    return { email, synced, syncError };
}

async function syncGoogleInbox(storeId) {
    const doc = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken").lean();
    const channel = doc?.channels?.find((c) => c.channelId === "email" && c.connected);
    if (!channel) return { synced: 0, error: "E-posta kanalı bağlı değil" };
    if (channel.externalRef !== "google") {
        return { synced: 0 };
    }

    const { token, error } = await getAccessTokenForChannel(channel);
    if (error) return { synced: 0, error };

    const afterSec = Math.floor((Date.now() - SYNC_DAYS * 24 * 60 * 60 * 1000) / 1000);
    let synced = 0;

    try {
        const { data: list } = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
            headers: { Authorization: `Bearer ${token}` },
            params: { maxResults: 60, q: `after:${afterSec}` },
        });

        const ids = (list.messages || []).map((m) => m.id).filter(Boolean);
        for (const id of ids) {
            try {
                const { data: msg } = await axios.get(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { format: "full" },
                    }
                );
                const headers = msg.payload?.headers || [];
                const fromRaw = getGmailHeader(headers, "From");
                const subject = getGmailHeader(headers, "Subject");
                const dateRaw = getGmailHeader(headers, "Date");
                const text = decodeGmailBody(msg.payload).replace(/<[^>]+>/g, " ").trim();
                const fromEmail = emailInbox.parseEmailAddress(fromRaw);
                const fromName = fromRaw.replace(/<[^>]+>/, "").trim() || fromEmail;
                let sentAt = new Date();
                if (dateRaw) {
                    const d = new Date(dateRaw);
                    if (!Number.isNaN(d.getTime())) sentAt = d;
                }

                if (!text && !subject) continue;
                await emailInbox.upsertEmailMessage(storeId, {
                    messageId: id,
                    fromName,
                    fromEmail,
                    subject,
                    text: text || subject,
                    sentAt,
                });
                synced++;
            } catch (e) {
                logger.warn("[Inbox Gmail] message:", e.message);
            }
        }
    } catch (e) {
        const msg = e.response?.data?.error?.message || e.message || String(e);
        logger.warn("[Inbox Gmail] list:", msg);
        if (/invalid_grant|unauthorized|401|403/i.test(msg)) {
            return {
                synced: 0,
                error: "Gmail erişimi sona erdi. Ayarlar → Kanalları Yönet → E-posta ile yeniden bağlayın.",
            };
        }
        return { synced: 0, error: `Gmail senkronu başarısız: ${msg}` };
    }

    return { synced };
}

module.exports = {
    isGoogleInboxConfigured,
    buildOAuthUrl,
    handleOAuthCallback,
    syncGoogleInbox,
    getDashboardRedirectUrl,
    getRedirectUri,
};
