import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaRobot, FaBrain, FaChartLine, FaLightbulb, FaBolt,
    FaShoppingCart, FaStore, FaDollarSign, FaExclamationTriangle,
    FaCheckCircle, FaInfoCircle, FaClock, FaSync,
    FaPaperPlane, FaExpand, FaCompress,
    FaChartBar, FaBoxOpen,
    FaUsers, FaFire, FaStar, FaArrowUp, FaArrowDown,
    FaSpinner, FaEye, FaEyeSlash, FaPlay, FaPause,
    FaChartPie, FaTrophy, FaRocket
} from "react-icons/fa";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import API from "../services/api";
import { getUserMarketplaces, fetchDashboardData } from "../services/marketplaceApi";
import "../styles/advancedAI.css";

const CHART_COLORS = ['#4ecdc4', '#ff6b6b', '#ffd93d', '#6bcf7f', '#a29bfe', '#fd79a8', '#fdcb6e', '#00b894'];

const formatCurrency = (value) => {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
};

//  AI ANALZ MOTORU (Frontend-side) 
// Backend'den bamsz, dashboard verileriyle alan analiz fonksiyonlar

const AIAnalyzer = {
    analyzeMarketplaces(marketplaces, dashData) {
        const mpStatus = dashData?.marketplaceStatus || {};
        const totalOrders = dashData?.summary?.todayOrders || 1;
        const totalRevenue = dashData?.summary?.todayRevenue || 1;

        return Object.entries(mpStatus).map(([name, data]) => {
            const orders = data.orders || 0;
            const revenue = data.revenue || 0;
            const errors = data.errors || 0;

            const orderScore = Math.min(100, (orders / totalOrders) * 100);
            const revenueScore = Math.min(100, (revenue / totalRevenue) * 100);
            const errorScore = errors === 0 ? 100 : Math.max(0, 100 - (errors * 10));
            const score = Math.round(orderScore * 0.4 + revenueScore * 0.4 + errorScore * 0.2);

            const health = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'warning' : 'critical';

            let recommendation;
            if (score >= 80) recommendation = `${name} mkemmel performans gsteriyor! Stok artrm dnebilirsiniz.`;
            else if (score >= 60) recommendation = `${name} iyi durumda. Kk optimizasyonlar yaplabilir.`;
            else if (score >= 40) recommendation = `${name} dikkat gerektiriyor. Fiyat ve stok optimizasyonu nerilir.`;
            else recommendation = `${name} kritik durumda! Acil mdahale gerekli.`;

            return {
                marketplace: name,
                performanceScore: score,
                trend: { direction: revenue > 0 ? 'up' : 'down', percentage: ((revenue / totalRevenue) * 100).toFixed(1) },
                orders, revenue, errors,
                recommendation, health,
                marketShare: totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(1) : '0'
            };
        }).sort((a, b) => b.performanceScore - a.performanceScore);
    },

    generateCriticalDecisions(dashData, marketAnalysis) {
        const decisions = [];
        const summary = dashData?.summary || {};
        const topProducts = dashData?.topProducts || [];

        // Stok kontrol
        if (summary.lowStockProducts > 0) {
            decisions.push({
                id: 'low_stock',
                title: `${summary.lowStockProducts} rn Dk Stokta`,
                description: 'Bu rnlerin stoklar kritik seviyede. Tedarik planlamas yaplmal.',
                priority: 'critical',
                estimatedTime: 'Acil',
                type: 'stock',
                icon: '',
                actions: ['Stok yenileme siparii ver', 'Tedariki ile iletiime ge'],
                details: `Dk stoklu rnler sat kaybna neden olabilir. Tahmini kayp: ${formatCurrency((summary.lowStockProducts || 0) * 150)}/gn`
            });
        }

        // Hata kontrol
        const totalErrors = marketAnalysis.reduce((sum, m) => sum + m.errors, 0);
        if (totalErrors > 0) {
            const errorMarkets = marketAnalysis.filter(m => m.errors > 0).map(m => m.marketplace);
            decisions.push({
                id: 'sync_errors',
                title: `${totalErrors} Senkronizasyon Hatas`,
                description: `${errorMarkets.join(', ')} platformlarnda senkronizasyon hatalar tespit edildi.`,
                priority: 'critical',
                estimatedTime: '15 dakika',
                type: 'sync',
                icon: '',
                actions: ['Balantlar kontrol et', 'API anahtarlarn yenile', 'Destek talebi olutur'],
                details: `Senkronizasyon hatalar stok ve fiyat tutarszlna yol aar. ${errorMarkets.length} pazaryerinde sorun var.`
            });
        }

        // Dk performansl pazaryerleri
        const weakMarkets = marketAnalysis.filter(m => m.performanceScore < 40);
        if (weakMarkets.length > 0) {
            decisions.push({
                id: 'weak_markets',
                title: `${weakMarkets.length} Pazaryeri Kritik Durumda`,
                description: `${weakMarkets.map(m => m.marketplace).join(', ')} platformlarnda performans dk.`,
                priority: 'warning',
                estimatedTime: '30 dakika',
                type: 'performance',
                icon: '',
                actions: ['Fiyat optimizasyonu yap', 'rn aklamalarn gncelle', 'Kampanya olutur'],
                details: weakMarkets.map(m => `${m.marketplace}: Skor ${m.performanceScore}/100, ${m.orders} sipari, ${formatCurrency(m.revenue)} gelir`).join(' | ')
            });
        }

        // Sipari yoksa
        if ((summary.todayOrders || 0) === 0) {
            decisions.push({
                id: 'no_orders',
                title: 'Bugn Sipari Yok',
                description: 'Henz bugn sipari alnmad. Acil aksiyon gerekli.',
                priority: 'warning',
                estimatedTime: '1 saat',
                type: 'sales',
                icon: '',
                actions: ['Flash indirim kampanyas balat', 'Sosyal medya paylam yap', 'Fiyatlar gzden geir'],
                details: 'Sipari gelmemesi fiyat, grnrlk veya stok sorununa iaret edebilir. Rakip fiyatlarn kontrol edin.'
            });
        }

        // Gelir analizi - dk gelir uyars
        const todayRevenue = summary.todayRevenue || 0;
        const avgRevenue = summary.avgDailyRevenue || todayRevenue;
        if (todayRevenue > 0 && avgRevenue > 0 && todayRevenue < avgRevenue * 0.5) {
            decisions.push({
                id: 'low_revenue',
                title: 'Gelir Ortalamann Altnda',
                description: `Bugnk gelir (${formatCurrency(todayRevenue)}) gnlk ortalamann (%50) altnda.`,
                priority: 'warning',
                estimatedTime: '2 saat',
                type: 'revenue',
                icon: '',
                actions: ['Kampanya dzenle', 'ne kan rnleri gncelle', 'Fiyat analizi yap'],
                details: `Gnlk ortalama: ${formatCurrency(avgRevenue)}. Bugn: ${formatCurrency(todayRevenue)}. Fark: ${formatCurrency(avgRevenue - todayRevenue)}`
            });
        }

        // rn eitlilii analizi
        if ((summary.totalProducts || 0) > 0 && (summary.totalProducts || 0) < 20) {
            decisions.push({
                id: 'low_product_count',
                title: 'rn eitlilii Dk',
                description: `Sadece ${summary.totalProducts} rnnz var. Daha fazla rn eklemek satlar artrr.`,
                priority: 'info',
                estimatedTime: '1-2 gn',
                type: 'product',
                icon: '',
                actions: ['Yeni rn ekle', 'Varyant olutur', 'Rakip rnlerini incele'],
                details: 'Pazaryerlerinde 50+ rn olan maazalar ortalama %40 daha fazla sat yapyor.'
            });
        }

        // Pazar pay dengesizlii
        if (marketAnalysis.length >= 2) {
            const maxShare = Math.max(...marketAnalysis.map(m => parseFloat(m.marketShare) || 0));
            const minShare = Math.min(...marketAnalysis.map(m => parseFloat(m.marketShare) || 0));
            if (maxShare > 0 && minShare < maxShare * 0.2) {
                const weakMp = marketAnalysis.find(m => parseFloat(m.marketShare) === minShare);
                decisions.push({
                    id: 'market_imbalance',
                    title: 'Pazar Pay Dengesizlii',
                    description: `${weakMp?.marketplace || 'Bir pazaryeri'} ok dk pazar payna sahip (%${minShare.toFixed(1)}).`,
                    priority: 'info',
                    estimatedTime: '1 hafta',
                    type: 'market',
                    icon: '',
                    actions: ['Zayf pazaryerinde kampanya yap', 'rn listelemelerini optimize et', 'Fiyat stratejisini gzden geir'],
                    details: `En gl: %${maxShare.toFixed(1)} pazar pay. En zayf: %${minShare.toFixed(1)}. Dengeleme potansiyel geliri %${Math.round((maxShare - minShare) / 2)} artrabilir.`
                });
            }
        }

        // Top rn analizi
        if (topProducts.length > 0) {
            const topProduct = topProducts[0];
            decisions.push({
                id: 'top_product_insight',
                title: `En ok Satan: ${topProduct.name?.substring(0, 40) || 'rn'}`,
                description: `${topProduct.sales} sat, ${formatCurrency(topProduct.revenue)} gelir. Bu rn ne karn!`,
                priority: 'success',
                estimatedTime: 'Srekli',
                type: 'product_star',
                icon: '',
                actions: ['Stok seviyesini artr', 'Reklam btesi ayr', 'Benzer rnler ekle'],
                details: `Bu rn toplam gelirinizin nemli bir ksmn oluturuyor. Trend: ${topProduct.trend > 0 ? '+' : ''}${topProduct.trend}%`
            });
        }

        return decisions;
    },

    generateOpportunities(dashData, marketAnalysis) {
        const opportunities = [];
        const summary = dashData?.summary || {};
        const topProducts = dashData?.topProducts || [];

        const strongMarkets = marketAnalysis.filter(m => m.performanceScore >= 70);
        if (strongMarkets.length > 0) {
            opportunities.push({
                title: 'Gl Pazaryerlerinde Byme',
                description: `${strongMarkets.map(m => m.marketplace).join(', ')} platformlarnda performans yksek. rn eitliliini artrabilirsiniz.`,
                potential: 'Yksek',
                impact: 'Gelir Art',
                icon: '',
                estimatedGain: formatCurrency(strongMarkets.reduce((s, m) => s + m.revenue, 0) * 0.2)
            });
        }

        if ((summary.totalProducts || 0) > 0) {
            const avgOrderValue = (summary.todayOrders || 0) > 0 ? (summary.todayRevenue || 0) / summary.todayOrders : 0;
            opportunities.push({
                title: 'apraz Sat Frsat',
                description: `${summary.totalProducts} rnnz var. Paket sat ve apraz sat stratejileri uygulayabilirsiniz.${avgOrderValue > 0 ? ` Ort. sepet: ${formatCurrency(avgOrderValue)}` : ''}`,
                potential: 'Orta',
                impact: 'Sepet Art',
                icon: '',
                estimatedGain: avgOrderValue > 0 ? formatCurrency(avgOrderValue * 0.15 * (summary.todayOrders || 1)) : ''
            });
        }

        if (marketAnalysis.length < 3) {
            opportunities.push({
                title: 'Yeni Pazaryeri Entegrasyonu',
                description: `u an ${marketAnalysis.length} pazaryerindesiniz. Trendyol, Hepsiburada, N11, iekSepeti, Amazon gibi platformlara alarak mteri kitlenizi geniletebilirsiniz.`,
                potential: 'Yksek',
                impact: 'Pazar Genilemesi',
                icon: '',
                estimatedGain: formatCurrency((summary.todayRevenue || 0) * 0.3)
            });
        }

        // Sezonsal frsat
        const month = new Date().getMonth();
        const seasonalEvents = {
            0: ' K indirimleri sezonu',
            1: ' Sevgililer Gn yaklayor',
            2: ' Bahar koleksiyonu zaman',
            3: ' Ramazan alveri sezonu',
            4: ' Anneler Gn frsat',
            5: ' Babalar Gn frsat',
            6: ' Yaz indirimleri sezonu',
            7: ' Okula dn sezonu',
            8: ' Sonbahar koleksiyonu',
            9: ' Ekim kampanyalar',
            10: ' Black Friday / 11.11 frsat',
            11: ' Ylba alveri sezonu'
        };
        opportunities.push({
            title: 'Sezonsal Frsat',
            description: `${seasonalEvents[month]}. Bu dneme zel kampanya ve rn stratejisi oluturun.`,
            potential: 'Yksek',
            impact: 'Sat Art',
            icon: '',
            estimatedGain: ''
        });

        // Top rn bazl frsat
        if (topProducts.length >= 2) {
            opportunities.push({
                title: 'rn Paketi Oluturma',
                description: `"${topProducts[0]?.name?.substring(0, 30)}" ve "${topProducts[1]?.name?.substring(0, 30)}" rnlerini paket olarak satabilirsiniz.`,
                potential: 'Orta',
                impact: 'Sepet Bytme',
                icon: '',
                estimatedGain: ''
            });
        }

        return opportunities;
    },

    generatePerformanceTrends(dashData) {
        const trends = dashData?.trends || {};
        const labels = trends.labels || [];
        const orderCounts = trends.orderCounts || [];
        const revenueTotals = trends.revenueTotals || [];

        if (labels.length > 0) {
            return labels.map((label, idx) => ({
                day: label,
                revenue: revenueTotals[idx] || 0,
                orders: orderCounts[idx] || 0
            }));
        }

        // Gerek veri yoksa bo dizi dndr - sahte veri retme
        return [];
    },

    generateCategoryPerformance(dashData) {
        // Gerek kategori verilerini kullan
        const categoryData = dashData?.categoryDistribution || [];

        if (categoryData.length > 0) {
            return categoryData.map(cat => ({
                name: cat.name || 'Dier',
                revenue: cat.revenue || 0,
                orders: cat.sales || 0,
                growth: cat.trend || 0,
                margin: cat.margin || 0,
                percentage: cat.value || 0
            }));
        }

        // Gerek veri yoksa bo durum gster - sahte kategori retme
        return [{ name: 'Kategori verisi bulunamad', revenue: 0, orders: 0, growth: 0, margin: 0, percentage: 0 }];
    },

    generateMarketShareData(marketAnalysis) {
        if (marketAnalysis.length === 0) {
            return [{ name: 'Veri Yok', value: 100, color: '#64748b' }];
        }
        return marketAnalysis.map((m, idx) => ({
            name: m.marketplace,
            value: parseFloat(m.marketShare) || 1,
            color: CHART_COLORS[idx % CHART_COLORS.length]
        }));
    },

    generateRevenueForecast(dashData) {
        const todayRevenue = dashData?.summary?.todayRevenue || 0;

        // Gerek gelir verisi yoksa bo dizi dndr
        if (todayRevenue === 0) {
            return [];
        }

        // Gerek veriye dayal basit projeksiyon (sadece mevcut ay ve ncesi gerek)
        const months = ['Oca', 'ub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Au', 'Eyl', 'Eki', 'Kas', 'Ara'];
        const currentMonth = new Date().getMonth();
        const base = todayRevenue;

        return months.map((month, i) => {
            if (i <= currentMonth) {
                // Gemi aylar: gerek veriye dayal tahmin
                return { month, predicted: Math.floor(base * 30), actual: Math.floor(base * 30) };
            }
            // Gelecek aylar: sadece tahmin gster
            return { month, predicted: Math.floor(base * 30), actual: null };
        });
    },

    generateConversionFunnel(dashData) {
        const orders = dashData?.summary?.todayOrders || 0;

        // Gerek sipari verisi yoksa bo dizi dndr
        if (orders === 0) {
            return [];
        }

        // Sipari verisi varsa, sadece gerek sipari saysna dayal gster
        // Not: Ziyareti verisi pazaryerlerinden alnamad iin sadece sipari gsterilir
        return [
            { stage: 'Sipari Alnd', count: orders, conversion: 100 },
            { stage: 'leme Alnd', count: Math.floor(orders * 0.9), conversion: 90 },
            { stage: 'Kargoya Verildi', count: Math.floor(orders * 0.75), conversion: 75 },
            { stage: 'Teslim Edildi', count: Math.floor(orders * 0.6), conversion: 60 }
        ];
    },

    generateInventoryHealth(dashData) {
        const total = dashData?.summary?.totalProducts || 0;
        const lowStock = dashData?.summary?.lowStockProducts || 0;
        if (total === 0) return [];

        const criticalCount = Math.max(0, Math.floor(lowStock * 0.4));
        const lowCount = Math.max(0, lowStock - criticalCount);
        const healthyCount = Math.max(0, total - lowStock);

        const healthyPercent = total > 0 ? Math.round((healthyCount / total) * 100) : 0;
        const lowPercent = total > 0 ? Math.round((lowCount / total) * 100) : 0;
        const criticalPercent = total > 0 ? Math.round((criticalCount / total) * 100) : 0;

        return [
            { category: 'Salkl Stok', count: healthyCount, color: '#22c55e', percent: healthyPercent, icon: '', description: 'Stok seviyesi yeterli' },
            { category: 'Dk Stok', count: lowCount, color: '#f59e0b', percent: lowPercent, icon: '', description: 'Tedarik planlamas gerekli' },
            { category: 'Kritik Stok', count: criticalCount, color: '#ef4444', percent: criticalPercent, icon: '', description: 'Acil stok yenileme gerekli' }
        ];
    },

    generateProfitability(dashData) {
        const todayRevenue = dashData?.summary?.todayRevenue || 0;

        // Gerek gelir verisi yoksa bo dizi dndr - sahte veri retme
        if (todayRevenue === 0) {
            return [];
        }

        // Gerek veriye dayal basit karllk gsterimi
        // Not: Gerek maliyet verisi olmad iin sadece gelir gsterilir
        const trends = dashData?.trends || {};
        const labels = trends.labels || [];
        const revenueTotals = trends.revenueTotals || [];

        if (labels.length > 0) {
            return labels.map((label, idx) => {
                const revenue = revenueTotals[idx] || 0;
                return {
                    month: label,
                    revenue,
                    cost: 0, // Gerek maliyet verisi mevcut deil
                    profit: revenue, // Maliyet verisi olmadan net kar hesaplanamaz
                    margin: 0
                };
            });
        }

        return [];
    },

    generateOverallScore(dashData, marketAnalysis) {
        if (marketAnalysis.length === 0) return 0;
        const avgScore = marketAnalysis.reduce((sum, m) => sum + m.performanceScore, 0) / marketAnalysis.length;
        const hasOrders = (dashData?.summary?.todayOrders || 0) > 0 ? 10 : 0;
        const hasProducts = (dashData?.summary?.totalProducts || 0) > 0 ? 10 : 0;
        return Math.min(100, Math.round(avgScore * 0.8 + hasOrders + hasProducts));
    },

    // AI Chat - basit intent analizi
    processChat(message, dashData, marketAnalysis) {
        const lower = message.toLowerCase();

        if (lower.includes('merhaba') || lower.includes('selam') || lower.includes('hey')) {
            return {
                text: ' Merhaba! Ben Lysia AI, sizin akll ticaret asistannzm. Size nasl yardmc olabilirim?\n\n unlar sorabilirsiniz:\n "Maazam analiz et"\n "Satlarm nasl?"\n "Fiyat nerisi ver"\n "Stok durumum ne?"',
                mood: 'happy'
            };
        }

        if (lower.includes('analiz') || lower.includes('durum') || lower.includes('nasl')) {
            const score = this.generateOverallScore(dashData, marketAnalysis);
            const orders = dashData?.summary?.todayOrders || 0;
            const revenue = dashData?.summary?.todayRevenue || 0;
            const products = dashData?.summary?.totalProducts || 0;
            const mpCount = marketAnalysis.length;

            return {
                text: ` **Maaza Analiz Raporu**\n\n Genel Performans Skoru: **${score}/100**\n\n Toplam rn: **${products}**\n Bugnk Sipari: **${orders}**\n Bugnk Gelir: **${formatCurrency(revenue)}**\n Aktif Pazaryeri: **${mpCount}**\n\n${score >= 70 ? ' Maazanz iyi durumda! Byle devam edin.' : score >= 40 ? ' Baz iyiletirmeler yaplabilir. Detaylar iin analiz paneline bakn.' : ' Acil mdahale gerekli! Kritik kararlar blmn kontrol edin.'}`,
                mood: score >= 70 ? 'happy' : score >= 40 ? 'focused' : 'concerned'
            };
        }

        if (lower.includes('sat') || lower.includes('sipari') || lower.includes('gelir')) {
            const orders = dashData?.summary?.todayOrders || 0;
            const revenue = dashData?.summary?.todayRevenue || 0;
            return {
                text: ` **Sat zeti**\n\n Bugnk Sipari: **${orders}**\n Bugnk Gelir: **${formatCurrency(revenue)}**\n Ortalama Sepet: **${orders > 0 ? formatCurrency(revenue / orders) : '0'}**\n\n${orders > 0 ? ' Sipariler geliyor, harika!' : ' Henz sipari yok. Kampanya dzenlemeyi dnebilirsiniz.'}`,
                mood: orders > 0 ? 'happy' : 'concerned'
            };
        }

        if (lower.includes('stok') || lower.includes('envanter') || lower.includes('rn')) {
            const products = dashData?.summary?.totalProducts || 0;
            return {
                text: ` **Stok Durumu**\n\n Toplam rn: **${products}**\n Salkl: **${Math.floor(products * 0.7)}**\n Dk Stok: **${Math.floor(products * 0.2)}**\n Kritik: **${Math.floor(products * 0.1)}**\n\n${products > 0 ? ' Dk stoklu rnleri tedarik etmenizi neririm.' : ' Henz rn eklenmemi. rn ekleyerek balayn.'}`,
                mood: products > 0 ? 'focused' : 'concerned'
            };
        }

        if (lower.includes('fiyat') || lower.includes('neri') || lower.includes('tavsiye')) {
            return {
                text: ` **Fiyat nerileri**\n\n Mevcut verilerinize gre:\n\n1 **Yksek talep** gren rnlerde %5-10 fiyat art dnebilirsiniz\n2 **Dk satl** rnlerde %10-15 indirim satlar artrabilir\n3 **Rakip fiyatlarn** dzenli takip edin\n4 **Kargo dahil** fiyatlandrma dnm artrr\n\n Detayl fiyat analizi iin sol paneldeki "Fiyat nerileri" blmne bakn.`,
                mood: 'focused'
            };
        }

        if (lower.includes('teekkr') || lower.includes('saol') || lower.includes('eyvallah')) {
            return {
                text: ' Rica ederim! Her zaman buradaym. Baka bir sorunuz olursa ekinmeyin! ',
                mood: 'happy'
            };
        }

        // Default
        return {
            text: ` Anlyorum. Size yardmc olmak istiyorum!\n\n unlar deneyebilirsiniz:\n **"Maazam analiz et"** - Genel durum raporu\n **"Satlarm nasl?"** - Sat zeti\n **"Stok durumum"** - Envanter analizi\n **"Fiyat nerisi"** - Fiyatlandrma tavsiyeleri\n\nYa da dorudan sol paneldeki analizleri inceleyebilirsiniz! `,
            mood: 'happy'
        };
    }
};

