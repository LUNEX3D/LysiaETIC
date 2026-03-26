"""
Advanced AI Model for E-commerce Analytics
Features:
- Price Prediction using Linear Regression
- Demand Forecasting
- Stock Optimization
- Seasonal Pattern Detection
- Customer Segmentation
"""

import numpy as np
from datetime import datetime, timedelta
import json
import sys


class EcommerceAIModel:
    """Advanced AI Model for E-commerce Predictions"""

    def __init__(self):
        self.min_data_points = 7
        self.confidence_threshold = 0.6

    def linear_regression(self, x_values, y_values):
        """
        Perform linear regression
        Returns: slope, intercept, r_squared
        """
        if len(x_values) < 2:
            return 0, 0, 0

        x = np.array(x_values, dtype=float)
        y = np.array(y_values, dtype=float)

        n = len(x)
        x_mean = np.mean(x)
        y_mean = np.mean(y)

        # Calculate slope and intercept
        numerator = np.sum((x - x_mean) * (y - y_mean))
        denominator = np.sum((x - x_mean) ** 2)

        if denominator == 0:
            return 0, y_mean, 0

        slope = numerator / denominator
        intercept = y_mean - slope * x_mean

        # Calculate R²
        y_pred = slope * x + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - y_mean) ** 2)

        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        r_squared = max(0, min(1, r_squared))

        return float(slope), float(intercept), float(r_squared)

    def predict_price(self, historical_prices, demand_trend="stable", competitor_prices=None):
        """
        Predict optimal price based on historical data and market conditions

        Args:
            historical_prices: List of historical prices
            demand_trend: "increasing", "stable", or "decreasing"
            competitor_prices: List of competitor prices (optional)

        Returns:
            dict with recommended_price, confidence, and reasoning
        """
        if not historical_prices or len(historical_prices) < 3:
            return {
                "recommended_price": 0,
                "confidence": 0,
                "reason": "Insufficient historical data"
            }

        prices = np.array(historical_prices, dtype=float)
        current_price = prices[-1]
        avg_price = np.mean(prices)
        std_price = np.std(prices)
        median_price = np.median(prices)

        # Calculate price trend
        x = np.arange(len(prices))
        slope, intercept, r_squared = self.linear_regression(x, prices)

        # Base recommendation on median (more stable than mean)
        recommended_price = median_price

        # Adjust based on demand trend
        if demand_trend == "increasing":
            # High demand - can increase price
            recommended_price = median_price * 1.05
            reason = "Yüksek talep nedeniyle fiyat artışı öneriliyor"
        elif demand_trend == "decreasing":
            # Low demand - decrease price to stimulate sales
            recommended_price = median_price * 0.95
            reason = "Talebi artırmak için fiyat indirimi öneriliyor"
        else:
            # Stable demand - maintain current strategy
            if abs(current_price - median_price) > std_price:
                recommended_price = median_price
                reason = "Fiyat istikrarı için medyan fiyat öneriliyor"
            else:
                recommended_price = current_price
                reason = "Mevcut fiyat optimal seviyede"

        # Consider competitor prices if available
        if competitor_prices and len(competitor_prices) > 0:
            comp_avg = np.mean(competitor_prices)
            if recommended_price > comp_avg * 1.1:
                recommended_price = comp_avg * 1.05
                reason += " (Rakip fiyatlarına göre ayarlandı)"

        # Apply safety limits (±20% from current price)
        max_price = current_price * 1.20
        min_price = current_price * 0.80
        recommended_price = max(min_price, min(max_price, recommended_price))

        # Calculate confidence based on data quality
        confidence = min(1.0, r_squared * (len(prices) / 30))

        return {
            "current_price": float(current_price),
            "recommended_price": round(float(recommended_price), 2),
            "change_percent": round(((recommended_price - current_price) / current_price) * 100, 2),
            "confidence": round(float(confidence), 2),
            "reason": reason,
            "price_trend": "increasing" if slope > 0.1 else "decreasing" if slope < -0.1 else "stable",
            "volatility": "high" if std_price > avg_price * 0.2 else "low"
        }

    def forecast_demand(self, historical_sales, forecast_days=30):
        """
        Forecast future demand using linear regression and seasonal adjustment

        Args:
            historical_sales: List of daily sales quantities
            forecast_days: Number of days to forecast

        Returns:
            dict with forecast, confidence, and trend
        """
        if not historical_sales or len(historical_sales) < self.min_data_points:
            return {
                "forecast": [],
                "confidence": 0,
                "trend": "insufficient_data",
                "message": "En az 7 günlük veri gerekli"
            }

        sales = np.array(historical_sales, dtype=float)
        x = np.arange(len(sales))

        # Perform regression
        slope, intercept, r_squared = self.linear_regression(x, sales)

        # Generate forecast
        forecast = []
        for i in range(1, forecast_days + 1):
            future_x = len(sales) + i
            predicted_value = slope * future_x + intercept
            # Ensure non-negative predictions
            predicted_value = max(0, predicted_value)
            forecast.append({
                "day": i,
                "predicted_sales": round(float(predicted_value), 2),
                "confidence": round(float(r_squared), 2)
            })

        # Determine trend
        avg_sales = np.mean(sales)
        recent_avg = np.mean(sales[-7:]) if len(sales) >= 7 else avg_sales
        trend = "increasing" if recent_avg > avg_sales * 1.1 else \
                "decreasing" if recent_avg < avg_sales * 0.9 else "stable"

        return {
            "forecast": forecast,
            "confidence": round(float(r_squared), 2),
            "trend": trend,
            "average_daily_sales": round(float(avg_sales), 2),
            "recent_average": round(float(recent_avg), 2),
            "total_forecast": round(float(sum(f["predicted_sales"] for f in forecast)), 2)
        }

    def optimize_stock(self, current_stock, daily_sales_forecast, lead_time_days=7, safety_factor=1.5):
        """
        Calculate optimal stock level

        Args:
            current_stock: Current inventory level
            daily_sales_forecast: Expected daily sales
            lead_time_days: Days to restock
            safety_factor: Safety stock multiplier

        Returns:
            dict with stock recommendations
        """
        if daily_sales_forecast <= 0:
            return {
                "current_stock": current_stock,
                "recommended_stock": current_stock,
                "reorder_point": 0,
                "order_quantity": 0,
                "status": "no_sales_data"
            }

        # Calculate reorder point (lead time demand + safety stock)
        lead_time_demand = daily_sales_forecast * lead_time_days
        safety_stock = lead_time_demand * (safety_factor - 1)
        reorder_point = lead_time_demand + safety_stock

        # Calculate optimal order quantity (Economic Order Quantity simplified)
        monthly_demand = daily_sales_forecast * 30
        optimal_stock = monthly_demand * 0.5  # Keep 15 days worth

        # Determine if reorder is needed
        if current_stock <= reorder_point:
            order_quantity = optimal_stock - current_stock
            status = "reorder_needed"
            urgency = "high" if current_stock < lead_time_demand else "medium"
        else:
            order_quantity = 0
            status = "sufficient"
            urgency = "low"

        # Calculate days until stockout
        days_until_stockout = current_stock / daily_sales_forecast if daily_sales_forecast > 0 else 999

        return {
            "current_stock": int(current_stock),
            "recommended_stock": round(float(optimal_stock), 0),
            "reorder_point": round(float(reorder_point), 0),
            "order_quantity": round(float(order_quantity), 0),
            "safety_stock": round(float(safety_stock), 0),
            "days_until_stockout": round(float(days_until_stockout), 1),
            "status": status,
            "urgency": urgency,
            "recommendation": self._get_stock_recommendation(status, days_until_stockout, lead_time_days)
        }

    def _get_stock_recommendation(self, status, days_until_stockout, lead_time):
        """Generate human-readable stock recommendation"""
        if status == "reorder_needed":
            if days_until_stockout < lead_time:
                return f"ACİL: Stok {days_until_stockout:.0f} gün içinde tükenecek! Hemen sipariş verin."
            else:
                return f"Stok yenileme zamanı. {days_until_stockout:.0f} gün sonra tükenecek."
        elif days_until_stockout > 60:
            return "Stok seviyesi yüksek. Yeni sipariş gerekmiyor."
        else:
            return f"Stok yeterli. {days_until_stockout:.0f} gün sonra yenileme gerekebilir."

    def detect_seasonality(self, daily_sales, window_size=7):
        """
        Detect seasonal patterns in sales data

        Args:
            daily_sales: List of daily sales
            window_size: Moving average window

        Returns:
            dict with seasonality analysis
        """
        if not daily_sales or len(daily_sales) < window_size * 2:
            return {
                "has_seasonality": False,
                "message": "Mevsimsellik analizi için yeterli veri yok"
            }

        sales = np.array(daily_sales, dtype=float)

        # Calculate moving average
        moving_avg = np.convolve(sales, np.ones(window_size) / window_size, mode='valid')

        # Calculate deviations from moving average
        deviations = []
        for i in range(len(moving_avg)):
            actual = sales[i + window_size - 1]
            expected = moving_avg[i]
            if expected > 0:
                deviation = ((actual - expected) / expected) * 100
                deviations.append(deviation)

        # Detect if there's significant variation
        if len(deviations) > 0:
            std_deviation = np.std(deviations)
            has_seasonality = std_deviation > 20  # 20% variation threshold

            return {
                "has_seasonality": bool(has_seasonality),
                "variation_percent": round(float(std_deviation), 2),
                "pattern": "high_variation" if has_seasonality else "stable",
                "recommendation": "Mevsimsel kampanyalar planlayın" if has_seasonality else "Düzenli stok stratejisi sürdürün"
            }

        return {
            "has_seasonality": False,
            "message": "Analiz tamamlanamadı"
        }

    def segment_customers(self, order_values, order_frequencies):
        """
        Simple customer segmentation (RFM-like)

        Args:
            order_values: List of customer order values
            order_frequencies: List of customer order frequencies

        Returns:
            dict with customer segments
        """
        if not order_values or not order_frequencies:
            return {"segments": [], "message": "Müşteri verisi yok"}

        values = np.array(order_values, dtype=float)
        frequencies = np.array(order_frequencies, dtype=float)

        # Calculate percentiles
        value_median = np.median(values)
        freq_median = np.median(frequencies)

        segments = {
            "champions": 0,  # High value, high frequency
            "loyal": 0,      # Low value, high frequency
            "big_spenders": 0,  # High value, low frequency
            "at_risk": 0     # Low value, low frequency
        }

        for i in range(len(values)):
            if values[i] >= value_median and frequencies[i] >= freq_median:
                segments["champions"] += 1
            elif values[i] < value_median and frequencies[i] >= freq_median:
                segments["loyal"] += 1
            elif values[i] >= value_median and frequencies[i] < freq_median:
                segments["big_spenders"] += 1
            else:
                segments["at_risk"] += 1

        total = len(values)
        return {
            "segments": {
                "champions": {"count": segments["champions"], "percent": round((segments["champions"] / total) * 100, 1)},
                "loyal": {"count": segments["loyal"], "percent": round((segments["loyal"] / total) * 100, 1)},
                "big_spenders": {"count": segments["big_spenders"], "percent": round((segments["big_spenders"] / total) * 100, 1)},
                "at_risk": {"count": segments["at_risk"], "percent": round((segments["at_risk"] / total) * 100, 1)}
            },
            "total_customers": total,
            "recommendations": self._get_segment_recommendations(segments, total)
        }

    def _get_segment_recommendations(self, segments, total):
        """Generate recommendations based on customer segments"""
        recommendations = []

        if segments["champions"] / total > 0.3:
            recommendations.append("Şampiyonlarınız için VIP programı oluşturun")

        if segments["at_risk"] / total > 0.4:
            recommendations.append("Risk altındaki müşteriler için geri kazanma kampanyası düzenleyin")

        if segments["big_spenders"] / total > 0.2:
            recommendations.append("Yüksek harcama yapan müşterilere özel teklifler sunun")

        if segments["loyal"] / total > 0.25:
            recommendations.append("Sadık müşterilerinizi ödüllendirin")

        return recommendations


