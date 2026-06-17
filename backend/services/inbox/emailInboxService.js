const dns = require("dns").promises;
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const Store = require("../../models/Store");
const StoreInboxSettings = require("../../models/StoreInboxSettings");
const StoreInboxConversation = require("../../models/StoreInboxConversation");
const StoreInboxMessage = require("../../models/StoreInboxMessage");
const { encrypt, decrypt, encryptCredentials, decryptCredentials } = require("../../utils/encryption");
const logger = require("../../config/logger");

const SYNC_DAYS = 7;

const PROVIDER_IMAP = {
    gmail: { host: "imap.gmail.com", port: 993, secure: true },
    outlook: { host: "outlook.office365.com", port: 993, secure: true },
    yandex: { host: "imap.yandex.com", port: 993, secure: true },
};

function parseEmailAddress(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/<([^>]+)>/) || s.match(/([^\s<>]+@[^\s<>]+)/);
    return (m ? m[1] : s).trim().toLowerCase();
}

function normalizeImapPassword(pass) {
    return String(pass || "").replace(/\s+/g, "");
}

function getImapDefaults(email) {
    const domain = (email.split("@")[1] || "").toLowerCase();
    if (domain.includes("gmail.com")) {
        return { host: "imap.gmail.com", port: 993, secure: true };
    }
    if (domain.includes("outlook.") || domain.includes("hotmail.") || domain.includes("live.")) {
        return { host: "outlook.office365.com", port: 993, secure: true };
    }
    if (domain.includes("yandex.")) {
        return { host: "imap.yandex.com", port: 993, secure: true };
    }
    return { host: `imap.${domain}`, port: 993, secure: true };
}

async function detectImapFromMx(email) {
    const domain = (email.split("@")[1] || "").toLowerCase();
    if (!domain || domain.includes("gmail.com")) return null;
    try {
        const mx = await dns.resolveMx(domain);
        const hosts = mx.map((r) => String(r.exchange || "").toLowerCase()).join(" ");
        if (/google\.com|googlemail\.com|gmail/i.test(hosts)) {
            return { host: "imap.gmail.com", port: 993, secure: true, via: "mx-google" };
        }
        if (/outlook\.com|microsoft|hotmail|office365/i.test(hosts)) {
            return { host: "outlook.office365.com", port: 993, secure: true, via: "mx-microsoft" };
        }
        if (/yandex/i.test(hosts)) {
            return { host: "imap.yandex.com", port: 993, secure: true, via: "mx-yandex" };
        }
        if (/zoho/i.test(hosts)) {
            return { host: "imap.zoho.com", port: 993, secure: true, via: "mx-zoho" };
        }
    } catch (e) {
        logger.debug("[Inbox Email] MX lookup:", domain, e.code || e.message);
    }
    return null;
}

async function resolveImapServer(email, creds = {}) {
    const domain = (email.split("@")[1] || "").toLowerCase();
    let explicitHost = String(creds.imapHost || creds.host || "").trim();

    // Önceden yanlış tahmin edilmiş imap.firma.com → MX ile düzelt (ör. Google Workspace)
    if (explicitHost && domain && explicitHost.toLowerCase() === `imap.${domain}`) {
        const mx = await detectImapFromMx(email);
        if (mx?.host && mx.host !== explicitHost) {
            explicitHost = mx.host;
        }
    }

    if (explicitHost) {
        return {
            host: explicitHost,
            port: Number(creds.imapPort || creds.port) || 993,
            secure: creds.secure !== false,
        };
    }

    const provider = String(creds.emailProvider || "").toLowerCase();
    if (PROVIDER_IMAP[provider]) {
        return { ...PROVIDER_IMAP[provider] };
    }

    const mx = await detectImapFromMx(email);
    if (mx) return mx;

    return getImapDefaults(email);
}

