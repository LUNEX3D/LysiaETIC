/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Tüm kullanıcıları listele
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı listesi
 *       403:
 *         description: Admin yetkisi gerekli
 *
 * /admin/users/{id}:
 *   get:
 *     summary: Kullanıcı detayı
 *     tags: [Admin]
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
 *         description: Kullanıcı bilgileri
 *   put:
 *     summary: Kullanıcı bilgilerini güncelle
 *     tags: [Admin]
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
 *         description: Güncellendi
 *   delete:
 *     summary: Kullanıcıyı sil
 *     tags: [Admin]
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
 * /admin/users/{id}/role:
 *   put:
 *     summary: Kullanıcı rolünü değiştir
 *     tags: [Admin]
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
 *               role:
 *                 type: string
 *                 enum: [user, admin, dev]
 *     responses:
 *       200:
 *         description: Rol güncellendi
 *
 * /admin/products:
 *   get:
 *     summary: Tüm ürünleri listele (admin)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün listesi
 *
 * /admin/delete-product/{id}:
 *   delete:
 *     summary: Ürün sil (admin)
 *     tags: [Admin]
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
 * /admin/orders:
 *   get:
 *     summary: Tüm siparişleri listele (admin)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sipariş listesi
 *
 * /admin/system/status:
 *   get:
 *     summary: Sistem durumu
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sistem durum bilgileri
 *
 * /admin/system/servers:
 *   get:
 *     summary: Sunucu bilgileri
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sunucu listesi
 *
 * /admin/system/logs:
 *   get:
 *     summary: Sistem logları
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Log verileri
 *
 * /admin/system/settings:
 *   get:
 *     summary: Sistem ayarları
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ayar verileri
 *
 * /admin/system/impersonate/{userId}:
 *   post:
 *     summary: Kullanıcı olarak giriş yap (impersonate)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Impersonate token
 */
