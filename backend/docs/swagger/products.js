/**
 * @swagger
 * /products/all:
 *   get:
 *     summary: Pazaryerinden ürünleri çek
 *     description: Belirtilen pazaryeri entegrasyonundan tüm ürünleri API üzerinden çeker.
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: marketplaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marketplace entegrasyon ID'si
 *     responses:
 *       200:
 *         description: Ürün listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 marketplace:
 *                   type: string
 *                 total:
 *                   type: number
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       404:
 *         description: Entegrasyon bulunamadı
 *
 * /orders/all:
 *   get:
 *     summary: Tüm siparişleri getir
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sipariş listesi
 *
 * /orders/sync-all:
 *   get:
 *     summary: Tüm pazaryerlerinden siparişleri senkronize et
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Senkronizasyon tamamlandı
 */
