Repo Hızlı Analizi

Özet (mevcut keşif):
- Backend: Node.js + Express. Kullanılan paketler: express, mongoose, ioredis, bullmq, helmet, swagger, sharp vs. (dosya: `backend/package.json`). MongoDB (mongoose) kullanılıyor.
- Frontend: React (Create React App + craco) ile geliştirilmiş bir SPA; ayrıca Capacitor mobil hedefleri var. GrapesJS ve @puckeditor gibi editör/drag&drop kütüphaneleri mevcut (dosya: `frontend/package.json`).
- Root seviyede bazı bağımlılıklar var (örnek: MUI, react-bootstrap) – ama ana frontend bağımlılıkları `frontend/package.json` içinde.
- Veritabanı: Kodda `mongoose` olduğu için MongoDB kullanımı açık.
- Asset/worker/scripts: Backend içinde worker ve tema ile ilgili scriptler (ör: `scripts/seed-theme-packs.js`, `generate-theme-preview-assets.js`, `capture-theme-screenshots-playwright.js`) var; bu, halihazırda bir tema altyapısı/preview mekanizması bulunduğunu gösteriyor.

İlk çıkarımlar / riskler:
- Mevcut sistem Node/React tabanlı ve temaya dair bazı işlemler (seed, preview, screenshot) zaten implement edilmiş — startup için avantaj.
- Backend MongoDB ile çalışıyor; headless GraphQL yok. Eğer headless önerisine devam edilecekse bir GraphQL katmanı veya API gateway eklenecek.
- Frontend CRA kullanıyor; ileride Next.js'e geçiş SEO/SSG için düşünülebilir.

Gerekli erişimler / sorular:
- Versiyon kontrol (Git) repo linkleri ve erişim.
- Çalışan instance bilgisi (DB bağlantı stringleri gizli olmadan), test mağaza verileri.
- Mevcut temaların örnekleri / `uploads`, `theme-packs` gibi klasörlerin içerikleri.
- Hedef trafik/işlem hacmi (ölçekleme planı için).

Sonraki adım: MVP backlog ve 8 haftalık sprint planı çıkaracağım, ardından repo içinde küçük bir "theme-starter" paketini scaffold'layıp size ekleyeceğim.
