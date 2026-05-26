# Dashtock AWS — EC2 kurulum ve deploy

## Beraber kurulum (ilk kez)

Yerel PowerShell, proje kokunde:

```powershell
# 1) Baglanti ve sunucu durumu
powershell -File setup-ec2.ps1 -CheckOnly

# 2) Nginx, Node, PM2, firewall (sunucuda)
powershell -File setup-ec2.ps1 -RunBootstrap

# 3) React build + /var/www/html (Dashtock arayuzu)
powershell -File setup-ec2.ps1 -DeployFrontend
```

Tek komutta 2+3:

```powershell
powershell -File setup-ec2.ps1 -RunBootstrap -DeployFrontend
```

SSH timeout alirsaniz: AWS Console > Security Group > **22, 80, 443** acik; instance **Public IP** deploy scriptindeki ile ayni.

## EC2 tarayici terminali (Instance Connect)

**Burada PowerShell ve `D:\` calismaz** — sunucu Linux (Ubuntu).

| Yanlis (sunucuda) | Dogru |
|-------------------|--------|
| `cd D:\LysiaETIC` | `cd ~/LysiaETIC` |
| `powershell -File deploy-frontend.ps1` | Yerel **Windows** PowerShell'de calistirin |

**Sunucuda (SSH / Instance Connect):**

```bash
cd ~
bash -c "$(curl -fsSL https://raw.githubusercontent.com/LUNEX3D/LysiaETIC/main/scripts/deploy-on-server.sh)" 2>/dev/null || bash ~/LysiaETIC/scripts/deploy-on-server.sh
```

veya repo varsa:

```bash
cd ~/LysiaETIC && git pull origin main && bash scripts/deploy-on-server.sh
```

**Arayuz (React)** — build yerelde, sunucuya kopyalanir:

```powershell
# Kendi bilgisayarinizda (Windows)
cd D:\LysiaETIC
powershell -File deploy-frontend.ps1 -Server ubuntu@SUNUCU_IP
```

`benim-server` ornegi: `-Server ubuntu@13.60.214.195`

---

## Production sunucu

| | |
|--|--|
| **Aktif IP** | `13.60.214.195` |
| Deploy | `deploy.ps1` / `deploy-frontend.ps1` |

Yedek EC2 (`13.53.193.241`) kullanilmiyorsa DNS ve GitHub `AWS_HOST` eski IP'de kalsin; yeni instance'i Stop ederek maliyetten kurtulabilirsiniz.

Ileride tasima: `powershell -File migrate-ec2.ps1`

---

# "PAZARYONET AKTIF" veya bos sayfa

## Asil sebep

`frontend/build/` klasoru **.gitignore** icinde. Yani:

| Yaptiginiz | Sonuc |
|------------|--------|
| Sadece `git pull` + `pm2 restart` | Backend guncellenir, **site (React) guncellenmez** |
| Eski test dosyasi `/var/www/html/index.html` | **PAZARYONET AKTIF** gibi metin gorunur |
| Dogru: build + scp + nginx | **Dashtock** uygulamasi acilir |

## Cozum (tek komut)

PowerShell, proje kokunde:

```powershell
powershell -File deploy-frontend.ps1
```

IP/key farkliysa:

```powershell
powershell -File deploy-frontend.ps1 -Server ubuntu@EC2_IP -Key C:\path\key.pem
```

Tam deploy (frontend + backend + git):

```powershell
powershell -File deploy.ps1
```

Sadece arayuz, git atla:

```powershell
powershell -File deploy.ps1 -FrontendOnly
```

## AWS kontrol listesi

1. **Security Group:** 80, 443 acik (22 SSH)
2. **Nginx calisiyor:** `sudo systemctl status nginx`
3. **Dogru index:** `grep 'id="root"' /var/www/html/index.html`
4. **Backend:** `pm2 list` → backend online, port **5000** (80 degil)
5. **Cloudflare:** Origin = EC2 IP, SSL Full; 522 = origin kapali

## Mimari

```
Kullanici → :443 Nginx → /var/www/html (React build)
                    → /api/* → :5000 Node (pm2)
```

Port 80/443 **dogrudan Node'a** bagli olmamali.

## Ilk kurulum (sunucuda bir kez)

```bash
sudo apt update && sudo apt install -y nginx
sudo ufw allow 80,443,22/tcp
```

Sonra yerelden `deploy-frontend.ps1`.
