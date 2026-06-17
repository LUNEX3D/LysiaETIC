# Dashtock Store — İkas Benzeri Web Mağaza Modülü (Teknik Taslak)

| Alan | Değer |
|------|--------|
| **Belge** | `docs/STOREFRONT-IKAS-SPEC.md` |
| **Tarih** | 27.05.2026 |
| **Hedef** | Her kullanıcı: domain bağlar, tema seçer, mağazayı yayınlar, site siparişi alır; stok/sipariş pazaryeri ile tek panelde |
| **Ürün adı (öneri)** | **Dashtock Store** / panelde **Web Sitem** |

---

## 1. Ürün özeti

```text
Satıcı (Dashtock panel)                    Ziyaretçi (public)
─────────────────────                      ───────────────────
Web Sitem → Kurulum / Tema / Domain   →    www.markam.com
         → Ürünler (kanal: mağaza)   →    Katalog + sepet + ödeme
         → Siparişler (kanal: store)  ←    PayTR / misafir checkout
         → Stok (merkezi havuz)       ↔    Trendyol, HB, N11…
```

**Mevcut kodla ilişki**

| Mevcut | Store modülü |
|--------|----------------|
| `ProductMapping` | Ürün kaynağı; `channels.store` bayrağı |
| `Order` | `salesChannel: 'store'` + `storeId` (genişletme) |
| `paytrService` | Abonelikten ayrı **mağaza PayTR** ayarları |
| `stockSyncService` | Site satışında stok düşümü + MP senkron |
| `UserDashboard` | Yeni üst menü grubu **E-Ticaret / Web Sitem** |

---

## 2. Panel menü ağacı (İkas benzeri)

`UserDashboard` sidebar’da yeni bölüm. Alt öğeler `activePanel` ile `store-*` prefix veya tek panel içi sekme (`StoreHub` + iç router).

### 2.1 Sidebar (önerilen yapı)

```text
─── E-TİCARET (yeni divider) ─────────────────────────────
📊 Web Sitem (özet)                    → store-dashboard
   Durum: Yayında / Taslak | Ziyaret | Sipariş bugün

─── MAĞAZA KURULUMU ─────────────────────────────────────
🎨 Tasarım & Tema                      → store-design
   • Tema galerisi, renk, logo, font
   • Header / footer, mobil önizleme

🌐 Domain & SSL                        → store-domain
   • Subdomain: {slug}.sites.dashtock.com
   • Özel domain + DNS talimatları + doğrulama

📄 Sayfalar & Menü                     → store-pages
   • Ana sayfa blokları, Hakkımızda, İletişim
   • Menü sırası, footer linkleri

⚖️ Yasal & Çerez                       → store-legal
   • Mesafeli satış, KVKK, iade şablonları

─── KATALOG (mağaza kanalı) ─────────────────────────────
🛍️ Mağaza Ürünleri                    → store-products
   • ProductMapping listesi (storeVisible)
   • Mağaza fiyatı, sıra, koleksiyon

📁 Koleksiyonlar / Kategoriler         → store-collections
   • Vitrin kategorileri (MP kategori merkezinden bağımsız olabilir)

─── SATIŞ & OPERASYON ───────────────────────────────────
🛒 Siparişler (Web)                    → store-orders
   • Filtre: sadece salesChannel=store
   • Durum, kargo, iptal

💳 Ödeme Ayarları                      → store-payments
   • PayTR mağaza anahtarları / test modu
   • Havale, kapıda (faz 2)

🚚 Kargo & Teslimat                    → store-shipping
   • Sabit ücret, ücretsiz eşik, bölgeler (faz 2)

👤 Müşteriler                          → store-customers
   • Kayıtlı müşteriler, adresler (faz 2)

🎁 Kampanyalar & Kuponlar              → store-marketing
   • Kupon kodu, indirim (faz 3)

─── YAYIN ───────────────────────────────────────────────
👁️ Önizleme                           → store-preview (modal veya yeni sekme)
🚀 Yayınla / Taslağa al                → store-publish (store-dashboard içinde CTA)

─── RAPOR (opsiyonel, faz 3) ───────────────────────────
📈 Mağaza Raporu                       → store-reports
   • Satış, dönüşüm, kanal kıyası (Web vs MP)
```

