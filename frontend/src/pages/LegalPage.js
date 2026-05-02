/**
 * LegalPage  Gizlilik Politikası, Kullanım Şartları, erez Politikası
 * URL: /privacy, /terms, /cookies
 * Public erişim  auth gerektirmez
 */
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/legal.css";

/* 
   LEGAL CONTENT  Türkçe yasal metinler
    */

const PRIVACY_POLICY = {
    title: "Gizlilik Politikası",
    icon: "",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Giri",
            content: `Pazaryönetim ("Biz", "Bizim", "Platform") olarak, kullanıcılarımızın gizliliçini korumayı en önemli önceliklerimizden biri olarak görüyoruz. Bu Gizlilik Politikası, kiisel verilerİşinizin nasıl toplandıını, kullanıldıını, saklandıını ve korunduunu açıklamaktadır.\n\nBu politika, 6698 sayılı Kiisel Verilerin Korunması Kanunu (KVKK), Avrupa Birlii Genel Veri Koruma Yönetmelii (GDPR) ve ilgili tüm veri koruma mevzuatına tam uyum salamak üzere hazırlanmıtır.`
        },
        {
            title: "2. Veri Sorumlusu",
            content: `Veri Sorumlusu: Pazaryönetim\nAdres: İstanbul, Türkiye\nE-posta: info@pazaryonetim.com\nWeb: https://pazaryonetim.com`
        },
        {
            title: "3. Toplanan Kiisel Veriler",
            content: `Hesap Oluturma Sırasında: Ad ve Soyad, E-posta adresi, Şifre (şifrelenmi olarak saklanır), Telefon numarası (istee balı), Şirket bilgileri (istee balı), Vergi numarası ve vergi dairesi.\n\nKullanım Sırasında: IP adresi, Tarayıcı türü ve versiyonu, İletim sistemi, Cihaz bilgileri, Giri/çıkı zamanları, Sayfa görüntüleme istatistikleri.\n\nİlem Verileri: Pazaryeri entegrasyon bilgileri (API anahtarları şifrelenmi saklanır), rün bilgileri, Sipariş verileri, Fatura bilgileri, deme ilem kayıtlıarı (kâredi kartı bilgileri saklanmaz).`
        },
        {
            title: "4. Kiisel Verilerin Kullanım Amaçları",
            content: `Hizmet Sunumu: Platform hizmetlerinin salanması, Hesap yönetimi ve kimlik doğrulama, Pazaryeri entegrasyonlarının yönetimi, Sipariş ve ürün yönetimi, Fatura ve ödeme ilemlerinin gerçekletirilmesi.\n\nGüvenlik: Hesap güvenliçinin salanması, Dolandırıcılık tespiti ve önlenmesi, Sistem güvenlii ve istikârarının korunması, Hukuki yükümlülüklerin yerine getirilmesi.\n\nAnaliz ve İyiletirme: Hizmet kalitesinin artırılması, Kullanıcı deneyiminin iyiletirilmesi, Yeni özelliklerin geliştirilmesi, İstatistiksel analizler yapılması.`
        },
        {
            title: "5. Kiisel Verilerin Paylaımı",
            content: `Kiisel verileriniz, yalnızca hizmet sunumu için gerekli olduu ölçüde aaıdaki üçüncü taraflarla paylaılabilir:\n\n Bulut Altyapı: Amazon Web Services (AWS)\n deme İlemcisi: PayTR\n E-Fatura: QNB, Sovos, Paraüt, deal\n Kargo: Aras, Yurtiçi, MNG, Sürat\n Pazaryerleri: Trendyol, Hepsiburada, Amazon, N11, içeksepeti\n\nYasal bir zorunluluk olması, mahkeme kararı veya resmi makam talebi halinde yetkili mercilerle paylaılabilir.`
        },
        {
            title: "6. Veri Güvenlii",
            content: `Teknik nlemler: 256-bit SSL/TLS şifreleme, Şifrelerin bcrypt ile hash'lenmesi, API anahtarlarının şifrelenmi saklanması, İki faktörlü kimlik doğrulama (2FA), Düzenli güvenlik güncellemeleri, Güvenlik duvarı koruması, DDoS saldırı koruması, Otomatik yedekleme sistemi.\n\nİdari nlemler: Eriim kontrolü ve yetkilendirme, Personel gizlilik eitimleri, Gizlilik sözlemeleri, Düzenli güvenlik denetimleri, Veri ihlali müdahale planı.\n\nVeri İhlali Bildirimi: İhlal tespit edildiçinde 72 saat içinde Kiisel Verileri Koruma Kurulu'na bildirim yapılır. Etkilenen kullanıcılar derhal bilgilendirilir.`
        },
        {
            title: "7. Kullanıcı Hakları (KVKK & GDPR)",
            content: `Aaıdaki haklara sahipsiniz:\n\n Bilgi Talep Etme: Kiisel verilerİşinizin ilenip ilenmediçini örenme\n Düzeltme Hakkı: Eksik veya yanlı verilerin düzeltilmesini talep etme\n Silme Hakkı: Kiisel verilerİşinizin silinmesini talep etme\n İtiraz Hakkı: Kiisel verilerİşinizin ilenmesine itiraz etme\n Veri Taınabilirlii: Verilerİşinizi yapılandırılmı formatta alma\n Şikayet Hakkı: Kiisel Verileri Koruma Kurulu'na ikayette bulunma\n\nBavurularınız 30 gün içinde ücretsiz olarak yanıtlanır.`
        },
        {
            title: "8. Saklama Süresi",
            content: ` Hesap Verileri: Hesap aktif olduu sürece + 10 yıl (vergi mevzuatı)\n İlem Kayıtları: 10 yıl (ticari kayıt zorunluluu)\n İİletişim Kayıtları: 3 yıl\n Log Kayıtları: 2 yıl\n Pazarlama İzinleri: İzin geri alınana kadar`
        },
        {
            title: "9. Uluslararası Veri Aktarımı",
            content: `Kiisel verileriniz, hizmet salayıcılarımızın sunucularının bulunduu ülkelere aktarılabilir. Veri aktarımı, KVKK ve GDPR gerekliliklerine uygun olarak gerçekletirilir. Yeterli koruma seviyesi olmayan ülkelere aktarım için açık rızanız alınır.`
        },
        {
            title: "10. İİletişim",
            content: `Gizlilik ile ilgili sorularınız için:\n\nE-posta: info@pazaryonetim.com\nVeri Koruma Görevlisi: dpo@pazaryonetim.com\nAdres: Pazaryönetim, İstanbul, Türkiye\n\nKiisel Verileri Koruma Kurulu:\nWeb: https://www.kvkk.gov.tr`
        }
    ]
};

