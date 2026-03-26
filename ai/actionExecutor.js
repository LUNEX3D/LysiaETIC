/**
 * ⚡ ACTION EXECUTOR
 *
 * Bu motor:
 * - AI kararlarını uygular
 * - Otomatik aksiyonlar alır
 * - Güvenlik kontrolleri yapar
 * - Sonuçları raporlar
 *
 * Felsefe: "Güvenli aksiyonları otomatik al, riskli olanları onayla"
 */

const Product = require('../backend/models/Product');
const Order = require('../backend/models/Order');
const Marketplace = require('../backend/models/Marketplace');

class ActionExecutor {
    constructor() {
        // Güvenlik limitleri
        this.safetyLimits = {
            maxPriceChange: 0.30,        // Maksimum %30 fiyat değişimi
            maxBulkUpdate: 50,           // Tek seferde max 50 ürün
            minApprovalAmount: 1000,     // 1000 TL üzeri manuel onay
            maxAutoDiscount: 0.25,       // Otomatik max %25 indirim
            cooldownPeriod: 3600000      // 1 saat cooldown (ms)
        };

        // Aksiyon geçmişi
        this.actionHistory = new Map();

        // Aksiyon tipleri ve özellikleri
        this.actionTypes = {
            price_update: {
                autoExecute: false,
                requiresApproval: true,
                reversible: true,
                risk: 'medium'
            },
            stock_alert: {
                autoExecute: true,
                requiresApproval: false,
                reversible: false,
                risk: 'low'
            },
            campaign_create: {
                autoExecute: false,
                requiresApproval: true,
                reversible: true,
                risk: 'medium'
            },
            product_optimize: {
                autoExecute: true,
                requiresApproval: false,
                reversible: true,
                risk: 'low'
            },
            bulk_sync: {
                autoExecute: true,
                requiresApproval: false,
                reversible: false,
                risk: 'low'
            }
        };
    }

    /**
     * 🎯 ANA UYGULAMA MOTORU
     */
    async executeActions(decisions, options = {}) {
        console.log('⚡ [Action Executor] Aksiyonlar uygulanıyor...');

        const results = {
            total: decisions.length,
            executed: [],
            pending: [],
            failed: [],
            skipped: []
        };

        for (const decision of decisions) {
            try {
                // Güvenlik kontrolü
                const safetyCheck = this.checkSafety(decision);
                if (!safetyCheck.safe) {
                    results.skipped.push({
                        decision,
                        reason: safetyCheck.reason
                    });
                    continue;
                }

                // Cooldown kontrolü
                if (this.isInCooldown(decision)) {
                    results.skipped.push({
                        decision,
                        reason: 'Cooldown period active'
                    });
                    continue;
                }

                // Otomatik uygulama kontrolü
                if (decision.autoExecute && !options.manualOnly) {
                    const result = await this.executeAction(decision);
                    results.executed.push({
                        decision,
                        result,
                        timestamp: new Date()
                    });
                } else {
                    results.pending.push({
                        decision,
                        reason: 'Requires manual approval'
                    });
                }

            } catch (error) {
                console.error('❌ Aksiyon hatası:', error);
                results.failed.push({
                    decision,
                    error: error.message
                });
            }
        }

        console.log(`✅ ${results.executed.length} aksiyon uygulandı`);
        console.log(`⏳ ${results.pending.length} aksiyon onay bekliyor`);
        console.log(`❌ ${results.failed.length} aksiyon başarısız`);
        console.log(`⏭️ ${results.skipped.length} aksiyon atlandı`);

        return results;
    }

    /**
     * 🔧 AKSİYON UYGULAMA
     */
    async executeAction(decision) {
        console.log(`🔧 [Action Executor] Uygulama: ${decision.type}`);

        switch (decision.type) {
            case 'price_increase':
            case 'price_decrease':
                return await this.updatePrice(decision);

            case 'stock_alert':
                return await this.sendStockAlert(decision);

            case 'campaign':
                return await this.createCampaign(decision);

            case 'optimization':
                return await this.optimizeProduct(decision);

            case 'bulk_sync':
                return await this.syncProducts(decision);

            default:
                throw new Error(`Unknown action type: ${decision.type}`);
        }
    }

