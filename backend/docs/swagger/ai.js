/**
 * @swagger
 * /ai/decisions:
 *   get:
 *     summary: AI karar motoru — ana kararlar
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: AI karar listesi
 *
 * /ai/execute-action:
 *   post:
 *     summary: Manuel aksiyon uygula
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actionId:
 *                 type: string
 *               params:
 *                 type: object
 *     responses:
 *       200:
 *         description: Aksiyon uygulandı
 *
 * /ai/auto-optimize:
 *   post:
 *     summary: Tek tık otomatik optimizasyon
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Optimizasyon tamamlandı
 *
 * /ai/action-stats:
 *   get:
 *     summary: Aksiyon istatistikleri
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistik verileri
 *
 * /ai/suggestions:
 *   get:
 *     summary: Gelişmiş AI önerileri
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: AI öneri listesi
 *
 * /ai/performance:
 *   get:
 *     summary: Satış ve performans asistanı
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Performans verileri
 *
 * /ai/chat:
 *   post:
 *     summary: AI Chat asistanı
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI yanıtı
 *
 * /ai/products:
 *   get:
 *     summary: Ürün performans analizi ve fiyat optimizasyonu
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün analiz verileri
 *
 * /ai/customer-behavior:
 *   get:
 *     summary: Müşteri davranış analizi
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Müşteri davranış verileri
 *
 * /ai/forecast:
 *   get:
 *     summary: Satış tahmini (forecasting)
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tahmin verileri
 *
 * /ai/anomalies:
 *   get:
 *     summary: Anomali tespiti
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Anomali listesi
 *
 * /ai/realtime-insights:
 *   get:
 *     summary: Gerçek zamanlı içgörüler
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: İçgörü verileri
 *
 * /ai/optimize:
 *   post:
 *     summary: Tek tık optimizasyon (legacy)
 *     tags: [AI]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Optimizasyon sonucu
 */