const TERMS_OF_SERVICE = {
    title: "Kullanım Şartları",
    icon: "",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Giriş ve Kapsam",
            content: `Bu Kullanım Şartları, Pazaryönetim platformu ile kullanıcılar arasındaki hukuki ilikiyi düzenler. Platformu kullanarak, bu Kullanım Şartlarını okuduunuzu, anladıınızı ve kabul ettiİşinizi beyan edersiniz.\n\nHizmet Salayıcı: Pazaryönetim, İstanbul, Türkiye\nE-posta: info@pazaryonetim.com\nWeb: https://pazaryonetim.com`
        },
        {
            title: "2. Hesap Oluturma ve Kullanıcı Yükümlülükleri",
            content: `Kayıt Şartları: 18 yaını doldurmu olmanız, doğru ve güncel bilgi salamanız, geçerli bir e-posta adresi kullanmanız gerekir.\n\nHesap Güvenlii: Hesap bilgilerinizin gizliliçinden siz sorumlusunuz. Şifrenizi kimseyle paylamamalısınız. Yetkisiz erişim üphesi durumunda derhal bizi bilgilendirmelisiniz. Hesabınızda gerçekleen tüm faaliyetlerden siz sorumlusunuz.`
        },
        {
            title: "3. Yasak Faaliyetler",
            content: `Teknik Kötüye Kullanım: Platform güvenliçini tehlikeye atmak, sistemlere yetkisiz erişim, zararlı yazılım yüklemek, DDoS saldırısı, API limitlerini amak, ters mühendislik.\n\nİçerik Kötüye Kullanımı: Yasa dıı içerik yüklemek, telif hakkı ihlali, yanıltıcı bilgi, spam, bakalarının verilerini izinsiz kullanmak.\n\nTicari Kötüye Kullanım: Sahte ürün satıı, fiyat manipülasyonu, stok hilesi, yasadıı ticaret.`
        },
        {
            title: "4. Hizmetler ve Paketler",
            content: `Platform aaıdaki hizmetleri sunar: oklu pazaryeri entegrasyonu, rün ve stok yönetimi, Sipariş takibi, Fiyat senkâronizasyonu, Kargo entegrasyonu, E-fatura, Gelişmiş analitik, AI destekli araçlar (LysiaBrain), Fırsat keşfi (LysiaRadar PRO), Finans yönetimi.\n\nPaketler: Trial (14 gün ücretsiz), Starter, Pro, Enterprise. Detaylar fiyatlandırma sayfasında mevcuttur.`
        },
        {
            title: "5. cretler ve deme",
            content: ` Tüm fiyatlar Türk Lirası (TRY) cinsindendir, KDV dahildir\n Abonelikler otomatik olarak yenilenir\n İptal etmediçiniz sürece ücretlendirme devam eder\n Kabul edilen ödeme yöntemleri: Kâredi kartı, Banka kartı, Havale/EFT\n\nİptal: İstediçiniz zaman iptal edebilirsiniz. Mevcut dönem sonunda geçerli olur.\n\nİİade: İlk 14 gün içinde tam iİade (ilk ödeme). Teknik arıza nedeniyle hizmet verilemezse orantılı iİade.`
        },
        {
            title: "6. Fikâri Mülkiyet Hakları",
            content: `Platform ve tüm bileenleri Pazaryönetim'in münhasır mülkiyetindedir: Kaynak kodu, Tasarım ve arayüz, Logo ve ticari markalar, Algoritmalar.\n\nPlatforma yüklediçiniz içerik (ürün bilgileri, görseller, müteri verileri) size aittir. Hizmet sunumu için bize sınırlı bir lisans verirsiniz.\n\nYAPAMAZSINIZ: Platformu kopyalamak, kaynak kodunu çıkarmak, yeniden satmak, rakip ürün geliştirmek için kullanmak.`
        },
        {
            title: "7. Sorumluluk Sınırlamaları",
            content: `Platform "olduu gibi" sunulur. Aaıdaki konularda garanti vermiyoruz: Kesintisiz hizmet, Hatasız çalıma, çüncü taraf hizmetlerin kesintisiz çalıması.\n\nSorumlu DEĞİLİZ: Dolaylı zararlar (kar kaybı, veri kaybı), Pazaryeri API kesintileri, Kargo firması hataları, Kullanıcı hataları.\n\nAzami Sorumluluk: Son 12 ayda ödenen abonelik ücretini amaz.`
        },
        {
            title: "8. Uyumazlık özümü",
            content: `Bu sözleme Türkiye Cumhuriyeti kanunlarına tabidir. Uyumazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.\n\nDava açmadan önce: Müteri hizmetleri ile iİletişime geçin, Arabuluculuk sürecini deneyin, Tüketici Hakem Heyeti'ne bavurabilirsiniz.\n\nDelil Sözlemesi: Elektronik kayıtlıar, e-posta ve platform bildirimleri delil olarak kabul edilir.`
        },
        {
            title: "9. Mesafeli Satı ve Tüketici Hakları",
            content: `6502 sayılı Tüketiçinin Korunması Hakkında Kanun uyarınca: 14 gün cayma hakkı vardır (ilk satın alma). Cayma hakkı kullanıldıında tam iİade yapılır.\n\n6563 sayılı Kanun uyarınca: Pazarlama e-postaları için onay gereklidir. İstediçiniz zaman abonelikten çıkabilirsiniz.`
        },
        {
            title: "10. Genel Hükümler",
            content: `Sözleme Değişiklikleri: nemli değişiklikler 30 gün önceden duyurulur. Devam eden kullanım, değişikliklerin kabulü anlamına gelir.\n\nMücbir Sebepler: Doal afetler, sava, hükümet kararları, internet kesintileri, siber saldırılar, salgın hastalıklar mücbir sebep sayılır.\n\nİİletişim: info@pazaryonetim.com | legal@pazaryonetim.com`
        }
    ]
};