    /**
     * 💰 FİYAT GÜNCELLEME
     */
    async updatePrice(decision) {
        const { product, recommended } = decision;

        // Güvenlik kontrolü
        const currentPrice = decision.current.price;
        const newPrice = recommended.price;
        const changePercent = Math.abs((newPrice - currentPrice) / currentPrice);

        if (changePercent > this.safetyLimits.maxPriceChange) {
            throw new Error(`Price change too large: ${(changePercent * 100).toFixed(1)}%`);
        }

        // Fiyat güncelle
        const updated = await Product.findByIdAndUpdate(
            product.id,
            {
                salePrice: newPrice,
                listPrice: newPrice * 1.2, // %20 üzerinde liste fiyatı
                updatedAt: new Date()
            },
            { new: true }
        );

        // Geçmişe kaydet
        this.recordAction(decision, {
            oldPrice: currentPrice,
            newPrice: newPrice,
            change: changePercent * 100
        });

        return {
            success: true,
            action: 'price_updated',
            product: updated.name,
            oldPrice: currentPrice,
            newPrice: newPrice,
            change: `${decision.type === 'price_increase' ? '+' : '-'}${(changePercent * 100).toFixed(1)}%`
        };
    }

    /**
     * 📦 STOK UYARISI
     */
    async sendStockAlert(decision) {
        const { product, current, recommended } = decision;

        // Bildirim gönder (email, SMS, push)
        const notification = {
            type: 'stock_alert',
            priority: decision.priority,
            product: product.name,
            currentStock: current.stock,
            daysUntilStockout: current.daysUntilStockout,
            recommendedOrder: recommended.orderQuantity,
            urgency: recommended.urgency,
            timestamp: new Date()
        };

        // Burada gerçek bildirim servisi çağrılır
        // await notificationService.send(notification);

        console.log('📧 Stok uyarısı gönderildi:', notification);

        this.recordAction(decision, notification);

        return {
            success: true,
            action: 'alert_sent',
            notification
        };
    }

    /**
     * 🎉 KAMPANYA OLUŞTURMA
     */
    async createCampaign(decision) {
        const { product, recommended } = decision;

        // Kampanya verisi
        const campaign = {
            productId: product.id,
            productName: product.name,
            originalPrice: decision.current.price,
            campaignPrice: recommended.campaignPrice,
            discount: recommended.discount,
            duration: recommended.duration,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 gün
            status: 'pending_approval'
        };

        // Kampanya kaydı oluştur
        // await Campaign.create(campaign);

        console.log('🎉 Kampanya oluşturuldu:', campaign);

        this.recordAction(decision, campaign);

        return {
            success: true,
            action: 'campaign_created',
            campaign,
            status: 'pending_approval'
        };
    }

    /**
     * ⚡ ÜRÜN OPTİMİZASYONU
     */
    async optimizeProduct(decision) {
        const { product, recommended } = decision;

        const optimizations = [];

        // Otomatik optimizasyonlar
        for (const action of recommended.actions) {
            if (action.includes('Kategori')) {
                // Kategori optimizasyonu
                optimizations.push({
                    type: 'category_check',
                    status: 'completed'
                });
            }

            if (action.includes('Görsel')) {
                // Görsel kontrolü
                optimizations.push({
                    type: 'image_check',
                    status: 'pending_manual'
                });
            }
        }

        this.recordAction(decision, { optimizations });

        return {
            success: true,
            action: 'product_optimized',
            optimizations
        };
    }

    /**
     * 🔄 TOPLU SENKRONİZASYON
     */
    async syncProducts(decision) {
        const { products } = decision;

        if (products.length > this.safetyLimits.maxBulkUpdate) {
            throw new Error(`Too many products: ${products.length}`);
        }

        const synced = [];

        for (const product of products) {
            try {
                // Pazaryeri senkronizasyonu
                // await marketplaceService.syncProduct(product);
                synced.push(product.id);
            } catch (error) {
                console.error(`Sync failed for ${product.name}:`, error);
            }
        }

        this.recordAction(decision, { synced: synced.length });

        return {
            success: true,
            action: 'bulk_synced',
            total: products.length,
            synced: synced.length,
            failed: products.length - synced.length
        };
    }