### 2.2 `activePanel` ID listesi (implementasyon)

| `activePanel` | Bileşen (öneri) | Plan kilidi |
|---------------|-----------------|-------------|
| `store-dashboard` | `StoreDashboardPage` | `own_storefront` (basic+) |
| `store-design` | `StoreDesignPage` | basic+ |
| `store-domain` | `StoreDomainPage` | `custom_domain` (pro+) |
| `store-pages` | `StorePagesPage` | basic+ |
| `store-legal` | `StoreLegalPage` | basic+ |
| `store-products` | `StoreProductsPage` | basic+ |
| `store-collections` | `StoreCollectionsPage` | basic+ |
| `store-orders` | `StoreOrdersPage` (veya OrdersPage `channel=store`) | basic+ |
| `store-payments` | `StorePaymentsPage` | `store_checkout` (pro+) |
| `store-shipping` | `StoreShippingPage` | basic+ |
| `store-customers` | `StoreCustomersPage` | faz 2 |
| `store-marketing` | `StoreMarketingPage` | faz 3 |
| `store-reports` | `StoreReportsPage` | pro+ |

### 2.3 Sihirbaz (ilk kurulum — İkas “mağaza aç”)

`store-dashboard` üzerinde tek seferlik wizard:

1. Mağaza adı + slug  
2. Tema seç  
3. İlk 5 ürünü vitrine ekle (ProductMapping’den)  
4. Ödeme (PayTR) — F2’de zorunlu  
5. Domain (subdomain hemen, özel domain opsiyonel)  
6. Yasal şablon onayı  
7. Yayınla  

---

## 3. Public storefront (ziyaretçi)

Ayrı build: `frontend/storefront/` (veya `frontend-storefront/`).

| URL (örnek) | Sayfa |
|-------------|--------|
| `/` (Host: `www.markam.com`) | Ana sayfa (bloklar) |
| `/urunler` | Katalog |
| `/urun/:slug` | Ürün detay |
| `/koleksiyon/:slug` | Koleksiyon |
| `/sepet` | Sepet |
| `/odeme` | Checkout |
| `/siparis/:token` | Sipariş teşekkür / durum |
| `/sayfa/:slug` | CMS sayfa (hakkımızda) |
| `/hesabim` | Müşteri (faz 2) |

**Tenant çözümleme:** `Host` → `GET /api/public/store/resolve?host=www.markam.com`

---

## 4. MongoDB koleksiyonları

### 4.1 `Store` (mağaza ana kaydı — 1 kullanıcı = 1 mağaza MVP)

```javascript
{
  userId: ObjectId,           // unique index
  name: String,
  slug: String,               // unique, subdomain
  status: "draft" | "published" | "suspended",
  themeId: String,            // "minimal" | "boutique" | ...
  themeOverrides: {
    primaryColor, secondaryColor, fontFamily, logoUrl, faviconUrl
  },
  subdomain: String,          // slug.sites.dashtock.com
  customDomain: String,       // www.markam.com
  domainStatus: "none" | "pending" | "verified" | "failed",
  domainVerifyToken: String,  // DNS TXT veya CNAME hedef doğrulama
  sslStatus: "pending" | "active",
  publishedAt: Date,
  settings: {
    currency: "TRY",
    locale: "tr",
    guestCheckout: true,
    minOrderAmount: Number,
    contactEmail, contactPhone, address
  },
  analytics: { gtmId, ga4Id },
  createdAt, updatedAt
}
```

**İndeksler:** `userId` unique; `slug` unique; `customDomain` sparse unique.

---

