8 Haftalık Sprint Planı (2 aylık, 2 haftalık sprintler)

Sprint 0 — Hazırlık (1 hafta, kısa):
- Kod tabanı derin inceleme, deploy runbook, test mağaza örneği.
- Mimari kararları nihai kıl (Headless mi yoksa mevcut backend korunacak mı?).
- Prod/dev ortamları ve CI tanımları.

Sprint 1 (Hafta 1-2): Core API Stabilizasyon
- Ürün model + CRUD API'leri (backend)
- Koleksiyon/category API'leri
- Temel auth (JWT) ve admin role
- Basit Postman koleksiyonu

Sprint 2 (Hafta 3-4): Tema altyapısı & render engine
- Tema dosya yapısı spec'i finalize et
- Tema seed/import/export scriptleri (backend)
- Tema render path (storefront) — client-side renderer (React) MVP

Sprint 3 (Hafta 5-6): Tema Editor MVP (başlangıç)
- GrapesJS entegrasyonu frontend admin içine
- Blok kütüphanesi: hero, banner, product-grid, product-card
- Canlı önizleme proxy (frontend->backend)
- Tema kaydet/yeniden yükle

Sprint 4 (Hafta 7-8): Editor polish + publishing
- Block ayar panelleri JSON schema-driven
- Undo/redo + basit versiyonlama (tema sürümü 1.0)
- Tema staging/publish akışı
- E2E smoke test (wb:smoke script'i gibi)

Sprint 5 (Opsiyonel sonrası): Ödeme entegrasyonu + performans
- Stripe checkout demo
- CDN + asset storage (S3/MinIO) entegrasyonu
- Lighthouse perf hedefleri

Her sprint sonunda: demo, QA testi, deploy to staging.

Not: Bu plan MVP odaklıdır. Daha ileri özellikler (market, GitHub sync, metafields) sonraki roadmap'te yer alır.
