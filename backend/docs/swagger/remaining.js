/**
 * @swagger
 * /hepsiburada/orders:
 *   post:
 *     summary: Hepsiburada siparişlerini çek
 *     tags: [Hepsiburada]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Sipariş listesi
 *
 * /ciceksepeti/orders:
 *   post:
 *     summary: ÇiçekSepeti siparişlerini çek
 *     tags: [ÇiçekSepeti]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sipariş listesi
 *
 * /ciceksepeti/products:
 *   get:
 *     summary: ÇiçekSepeti ürünlerini listele
 *     tags: [ÇiçekSepeti]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün listesi
 *   post:
 *     summary: ÇiçekSepeti'ne ürün oluştur
 *     tags: [ÇiçekSepeti]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün oluşturuldu
 *
 * /ciceksepeti/categories:
 *   get:
 *     summary: ÇiçekSepeti kategorileri
 *     tags: [ÇiçekSepeti]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kategori listesi
 *
 * /ciceksepeti/test-credentials:
 *   post:
 *     summary: ÇiçekSepeti credential testi
 *     tags: [ÇiçekSepeti]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test sonucu
 *
 * /amazon/orders:
 *   get:
 *     summary: Amazon siparişlerini listele
 *     tags: [Amazon]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sipariş listesi
 *
 * /amazon/listings/{sku}:
 *   get:
 *     summary: Amazon listing detayı
 *     tags: [Amazon]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sku
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Listing bilgileri
 *
 * /amazon/catalog/search:
 *   get:
 *     summary: Amazon katalog araması
 *     tags: [Amazon]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keywords
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Arama sonuçları
 *
 * /amazon/inventory:
 *   get:
 *     summary: Amazon envanter özeti
 *     tags: [Amazon]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Envanter verileri
 *
 * /amazon/test-credentials:
 *   post:
 *     summary: Amazon SP-API credential testi
 *     tags: [Amazon]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Test sonucu
 *
 * /categories:
 *   get:
 *     summary: Kategori listesi
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Kategori listesi
 *
 * /brands:
 *   get:
 *     summary: Marka listesi
 *     tags: [Brands]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Marka listesi
 *   post:
 *     summary: Yeni marka ekle
 *     tags: [Brands]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Marka eklendi
 *
 * /roketfy/dashboard:
 *   get:
 *     summary: Roketfy dashboard
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard verileri
 *
 * /roketfy/research/products:
 *   post:
 *     summary: Ürün araştırması
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               keyword:
 *                 type: string
 *               categoryId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Araştırma sonuçları
 *
 * /roketfy/research/keywords:
 *   post:
 *     summary: Anahtar kelime araştırması
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kelime analizi
 *
 * /roketfy/competitor/analyze:
 *   post:
 *     summary: Rakip analizi
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Rakip analiz sonuçları
 *
 * /roketfy/listing/analyze:
 *   post:
 *     summary: Listeleme analizi
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Listeleme analiz sonuçları
 *
 * /roketfy/content/title:
 *   post:
 *     summary: AI başlık üretimi
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Üretilen başlıklar
 *
 * /roketfy/content/description:
 *   post:
 *     summary: AI açıklama üretimi
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Üretilen açıklama
 *
 * /roketfy/price/suggest:
 *   post:
 *     summary: Fiyat önerisi
 *     tags: [Roketfy]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Fiyat önerisi
 *
 * /product-management/products:
 *   get:
 *     summary: Ürünleri listele
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün listesi
 *   post:
 *     summary: Yeni ürün oluştur
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Ürün oluşturuldu
 *
 * /product-management/products/{productId}:
 *   get:
 *     summary: Ürün detayı
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ürün detayı
 *   put:
 *     summary: Ürün güncelle
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Güncellendi
 *   delete:
 *     summary: Ürün sil
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Silindi
 *
 * /product-management/import/template:
 *   get:
 *     summary: Excel import şablonu indir
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Excel dosyası
 *
 * /product-management/export:
 *   get:
 *     summary: Ürünleri Excel olarak dışa aktar
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Excel dosyası
 *
 * /product-management/sync/from-marketplace:
 *   post:
 *     summary: Pazaryerinden ürünleri senkronize et
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Senkronizasyon tamamlandı
 *
 * /product-management/sync/distribute:
 *   post:
 *     summary: Ürünü pazaryerine dağıt
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dağıtım tamamlandı
 *
 * /product-management/dashboard:
 *   get:
 *     summary: Ürün yönetimi dashboard
 *     tags: [Product Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard verileri
 *
 * /advanced-products/pull-all:
 *   post:
 *     summary: Tüm pazaryerlerinden ürünleri çek
 *     tags: [Advanced Products]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Çekme işlemi başlatıldı
 *
 * /advanced-products/products:
 *   get:
 *     summary: Kullanıcının ürünlerini listele
 *     tags: [Advanced Products]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün listesi
 *
 * /advanced-products/compare:
 *   get:
 *     summary: Pazaryerlerini karşılaştır
 *     tags: [Advanced Products]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Karşılaştırma verileri
 *
 * /advanced-products/dashboard:
 *   get:
 *     summary: Gelişmiş ürün dashboard
 *     tags: [Advanced Products]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard verileri
 *
 * /e-invoice/partner-login:
 *   post:
 *     summary: Trendyol E-Faturam partner login
 *     tags: [E-Invoice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Login başarılı
 *
 * /e-invoice/earchive/create:
 *   post:
 *     summary: E-Arşiv fatura oluştur
 *     tags: [E-Invoice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Fatura oluşturuldu
 *
 * /e-invoice/qnb/login:
 *   post:
 *     summary: QNB eSolutions login
 *     tags: [E-Invoice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Login başarılı
 *
 * /e-invoice/sovos/token:
 *   post:
 *     summary: Sovos OAuth token al
 *     tags: [E-Invoice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token alındı
 *
 * /e-invoice/parasut/token:
 *   post:
 *     summary: Paraşüt OAuth token al
 *     tags: [E-Invoice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token alındı
 *
 * /e-invoice/odeal/validate-key:
 *   post:
 *     summary: Ödeal servis anahtarı doğrula
 *     tags: [E-Invoice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Anahtar geçerli
 *
 * /category-smart/internal:
 *   get:
 *     summary: Dahili kategorileri listele
 *     tags: [Category Smart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kategori listesi
 *   post:
 *     summary: Dahili kategori oluştur
 *     tags: [Category Smart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Oluşturuldu
 *
 * /category-smart/mappings:
 *   get:
 *     summary: Kategori mapping'lerini listele
 *     tags: [Category Smart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Mapping listesi
 *   post:
 *     summary: Kategori mapping kaydet
 *     tags: [Category Smart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kaydedildi
 *
 * /category-smart/auto-match:
 *   post:
 *     summary: Otomatik kategori eşleştirme
 *     tags: [Category Smart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Eşleştirme sonuçları
 *
 * /category-smart/stats:
 *   get:
 *     summary: Kategori eşleştirme istatistikleri
 *     tags: [Category Smart]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistik verileri
 */