### 4.2 `StorePage` (içerik sayfaları + ana sayfa blokları)

```javascript
{
  storeId: ObjectId,
  type: "home" | "about" | "contact" | "custom" | "legal_distance" | "legal_kvkk" | "legal_return",
  slug: String,
  title: String,
  seo: { metaTitle, metaDescription, ogImage },
  blocks: [                   // JSON blok editörü (İkas benzeri)
    { type: "hero", props: { image, title, cta } },
    { type: "product_grid", props: { collectionId, limit } },
    { type: "rich_text", props: { html } }
  ],
  isPublished: Boolean,
  sortOrder: Number
}
```

---

### 4.3 `StoreCollection` (vitrin kategorisi / koleksiyon)

```javascript
{
  storeId: ObjectId,
  name: String,
  slug: String,               // unique per store
  description: String,
  imageUrl: String,
  sortOrder: Number,
  productIds: [ObjectId]      // ProductMapping _id veya StoreProduct ref
}
```

---

### 4.4 `StoreProduct` (mağaza vitrin cache — yayın snapshot)

Ürün kaynağı `ProductMapping`; vitrin performansı için denormalize.

```javascript
{
  storeId: ObjectId,
  productMappingId: ObjectId,
  visible: Boolean,
  slug: String,               // unique per store
  sortOrder: Number,
  // Snapshot (yayınla veya sync job ile güncelle)
  title, description, images[], 
  price, compareAtPrice,     // mağaza fiyatı (MP'den farklı olabilir)
  stock: Number,              // canlı okuma tercih: ayrı alan sync
  vatRate, barcode, sku,
  collectionIds: [ObjectId],
  seo: { metaTitle, metaDescription },
  variantGroupId: ObjectId, // opsiyonel, ProductMapping varyant ile bağ
  publishedAt, updatedAt
}
```

**İndeksler:** `{ storeId, slug }` unique; `{ storeId, visible, sortOrder }`.

---

### 4.5 `StoreCart` (sepet — misafir + oturum)

```javascript
{
  storeId: ObjectId,
  sessionId: String,          // cookie
  customerId: ObjectId,       // opsiyonel
  items: [{ storeProductId, quantity, unitPrice }],
  currency: "TRY",
  expiresAt: Date
}
```

TTL index `expiresAt` (7 gün).

---

### 4.6 `StoreOrder` (site siparişi)

**Seçenek A (öneri):** Mevcut `Order` modelini genişlet — tek sipariş listesi.

```javascript
// Order modeline ek alanlar:
salesChannel: { type: String, enum: ["store", "trendyol", "hepsiburada", ...], default: "trendyol" },
storeId: ObjectId,
storeOrderNumber: String,     // WEB-2026-00042
payment: {
  provider: "paytr",
  status: "pending" | "paid" | "failed" | "refunded",
  paytrMerchantOid, transactionId, paidAt
},
shippingMethod: String,
shippingCost: Number,
discountTotal: Number,
couponCode: String,
lineItems: [{ storeProductId, productMappingId, title, quantity, unitPrice, vatRate }]
```

**Seçenek B:** Ayrı `StoreOrder` koleksiyonu + panelde birleşik görünüm (daha fazla iş).

Bu taslak **Seçenek A** üzerinden gider.

---

### 4.7 `StoreCustomer` (faz 2)

```javascript
{
  storeId: ObjectId,
  email: String,              // unique per store
  passwordHash: String,
  name, phone,
  addresses: [{ title, city, district, line, zip, isDefault }],
  createdAt
}
```

---

### 4.8 `StorePaymentSettings`

```javascript
{
  storeId: ObjectId,          // unique
  paytr: {
    enabled: Boolean,
    merchantId, merchantKey, merchantSalt,  // şifreli alan önerilir
    testMode: Boolean
  },
  bankTransfer: { enabled, instructions },
  cod: { enabled }            // kapıda ödeme
}
```

---

### 4.9 `StoreShippingZone` (faz 2)

