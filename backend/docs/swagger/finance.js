/**
 * @swagger
 * /finance/summary:
 *   get:
 *     summary: Finans özeti
 *     description: Tek pazaryeri veya tüm pazaryerlerinin mali özetini döner.
 *     tags: [Finance]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: marketplaceId
 *         schema:
 *           type: string
 *         description: Opsiyonel — belirli bir pazaryeri için filtrele
 *     responses:
 *       200:
 *         description: Finans özet verileri
 *
 * /finance/trendyol/settlements:
 *   get:
 *     summary: Trendyol hesap kesim verileri
 *     tags: [Finance]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Settlement verileri
 *
 * /finance/trendyol/otherfinancials:
 *   get:
 *     summary: Trendyol diğer mali veriler
 *     tags: [Finance]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Diğer mali veriler
 *
 * /finance/trendyol/cargo-invoice-items:
 *   get:
 *     summary: Trendyol kargo fatura kalemleri
 *     tags: [Finance]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kargo fatura verileri
 */
