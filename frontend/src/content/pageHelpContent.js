/**
 * Sayfa yardım metinleri — PageHelpButton / PageHelpProvider
 * pageId: panel veya alt sekme anahtarı
 */

const PM_VARIANTS = {
    title: "Varyant grupları",
    intro: "Aynı ürün modelinin renk/beden satırlarını tek aile altında toplar. Trendyol'da ortak model kodu (productMainId) ile tek ürün sayfasında görünürler.",
    steps: [
        "Yeni grup oluşturun; grup adı ve Trendyol model kodunu girin.",
        "Grupsuz ürünleri seçerek gruba ekleyin (veya sonra Düzenle → Ürün ekle).",
        "Kaydet ve üyelere uygula: model kodu tüm üyelerin ürün kaydına yazılır.",
        "Gruptakilere dağıt: üyeler seçilir, pazaryeri seçerek toplu gönderim yapılır.",
        "Ürünler sekmesinde grup rozeti görünür; tıklayınca bu gruba dönersiniz.",
    ],
    tips: [
        "Her satırın kendi barkodu ve stok kodu kalır; sadece model kodu ortaktır.",
        "Uyarı kutusu görürseniz «Tüm üyelere uygula» ile hizalayın.",
        "Bir ürün aynı anda yalnızca bir grupta olabilir (en fazla 80 üye).",
    ],
};

