/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI CHAT SERVICE — LysiaETIC AI Operatör
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * GPT OLMADAN GPT GİBİ ÇALIŞAN CHAT SİSTEMİ
 *
 * Nasıl çalışır?
 *   1. Intent Detection  — Kullanıcı ne istiyor? (regex + keyword matching)
 *   2. Entity Extraction — Hangi ürün? Hangi marketplace? Ne kadar?
 *   3. Context Tracking  — Son 10 mesajı hatırla, bağlamı koru
 *   4. Data Query        — İlgili veriyi DB'den çek
 *   5. Response Build    — Akıllı, doğal dilde cevap üret
 *   6. Action Suggest    — Gerekirse aksiyon öner veya uygula
 *
 * INTENT CATEGORIES:
 *   - greeting          → Selamlama
 *   - status_query      → "Nasıl gidiyor?", "Durum ne?"
 *   - sales_query       → "Bugün kaç satış oldu?", "Ciro ne kadar?"
 *   - product_query     → "X ürünü nasıl?", "En çok satan ne?"
 *   - stock_query       → "Stok durumu ne?", "Hangi ürünler tükendi?"
 *   - price_query       → "Fiyatlar nasıl?", "X ürünün fiyatı ne?"
 *   - price_action      → "X ürünün fiyatını Y yap", "Fiyat artır"
 *   - stock_action      → "Stok ekle", "Sipariş ver"
 *   - analysis_request  → "Analiz yap", "Rapor ver"
 *   - recommendation    → "Ne yapmalıyım?", "Öneri ver"
 *   - problem_query     → "Sorun ne?", "Nerede hata var?"
 *   - profit_query      → "Kâr ne kadar?", "Zarar var mı?"
 *   - marketplace_query → "Trendyol nasıl?", "Hangi platform iyi?"
 *   - help              → "Yardım", "Ne yapabilirsin?"
 *   - unknown           → Anlaşılamayan mesajlar
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const AIOperator = require("./aiOperatorEngine");
const AIConversation = require("../models/AIConversation");
const AIMemory = require("../models/AIMemory");
const Product = require("../models/Product");
const Order = require("../models/Order");
const logger = require("../config/logger");

// ═════════════════════════════════════════════════════════════════════════════
// INTENT DETECTION — Kullanıcının niyetini anla
// ═════════════════════════════════════════════════════════════════════════════

const INTENT_PATTERNS = [
    // Selamlama
    { intent: "greeting", patterns: [
        /^(merhaba|selam|hey|hi|hello|günaydın|iyi\s*günler|iyi\s*akşamlar|iyi\s*geceler|naber|nasılsın)/i,
    ], priority: 1 },

    // Durum sorgusu
    { intent: "status_query", patterns: [
        /durum|nasıl\s*gidiyor|genel\s*durum|özet|summary|dashboard|ne\s*var\s*ne\s*yok|son\s*durum/i,
    ], priority: 2 },

    // Satış sorgusu
    { intent: "sales_query", patterns: [
        /satış|satıs|ciro|gelir|revenue|sipariş|siparis|order|bugün\s*kaç|kaç\s*satış|kaç\s*sipariş|günlük|haftalık|aylık/i,
    ], priority: 3 },

    // Ürün sorgusu
    { intent: "product_query", patterns: [
        /ürün|urun|en\s*çok\s*sat(an|ılan)|best\s*seller|top\s*product|hangi\s*ürün|ürün\s*performans/i,
    ], priority: 4 },

    // Stok sorgusu
    { intent: "stock_query", patterns: [
        /stok|stock|tüken|biten|kalan|envanter|inventory|stokta\s*yok|düşük\s*stok|stok\s*durumu/i,
    ], priority: 5 },

    // Fiyat sorgusu
    { intent: "price_query", patterns: [
        /fiyat|price|ne\s*kadar|kaça|pahalı|ucuz|indirim|kampanya|fiyat\s*durumu/i,
    ], priority: 6 },

    // Fiyat aksiyonu
    { intent: "price_action", patterns: [
        /fiyat.*(güncelle|değiştir|artır|düşür|yap|ayarla)|price.*(update|change|set)|(%\d+|yüzde\s*\d+).*(artır|indir)/i,
    ], priority: 7 },

    // Stok aksiyonu
    { intent: "stock_action", patterns: [
        /stok.*(ekle|artır|sipariş|order)|tedarik|restock|stok\s*sipariş/i,
    ], priority: 8 },

    // Analiz talebi
    { intent: "analysis_request", patterns: [
        /analiz|rapor|report|analysis|incele|değerlendir|teşhis|diagnos/i,
    ], priority: 9 },

    // Öneri talebi
    { intent: "recommendation", patterns: [
        /öneri|tavsiye|ne\s*yapmalı|ne\s*yapayım|recommend|suggest|fikir|strateji|plan|ne\s*önerirsin/i,
    ], priority: 10 },

    // Problem sorgusu
    { intent: "problem_query", patterns: [
        /sorun|problem|hata|yanlış|kötü|düşüş|risk|tehlike|uyarı|alert|kritik/i,
    ], priority: 11 },

    // Kâr sorgusu
    { intent: "profit_query", patterns: [
        /kâr|kar|zarar|loss|profit|marj|margin|kazanç|kayıp|maliyet|cost/i,
    ], priority: 12 },

    // Marketplace sorgusu
    { intent: "marketplace_query", patterns: [
        /trendyol|hepsiburada|n11|çiçeksepeti|ciceksepeti|amazon|marketplace|pazaryeri|platform|kanal/i,
    ], priority: 13 },

    // Yardım
    { intent: "help", patterns: [
        /yardım|help|ne\s*yapabilirsin|komut|command|özellik|feature|nasıl\s*kullan/i,
    ], priority: 14 },
];

