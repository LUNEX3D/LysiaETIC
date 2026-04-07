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
    Area
} from "recharts";
import "../styles/AIPanel.modern.css";

const AIPanel = () => {
    // Theme & Settings
    const [theme, setTheme] = useState(() => localStorage.getItem('ai-panel-theme') || 'dark');
    const [animationEnabled, setAnimationEnabled] = useState(() =>
        localStorage.getItem('ai-panel-animation') !== 'false'
    );

    // Data States
    const [aiData, setAiData] = useState(null);
    const [realtimeInsights, setRealtimeInsights] = useState(null);
    const [productAnalysis, setProductAnalysis] = useState(null);
    const [customerBehavior, setCustomerBehavior] = useState(null);
    const [salesForecast, setSalesForecast] = useState(null);
    const [anomalies, setAnomalies] = useState(null);
    const [performance, setPerformance] = useState(null);

    // UI States
    const [activeTab, setActiveTab] = useState("overview");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState(null);

    // Chat States
    const [chatMessages, setChatMessages] = useState([
        {
            type: 'ai',
            content: '👋 Merhaba! Ben sizin AI asistanınızım. Size nasıl yardımcı olabilirim?',
            timestamp: new Date(),
            suggestions: [
                'Ürünlerimi analiz et',
                'Pazaryeri durumum nasıl?',
                'Satış tahmini yap',
                'Stok durumunu kontrol et'
            ]
        }
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const chatMessagesEndRef = useRef(null);

    // Loading States
    const [loadingStates, setLoadingStates] = useState({
        main: false,
        realtime: false,
        products: false,
        customers: false,
        forecast: false,
        anomalies: false,
        performance: false
    });

    // Theme Management
    useEffect(() => {
        localStorage.setItem('ai-panel-theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('ai-panel-animation', animationEnabled);
    }, [animationEnabled]);

    // Auto-scroll chat
    const scrollToBottom = () => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    // Fetch Functions
    const fetchRealtimeInsights = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, realtime: true }));
            const response = await axios.get("/ai/realtime-insights");
            setRealtimeInsights(response.data);
        } catch (err) {
            console.error("❌ Gerçek zamanlı veriler alınamadı:", err);
        } finally {
            setLoadingStates(prev => ({ ...prev, realtime: false }));
        }
    }, []);

    const fetchAISuggestions = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, main: true }));
            setError("");
            const response = await axios.get("/ai/suggestions");
            if (response.data) {
                setAiData(response.data);
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.error("❌ AI önerileri alınırken hata:", err);
            setError("AI önerileri yüklenemedi. Lütfen tekrar deneyin.");
        } finally {
            setLoadingStates(prev => ({ ...prev, main: false }));
        }
    }, []);

    const fetchProductAnalysis = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, products: true }));
            const response = await axios.get("/ai/products");
            setProductAnalysis(response.data);
        } catch (err) {
            console.error("❌ Ürün analizi hatası:", err);
        } finally {
            setLoadingStates(prev => ({ ...prev, products: false }));
        }
    }, []);

    const fetchCustomerBehavior = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, customers: true }));
            const response = await axios.get("/ai/customer-behavior");
            setCustomerBehavior(response.data);
        } catch (err) {
            console.error("❌ Müşteri analizi hatası:", err);
        } finally {
            setLoadingStates(prev => ({ ...prev, customers: false }));
        }
    }, []);

    const fetchSalesForecast = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, forecast: true }));
            const response = await axios.get("/ai/forecast?days=30");
            setSalesForecast(response.data);
        } catch (err) {
            console.error("❌ Satış tahmini hatası:", err);
        } finally {
            setLoadingStates(prev => ({ ...prev, forecast: false }));
        }
    }, []);

    const fetchAnomalies = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, anomalies: true }));
            const response = await axios.get("/ai/anomalies");
            setAnomalies(response.data);
        } catch (err) {
            console.error("❌ Anomali tespiti hatası:", err);
        } finally {
            setLoadingStates(prev => ({ ...prev, anomalies: false }));
        }
    }, []);

    const fetchPerformance = useCallback(async () => {
        try {
            setLoadingStates(prev => ({ ...prev, performance: true }));
            const response = await axios.get("/ai/performance");
            setPerformance(response.data);
        } catch (err) {
            console.error("❌ Performance assistant hatası:", err);
        } finally {
            setLoadingStates(prev => ({ ...prev, performance: false }));
        }
    }, []);

    // Fetch All Data
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        await Promise.all([
            fetchRealtimeInsights(),
            fetchAISuggestions(),
            fetchProductAnalysis(),
            fetchCustomerBehavior(),
            fetchSalesForecast(),
            fetchAnomalies(),
            fetchPerformance()
        ]);
        setLoading(false);
    }, [
        fetchRealtimeInsights,
        fetchAISuggestions,
        fetchProductAnalysis,
        fetchCustomerBehavior,
        fetchSalesForecast,
        fetchAnomalies,
        fetchPerformance
    ]);

    // AI Chat
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
                suggestions: response.data.suggestions || []
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

    // Initial Load
    useEffect(() => {
        fetchAllData();

        // Auto-refresh every 5 minutes
        const interval = setInterval(() => {
            fetchRealtimeInsights();
        }, 300000);

        return () => clearInterval(interval);
    }, [fetchAllData, fetchRealtimeInsights]);

    // Helper Functions
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

    const COLORS = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

    // Render Functions
    const renderRealtimeStats = () => {
        if (!realtimeInsights) return null;

        return (
            <div className="realtime-stats-bar">
                <div className="realtime-stat">
                    <div className="realtime-stat-icon">🏪</div>
                    <div className="realtime-stat-content">
                        <div className="realtime-stat-label">Aktif Pazaryeri</div>
                        <div className="realtime-stat-value">{realtimeInsights.activeIntegrations}</div>
                    </div>
                </div>
                <div className="realtime-stat">
                    <div className="realtime-stat-icon">📦</div>
                    <div className="realtime-stat-content">
                        <div className="realtime-stat-label">Toplam Ürün</div>
                        <div className="realtime-stat-value">{realtimeInsights.totalProducts}</div>
                    </div>
                </div>
                <div className="realtime-stat">
                    <div className="realtime-stat-icon">⚠️</div>
                    <div className="realtime-stat-content">
                        <div className="realtime-stat-label">Düşük Stok</div>
                        <div className="realtime-stat-value">{realtimeInsights.lowStockProducts}</div>
                        <div className={`realtime-stat-change ${realtimeInsights.lowStockProducts > 5 ? 'negative' : 'positive'}`}>
                            {realtimeInsights.lowStockProducts > 5 ? '⚠️ Dikkat' : '✅ İyi'}
                        </div>
                    </div>
                </div>
                <div className="realtime-stat">
                    <div className="realtime-stat-icon">💰</div>
                    <div className="realtime-stat-content">
                        <div className="realtime-stat-label">Ort. Fiyat</div>
                        <div className="realtime-stat-value">{realtimeInsights.avgProductPrice} ₺</div>
                    </div>
                </div>
            </div>
        );
    };

    const renderQuickActions = () => {
        if (!realtimeInsights?.quickActions) return null;

        return (
            <div className="quick-actions-grid">
                {realtimeInsights.quickActions.map((action, index) => (
                    <div key={index} className="quick-action-card">
                        <div className="quick-action-header">
                            <span className="quick-action-icon">{action.icon}</span>
                            <span className={`quick-action-badge ${action.severity}`}>
                                {action.count}
                            </span>
                        </div>
                        <h3 className="quick-action-title">{action.title}</h3>
                        <p className="quick-action-description">{action.action}</p>
                    </div>
                ))}
            </div>
        );
    };

    const renderAIChat = () => {
        return (
            <div className="ai-chat-section">
                <div className="ai-chat-header">
                    <h2>
                        <span>🤖</span>
                        AI Asistan
                    </h2>
                    <div className="ai-chat-status">
                        <span className="ai-chat-status-dot"></span>
                        <span>Çevrimiçi</span>
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
        );
    };

    const renderOverviewTab = () => {
        return (
            <div className="ai-tab-content">
                {/* AI Recommendations */}
                {aiData?.recommendations && aiData.recommendations.length > 0 && (
                    <div className="ai-cards-grid">
                        {aiData.recommendations.map((rec, index) => (
                            <div key={index} className="ai-card">
                                <div className="ai-card-header">
                                    <h3 className="ai-card-title">{rec.title}</h3>
                                    <span className={`ai-card-badge ${rec.priority}`}>
                                        {rec.priority}
                                    </span>
                                </div>
                                <p className="ai-card-content">{rec.description}</p>
                                {rec.action && (
                                    <div className="ai-card-action">
                                        <strong>Aksiyon:</strong> {rec.action}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Marketplace Analysis */}
                {aiData?.marketplaces && aiData.marketplaces.length > 0 && (
                    <div className="ai-table-container">
                        <table className="ai-table">
                            <thead>
                                <tr>
                                    <th>Pazaryeri</th>
                                    <th>Durum</th>
                                    <th>Sipariş</th>
                                    <th>Ciro</th>
                                    <th>Trend</th>
                                    <th>Güven</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aiData.marketplaces.map((mp, index) => (
                                    <tr key={index}>
                                        <td><strong>{mp.name}</strong></td>
                                        <td>
                                            <span className={`ai-card-badge ${mp.status === 'analyzed' ? 'low' : 'medium'}`}>
                                                {mp.status}
                                            </span>
                                        </td>
                                        <td>{mp.orderCount || 0}</td>
                                        <td>{formatCurrency(mp.totalRevenue)}</td>
                                        <td>
                                            <span className={`ai-card-badge ${
                                                mp.forecast?.trend === 'increasing' ? 'low' :
                                                mp.forecast?.trend === 'decreasing' ? 'high' :
                                                'medium'
                                            }`}>
                                                {mp.forecast?.trend || 'N/A'}
                                            </span>
                                        </td>
                                        <td>{mp.forecast?.confidence ? `${(mp.forecast.confidence * 100).toFixed(0)}%` : 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderProductsTab = () => {
        if (loadingStates.products) {
            return (
                <div className="ai-loading">
                    <div className="ai-loading-spinner"></div>
                    <p className="ai-loading-text">Ürün analizi yapılıyor...</p>
                </div>
            );
        }

        if (!productAnalysis) {
            return (
                <div className="ai-empty-state">
                    <div className="ai-empty-state-icon">📦</div>
                    <h3 className="ai-empty-state-title">Ürün Verisi Bulunamadı</h3>
                    <p className="ai-empty-state-description">Analiz için yeterli ürün verisi yok.</p>
                </div>
            );
        }

        return (
            <div className="ai-tab-content">
                {/* Top Performers */}
                {productAnalysis.topPerformers && productAnalysis.topPerformers.length > 0 && (
                    <div className="ai-table-container">
                        <div className="ai-chart-header">
                            <h3 className="ai-chart-title">⭐ En İyi Performans Gösteren Ürünler</h3>
                        </div>
                        <table className="ai-table">
                            <thead>
                                <tr>
                                    <th>Ürün</th>
                                    <th>Barkod</th>
                                    <th>Performans</th>
                                    <th>Satış</th>
                                    <th>Ciro</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productAnalysis.topPerformers.slice(0, 10).map((product, index) => (
                                    <tr key={index}>
                                        <td><strong>{product.name}</strong></td>
                                        <td>{product.barcode || 'N/A'}</td>
                                        <td>{product.performanceScore}/100</td>
                                        <td>{product.totalQuantity}</td>
                                        <td>{formatCurrency(product.totalRevenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Price Optimization */}
                {productAnalysis.priceOptimization && productAnalysis.priceOptimization.length > 0 && (
                    <div className="ai-cards-grid">
                        {productAnalysis.priceOptimization.map((opt, index) => (
                            <div key={index} className="ai-card">
                                <h4 className="ai-card-title">{opt.product}</h4>
                                <p className="ai-card-content">
                                    Mevcut: {formatCurrency(opt.currentPrice)} →
                                    Önerilen: {formatCurrency(opt.recommendedPrice)}
                                </p>
                                <div className="ai-card-action">
                                    <strong>Değişim:</strong> {opt.change > 0 ? '↑' : '↓'} {Math.abs(opt.change).toFixed(1)}%
                                </div>
                                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    {opt.reason}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderCustomersTab = () => {
        if (loadingStates.customers) {
            return (
                <div className="ai-loading">
                    <div className="ai-loading-spinner"></div>
                    <p className="ai-loading-text">Müşteri davranışı analiz ediliyor...</p>
                </div>
            );
        }

        if (!customerBehavior) {
            return (
                <div className="ai-empty-state">
                    <div className="ai-empty-state-icon">👥</div>
                    <h3 className="ai-empty-state-title">Müşteri Verisi Bulunamadı</h3>
                    <p className="ai-empty-state-description">Analiz için yeterli müşteri verisi yok.</p>
                </div>
            );
        }

        return (
            <div className="ai-tab-content">
                {/* Hourly Distribution Chart */}
                {customerBehavior.hourlyDistribution && (
                    <div className="ai-chart-container">
                        <h3 className="ai-chart-title">📊 Saatlik Sipariş Dağılımı</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={customerBehavior.hourlyDistribution.map((count, hour) => ({
                                hour: `${hour}:00`,
                                orders: count
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="hour" stroke="var(--text-secondary)" />
                                <YAxis stroke="var(--text-secondary)" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar dataKey="orders" fill="#667eea" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Weekday Distribution */}
                {customerBehavior.weekdayDistribution && (
                    <div className="ai-chart-container">
                        <h3 className="ai-chart-title">📅 Haftalık Sipariş Dağılımı</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, index) => ({
                                day,
                                orders: customerBehavior.weekdayDistribution[index]
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="day" stroke="var(--text-secondary)" />
                                <YAxis stroke="var(--text-secondary)" />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar dataKey="orders" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    };

    const renderForecastTab = () => {
        if (loadingStates.forecast) {
            return (
                <div className="ai-loading">
                    <div className="ai-loading-spinner"></div>
                    <p className="ai-loading-text">Satış tahmini hesaplanıyor...</p>
                </div>
            );
        }

        if (!salesForecast?.forecasts || salesForecast.forecasts.length === 0) {
            return (
                <div className="ai-empty-state">
                    <div className="ai-empty-state-icon">🔮</div>
                    <h3 className="ai-empty-state-title">Tahmin Verisi Bulunamadı</h3>
                    <p className="ai-empty-state-description">Tahmin için yeterli veri yok (minimum 7 gün gerekli).</p>
                </div>
            );
        }

        return (
            <div className="ai-tab-content">
                {salesForecast.forecasts.map((forecast, index) => (
                    <div key={index} className="ai-chart-container">
                        <h3 className="ai-chart-title">📊 {forecast.marketplace} - 30 Günlük Tahmin</h3>
                        {forecast.forecast && forecast.forecast.length > 0 && (
                            <ResponsiveContainer width="100%" height={350}>
                                <LineChart data={forecast.forecast.slice(0, 30)}>
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
        );
    };

    const renderAnomaliesTab = () => {
        if (loadingStates.anomalies) {
            return (
                <div className="ai-loading">
                    <div className="ai-loading-spinner"></div>
                    <p className="ai-loading-text">Anomaliler tespit ediliyor...</p>
                </div>
            );
        }

        if (!anomalies?.anomalies || anomalies.anomalies.length === 0) {
            return (
                <div className="ai-empty-state">
                    <div className="ai-empty-state-icon">✅</div>
                    <h3 className="ai-empty-state-title">Anomali Tespit Edilmedi</h3>
                    <p className="ai-empty-state-description">Tüm veriler normal aralıkta görünüyor.</p>
                </div>
            );
        }

        return (
            <div className="ai-tab-content">
                {anomalies.anomalies.map((marketplaceAnomaly, index) => (
                    <div key={index} className="ai-chart-container">
                        <h3 className="ai-chart-title">🏪 {marketplaceAnomaly.marketplace}</h3>
                        {marketplaceAnomaly.anomalies && marketplaceAnomaly.anomalies.length > 0 && (
                            <div className="ai-cards-grid">
                                {marketplaceAnomaly.anomalies.map((anomaly, idx) => (
                                    <div key={idx} className="ai-card">
                                        <div className="ai-card-header">
                                            <h4 className="ai-card-title">
                                                {anomaly.type === 'revenue' ? '💰 Ciro' : '📦 Sipariş'} Anomalisi
                                            </h4>
                                            <span className={`ai-card-badge ${anomaly.severity === 'high' ? 'high' : 'medium'}`}>
                                                {anomaly.severity}
                                            </span>
                                        </div>
                                        <p className="ai-card-content">
                                            <strong>Tarih:</strong> {anomaly.date}<br />
                                            <strong>Gerçekleşen:</strong> {anomaly.type === 'revenue' ? formatCurrency(anomaly.value) : anomaly.value}<br />
                                            <strong>Beklenen:</strong> {anomaly.type === 'revenue' ? formatCurrency(anomaly.expected) : Math.round(anomaly.expected)}<br />
                                            <strong>Sapma:</strong> {anomaly.deviation.toFixed(2)}σ
                                        </p>
                                        <div className="ai-card-action">
                                            <strong>{anomaly.direction === 'spike' ? '📈 Ani Artış' : '📉 Ani Düşüş'}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    // Main Render
    return (
        <div className="ai-panel" data-theme={theme} data-animation={animationEnabled ? 'enabled' : 'disabled'}>
            <div className="ai-panel-background"></div>

            {/* Header */}
            <div className="ai-panel-header">
                <div className="ai-panel-header-content">
                    <div className="ai-panel-title-section">
                        <h1 className="ai-panel-title">
                            <span>🤖</span>
                            AI Asistan Paneli
                        </h1>
                        <p className="ai-panel-subtitle">
                            Gerçek zamanlı yapay zeka destekli analizler ve öneriler
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
                        <button className="btn-refresh" onClick={fetchAllData} disabled={loading}>
                            <span className={loading ? 'icon-spin' : ''}>🔄</span>
                            <span>{loading ? 'Yükleniyor...' : 'Yenile'}</span>
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

                {/* Realtime Stats */}
                {renderRealtimeStats()}

                {/* Quick Actions */}
                {renderQuickActions()}

                {/* AI Chat */}
                {renderAIChat()}

                {/* Tabs */}
                <div className="ai-tabs">
                    <button
                        className={`ai-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <span>📊</span>
                        <span>Genel Bakış</span>
                    </button>
                    <button
                        className={`ai-tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                        onClick={() => setActiveTab('products')}
                    >
                        <span>📦</span>
                        <span>Ürün Analizi</span>
                    </button>
                    <button
                        className={`ai-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('customers')}
                    >
                        <span>👥</span>
                        <span>Müşteri Davranışı</span>
                    </button>
                    <button
                        className={`ai-tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
                        onClick={() => setActiveTab('forecast')}
                    >
                        <span>🔮</span>
                        <span>Satış Tahmini</span>
                    </button>
                    <button
                        className={`ai-tab-btn ${activeTab === 'anomalies' ? 'active' : ''}`}
                        onClick={() => setActiveTab('anomalies')}
                    >
                        <span>🔍</span>
                        <span>Anomali Tespiti</span>
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'products' && renderProductsTab()}
                {activeTab === 'customers' && renderCustomersTab()}
                {activeTab === 'forecast' && renderForecastTab()}
                {activeTab === 'anomalies' && renderAnomaliesTab()}

                {/* Last Updated */}
                {lastUpdated && (
                    <div style={{
                        textAlign: 'center',
                        marginTop: '2rem',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.9rem'
                    }}>
                        Son güncelleme: {lastUpdated.toLocaleString('tr-TR')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIPanel;