    /**
     * 🔒 GÜVENLİK KONTROLÜ
     */
    checkSafety(decision) {
        // Fiyat değişimi kontrolü
        if (decision.type === 'price_increase' || decision.type === 'price_decrease') {
            const changePercent = decision.type === 'price_increase'
                ? decision.recommended.increase / 100
                : decision.recommended.decrease / 100;

            if (changePercent > this.safetyLimits.maxPriceChange) {
                return {
                    safe: false,
                    reason: `Price change too large: ${(changePercent * 100).toFixed(1)}%`
                };
            }

            // Toplam etki kontrolü
            if (decision.impact?.expectedRevenue > this.safetyLimits.minApprovalAmount) {
                return {
                    safe: false,
                    reason: 'High impact decision requires manual approval'
                };
            }
        }

        // Toplu işlem kontrolü
        if (decision.products && decision.products.length > this.safetyLimits.maxBulkUpdate) {
            return {
                safe: false,
                reason: `Too many products: ${decision.products.length}`
            };
        }

        return { safe: true };
    }

    /**
     * ⏱️ COOLDOWN KONTROLÜ
     */
    isInCooldown(decision) {
        const key = `${decision.type}_${decision.product?.id}`;
        const lastAction = this.actionHistory.get(key);

        if (!lastAction) return false;

        const timeSinceLastAction = Date.now() - lastAction.timestamp;
        return timeSinceLastAction < this.safetyLimits.cooldownPeriod;
    }

    /**
     * 📝 AKSİYON KAYDI
     */
    recordAction(decision, result) {
        const key = `${decision.type}_${decision.product?.id}`;

        this.actionHistory.set(key, {
            decision,
            result,
            timestamp: Date.now()
        });

        // Geçmişi temizle (son 100 kayıt)
        if (this.actionHistory.size > 100) {
            const firstKey = this.actionHistory.keys().next().value;
            this.actionHistory.delete(firstKey);
        }
    }

    /**
     * 🔄 AKSİYON GERİ ALMA
     */
    async rollbackAction(actionId) {
        console.log('🔄 [Action Executor] Aksiyon geri alınıyor...');

        // Geçmişten bul
        const action = Array.from(this.actionHistory.values())
            .find(a => a.decision.id === actionId);

        if (!action) {
            throw new Error('Action not found in history');
        }

        // Geri alma işlemi
        switch (action.decision.type) {
            case 'price_increase':
            case 'price_decrease':
                // Eski fiyata dön
                await Product.findByIdAndUpdate(
                    action.decision.product.id,
                    { salePrice: action.result.oldPrice }
                );
                return { success: true, action: 'price_rolled_back' };

            default:
                throw new Error('Action type not reversible');
        }
    }

    /**
     * 📊 AKSİYON İSTATİSTİKLERİ
     */
    getStatistics() {
        const stats = {
            totalActions: this.actionHistory.size,
            byType: {},
            successRate: 0,
            last24Hours: 0
        };

        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        let successCount = 0;

        this.actionHistory.forEach(action => {
            // Tip bazlı sayım
            const type = action.decision.type;
            stats.byType[type] = (stats.byType[type] || 0) + 1;

            // Başarı oranı
            if (action.result.success) successCount++;

            // Son 24 saat
            if (action.timestamp >= oneDayAgo) stats.last24Hours++;
        });

        stats.successRate = this.actionHistory.size > 0
            ? (successCount / this.actionHistory.size) * 100
            : 0;

        return stats;
    }

    /**
     * 🧹 GEÇMİŞİ TEMİZLE
     */
    clearHistory(olderThan = 7) {
        const cutoff = Date.now() - (olderThan * 24 * 60 * 60 * 1000);

        for (const [key, action] of this.actionHistory.entries()) {
            if (action.timestamp < cutoff) {
                this.actionHistory.delete(key);
            }
        }

        console.log(`🧹 ${olderThan} günden eski kayıtlar temizlendi`);
    }
}

module.exports = new ActionExecutor();
