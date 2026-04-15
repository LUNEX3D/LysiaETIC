/**
 * LegalPage — Gizlilik Politikası, Kullanım Şartları, Çerez Politikası
 * URL: /privacy, /terms, /cookies
 * Public erişim — auth gerektirmez
 */
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/legal.css";

/* ═══════════════════════════════════════════════════════════════════════════
   LEGAL CONTENT — Türkçe yasal metinler
   ═══════════════════════════════════════════════════════════════════════════ */

const PRIVACY_POLICY = {
    title: "Gizlilik Politikası",
    icon: "🔒",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Giriş",
            content: `LysiaETIC ("Biz", "Bizim", "Platform") olarak, kullanıcılarımızın gizliliğini korumayı en önemli önceliklerimizden biri olarak görüyoruz. Bu Gizlilik Politikası, kişisel verilerinizin nasıl toplandığını, kullanıldığını, saklandığını ve korunduğunu açıklamaktadır.\n\nBu politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK), Avrupa Birliği Genel Veri Koruma Yönetmeliği (GDPR) ve ilgili tüm veri koruma mevzuatına tam uyum sağlamak üzere hazırlanmıştır.`
        },
        {
            title: "2. Veri Sorumlusu",
            content: `Veri Sorumlusu: LysiaETIC\nAdres: İstanbul, Türkiye\nE-posta: info@lysiaetic.com\nWeb: https://lunexetic.com`
        },
        {
            title: "3. Toplanan Kişisel Veriler",
            content: `Hesap Oluşturma Sırasında: Ad ve Soyad, E-posta adresi, Şifre (şifrelenmiş olarak saklanır), Telefon numarası (isteğe bağlı), Şirket bilgileri (isteğe bağlı), Vergi numarası ve vergi dairesi.\n\nKullanım Sırasında: IP adresi, Tarayıcı türü ve versiyonu, İşletim sistemi, Cihaz bilgileri, Giriş/çıkış zamanları, Sayfa görüntüleme istatistikleri.\n\nİşlem Verileri: Pazaryeri entegrasyon bilgileri (API anahtarları şifrelenmiş saklanır), Ürün bilgileri, Sipariş verileri, Fatura bilgileri, Ödeme işlem kayıtları (kredi kartı bilgileri saklanmaz).`
        },
        {
            title: "4. Kişisel Verilerin Kullanım Amaçları",
            content: `Hizmet Sunumu: Platform hizmetlerinin sağlanması, Hesap yönetimi ve kimlik doğrulama, Pazaryeri entegrasyonlarının yönetimi, Sipariş ve ürün yönetimi, Fatura ve ödeme işlemlerinin gerçekleştirilmesi.\n\nGüvenlik: Hesap güvenliğinin sağlanması, Dolandırıcılık tespiti ve önlenmesi, Sistem güvenliği ve istikrarının korunması, Hukuki yükümlülüklerin yerine getirilmesi.\n\nAnaliz ve İyileştirme: Hizmet kalitesinin artırılması, Kullanıcı deneyiminin iyileştirilmesi, Yeni özelliklerin geliştirilmesi, İstatistiksel analizler yapılması.`
        },
        {
            title: "5. Kişisel Verilerin Paylaşımı",
            content: `Kişisel verileriniz, yalnızca hizmet sunumu için gerekli olduğu ölçüde aşağıdaki üçüncü taraflarla paylaşılabilir:\n\n• Bulut Altyapı: Amazon Web Services (AWS)\n• Ödeme İşlemcisi: PayTR\n• E-Fatura: QNB, Sovos, Paraşüt, Ödeal\n• Kargo: Aras, Yurtiçi, MNG, Sürat\n• Pazaryerleri: Trendyol, Hepsiburada, Amazon, N11, Çiçeksepeti\n\nYasal bir zorunluluk olması, mahkeme kararı veya resmi makam talebi halinde yetkili mercilerle paylaşılabilir.`
        },
        {
            title: "6. Veri Güvenliği",
            content: `Teknik Önlemler: 256-bit SSL/TLS şifreleme, Şifrelerin bcrypt ile hash'lenmesi, API anahtarlarının şifrelenmiş saklanması, İki faktörlü kimlik doğrulama (2FA), Düzenli güvenlik güncellemeleri, Güvenlik duvarı koruması, DDoS saldırı koruması, Otomatik yedekleme sistemi.\n\nİdari Önlemler: Erişim kontrolü ve yetkilendirme, Personel gizlilik eğitimleri, Gizlilik sözleşmeleri, Düzenli güvenlik denetimleri, Veri ihlali müdahale planı.\n\nVeri İhlali Bildirimi: İhlal tespit edildiğinde 72 saat içinde Kişisel Verileri Koruma Kurulu'na bildirim yapılır. Etkilenen kullanıcılar derhal bilgilendirilir.`
        },
        {
            title: "7. Kullanıcı Hakları (KVKK & GDPR)",
            content: `Aşağıdaki haklara sahipsiniz:\n\n• Bilgi Talep Etme: Kişisel verilerinizin işlenip işlenmediğini öğrenme\n• Düzeltme Hakkı: Eksik veya yanlış verilerin düzeltilmesini talep etme\n• Silme Hakkı: Kişisel verilerinizin silinmesini talep etme\n• İtiraz Hakkı: Kişisel verilerinizin işlenmesine itiraz etme\n• Veri Taşınabilirliği: Verilerinizi yapılandırılmış formatta alma\n• Şikayet Hakkı: Kişisel Verileri Koruma Kurulu'na şikayette bulunma\n\nBaşvurularınız 30 gün içinde ücretsiz olarak yanıtlanır.`
        },
        {
            title: "8. Saklama Süresi",
            content: `• Hesap Verileri: Hesap aktif olduğu sürece + 10 yıl (vergi mevzuatı)\n• İşlem Kayıtları: 10 yıl (ticari kayıt zorunluluğu)\n• İletişim Kayıtları: 3 yıl\n• Log Kayıtları: 2 yıl\n• Pazarlama İzinleri: İzin geri alınana kadar`
        },
        {
            title: "9. Uluslararası Veri Aktarımı",
            content: `Kişisel verileriniz, hizmet sağlayıcılarımızın sunucularının bulunduğu ülkelere aktarılabilir. Veri aktarımı, KVKK ve GDPR gerekliliklerine uygun olarak gerçekleştirilir. Yeterli koruma seviyesi olmayan ülkelere aktarım için açık rızanız alınır.`
        },
        {
            title: "10. İletişim",
            content: `Gizlilik ile ilgili sorularınız için:\n\nE-posta: info@lysiaetic.com\nVeri Koruma Görevlisi: dpo@lysiaetic.com\nAdres: LysiaETIC, İstanbul, Türkiye\n\nKişisel Verileri Koruma Kurulu:\nWeb: https://www.kvkk.gov.tr`
        }
    ]
};

