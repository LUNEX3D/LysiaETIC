import { APP_DOMAIN, APP_SITE_URL } from "./domain";

/** Dashtock — merkezi marka sabitleri (UI) */
export const BRAND_NAME = "Dashtock";
export { APP_DOMAIN, APP_SITE_URL };
export const BRAND_NAME_UPPER = "DASHTOCK";
export const BRAND_TAGLINE = "Pazaryeri stok ve satış dashboard'u";
export const BRAND_PANEL_SUB = "Yönetim Paneli";
export const BRAND_ADMIN_TAG = "SaaS Yönetim Konsolu";
export const BRAND_AI = "Dashtock AI";
export const BRAND_RADAR = "Dashtock Radar";
export const BRAND_AGENT = "Dashtock Agent";
export const BRAND_LOGO_SRC = "/brand/dashtock-logo.svg?v=dashtock3";
/** Doğrulama ve iletişim */
export const BRAND_EMAIL = "info@dashtock.com";
export const BRAND_MAIL_DOMAIN = "dashtock.com";
export const BRAND_VERIFY_EMAIL_NOTE =
    "Kayıt ve e-posta doğrulama mesajları info@dashtock.com adresinden gönderilir.";
export const BRAND_INTEGRATOR = "Dashtock";

/** Sekme başlığı: "Sayfa · Dashtock" */
export function formatBrandPageTitle(pageLabel) {
    return pageLabel ? `${pageLabel} · ${BRAND_NAME}` : BRAND_NAME;
}
