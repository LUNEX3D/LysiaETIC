/**
 * @swagger
 * /cargo:
 *   get:
 *     summary: Kargo takip siparişlerini getir
 *     tags: [Cargo]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Başlangıç tarihi (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Bitiş tarihi (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Kargo takip verileri
 *       401:
 *         description: Yetkisiz
 */
