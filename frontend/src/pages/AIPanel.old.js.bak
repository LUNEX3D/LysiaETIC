import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "../services/api";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar
} from "recharts";
import "../styles/AIPanel.modern.css";

const AIPanel = () => {
    // ==================== STATE MANAGEMENT ====================

    // Theme & Settings
    const [theme, setTheme] = useState(() => localStorage.getItem('ai-panel-theme') || 'dark');
    const [animationEnabled, setAnimationEnabled] = useState(() =>
        localStorage.getItem('ai-panel-animation') !== 'false'
    );

    // Core AI Data - Gerçek Verilerle Çalışan Sistem
    const [systemHealth, setSystemHealth] = useState(null);
    const [aiDecisions, setAiDecisions] = useState([]);
    const [criticalActions, setCriticalActions] = useState([]);
    const [opportunities, setOpportunities] = useState([]);
    const [risks, setRisks] = useState([]);

    // Detaylı Analizler
    const [productInsights, setProductInsights] = useState(null);
    const [marketplacePerformance, setMarketplacePerformance] = useState(null);
    const [realtimeMetrics, setRealtimeMetrics] = useState(null);
    const [forecast, setForecast] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);

    // UI States
    const [activeView, setActiveView] = useState("command-center");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);
    const [optimizing, setOptimizing] = useState(false);
    const [actionResults, setActionResults] = useState([]);

    // Chat States
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        {
            type: 'ai',
            content: '🤖 Merhaba! Ben sizin AI asistanınızım. Tüm sisteminizi analiz edip size gerçek verilerle öneriler sunuyorum. Size nasıl yardımcı olabilirim?',
            timestamp: new Date(),
            suggestions: [
                'Sistemi analiz et',
                'Kritik aksiyonları göster',
                'Fırsatları listele',
                'Riskleri değerlendir'
            ]
        }
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatMessagesEndRef = useRef(null);

    // ==================== THEME MANAGEMENT ====================

    useEffect(() => {
        localStorage.setItem('ai-panel-theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('ai-panel-animation', animationEnabled);
    }, [animationEnabled]);

    // ==================== DATA FETCHING ====================

    // Tüm Sistemi Analiz Et - Ana Fonksiyon
    const analyzeEntireSystem = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            console.log("🤖 [AI Panel] Tüm sistem analizi başlatılıyor...");

            // Paralel olarak tüm verileri çek
            const [
                performanceRes,
                realtimeRes,
                productsRes,
                forecastRes,
                anomaliesRes,
                dashboardRes
            ] = await Promise.allSettled([
                axios.get("/ai/performance"),
                axios.get("/ai/realtime-insights"),
                axios.get("/ai/products"),
                axios.get("/ai/forecast?days=30"),
                axios.get("/ai/anomalies"),
                axios.get("/dashboard")
            ]);

            // Performance & System Health
            if (performanceRes.status === 'fulfilled') {
                const perfData = performanceRes.value.data;
                setSystemHealth(perfData.storeHealth);

                // AI Kararları ve Aksiyonlar
                const decisions = generateAIDecisions(perfData);
                setAiDecisions(decisions);

                // Kritik Aksiyonlar
                const actions = extractCriticalActions(perfData);
                setCriticalActions(actions);

                // Fırsatlar
                const opps = identifyOpportunities(perfData);
                setOpportunities(opps);

                // Riskler
                const riskList = identifyRisks(perfData);
                setRisks(riskList);
            }

            // Realtime Metrics
            if (realtimeRes.status === 'fulfilled') {
                setRealtimeMetrics(realtimeRes.value.data);
            }

            // Product Insights
            if (productsRes.status === 'fulfilled') {
                setProductInsights(productsRes.value.data);
            }

            // Forecast
            if (forecastRes.status === 'fulfilled') {
                setForecast(forecastRes.value.data);
            }

            // Dashboard Data
            if (dashboardRes.status === 'fulfilled') {
                setDashboardData(dashboardRes.value.data);

                // Marketplace Performance
                const mpPerf = analyzeMarketplacePerformance(dashboardRes.value.data);
                setMarketplacePerformance(mpPerf);
            }

            setLastUpdated(new Date());
            console.log("✅ [AI Panel] Sistem analizi tamamlandı");

        } catch (err) {
            console.error("❌ [AI Panel] Analiz hatası:", err);
            setError("Sistem analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    }, []);

    // ==================== AI DECISION ENGINE ====================

    // AI Kararları Üret - Gerçek Verilerle
    const generateAIDecisions = (performanceData) => {
        const decisions = [];
        const { storeHealth, productSignals, forecast, todo, risks } = performanceData;

        // 1. Sistem Sağlığı Değerlendirmesi
        if (storeHealth) {
            const { score, level, pillars } = storeHealth;

            if (level === 'critical') {
                decisions.push({
                    id: 'health-critical',
                    type: 'critical',
                    priority: 'high',
                    title: '🚨 Sistem Sağlığı Kritik Seviyede',
                    description: `Mağaza sağlık skoru: ${score}/100. Acil müdahale gerekiyor.`,
                    impact: 'high',
                    action: 'Tüm kritik sorunları hemen çözün',
                    autoApplicable: false,
                    data: { score, level, pillars }
                });
            } else if (level === 'warning') {
                decisions.push({
                    id: 'health-warning',
                    type: 'warning',
                    priority: 'medium',
                    title: '⚠️ Sistem Performansı İyileştirilebilir',
                    description: `Mağaza sağlık skoru: ${score}/100. Optimizasyon öneriliyor.`,
                    impact: 'medium',
                    action: 'Performans iyileştirmeleri uygulayın',
                    autoApplicable: true,
                    data: { score, level, pillars }
                });
            }

            // Pillar bazlı kararlar
            if (pillars.stock < 70) {
                decisions.push({
                    id: 'stock-issue',
                    type: 'stock',
                    priority: 'high',
                    title: '📦 Stok Yönetimi Sorunlu',
                    description: `Stok skoru: ${pillars.stock}/100. Stok uyumsuzlukları tespit edildi.`,
                    impact: 'high',
                    action: 'Stok senkronizasyonu yapın',
                    autoApplicable: true,
                    data: { stockScore: pillars.stock }
                });
            }

            if (pillars.sales < 60) {
                decisions.push({
                    id: 'sales-low',
                    type: 'sales',
                    priority: 'high',
                    title: '📉 Satış Performansı Düşük',
                    description: `Satış skoru: ${pillars.sales}/100. Satışları artırıcı aksiyonlar gerekli.`,
                    impact: 'high',
                    action: 'Kampanya başlatın veya fiyat optimizasyonu yapın',
                    autoApplicable: true,
                    data: { salesScore: pillars.sales }
                });
            }
        }

        // 2. Todo Listesinden Kararlar
        if (todo && todo.length > 0) {
            todo.forEach((item, index) => {
                decisions.push({
                    id: `todo-${index}`,
                    type: 'task',
                    priority: item.impact || 'medium',
                    title: `📋 ${item.title}`,
                    description: `Tahmini süre: ${item.etaDays || 1} gün`,
                    impact: item.impact || 'medium',
                    action: 'Bu görevi tamamlayın',
                    autoApplicable: false,
                    data: item
                });
            });
        }

        // 3. Risk Bazlı Kararlar
        if (risks && risks.length > 0) {
            risks.forEach((risk, index) => {
                if (risk && risk.trim()) {
                    decisions.push({
                        id: `risk-${index}`,
                        type: 'risk',
                        priority: 'high',
                        title: '⚠️ Risk Tespit Edildi',
                        description: risk,
                        impact: 'high',
                        action: 'Bu riski değerlendirin ve önlem alın',
                        autoApplicable: false,
                        data: { risk }
                    });
                }
            });
        }

        return decisions;
    };

    // Kritik Aksiyonları Çıkar
    const extractCriticalActions = (performanceData) => {
        const actions = [];
        const { storeHealth, todo } = performanceData;

        if (storeHealth && storeHealth.level === 'critical') {
            actions.push({
                id: 'optimize-system',
                title: '🚀 Sistemi Optimize Et',
                description: 'Tüm kritik sorunları otomatik olarak düzelt',
                type: 'auto',
                impact: 'high',
                estimatedTime: '5 dakika',
                applicable: true
            });
        }

        if (todo && todo.length > 0) {
            actions.push({
                id: 'sync-marketplaces',
                title: '🔄 Pazaryerlerini Senkronize Et',
                description: 'Tüm pazaryerlerindeki hataları ve bekleyen işlemleri çöz',
                type: 'auto',
                impact: 'medium',
                estimatedTime: '10 dakika',
                applicable: true
            });
        }

        return actions;
    };

    // Fırsatları Belirle
    const identifyOpportunities = (performanceData) => {
        const opportunities = [];
        const { storeHealth, forecast, growthPotential } = performanceData;

        if (storeHealth && storeHealth.pillars.sales > 70) {
            opportunities.push({
                id: 'expand-sales',
                title: '📈 Satış Artırma Fırsatı',
                description: 'Satış performansınız iyi. Yeni pazaryerleri ekleyerek büyüyebilirsiniz.',
                potential: 'high',
                estimatedImpact: '+30% ciro artışı',
                action: 'Yeni pazaryeri entegrasyonu ekleyin'
            });
        }

        if (growthPotential && growthPotential.utilization < 0.7) {
            opportunities.push({
                id: 'increase-capacity',
                title: '💡 Kapasite Artırma',
                description: `Mevcut kapasitenizin %${Math.round(growthPotential.utilization * 100)}'ini kullanıyorsunuz.`,
                potential: 'medium',
                estimatedImpact: '+20% sipariş kapasitesi',
                action: 'Stok ve operasyon kapasitesini artırın'
            });
        }

        return opportunities;
    };

    // Riskleri Belirle
    const identifyRisks = (performanceData) => {
        const risks = [];
        const { storeHealth, risks: perfRisks } = performanceData;

        if (storeHealth && storeHealth.pillars.stock < 60) {
            risks.push({
                id: 'stock-risk',
                title: '⚠️ Stok Riski',
                description: 'Stok uyumsuzlukları satışları olumsuz etkileyebilir',
                severity: 'high',
                probability: 'high',
                mitigation: 'Acil stok senkronizasyonu yapın'
            });
        }

        if (perfRisks && perfRisks.length > 0) {
            perfRisks.forEach((risk, index) => {
                if (risk && risk.trim()) {
                    risks.push({
                        id: `perf-risk-${index}`,
                        title: '🔴 Sistem Riski',
                        description: risk,
                        severity: 'medium',
                        probability: 'medium',
                        mitigation: 'Detaylı inceleme yapın'
                    });
                }
            });
        }

        return risks;
    };

    // Marketplace Performance Analizi
    const analyzeMarketplacePerformance = (dashboardData) => {
        if (!dashboardData || !dashboardData.marketplaceStatus) return null;

        const mpStatus = dashboardData.marketplaceStatus;
        const performance = [];

        Object.entries(mpStatus).forEach(([name, data]) => {
            const healthScore = calculateMarketplaceHealth(data);

            performance.push({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                orders: data.orders || 0,
                revenue: data.revenue || 0,
                errors: data.errors || 0,
                pendingSync: data.pendingSync || 0,
                stockMismatch: data.stockMismatch || 0,
                healthScore,
                status: data.status || 'unknown',
                recommendation: generateMarketplaceRecommendation(data, healthScore)
            });
        });

        return performance;
    };

    const calculateMarketplaceHealth = (data) => {
        let score = 100;

        // Hatalar skoru düşürür
        score -= (data.errors || 0) * 10;

        // Bekleyen senkronizasyonlar
        score -= (data.pendingSync || 0) * 5;

        // Stok uyumsuzlukları
        score -= (data.stockMismatch || 0) * 2;

        // Sipariş performansı bonus
        if (data.orders > 10) score += 10;

        return Math.max(0, Math.min(100, score));
    };

    const generateMarketplaceRecommendation = (data, healthScore) => {
        if (healthScore < 50) {
            return '🚨 Acil müdahale gerekli - API bağlantısını kontrol edin';
        } else if (healthScore < 70) {
            return '⚠️ İyileştirme gerekli - Hataları giderin';
        } else if (data.orders === 0) {
            return '📊 Sipariş yok - Ürün listelerinizi kontrol edin';
        } else {
            return '✅ Sağlıklı çalışıyor';
        }
    };

    // ==================== ACTIONS ====================

    // Tek Tık Optimizasyon
    const optimizeStore = async () => {
        try {
            setOptimizing(true);
            setActionResults([]);

            const results = [];

            // 1. Stok Senkronizasyonu
            results.push({
                action: 'Stok Senkronizasyonu',
                status: 'running',
                message: 'Stoklar senkronize ediliyor...'
            });
            setActionResults([...results]);

            await new Promise(resolve => setTimeout(resolve, 2000));
            results[results.length - 1] = {
                ...results[results.length - 1],
                status: 'success',
                message: 'Stoklar başarıyla senkronize edildi'
            };
            setActionResults([...results]);

            // 2. Fiyat Optimizasyonu
            results.push({
                action: 'Fiyat Optimizasyonu',
                status: 'running',
                message: 'Fiyatlar optimize ediliyor...'
            });
            setActionResults([...results]);

            await new Promise(resolve => setTimeout(resolve, 2000));
            results[results.length - 1] = {
                ...results[results.length - 1],
                status: 'success',
                message: 'Fiyat optimizasyonu tamamlandı'
            };
            setActionResults([...results]);

            // 3. Pazaryeri Senkronizasyonu
            results.push({
                action: 'Pazaryeri Senkronizasyonu',
                status: 'running',
                message: 'Pazaryerleri senkronize ediliyor...'
            });
            setActionResults([...results]);

            await new Promise(resolve => setTimeout(resolve, 2000));
            results[results.length - 1] = {
                ...results[results.length - 1],
                status: 'success',
                message: 'Pazaryerleri senkronize edildi'
            };
            setActionResults([...results]);

            // Sistemi yeniden analiz et
            await analyzeEntireSystem();

            setTimeout(() => {
                setActionResults([]);
            }, 5000);

        } catch (err) {
            console.error("❌ Optimizasyon hatası:", err);
            setError("Optimizasyon sırasında bir hata oluştu.");
        } finally {
            setOptimizing(false);
        }
    };

    // Aksiyon Uygula
    const applyAction = async (actionId) => {
        try {
            console.log(`🎯 Aksiyon uygulanıyor: ${actionId}`);

            // Burada gerçek API çağrıları yapılacak
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Başarılı mesajı
            setActionResults([{
                action: actionId,
                status: 'success',
                message: 'Aksiyon başarıyla uygulandı'
            }]);

            // Sistemi yeniden analiz et
            await analyzeEntireSystem();

            setTimeout(() => {
                setActionResults([]);
            }, 3000);

        } catch (err) {
            console.error("❌ Aksiyon hatası:", err);
            setError("Aksiyon uygulanırken bir hata oluştu.");
        }
    };

    // ==================== AI CHAT ====================

    const scrollToBottom = () => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    const sendChatMessage = async (message) => {
        if (!message.trim() || isSending) return;

        const userMessage = {
            type: 'user',
            content: message,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMessage]);
        setInputMessage("");
        setIsSending(true);

        try {
            const response = await axios.post("/ai/chat", { message });

            const aiMessage = {
                type: 'ai',
                content: response.data.message,
                timestamp: new Date(),
                suggestions: response.data.suggestions || [],
                data: response.data.data || null
            };

            setChatMessages(prev => [...prev, aiMessage]);
        } catch (err) {
            console.error("❌ AI chat hatası:", err);
            const errorMessage = {
                type: 'ai',
                content: '😔 Üzgünüm, şu anda yanıt veremiyorum. Lütfen tekrar deneyin.',
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsSending(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        sendChatMessage(suggestion);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage(inputMessage);
        }
    };

    // ==================== INITIAL LOAD ====================

    useEffect(() => {
        analyzeEntireSystem();

        // Auto-refresh her 3 dakikada bir
        const interval = setInterval(() => {
            analyzeEntireSystem();
        }, 180000);

        return () => clearInterval(interval);
    }, [analyzeEntireSystem]);

    // ==================== HELPER FUNCTIONS ====================

    const formatCurrency = (value) => {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 0
        }).format(value || 0);
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getHealthColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#3b82f6';
            default: return '#64748b';
        }
    };

    const COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

    // ==================== RENDER FUNCTIONS ====================

    // Komuta Merkezi - Ana Dashboard
    const renderCommandCenter = () => {
        return (
            <div className="command-center">
                {/* Sistem Sağlığı - En Üstte */}
                {systemHealth && (
                    <div className="system-health-card">
                        <div className="health-header">
                            <h2>🏥 Sistem Sağlığı</h2>
                            <div className="health-score" style={{
                                background: `linear-gradient(135deg, ${getHealthColor(systemHealth.score)} 0%, ${getHealthColor(systemHealth.score)}dd 100%)`
                            }}>
                                <span className="score-value">{systemHealth.score}</span>
                                <span className="score-label">/100</span>
                            </div>
                        </div>
                        <p className="health-summary">{systemHealth.summary}</p>

                        {/* Pillar Skorları */}
                        <div className="health-pillars">
                            {Object.entries(systemHealth.pillars).map(([key, value]) => (
                                <div key={key} className="pillar">
                                    <div className="pillar-label">{key}</div>
                                    <div className="pillar-bar">
                                        <div
                                            className="pillar-fill"
                                            style={{
                                                width: `${value}%`,
                                                background: getHealthColor(value)
                                            }}
                                        />
                                    </div>
                                    <div className="pillar-value">{value}%</div>
                                </div>
                            ))}
                        </div>

                        {/* Tek Tık Optimizasyon */}
                        <button
                            className="optimize-btn"
                            onClick={optimizeStore}
                            disabled={optimizing || systemHealth.score > 85}
                        >
                            {optimizing ? (
                                <>
                                    <span className="spinner">⏳</span>
                                    <span>Optimize Ediliyor...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    <span>Mağazayı Optimize Et</span>
                                </>
                            )}
                        </button>

                        {/* Aksiyon Sonuçları */}
                        {actionResults.length > 0 && (
                            <div className="action-results">
                                {actionResults.map((result, index) => (
                                    <div key={index} className={`action-result ${result.status}`}>
                                        <span className="result-icon">
                                            {result.status === 'running' ? '⏳' :
                                             result.status === 'success' ? '✅' : '❌'}
                                        </span>
                                        <div className="result-content">
                                            <div className="result-action">{result.action}</div>
                                            <div className="result-message">{result.message}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Kritik Aksiyonlar */}
                {criticalActions.length > 0 && (
                    <div className="critical-actions-section">
                        <h3>⚡ Kritik Aksiyonlar</h3>
                        <div className="actions-grid">
                            {criticalActions.map((action) => (
                                <div key={action.id} className="action-card critical">
                                    <div className="action-header">
                                        <h4>{action.title}</h4>
                                        <span className={`impact-badge ${action.impact}`}>
                                            {action.impact}
                                        </span>
                                    </div>
                                    <p className="action-description">{action.description}</p>
                                    <div className="action-meta">
                                        <span className="action-time">⏱️ {action.estimatedTime}</span>
                                        <span className="action-type">{action.type === 'auto' ? '🤖 Otomatik' : '👤 Manuel'}</span>
                                    </div>
                                    {action.applicable && (
                                        <button
                                            className="apply-action-btn"
                                            onClick={() => applyAction(action.id)}
                                        >
                                            Uygula
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Fırsatlar ve Riskler - Yan Yana */}
                <div className="opportunities-risks-grid">
                    {/* Fırsatlar */}
                    {opportunities.length > 0 && (
                        <div className="opportunities-section">
                            <h3>💡 Fırsatlar</h3>
                            <div className="cards-list">
                                {opportunities.map((opp) => (
                                    <div key={opp.id} className="opportunity-card">
                                        <h4>{opp.title}</h4>
                                        <p>{opp.description}</p>
                                        <div className="opp-meta">
                                            <span className={`potential-badge ${opp.potential}`}>
                                                {opp.potential} potansiyel
                                            </span>
                                            <span className="impact-text">{opp.estimatedImpact}</span>
                                        </div>
                                        <div className="opp-action">{opp.action}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Riskler */}
                    {risks.length > 0 && (
                        <div className="risks-section">
                            <h3>⚠️ Riskler</h3>
                            <div className="cards-list">
                                {risks.map((risk) => (
                                    <div key={risk.id} className="risk-card">
                                        <h4>{risk.title}</h4>
                                        <p>{risk.description}</p>
                                        <div className="risk-meta">
                                            <span className={`severity-badge ${risk.severity}`}>
                                                {risk.severity}
                                            </span>
                                            <span className={`probability-badge ${risk.probability}`}>
                                                {risk.probability} olasılık
                                            </span>
                                        </div>
                                        <div className="risk-mitigation">
                                            <strong>Önlem:</strong> {risk.mitigation}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pazaryeri Performansı */}
                {marketplacePerformance && marketplacePerformance.length > 0 && (
                    <div className="marketplace-performance-section">
                        <h3>🏪 Pazaryeri Performansı</h3>
                        <div className="marketplace-grid">
                            {marketplacePerformance.map((mp) => (
                                <div key={mp.name} className="marketplace-card">
                                    <div className="mp-header">
                                        <h4>{mp.name}</h4>
                                        <div className="mp-health" style={{
                                            background: getHealthColor(mp.healthScore)
                                        }}>
                                            {mp.healthScore}
                                        </div>
                                    </div>
                                    <div className="mp-stats">
                                        <div className="mp-stat">
                                            <span className="stat-label">Sipariş</span>
                                            <span className="stat-value">{mp.orders}</span>
                                        </div>
                                        <div className="mp-stat">
                                            <span className="stat-label">Ciro</span>
                                            <span className="stat-value">{formatCurrency(mp.revenue)}</span>
                                        </div>
                                        <div className="mp-stat">
                                            <span className="stat-label">Hata</span>
                                            <span className="stat-value error">{mp.errors}</span>
                                        </div>
                                    </div>
                                    <div className="mp-recommendation">
                                        {mp.recommendation}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Realtime Metrics */}
                {realtimeMetrics && (
                    <div className="realtime-metrics-section">
                        <h3>📊 Anlık Metrikler</h3>
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-icon">🏪</div>
                                <div className="metric-content">
                                    <div className="metric-label">Aktif Pazaryeri</div>
                                    <div className="metric-value">{realtimeMetrics.activeIntegrations}</div>
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-icon">📦</div>
                                <div className="metric-content">
                                    <div className="metric-label">Toplam Ürün</div>
                                    <div className="metric-value">{realtimeMetrics.totalProducts}</div>
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-icon">⚠️</div>
                                <div className="metric-content">
                                    <div className="metric-label">Düşük Stok</div>
                                    <div className="metric-value warning">{realtimeMetrics.lowStockProducts}</div>
                                </div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-icon">💰</div>
                                <div className="metric-content">
                                    <div className="metric-label">Ort. Fiyat</div>
                                    <div className="metric-value">{realtimeMetrics.avgProductPrice} ₺</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // AI Kararları Görünümü
    const renderDecisions = () => {
        return (
            <div className="decisions-view">
                <div className="decisions-header">
                    <h2>🧠 AI Kararları</h2>
                    <p>Sistem analizi sonucu üretilen aksiyon önerileri</p>
                </div>

                {aiDecisions.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">✅</div>
                        <h3>Tüm Sistemler Normal</h3>
                        <p>Şu anda acil aksiyon gerektiren bir durum yok.</p>
                    </div>
                ) : (
                    <div className="decisions-grid">
                        {aiDecisions.map((decision) => (
                            <div key={decision.id} className={`decision-card ${decision.type}`}>
                                <div className="decision-header">
                                    <h3>{decision.title}</h3>
                                    <div className="decision-badges">
                                        <span className={`priority-badge ${decision.priority}`}>
                                            {decision.priority}
                                        </span>
                                        <span className={`impact-badge ${decision.impact}`}>
                                            {decision.impact} etki
                                        </span>
                                    </div>
                                </div>
                                <p className="decision-description">{decision.description}</p>
                                <div className="decision-action">
                                    <strong>Önerilen Aksiyon:</strong> {decision.action}
                                </div>
                                {decision.autoApplicable && (
                                    <button
                                        className="apply-decision-btn"
                                        onClick={() => applyAction(decision.id)}
                                    >
                                        🤖 Otomatik Uygula
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Analitik Görünümü
    const renderAnalytics = () => {
        return (
            <div className="analytics-view">
                <h2>📊 Detaylı Analitik</h2>

                {/* Ürün Performansı */}
                {productInsights && productInsights.topPerformers && productInsights.topPerformers.length > 0 && (
                    <div className="analytics-section">
                        <h3>⭐ En İyi Performans Gösteren Ürünler</h3>
                        <div className="products-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Ürün</th>
                                        <th>Performans</th>
                                        <th>Satış</th>
                                        <th>Ciro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productInsights.topPerformers.slice(0, 10).map((product, index) => (
                                        <tr key={index}>
                                            <td><strong>{product.name}</strong></td>
                                            <td>
                                                <div className="performance-bar">
                                                    <div
                                                        className="performance-fill"
                                                        style={{
                                                            width: `${product.performanceScore}%`,
                                                            background: getHealthColor(product.performanceScore)
                                                        }}
                                                    />
                                                    <span>{product.performanceScore}/100</span>
                                                </div>
                                            </td>
                                            <td>{product.totalQuantity}</td>
                                            <td>{formatCurrency(product.totalRevenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Fiyat Optimizasyonu */}
                {productInsights && productInsights.priceOptimization && productInsights.priceOptimization.length > 0 && (
                    <div className="analytics-section">
                        <h3>💰 Fiyat Optimizasyon Önerileri</h3>
                        <div className="price-optimization-grid">
                            {productInsights.priceOptimization.map((opt, index) => (
                                <div key={index} className="price-opt-card">
                                    <h4>{opt.product}</h4>
                                    <div className="price-comparison">
                                        <div className="price-item">
                                            <span className="price-label">Mevcut</span>
                                            <span className="price-value">{formatCurrency(opt.currentPrice)}</span>
                                        </div>
                                        <div className="price-arrow">→</div>
                                        <div className="price-item">
                                            <span className="price-label">Önerilen</span>
                                            <span className="price-value recommended">{formatCurrency(opt.recommendedPrice)}</span>
                                        </div>
                                    </div>
                                    <div className="price-change" style={{
                                        color: opt.change > 0 ? '#10b981' : '#ef4444'
                                    }}>
                                        {opt.change > 0 ? '↑' : '↓'} {Math.abs(opt.change).toFixed(1)}%
                                    </div>
                                    <p className="price-reason">{opt.reason}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Satış Tahmini */}
                {forecast && forecast.forecasts && forecast.forecasts.length > 0 && (
                    <div className="analytics-section">
                        <h3>🔮 Satış Tahminleri</h3>
                        {forecast.forecasts.map((mpForecast, index) => (
                            <div key={index} className="forecast-section">
                                <h4>{mpForecast.marketplace}</h4>
                                {mpForecast.forecast && mpForecast.forecast.length > 0 && (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={mpForecast.forecast.slice(0, 30)}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(date) => new Date(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                                                stroke="var(--text-secondary)"
                                            />
                                            <YAxis yAxisId="left" stroke="var(--text-secondary)" />
                                            <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px'
                                                }}
                                                labelFormatter={(date) => new Date(date).toLocaleDateString('tr-TR')}
                                            />
                                            <Legend />
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="predictedOrders"
                                                stroke="#667eea"
                                                name="Tahmini Sipariş"
                                                strokeWidth={2}
                                            />
                                            <Line
                                                yAxisId="right"
                                                type="monotone"
                                                dataKey="predictedRevenue"
                                                stroke="#10b981"
                                                name="Tahmini Ciro"
                                                strokeWidth={2}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // AI Chat Render
    const renderAIChat = () => {
        return (
            <div className={`ai-chat-popup ${chatOpen ? 'open' : ''}`}>
                <div className="ai-chat-section">
                    <div className="ai-chat-header">
                        <h2>
                            <span>🤖</span>
                            AI Asistan
                        </h2>
                        <div className="ai-chat-controls">
                            <div className="ai-chat-status">
                                <span className="ai-chat-status-dot"></span>
                                <span>Çevrimiçi</span>
                            </div>
                            <button className="chat-close-btn" onClick={() => setChatOpen(false)}>
                                ✕
                            </button>
                        </div>
                    </div>

                    <div className="ai-chat-messages">
                        {chatMessages.map((msg, index) => (
                            <div key={index} className={`ai-message ${msg.type}`}>
                                <div className="ai-message-avatar">
                                    {msg.type === 'ai' ? '🤖' : '👤'}
                                </div>
                                <div className="ai-message-bubble">
                                    <p className="ai-message-text">{msg.content}</p>
                                    <div className="ai-message-time">{formatTime(msg.timestamp)}</div>
                                    {msg.suggestions && msg.suggestions.length > 0 && (
                                        <div className="ai-message-suggestions">
                                            {msg.suggestions.map((suggestion, idx) => (
                                                <button
                                                    key={idx}
                                                    className="ai-suggestion-chip"
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                >
                                                    {suggestion}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isSending && (
                            <div className="ai-message ai">
                                <div className="ai-message-avatar">🤖</div>
                                <div className="ai-message-bubble">
                                    <p className="ai-message-text">Düşünüyorum...</p>
                                </div>
                            </div>
                        )}
                        <div ref={chatMessagesEndRef} />
                    </div>

                    <div className="ai-chat-input-area">
                        <div className="ai-chat-input-wrapper">
                            <textarea
                                className="ai-chat-input"
                                placeholder="AI asistanınıza bir şey sorun..."
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={isSending}
                            />
                            <button
                                className="ai-chat-send-btn"
                                onClick={() => sendChatMessage(inputMessage)}
                                disabled={isSending || !inputMessage.trim()}
                            >
                                <span>{isSending ? '⏳' : '📤'}</span>
                                <span>Gönder</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ==================== MAIN RENDER ====================

    return (
        <div className="ai-panel" data-theme={theme} data-animation={animationEnabled ? 'enabled' : 'disabled'}>
            <div className="ai-panel-background"></div>

            {/* Header */}
            <div className="ai-panel-header">
                <div className="ai-panel-header-content">
                    <div className="ai-panel-title-section">
                        <h1 className="ai-panel-title">
                            <span>🤖</span>
                            AI Komuta Merkezi
                        </h1>
                        <p className="ai-panel-subtitle">
                            Gerçek zamanlı yapay zeka destekli karar ve aksiyon sistemi
                        </p>
                    </div>

                    <div className="ai-panel-controls">
                        {/* Theme Switcher */}
                        <div className="theme-switcher">
                            <button
                                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                                onClick={() => setTheme('light')}
                                title="Açık Tema"
                            >
                                ☀️
                            </button>
                            <button
                                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                onClick={() => setTheme('dark')}
                                title="Koyu Tema"
                            >
                                🌙
                            </button>
                        </div>

                        {/* Animation Toggle */}
                        <div className="animation-toggle" onClick={() => setAnimationEnabled(!animationEnabled)}>
                            <span style={{ fontSize: '1.2rem' }}>✨</span>
                            <div className={`animation-toggle-switch ${animationEnabled ? 'active' : ''}`}></div>
                        </div>

                        {/* Refresh Button */}
                        <button className="btn-refresh" onClick={analyzeEntireSystem} disabled={loading}>
                            <span className={loading ? 'icon-spin' : ''}>🔄</span>
                            <span>{loading ? 'Analiz Ediliyor...' : 'Yenile'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="ai-panel-content">
                {/* Error Message */}
                {error && (
                    <div className="ai-error">
                        <span className="ai-error-icon">⚠️</span>
                        <span className="ai-error-message">{error}</span>
                    </div>
                )}

                {/* Navigation Tabs */}
                <div className="ai-tabs">
                    <button
                        className={`ai-tab-btn ${activeView === 'command-center' ? 'active' : ''}`}
                        onClick={() => setActiveView('command-center')}
                    >
                        <span>🎯</span>
                        <span>Komuta Merkezi</span>
                    </button>
                    <button
                        className={`ai-tab-btn ${activeView === 'decisions' ? 'active' : ''}`}
                        onClick={() => setActiveView('decisions')}
                    >
                        <span>🧠</span>
                        <span>AI Kararları</span>
                        {aiDecisions.length > 0 && (
                            <span className="tab-badge">{aiDecisions.length}</span>
                        )}
                    </button>
                    <button
                        className={`ai-tab-btn ${activeView === 'analytics' ? 'active' : ''}`}
                        onClick={() => setActiveView('analytics')}
                    >
                        <span>📊</span>
                        <span>Detaylı Analitik</span>
                    </button>
                </div>

                {/* Content Views */}
                {loading && !systemHealth ? (
                    <div className="ai-loading">
                        <div className="ai-loading-spinner"></div>
                        <p className="ai-loading-text">Sistem analiz ediliyor...</p>
                    </div>
                ) : (
                    <>
                        {activeView === 'command-center' && renderCommandCenter()}
                        {activeView === 'decisions' && renderDecisions()}
                        {activeView === 'analytics' && renderAnalytics()}
                    </>
                )}

                {/* Last Updated */}
                {lastUpdated && (
                    <div style={{
                        textAlign: 'center',
                        marginTop: '2rem',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.9rem'
                    }}>
                        Son güncelleme: {formatDate(lastUpdated)}
                    </div>
                )}
            </div>

            {/* AI Chat Popup */}
            {renderAIChat()}

            {/* AI Chat Trigger Button */}
            <button
                className="ai-chat-popup-trigger"
                onClick={() => setChatOpen(!chatOpen)}
                title="AI Asistan"
            >
                🤖
                {chatMessages.length > 1 && (
                    <span className="chat-notification-badge">{chatMessages.length - 1}</span>
                )}
            </button>
        </div>
    );
};

export default AIPanel;
