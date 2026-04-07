/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Yeni kullanıcı kaydı
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Kayıt başarılı — doğrulama e-postası gönderildi
 *       400:
 *         description: Validasyon hatası veya e-posta zaten kayıtlı
 *       429:
 *         description: Rate limit aşıldı
 *
 * /auth/login:
 *   post:
 *     summary: Kullanıcı girişi
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Giriş başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Geçersiz e-posta veya şifre
 *       429:
 *         description: Rate limit aşıldı
 *
 * /auth/logout:
 *   post:
 *     summary: Oturumu kapat (refresh token revoke)
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Çıkış başarılı
 *       401:
 *         description: Yetkisiz
 *
 * /auth/profile:
 *   get:
 *     summary: Giriş yapan kullanıcının profili
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profil bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Yetkisiz
 *
 * /auth/verify-email:
 *   get:
 *     summary: E-posta doğrulama
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: E-posta doğrulama token'ı
 *     responses:
 *       200:
 *         description: E-posta doğrulandı
 *       400:
 *         description: Geçersiz veya süresi dolmuş token
 *
 * /auth/resend-verification:
 *   post:
 *     summary: Doğrulama e-postasını tekrar gönder
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Doğrulama e-postası gönderildi
 *       429:
 *         description: Rate limit aşıldı
 *
 * /auth/google:
 *   post:
 *     summary: Google OAuth ile giriş/kayıt
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential:
 *                 type: string
 *                 description: Google ID Token
 *     responses:
 *       200:
 *         description: Giriş başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *
 * /auth/forgot-password:
 *   post:
 *     summary: Şifre sıfırlama kodu gönder
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Sıfırlama kodu gönderildi
 *       404:
 *         description: Kullanıcı bulunamadı
 *
 * /auth/verify-reset-code:
 *   post:
 *     summary: Şifre sıfırlama kodunu doğrula
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kod doğrulandı
 *       400:
 *         description: Geçersiz veya süresi dolmuş kod
 *
 * /auth/reset-password:
 *   post:
 *     summary: Yeni şifre belirle
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Şifre başarıyla değiştirildi
 *
 * /auth/refresh-token:
 *   post:
 *     summary: Access token yenile (token rotation)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Yeni token çifti
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Geçersiz refresh token
 */
