# 📱 LysiaETIC — Mobile App (iOS & Android)

## Mimari

LysiaETIC mobil uygulaması **hibrit mimari** kullanır:

```
┌─────────────────────────────────────────────┐
│           React Web App (Mevcut)            │
│  113 sayfa · 25 component · MUI · Recharts  │
├─────────────────────────────────────────────┤
│         Capacitor Native Bridge             │
│  Push · StatusBar · Camera · Network · App  │
├──────────────────┬──────────────────────────┤
│   Android (APK)  │      iOS (IPA)           │
│   Android Studio │      Xcode               │
│   Play Store     │      App Store           │
└──────────────────┴──────────────────────────┘
```

**Tek codebase** → Web + Android + iOS aynı React kodu kullanır.

---

## 🚀 Hızlı Başlangıç

### Gereksinimler

| Platform | Gerekli Araçlar |
|----------|----------------|
| **Android** | Android Studio, JDK 17+, Android SDK 33+ |
| **iOS** | macOS, Xcode 15+, CocoaPods |
| **Her ikisi** | Node.js 18+, npm 9+ |

### Kurulum

```bash
# 1. Bağımlılıkları yükle
cd frontend
npm install

# 2. Android ikonlarını kur
node scripts/setup-android-icons.js
```

### Build & Çalıştırma

```bash
# ── Android ──────────────────────────────────
npm run mobile:build:android    # Build + sync
npm run mobile:open:android     # Android Studio'da aç
npm run mobile:run:android      # Cihazda/emülatörde çalıştır

# ── iOS ──────────────────────────────────────
npm run mobile:build:ios        # Build + sync
npm run mobile:open:ios         # Xcode'da aç
npm run mobile:run:ios          # Cihazda/simülatörde çalıştır

# ── Her ikisi ────────────────────────────────
npm run mobile:build:all        # Build + sync (Android + iOS)
npm run mobile:sync             # Sadece web değişikliklerini sync et

# ── Geliştirme (IDE'yi otomatik aç) ─────────
npm run mobile:dev:android      # Build + sync + Android Studio aç
npm run mobile:dev:ios          # Build + sync + Xcode aç
```

---

## 📂 Dosya Yapısı

```
frontend/
├── android/                    # Android native projesi
│   └── app/src/main/
│       ├── res/values/
│       │   ├── colors.xml      # LysiaETIC marka renkleri
│       │   ├── styles.xml      # Tema & splash screen
│       │   └── strings.xml     # Uygulama adı
│       └── assets/public/      # Capacitor web assets (auto-generated)
│
├── ios/                        # iOS native projesi
│   └── App/                    # Xcode projesi
│
├── src/
│   ├── utils/
│   │   ├── capacitorBridge.js          # Native API bridge (cross-platform)
│   │   ├── useCapacitorInit.js         # React hook — native init
│   │   ├── serviceWorkerRegistration.js # Enhanced SW (push + sync)
│   │   └── useViewportHeight.js        # Mobile viewport fix
│   │
│   └── components/
│       ├── PWAInstallPrompt.js         # PWA install banner
│       ├── UpdatePrompt.js             # App update notification
│       └── NotificationSettings.js     # Push notification toggle
│
├── public/
│   ├── service-worker.js       # Enhanced SW v3 (push + background sync)
│   ├── manifest.json           # PWA manifest
│   └── icons/                  # App ikonları (72-512px)
│
├── scripts/
│   ├── build-mobile.js         # Mobile build script
│   └── setup-android-icons.js  # Android ikon kurulumu
│
└── capacitor.config.ts         # Capacitor yapılandırması
```

---

## 🔧 Özellikler

### PWA (Web — Tarayıcı)
| Özellik | Durum |
|---------|-------|
| Ana ekrana ekleme (Android Chrome) | ✅ |
| Ana ekrana ekleme (iOS Safari) | ✅ |
| Offline çalışma | ✅ |
| Push bildirimleri | ✅ |
| Background sync | ✅ |
| Otomatik güncelleme bildirimi | ✅ |
| App shortcuts (uzun basma menüsü) | ✅ |
| Splash screen | ✅ |