function detectIntent(message) {
    const normalized = message.toLowerCase().trim();

    for (const { intent, patterns, priority } of INTENT_PATTERNS) {
        for (const pattern of patterns) {
            if (pattern.test(normalized)) {
                return { intent, confidence: Math.max(60, 95 - priority * 3), pattern: pattern.toString() };
            }
        }
    }

    return { intent: "unknown", confidence: 20, pattern: null };
}

// ═════════════════════════════════════════════════════════════════════════════
// ENTITY EXTRACTION — Mesajdan varlıkları çıkar
// ═════════════════════════════════════════════════════════════════════════════

function extractEntities(message) {
    const entities = {};

    // Sayı çıkarma (fiyat, miktar)
    const numbers = message.match(/\d+([.,]\d+)?/g);
    if (numbers) {
        entities.numbers = numbers.map(n => parseFloat(n.replace(",", ".")));
    }

    // Yüzde çıkarma
    const percentMatch = message.match(/[%yüzde]\s*(\d+)/i) || message.match(/(\d+)\s*[%yüzde]/i);
    if (percentMatch) {
        entities.percentage = parseFloat(percentMatch[1]);
    }

    // Marketplace çıkarma
    const marketplaces = [];
    if (/trendyol/i.test(message)) marketplaces.push("Trendyol");
    if (/hepsiburada/i.test(message)) marketplaces.push("Hepsiburada");
    if (/n11/i.test(message)) marketplaces.push("N11");
    if (/çiçeksepeti|ciceksepeti/i.test(message)) marketplaces.push("ÇiçekSepeti");
    if (/amazon/i.test(message)) marketplaces.push("Amazon");
    if (marketplaces.length > 0) entities.marketplaces = marketplaces;

    // Zaman çıkarma
    if (/bugün|today/i.test(message)) entities.timeframe = "today";
    else if (/dün|yesterday/i.test(message)) entities.timeframe = "yesterday";
    else if (/hafta|week/i.test(message)) entities.timeframe = "week";
    else if (/ay|month/i.test(message)) entities.timeframe = "month";

    // Barkod çıkarma (genelde uzun sayılar)
    const barcodeMatch = message.match(/\b\d{8,13}\b/);
    if (barcodeMatch) entities.barcode = barcodeMatch[0];

    return entities;
}

// ═════════════════════════════════════════════════════════════════════════════
// RESPONSE GENERATORS — Her intent için akıllı cevap üretici
// ═════════════════════════════════════════════════════════════════════════════

