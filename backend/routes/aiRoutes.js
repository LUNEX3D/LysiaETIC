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

const router = express.Router();

// ==================== AI DECISION & AUTOMATION SYSTEM ====================

// 🧠 AI Decision Engine - Ana Karar Motoru
router.get("/decisions", authMiddleware, getAIDecisions);

// ⚡ Action Executor - Manuel Aksiyon Uygulama
router.post("/execute-action", authMiddleware, executeAction);

// 🚀 Auto Optimizer - Tek Tık Otomatik Optimizasyon
router.post("/auto-optimize", authMiddleware, autoOptimize);

// 📊 Action Statistics - Aksiyon İstatistikleri
router.get("/action-stats", authMiddleware, getActionStats);

// ==================== LEGACY AI ENDPOINTS ====================

// ✅ Gelişmiş AI Önerileri (Comprehensive Analysis)
router.get("/suggestions", authMiddleware, getAISuggestions);

// ✅ Satış & Performans Asistanı
router.get("/performance", authMiddleware, getPerformanceAssistant);

// 🆕 AI Chat Assistant
router.post("/chat", authMiddleware, aiChat);

// 🆕 Ürün Performans Analizi ve Fiyat Optimizasyonu
router.get("/products", authMiddleware, getProductAnalysis);

// 🆕 Müşteri Davranış Analizi
router.get("/customer-behavior", authMiddleware, getCustomerBehavior);

// 🆕 Satış Tahmini (Forecasting)
router.get("/forecast", authMiddleware, getSalesForecast);

// 🆕 Anomali Tespiti
router.get("/anomalies", authMiddleware, getAnomalies);

// ⚡ Gerçek Zamanlı İçgörüler
router.get("/realtime-insights", authMiddleware, getRealtimeInsights);

// 🚀 Tek Tık Optimizasyon (Legacy)
router.post("/optimize", authMiddleware, optimizeStore);

module.exports = router;