export const pageHelpContent = {
    default: {
        title: "Panel yardımı",
        intro: "Sol menüden bölüm seçin. Sağ üstteki (i) simgesine her zaman tıklayarak o sayfanın kullanımını okuyabilirsiniz.",
        steps: ["Menüden istediğiniz modüle geçin.", "Üst bildirimler ve hızlı işlemler ana sayfada toplanır."],
        tips: ["Sorun yaşarsanız Destek veya Operasyon Defteri bölümünü kullanın."],
    },
    dashboard: {
        title: "Ana sayfa",
        intro: "Günlük özet: siparişler, stok uyarıları, kanal geliri ve hızlı kısayollar.",
        steps: [
            "Kartlara tıklayarak ilgili bölüme (sipariş, stok vb.) gidin.",
            "Bildirim zilinden sipariş ve sistem uyarılarını takip edin.",
            "Hızlı işlemler ile sık kullandığınız sayfalara geçin.",
        ],
    },
    integration: {
        title: "Pazaryeri entegrasyonları",
        intro: "Trendyol, Hepsiburada, N11 ve diğer kanalları bağlayın veya API bilgilerini güncelleyin.",
        steps: [
            "Entegrasyon ekleyin veya mevcut satırı düzenleyin.",
            "API anahtarlarını kaydettikten sonra bağlantı testini çalıştırın.",
            "Aktif entegrasyonlar ürün ve sipariş senkronunda kullanılır.",
        ],
    },
    orders: {
        title: "Siparişler",
        intro: "Tüm kanallardan gelen siparişleri listeleyin, filtreleyin ve durum güncelleyin.",
        steps: [
            "Üstten pazaryeri veya durum filtresi seçin.",
            "Satıra tıklayarak sipariş detayını açın.",
            "Toplu işlemler için satırları işaretleyin.",
        ],
    },
    inventory: {
        title: "Stok yönetimi",
        intro: "Merkezi stok miktarlarını görün ve pazaryerlerine senkron edin.",
        steps: [
            "Stok değerini düzenleyip kaydedin.",
            "Senkron ile tüm aktif kanallara gönderin.",
            "Düşük stok / tükenen ürünleri filtreleyin.",
        ],
    },
    finance: {
        title: "Finans",
        intro: "Kanal bazlı gelir, komisyon ve özet finansal görünüm.",
        steps: ["Pazaryeri seçin.", "Tarih aralığı ve özet kartları inceleyin."],
    },
    "cargo-tracking": {
        title: "Kargo takibi",
        intro: "Kargodaki siparişleri ve takip numaralarını izleyin.",
        steps: ["Liste veya arama ile sipariş bulun.", "Takip bilgisini kontrol edin."],
    },
    "pm-center": {
        title: "Ürün yönetim merkezi",
        intro: "Ürün listesi, yükleme, varyant aileleri, fiyat/stok ve dağıtım burada yapılır.",
        steps: [
            "Üst sekmelerden işleminize uygun bölümü seçin.",
            "Ürünler: arama, seçim, toplu dağıtım ve detay.",
            "Ürünleri Yükle: mevcut ürünü platforma gönderme.",
            "Varyant grupları: aynı modelin renk/beden satırları.",
        ],
    },
    "pm-center.products": {
        title: "Ürünler",
        intro: "Tüm master ürün kayıtları; arama, seçim, Excel ve toplu dağıtım.",
        steps: [
            "Ara: ad, barkod veya SKU ile bulun.",
            "Satırı işaretleyip Dağıt ile seçili pazaryerlerine gönderin.",
            "Varyant grubu rozeti varsa gruba hızlı geçiş yapın.",
            "Detay (göz) ile tek ürün düzenleme ve platform gönderimi.",
        ],
    },
    "pm-center.newProduct": {
        title: "Yeni ürün ve dağıt",
        intro: "4 adımlı sihirbaz: temel bilgiler → görseller → ön izleme → kategori ve gönderim.",
        steps: [
            "Üstteki adım kutularına tıklayarak ilerleyin veya İleri/Geri kullanın.",
            "Tek ürün veya varyantlı aile seçin; TY için https görsel URL şart.",
            "3. adımda hedef pazaryerlerini işaretleyin.",
            "4. adımda her platform için kategori seçip Oluştur & Dağıt deyin.",
        ],
        tips: ["Kayıtlı ürünü yüklemek için Ürünleri Yükle sekmesini kullanın."],
    },
    "pm-center.uploadMp": {
        title: "Ürünleri yükle",
        intro: "Zaten kayıtlı ürünleri henüz listelenmemiş pazaryerlere gönderin.",
        steps: [
            "Ürün seçin → Gönder → pazaryeri seçin.",
            "Kategori arama veya ağaçtan yaprak kategori seçin.",
            "Hepsiburada için listelenebilir katalog kategorisi şarttır.",
        ],
    },
    "pm-center.variants": PM_VARIANTS,
    "pm-center.pricestock": {
        title: "Fiyat ve stok",
        intro: "Toplu fiyat/stok güncelleme ve senkron.",
        steps: ["Ürünleri filtreleyin.", "Değerleri düzenleyin.", "Kaydet veya senkron gönderin."],
    },
    "pm-center.channel-prices": {
        title: "Kanal fiyatları",
        intro: "Pazaryeri bazında satış ve liste fiyatlarını karşılaştırıp düzenleyin.",
        steps: ["Ürün satırında kanal fiyatlarını girin.", "Kaydet ile master veya kanala yazın."],
    },
    "pm-center.bulk": {
        title: "Toplu işlemler",
        intro: "Çok sayıda üründe toplu fiyat, stok, silme veya dağıtım.",
        steps: ["Ürünleri işaretleyin.", "İşlem türünü seçin.", "Onaylayın ve sonucu kontrol edin."],
    },
    "pm-center.fieldAudit": {
        title: "Alan denetimi",
        intro: "Barkod, SKU, model kodu gibi alanlarda master ile platform farklarını görün.",
        steps: [
            "Uyumsuz satırı açın.",
            "Platform değerini master'a veya tersini uygulayın.",
        ],
    },
    "pm-center.sync": {
        title: "Senkron logları",
        intro: "Stok, fiyat ve ürün senkron geçmişi.",
        steps: ["Tarih ve duruma göre filtreleyin.", "Hata satırında mesajı okuyun."],
    },
    "product-upload": {
        title: "Ürün yükleme",
        intro: "Yeni ürün oluşturma sihirbazı (Ürün Merkezi ile aynı akış).",
        steps: ["Sihirbaz adımlarını tamamlayın.", "Kategori ve pazaryeri seçerek bitirin."],
    },
    "category-center": {
        title: "Kategori merkezi",
        intro: "Master kategoriler ile pazaryeri kategori eşleştirmesi.",
        steps: [
            "Ağaçtan veya aramadan platform kategorisi bulun.",
            "Master kategori ile eşleştirin.",
            "Ürün dağıtımında bu eşleşme kullanılır.",
        ],
    },
    "advanced-analytics": {
        title: "Gelişmiş analitik",
        intro: "Satış, kanal ve performans grafikleri.",
        steps: ["Dönem seçin.", "Grafik ve tabloları inceleyin.", "Dışa aktarma varsa kullanın."],
    },
    "lysia-brain": {
        title: "Dashtock AI",
        intro: "Yapay zeka önerileri, risk ve fırsat analizi.",
        steps: ["Sekmeler arasında gezin.", "Önerilen aksiyonları okuyun ve uygulayın."],
    },
    roketfy: {
        title: "Roketfy",
        intro: "Reklam ve büyüme araçları paneli.",
        steps: ["Modül içi yönlendirmeleri takip edin."],
    },
    "radar-pro": {
        title: "Radar Pro",
        intro: "Rakip ve pazar izleme.",
        steps: ["Takip listesi ve uyarıları kontrol edin."],
    },
    users: {
        title: "Kullanıcı yönetimi",
        intro: "Hesap kullanıcıları ve yetkiler (varsa).",
        steps: ["Kullanıcı ekleyin veya düzenleyin.", "Rolleri atayın."],
    },
    billing: {
        title: "Faturalama",
        intro: "Fatura geçmişi ve ödeme bilgileri.",
        steps: ["Faturaları görüntüleyin.", "Ödeme yöntemini güncelleyin."],
    },
    subscription: {
        title: "Abonelik ve paket",
        intro: "Plan seçimi, yenileme ve limitler.",
        steps: ["Mevcut planı görün.", "Yükseltme veya yenileme yapın."],
    },
    "error-center": {
        title: "Operasyon defteri",
        intro: "Sistem ve entegrasyon hatalarının kaydı.",
        steps: ["Kayıtları filtreleyin.", "Detay okuyup gerekirse destek açın."],
    },
    support: {
        title: "Destek",
        intro: "Destek talebi oluşturma ve takip.",
        steps: ["Yeni talep açın.", "Mesajlaşma ile güncellemeleri izleyin."],
    },
    settings: {
        title: "Ayarlar",
        intro: "Hesap, bildirim ve uygulama tercihleri.",
        steps: ["Sekmeleri gezin.", "Değişiklikleri kaydedin."],
    },
    "admin-panel": {
        title: "Admin paneli",
        intro: "Yönetici araçları (yalnızca yetkili kullanıcılar).",
        steps: ["Modül kartından ilgili yönetim sayfasına gidin."],
    },
    /** Grup düzenle modalı — ek bağlam */
    "pm-variants.editModal": {
        title: "Grup düzenle — alanlar",
        intro: "Bu pencerede grubun meta bilgilerini ve üye listesini yönetirsiniz.",
        steps: [
            "Grup adı: panelde gördüğünüz aile adı.",
            "Trendyol model kodu: tüm varyantlarda aynı productMainId.",
            "Kaydet ve üyelere uygula: kodu her üyenin ürün kaydına yazar.",
            "Tüm üyelere uygula / Sadece boş olanlara: kaydetmeden sadece kod senkronu.",
            "Gruptakilere dağıt: üyeleri seçip toplu pazaryeri dağıtımı açar.",
            "Çıkar: ürünü gruptan ayırır (ürün silinmez).",
        ],
        tips: ["Sarı uyarı: bazı üyelerde kod hâlâ farklı veya boş."],
    },
    "ec-products-definitions-variant-types": {
        title: "Varyant Türleri",
        intro:
            "Varyant Türleri, ürünlerinize renk, beden, boyut gibi seçenekler eklemenizi sağlar. Varyant türlerini doğrudan bu alandan oluşturabilir veya mevcut olanları düzenleyebilirsiniz.",
        introExtra:
            "Ayrıca yeni ürün eklerken ya da dosya ile toplu ürün yüklerken de ihtiyaç duyduğunuz varyant türlerini oluşturabilirsiniz.",
        toc: [
            { id: "create", label: "Yeni Varyant Oluşturma" },
            { id: "product", label: "Ürüne Varyant Tanımlama" },
        ],
        sections: [
            {
                id: "create",
                title: "Yeni Varyant Oluşturma",
                paragraphs: [
                    "Varyant türü eklemek için Ürünler → Tanımlamalar → Varyant Türleri alanına gidin.",
                    "Sağ üstteki Varyant Türü Ekle butonuna tıklayın. Liste boşsa ortadaki butonu da kullanabilirsiniz.",
                ],
                steps: [
                    "Varyant Türü Adı: Beden, Renk, Ayakkabı Numarası gibi isimler verin. Bu isim ürün sayfasında görünür.",
                    "Seçim Stili — Liste: Renk/görsel gerekmeyen seçenekler (beden, hafıza vb.).",
                    "Seçim Stili — Renk/Görsel: Renk kareleri veya küçük görsellerle gösterilecek seçenekler.",
                    "Varyantlar: ENTER ile değer ekleyin (S, M, L veya Siyah, Beyaz). Virgülle ayrılmış listeyi yapıştırabilirsiniz.",
                    "Renk/Görsel modunda her değerin rengini veya görselini kalem ikonundan düzenleyin.",
                    "Kaydet ile varyant türünü kaydedin.",
                ],
            },
            {
                id: "product",
                title: "Ürüne Varyant Tanımlama",
                paragraphs: [
                    "Ürünler → Ürünler alanından varyantlı ürün seçin veya yeni varyantlı ürün oluşturun.",
                    "Ürün detayındaki Varyant bölümünden Varyant Ekle butonuna tıklayın.",
                ],
                steps: [
                    "Varyant Türü Adı alanına daha önce oluşturduğunuz bir türü yazın; listeden seçerek tekrar kullanın.",
                    "Tür daha önce yoksa Varyantlar alanına değerleri ekleyerek yeni tür oluşturabilirsiniz.",
                    "Bir değeri yalnızca o üründen kaldırabilirsiniz; diğer ürünler etkilenmez.",
                ],
            },
        ],
        tips: [
            "Tür veya değeri kalıcı silmek/düzenlemek için Tanımlamalar → Varyant Türleri alanını kullanın; bu değişiklik aynı türü kullanan tüm ürünleri etkiler.",
            "Tabloda satıra tıklayarak mevcut türü düzenleyebilirsiniz.",
        ],
    },
    "ec-products-definitions-product-groups": {
        title: "Ürün Grupları",
        intro:
            "Ürün grupları, ürünlerinizi tek bir detay sayfasında varyant benzeri bir görünümle sunmanıza olanak tanır. Varyantlardan farklı olarak her ürün kendi slug, meta bilgileri, açıklama ve görselleriyle ayrı yapılandırılabilir.",
        introExtra:
            "Normal varyant yapısında SEO alanları ortak olur; ürün grupları ile her ürün için farklı içerik ve SEO yönetebilirsiniz.",
        toc: [
            { id: "where", label: "Nerelerde Kullanılır?" },
            { id: "manual", label: "Manuel Ürün Grubu" },
            { id: "auto", label: "Otomatik Ürün Grubu" },
        ],
        sections: [
            {
                id: "where",
                title: "Ürün Grupları Nerelerde Kullanılabilir?",
                steps: [
                    "Farklı ürün modellerini tek sayfada varyant görünümünde sunmak istediğinizde",
                    "Her ürün için farklı açıklama ve içerik girmek istediğinizde",
                    "Her ürünün SEO bilgilerini (slug, meta title, meta description) ayrı yönetmek istediğinizde",
                    "Varyant görünümünü bozmadan ürünleri kategori sayfalarında ayrı listelemek istediğinizde",
                    "Varyantlara özel kişiselleştirme veya özellikler eklemek istediğinizde",
                ],
            },
            {
                id: "manual",
                title: "Manuel Ürün Grubu Ekleme",
                paragraphs: [
                    "Ürünler → Tanımlamalar → Ürün Grupları → Ürün Grubu Ekle → Manuel Ekle yolunu izleyin.",
                ],
                steps: [
                    "Temel Bilgiler: Yalnızca sizin göreceğiniz grup adını girin.",
                    "Ürün Grubu Türü: Renk, Beden gibi seçenek başlıklarını yazıp Enter ile ekleyin (en fazla 3).",
                    "Ürün Ekle ile basit ürünlerinizi gruba dahil edin.",
                    "Her ürün için tür sütunlarına değer girin (Kırmızı, M, 250gr vb.).",
                    "Sıra numarası veya ok düğmeleri ile gösterim sırasını belirleyin.",
                    "Kaydet ile grubu oluşturun.",
                ],
            },
            {
                id: "auto",
                title: "Otomatik Ürün Grubu Ekleme",
                paragraphs: [
                    "Önce ürünlerinize Yazı türünde özel alan ekleyin ve gruplanacak ürünlere aynı değeri yazın.",
                    "Alternatif olarak tek varyant tanımlayarak da gruplama yapabilirsiniz.",
                ],
                steps: [
                    "Ürün Grubu Ekle → Otomatik Ekle seçin.",
                    "Temel Bilgiler: Yönetim adını girin.",
                    "Gruplama Koşulu: Aynı değere sahip ürünleri birleştirecek özel alanı seçin.",
                    "Varyanta Göre Grupla: Ürünlerdeki varyant bilgisi seçenek başlığı olur.",
                    "Özel Alana Göre Grupla: Tür olarak gösterilecek özel alanı seçin.",
                    "Kaydettiğinizde eşleşen ürünler otomatik gruplanır.",
                ],
            },
        ],
        tips: [
            "Otomatik gruplama için özel alan türü Yazı olmalıdır.",
            "Manuel gruplarda yalnızca basit ürünler eklenebilir; her ürün kendi detay sayfasına sahip olmalıdır.",
        ],
    },
};

/** panel id → yardım anahtarı */
export function resolveHelpPageId(rawId) {
    if (!rawId) return "default";
    const id = String(rawId).trim();
    if (pageHelpContent[id]) return id;

    if (id.startsWith("pm-center.")) return id;
    if (id === "pm-center" || id === "product-upload") return id;
    if (id.startsWith("ec-products-definitions-")) return id;
    if (id.startsWith("ec-category-")) return "ec-products-definitions-categories";
    if (id.startsWith("ec-brand-")) return "ec-products-definitions-brands";
    if (id.startsWith("ec-product-group-")) return "ec-products-definitions-product-groups";
    if (id.startsWith("orders")) return "orders";
    if (id.startsWith("finance")) return "finance";
    if (id.startsWith("integration")) return "integration";

    return "default";
}

export function getPageHelp(pageId) {
    const key = resolveHelpPageId(pageId);
    return pageHelpContent[key] || pageHelpContent.default;
}
