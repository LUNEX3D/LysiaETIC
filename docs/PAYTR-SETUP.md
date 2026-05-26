# PayTR — Dashtock ödeme kurulumu

Resmi dokümantasyon:

- [iFrame API 1. Adım](https://dev.paytr.com/iframe-api/iframe-api-1-adim)
- [iFrame API 2. Adım](https://dev.paytr.com/iframe-api/iframe-api-2-adim)
- [Direkt API 1. Adım](https://dev.paytr.com/direkt-api/direkt-api-1-adim) (yedek)

## Hangi entegrasyon?

| | **iFrame API (önerilen, varsayılan)** | **Direkt API (eski)** |
|---|--------------------------------------|------------------------|
| Akış | Backend `get-token` → iframe’de PayTR formu | Sizin sitede kart formu → `paytr.com/odeme` POST |
| Token | Sunucu `paytr_token` ile `get-token` çağırır | Formda `paytr_token` + kart alanları |
| Kart | PayTR iframe’inde girilir | Sizin modalınızda girilir |
| `payment_amount` | **Direkt:** ondalık TL (`1699.00`) · **iFrame:** kuruş (`169900`) |

Dashtock varsayılan: **`PAYTR_FLOW=iframe`** — ödeme PayTR’nin güvenli ekranında (çoğu mağazada bu yetki açıktır). **Direkt API** ayrı panel yetkisi ister; kapalıysa «Mağaza API yetkisi bulunmuyor» hatası alırsınız.

Taksit: `PAYTR_MAX_INSTALLMENT=12` (panelde açık taksit oranları gerekir). Kullanıcı ödeme ekranında Tek Çekim / 2–12 taksit seçer.

## Panel ayarları

1. **Bildirim URL:** `https://dashtock.com/api/paytr/callback` (site adresi ile aynı host; `www` karıştırmayın)
2. **Başarılı / Başarısız URL:** `.env` ile aynı
3. **iFrame API yetkisi** mağazada açık olmalı (Destek’ten talep edilebilir)

## Sunucu `.env` (git ile gitmez)

`git pull` PayTR anahtarlarını **taşımaz**. Windows’tan:

```powershell
cd D:\LysiaETIC
powershell -File scripts/sync-backend-env.ps1
```

veya `deploy.ps1` (backend `.env` otomatik SCP).

```env
PAYTR_MERCHANT_ID=...
PAYTR_MERCHANT_KEY=...
PAYTR_MERCHANT_SALT=...
PAYTR_OK_URL=https://dashtock.com/payment/success
PAYTR_FAIL_URL=https://dashtock.com/payment/failed
PAYTR_NOTIFY_URL=https://dashtock.com/api/paytr/callback
PAYTR_TEST_MODE=0
PAYTR_FLOW=iframe
PAYTR_MAX_INSTALLMENT=12
```

Direkt API (kendi kart formunuz) için panelden **Direkt API yetkisi** + `PAYTR_FLOW=direct`

```bash
pm2 restart backend
curl -s https://dashtock.com/api/paytr/health
```

`"paymentFlow":"iframe"` ve `"configured":true` olmalı.

## iFrame 1. Adım (kodda)

Backend `POST https://www.paytr.com/odeme/api/get-token`:

- `payment_amount` — kuruş (tam sayı)
- `user_basket` — base64(JSON)
- `paytr_token` — hash:  
  `merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode + salt`
- Yanıt: `{ "status":"success", "token":"..." }`

Frontend iframe:

`https://www.paytr.com/odeme/guvenli/{token}`

## Direkt API (varsayılan — `PAYTR_FLOW=direct`)

[1. Adım](https://dev.paytr.com/direkt-api/direkt-api-1-adim) — form `POST https://www.paytr.com/odeme`:

- `payment_amount` — **ondalık TL** (`1699.00`), kuruş değil
- `installment_count` — `0` tek çekim; taksit için `2`–`12`
- **Taksitli işlem:** `card_type` zorunlu → `POST /api/paytr/bin-lookup` (BIN → `brand`)
- iFrame taksit: `no_installment=0`, `max_installment=0` (paneldeki max taksit). Tek çekim zorunluysa `PAYTR_NO_INSTALLMENT=1`
- Taksit tablosu görünmüyorsa: PayTR panelinde taksit oranları tanımlı mı + `PAYTR_NO_INSTALLMENT` boş/0 olmalı
- Token hash: `merchant_id + user_ip + merchant_oid + email + payment_amount + payment_type + installment_count + currency + test_mode + non_3d`

## iFrame 2. Adım (callback — zaten var)

PayTR `Bildirim URL`’ye POST eder. Hash:

`merchant_oid + merchant_salt + status + total_amount` → HMAC → `OK` dönülür.

**Önemli:** PayTR’de başarılı ödeme alındıysa paket **admin onayı olmadan** otomatik açılır (sıra: **callback** → `verify-payment` → `sync-subscription`). Admin panelinde PayTR satırları «PayTR — otomatik» olarak görünür; yalnızca havale/manuel ödemeler için «Onayla» kullanılır.

## Durum Sorgu ([dev.paytr.com/durum-sorgu](https://dev.paytr.com/durum-sorgu))

Backend `POST https://www.paytr.com/odeme/durum-sorgu` — `paytr_token` = HMAC(`merchant_id + merchant_oid + merchant_salt`).

- `status: success` → ödeme PayTR’de başarılı; paket aktivasyonu yapılır.
- `err_msg` (ör. başarılı ödeme bulunamadı) → ödeme başarısız sayılır, kayıt `failed` olur.

Ödeme modalı kapatılırsa `POST /api/paytr/cancel-payment` — PayTR'de ödeme yoksa kayıt iptal edilir; paket **aktifleştirilmez**.

## İade API ([dev.paytr.com/iade-api](https://dev.paytr.com/iade-api))

Backend `POST https://www.paytr.com/odeme/iade` — `paytr_token` = HMAC(`merchant_id + merchant_oid + return_amount + merchant_salt`).

- `return_amount` — ondalık nokta ile TL (`1699.00`)
- Admin: `POST /api/saas-admin/payments/:id/refund` — body: `{ returnAmount?, refundReason?, referenceNo?, deactivateSubscription? }`
- PayTR başarılı olmadan veritabanında `refunded` yapılmaz
- Kısmi iade: `metadata.refundedTotal` güncellenir; tam iade sonrası `status: refunded`
- Tam iade + `deactivateSubscription: true` → kullanıcı aboneliği `expired`

## Ödeme onay e-postası

Ödeme tamamlanıp abonelik aktifleşince kullanıcıya **Resend** ile şık onay maili gider (`RESEND_API_KEY` gerekli).

- PayTR müşteriye PDF dekont API’si sunmaz; mailde **PayTR durum sorgusu** + callback verileriyle özet dekont tablosu yer alır.
- Aynı ödeme için mail yalnızca bir kez gönderilir (`metadata.paymentSuccessEmailSent`).

## Deploy

```bash
# Sunucu
cd ~/LysiaETIC && git pull && cd backend && pm2 restart backend
```

```powershell
# Windows frontend
cd D:\LysiaETIC
.\deploy-frontend.ps1
```

## Test

`PAYTR_TEST_MODE=1` + PayTR panel test kartları.

Hata `paytr_token gecersiz` (Direkt modda): hash ile POST `payment_amount` aynı kuruş olmalı (`direct_sync`).

Hata get-token’da: paneldeki Mağaza No / Key / Salt ile `.env` birebir olmalı.