function formatImapError(e, { host, user } = {}) {
    const responseText = e.responseText || "";
    const text = responseText || e.message || String(e);
    const combined = `${text} ${responseText}`.trim();

    if (e.code === "ENOTFOUND") {
        return `IMAP sunucusu bulunamadı (${host || "?"}). Sunucu adresini kontrol edin; @firma.com için genelde imap.gmail.com kullanılır.`;
    }
    if (e.code === "ECONNREFUSED" || e.code === "EHOSTUNREACH") {
        return `Sunucuya bağlanılamadı (${host}). Port 993 ve IMAP sunucu adresini kontrol edin.`;
    }
    if (e.code === "ETIMEDOUT" || /timed out/i.test(combined)) {
        return "E-posta sunucusu zaman aşımına uğradı. Bir süre sonra tekrar deneyin.";
    }
    if (
        /AUTHENTICATIONFAILED|Invalid credentials|Login failed|NO \[AUTHENTICATIONFAILED\]|authentication failed|not authorized/i.test(
            combined
        )
    ) {
        const domain = (user || "").split("@")[1] || "";
        const workspace =
            domain && !domain.includes("gmail.com")
                ? ` Google Workspace (${domain}) için de imap.gmail.com ve uygulama şifresi gerekir.`
                : "";
        return `Giriş reddedildi.${workspace} Normal şifre yerine uygulama şifresi kullanın (Google: Hesap → Güvenlik → Uygulama şifreleri).`;
    }
    if (/Application-specific password|WEBLOGIN|web browser|less secure/i.test(combined)) {
        return "Bu hesap uygulama şifresi istiyor. 2 adımlı doğrulamayı açıp 16 haneli uygulama şifresi oluşturun.";
    }
    if (/Too many simultaneous|rate limit|try again later/i.test(combined)) {
        return "Çok fazla bağlantı denemesi. Birkaç dakika bekleyip tekrar deneyin.";
    }
    if (responseText) {
        return `E-posta sunucusu: ${responseText}`;
    }
    if (text === "Command failed") {
        return `E-posta sunucusu işlemi reddetti (${host || "IMAP"}). Sunucu adresi, e-posta ve uygulama şifresini kontrol edin.`;
    }
    return `E-posta sunucusuna bağlanılamadı: ${text}`;
}

function buildClientOptions(imapConfig) {
    const host = imapConfig.host;
    return {
        host,
        port: imapConfig.port,
        secure: imapConfig.secure !== false,
        auth: {
            user: imapConfig.auth.user,
            pass: normalizeImapPassword(imapConfig.auth.pass),
        },
        logger: false,
        tls: host ? { servername: host } : undefined,
        connectionTimeout: 30_000,
        greetingTimeout: 20_000,
    };
}

async function buildImapConfig(email, creds = {}) {
    const user = parseEmailAddress(creds.imapUser || creds.user || email);
    const pass = normalizeImapPassword(creds.imapPassword || creds.password || "");
    if (!user || !pass) return null;

    const server = await resolveImapServer(user, creds);
    return {
        host: server.host,
        port: server.port,
        secure: server.secure !== false,
        auth: { user, pass },
    };
}

async function getEmailChannel(storeId) {
    const doc = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken").lean();
    const ch = doc?.channels?.find((c) => c.channelId === "email" && c.connected);
    return ch || null;
}

async function getImapConfig(channel, supportEmail) {
    let creds = {};
    if (channel.accessToken) {
        try {
            const raw = decrypt(channel.accessToken);
            creds = decryptCredentials(JSON.parse(raw));
        } catch {
            creds = {};
        }
    }
    return buildImapConfig(supportEmail, creds);
}

async function searchRecentUids(client, since) {
    try {
        const uids = await client.search({ since }, { uid: true });
        if (Array.isArray(uids) && uids.length > 0) return uids;
    } catch (e) {
        logger.warn("[Inbox Email] SINCE search:", e.responseText || e.message);
    }

    try {
        const all = await client.search({ all: true }, { uid: true });
        return Array.isArray(all) ? all.slice(-80) : [];
    } catch (e) {
        throw e;
    }
}

async function testImapConnection(imapConfig) {
    const client = new ImapFlow(buildClientOptions(imapConfig));
    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        lock.release();
        await client.logout();
        return { ok: true };
    } catch (e) {
        return { error: formatImapError(e, { host: imapConfig.host, user: imapConfig.auth?.user }) };
    } finally {
        try {
            await client.close();
        } catch {
            /* ignore */
        }
    }
}