def main():
    """Example usage and testing"""
    model = EcommerceAIModel()

    # Example 1: Price Prediction
    print("=" * 50)
    print("1. FİYAT TAHMİNİ")
    print("=" * 50)
    historical_prices = [100, 105, 103, 108, 110, 107, 112, 115]
    price_result = model.predict_price(historical_prices, demand_trend="increasing")
    print(json.dumps(price_result, indent=2, ensure_ascii=False))

    # Example 2: Demand Forecasting
    print("\n" + "=" * 50)
    print("2. TALEP TAHMİNİ")
    print("=" * 50)
    historical_sales = [10, 12, 15, 13, 18, 20, 22, 19, 25, 28, 30, 27, 32, 35]
    demand_result = model.forecast_demand(historical_sales, forecast_days=7)
    print(json.dumps(demand_result, indent=2, ensure_ascii=False))

    # Example 3: Stock Optimization
    print("\n" + "=" * 50)
    print("3. STOK OPTİMİZASYONU")
    print("=" * 50)
    stock_result = model.optimize_stock(
        current_stock=50,
        daily_sales_forecast=8.5,
        lead_time_days=7,
        safety_factor=1.5
    )
    print(json.dumps(stock_result, indent=2, ensure_ascii=False))

    # Example 4: Seasonality Detection
    print("\n" + "=" * 50)
    print("4. MEVSİMSELLİK ANALİZİ")
    print("=" * 50)
    sales_data = [10, 12, 15, 20, 25, 30, 28, 15, 12, 10, 8, 12, 15, 20, 25, 30, 32, 28, 20, 15]
    seasonality_result = model.detect_seasonality(sales_data)
    print(json.dumps(seasonality_result, indent=2, ensure_ascii=False))

    # Example 5: Customer Segmentation
    print("\n" + "=" * 50)
    print("5. MÜŞTERİ SEGMENTASYONu")
    print("=" * 50)
    order_values = [500, 1200, 300, 2000, 450, 1800, 600, 250, 1500, 800]
    order_frequencies = [5, 12, 3, 8, 4, 15, 6, 2, 10, 7]
    segment_result = model.segment_customers(order_values, order_frequencies)
    print(json.dumps(segment_result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
