/**
 * Dashtock Radar — sekme bazlı kullanıcı rehberi metinleri
 */

export const RADAR_TAB_GUIDES = {
    opportunities: {
        title: "Fırsat Radarı",
        icon: "crosshairs",
        summary:
            "Mağazanızdaki ürünler, kategoriler ve pazar verilerine göre AI’nın önerdiği anahtar kelime ve niş fırsatlarını skorlu kartlar halinde listeler.",
        purpose: [
            "Hangi kelimelerde veya kategorilerde yeni ürün eklemenin mantıklı olduğunu önceden görmenizi sağlar.",
            "Trend, talep, rekabet ve kâr potansiyelini tek bakışta karşılaştırmanıza yardım eder.",
            "Ürün Keşfi sekmesindeki örnek ürünlerin hangi fırsattan geldiğini bu listeden takip edersiniz.",
        ],
        actions: [
            { label: "Yeni analiz", desc: "Kataloğunuzu ve güncel pazar verilerini tarar; listeyi yeniler (birkaç dakika sürebilir)." },
            { label: "Filtre chip’leri", desc: "Listeyi yeniden yüklemeden sıralar: en iyi skor, güncellik, trend, kâr veya rekabet." },
            { label: "Kelimeye tıklama", desc: "Trend & Veri’den veya kart üzerinden gelen kelimeyle listeyi daraltır." },
            { label: "Simülasyon", desc: "Tahmini satış fiyatı, maliyet ve kâr senaryosunu hızlıca hesaplar." },
            { label: "Kaldır", desc: "İlgisiz fırsatı listenizden çıkarır; bir sonraki analizde önceliği düşer." },
        ],
        dataFields: [
            { term: "Toplam skor (0–100)", desc: "Trend, talep, rekabet, kâr ve mağaza uyumunun birleşik notu. 75+ güçlü fırsat sayılır." },
            { term: "Trend / Talep / Rekabet / Kâr / Uyum", desc: "Her boyut 0–100 arası. Trend: arama ilgisi; Talep: satış potansiyeli; Rekabet: pazardaki yoğunluk; Kâr: marj tahmini; Uyum: mevcut kataloğunuzla örtüşme." },
            { term: "Genişleme tipi", desc: "Aynı kategori, yakın kategori, trend veya tamamen yeni kategori önerisi — risk ve yatırım seviyesini gösterir." },
            { term: "Ort. fiyat & satıcı sayısı", desc: "Pazaryerindeki örneklem verisi; fiyat bandını ve rekabet yoğunluğunu anlamanıza yarar." },
            { term: "Kâr marjı %", desc: "Tahmini alış–satış farkı; kesin değil, karşılaştırma için kullanın." },
            { term: "AI analizi", desc: "Özet yorum, avantajlar ve riskler; nihai karar için tek başına yeterli değildir, skorlarla birlikte okuyun." },
        ],
        note: "Liste varsayılan olarak veritabanındaki son analizi gösterir. En taze sonuç için üstteki «Yeni analiz» düğmesini kullanın.",
    },

    products: {
        title: "Ürün Keşfi",
        icon: "box",
        summary:
            "Fırsat Radarı’nda yüksek skor alan anahtar kelimeler için pazaryerinden çekilen örnek ürünleri gösterir — fikri somut ürünle eşleştirmenize yardım eder.",
        purpose: [
            "Bir fırsat kelimesinde gerçekten ne satıldığını (fiyat, görsel, satıcı, puan) görmenizi sağlar.",
            "Ürün eklemeden önce pazarın fiyat aralığını ve kalite beklentisini kontrol etmenize yardım eder.",
            "Fırsat skorunu gerçek listelemelerle doğrulamanıza olanak tanır.",
        ],
        actions: [
            { label: "Sırala chip’leri", desc: "Fırsat skoru, tahmini kâr, fiyat veya müşteri puanına göre listeyi anında sıralar." },
            { label: "Mağazama Ekle / bağlantı", desc: "Ürünü incelemek için pazaryeri sayfasını açar; aksiyon kaydı fırsat takibine işlenir." },
            { label: "İlk yükleme", desc: "Bu sekme ilk açılışta veri çeker; sonraki geçişlerde önbellekten hızlı açılır." },
        ],
        dataFields: [
            { term: "Fırsat skoru", desc: "İlgili anahtar kelimenin Fırsat Radarı kartındaki toplam skorunun ürünle ilişkisi." },
            { term: "Fiyat & puan", desc: "Pazaryerindeki güncel liste fiyatı ve müşteri değerlendirmesi; rekabetçi konumlandırma için referans." },
            { term: "Tahmini kâr / marj %", desc: "Fırsat motorunun ürün fiyatına göre hesapladığı kabaca marj; tedarik maliyetinize göre yeniden değerlendirin." },
            { term: "Anahtar kelime etiketi", desc: "Ürünün hangi fırsat taramasından geldiğini gösterir; Fırsat Radarı’nda aynı kelimeyi arayabilirsiniz." },
            { term: "Mini skorlar (Trend, Talep…)", desc: "Ürün düzeyinde özet; detaylı skorlar ana fırsat kartında yer alır." },
        ],
        note: "Örnek ürün sayısı sınırlıdır; tüm pazarı temsil etmez. Karar vermeden önce birkaç rakip listelemeyi manuel kontrol edin.",
    },

    insights: {
        title: "Trend & Veri",
        icon: "chart",
        summary:
            "Radar’ın beslendiği dış kaynakların özeti: Google trendleri, yükselen kelimeler, arbitraj sinyalleri ve entegrasyon durumu.",
        purpose: [
            "Fırsat listesinin hangi verilerle üretildiğini şeffaf şekilde görmenizi sağlar.",
            "Genel pazar nabzını (arama trendi, popüler kelimeler) mağaza özel fırsatlarla birleştirmenize yardım eder.",
            "Amazon ↔ Trendyol gibi platformlar arası fiyat farkı ipuçlarını tek yerde toplar.",
        ],
        actions: [
            { label: "Kelime / trend satırına tıklama", desc: "Seçilen kelimeyle Fırsat Radarı sekmesine geçer ve listeyi filtreler." },
            { label: "Yenile", desc: "İstatistik ve trend panellerini günceller (2 dakika önbellek vardır)." },
            { label: "Fırsat taramasına git", desc: "Ana fırsat listesine döner; ağır analiz başlatmaz." },
        ],
        dataFields: [
            { term: "Aktif fırsat", desc: "Hesabınızda şu an geçerli, süresi dolmamış fırsat kayıt sayısı." },
            { term: "Ortalama skor", desc: "Tüm aktif fırsatların toplam skor ortalaması; genel kalite göstergesi." },
            { term: "Google Trends", desc: "SerpAPI üzerinden alınan arama ilgisi; yüksek değer = artan merak (doğrudan satış garantisi değil)." },
            { term: "Yükselen kelimeler", desc: "Sosyal ve pazar sinyallerinden çıkarılan popüler terimler; yeni niş keşfi için ipucu." },
            { term: "Arbitraj fırsatları", desc: "Platformlar arası tahmini fiyat/marj farkı; tedarik ve lojistik maliyetler dahil değildir." },
            { term: "Veri kaynakları (Aktif/Kapalı)", desc: "Trendyol, Google, Amazon vb. bağlantıların yapılandırma durumu; kapalı kaynaklar ilgili skorları zayıflatır." },
        ],
        note: "Arka plandaki worker yaklaşık 6 saatte bir havuzu günceller. Acil ve kişiselleştirilmiş tarama için Fırsat Radarı’nda «Yeni analiz» kullanın.",
    },
};
