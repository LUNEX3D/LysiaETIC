# Website Builder — Caddy on-demand TLS (F2)

Müşteri `www.magaza.com` → `sites.lysia.com.tr` CNAME sonrası TLS bu katmanda üretilir.

## Gereksinimler

- 80/443 açık (UFW)
- Müşteri DNS: **DNS-only** (Cloudflare turuncu bulut kapalı) veya doğrudan origin IP
- Node `WB_SSL_INTERNAL_SECRET` ve ask URL ayarlı

## Ortam değişkenleri (Caddy / systemd)

| Değişken | Örnek |
|----------|--------|
| `WB_SSL_ASK_URL` | `http://127.0.0.1:5000/internal/wb/ssl/authorize` |
| `WB_SSL_UPSTREAM` | `127.0.0.1:8080` (Nginx veya Node static) |
| `ACME_EMAIL` | `ssl@lysia.com.tr` |

Caddy ask isteğine `X-WB-SSL-Internal-Secret` eklemek için Caddy v2.8+ `ask` URL yanında header desteği sınırlı olabilir; bu durumda ask yalnızca localhost’tan çağrılır (`wbSslInternalAuth` varsayılan).

## Kurulum özeti

```bash
sudo apt install -y caddy
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
# /etc/caddy/caddy.env içine WB_SSL_ASK_URL, WB_SSL_UPSTREAM, ACME_EMAIL
sudo systemctl reload caddy
```

## Akış

1. `WBDomain.status = ssl_provisioning` → Node worker warm-up + TLS probe
2. Caddy ilk HTTPS isteğinde ACME → `ask` → Node 200/403
3. Başarılı sertifika → Node `active` + `validTo` yazar
