/**
 * BİRLEŞİK KATEGORİ ŞABLONU — LysiaETIC Internal Category Tree
 *
 * 3 platformun (Trendyol, N11, ÇiçekSepeti) kategorileri derinlemesine analiz edilerek
 * ortak bir şablon oluşturulmuştur.
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  PLATFORM ANALİZ ÖZETİ                                                     ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  N11:         4398 kategori, 80 kök, max derinlik 3                        ║
 * ║  Trendyol:    3862 kategori, 16 kök, max derinlik 5                        ║
 * ║  ÇiçekSepeti: 3613 kategori, 3 kök,  max derinlik 5                       ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  SORUN: Her platform farklı yapıda                                         ║
 * ║  - N11: Çok granüler kök (80 adet), sığ ağaç (max 3)                      ║
 * ║  - Trendyol: Az kök (16), derin ağaç (max 5)                              ║
 * ║  - ÇiçekSepeti: Sadece 3 kök (Çiçek, Yenilebilir Çiçek, Hediye)          ║
 * ║    → "Hediye" altında tüm genel e-ticaret kategorileri var                 ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  ÇÖZÜM: 25 birleşik kök kategori, max 4 seviye derinlik                   ║
 * ║  Her kök kategori → alt kategoriler → yaprak kategoriler                   ║
 * ║  Her yaprak kategoride platform eşleştirme ipuçları (keywords) var         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Yapı:
 *   { slug, name, icon, keywords[], children[] }
 *
 * keywords: Platform kategori isimlerini otomatik eşleştirmek için kullanılır.
 *           normalizeKey() ile normalize edilip fuzzy match yapılır.
 *
 * Kullanım:
 *   const template = require("./unifiedCategoryTemplate");
 *   // template.categories → kök kategori dizisi
 *   // Her kategori children[] ile alt kategorilere sahip
 */