const responseGenerators = {

    greeting: async (userId, entities, context) => {
        const stats = await AIOperator.getQuickStats(userId);
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

        let statusLine = "";
        if (stats.healthScore > 0) {
            const emoji = stats.rating === "excellent" ? "🟢" : stats.rating === "good" ? "🔵" : stats.rating === "warning" ? "🟡" : "🔴";
            statusLine = `\n\n${emoji} İşletme sağlığı: **${stats.healthScore}/100** (${stats.rating})`;
            if (stats.criticalAlerts > 0) {
                statusLine += `\n⚠️ ${stats.criticalAlerts} kritik uyarı var!`;
            }
            if (stats.pendingRecs > 0) {
                statusLine += `\n📋 ${stats.pendingRecs} bekleyen öneri var.`;
            }
        }

        return {
            content: `${greeting}! 🤖 Ben LysiaETIC AI Operatör. İşletmenizi yönetmek için buradayım.${statusLine}\n\nSize nasıl yardımcı olabilirim? Satış durumu, stok analizi, fiyat optimizasyonu veya herhangi bir konuda sorabilirsiniz.`,
            suggestions: ["Bugün nasıl gidiyor?", "Stok durumu ne?", "Ne yapmalıyım?", "Sorunları göster"],
        };
    },

    status_query: async (userId, entities, context) => {
        const stats = await AIOperator.getQuickStats(userId);

        let observation;
        try {
            observation = await AIOperator.observe(userId);
        } catch (e) {
            return {
                content: `📊 Hızlı durum:\n• ${stats.productCount} ürün\n• ${stats.orderCount} sipariş\n• Sağlık: ${stats.healthScore}/100\n\nDetaylı analiz için veri toplanıyor...`,
                suggestions: ["Detaylı analiz yap", "Satış raporu", "Stok durumu"],
            };
        }

        const m = observation.metrics;
        const emoji = stats.rating === "excellent" ? "🟢" : stats.rating === "good" ? "🔵" : stats.rating === "warning" ? "🟡" : "🔴";

        let content = `${emoji} **İşletme Durumu**\n\n`;
        content += `📊 **Sağlık Skoru:** ${stats.healthScore}/100\n`;
        content += `📦 **Ürünler:** ${m.totalProducts} toplam, ${m.activeProducts} aktif\n`;
        content += `🛒 **Bugün:** ${m.totalOrdersToday} sipariş — ${m.todayRevenue.toFixed(0)}₺\n`;
        content += `📈 **Bu hafta:** ${m.weekRevenue.toFixed(0)}₺\n`;
        content += `📅 **Bu ay:** ${m.monthRevenue.toFixed(0)}₺ (${m.totalOrders30} sipariş)\n`;

        if (m.outOfStock > 0) content += `\n🚨 **${m.outOfStock} ürün stokta yok!**`;
        if (m.lossProducts > 0) content += `\n🔴 **${m.lossProducts} ürün zararda satılıyor!**`;
        if (m.lowStock > 0) content += `\n⚠️ ${m.lowStock} ürün düşük stokta`;
        if (m.deadProducts > 0) content += `\n💀 ${m.deadProducts} ölü ürün stokta bekliyor`;

        if (m.avgMargin >= 0) {
            content += `\n\n💰 **Ortalama kâr marjı:** %${m.avgMargin.toFixed(1)}`;
        }

        return {
            content,
            suggestions: ["Sorunları çöz", "Detaylı analiz", "Ne yapmalıyım?", "Kâr raporu"],
            dataSnapshot: m,
        };
    },

    sales_query: async (userId, entities, context) => {
        let observation;
        try {
            observation = await AIOperator.observe(userId);
        } catch (e) {
            return { content: "Satış verisi yüklenirken hata oluştu. Lütfen tekrar deneyin.", suggestions: ["Tekrar dene"] };
        }

        const m = observation.metrics;
        const timeframe = entities.timeframe || "today";

        let content = "📊 **Satış Raporu**\n\n";

        if (timeframe === "today" || !entities.timeframe) {
            content += `🛒 **Bugün:** ${m.totalOrdersToday} sipariş — ${m.todayRevenue.toFixed(0)}₺\n`;
            content += `📅 **Dün:** ${m.yesterdayRevenue.toFixed(0)}₺\n`;

            if (m.yesterdayRevenue > 0) {
                const change = ((m.todayRevenue - m.yesterdayRevenue) / m.yesterdayRevenue * 100);
                content += change >= 0
                    ? `📈 Düne göre **+%${change.toFixed(0)}** artış\n`
                    : `📉 Düne göre **%${Math.abs(change).toFixed(0)}** düşüş\n`;
            }
        }

        content += `\n📈 **Haftalık:** ${m.weekRevenue.toFixed(0)}₺\n`;
        content += `📅 **Aylık:** ${m.monthRevenue.toFixed(0)}₺ (${m.totalOrders30} sipariş)\n`;

        const avgDaily = m.monthRevenue / 30;
        if (avgDaily > 0) {
            content += `\n📊 **Günlük ortalama:** ${avgDaily.toFixed(0)}₺`;
            if (m.todayRevenue > avgDaily * 1.3) {
                content += ` — Bugün ortalamanın üstünde! 🎉`;
            } else if (m.todayRevenue < avgDaily * 0.7 && m.todayRevenue > 0) {
                content += ` — Bugün ortalamanın altında ⚠️`;
            }
        }

        return {
            content,
            suggestions: ["En çok satan ürünler", "Stok durumu", "Kâr analizi", "Trend analizi"],
            dataSnapshot: { todayRevenue: m.todayRevenue, weekRevenue: m.weekRevenue, monthRevenue: m.monthRevenue },
        };
    },

    stock_query: async (userId, entities, context) => {
        let observation;
        try {
            observation = await AIOperator.observe(userId);
        } catch (e) {
            return { content: "Stok verisi yüklenirken hata oluştu.", suggestions: ["Tekrar dene"] };
        }

        const { analyzedProducts, metrics } = observation;
        const m = metrics;

        let content = "📦 **Stok Durumu**\n\n";
        content += `✅ **Stokta:** ${m.activeProducts} ürün\n`;
        content += `🚨 **Tükenen:** ${m.outOfStock} ürün\n`;
        content += `⚠️ **Düşük stok:** ${m.lowStock} ürün\n`;

        // Tükenen ürünleri listele
        const outOfStockProducts = analyzedProducts
            .filter(p => p.stock === 0 || p.isOutOfStock)
            .sort((a, b) => b.avgDailySales - a.avgDailySales)
            .slice(0, 5);

        if (outOfStockProducts.length > 0) {
            content += `\n🚨 **Tükenen Ürünler (en çok satanlar):**\n`;
            outOfStockProducts.forEach((p, i) => {
                content += `${i + 1}. ${p.name.slice(0, 40)} — günlük ${p.avgDailySales.toFixed(1)} adet satılıyordu\n`;
            });
        }

        // Kritik düşük stok
        const criticalLow = analyzedProducts
            .filter(p => p.stock > 0 && p.daysOfStock < 5 && p.avgDailySales > 0.3)
            .sort((a, b) => a.daysOfStock - b.daysOfStock)
            .slice(0, 5);

        if (criticalLow.length > 0) {
            content += `\n⚠️ **5 Gün İçinde Tükenecekler:**\n`;
            criticalLow.forEach((p, i) => {
                content += `${i + 1}. ${p.name.slice(0, 40)} — ${p.stock} adet kaldı (${p.daysOfStock} gün)\n`;
            });
        }

        return {
            content,
            suggestions: ["Stok siparişi öner", "Tükenen ürünleri düzelt", "Satış raporu"],
        };
    },

    profit_query: async (userId, entities, context) => {
        let observation;
        try {
            observation = await AIOperator.observe(userId);
        } catch (e) {
            return { content: "Kâr verisi yüklenirken hata oluştu.", suggestions: ["Tekrar dene"] };
        }

        const { analyzedProducts, metrics } = observation;

        const productsWithCost = analyzedProducts.filter(p => p.costPrice > 0);
        const lossProducts = analyzedProducts.filter(p => p.profit < 0 && p.costPrice > 0 && p.totalSold > 0);
        const totalLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);

        let content = "💰 **Kârlılık Raporu**\n\n";

        if (productsWithCost.length === 0) {
            content += "⚠️ Hiçbir ürüne maliyet bilgisi girilmemiş! Kâr analizi yapabilmem için ürün maliyetlerini girmeniz gerekiyor.\n";
            content += "\n📝 Ürün Merkezi → Maliyet Bilgileri bölümünden maliyetleri girin.";
        } else {
            content += `📊 **Maliyet girilen ürün:** ${productsWithCost.length}/${analyzedProducts.length}\n`;
            content += `📈 **Ortalama kâr marjı:** %${metrics.avgMargin.toFixed(1)}\n`;

            if (lossProducts.length > 0) {
                content += `\n🔴 **${lossProducts.length} ürün ZARARDA satılıyor!**\n`;
                content += `💸 Toplam kayıp: **${totalLoss.toFixed(0)}₺**\n\n`;
                content += `En çok zarar ettiren ürünler:\n`;
                lossProducts
                    .sort((a, b) => (Math.abs(b.profit) * b.totalSold) - (Math.abs(a.profit) * a.totalSold))
                    .slice(0, 5)
                    .forEach((p, i) => {
                        content += `${i + 1}. ${p.name.slice(0, 35)} — ${Math.abs(p.profit).toFixed(0)}₺/adet zarar (${p.totalSold} adet satıldı)\n`;
                    });
            } else {
                content += `\n✅ Zararda satılan ürün yok!`;
            }

            // En kârlı ürünler
            const topProfit = productsWithCost
                .filter(p => p.profit > 0 && p.totalSold > 0)
                .sort((a, b) => (b.profit * b.totalSold) - (a.profit * a.totalSold))
                .slice(0, 5);

            if (topProfit.length > 0) {
                content += `\n\n🏆 **En Kârlı Ürünler:**\n`;
                topProfit.forEach((p, i) => {
                    content += `${i + 1}. ${p.name.slice(0, 35)} — +${p.profit.toFixed(0)}₺/adet (%${p.profitMargin.toFixed(0)} marj)\n`;
                });
            }
        }

        return {
            content,
            suggestions: ["Zarar eden ürünleri düzelt", "Fiyat optimizasyonu", "Maliyet gir"],
        };
    },

    problem_query: async (userId, entities, context) => {
        let alertsData;
        try {
            alertsData = await AIOperator.generateProactiveAlerts(userId);
        } catch (e) {
            return { content: "Sorun analizi yapılırken hata oluştu. Lütfen tekrar deneyin.", suggestions: ["Tekrar dene"] };
        }

        const alertsList = alertsData?.alerts || [];
        let content = "🔍 **Tespit Edilen Sorunlar**\n\n";

        if (alertsList.length === 0) {
            content += "✅ Şu an kritik bir sorun tespit edilmedi! İşler yolunda görünüyor.\n";
            const healthScore = alertsData?.businessHealth?.score || 0;
            if (healthScore > 0) {
                content += `\n📊 İşletme sağlığı: ${healthScore}/100`;
            }
        } else {
            alertsList.forEach((alert, i) => {
                content += `${alert.icon || "⚠️"} **${alert.title}**\n`;
                content += `   ${alert.message}\n`;
                content += `   → ${alert.action}\n\n`;
            });
        }

        return {
            content,
            suggestions: ["Sorunları çöz", "Detaylı analiz", "Risk raporu", "Ne yapmalıyım?"],
        };
    },

    recommendation: async (userId, entities, context) => {
        let observation, analysis;
        try {
            observation = await AIOperator.observe(userId);
            analysis = AIOperator.analyze(observation);
        } catch (e) {
            return { content: "Analiz yapılırken hata oluştu.", suggestions: ["Tekrar dene"] };
        }

        const { focusItems, emotionalTone } = analysis;

        let content = `${emotionalTone.emoji} **AI Operatör Önerileri**\n\n`;
        content += `${emotionalTone.message}\n\n`;

        if (focusItems.length === 0) {
            content += "✅ Şu an acil bir aksiyon gerekmiyor. İşler yolunda!\n";
        } else {
            content += "🎯 **Öncelikli Aksiyonlar:**\n\n";
            focusItems.forEach((item, i) => {
                content += `${item.icon} **${item.title}**\n`;
                content += `   ${item.description}\n`;
                content += `   💰 Etki: ${item.impact}\n`;
                content += `   → ${item.action}\n\n`;
            });
        }

        return {
            content,
            suggestions: ["Hepsini uygula", "Detaylı analiz", "Risk raporu", "Satış raporu"],
        };
    },

    product_query: async (userId, entities, context) => {
        let observation;
        try {
            observation = await AIOperator.observe(userId);
        } catch (e) {
            return { content: "Ürün verisi yüklenirken hata oluştu.", suggestions: ["Tekrar dene"] };
        }

        const { analyzedProducts } = observation;

        // En çok satanlar
        const topSellers = analyzedProducts
            .filter(p => p.totalSold > 0)
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, 5);

        let content = "🏆 **Ürün Performansı**\n\n";
        content += `📦 Toplam: ${analyzedProducts.length} ürün\n\n`;

        if (topSellers.length > 0) {
            content += "**En Çok Satanlar (Son 90 Gün):**\n";
            topSellers.forEach((p, i) => {
                content += `${i + 1}. ${p.name.slice(0, 40)}\n`;
                content += `   📊 ${p.totalSold} adet | ${p.totalRevenue.toFixed(0)}₺ ciro | Stok: ${p.stock}\n`;
            });
        } else {
            content += "Henüz satış verisi yok. Siparişler senkronize edildikçe burada görünecek.\n";
        }

        // En kötü performans
        const worst = analyzedProducts
            .filter(p => p.healthScore < 30 && p.stock > 0)
            .sort((a, b) => a.healthScore - b.healthScore)
            .slice(0, 3);

        if (worst.length > 0) {
            content += "\n\n⚠️ **Dikkat Gerektiren Ürünler:**\n";
            worst.forEach((p, i) => {
                content += `${i + 1}. ${p.name.slice(0, 40)} — Sağlık: ${p.healthScore}/100\n`;
            });
        }

        return {
            content,
            suggestions: ["Stok durumu", "Kâr analizi", "Ölü ürünler", "Fiyat optimizasyonu"],
        };
    },

    marketplace_query: async (userId, entities, context) => {
        let observation;
        try {
            observation = await AIOperator.observe(userId);
        } catch (e) {
            return { content: "Marketplace verisi yüklenirken hata oluştu.", suggestions: ["Tekrar dene"] };
        }

        const { marketplaces, orders30 } = observation;

        let content = "🏪 **Pazaryeri Durumu**\n\n";

        if (marketplaces.length === 0) {
            content += "Henüz aktif pazaryeri bağlantısı yok. Ayarlar → Pazaryerleri bölümünden ekleyin.\n";
        } else {
            // Marketplace bazlı sipariş dağılımı
            const mpOrders = {};
            for (const o of orders30) {
                const mp = o.marketplaceName || "Diğer";
                if (!mpOrders[mp]) mpOrders[mp] = { count: 0, revenue: 0 };
                mpOrders[mp].count++;
                mpOrders[mp].revenue += o.totalPrice || 0;
            }

            marketplaces.forEach(mp => {
                const stats = mpOrders[mp.marketplaceName] || { count: 0, revenue: 0 };
                const isActive = mp.isActive !== false;
                content += `${isActive ? "✅" : "❌"} **${mp.marketplaceName}**\n`;
                content += `   📦 ${stats.count} sipariş | 💰 ${stats.revenue.toFixed(0)}₺ (son 30 gün)\n\n`;
            });
        }

        return {
            content,
            suggestions: ["Satış raporu", "Hangi platform daha iyi?", "Ürün dağılımı"],
        };
    },

    analysis_request: async (userId, entities, context) => {
        let observation, analysis;
        try {
            observation = await AIOperator.observe(userId);
            analysis = AIOperator.analyze(observation);
        } catch (e) {
            return { content: "Analiz yapılırken hata oluştu.", suggestions: ["Tekrar dene"] };
        }

        const { businessHealth, lossHunter, risks, predictions, segmentation } = analysis;
        const m = observation.metrics;

        let content = "🧠 **Detaylı AI Analizi**\n\n";

        // Business Health
        const emoji = businessHealth.rating === "excellent" ? "🟢" : businessHealth.rating === "good" ? "🔵" : businessHealth.rating === "warning" ? "🟡" : "🔴";
        content += `${emoji} **İşletme Sağlığı: ${businessHealth.overallScore}/100**\n`;
        content += `   💰 Kârlılık: ${businessHealth.profitHealth}/100\n`;
        content += `   📦 Stok: ${businessHealth.stockHealth}/100\n`;
        content += `   📈 Satış: ${businessHealth.salesHealth}/100\n`;
        content += `   ⚙️ Operasyon: ${businessHealth.operationsHealth}/100\n\n`;

        // Kayıplar
        const totalLoss = lossHunter?.totalImpact || lossHunter?.totalLostProfit || 0;
        if (totalLoss > 0) {
            content += `💸 **Tespit Edilen Kayıp:** ${totalLoss.toFixed(0)}₺\n`;
            content += `   ${lossHunter.summary || ""}\n\n`;
        }

        // Riskler
        if (risks) {
            content += `⚠️ **Risk Seviyesi:** ${risks.overallRiskLevel || "bilinmiyor"}\n`;
            content += `   ${risks.riskCount?.high || 0} yüksek, ${risks.riskCount?.medium || 0} orta risk\n\n`;
        }

        // Segmentasyon
        if (segmentation) {
            content += `📊 **Ürün Segmentasyonu:**\n`;
            content += `   ⭐ Yıldızlar: ${segmentation.stars?.count || 0}\n`;
            content += `   🐄 Nakit İnekleri: ${segmentation.cashCows?.count || 0}\n`;
            content += `   ❓ Soru İşaretleri: ${segmentation.questionMarks?.count || 0}\n`;
            content += `   🐕 Köpekler: ${segmentation.dogs?.count || 0}\n`;
        }

        return {
            content,
            suggestions: ["Ne yapmalıyım?", "Sorunları çöz", "Kâr raporu", "Risk detayları"],
        };
    },

    help: async (userId, entities, context) => {
        return {
            content: `🤖 **LysiaETIC AI Operatör — Yardım**\n\nBen işletmenizi yöneten yapay zeka asistanınızım. İşte yapabileceklerim:\n\n📊 **Sorgular:**\n• "Nasıl gidiyor?" — Genel durum özeti\n• "Bugün kaç satış oldu?" — Satış raporu\n• "Stok durumu ne?" — Stok analizi\n• "Kâr ne kadar?" — Kârlılık raporu\n• "Sorunlar ne?" — Problem tespiti\n• "Trendyol nasıl?" — Marketplace analizi\n\n🎯 **Öneriler:**\n• "Ne yapmalıyım?" — AI önerileri\n• "Analiz yap" — Detaylı analiz\n• "Öneri ver" — Aksiyon önerileri\n\n⚡ **Aksiyonlar:**\n• "Fiyat güncelle" — Fiyat değişikliği\n• "Stok ekle" — Stok siparişi\n\n🧠 **Özellikler:**\n• Konuşma hafızası — Son mesajlarınızı hatırlarım\n• Öğrenme — Yaptığım aksiyonların sonuçlarını takip ederim\n• Proaktif uyarılar — Kritik durumları size bildiririm\n\n3 Kontrol Modu:\n🟢 Passive — Sadece analiz + öneri\n🟡 Assisted — Öneri + onay ile uygulama\n🔴 Autonomous — Tam otomatik`,
            suggestions: ["Nasıl gidiyor?", "Ne yapmalıyım?", "Stok durumu", "Kâr raporu"],
        };
    },

    price_action: async (userId, entities, context) => {
        return {
            content: "💰 **Fiyat Güncelleme**\n\nFiyat güncellemesi için lütfen şu bilgileri verin:\n\n1. Hangi ürün? (ürün adı veya barkod)\n2. Yeni fiyat ne olsun?\n\nÖrnek: \"X ürününün fiyatını 150₺ yap\"\n\n⚠️ Güvenlik: Tek seferde max %20 fiyat değişikliği yapılabilir.",
            suggestions: ["Zarar eden ürünlerin fiyatını düzelt", "Tüm fiyatları %5 artır", "Fiyat önerileri"],
        };
    },

    stock_action: async (userId, entities, context) => {
        return {
            content: "📦 **Stok Yönetimi**\n\nStok işlemi için ne yapmak istiyorsunuz?\n\n1. **Tükenen ürünleri göster** — Stokta olmayan ürünler\n2. **Stok siparişi öner** — AI'ın tedarik önerileri\n3. **Kritik stok uyarıları** — 5 gün içinde tükenecekler\n\n⚠️ Not: Stok siparişleri tedarikçiye manuel verilmelidir. AI sadece miktar önerir.",
            suggestions: ["Tükenen ürünler", "Stok siparişi öner", "Kritik stok uyarıları"],
        };
    },

    unknown: async (userId, entities, context) => {
        return {
            content: "🤔 Tam olarak ne istediğinizi anlayamadım. Şunları sorabilirsiniz:\n\n• \"Nasıl gidiyor?\" — Genel durum\n• \"Satışlar nasıl?\" — Satış raporu\n• \"Stok durumu\" — Stok analizi\n• \"Ne yapmalıyım?\" — AI önerileri\n• \"Yardım\" — Tüm komutlar\n\nVeya doğal dilde sorunuzu yazın, anlamaya çalışacağım! 🤖",
            suggestions: ["Nasıl gidiyor?", "Ne yapmalıyım?", "Yardım", "Stok durumu"],
        };
    },
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN CHAT FUNCTION — Ana sohbet fonksiyonu
// ═════════════════════════════════════════════════════════════════════════════

