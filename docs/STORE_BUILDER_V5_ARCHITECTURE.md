# Store Builder V5 — Mimari Yenileme

## Amaç

Kullanıcı ERP modülü değil, **profesyonel mağaza yönetim platformu** hissine girmeli (Shopify + İkas + Framer referans).

Öncelik: **UX / IA / Theme Management / Editor Experience** — özellik sayısı değil.

---

## Bilgi mimarisi (önce / sonra)

| Önce | Sonra (V5) |
|------|------------|
| ERP → E-Ticaret → Store Builder → Bölümler → Editör | ERP → E-Ticaret → **Mağaza Merkezi** → **Temalarım** → **Tema Yönetimi** → **Store Editor** |

### Panel kimlikleri (`ec-wb-*`)

| Panel | Segment | Ekran |
|-------|---------|--------|
| `ec-wb-center` | `center` | **StoreManagementCenter** |
| `ec-wb-my-themes` | `my-themes` | **ThemeManagementHub** (Temalarım) |
| `ec-wb-theme-manage` | `theme-manage` | **ThemeManagementHub** (yönetim) |
| `ec-wb-editor` | `editor` | **ThemeEditorPage** `editorVariant="v5"` |
| `ec-wb-marketplace` | `marketplace` | **ThemeMarketplaceV5Page** |
| `ec-wb-design-studio` | `design-studio` | **GlobalDesignStudio** |

Geriye dönük: `ec-wb-themes`, `ec-wb-themes-editor`, `ec-wb-themes-marketplace` otomatik eşlenir.

Kaynak: `frontend/src/constants/storeBuilderV5.js`, `ecommerceMenu.js`

---

## 1. Store Management Center

**Dosya:** `frontend/src/pages/storeBuilder/StoreManagementCenter.js`

- Aktif tema kartı (önizleme, sürüm, yayın durumu, son güncelleme)
- Tema Özelleştir / Önizle / Yayınla / Kopyala / Dışa Aktar
- Tema kütüphanesi kısayolları (filtre sekmeleri)

---

## 2. Tema Mağazası V5

**Dosyalar:**

- `frontend/src/components/storeBuilder/marketplace/ThemeMarketplaceV5Page.js`
- `frontend/src/components/storeBuilder/marketplace/ThemeMarketplaceV5Card.js`

- Kart: min **450×700px**, desktop/tablet/mobile önizleme toggle, performans/SEO skoru, demo/kur/favori
- Eski `ThemeMarketplaceFullPage` ERP kanalında **kullanılmıyor** (hub V5 sayfaya yönlendirir)

---

## 3. Tema motoru (Dawn referans)

Disk yapısı (JSON pack):

```
backend/data/themes/{slug}/
  theme.json
  settings_schema.json
  settings_data.json
  theme.config.json          # mevcut uyumluluk
  presets/*.json
  templates/*.json
  sections/                  # (genişletilebilir)
  blocks/                    # meta
  assets/
  translations/
```

**Loader:** `backend/services/wbJsonThemeLoader.js` — `settingsSchema`, `settingsData`, `presets`, `engineVersion` alanları pack’e eklenir.

**Lumiere ailesi:** `lumiere-fashion` + preset dosyaları (`lumiere-electronics`, … hedeflenen 6 varyasyon).

---

## 4. Store Editor V5

**Kabuk:** `ThemeEditorPage` + `editorVariant="v5"` + `storeBuilderV5.css`

| Kolon | Bileşen |
|-------|---------|
| Sol | `StoreEditorSectionTree` — sayfa ağacı, gizle/kopyala/taşı/sil |
| Orta | `StorePreviewFrame` — browser chrome, cihaz, zoom, 1440px canvas |
| Sağ | `StoreEditorPropertiesPanel` — İçerik / Tasarım / Mobil / Animasyon / Gelişmiş |

**Section Library:** `SectionLibraryPanel` — kategori bazlı, API registry’den beslenir (150+ hedef registry genişlemesiyle).

---

## 5. Global Design Studio

**Dosya:** `frontend/src/pages/storeBuilder/GlobalDesignStudio.js`

Renk, tipografi, header/footer ve token’lar — `saveThemeCustomizations` ile **tüm mağazaya** uygulanır.

---

## 6. Tasarım sistemi

**Merkezi CSS:** `frontend/src/styles/storeBuilder/storeBuilderV5.css`  
Global import: `frontend/src/index.js`  
Mevcut: `lysiaDesignSystem.css`, `wbPremiumUI.css` (editör studio)

---

## Kullanıcı akışı (ERP)

1. E-Ticaret → mağaza seç
2. Satış kanalı (globe) → **Mağaza Merkezi** (`ec-wb-center`)
3. Tema Özelleştir veya Store Editor → tam ekran V5 editör
4. Tema Mağazası → V5 marketplace

Sol menü (embedded): `WBSiteWorkspaceSidebar` → `SB_V5_WORKSPACE_NAV` (“Mağaza Platformu”).

---

## Sonraki iterasyonlar (bilinçli sınır)

- Drag-and-drop sıra: UI hazır, tam DnD kit entegrasyonu
- Sağ panel Tasarım/Mobil/Animasyon: sekme iskeleti; alanlar şema genişlemesiyle dolar
- 150+ section: registry’ye kategori etiketi + varyant üretim scripti
- Liquid/Shopify tema import: yok (bilinçli custom motor)

---

## Test

1. `npm start` (frontend) — hard refresh
2. E-Ticaret → globe → Mağaza Merkezi görünümü
3. Tema Mağazası → 450px+ kartlar
4. Store Editor → 3 kolon, browser frame, section library

Build: `cd frontend && npm run build`
