# Website Builder — UX/UI Audit (İkas / Shopify karşılaştırma)

**Sprint:** UI/UX redesign only — fonksiyon ve API değişmez.  
**Referans:** İkas tema mağazası, tema editörü, mağaza özeti; Shopify Online Store / Theme Editor.

---

## Genel bulgular

| Alan | Mevcut | İkas/Shopify | Gap |
|------|--------|--------------|-----|
| Tasarım sistemi | Dağınık CSS (`wbIkas`, `wb-mp`, MUI karışık) | Tek token seti | Tutarsız spacing/renk |
| Bilgi mimarisi | İki giriş (WBLayout / ec-wb) | Tek mağaza merkezi | Kanalda eksik menü (önceki audit) |
| Yoğunluk | Form/popup liste + dialog | Studio 3 kolon | Düşük görsel hiyerarşi |

---

## 1. Theme Marketplace

**Mevcut:** Grid kartlar, 16:10 görsel, küçük aksiyon ikonları.  
**İkas:** Büyük mockup, net CTA hiyerarşisi (Önizle / Kur primary).  
**Gap:** Görsel alan küçük hissi; aksiyonlar aynı ağırlıkta; premium gölge/typography zayıf.

**Redesign:** 4:3 görsel, stacked CTA, badge hiyerarşisi, `wb-ds` kartları.

---

## 2. Theme Editor

**Mevcut:** 240 \| 1fr \| 280 grid, sol tab karma (Yapı/Tema/Global).  
**İkas:** Sol yapı ağacı, orta dominant preview, sağ ayarlar.  
**Gap:** Sol panel picker ile daralıyor; teknik tab hissi.

**Redesign:** Grid `200px minmax(0, 2fr) 248px`, canvas min-height, sağ panel “Ayarlar” başlığı.

---

## 3. Site Overview

**Mevcut:** Header + hızlı aksiyonlar + metrik grid.  
**İkas/Shopify:** Hero (durum, URL, yayın CTA) + KPI şeridi.  
**Gap:** Hero yok; mağaza durumu dağınık.

**Redesign:** `wb-overview-hero` — durum, domain, SSL, ziyaret, sipariş, tema tek bakışta.

---

## 4. Domain Center

**Mevcut:** Grid + DNS tablo (teknik).  
**İkas:** Adım adım sihirbaz.  
**Gap:** Stepper yok; kullanıcı sırası belirsiz.

**Redesign:** 4 adımlı görsel stepper (Domain → DNS → SSL → Yayın).

---

## 5. Analytics

**Mevcut:** 4 kart + 7/5 chart split.  
**İkas:** Üst KPI şeridi, büyük grafik, altta tablolar.  
**Gap:** Grafik alanı küçük; dönüşüm kartı yan panelde sıkışık.

**Redesign:** Tam genişlik grafik satırı, tablolar alt blok.

---

## 6. Popup Center

**Mevcut:** Dikey kart listesi + Dialog düzenleme.  
**Canva/İkas:** Sol liste, orta preview, sağ ayarlar.  
**Gap:** Studio layout yok.

**Redesign:** 3 kolon; dialog kaldırıldı, sağ panel inline ayar.

---

## 7. Form Center

**Mevcut:** Basit kartlar; cevaplar **tablo**.  
**Notion/Shopify:** Kart grid + durum pill.  
**Gap:** Cevaplar tablo ağır; form listesi düz.

**Redesign:** Durum pill’li kart grid; cevaplar kart listesi.

---

## Uygulama sırası (bu sprint)

1. `wbDesignSystem.css`  
2. Marketplace → Editor → Overview → Domain → Analytics → Popup → Form  
3. `wbIkasWorkspace.css` import design system
