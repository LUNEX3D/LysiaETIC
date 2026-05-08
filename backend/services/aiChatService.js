/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI CHAT SERVICE — LysiaETIC AI Operatör
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Hibrit ajan: Ollama (yerel, ücretsiz) veya OpenAI + mağaza bağlamı + kural tabanlı özet;
 * dil modeli kapalıysa yalnızca kural tabanlı yanıt (intent → şablon / veri).
 *
 * Akış:
 *   1. Intent + varlık çıkarımı
 *   2. Kural tabanlı yanıt (sayılar ve öneriler için güvenilir kaynak)
 *   3. LLM açıksa: mağaza özeti + iç motor özeti ile doğal dilde cevap
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
const { isLlmEnabled, chatCompletion, getLlmConfig } = require("./llmChatRouter");

/** Ajan yanıtında gösterilecek Türkçe niyet etiketleri */
const INTENT_LABELS_TR = {
    greeting: "Selamlama",
    status_query: "Genel durum",
    sales_query: "Satış / ciro",
    product_query: "Ürün performansı",
    stock_query: "Stok",
    price_query: "Fiyat",
    price_action: "Fiyat aksiyonu",
    stock_action: "Stok aksiyonu",
    analysis_request: "Analiz",
    recommendation: "Öneri",
    problem_query: "Sorun / risk",
    profit_query: "Kârlılık",
    marketplace_query: "Pazaryeri",
    help: "Yardım",
    unknown: "Belirsiz",
    wellbeing_chat: "Hal hatır",
};

/** Bu niyetlerde mağaza / operatör verisi okunur */
const INTENTS_USING_STORE_DATA = new Set([
    "status_query", "sales_query", "product_query", "stock_query", "price_query",
    "analysis_request", "recommendation", "problem_query", "profit_query", "marketplace_query",
]);

const AGENT_MODEL_ID = "lysia-agent-v1";

const AGENT_NOTE_HYBRID =
    "Hibrit ajan: niyet + mağaza özeti + dil modeli (ücretsiz yerel Ollama veya isteğe bağlı OpenAI). İşletme sayıları yalnızca MAĞAZA_VERİSİ ve iç motor özetine dayanmalıdır.";

const AGENT_NOTE_RULES =
    "Kurallı mod: dil modeli kapalı (Ollama/OpenAI yok veya hata); yanıt şablon / kural tabanlıdır.";

const LYSIA_AGENT_SYSTEM_PROMPT = `Sen "Lysia Agent" adında, LysiaETIC platformunda çalışan bir e-ticaret ve pazaryeri satıcı asistanısın.
Kullanıcıyla öncelikle Türkçe, doğal ve profesyonel konuş.

KURALLAR:
1) "MAĞAZA_VERİSİ" bloğundaki rakamlar bu kullanıcının hesabına ait özet veridir; iş / mağaza sorularında bunları esas al. Bu blokta olmayan sipariş, stok veya ciro detayını asla uydurma.
2) "İÇ MOTOR ÖZETİ" varsa iş sorusunda onu destek olarak kullan; çelişki olursa MAĞAZA_VERİSİ ve iç motor özetindeki somut rakamlara öncelik ver.
3) Kullanıcı iş dışı genel konu sorarsa (bilgi, sohbet, hayat, teknik genel sorular) makul uzunlukta cevap ver; bilmediğini kabul et. Her yanıtı zorla satışa bağlamak zorunda değilsin; nazikçe teklif edebilirsin.
4) Güvenlik: API anahtarı, şifre veya gizli veri isteme; kullanıcıdan hassas kimlik bilgisi toplama.
5) Markdown başlıkları kullanabilirsin; abartılı emoji kullanma (gerekirse en fazla bir iki tane).`;

/**
 * Sohbette "ajan akışı" — kullanıcıya şeffaflık için adımlar
 */