const TERMS_OF_SERVICE = {
    title: "Kullanım Şartları",
    icon: "📋",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Giriş ve Kapsam",
            content: `Bu Kullanım Şartları, LysiaETIC platformu ile kullanıcılar arasındaki hukuki ilişkiyi düzenler. Platformu kullanarak, bu Kullanım Şartlarını okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz.\n\nHizmet Sağlayıcı: LysiaETIC, İstanbul, Türkiye\nE-posta: info@lysiaetic.com\nWeb: https://lunexetic.com`
        },
        {
            title: "2. Hesap Oluşturma ve Kullanıcı Yükümlülükleri",
            content: `Kayıt Şartları: 18 yaşını doldurmuş olmanız, doğru ve güncel bilgi sağlamanız, geçerli bir e-posta adresi kullanmanız gerekir.\n\nHesap Güvenliği: Hesap bilgilerinizin gizliliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmamalısınız. Yetkisiz erişim şüphesi durumunda derhal bizi bilgilendirmelisiniz. Hesabınızda gerçekleşen tüm faaliyetlerden siz sorumlusunuz.`
        },
        {
            title: "3. Yasak Faaliyetler",
            content: `Teknik Kötüye Kullanım: Platform güvenliğini tehlikeye atmak, sistemlere yetkisiz erişim, zararlı yazılım yüklemek, DDoS saldırısı, API limitlerini aşmak, ters mühendislik.\n\nİçerik Kötüye Kullanımı: Yasa dışı içerik yüklemek, telif hakkı ihlali, yanıltıcı bilgi, spam, başkalarının verilerini izinsiz kullanmak.\n\nTicari Kötüye Kullanım: Sahte ürün satışı, fiyat manipülasyonu, stok hilesi, yasadışı ticaret.`
        },
        {
            title: "4. Hizmetler ve Paketler",
            content: `Platform aşağıdaki hizmetleri sunar: Çoklu pazaryeri entegrasyonu, Ürün ve stok yönetimi, Sipariş takibi, Fiyat senkronizasyonu, Kargo entegrasyonu, E-fatura, Gelişmiş analitik, AI destekli araçlar (LysiaBrain), Fırsat keşfi (LysiaRadar PRO), Finans yönetimi.\n\nPaketler: Trial (14 gün ücretsiz), Starter, Pro, Enterprise. Detaylar fiyatlandırma sayfasında mevcuttur.`
        },
        {
            title: "5. Ücretler ve Ödeme",
            content: `• Tüm fiyatlar Türk Lirası (TRY) cinsindendir, KDV dahildir\n• Abonelikler otomatik olarak yenilenir\n• İptal etmediğiniz sürece ücretlendirme devam eder\n• Kabul edilen ödeme yöntemleri: Kredi kartı, Banka kartı, Havale/EFT\n\nİptal: İstediğiniz zaman iptal edebilirsiniz. Mevcut dönem sonunda geçerli olur.\n\nİade: İlk 14 gün içinde tam iade (ilk ödeme). Teknik arıza nedeniyle hizmet verilemezse orantılı iade.`
        },
        {
            title: "6. Fikri Mülkiyet Hakları",
            content: `Platform ve tüm bileşenleri LysiaETIC'in münhasır mülkiyetindedir: Kaynak kodu, Tasarım ve arayüz, Logo ve ticari markalar, Algoritmalar.\n\nPlatforma yüklediğiniz içerik (ürün bilgileri, görseller, müşteri verileri) size aittir. Hizmet sunumu için bize sınırlı bir lisans verirsiniz.\n\nYAPAMAZSINIZ: Platformu kopyalamak, kaynak kodunu çıkarmak, yeniden satmak, rakip ürün geliştirmek için kullanmak.`
        },
        {
            title: "7. Sorumluluk Sınırlamaları",
            content: `Platform "olduğu gibi" sunulur. Aşağıdaki konularda garanti vermiyoruz: Kesintisiz hizmet, Hatasız çalışma, Üçüncü taraf hizmetlerin kesintisiz çalışması.\n\nSorumlu DEĞİLİZ: Dolaylı zararlar (kar kaybı, veri kaybı), Pazaryeri API kesintileri, Kargo firması hataları, Kullanıcı hataları.\n\nAzami Sorumluluk: Son 12 ayda ödenen abonelik ücretini aşmaz.`
        },
        {
            title: "8. Uyuşmazlık Çözümü",
            content: `Bu sözleşme Türkiye Cumhuriyeti kanunlarına tabidir. Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.\n\nDava açmadan önce: Müşteri hizmetleri ile iletişime geçin, Arabuluculuk sürecini deneyin, Tüketici Hakem Heyeti'ne başvurabilirsiniz.\n\nDelil Sözleşmesi: Elektronik kayıtlar, e-posta ve platform bildirimleri delil olarak kabul edilir.`
        },
        {
            title: "9. Mesafeli Satış ve Tüketici Hakları",
            content: `6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca: 14 gün cayma hakkı vardır (ilk satın alma). Cayma hakkı kullanıldığında tam iade yapılır.\n\n6563 sayılı Kanun uyarınca: Pazarlama e-postaları için onay gereklidir. İstediğiniz zaman abonelikten çıkabilirsiniz.`
        },
        {
            title: "10. Genel Hükümler",
            content: `Sözleşme Değişiklikleri: Önemli değişiklikler 30 gün önceden duyurulur. Devam eden kullanım, değişikliklerin kabulü anlamına gelir.\n\nMücbir Sebepler: Doğal afetler, savaş, hükümet kararları, internet kesintileri, siber saldırılar, salgın hastalıklar mücbir sebep sayılır.\n\nİletişim: info@lysiaetic.com | legal@lysiaetic.com`
        }
    ]
};

