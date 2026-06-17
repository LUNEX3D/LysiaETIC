# E-Ticaret Platform V6

Shopify Admin × İkas — tek panel, tek sidebar, çevrimiçi mağaza + operasyon bir arada.

Araştırma özeti: `docs/ECOMMERCE_IKAS_SHOPIFY_RESEARCH.md`

## Bilgi mimarisi (İkas / Shopify uyumlu)

```
E-Ticaret
├── Mağazalarım (picker)
└── [Seçili mağaza]
    ├── Ana Sayfa (KPI + kurulum rehberi)
    ├── Tasarım (İkas Temalarım)
    │   ├── Temalarım → EcommerceIkasThemesPage
    │   ├── Tema ekle / Temayı düzenle / Renk ve font
    │   └── Menü, Mağaza merkezi, Blog
    ├── SEO ve alan adı
    │   ├── SEO, Domain, Lokalizasyon
    ├── Ürünler
    ├── Siparişler
    ├── Müşteriler
    ├── Pazarlama (indirimler)
    ├── Gelen kutusu
    ├── Analitik (mağaza API)
    └── Mağaza ayarları (ödeme, genel)
```

## Önce / sonra

| Önce (V5) | V6 |
|-----------|-----|
| İki sidebar (workspace + WB kanal) | Tek `EcommercePlatformSidebar` |
| `ec-wb-*` ayrı “kanal modu” | Çevrimiçi mağaza menü grubu |
| `ec-reports` → ERP analitik | `EcommerceStoreReportsPage` |
| `ec-settings` → kullanıcı ayarları | `EcommerceStoreSettingsHub` |

## Dosyalar

| Bileşen | Yol |
|---------|-----|
| IA | `frontend/src/constants/ecommercePlatform.js` |
| Kabuk | `frontend/src/components/ecommerce/platform/EcommercePlatformShell.js` |
| Sidebar | `frontend/src/components/ecommerce/platform/EcommercePlatformSidebar.js` |
| Topbar | `frontend/src/components/ecommerce/platform/EcommercePlatformTopbar.js` |
| Mağaza ayarları | `frontend/src/pages/ecommerce/platform/EcommerceStoreSettingsHub.js` |
| Analitik | `frontend/src/pages/ecommerce/platform/EcommerceStoreReportsPage.js` |
| Stil | `frontend/src/styles/ecommercePlatform.css` |
| Orchestration | `frontend/src/pages/UserDashboard.js` |

## Sonraki adımlar (çoklu mağaza)

- `WBSite.storeId` ↔ `Store` bağlantısı (site başına katalog/sipariş)
- Terk edilmiş sepet + fiyat listesi ekranları
- Legacy `store-*` router kaldırma