const UNIFIED_CATEGORY_TEMPLATE = {
    version: "1.0.0",
    createdAt: "2026-04-06",
    description: "LysiaETIC Birleşik Kategori Şablonu — Trendyol, N11, ÇiçekSepeti analizi",
    maxDepth: 4,
    totalRootCategories: 25,

    // ═══════════════════════════════════════════════════════════════════════════
    // PLATFORM EŞLEŞTİRME HARİTASI
    // Her kök kategorinin hangi platform kök kategorilerine denk geldiği
    // ═══════════════════════════════════════════════════════════════════════════
    platformRootMapping: {
        "elektronik": {
            trendyol: ["Elektronik"],
            n11: ["Bilgisayar", "Telefon & Aksesuarları", "Televizyon & Ses Sistemleri", "Fotoğraf & Kamera", "Dijital Kodlar & Ürünler", "Video Oyun & Konsol"],
            ciceksepeti: ["Hediye > Elektronik"]
        },
        "beyaz-esya-ev-aletleri": {
            trendyol: ["Elektronik > Beyaz Eşya & İklimlendirme", "Elektronik > Elektrikli Ev Aletleri", "Elektronik > Akıllı Ev Aletleri"],
            n11: ["Beyaz Eşya", "Elektrikli Ev Aletleri"],
            ciceksepeti: ["Hediye > Elektronik > Beyaz Eşya & Küçük Ev Aletleri"]
        },
        "giyim": {
            trendyol: ["Giyim"],
            n11: ["Erkek Giyim & Aksesuar", "Kadın Giyim & Aksesuar", "Hamile Giyim"],
            ciceksepeti: ["Hediye > Moda > Giyim", "Hediye > Moda > Büyük Beden", "Hediye > Moda > Hamile Giyim", "Hediye > Moda > Tesettür Giyim, Aksesuar"]
        },
        "ayakkabi-canta": {
            trendyol: ["Ayakkabı", "Aksesuar > Çanta"],
            n11: ["Ayakkabı & Çanta"],
            ciceksepeti: ["Hediye > Moda > Ayakkabı", "Hediye > Moda > Çanta"]
        },
        "anne-bebek-cocuk": {
            trendyol: ["Anne & Bebek & Çocuk", "Giyim > Bebek Giyim", "Giyim > Hamile Giyim"],
            n11: ["Bebek Arabaları", "Bebek Bakım & Sağlık", "Bebek Bezi & Islak Mendil", "Bebek Giyim", "Bebek Güvenlik", "Bebek Odası & Park Yatak", "Bebek Oyuncakları", "Beslenme & Mama Sandalyesi", "Biberon ve Aksesuarları", "Emzirme Ürünleri", "Hamile Giyim", "Oto Koltuğu & Ana Kucağı", "Yürüteç & Yürüme Yardımcıları"],
            ciceksepeti: ["Hediye > Anne & Bebek"]
        },

        "kozmetik-kisisel-bakim": {
            trendyol: ["Kozmetik & Kişisel Bakım", "Elektronik > Kişisel Bakım Aletleri"],
            n11: ["Makyaj", "Parfüm & Deodorant", "Saç Bakım & Şekillendirme", "Cilt Bakımı", "Erkek Bakım Ürünleri", "Kadın Bakım Ürünleri", "Güzellik Salonu & Kuaför Ürünleri", "Ağız & Diş Bakımı"],
            ciceksepeti: ["Hediye > Parfüm & Kişisel Bakım"]
        },
        "ev-mobilya": {
            trendyol: ["Ev & Mobilya"],
            n11: ["Mobilya", "Dekorasyon & Aydınlatma", "Ev Tekstili", "Banyo & Ev Gereçleri"],
            ciceksepeti: ["Hediye > Ev & Yaşam"]
        },
        "mutfak": {
            trendyol: ["Ev & Mobilya > Ev > Sofra & Mutfak"],
            n11: ["Mutfak Gereçleri"],
            ciceksepeti: ["Hediye > Ev & Yaşam > Mutfak, Sofra"]
        },
        "supermarket": {
            trendyol: ["Süpermarket"],
            n11: ["Süpermarket"],
            ciceksepeti: ["Hediye > Süpermarket"]
        },
        "saglik-medikal": {
            trendyol: ["Süpermarket > Sağlık"],
            n11: ["Sağlık & Medikal Ürünler"],
            ciceksepeti: []
        },
        "spor-outdoor": {
            trendyol: ["Spor & Outdoor"],
            n11: ["Avcılık & Balıkçılık", "Bireysel & Takım Sporları", "Bisiklet & Scooter", "Fitness & Kondisyon", "Kış Sporları", "Outdoor & Kamp", "Spor Giyim & Ayakkabı", "Su Sporları", "Tekne & Yat Malzemeleri"],
            ciceksepeti: ["Hediye > Spor ve Outdoor"]
        },
        "taki-mucevher-saat": {
            trendyol: ["Aksesuar > Takı & Mücevher", "Aksesuar > Altın", "Aksesuar > Saat"],
            n11: ["Altın Takılar", "Gümüş Takılar", "Pırlanta Takılar", "Bijuteri Takılar", "Çelik Takılar", "Saat", "Yatırımlık Altın & Gümüş", "Takı Aksesuarları"],
            ciceksepeti: ["Hediye > Takı, Saat, Aksesuar"]
        },
        "aksesuar": {
            trendyol: ["Aksesuar"],
            n11: ["Aksesuar", "Güneş Gözlüğü"],
            ciceksepeti: ["Hediye > Takı, Saat, Aksesuar > Aksesuar"]
        },
        "otomotiv-motosiklet": {
            trendyol: ["Otomobil & Motosiklet"],
            n11: ["Aksesuar & Tuning", "Lastik & Jant", "Motosiklet", "Ses Sistemleri & Navigasyon", "Yedek Parça"],
            ciceksepeti: ["Hediye > Oto Aksesuar"]
        },
        "yapi-market-bahce": {
            trendyol: ["Bahçe & Elektrikli El Aletleri", "Banyo Yapı & Hırdavat"],
            n11: ["Yapı Market & Bahçe"],
            ciceksepeti: ["Hediye > Yapı Market, Hırdavat & Bahçe"]
        },
        "kirtasiye-ofis": {
            trendyol: ["Kırtasiye & Ofis Malzemeleri"],
            n11: ["Kırtasiye & Ofis"],
            ciceksepeti: ["Hediye > Ofis & Kırtasiye"]
        },
        "kitap": {
            trendyol: ["Kitap"],
            n11: ["Kitap"],
            ciceksepeti: ["Hediye > Hobi > Kitap"]
        },
        "oyuncak-parti": {
            trendyol: ["Anne & Bebek & Çocuk > Oyuncak", "Hobi & Eğlence > Parti Malzemeleri"],
            n11: ["Çocuk Oyuncakları & Parti"],
            ciceksepeti: ["Hediye > Oyuncak"]
        },
        "hobi-eglence": {
            trendyol: ["Hobi & Eğlence"],
            n11: ["Yetişkin Hobi & Oyun", "Film", "Müzik", "El İşi Ürünleri"],
            ciceksepeti: ["Hediye > Hobi"]
        },
        "evcil-hayvan": {
            trendyol: ["Süpermarket > Pet Shop"],
            n11: ["Evcil Hayvan Ürünleri"],
            ciceksepeti: ["Hediye > Evcil Hayvan Ürünleri"]
        },
        "cicek-bitki": {
            trendyol: [],
            n11: [],
            ciceksepeti: ["Çiçek", "Yenilebilir Çiçek"]
        },
        "dugun-organizasyon": {
            trendyol: [],
            n11: ["Düğün, Davet, Organizasyon"],
            ciceksepeti: ["Hediye > Moda > Nikah, Düğün", "Hediye > Ev & Yaşam > Parti kutlama"]
        },
        "cinsel-saglik": {
            trendyol: ["Giyim > Fantezi Giyim", "Süpermarket > Sağlık > Cinsel Sağlık"],
            n11: ["Cinsel Ürünler"],
            ciceksepeti: []
        },
        "ikinci-el-koleksiyon": {
            trendyol: [],
            n11: ["2.El Antika & Koleksiyon"],
            ciceksepeti: ["Hediye > 2. El, Yenilenmiş"]
        },
        "traktor-tarim": {
            trendyol: [],
            n11: ["Traktör"],
            ciceksepeti: []
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ANA KATEGORİ AĞACI
    // ═══════════════════════════════════════════════════════════════════════════
    categories: [
        // ─────────────────────────────────────────────────────────────────────
        // 1. ELEKTRONİK
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "elektronik",
            name: "Elektronik",
            icon: "📱",
            keywords: ["elektronik", "teknoloji", "dijital"],
            children: [
                {
                    slug: "cep-telefonu",
                    name: "Cep Telefonu",
                    icon: "📱",
                    keywords: ["cep telefonu", "akilli telefon", "smartphone", "iphone", "samsung", "telefon"],
                    children: [
                        { slug: "akilli-cep-telefonu", name: "Akıllı Cep Telefonu", keywords: ["akilli cep telefonu", "smartphone"] },
                        { slug: "tuslu-cep-telefonu", name: "Tuşlu Cep Telefonu", keywords: ["tuslu telefon", "tuslu cep"] },
                        { slug: "yenilenmis-telefon", name: "Yenilenmiş Telefon", keywords: ["yenilenmis telefon", "ikinci el telefon", "refurbished"] },
                        { slug: "cep-telefonu-aksesuar", name: "Cep Telefonu Aksesuarları", keywords: ["telefon kilifi", "telefon aksesuar", "ekran koruyucu", "sarj aleti"] },
                        { slug: "cep-telefonu-yedek-parca", name: "Cep Telefonu Yedek Parça", keywords: ["telefon yedek parca", "telefon batarya", "telefon ekran"] }
                    ]
                },
                {
                    slug: "bilgisayar",
                    name: "Bilgisayar",
                    icon: "💻",
                    keywords: ["bilgisayar", "laptop", "pc", "notebook", "masaustu"],
                    children: [
                        { slug: "dizustu-bilgisayar", name: "Dizüstü Bilgisayar", keywords: ["dizustu", "laptop", "notebook"] },
                        { slug: "masaustu-bilgisayar", name: "Masaüstü Bilgisayar", keywords: ["masaustu", "desktop", "kasa"] },
                        { slug: "bilgisayar-bilesenleri", name: "Bilgisayar Bileşenleri", keywords: ["ekran karti", "islemci", "ram", "anakart", "ssd", "hdd", "bilesen"] },
                        { slug: "bilgisayar-aksesuar", name: "Bilgisayar Aksesuarları", keywords: ["klavye", "mouse", "fare", "bilgisayar aksesuar", "cevre birimleri"] },
                        { slug: "monitor", name: "Monitör", keywords: ["monitor", "ekran"] },
                        { slug: "yazici-tarayici", name: "Yazıcı & Tarayıcı", keywords: ["yazici", "tarayici", "printer", "scanner"] },
                        { slug: "modem-ag-urunleri", name: "Modem & Ağ Ürünleri", keywords: ["modem", "router", "ag urunleri", "wifi", "switch"] }
                    ]
                },
                {
                    slug: "tablet",
                    name: "Tablet",
                    icon: "📟",
                    keywords: ["tablet", "ipad", "grafik tablet"],
                    children: [
                        { slug: "tablet-cihaz", name: "Tablet", keywords: ["tablet"] },
                        { slug: "grafik-tablet", name: "Grafik Tablet", keywords: ["grafik tablet", "cizim tableti"] },
                        { slug: "tablet-aksesuar", name: "Tablet Aksesuarları", keywords: ["tablet kilif", "tablet aksesuar", "tablet kalem"] }
                    ]
                },
                {
                    slug: "televizyon-ses-sistemleri",
                    name: "Televizyon & Ses Sistemleri",
                    icon: "📺",
                    keywords: ["televizyon", "tv", "ses sistemi", "hoparlor", "soundbar"],
                    children: [
                        { slug: "televizyon", name: "Televizyon", keywords: ["televizyon", "tv", "led tv", "oled", "smart tv"] },
                        { slug: "ses-sistemleri", name: "Ses Sistemleri", keywords: ["ses sistemi", "muzik sistemi", "hoparlor", "bluetooth hoparlor"] },
                        { slug: "kulaklik", name: "Kulaklık", keywords: ["kulaklik", "bluetooth kulaklik", "kablosuz kulaklik"] },
                        { slug: "soundbar", name: "Soundbar", keywords: ["soundbar", "ses bari"] },
                        { slug: "projeksiyon", name: "Projeksiyon", keywords: ["projeksiyon", "projektör"] },
                        { slug: "uydu-sistemleri", name: "Uydu Sistemleri", keywords: ["uydu", "uydu alici", "canak anten"] },
                        { slug: "tv-aksesuar", name: "TV Aksesuarları", keywords: ["tv aksesuar", "tv askisi", "kumanda"] }
                    ]
                },
                {
                    slug: "fotograf-kamera",
                    name: "Fotoğraf & Kamera",
                    icon: "📷",
                    keywords: ["fotograf", "kamera", "dijital kamera", "dslr"],
                    children: [
                        { slug: "fotograf-makinesi", name: "Fotoğraf Makinesi", keywords: ["fotograf makinesi", "dslr", "aynasiz", "dijital kamera"] },
                        { slug: "video-kamera", name: "Video Kamera", keywords: ["video kamera", "kameraman"] },
                        { slug: "lens-objektif", name: "Lens & Objektif", keywords: ["lens", "objektif", "filtre"] },
                        { slug: "kamera-aksesuar", name: "Kamera Aksesuarları", keywords: ["tripod", "monopod", "kamera cantasi", "kamera aksesuar"] },
                        { slug: "drone", name: "Drone", keywords: ["drone", "insansiz hava araci"] }
                    ]
                },
                {
                    slug: "giyilebilir-teknoloji",
                    name: "Giyilebilir Teknoloji",
                    icon: "⌚",
                    keywords: ["akilli saat", "akilli bileklik", "giyilebilir teknoloji", "smartwatch"],
                    children: [
                        { slug: "akilli-saat", name: "Akıllı Saat", keywords: ["akilli saat", "smartwatch", "apple watch"] },
                        { slug: "akilli-bileklik", name: "Akıllı Bileklik", keywords: ["akilli bileklik", "fitness bileklik"] },
                        { slug: "sanal-gerceklik", name: "Sanal Gerçeklik Gözlüğü", keywords: ["vr", "sanal gerceklik", "vr gozluk"] }
                    ]
                },
                {
                    slug: "video-oyun-konsol",
                    name: "Video Oyun & Konsol",
                    icon: "🎮",
                    keywords: ["oyun konsolu", "playstation", "xbox", "nintendo", "video oyun"],
                    children: [
                        { slug: "playstation", name: "PlayStation", keywords: ["playstation", "ps5", "ps4", "ps3"] },
                        { slug: "xbox", name: "Xbox", keywords: ["xbox", "xbox series", "xbox one"] },
                        { slug: "nintendo", name: "Nintendo", keywords: ["nintendo", "switch"] },
                        { slug: "konsol-aksesuar", name: "Konsol Aksesuarları", keywords: ["konsol aksesuar", "gamepad", "joystick", "oyun kolu"] },
                        { slug: "bilgisayar-oyunu", name: "Bilgisayar Oyunu", keywords: ["pc oyun", "bilgisayar oyunu", "steam"] }
                    ]
                },
                {
                    slug: "dijital-kodlar",
                    name: "Dijital Kodlar & Ürünler",
                    icon: "🔑",
                    keywords: ["dijital kod", "e-pin", "dijital uyelik", "dijital kart"],
                    children: [
                        { slug: "dijital-uyelik", name: "Dijital Üyelikler", keywords: ["dijital uyelik", "netflix", "spotify"] },
                        { slug: "e-pin-cuzdan-kodu", name: "E-Pin & Cüzdan Kodları", keywords: ["e-pin", "cuzdan kodu", "oyun kodu"] },
                        { slug: "dijital-yardim-karti", name: "Dijital Yardım Kartları", keywords: ["dijital yardim", "destek karti"] }
                    ]
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 2. BEYAZ EŞYA & EV ALETLERİ
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "beyaz-esya-ev-aletleri",
            name: "Beyaz Eşya & Ev Aletleri",
            icon: "🏠",
            keywords: ["beyaz esya", "ev aletleri", "elektrikli ev"],
            children: [
                {
                    slug: "buyuk-beyaz-esya",
                    name: "Büyük Beyaz Eşya",
                    keywords: ["beyaz esya", "buzdolabi", "camasir makinesi", "bulasik makinesi"],
                    children: [
                        { slug: "buzdolabi", name: "Buzdolabı", keywords: ["buzdolabi", "no frost"] },
                        { slug: "camasir-makinesi", name: "Çamaşır Makinesi", keywords: ["camasir makinesi"] },
                        { slug: "bulasik-makinesi", name: "Bulaşık Makinesi", keywords: ["bulasik makinesi"] },
                        { slug: "kurutma-makinesi", name: "Kurutma Makinesi", keywords: ["kurutma makinesi"] },
                        { slug: "firin-ocak", name: "Fırın & Ocak", keywords: ["firin", "ocak", "ankastre", "pisirme grubu"] },
                        { slug: "derin-dondurucu", name: "Derin Dondurucu", keywords: ["derin dondurucu"] }
                    ]
                },
                {
                    slug: "kucuk-ev-aletleri",
                    name: "Küçük Ev Aletleri",
                    keywords: ["kucuk ev aleti", "elektrikli mutfak", "supurge"],
                    children: [
                        { slug: "elektrikli-supurge", name: "Elektrikli Süpürge", keywords: ["elektrikli supurge", "robot supurge", "dikey supurge"] },
                        { slug: "utu", name: "Ütü", keywords: ["utu", "buharli utu"] },
                        { slug: "kahve-makinesi", name: "Kahve Makinesi", keywords: ["kahve makinesi", "espresso", "turk kahvesi makinesi", "filtre kahve"] },
                        { slug: "elektrikli-mutfak-aletleri", name: "Elektrikli Mutfak Aletleri", keywords: ["blender", "mikser", "tost makinesi", "mutfak robotu", "fritoz"] },
                        { slug: "dikis-makinesi", name: "Dikiş Makinesi", keywords: ["dikis makinesi"] },
                        { slug: "hava-temizleme", name: "Hava Temizleme & Nemlendirme", keywords: ["hava temizleyici", "nemlendirici", "hava temizleme"] }
                    ]
                },
                {
                    slug: "isitma-sogutma",
                    name: "Isıtma & Soğutma",
                    keywords: ["klima", "isitici", "sogutma", "iklimlendirme"],
                    children: [
                        { slug: "klima", name: "Klima", keywords: ["klima", "split klima"] },
                        { slug: "isitici", name: "Isıtıcı", keywords: ["isitici", "soba", "kombi"] },
                        { slug: "vantilatör", name: "Vantilatör", keywords: ["ventilator", "fan"] },
                        { slug: "su-sebili", name: "Su Sebili", keywords: ["su sebili", "su aritmasi"] }
                    ]
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 3. GİYİM
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "giyim",
            name: "Giyim",
            icon: "👔",
            keywords: ["giyim", "kiyafet", "moda", "giysi"],
            children: [
                {
                    slug: "kadin-giyim",
                    name: "Kadın Giyim",
                    keywords: ["kadin giyim", "bayan giyim"],
                    children: [
                        { slug: "kadin-elbise", name: "Elbise", keywords: ["elbise", "kadin elbise"] },
                        { slug: "kadin-tisort", name: "Kadın Tişört", keywords: ["kadin tisort", "bayan tisort"] },
                        { slug: "kadin-pantolon", name: "Kadın Pantolon", keywords: ["kadin pantolon", "kadin jean", "tayt"] },
                        { slug: "kadin-etek", name: "Etek", keywords: ["etek", "kadin etek"] },
                        { slug: "kadin-gomlek-bluz", name: "Gömlek & Bluz", keywords: ["kadin gomlek", "bluz"] },
                        { slug: "kadin-dis-giyim", name: "Kadın Dış Giyim", keywords: ["kadin mont", "kadin kaban", "kadin ceket"] },
                        { slug: "kadin-kazak-hirka", name: "Kazak & Hırka", keywords: ["kadin kazak", "kadin hirka", "suveter"] },
                        { slug: "abiye", name: "Abiye & Mezuniyet", keywords: ["abiye", "mezuniyet elbisesi", "nikah elbisesi"] },
                        { slug: "gelinlik", name: "Gelinlik", keywords: ["gelinlik"] },
                        { slug: "kadin-tulum", name: "Tulum & Salopet", keywords: ["tulum", "salopet", "kadin tulum"] }
                    ]
                },
                {
                    slug: "erkek-giyim",
                    name: "Erkek Giyim",
                    keywords: ["erkek giyim"],
                    children: [
                        { slug: "erkek-tisort", name: "Erkek Tişört", keywords: ["erkek tisort", "polo yaka"] },
                        { slug: "erkek-gomlek", name: "Erkek Gömlek", keywords: ["erkek gomlek"] },
                        { slug: "erkek-pantolon", name: "Erkek Pantolon & Şort", keywords: ["erkek pantolon", "erkek sort", "erkek jean"] },
                        { slug: "erkek-dis-giyim", name: "Erkek Dış Giyim", keywords: ["erkek mont", "erkek kaban", "erkek ceket"] },
                        { slug: "erkek-kazak", name: "Erkek Kazak & Hırka", keywords: ["erkek kazak", "erkek hirka"] },
                        { slug: "takim-elbise", name: "Takım Elbise", keywords: ["takim elbise", "smokin", "damatlik"] },
                        { slug: "erkek-esofman", name: "Eşofman & Sweatshirt", keywords: ["esofman", "sweatshirt"] }
                    ]
                },
                {
                    slug: "ic-giyim",
                    name: "İç Giyim",
                    keywords: ["ic giyim", "ic camasiri"],
                    children: [
                        { slug: "kadin-ic-giyim", name: "Kadın İç Giyim", keywords: ["sutyen", "kulot", "kadin ic giyim", "ic camasiri takimi"] },
                        { slug: "erkek-ic-giyim", name: "Erkek İç Giyim", keywords: ["boxer", "erkek ic giyim", "slip", "atlet"] },
                        { slug: "corap", name: "Çorap", keywords: ["corap", "kadin corap", "erkek corap"] },
                        { slug: "termal-giyim", name: "Termal Giyim", keywords: ["termal", "iclik", "termal giyim"] }
                    ]
                },
                {
                    slug: "plaj-giyim",
                    name: "Plaj Giyim",
                    keywords: ["plaj giyim", "mayo", "bikini", "deniz sortu"],
                    children: [
                        { slug: "mayo", name: "Mayo", keywords: ["mayo", "kadin mayo", "erkek mayo"] },
                        { slug: "bikini", name: "Bikini", keywords: ["bikini", "bikini takimi"] },
                        { slug: "deniz-sortu", name: "Deniz Şortu", keywords: ["deniz sortu", "erkek mayo"] }
                    ]
                },
                {
                    slug: "tesettur-giyim",
                    name: "Tesettür Giyim",
                    keywords: ["tesettur", "tesettur giyim", "hijab"],
                    children: [
                        { slug: "tesettur-elbise", name: "Tesettür Elbise", keywords: ["tesettur elbise"] },
                        { slug: "tesettur-tunik", name: "Tesettür Tunik", keywords: ["tesettur tunik"] },
                        { slug: "tesettur-ferace", name: "Ferace & Kap", keywords: ["ferace", "kap", "tesettur dis giyim"] },
                        { slug: "esarp-sal", name: "Eşarp & Şal", keywords: ["esarp", "sal", "bone"] }
                    ]
                },
                {
                    slug: "spor-giyim",
                    name: "Spor Giyim",
                    keywords: ["spor giyim", "spor kiyafet"],
                    children: [
                        { slug: "spor-tisort", name: "Spor Tişört", keywords: ["spor tisort", "forma"] },
                        { slug: "spor-tayt", name: "Spor Tayt", keywords: ["spor tayt"] },
                        { slug: "spor-sort", name: "Spor Şort", keywords: ["spor sort"] },
                        { slug: "esofman-takim", name: "Eşofman Takım", keywords: ["esofman takim", "spor takim"] }
                    ]
                },
                {
                    slug: "buyuk-beden",
                    name: "Büyük Beden",
                    keywords: ["buyuk beden", "plus size"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 4. AYAKKABI & ÇANTA
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "ayakkabi-canta",
            name: "Ayakkabı & Çanta",
            icon: "👟",
            keywords: ["ayakkabi", "canta", "bavul"],
            children: [
                {
                    slug: "kadin-ayakkabi",
                    name: "Kadın Ayakkabı",
                    keywords: ["kadin ayakkabi", "bayan ayakkabi"],
                    children: [
                        { slug: "topuklu-ayakkabi", name: "Topuklu Ayakkabı", keywords: ["topuklu", "stiletto", "dolgu topuk"] },
                        { slug: "kadin-bot", name: "Kadın Bot & Çizme", keywords: ["kadin bot", "kadin cizme", "bootie"] },
                        { slug: "kadin-sandalet", name: "Kadın Sandalet & Terlik", keywords: ["kadin sandalet", "kadin terlik"] },
                        { slug: "babet", name: "Babet", keywords: ["babet"] }
                    ]
                },
                {
                    slug: "erkek-ayakkabi",
                    name: "Erkek Ayakkabı",
                    keywords: ["erkek ayakkabi"],
                    children: [
                        { slug: "erkek-klasik-ayakkabi", name: "Klasik Ayakkabı", keywords: ["erkek klasik", "oxford", "loafer"] },
                        { slug: "erkek-bot", name: "Erkek Bot", keywords: ["erkek bot"] },
                        { slug: "erkek-sandalet", name: "Erkek Sandalet & Terlik", keywords: ["erkek sandalet", "erkek terlik"] }
                    ]
                },
                {
                    slug: "spor-ayakkabi",
                    name: "Spor Ayakkabı",
                    keywords: ["spor ayakkabi", "sneaker", "kosu ayakkabisi"],
                    children: [
                        { slug: "sneaker", name: "Sneaker", keywords: ["sneaker"] },
                        { slug: "kosu-ayakkabisi", name: "Koşu Ayakkabısı", keywords: ["kosu ayakkabisi"] },
                        { slug: "futbol-ayakkabisi", name: "Futbol Ayakkabısı", keywords: ["krampon", "hali saha", "futbol ayakkabisi"] },
                        { slug: "yuruyus-ayakkabisi", name: "Yürüyüş Ayakkabısı", keywords: ["yuruyus ayakkabisi", "outdoor ayakkabi"] }
                    ]
                },
                {
                    slug: "cocuk-ayakkabi",
                    name: "Çocuk Ayakkabı",
                    keywords: ["cocuk ayakkabi"],
                    children: []
                },
                {
                    slug: "canta",
                    name: "Çanta",
                    keywords: ["canta", "kadin canta", "erkek canta"],
                    children: [
                        { slug: "kadin-canta", name: "Kadın Çanta", keywords: ["kadin canta", "omuz cantasi", "el cantasi"] },
                        { slug: "erkek-canta", name: "Erkek Çanta", keywords: ["erkek canta", "evrak cantasi"] },
                        { slug: "sirt-cantasi", name: "Sırt Çantası", keywords: ["sirt cantasi", "okul cantasi"] },
                        { slug: "bavul-valiz", name: "Bavul & Valiz", keywords: ["bavul", "valiz", "seyahat cantasi"] }
                    ]
                },
                {
                    slug: "ayakkabi-bakim",
                    name: "Ayakkabı Bakım Ürünleri",
                    keywords: ["ayakkabi bakim", "ayakkabi boyasi", "ayakkabi bagcigi"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 5. ANNE & BEBEK & ÇOCUK
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "anne-bebek-cocuk",
            name: "Anne & Bebek & Çocuk",
            icon: "👶",
            keywords: ["anne", "bebek", "cocuk", "hamile"],
            children: [
                {
                    slug: "bebek-arabasi",
                    name: "Bebek Arabası & Puset",
                    keywords: ["bebek arabasi", "puset", "baston puset", "travel sistem"],
                    children: [
                        { slug: "travel-sistem", name: "Travel Sistem", keywords: ["travel sistem"] },
                        { slug: "baston-puset", name: "Baston Puset", keywords: ["baston puset"] },
                        { slug: "cift-yonlu-araba", name: "Çift Yönlü Bebek Arabası", keywords: ["cift yonlu"] },
                        { slug: "ikiz-araba", name: "İkiz Bebek Arabası", keywords: ["ikiz bebek arabasi"] },
                        { slug: "araba-aksesuar", name: "Bebek Arabası Aksesuarları", keywords: ["araba aksesuar"] }
                    ]
                },
                {
                    slug: "bebek-bakim",
                    name: "Bebek Bakım & Sağlık",
                    keywords: ["bebek bakim", "bebek sagligi", "bebek bezi", "islak mendil"],
                    children: [
                        { slug: "bebek-bezi", name: "Bebek Bezi", keywords: ["bebek bezi"] },
                        { slug: "islak-mendil", name: "Islak Mendil", keywords: ["islak mendil", "bebek havlu"] },
                        { slug: "bebek-kozmetik", name: "Bebek Kozmetik & Bakım", keywords: ["bebek sampuan", "bebek kremi", "bebek yagi"] },
                        { slug: "bebek-saglik", name: "Bebek Sağlık Ürünleri", keywords: ["bebek termometre", "burun aspiratoru"] }
                    ]
                },
                {
                    slug: "bebek-beslenme",
                    name: "Bebek Beslenme",
                    keywords: ["biberon", "mama sandalyesi", "emzik", "mama"],
                    children: [
                        { slug: "biberon", name: "Biberon & Aksesuarları", keywords: ["biberon", "biberon isitici", "sterilizator"] },
                        { slug: "mama-sandalyesi", name: "Mama Sandalyesi", keywords: ["mama sandalyesi"] },
                        { slug: "emzik", name: "Emzik & Diş Kaşıyıcı", keywords: ["emzik", "dis kasiyici"] },
                        { slug: "bebek-mamasi", name: "Bebek Maması", keywords: ["mama", "bebek mamasi", "ek gida"] }
                    ]
                },
                {
                    slug: "emzirme",
                    name: "Emzirme Ürünleri",
                    keywords: ["emzirme", "gogus pompasi", "sut saklama"],
                    children: [
                        { slug: "gogus-pompasi", name: "Göğüs Pompası", keywords: ["gogus pompasi", "sut pompasi"] },
                        { slug: "emzirme-yastigi", name: "Emzirme Yastığı", keywords: ["emzirme yastigi"] },
                        { slug: "sut-saklama", name: "Süt Saklama", keywords: ["sut saklama poset", "sut saklama kabi"] }
                    ]
                },
                {
                    slug: "oto-koltugu-ana-kucagi",
                    name: "Oto Koltuğu & Ana Kucağı",
                    keywords: ["oto koltugu", "ana kucagi", "kanguru"],
                    children: [
                        { slug: "oto-koltugu", name: "Oto Koltuğu", keywords: ["oto koltugu", "cocuk koltugu"] },
                        { slug: "ana-kucagi", name: "Ana Kucağı", keywords: ["ana kucagi"] },
                        { slug: "kanguru", name: "Kanguru", keywords: ["kanguru", "bebek tasiyici"] }
                    ]
                },
                {
                    slug: "bebek-guvenlik",
                    name: "Bebek Güvenlik",
                    keywords: ["bebek guvenlik", "yatak bariyeri", "priz emniyeti"],
                    children: []
                },
                {
                    slug: "bebek-odasi",
                    name: "Bebek Odası & Park Yatak",
                    keywords: ["bebek odasi", "park yatak", "besik", "bebek mobilya"],
                    children: []
                },
                {
                    slug: "bebek-giyim",
                    name: "Bebek Giyim",
                    keywords: ["bebek giyim", "bebek body", "zibin", "hastane cikisi"],
                    children: [
                        { slug: "kiz-bebek-giyim", name: "Kız Bebek", keywords: ["kiz bebek"] },
                        { slug: "erkek-bebek-giyim", name: "Erkek Bebek", keywords: ["erkek bebek"] }
                    ]
                },
                {
                    slug: "cocuk-giyim",
                    name: "Çocuk Giyim",
                    keywords: ["cocuk giyim", "cocuk kiyafet"],
                    children: [
                        { slug: "kiz-cocuk-giyim", name: "Kız Çocuk", keywords: ["kiz cocuk"] },
                        { slug: "erkek-cocuk-giyim", name: "Erkek Çocuk", keywords: ["erkek cocuk"] }
                    ]
                },
                {
                    slug: "hamile-giyim",
                    name: "Hamile Giyim",
                    keywords: ["hamile giyim", "hamile elbise", "lohusa"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 6. KOZMETİK & KİŞİSEL BAKIM
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "kozmetik-kisisel-bakim",
            name: "Kozmetik & Kişisel Bakım",
            icon: "💄",
            keywords: ["kozmetik", "kisisel bakim", "guzellik"],
            children: [
                {
                    slug: "makyaj",
                    name: "Makyaj",
                    keywords: ["makyaj", "ruj", "fondoten", "rimel"],
                    children: [
                        { slug: "dudak-makyaji", name: "Dudak Makyajı", keywords: ["ruj", "dudak", "lip gloss"] },
                        { slug: "goz-makyaji", name: "Göz Makyajı", keywords: ["rimel", "far", "eyeliner", "goz makyaji"] },
                        { slug: "yuz-makyaji", name: "Yüz Makyajı", keywords: ["fondoten", "pudra", "allik", "kapatici", "ten makyaji"] },
                        { slug: "tirnak", name: "Tırnak & Oje", keywords: ["oje", "tirnak", "manikur"] },
                        { slug: "makyaj-aksesuar", name: "Makyaj Aksesuarları", keywords: ["makyaj fircasi", "makyaj sungeri", "makyaj aksesuar"] }
                    ]
                },
                {
                    slug: "parfum-deodorant",
                    name: "Parfüm & Deodorant",
                    keywords: ["parfum", "deodorant", "kolonya"],
                    children: [
                        { slug: "kadin-parfum", name: "Kadın Parfüm", keywords: ["kadin parfum"] },
                        { slug: "erkek-parfum", name: "Erkek Parfüm", keywords: ["erkek parfum"] },
                        { slug: "deodorant-rollon", name: "Deodorant & Roll-on", keywords: ["deodorant", "roll on"] },
                        { slug: "kolonya", name: "Kolonya", keywords: ["kolonya"] }
                    ]
                },
                {
                    slug: "cilt-bakim",
                    name: "Cilt Bakımı",
                    keywords: ["cilt bakim", "yuz bakim", "vucut bakim"],
                    children: [
                        { slug: "yuz-bakim", name: "Yüz Bakımı", keywords: ["yuz kremi", "serum", "yuz temizleme", "yuz bakim"] },
                        { slug: "vucut-bakim", name: "Vücut Bakımı", keywords: ["vucut losyonu", "vucut bakim"] },
                        { slug: "gunes-urunleri", name: "Güneş Ürünleri", keywords: ["gunes kremi", "gunes koruyucu", "bronzlastirici"] },
                        { slug: "el-ayak-bakim", name: "El & Ayak Bakımı", keywords: ["el kremi", "ayak bakim"] }
                    ]
                },
                {
                    slug: "sac-bakim",
                    name: "Saç Bakım & Şekillendirme",
                    keywords: ["sac bakim", "sampuan", "sac boyasi"],
                    children: [
                        { slug: "sampuan", name: "Şampuan", keywords: ["sampuan"] },
                        { slug: "sac-kremi-maske", name: "Saç Kremi & Maske", keywords: ["sac kremi", "sac maskesi"] },
                        { slug: "sac-boyasi", name: "Saç Boyası", keywords: ["sac boyasi"] },
                        { slug: "sac-sekillendirme", name: "Saç Şekillendirme", keywords: ["sac jeli", "sac spreyi", "sac sekillendirme"] },
                        { slug: "sac-kurutma-makinesi", name: "Saç Kurutma Makinesi", keywords: ["sac kurutma", "fon makinesi"] },
                        { slug: "sac-duzlestirici-masa", name: "Saç Düzleştirici & Maşa", keywords: ["sac duzlestirici", "sac masasi"] }
                    ]
                },
                {
                    slug: "agiz-dis-bakim",
                    name: "Ağız & Diş Bakımı",
                    keywords: ["dis fircasi", "dis macunu", "agiz bakim"],
                    children: [
                        { slug: "dis-fircasi", name: "Diş Fırçası", keywords: ["dis fircasi", "elektrikli dis fircasi"] },
                        { slug: "dis-macunu", name: "Diş Macunu", keywords: ["dis macunu"] },
                        { slug: "agiz-dusu", name: "Ağız Duşu & Gargara", keywords: ["agiz dusu", "gargara", "agiz calkalama"] }
                    ]
                },
                {
                    slug: "erkek-bakim",
                    name: "Erkek Bakım",
                    keywords: ["erkek bakim", "tiras", "sakal"],
                    children: [
                        { slug: "tiras-makinesi", name: "Tıraş Makinesi", keywords: ["tiras makinesi"] },
                        { slug: "tiras-bicagi", name: "Tıraş Bıçağı & Yedekleri", keywords: ["tiras bicagi", "jilet"] },
                        { slug: "tiras-sonrasi", name: "Tıraş Sonrası Ürünler", keywords: ["tiras sonrasi", "after shave"] },
                        { slug: "sac-sakal-makinesi", name: "Saç & Sakal Kesme Makinesi", keywords: ["sakal makinesi", "sac kesme"] }
                    ]
                },
                {
                    slug: "epilasyon-agda",
                    name: "Epilasyon & Ağda",
                    keywords: ["epilasyon", "agda", "tuy dokme", "ipl lazer"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 7. EV & MOBİLYA
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "ev-mobilya",
            name: "Ev & Mobilya",
            icon: "🛋️",
            keywords: ["ev", "mobilya", "dekorasyon", "ev esyasi"],
            children: [
                {
                    slug: "mobilya",
                    name: "Mobilya",
                    keywords: ["mobilya", "koltuk", "masa", "sandalye"],
                    children: [
                        { slug: "oturma-gruplari", name: "Oturma Grupları", keywords: ["koltuk takimi", "oturma grubu", "kanepe"] },
                        { slug: "yatak-odasi", name: "Yatak Odası", keywords: ["yatak", "baza", "karyola", "yatak odasi"] },
                        { slug: "yemek-odasi", name: "Yemek Odası", keywords: ["yemek masasi", "yemek odasi"] },
                        { slug: "tv-unitesi-sehpa", name: "TV Ünitesi & Sehpa", keywords: ["tv unitesi", "sehpa"] },
                        { slug: "kitaplik-raf", name: "Kitaplık & Raf", keywords: ["kitaplik", "raf"] },
                        { slug: "gardrop-sifonyer", name: "Gardırop & Şifonyer", keywords: ["gardrop", "sifonyer", "komodin"] },
                        { slug: "ofis-mobilyasi", name: "Ofis Mobilyası", keywords: ["ofis masasi", "ofis koltugu", "oyuncu koltugu"] },
                        { slug: "bahce-mobilyasi", name: "Bahçe Mobilyası", keywords: ["bahce mobilya", "bahce masa", "sezlong"] },
                        { slug: "cocuk-genc-odasi", name: "Çocuk & Genç Odası", keywords: ["cocuk odasi", "genc odasi", "ranza"] },
                        { slug: "mutfak-mobilyasi", name: "Mutfak Mobilyası", keywords: ["mutfak dolabi", "mutfak masasi"] }
                    ]
                },
                {
                    slug: "dekorasyon-aydinlatma",
                    name: "Dekorasyon & Aydınlatma",
                    keywords: ["dekorasyon", "aydinlatma", "lamba", "avize"],
                    children: [
                        { slug: "aydinlatma", name: "Aydınlatma", keywords: ["avize", "lamba", "aplik", "led", "aydinlatma"] },
                        { slug: "tablo-duvar-dekor", name: "Tablo & Duvar Dekor", keywords: ["tablo", "duvar sticker", "duvar kagidi"] },
                        { slug: "ayna", name: "Ayna", keywords: ["ayna", "dekoratif ayna"] },
                        { slug: "saat-dekoratif", name: "Dekoratif Saat", keywords: ["duvar saati", "dekoratif saat"] },
                        { slug: "ev-aksesuarlari", name: "Ev Aksesuarları", keywords: ["vazo", "mumluk", "cerceve", "dekoratif aksesuar"] },
                        { slug: "hediyelik-esya", name: "Hediyelik Eşya", keywords: ["hediyelik", "hatira esya"] }
                    ]
                },
                {
                    slug: "ev-tekstili",
                    name: "Ev Tekstili",
                    keywords: ["ev tekstili", "nevresim", "hali", "perde"],
                    children: [
                        { slug: "yatak-odasi-tekstili", name: "Yatak Odası Tekstili", keywords: ["nevresim", "yorgan", "yastik", "pike"] },
                        { slug: "hali-kilim", name: "Halı & Kilim", keywords: ["hali", "kilim"] },
                        { slug: "perde", name: "Perde", keywords: ["perde", "tul perde", "stor perde"] },
                        { slug: "banyo-tekstili", name: "Banyo Tekstili", keywords: ["havlu", "bornoz", "banyo paspasi"] },
                        { slug: "salon-tekstili", name: "Salon Tekstili", keywords: ["kirlent", "battaniye", "tv battaniyesi"] }
                    ]
                },
                {
                    slug: "banyo",
                    name: "Banyo",
                    keywords: ["banyo", "banyo aksesuar", "banyo dolabi"],
                    children: [
                        { slug: "banyo-aksesuar", name: "Banyo Aksesuarları", keywords: ["banyo aksesuar", "sabunluk", "havluluk"] },
                        { slug: "banyo-mobilya", name: "Banyo Mobilyası", keywords: ["banyo dolabi", "lavabo"] }
                    ]
                },
                {
                    slug: "ev-gerecleri-duzenleme",
                    name: "Ev Gereçleri & Düzenleme",
                    keywords: ["ev gerecleri", "saklama", "duzenleme", "askili"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 8. MUTFAK GEREÇLERİ
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "mutfak",
            name: "Mutfak Gereçleri",
            icon: "🍳",
            keywords: ["mutfak", "tencere", "tabak", "bardak"],
            children: [
                { slug: "yemek-pisirme", name: "Yemek Pişirme", keywords: ["tencere", "tava", "dukum tencere", "cezve"] },
                { slug: "sofra", name: "Sofra", keywords: ["tabak", "bardak", "catal", "kasik", "sofra takimi"] },
                { slug: "saklama-kaplari", name: "Saklama Kapları", keywords: ["saklama kabi", "kavanoz", "vakum"] },
                { slug: "cay-kahve-demleme", name: "Çay & Kahve Demleme", keywords: ["caydanlik", "demlik", "french press"] },
                { slug: "pratik-mutfak", name: "Pratik Mutfak Gereçleri", keywords: ["dograma tahta", "rende", "acicak", "mutfak gereci"] },
                { slug: "ceyiz-setleri", name: "Çeyiz Setleri", keywords: ["ceyiz seti", "ceyiz"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 9. SÜPERMARKET
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "supermarket",
            name: "Süpermarket",
            icon: "🛒",
            keywords: ["supermarket", "market", "gida", "temizlik"],
            children: [
                {
                    slug: "gida-icecek",
                    name: "Gıda & İçecek",
                    keywords: ["gida", "icecek", "yiyecek"],
                    children: [
                        { slug: "atistirmalik", name: "Atıştırmalık", keywords: ["cikolata", "cips", "biskuvi", "atistirmalik"] },
                        { slug: "cay-kahve", name: "Çay & Kahve", keywords: ["cay", "kahve", "bitki cayi"] },
                        { slug: "kuru-gida", name: "Kuru Gıda", keywords: ["makarna", "pirinc", "bulgur", "kuru gida"] },
                        { slug: "hazir-gida", name: "Hazır Gıda", keywords: ["konserve", "hazir gida"] },
                        { slug: "icecekler", name: "İçecekler", keywords: ["su", "meyve suyu", "gazli icecek"] },
                        { slug: "sut-kahvaltilik", name: "Süt & Kahvaltılık", keywords: ["sut", "peynir", "yumurta", "kahvaltilik"] }
                    ]
                },
                {
                    slug: "deterjan-temizlik",
                    name: "Deterjan & Temizlik",
                    keywords: ["deterjan", "temizlik", "camasir", "bulasik"],
                    children: [
                        { slug: "camasir-yikama", name: "Çamaşır Yıkama", keywords: ["camasir deterjani", "yumusatici"] },
                        { slug: "bulasik-yikama", name: "Bulaşık Yıkama", keywords: ["bulasik deterjani", "bulasik tableti"] },
                        { slug: "ev-temizlik", name: "Ev Temizlik", keywords: ["yuzey temizleyici", "cam silici", "cif"] },
                        { slug: "kagit-urunleri", name: "Kağıt Ürünleri", keywords: ["tuvalet kagidi", "kagit havlu", "pecete"] }
                    ]
                },
                {
                    slug: "meyve-sebze",
                    name: "Meyve & Sebze",
                    keywords: ["meyve", "sebze", "manav"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 10. SAĞLIK & MEDİKAL
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "saglik-medikal",
            name: "Sağlık & Medikal",
            icon: "🏥",
            keywords: ["saglik", "medikal", "ilac", "vitamin"],
            children: [
                { slug: "besin-takviyesi", name: "Besin Takviyesi & Vitamin", keywords: ["vitamin", "besin takviyesi", "supplement", "omega"] },
                { slug: "sporcu-besini", name: "Sporcu Besini", keywords: ["protein tozu", "sporcu besini", "bcaa", "kreatin"] },
                { slug: "medikal-ekipman", name: "Medikal Ekipman", keywords: ["tansiyon aleti", "nebulizator", "medikal"] },
                { slug: "ortopedik-urunler", name: "Ortopedik Ürünler", keywords: ["ortopedik", "bel destegi", "diz destegi"] },
                { slug: "ilk-yardim", name: "İlk Yardım", keywords: ["ilk yardim", "yara bandi", "sargı bezi"] },
                { slug: "olcum-cihazlari", name: "Ölçüm Cihazları", keywords: ["termometre", "seker olcum", "pulse oksimetre"] },
                { slug: "masaj-urunleri", name: "Masaj Ürünleri", keywords: ["masaj aleti", "masaj yastigi"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 11. SPOR & OUTDOOR
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "spor-outdoor",
            name: "Spor & Outdoor",
            icon: "⚽",
            keywords: ["spor", "outdoor", "fitness", "kamp"],
            children: [
                {
                    slug: "fitness-kondisyon",
                    name: "Fitness & Kondisyon",
                    keywords: ["fitness", "kondisyon", "kardiyo", "agirlik"],
                    children: [
                        { slug: "fitness-ekipman", name: "Fitness Ekipmanları", keywords: ["dambil", "kosu bandi", "kondisyon bisikleti", "agirlik"] },
                        { slug: "pilates-yoga", name: "Pilates & Yoga", keywords: ["pilates", "yoga", "yoga mati"] }
                    ]
                },
                {
                    slug: "bisiklet-scooter",
                    name: "Bisiklet & Scooter",
                    keywords: ["bisiklet", "scooter", "elektrikli bisiklet"],
                    children: [
                        { slug: "dag-bisikleti", name: "Dağ Bisikleti", keywords: ["dag bisikleti"] },
                        { slug: "sehir-bisikleti", name: "Şehir Bisikleti", keywords: ["sehir bisikleti"] },
                        { slug: "elektrikli-bisiklet", name: "Elektrikli Bisiklet", keywords: ["elektrikli bisiklet"] },
                        { slug: "elektrikli-scooter", name: "Elektrikli Scooter", keywords: ["elektrikli scooter"] },
                        { slug: "cocuk-bisikleti", name: "Çocuk Bisikleti", keywords: ["cocuk bisikleti"] },
                        { slug: "bisiklet-aksesuar", name: "Bisiklet Aksesuarları", keywords: ["bisiklet aksesuar", "bisiklet kask", "bisiklet isik"] }
                    ]
                },
                {
                    slug: "outdoor-kamp",
                    name: "Outdoor & Kamp",
                    keywords: ["outdoor", "kamp", "cadir", "uyku tulumu"],
                    children: [
                        { slug: "cadir", name: "Çadır", keywords: ["cadir", "kamp cadiri"] },
                        { slug: "uyku-tulumu", name: "Uyku Tulumu", keywords: ["uyku tulumu"] },
                        { slug: "kamp-malzemeleri", name: "Kamp Malzemeleri", keywords: ["kamp ocagi", "termos", "matara", "kamp sandalyesi"] },
                        { slug: "outdoor-giyim", name: "Outdoor Giyim", keywords: ["outdoor mont", "yagmurluk", "outdoor giyim"] }
                    ]
                },
                {
                    slug: "takim-sporlari",
                    name: "Takım Sporları",
                    keywords: ["futbol", "basketbol", "voleybol"],
                    children: [
                        { slug: "futbol", name: "Futbol", keywords: ["futbol topu", "futbol forma", "futbol"] },
                        { slug: "basketbol", name: "Basketbol", keywords: ["basketbol topu", "basketbol"] },
                        { slug: "voleybol", name: "Voleybol", keywords: ["voleybol topu", "voleybol"] }
                    ]
                },
                {
                    slug: "su-sporlari",
                    name: "Su Sporları",
                    keywords: ["dalis", "sorf", "su sporu", "yuzme"],
                    children: [
                        { slug: "dalis", name: "Dalış", keywords: ["dalis", "snorkel", "palet"] },
                        { slug: "sorf", name: "Sörf & Kitesurf", keywords: ["sorf", "kitesurf", "windsurf"] },
                        { slug: "sisirme-urunler", name: "Şişme Deniz & Havuz Ürünleri", keywords: ["sisirme", "deniz yatagi", "can simidi"] }
                    ]
                },
                {
                    slug: "avcilik-balikcilik",
                    name: "Avcılık & Balıkçılık",
                    keywords: ["avcilik", "balikcilik", "olta", "av"],
                    children: [
                        { slug: "olta-kamis", name: "Olta & Kamışlar", keywords: ["olta", "kamis", "olta makinesi"] },
                        { slug: "av-malzemeleri", name: "Av Malzemeleri", keywords: ["av", "kara avi", "av tufegi"] }
                    ]
                },
                {
                    slug: "kis-sporlari",
                    name: "Kış Sporları",
                    keywords: ["kayak", "snowboard", "kis sporu"],
                    children: [
                        { slug: "kayak", name: "Kayak", keywords: ["kayak"] },
                        { slug: "snowboard", name: "Snowboard", keywords: ["snowboard"] }
                    ]
                },
                {
                    slug: "dovus-sporlari",
                    name: "Dövüş Sporları",
                    keywords: ["boks", "dovus", "muay thai", "mma"],
                    children: []
                },
                {
                    slug: "tekne-yat",
                    name: "Tekne & Yat",
                    keywords: ["tekne", "yat", "deniz motoru", "bot"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 12. TAKI & MÜCEVHER & SAAT
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "taki-mucevher-saat",
            name: "Takı, Mücevher & Saat",
            icon: "💍",
            keywords: ["taki", "mucevher", "saat", "altin", "gumus"],
            children: [
                {
                    slug: "altin-taki",
                    name: "Altın Takılar",
                    keywords: ["altin", "altin kolye", "altin yuzuk", "altin bileklik", "altin kupe"],
                    children: [
                        { slug: "altin-kolye", name: "Altın Kolye", keywords: ["altin kolye"] },
                        { slug: "altin-yuzuk", name: "Altın Yüzük", keywords: ["altin yuzuk"] },
                        { slug: "altin-bileklik", name: "Altın Bileklik", keywords: ["altin bileklik", "altin bilezik"] },
                        { slug: "altin-kupe", name: "Altın Küpe", keywords: ["altin kupe"] }
                    ]
                },
                {
                    slug: "gumus-taki",
                    name: "Gümüş Takılar",
                    keywords: ["gumus", "gumus kolye", "gumus yuzuk"],
                    children: [
                        { slug: "gumus-kolye", name: "Gümüş Kolye", keywords: ["gumus kolye"] },
                        { slug: "gumus-yuzuk", name: "Gümüş Yüzük", keywords: ["gumus yuzuk"] },
                        { slug: "gumus-bileklik", name: "Gümüş Bileklik", keywords: ["gumus bileklik"] },
                        { slug: "gumus-kupe", name: "Gümüş Küpe", keywords: ["gumus kupe"] }
                    ]
                },
                {
                    slug: "pirlanta-taki",
                    name: "Pırlanta Takılar",
                    keywords: ["pirlanta", "pirlanta yuzuk", "pirlanta kolye"],
                    children: []
                },
                {
                    slug: "bijuteri",
                    name: "Bijuteri Takılar",
                    keywords: ["bijuteri", "bijuteri kolye", "bijuteri bileklik"],
                    children: []
                },
                {
                    slug: "celik-taki",
                    name: "Çelik Takılar",
                    keywords: ["celik taki", "celik kolye", "celik yuzuk"],
                    children: []
                },
                {
                    slug: "saat",
                    name: "Saat",
                    keywords: ["kol saati", "saat"],
                    children: [
                        { slug: "kadin-saat", name: "Kadın Saat", keywords: ["kadin saat"] },
                        { slug: "erkek-saat", name: "Erkek Saat", keywords: ["erkek saat"] },
                        { slug: "cocuk-saat", name: "Çocuk Saat", keywords: ["cocuk saat"] }
                    ]
                },
                {
                    slug: "yatirimlik-altin",
                    name: "Yatırımlık Altın & Gümüş",
                    keywords: ["yatirimlik altin", "cumhuriyet altini", "kulce altin", "ziynet"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 13. AKSESUAR
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "aksesuar",
            name: "Aksesuar",
            icon: "🕶️",
            keywords: ["aksesuar", "gozluk", "kemer", "sal"],
            children: [
                { slug: "gunes-gozlugu", name: "Güneş Gözlüğü", keywords: ["gunes gozlugu", "erkek gozluk", "kadin gozluk"] },
                { slug: "kemer", name: "Kemer", keywords: ["kemer", "pantolon askisi"] },
                { slug: "sal-fular-atki", name: "Şal, Fular & Atkı", keywords: ["sal", "fular", "atki", "bere", "eldiven"] },
                { slug: "sapka", name: "Şapka", keywords: ["sapka", "kasket", "bere"] },
                { slug: "kravat-papyon", name: "Kravat & Papyon", keywords: ["kravat", "papyon", "kol dugmesi"] },
                { slug: "sac-aksesuari", name: "Saç Aksesuarı", keywords: ["sac tokasi", "sac bandi", "tac"] },
                { slug: "anahtarlik", name: "Anahtarlık", keywords: ["anahtarlik"] },
                { slug: "cuzdan", name: "Cüzdan", keywords: ["cuzdan", "kartlik"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 14. OTOMOTİV & MOTOSİKLET
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "otomotiv-motosiklet",
            name: "Otomotiv & Motosiklet",
            icon: "🚗",
            keywords: ["otomobil", "araba", "motosiklet", "oto"],
            children: [
                {
                    slug: "oto-aksesuar",
                    name: "Oto Aksesuar & Tuning",
                    keywords: ["oto aksesuar", "tuning", "paspas", "koltuk kilifi"],
                    children: [
                        { slug: "oto-ic-aksesuar", name: "Oto İç Aksesuar", keywords: ["oto ic aksesuar", "koltuk kilifi", "direksiyon kilifi"] },
                        { slug: "oto-dis-aksesuar", name: "Oto Dış Aksesuar", keywords: ["oto dis aksesuar", "spoiler", "cam filmi"] },
                        { slug: "oto-bakim", name: "Oto Bakım", keywords: ["oto yikama", "cila", "oto bakim"] },
                        { slug: "oto-guvenlik", name: "Oto Güvenlik", keywords: ["arac kamerasi", "park sensoru", "alarm"] }
                    ]
                },
                {
                    slug: "lastik-jant",
                    name: "Lastik & Jant",
                    keywords: ["lastik", "jant", "oto lastik"],
                    children: []
                },
                {
                    slug: "yedek-parca",
                    name: "Yedek Parça",
                    keywords: ["yedek parca", "far", "egzoz", "fren"],
                    children: []
                },
                {
                    slug: "oto-ses-navigasyon",
                    name: "Oto Ses & Navigasyon",
                    keywords: ["oto ses", "navigasyon", "multimedya", "teyp"],
                    children: []
                },
                {
                    slug: "motosiklet",
                    name: "Motosiklet",
                    keywords: ["motosiklet", "kask", "motosiklet aksesuar"],
                    children: [
                        { slug: "motosiklet-kask", name: "Kask", keywords: ["kask", "motosiklet kask"] },
                        { slug: "motosiklet-kiyafet", name: "Motosiklet Kıyafet", keywords: ["motosiklet mont", "motosiklet eldiven"] },
                        { slug: "motosiklet-yedek-parca", name: "Motosiklet Yedek Parça", keywords: ["motosiklet yedek parca"] }
                    ]
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 15. YAPI MARKET & BAHÇE
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "yapi-market-bahce",
            name: "Yapı Market & Bahçe",
            icon: "🔧",
            keywords: ["yapi market", "bahce", "hirdavat", "nalburiye"],
            children: [
                {
                    slug: "el-aletleri",
                    name: "El Aletleri",
                    keywords: ["el aleti", "tornavida", "pense", "cekic"],
                    children: []
                },
                {
                    slug: "elektrikli-aletler",
                    name: "Elektrikli Aletler",
                    keywords: ["matkap", "taslama", "testere", "vidalama"],
                    children: []
                },
                {
                    slug: "boya-malzemeleri",
                    name: "Boya & Boya Malzemeleri",
                    keywords: ["boya", "vernik", "astar", "rulo"],
                    children: []
                },
                {
                    slug: "bahce-cicek",
                    name: "Bahçe & Çiçek",
                    keywords: ["bahce", "cicek", "fide", "tohum", "saks"],
                    children: [
                        { slug: "bahce-sulama", name: "Bahçe Sulama", keywords: ["hortum", "sulama", "fiskiye"] },
                        { slug: "bahce-makineleri", name: "Bahçe Makineleri", keywords: ["cim bicme", "budama", "bahce makinesi"] },
                        { slug: "bitki-tohum", name: "Bitki & Tohum", keywords: ["tohum", "fide", "cicek tohumu"] }
                    ]
                },
                {
                    slug: "elektrik-tesisat",
                    name: "Elektrik & Tesisat",
                    keywords: ["elektrik", "tesisat", "priz", "kablo", "musluk"],
                    children: []
                },
                {
                    slug: "yapi-malzemeleri",
                    name: "Yapı Malzemeleri",
                    keywords: ["yapi malzemesi", "cimento", "seramik", "izolasyon"],
                    children: []
                },
                {
                    slug: "hirdavat",
                    name: "Hırdavat & Nalburiye",
                    keywords: ["hirdavat", "nalburiye", "vida", "civata", "menteşe"],
                    children: []
                },
                {
                    slug: "havuz-ekipman",
                    name: "Havuz & Ekipmanları",
                    keywords: ["havuz", "havuz kimyasali", "havuz pompasi"],
                    children: []
                },
                {
                    slug: "gunes-enerji",
                    name: "Güneş & Rüzgar Enerjisi",
                    keywords: ["gunes paneli", "solar", "ruzgar enerjisi"],
                    children: []
                }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 16. KIRTASİYE & OFİS
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "kirtasiye-ofis",
            name: "Kırtasiye & Ofis",
            icon: "📝",
            keywords: ["kirtasiye", "ofis", "kalem", "defter"],
            children: [
                { slug: "kalem-yazi-gerecleri", name: "Kalem & Yazı Gereçleri", keywords: ["kalem", "tukenmez", "kursun kalem", "marker"] },
                { slug: "defter-ajanda", name: "Defter & Ajanda", keywords: ["defter", "ajanda", "bloknot"] },
                { slug: "dosyalama-arsivleme", name: "Dosyalama & Arşivleme", keywords: ["dosya", "klasor", "arsivleme"] },
                { slug: "okul-cantasi", name: "Okul Çantaları", keywords: ["okul cantasi", "beslenme cantasi"] },
                { slug: "sanatsal-malzemeler", name: "Sanatsal Malzemeler", keywords: ["boya kalemi", "pastel", "tuval", "resim malzemesi"] },
                { slug: "ofis-makineleri", name: "Ofis Makineleri", keywords: ["hesap makinesi", "etiket makinesi", "laminasyon"] },
                { slug: "kagit-urunleri-kirtasiye", name: "Kağıt Ürünleri", keywords: ["a4 kagit", "fotokopi kagidi", "karton"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 17. KİTAP
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "kitap",
            name: "Kitap",
            icon: "📚",
            keywords: ["kitap", "roman", "edebiyat"],
            children: [
                { slug: "roman-edebiyat", name: "Roman & Edebiyat", keywords: ["roman", "edebiyat", "hikaye", "siir"] },
                { slug: "kisisel-gelisim", name: "Kişisel Gelişim", keywords: ["kisisel gelisim", "motivasyon"] },
                { slug: "cocuk-genclik-kitap", name: "Çocuk & Gençlik Kitapları", keywords: ["cocuk kitabi", "genclik kitabi", "masal"] },
                { slug: "egitim-ders-kitabi", name: "Eğitim & Ders Kitapları", keywords: ["ders kitabi", "sinav kitabi", "egitim"] },
                { slug: "is-ekonomi", name: "İş & Ekonomi", keywords: ["is kitabi", "ekonomi", "finans"] },
                { slug: "din-mitoloji", name: "Din & Mitoloji", keywords: ["din", "mitoloji", "islam"] },
                { slug: "hobi-sanat-kitap", name: "Hobi & Sanat Kitapları", keywords: ["hobi kitabi", "yemek kitabi", "sanat"] },
                { slug: "yabanci-dil-kitap", name: "Yabancı Dil Kitaplar", keywords: ["ingilizce kitap", "yabanci dil"] },
                { slug: "e-kitap-okuyucu", name: "E-Kitap Okuyucu", keywords: ["e-kitap", "kindle", "e-kitap okuyucu"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 18. OYUNCAK & PARTİ
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "oyuncak-parti",
            name: "Oyuncak & Parti",
            icon: "🧸",
            keywords: ["oyuncak", "parti", "lego", "pelus"],
            children: [
                { slug: "egitici-oyuncak", name: "Eğitici Oyuncaklar", keywords: ["egitici oyuncak", "zeka oyunu"] },
                { slug: "pelus-oyuncak", name: "Peluş Oyuncaklar", keywords: ["pelus", "pelus oyuncak"] },
                { slug: "lego-yapi", name: "Lego & Yapı Oyuncakları", keywords: ["lego", "yapi oyuncagi", "puzzle"] },
                { slug: "oyuncak-arac", name: "Oyuncak Araçlar", keywords: ["oyuncak araba", "uzaktan kumandali"] },
                { slug: "oyuncak-bebek", name: "Oyuncak Bebekler", keywords: ["oyuncak bebek", "barbie"] },
                { slug: "akulu-arac", name: "Akülü & Pedallı Araçlar", keywords: ["akulu araba", "pedalli araba"] },
                { slug: "bahce-plaj-oyuncak", name: "Bahçe & Plaj Oyuncakları", keywords: ["bahce oyuncagi", "kum havuzu", "kaydırak"] },
                { slug: "kutu-oyunu", name: "Kutu Oyunları", keywords: ["kutu oyunu", "monopoly", "satranc"] },
                { slug: "parti-malzemeleri", name: "Parti Malzemeleri", keywords: ["balon", "parti", "dogum gunu", "konfeti"] },
                { slug: "figur-oyuncak", name: "Figür Oyuncaklar", keywords: ["figur", "action figure", "koleksiyon"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 19. HOBİ & EĞLENCE
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "hobi-eglence",
            name: "Hobi & Eğlence",
            icon: "🎵",
            keywords: ["hobi", "eglence", "muzik", "film"],
            children: [
                { slug: "muzik-aletleri", name: "Müzik Aletleri", keywords: ["gitar", "piyano", "bateri", "muzik aleti", "enstruman"] },
                { slug: "film-dizi", name: "Film & Dizi", keywords: ["dvd", "blu-ray", "film"] },
                { slug: "muzik-albumu", name: "Müzik Albümleri", keywords: ["plak", "cd", "vinil", "album"] },
                { slug: "maket-model", name: "Maket & Model", keywords: ["maket", "model", "diorama"] },
                { slug: "puzzle-yapboz", name: "Puzzle & Yapboz", keywords: ["puzzle", "yapboz"] },
                { slug: "hobi-malzemeleri", name: "Hobi Malzemeleri", keywords: ["hobi", "el isi", "orgu", "nakis"] },
                { slug: "nargile-tutun", name: "Nargile & Tütün Aksesuarları", keywords: ["nargile", "pipo", "cakmak", "tutun"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 20. EVCİL HAYVAN
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "evcil-hayvan",
            name: "Evcil Hayvan Ürünleri",
            icon: "🐾",
            keywords: ["evcil hayvan", "pet", "kedi", "kopek"],
            children: [
                { slug: "kedi-urunleri", name: "Kedi Ürünleri", keywords: ["kedi mamasi", "kedi kumu", "kedi oyuncagi", "kedi"] },
                { slug: "kopek-urunleri", name: "Köpek Ürünleri", keywords: ["kopek mamasi", "kopek tasma", "kopek"] },
                { slug: "kus-urunleri", name: "Kuş Ürünleri", keywords: ["kus yemi", "kus kafesi", "kus"] },
                { slug: "balik-akvaryum", name: "Balık & Akvaryum", keywords: ["akvaryum", "balik yemi", "balik"] },
                { slug: "kemirgen-urunleri", name: "Kemirgen Ürünleri", keywords: ["kemirgen", "hamster", "tavsan"] },
                { slug: "surungen-urunleri", name: "Sürüngen Ürünleri", keywords: ["surungen", "teraryum", "kaplumbaga"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 21. ÇİÇEK & BİTKİ (ÇiçekSepeti'ne özel)
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "cicek-bitki",
            name: "Çiçek & Bitki",
            icon: "🌸",
            keywords: ["cicek", "bitki", "buket", "orkide", "gul"],
            children: [
                { slug: "buket-cicek", name: "Buket Çiçek", keywords: ["buket", "gul buketi", "cicek buketi"] },
                { slug: "saksi-cicek", name: "Saksı Çiçek", keywords: ["saksi cicek", "orkide", "bonsai", "kaktus"] },
                { slug: "yapay-cicek", name: "Yapay Çiçek", keywords: ["yapay cicek", "dekoratif cicek"] },
                { slug: "celenk", name: "Çelenk", keywords: ["celenk", "cenaze celenk", "dugun celenk"] },
                { slug: "teraryum-minyatur", name: "Teraryum & Minyatür Bahçe", keywords: ["teraryum", "minyatur bahce", "sukulent"] },
                { slug: "yenilebilir-cicek", name: "Yenilebilir Çiçek & Hediye Sepeti", keywords: ["cikolata buketi", "meyve sepeti", "yenilebilir"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 22. DÜĞÜN & ORGANİZASYON
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "dugun-organizasyon",
            name: "Düğün, Davet & Organizasyon",
            icon: "💒",
            keywords: ["dugun", "nisan", "kina", "organizasyon", "davet"],
            children: [
                { slug: "dugun-malzemeleri", name: "Düğün Malzemeleri", keywords: ["dugun", "nikah sekeri", "gelin arabasi"] },
                { slug: "soz-nisan", name: "Söz & Nişan", keywords: ["soz", "nisan", "nisan tepsisi"] },
                { slug: "kina-gecesi", name: "Kına Gecesi", keywords: ["kina", "kina gecesi"] },
                { slug: "ceyiz", name: "Çeyiz", keywords: ["ceyiz", "ceyiz seti", "bohca"] },
                { slug: "parti-organizasyon", name: "Parti & Organizasyon", keywords: ["parti", "dogum gunu", "baby shower"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 23. CİNSEL SAĞLIK
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "cinsel-saglik",
            name: "Cinsel Sağlık",
            icon: "🔞",
            keywords: ["cinsel saglik", "prezervatif", "cinsel urun"],
            children: [
                { slug: "prezervatif", name: "Prezervatif", keywords: ["prezervatif", "kondom"] },
                { slug: "kaydirici-jel", name: "Kayganlaştırıcı", keywords: ["kaydirici", "kayganlaştirici", "jel"] },
                { slug: "cinsel-saglik-urun", name: "Cinsel Sağlık Ürünleri", keywords: ["cinsel saglik", "fantezi"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 24. İKİNCİ EL & KOLEKSİYON
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "ikinci-el-koleksiyon",
            name: "2. El, Antika & Koleksiyon",
            icon: "🏺",
            keywords: ["ikinci el", "antika", "koleksiyon", "vintage"],
            children: [
                { slug: "antika-objeler", name: "Antika Objeler", keywords: ["antika", "antika obje"] },
                { slug: "koleksiyon-urunleri", name: "Koleksiyon Ürünleri", keywords: ["koleksiyon", "pul", "para", "madalya"] },
                { slug: "ikinci-el-elektronik", name: "2. El Elektronik", keywords: ["ikinci el telefon", "ikinci el bilgisayar", "yenilenmis"] },
                { slug: "ikinci-el-kitap", name: "2. El Kitap", keywords: ["ikinci el kitap", "sahaf"] }
            ]
        },

        // ─────────────────────────────────────────────────────────────────────
        // 25. TRAKTÖR & TARIM
        // ─────────────────────────────────────────────────────────────────────
        {
            slug: "traktor-tarim",
            name: "Traktör & Tarım",
            icon: "🚜",
            keywords: ["traktor", "tarim", "hayvancilik"],
            children: [
                { slug: "traktor-yedek-parca", name: "Traktör Yedek Parçaları", keywords: ["traktor yedek parca"] },
                { slug: "traktor-aksesuar", name: "Traktör Aksesuarları", keywords: ["traktor aksesuar"] },
                { slug: "hayvancilik-ekipman", name: "Hayvancılık Ekipmanları", keywords: ["hayvancilik", "sut sagim", "yem"] }
            ]
        }
    ]
};

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI FONKSİYONLAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tüm kategorileri düz liste olarak döndür (flatten)
 * @param {Array} categories
 * @param {string|null} parentSlug
 * @param {number} depth
 * @returns {Array}
 */
const flattenCategories = (categories = UNIFIED_CATEGORY_TEMPLATE.categories, parentSlug = null, depth = 0) => {
    const result = [];
    for (const cat of categories) {
        result.push({
            slug: cat.slug,
            name: cat.name,
            icon: cat.icon || "📁",
            keywords: cat.keywords || [],
            parentSlug,
            depth,
            isLeaf: !cat.children || cat.children.length === 0
        });
        if (cat.children && cat.children.length > 0) {
            result.push(...flattenCategories(cat.children, cat.slug, depth + 1));
        }
    }
    return result;
};

/**
 * Toplam kategori sayısını hesapla
 */
const countCategories = (categories = UNIFIED_CATEGORY_TEMPLATE.categories) => {
    let count = 0;
    for (const cat of categories) {
        count++;
        if (cat.children && cat.children.length > 0) {
            count += countCategories(cat.children);
        }
    }
    return count;
};

/**
 * Slug ile kategori bul
 */
const findBySlug = (slug, categories = UNIFIED_CATEGORY_TEMPLATE.categories) => {
    for (const cat of categories) {
        if (cat.slug === slug) return cat;
        if (cat.children && cat.children.length > 0) {
            const found = findBySlug(slug, cat.children);
            if (found) return found;
        }
    }
    return null;
};

module.exports = {
    UNIFIED_CATEGORY_TEMPLATE,
    flattenCategories,
    countCategories,
    findBySlug
};
