import { APP_SITE_URL } from "../constants/domain";
import { BRAND_NAME } from "../constants/brand";

const DEFAULT_TITLE = `${BRAND_NAME} - Pazaryeri Entegrasyon ve E-Ticaret Yönetim Sistemi`;
const DEFAULT_DESC =
    "PazarYonet ile Trendyol, Hepsiburada, Amazon, N11 ve diğer pazaryerlerini tek panelden yönetin. Stok, sipariş, fiyat ve kâr analizi.";

/** pathname → { title, description, noindex } */
export const SEO_BY_PATH = {
    "/": {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
    },
    "/home": {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
    },
    "/blog": {
        title: `Blog | ${BRAND_NAME} — Pazaryeri ve E-Ticaret Rehberleri`,
        description:
            "Trendyol, Hepsiburada, Amazon, N11 entegrasyonu, stok senkronizasyonu, kâr analizi ve e-ticaret ipuçları.",
    },
    "/login": {
        title: `Giriş | ${BRAND_NAME}`,
        description: `${BRAND_NAME} hesabınıza giriş yapın. Pazaryeri entegrasyon paneli.`,
    },
    "/register": {
        title: `Ücretsiz Kayıt | ${BRAND_NAME}`,
        description: `14 gün ücretsiz deneyin. ${DEFAULT_DESC}`,
    },
    "/verify-email": {
        title: `E-posta Doğrulama | ${BRAND_NAME}`,
        description: "Hesap doğrulama sayfası.",
        noindex: true,
    },
    "/privacy": {
        title: `Gizlilik Politikası | ${BRAND_NAME}`,
        description: `${BRAND_NAME} gizlilik politikası ve KVKK aydınlatma metni.`,
    },
    "/terms": {
        title: `Kullanım Şartları | ${BRAND_NAME}`,
        description: `${BRAND_NAME} kullanım şartları.`,
    },
    "/cookies": {
        title: `Çerez Politikası | ${BRAND_NAME}`,
        description: `${BRAND_NAME} çerez politikası.`,
    },
    "/distance-sales": {
        title: `Mesafeli Satış Sözleşmesi | ${BRAND_NAME}`,
        description: "Mesafeli satış ve cayma hakkı bilgileri.",
    },
    "/preliminary-info": {
        title: `Ön Bilgilendirme Formu | ${BRAND_NAME}`,
        description: "Ön bilgilendirme formu.",
    },
    "/trendyol-entegrasyonu": {
        title: `Trendyol Entegrasyonu | ${BRAND_NAME}`,
        description:
            "Trendyol API entegrasyonu, ürün yükleme, stok ve sipariş senkronizasyonu. Tek panelden Trendyol yönetimi.",
    },
    "/hepsiburada-entegrasyonu": {
        title: `Hepsiburada Entegrasyonu | ${BRAND_NAME}`,
        description:
            "Hepsiburada XML ve API entegrasyonu, kategori eşleme, stok ve fiyat senkronizasyonu.",
    },
    "/amazon-entegrasyonu": {
        title: `Amazon Türkiye Entegrasyonu | ${BRAND_NAME}`,
        description: "Amazon TR pazaryeri entegrasyonu, sipariş ve envanter yönetimi.",
    },
    "/n11-entegrasyonu": {
        title: `N11 Entegrasyonu | ${BRAND_NAME}`,
        description: "N11 mağaza entegrasyonu, ürün ve sipariş otomasyonu.",
    },
    "/ciceksepeti-entegrasyonu": {
        title: `ÇiçekSepeti Entegrasyonu | ${BRAND_NAME}`,
        description: "ÇiçekSepeti pazaryeri entegrasyonu ve çoklu kanal yönetimi.",
    },
    "/dashboard": {
        title: `Yönetim Paneli | ${BRAND_NAME}`,
        description: "Pazaryeri yönetim paneli.",
        noindex: true,
    },
};

export function getSeoForPath(pathname) {
    const base = SEO_BY_PATH[pathname] || {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
    };
    const canonical = `${APP_SITE_URL}${pathname === "/" ? "" : pathname}`;
    return { ...base, canonical };
}

export { DEFAULT_TITLE, DEFAULT_DESC };
