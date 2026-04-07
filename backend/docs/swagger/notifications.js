/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Kullanıcı bildirimlerini getir
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Bildirim listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *
 * /notifications/{id}/read:
 *   put:
 *     summary: Bildirimi okundu işaretle (id="all" tümünü işaretler)
 *     tags: [Notifications]
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
 *         description: İşaretlendi
 *
 * /notifications/{id}:
 *   delete:
 *     summary: Bildirimi sil/dismiss (id="all" tümünü siler)
 *     tags: [Notifications]
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
 * /notifications/order:
 *   post:
 *     summary: Sipariş bildirimi oluştur
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Bildirim oluşturuldu
 *
 * /notifications/orders/bulk:
 *   post:
 *     summary: Toplu sipariş bildirimi oluştur
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Bildirimler oluşturuldu
 *
 * /notifications/ai:
 *   post:
 *     summary: AI bildirimi oluştur
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: AI bildirimi oluşturuldu
 *
 * /notifications/admin/send:
 *   post:
 *     summary: Admin bildirim gönder
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Gönderildi
 *
 * /notifications/admin/all:
 *   get:
 *     summary: Tüm bildirimleri gör (admin)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Bildirim listesi
 */
