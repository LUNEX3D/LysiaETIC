/**
 * PayTR Direkt API Service
 *
 * PayTR Direkt API ödeme entegrasyonu için servis.
 * Kart bilgileri doğrudan PayTR'a POST edilir (3D Secure).
 *
 * Dokümantasyon: https://dev.paytr.com/direkt-api/direkt-api-1-adim
 *
 * ✅ Direkt API — iFrame API yetkisi gerekmez
 * ✅ Credentials her çağrıda .env'den okunuyor (lazy read)
 * ✅ crypto.timingSafeEqual ile hash doğrulama (timing attack koruması)
 * ✅ Fiyat-plan doğrulama (amount manipulation koruması)
 */

const crypto = require("crypto");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const logger = require("../config/logger");
const { APP_URL } = require("../config/domain");

const BACKEND_ENV = path.join(__dirname, "..", ".env");
const BACKEND_ENV_LOCAL = path.join(__dirname, "..", ".env.local");

/** PM2 / farklı cwd — .env tekrar yükle */
function ensurePaytrEnvLoaded() {
    if (process.env.PAYTR_MERCHANT_ID && process.env.PAYTR_MERCHANT_KEY && process.env.PAYTR_MERCHANT_SALT) {
        return;
    }
    if (fs.existsSync(BACKEND_ENV)) {
        require("dotenv").config({ path: BACKEND_ENV });
    }
    if (fs.existsSync(BACKEND_ENV_LOCAL)) {
        require("dotenv").config({ path: BACKEND_ENV_LOCAL, override: true });
    }
}

class PayTRService {
    constructor() {
        this.paymentUrl = "https://www.paytr.com/odeme";
        this.iframeGetTokenUrl = "https://www.paytr.com/odeme/api/get-token";
        this.iframeBaseUrl = "https://www.paytr.com/odeme/guvenli/";
        this.binDetailUrl = "https://www.paytr.com/odeme/api/bin-detail";
        this.statusQueryUrl = "https://www.paytr.com/odeme/durum-sorgu";
        this.refundUrl = "https://www.paytr.com/odeme/iade";
    }

    /** PayTR iade tutarı — ondalık nokta (örn. 1699.00) */
    formatRefundAmountTl(amountTl) {
        const n = Math.round(Number(amountTl) * 100) / 100;
        if (!Number.isFinite(n) || n <= 0) {
            throw new Error("Geçersiz iade tutarı");
        }
        return n.toFixed(2);
    }

