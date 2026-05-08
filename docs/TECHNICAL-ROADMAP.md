# LysiaETIC — Teknik yol haritası (ürün senkronu & ödeme / abonelik)

Bu belge, iki ana modül için uygulanabilir bir sıra önerir. Mevcut kodla uyumlu adımlar; öncelik ve süre işletmenize bağlıdır.

---

## 1. Ürün senkronu (pazaryeri çekme, dağıtım, TY/HB batch)

### 1.1 Mevcut durum (özet)

- Tek marketplace çekme ve tüm marketplace toplu çekme, `async: true` ile **202 + `jobId`** dönebiliyor; ilerleme `GET /product-management/sync/job/:jobId` ile okunuyor.
- **BullMQ** isteğe bağlı: `REDIS_URL` + `SYNC_USE_BULLMQ=true` ve ayrı süreçte `npm run worker:sync`. API hızlı yanıt verir; iş worker’da çalışır.
- Bellek içi job store (`syncProgressStore`) tek pod / tek süreç için geçerlidir; BullMQ açıkken durum Redis + Bull job üzerinden gelir.

### 1.2 Kısa vadeli (1–2 sprint)

| Adım | Ne yapılır | Çıktı |
|------|------------|--------|
| A | Production’da Redis + worker sürecini tanımla (systemd, Docker Compose veya K8s Deployment ikinci container). | Uzun sync HTTP timeout olmadan tamamlanır. |
| B | Frontend’de tüm “uzun senkron” butonlarında `async: true` + `jobId` ile polling standardize et; tek bir `useSyncJob(jobId)` hook’u. | Tutarlı UX ve hata yönetimi. |
| C | `getSyncJobStatus` yanıtına `queue: "bull" \| "memory"` (isteğe bağlı) ekleyerek destek teşhisini kolaylaştır. | Operasyonel netlik. |
| D | TY/HB/N11 batch takip alanları (`trendyolBatchRequestId`, `hepsiburadaTrackingId`, vb.) için periyodik “pending kontrol” job’ını Bull **repeat** veya cron ile tek worker’da topla. | Kuyruk standardı tek yerde. |

### 1.3 Orta vadeli

- **Idempotency key**: Aynı kullanıcı + aynı marketplace için eşzamanlı çift “pull” isteğini Bull’da `jobId` veya dedup key ile engelle.
- **Hata sınıfları**: Pazaryeri rate limit / geçici ağ / kalıcı validasyon hatası ayrımı; retry stratejisi Bull `attempts` + backoff.
- **Gözlemlenebilirlik**: job `failed` olaylarında Sentry/log aggregation; kullanıcıya sade mesaj.

### 1.4 Uzun vadeli

- Çok kiracılı ortamda worker sayısını horizantal ölçekle; Redis cluster / managed Redis.
- Ağır işleri tür bazında ayırın (`product-pull`, `stock-push`, `category-refresh`) — ayrı kuyruk ve concurrency.

---

## 2. Ödeme ve abonelik (PayTR, SaaS admin, faturalama)

### 2.1 Mevcut durum (özet)

- PayTR callback ve abonelik akışları backend route’ları üzerinden işler.
- SaaS admin ve güvenlik olayları için `AuditLog` modeli kullanılıyor; kullanıcı **kendi şifre sıfırlama** sonrası için merkezi kayıt eklendi (`password_reset_self`).

### 2.2 Kısa vadeli

| Adım | Ne yapılır | Çıktı |
|------|------------|--------|
| A | Tüm abonelik oluşturma / güncelleme / iptal ve admin şifre sıfırlama yollarında `AuditLog` şemasını tekilleştir: `action`, `category`, `metadata` (planId, eski/yeni plan, ödeme referansı). | Tek raporlama dili. |
| B | Impersonation giriş/çıkışında zaten varsa `adminId`, `userId`, süre ve sebep alanlarını standardize et. | Güvenlik denetimi. |
| C | PayTR webhook/callback başarı ve red senaryolarında audit + kullanıcıya gösterilen mesajı ayır (teknik detay log’da). | Daha az veri sızıntısı riski. |

### 2.3 Orta vadeli

- **Ödeme durumu makinesi**: `pending` → `authorized` → `captured` / `failed` / `refunded` tek tablo veya event log.
- Abonelik periyodu ile ödeme periyodunu bağlayan **reconciliation** job’ı (günlük): eksik ödeme / fazla çekim tespiti.

### 2.4 Uzun vadeli

- İkinci ödeme sağlayıcı veya kurumsal fatura (e-Fatura) ile entegrasyon için ödeme katmanında adapter arayüzü.
- Admin panelde salt-okunur audit ekranı (filtre: kullanıcı, aksiyon, tarih).

---

## 3. Çapraz konular

- **CORS / origin**: Production’da sabit IP yerine `CORS_EXTRA_ORIGINS` ile yönetim.
- **Sipariş tarih penceresi**: Backend `ORDER_DEFAULT_WINDOW_DAYS` (varsayılan 7 gün); UI’da açılışta Son 7 gün, kullanıcı 30 / 90 veya manuel tarih seçebilir.
- **Mapping şeması**: `PRODUCT_MAPPING_REQUIRE_CATEGORY_ID=true` ile TY/HB/N11 listelenmiş kanallarda `categoryId` zorunluluğu (yumuşak geçiş için varsayılan kapalı).

Bu sıra, “önce gözlemlenebilirlik ve tek worker/queue modeli, sonra ürün ve ödeme domain derinliği” mantığıyla ilerler; ihtiyaç halinde tek modüle indirgenebilir.