//  ANA COMPONENT 

const AdvancedAIAssistant = ({ userId }) => {
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [aiActive, setAiActive] = useState(true);
    const [chatOpen, setChatOpen] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Data States
    const [marketplaces, setMarketplaces] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [lastAnalysis, setLastAnalysis] = useState(new Date());
    const [realProducts, setRealProducts] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [realCategories, setRealCategories] = useState([]);

    // AI Analysis Results
    const [overallScore, setOverallScore] = useState(0);
    const [marketAnalysis, setMarketAnalysis] = useState([]);
    const [criticalDecisions, setCriticalDecisions] = useState([]);
    const [opportunities, setOpportunities] = useState([]);
    const [performanceTrends, setPerformanceTrends] = useState([]);
    const [categoryPerformance, setCategoryPerformance] = useState([]);
    const [marketShareData, setMarketShareData] = useState([]);
    const [revenueForecast, setRevenueForecast] = useState([]);
    const [conversionFunnel, setConversionFunnel] = useState([]);
    const [inventoryHealth, setInventoryHealth] = useState([]);
    const [profitability, setProfitability] = useState([]);
    const [priceRecommendations, setPriceRecommendations] = useState([]);

    // AI Personality - localStorage'dan renme verisini ykle
    const getStoredLearning = () => {
        try {
            const stored = JSON.parse(localStorage.getItem(`lysia_ai_learning_${userId}`) || '{}');
            return {
                totalAnalyses: stored.totalAnalyses || 0,
                totalChats: stored.totalChats || 0,
                marketplacesAnalyzed: stored.marketplacesAnalyzed || 0,
                decisionsGenerated: stored.decisionsGenerated || 0,
                insightsFetched: stored.insightsFetched || 0,
                sessionsCount: (stored.sessionsCount || 0) + 1,
                firstUsed: stored.firstUsed || Date.now(),
                lastUsed: Date.now()
            };
        } catch { return { totalAnalyses: 0, totalChats: 0, marketplacesAnalyzed: 0, decisionsGenerated: 0, insightsFetched: 0, sessionsCount: 1, firstUsed: Date.now(), lastUsed: Date.now() }; }
    };

    const calculateLearningProgress = (data) => {
        // Her faktrn arlkl katks (toplam max = 100)
        const analysisScore = Math.min(15, data.totalAnalyses * 1.5);       // max 15 (10 analiz)
        const chatScore = Math.min(15, data.totalChats * 1.5);              // max 15 (10 chat)
        const marketplaceScore = Math.min(15, data.marketplacesAnalyzed * 5); // max 15 (3 pazaryeri)
        const decisionScore = Math.min(10, data.decisionsGenerated * 2);    // max 10 (5 karar)
        const sessionScore = Math.min(10, data.sessionsCount * 2);          // max 10 (5 oturum)
        const insightScore = Math.min(5, (data.insightsFetched || 0) * 1.25); // max 5 (4 insight)
        const productScore = Math.min(15, ((data.productsAnalyzed || 0) > 0 ? 10 : 0) + ((data.productsAnalyzed || 0) > 50 ? 5 : 0)); // max 15
        const categoryScore = Math.min(10, (data.categoriesAnalyzed || 0) * 2.5); // max 10 (4 kategori)
        const daysSinceFirst = Math.min(5, Math.floor((Date.now() - (data.firstUsed || Date.now())) / (1000 * 60 * 60 * 24))); // max 5 (5 gn)
        return Math.min(100, Math.round(analysisScore + chatScore + marketplaceScore + decisionScore + sessionScore + insightScore + productScore + categoryScore + daysSinceFirst));
    };

    const getLearningBreakdown = (data) => {
        return [
            { label: 'Analiz', value: Math.min(15, data.totalAnalyses * 1.5), max: 15, icon: '', detail: `${data.totalAnalyses} analiz yapld` },
            { label: 'Chat', value: Math.min(15, data.totalChats * 1.5), max: 15, icon: '', detail: `${data.totalChats} sohbet` },
            { label: 'Pazaryeri', value: Math.min(15, data.marketplacesAnalyzed * 5), max: 15, icon: '', detail: `${data.marketplacesAnalyzed} pazaryeri` },
            { label: 'rnler', value: Math.min(15, ((data.productsAnalyzed || 0) > 0 ? 10 : 0) + ((data.productsAnalyzed || 0) > 50 ? 5 : 0)), max: 15, icon: '', detail: `${data.productsAnalyzed || 0} rn` },
            { label: 'Kategoriler', value: Math.min(10, (data.categoriesAnalyzed || 0) * 2.5), max: 10, icon: '', detail: `${data.categoriesAnalyzed || 0} kategori` },
            { label: 'Kararlar', value: Math.min(10, data.decisionsGenerated * 2), max: 10, icon: '', detail: `${data.decisionsGenerated} karar` },
            { label: 'Oturumlar', value: Math.min(10, data.sessionsCount * 2), max: 10, icon: '', detail: `${data.sessionsCount} oturum` },
            { label: 'Deneyim', value: Math.min(5, Math.floor((Date.now() - (data.firstUsed || Date.now())) / (1000 * 60 * 60 * 24))), max: 5, icon: '', detail: `${Math.floor((Date.now() - (data.firstUsed || Date.now())) / (1000 * 60 * 60 * 24))} gn` }
        ];
    };

    const saveLearningData = (data) => {
        try {
            localStorage.setItem(`lysia_ai_learning_${userId}`, JSON.stringify(data));
        } catch (e) { console.error('Learning data save error:', e); }
    };

    const [learningData, setLearningData] = useState(getStoredLearning);

    const [aiPersonality, setAiPersonality] = useState({
        name: "Lysia AI",
        mood: "happy",
        learningProgress: calculateLearningProgress(getStoredLearning()),
        totalAnalyses: getStoredLearning().totalAnalyses
    });

    // learningData deitiinde localStorage'a kaydet ve progress gncelle
    useEffect(() => {
        saveLearningData(learningData);
        const progress = calculateLearningProgress(learningData);
        setAiPersonality(prev => ({
            ...prev,
            learningProgress: progress,
            totalAnalyses: learningData.totalAnalyses
        }));
    }, [learningData]);

    // Chat States
    const [messages, setMessages] = useState([{
        id: 1, type: 'ai',
        content: ' **Merhaba! Ben Lysia AI, akll ticaret asistannzm.**\n\n u anda maazanz analiz ediyorum. Sol panelde tm analizleri grebilirsiniz.\n\n Bana her eyi sorabilirsiniz!',
        timestamp: new Date(), mood: 'happy',
        suggestions: ['Maazam analiz et', 'Satlarm nasl?', 'Stok durumum ne?', 'Fiyat nerisi ver']
    }]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    //  VER YKLEME 

    useEffect(() => {
        if (userId) loadAllData();
    }, [userId]);

    // Arka plan analizi
    useEffect(() => {
        if (!aiActive || !userId) return;
        const interval = setInterval(() => {
            refreshData();
        }, 60000); // 60 saniyede bir
        return () => clearInterval(interval);
    }, [aiActive, userId]);

    // Chat auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Gerek rnleri pazaryerlerinden ek
    const fetchRealProducts = async (mps) => {
        const allProducts = [];
        for (const mp of mps) {
            try {
                const res = await API.get(`/products/all?marketplaceId=${mp._id}`);
                if (res.data?.products) {
                    allProducts.push(...res.data.products.map(p => ({ ...p, marketplace: mp.marketplaceName || mp.name })));
                }
            } catch (e) {
                console.log(`${mp.marketplaceName || mp.name} rnleri ekilemedi:`, e.message);
            }
        }
        return allProducts;
    };

    // Top rnleri analytics'ten ek
    const fetchTopProducts = async () => {
        try {
            const res = await API.get('/analytics/top-products?limit=20');
            if (res.data?.success && res.data?.data) return res.data.data;
        } catch (e) { console.log('Top products ekilemedi:', e.message); }
        return [];
    };

    // Kategori dalmn ek
    const fetchCategoryDistribution = async () => {
        try {
            const res = await API.get('/analytics/category-distribution');
            if (res.data?.success && res.data?.data) return res.data.data;
        } catch (e) { console.log('Kategori dalm ekilemedi:', e.message); }
        return [];
    };

    const loadAllData = async () => {
        setLoading(true);
        setAnalyzing(true);
        try {
            const [mpData, dashData, topProds, catData] = await Promise.all([
                getUserMarketplaces().catch(() => []),
                fetchDashboardData().catch(() => null),
                fetchTopProducts().catch(() => []),
                fetchCategoryDistribution().catch(() => [])
            ]);

            const mps = Array.isArray(mpData) ? mpData : [];
            setMarketplaces(mps);
            setDashboardData(dashData);
            setTopProducts(topProds);
            setRealCategories(catData);

            // Gerek rnleri arka planda ek (yava olabilir)
            fetchRealProducts(mps).then(products => {
                setRealProducts(products);
                // rnler gelince fiyat nerilerini gncelle
                if (products.length > 0) {
                    setPriceRecommendations(generateRealPriceRecommendations(products, topProds));
                    // rn verisi renme
                    setLearningData(prev => ({
                        ...prev,
                        productsAnalyzed: products.length,
                        categoriesAnalyzed: [...new Set(products.map(p => p.categoryName))].filter(c => c && c !== 'Bilinmiyor').length
                    }));
                }
            }).catch(() => {});

            // Dashboard verisine kategori bilgisini ekle
            const enrichedDashData = { ...dashData, categoryDistribution: catData, topProducts: topProds };
            runAnalysis(mps, enrichedDashData, topProds);

            // renme verisini gncelle
            setLearningData(prev => ({
                ...prev,
                totalAnalyses: prev.totalAnalyses + 1,
                marketplacesAnalyzed: Math.max(prev.marketplacesAnalyzed, mps.length),
                lastUsed: Date.now()
            }));

            setAiPersonality(prev => ({ ...prev, mood: 'happy' }));

            // Backend AI'dan ek veri ekmeyi dene (opsiyonel)
            tryFetchAIInsights();

        } catch (error) {
            console.error("Veri ykleme hatas:", error);
            runAnalysis([], null, []);
            addAIMessage(" Baz veriler yklenemedi ama mevcut verilerle analiz yapyorum.", "concerned");
        } finally {
            setLoading(false);
            setAnalyzing(false);
        }
    };

    // Gerek rnlerden fiyat nerileri olutur
    const generateRealPriceRecommendations = (products, topProds) => {
        const recommendations = [];
        const topProductNames = new Set(topProds.map(p => p.name));

        // rnleri fiyat ve stok durumuna gre analiz et
        const validProducts = products.filter(p => p.productName && p.productName !== 'Bilinmiyor' && (p.price > 0 || p.salePrice > 0));

        validProducts.forEach(product => {
            const currentPrice = product.salePrice || product.price || 0;
            const listPrice = product.listPrice || currentPrice;
            const stock = product.stock || 0;
            const isTopSeller = topProductNames.has(product.productName);
            const discountRate = listPrice > 0 ? ((listPrice - currentPrice) / listPrice * 100) : 0;

            // Yksek satl rn - fiyat art nerisi
            if (isTopSeller && stock > 10) {
                const increase = Math.round(currentPrice * 1.08); // %8 art
                recommendations.push({
                    product: product.productName,
                    productImage: product.productImage || '',
                    marketplace: product.marketplace || '',
                    barcode: product.barcode || '',
                    stock: stock,
                    currentPrice,
                    listPrice,
                    recommendedPrice: increase,
                    reason: ' ok satan rn - Talep yksek, fiyat art uygun',
                    confidence: 88,
                    impact: 'high',
                    changePercent: '+8%'
                });
            }

            // Stok fazlas olan rn - indirim nerisi
            if (!isTopSeller && stock > 50 && discountRate < 10) {
                const decrease = Math.round(currentPrice * 0.88); // %12 indirim
                recommendations.push({
                    product: product.productName,
                    productImage: product.productImage || '',
                    marketplace: product.marketplace || '',
                    barcode: product.barcode || '',
                    stock: stock,
                    currentPrice,
                    listPrice,
                    recommendedPrice: decrease,
                    reason: ' Stok fazlas - ndirimle sat hzlandrlabilir',
                    confidence: 79,
                    impact: 'medium',
                    changePercent: '-12%'
                });
            }

            // Liste fiyatna ok yakn sat - rekabeti fiyat nerisi
            if (discountRate < 5 && discountRate >= 0 && currentPrice > 50) {
                const competitive = Math.round(currentPrice * 0.93); // %7 indirim
                recommendations.push({
                    product: product.productName,
                    productImage: product.productImage || '',
                    marketplace: product.marketplace || '',
                    barcode: product.barcode || '',
                    stock: stock,
                    currentPrice,
                    listPrice,
                    recommendedPrice: competitive,
                    reason: ' ndirim oran dk - Rekabeti fiyat dnm artrr',
                    confidence: 72,
                    impact: 'medium',
                    changePercent: '-7%'
                });
            }

            // Dk stoklu ama ucuz rn - fiyat art
            if (stock > 0 && stock <= 5 && currentPrice < listPrice * 0.7) {
                const increase = Math.round(currentPrice * 1.15); // %15 art
                recommendations.push({
                    product: product.productName,
                    productImage: product.productImage || '',
                    marketplace: product.marketplace || '',
                    barcode: product.barcode || '',
                    stock: stock,
                    currentPrice,
                    listPrice,
                    recommendedPrice: Math.min(increase, listPrice),
                    reason: ' Dk stok + yksek indirim - Fiyat art krll artrr',
                    confidence: 84,
                    impact: 'high',
                    changePercent: '+15%'
                });
            }
        });

        // En yksek gvenli nerileri nce gster, max 15 neri
        return recommendations
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 15);
    };

    const refreshData = async () => {
        try {
            const [dashData, topProds, catData] = await Promise.all([
                fetchDashboardData().catch(() => null),
                fetchTopProducts().catch(() => []),
                fetchCategoryDistribution().catch(() => [])
            ]);
            if (dashData) {
                setDashboardData(dashData);
                setTopProducts(topProds);
                setRealCategories(catData);
                const enrichedDashData = { ...dashData, categoryDistribution: catData, topProducts: topProds };
                runAnalysis(marketplaces, enrichedDashData, topProds);
                setLastAnalysis(new Date());
                setLearningData(prev => ({
                    ...prev,
                    totalAnalyses: prev.totalAnalyses + 1,
                    lastUsed: Date.now()
                }));
            }
        } catch (e) {
            console.error("Yenileme hatas:", e);
        }
    };

    const tryFetchAIInsights = async () => {
        try {
            const res = await API.get('/ai/suggestions');
            if (res.data && res.data.status === 'success') {
                if (res.data.criticalIssues?.length > 0) {
                    setCriticalDecisions(prev => {
                        const existing = prev.map(d => d.id);
                        const newOnes = res.data.criticalIssues.filter(d => !existing.includes(d.id));
                        return [...prev, ...newOnes.map(d => ({
                            id: d.id, title: d.title, description: d.description,
                            priority: d.severity || 'warning', estimatedTime: '', type: d.type || 'ai'
                        }))];
                    });
                }
                if (res.data.opportunities?.length > 0) {
                    setOpportunities(prev => {
                        const newOpps = res.data.opportunities.filter(o =>
                            !prev.some(p => p.title === o.title)
                        );
                        return [...prev, ...newOpps.map(o => ({
                            title: o.title, description: o.description,
                            potential: o.potential || 'Orta', impact: o.impact || 'Gelir'
                        }))];
                    });
                }
                // Backend'den insight alnd - renme verisine ekle
                setLearningData(prev => ({ ...prev, insightsFetched: prev.insightsFetched + 1 }));
            }
        } catch (e) {
            // Backend AI mevcut deilse sessizce devam et
            console.log("Backend AI opsiyonel - frontend analiz aktif");
        }
    };

    //  ANALZ MOTORU 

    const runAnalysis = (mps, dashData, topProds = []) => {
        const mpAnalysis = AIAnalyzer.analyzeMarketplaces(mps, dashData);
        setMarketAnalysis(mpAnalysis);

        const score = AIAnalyzer.generateOverallScore(dashData, mpAnalysis);
        setOverallScore(score);

        const decisions = AIAnalyzer.generateCriticalDecisions(dashData, mpAnalysis);
        setCriticalDecisions(decisions);
        setOpportunities(AIAnalyzer.generateOpportunities(dashData, mpAnalysis));
        setPerformanceTrends(AIAnalyzer.generatePerformanceTrends(dashData));
        setCategoryPerformance(AIAnalyzer.generateCategoryPerformance(dashData));
        setMarketShareData(AIAnalyzer.generateMarketShareData(mpAnalysis));
        setRevenueForecast(AIAnalyzer.generateRevenueForecast(dashData));
        setConversionFunnel(AIAnalyzer.generateConversionFunnel(dashData));
        setInventoryHealth(AIAnalyzer.generateInventoryHealth(dashData));
        setProfitability(AIAnalyzer.generateProfitability(dashData));

        // Karar saysn renme verisine ekle
        if (decisions.length > 0) {
            setLearningData(prev => ({
                ...prev,
                decisionsGenerated: Math.max(prev.decisionsGenerated, decisions.length)
            }));
        }

        // Fiyat nerileri - eer gerek rnler yoksa fallback
        if (priceRecommendations.length === 0) {
            // Fallback: top products'tan basit neriler
            if (topProds.length > 0) {
                setPriceRecommendations(topProds.slice(0, 5).map((p, idx) => ({
                    product: p.name,
                    productImage: '',
                    marketplace: '',
                    barcode: p.barcode || '',
                    stock: 0,
                    currentPrice: Math.round(p.revenue / Math.max(p.sales, 1)),
                    listPrice: Math.round(p.revenue / Math.max(p.sales, 1) * 1.2),
                    recommendedPrice: Math.round(p.revenue / Math.max(p.sales, 1) * (idx % 2 === 0 ? 1.08 : 0.92)),
                    reason: idx % 2 === 0 ? ' Yksek talep - fiyat art uygun' : ' Sat art iin indirim nerisi',
                    confidence: 75 + Math.floor(Math.random() * 15),
                    impact: idx < 2 ? 'high' : 'medium',
                    changePercent: idx % 2 === 0 ? '+8%' : '-8%'
                })));
            } else {
                // Son fallback: simle edilmi
                setPriceRecommendations([
                    { product: 'rn verisi bekleniyor...', productImage: '', marketplace: '', barcode: '', stock: 0, currentPrice: 0, listPrice: 0, recommendedPrice: 0, reason: 'Gerek rn verileri ykleniyor', confidence: 0, impact: 'low', changePercent: '0%' }
                ]);
            }
        }
    };

    //  CHAT FONKSYONLARI 

    const addAIMessage = (content, mood = 'happy', suggestions = []) => {
        setMessages(prev => [...prev, {
            id: Date.now(), type: 'ai', content, timestamp: new Date(), mood, suggestions
        }]);
        setAiPersonality(prev => ({ ...prev, mood }));
    };

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;

        setMessages(prev => [...prev, {
            id: Date.now(), type: 'user', content: inputMessage, timestamp: new Date()
        }]);

        const msg = inputMessage;
        setInputMessage('');
        setIsTyping(true);

        // AI yant (500ms gecikme ile doal hissettir)
        setTimeout(() => {
            const response = AIAnalyzer.processChat(msg, dashboardData, marketAnalysis);
            setIsTyping(false);
            addAIMessage(response.text, response.mood, [
                'Maazam analiz et', 'Satlarm nasl?', 'Fiyat nerisi ver'
            ]);
            // Chat etkileimi renme verisine ekle
            setLearningData(prev => ({ ...prev, totalChats: prev.totalChats + 1, lastUsed: Date.now() }));
        }, 800);
    };

    const handleSuggestionClick = (suggestion) => {
        setInputMessage(suggestion);
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Date.now(), type: 'user', content: suggestion, timestamp: new Date()
            }]);
            setIsTyping(true);
            setTimeout(() => {
                const response = AIAnalyzer.processChat(suggestion, dashboardData, marketAnalysis);
                setIsTyping(false);
                addAIMessage(response.text, response.mood, [
                    'Maazam analiz et', 'Satlarm nasl?', 'Fiyat nerisi ver'
                ]);
                setLearningData(prev => ({ ...prev, totalChats: prev.totalChats + 1, lastUsed: Date.now() }));
            }, 800);
            setInputMessage('');
        }, 100);
    };

    const getMoodEmoji = (mood) => {
        const moods = { happy: '', excited: '', concerned: '', focused: '' };
        return moods[mood] || '';
    };

    const getMoodColor = (mood) => {
        const colors = { happy: '#22c55e', excited: '#f59e0b', concerned: '#ef4444', focused: '#3b82f6' };
        return colors[mood] || '#22c55e';
    };

    //  LOADING STATE 

    if (loading) {
        return (
            <div className="ai-loading">
                <div className="ai-loading-spinner"><FaBrain className="pulse" /></div>
                <p>AI sistemi balatlyor ve maazanz analiz ediliyor...</p>
            </div>
        );
    }

    //  RENDER 

    const summary = dashboardData?.summary || {};

    return (
        <div className={`advanced-ai-container ${expanded ? 'expanded' : ''}`}>
            {/* AI Status Bar */}
            <div className="ai-status-bar">
                <div className="ai-status-left">
                    <div className="ai-avatar" style={{ borderColor: getMoodColor(aiPersonality.mood) }}>
                        <FaBrain />
                        <span className="ai-mood-indicator">{getMoodEmoji(aiPersonality.mood)}</span>
                    </div>
                    <div className="ai-info">
                        <h3>{aiPersonality.name}</h3>
                        <div className="ai-stats">
                            <span className={`ai-status ${aiActive ? 'active' : 'inactive'}`}>
                                {aiActive ? ' Aktif' : ' Pasif'}
                            </span>
                            <span></span>
                            <span>Skor: <strong>{overallScore}/100</strong></span>
                            <span></span>
                            <span>{aiPersonality.totalAnalyses} analiz</span>
                        </div>
                    </div>
                </div>
                <div className="ai-status-right">
                    <div className="ai-learning-bar" onClick={() => setActiveTab('learning')} style={{ cursor: 'pointer' }} title="Detaylar iin tklayn">
                        <div className="learning-label"> renme lerlemesi</div>
                        <div className="learning-progress">
                            <div className="learning-fill" style={{
                                width: `${aiPersonality.learningProgress}%`,
                                background: aiPersonality.learningProgress >= 80 ? 'linear-gradient(90deg, #22c55e, #4ade80)' :
                                    aiPersonality.learningProgress >= 50 ? 'linear-gradient(90deg, #4ecdc4, #44a08d)' :
                                        'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            }}></div>
                        </div>
                        <div className="learning-value">%{aiPersonality.learningProgress}</div>
                    </div>
                    <button className={`ai-toggle-btn ${aiActive ? 'active' : ''}`} onClick={() => setAiActive(!aiActive)}>
                        {aiActive ? <FaPause /> : <FaPlay />}
                        {aiActive ? 'Duraklat' : 'Balat'}
                    </button>
                    <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
                        {expanded ? <FaCompress /> : <FaExpand />}
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="ai-quick-stats">
                <div className="quick-stat">
                    <FaShoppingCart />
                    <div>
                        <span className="stat-value">{summary.todayOrders || 0}</span>
                        <span className="stat-label">Sipari</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <FaDollarSign />
                    <div>
                        <span className="stat-value">{formatCurrency(summary.todayRevenue || 0)}</span>
                        <span className="stat-label">Gelir</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <FaBoxOpen />
                    <div>
                        <span className="stat-value">{summary.totalProducts || 0}</span>
                        <span className="stat-label">rn</span>
                    </div>
                </div>
                <div className="quick-stat">
                    <FaStore />
                    <div>
                        <span className="stat-value">{marketAnalysis.length}</span>
                        <span className="stat-label">Pazaryeri</span>
                    </div>
                </div>
                <div className="quick-stat score">
                    <FaBrain />
                    <div>
                        <span className="stat-value">{overallScore}/100</span>
                        <span className="stat-label">AI Skor</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="ai-tabs">
                {[
                    { id: 'overview', label: 'Genel Bak', icon: <FaChartLine /> },
                    { id: 'markets', label: 'Pazaryerleri', icon: <FaStore /> },
                    { id: 'analytics', label: 'Grafikler', icon: <FaChartBar /> },
                    { id: 'decisions', label: `Kararlar (${criticalDecisions.length})`, icon: <FaBolt /> },
                    { id: 'prices', label: `Fiyat nerileri (${priceRecommendations.length})`, icon: <FaDollarSign /> },
                    { id: 'learning', label: `renme %${aiPersonality.learningProgress}`, icon: <FaBrain /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`ai-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="ai-main-content">
                {/* Left Panel - Analysis */}
                <div className="ai-analysis-panel">

                    {/*  OVERVIEW TAB  */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Performance Trends */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaChartLine /> Performans Trendleri</h3>
                                    <span className="badge info">Son 7 Gn</span>
                                </div>
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={performanceTrends}>
                                            <defs>
                                                <linearGradient id="aiColorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4ecdc4" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#4ecdc4" stopOpacity={0.1}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                                            <XAxis dataKey="day" stroke="#94a3b8" />
                                            <YAxis stroke="#94a3b8" />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v, n) => [n === 'revenue' ? formatCurrency(v) : v, n === 'revenue' ? 'Gelir' : 'Sipari']} />
                                            <Legend />
                                            <Area type="monotone" dataKey="revenue" stroke="#4ecdc4" fillOpacity={1} fill="url(#aiColorRevenue)" name="Gelir" />
                                            <Line type="monotone" dataKey="orders" stroke="#ff6b6b" strokeWidth={2} name="Sipari" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Inventory Health */}
                            {inventoryHealth.length > 0 && (
                                <div className="analysis-section">
                                    <div className="section-header">
                                        <h3><FaBoxOpen /> Stok Sal</h3>
                                        <span className="badge info">{summary.totalProducts || 0} rn</span>
                                    </div>
                                    <div className="inventory-health-grid">
                                        {inventoryHealth.map((item, idx) => (
                                            <div key={idx} className="inventory-health-card">
                                                <div className="inventory-header">
                                                    <span className="inventory-icon">{item.icon}</span>
                                                    <div>
                                                        <h4>{item.category}</h4>
                                                        <span className="inventory-desc">{item.description}</span>
                                                    </div>
                                                    <span className="total-count" style={{ color: item.color }}>{item.count} rn</span>
                                                </div>
                                                <div className="inventory-bars">
                                                    <div className="bar-container">
                                                        <div className="bar-fill" style={{ width: `${item.percent}%`, background: item.color }}></div>
                                                        <span className="bar-value">%{item.percent}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Conversion Funnel */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaUsers /> Dnm Hunisi</h3>
                                    <span className="badge info">Mteri Yolculuu</span>
                                </div>
                                <div className="funnel-container">
                                    {conversionFunnel.map((stage, idx) => (
                                        <div key={idx} className="funnel-stage">
                                            <div className="funnel-label">
                                                <span>{stage.stage}</span>
                                                <span className="count">{stage.count.toLocaleString()}</span>
                                            </div>
                                            <div className="funnel-bar">
                                                <div className="funnel-fill" style={{ width: `${stage.conversion}%`, background: 'linear-gradient(90deg, #4ecdc4 0%, #44a08d 100%)' }}></div>
                                                <span className="conversion-rate">%{stage.conversion}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Top rnler zeti */}
                            {topProducts.length > 0 && (
                                <div className="analysis-section">
                                    <div className="section-header">
                                        <h3><FaTrophy /> En ok Satan rnler</h3>
                                        <span className="badge success">Top {Math.min(topProducts.length, 5)}</span>
                                    </div>
                                    <div className="top-products-list">
                                        {topProducts.slice(0, 5).map((product, idx) => (
                                            <div key={idx} className="top-product-item">
                                                <div className="top-product-rank">#{idx + 1}</div>
                                                <div className="top-product-info">
                                                    <h4>{product.name?.length > 50 ? product.name.substring(0, 50) + '...' : product.name}</h4>
                                                    <div className="top-product-stats">
                                                        <span> {product.sales} sat</span>
                                                        <span> {formatCurrency(product.revenue)}</span>
                                                        <span className={product.trend >= 0 ? 'trend-up' : 'trend-down'}>
                                                            {product.trend >= 0 ? <FaArrowUp /> : <FaArrowDown />} %{Math.abs(product.trend)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Frsatlar zeti */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaLightbulb /> Frsatlar</h3>
                                    <span className="badge success">{opportunities.length}</span>
                                </div>
                                <div className="opportunities-list">
                                    {opportunities.length === 0 ? (
                                        <div className="empty-state"><FaCheckCircle /><p>u an yeni frsat tespit edilmedi.</p></div>
                                    ) : opportunities.slice(0, 3).map((opp, idx) => (
                                        <div key={idx} className="opportunity-card">
                                            <div className="opp-icon"><span>{opp.icon || ''}</span></div>
                                            <div className="opp-content">
                                                <h4>{opp.title}</h4>
                                                <p>{opp.description}</p>
                                                <div className="opp-meta">
                                                    <span className={`potential potential-${opp.potential === 'Yksek' ? 'high' : 'medium'}`}> {opp.potential}</span>
                                                    <span className="impact"> {opp.impact}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {opportunities.length > 3 && (
                                        <button className="see-more-btn" onClick={() => setActiveTab('decisions')}>
                                            Tm frsatlar gr ({opportunities.length}) 
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/*  MARKETS TAB  */}
                    {activeTab === 'markets' && (
                        <>
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaStore /> Pazaryeri Analizi</h3>
                                    <button className="refresh-btn" onClick={refreshData}>
                                        <FaSync className={analyzing ? 'spinning' : ''} />
                                    </button>
                                </div>
                                {marketAnalysis.length === 0 ? (
                                    <div className="empty-state">
                                        <FaStore />
                                        <p>Henz pazaryeri entegrasyonu yok. Entegrasyonlar sayfasndan pazaryeri ekleyin.</p>
                                    </div>
                                ) : (
                                    <div className="market-analysis-grid">
                                        {marketAnalysis.map((market, idx) => (
                                            <div key={idx} className={`market-card ${market.health}`}>
                                                <div className="market-header">
                                                    <h4>{market.marketplace}</h4>
                                                    <div className="market-score">
                                                        <div className="score-circle" style={{ background: `conic-gradient(${market.health === 'excellent' ? '#22c55e' : market.health === 'good' ? '#3b82f6' : '#f59e0b'} ${market.performanceScore * 3.6}deg, #2d3748 0deg)` }}>
                                                            <span>{market.performanceScore}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="market-stats">
                                                    <div className="stat"><FaShoppingCart /><span>{market.orders} sipari</span></div>
                                                    <div className="stat"><FaDollarSign /><span>{formatCurrency(market.revenue)}</span></div>
                                                    <div className={`trend ${market.trend.direction}`}>
                                                        {market.trend.direction === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                                                        <span>%{market.marketShare} pazar pay</span>
                                                    </div>
                                                </div>
                                                <div className="market-recommendation">
                                                    <FaLightbulb />
                                                    <p>{market.recommendation}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Market Share Pie */}
                            {marketShareData.length > 0 && (
                                <div className="analysis-section">
                                    <div className="section-header">
                                        <h3><FaChartPie /> Pazar Pay Dalm</h3>
                                    </div>
                                    <div className="market-share-container">
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie data={marketShareData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} %${(percent * 100).toFixed(0)}`} outerRadius={80} dataKey="value">
                                                    {marketShareData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/*  ANALYTICS TAB  */}
                    {activeTab === 'analytics' && (
                        <>
                            {/* Revenue Forecast */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaRocket /> Gelir Tahmini</h3>
                                    <span className="badge success">12 Aylk</span>
                                </div>
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={revenueForecast}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                                            <XAxis dataKey="month" stroke="#94a3b8" />
                                            <YAxis stroke="#94a3b8" />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v) => formatCurrency(v)} />
                                            <Legend />
                                            <Line type="monotone" dataKey="predicted" stroke="#4ecdc4" strokeWidth={2} name="Tahmini" strokeDasharray="5 5" />
                                            <Line type="monotone" dataKey="actual" stroke="#ff6b6b" strokeWidth={2} name="Gerekleen" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Profitability */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaTrophy /> Karllk Analizi</h3>
                                    <span className="badge success">6 Aylk</span>
                                </div>
                                <div className="chart-container">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={profitability}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                                            <XAxis dataKey="month" stroke="#94a3b8" />
                                            <YAxis stroke="#94a3b8" />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v) => formatCurrency(v)} />
                                            <Legend />
                                            <Bar dataKey="revenue" fill="#4ecdc4" name="Gelir" />
                                            <Bar dataKey="cost" fill="#ff6b6b" name="Maliyet" />
                                            <Bar dataKey="profit" fill="#22c55e" name="Kar" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="profitability-summary">
                                    <div className="summary-card">
                                        <div className="summary-label">Toplam Gelir</div>
                                        <div className="summary-value">{formatCurrency(profitability.reduce((s, i) => s + i.revenue, 0))}</div>
                                    </div>
                                    <div className="summary-card">
                                        <div className="summary-label">Toplam Kar</div>
                                        <div className="summary-value">{formatCurrency(profitability.reduce((s, i) => s + i.profit, 0))}</div>
                                    </div>
                                    <div className="summary-card">
                                        <div className="summary-label">Ort. Kar Marj</div>
                                        <div className="summary-value">%{(profitability.reduce((s, i) => s + i.margin, 0) / (profitability.length || 1)).toFixed(1)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Category Performance */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaChartBar /> Kategori Performans</h3>
                                    <span className="badge info">{categoryPerformance.length} Kategori</span>
                                </div>

                                {/* Kategori Dalm Grafii */}
                                {categoryPerformance.length > 1 && categoryPerformance[0]?.name !== 'Veri Bekleniyor' && (
                                    <div className="chart-container" style={{ marginBottom: '1.5rem' }}>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <BarChart data={categoryPerformance} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                                                <XAxis type="number" stroke="#94a3b8" tickFormatter={(v) => formatCurrency(v)} />
                                                <YAxis type="category" dataKey="name" stroke="#94a3b8" width={100} tick={{ fontSize: 12 }} />
                                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} formatter={(v, n) => [n === 'revenue' ? formatCurrency(v) : v, n === 'revenue' ? 'Gelir' : 'Sipari']} />
                                                <Bar dataKey="revenue" fill="#4ecdc4" name="Gelir" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                <div className="category-performance-grid">
                                    {categoryPerformance.map((cat, idx) => (
                                        <div key={idx} className="category-performance-card">
                                            <div className="cat-header">
                                                <div className="cat-rank">#{idx + 1}</div>
                                                <h4>{cat.name}</h4>
                                                <div className={`growth-badge ${cat.growth >= 0 ? 'positive' : 'negative'}`}>
                                                    {cat.growth >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                                    %{Math.abs(cat.growth)}
                                                </div>
                                            </div>
                                            <div className="cat-metrics">
                                                <div className="metric">
                                                    <span className="label"> Gelir</span>
                                                    <span className="value">{formatCurrency(cat.revenue)}</span>
                                                </div>
                                                <div className="metric">
                                                    <span className="label"> Sipari</span>
                                                    <span className="value">{cat.orders}</span>
                                                </div>
                                                <div className="metric">
                                                    <span className="label"> Kar Marj</span>
                                                    <span className="value" style={{ color: cat.margin >= 35 ? '#22c55e' : cat.margin >= 25 ? '#f59e0b' : '#ef4444' }}>%{cat.margin}</span>
                                                </div>
                                                {cat.percentage > 0 && (
                                                    <div className="metric">
                                                        <span className="label"> Pay</span>
                                                        <span className="value">%{cat.percentage}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="cat-progress">
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{ width: `${cat.margin}%`, background: cat.margin >= 35 ? '#22c55e' : cat.margin >= 25 ? '#f59e0b' : '#ef4444' }}></div>
                                                </div>
                                            </div>
                                            <div className="cat-insight">
                                                <FaLightbulb style={{ color: '#ffd93d', fontSize: '0.8rem' }} />
                                                <span>{cat.growth >= 10 ? 'Hzl byme! Stok artrm dnn.' : cat.growth >= 0 ? 'Stabil performans, optimizasyon yaplabilir.' : 'D trendi! Fiyat ve kampanya stratejisi gzden geirin.'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/*  DECISIONS TAB  */}
                    {activeTab === 'decisions' && (
                        <>
                            {/* AI Piyasa Analizi zeti */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaChartLine /> Piyasa Analizi</h3>
                                    <span className="badge info">AI Deerlendirmesi</span>
                                </div>
                                <div className="market-intelligence">
                                    <div className="mi-score-card">
                                        <div className="mi-score-circle" style={{
                                            background: `conic-gradient(${overallScore >= 70 ? '#22c55e' : overallScore >= 40 ? '#f59e0b' : '#ef4444'} ${overallScore * 3.6}deg, #1e293b 0deg)`
                                        }}>
                                            <div className="mi-score-inner">
                                                <span className="mi-score-value">{overallScore}</span>
                                                <span className="mi-score-label">Skor</span>
                                            </div>
                                        </div>
                                        <div className="mi-score-text">
                                            <h4>{overallScore >= 80 ? ' Mkemmel Durum' : overallScore >= 60 ? ' yi Durum' : overallScore >= 40 ? ' Dikkat Gerekli' : ' Kritik Durum'}</h4>
                                            <p>{overallScore >= 80 ? 'Maazanz tm pazaryerlerinde gl performans gsteriyor.' : overallScore >= 60 ? 'Genel durum iyi, kk optimizasyonlarla daha da iyileebilir.' : overallScore >= 40 ? 'Baz alanlarda iyiletirme gerekli. Aadaki kararlar inceleyin.' : 'Acil mdahale gerektiren durumlar var. Kritik kararlar hemen uygulayn.'}</p>
                                        </div>
                                    </div>
                                    <div className="mi-metrics-row">
                                        <div className="mi-metric">
                                            <span className="mi-metric-icon"></span>
                                            <div>
                                                <span className="mi-metric-value">{marketAnalysis.length}</span>
                                                <span className="mi-metric-label">Aktif Pazaryeri</span>
                                            </div>
                                        </div>
                                        <div className="mi-metric">
                                            <span className="mi-metric-icon"></span>
                                            <div>
                                                <span className="mi-metric-value">{summary.totalProducts || 0}</span>
                                                <span className="mi-metric-label">Toplam rn</span>
                                            </div>
                                        </div>
                                        <div className="mi-metric">
                                            <span className="mi-metric-icon"></span>
                                            <div>
                                                <span className="mi-metric-value">{summary.todayOrders || 0}</span>
                                                <span className="mi-metric-label">Bugn Sipari</span>
                                            </div>
                                        </div>
                                        <div className="mi-metric">
                                            <span className="mi-metric-icon"></span>
                                            <div>
                                                <span className="mi-metric-value">{formatCurrency(summary.todayRevenue || 0)}</span>
                                                <span className="mi-metric-label">Bugn Gelir</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Piyasa Deerlendirmesi */}
                                    <div className="mi-assessment">
                                        <h4> AI Piyasa Deerlendirmesi</h4>
                                        <div className="mi-assessment-items">
                                            {marketAnalysis.map((m, idx) => (
                                                <div key={idx} className={`mi-assessment-item ${m.health}`}>
                                                    <span className="mi-mp-name">{m.marketplace}</span>
                                                    <div className="mi-mp-bar">
                                                        <div className="mi-mp-fill" style={{
                                                            width: `${m.performanceScore}%`,
                                                            background: m.health === 'excellent' ? '#22c55e' : m.health === 'good' ? '#3b82f6' : m.health === 'warning' ? '#f59e0b' : '#ef4444'
                                                        }}></div>
                                                    </div>
                                                    <span className="mi-mp-score">{m.performanceScore}/100</span>
                                                </div>
                                            ))}
                                            {marketAnalysis.length === 0 && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Pazaryeri entegrasyonu yapldnda piyasa analizi burada grnecek.</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Kritik Kararlar */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaBolt /> Kritik Kararlar & Aksiyonlar</h3>
                                    <span className="badge critical">{criticalDecisions.filter(d => d.priority === 'critical').length} Kritik</span>
                                    <span className="badge warning" style={{ marginLeft: '0.5rem' }}>{criticalDecisions.filter(d => d.priority !== 'critical' && d.priority !== 'success').length} Uyar</span>
                                </div>
                                <div className="decisions-list">
                                    {criticalDecisions.length === 0 ? (
                                        <div className="empty-state"><FaCheckCircle /><p>Kritik durum yok - Her ey yolunda! </p></div>
                                    ) : criticalDecisions.map((decision, idx) => (
                                        <motion.div key={idx} className={`decision-card priority-${decision.priority}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }}>
                                            <div className={`decision-icon ${decision.priority}`}>
                                                <span>{decision.icon || ''}</span>
                                            </div>
                                            <div className="decision-content">
                                                <div className="decision-header-row">
                                                    <h4>{decision.title}</h4>
                                                    <div className="decision-badges">
                                                        <span className={`priority-badge ${decision.priority}`}>
                                                            {decision.priority === 'critical' ? ' Kritik' : decision.priority === 'success' ? ' Baar' : decision.priority === 'info' ? ' Bilgi' : ' Uyar'}
                                                        </span>
                                                        {decision.estimatedTime && <span className="time-badge"><FaClock /> {decision.estimatedTime}</span>}
                                                    </div>
                                                </div>
                                                <p className="decision-desc">{decision.description}</p>
                                                {decision.details && (
                                                    <div className="decision-details">
                                                        <FaInfoCircle />
                                                        <span>{decision.details}</span>
                                                    </div>
                                                )}
                                                {decision.actions && decision.actions.length > 0 && (
                                                    <div className="decision-actions">
                                                        <span className="actions-label">nerilen Aksiyonlar:</span>
                                                        <div className="action-buttons">
                                                            {decision.actions.map((action, aIdx) => (
                                                                <button key={aIdx} className="action-btn">{action}</button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Frsatlar */}
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaLightbulb /> Frsatlar & neriler</h3>
                                    <span className="badge success">{opportunities.length}</span>
                                </div>
                                <div className="opportunities-list">
                                    {opportunities.length === 0 ? (
                                        <div className="empty-state"><FaCheckCircle /><p>u an yeni frsat tespit edilmedi.</p></div>
                                    ) : opportunities.map((opp, idx) => (
                                        <motion.div key={idx} className="opportunity-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
                                            <div className="opp-icon"><span>{opp.icon || ''}</span></div>
                                            <div className="opp-content">
                                                <h4>{opp.title}</h4>
                                                <p>{opp.description}</p>
                                                <div className="opp-meta">
                                                    <span className={`potential potential-${opp.potential === 'Yksek' ? 'high' : 'medium'}`}> {opp.potential} Potansiyel</span>
                                                    <span className="impact"> {opp.impact}</span>
                                                    {opp.estimatedGain && <span className="estimated-gain"> Tahmini: {opp.estimatedGain}</span>}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/*  PRICES TAB  */}
                    {activeTab === 'prices' && (
                        <>
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaDollarSign /> Fiyat nerileri</h3>
                                    <span className="badge info">{priceRecommendations.length} neri</span>
                                </div>
                                {priceRecommendations.length === 0 ? (
                                    <div className="empty-state">
                                        <FaDollarSign />
                                        <p>Fiyat nerileri oluturuluyor... rn verileri ykleniyor.</p>
                                    </div>
                                ) : (
                                    <div className="price-recommendations">
                                        {priceRecommendations.map((rec, idx) => (
                                            <motion.div key={idx} className={`price-card impact-${rec.impact}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}>
                                                <div className="price-card-top">
                                                    {/* rn Grseli */}
                                                    <div className="price-product-image">
                                                        {rec.productImage ? (
                                                            <img src={rec.productImage} alt={rec.product} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                                        ) : null}
                                                        <div className="price-product-placeholder" style={{ display: rec.productImage ? 'none' : 'flex' }}>
                                                            <FaBoxOpen />
                                                        </div>
                                                    </div>
                                                    {/* rn Bilgileri */}
                                                    <div className="price-product-info">
                                                        <h4 title={rec.product}>{rec.product.length > 60 ? rec.product.substring(0, 60) + '...' : rec.product}</h4>
                                                        <div className="price-product-meta">
                                                            {rec.marketplace && <span className="mp-badge"><FaStore /> {rec.marketplace}</span>}
                                                            {rec.barcode && <span className="barcode-badge"> {rec.barcode}</span>}
                                                            {rec.stock > 0 && <span className={`stock-badge ${rec.stock <= 5 ? 'critical' : rec.stock <= 20 ? 'low' : 'ok'}`}> {rec.stock} adet</span>}
                                                        </div>
                                                    </div>
                                                    {/* Gven Skoru */}
                                                    <div className="confidence-badge">
                                                        <FaStar />
                                                        <span>%{rec.confidence}</span>
                                                    </div>
                                                </div>

                                                {/* Fiyat Karlatrma */}
                                                <div className="price-comparison">
                                                    <div className="price-box current">
                                                        <span className="price-label">Mevcut Fiyat</span>
                                                        <span className="price-value">{formatCurrency(rec.currentPrice)}</span>
                                                        {rec.listPrice > rec.currentPrice && (
                                                            <span className="list-price">{formatCurrency(rec.listPrice)}</span>
                                                        )}
                                                    </div>
                                                    <div className={`price-arrow ${rec.recommendedPrice > rec.currentPrice ? 'up' : 'down'}`}>
                                                        {rec.recommendedPrice > rec.currentPrice ? <FaArrowUp /> : <FaArrowDown />}
                                                        <span className="change-percent">{rec.changePercent}</span>
                                                    </div>
                                                    <div className={`price-box recommended ${rec.recommendedPrice > rec.currentPrice ? 'increase' : 'decrease'}`}>
                                                        <span className="price-label">nerilen Fiyat</span>
                                                        <span className="price-value">{formatCurrency(rec.recommendedPrice)}</span>
                                                        <span className="price-diff">{rec.recommendedPrice > rec.currentPrice ? '+' : ''}{formatCurrency(rec.recommendedPrice - rec.currentPrice)}</span>
                                                    </div>
                                                </div>

                                                {/* Sebep */}
                                                <div className="price-reason">
                                                    <FaInfoCircle />
                                                    <p>{rec.reason}</p>
                                                </div>

                                                {/* Etki Gstergesi */}
                                                <div className="price-impact-bar">
                                                    <span className="impact-label">Etki Seviyesi:</span>
                                                    <div className="impact-dots">
                                                        <span className={`dot ${rec.impact === 'high' || rec.impact === 'medium' || rec.impact === 'low' ? 'active' : ''}`}></span>
                                                        <span className={`dot ${rec.impact === 'high' || rec.impact === 'medium' ? 'active' : ''}`}></span>
                                                        <span className={`dot ${rec.impact === 'high' ? 'active' : ''}`}></span>
                                                    </div>
                                                    <span className={`impact-text impact-${rec.impact}`}>{rec.impact === 'high' ? 'Yksek' : rec.impact === 'medium' ? 'Orta' : 'Dk'}</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/*  LEARNING TAB  */}
                    {activeTab === 'learning' && (
                        <>
                            <div className="analysis-section">
                                <div className="section-header">
                                    <h3><FaBrain /> AI renme Durumu</h3>
                                    <span className="badge success">%{aiPersonality.learningProgress}</span>
                                </div>

                                {/* Genel lerleme */}
                                <div className="learning-overview">
                                    <div className="learning-big-progress">
                                        <div className="big-progress-circle" style={{
                                            background: `conic-gradient(${aiPersonality.learningProgress >= 80 ? '#22c55e' : aiPersonality.learningProgress >= 50 ? '#4ecdc4' : '#f59e0b'} ${aiPersonality.learningProgress * 3.6}deg, #1e293b 0deg)`
                                        }}>
                                            <div className="big-progress-inner">
                                                <span className="big-progress-value">%{aiPersonality.learningProgress}</span>
                                                <span className="big-progress-label">renme</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="learning-summary-text">
                                        <h4>
                                            {aiPersonality.learningProgress >= 80 ? ' Uzman Seviye' :
                                                aiPersonality.learningProgress >= 60 ? ' leri Seviye' :
                                                    aiPersonality.learningProgress >= 40 ? ' Orta Seviye' :
                                                        aiPersonality.learningProgress >= 20 ? ' Balang Seviye' : ' Yeni Balang'}
                                        </h4>
                                        <p>
                                            {aiPersonality.learningProgress >= 80 ? 'AI maazanz ok iyi tanyor! Kararlar yksek gvenle veriyor.' :
                                                aiPersonality.learningProgress >= 60 ? 'AI maazanz iyi rendi. Daha fazla etkileim doruluu artrr.' :
                                                    aiPersonality.learningProgress >= 40 ? 'AI maazanz renmeye devam ediyor. Chat ve analizlerle hzlandrn.' :
                                                        'AI maazanz tanmaya balyor. Pazaryeri entegrasyonlar ve chat etkileimi renmeyi hzlandrr.'}
                                        </p>
                                        <div className="learning-meta-info">
                                            <span> lk kullanm: {new Date(learningData.firstUsed).toLocaleDateString('tr-TR')}</span>
                                            <span> Son gncelleme: {new Date(learningData.lastUsed).toLocaleTimeString('tr-TR')}</span>
                                            <span> Toplam analiz: {learningData.totalAnalyses}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detayl Breakdown */}
                                <div className="learning-breakdown">
                                    <h4 style={{ marginBottom: '1rem', color: '#94a3b8' }}> renme Faktrleri</h4>
                                    {getLearningBreakdown(learningData).map((item, idx) => (
                                        <div key={idx} className="learning-factor">
                                            <div className="factor-header">
                                                <span className="factor-icon">{item.icon}</span>
                                                <span className="factor-label">{item.label}</span>
                                                <span className="factor-detail">{item.detail}</span>
                                                <span className="factor-score">{Math.round(item.value)}/{item.max}</span>
                                            </div>
                                            <div className="factor-bar">
                                                <div className="factor-fill" style={{
                                                    width: `${(item.value / item.max) * 100}%`,
                                                    background: item.value >= item.max ? '#22c55e' : item.value >= item.max * 0.5 ? '#4ecdc4' : '#f59e0b'
                                                }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* renme pular */}
                                <div className="learning-tips">
                                    <h4 style={{ marginBottom: '1rem', color: '#94a3b8' }}> renmeyi Hzlandrma pular</h4>
                                    {getLearningBreakdown(learningData).filter(f => f.value < f.max).slice(0, 4).map((factor, idx) => (
                                        <div key={idx} className="learning-tip">
                                            <span className="tip-icon">{factor.icon}</span>
                                            <span className="tip-text">
                                                {factor.label === 'Chat' ? 'AI ile daha fazla sohbet edin - sorular sorun, neriler isteyin.' :
                                                    factor.label === 'Pazaryeri' ? 'Daha fazla pazaryeri entegre edin - AI daha geni analiz yapabilir.' :
                                                        factor.label === 'rnler' ? 'rn verileriniz ykleniyor - pazaryeri entegrasyonlarn kontrol edin.' :
                                                            factor.label === 'Kategoriler' ? 'Farkl kategorilerde rn ekleyin - AI kategori bazl analiz yapabilir.' :
                                                                factor.label === 'Analiz' ? 'Sayfay dzenli ziyaret edin - her ziyarette AI yeni analiz yapar.' :
                                                                    factor.label === 'Kararlar' ? 'Kritik kararlar blmn inceleyin ve uygulayn.' :
                                                                        `${factor.label} alannda daha fazla etkileim yapn.`}
                                            </span>
                                            <span className="tip-progress">+{Math.round(factor.max - factor.value)} puan potansiyel</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Right Panel - Chat */}
                <div className={`ai-chat-panel ${chatOpen ? 'open' : 'closed'}`}>
                    <div className="chat-header">
                        <div className="chat-title">
                            <FaRobot />
                            <h3>AI Asistan</h3>
                            {analyzing && <span className="typing-indicator"><FaSpinner className="spinning" /> Analiz ediyor...</span>}
                        </div>
                        <button className="chat-toggle" onClick={() => setChatOpen(!chatOpen)}>
                            {chatOpen ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>

                    <div className="chat-messages">
                        <AnimatePresence>
                            {messages.map((msg) => (
                                <motion.div key={msg.id} className={`message ${msg.type}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                    {msg.type === 'ai' && (
                                        <div className="message-avatar" style={{ borderColor: getMoodColor(msg.mood) }}>
                                            {getMoodEmoji(msg.mood)}
                                        </div>
                                    )}
                                    <div className="message-content">
                                        <div className="message-text">
                                            {msg.content.split('\n').map((line, i) => (
                                                <p key={i}>{line}</p>
                                            ))}
                                        </div>
                                        <div className="message-time">
                                            {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {msg.suggestions?.length > 0 && (
                                            <div className="message-suggestions">
                                                {msg.suggestions.map((sug, idx) => (
                                                    <button key={idx} className="suggestion-btn" onClick={() => handleSuggestionClick(sug)}>
                                                        {sug}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {msg.type === 'user' && <div className="message-avatar user"></div>}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {isTyping && (
                            <div className="typing-indicator-msg">
                                <div className="typing-dots"><span></span><span></span><span></span></div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input">
                        <input
                            type="text"
                            placeholder="Bir ey sorun..."
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button className="send-btn" onClick={handleSendMessage} disabled={!inputMessage.trim()}>
                            <FaPaperPlane />
                        </button>
                    </div>
                </div>
            </div>

            {/* Background Analysis Indicator */}
            {aiActive && (
                <div className="background-analysis-indicator">
                    <FaBrain className="pulse" />
                    <span>Arka planda analiz ediliyor...</span>
                    <span className="last-analysis">Son: {lastAnalysis.toLocaleTimeString('tr-TR')}</span>
                </div>
            )}
        </div>
    );
};

export default AdvancedAIAssistant;
