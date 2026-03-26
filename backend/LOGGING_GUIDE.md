# 📋 Logging Yapılandırma Kılavuzu

## 🎯 Yapılan Değişiklikler

Backend'deki tüm gereksiz `console.log`, `console.info` ve `console.debug` logları temizlendi. Sadece **kritik hatalar**, **uyarılar** ve **önemli bilgiler** loglanıyor.

## 🔧 Winston Logger Yapılandırması

### Log Seviyeleri

```javascript
- error (0)   → Kritik hatalar
- warn (1)    → Uyarılar
- info (2)    → Önemli bilgiler
- debug (3)   → Geliştirme logları (Production'da kapalı)
```

### Varsayılan Ayarlar

- **Log Seviyesi**: `warn` (sadece uyarılar ve hatalar)
- **Log Dosyaları**:
  - `logs/error.log` - Sadece hatalar
  - `logs/combined.log` - Tüm loglar
- **Dosya Boyutu**: Maksimum 5MB
- **Dosya Sayısı**: Son 5 dosya saklanır

### Ortam Değişkenleri

`.env` dosyanıza ekleyebilirsiniz:

```env
# Log seviyesini değiştirmek için
LOG_LEVEL=warn          # Varsayılan (sadece warn ve error)
# LOG_LEVEL=info        # Daha detaylı (info, warn, error)
# LOG_LEVEL=debug       # Tüm loglar (geliştirme için)

# Production modunda console.log'lar otomatik kapatılır
NODE_ENV=production
```

## 📁 Temizlenen Dosyalar

### Core Files
- ✅ `config/logger.js` - Winston logger yapılandırması
- ✅ `server.js` - Ana sunucu dosyası

### Services
- ✅ `services/dashboardService.js` - Dashboard servisi
- ✅ `services/aiDecisionEngine.js` - AI karar motoru
- ✅ `services/ordersService.js` - Sipariş servisleri
- ✅ `services/hepsiburadaService.js` - Hepsiburada API servisi

### Controllers
- ✅ `controllers/aiController.js` - AI controller
- ✅ `controllers/ordersController.js` - Sipariş controller
- ✅ `controllers/dashboardController.js` - Dashboard controller
- ✅ `controllers/marketplaceController.js` - Pazaryeri controller
- ✅ `controllers/cargoController.js` - Kargo controller
- ✅ `controllers/categoryController.js` - Kategori controller
- ✅ `controllers/inventoryController.js` - Envanter controller

### Routes
- ✅ `routes/hepsiburadaRoutes.js` - Hepsiburada route'ları

## 🚀 Kullanım Örnekleri

### Logger Import

```javascript
const logger = require("../config/logger");
```

### Hata Loglama

```javascript
try {
    // Kod...
} catch (error) {
    logger.error("İşlem başarısız", { error: error.message });
}
```

### Uyarı Loglama

```javascript
if (!credentials) {
    logger.warn("Credentials eksik", { userId });
}
```

### Bilgi Loglama (Önemli olaylar için)

```javascript
logger.info("Sunucu başlatıldı", { port: PORT });
```

## 📊 Log Formatı

```
[2024-01-15 14:30:45] ERROR: MongoDB bağlantı hatası
[2024-01-15 14:30:46] WARN: Unsupported marketplace: InvalidMarket
[2024-01-15 14:30:47] INFO: Sunucu 5000 portunda çalışıyor
```

## 🔍 Log Dosyalarını İnceleme

```bash
# Hata loglarını görüntüle
cat backend/logs/error.log

# Tüm logları görüntüle
cat backend/logs/combined.log

# Son 50 satırı takip et
tail -f backend/logs/combined.log -n 50
```

## ⚙️ Production Ayarları

Production ortamında:
1. `NODE_ENV=production` ayarlayın
2. `LOG_LEVEL=warn` veya `LOG_LEVEL=error` kullanın
3. `console.log`, `console.info`, `console.debug` otomatik olarak devre dışı kalır
4. Sadece kritik hatalar ve uyarılar loglanır

## 🎨 Avantajlar

✅ **Temiz Console**: Gereksiz loglar yok
✅ **Performans**: Daha az I/O işlemi
✅ **Güvenlik**: Hassas bilgiler loglanmıyor
✅ **Dosya Yönetimi**: Otomatik log rotasyonu
✅ **Filtreleme**: Sadece önemli olaylar
✅ **Renkli Output**: Console'da renkli loglar
✅ **Timestamp**: Her log zaman damgalı
✅ **Stack Trace**: Hatalarda tam stack trace

## 📝 Notlar

- Geliştirme sırasında `LOG_LEVEL=debug` kullanabilirsiniz
- Production'da mutlaka `LOG_LEVEL=warn` veya `error` kullanın
- Log dosyaları `.gitignore`'a eklenmiştir
- Log dosyaları otomatik olarak rotate edilir (5MB'dan sonra)

## 🔄 Eski Kod vs Yeni Kod

### ❌ Eski (Gereksiz)
```javascript
console.log("📦 Ürünler çekiliyor...");
console.log("✅ Başarılı:", data);
console.log("🔍 Debug:", someVariable);
```

### ✅ Yeni (Sadece Kritik)
```javascript
// Sadece hatalar
logger.error("Ürün çekme hatası", { error: error.message });

// Sadece uyarılar
logger.warn("Credentials eksik");

// Sadece önemli bilgiler
logger.info("Sunucu başlatıldı");
```

---

**Son Güncelleme**: 2024
**Durum**: ✅ Tamamlandı - Tüm dosyalar temizlendi