```javascript
{
  storeId: ObjectId,
  name: String,               // "Türkiye", "İstanbul"
  regions: [String],          // il kodları veya "all"
  rules: [
    { type: "flat", cost: 49 },
    { type: "free_over", minAmount: 500 }
  ],
  defaultCarrier: String
}
```

---

### 4.10 `StoreCoupon` (faz 3)

```javascript
{
  storeId: ObjectId,
  code: String,               // unique per store
  type: "percent" | "fixed" | "free_shipping",
  value: Number,
  minCartAmount, usageLimit, usedCount,
  startsAt, endsAt, isActive
}
```

---

### 4.11 `StoreMenu` (opsiyonel — veya StorePage içinde)

```javascript
{
  storeId: ObjectId,
  location: "header" | "footer",
  items: [{ label, url, type: "page" | "collection" | "external", refId }]
}
```

---

### 4.12 Mevcut koleksiyonlarla ilişki

| Koleksiyon | Değişiklik |
|------------|------------|
| `ProductMapping` | `channels: { store: Boolean, trendyol: Boolean, ... }` veya `storeSettings: { visible, priceOverride }` |
| `Order` | `salesChannel`, `storeId`, `payment`, `lineItems` (yukarı) |
| `User` | `storeId` ref opsiyonel |
| `planFeatureRegistry` | Yeni feature id’ler (aşağı) |

---

## 5. Plan özellikleri (`planFeatureRegistry`)

```javascript
own_storefront:      { minPlan: "basic",  label: "Web mağaza (subdomain)" },
custom_domain:       { minPlan: "pro",    label: "Özel domain" },
store_checkout:      { minPlan: "pro",    label: "Online ödeme (PayTR)" },
store_marketing:     { minPlan: "pro",    label: "Kupon & kampanya" },
store_max_products:  // limit: trial 20, basic 500, pro unlimited — ayrı limit tablosu
```

---

## 6. API endpoint listesi

Önek prefix: **`/api/store`** (panel, auth) ve **`/api/public/store`** (vitrin, auth yok / rate limit).

### 6.1 Mağaza & kurulum (panel)

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 1 | GET | `/api/store` | Kullanıcının mağaza özeti |
| 2 | POST | `/api/store` | Mağaza oluştur (wizard) |
| 3 | PATCH | `/api/store` | Genel ayarlar |
| 4 | POST | `/api/store/publish` | Yayınla |
| 5 | POST | `/api/store/unpublish` | Taslağa al |
| 6 | GET | `/api/store/stats` | Ziyaret, sipariş özeti (dashboard) |

### 6.2 Tema & tasarım

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 7 | GET | `/api/store/themes` | Tema kataloğu |
| 8 | PATCH | `/api/store/theme` | themeId + overrides |
| 9 | GET | `/api/store/preview-token` | Önizleme JWT (15 dk) |

### 6.3 Domain

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 10 | GET | `/api/store/domain` | Domain durumu + talimatlar |
| 11 | POST | `/api/store/domain` | Özel domain ekle |
| 12 | POST | `/api/store/domain/verify` | DNS kontrolü tetikle |
| 13 | DELETE | `/api/store/domain` | Özel domain kaldır |

### 6.4 Sayfalar & menü

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 14 | GET | `/api/store/pages` | Sayfa listesi |
| 15 | POST | `/api/store/pages` | Sayfa oluştur |
| 16 | GET | `/api/store/pages/:id` | Sayfa detay |
| 17 | PATCH | `/api/store/pages/:id` | Güncelle |
| 18 | DELETE | `/api/store/pages/:id` | Sil |
| 19 | GET | `/api/store/menus/:location` | header/footer menü |
| 20 | PUT | `/api/store/menus/:location` | Menü kaydet |

