/**
 * AI Module Test Examples
 *
 * Bu dosya, AI modülünün tüm özelliklerini test etmek için örnek kodlar içerir.
 * Gerçek API çağrıları yapmadan önce bu örnekleri inceleyebilirsiniz.
 */

const AIService = require('./advancedAIService');

// Mock data for testing
const mockOrders = [
    {
        orderNumber: "ORD001",
        orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        customerName: "Ahmet Yılmaz",
        totalPrice: 250,
        status: "Delivered",
        products: [
            { productName: "Ürün A", barcode: "123456", quantity: 2, price: 100 },
            { productName: "Ürün B", barcode: "789012", quantity: 1, price: 50 }
        ]
    },
    {
        orderNumber: "ORD002",
        orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        customerName: "Ayşe Demir",
        totalPrice: 450,
        status: "Delivered",
        products: [
            { productName: "Ürün A", barcode: "123456", quantity: 3, price: 100 },
            { productName: "Ürün C", barcode: "345678", quantity: 1, price: 150 }
        ]
    },
    {
        orderNumber: "ORD003",
        orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        customerName: "Mehmet Kaya",
        totalPrice: 300,
        status: "Delivered",
        products: [
            { productName: "Ürün A", barcode: "123456", quantity: 2, price: 100 },
            { productName: "Ürün D", barcode: "901234", quantity: 1, price: 100 }
        ]
    },
    {
        orderNumber: "ORD004",
        orderDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        customerName: "Fatma Şahin",
        totalPrice: 500,
        status: "Delivered",
        products: [
            { productName: "Ürün B", barcode: "789012", quantity: 4, price: 50 },
            { productName: "Ürün C", barcode: "345678", quantity: 2, price: 150 }
        ]
    },
    {
        orderNumber: "ORD005",
        orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        customerName: "Ali Öztürk",
        totalPrice: 350,
        status: "Cancelled",
        products: [
            { productName: "Ürün A", barcode: "123456", quantity: 3, price: 100 },
            { productName: "Ürün B", barcode: "789012", quantity: 1, price: 50 }
        ]
    },
    {
        orderNumber: "ORD006",
        orderDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        customerName: "Zeynep Arslan",
        totalPrice: 600,
        status: "Delivered",
        products: [
            { productName: "Ürün C", barcode: "345678", quantity: 4, price: 150 }
        ]
    },
    {
        orderNumber: "ORD007",
        orderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        customerName: "Ahmet Yılmaz",
        totalPrice: 200,
        status: "Delivered",
        products: [
            { productName: "Ürün A", barcode: "123456", quantity: 2, price: 100 }
        ]
    },
    {
        orderNumber: "ORD008",
        orderDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        customerName: "Can Yıldız",
        totalPrice: 400,
        status: "Delivered",
        products: [
            { productName: "Ürün D", barcode: "901234", quantity: 4, price: 100 }
        ]
    },
    {
        orderNumber: "ORD009",
        orderDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
        customerName: "Elif Kara",
        totalPrice: 550,
        status: "Delivered",
        products: [
            { productName: "Ürün C", barcode: "345678", quantity: 3, price: 150 },
            { productName: "Ürün B", barcode: "789012", quantity: 4, price: 50 }
        ]
    },
    {
        orderNumber: "ORD010",
        orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        customerName: "Burak Çelik",
        totalPrice: 300,
        status: "Delivered",
        products: [
            { productName: "Ürün A", barcode: "123456", quantity: 3, price: 100 }
        ]
    }
];

// Test Functions
async function testAll() {
    console.log("🤖 AI MODULE TEST SUITE\n");
    console.log("=" .repeat(60));

    // Test 1: Sales Forecasting
    console.log("\n📊 TEST 1: SALES FORECASTING");
    console.log("-".repeat(60));
    testSalesForecasting();

    // Test 2: Anomaly Detection
    console.log("\n🔍 TEST 2: ANOMALY DETECTION");
    console.log("-".repeat(60));
    testAnomalyDetection();

    // Test 3: Product Performance
    console.log("\n📦 TEST 3: PRODUCT PERFORMANCE ANALYSIS");
    console.log("-".repeat(60));
    testProductPerformance();

    // Test 4: Price Optimization
    console.log("\n💰 TEST 4: PRICE OPTIMIZATION");
    console.log("-".repeat(60));
    testPriceOptimization();

    // Test 5: Customer Behavior
    console.log("\n👥 TEST 5: CUSTOMER BEHAVIOR ANALYSIS");
    console.log("-".repeat(60));
    testCustomerBehavior();

    // Test 6: Seasonality Detection
    console.log("\n📅 TEST 6: SEASONALITY DETECTION");
    console.log("-".repeat(60));
    testSeasonality();

    // Test 7: Smart Recommendations
    console.log("\n💡 TEST 7: SMART RECOMMENDATIONS");
    console.log("-".repeat(60));
    testSmartRecommendations();

    // Test 8: Statistical Methods
    console.log("\n📈 TEST 8: STATISTICAL METHODS");
    console.log("-".repeat(60));
    testStatisticalMethods();

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS COMPLETED\n");
}

