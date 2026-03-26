# 🤖 LysiaETIC Advanced AI Module

Gelişmiş E-Ticaret Analitik ve Yapay Zeka Modülü

## 📋 İçindekiler

- [Özellikler](#özellikler)
- [Kurulum](#kurulum)
- [API Endpoints](#api-endpoints)
- [Kullanım Örnekleri](#kullanım-örnekleri)
- [AI Özellikleri](#ai-özellikleri)
- [Teknik Detaylar](#teknik-detaylar)

---

## 🎯 Özellikler

### JavaScript AI Service (advancedAIService.js)

#### 1. **Predictive Analytics (Tahmin Analitiği)**
- Linear Regression ile satış tahmini
- 30 güne kadar gelecek projeksiyonu
- Güven skoru hesaplama (R² değeri)
- Trend analizi (artış/azalış/stabil)

#### 2. **Anomaly Detection (Anomali Tespiti)**
- İstatistiksel analiz ile anormal durumlar
- Z-score hesaplama
- Ciro ve sipariş anomalileri
- Otomatik severity belirleme (high/medium)

#### 3. **Product Performance Analysis (Ürün Performans Analizi)**
- Performans skoru (0-100)
- En çok satan ürünler
- Düşük performanslı ürünler
- Kategorizasyon (star/average/underperforming)

#### 4. **Dynamic Price Optimization (Dinamik Fiyat Optimizasyonu)**
- Talep elastikiyeti analizi
- Fiyat varyans kontrolü
- ±15% güvenli fiyat aralığı
- Otomatik fiyat önerileri

#### 5. **Customer Behavior Analysis (Müşteri Davranış Analizi)**
- Saatlik sipariş dağılımı
- Haftalık trend analizi
- Tekrar eden müşteri oranı
- Ortalama sepet değeri
- Percentile analizleri (P25, P50, P75, P90)

#### 6. **Seasonality Detection (Mevsimsellik Tespiti)**
- Exponential smoothing
- Trend değişim analizi
- Mevsimsel pattern tespiti
- Otomatik öneriler

#### 7. **Smart Recommendations Engine (Akıllı Öneri Motoru)**
- Öncelik bazlı öneriler (high/medium/low)
- Aksiyon önerileri
- Güven skorları
- Çoklu pazaryeri desteği

### Python AI Model (advancedModel.py)

#### 1. **Price Prediction (Fiyat Tahmini)**
- Linear regression
- Talep trend analizi
- Rakip fiyat karşılaştırma
- Volatilite hesaplama

#### 2. **Demand Forecasting (Talep Tahmini)**
- Gelecek satış tahmini
- Trend belirleme
- Ortalama ve medyan hesaplama

#### 3. **Stock Optimization (Stok Optimizasyonu)**
- Reorder point hesaplama
- Safety stock belirleme
- Economic Order Quantity (EOQ)
- Stok tükenme tahmini

#### 4. **Seasonality Detection (Mevsimsellik)**
- Moving average
- Varyasyon analizi
- Pattern tespiti

#### 5. **Customer Segmentation (Müşteri Segmentasyonu)**
- RFM benzeri segmentasyon
- Champions, Loyal, Big Spenders, At-Risk
- Segment bazlı öneriler

---

## 🚀 Kurulum

### Gereksinimler

**JavaScript:**
```bash
# Node.js dependencies (zaten yüklü)
- axios
- moment
- lodash
```

**Python:**
```bash
pip install numpy
```

### Kullanıma Hazırlama

1. **JavaScript AI Service:**
```javascript
const AIService = require('./ai/advancedAIService');
```

2. **Python AI Model:**
```bash
cd ai
python advancedModel.py
```

---

## 🔌 API Endpoints

### 1. Gelişmiş AI Önerileri
```http
POST /api/ai/suggestions
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "user_id_here"
}
```

**Response:**
```json
{
  "summary": {
    "total": 3,
    "active": 2,
    "incomplete": 1,
    "analyzedOrders": 450,
    "totalRevenue": 125000
  },
  "marketplaces": [
    {
      "name": "Trendyol",
      "status": "analyzed",
      "orderCount": 300,
      "totalRevenue": 85000,
      "forecast": {
        "next7Days": [...],
        "confidence": 0.85,
        "trend": "increasing"
      },
      "anomalies": [...],
      "productPerformance": {...},
      "customerBehavior": {...},
      "recommendations": [...]
    }
  ],
  "recommendations": [
    {
      "type": "forecast",
      "priority": "high",
      "title": "📊 7 Günlük Satış Tahmini",
      "description": "Önümüzdeki hafta 45 sipariş ve 12,500 TRY ciro bekleniyor.",
      "confidence": 85,
      "trend": "increasing",
      "action": "Stok seviyelerinizi artırın"
    }
  ],
  "insights": {
    "totalOrders": 450,
    "totalRevenue": "125.000,00 TRY",
    "avgRevenuePerOrder": "277,78 TRY",
    "activeMarketplaces": 2,
    "analysisQuality": "high"
  }
}
```

### 2. Ürün Performans Analizi
```http
GET /api/ai/products/{userId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "summary": {
    "totalProducts": 150,
    "topPerformers": 10,
    "underperformers": 25,
    "analyzedOrders": 450
  },
  "topPerformers": [
    {
      "name": "Ürün A",
      "barcode": "1234567890",
      "totalQuantity": 250,
      "totalRevenue": 25000,
      "performanceScore": 95,
      "category": "star",
      "avgPrice": 100,
      "daysSinceLastOrder": 1
    }
  ],
  "priceOptimization": [
    {
      "product": "Ürün A",
      "currentPrice": 100,
      "recommendedPrice": 105,
      "change": 5,
      "changeAmount": 5,
      "reason": "Yüksek talep - fiyat artırımı öneriliyor",
      "confidence": "high"
    }
  ]
}
```

### 3. Müşteri Davranış Analizi
```http
GET /api/ai/customer-behavior/{userId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "peakHour": "14:00",
  "peakDay": "Cuma",
  "repeatCustomerRate": 35.5,
  "avgOrderValue": 278.50,
  "medianOrderValue": 250.00,
  "orderValuePercentiles": {
    "p25": 150,
    "p50": 250,
    "p75": 400,
    "p90": 600
  },
  "hourlyDistribution": [0, 0, 1, 2, 5, 8, 12, ...],
  "weekdayDistribution": [10, 25, 30, 35, 40, 50, 20],
  "totalOrders": 450
}
```

### 4. Satış Tahmini
```http
GET /api/ai/forecast/{userId}?days=30
Authorization: Bearer {token}
```

**Response:**
```json
{
  "forecasts": [
    {
      "marketplace": "Trendyol",
      "forecast": [
        {
          "date": "2025-02-01",
          "predictedOrders": 15,
          "predictedRevenue": 4200,
          "confidence": 0.85
        }
      ],
      "confidence": 0.85,
      "trend": "increasing",
      "historicalAverage": {
        "dailyOrders": 12,
        "dailyRevenue": 3500
      }
    }
  ]
}
```

### 5. Anomali Tespiti
```http
GET /api/ai/anomalies/{userId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "anomalies": [
    {
      "marketplace": "Trendyol",
      "anomalies": [
        {
          "date": "2025-01-15",
          "type": "revenue",
          "value": 15000,
          "expected": 3500,
          "deviation": 3.2,
          "severity": "high",
          "direction": "spike"
        }
      ],
      "statistics": {
        "revenue": {
          "mean": 3500,
          "stdDev": 850
        },
        "orders": {
          "mean": 12,
          "stdDev": 3
        }
      }
    }
  ],
  "totalAnomalies": 5
}
```

### 6. Performans Asistanı
```http
GET /api/ai/performance
Authorization: Bearer {token}
```

---

## 💡 Kullanım Örnekleri

### JavaScript Örneği

```javascript
const AIService = require('./ai/advancedAIService');

// Pazaryeri analizi
const integrations = await Marketplace.find({ userId });
const analysis = await AIService.analyzeMarketplaces(integrations);

console.log('Toplam Sipariş:', analysis.summary.analyzedOrders);
console.log('Öneriler:', analysis.recommendations);

// Ürün performans analizi
const orders = await fetchOrders();
const productPerformance = AIService.analyzeProductPerformance(orders);

console.log('En İyi Ürün:', productPerformance.topPerformers[0]);

// Fiyat optimizasyonu
const product = productPerformance.topPerformers[0];
const priceOptimization = AIService.optimizePrice(product);

console.log('Önerilen Fiyat:', priceOptimization.recommendedPrice);

// Satış tahmini
const forecast = AIService.forecastSales(orders, 30);
console.log('30 Günlük Tahmin:', forecast.forecast);

// Anomali tespiti
const anomalies = AIService.detectAnomalies(orders);
console.log('Tespit Edilen Anomaliler:', anomalies.anomalies.length);

// Müşteri davranışı
const behavior = AIService.analyzeCustomerBehavior(orders);
console.log('En Yoğun Saat:', behavior.peakHour);
console.log('Tekrar Eden Müşteri:', behavior.repeatCustomerRate + '%');
```

### Python Örneği

```python
from advancedModel import EcommerceAIModel

model = EcommerceAIModel()

# Fiyat tahmini
historical_prices = [100, 105, 103, 108, 110, 107, 112, 115]
price_result = model.predict_price(
    historical_prices,
    demand_trend="increasing"
)
print(f"Önerilen Fiyat: {price_result['recommended_price']} TRY")

# Talep tahmini
historical_sales = [10, 12, 15, 13, 18, 20, 22, 19, 25, 28]
demand_result = model.forecast_demand(historical_sales, forecast_days=7)
print(f"7 Günlük Tahmin: {demand_result['total_forecast']} adet")

# Stok optimizasyonu
stock_result = model.optimize_stock(
    current_stock=50,
    daily_sales_forecast=8.5,
    lead_time_days=7
)
print(f"Sipariş Miktarı: {stock_result['order_quantity']}")

# Mevsimsellik tespiti
sales_data = [10, 12, 15, 20, 25, 30, 28, 15, 12, 10]
seasonality = model.detect_seasonality(sales_data)
print(f"Mevsimsellik: {seasonality['has_seasonality']}")

# Müşteri segmentasyonu
order_values = [500, 1200, 300, 2000, 450]
order_frequencies = [5, 12, 3, 8, 4]
segments = model.segment_customers(order_values, order_frequencies)
print(f"Champions: {segments['segments']['champions']['percent']}%")
```

---

## 🧠 AI Özellikleri Detayları

### 1. Linear Regression (Doğrusal Regresyon)

**Formül:**
```
y = mx + b
```

**Kullanım Alanları:**
- Satış tahmini
- Fiyat trend analizi
- Talep projeksiyonu

**R² (Coefficient of Determination):**
- 0.0 - 0.3: Düşük güven
- 0.3 - 0.7: Orta güven
- 0.7 - 1.0: Yüksek güven

### 2. Z-Score (Standart Sapma)

**Formül:**
```
z = (x - μ) / σ
```

**Anomali Eşikleri:**
- |z| > 2.5: Anomali
- |z| > 3.0: Yüksek şiddetli anomali

### 3. Exponential Smoothing

**Formül:**
```
S_t = α * Y_t + (1 - α) * S_{t-1}
```

**Alpha (α) Değeri:**
- 0.3: Varsayılan (dengeli)
- Düşük α: Daha yumuşak
- Yüksek α: Daha reaktif

### 4. Performance Score

**Hesaplama:**
```
Score = (Revenue * 0.4) + (Velocity * 0.3) + (Recency * 0.3)
```

**Kategoriler:**
- 70-100: Star (Yıldız)
- 40-69: Average (Ortalama)
- 0-39: Underperforming (Düşük)

---

## 📊 Teknik Detaylar

### Veri Gereksinimleri

| Analiz Türü | Minimum Veri | Önerilen Veri |
|-------------|--------------|---------------|
| Satış Tahmini | 7 gün | 30+ gün |
| Anomali Tespiti | 7 gün | 30+ gün |
| Ürün Performansı | 5 sipariş | 50+ sipariş |
| Müşteri Davranışı | 10 sipariş | 100+ sipariş |
| Mevsimsellik | 30 gün | 90+ gün |

### Performans Optimizasyonu

**Cache Mekanizması:**
- TTL: 5 dakika
- Key-based caching
- Otomatik temizleme

**Retry Mekanizması:**
- Maksimum 3 deneme
- 5 saniye delay
- Exponential backoff

### Güvenlik

- JWT authentication
- User-based data isolation
- Rate limiting ready
- Input validation

---

## 🎓 Algoritma Açıklamaları

### Satış Tahmini Algoritması

1. **Veri Toplama**: Son 90 günlük sipariş verisi
2. **Günlük Gruplama**: Siparişleri günlere göre grupla
3. **Regresyon Analizi**: Linear regression uygula
4. **Tahmin Üretimi**: Gelecek günler için projeksiyon
5. **Güven Hesaplama**: R² değeri ile güven skoru

### Anomali Tespit Algoritması

1. **İstatistik Hesaplama**: Mean ve StdDev hesapla
2. **Z-Score Hesaplama**: Her veri noktası için z-score
3. **Eşik Kontrolü**: |z| > 2.5 ise anomali
4. **Severity Belirleme**: z > 3 ise high, değilse medium
5. **Yön Tespiti**: Spike veya drop

### Fiyat Optimizasyon Algoritması

1. **Mevcut Analiz**: Ortalama, medyan, varyans
2. **Talep Analizi**: Son 7 gün vs genel ortalama
3. **Fiyat Önerisi**: Talep ve varyansa göre ayarlama
4. **Güvenlik Limiti**: ±15% aralığında tut
5. **Rakip Kontrolü**: Varsa rakip fiyatlarını dikkate al

---

## 📈 Metrikler ve KPI'lar

### Hesaplanan Metrikler

- **Total Revenue**: Toplam ciro
- **Average Order Value (AOV)**: Ortalama sepet değeri
- **Repeat Customer Rate**: Tekrar eden müşteri oranı
- **Performance Score**: Ürün performans skoru (0-100)
- **Confidence Score**: Tahmin güven skoru (0-1)
- **Cancel Rate**: İptal/iade oranı
- **Stock Turnover**: Stok devir hızı

### Trend Göstergeleri

- **Increasing**: Artış trendi (slope > 0.5)
- **Stable**: Stabil trend (-0.5 < slope < 0.5)
- **Decreasing**: Azalış trendi (slope < -0.5)

---

## 🔧 Yapılandırma

### AI Config (advancedAIService.js)

```javascript
this.config = {
    forecastDays: 30,              // Tahmin günü
    minDataPoints: 7,              // Minimum veri noktası
    anomalyThreshold: 2.5,         // Anomali eşiği (σ)
    priceOptimizationRange: 0.15,  // Fiyat değişim limiti (±15%)
    lowStockThreshold: 10,         // Düşük stok eşiği
    highCancelRateThreshold: 0.15, // Yüksek iptal oranı (15%)
    seasonalityWindow: 90,         // Mevsimsellik penceresi (gün)
    trendWindow: 30                // Trend penceresi (gün)
};
```

---

## 🚦 Durum Kodları

| Kod | Durum | Açıklama |
|-----|-------|----------|
| 200 | Success | İşlem başarılı |
| 400 | Bad Request | Geçersiz istek |
| 401 | Unauthorized | Yetkilendirme hatası |
| 404 | Not Found | Veri bulunamadı |
| 500 | Server Error | Sunucu hatası |

---

## 📝 Notlar

- Tüm tarih/saat değerleri **Istanbul (GMT+3)** timezone'unda
- Para birimi **TRY (Türk Lirası)**
- Tüm API endpoint'leri **JWT authentication** gerektirir
- Cache süresi **5 dakika**
- Minimum veri gereksinimi **7 gün** veya **5 sipariş**

---

## 🔮 Gelecek Geliştirmeler

- [ ] Deep Learning modelleri (LSTM, GRU)
- [ ] Sentiment analysis (müşteri yorumları)
- [ ] Image recognition (ürün görselleri)
- [ ] Chatbot entegrasyonu
- [ ] Real-time predictions
- [ ] A/B testing framework
- [ ] Multi-language support
- [ ] Advanced customer clustering (K-means, DBSCAN)
- [ ] Time series decomposition (STL)
- [ ] Causal impact analysis

---

## 📞 Destek

Sorularınız için:
- GitHub Issues
- Email: support@lysiaetic.com
- Dokümantasyon: /docs/ai

---

**Version:** 2.0.0
**Last Updated:** 2025-01-31
**Author:** LysiaETIC AI Team
