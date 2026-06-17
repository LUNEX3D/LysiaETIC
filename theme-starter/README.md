Lysia Theme Starter

Bu klasör, yeni bir tema geliştirirken başlangıç kullanmanız için minimal bir örnek içerir.

Yapı:
- config/schema.json — tema ayarları ve section/block tanımları (JSON)
- templates/index.json — sayfa şablonları (JSON)
- sections/*.json — section tanımları + varsayılan HTML
- assets/style.css — temel stiller

Kullanım (geliştirici):
1. Tema paketini ZIP yaparak backend'in import endpoint'ine gönderin veya `seed:themes` script'i ile yükleyin.
2. Admin -> Theme Editor içinde bu tema yüklendikten sonra GrapesJS veya custom renderer ile sectionları render edin.

Not: Bu sadece başlangıç amaçlıdır. Gerçek editör entegrasyonu için frontend tarafında GrapesJS blok adaptörleri ve backend'de tema manifest'i parse eden kod eklenmelidir.
