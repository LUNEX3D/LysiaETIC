# Hazır tema paketleri (İkas / Shopify tarzı)

## Katalog

- JSON paketler: `backend/data/themes/*/`
- GitHub referans meta: `backend/data/themes/github-theme-catalog.json`
- Ortak ayar şeması (TR): `backend/data/themes/_shared/settings_schema.tr.json`

Yeni paketler (Dawn / Craft / Sense referanslı):

| Slug | Referans |
|------|----------|
| `dawn-trade` | Shopify/dawn |
| `craft-boutique` | Shopify/craft |
| `spotlight-showcase` | Shopify/sense |

Lumiere ailesi preset’leri otomatik ayrı tema slug’ları olarak listelenir (`lumiere-electronics`, vb.).

## Kullanıcı akışı

1. **E-Ticaret** → mağaza → **Mağaza Merkezi**
2. Tema kartından **Kur** veya **Tema Mağazası**
3. **Tema stilleri** — renk, tipografi, header/footer; **Revizyonu kaydet**
4. **Store Editor** — bölüm ve sayfa düzeni

Backend’i yeniden başlatın; tema listesi önbelleği (`wbThemePackLoader`) böylece güncellenir.

## Not

Liquid Shopify temaları doğrudan çalışmaz; bölüm motoru Lysia `SectionRenderer` + JSON `templates/index.json` kullanır. GitHub referansları görsel ve yapı ilhamı içindir.
