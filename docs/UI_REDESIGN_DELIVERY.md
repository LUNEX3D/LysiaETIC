# Website Builder — UI Redesign Delivery (Özellik Yok, Sadece Kalite)

## Önce / Sonra (özet)

| Alan | Önce | Sonra |
|------|------|--------|
| Theme Editor | 2 sütun + yüzen panel; dar canvas; üstte form sekmeleri; gri admin hissi | **3 sütun:** ağaç \| tam genişlik mağaza \| sabit ayarlar; koyu studio + beyaz inspector |
| Canvas | ~%75 genişlik, çevrede boşluk | **%100 alan**, radial arka plan, cihaz toolbar canvas üstünde |
| Sol panel | 3 büyük sekme (form hissi) | Sayfa rail + Header/bölüm/Footer ağacı; Stil/Global altta küçük |
| Sağ panel | Altta kalan / boş “Bölüm seçin” kartı | Sabit sütun; kompakt boş durum; başlık seçili bölüm adı |
| Marketplace | Sıkışık kart listesi | Büyük screenshot (340px+), hover derinliği, tipografi |
| Diğer WB sayfaları | Varsayılan MUI kartları | Yuvarlatılmış kartlar, tutarlı buton stili |

---

## 1. Yeniden tasarlanan ekranlar

| Ekran | Kapsam |
|-------|--------|
| **Theme Editor** | Tam layout yeniden yapılandırma (`wbPremiumUI.css` + `ThemeEditorPage.js`) |
| **Theme Marketplace** | Kart, grid, toolbar, featured row (`wb-mp-page--premium`) |
| **Site Overview** | Kart ve header polish |
| **Site Analytics** | Workspace kart stili |
| **Domain Center** | Workspace kart stili |
| **Navigation Builder** | Workspace kart stili |
| **Form Center** | Workspace kart stili |
| **Popup Center** | Workspace kart stili |

Theme Settings (`ThemeCustomizerPage`) mevcut token studio CSS ile uyumlu; global `wbPremiumUI` kart kuralları uygulanır.

---

## 2. UX değişiklikleri

**Theme Editor**
- İlk odak: ortadaki canlı mağaza (form ikinci planda).
- Sayfa geçişi canvas üst şeridinden kaldırıldı → sol **page rail** (daha az dikkat dağıtıcı).
- Cihaz seçimi üst bardan kaldırıldı → **canvas toolbar** (Framer benzeri).
- Görünüm paketi / Header-Footer sekmeleri gizlendi → altta **Sayfa | Stil | Global** (daha az “admin form”).
- Sağ panel artık overlay değil; sürekli görünür **inspector sütunu** — ayarlar kaybolmuyor.

**Marketplace**
- Kart üzerinde masaüstü/mobil önizleme toggle (mevcut bileşen, görsel hiyerarşi güçlendirildi).
- Featured bölüm daha büyük vitrin.

**Genel**
- SEO / dil chip / gereksiz topbar öğeleri editörde gizlendi → daha sade üst çubuk.

---

## 3. Görsel kalite artışı

- Koyu **studio** arka plan + tam yükseklik storefront frame.
- Inspector: açık gri yüzey, ince tipografi, form alanları sadeleştirildi.
- Marketplace: 20px radius kartlar, güçlü hover gölgesi, 2 satır açıklama kırpımı.
- Tema farklılaşması: canvas `data-theme-slug` ile fashion / electronics / luxury vb. **font ve accent** CSS (renk kopyası değil, vitrin kişiliği).

---

## 4. Teknik (yeni özellik yok)

- Yeni dosya: `frontend/src/styles/websiteBuilder/wbPremiumUI.css`
- Dokunulan bileşenler: `ThemeEditorPage`, `ThemeEditorLivePreview`, `ThemeEditorRightPanel`, `ThemeMarketplaceFullPage`
- Global import: `frontend/src/index.js`

**Eklenmedi:** yeni tema, yeni section, yeni marketplace API, yeni ayar alanları.

---

## Profesyonellik testi (hedef)

| Soru | Theme Editor (sonra) | Marketplace (sonra) |
|------|----------------------|---------------------|
| İkas’ta görsem profesyonel der miyim? | Mağaza öncelikli layout → **evet, yakın** | Theme Store kart yoğunluğu → **evet, yakın** |
| Shopify’ta görsem? | Customizer + live preview → **kısmen evet** | Theme Store grid → **evet** |

Kalan boşluklar (bilerek sonraki iterasyon): tema screenshot asset’leri, gerçek crop medya UI, Theme Settings tam ekran Framer polish.