### 6.5 Ürünler & koleksiyonlar

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 21 | GET | `/api/store/products` | Vitrin ürünleri (StoreProduct) |
| 22 | POST | `/api/store/products/sync` | ProductMapping → StoreProduct senkron |
| 23 | PATCH | `/api/store/products/:id` | visible, fiyat, sıra, slug |
| 24 | POST | `/api/store/products/bulk` | Toplu visible/fiyat |
| 25 | GET | `/api/store/catalog-source` | ProductMapping listesi (ekleme UI) |
| 26 | GET | `/api/store/collections` | Koleksiyonlar |
| 27 | POST | `/api/store/collections` | Oluştur |
| 28 | PATCH | `/api/store/collections/:id` | Güncelle |
| 29 | DELETE | `/api/store/collections/:id` | Sil |

### 6.6 Ödeme & kargo (panel)

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 30 | GET | `/api/store/payments` | PayTR / diğer ayarlar |
| 31 | PUT | `/api/store/payments` | Kaydet (şifreli) |
| 32 | POST | `/api/store/payments/test` | Test ödemesi |
| 33 | GET | `/api/store/shipping` | Kargo bölgeleri |
| 34 | PUT | `/api/store/shipping` | Kuralları kaydet |

### 6.7 Siparişler (panel)

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 35 | GET | `/api/store/orders` | `salesChannel=store` |
| 36 | GET | `/api/store/orders/:id` | Detay |
| 37 | PATCH | `/api/store/orders/:id/status` | Hazırlanıyor, kargoda, iptal |
| 38 | POST | `/api/store/orders/:id/tracking` | Kargo takip no |

### 6.8 Müşteri & pazarlama (faz 2–3)

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| 39 | GET | `/api/store/customers` | Müşteri listesi |
| 40 | GET | `/api/store/customers/:id` | Detay + siparişler |
| 41 | GET | `/api/store/coupons` | Kuponlar |
| 42 | POST | `/api/store/coupons` | Oluştur |
| 43 | PATCH | `/api/store/coupons/:id` | Güncelle |

---

### 6.9 Public API (vitrin + checkout)

| # | Method | Endpoint | Açıklama |
|---|--------|----------|----------|
| P1 | GET | `/api/public/store/resolve` | `?host=` → store config + theme |
| P2 | GET | `/api/public/store/products` | Katalog (sayfalı, filtre) |
| P3 | GET | `/api/public/store/products/:slug` | Ürün detay |
| P4 | GET | `/api/public/store/collections/:slug` | Koleksiyon |
| P5 | GET | `/api/public/store/pages/:slug` | CMS sayfa |
| P6 | GET | `/api/public/store/cart` | Sepet (session cookie) |
| P7 | POST | `/api/public/store/cart/items` | Sepete ekle |
| P8 | PATCH | `/api/public/store/cart/items/:lineId` | Adet güncelle |
| P9 | DELETE | `/api/public/store/cart/items/:lineId` | Satır sil |
| P10 | POST | `/api/public/store/checkout/shipping-quote` | Kargo ücreti hesapla |
| P11 | POST | `/api/public/store/checkout/create` | Sipariş oluştur + PayTR token |
| P12 | POST | `/api/public/store/checkout/paytr-callback` | Mağaza PayTR callback (ayrı merchant) |
| P13 | GET | `/api/public/store/orders/track` | `?token=` misafir sipariş takip |
| P14 | GET | `/api/public/store/sitemap.xml` | Tenant sitemap (nginx rewrite ile) |

**Toplam:** 43 panel + public endpoint (faz 1–3 dahil).

---

## 7. Backend dosya yapısı (öneri)

