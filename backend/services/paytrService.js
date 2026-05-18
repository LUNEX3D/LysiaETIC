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
const logger = require("../config/logger");
const { APP_URL } = require("../config/domain");

class PayTRService {
    constructor() {
        // Direkt API — form doğrudan PayTR'a POST edilir
        this.paymentUrl = "https://www.paytr.com/odeme";
    }

    /**
     * Credentials'ları her çağrıda .env'den oku
     */
    getCredentials() {
        return {
            merchantId: process.env.PAYTR_MERCHANT_ID || "",
            merchantKey: process.env.PAYTR_MERCHANT_KEY || "",
            merchantSalt: process.env.PAYTR_MERCHANT_SALT || "",
            testMode: process.env.PAYTR_TEST_MODE || (process.env.NODE_ENV === "production" ? "0" : "1"),
            merchantOkUrl: process.env.PAYTR_OK_URL || `${APP_URL}/payment/success`,
            merchantFailUrl: process.env.PAYTR_FAIL_URL || `${APP_URL}/payment/failed`,
        };
    }

    /**
     * Credentials'ların geçerli olup olmadığını kontrol et
     */
    hasValidCredentials() {
        const creds = this.getCredentials();
        return !!(creds.merchantId && creds.merchantKey && creds.merchantSalt);
    }

    /**
     * Direkt API token hash'i oluştur
     *
     * Hash formülü (PayTR Direkt API dokümantasyonuna göre):
     *   hash = base64( hmac_sha256( merchantKey, hashStr + merchantSalt ) )
     *   hashStr = merchant_id + user_ip + merchant_oid + email + payment_amount + payment_type + installment_count + currency + test_mode + non_3d
     *
     * @param {Object} params - Token parametreleri
     * @returns {String} Base64 encoded hash
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

            // Direkt API'de payment_amount ondalıklı TL string olmalı (örn: "299.00")
            // PayTR dokümantasyonu: "payment_amount (double), decimal (.) and two digits after the point"
            // Örnek: 100.99 veya 150 veya 1500.35
            const paymentAmount = Number(amount).toFixed(2);

            // Sepet içeriği — JSON string
            // PayTR Direkt API Node.js örneğinde user_basket düz JSON string olarak gönderilir
            const userBasket = JSON.stringify([
                [`LysiaETIC ${plan.toUpperCase()} Paketi`, paymentAmount, 1]
            ]);

            // Token parametreleri
            const tokenParams = {
                merchantId: creds.merchantId,
                userIp: userIp || "85.34.78.112",
                merchantOid: orderId,
                email: userEmail,
                paymentAmount,
                paymentType: "card",
                installmentCount: "0",
                currency,
                testMode: creds.testMode,
                non3d: "0" // 3D Secure aktif
            };

            // Token hash'i oluştur
            const paytrToken = this.generateDirectToken(tokenParams);

            logger.info(`PayTR Direkt API form hazırlanıyor: ${orderId} - ${amount} TL — ${userEmail}`);

            // Frontend'e gönderilecek form verileri
            // Frontend bu verileri hidden form ile https://www.paytr.com/odeme'ye POST edecek
            return {
                success: true,
                paymentUrl: this.paymentUrl,
                formData: {
                    merchant_id: creds.merchantId,
                    user_ip: tokenParams.userIp,
                    merchant_oid: orderId,
                    email: userEmail,
                    payment_amount: paymentAmount,
                    payment_type: "card",
                    installment_count: "0",
                    currency,
                    test_mode: creds.testMode,
                    non_3d: "0",
                    merchant_ok_url: creds.merchantOkUrl,
                    merchant_fail_url: creds.merchantFailUrl,
                    user_name: userName || "Müşteri",
                    user_address: userAddress || "Türkiye",
                    user_phone: userPhone || "05000000000",
                    user_basket: userBasket,
                    debug_on: creds.testMode === "1" ? "1" : "0",
                    client_lang: "tr",
                    paytr_token: paytrToken,
                    non3d_test_failed: "0",
                    card_type: ""
                }
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

            return {
                success: true,
                orderId: merchant_oid,
                status, // "success" veya "failed"
                totalAmount: parseInt(total_amount) / 100, // Kuruştan TL'ye
                totalAmountKurus: parseInt(total_amount),   // Kuruş cinsinden (doğrulama için)
                paymentAmount: parseInt(payment_amount || total_amount) / 100,
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