const COOKIE_POLICY = {
    title: "Çerez Politikası",
    icon: "🍪",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Giriş",
            content: `LysiaETIC olarak, web sitemizde ve uygulamamızda çerezler ve benzeri teknolojiler kullanıyoruz. Bu Çerez Politikası, hangi çerezleri kullandığımızı, neden kullandığımızı ve çerezleri nasıl kontrol edebileceğinizi açıklar.\n\nBu politika, KVKK, GDPR ve ilgili elektronik iletişim mevzuatına uygun olarak hazırlanmıştır.`
        },
        {
            title: "2. Çerez Nedir?",
            content: `Çerezler, web sitelerini ziyaret ettiğinizde cihazınıza kaydedilen küçük metin dosyalarıdır. Web sitesinin düzgün çalışmasını sağlar, kullanıcı deneyimini iyileştirir ve analitik bilgi sağlar.\n\nOturum Çerezleri: Tarayıcıyı kapattığınızda silinir.\nKalıcı Çerezler: Belirli bir süre cihazınızda kalır.\nBirinci Taraf: Doğrudan bizim tarafımızdan yerleştirilir.\nÜçüncü Taraf: Ortaklarımız tarafından yerleştirilir.`
        },
        {
            title: "3. Zorunlu Çerezler",
            content: `Bu çerezler platformun temel işlevleri için gereklidir ve devre dışı bırakılamazlar:\n\n• token — Kullanıcı oturumu yönetimi (1 gün)\n• refreshToken — Oturum yenileme (7 gün)\n• rememberMe — "Beni Hatırla" tercihi (30 gün)\n• userId, userRole — Kullanıcı kimliği (Oturum)\n• XSRF-TOKEN — CSRF koruması (Oturum)\n\nYasal Dayanak: Meşru menfaat — Hizmet sunumu için teknik gereklilik`
        },
        {
            title: "4. Performans ve Analitik Çerezleri",
            content: `Sitemizin nasıl kullanıldığını anlamamıza yardımcı olur. Toplanan veriler anonim ve toplu haldedir.\n\n• _ga — Google Analytics, Benzersiz kullanıcı tanımlama (2 yıl)\n• _gid — Google Analytics, Benzersiz kullanıcı tanımlama (24 saat)\n• _gat — Google Analytics, İstek hızı sınırlama (1 dakika)\n\nYasal Dayanak: Açık rıza (Çerez banner'ı ile)\nIP anonimleştirme aktiftir.`
        },
        {
            title: "5. İşlevsellik Çerezleri",
            content: `Tercihlerinizi hatırlamamızı ve kişiselleştirilmiş deneyim sunmamızı sağlar:\n\n• language — Dil tercihi (1 yıl)\n• theme — Tema tercihi (1 yıl)\n• currency — Para birimi tercihi (1 yıl)\n• timezone — Saat dilimi (1 yıl)\n• cookieConsent — Çerez onay durumu (1 yıl)`
        },
        {
            title: "6. Güvenlik Çerezleri",
            content: `Hesabınızın güvenliğini sağlamak için kullanılır:\n\n• 2fa_verified — İki faktörlü doğrulama durumu (Oturum)\n• login_attempt — Başarısız giriş sayacı (15 dakika)\n• device_fingerprint — Cihaz tanımlama (30 gün)\n\nYasal Dayanak: Meşru menfaat — Güvenlik ve dolandırıcılık önleme`
        },
        {
            title: "7. Çerez Yönetimi",
            content: `Çerez tercihlerinizi değiştirmek için:\n\n• Platform Üzerinden: Hesap Ayarları > Gizlilik > Çerez Tercihleri\n• Tarayıcı Ayarları: Chrome, Firefox, Safari, Edge ayarlarından yönetebilirsiniz\n• Do Not Track: Tarayıcınızın DNT ayarını etkinleştirirseniz analitik ve pazarlama çerezleri devre dışı bırakılır\n\nUyarı: Zorunlu çerezleri silerseniz platformu kullanamayabilirsiniz.`
        },
        {
            title: "8. Üçüncü Taraf Çerezleri",
            content: `• Google Analytics: Web sitesi kullanım istatistikleri (Privacy Shield sertifikalı)\n• PayTR: Güvenli ödeme işlemi (PCI-DSS uyumlu)\n• AWS CloudFront: CDN ve performans\n\nBu hizmetlerin kendi gizlilik politikaları geçerlidir.`
        },
        {
            title: "9. Kullanıcı Hakları",
            content: `Çerezler ile toplanan veriler için:\n\n• Bilgi Talep Etme: Hangi çerezlerin kullanıldığını öğrenme\n• Erişim Hakkı: Çerez ile toplanan verilere erişme\n• Silme Hakkı: Çerezlerin silinmesini talep etme\n• İtiraz Hakkı: Çerez kullanımına itiraz etme\n• Şikayet Hakkı: KVKK'ya başvurma`
        },
        {
            title: "10. İletişim",
            content: `Çerez kullanımı hakkında sorularınız için:\n\nE-posta: privacy@lysiaetic.com\nVeri Koruma Görevlisi: dpo@lysiaetic.com\nAdres: LysiaETIC, İstanbul, Türkiye\n\nKişisel Verileri Koruma Kurulu:\nWeb: https://www.kvkk.gov.tr`
        }
    ]
};

