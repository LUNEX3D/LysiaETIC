/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Dashboard özet verileri
 *     description: Kullanıcının tüm pazaryerlerinden toplam sipariş, ürün, ciro ve trend verilerini döner.
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard verileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalOrders:
 *                   type: number
 *                 totalRevenue:
 *                   type: number
 *                 totalProducts:
 *                   type: number
 *                 marketplaces:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Yetkisiz
 */