function testSalesForecasting() {
    const forecast = AIService.forecastSales(mockOrders, 7);

    console.log("Forecast Confidence:", (forecast.confidence * 100).toFixed(1) + "%");
    console.log("Trend:", forecast.trend);
    console.log("Historical Daily Average:", forecast.historicalAverage?.dailyOrders || "N/A");

    if (forecast.forecast && forecast.forecast.length > 0) {
        console.log("\nNext 7 Days Forecast:");
        forecast.forecast.forEach((day, index) => {
            console.log(`  Day ${index + 1}: ${day.predictedOrders} orders, ${AIService.formatCurrency(day.predictedRevenue)}`);
        });
    }
}

function testAnomalyDetection() {
    const anomalies = AIService.detectAnomalies(mockOrders);

    console.log("Total Anomalies Detected:", anomalies.anomalies?.length || 0);

    if (anomalies.statistics) {
        console.log("\nStatistics:");
        console.log("  Revenue Mean:", AIService.formatCurrency(anomalies.statistics.revenue.mean));
        console.log("  Revenue StdDev:", AIService.formatCurrency(anomalies.statistics.revenue.stdDev));
        console.log("  Orders Mean:", Math.round(anomalies.statistics.orders.mean));
        console.log("  Orders StdDev:", anomalies.statistics.orders.stdDev.toFixed(2));
    }

    if (anomalies.anomalies && anomalies.anomalies.length > 0) {
        console.log("\nDetected Anomalies:");
        anomalies.anomalies.forEach((anomaly, index) => {
            console.log(`  ${index + 1}. ${anomaly.date} - ${anomaly.type} ${anomaly.direction} (${anomaly.severity})`);
        });
    }
}

function testProductPerformance() {
    const performance = AIService.analyzeProductPerformance(mockOrders);

    console.log("Total Products Analyzed:", performance.totalProducts);
    console.log("Top Performers:", performance.topPerformers.length);
    console.log("Underperformers:", performance.underperformers.length);

    if (performance.topPerformers.length > 0) {
        console.log("\nTop 3 Products:");
        performance.topPerformers.slice(0, 3).forEach((product, index) => {
            console.log(`  ${index + 1}. ${product.name}`);
            console.log(`     Score: ${product.performanceScore}/100`);
            console.log(`     Revenue: ${AIService.formatCurrency(product.totalRevenue)}`);
            console.log(`     Quantity: ${product.totalQuantity}`);
            console.log(`     Category: ${product.category}`);
        });
    }
}

function testPriceOptimization() {
    const performance = AIService.analyzeProductPerformance(mockOrders);

    if (performance.topPerformers.length > 0) {
        const product = performance.topPerformers[0];
        const optimization = AIService.optimizePrice(product);

        console.log("Product:", product.name);
        console.log("Current Price:", AIService.formatCurrency(optimization.currentPrice));
        console.log("Recommended Price:", AIService.formatCurrency(optimization.recommendedPrice));
        console.log("Change:", optimization.change.toFixed(2) + "%");
        console.log("Reason:", optimization.reason);
        console.log("Confidence:", optimization.confidence);
    }
}

function testCustomerBehavior() {
    const behavior = AIService.analyzeCustomerBehavior(mockOrders);

    console.log("Peak Hour:", behavior.peakHour);
    console.log("Peak Day:", behavior.peakDay);
    console.log("Repeat Customer Rate:", behavior.repeatCustomerRate.toFixed(1) + "%");
    console.log("Average Order Value:", AIService.formatCurrency(behavior.avgOrderValue));
    console.log("Median Order Value:", AIService.formatCurrency(behavior.medianOrderValue));

    console.log("\nOrder Value Percentiles:");
    console.log("  P25:", AIService.formatCurrency(behavior.orderValuePercentiles.p25));
    console.log("  P50:", AIService.formatCurrency(behavior.orderValuePercentiles.p50));
    console.log("  P75:", AIService.formatCurrency(behavior.orderValuePercentiles.p75));
    console.log("  P90:", AIService.formatCurrency(behavior.orderValuePercentiles.p90));
}

