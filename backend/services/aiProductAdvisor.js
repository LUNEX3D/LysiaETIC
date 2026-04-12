/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI PRODUCT ADVISOR — LysiaETIC
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * "Bu ürün neden satılmıyor?" + "Nasıl satılır?" motoru.
 *
 * Felsefe: "Pasife al" DEĞİL → "Bunları yaparak satabilirsin"
 *
 * Her ürün için:
 *   1. Kök neden analizi (neden satılmıyor?)
 *   2. Çözüm önerileri (nasıl satılır?)
 *   3. Tahmini etki (ne kadar kazanırsın?)
 *   4. Platform bazlı analiz
 *   5. Kullanıcı hata tespiti
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const logger = require("../config/logger");

const dayMs = 24 * 60 * 60 * 1000;
function round2(v) { return Math.round(v * 100) / 100; }
function fmtCurrency(v) { return `${Math.round(v).toLocaleString("tr-TR")}₺`; }

// ═════════════════════════════════════════════════════════════════════════════
// ÜRÜN DANIŞMANI — Tek ürün detaylı analiz
// ═════════════════════════════════════════════════════════════════════════════

function analyzeProduct(product, allProducts, observation) {
    const diagnosis = {
        barcode: product.barcode,
        name: product.name,
        category: product.category || "Kategorisiz",
        price: product.price,
        costPrice: product.costPrice,
        stock: product.stock,
        healthScore: product.healthScore || 0,
        profitMargin: product.profitMargin || 0,
        totalSold: product.totalSold || 0,
        avgDailySales: product.avgDailySales || 0,
        daysSinceLastSale: product.daysSinceLastSale || 999,
        daysOfStock: product.daysOfStock || 0,

        // Durum sınıflandırması
        status: "unknown",
        statusLabel: "",
        statusColor: "",
        statusEmoji: "",

        // Kök nedenler
        rootCauses: [],

        // Çözüm önerileri
        solutions: [],

        // Kullanıcı hataları
        mistakes: [],

        // Tahmini etki
        projectedImpact: {
            salesIncrease: 0,
            revenueIncrease: 0,
            profitIncrease: 0,
        },

        // Özet
        summary: "",
        aiVerdict: "",
    };

    // ── Durum sınıflandırması ──
    if (product.healthScore >= 75 && product.totalSold > 0) {
        diagnosis.status = "star";
        diagnosis.statusLabel = "Yıldız Ürün";
        diagnosis.statusColor = "#34d399";
        diagnosis.statusEmoji = "⭐";
    } else if (product.healthScore >= 50) {
        diagnosis.status = "healthy";
        diagnosis.statusLabel = "Sağlıklı";
        diagnosis.statusColor = "#60a5fa";
        diagnosis.statusEmoji = "✅";
    } else if (product.healthScore >= 30) {
        diagnosis.status = "warning";
        diagnosis.statusLabel = "Dikkat Gerekli";
        diagnosis.statusColor = "#fbbf24";
        diagnosis.statusEmoji = "⚠️";
    } else {
        diagnosis.status = "critical";
        diagnosis.statusLabel = "Kritik";
        diagnosis.statusColor = "#f87171";
        diagnosis.statusEmoji = "🚨";
    }

    // ── Kategori ortalamaları ──
    const categoryProducts = allProducts.filter(p => p.category === product.category && p.totalSold > 0);
    const categoryAvgPrice = categoryProducts.length > 0
        ? categoryProducts.reduce((s, p) => s + p.price, 0) / categoryProducts.length : product.price;
    const categoryAvgSales = categoryProducts.length > 0
        ? categoryProducts.reduce((s, p) => s + p.avgDailySales, 0) / categoryProducts.length : 0;
    const categoryAvgMargin = categoryProducts.filter(p => p.costPrice > 0).length > 0
        ? categoryProducts.filter(p => p.costPrice > 0).reduce((s, p) => s + p.profitMargin, 0) / categoryProducts.filter(p => p.costPrice > 0).length : 0;

    // ── Genel ortalamalar ──
    const allAvgPrice = allProducts.length > 0
        ? allProducts.reduce((s, p) => s + p.price, 0) / allProducts.length : 0;
    const allAvgDailySales = allProducts.filter(p => p.totalSold > 0).length > 0
        ? allProducts.filter(p => p.totalSold > 0).reduce((s, p) => s + p.avgDailySales, 0) / allProducts.filter(p => p.totalSold > 0).length : 0;

    // ═══════════════════════════════════════════════════════════════════════
    // KÖK NEDEN ANALİZİ
    // ═══════════════════════════════════════════════════════════════════════

    // 1. Fiyat analizi
    if (categoryAvgPrice > 0 && product.price > categoryAvgPrice * 1.3) {
        const priceDiff = round2(((product.price - categoryAvgPrice) / categoryAvgPrice) * 100);
        diagnosis.rootCauses.push({
            type: "overpriced",
            severity: "high",
            icon: "💰",
            title: "Fiyat kategorisinden yüksek",
            detail: `Bu ürün kategorisindeki ortalama fiyat ${fmtCurrency(categoryAvgPrice)}, sizin fiyatınız ${fmtCurrency(product.price)} (%${priceDiff} pahalı)`,
            impact: "Müşteriler daha ucuz alternatifleri tercih ediyor olabilir",
        });

        const suggestedPrice = Math.round(categoryAvgPrice * 1.05);
        const estimatedSalesIncrease = Math.max(1, Math.round(categoryAvgSales * 0.7 * 30));
        diagnosis.solutions.push({
            type: "price_reduce",
            icon: "🏷️",
            title: `Fiyatı ${fmtCurrency(suggestedPrice)}'ye düşürün`,
            detail: `Kategori ortalamasının %5 üstü — rekabetçi fiyat`,
            projectedSalesIncrease: estimatedSalesIncrease,
            projectedRevenue: estimatedSalesIncrease * suggestedPrice,
            confidence: 75,
            actionable: true,
            actionPayload: { type: "update_price", newPrice: suggestedPrice, barcode: product.barcode },
            priority: 1,
        });
        diagnosis.projectedImpact.salesIncrease += estimatedSalesIncrease;
        diagnosis.projectedImpact.revenueIncrease += estimatedSalesIncrease * suggestedPrice;
    } else if (categoryAvgPrice > 0 && product.price < categoryAvgPrice * 0.6 && product.costPrice > 0) {
        diagnosis.rootCauses.push({
            type: "underpriced",
            severity: "medium",
            icon: "📉",
            title: "Fiyat çok düşük",
            detail: `Kategori ortalaması ${fmtCurrency(categoryAvgPrice)}, sizin fiyatınız ${fmtCurrency(product.price)} — kâr marjınız düşük olabilir`,
            impact: "Satış yapıyorsunuz ama yeterli kâr elde edemiyorsunuz",
        });

        const suggestedPrice = Math.round(categoryAvgPrice * 0.85);
        if (suggestedPrice > product.price) {
            diagnosis.solutions.push({
                type: "price_increase",
                icon: "📈",
                title: `Fiyatı ${fmtCurrency(suggestedPrice)}'ye çıkarın`,
                detail: `Kategori ortalamasının %15 altı — hâlâ rekabetçi ama daha kârlı`,
                projectedRevenue: product.avgDailySales * 30 * (suggestedPrice - product.price),
                confidence: 70,
                actionable: true,
                actionPayload: { type: "update_price", newPrice: suggestedPrice, barcode: product.barcode },
                priority: 2,
            });
        }
    }

    // 2. Satış trendi analizi
    if (product.totalSold === 0 && product.stock > 0) {
        const daysSinceCreated = product.daysSinceLastSale || 90;
        diagnosis.rootCauses.push({
            type: "no_sales",
            severity: "critical",
            icon: "📊",
            title: "Hiç satış yok",
            detail: `Bu ürün ${daysSinceCreated > 90 ? "90+ gündür" : `${daysSinceCreated} gündür`} hiç satılmamış. ${product.stock} adet stokta bekliyor.`,
            impact: `${fmtCurrency(product.price * product.stock)} değerinde stok bağlı sermaye`,
        });

        diagnosis.solutions.push({
            type: "campaign",
            icon: "🎯",
            title: "Tanıtım kampanyası başlatın",
            detail: "Ürünü öne çıkarmak için %10-15 indirimli kampanya veya reklam deneyin",
            confidence: 60,
            actionable: false,
            priority: 1,
        });

        if (product.price > categoryAvgPrice * 1.1) {
            diagnosis.solutions.push({
                type: "price_competitive",
                icon: "💰",
                title: "Fiyatı rekabetçi seviyeye çekin",
                detail: `Kategori ortalaması ${fmtCurrency(categoryAvgPrice)} — fiyatınızı buna yaklaştırın`,
                confidence: 70,
                actionable: true,
                actionPayload: { type: "update_price", newPrice: Math.round(categoryAvgPrice * 0.95), barcode: product.barcode },
                priority: 1,
            });
        }
    } else if (product.avgDailySales < categoryAvgSales * 0.3 && categoryAvgSales > 0 && product.totalSold > 0) {
        diagnosis.rootCauses.push({
            type: "low_sales",
            severity: "high",
            icon: "📉",
            title: "Satışlar kategori ortalamasının çok altında",
            detail: `Günlük ortalama: ${round2(product.avgDailySales)} adet vs Kategori ort: ${round2(categoryAvgSales)} adet`,
            impact: "Potansiyel gelir kaybı yaşanıyor",
        });
    } else if (product.daysSinceLastSale > 14 && product.totalSold > 0) {
        diagnosis.rootCauses.push({
            type: "stale_sales",
            severity: "medium",
            icon: "⏰",
            title: `${product.daysSinceLastSale} gündür satış yok`,
            detail: "Daha önce satılıyordu ama son dönemde durdu",
            impact: "Talep düşüşü veya rekabet artışı olabilir",
        });

        diagnosis.solutions.push({
            type: "reactivate",
            icon: "🔄",
            title: "Ürünü yeniden aktifleştirin",
            detail: "Fiyat indirimi + kampanya ile talebi canlandırın. Ürün listesini güncelleyin.",
            confidence: 55,
            actionable: false,
            priority: 2,
        });
    }

    // 3. Stok analizi
    if (product.stock === 0 && product.avgDailySales > 0) {
        const dailyLoss = product.avgDailySales * product.price;
        diagnosis.rootCauses.push({
            type: "out_of_stock",
            severity: "critical",
            icon: "📦",
            title: "Stok tükendi — satış kaçırılıyor!",
            detail: `Günlük ${round2(product.avgDailySales)} adet satılıyordu. Her gün ${fmtCurrency(dailyLoss)} ciro kaybediyorsunuz.`,
            impact: `Aylık tahmini kayıp: ${fmtCurrency(dailyLoss * 30)}`,
        });

        diagnosis.solutions.push({
            type: "restock_urgent",
            icon: "🚚",
            title: "ACİL stok tedarik edin",
            detail: `En az ${Math.ceil(product.avgDailySales * 30)} adet sipariş verin (1 aylık stok)`,
            confidence: 95,
            actionable: false,
            priority: 0,
        });
    } else if (product.daysOfStock < 7 && product.avgDailySales > 0.3 && product.stock > 0) {
        diagnosis.rootCauses.push({
            type: "low_stock",
            severity: "high",
            icon: "⚠️",
            title: `Stok ${product.daysOfStock} gün içinde tükenecek`,
            detail: `Mevcut: ${product.stock} adet, Günlük satış: ${round2(product.avgDailySales)} adet`,
            impact: "Stok tükenirse satış kaybı başlayacak",
        });

        diagnosis.solutions.push({
            type: "restock",
            icon: "📦",
            title: "Stok siparişi verin",
            detail: `Önerilen miktar: ${Math.ceil(product.avgDailySales * 45)} adet (45 günlük stok)`,
            confidence: 85,
            actionable: false,
            priority: 1,
        });
    } else if (product.stock > 0 && product.avgDailySales > 0 && product.daysOfStock > 180) {
        diagnosis.rootCauses.push({
            type: "overstock",
            severity: "medium",
            icon: "🏭",
            title: "Aşırı stok — sermaye bağlı",
            detail: `${product.daysOfStock} günlük stok var (${product.stock} adet). Bu çok fazla.`,
            impact: `${fmtCurrency(product.price * product.stock)} sermaye bağlı`,
        });

        diagnosis.solutions.push({
            type: "stock_clearance",
            icon: "🏷️",
            title: "Stok eritme kampanyası başlatın",
            detail: "%15-20 indirimle stoku eritin, sermayeyi serbest bırakın",
            confidence: 65,
            actionable: false,
            priority: 3,
        });
    }

    // 4. Kârlılık analizi
    if (product.costPrice > 0 && product.profitMargin < 0) {
        const lossPerUnit = Math.abs(product.profit || 0);
        diagnosis.rootCauses.push({
            type: "negative_margin",
            severity: "critical",
            icon: "🔴",
            title: "ZARARDA satılıyor!",
            detail: `Her satışta ${fmtCurrency(lossPerUnit)} zarar ediyorsunuz. Maliyet: ${fmtCurrency(product.costPrice)}, Satış: ${fmtCurrency(product.price)}`,
            impact: product.totalSold > 0 ? `Toplam zarar: ${fmtCurrency(lossPerUnit * product.totalSold)}` : "Her satışta para kaybediyorsunuz",
        });

        const minPrice = Math.round(product.costPrice * 1.15); // %15 minimum marj
        diagnosis.solutions.push({
            type: "fix_price",
            icon: "💰",
            title: `Fiyatı en az ${fmtCurrency(minPrice)}'ye çıkarın`,
            detail: `Minimum %15 kâr marjı için ${fmtCurrency(minPrice)} olmalı`,
            confidence: 90,
            actionable: true,
            actionPayload: { type: "update_price", newPrice: minPrice, barcode: product.barcode },
            priority: 0,
        });
    } else if (product.costPrice > 0 && product.profitMargin < 10 && product.profitMargin >= 0) {
        diagnosis.rootCauses.push({
            type: "low_margin",
            severity: "medium",
            icon: "📊",
            title: `Kâr marjı düşük (%${round2(product.profitMargin)})`,
            detail: "Komisyon, kargo ve diğer giderler düşünüldüğünde kâr çok az",
            impact: "Hacim artsa bile yeterli kâr elde edemezsiniz",
        });
    }

    // 5. Maliyet bilgisi eksikliği
    if (product.costPrice === 0 || !product.costPrice) {
        diagnosis.mistakes.push({
            type: "no_cost",
            severity: "high",
            icon: "❌",
            title: "Maliyet bilgisi girilmemiş",
            detail: "AI kâr analizi yapamıyor. Maliyet bilgisini girin.",
            fix: "LysiaBrain → Ürün Maliyetleri sekmesinden maliyet girin",
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AI VERDİCT — Özet yorum
    // ═══════════════════════════════════════════════════════════════════════

    if (diagnosis.rootCauses.length === 0 && diagnosis.status === "star") {
        diagnosis.aiVerdict = `⭐ Bu ürün harika performans gösteriyor! Günlük ${round2(product.avgDailySales)} adet satış, %${round2(product.profitMargin)} kâr marjı. Stok durumunu takip etmeye devam edin.`;
        diagnosis.summary = "Yıldız ürün — performansı koruyun";
    } else if (diagnosis.rootCauses.length === 0) {
        diagnosis.aiVerdict = "✅ Bu ürün genel olarak iyi durumda. Büyük bir sorun tespit edilmedi.";
        diagnosis.summary = "Sağlıklı — izlemeye devam";
    } else {
        const criticalCount = diagnosis.rootCauses.filter(r => r.severity === "critical").length;
        const highCount = diagnosis.rootCauses.filter(r => r.severity === "high").length;

        if (criticalCount > 0) {
            diagnosis.aiVerdict = `🚨 ${criticalCount} kritik sorun tespit edildi! ${diagnosis.solutions.length} çözüm önerisi hazır. Hemen aksiyon alın.`;
            diagnosis.summary = `${criticalCount} kritik sorun — acil müdahale gerekli`;
        } else if (highCount > 0) {
            diagnosis.aiVerdict = `⚠️ ${highCount} önemli sorun var. Çözüm önerilerini uygulayarak bu ürünün performansını artırabilirsiniz.`;
            diagnosis.summary = `${highCount} sorun — iyileştirme fırsatı`;
        } else {
            diagnosis.aiVerdict = `💡 Küçük iyileştirmelerle bu ürünün performansı artırılabilir. ${diagnosis.solutions.length} öneri hazır.`;
            diagnosis.summary = "İyileştirme fırsatları mevcut";
        }
    }

    // Çözümleri önceliğe göre sırala
    diagnosis.solutions.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    return diagnosis;
}

// ═════════════════════════════════════════════════════════════════════════════
// TÜM ÜRÜNLER İÇİN DANIŞMAN ANALİZİ
// ═════════════════════════════════════════════════════════════════════════════

function analyzeAllProducts(analyzedProducts, observation) {
    const results = analyzedProducts.map(p => analyzeProduct(p, analyzedProducts, observation));

    // Önce kritik, sonra uyarı, sonra sağlıklı
    results.sort((a, b) => {
        const statusOrder = { critical: 0, warning: 1, healthy: 2, star: 3 };
        return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    });

    // Özet istatistikler
    const summary = {
        total: results.length,
        critical: results.filter(r => r.status === "critical").length,
        warning: results.filter(r => r.status === "warning").length,
        healthy: results.filter(r => r.status === "healthy").length,
        star: results.filter(r => r.status === "star").length,
        totalRootCauses: results.reduce((s, r) => s + r.rootCauses.length, 0),
        totalSolutions: results.reduce((s, r) => s + r.solutions.length, 0),
        totalMistakes: results.reduce((s, r) => s + r.mistakes.length, 0),
        actionableCount: results.reduce((s, r) => s + r.solutions.filter(sol => sol.actionable).length, 0),
    };

    return { products: results, summary };
}

// ═════════════════════════════════════════════════════════════════════════════
// KULLANICI HATA TESPİTİ
// ═════════════════════════════════════════════════════════════════════════════

function detectMistakes(analyzedProducts, observation) {
    const mistakes = {
        critical: [],
        warnings: [],
        improvements: [],
        positives: [],
    };

    const metrics = observation.metrics || {};

    // ── KRİTİK HATALAR ──

    // Zararda satılan ürünler
    const lossProducts = analyzedProducts.filter(p => p.profit < 0 && p.costPrice > 0 && p.totalSold > 0);
    if (lossProducts.length > 0) {
        const totalLoss = lossProducts.reduce((s, p) => s + Math.abs(p.profit) * p.totalSold, 0);
        mistakes.critical.push({
            type: "loss_products",
            icon: "🔴",
            title: `${lossProducts.length} ürün ZARARDA satılıyor`,
            detail: `Toplam kayıp: ${fmtCurrency(totalLoss)}/ay. En büyük zarar: "${lossProducts[0]?.name?.slice(0, 30)}" (${fmtCurrency(Math.abs(lossProducts[0]?.profit || 0))}/adet)`,
            fix: "Fiyatları maliyet + %15 minimum marj olacak şekilde güncelleyin",
            count: lossProducts.length,
            impact: totalLoss,
            actionable: true,
        });
    }

    // Stokta olmayan ama talep olan ürünler
    const outOfStockWithDemand = analyzedProducts.filter(p => (p.stock === 0 || p.isOutOfStock) && p.avgDailySales > 0.3);
    if (outOfStockWithDemand.length > 0) {
        const dailyLoss = outOfStockWithDemand.reduce((s, p) => s + p.avgDailySales * p.price, 0);
        mistakes.critical.push({
            type: "out_of_stock_demand",
            icon: "📦",
            title: `${outOfStockWithDemand.length} popüler ürün stokta yok`,
            detail: `Her gün ${fmtCurrency(dailyLoss)} ciro kaçırıyorsunuz. Aylık kayıp: ${fmtCurrency(dailyLoss * 30)}`,
            fix: "Bu ürünleri acil tedarik edin",
            count: outOfStockWithDemand.length,
            impact: dailyLoss * 30,
        });
    }

    // ── UYARILAR ──

    // Maliyet girilmemiş ürünler
    const noCost = analyzedProducts.filter(p => !p.costPrice || p.costPrice === 0);
    if (noCost.length > 0) {
        const pct = round2((noCost.length / analyzedProducts.length) * 100);
        mistakes.warnings.push({
            type: "no_cost_data",
            icon: "❌",
            title: `${noCost.length} üründe maliyet bilgisi yok (%${pct})`,
            detail: "AI kâr analizi yapamıyor. Maliyet bilgilerini girin.",
            fix: "LysiaBrain → Ürün Maliyetleri sekmesinden maliyetleri girin",
            count: noCost.length,
        });
    }

    // Ölü stok (satılmayan ama stokta olan)
    const deadStock = analyzedProducts.filter(p => p.stock > 0 && p.daysSinceLastSale > 60 && p.totalSold === 0);
    if (deadStock.length > 0) {
        const tiedCapital = deadStock.reduce((s, p) => s + p.price * p.stock, 0);
        mistakes.warnings.push({
            type: "dead_stock",
            icon: "💀",
            title: `${deadStock.length} ürün 60+ gündür hiç satılmamış`,
            detail: `${fmtCurrency(tiedCapital)} sermaye bağlı. Bu ürünleri kampanyayla eritin veya fiyat düşürün.`,
            fix: "Stok eritme kampanyası veya fiyat indirimi uygulayın",
            count: deadStock.length,
            impact: tiedCapital,
        });
    }

    // Aşırı stok
    const overstock = analyzedProducts.filter(p => p.daysOfStock > 180 && p.stock > 0 && p.avgDailySales > 0);
    if (overstock.length > 0) {
        mistakes.warnings.push({
            type: "overstock",
            icon: "🏭",
            title: `${overstock.length} üründe 6 aydan fazla stok var`,
            detail: "Aşırı stok sermayenizi bağlıyor. Tedarik miktarlarını azaltın.",
            fix: "Sipariş miktarlarını günlük satışa göre optimize edin",
            count: overstock.length,
        });
    }

    // ── İYİLEŞTİRME FIRSATLARI ──

    // Fiyat optimizasyonu fırsatları
    const underpriced = analyzedProducts.filter(p => {
        const catProducts = analyzedProducts.filter(cp => cp.category === p.category && cp.totalSold > 0);
        const catAvg = catProducts.length > 0 ? catProducts.reduce((s, cp) => s + cp.price, 0) / catProducts.length : 0;
        return catAvg > 0 && p.price < catAvg * 0.7 && p.totalSold > 5;
    });
    if (underpriced.length > 0) {
        mistakes.improvements.push({
            type: "underpriced_products",
            icon: "💡",
            title: `${underpriced.length} ürün kategorisinden çok ucuz`,
            detail: "Fiyat artırarak kâr marjınızı yükseltebilirsiniz",
            fix: "Fiyatları kategori ortalamasına yaklaştırın",
            count: underpriced.length,
        });
    }

    // ── İYİ YAPILANLAR ──

    if (metrics.outOfStock === 0) {
        mistakes.positives.push({
            type: "good_stock",
            icon: "✅",
            title: "Stok yönetimi iyi",
            detail: "Tükenen ürün yok — müşterileriniz ürün bulabiliyor",
        });
    }

    if (lossProducts.length === 0 && analyzedProducts.filter(p => p.costPrice > 0).length > 0) {
        mistakes.positives.push({
            type: "no_loss",
            icon: "✅",
            title: "Zararda ürün yok",
            detail: "Tüm ürünleriniz kârlı satılıyor",
        });
    }

    const highMarginProducts = analyzedProducts.filter(p => p.profitMargin > 25 && p.costPrice > 0);
    if (highMarginProducts.length > 5) {
        mistakes.positives.push({
            type: "good_margins",
            icon: "✅",
            title: `${highMarginProducts.length} ürün %25+ kâr marjında`,
            detail: "Fiyatlandırma stratejiniz genel olarak iyi",
        });
    }

    // Özet
    mistakes.summary = {
        criticalCount: mistakes.critical.length,
        warningCount: mistakes.warnings.length,
        improvementCount: mistakes.improvements.length,
        positiveCount: mistakes.positives.length,
        totalImpact: [...mistakes.critical, ...mistakes.warnings].reduce((s, m) => s + (m.impact || 0), 0),
        overallGrade: mistakes.critical.length === 0 && mistakes.warnings.length <= 2 ? "A"
            : mistakes.critical.length === 0 ? "B"
            : mistakes.critical.length <= 2 ? "C" : "D",
    };

    return mistakes;
}

// ═════════════════════════════════════════════════════════════════════════════
// PLATFORM ANALİZİ
// ═════════════════════════════════════════════════════════════════════════════

function analyzePlatforms(analyzedProducts, observation) {
    const { orders30 = [], marketplaces = [] } = observation;

    // Platform bazlı sipariş dağılımı
    const platformStats = {};
    for (const order of orders30) {
        const mp = order.marketplaceName || "Diğer";
        if (!platformStats[mp]) {
            platformStats[mp] = { name: mp, orderCount: 0, revenue: 0, products: new Set(), avgOrderValue: 0 };
        }
        platformStats[mp].orderCount++;
        platformStats[mp].revenue += order.totalPrice || 0;
        if (order.barcode) platformStats[mp].products.add(order.barcode);
    }

    // Platform skorları hesapla
    const platforms = Object.values(platformStats).map(p => {
        p.productCount = p.products.size;
        p.avgOrderValue = p.orderCount > 0 ? round2(p.revenue / p.orderCount) : 0;
        delete p.products;

        // Basit skor
        let score = 50;
        if (p.orderCount > 30) score += 20;
        else if (p.orderCount > 10) score += 10;
        if (p.revenue > 10000) score += 15;
        else if (p.revenue > 3000) score += 8;
        if (p.productCount > 20) score += 15;
        else if (p.productCount > 5) score += 8;
        p.score = Math.min(100, score);

        return p;
    });

    platforms.sort((a, b) => b.revenue - a.revenue);

    // Sorunlar ve fırsatlar
    const issues = [];
    const opportunities = [];

    // En iyi platformdaki ürünler diğerlerinde var mı?
    if (platforms.length >= 2) {
        const bestPlatform = platforms[0];
        const otherPlatforms = platforms.slice(1);

        for (const other of otherPlatforms) {
            if (other.revenue < bestPlatform.revenue * 0.3 && bestPlatform.revenue > 0) {
                issues.push({
                    icon: "📊",
                    title: `${other.name} performansı düşük`,
                    detail: `${bestPlatform.name}'dan %${round2(((bestPlatform.revenue - other.revenue) / bestPlatform.revenue) * 100)} daha az ciro`,
                    suggestion: `${other.name}'daki ürün sayısını ve fiyatları kontrol edin`,
                });
            }
        }
    }

    // Tek platforma bağımlılık
    if (platforms.length === 1 && platforms[0].revenue > 5000) {
        issues.push({
            icon: "⚠️",
            title: "Tek platforma bağımlısınız",
            detail: `Tüm cironuz ${platforms[0].name}'dan geliyor. Risk çeşitlendirmesi yapın.`,
            suggestion: "Başka pazaryerlerine de ürünlerinizi ekleyin",
        });
    }

    return {
        platforms,
        issues,
        opportunities,
        totalRevenue: platforms.reduce((s, p) => s + p.revenue, 0),
        totalOrders: platforms.reduce((s, p) => s + p.orderCount, 0),
        platformCount: platforms.length,
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
    analyzeProduct,
    analyzeAllProducts,
    detectMistakes,
    analyzePlatforms,
};