const COOKIE_POLICY = {
    title: "erez Politikası",
    icon: "",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Giri",
            content: `Pazaryönetim olarak, web sitemizde ve uygulamamızda çerezler ve benzeri teknolojiler kullanıyoruz. Bu erez Politikası, hangi çerezleri kullandıımızı, neden kullandıımızı ve çerezleri nasıl kontrol edebileceİşinizi açıklar.\n\nBu politika, KVKK, GDPR ve ilgili elektronik iİletişim mevzuatına uygun olarak hazırlanmıtır.`
        },
        {
            title: "2. erez Nedir?",
            content: `erezler, web sitelerini ziyaret ettiçinizde cihazınıza kaydedilen küçük metin dosyalarıdır. Web sitesinin düzgün çalımasını salar, kullanıcı deneyimini iyiletirir ve analitik bilgi salar.\n\nOturum erezleri: Tarayıcıyı kapattıınızda silinir.\nKalıcı erezler: Belirli bir süre cihazınızda kalır.\nBirinci Taraf: Doğrudan bizim tarafımızdan yerletirilir.\nçüncü Taraf: Ortaklarımız tarafından yerletirilir.`
        },
        {
            title: "3. Zorunlu erezler",
            content: `Bu çerezler platformun temel ilevleri için gereklidir ve devre dıı bırakılamazlar:\n\n token  Kullanıcı oturumu yönetimi (1 gün)\n refreshToken  Oturum yenileme (7 gün)\n rememberMe  "Beni Hatırla" tercihi (30 gün)\n userId, userRole  Kullanıcı kimlii (Oturum)\n XSRF-TOKEN  CSRF koruması (Oturum)\n\nYasal Dayanak: Meru menfaat  Hizmet sunumu için teknik gereklilik`
        },
        {
            title: "4. Performans ve Analitik erezleri",
            content: `Sitemizin nasıl kullanıldıını anlamamıza yardımcı olur. Toplanan veriler anonim ve toplu haldedir.\n\n _ga  Google Analytics, Benzersiz kullanıcı tanımlama (2 yıl)\n _gid  Google Analytics, Benzersiz kullanıcı tanımlama (24 saat)\n _gat  Google Analytics, İstek hızı sınırlama (1 dakika)\n\nYasal Dayanak: Açık rıza (erez banner'ı ile)\nIP anonimletirme aktiftir.`
        },
        {
            title: "5. İlevsellik erezleri",
            content: `Tercihlerİşinizi hatırlamamızı ve kiiselletirilmi deneyim sunmamızı salar:\n\n language  Dil tercihi (1 yıl)\n theme  Tema tercihi (1 yıl)\n currency  Para birimi tercihi (1 yıl)\n timezone  Saat dilimi (1 yıl)\n cookieConsent  erez onay durumu (1 yıl)`
        },
        {
            title: "6. Güvenlik erezleri",
            content: `Hesabınızın güvenliçini salamak için kullanılır:\n\n 2fa_verified  İki faktörlü doğrulama durumu (Oturum)\n login_attempt  Baarısız giriş sayacı (15 dakika)\n device_fingerprint  Cihaz tanımlama (30 gün)\n\nYasal Dayanak: Meru menfaat  Güvenlik ve dolandırıcılık önleme`
        },
        {
            title: "7. erez Yönetimi",
            content: `erez tercihlerİşinizi değiştirmek için:\n\n Platform zerinden: Hesap Ayarları > Gizlilik > erez Tercihleri\n Tarayıcı Ayarları: Chrome, Firefox, Safari, Edge ayarlarından yönetebilirsiniz\n Do Not Track: Tarayıcınızın DNT ayarını etkinletirirseniz analitik ve pazarlama çerezleri devre dıı bırakılır\n\nUyarı: Zorunlu çerezleri silerseniz platformu kullanamayabilirsiniz.`
        },
        {
            title: "8. çüncü Taraf erezleri",
            content: ` Google Analytics: Web sitesi kullanım istatistikleri (Privacy Shield sertifikalı)\n PayTR: Güvenli ödeme ilemi (PCI-DSS uyumlu)\n AWS CloudFront: CDN ve performans\n\nBu hizmetlerin kendi gizlilik politikaları geçerlidir.`
        },
        {
            title: "9. Kullanıcı Hakları",
            content: `erezler ile toplanan veriler için:\n\n Bilgi Talep Etme: Hangi çerezlerin kullanıldıını örenme\n Eriim Hakkı: erez ile toplanan verilere erime\n Silme Hakkı: erezlerin silinmesini talep etme\n İtiraz Hakkı: erez kullanımına itiraz etme\n Şikayet Hakkı: KVKK'ya bavurma`
        },
        {
            title: "10. İİletişim",
            content: `erez kullanımı hakkında sorularınız için:\n\nE-posta: privacy@pazaryonetim.com\nVeri Koruma Görevlisi: dpo@pazaryonetim.com\nAdres: Pazaryönetim, İstanbul, Türkiye\n\nKiisel Verileri Koruma Kurulu:\nWeb: https://www.kvkk.gov.tr`
        }
    ]
};