function testSeasonality() {
    const seasonality = AIService.detectSeasonality(mockOrders);

    console.log("Has Seasonality:", seasonality.hasSeasonality);
    if (seasonality.trendChange !== undefined) {
        console.log("Trend Change:", seasonality.trendChange.toFixed(2) + "%");
        console.log("Direction:", seasonality.direction);
        console.log("Recommendation:", seasonality.recommendation);
    } else {
        console.log("Message:", seasonality.message);
    }
}

function testSmartRecommendations() {
    const recommendations = AIService.generateSmartRecommendations(mockOrders);

    console.log("Total Recommendations:", recommendations.length);

    const priorityCounts = {
        high: recommendations.filter(r => r.priority === "high").length,
        medium: recommendations.filter(r => r.priority === "medium").length,
        low: recommendations.filter(r => r.priority === "low").length
    };

    console.log("Priority Breakdown:");
    console.log("  High:", priorityCounts.high);
    console.log("  Medium:", priorityCounts.medium);
    console.log("  Low:", priorityCounts.low);

    console.log("\nTop 5 Recommendations:");
    recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`     ${rec.description}`);
        if (rec.action) {
            console.log(`     Action: ${rec.action}`);
        }
    });
}

function testStatisticalMethods() {
    const values = [10, 12, 15, 13, 18, 20, 22, 19, 25, 28];

    console.log("Test Data:", values);
    console.log("\nStatistical Calculations:");
    console.log("  Mean:", AIService.calculateMean(values).toFixed(2));
    console.log("  Median:", AIService.calculateMedian(values).toFixed(2));
    console.log("  Std Dev:", AIService.calculateStdDev(values).toFixed(2));
    console.log("  P25:", AIService.calculatePercentile(values, 25).toFixed(2));
    console.log("  P50:", AIService.calculatePercentile(values, 50).toFixed(2));
    console.log("  P75:", AIService.calculatePercentile(values, 75).toFixed(2));

    // Linear Regression Test
    const xValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const yValues = values;
    const regression = AIService.linearRegression(xValues, yValues);

    console.log("\nLinear Regression:");
    console.log("  Slope:", regression.slope.toFixed(4));
    console.log("  Intercept:", regression.intercept.toFixed(4));
    console.log("  R²:", regression.r2.toFixed(4));

    // Exponential Smoothing Test
    const smoothed = AIService.exponentialSmoothing(values, 0.3);
    console.log("\nExponential Smoothing (α=0.3):");
    console.log("  Original:", values.slice(0, 5).join(", ") + "...");
    console.log("  Smoothed:", smoothed.slice(0, 5).map(v => v.toFixed(2)).join(", ") + "...");
}

// API Usage Examples
function apiUsageExamples() {
    console.log("\n🔌 API USAGE EXAMPLES\n");
    console.log("=" .repeat(60));

    console.log("\n1. Get AI Suggestions:");
    console.log(`
POST /api/ai/suggestions
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "userId": "USER_ID_HERE"
}
    `);

    console.log("\n2. Get Product Analysis:");
    console.log(`
GET /api/ai/products/USER_ID_HERE
Authorization: Bearer YOUR_JWT_TOKEN
    `);

    console.log("\n3. Get Customer Behavior:");
    console.log(`
GET /api/ai/customer-behavior/USER_ID_HERE
Authorization: Bearer YOUR_JWT_TOKEN
    `);

    console.log("\n4. Get Sales Forecast:");
    console.log(`
GET /api/ai/forecast/USER_ID_HERE?days=30
Authorization: Bearer YOUR_JWT_TOKEN
    `);

    console.log("\n5. Get Anomalies:");
    console.log(`
GET /api/ai/anomalies/USER_ID_HERE
Authorization: Bearer YOUR_JWT_TOKEN
    `);
}

// Run tests
if (require.main === module) {
    testAll();
    apiUsageExamples();
}

module.exports = {
    testAll,
    testSalesForecasting,
    testAnomalyDetection,
    testProductPerformance,
    testPriceOptimization,
    testCustomerBehavior,
    testSeasonality,
    testSmartRecommendations,
    testStatisticalMethods,
    apiUsageExamples,
    mockOrders
};