const DISTANCE_SALES = {
    title: "Mesafeli Satış Sözleşmesi",
    icon: "📝",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Taraflar",
            content: `SATICI:\nUnvan: LysiaETIC\nAdres: İstanbul, Türkiye\nE-posta: info@lysiaetic.com\nWeb: https://lunexetic.com\n\nALICI:\nPlatformda kayıtlı kullanıcı bilgileri esas alınır. Alıcının adı, soyadı, adresi, telefon numarası ve e-posta adresi üyelik bilgilerinde kayıtlı olan bilgilerdir.`
        },
        {
            title: "2. Sözleşmenin Konusu",
            content: `İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait https://lunexetic.com internet sitesinden elektronik ortamda satın aldığı hizmetin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir.\n\nALICI, satışa konu hizmet ile ilgili tüm ön bilgiler ve cayma hakkının nasıl kullanılacağı konusunda SATICI tarafından bilgilendirildiğini, bu ön bilgileri elektronik ortamda teyit ettiğini kabul ve beyan eder.`
        },
        {
            title: "3. Hizmet Bilgileri",
            content: `LysiaETIC, e-ticaret yönetim platformu olarak aşağıdaki hizmetleri sunar:\n\n• Çoklu Pazaryeri Entegrasyonu (Trendyol, Hepsiburada, Amazon, N11, Çiçeksepeti)\n• Ürün ve Stok Yönetimi (merkezi katalog, senkronizasyon)\n• Sipariş Takibi (tüm pazaryerlerinden merkezi yönetim)\n• Fiyat Senkronizasyonu (otomatik güncelleme)\n• Kargo Entegrasyonu (Aras, Yurtiçi, MNG, Sürat)\n• E-Fatura (QNB, Sovos, Paraşüt, Ödeal)\n• Gelişmiş Analitik ve Raporlama\n• AI Destekli Araçlar (LysiaBrain, LysiaRadar PRO)\n• Finans Yönetimi (gelir-gider, kâr analizi)\n\nPaketler: Trial (14 gün ücretsiz), Basic, Pro, Enterprise. Fiyatlara KDV dahildir.\nÖdeme: Kredi kartı / Banka kartı (PayTR güvenli ödeme, 3D Secure)\nFaturalama: Aylık veya Yıllık abonelik dönemleri`
        },
        {
            title: "4. Genel Hükümler",
            content: `• ALICI, sözleşme konusu hizmete ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli onayı verdiğini kabul eder.\n• Hizmet, ödeme onayından hemen sonra elektronik ortamda sunulmaya başlanır.\n• SATICI, hizmeti eksiksiz ve belirtilen niteliklere uygun sunmayı taahhüt eder.\n• Hizmetin ifasının imkânsızlaşması halinde SATICI, 3 gün içinde ALICI'yı bilgilendirir ve 14 gün içinde ödenen bedeli iade eder.\n• ALICI'nın gerekli teknik altyapıya (internet, uyumlu tarayıcı) sahip olması gerekir.`
        },
        {
            title: "5. Satıcının Yükümlülükleri",
            content: `• Hizmeti platformda belirtilen niteliklere uygun sunmak\n• Kesintisiz hizmet için makul çabayı göstermek\n• Planlı bakım çalışmalarını önceden duyurmak\n• ALICI'nın kişisel verilerini KVKK kapsamında korumak\n• Ödeme güvenliğini PayTR ve 3D Secure ile sağlamak\n• Kredi kartı bilgilerini sunucularda saklamamak`
        },
        {
            title: "6. Alıcının Yükümlülükleri",
            content: `• Platformu kullanırken Türkiye Cumhuriyeti kanunlarına uygun davranmak\n• Kayıt bilgilerinin doğru ve güncel olmasını sağlamak\n• Hesap bilgilerinin güvenliğinden sorumlu olmak\n• Platformu amacı dışında kullanmamak, zararlı yazılım yüklememek\n• Abonelik ücretlerini zamanında ödemek\n• Yönetilen ürün, fiyat ve sipariş bilgilerinin doğruluğundan sorumlu olmak`
        },
        {
            title: "7. Ödeme ve Teslimat",
            content: `Ödeme: PayTR güvenli ödeme altyapısı üzerinden kredi/banka kartı ile yapılır. 3D Secure zorunludur. 256-bit SSL şifreleme ile korunur. Fiyatlara KDV dahildir.\n\nHizmet Teslimatı: Dijital hizmet olması sebebiyle, ödeme onayından hemen sonra hizmet sunulmaya başlanır. Fiziksel teslimat söz konusu değildir.\n\nFaturalama: Her başarılı ödeme için e-fatura düzenlenir ve kayıtlı e-posta adresine gönderilir.`
        },
        {
            title: "8. Cayma Hakkı",
            content: `6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca:\n\n• Satın alma tarihinden itibaren 14 gün içinde cayma hakkınız vardır\n• Herhangi bir gerekçe göstermeden cayabilirsiniz\n• Cayma için info@lysiaetic.com adresine veya platform üzerinden bildirim yapmanız yeterlidir\n• Cayma bildirimi ulaştıktan sonra 14 gün içinde tam iade yapılır\n• İade, ödeme yaptığınız karta yapılır, masraf yansıtılmaz\n\nCayma Hakkı İstisnaları (Yönetmelik Madde 15):\n• Dijital içerik teslimi: Onayınız ile hizmetin başlaması halinde cayma hakkı sona erer\n• Hizmetin tamamen ifa edilmesi: Onayınız ile hizmetin tamamlanması halinde cayma hakkı kullanılamaz`
        },
        {
            title: "9. Abonelik ve İptal",
            content: `Abonelik Yenileme: Seçilen dönem sonunda otomatik yenilenir. Yenileme öncesi e-posta bildirimi yapılır.\n\nAbonelik İptali: İstediğiniz zaman iptal edebilirsiniz. İptal, mevcut dönem sonunda geçerli olur. İptal edilen dönem için kısmi iade yapılmaz (cayma hakkı süresi hariç).\n\nPaket Değişikliği: Üst pakete yükseltme yapılabilir, fark ücreti hesaplanır. Alt pakete geçiş mevcut dönem sonunda gerçekleşir.`
        },
        {
            title: "10. Garanti, Sorumluluk ve Uyuşmazlık",
            content: `Sorumluluk Sınırı: SATICI'nın toplam sorumluluğu son 12 ayda ödenen abonelik ücretini aşamaz. Dolaylı zararlardan sorumlu tutulamaz.\n\nMücbir Sebepler: Doğal afetler, savaş, salgın, hükümet kararları, internet kesintileri, siber saldırılar mücbir sebep sayılır.\n\nUyuşmazlık: Türkiye Cumhuriyeti kanunları uygulanır. İstanbul Mahkemeleri ve İcra Daireleri yetkilidir. Tüketici Hakem Heyetleri ve Tüketici Mahkemelerine başvuru hakkınız saklıdır.\n\nDelil Sözleşmesi: SATICI'nın ticari kayıtları, bilgisayar kayıtları, e-posta yazışmaları ve platform işlem kayıtları HMK 193. madde anlamında münhasır delil olarak kabul edilir.`
        },
        {
            title: "11. Son Hükümler",
            content: `• Sözleşme, elektronik ortamda onaylandığı tarihte yürürlüğe girer\n• SATICI, sözleşmede değişiklik yapma hakkını saklı tutar (30 gün önceden bildirim)\n• ALICI, değişiklikleri kabul etmemesi halinde sözleşmeyi feshedebilir\n• Herhangi bir hükmün geçersiz sayılması diğer hükümleri etkilemez\n\nALICI, işbu Mesafeli Satış Sözleşmesi'nin tüm maddelerini okuduğunu, anladığını ve kabul ettiğini, Ön Bilgilendirme Formu'nu teslim aldığını beyan eder.\n\nİletişim: info@lysiaetic.com | legal@lysiaetic.com`
        }
    ]
};

