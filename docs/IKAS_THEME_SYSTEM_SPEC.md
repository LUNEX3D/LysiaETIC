# İkas Tarzı Tema Sistemi — LysiaETIC

Referans: [İkas tema düzenleme rehberi](https://support.ikas.com/tr/start-paket-rehberi-kombos-temami-nasil-duzenlerim)

## Kullanıcı akışı (İkas ile aynı)

```
Satış Kanalları → Mağaza → Temalar
    → Temayı düzenle (birincil CTA)
    → Tema mağazası (hazır tema seç)
    → Kaydet → Tema hazırlanıyor → Yayınla → Canlı site
```

## Panel yapısı

| İkas | LysiaETIC |
|------|-----------|
| Temalar | `EcommerceIkasThemesPage` + `ikas-themes-page` |
| Tema mağazası | `ThemeMarketplaceV5Page` + `ikas-marketplace` |
| Tema editörü | `ThemeEditorPage` (v5 embedded) + `ikas-editor-root` |
| Tema ayarları (sol alt) | `IkasThemeSettingsDrawer` |
| Modül listesi + sürükle-bırak | `IkasModuleTree` |
| Anlık önizleme | `IkasLiveThemePreview` → `SectionRenderer` |

## Dosyalar

- `frontend/src/styles/ikas/ikasThemeSystem.css`
- `frontend/src/components/ikas/IkasEditorTopbar.js`
- `frontend/src/components/ikas/IkasModuleTree.js`
- `frontend/src/components/ikas/IkasThemeSettingsDrawer.js`
- `frontend/src/components/ikas/IkasLiveThemePreview.js`

## Sonraki adımlar

1. Tema screenshot pipeline (gradient mock tamamen kalksın)
2. Taslak önizleme URL (`?preview_token=`)
3. Legacy `ThemeCustomizerPage` / `GlobalDesignStudio` kaldırma
4. `WBSite ↔ Store` birleşimi
