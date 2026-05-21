/**
 * Varsayılan SaaS paket tanımları — tek kaynak (SSOT)
 * Admin Paket Yönetimi (SaasPlanManager) kataloğu ile uyumlu özellik metinleri.
 * Fiyatlandırma: TR pazaryeri entegrasyon araçlarına göre girişte ~%15–25 daha uygun konumlandırma.
 *
 * Yıllık fiyat = aylık × 10 (~%17 indirim, 2 ay bedava)
 */
const DEFAULT_PLAN_DEFINITIONS = {
    trial: {
        name: "Deneme",
        description: "14 gün ücretsiz — platformu tüm temel modüllerle test edin",
        badge: "",
        price: 0,
        monthlyPrice: 0,
        yearlyPrice: 0,
        duration: 14,
        limits: {
            maxProducts: 50,
            maxOrders: 150,
            maxMarketplaces: 1,
            maxApiCalls: 5000,
            maxUsers: 1
        },
        features: [
            "Dashboard erişimi",
            "Temel raporlama",
            "Temel ürün yönetimi",
            "Sipariş görüntüleme",
            "Sipariş durum takibi",
            "Trendyol entegrasyonu",
            "E-posta desteği"
        ]
    },
    basic: {
        name: "Giriş",
        description: "Küçük ve orta ölçekli satıcılar için — piyasadaki giriş paketlerine göre daha uygun fiyat",
        badge: "",
        price: 249,
        monthlyPrice: 249,
        yearlyPrice: 2490,
        duration: 30,
        limits: {
            maxProducts: 300,
            maxOrders: 2000,
            maxMarketplaces: 2,
            maxApiCalls: 25000,
            maxUsers: 2
        },
        features: [
            "Dashboard erişimi",
            "Temel raporlama",
            "Gelişmiş raporlama",
            "Excel/PDF dışa aktarım",
            "Temel ürün yönetimi",
            "Toplu ürün düzenleme",
            "Barkod/SKU yönetimi",
            "Sipariş görüntüleme",
            "Sipariş durum takibi",
            "Toplu sipariş aksiyonları",
            "Trendyol entegrasyonu",
            "Hepsiburada entegrasyonu",
            "N11 entegrasyonu",
            "Çoklu pazaryeri yönetimi",
            "Kargo takibi",
            "E-posta desteği",
            "Rol bazlı yetkilendirme"
        ]
    },
    pro: {
        name: "Profesyonel",
        description: "Büyüyen markalar için AI, tüm pazaryerleri ve gelişmiş otomasyon — orta segment rakiplerin altında",
        badge: "EN POPÜLER",
        price: 699,
        monthlyPrice: 699,
        yearlyPrice: 6990,
        duration: 30,
        limits: {
            maxProducts: 3000,
            maxOrders: 25000,
            maxMarketplaces: 6,
            maxApiCalls: 300000,
            maxUsers: 8
        },
        features: [
            "Dashboard erişimi",
            "Gerçek zamanlı metrikler",
            "Gelişmiş raporlama",
            "Kâr/zarar analizi",
            "Excel/PDF dışa aktarım",
            "Temel ürün yönetimi",
            "Toplu ürün düzenleme",
            "Varyant yönetimi",
            "Ürün performans takibi",
            "Sipariş görüntüleme",
            "Sipariş durum takibi",
            "Toplu sipariş aksiyonları",
            "İade/iptal yönetimi",
            "Sipariş bildirimleri",
            "Trendyol entegrasyonu",
            "Hepsiburada entegrasyonu",
            "N11 entegrasyonu",
            "Amazon entegrasyonu",
            "ÇiçekSepeti entegrasyonu",
            "Çoklu pazaryeri yönetimi",
            "Webhook desteği",
            "AI Asistan (Dashtock AI)",
            "AI destekli analiz",
            "AI fiyat önerileri",
            "AI radar fırsat taraması",
            "Otomatik sipariş önerileri",
            "Kargo takibi",
            "Çoklu kargo firması desteği",
            "Kargo maliyet analizi",
            "E-fatura entegrasyonu",
            "Finans dashboard",
            "Öncelikli destek",
            "Canlı chat desteği",
            "API key yönetimi",
            "Aktivite logları"
        ]
    },
    enterprise: {
        name: "Kurumsal",
        description: "Yüksek hacimli operasyonlar — sınırsız kapasite, SLA ve özel entegrasyon (kurumsal rakip fiyatların altında)",
        badge: "KURUMSAL",
        price: 1699,
        monthlyPrice: 1699,
        yearlyPrice: 16990,
        duration: 30,
        limits: {
            maxProducts: 999999,
            maxOrders: 999999,
            maxMarketplaces: 999,
            maxApiCalls: 9999999,
            maxUsers: 999
        },
        features: [
            "Dashboard erişimi",
            "Gerçek zamanlı metrikler",
            "Gelişmiş raporlama",
            "Kâr/zarar analizi",
            "Excel/PDF dışa aktarım",
            "Temel ürün yönetimi",
            "Toplu ürün düzenleme",
            "Varyant yönetimi",
            "Ürün performans takibi",
            "Sipariş görüntüleme",
            "Sipariş durum takibi",
            "Toplu sipariş aksiyonları",
            "İade/iptal yönetimi",
            "Sipariş bildirimleri",
            "Trendyol entegrasyonu",
            "Hepsiburada entegrasyonu",
            "N11 entegrasyonu",
            "Amazon entegrasyonu",
            "ÇiçekSepeti entegrasyonu",
            "Çoklu pazaryeri yönetimi",
            "Webhook desteği",
            "AI Asistan (Dashtock AI)",
            "AI destekli analiz",
            "AI fiyat önerileri",
            "AI stok tahmini",
            "AI radar fırsat taraması",
            "Otomatik sipariş önerileri",
            "Kargo takibi",
            "Çoklu kargo firması desteği",
            "Kargo maliyet analizi",
            "Teslimat performans raporu",
            "E-fatura entegrasyonu",
            "Otomatik faturalama",
            "Gelir/gider takibi",
            "Finans dashboard",
            "İki faktörlü doğrulama (2FA)",
            "Rol bazlı yetkilendirme",
            "API key yönetimi",
            "Aktivite logları",
            "7/24 destek",
            "SLA garantisi",
            "Özel entegrasyonlar",
            "White-label seçeneği",
            "Özel domain desteği",
            "Sınırsız ürün/sipariş",
            "Sınırsız kullanıcı",
            "Beta özelliklere erken erişim"
        ]
    }
};

/** Abonelik oluştururken plan limiti yedekleri */
const PLAN_LIMITS_BY_KEY = Object.fromEntries(
    Object.entries(DEFAULT_PLAN_DEFINITIONS).map(([key, plan]) => [key, plan.limits])
);

module.exports = {
    DEFAULT_PLAN_DEFINITIONS,
    PLAN_LIMITS_BY_KEY
};
