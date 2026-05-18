/**
 * PazarYonet — marka ve e-posta sabitleri (backend)
 * Doğrulama postası: info@pazaryonet.com (Resend'de domain doğrulanmalı)
 */
const BRAND_NAME = process.env.BRAND_NAME || "PazarYonet";

const MAIL_DOMAIN = (process.env.MAIL_DOMAIN || "pazaryonet.com").replace(/^@/, "");

const DEFAULT_FROM = `PazarYonet <info@${MAIL_DOMAIN}>`;

const FROM_EMAIL = process.env.FROM_EMAIL || DEFAULT_FROM;

const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || `info@${MAIL_DOMAIN}`;

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || `info@${MAIL_DOMAIN}`;

module.exports = {
    BRAND_NAME,
    MAIL_DOMAIN,
    FROM_EMAIL,
    REPLY_TO_EMAIL,
    SUPPORT_EMAIL,
};
