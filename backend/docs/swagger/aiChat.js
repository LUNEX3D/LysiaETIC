/**
 * @swagger
 * /ai-chat/message:
 *   post:
 *     summary: AI Operatör'e mesaj gönder
 *     tags: [AI Chat]
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
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI yanıtı
 *
 * /ai-chat/history/{sessionId}:
 *   get:
 *     summary: Chat geçmişi
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mesaj geçmişi
 *
 * /ai-chat/conversations:
 *   get:
 *     summary: Tüm konuşmaları listele
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Konuşma listesi
 *
 * /ai-chat/conversation/{sessionId}:
 *   delete:
 *     summary: Konuşmayı sil
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Silindi
 *
 * /ai-chat/alerts:
 *   get:
 *     summary: Proaktif AI uyarıları
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Uyarı listesi
 *
 * /ai-chat/quick-stats:
 *   get:
 *     summary: Hızlı istatistikler
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistik verileri
 *
 * /ai-chat/operator/cycle:
 *   post:
 *     summary: Otonom döngü çalıştır
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Döngü sonucu
 *
 * /ai-chat/operator/act:
 *   post:
 *     summary: Operatör aksiyonu uygula
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Aksiyon uygulandı
 *
 * /ai-chat/operator/status:
 *   get:
 *     summary: Operatör durumu
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Durum bilgisi
 *
 * /ai-chat/operator/mode:
 *   post:
 *     summary: Operasyon modunu değiştir
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [passive, advisory, semi-auto, full-auto]
 *     responses:
 *       200:
 *         description: Mod değiştirildi
 *
 * /ai-chat/operator/cycles:
 *   get:
 *     summary: Döngü geçmişi
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Döngü listesi
 *
 * /ai-chat/operator/cycle/{id}:
 *   get:
 *     summary: Döngü detayı
 *     tags: [AI Chat]
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
 *         description: Döngü detayı
 *
 * /ai-chat/worker/status:
 *   get:
 *     summary: Worker durumu
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Worker durum bilgisi
 *
 * /ai-chat/worker/force-cycle:
 *   post:
 *     summary: Zorla döngü çalıştır
 *     tags: [AI Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Döngü başlatıldı
 */
