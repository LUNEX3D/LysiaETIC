/**
 * @swagger
 * /ai-engine/dashboard:
 *   get:
 *     summary: AI Engine tam dashboard (birleşik endpoint)
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Birleşik dashboard verileri
 *
 * /ai-engine/recommendations:
 *   get:
 *     summary: AI önerilerini listele
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Öneri listesi
 *
 * /ai-engine/recommendations/generate:
 *   post:
 *     summary: Yeni AI önerileri oluştur
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Öneriler oluşturuldu
 *
 * /ai-engine/recommendations/bulk-approve:
 *   post:
 *     summary: Toplu öneri onaylama
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Öneriler onaylandı
 *
 * /ai-engine/recommendations/bulk-reject:
 *   post:
 *     summary: Toplu öneri reddetme
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Öneriler reddedildi
 *
 * /ai-engine/recommendations/{id}/approve:
 *   post:
 *     summary: Tek öneri onayla
 *     tags: [AI Engine]
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
 *         description: Onaylandı
 *
 * /ai-engine/recommendations/{id}/reject:
 *   post:
 *     summary: Tek öneri reddet
 *     tags: [AI Engine]
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
 *         description: Reddedildi
 *
 * /ai-engine/recommendations/{id}/execute:
 *   post:
 *     summary: Öneriyi uygula
 *     tags: [AI Engine]
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
 *         description: Uygulandı
 *
 * /ai-engine/ai-score:
 *   get:
 *     summary: AI skoru
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: AI skor verileri
 *
 * /ai-engine/daily-report:
 *   get:
 *     summary: Günlük AI raporu
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Günlük rapor
 *
 * /ai-engine/daily-actions:
 *   get:
 *     summary: Günlük AI aksiyonları
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Aksiyon listesi
 *
 * /ai-engine/strategy:
 *   get:
 *     summary: AI strateji önerisi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Strateji verileri
 *
 * /ai-engine/simulate:
 *   post:
 *     summary: Simülasyon çalıştır
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Simülasyon sonucu
 *
 * /ai-engine/simulate-advanced:
 *   post:
 *     summary: Gelişmiş simülasyon
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Gelişmiş simülasyon sonucu
 *
 * /ai-engine/simulate/apply:
 *   post:
 *     summary: Simülasyon sonucunu uygula
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Uygulandı
 *
 * /ai-engine/profit-heatmap:
 *   get:
 *     summary: Kâr ısı haritası
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Heatmap verileri
 *
 * /ai-engine/timing:
 *   get:
 *     summary: Zamanlama analizi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Zamanlama verileri
 *
 * /ai-engine/retro:
 *   get:
 *     summary: Retrospektif analiz
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Retro verileri
 *
 * /ai-engine/roi:
 *   get:
 *     summary: ROI analizi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: ROI verileri
 *
 * /ai-engine/product-health:
 *   get:
 *     summary: Ürün sağlık durumu
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün sağlık verileri
 *
 * /ai-engine/learning:
 *   get:
 *     summary: AI öğrenme verileri
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Öğrenme verileri
 *
 * /ai-engine/goals:
 *   post:
 *     summary: Hedef oluştur
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Hedef oluşturuldu
 *   get:
 *     summary: Hedefleri listele
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Hedef listesi
 *
 * /ai-engine/notifications:
 *   get:
 *     summary: AI bildirimleri
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Bildirim listesi
 *
 * /ai-engine/brain:
 *   get:
 *     summary: AI Brain dashboard
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Brain dashboard verileri
 *
 * /ai-engine/brain/focus:
 *   get:
 *     summary: AI odak noktaları
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Odak verileri
 *
 * /ai-engine/brain/losses:
 *   get:
 *     summary: Kayıp analizi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kayıp verileri
 *
 * /ai-engine/brain/risks:
 *   get:
 *     summary: Risk analizi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Risk verileri
 *
 * /ai-engine/brain/predictions:
 *   get:
 *     summary: Tahminler
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tahmin verileri
 *
 * /ai-engine/brain/segmentation:
 *   get:
 *     summary: Segmentasyon analizi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Segment verileri
 *
 * /ai-engine/brain/causes:
 *   get:
 *     summary: Kök neden analizi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Neden verileri
 *
 * /ai-engine/brain/opportunities:
 *   get:
 *     summary: Fırsat analizi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Fırsat verileri
 *
 * /ai-engine/brain/self-eval:
 *   get:
 *     summary: AI öz değerlendirme
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Değerlendirme verileri
 *
 * /ai-engine/brain/decision-history:
 *   get:
 *     summary: Karar geçmişi
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Karar geçmişi
 *
 * /ai-engine/brain/explain/{id}:
 *   post:
 *     summary: Öneri açıklaması
 *     tags: [AI Engine]
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
 *         description: Açıklama
 *
 * /ai-engine/brain/auto-decide:
 *   post:
 *     summary: Otomatik karar verme
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Karar sonucu
 *
 * /ai-engine/brain/diagnosis:
 *   get:
 *     summary: AI teşhis
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Teşhis verileri
 *
 * /ai-engine/brain/products:
 *   get:
 *     summary: Brain ürün listesi (maliyet yönetimi)
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ürün listesi
 *
 * /ai-engine/brain/update-cost:
 *   post:
 *     summary: Ürün maliyeti güncelle
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Güncellendi
 *
 * /ai-engine/brain/bulk-update-cost:
 *   post:
 *     summary: Toplu maliyet güncelleme
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Toplu güncelleme tamamlandı
 *
 * /ai-engine/worker-status:
 *   get:
 *     summary: AI background worker durumu
 *     tags: [AI Engine]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Worker durum bilgisi
 */
