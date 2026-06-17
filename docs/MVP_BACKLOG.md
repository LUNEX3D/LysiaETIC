MVP Backlog — Tema-Editör odaklı e-ticaret platformu (MVP)

Hedef: Mağaza sahiplerinin teknik bilgiye ihtiyaç duymadan şık mağaza açıp, tema editörüyle sayfa/section/block oluşturabildiği temel ürün.

Core (kritik) işler:
1. API Stabilizasyon
  - Ürün CRUD, Koleksiyon/Category CRUD
  - Sipariş okuma/işleme (checkout flow minimal)
  - Müşteri auth (JWT), temel yetki
2. Tema altyapısı (render + paketleme)
  - Tema dosya yapısı standardı (config/schema.json, templates/, sections/, assets/)
  - Tema render engine — backend'de basit template renderer veya frontend client-side renderer
  - Tema seed/import/export scriptleri (ZIP/Git)
3. Tema Editor MVP
  - GrapesJS entegrasyonu ile blok-temelli sürükle-bırak canvas
  - Canlı önizleme (frontend geliştirme sunucusunda proxy ile)
  - Blok kütüphanesi: hero, product-grid, product-card, banner, footer, text
  - Block ayar paneli (JSON schema-driven)
  - Kaydet / Yayınla / Geri al (temel undo/redo + tema sürümü)
4. Asset yönetimi
  - S3/MinIO uyarlaması veya local storage için adaptör
  - Görsel yükleme, optimise (sharp)
5. Temalar için staging/publish flow
  - Tema taslağı -> test mağazasında önizleme -> publish
6. Ödeme (MVP için): harici ödeme sağlayıcı (Stripe) üzerinden checkout
7. Güvenlik ve temel ops
  - Helmet, rate-limit, validation
  - CDN cache planı (sonraki adım)

Ek (MVP sonrası):
- GitHub/Theme Market entegrasyonu, multi-store, çoklu dil, metafields, PWA optimizasyon.

Acceptance kriterleri (örnek):
- Admin panelden tema seçilip 5 dakikada mağaza temel sayfası oluşturulabilmeli.
- Tema editörde sayfa kaydedildiğinde canlı önizleme mağazada güncellenebilmeli.
- Ürün CRUD ile bir ürün eklenip storefront'da gözükebilmeli.

Tahmini süre: MVP (yukarıdaki core) = 3-4 ay (küçük ekip).