async function upsertEmailChannel(storeId, userId, supportEmail, imapBody = {}) {
    const full = await StoreInboxSettings.findOne({ storeId }).select("+channels.accessToken");
    if (!full) throw new Error("Gelen kutusu ayarları yok");

    const imapUser = String(imapBody.imapUser || imapBody.user || supportEmail).trim();
    let resolvedHost = String(imapBody.imapHost || imapBody.host || "").trim();
    let resolvedPort = imapBody.imapPort || imapBody.port || "";

    if (imapBody.imapPassword || imapBody.password) {
        const preview = await buildImapConfig(supportEmail, {
            ...imapBody,
            imapUser,
            imapHost: resolvedHost,
        });
        if (preview?.host) {
            resolvedHost = preview.host;
            resolvedPort = preview.port;
        }
    }

    const creds = {
        imapUser,
        imapPassword: normalizeImapPassword(imapBody.imapPassword || imapBody.password || ""),
        imapHost: resolvedHost,
        imapPort: resolvedPort,
        emailProvider: String(imapBody.emailProvider || "").trim(),
    };

    let accessToken = "";
    if (creds.imapPassword) {
        accessToken = encrypt(JSON.stringify(encryptCredentials(creds)));
    }

    const existing = full.channels || [];
    full.channels = StoreInboxSettings.CHANNEL_IDS.map((id) => {
        const prev = existing.find((c) => c.channelId === id) || { channelId: id };
        if (id !== "email") return { ...prev, channelId: id };
        const mode = creds.imapPassword ? "imap" : "light";
        return {
            ...prev,
            channelId: "email",
            connected: true,
            accountLabel: supportEmail,
            connectedAt: new Date(),
            externalRef: mode,
            accessToken,
        };
    });
    full.onboardingStep = "done";
    await full.save();

    await Store.updateOne({ _id: storeId }, { $set: { "settings.contactEmail": supportEmail } });

    const { getOrCreateSettings } = require("../storeInboxService");
    return getOrCreateSettings(storeId, userId);
}

async function connectEmailChannel(storeId, userId, body = {}) {
    const store = await Store.findById(storeId).lean();
    if (!store) return { error: "Mağaza bulunamadı" };

    let supportEmail = parseEmailAddress(body.accountLabel || store.settings?.contactEmail || "");
    if (!supportEmail || !supportEmail.includes("@")) {
        return {
            error: "Geçerli bir destek e-postası girin (ör. destek@magazaniz.com).",
        };
    }

    const hasImap = !!(body.imapPassword || body.password);

    if (hasImap) {
        const imapConfig = await buildImapConfig(supportEmail, body);
        if (!imapConfig) {
            return { error: "IMAP kullanıcı adı ve uygulama şifresi gerekli." };
        }
        const test = await testImapConnection(imapConfig);
        if (test.error) {
            return { error: test.error };
        }
        body = {
            ...body,
            imapHost: imapConfig.host,
            imapPort: imapConfig.port,
            imapUser: imapConfig.auth.user,
        };
    }

    const settings = await upsertEmailChannel(storeId, userId, supportEmail, body);

    let synced = 0;
    let syncError = "";
    let syncHint = "";

    if (hasImap) {
        try {
            const r = await syncEmailInbox(storeId);
            synced = r.synced || 0;
            syncError = r.error || "";
        } catch (e) {
            syncError = e.message || "E-posta senkronu başarısız";
            logger.warn("[Inbox Email] connect sync:", syncError);
        }
    } else {
        syncHint =
            "Kolay mod aktif. Mağaza iletişim formundan gelen mesajlar burada görünür. Gmail/Outlook kutunuzu bağlamak için kanalı yeniden açıp posta kutusu seçeneğini kullanın.";
    }

    return { settings, synced, syncError, syncHint, connectionMode: hasImap ? "imap" : "light" };
}

