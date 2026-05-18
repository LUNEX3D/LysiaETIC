/**
 * PazarYonet Blog — makale verisi (SEO + rehber içerik)
 */
import { MARKETPLACE_BLOG_SECTIONS } from "./marketplaceBlog";

export const BLOG_CATEGORIES = MARKETPLACE_BLOG_SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    description: s.intro,
}));

export const BLOG_ARTICLES = [
    {
        slug: "trendyol-api-entegrasyonu-nasil-yapilir",
        categoryId: "trendyol",
        title: "Trendyol API Entegrasyonu Nasıl Yapılır? Adım Adım Rehber",
        excerpt:
            "Trendyol satıcı panelinden API bilgilerinizi alıp PazarYonet'e bağlayarak ürün, stok ve siparişleri tek merkezden yönetin.",
        readTime: 9,
        date: "2025-11-12",
        tags: ["Trendyol", "API", "Entegrasyon"],
        integrationPath: "/trendyol-entegrasyonu",
        sections: [
            {
                type: "p",
                text: "Trendyol'da ölçeklenebilir satış için manuel panel işlemleri yeterli değildir. API entegrasyonu; stok güncellemesi, sipariş çekme, fiyat revizyonu ve raporlamayı otomatikleştirir. Bu rehberde Trendyol entegrasyonunu sıfırdan kurmanız için pratik adımları bulacaksınız.",
            },
            {
                type: "h2",
                text: "1. Trendyol satıcı API bilgilerini alın",
            },
            {
                type: "p",
                text: "Trendyol Satıcı Paneli → Entegrasyon / API bölümünden Supplier ID, API Key ve API Secret bilgilerinizi oluşturun. Bu bilgileri yalnızca güvenilir sistemlerde saklayın; ekip içi paylaşımda maskeleme kullanın.",
            },
            {
                type: "ul",
                items: [
                    "Supplier ID (tedarikçi numaranız)",
                    "API Key ve Secret çifti",
                    "Test ortamı varsa önce test anahtarı ile deneme",
                ],
            },
            {
                type: "h2",
                text: "2. PazarYonet'te mağazayı bağlayın",
            },
            {
                type: "p",
                text: "PazarYonet panelinde Pazaryeri Entegrasyonu menüsüne girin, Trendyol'u seçin ve API alanlarını kaydedin. Bağlantı testi başarılı olduğunda sipariş senkronu ve ürün eşleştirme adımlarına geçebilirsiniz.",
            },
            {
                type: "tip",
                text: "İlk kurulumda siparişleri son 7–30 gün ile sınırlı çekin; veri tabanınızı kontrollü doldurun.",
            },
            {
                type: "h2",
                text: "3. Ürün ve barkod eşleştirmesi",
            },
            {
                type: "p",
                text: "Her satır için barkod (veya merchant SKU) anahtar alanıdır. Katalog ürününüz ile Trendyol listesini eşleştirmeden stok güncellemesi yanlış ürüne gidebilir. Eşleşmeyen ürünleri rapor ekranından düzenli kontrol edin.",
            },
            {
                type: "h2",
                text: "4. Canlıya geçiş kontrol listesi",
            },
            {
                type: "ul",
                items: [
                    "Test siparişi ile stok düşümünü doğrulayın",
                    "Komisyon ve kargo maliyetlerini ürün kartına girin",
                    "İptal / iade siparişlerinin analize dahil edilip edilmediğini kontrol edin",
                    "Kritik stok eşiği uyarılarını açın",
                ],
            },
        ],
    },
    {
        slug: "trendyol-stok-ve-fiyat-senkronizasyonu",
        categoryId: "trendyol",
        title: "Trendyol Stok ve Fiyat Senkronizasyonu: Overselling'i Önleyin",
        excerpt:
            "Çoklu kanalda aynı stoğu satarken çakışmayı önlemek için merkezi stok havuzu ve senkron sıklığı ayarları.",
        readTime: 7,
        date: "2025-11-08",
        tags: ["Trendyol", "Stok", "Fiyat"],
        integrationPath: "/trendyol-entegrasyonu",
        sections: [
            {
                type: "p",
                text: "Trendyol'da stok 0 görünürken başka kanalda satış devam ediyorsa müşteri deneyimi zarar görür ve ceza puanları artar. Merkezi stok yönetimi bu riski azaltır.",
            },
            {
                type: "h2",
                text: "Merkezi stok mantığı",
            },
            {
                type: "p",
                text: "Gerçek stok tek kaynakta tutulur (ör. ana depo). Pazaryerlerine gönderilen miktar; rezerve siparişler ve güvenlik stoğu düşüldükten sonra hesaplanır.",
            },
            {
                type: "h2",
                text: "Fiyat senkronu",
            },
            {
                type: "p",
                text: "Kanal bazlı fiyat farkı (komisyon, kargo, kampanya) tanımlayın. Toplu zam/indirim dönemlerinde Excel yerine panelden kural bazlı güncelleme yapın.",
            },
            {
                type: "tip",
                text: "Kampanya öncesi senkron sıklığını artırın; yoğun saatlerde 5–15 dakikalık aralık idealdir.",
            },
        ],
    },
    {
        slug: "hepsiburada-xml-urun-yukleme-rehberi",
        categoryId: "hepsiburada",
        title: "Hepsiburada XML Ürün Yükleme ve Katalog Dağıtım Rehberi",
        excerpt:
            "Kategori, marka ve özellik eşlemesi ile Hepsiburada'ya toplu ürün aktarımında dikkat edilmesi gerekenler.",
        readTime: 10,
        date: "2025-10-28",
        tags: ["Hepsiburada", "XML", "Ürün"],
        integrationPath: "/hepsiburada-entegrasyonu",
        sections: [
            {
                type: "p",
                text: "Hepsiburada ürün açma süreci kategori ağacı ve zorunlu attribute alanlarına bağlıdır. Eksik alan gönderimi ürünlerin reddedilmesine neden olur.",
            },
            {
                type: "h2",
                text: "Kategori eşleme",
            },
            {
                type: "p",
                text: "Kendi kategori ağacınızı Hepsiburada kategori ID'leri ile eşleyin. Kampanya veya ürün dışı HB kategorilerinden kaçının; yalnızca satışa uygun yaprak kategorileri kullanın.",
            },
            {
                type: "h2",
                text: "XML / API ile toplu yükleme",
            },
            {
                type: "ul",
                items: [
                    "Barkod, marka, garanti süresi, KDV oranı zorunlu alanları doldurun",
                    "Görsel URL'lerinin HTTPS ve erişilebilir olduğundan emin olun",
                    "Varyantlı ürünlerde her varyant için ayrı SKU tanımlayın",
                ],
            },
            {
                type: "h2",
                text: "PazarYonet ile dağıtım",
            },
            {
                type: "p",
                text: "Merkez katalogunuzdan Hepsiburada kanalına dağıtım yaparken alan denetimi (field audit) ekranı eksik veya hatalı alanları önceden gösterir.",
            },
        ],
    },
    {
        slug: "hepsiburada-siparis-ve-kargo-yonetimi",
        categoryId: "hepsiburada",
        title: "Hepsiburada Sipariş ve Kargo Maliyeti Yönetimi",
        excerpt:
            "HB siparişlerini otomatik çekmek, kargo maliyetini kâr hesabına dahil etmek ve operasyonu hızlandırmak.",
        readTime: 6,
        date: "2025-10-20",
        tags: ["Hepsiburada", "Sipariş", "Kargo"],
        integrationPath: "/hepsiburada-entegrasyonu",
        sections: [
            {
                type: "p",
                text: "Siparişlerin gecikmeli işlenmesi Hepsiburada performans puanınızı düşürür. Otomatik sipariş akışı ve yazdırılabilir kargo etiketleri süreyi kısaltır.",
            },
            {
                type: "h2",
                text: "Kargo maliyetini ürün ekonomisine işleme",
            },
            {
                type: "p",
                text: "Sabit desi bazlı veya sipariş bazlı kargo maliyetini ürün veya sipariş kırılımında tanımlayın. Gelişmiş Analiz'de kanal bazlı net kârı görmek için bu adım zorunludur.",
            },
        ],
    },
    {
        slug: "amazon-turkiye-seller-entegrasyonu",
        categoryId: "amazon",
        title: "Amazon Türkiye Seller Entegrasyonu: SP-API ve Stok Yönetimi",
        excerpt:
            "Amazon TR'de satıcı hesabınızı bağlayıp envanter ve sipariş akışını tek panelde toplayın.",
        readTime: 8,
        date: "2025-10-15",
        tags: ["Amazon", "SP-API"],
        integrationPath: "/amazon-entegrasyonu",
        sections: [
            {
                type: "p",
                text: "Amazon Türkiye'de FBM (kendi depodan gönderim) veya FBA modellerinden birini veya her ikisini kullanabilirsiniz. Entegrasyon kurulumunda depo ve SKU yapınızı netleştirin.",
            },
            {
                type: "h2",
                text: "SP-API yetkilendirme",
            },
            {
                type: "p",
                text: "Seller Central üzerinden geliştirici uygulaması oluşturup LWA kimlik bilgilerini entegrasyon paneline girin. Yetki kapsamında sipariş ve envanter okuma/yazma izinlerinin açık olduğundan emin olun.",
            },
            {
                type: "h2",
                text: "Buybox ve rekabet",
            },
            {
                type: "p",
                text: "Aynı ASIN'de birden fazla satıcı varken fiyat ve teslimat süresi buybox kazanır. Stok doğruluğu ve iade oranı da sıralamayı etkiler.",
            },
        ],
    },
    {
        slug: "n11-api-ve-magaza-baglanti",
        categoryId: "n11",
        title: "N11 API Bağlantısı ve Mağaza Ayarları",
        excerpt:
            "N11 mağaza API anahtarlarınızı güvenle bağlayıp ürün listeleme ve sipariş süreçlerini otomatikleştirin.",
        readTime: 6,
        date: "2025-10-10",
        tags: ["N11", "API"],
        integrationPath: "/n11-entegrasyonu",
        sections: [
            {
                type: "p",
                text: "N11'de apiKey ve apiSecret ile mağazanıza programatik erişim sağlarsınız. İlk bağlantıda düşük limitli test çağrıları yapın.",
            },
            {
                type: "h2",
                text: "Varyant ve SKU disiplini",
            },
            {
                type: "p",
                text: "Renk/beden kombinasyonları için tutarlı SKU üretin. Pazaryerleri arası SKU eşlemesi yapılmazsa stok sapması kaçınılmaz olur.",
            },
        ],
    },
    {
        slug: "ciceksepeti-entegrasyon-ve-sezon-planlama",
        categoryId: "ciceksepeti",
        title: "ÇiçekSepeti Entegrasyonu ve Sezonluk Stok Planlama",
        excerpt:
            "Özel günler öncesi stok ve fiyat hazırlığı; ÇiçekSepeti siparişlerini diğer kanallarla birlikte yönetme.",
        readTime: 5,
        date: "2025-09-25",
        tags: ["ÇiçekSepeti", "Sezon"],
        integrationPath: "/ciceksepeti-entegrasyonu",
        sections: [
            {
                type: "p",
                text: "Sevgililer Günü, Anneler Günü gibi dönemlerde sipariş patlaması yaşanır. Önceden stok rezervi ve kargo anlaşması yapılmalıdır.",
            },
            {
                type: "tip",
                text: "Sezon öncesi 2–3 hafta kala test siparişi ve tam senkron döngüsü çalıştırın.",
            },
        ],
    },
    {
        slug: "pazaryeri-entegrasyonu-nedir",
        categoryId: "genel",
        title: "Pazaryeri Entegrasyonu Nedir? Satıcılar İçin Temel Rehber",
        excerpt:
            "Pazaryeri entegrasyonunun ne işe yaradığı, hangi süreçleri otomatikleştirdiği ve doğru yazılım seçimi.",
        readTime: 7,
        date: "2025-09-18",
        tags: ["Entegrasyon", "E-ticaret"],
        sections: [
            {
                type: "p",
                text: "Pazaryeri entegrasyonu; Trendyol, Hepsiburada, N11, Amazon gibi platformlardaki ürün, sipariş, stok ve fiyat verilerinin tek bir yazılım üzerinden yönetilmesidir.",
            },
            {
                type: "h2",
                text: "Manuel süreç vs entegrasyon",
            },
            {
                type: "ul",
                items: [
                    "Manuel: Her panelde ayrı giriş, Excel export, hata riski yüksek",
                    "Entegrasyon: Tek katalog, otomatik senkron, merkezi rapor",
                ],
            },
            {
                type: "h2",
                text: "Doğru panelde olması gerekenler",
            },
            {
                type: "ul",
                items: [
                    "Çoklu pazaryeri API desteği",
                    "Gerçek zamanlı veya zamanlanmış stok senkronu",
                    "Sipariş birleştirme ve kargo entegrasyonu",
                    "Komisyon, kargo ve maliyet ile kâr analizi",
                ],
            },
        ],
    },
    {
        slug: "coklu-pazaryeri-stok-yonetimi",
        categoryId: "genel",
        title: "Çoklu Pazaryeri Stok Yönetimi: Merkezi Havuz Modeli",
        excerpt:
            "Birden fazla kanalda overselling olmadan stok paylaştırma stratejileri ve güvenlik stoğu.",
        readTime: 8,
        date: "2025-09-10",
        tags: ["Stok", "Çoklu kanal"],
        sections: [
            {
                type: "p",
                text: "Aynı fiziksel ürün beş farklı pazaryerinde listelenebilir. Stok tek kaynaktan yönetilmezse iki kanalda aynı son ürün satılabilir.",
            },
            {
                type: "h2",
                text: "Güvenlik stoğu (buffer)",
            },
            {
                type: "p",
                text: "Pazaryerine gönderilen miktar = fiziksel stok − bekleyen siparişler − güvenlik stoğu. Buffer, senkron gecikmelerine karşı koruma sağlar.",
            },
            {
                type: "h2",
                text: "Senkron sıklığı",
            },
            {
                type: "p",
                text: "Dakikalık senkron yüksek hacimli satıcılar için uygundur. Düşük hacimde saatlik senkron yeterli olabilir; ancak kampanya dönemlerinde sıklığı artırın.",
            },
        ],
    },
    {
        slug: "pazaryeri-kar-zarar-analizi",
        categoryId: "genel",
        title: "Pazaryeri Kâr-Zarar Analizi: Komisyon ve Kargo Dahil Hesaplama",
        excerpt:
            "Ürün başına gerçek kârı görmek için maliyet, komisyon ve kargo kalemlerini nasıl gireceğiniz.",
        readTime: 6,
        date: "2025-08-28",
        tags: ["Kâr", "Analiz"],
        sections: [
            {
                type: "p",
                text: "Ciro yüksek görünüp net kârın düşük olması pazaryerlerinde sık görülür. Sebep: komisyon, kargo, iade ve ürün maliyetinin hesaba katılmaması.",
            },
            {
                type: "h2",
                text: "Formül",
            },
            {
                type: "p",
                text: "Net kâr ≈ Satış fiyatı − ürün maliyeti − pazaryeri komisyonu − kargo − paketleme − diğer giderler.",
            },
            {
                type: "tip",
                text: "PazarYonet Gelişmiş Analiz → Kar/Zarar sekmesinde ürün bazlı tabloyu kullanın; maliyet girilmemiş ürünleri önce tamamlayın.",
            },
        ],
    },
    {
        slug: "e-ticaret-otomasyonu-ipuclari",
        categoryId: "genel",
        title: "E-Ticaret Otomasyonu: 10 Pratik İpucu",
        excerpt:
            "Tekrarlayan işleri azaltarak operasyon ekibinin kapasitesini artırın.",
        readTime: 5,
        date: "2025-08-15",
        tags: ["Otomasyon", "Verimlilik"],
        sections: [
            {
                type: "ul",
                items: [
                    "Siparişleri otomatik içe aktarın, manuel CSV kullanmayın",
                    "Stok kurallarını merkezi tanımlayın",
                    "Kritik stok uyarılarını e-posta veya panele alın",
                    "Fiyat güncellemelerini toplu ve log'lu yapın",
                    "İade ve iptal siparişlerini analizden ayırın",
                    "Ürün maliyetlerini güncel tutun",
                    "Kargo desi tablosunu periyodik güncelleyin",
                    "Kampanya öncesi senkron sıklığını artırın",
                    "Pazaryeri bazlı performans raporu okuyun",
                    "Entegrasyon hata loglarını haftalık kontrol edin",
                ],
            },
        ],
    },
    {
        slug: "overselling-nasil-onlenir",
        categoryId: "genel",
        title: "Overselling Nasıl Önlenir? Stok Çakışması Çözümleri",
        excerpt:
            "Müşteriye stokta olmayan ürün satışının önüne geçmek için teknik ve operasyonel adımlar.",
        readTime: 6,
        date: "2025-08-01",
        tags: ["Stok", "Overselling"],
        sections: [
            {
                type: "p",
                text: "Overselling; iki müşterinin aynı son ürünü satın alması ve iptal/telafi süreçlerinin maliyetlidir. Pazaryeri puanınızı da düşürür.",
            },
            {
                type: "h2",
                text: "Teknik önlemler",
            },
            {
                type: "ul",
                items: [
                    "Merkezi stok havuzu",
                    "Sipariş anında stok düşümü",
                    "Güvenlik stoğu buffer'ı",
                    "Hızlı senkron (dakika bazlı)",
                    "Barkod/SKU eşleme denetimi",
                ],
            },
        ],
    },
];

export function getArticleBySlug(slug) {
    return BLOG_ARTICLES.find((a) => a.slug === slug) || null;
}

export function getArticlesByCategory(categoryId) {
    if (!categoryId || categoryId === "all") return BLOG_ARTICLES;
    return BLOG_ARTICLES.filter((a) => a.categoryId === categoryId);
}

export function getCategoryMeta(categoryId) {
    return BLOG_CATEGORIES.find((c) => c.id === categoryId) || null;
}

export function formatBlogDate(iso) {
    try {
        return new Date(iso).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    } catch {
        return iso;
    }
}
