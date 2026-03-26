import random

def predict_price_change(current_price):
    return round(current_price * random.uniform(0.95, 1.05), 2)

if __name__ == "__main__":
    fiyat = 200  # Örnek fiyat
    print(f"AI önerilen yeni fiyat: {predict_price_change(fiyat)}₺")