const DISTANCE_SALES = {
    title: "Mesafeli Satı Sözlemesi",
    icon: "",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Taraflar",
            content: `SATICI:\nUnvan: Pazaryönetim\nAdres: İstanbul, Türkiye\nE-posta: info@pazaryonetim.com\nWeb: https://pazaryonetim.com\n\nALICI:\nPlatformda kayıtlıı kullanıcı bilgileri esas alınır. Alıcının adı, soyadı, adresi, telefon numarası ve e-posta adresi üyelik bilgilerinde kayıtlıı olan bilgilerdir.`
        },
        {
            title: "2. Sözlemenin Konusu",
            content: `İbu sözlemenin konusu, ALICI'nın SATICI'ya ait https://pazaryonetim.com internet sitesinden elektronik ortamda satın aldıı hizmetin satıı ve teslimi ile ilgili olarak 6502 sayılı Tüketiçinin Korunması Hakkında Kanun ve Mesafeli Sözlemeler Yönetmelii hükümleri gereince tarafların hak ve yükümlülüklerinin belirlenmesidir.\n\nALICI, satıa konu hizmet ile ilgili tüm ön bilgiler ve cayma hakkının nasıl kullanılacaı konusunda SATICI tarafından bilgilendirildiçini, bu ön bilgileri elektronik ortamda teyit ettiçini kabul ve beyan eder.`
        },
        {
            title: "3. Hizmet Bilgileri",
            content: `Pazaryönetim, e-ticaret yönetim platformu olarak aaıdaki hizmetleri sunar:\n\n oklu Pazaryeri Entegrasyonu (Trendyol, Hepsiburada, Amazon, N11, içeksepeti)\n rün ve Stok Yönetimi (merkezi katalog, senkâronizasyon)\n Sipariş Takibi (tüm pazaryerlerinden merkezi yönetim)\n Fiyat Senkâronizasyonu (otomatik güncelleme)\n Kargo Entegrasyonu (Aras, Yurtiçi, MNG, Sürat)\n E-Fatura (QNB, Sovos, Paraüt, deal)\n Gelişmiş Analitik ve Raporlama\n AI Destekli Araçlar (LysiaBrain, LysiaRadar PRO)\n Finans Yönetimi (gelir-gider, kâr analizi)\n\nPaketler: Trial (14 gün ücretsiz), Basic, Pro, Enterprise. Fiyatlara KDV dahildir.\ndeme: Kâredi kartı / Banka kartı (PayTR güvenli ödeme, 3D Secure)\nFaturalama: Aylık veya Yıllık abonelik dönemleri`
        },
        {
            title: "4. Genel Hükümler",
            content: ` ALICI, sözleme konusu hizmete ilikin ön bilgileri okuyup bilgi sahibi olduunu ve elektronik ortamda gerekli onayı verdiçini kabul eder.\n Hizmet, ödeme onayından hemen sonra elektronik ortamda sunulmaya balanır.\n SATICI, hizmeti eksiksiz ve belirtilen niteliklere uygun sunmayı taahhüt eder.\n Hizmetin ifasının imkânsızlaması halinde SATICI, 3 gün içinde ALICI'yı bilgilendirir ve 14 gün içinde ödenen bedeli iİade eder.\n ALICI'nın gerekli teknik altyapıya (internet, uyumlu tarayıcı) sahip olması gerekir.`
        },
        {
            title: "5. Satıcının Yükümlülükleri",
            content: ` Hizmeti platformda belirtilen niteliklere uygun sunmak\n Kesintisiz hizmet için makul çabayı göstermek\n Planlı bakım çalımalarını önceden duyurmak\n ALICI'nın kiisel verilerini KVKK kapsamında korumak\n deme güvenliçini PayTR ve 3D Secure ile salamak\n Kâredi kartı bilgilerini sunucularda saklamamak`
        },
        {
            title: "6. Alıcının Yükümlülükleri",
            content: ` Platformu kullanırken Türkiye Cumhuriyeti kanunlarına uygun davranmak\n Kayıt bilgilerinin doğru ve güncel olmasını salamak\n Hesap bilgilerinin güvenliçinden sorumlu olmak\n Platformu amacı dıında kullanmamak, zararlı yazılım yüklememek\n Abonelik ücretlerini zamanında ödemek\n Yönetilen ürün, fiyat ve sipariş bilgilerinin doğruluundan sorumlu olmak`
        },
        {
            title: "7. deme ve Teslimat",
            content: `deme: PayTR güvenli ödeme altyapısı üzerinden kâredi/banka kartı ile yapılır. 3D Secure zorunludur. 256-bit SSL şifreleme ile korunur. Fiyatlara KDV dahildir.\n\nHizmet Teslimatı: Dijital hizmet olması sebebiyle, ödeme onayından hemen sonra hizmet sunulmaya balanır. Fiziksel teslimat söz konusu değildir.\n\nFaturalama: Her baarılı ödeme için e-fatura düzenlenir ve kayıtlıı e-posta adresine gönderilir.`
        },
        {
            title: "8. Cayma Hakkı",
            content: `6502 sayılı Kanun ve Mesafeli Sözlemeler Yönetmelii uyarınca:\n\n Satın alma tarihinden itibaren 14 gün içinde cayma hakkınız vardır\n Herhangi bir gerekçe göstermeden cayabilirsiniz\n Cayma için info@pazaryonetim.com adresine veya platform üzerinden bildirim yapmanız yeterlidir\n Cayma bildirimi ulatıktan sonra 14 gün içinde tam iİade yapılır\n İİade, ödeme yaptıınız karta yapılır, masraf yansıtılmaz\n\nCayma Hakkı İstisnaları (Yönetmelik Madde 15):\n Dijital içerik teslimi: Onayınız ile hizmetin balaması halinde cayma hakkı sona erer\n Hizmetin tamamen ifa edilmesi: Onayınız ile hizmetin tamamlanması halinde cayma hakkı kullanılamaz`
        },
        {
            title: "9. Abonelik ve İptal",
            content: `Abonelik Yenileme: Seçilen dönem sonunda otomatik yenilenir. Yenileme öncesi e-posta bildirimi yapılır.\n\nAbonelik İptali: İstediçiniz zaman iptal edebilirsiniz. İptal, mevcut dönem sonunda geçerli olur. İptal edilen dönem için kısmi iİade yapılmaz (cayma hakkı süresi hariç).\n\nPaket Deiiklii: st pakete yükseltme yapılabilir, fark ücreti hesaplanır. Alt pakete geçi mevcut dönem sonunda gerçekleir.`
        },
        {
            title: "10. Garanti, Sorumluluk ve Uyumazlık",
            content: `Sorumluluk Sınırı: SATICI'nın toplam sorumluluu son 12 ayda ödenen abonelik ücretini aamaz. Dolaylı zararlardan sorumlu tutulamaz.\n\nMücbir Sebepler: Doal afetler, sava, salgın, hükümet kararları, internet kesintileri, siber saldırılar mücbir sebep sayılır.\n\nUyumazlık: Türkiye Cumhuriyeti kanunları uygulanır. İstanbul Mahkemeleri ve İcra Daireleri yetkilidir. Tüketici Hakem Heyetleri ve Tüketici Mahkemelerine bavuru hakkınız saklıdır.\n\nDelil Sözlemesi: SATICI'nın ticari kayıtlıarı, bilgisayar kayıtlıarı, e-posta yazımaları ve platform ilem kayıtlıarı HMK 193. madde anlamında münhasır delil olarak kabul edilir.`
        },
        {
            title: "11. Son Hükümler",
            content: ` Sözleme, elektronik ortamda onaylandıı tarihte yürürlüe girer\n SATICI, sözlemede değişiklik yapma hakkını saklı tutar (30 gün önceden bildirim)\n ALICI, değişiklikleri kabul etmemesi halinde sözlemeyi feshedebilir\n Herhangi bir hükmün geçersiz sayılması dier hükümleri etkilemez\n\nALICI, ibu Mesafeli Satı Sözlemesi'nin tüm maddelerini okuduunu, anladıını ve kabul ettiçini, n Bilgilendirme Formu'nu teslim aldıını beyan eder.\n\nİİletişim: info@pazaryonetim.com | legal@pazaryonetim.com`
        }
    ]
};

