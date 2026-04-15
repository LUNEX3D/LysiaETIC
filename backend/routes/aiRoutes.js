const express = require("express");
const {
    getAISuggestions,
    getPerformanceAssistant,
    getProductAnalysis,
    getCustomerBehavior,
    getSalesForecast,
    getAnomalies,
    aiChat,
    getRealtimeInsights,
    optimizeStore,
    getAIDecisions,
    executeAction,
    autoOptimize,
    getActionStats
} = require("../controllers/aiController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require("../middlewares/subscriptionMiddleware");

const router = express.Router();

// ✅ FIX: subscriptionMiddleware eklendi — aboneliği biten kullanıcılar AI özelliklerine erişemez
router.use(authMiddleware, subscriptionMiddleware);

// ==================== AI DECISION & AUTOMATION SYSTEM ====================

// 🧠 AI Decision Engine - Ana Karar Motoru
router.get("/decisions", getAIDecisions);

// ⚡ Action Executor - Manuel Aksiyon Uygulama
router.post("/execute-action", executeAction);

// 🚀 Auto Optimizer - Tek Tık Otomatik Optimizasyon
router.post("/auto-optimize", autoOptimize);

// 📊 Action Statistics - Aksiyon İstatistikleri
router.get("/action-stats", getActionStats);

// ==================== LEGACY AI ENDPOINTS ====================

// ✅ Gelişmiş AI Önerileri (Comprehensive Analysis)
router.get("/suggestions", getAISuggestions);

// ✅ Satış & Performans Asistanı
router.get("/performance", getPerformanceAssistant);

// 🆕 AI Chat Assistant
router.post("/chat", aiChat);

// 🆕 Ürün Performans Analizi ve Fiyat Optimizasyonu
router.get("/products", getProductAnalysis);

// 🆕 Müşteri Davranış Analizi
router.get("/customer-behavior", getCustomerBehavior);

// 🆕 Satış Tahmini (Forecasting)
router.get("/forecast", getSalesForecast);

// 🆕 Anomali Tespiti
router.get("/anomalies", getAnomalies);

// ⚡ Gerçek Zamanlı İçgörüler
router.get("/realtime-insights", getRealtimeInsights);

// 🚀 Tek Tık Optimizasyon (Legacy)
router.post("/optimize", optimizeStore);

module.exports = router;