    /**
     * PayTR Durum Sorgu — ödeme gerçekten başarılı mı?
     * @see https://dev.paytr.com/durum-sorgu
     * paytr_token = HMAC-SHA256( merchant_id + merchant_oid + merchant_salt, merchant_key )
     */
    async queryOrderStatus(merchantOid) {
        const creds = this.getCredentials();
        if (!creds.merchantId || !creds.merchantKey || !creds.merchantSalt) {
            return { apiOk: false, error: "PayTR yapılandırılmamış" };
        }

        const oid = String(merchantOid || "").trim();
        if (!oid) {
            return { apiOk: false, error: "Sipariş numarası gerekli" };
        }

        const hashStr = `${creds.merchantId}${oid}${creds.merchantSalt}`;
        const paytrToken = crypto
            .createHmac("sha256", creds.merchantKey)
            .update(hashStr)
            .digest("base64");

        try {
            const body = new URLSearchParams({
                merchant_id: creds.merchantId,
                merchant_oid: oid,
                paytr_token: paytrToken,
            });

            const { data } = await axios.post(this.statusQueryUrl, body.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 30000,
                validateStatus: () => true,
            });

            if (data?.status === "success") {
                const amountRaw = String(data.payment_total || data.payment_amount || "0");
                const amountTl = parseFloat(amountRaw.replace(",", ".")) || 0;
                return {
                    apiOk: true,
                    paid: true,
                    paymentAmount: data.payment_amount,
                    paymentTotal: data.payment_total,
                    paymentTotalTl: amountTl,
                    paymentDate: data.payment_date,
                    currency: data.currency || "TL",
                    installment: data.taksit,
                    cardBrand: data.kart_marka,
                    raw: data,
                };
            }

            return {
                apiOk: true,
                paid: false,
                errNo: data?.err_no,
                errMsg: data?.err_msg || "PayTR: bu sipariş için başarılı ödeme bulunamadı",
                notFound: /bulunamadi|bulunamadı/i.test(String(data?.err_msg || "")),
                raw: data,
            };
        } catch (err) {
            logger.error(`PayTR durum sorgu hatası: ${err.message}`, { merchantOid: oid });
            return { apiOk: false, error: err.message };
        }
    }

    /**
     * PayTR İade API
     * @see https://dev.paytr.com/iade-api
     * paytr_token = HMAC-SHA256( merchant_id + merchant_oid + return_amount + merchant_salt, merchant_key )
     * return_amount — ondalık nokta ile TL (örn. "10.25")
     */
    async requestRefund(merchantOid, returnAmountTl, referenceNo = "") {
        const creds = this.getCredentials();
        if (!creds.merchantId || !creds.merchantKey || !creds.merchantSalt) {
            return { success: false, error: "PayTR yapılandırılmamış" };
        }

        const oid = String(merchantOid || "").trim();
        if (!oid) {
            return { success: false, error: "Sipariş numarası gerekli" };
        }

        let returnAmountStr;
        try {
            returnAmountStr = this.formatRefundAmountTl(returnAmountTl);
        } catch (e) {
            return { success: false, error: e.message };
        }

        const hashStr = `${creds.merchantId}${oid}${returnAmountStr}${creds.merchantSalt}`;
        const paytrToken = crypto
            .createHmac("sha256", creds.merchantKey)
            .update(hashStr)
            .digest("base64");

        try {
            const body = new URLSearchParams({
                merchant_id: creds.merchantId,
                merchant_oid: oid,
                return_amount: returnAmountStr,
                paytr_token: paytrToken,
            });

            const ref = String(referenceNo || "").trim().slice(0, 64);
            if (ref) {
                body.append("reference_no", ref);
            }

            const { data } = await axios.post(this.refundUrl, body.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 90000,
                validateStatus: () => true,
            });

            if (data?.status === "success") {
                logger.info(`PayTR iade başarılı: ${oid} — ${returnAmountStr} TL — ref=${data.reference_no || ref}`);
                return {
                    success: true,
                    merchantOid: data.merchant_oid || oid,
                    returnAmount: data.return_amount || returnAmountStr,
                    referenceNo: data.reference_no || ref,
                    isTest: data.is_test === 1 || data.is_test === "1",
                    raw: data,
                };
            }

            const errMsg = data?.err_msg || data?.reason || "PayTR iade talebi reddedildi";
            logger.warn(`PayTR iade başarısız: ${oid} — ${errMsg}`, { err_no: data?.err_no });
            return {
                success: false,
                status: data?.status || "error",
                errNo: data?.err_no,
                errMsg,
                raw: data,
            };
        } catch (err) {
            logger.error(`PayTR iade API hatası: ${err.message}`, { merchantOid: oid });
            return { success: false, error: err.message };
        }
    }

    /** PayTR BIN — taksitli işlemde card_type (brand) zorunlu */
    async lookupBinDetail(binNumber) {
        const creds = this.getCredentials();
        if (!creds.merchantId || !creds.merchantKey || !creds.merchantSalt) {
            return { success: false, error: "PayTR yapılandırılmamış" };
        }
        const bin = String(binNumber || "").replace(/\D/g, "").slice(0, 8);
        if (bin.length < 6) {
            return { success: false, error: "Kart numarasının ilk 6 hanesi gerekli" };
        }
        const hashStr = `${bin}${creds.merchantId}${creds.merchantSalt}`;
        const paytrToken = crypto
            .createHmac("sha256", creds.merchantKey)
            .update(hashStr)
            .digest("base64");

        try {
            const body = new URLSearchParams({
                merchant_id: creds.merchantId,
                bin_number: bin,
                paytr_token: paytrToken,
            });
            const { data } = await axios.post(this.binDetailUrl, body.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 15000,
                validateStatus: () => true,
            });
            if (data?.status === "success" && data?.brand) {
                const brand = String(data.brand).toLowerCase();
                if (brand === "none") {
                    return { success: false, error: "Bu kart ile taksitli ödeme yapılamaz" };
                }
                const allowed = ["advantage", "axess", "combo", "bonus", "cardfinans", "maximum", "paraf", "world", "saglamkart"];
                if (!allowed.includes(brand)) {
                    return { success: false, error: `Desteklenmeyen kart programı: ${brand}` };
                }
                return { success: true, brand, cardType: brand, raw: data };
            }
            if (data?.status === "failed") {
                return { success: false, error: "Kart BIN tanımlı değil (yurtdışı kart olabilir)" };
            }
            return { success: false, error: data?.err_msg || "BIN sorgusu başarısız" };
        } catch (err) {
            logger.error(`PayTR BIN sorgu hatası: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    getPaymentFlow() {
        return String(process.env.PAYTR_FLOW || "iframe").toLowerCase();
    }

    /**
     * iFrame API — PayTR ödeme ekranında taksit tablosu
     * @see https://dev.paytr.com/iframe-api/iframe-api-1-adim
     * no_installment=0 → taksit seçenekleri gösterilir (kart girilince BIN + taksit tablosu)
     * no_installment=1 → yalnızca Tek Çekim
     * max_installment=0 → panelde tanımlı en fazla taksit
     */
    resolveIframeInstallmentOptions() {
        const forceSingleOnly = String(process.env.PAYTR_NO_INSTALLMENT || "0").trim() === "1";
        const maxRaw = parseInt(process.env.PAYTR_MAX_INSTALLMENT || "0", 10);
        const maxInstallment = forceSingleOnly
            ? "0"
            : (maxRaw > 0 ? String(Math.min(12, maxRaw)) : "0");
        return {
            noInstallment: forceSingleOnly ? "1" : "0",
            maxInstallment,
        };
    }

    /** Direkt API — seçilen taksit sayısı token hash'ine girer */
    resolveInstallmentOptions(installmentCount) {
        const max = Math.min(12, Math.max(0, parseInt(process.env.PAYTR_MAX_INSTALLMENT || "12", 10) || 12));
        const maxInstallment = String(max);
        const count = Math.max(0, Math.min(max, parseInt(installmentCount, 10) || 0));
        if (count <= 0) {
            return { installmentCount: "0", noInstallment: "1", maxInstallment };
        }
        return { installmentCount: String(count), noInstallment: "0", maxInstallment };
    }

    getInstallmentChoices() {
        const max = Math.min(12, Math.max(0, parseInt(process.env.PAYTR_MAX_INSTALLMENT || "12", 10) || 12));
        return [0, 2, 3, 4, 6, 9, 12].filter((n) => n === 0 || n <= max);
    }

    /**
     * Credentials'ları her çağrıda .env'den oku
     */
    getCredentials() {
        ensurePaytrEnvLoaded();
        const trim = (v) => String(v || "").trim().replace(/^\uFEFF/, "");
        return {
            merchantId: trim(process.env.PAYTR_MERCHANT_ID),
            merchantKey: trim(process.env.PAYTR_MERCHANT_KEY),
            merchantSalt: trim(process.env.PAYTR_MERCHANT_SALT),
            testMode: trim(process.env.PAYTR_TEST_MODE) || (process.env.NODE_ENV === "production" ? "0" : "1"),
            merchantOkUrl: trim(process.env.PAYTR_OK_URL) || `${APP_URL}/payment/success`,
            merchantFailUrl: trim(process.env.PAYTR_FAIL_URL) || `${APP_URL}/payment/failed`,
            notifyUrl: trim(process.env.PAYTR_NOTIFY_URL) || `${APP_URL}/api/paytr/callback`,
        };
    }

    /**
     * Credentials'ların geçerli olup olmadığını kontrol et
     */
    hasValidCredentials() {
        const creds = this.getCredentials();
        return !!(creds.merchantId && creds.merchantKey && creds.merchantSalt);
    }

    /** Yapılandırma özeti (secret değerleri dönmez) */
    getConfigStatus() {
        const c = this.getCredentials();
        return {
            configured: this.hasValidCredentials(),
            merchantIdSet: !!c.merchantId,
            merchantKeySet: !!c.merchantKey,
            merchantSaltSet: !!c.merchantSalt,
            testMode: c.testMode,
            merchantOkUrl: c.merchantOkUrl,
            merchantFailUrl: c.merchantFailUrl,
            notifyUrl: c.notifyUrl,
            paymentUrl: this.paymentUrl,
            directApi: true,
            paymentFlow: this.getPaymentFlow(),
            tokenMode: String(process.env.PAYTR_TOKEN_MODE || "iframe_b64").toLowerCase(),
            iframeGetTokenUrl: this.iframeGetTokenUrl,
            installmentChoices: this.getInstallmentChoices(),
            maxInstallment: parseInt(process.env.PAYTR_MAX_INSTALLMENT || "12", 10) || 12,
        };
    }

    /**
     * iFrame API 1. Adım — sunucudan get-token
     * @see https://dev.paytr.com/iframe-api/iframe-api-1-adim
     */
    async requestIframeToken(paymentData) {
        const creds = this.getCredentials();
        if (!creds.merchantId || !creds.merchantKey || !creds.merchantSalt) {
            return { success: false, error: "PayTR credentials yapılandırılmamış" };
        }

        const {
            userEmail,
            userName,
            userPhone,
            userAddress,
            userIp,
            amount,
            orderId,
            plan,
            currency = "TL",
        } = paymentData;

        const phoneNorm = String(userPhone || "05000000000").replace(/\D/g, "").slice(0, 20) || "05000000000";
        const paymentAmountKurus = Math.round(Number(amount) * 100);
        const paymentAmount = String(paymentAmountKurus);
        const paymentAmountTl = Number(amount).toFixed(2);
        const { noInstallment, maxInstallment } = this.resolveIframeInstallmentOptions();
        const userIpResolved = this.resolveUserIp(userIp);
        const emailNorm = String(userEmail || "").trim().toLowerCase();

        const basketItems = [
            [`Dashtock ${String(plan).toUpperCase()} Paketi`, paymentAmountTl, 1],
        ];
        const userBasketB64 = this.encodeUserBasket(basketItems);

        const paytrToken = this.generateIframeToken({
            merchantId: creds.merchantId,
            userIp: userIpResolved,
            merchantOid: orderId,
            email: emailNorm,
            paymentAmount,
            userBasket: userBasketB64,
            noInstallment,
            maxInstallment,
            currency,
            testMode: creds.testMode,
        });

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
            merchant_ok_url: creds.merchantOkUrl,
            merchant_fail_url: creds.merchantFailUrl,
            timeout_limit: "30",
            currency,
            test_mode: creds.testMode,
            debug_on: creds.testMode === "1" ? "1" : "0",
            lang: "tr",
            no_installment: noInstallment,
            max_installment: maxInstallment,
        });

        try {
            const { data } = await axios.post(this.iframeGetTokenUrl, body.toString(), {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                timeout: 20000,
                validateStatus: () => true,
            });

            if (data?.status === "success" && data?.token) {
                logger.info(`PayTR iFrame token alındı: ${orderId} — ${amount} TL (${paymentAmount} kuruş)`);
                return {
                    success: true,
                    iframeToken: data.token,
                    iframeUrl: `${this.iframeBaseUrl}${data.token}`,
                    amountTl: paymentAmountTl,
                    paymentAmountKurus: paymentAmount,
                };
            }

            const reason = data?.reason || data?.err_msg || "PayTR get-token başarısız";
            logger.error(`PayTR get-token hatası: ${reason}`, { orderId, status: data?.status });
            return { success: false, error: reason };
        } catch (err) {
            logger.error(`PayTR get-token bağlantı hatası: ${err.message}`, { orderId });
            return { success: false, error: err.message };
        }
    }

    /**
     * /odeme POST ile token hash'inde aynı payment_amount kullanılmalı (PayTR doğrulaması).
     * spp sayfası POST'ta kuruş ister → hash de kuruş olmalı (ondalık TL hash = geçersiz token).
     */
    buildPaytrToken(creds, opts) {
        const {
            mode,
            merchantId,
            userIp,
            merchantOid,
            email,
            paymentAmountKurus,
            paymentAmountTl,
            userBasketJson,
            userBasketB64,
            noInstallment,
            maxInstallment,
            currency,
            testMode,
        } = opts;

        const m = String(mode || "direct_sync").toLowerCase();
        const kurus = String(paymentAmountKurus);
        const directBase = {
            merchantId,
            userIp,
            merchantOid,
            email,
            paymentType: "card",
            installmentCount: "0",
            currency,
            testMode,
            non3d: "0",
        };

        if (m === "iframe_b64") {
            return {
                token: this.generateIframeToken({
                    ...directBase,
                    paymentAmount: kurus,
                    userBasket: userBasketB64,
                    noInstallment,
                    maxInstallment,
                }),
                userBasketPost: userBasketB64,
                mode: m,
            };
        }

        if (m === "iframe_plain" || m === "iframe") {
            return {
                token: this.generateIframeToken({
                    ...directBase,
                    paymentAmount: kurus,
                    userBasket: userBasketJson,
                    noInstallment,
                    maxInstallment,
                }),
                userBasketPost: userBasketJson,
                mode: m,
            };
        }

        if (m === "direct_decimal") {
            return {
                token: this.generateDirectToken({
                    ...directBase,
                    paymentAmount: paymentAmountTl,
                }),
                userBasketPost: userBasketJson,
                mode: m,
            };
        }

        // direct_sync: PayTR Direkt API — hash ve POST'ta payment_amount ondalık TL (örn. 299.00)
        // @see https://dev.paytr.com/direkt-api/direkt-api-1-adim
        const inst = String(opts.installmentCount || "0");
        return {
            token: this.generateDirectToken({
                ...directBase,
                paymentAmount: paymentAmountTl,
                installmentCount: inst,
            }),
            userBasketPost: userBasketJson,
            mode: "direct_sync",
        };
    }

    /**
     * PayTR callback total_amount — kuruş (10099) veya ondalık TL ("100.99")
     * @see https://dev.paytr.com/direkt-api/direkt-api-2-adim
     */
    parseCallbackAmount(total_amount) {
        const raw = String(total_amount ?? "").trim();
        if (!raw) return { kurus: 0, tl: 0 };
        if (raw.includes(".") || raw.includes(",")) {
            const tl = parseFloat(raw.replace(",", ".")) || 0;
            return { tl, kurus: Math.round(tl * 100) };
        }
        const kurus = parseInt(raw, 10) || 0;
        return { tl: kurus / 100, kurus };
    }

    /**
     * Callback / durum sorgu tutarı ile kayıtlı beklenen tutar (kuruş veya TL formatı).
     * PayTR hash doğrulandıysa küçük farklarda ödemeyi reddetmeyin — paket otomatik açılsın.
     */
    amountMatchesExpected(payment, totalAmountKurus, totalAmountTl) {
        const expected = payment?.expectedAmount;
        if (!expected) return true;
        if (totalAmountKurus === expected) return true;
        const expectedTl = expected / 100;
        if (Math.abs(totalAmountTl - expectedTl) < 0.02) return true;
        const recordedTl = Number(payment.amount) || 0;
        if (Math.abs(recordedTl - totalAmountTl) < 0.02) return true;
        return Math.abs(totalAmountKurus - expected) <= 2;
    }

    /**
     * PayTR yalnızca IPv4 kabul eder (max 39 karakter).
     * @see https://dev.paytr.com/direkt-api/direkt-api-1-adim
     */
    resolveUserIp(raw) {
        const cleaned = String(raw || "").trim().replace(/^::ffff:/i, "");
        const match = cleaned.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
        if (match) return match[1];
        if (cleaned === "::1" || cleaned === "127.0.0.1" || !cleaned) {
            return "85.34.78.112";
        }
        return cleaned.slice(0, 39);
    }

    /** Sepet JSON → base64 (iFrame API POST) */
    encodeUserBasket(items) {
        const json = JSON.stringify(items);
        return Buffer.from(json, "utf8").toString("base64");
    }

    /**
     * iFrame API token — odeme spp + kuruş payment_amount için geçerli
     * @see https://dev.paytr.com/iframe-api/iframe-api-1-adim
     * hashStr = merchant_id + user_ip + merchant_oid + email + payment_amount
     *   + user_basket + no_installment + max_installment + currency + test_mode
     */
    generateIframeToken(params) {
        const creds = this.getCredentials();
        const {
            merchantId,
            userIp,
            merchantOid,
            email,
            paymentAmount,
            userBasket,
            noInstallment,
            maxInstallment,
            currency,
            testMode,
        } = params;

        const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`;

        return crypto
            .createHmac("sha256", creds.merchantKey)
            .update(hashStr + creds.merchantSalt)
            .digest("base64");
    }

    /**
     * Direkt API token (kart POST /odeme — klasik Direkt hash)
     * hashStr = merchant_id + user_ip + merchant_oid + email + payment_amount
     *   + payment_type + installment_count + currency + test_mode + non_3d
     */
    generateDirectToken(params) {
        const creds = this.getCredentials();
        const {
            merchantId,
            userIp,
            merchantOid,
            email,
            paymentAmount, // Ondalıklı TL string (örn: "299.00" veya "100.99")
            paymentType,   // "card"
            installmentCount, // "0"
            currency,      // "TL"
            testMode,
            non3d          // "0" (3D Secure aktif)
        } = params;

        // Hash string oluştur (PayTR Direkt API dokümantasyonuna göre sıralama)
        const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${paymentType}${installmentCount}${currency}${testMode}${non3d}`;

        // HMAC-SHA256 ile hash oluştur
        const hash = crypto
            .createHmac("sha256", creds.merchantKey)
            .update(hashStr + creds.merchantSalt)
            .digest("base64");

        return hash;
    }

    /**
     * Direkt API için form verilerini hazırla
     * Bu veriler frontend'e gönderilir, frontend bunları hidden form ile PayTR'a POST eder
     *
     * @param {Object} paymentData - Ödeme bilgileri
     * @returns {Object} Form verileri
     */
    prepareDirectFormData(paymentData) {
        try {
            const creds = this.getCredentials();

            // Credentials kontrolü
            if (!creds.merchantId || !creds.merchantKey || !creds.merchantSalt) {
                logger.error("PayTR credentials eksik!", {
                    hasMerchantId: !!creds.merchantId,
                    hasMerchantKey: !!creds.merchantKey,
                    hasMerchantSalt: !!creds.merchantSalt
                });
                return {
                    success: false,
                    error: "PayTR credentials yapılandırılmamış"
                };
            }

            const {
                userEmail,
                userName,
                userPhone,
                userAddress,
                userIp,
                amount,    // TL cinsinden (örn: 299 veya 1299)
                orderId,
                plan,
                currency = "TL"
            } = paymentData;

            const phoneNorm = String(userPhone || "05000000000").replace(/\D/g, "").slice(0, 20) || "05000000000";

            // PayTR ödeme sayfası (odeme spp): payment_amount kuruş, tam sayı (299.00 TL → 29900)
            // iFrame API: https://dev.paytr.com/iframe-api/iframe-api-1-adim
            const paymentAmountKurus = Math.round(Number(amount) * 100);
            const paymentAmount = String(paymentAmountKurus);
            const paymentAmountTl = Number(amount).toFixed(2);

            const { installmentCount, noInstallment, maxInstallment } = this.resolveInstallmentOptions(
                paymentData.installmentCount
            );
            const userIpResolved = this.resolveUserIp(userIp);
            const emailNorm = String(userEmail || "").trim().toLowerCase();

            const basketItems = [
                [`Dashtock ${String(plan).toUpperCase()}`, paymentAmountTl, 1]
            ];
            const userBasketJson = JSON.stringify(basketItems);
            const userBasketB64 = this.encodeUserBasket(basketItems);

            const tokenMode = String(process.env.PAYTR_TOKEN_MODE || "direct_sync").toLowerCase();
            const resolvedTokenMode = tokenMode === "direct" || tokenMode === "direct_kurus"
                ? "direct_sync"
                : tokenMode;
            const { token: paytrToken, userBasketPost: userBasketForPost, mode: resolvedMode } =
                this.buildPaytrToken(creds, {
                    mode: resolvedTokenMode,
                    merchantId: creds.merchantId,
                    userIp: userIpResolved,
                    merchantOid: orderId,
                    email: emailNorm,
                    paymentAmountKurus: paymentAmount,
                    paymentAmountTl,
                    userBasketJson,
                    userBasketB64,
                    noInstallment,
                    maxInstallment,
                    installmentCount,
                    currency,
                    testMode: creds.testMode,
                });

            logger.info(`PayTR ödeme formu: ${orderId} — ${amount} TL — amount=${paymentAmount} — token=${resolvedMode} — ip=${userIpResolved}`);

            // Frontend'e gönderilecek form verileri
            // Frontend bu verileri hidden form ile https://www.paytr.com/odeme'ye POST edecek
            return {
                success: true,
                paymentUrl: this.paymentUrl,
                amountTl: paymentAmountTl,
                paymentAmountTl,
                installmentCount,
                formData: {
                    merchant_id: creds.merchantId,
                    user_ip: userIpResolved,
                    merchant_oid: orderId,
                    email: emailNorm,
                    payment_amount: paymentAmountTl,
                    payment_type: "card",
                    installment_count: installmentCount,
                    currency,
                    test_mode: creds.testMode,
                    non_3d: "0",
                    merchant_ok_url: creds.merchantOkUrl,
                    merchant_fail_url: creds.merchantFailUrl,
                    user_name: userName || "Müşteri",
                    user_address: userAddress || "Türkiye",
                    user_phone: phoneNorm,
                    user_basket: userBasketForPost,
                    debug_on: creds.testMode === "1" ? "1" : "0",
                    client_lang: "tr",
                    paytr_token: paytrToken,
                    non3d_test_failed: "0",
                },
            };
        } catch (error) {
            logger.error(`PayTR Direkt API form hazırlama hatası: ${error.message}`, {
                stack: error.stack?.substring(0, 500)
            });
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Callback hash'i doğrula
     * ✅ crypto.timingSafeEqual kullanılıyor (timing attack koruması)
     *
     * PayTR hash formülü (Direkt API Step 2 — iFrame ile aynı):
     *   hash = base64( hmac_sha256( merchantKey, merchant_oid + merchantSalt + status + total_amount ) )
     *
     * @param {Object} callbackData - PayTR'dan gelen callback verisi
     * @returns {Boolean} Hash geçerli mi?
     */
    verifyCallback(callbackData) {
        const creds = this.getCredentials();
        const { merchant_oid, status, total_amount, hash } = callbackData;

        if (!this.hasValidCredentials()) {
            logger.error("PayTR callback: credentials eksik, doğrulama reddedildi");
            return false;
        }

        if (!merchant_oid || !status || !total_amount || !hash) {
            logger.error("PayTR callback: Eksik parametreler", {
                hasMerchantOid: !!merchant_oid,
                hasStatus: !!status,
                hasTotalAmount: !!total_amount,
                hasHash: !!hash
            });
            return false;
        }

        // Hash string oluştur (PayTR dokümantasyonuna göre)
        const hashStr = `${merchant_oid}${creds.merchantSalt}${status}${total_amount}`;

        // HMAC-SHA256 ile hash oluştur
        const calculatedHash = crypto
            .createHmac("sha256", creds.merchantKey)
            .update(hashStr)
            .digest("base64");

        // ✅ Timing-safe karşılaştırma
        try {
            const hashBuffer = Buffer.from(hash, "utf8");
            const calculatedBuffer = Buffer.from(calculatedHash, "utf8");

            if (hashBuffer.length !== calculatedBuffer.length) {
                logger.error("PayTR callback: Hash uzunluk uyumsuzluğu", {
                    expected: calculatedBuffer.length,
                    received: hashBuffer.length,
                    merchant_oid
                });
                return false;
            }

            const isValid = crypto.timingSafeEqual(hashBuffer, calculatedBuffer);

            if (!isValid) {
                logger.error("PayTR callback: Hash değeri eşleşmiyor!", {
                    merchant_oid,
                    status,
                    total_amount,
                    receivedHash: hash.substring(0, 10) + "...",
                    calculatedHash: calculatedHash.substring(0, 10) + "..."
                });
            }

            return isValid;
        } catch (err) {
            logger.error(`PayTR callback: Hash karşılaştırma hatası: ${err.message}`);
            return false;
        }
    }

    /**
     * Callback'i işle
     * @param {Object} callbackData - PayTR'dan gelen POST verisi
     * @returns {Object} İşlem sonucu
     */
    processCallback(callbackData) {
        try {
            const safeLogData = {
                merchant_oid: callbackData?.merchant_oid,
                status: callbackData?.status,
                total_amount: callbackData?.total_amount,
                payment_type: callbackData?.payment_type,
                test_mode: callbackData?.test_mode
            };
            logger.info(`PayTR callback alındı: ${JSON.stringify(safeLogData)}`);

            if (!this.hasValidCredentials()) {
                logger.error("PayTR callback: credentials eksik, callback reddedildi");
                return {
                    success: false,
                    error: "PayTR credentials missing"
                };
            }

            // Boş body kontrolü
            if (!callbackData || Object.keys(callbackData).length === 0) {
                logger.error("PayTR callback: Boş body geldi! express.urlencoded() middleware kontrol edin.");
                return {
                    success: false,
                    error: "Empty callback body"
                };
            }

            // ✅ HMAC-SHA256 hash doğrulama (timing-safe)
            if (!this.verifyCallback(callbackData)) {
                logger.error("💀 PayTR callback HASH DOĞRULAMA BAŞARISIZ — SAHTE CALLBACK OLABİLİR!", {
                    merchant_oid: callbackData.merchant_oid,
                    status: callbackData.status,
                    ip: callbackData._remoteIp || "unknown"
                });
                return {
                    success: false,
                    error: "Invalid hash — callback rejected"
                };
            }

            const {
                merchant_oid,
                status,
                total_amount,
                payment_amount,
                currency,
                payment_type,
                installment_count,
                test_mode,
                failed_reason_code,
                failed_reason_msg
            } = callbackData;

            logger.info(`✅ PayTR callback hash doğrulandı: ${merchant_oid} - Status: ${status} - Amount: ${total_amount}`);

            const { kurus: totalAmountKurus, tl: totalAmountTl } = this.parseCallbackAmount(total_amount);
            const paymentParsed = this.parseCallbackAmount(payment_amount || total_amount);

            return {
                success: true,
                orderId: merchant_oid,
                status, // "success" veya "failed"
                totalAmount: totalAmountTl,
                totalAmountKurus,
                paymentAmount: paymentParsed.tl,
                currency: currency || "TL",
                paymentType: payment_type || "card",
                installmentCount: installment_count || 1,
                isTest: test_mode === "1",
                failReasonCode: failed_reason_code || null,
                failReasonMsg: failed_reason_msg || null,
                rawData: callbackData
            };
        } catch (error) {
            logger.error(`PayTR callback işleme hatası: ${error.message}`, { stack: error.stack });
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PayTRService();