function buildAgentTrace(intent, confidence, entities, options = {}) {
    const trace = [
        {
            id: "perceive",
            label: "Algılama",
            detail: "Mesajınız güvenli biçimde alındı ve tokenize edildi.",
            status: "done",
        },
        {
            id: "intent",
            label: "Niyet çıkarımı",
            detail: `${INTENT_LABELS_TR[intent] || intent} · güven ${Math.round(Number(confidence) || 0)}%`,
            status: "done",
        },
    ];

    const ent = entities && typeof entities === "object" ? entities : {};
    const parts = [];
    if (ent.marketplaces?.length) parts.push(`Kanallar: ${ent.marketplaces.join(", ")}`);
    if (ent.timeframe) parts.push(`Zaman: ${ent.timeframe}`);
    if (ent.barcode) parts.push(`Barkod: ${ent.barcode}`);
    if (ent.numbers?.length) parts.push(`Sayılar: ${ent.numbers.slice(0, 5).join(", ")}`);
    if (ent.percentage != null) parts.push(`Oran: %${ent.percentage}`);
    if (parts.length > 0) {
        trace.push({
            id: "entities",
            label: "Varlıklar",
            detail: parts.join(" · "),
            status: "done",
        });
    }

    if (INTENTS_USING_STORE_DATA.has(intent)) {
        trace.push({
            id: "retrieve",
            label: "Veri katmanı",
            detail: options.dataDetail || "Ürün, sipariş ve AI Operatör metrikleri okundu.",
            status: "done",
        });
    }

    if (options.storeContextInjected) {
        trace.push({
            id: "context",
            label: "Mağaza bağlamı",
            detail: "Özet metrikler dil modeline iletildi.",
            status: "done",
        });
    }

    if (options.llmModel) {
        const llmTag = String(options.llmModel).startsWith("ollama:") ? "Ollama (yerel)" : "OpenAI";
        trace.push({
            id: "llm",
            label: "Dil modeli",
            detail: `${options.llmModel} (${llmTag})`,
            status: "done",
        });
    } else if (options.llmSkippedReason) {
        trace.push({
            id: "llm",
            label: "Dil modeli",
            detail: options.llmSkippedReason,
            status: "skipped",
        });
    }

    trace.push({
        id: "synthesize",
        label: "Yanıt üretimi",
        detail: options.llmModel ? "LLM + mağaza bağlamı birleştirildi." : "Kural tabanlı şablon.",
        status: "done",
    });

    return trace;
}

/**
 * LLM sistem mesajına giden kısa mağaza özeti
 */
async function buildStoreContextSummary(userId) {
    const lines = [];
    try {
        const stats = await AIOperator.getQuickStats(userId);
        lines.push(`Sağlık skoru: ${stats.healthScore ?? "—"}/100 (${stats.rating || "—"})`);
        if (stats.pendingRecs != null) lines.push(`Bekleyen öneriler: ${stats.pendingRecs}`);
        if (stats.criticalAlerts != null) lines.push(`Kritik / yüksek uyarı sayısı: ${stats.criticalAlerts}`);
        if (stats.productCount != null) lines.push(`Ürün (özet): ${stats.productCount}`);
        if (stats.orderCount != null) lines.push(`Sipariş (özet): ${stats.orderCount}`);
    } catch (e) {
        lines.push(`Hızlı istatistik alınamadı: ${e.message}`);
    }
    try {
        const observation = await AIOperator.observe(userId);
        const m = observation?.metrics;
        if (m) {
            lines.push("--- Sipariş / stok metrikleri (AI Operatör) ---");
            lines.push(`Ürün: ${m.activeProducts}/${m.totalProducts} aktif/toplam`);
            lines.push(`Bugün: ${m.totalOrdersToday} sipariş, ${Number(m.todayRevenue || 0).toFixed(0)} TL ciro`);
            lines.push(`Bu hafta ciro: ${Number(m.weekRevenue || 0).toFixed(0)} TL`);
            lines.push(`Bu ay: ${Number(m.monthRevenue || 0).toFixed(0)} TL (${m.totalOrders30} sipariş, ~30 gün)`);
            if (m.outOfStock) lines.push(`Stokta yok: ${m.outOfStock} kalem`);
            if (m.lowStock) lines.push(`Düşük stok: ${m.lowStock}`);
            if (m.lossProducts) lines.push(`Zarar riski ürün sayısı: ${m.lossProducts}`);
            if (m.avgMargin >= 0) lines.push(`Ortalama kâr marjı (özet): %${Number(m.avgMargin).toFixed(1)}`);
        }
    } catch (e) {
        lines.push(`Detaylı gözlem alınamadı: ${e.message}`);
    }
    return lines.join("\n");
}