### Native (Capacitor — Android/iOS)
| Özellik | Durum |
|---------|-------|
| Status bar kontrolü | ✅ |
| Splash screen (native) | ✅ |
| Push notifications (FCM/APNs) | ✅ |
| Network durumu izleme | ✅ |
| Android geri butonu | ✅ |
| App lifecycle (foreground/background) | ✅ |
| Kamera (ürün fotoğrafı) | ✅ |
| Dosya sistemi (fatura indirme) | ✅ |
| Haptic feedback | ✅ |

---

## 🔔 Push Notifications

### Web (PWA)
```javascript
// Kullanıcı ayarlarında NotificationSettings component'ini kullanın
import NotificationSettings from "./components/NotificationSettings";

// Veya programatik olarak:
import { subscribeToPush } from "./utils/serviceWorkerRegistration";
await subscribeToPush();
```

### Native (Capacitor)
```javascript
// Otomatik — useCapacitorInit hook'u başlatır
// Manuel kontrol:
import { pushNotifications } from "./utils/capacitorBridge";
const token = await pushNotifications.register();
```

### Backend'den Push Gönderme
```javascript
// Notification payload formatı:
{
    "title": "Yeni Sipariş! 🎉",
    "body": "Trendyol'dan 3 yeni sipariş geldi",
    "icon": "/icons/icon-192x192.png",
    "data": { "url": "/dashboard" },
    "actions": [
        { "action": "open", "title": "📂 Aç" },
        { "action": "dismiss", "title": "❌ Kapat" }
    ]
}
```

---

## 📱 Platform-Specific Notlar

### Android
- **Min SDK**: 22 (Android 5.1+)
- **Target SDK**: 34 (Android 14)
- **Keystore**: Release build için keystore oluşturulmalı
- **Play Store**: `ic_launcher-playstore.png` (512x512) hazır

```bash
# Release APK oluşturma (Android Studio'da):
# Build → Generate Signed Bundle/APK → APK → keystore seç → Release
```

### iOS
- **Min iOS**: 14.0+
- **Xcode**: 15.0+
- **CocoaPods**: `cd ios/App && pod install`
- **App Store**: Apple Developer hesabı gerekli ($99/yıl)

```bash
# iOS build (macOS gerekli):
cd ios/App
pod install
# Xcode'da aç → Product → Archive → Distribute
```

---

## 🔄 Geliştirme Workflow

### Web Değişikliği Yaptıktan Sonra

```bash
# 1. React build
npm run build

# 2. Native projelere sync
npm run mobile:sync

# 3. Test et
npm run mobile:run:android   # veya ios
```

### Live Reload (Geliştirme)

`capacitor.config.ts` dosyasında:
```typescript
server: {
    // Bilgisayarınızın local IP'sini yazın
    url: 'http://192.168.1.X:3000',
    cleartext: true,
}
```

Sonra:
```bash
npm start                      # React dev server
npm run mobile:run:android     # Cihazda live reload
```

> ⚠️ Production build'de `server.url`'i kaldırmayı unutmayın!

---

## 🏪 Store Yayınlama Checklist

### Google Play Store
- [ ] Release keystore oluştur
- [ ] `android/app/build.gradle` — versionCode/versionName güncelle
- [ ] Release APK/AAB oluştur
- [ ] Play Console'da uygulama oluştur
- [ ] Store listing (açıklama, ekran görüntüleri, ikon)
- [ ] İçerik derecelendirmesi
- [ ] Gizlilik politikası URL'i
- [ ] İncelemeye gönder

### Apple App Store
- [ ] Apple Developer hesabı ($99/yıl)
- [ ] App ID & Provisioning Profile oluştur
- [ ] Xcode'da Archive → Distribute
- [ ] App Store Connect'te uygulama oluştur
- [ ] Store listing (açıklama, ekran görüntüleri)
- [ ] App Review Guidelines uyumu
- [ ] İncelemeye gönder

---

## 🛠️ Sorun Giderme

### "capacitor.config.ts not found"
```bash
# Capacitor config frontend/ klasöründe olmalı
ls frontend/capacitor.config.ts
```

### Android build hatası
```bash
# Gradle cache temizle
cd android && ./gradlew clean
```

### iOS pod hatası
```bash
cd ios/App
pod deintegrate
pod install
```

### Web değişiklikleri native'de görünmüyor
```bash
# Sync'i unutmuş olabilirsiniz
npm run mobile:sync
```

---

**LysiaETIC** — Web + iOS + Android, Tek Codebase 🚀
