/**
 * Ana sayfa blog — pazaryeri rehber içerikleri (SEO + bilgilendirme)
 */
export const MARKETPLACE_BLOG_SECTIONS = [
    {
        id: "trendyol",
        label: "Trendyol",
        color: "#f27a1a",
        title: "Trendyol ile E-Ticaret Yönetimi",
        intro:
            "Trendyol, Türkiye'nin en büyük pazaryerlerinden biridir. Doğru entegrasyon ile stok, fiyat ve siparişlerinizi otomatik senkronize edebilirsiniz.",
        topics: [
            {
                heading: "Trendyol API entegrasyonu nasıl yapılır?",
                body: "Satıcı panelinden API anahtarlarınızı alın, Dashtock'e bağlayın. Ürün listeleme, stok güncelleme ve sipariş çekme işlemleri tek panelden yönetilir.",
            },
            {
                heading: "Stok ve fiyat senkronizasyonu",
                body: "Çoklu kanalda satış yaparken stok çakışması en büyük risktir. Merkezi stok havuzu ile Trendyol ve diğer pazaryerlerinde anlık güncelleme sağlayın.",
            },
            {
                heading: "Komisyon ve kâr takibi",
                body: "Trendyol komisyon oranlarını ürün bazında tanımlayarak net kârınızı Gelişmiş Analiz modülünde görün.",
            },
        ],
        keywords: ["trendyol entegrasyonu", "trendyol api", "pazaryeri stok yönetimi"],
    },
    {
        id: "hepsiburada",
        label: "Hepsiburada",
        color: "#ff6000",
        title: "Hepsiburada Entegrasyon Rehberi",
        intro:
            "Hepsiburada'da ürün yüklemek için kategori eşleme ve XML/API süreçlerini doğru yönetmek gerekir.",
        topics: [
            {
                heading: "Hepsiburada XML ürün yükleme",
                body: "Toplu ürün aktarımında kategori ve marka eşleştirmesi kritiktir. Dashtock ile katalogdan HB'ye güvenli dağıtım yapın.",
            },
            {
                heading: "Sipariş ve kargo süreçleri",
                body: "Siparişler otomatik çekilir; kargo maliyetini ürün ekonomisine işleyerek gerçek kârı hesaplayın.",
            },
            {
                heading: "Kampanya dönemleri",
                body: "Yoğun dönemlerde fiyat ve stok güncelleme hızı satış kaybını önler. Zamanlanmış senkron kullanın.",
            },
        ],
        keywords: ["hepsiburada entegrasyonu", "hepsiburada xml", "e-ticaret otomasyonu"],
    },
    {
        id: "amazon",
        label: "Amazon TR",
        color: "#ff9900",
        title: "Amazon Türkiye Entegrasyonu",
        intro:
            "Amazon TR'de satış yapmak için envanter, buybox ve sipariş yönetimi disiplinli olmalıdır.",
        topics: [
            {
                heading: "Amazon Seller entegrasyonu",
                body: "MWS/SP-API bağlantısı ile sipariş ve stok verilerinizi panele alın. FBA ve FBM modellerine göre maliyet ayrımı yapın.",
            },
            {
                heading: "Çoklu pazaryeri stratejisi",
                body: "Amazon ile Trendyol, HB gibi kanalları aynı stok havuzunda yöneterek operasyon yükünü azaltın.",
            },
            {
                heading: "Raporlama",
                body: "Kanal bazlı ciro, komisyon ve iade oranlarını karşılaştırarak bütçe planlayın.",
            },
        ],
        keywords: ["amazon türkiye entegrasyonu", "amazon seller api", "çoklu pazaryeri"],
    },
    {
        id: "n11",
        label: "N11",
        color: "#7b2cbf",
        title: "N11 Mağaza Yönetimi",
        intro: "N11, esnek komisyon yapısı ve geniş kategori ağı ile öne çıkar.",
        topics: [
            {
                heading: "N11 API bağlantısı",
                body: "Mağaza API bilgilerinizi girerek ürün ve sipariş akışını otomatikleştirin.",
            },
            {
                heading: "Ürün varyantları",
                body: "Renk/beden varyantlarını doğru SKU ile eşleyin; stok sapmasını önleyin.",
            },
            {
                heading: "Müşteri memnuniyeti",
                body: "Hızlı kargo ve doğru stok bilgisi puanınızı yükseltir; iade oranını düşürür.",
            },
        ],
        keywords: ["n11 entegrasyonu", "n11 api", "pazaryeri yönetim paneli"],
    },
    {
        id: "ciceksepeti",
        label: "ÇiçekSepeti",
        color: "#e91e8c",
        title: "ÇiçekSepeti ve Niş Pazaryerleri",
        intro: "Sezonsal talep ve hızlı teslimat beklentisi yüksek kategorilerde stok doğruluğu şarttır.",
        topics: [
            {
                heading: "Sezonluk stok planlama",
                body: "Özel günler öncesi stok ve fiyatları toplu güncelleyin.",
            },
            {
                heading: "Tek panelden çok kanal",
                body: "ÇiçekSepeti siparişlerini diğer pazaryerleriyle aynı operasyon ekranında işleyin.",
            },
            {
                heading: "Kârlılık analizi",
                body: "Yüksek kargo maliyetli ürünlerde birim ekonomiyi ürün bazında izleyin.",
            },
        ],
        keywords: ["çiçeksepeti entegrasyonu", "e-ticaret yönetim sistemi"],
    },
    {
        id: "genel",
        label: "E-Ticaret İpuçları",
        color: "#0f766e",
        title: "Pazaryeri ve E-Ticaret Best Practice",
        intro:
            "Başarılı çoklu kanal satışı; doğru araç, veri ve süreç disiplini ister.",
        topics: [
            {
                heading: "Pazaryeri entegrasyonu seçerken",
                body: "API kapsamı, stok hızı, kâr raporu ve destek kalitesine bakın. Dashtock bu ihtiyaçlar için tasarlandı.",
            },
            {
                heading: "Stok senkronizasyonu",
                body: "Gerçek zamanlı veya dakikalık senkron, overselling riskini minimize eder.",
            },
            {
                heading: "E-ticaret otomasyonu",
                body: "Manuel Excel yerine otomatik sipariş, fiyat ve kargo kuralları ile ölçeklenin.",
            },
            {
                heading: "SEO ve marka",
                body: "Kendi domaininizde tutarlı marka (Dashtock) ve blog içerikleri organik trafik getirir.",
            },
        ],
        keywords: [
            "pazaryeri entegrasyonu",
            "e-ticaret yönetim paneli",
            "çoklu mağaza yönetimi",
            "stok senkronizasyonu",
        ],
    },
];