// ═════════════════════════════════════════════════════════════════════════════
// INTENT DETECTION — Kullanıcının niyetini anla
// ═════════════════════════════════════════════════════════════════════════════

const INTENT_PATTERNS = [
    // Hal hatır — "nasılsın" / "naber" tam mesaj; uzun karşılama metnini tekrarlatma
    { intent: "wellbeing_chat", patterns: [
        /^(nasılsın|naber|ne\s*haber)(\s*[\?!\.…]*)?\s*$/i,
        /^(nasıl\s*gidiyorsun|iyi\s*misin|iyi\s*misiniz|how\s+are\s+you)(\s*[\?!\.…]*)?\s*$/i,
    ], priority: 0 },

    // Selamlama (nasılsın / naber burada değil — wellbeing_chat)
    { intent: "greeting", patterns: [
        /^(merhaba|selam|hey|hi|hello|günaydın|iyi\s*günler|iyi\s*akşamlar|iyi\s*geceler)\b/i,
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

    wellbeing_chat: async () => {
        return {
            content:
                `İyiyim, teşekkür ederim. Ben yazılım tabanlı bir işletme ajanıyım; sizin gibi yorulmam ama panelinizdeki işleri hızlandırmak için buradayım.\n\n` +
                `Siz nasılsınız? Hazırsanız doğrudan mağaza özetine geçebiliriz.`,
            suggestions: ["Nasıl gidiyor?", "Stok durumu", "Ne yapmalıyım?", "Yardım"],
        };
    },

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
            content:
                `${greeting}! Ben **Lysia Agent** — mağazanız için çalışan işletme operatör asistanıyım. ` +
                `Sorularınızı niyet ve veri katmanları üzerinden işler, yanıtları doğrudan hesabınızdaki ölçümlere bağlarım.${statusLine}\n\n` +
                `Bugün neye odaklanalım? Örneğin satış özeti, stok riski veya “ne yapmalıyım?” diye sorabilirsiniz.`,
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
        const cfg = getLlmConfig();
        const llmLine =
            !llmOn
                ? " şu an yalnızca kural tabanlı modda yanıt üretirim."
                : cfg.type === "ollama"
                    ? " **yerel Ollama** (ücretsiz, kendi bilgisayarınızda) ile doğal dilde konuşurum."
                    : " **OpenAI** (ücretli API) ile doğal dilde konuşurum.";
        return {
            content:
                `**Lysia Agent — sistem kartı**\n\n` +
                `Çok katmanlı bir e-ticaret asistanıyım: niyet çıkarımı, mağaza verisi ve` +
                llmLine +
                `\n\n📊 **Sorgu örnekleri:**\n` +
                `• "Nasıl gidiyor?" — Genel durum\n` +
                `• "Bugün kaç satış?" — Ciro / sipariş\n` +
                `• "Stok durumu?" — Envanter riski\n` +
                `• "Kâr ne kadar?" — Kârlılık\n` +
                `• "Trendyol nasıl?" — Kanal bazlı bakış\n\n` +
                `🎯 **Öneri:** "Ne yapmalıyım?" veya "Analiz yap"\n` +
                `⚡ **Aksiyon (rehber):** Fiyat / stok ifadeleri — güvenlik kuralları geçerlidir.\n\n` +
                `**Çalışma modları:** Pasif · Asistan · Otonom (AI Operatör panelinden).`,
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
            content:
                `Niyet sınıfım **belirsiz** kaldı; yine de yardımcı olmak için şu kalıpları öneririm:\n\n` +
                `• "Nasıl gidiyor?" — Özet\n` +
                `• "Satışlar?" — Ciro\n` +
                `• "Stok?" — Envanter\n` +
                `• "Ne yapmalıyım?" — Önceliklendirme\n` +
                `• "Yardım" — Yetenek listesi\n\n` +
                `Cümleyi biraz daha net yazarsanız, aynı ajan hattı tekrar devreye girer.`,
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
        userMessage = String(userMessage || "").trim();
        if (userMessage.length > 8000) userMessage = userMessage.slice(0, 8000);

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

        // 6. Kural tabanlı yanıt (öneriler, snapshot, LLM için sayısal zemin)
        const generator = responseGenerators[intent] || responseGenerators.unknown;
        const ruleResponse = await generator(userId, entities, context);

        let finalContent = ruleResponse.content;
        let llmModelUsed = null;
        let llmSkippedReason = null;
        let storeContextInjected = false;

        if (isLlmEnabled()) {
            try {
                const storeContext = await buildStoreContextSummary(userId);
                storeContextInjected = true;

                const factualBlock =
                    ruleResponse.content && ruleResponse.content.length > 0
                        ? `\n\n=== İÇ MOTOR ÖZETİ (işletme sorunuz buysa buradaki sayı ve maddelere sadık kal; çelişki olursa MAĞAZA_VERİSİ önceliklidir) ===\n${ruleResponse.content.slice(0, 8000)}`
                        : "";

                const systemPayload = `${LYSIA_AGENT_SYSTEM_PROMPT}\n\n=== MAĞAZA_VERİSİ ===\n${storeContext}${factualBlock}`;

                const priorMsgs = conversation.messages.slice(0, -1).slice(-10);
                const openAiMessages = priorMsgs
                    .filter((m) => m.role === "user" || m.role === "ai")
                    .map((m) => ({
                        role: m.role === "ai" ? "assistant" : "user",
                        content: String(m.content || "").slice(0, 4000),
                    }));
                openAiMessages.push({ role: "user", content: userMessage.slice(0, 4000) });

                const { text, model } = await chatCompletion(
                    [{ role: "system", content: systemPayload }, ...openAiMessages],
                    { temperature: 0.65, max_tokens: 1400, timeoutMs: 90000 }
                );
                finalContent = text;
                llmModelUsed = model;
            } catch (e) {
                llmSkippedReason = `LLM kullanılamadı: ${e.message}`;
                logger.warn(`[AI Chat] ${llmSkippedReason}`);
            }
        } else {
            llmSkippedReason = "LLM kapalı — .env içinde USE_OLLAMA=true veya OLLAMA_BASE_URL (yerel) ya da OPENAI_API_KEY (bulut) tanımlayın; tamamen kapatmak için LYSIA_LLM_PROVIDER=none";
        }

        const agentTrace = buildAgentTrace(intent, confidence, entities, {
            dataDetail: INTENTS_USING_STORE_DATA.has(intent)
                ? "MongoDB + AI Operatör gözlemi (ürün / sipariş / skor)."
                : undefined,
            storeContextInjected: !!(storeContextInjected && llmModelUsed),
            llmModel: llmModelUsed,
            llmSkippedReason: llmModelUsed ? null : llmSkippedReason,
        });

        const agentNoteFinal = llmModelUsed ? AGENT_NOTE_HYBRID : AGENT_NOTE_RULES;
        const agentModelFinal = llmModelUsed ? `${AGENT_MODEL_ID} · ${llmModelUsed}` : AGENT_MODEL_ID;

        // 7. Add AI response
        conversation.messages.push({
            role: "ai",
            content: finalContent,
            metadata: {
                intent,
                confidence,
                entities,
                emotionalTone: ruleResponse.emotionalTone || "neutral",
                suggestions: ruleResponse.suggestions || [],
                dataSnapshot: ruleResponse.dataSnapshot,
                agentTrace,
                agentModel: agentModelFinal,
                agentNote: agentNoteFinal,
                llmModel: llmModelUsed || undefined,
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
                content: finalContent,
                suggestions: ruleResponse.suggestions || [],
                intent,
                confidence,
                entities,
                agentTrace,
                agentModel: agentModelFinal,
                agentNote: agentNoteFinal,
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
                content: "Sistem tarafında bir hata oluştu; ajan hattı yanıtı tamamlayamadı. Lütfen tekrar deneyin.",
                suggestions: ["Tekrar dene", "Yardım"],
                intent: "error",
                confidence: 0,
                agentTrace: [
                    { id: "error", label: "Hata", detail: err.message || "Bilinmeyen", status: "error" },
                ],
                agentModel: AGENT_MODEL_ID,
                agentNote: AGENT_NOTE_RULES,
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
                agentTrace: m.metadata?.agentTrace,
                agentModel: m.metadata?.agentModel,
                agentNote: m.metadata?.agentNote,
                llmModel: m.metadata?.llmModel,
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
    buildAgentTrace,
    AGENT_MODEL_ID,
    AGENT_NOTE_HYBRID,
    AGENT_NOTE_RULES,
};