async function processMessage(userId, sessionId, userMessage) {
    const startTime = Date.now();

    try {
        // 1. Intent Detection
        const { intent, confidence } = detectIntent(userMessage);

        // 2. Entity Extraction
        const entities = extractEntities(userMessage);

        // 3. Get/Create conversation
        let conversation = await AIConversation.findOne({ userId, sessionId });
        if (!conversation) {
            conversation = await AIConversation.create({
                userId,
                sessionId,
                title: userMessage.slice(0, 50),
                messages: [],
                context: { operationMode: "assisted" },
                stats: { messageCount: 0, userMessageCount: 0, aiMessageCount: 0 },
            });
        }

        // 4. Add user message
        conversation.messages.push({
            role: "user",
            content: userMessage,
            metadata: { intent, confidence, entities },
            timestamp: new Date(),
        });

        // 5. Build context from recent messages
        const recentMessages = conversation.messages.slice(-10);
        const context = {
            recentMessages,
            currentTopic: conversation.context?.currentTopic,
            operationMode: conversation.context?.operationMode || "assisted",
        };

        // 6. Generate response
        const generator = responseGenerators[intent] || responseGenerators.unknown;
        const response = await generator(userId, entities, context);

        // 7. Add AI response
        conversation.messages.push({
            role: "ai",
            content: response.content,
            metadata: {
                intent,
                confidence,
                entities,
                emotionalTone: response.emotionalTone || "neutral",
                suggestions: response.suggestions || [],
                dataSnapshot: response.dataSnapshot,
            },
            timestamp: new Date(),
        });

        // 8. Update conversation stats & context
        conversation.stats.messageCount = conversation.messages.length;
        conversation.stats.userMessageCount = conversation.messages.filter(m => m.role === "user").length;
        conversation.stats.aiMessageCount = conversation.messages.filter(m => m.role === "ai").length;
        conversation.context.currentTopic = intent;
        if (entities.marketplaces) {
            conversation.context.mentionedMarketplaces = [
                ...new Set([...(conversation.context.mentionedMarketplaces || []), ...entities.marketplaces])
            ];
        }

        // 9. Keep only last 50 messages (memory management)
        if (conversation.messages.length > 50) {
            conversation.messages = conversation.messages.slice(-50);
        }

        await conversation.save();

        const durationMs = Date.now() - startTime;

        return {
            success: true,
            response: {
                content: response.content,
                suggestions: response.suggestions || [],
                intent,
                confidence,
                entities,
            },
            conversationId: conversation._id,
            sessionId,
            messageCount: conversation.stats.messageCount,
            durationMs,
        };
    } catch (err) {
        logger.error(`💬 [AI Chat] processMessage ERROR: ${err.message}`);
        return {
            success: false,
            response: {
                content: "Bir hata oluştu. Lütfen tekrar deneyin. 🔄",
                suggestions: ["Tekrar dene", "Yardım"],
                intent: "error",
                confidence: 0,
            },
            durationMs: Date.now() - startTime,
        };
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONVERSATION MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

async function getConversationHistory(userId, sessionId) {
    const conversation = await AIConversation.findOne({ userId, sessionId }).lean();
    if (!conversation) return { messages: [], sessionId };

    return {
        messages: conversation.messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            metadata: {
                intent: m.metadata?.intent,
                suggestions: m.metadata?.suggestions,
            },
        })),
        sessionId,
        stats: conversation.stats,
        context: conversation.context,
    };
}

async function getRecentConversations(userId, limit = 10) {
    const conversations = await AIConversation.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select("sessionId title status stats updatedAt")
        .lean();

    return conversations;
}

async function clearConversation(userId, sessionId) {
    await AIConversation.deleteOne({ userId, sessionId });
    return { success: true, message: "Konuşma silindi" };
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    processMessage,
    getConversationHistory,
    getRecentConversations,
    clearConversation,
    detectIntent,
    extractEntities,
};
