/**
 * @swagger
 * /auth/2fa/enable:
 *   post:
 *     summary: 2FA aktifleştir
 *     description: E-posta tabanlı iki faktörlü doğrulamayı aktifleştirir. Yedek kodlar döner.
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA aktifleştirildi — yedek kodlar döner
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     backupCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 10 adet tek kullanımlık yedek kod
 *       400:
 *         description: 2FA zaten aktif
 *
 * /auth/2fa/disable:
 *   post:
 *     summary: 2FA devre dışı bırak
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA devre dışı bırakıldı
 *       400:
 *         description: 2FA zaten kapalı
 *
 * /auth/2fa/status:
 *   get:
 *     summary: 2FA durumunu getir
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA durum bilgisi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                     backupCodesRemaining:
 *                       type: number
 *
 * /auth/2fa/verify:
 *   post:
 *     summary: 2FA kodunu doğrula (login'in ikinci adımı)
 *     description: Login sırasında 2FA aktifse, e-posta ile gönderilen kodu doğrular ve token çifti döner.
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
 *                 description: 6 haneli doğrulama kodu veya yedek kod
 *     responses:
 *       200:
 *         description: Doğrulama başarılı — token çifti döner
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *       401:
 *         description: Geçersiz veya süresi dolmuş kod
 *
 * /auth/2fa/resend:
 *   post:
 *     summary: 2FA kodunu tekrar gönder
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
 *         description: Kod gönderildi
 *       429:
 *         description: Rate limit aşıldı
 */
