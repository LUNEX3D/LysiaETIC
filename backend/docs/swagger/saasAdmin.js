/**
 * @swagger
 * /saas-admin/dashboard:
 *   get:
 *     summary: SaaS dashboard metrikleri
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard verileri
 *
 * /saas-admin/tenants:
 *   get:
 *     summary: Tüm firmaları (tenant) listele
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant listesi
 *
 * /saas-admin/tenants/{id}:
 *   get:
 *     summary: Firma detayı
 *     tags: [SaaS Admin]
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
 *         description: Firma detayı
 *
 * /saas-admin/tenants/{id}/suspend:
 *   post:
 *     summary: Firmayı askıya al
 *     tags: [SaaS Admin]
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
 *         description: Askıya alındı
 *
 * /saas-admin/tenants/{id}/activate:
 *   post:
 *     summary: Firmayı aktifleştir
 *     tags: [SaaS Admin]
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
 *         description: Aktifleştirildi
 *
 * /saas-admin/tenants/{id}/ban:
 *   post:
 *     summary: Firmayı yasakla
 *     tags: [SaaS Admin]
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
 *         description: Yasaklandı
 *
 * /saas-admin/tenants/{id}/reset-password:
 *   post:
 *     summary: Firma şifresini sıfırla
 *     tags: [SaaS Admin]
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
 *         description: Şifre sıfırlandı
 *
 * /saas-admin/subscriptions:
 *   get:
 *     summary: Tüm abonelikleri listele
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Abonelik listesi
 *   post:
 *     summary: Yeni abonelik oluştur
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Oluşturuldu
 *
 * /saas-admin/subscriptions/{id}:
 *   put:
 *     summary: Abonelik güncelle
 *     tags: [SaaS Admin]
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
 *         description: Güncellendi
 *
 * /saas-admin/payments:
 *   get:
 *     summary: Tüm ödemeleri listele
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ödeme listesi
 *   post:
 *     summary: Manuel ödeme oluştur
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Oluşturuldu
 *
 * /saas-admin/payments/{id}/status:
 *   put:
 *     summary: Ödeme durumunu güncelle
 *     tags: [SaaS Admin]
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
 *         description: Güncellendi
 *
 * /saas-admin/integrations:
 *   get:
 *     summary: Tüm entegrasyonları listele
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Entegrasyon listesi
 *
 * /saas-admin/usage:
 *   get:
 *     summary: Kullanım istatistikleri
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanım verileri
 *
 * /saas-admin/reports:
 *   get:
 *     summary: Global raporlar
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Rapor verileri
 *
 * /saas-admin/announcements:
 *   get:
 *     summary: Duyuruları listele
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Duyuru listesi
 *   post:
 *     summary: Yeni duyuru oluştur
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Oluşturuldu
 *
 * /saas-admin/announcements/{id}:
 *   put:
 *     summary: Duyuru güncelle
 *     tags: [SaaS Admin]
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
 *         description: Güncellendi
 *   delete:
 *     summary: Duyuru sil
 *     tags: [SaaS Admin]
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
 * /saas-admin/audit-logs:
 *   get:
 *     summary: Audit logları
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Log listesi
 *
 * /saas-admin/tickets:
 *   get:
 *     summary: Destek taleplerini listele
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket listesi
 *
 * /saas-admin/tickets/{id}:
 *   get:
 *     summary: Ticket detayı
 *     tags: [SaaS Admin]
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
 *         description: Ticket detayı
 *
 * /saas-admin/tickets/{id}/reply:
 *   post:
 *     summary: Ticket'a yanıt ver
 *     tags: [SaaS Admin]
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
 *         description: Yanıt gönderildi
 *
 * /saas-admin/tickets/{id}/status:
 *   put:
 *     summary: Ticket durumunu güncelle
 *     tags: [SaaS Admin]
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
 *         description: Güncellendi
 *
 * /saas-admin/system-config:
 *   get:
 *     summary: Sistem konfigürasyonu
 *     tags: [SaaS Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Konfigürasyon verileri
 */