const PRELIMINARY_INFO = {
    title: "Ön Bilgilendirme Formu",
    icon: "📄",
    lastUpdate: "2024",
    sections: [
        {
            title: "1. Satıcı Bilgileri",
            content: `Ticari Unvan: LysiaETIC\nAdres: İstanbul, Türkiye\nTelefon: Platformda belirtilen iletişim numarası\nE-posta: info@lysiaetic.com\nWeb Sitesi: https://lunexetic.com`
        },
        {
            title: "2. Alıcı Bilgileri",
            content: `Alıcı bilgileri, platformda kayıtlı üyelik bilgilerinden alınır:\n\n• Ad Soyad / Ticari Unvan: Üyelik kaydında belirtilen\n• Adres: Üyelik kaydında belirtilen\n• Telefon: Üyelik kaydında belirtilen\n• E-posta: Üyelik kaydında belirtilen`
        },
        {
            title: "3. Hizmet Tanımı",
            content: `Hizmet Adı: LysiaETIC E-Ticaret Yönetim Platformu\nHizmet Türü: Dijital Hizmet (SaaS — Software as a Service)\n\nLysiaETIC, e-ticaret işletmelerinin çoklu pazaryeri yönetimini tek bir platformdan gerçekleştirmesini sağlayan bulut tabanlı bir yazılım hizmetidir.\n\nTemel Özellikler:\n• Pazaryeri Entegrasyonları (Trendyol, Hepsiburada, Amazon, N11, Çiçeksepeti)\n• Ürün Yönetimi (merkezi katalog, toplu yükleme, stok/fiyat senkronizasyonu)\n• Sipariş Yönetimi (merkezi toplama, otomatik işleme, iptal/iade yönetimi)\n• Kargo Entegrasyonları (Aras, Yurtiçi, MNG, Sürat)\n• E-Fatura Entegrasyonları (QNB, Sovos, Paraşüt, Ödeal)\n• Analitik ve Raporlama (satış, performans, kâr-zarar)\n• AI Araçları (LysiaBrain asistan, LysiaRadar PRO fırsat keşfi)\n• Finans Yönetimi (gelir-gider, kâr analizi)`
        },
        {
            title: "4. Abonelik Paketleri",
            content: `TRIAL (DEMO): 14 gün ücretsiz — 100 ürün, 1.000 sipariş/ay, 2 pazaryeri\n\nBASIC (STARTER): ₺299/ay veya ₺2.990/yıl (KDV dahil) — 500 ürün, 5.000 sipariş/ay, 3 pazaryeri, e-fatura, öncelikli destek\n\nPRO ⭐: ₺599/ay veya ₺5.990/yıl (KDV dahil) — 2.000 ürün, 20.000 sipariş/ay, 5 pazaryeri, tüm entegrasyonlar, 7/24 destek, AI araçları, finans modülü\n\nENTERPRISE: ₺1.299/ay veya ₺12.990/yıl (KDV dahil) — Sınırsız her şey, özel hesap yöneticisi, SLA garantisi\n\nNOT: Güncel fiyatlar platformun fiyatlandırma sayfasında görüntülenir. Fiyatlar sistem ayarlarından dinamik olarak yönetilir.`
        },
        {
            title: "5. Ödeme Bilgileri",
            content: `Toplam Ücret: Seçilen pakete göre (KDV dahil)\nÖdeme Yöntemi: Kredi kartı veya Banka kartı\nÖdeme Altyapısı: PayTR güvenli ödeme sistemi\nGüvenlik: 3D Secure doğrulama zorunlu, 256-bit SSL/TLS şifreleme\nKart Bilgileri: SATICI'nın sunucularında saklanmaz\n\nFaturalama: Elektronik fatura (e-Fatura), e-posta ile gönderilir\nKDV: Tüm fiyatlara dahildir\n\nOtomatik Yenileme: Abonelikler dönem sonunda otomatik yenilenir. Yenileme öncesi e-posta bildirimi yapılır. İptal etmediğiniz sürece devam eder.`
        },
        {
            title: "6. Teslimat",
            content: `Teslimat Şekli: Dijital ortamda, internet üzerinden\nTeslimat Süresi: Ödeme onayından hemen sonra (anlık)\nErişim: Web tarayıcısı üzerinden (Chrome, Firefox, Safari, Edge)\nGereksinimler: İnternet bağlantısı, güncel web tarayıcısı\n\nDijital hizmet olması sebebiyle fiziksel teslimat söz konusu değildir.`
        },
        {
            title: "7. Cayma Hakkı",
            content: `6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca:\n\n• Satın alma tarihinden itibaren 14 gün içinde cayma hakkınız vardır\n• Herhangi bir gerekçe göstermeden ve cezai şart ödemeden cayabilirsiniz\n• Cayma için info@lysiaetic.com adresine veya platform üzerinden bildirim yapın\n• 14 gün içinde tam iade yapılır, masraf yansıtılmaz\n\nİstisna: Onayınız ile dijital içeriğin sunulmaya başlaması halinde cayma hakkı sona erer. Hizmetin derhal başlamasını talep ettiğinizde ve platformu kullanmaya başladığınızda bunu kabul etmiş olursunuz.`
        },
        {
            title: "8. Tüketici Hakları ve Şikâyet Mercileri",
            content: `Tüketici Hakem Heyetleri: Parasal sınırlar dahilinde başvurabilirsiniz (ücretsiz)\nTüketici Mahkemeleri: Parasal sınırları aşan uyuşmazlıklar için\nTicaret Bakanlığı: Tüketici İletişim Merkezi (TİM): 1512\nKVKK: https://www.kvkk.gov.tr\n\nYetkili Mahkeme: İstanbul Mahkemeleri ve İcra Daireleri`
        },
        {
            title: "9. Alıcı Beyanı",
            content: `ALICI, işbu Ön Bilgilendirme Formu'nu okuyarak aşağıdaki hususları kabul ve beyan eder:\n\n✅ Satıcının unvan, adres, telefon ve e-posta bilgilerini öğrendim\n✅ Hizmetin temel niteliklerini, içeriğini ve kapsamını öğrendim\n✅ Hizmetin toplam fiyatını (vergiler dahil) öğrendim\n✅ Ödeme şeklini ve planını öğrendim\n✅ Hizmetin dijital ortamda sunulacağını ve teslimat süresini öğrendim\n✅ 14 gün cayma hakkımın olduğunu ve nasıl kullanacağımı öğrendim\n✅ Dijital içeriğin sunulmaya başlaması ile cayma hakkımın sona ereceğini öğrendim\n✅ Aboneliklerin otomatik yenilendiğini öğrendim\n✅ Şikâyet başvuru mercilerini öğrendim\n✅ Bu ön bilgilendirme formunu elektronik ortamda teslim aldım\n✅ Mesafeli Satış Sözleşmesi'ni okudum ve kabul ettim\n\nOnay Yöntemi: Platform üzerinden elektronik onay`
        },
        {
            title: "10. İletişim",
            content: `Genel Sorular: info@lysiaetic.com\nTeknik Destek: support@lysiaetic.com (7/24 canlı destek)\nHukuki Konular: legal@lysiaetic.com\nVeri Koruma: dpo@lysiaetic.com\n\nÇalışma Saatleri: Pazartesi-Cuma 09:00-18:00\nAcil Destek: 7/24 mevcuttur\n\nBu form, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümlerine uygun olarak hazırlanmıştır.`
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

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
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
                        ← Geri
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
                        🔒 Gizlilik Politikası
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/terms" ? " active" : ""}`}
                        onClick={() => navigate("/terms")}
                    >
                        📋 Kullanım Şartları
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/cookies" ? " active" : ""}`}
                        onClick={() => navigate("/cookies")}
                    >
                        🍪 Çerez Politikası
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/distance-sales" ? " active" : ""}`}
                        onClick={() => navigate("/distance-sales")}
                    >
                        📝 Mesafeli Satış Sözleşmesi
                    </button>
                    <button
                        className={`legal-nav-tab${location.pathname === "/preliminary-info" ? " active" : ""}`}
                        onClick={() => navigate("/preliminary-info")}
                    >
                        📄 Ön Bilgilendirme Formu
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
                        <p>Bu belge yasal olarak bağlayıcıdır. Sorularınız için <strong>info@lysiaetic.com</strong> adresine başvurabilirsiniz.</p>
                        <p>© {new Date().getFullYear()} Lunexetic. Tüm hakları saklıdır.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegalPage;