```text
backend/
├── models/
│   Store.js
│   StorePage.js
│   StoreProduct.js
│   StoreCollection.js
│   StoreCart.js
│   StorePaymentSettings.js
│   StoreShippingZone.js
│   StoreCoupon.js
│   StoreCustomer.js
├── controllers/store/
│   storeController.js
│   storeDomainController.js
│   storeProductController.js
│   storeCheckoutController.js
│   storePublicController.js
├── services/store/
│   storePublishService.js      # yayınla → snapshot
│   storeDomainService.js       # DNS verify
│   storeCheckoutService.js     # sipariş + PayTR
│   storeStockService.js        # stok düşümü → stockSyncService
├── routes/
│   storeRoutes.js              # /api/store/*
│   storePublicRoutes.js        # /api/public/store/*
└── jobs/
    storeDomainVerifyJob.js     # cron DNS
```

`server.js` mount:

```javascript
app.use("/api/store", storeRoutes);
app.use("/api/public/store", storePublicLimiter, storePublicRoutes);
```

---

## 8. Frontend dosya yapısı (öneri)

```text
frontend/src/
├── pages/store/
│   StoreDashboardPage.js
│   StoreDesignPage.js
│   StoreDomainPage.js
│   StorePagesPage.js
│   StoreProductsPage.js
│   StoreOrdersPage.js
│   StorePaymentsPage.js
│   ...
├── services/storeApi.js
└── styles/store/

frontend/storefront/          # Ayrı CRA/Vite app
├── src/
│   themes/ minimal, boutique, classic
│   pages/ Home, Catalog, Product, Cart, Checkout
│   api/ publicStoreApi.js
└── package.json
```

---

## 9. Domain & SSL (operasyon)

| Adım | Teknik |
|------|--------|
| Subdomain | `*.sites.dashtock.com` wildcard DNS + SSL |
| Özel domain | Kullanıcı CNAME → `sites.dashtock.com` |
| Doğrulama | Cron: `dns.resolveCname` / TXT |
| SSL | **Cloudflare for SaaS** Custom Hostnames API (öneri) |
| Nginx | `server_name` map veya tek server + `proxy_set_header Host` |

---

## 10. Stok & sipariş entegrasyonu

```text
Site checkout başarılı
  → StoreOrder (Order salesChannel=store) oluştur
  → storeStockService.decrement(productMappingId, qty)
  → stockSyncService.pushToMarketplaces(userId)   // arka plan job
```

**Oversell koruması:** Checkout’ta atomik stok kontrolü (`findOneAndUpdate` with `$gte`).

---

## 11. Uygulama fazları (bu taslağa göre)

| Faz | Endpoint aralığı | Panel panelleri |
|-----|------------------|-----------------|
| **F1** | 1–9, 14–18, 21–25, P1–P5 | dashboard, design, pages, products, publish |
| **F2** | 10–13, 30–32, 35–38, P6–P13 | domain, payments, orders, checkout |
| **F3** | 33–34, 39–43, 26–29 | shipping, customers, coupons, collections |

---

## 12. İlk sprint backlog (F1 kodlamaya başlangıç)

1. `Store` model + `GET/POST/PATCH /api/store`  
2. `StoreProduct` + sync from ProductMapping  
3. `storeRoutes` + `storePublicRoutes` mount  
4. `StoreDashboardPage` + sidebar menü kaydı  
5. `frontend/storefront` minimal tema: liste + detay (sepet yok)  
6. Subdomain resolve + Nginx wildcard  
7. `planFeatureRegistry.own_storefront` + middleware  

---

## 13. Açık kararlar (kodlamadan önce)

| # | Soru | Öneri |
|---|------|--------|
| 1 | Sipariş tek `Order` mı, ayrı `StoreOrder` mı? | Tek `Order` + `salesChannel` |
| 2 | Fiyat canlı mı snapshot mı? | Fiyat/stok canlı; açıklama/görsel snapshot |
| 3 | Mağaza başına 1 mi, çoklu mağaza mı? | MVP: 1 kullanıcı = 1 mağaza |
| 4 | PayTR ayrı merchant mı? | Evet, satıcı kendi PayTR bilgisi |

---

*Belge implementasyon rehberidir; kod üretilmedikçe API sözleşmesi değişebilir. Sorular veya “F1’den başla” için Agent modunda devam edilebilir.*