const PRELIMINARY_INFO = {
    title: "n Bilgilendirme Formu",
    icon: "",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Satıcı Bilgileri",
            content: `Ticari Unvan: Pazaryönetim\nAdres: İstanbul, Türkiye\nTelefon: Platformda belirtilen iİletişim numarası\nE-posta: info@pazaryonetim.com\nWeb Sitesi: https://pazaryonetim.com`
        },
        {
            title: "2. Alıcı Bilgileri",
            content: `Alıcı bilgileri, platformda kayıtlıı üyelik bilgilerinden alınır:\n\n Ad Soyad / Ticari Unvan: yelik kaydında belirtilen\n Adres: yelik kaydında belirtilen\n Telefon: yelik kaydında belirtilen\n E-posta: yelik kaydında belirtilen`
        },
        {
            title: "3. Hizmet Tanımı",
            content: `Hizmet Adı: Pazaryönetim E-Ticaret Yönetim Platformu\nHizmet Türü: Dijital Hizmet (SaaS  Software as a Service)\n\nPazaryönetim, e-ticaret iletmelerinin çoklu pazaryeri yönetimini tek bir platformdan gerçekletirmesini salayan bulut tabanlı bir yazılım hizmetidir.\n\nTemel özellikler:\n Pazaryeri Entegrasyonları (Trendyol, Hepsiburada, Amazon, N11, içeksepeti)\n rün Yönetimi (merkezi katalog, toplu yükleme, stok/fiyat senkâronizasyonu)\n Sipariş Yönetimi (merkezi toplama, otomatik ileme, iptal/iİade yönetimi)\n Kargo Entegrasyonları (Aras, Yurtiçi, MNG, Sürat)\n E-Fatura Entegrasyonları (QNB, Sovos, Paraüt, deal)\n Analitik ve Raporlama (satı, performans, kâr-zarar)\n AI Araçları (LysiaBrain asistan, LysiaRadar PRO fırsat keşfi)\n Finans Yönetimi (gelir-gider, kâr analizi)`
        },
        {
            title: "4. Abonelik Paketleri",
            content: `TRIAL (DEMO): 14 gün ücretsiz  100 ürün, 1.000 sipariş/ay, 2 pazaryeri\n\nBASIC (STARTER): 299/ay veya 2.990/yıl (KDV dahil)  500 ürün, 5.000 sipariş/ay, 3 pazaryeri, e-fatura, öncelikli destek\n\nPRO ⭐: 599/ay veya 5.990/yıl (KDV dahil)  2.000 ürün, 20.000 sipariş/ay, 5 pazaryeri, tüm entegrasyonlar, 7/24 destek, AI araçları, finans modülü\n\nENTERPRISE: 1.299/ay veya 12.990/yıl (KDV dahil)  Sınırsız her ey, özel hesap yöneticisi, SLA garantisi\n\nNOT: Güncel fiyatlar platformun fiyatlandırma sayfasında görüntülenir. Fiyatlar sistem ayarlarından dinamik olarak yönetilir.`
        },
        {
            title: "5. deme Bilgileri",
            content: `Toplam cret: Seçilen pakete göre (KDV dahil)\ndeme Yöntemi: Kâredi kartı veya Banka kartı\ndeme Altyapısı: PayTR güvenli ödeme sistemi\nGüvenlik: 3D Secure doğrulama zorunlu, 256-bit SSL/TLS şifreleme\nKart Bilgileri: SATICI'nın sunucularında saklanmaz\n\nFaturalama: Elektronik fatura (e-Fatura), e-posta ile gönderilir\nKDV: Tüm fiyatlara dahildir\n\nOtomatik Yenileme: Abonelikler dönem sonunda otomatik yenilenir. Yenileme öncesi e-posta bildirimi yapılır. İptal etmediçiniz sürece devam eder.`
        },
        {
            title: "6. Teslimat",
            content: `Teslimat Şekli: Dijital ortamda, internet üzerinden\nTeslimat Süresi: deme onayından hemen sonra (anlık)\nEriim: Web tarayıcısı üzerinden (Chrome, Firefox, Safari, Edge)\nGereksinimler: İnternet bağlantısı, güncel web tarayıcısı\n\nDijital hizmet olması sebebiyle fiziksel teslimat söz konusu değildir.`
        },
        {
            title: "7. Cayma Hakkı",
            content: `6502 sayılı Kanun ve Mesafeli Sözlemeler Yönetmelii uyarınca:\n\n Satın alma tarihinden itibaren 14 gün içinde cayma hakkınız vardır\n Herhangi bir gerekçe göstermeden ve cezai art ödemeden cayabilirsiniz\n Cayma için info@pazaryonetim.com adresine veya platform üzerinden bildirim yapın\n 14 gün içinde tam iİade yapılır, masraf yansıtılmaz\n\nİstisna: Onayınız ile dijital içeriçin sunulmaya balaması halinde cayma hakkı sona erer. Hizmetin derhal balamasını talep ettiçinizde ve platformu kullanmaya baladıınızda bunu kabul etmi olursunuz.`
        },
        {
            title: "8. Tüketici Hakları ve Şikâyet Mercileri",
            content: `Tüketici Hakem Heyetleri: Parasal sınırlar dahilinde bavurabilirsiniz (ücretsiz)\nTüketici Mahkemeleri: Parasal sınırları aan uyumazlıklar için\nTicaret Bakanlıı: Tüketici İİletişim Merkezi (TİM): 1512\nKVKK: https://www.kvkk.gov.tr\n\nYetkili Mahkeme: İstanbul Mahkemeleri ve İcra Daireleri`
        },
        {
            title: "9. Alıcı Beyanı",
            content: `ALICI, ibu n Bilgilendirme Formu'nu okuyarak aaıdaki hususları kabul ve beyan eder:\n\n Satıcının unvan, adres, telefon ve e-posta bilgilerini örendim\n Hizmetin temel niteliklerini, içeriçini ve kapsamını örendim\n Hizmetin toplam fiyatını (vergiler dahil) örendim\n deme eklini ve planını örendim\n Hizmetin dijital ortamda sunulacaını ve teslimat süresini örendim\n 14 gün cayma hakkımın olduunu ve nasıl kullanacaımı örendim\n Dijital içeriçin sunulmaya balaması ile cayma hakkımın sona ereceini örendim\n Aboneliklerin otomatik yenilendiçini örendim\n Şikâyet bavuru mercilerini örendim\n Bu ön bilgilendirme formunu elektronik ortamda teslim aldım\n Mesafeli Satı Sözlemesi'ni okudum ve kabul ettim\n\nOnay Yöntemi: Platform üzerinden elektronik onay`
        },
        {
            title: "10. İİletişim",
            content: `Genel Sorular: info@pazaryonetim.com\nTeknik Destek: support@pazaryonetim.com (7/24 canlı destek)\nHukuki Konular: legal@pazaryonetim.com\nVeri Koruma: dpo@pazaryonetim.com\n\nalıma Saatleri: Pazartesi-Cuma 09:00-18:00\nAcil Destek: 7/24 mevcuttur\n\nBu form, 6502 sayılı Tüketiçinin Korunması Hakkında Kanun ve Mesafeli Sözlemeler Yönetmelii hükümlerine uygun olarak hazırlanmıtır.`
        }
    ]
};

