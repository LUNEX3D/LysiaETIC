/**
 * Giriş sayfası varsayılan içerik — Dashtock özellikleri
 */
const partnerTemplates = require("./loginPartnerTemplates");

module.exports = {
    hero: {
        titleLine1: "Pazaryerinden faturaya,",
        titleLine2: "stoktan kargoya",
        titleEmphasis: "tek panel",
        description1: "Trendyol, Hepsiburada, Amazon, N11 ve Çiçeksepeti siparişlerinizi tek yerden yönetin.",
        description2: "Otomatik e-Arşiv, iade sonrası fatura iptali, gelişmiş analiz ve AI destekli araçlar.",
    },
    partners: {
        enabled: true,
        kicker: "Referanslarımız",
        title: "Bize güvenen iş ortaklarımız",
        subtitle: "Türkiye'nin önde gelen markaları Dashtock ile operasyonlarını yönetiyor",
        useTemplateWhenEmpty: true,
    },
    partnerTemplates,
    sections: {
        features: {
            badge: "Dashtock özellikleri",
            title: "E-ticaret operasyonunuzun",
            titleAccent: "tamamı burada",
            description:
                "Çoklu pazaryeri entegrasyonu, otomatik faturalandırma (Sovos / QNB), stok senkronu, iade yönetimi, finans ve AI analiz — ayrı ayrı araçlara ihtiyaç duymayın.",
            highlights: [
                {
                    icon: "🛒",
                    title: "Çoklu pazaryeri",
                    text: "Trendyol, Hepsiburada, Amazon, N11 ve Çiçeksepeti — sipariş, stok ve fiyat tek panelde.",
                    tags: ["Trendyol", "Hepsiburada", "Amazon", "N11"],
                },
                {
                    icon: "📄",
                    title: "Otomatik e-Arşiv & e-Fatura",
                    text: "Gecikmeli otomatik kesim, iade onayında fatura iptali, Sovos ve QNB entegrasyonu.",
                    tags: ["e-Arşiv", "Sovos", "QNB"],
                },
                {
                    icon: "📦",
                    title: "Stok & ürün merkezi",
                    text: "Toplu yükleme, varyant yönetimi, pazaryerleri arası otomatik stok senkronizasyonu.",
                    tags: ["Stok", "Toplu yükleme"],
                },
                {
                    icon: "🧠",
                    title: "Dashtock AI & Radar",
                    text: "Ürün açıklaması, SEO, fiyat önerisi ve pazaryeri fırsat analizi.",
                    tags: ["AI", "Radar"],
                },
                {
                    icon: "💰",
                    title: "Finans & analiz",
                    text: "Komisyon hesabı, KDV tahmini, gelir-gider ve pazaryeri kârlılık raporları.",
                    tags: ["Finans", "KDV"],
                },
                {
                    icon: "↩️",
                    title: "İade & operasyon",
                    text: "İade onayı sonrası otomatik fatura iptali, operasyon defteri ve bildirimler.",
                    tags: ["İade", "Otomasyon"],
                },
            ],
            ctaTitle: "14 gün ücretsiz deneyin",
            ctaText: "Kredi kartı gerekmez — tüm modüllere erişim.",
        },
        pricing: {
            badge: "Şeffaf fiyatlandırma",
            title: "İşletmenize uygun",
            titleAccent: "paketler",
            description: "Gizli ücret yok. İstediğiniz zaman yükseltin veya iptal edin. Tüm paketlerde 14 gün deneme.",
            note: "Güncel fiyatlar giriş ekranında PayTR planlarından çekilir.",
        },
        about: {
            badge: "Dashtock hakkında",
            title: "Türkiye odaklı",
            titleAccent: "e-ticaret altyapısı",
            description:
                "Dashtock, pazaryeri satıcılarının dağınık araçlar yerine tek platformda çalışması için tasarlandı. Otomatik faturalandırma, iade uyumu ve vergi analizi gibi yerel ihtiyaçlara özel çözümler sunar.",
            points: [
                "Türkiye pazaryerlerine tam entegrasyon",
                "KVKK uyumlu altyapı ve güvenli oturum",
                "Sovos / QNB resmi e-belge API entegrasyonu",
                "7/24 destek ve sürekli güncelleme",
            ],
        },
        contact: {
            badge: "İletişim",
            title: "Bize",
            titleAccent: "ulaşın",
            description: "Demo, entegrasyon veya iş birliği için ekibimizle iletişime geçin.",
            phone: "+905363989092",
            email: "destek@dashtock.com",
            address: "Türkiye / İstanbul / Ümraniye",
            workingHours: "Hafta içi 08:00 – 18:00",
            whatsapp: "+905363989092",
        },
    },
};
