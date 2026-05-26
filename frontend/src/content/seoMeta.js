import { APP_SITE_URL } from "../constants/domain";
import { BRAND_NAME, formatBrandPageTitle } from "../constants/brand";

const DEFAULT_TITLE = `${BRAND_NAME} — Pazaryeri Entegrasyon ve E-Ticaret Yönetimi`;
const DEFAULT_DESC =
    "Dashtock ile Trendyol, Hepsiburada, Amazon, N11 ve diğer pazaryerlerini tek panelden yönetin. Stok, sipariş, fiyat ve kâr analizi.";

/** pathname → { title, description, noindex } */
export const SEO_BY_PATH = {
    "/": {
        title: formatBrandPageTitle("Giriş"),
        description: DEFAULT_DESC,
    },
    "/home": {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
    },
    "/blog": {
        title: formatBrandPageTitle("Blog"),
        description:
            "Trendyol, Hepsiburada, Amazon, N11 entegrasyonu, stok senkronizasyonu, kâr analizi ve e-ticaret ipuçları.",
    },
    "/login": {
        title: formatBrandPageTitle("Giriş"),
        description: `${BRAND_NAME} hesabınıza giriş yapın.`,
    },
    "/register": {
        title: formatBrandPageTitle("Kayıt"),
        description: `14 gün ücretsiz deneyin. ${DEFAULT_DESC}`,
    },
    "/verify-email": {
        title: formatBrandPageTitle("E-posta Doğrulama"),
        description: "Hesap doğrulama sayfası.",
        noindex: true,
    },
    "/privacy": {
        title: formatBrandPageTitle("Gizlilik Politikası"),
        description: `${BRAND_NAME} gizlilik politikası ve KVKK aydınlatma metni.`,
    },
    "/terms": {
        title: formatBrandPageTitle("Kullanım Şartları"),
        description: `${BRAND_NAME} kullanım şartları.`,
    },
    "/cookies": {
        title: formatBrandPageTitle("Çerez Politikası"),
        description: `${BRAND_NAME} çerez politikası.`,
    },
    "/distance-sales": {
        title: formatBrandPageTitle("Mesafeli Satış"),
        description: "Mesafeli satış ve cayma hakkı bilgileri.",
    },
    "/preliminary-info": {
        title: formatBrandPageTitle("Ön Bilgilendirme"),
        description: "Ön bilgilendirme formu.",
    },
    "/trendyol-entegrasyonu": {
        title: formatBrandPageTitle("Trendyol Entegrasyonu"),
        description:
            "Trendyol API entegrasyonu, ürün yükleme, stok ve sipariş senkronizasyonu.",
    },
    "/hepsiburada-entegrasyonu": {
        title: formatBrandPageTitle("Hepsiburada Entegrasyonu"),
        description:
            "Hepsiburada XML ve API entegrasyonu, kategori eşleme, stok ve fiyat senkronizasyonu.",
    },
    "/amazon-entegrasyonu": {
        title: formatBrandPageTitle("Amazon Entegrasyonu"),
        description: "Amazon TR pazaryeri entegrasyonu, sipariş ve envanter yönetimi.",
    },
    "/n11-entegrasyonu": {
        title: formatBrandPageTitle("N11 Entegrasyonu"),
        description: "N11 mağaza entegrasyonu, ürün ve sipariş otomasyonu.",
    },
    "/ciceksepeti-entegrasyonu": {
        title: formatBrandPageTitle("ÇiçekSepeti Entegrasyonu"),
        description: "ÇiçekSepeti pazaryeri entegrasyonu ve çoklu kanal yönetimi.",
    },
    "/dashboard": {
        title: formatBrandPageTitle("Yönetim Paneli"),
        description: DEFAULT_DESC,
        noindex: true,
    },
    "/marketplace-integration": {
        title: formatBrandPageTitle("Pazaryeri Entegrasyonu"),
        description: DEFAULT_DESC,
        noindex: true,
    },
    "/finance": {
        title: formatBrandPageTitle("Finans"),
        noindex: true,
    },
    "/product-management": {
        title: formatBrandPageTitle("Ürün Merkezi"),
        noindex: true,
    },
    "/product-upload": {
        title: formatBrandPageTitle("Ürün Yükle"),
        noindex: true,
    },
    "/radar-pro": {
        title: formatBrandPageTitle("Fırsat Radarı"),
        noindex: true,
    },
    "/roketfy": {
        title: formatBrandPageTitle("Ürün Araştırma"),
        noindex: true,
    },
    "/subscription": {
        title: formatBrandPageTitle("Abonelik"),
        noindex: true,
    },
    "/billing": {
        title: formatBrandPageTitle("Faturalama"),
        noindex: true,
    },
    "/journal": {
        title: formatBrandPageTitle("Operasyon Defteri"),
        noindex: true,
    },
    "/lysiabrain2": {
        title: formatBrandPageTitle("Dashtock AI"),
        noindex: true,
    },
};

const APP_PANEL_PREFIXES = [
    "/dashboard",
    "/finance",
    "/billing",
    "/product-management",
    "/product-upload",
    "/marketplace-integration",
    "/radar-pro",
    "/roketfy",
    "/subscription",
    "/journal",
    "/lysiabrain2",
    "/admin",
];

export function getSeoForPath(pathname) {
    const exact = SEO_BY_PATH[pathname];
    const isAppPanel = APP_PANEL_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    const base = exact || {
        title: isAppPanel ? formatBrandPageTitle("Yönetim Paneli") : DEFAULT_TITLE,
        description: DEFAULT_DESC,
        noindex: isAppPanel || pathname.startsWith("/admin"),
    };
    const canonical = `${APP_SITE_URL}${pathname === "/" ? "" : pathname}`;
    return { ...base, canonical };
}

export { DEFAULT_TITLE, DEFAULT_DESC, formatBrandPageTitle };