async function upsertEmailMessage(storeId, { messageId, fromName, fromEmail, subject, text, sentAt }) {
    const email = parseEmailAddress(fromEmail);
    const body = String(text || subject || "").trim();
    if (!body) return null;

    const externalId = `mail_${messageId || `${email}_${sentAt?.getTime?.() || Date.now()}`}`;
    let conv = await StoreInboxConversation.findOne({
        storeId,
        channelId: "email",
        participantUsername: email,
    });

    if (!conv) {
        conv = await StoreInboxConversation.create({
            storeId,
            channelId: "email",
            externalId,
            participantName: fromName || email,
            participantUsername: email,
            lastMessageText: body.slice(0, 500),
            lastMessageAt: sentAt || new Date(),
            unreadCount: 1,
            context: { subject: subject || "" },
        });
    } else {
        await StoreInboxConversation.updateOne(
            { _id: conv._id },
            {
                $set: {
                    lastMessageText: body.slice(0, 500),
                    lastMessageAt: sentAt || new Date(),
                    "context.subject": subject || conv.context?.subject || "",
                },
                $inc: { unreadCount: 1 },
            }
        );
    }

    await StoreInboxMessage.findOneAndUpdate(
        { conversationId: conv._id, externalId: `m_${externalId}` },
        {
            $set: {
                storeId,
                direction: "in",
                text: body,
                sentAt: sentAt || new Date(),
                fromName: fromName || email,
            },
        },
        { upsert: true }
    );

    return conv;
}

async function syncEmailInbox(storeId) {
    const channel = await getEmailChannel(storeId);
    if (!channel) return { synced: 0, error: "E-posta kanalı bağlı değil" };

    if (channel.externalRef === "google") {
        return require("./googleInboxService").syncGoogleInbox(storeId);
    }

    const supportEmail = parseEmailAddress(channel.accountLabel);
    const imapConfig = await getImapConfig(channel, supportEmail);
    if (!imapConfig) {
        if (channel.externalRef === "light") {
            return { synced: 0 };
        }
        return {
            synced: 0,
            error: "IMAP şifresi kayıtlı değil. Kanalı yeniden bağlayıp posta kutusu seçeneğini kullanın.",
        };
    }

    const since = new Date(Date.now() - SYNC_DAYS * 24 * 60 * 60 * 1000);
    let synced = 0;
    const client = new ImapFlow(buildClientOptions(imapConfig));

    try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
            const uids = await searchRecentUids(client, since);
            const list = Array.isArray(uids) ? uids.slice(-80) : [];
            for (const uid of list) {
                try {
                    const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
                    if (!msg?.source) continue;
                    const parsed = await simpleParser(msg.source);
                    const fromAddr = parsed.from?.value?.[0];
                    const fromEmail = fromAddr?.address || "";
                    const fromName = fromAddr?.name || fromEmail;
                    const subject = parsed.subject || msg.envelope?.subject || "";
                    const text = (parsed.text || parsed.html || "").replace(/<[^>]+>/g, " ").trim();
                    if (!text && !subject) continue;

                    const msgDate = parsed.date || new Date();
                    if (msgDate < since) continue;

                    await upsertEmailMessage(storeId, {
                        messageId: String(uid),
                        fromName,
                        fromEmail,
                        subject,
                        text: text || subject,
                        sentAt: msgDate,
                    });
                    synced++;
                } catch (e) {
                    logger.warn("[Inbox Email] parse mail:", e.message);
                }
            }
        } finally {
            lock.release();
        }
        await client.logout();
    } catch (e) {
        const err = formatImapError(e, { host: imapConfig.host, user: imapConfig.auth?.user });
        logger.warn("[Inbox Email] IMAP:", e.responseText || e.message, "host=", imapConfig.host);
        return { synced: 0, error: err };
    } finally {
        try {
            await client.close();
        } catch {
            /* ignore */
        }
    }

    return { synced };
}

module.exports = {
    connectEmailChannel,
    syncEmailInbox,
    upsertEmailMessage,
    parseEmailAddress,
    testImapConnection,
    buildImapConfig,
};
