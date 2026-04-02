/**
 * PayTR iFrame API Service
 *
 * PayTR ödeme entegrasyonu için servis.
 * iFrame API kullanarak token oluşturma ve callback işlemleri.
 *
 * Dokümantasyon: https://dev.paytr.com/iframe-api
 *
 * ✅ FIX: Credentials her çağrıda .env'den okunuyor (lazy read)
 * ✅ FIX: merchant_notify_url eklendi (callback URL)
 * ✅ FIX: Detaylı hata loglaması
 * ✅ FIX: crypto.timingSafeEqual ile hash doğrulama (timing attack koruması)
 * ✅ FIX: Fiyat-plan doğrulama (amount manipulation koruması)
 */

const crypto = require("crypto");
const axios = require("axios");
const logger = require("../config/logger");

class PayTRService {
    constructor() {
        this.apiUrl = "https://www.paytr.com/odeme/api/get-token";
    }

    /**
     * Credentials'ları her çağrıda .env'den oku
     * (Module cache nedeniyle constructor'da okumak güvenilir değil)
     */
    getCredentials() {
        return {
            merchantId: process.env.PAYTR_MERCHANT_ID || "",
            merchantKey: process.env.PAYTR_MERCHANT_KEY || "",
            merchantSalt: process.env.PAYTR_MERCHANT_SALT || "",
            testMode: process.env.PAYTR_TEST_MODE || (process.env.NODE_ENV === "production" ? "0" : "1"),
            merchantOkUrl: process.env.PAYTR_OK_URL || "http://localhost:3000/payment/success",
            merchantFailUrl: process.env.PAYTR_FAIL_URL || "http://localhost:3000/payment/failed",
            merchantNotifyUrl: process.env.PAYTR_NOTIFY_URL || `${process.env.PAYTR_BACKEND_URL || ("http://localhost:" + (process.env.PORT || 5000))}/api/paytr/callback`
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
     * PayTR token hash'i oluştur
     * @param {Object} params - Token parametreleri
     * @param {string} merchantKey - Merchant key
     * @param {string} merchantSalt - Merchant salt
     * @returns {String} Base64 encoded hash
     */
    generateToken(params, merchantKey, merchantSalt) {
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
            testMode
        } = params;

        // Hash string oluştur (PayTR dokümantasyonuna göre sıralama)
        const hashStr = `${merchantId}${userIp}${merchantOid}${email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`;

        // HMAC-SHA256 ile hash oluştur
        const hash = crypto
            .createHmac("sha256", merchantKey)
            .update(hashStr + merchantSalt)
            .digest("base64");

        return hash;
    }

    /**
     * Callback hash'i doğrula
     * ✅ crypto.timingSafeEqual kullanılıyor (timing attack koruması)
     *
     * PayTR hash formülü:
     *   hash = base64( hmac_sha256( merchantKey, merchant_oid + merchantSalt + status + total_amount ) )
     *
     * @param {Object} callbackData - PayTR'dan gelen callback verisi
     * @returns {Boolean} Hash geçerli mi?
     */
    verifyCallback(callbackData) {
        const creds = this.getCredentials();
        const { merchant_oid, status, total_amount, hash } = callbackData;

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
        // Formül: merchant_oid + merchant_salt + status + total_amount
        const hashStr = `${merchant_oid}${creds.merchantSalt}${status}${total_amount}`;

        // HMAC-SHA256 ile hash oluştur
        const calculatedHash = crypto
            .createHmac("sha256", creds.merchantKey)
            .update(hashStr)
            .digest("base64");

        // ✅ Timing-safe karşılaştırma (timing attack koruması)
        // String === karşılaştırma yerine sabit zamanlı karşılaştırma kullan
        try {
            const hashBuffer = Buffer.from(hash, "utf8");
            const calculatedBuffer = Buffer.from(calculatedHash, "utf8");

            // Uzunluklar farklıysa zaten geçersiz
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
     * iFrame token al
     * @param {Object} paymentData - Ödeme bilgileri
     * @returns {Promise<Object>} Token response
     */
    async getIframeToken(paymentData) {
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
                userId,
                userEmail,
                userName,
                userPhone,
                userAddress,
                userIp,
                amount, // TL cinsinden (örn: 299)
                orderId, // Benzersiz sipariş ID
                plan, // basic, pro, enterprise
                currency = "TL"
            } = paymentData;

            // Ödeme tutarını kuruşa çevir (100 ile çarp)
            const paymentAmount = Math.round(amount * 100);

            // Sepet içeriği oluştur (base64 encoded JSON array)
            const userBasket = Buffer.from(JSON.stringify([
                [`LysiaETIC ${plan.toUpperCase()} Paketi`, amount.toFixed(2), 1]
            ])).toString("base64");

            // Token parametreleri
            const tokenParams = {
                merchantId: creds.merchantId,
                userIp: userIp || "85.34.78.112",
                merchantOid: orderId,
                email: userEmail,
                paymentAmount: paymentAmount.toString(),
                userBasket,
                noInstallment: "0",
                maxInstallment: "0",
                currency,
                testMode: creds.testMode
            };

            // Token hash'i oluştur
            const paytrToken = this.generateToken(tokenParams, creds.merchantKey, creds.merchantSalt);

            // PayTR API'ye POST isteği
            const formData = new URLSearchParams({
                merchant_id: creds.merchantId,
                user_ip: tokenParams.userIp,
                merchant_oid: orderId,
                email: userEmail,
                payment_amount: paymentAmount.toString(),
                paytr_token: paytrToken,
                user_basket: userBasket,
                debug_on: creds.testMode === "1" ? "1" : "0",
                no_installment: "0",
                max_installment: "0",
                user_name: userName || "Müşteri",
                user_address: userAddress || "Türkiye",
                user_phone: userPhone || "05000000000",
                merchant_ok_url: creds.merchantOkUrl,
                merchant_fail_url: creds.merchantFailUrl,
                merchant_notify_url: creds.merchantNotifyUrl,
                timeout_limit: "30",
                currency,
                test_mode: creds.testMode,
                lang: "tr"
            });

            logger.info(`PayTR token isteği gönderiliyor: ${orderId} - ${amount} TL (notify: ${creds.merchantNotifyUrl})`);

            const response = await axios.post(this.apiUrl, formData.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                timeout: 30000
            });

            logger.info(`PayTR API yanıtı: ${JSON.stringify(response.data)}`);

            if (response.data.status === "success") {
                logger.info(`PayTR token başarıyla alındı: ${orderId} — Token: ${response.data.token?.substring(0, 20)}...`);
                return {
                    success: true,
                    token: response.data.token,
                    iframeUrl: `https://www.paytr.com/odeme/guvenli/${response.data.token}`
                };
            } else {
                logger.error(`PayTR token hatası: ${response.data.reason}`, {
                    orderId,
                    merchantId: creds.merchantId,
                    amount,
                    reason: response.data.reason
                });
                return {
                    success: false,
                    error: response.data.reason || "Token alınamadı"
                };
            }
        } catch (error) {
            logger.error(`PayTR servis hatası: ${error.message}`, {
                status: error.response?.status,
                data: error.response?.data,
                stack: error.stack?.substring(0, 500)
            });
            return {
                success: false,
                error: error.response?.data?.reason || error.message
            };
        }
    }

    /**
     * Callback'i işle
     * @param {Object} callbackData - PayTR'dan gelen POST verisi
     * @returns {Object} İşlem sonucu
     */
    processCallback(callbackData) {
        try {
            logger.info(`PayTR callback ham veri: ${JSON.stringify(callbackData)}`);

            // Boş body kontrolü
            if (!callbackData || Object.keys(callbackData).length === 0) {
                logger.error("PayTR callback: Boş body geldi! express.urlencoded() middleware kontrol edin.");
                return {
                    success: false,
                    error: "Empty callback body"
                };
            }

            // ✅ HMAC-SHA256 hash doğrulama (timing-safe)
            // Formül: hash = base64( hmac_sha256( merchantKey, merchant_oid + merchantSalt + status + total_amount ) )
            // Bu başarısız olursa → sahte callback, REJECT
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
