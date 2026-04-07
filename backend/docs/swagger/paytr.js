/**
 * @swagger
 * /paytr/plans:
 *   get:
 *     summary: Abonelik paketlerini listele
 *     tags: [PayTR]
 *     responses:
 *       200:
 *         description: Paket listesi
 *
 * /paytr/callback:
 *   post:
 *     summary: PayTR ödeme callback (PayTR sunucusundan gelir)
 *     tags: [PayTR]
 *     description: Bu endpoint PayTR sunucusu tarafından çağrılır. Manuel kullanılmaz.
 *     responses:
 *       200:
 *         description: OK
 *
 * /paytr/subscription:
 *   get:
 *     summary: Kullanıcının abonelik durumu
 *     tags: [PayTR]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Abonelik bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *
 * /paytr/create-payment:
 *   post:
 *     summary: Ödeme başlat (PayTR iFrame token al)
 *     tags: [PayTR]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId]
 *             properties:
 *               planId:
 *                 type: string
 *     responses:
 *       200:
 *         description: iFrame token
 *
 * /paytr/admin/subscriptions:
 *   get:
 *     summary: Tüm abonelikleri listele (admin)
 *     tags: [PayTR]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Abonelik listesi
 *
 * /paytr/admin/grant:
 *   post:
 *     summary: Kullanıcıya abonelik/demo ver (admin)
 *     tags: [PayTR]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               plan:
 *                 type: string
 *               days:
 *                 type: number
 *     responses:
 *       200:
 *         description: Abonelik verildi
 *
 * /paytr/admin/grant-demo-all:
 *   post:
 *     summary: Tüm kullanıcılara toplu demo ver (admin)
 *     tags: [PayTR]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Demo verildi
 */
