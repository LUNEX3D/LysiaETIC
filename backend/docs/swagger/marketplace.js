/**
 * @swagger
 * /marketplace/user-marketplaces:
 *   get:
 *     summary: Kullanıcının pazaryeri entegrasyonlarını listele
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Entegrasyon listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Marketplace'
 *
 * /marketplace/integrate:
 *   post:
 *     summary: Yeni pazaryeri entegrasyonu ekle
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddMarketplaceRequest'
 *     responses:
 *       201:
 *         description: Entegrasyon eklendi
 *       400:
 *         description: Validasyon hatası
 *
 * /marketplace/{id}:
 *   put:
 *     summary: Pazaryeri entegrasyonunu güncelle
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               credentials:
 *                 type: object
 *     responses:
 *       200:
 *         description: Güncellendi
 *   delete:
 *     summary: Pazaryeri entegrasyonunu sil
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Silindi
 *
 * /marketplace/test-hepsiburada:
 *   post:
 *     summary: Hepsiburada credential testi
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               merchantId:
 *                 type: string
 *               apiKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bağlantı başarılı
 *       400:
 *         description: Bağlantı başarısız
 *
 * /marketplace/test-ciceksepeti:
 *   post:
 *     summary: ÇiçekSepeti credential testi
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Bağlantı başarılı
 *
 * /marketplace/test-amazon:
 *   post:
 *     summary: Amazon SP-API credential testi
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Bağlantı başarılı
 *
 * /marketplace/n11/categories:
 *   get:
 *     summary: N11 kategori ağacını çek
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kategori listesi
 *
 * /marketplace/n11/categories/{categoryId}/attributes:
 *   get:
 *     summary: N11 kategori attribute'larını çek
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Attribute listesi
 *
 * /marketplace/n11/unmapped-categories:
 *   get:
 *     summary: Eşleştirilemeyen kategorileri listele
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: marketplace
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeResolved
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Unmapped kategori listesi
 *
 * /marketplace/n11/category-mapping:
 *   post:
 *     summary: Kategori mapping kaydet
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sourceCategory:
 *                 type: string
 *               marketplace:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               categoryName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mapping kaydedildi
 *
 * /marketplace/n11/category-mappings:
 *   get:
 *     summary: Kayıtlı kategori mapping'lerini listele
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Mapping listesi
 *
 * /marketplace/n11/category-mapping/{id}:
 *   delete:
 *     summary: Kategori mapping sil
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Silindi
 *
 * /marketplace/n11/category-suggest:
 *   post:
 *     summary: Ürün bilgisine göre N11 kategori önerisi al
 *     tags: [Marketplace]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *               brand:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kategori önerisi
 */