const LEGAL_MAP = {
    "/privacy": PRIVACY_POLICY,
    "/terms": TERMS_OF_SERVICE,
    "/cookies": COOKIE_POLICY,
    "/distance-sales": DISTANCE_SALES,
    "/preliminary-info": PRELIMINARY_INFO,
};

/* 
   COMPONENT
    */
const LegalPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState(0);

    const doc = LEGAL_MAP[location.pathname];

    useEffect(() => {
        setActiveSection(0);
        window.scrollTo(0, 0);
    }, [location.pathname]);

    if (!doc) {
        return (
            <div className="legal-page">
                <div className="legal-container">
                    <h1>Sayfa Bulunamadı</h1>
                    <button className="legal-back-btn" onClick={() => navigate("/")}>Ana Sayfaya Dön</button>
                </div>
            </div>
        );
    }

    return (
        <div className="legal-page">
            {/* Header */}
            <div className="legal-header">
                <div className="legal-header-inner">
                    <button className="legal-back-btn" onClick={() => navigate(-1)}>
                         Geri
                    </button>
                    <div className="legal-header-title">
                        <span className="legal-header-icon">{doc.icon}</span>
                        <h1>{doc.title}</h1>
                    </div>
                    <div className="legal-header-meta">
                        Son Güncelleme: {doc.lastUpdate}
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="legal-nav">
                <div className="legal-nav-tabs">
                    <button
                        className={`legal-nav-tab${location.pathname === "/privacy" ? " active" : ""}`}
                        onClick={() => navigate("/privacy")}
                    >
                         Gizlilik Politikası
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/terms" ? " active" : ""}`}
                        onClick={() => navigate("/terms")}
                    >
                         Kullanım Şartları
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/cookies" ? " active" : ""}`}
                        onClick={() => navigate("/cookies")}
                    >
                         erez Politikası
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/distance-sales" ? " active" : ""}`}
                        onClick={() => navigate("/distance-sales")}
                    >
                         Mesafeli Satı Sözlemesi
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/preliminary-info" ? " active" : ""}`}
                        onClick={() => navigate("/preliminary-info")}
                    >
                         n Bilgilendirme Formu
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="legal-content">
                {/* Sidebar TOC */}
                <div className="legal-sidebar">
                    <div className="legal-toc-title">İçindekiler</div>
                    {doc.sections.map((s, i) => (
                        <button
                            key={i}
                            className={`legal-toc-item${activeSection === i ? " active" : ""}`}
                            onClick={() => {
                                setActiveSection(i);
                                document.getElementById(`legal-section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                        >
                            {s.title}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="legal-main">
                    {doc.sections.map((s, i) => (
                        <div key={i} id={`legal-section-${i}`} className="legal-section">
                            <h2 className="legal-section-title">{s.title}</h2>
                            <div className="legal-section-content">
                                {s.content.split("\n").map((line, li) => (
                                    <p key={li}>{line}</p>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Footer */}
                    <div className="legal-doc-footer">
                        <p>Bu belge yasal olarak balayıcıdır. Sorularınız için <strong>info@pazaryonetim.com</strong> adresine bavurabilirsiniz.</p>
                        <p>© {new Date().getFullYear()} Pazaryönetim. Tüm hakları saklıdır.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegalPage;

