/**
 * Mağaza PayTR — her satıcı kendi merchant bilgileriyle ödeme alır
 * @see https://dev.paytr.com/iframe-api/iframe-api-1-adim
 */
const crypto = require("crypto");
const axios = require("axios");
const { APP_URL } = require("../config/domain");
const logger = require("../config/logger");
const { decrypt } = require("../utils/storeCredentialCrypto");

const IFRAME_GET_TOKEN = "https://www.paytr.com/odeme/api/get-token";
const IFRAME_BASE = "https://www.paytr.com/odeme/guvenli/";

function resolveUserIp(raw) {
    const cleaned = String(raw || "").trim().replace(/^::ffff:/i, "");
    const match = cleaned.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    if (match) return match[1];
    if (cleaned === "::1" || cleaned === "127.0.0.1" || !cleaned) return "85.34.78.112";
    return cleaned.slice(0, 39);
}

function encodeBasket(items) {
    return Buffer.from(JSON.stringify(items), "utf8").toString("base64");
}

function buildIframeToken(creds, params) {
    const hashStr = `${params.merchantId}${params.userIp}${params.merchantOid}${params.email}${params.paymentAmount}${params.userBasket}${params.noInstallment}${params.maxInstallment}${params.currency}${params.testMode}`;
    return crypto.createHmac("sha256", creds.merchantKey).update(hashStr + creds.merchantSalt).digest("base64");
}

function verifyCallback(creds, callbackData) {
    const { merchant_oid, status, total_amount, hash } = callbackData;
    if (!merchant_oid || !status || !total_amount || !hash) return false;
    const hashStr = `${merchant_oid}${creds.merchantSalt}${status}${total_amount}`;
    const calculated = crypto.createHmac("sha256", creds.merchantKey).update(hashStr).digest("base64");
    try {
        const a = Buffer.from(hash, "utf8");
        const b = Buffer.from(calculated, "utf8");
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

function resolveCreds(paymentSettings) {
    const p = paymentSettings?.paytr || {};
    return {
        merchantId: String(p.merchantId || "").trim(),
        merchantKey: decrypt(p.merchantKeyEnc),
        merchantSalt: decrypt(p.merchantSaltEnc),
        testMode: p.testMode ? "1" : "0",
    };
}

function hasValidCreds(paymentSettings) {
    const c = resolveCreds(paymentSettings);
    return !!(c.merchantId && c.merchantKey && c.merchantSalt);
}

/**
 * @param {object} paymentSettings StorePaymentSettings doc
 */
async function requestStoreIframeToken(paymentSettings, paymentData) {
    const creds = resolveCreds(paymentSettings);
    if (!creds.merchantId || !creds.merchantKey || !creds.merchantSalt) {
        return { success: false, error: "PayTR mağaza bilgileri eksik. Panelden PayTR ayarlarını tamamlayın." };
    }

    const {
        userEmail,
        userName,
        userPhone,
        userAddress,
        userIp,
        amount,
        orderId,
        storeName,
        okUrl,
        failUrl,
    } = paymentData;

    const paymentAmountKurus = Math.round(Number(amount) * 100);
    const paymentAmount = String(paymentAmountKurus);
    const paymentAmountTl = Number(amount).toFixed(2);
    const userIpResolved = resolveUserIp(userIp);
    const emailNorm = String(userEmail || "").trim().toLowerCase();
    const phoneNorm = String(userPhone || "05000000000").replace(/\D/g, "").slice(0, 20) || "05000000000";

    const basketItems = [[`${storeName || "Mağaza"} Sipariş`, paymentAmountTl, 1]];
    const userBasketB64 = encodeBasket(basketItems);

    const paytrToken = buildIframeToken(creds, {
        merchantId: creds.merchantId,
        userIp: userIpResolved,
        merchantOid: orderId,
        email: emailNorm,
        paymentAmount,
        userBasket: userBasketB64,
        noInstallment: "0",
        maxInstallment: "12",
        currency: "TL",
        testMode: creds.testMode,
    });

    const base = APP_URL || "http://localhost:3000";
    const body = new URLSearchParams({
        merchant_id: creds.merchantId,
        user_ip: userIpResolved,
        merchant_oid: orderId,
        email: emailNorm,
        payment_amount: paymentAmount,
        paytr_token: paytrToken,
        user_basket: userBasketB64,
        user_name: userName || "Müşteri",
        user_address: userAddress || "Türkiye",
        user_phone: phoneNorm,
        merchant_ok_url: okUrl || `${base}/shop/payment/success`,
        merchant_fail_url: failUrl || `${base}/shop/payment/failed`,
        timeout_limit: "30",
        currency: "TL",
        test_mode: creds.testMode,
        debug_on: creds.testMode === "1" ? "1" : "0",
        lang: "tr",
        no_installment: "0",
        max_installment: "12",
    });

    try {
        const { data } = await axios.post(IFRAME_GET_TOKEN, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 20000,
            validateStatus: () => true,
        });
        if (data?.status === "success" && data?.token) {
            return {
                success: true,
                iframeToken: data.token,
                iframeUrl: `${IFRAME_BASE}${data.token}`,
            };
        }
        return { success: false, error: data?.reason || data?.err_msg || "PayTR token alınamadı" };
    } catch (err) {
        logger.error("[StorePayTR] get-token:", err.message);
        return { success: false, error: err.message };
    }
}

function getNotifyUrl() {
    const base = process.env.APP_URL || process.env.BACKEND_PUBLIC_URL || "http://localhost:5000";
    return `${base.replace(/\/$/, "")}/api/public/store/paytr/callback`;
}

module.exports = {
    requestStoreIframeToken,
    verifyCallback,
    resolveCreds,
    hasValidCreds,
    getNotifyUrl,
};
