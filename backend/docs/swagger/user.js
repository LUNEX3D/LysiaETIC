/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Kullanıcı profilini getir
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profil bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *   put:
 *     summary: Profil bilgilerini güncelle
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil güncellendi
 *
 * /user/change-password:
 *   put:
 *     summary: Şifre değiştir
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Şifre değiştirildi
 *       400:
 *         description: Mevcut şifre yanlış
 *
 * /user/verify-password:
 *   post:
 *     summary: Mevcut şifreyi doğrula (hassas işlemler öncesi)
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Şifre doğru
 *       401:
 *         description: Şifre yanlış
 *
 * /user/notifications:
 *   put:
 *     summary: Bildirim ayarlarını güncelle
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ayarlar güncellendi
 *
 * /user/api-key:
 *   post:
 *     summary: Yeni API anahtarı oluştur
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: API anahtarı oluşturuldu
 *
 * /user/api-key/{keyId}:
 *   delete:
 *     summary: API anahtarını iptal et
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: keyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API anahtarı iptal edildi
 *
 * /user/stats:
 *   get:
 *     summary: Kullanıcı istatistikleri
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistik verileri
 *
 * /user/account:
 *   delete:
 *     summary: Hesabı kalıcı olarak sil (KVKK/GDPR)
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Hesap silindi
 *       401:
 *         description: Yetkisiz
 */
