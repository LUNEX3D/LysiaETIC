# Website Builder — Production Readiness Sprint

Son güncelleme: production hardening sprint (yeni özellik yok).

## 1. E2E akış denetimi

| Adım | API / UI | Durum |
|------|----------|--------|
| Site oluştur | `POST /sites` | Mevcut |
| Tema kur + materialize | `POST /sites/:id/theme/install` | Mevcut |
| Tema düzenle | Theme Editor panel | Mevcut |
| Domain bağla | `DomainCenter` | Mevcut |
| Yayınla | `POST /sites/:id/publish` | Mevcut |
| Popup | `PopupCenter` + public vitrin | MVP + analytics |
| Form | `FormCenter` + captcha | MVP + export |
| SEO | `SEOCenter` + head inject | Tamamlandı (sprint) |
| Sipariş | Store checkout (storeSlug) | WB vitrin → `/shop/:slug` |

Smoke script: `WB_SMOKE_TOKEN=… WB_SMOKE_SITE_ID=… npm run wb:smoke` (backend).

Manuel E2E: auth + yayınlanmış site slug ile vitrin URL doğrulanmalı.

## 2. SEO production ✅

- `WbStorefrontHead` — title, description, robots, OG, Twitter, canonical
- JSON-LD: Organization, Product, BlogPosting, BreadcrumbList
- Backend `buildSeoBundle` tüm public bundle’larda

## 3. Popup production ✅ (MVP+)

- `popup_view` / `popup_click` / `popup_close` → `WBConversionEvent`
- `GET /sites/:id/popup-analytics` — dönüşüm oranı
- A/B: `WBABTest` + `pickAbVariant` (popup testType)

## 4. Form production ✅ (MVP+)

- Math captcha: `GET …/form-captcha`
- Honeypot `_hp`, IP rate limit (30/saat)
- CSV: `GET …/form-submissions/export.csv`
- Analytics: `GET …/form-analytics`

## 5. Theme screenshot pipeline

- Playwright: `npm run themes:screenshots -- <slug>` (dev dependency: `playwright`)
- Tema kurulumunda arka planda spawn (`WB_SCREENSHOTS_ON_INSTALL=false` ile kapatılır)
- Eski mock: `generate-theme-preview-assets.js` — yedek

**Gereksinim:** Frontend + backend ayakta, site slug yayında.

## 6. Lighthouse (hedefler)

| Metrik | Hedef | Not |
|--------|-------|-----|
| Performance | >90 | Vitrin bundle, görseller, lazy load ölçülmeli |
| SEO | >95 | Head inject sonrası yeniden ölçüm |
| Accessibility | >90 | Kontrast, aria-label popup/menü |
| Best Practices | >90 | HTTPS, güvenli harici script |

Ölçüm: Chrome Lighthouse → `/site/<slug>` (yayın sonrası).

## 7. Security audit

| Risk | Önlem |
|------|--------|
| XSS (blog HTML) | `stripWbHtml` vitrin |
| Open redirect | `sanitizeRedirectTarget` |
| Form abuse | captcha + rate limit + honeypot |
| Popup abuse | frequency cookie + public track rate limit (mevcut analytics route) |
| Domain | `normalizeDomainInput` (wbSecurity) |
| CSRF | JWT API; public formlar captcha ile |
| HTML injection | Form alanları JSON; admin CSV escape |

## 8. Mobile audit

`frontend/src/styles/websiteBuilder/wbProductionMobile.css` — 390/768/1024 breakpoint.

Import edilen sayfalar: NavigationBuilder, FormCenter, PopupCenter, SEOCenter, ThemeMarketplace.

## 9. Technical debt & temizlik planı

### Kullanılmayan / legacy

| Öğe | Öneri |
|-----|--------|
| `NavigationEditor.js` | `NavigationBuilder` ile değiştirildi — sil (Faz 2) |
| `SEOSettings.js` | SEOCenter tab 0’da kullanılıyor — tut |
| JS tema `marketplace` slug + `legacy` tag | Katalogda gizli — dokümante |
| `ThemeCustomizerPage` vs Editor V2 | Birleştirme planı |
| Marketing popups (`MarketingPopupsPage`) | WB Popup’tan ayrı ürün — dokümante |

### Duplicate

- `ThemeMarketplace.js` vs `ThemeMarketplaceFullPage.js` — embedded vs full bleed
- İki render yolu: `BlockPreview` + `SectionRenderer` — tekilleştirme devam

### Gereksiz / eksik API

- `cloneThemeInstall` — UI eklendi ✅
- `WBABTest` admin UI — yok (sadece popup variant backend)
- Ürün URL sitemap — henüz yok

### Temizlik sırası (öneri)

1. `NavigationEditor.js` kaldır, import’ları doğrula  
2. Lighthouse ölç → performans quick wins (lazy images)  
3. Playwright CI job (staging URL)  
4. `WBABTest` admin UI veya feature flag kapat  
5. Sitemap’e ürün + canonical sayfa bazlı inject doğrulama  

---

## Değişen dosyalar (özet)

**Backend:** `wbSeoService.js`, `wbPublicService.js`, `wbPublicController.js`, `wbSecurity.js`, `wbFormCaptcha.js`, `wbFormService.js`, `wbPopupService.js`, `wbRedirectService.js`, `wbThemeVersionService.js`, `wbBuilderToolsController.js`, `websiteBuilderRoutes.js`, `wbPublicRoutes.js`, `capture-theme-screenshots-playwright.js`, `wb-e2e-smoke.js`

**Frontend:** `WbStorefrontHead.js`, `WbStorefrontSeoContext.js`, vitrin sayfaları, `wbTrackApi.js`, `WbStorefrontPopups.js`, `wbSafeHtml.js`, `wbProductionMobile.css`
