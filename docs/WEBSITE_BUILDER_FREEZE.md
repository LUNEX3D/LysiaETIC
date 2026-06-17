# Website Builder — Feature Freeze (Bakım Modu)

**Durum:** Aktif — yeni geliştirme odağı ERP entegrasyonları, sipariş, stok, e-fatura ve LysiaBrain.

## Yasak (freeze süresince)

- Yeni Website Builder özelliği
- Yeni tema (starter, marketplace, şablon)
- Yeni builder modülü (popup/form/SEO/navigation vb. genişletme)
- Yeni marketplace / tema mağazası geliştirmesi
- UX “nice-to-have” ve backlog özellikleri

## İzin verilen (yalnızca P0)

| Kategori | Örnek |
|----------|--------|
| **Bug fix** | Canlıda kırık akış (form, yayın, vitrin, domain) |
| **Güvenlik** | XSS, open redirect, upload abuse, rate limit |
| **Performans** | Canlıyı etkileyen bundle / API / DB darboğazı |
| **Kritik production** | Smoke/Lighthouse blocker, veri kaybı, yayın engeli |

**Öncelik:** Yalnızca **P0**. P1/P2 ve teknik borç temizliği backlog’a; freeze kalkana kadar planlanmaz (istisna: kullanıcı açıkça P1 onayı verirse).

## Tamamlanan P0 sprint (referans)

- Vitrin form + captcha (`StorefrontContactBlock`)
- Vitrin HTML sanitize (`SectionRenderer` + `wbSafeHtml`)
- Public analytics rate limit + track route düzeltmesi
- Smoke: `npm run wb:smoke` (+ opsiyonel `WB_SMOKE_SITE_SLUG`)

Detay: `docs/WEBSITE_BUILDER_PRODUCTION_READINESS.md`

## Backlog

Audit fazındaki tüm yeni özellikler, tema, modül ve UX iyileştirmeleri **backlog**’da kalır. Freeze kalkmadan PR açılmaz.

## Aktif geliştirme odağı (LysiaETIC)

1. **Marketplace Integrations** — Trendyol, Hepsiburada, Amazon, N11, Çiçeksepeti, Ozon, Roketfy  
2. **Order Management** — sipariş yaşam döngüsü, kargo, iade, iptal, parçalı gönderim  
3. **Inventory Engine** — çok kanallı stok, rezervasyon, bundle, depo  
4. **E-Invoice** — e-Fatura, e-Arşiv, UBL, Sovos, QNB  
5. **LysiaBrain** — AI Operator, Automation, Suggestions, Analytics, Pricing, Inventory  

## Agent / PR kontrol listesi

- [ ] WB PR yalnızca P0 bug / güvenlik / performans / production mı?
- [ ] Yeni route, model, tema veya modül eklenmedi mi?
- [ ] Backlog özelliği “küçük ekleme” ile sızmadı mı?

**Freeze kaldırma:** Ürün sahibi açık onayı olmadan bu dosya güncellenmez.
