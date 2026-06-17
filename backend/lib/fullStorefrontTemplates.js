"use strict";

const { mergeCfg } = require("./storefrontVerticalCatalog");

/**
 * Tam e-ticaret vitrin şablonu — header, hero, kategoriler, ürünler,
 * promo, özellikler, yorumlar, bülten, footer.
 */
function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function imgHtml(src, alt, className = "") {
    const cls = className ? ` class="${className}"` : "";
    return `<img${cls} src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" />`;
}

function headerNavHtml() {
    return `<nav class="ft-nav">
      <a href="/products">Ürünler</a>
      <a href="/collections">Koleksiyonlar</a>
      <a href="/blog">Blog</a>
      <a href="/about">Hakkımızda</a>
      <a href="/contact">İletişim</a>
    </nav>`;
}

function headerActionsHtml() {
    return `<div class="ft-header__search">
      <input type="search" placeholder="Ürün, kategori veya marka ara…" aria-label="Arama" />
      <button type="button" class="ft-header__search-btn" aria-label="Ara">⌕</button>
    </div>
    <div class="ft-header__actions">
      <a href="/login" class="ft-header__icon" title="Hesabım">👤</a>
      <a href="/wishlist" class="ft-header__icon" title="Favoriler">♡</a>
      <a href="/cart" class="ft-btn ft-btn--primary ft-header__cart">Sepet <span class="ft-header__cart-count">2</span></a>
    </div>`;
}

function parsePriceNum(price) {
    return parseInt(String(price || "").replace(/\D/g, ""), 10) || 0;
}

function installmentText(price) {
    const n = parsePriceNum(price);
    if (n < 300) return "";
    const monthly = Math.ceil(n / 12);
    return `<p class="ft-installment">12 x ₺${monthly.toLocaleString("tr-TR")}</p>`;
}

function productCardHtml(p, cfg, index = 0) {
    const assets = cfg._assets || {};
    const src = (assets.products || [])[index % (assets.products?.length || 1)] || "";
    const badge = p.badge ? `<span class="ft-product__badge">${esc(p.badge)}</span>` : "";
    const oldPrice = p.old ? `<s class="ft-price-old">${esc(p.old)}</s>` : "";
    const discount = p.old ? `<span class="ft-product__discount">-${Math.round((1 - parsePriceNum(p.price) / parsePriceNum(p.old)) * 100)}%</span>` : "";
    const swatches = `<div class="ft-product__swatches" aria-hidden="true"><span class="ft-color-swatch ft-color-swatch--black"></span><span class="ft-color-swatch ft-color-swatch--beige"></span><span class="ft-color-swatch ft-color-swatch--blue"></span></div>`;
    return `<article class="ft-product">
${badge}${discount}
<div class="ft-product__media">
  ${imgHtml(src, p.name, "ft-product__img")}
  <div class="ft-product__overlay">
    <button type="button" class="ft-product__action">Hızlı bak</button>
    <button type="button" class="ft-product__action ft-product__action--wish">♡</button>
  </div>
</div>
<div class="ft-product__rating" aria-hidden="true">★★★★★ <small>(${80 + (p.name.length % 200)})</small></div>
<h3><a href="/products/urun-${index + 1}">${esc(p.name)}</a></h3>
${swatches}
<p class="ft-price">${esc(p.price)} ${oldPrice}</p>
${installmentText(p.price)}
<p class="ft-product__stock">● Stokta — yarın kargoda</p>
<button type="button" class="ft-btn ft-btn--sm">Sepete ekle</button>
</article>`;
}

function productGridHtml(cfg, count = 8) {
    const products = (cfg._vertical && cfg._vertical.products) || [];
    return products.slice(0, count).map((p, i) => productCardHtml(p, cfg, i)).join("");
}

function homeCategoryGridHtml(cfg) {
    const cols = (cfg._vertical && cfg._vertical.collections) || [];
    const imgs = (cfg._assets && cfg._assets.collections) || [];
    return cols.slice(0, 4).map(([label, href], i) => (
        `<a href="${href}" class="ft-cat"><div class="ft-cat__img">${imgHtml(imgs[i] || "", label, "ft-cat__photo")}</div><span>${esc(label)}</span></a>`
    )).join("");
}

function collectionGridHtml(cfg) {
    const cols = (cfg._vertical && cfg._vertical.collections) || [];
    const imgs = (cfg._assets && cfg._assets.collections) || [];
    return cols.map(([label, href, desc], i) => (
        `<a href="${href}" class="ft-cat ft-cat--rich"><div class="ft-cat__img">${imgHtml(imgs[i] || "", label, "ft-cat__photo")}<span class="ft-cat__count">${12 + i * 3} ürün</span></div><span>${esc(label)}</span><small>${esc(desc || "")}</small></a>`
    )).join("");
}

function blogGridHtml(cfg) {
    const posts = (cfg._vertical && cfg._vertical.blog) || [];
    const imgs = (cfg._assets && cfg._assets.blog) || [];
    return posts.map(([title, cat, time, excerpt], i) => (
        `<article class="ft-blog-card"><a href="/blog/yazi" class="ft-blog-card__img">${imgHtml(imgs[i] || "", title, "ft-blog-card__photo")}</a><span class="ft-eyebrow">${esc(cat)}</span><h3><a href="/blog/yazi">${esc(title)}</a></h3><p class="ft-blog-card__excerpt">${esc(excerpt)}</p><p class="ft-blog-card__meta">${esc(time)} okuma · ${esc(cat)}</p><a href="/blog/yazi" class="ft-link">Devamını oku →</a></article>`
    )).join("");
}

function reviewsGridHtml(cfg) {
    const reviews = (cfg._assets && cfg._assets.reviews) || [];
    return reviews.map((r) => (
        `<blockquote class="ft-review"><div class="ft-review__head">${imgHtml(r.img, r.name, "ft-review__avatar")}<div><strong>${esc(r.name)}</strong><span class="ft-review__stars">${r.stars}</span></div></div><p>"${esc(r.text)}"</p></blockquote>`
    )).join("");
}

function teamGridHtml(cfg) {
    const team = (cfg._assets && cfg._assets.team) || [];
    return team.map((m) => (
        `<div class="ft-team-card">${imgHtml(m.img, m.name, "ft-team-card__photo")}<strong>${esc(m.name)}</strong><span>${esc(m.role)}</span></div>`
    )).join("");
}

function galleryGridHtml(cfg) {
    const imgs = (cfg._assets && cfg._assets.gallery) || [];
    return imgs.map((src, i) => (
        `<a href="/collections" class="ft-gallery__item">${imgHtml(src, `Galeri ${i + 1}`, "ft-gallery__photo")}</a>`
    )).join("");
}

function brandsRowHtml(cfg = {}) {
    const key = cfg._verticalKey || "general";
    const rows = {
        beauty: ["LOREAL", "MAC", "NARS", "CLINIQUE", "DIOR", "CHANEL"],
        fashion: ["VOGUE", "ZARA", "H&M", "COS", "MANGO", "BURBERRY"],
        electronics: ["APPLE", "SAMSUNG", "SONY", "ASUS", "LG", "DELL"],
        food: ["ORGANIC", "FRESH", "FARM", "GREEN", "NATURAL", "LOCAL"],
        furniture: ["IKEA", "WEST ELM", "MUJI", "HAY", "CB2", "CASPER"],
        kids: ["LEGO", "DISNEY", "FISHER", "CHICCO", "H&M KIDS", "CARTERS"],
        pet: ["ROYAL CANIN", "WHISKAS", "PEDIGREE", "FELIX", "PRO PLAN", "HILL'S"],
        sports: ["NIKE", "ADIDAS", "PUMA", "UNDER ARMOUR", "ASICS", "NEW BALANCE"],
        jewelry: ["TIFFANY", "CARTIER", "PANDORA", "SWAROVSKI", "BULGARI", "CHOPARD"],
        luxury: ["GUCCI", "PRADA", "HERMÈS", "BURBERRY", "BALENCIAGA", "DIOR"],
        digital: ["ADOBE", "FIGMA", "NOTION", "STRIPE", "VERCEL", "SHOPIFY"],
        marketplace: ["TRENDYOL", "AMAZON", "ETSY", "EBAY", "ALIEXPRESS", "WALMART"],
        general: ["VOGUE", "NIKE", "APPLE", "ZARA", "LOREAL", "IKEA"],
    };
    const brands = rows[key] || rows.general;
    return `<div class="ft-brands">${brands.map((b) => `<span class="ft-brands__item">${b}</span>`).join("")}</div>`;
}

function flashSaleHtml(cfg) {
    const p = (cfg._vertical?.products || [])[0];
    const src = (cfg._assets?.products || [])[0] || "";
    if (!p) return "";
    return `<section class="ft-flash"><div class="ft-wrap ft-flash__inner">
  <div class="ft-flash__media">${imgHtml(src, p.name, "ft-flash__img")}</div>
  <div class="ft-flash__copy">
    <span class="ft-eyebrow">⚡ Flaş indirim</span>
    <h2>${esc(p.name)}</h2>
    <p class="ft-flash__price">${esc(p.price)} ${p.old ? `<s>${esc(p.old)}</s>` : ""}</p>
    <div class="ft-countdown" aria-label="Kampanya süresi"><span><b>02</b>saat</span><span><b>45</b>dk</span><span><b>18</b>sn</span></div>
    <a href="/products" class="ft-btn ft-btn--primary ft-btn--lg">Hemen al</a>
  </div>
</div></section>`;
}

function colorSwatchesHtml(activeIdx = 1) {
    const colors = [
        ["black", "Siyah"],
        ["red", "Kırmızı"],
        ["blue", "Mavi"],
        ["white", "Beyaz"],
        ["green", "Yeşil"],
        ["beige", "Bej"],
    ];
    return colors.map(([cls, label], i) => (
        `<button type="button" class="ft-color-swatch ft-color-swatch--${cls}${i === activeIdx ? " is-active" : ""}" aria-label="${label}"></button>`
    )).join("");
}

function sizeFilterHtml() {
    return `<div class="ft-shop-filter"><h3>Beden</h3><div class="ft-size-grid"><button type="button">XS</button><button type="button">S</button><button type="button" class="is-active">M</button><button type="button">L</button><button type="button">XL</button></div></div>`;
}

function brandFilterHtml(cfg) {
    const brands = (cfg._vertical?.products || []).slice(0, 5).map((p) => p.name.split(" ")[0]);
    const unique = [...new Set(brands)].slice(0, 5);
    return `<div class="ft-shop-filter"><h3>Marka</h3><ul>${unique.map((b) => `<li><label class="ft-shop-check"><input type="checkbox" /> ${esc(b)}</label></li>`).join("")}</ul></div>`;
}

function ratingFilterHtml() {
    return `<div class="ft-shop-filter"><h3>Değerlendirme</h3><ul><li><label class="ft-shop-check"><input type="checkbox" /> ★★★★★ ve üzeri</label></li><li><label class="ft-shop-check"><input type="checkbox" /> ★★★★☆ ve üzeri</label></li></ul></div>`;
}

function productsSidebarHtml(cfg) {
    const vKey = cfg._verticalKey || "general";
    const cols = (cfg._vertical?.collections || []).slice(0, 6);
    const showSize = ["fashion", "luxury", "sports", "kids"].includes(vKey);
    const showColor = !["food", "digital", "marketplace", "pet"].includes(vKey);
    const showBrand = ["electronics", "digital", "beauty", "marketplace"].includes(vKey);
    const priceLabel = vKey === "food" ? "Fiyat (kg/adet)" : "Fiyat aralığı";

    let extra = "";
    if (vKey === "beauty") {
        extra = `<div class="ft-shop-filter"><h3>Cilt tipi</h3><ul><li><label class="ft-shop-check"><input type="checkbox" checked /> Karma / normal</label></li><li><label class="ft-shop-check"><input type="checkbox" /> Kuru</label></li><li><label class="ft-shop-check"><input type="checkbox" /> Yağlı</label></li><li><label class="ft-shop-check"><input type="checkbox" /> Hassas</label></li></ul></div>`;
    } else if (vKey === "food") {
        extra = `<div class="ft-shop-filter"><h3>Özellik</h3><ul><li><label class="ft-shop-check"><input type="checkbox" checked /> Organik</label></li><li><label class="ft-shop-check"><input type="checkbox" /> Glutensiz</label></li><li><label class="ft-shop-check"><input type="checkbox" /> Vegan</label></li></ul></div>`;
    } else if (vKey === "furniture") {
        extra = `<div class="ft-shop-filter"><h3>Oda</h3><ul>${["Oturma odası", "Yatak odası", "Ofis", "Bahçe"].map((r) => `<li><label class="ft-shop-check"><input type="checkbox" /> ${r}</label></li>`).join("")}</ul></div>`;
    }

    return `<aside class="ft-shop-sidebar">
  <div class="ft-shop-filter"><h3>Kategoriler</h3><ul>${cols.map(([l, h]) => `<li><a href="${h}">${esc(l)}</a></li>`).join("")}</ul></div>
  <div class="ft-shop-filter"><h3>${priceLabel}</h3><div class="ft-range"><input type="range" min="0" max="5000" value="2500" aria-label="Fiyat aralığı" /><div class="ft-range__labels"><span>₺0</span><span>₺5.000+</span></div></div></div>
  ${showBrand ? brandFilterHtml(cfg) : ""}
  ${extra}
  ${showSize ? sizeFilterHtml() : ""}
  ${showColor ? `<div class="ft-shop-filter"><h3>Renk</h3><div class="ft-color-grid">${colorSwatchesHtml()}</div></div>` : ""}
  ${ratingFilterHtml()}
  <button type="button" class="ft-btn ft-btn--outline ft-shop-filter__apply">Filtreleri uygula</button>
</aside>`;
}

function productsToolbarHtml(count) {
    return `<div class="ft-shop-toolbar">
  <p class="ft-shop-results"><strong>${count}</strong> ürün listeleniyor</p>
  <div class="ft-shop-toolbar__actions">
    <label class="ft-shop-sort">Sırala
      <select aria-label="Sıralama"><option>Öne çıkanlar</option><option>En yeni</option><option>Fiyat: Artan</option><option>Fiyat: Azalan</option><option>En çok satan</option></select>
    </label>
    <div class="ft-shop-view"><button type="button" class="is-active" title="Izgara">⊞</button><button type="button" title="Liste">☰</button></div>
  </div>
</div>`;
}

function productsPageHtml(cfg) {
    const merged = mergeCfg(cfg);
    const shellStart = buildPageShellStart(merged);
    const shellEnd = buildPageShellEnd(merged);
    const productCount = (merged._vertical?.products || []).length;
    const listCount = Math.min(productCount, 12);

    return `${shellStart}
${pageHeroHtml("<h1>Tüm ürünler</h1>", esc(`Katalogumuzda ${productCount}+ ürün — filtreleyin, karşılaştırın, sepete ekleyin.`), breadcrumbHtml([["Ana Sayfa", "/"], ["Ürünler", "/products"]]))}
<section class="ft-products ft-products--shop"><div class="ft-wrap ft-shop-layout">
${productsSidebarHtml(merged)}
<div class="ft-shop-main">
${productsToolbarHtml(listCount)}
${filterChipsHtml()}
<div class="ft-product-grid ft-product-grid--shop">${productGridHtml(merged, 12)}</div>
${paginationHtml()}
<div class="ft-shop-trust"><span>✓ Ücretsiz iade 14 gün</span><span>✓ Orijinal ürün garantisi</span><span>✓ Aynı gün kargo</span></div>
</div>
</div></section>
${shellEnd}`;
}

function footerExtrasHtml() {
    return `<div class="ft-wrap ft-footer__extras">
  <div class="ft-footer__payments"><span>Ödeme yöntemleri:</span>
    <span class="ft-pay-badge">Visa</span><span class="ft-pay-badge">Mastercard</span>
    <span class="ft-pay-badge">Troy</span><span class="ft-pay-badge">Apple Pay</span>
  </div>
  <div class="ft-footer__social">
    <a href="#" aria-label="Instagram">Instagram</a>
    <a href="#" aria-label="Facebook">Facebook</a>
    <a href="#" aria-label="X">X</a>
    <a href="#" aria-label="YouTube">YouTube</a>
  </div>
</div>`;
}

function breadcrumbHtml(items) {
    const crumbs = items.map(([label, href], i) => {
        if (i === items.length - 1) return `<span>${esc(label)}</span>`;
        return `<a href="${href}">${esc(label)}</a>`;
    }).join('<span class="ft-breadcrumb__sep">/</span>');
    return `<nav class="ft-breadcrumb" aria-label="Breadcrumb">${crumbs}</nav>`;
}

function filterChipsHtml() {
    const chips = ["Tümü", "Yeni", "İndirim", "Çok Satan", "Premium"];
    return `<div class="ft-filter-bar">${chips.map((c, i) => (
        `<button type="button" class="ft-filter-chip${i === 0 ? " ft-filter-chip--active" : ""}">${c}</button>`
    )).join("")}</div>`;
}

function checkoutFormHtml(cfg) {
    const items = (cfg._vertical && cfg._vertical.cartItems) || [];
    const subtotal = items.reduce((sum, [, p]) => sum + parseInt(String(p).replace(/\D/g, ""), 10), 0);
    const shipping = subtotal >= 500 ? 0 : 49;
    const total = subtotal + shipping;
    const fmt = (n) => `₺${n.toLocaleString("tr-TR")}`;
    const summaryRows = items.map(([label, price]) => (
        `<div class="ft-checkout-summary__row"><span>${esc(label)} × 1</span><span>${esc(price)}</span></div>`
    )).join("");
    return `<div class="ft-checkout-layout">
<div class="ft-checkout-main">
<form class="ft-checkout-form">
  <h3>İletişim bilgileri</h3>
  <input type="email" placeholder="E-posta adresiniz" />
  <input type="tel" placeholder="Telefon (opsiyonel)" />
  <h3>Teslimat adresi</h3>
  <input type="text" placeholder="Ad Soyad" />
  <input type="text" placeholder="Adres satırı 1" />
  <input type="text" placeholder="İl / İlçe" />
  <input type="text" placeholder="Posta kodu" />
  <select><option>Türkiye</option></select>
  <h3>Ödeme yöntemi</h3>
  <label class="ft-checkout-radio"><input type="radio" name="pay" checked /> Kredi / banka kartı</label>
  <label class="ft-checkout-radio"><input type="radio" name="pay" /> Kapıda ödeme</label>
  <input type="text" placeholder="Kart numarası" />
  <div class="ft-checkout-card-row"><input type="text" placeholder="AA/YY" /><input type="text" placeholder="CVV" /></div>
</form>
</div>
<aside class="ft-checkout-summary">
  <h3>Sipariş özeti</h3>
  ${summaryRows}
  <div class="ft-checkout-summary__row"><span>Ara toplam</span><span>${fmt(subtotal)}</span></div>
  <div class="ft-checkout-summary__row"><span>Kargo</span><span>${shipping === 0 ? "Ücretsiz" : fmt(shipping)}</span></div>
  <div class="ft-checkout-summary__total"><span>Toplam</span><strong>${fmt(total)}</strong></div>
  <button type="button" class="ft-btn ft-btn--primary ft-btn--lg ft-checkout-pay">Siparişi tamamla</button>
  <p class="ft-checkout-trust">🔒 256-bit SSL · Güvenli ödeme · 14 gün iade garantisi</p>
</aside>
</div>`;
}

function cartTableHtml(cfg) {
    const items = (cfg._vertical && cfg._vertical.cartItems) || [];
    const thumbs = (cfg._assets && cfg._assets.products) || [];
    const rows = items.map(([label, price], i) => (
        `<div class="ft-cart-row"><div class="ft-cart-row__thumb">${imgHtml(thumbs[i] || "", label, "ft-cart-row__photo")}</div><div class="ft-cart-row__info"><strong>${esc(label)}</strong><small>Stokta — 1–3 gün kargo</small><a href="/products" class="ft-link" style="font-size:.75rem">Düzenle</a></div><div class="ft-cart-row__qty"><button type="button">−</button><span>1</span><button type="button">+</button></div><strong class="ft-cart-row__price">${esc(price)}</strong></div>`
    )).join("");
    const subtotal = items.reduce((sum, [, p]) => sum + parseInt(String(p).replace(/\D/g, ""), 10), 0);
    const shipping = subtotal >= 500 ? "Ücretsiz" : "₺49";
    const total = subtotal + (shipping === "Ücretsiz" ? 0 : 49);
    const fmt = (n) => `₺${n.toLocaleString("tr-TR")}`;
    return `<div class="ft-cart-panel">
${rows}
<div class="ft-cart-promo"><input type="text" placeholder="İndirim kodu" /><button type="button" class="ft-btn ft-btn--outline">Uygula</button></div>
<div class="ft-cart-summary">
  <div><span>Ara toplam</span><span>${fmt(subtotal)}</span></div>
  <div><span>Kargo</span><span>${shipping}</span></div>
  <div class="ft-cart-summary__total"><strong>Toplam</strong><strong>${fmt(total)}</strong></div>
</div>
<a href="/checkout" class="ft-btn ft-btn--primary ft-btn--lg ft-cart-checkout">Ödemeye geç</a>
<p class="ft-cart-note">🔒 Güvenli ödeme · 256-bit SSL · 14 gün iade garantisi</p>
</div>`;
}

function statsRowHtml() {
    return `<div class="ft-stats-row">
  <div><strong>50K+</strong><span>Mutlu müşteri</span></div>
  <div><strong>4.8</strong><span>Mağaza puanı</span></div>
  <div><strong>1–3 gün</strong><span>Ortalama teslimat</span></div>
  <div><strong>7/24</strong><span>Canlı destek</span></div>
</div>`;
}

function pageHeroHtml(title, subtitle, breadcrumb) {
    return `<section class="ft-page-hero"><div class="ft-wrap">${breadcrumb}${title}<p class="ft-page-hero__sub">${subtitle}</p></div></section>`;
}

function homeTopHtml(merged) {
    const brand = esc(merged.brand || "LYSIA");
    const promo = esc(merged.promoText);
    return `<div class="ft-root" data-theme="${esc(merged.style || "modern")}" data-layout="${esc(merged.layout || "full")}">
<div class="ft-promo">${promo} <a href="/collections/indirim" class="ft-promo__link">Detaylar →</a></div>
<header class="ft-header">
  <div class="ft-wrap ft-header__inner">
    <a href="/" class="ft-logo">${brand}</a>
    ${headerNavHtml()}
    ${headerActionsHtml()}
  </div>
</header>`;
}

function homeHeroHtml(merged) {
    const tagline = esc(merged.tagline);
    const heroTitle = esc(merged.heroTitle || "Sezonun en yeni koleksiyonu");
    const heroSub = esc(merged.heroSub);
    const heroImg = (merged._assets && merged._assets.hero) || "";
    const boutique = merged.style === "boutique";
    const compact = merged.layout === "showcase" || merged.layout === "minimal";
    const heroClass = boutique ? "ft-hero ft-hero--boutique" : compact ? "ft-hero ft-hero--compact" : "ft-hero";
    return `<section class="${heroClass}">
  <div class="ft-wrap ft-hero__grid">
    <div class="ft-hero__copy">
      <span class="ft-eyebrow">${tagline}</span>
      <h1>${heroTitle}</h1>
      <p>${heroSub}</p>
      <div class="ft-hero__badges"><span>✓ Orijinal ürün</span><span>✓ Aynı gün kargo</span><span>✓ 14 gün iade</span></div>
      <div class="ft-hero__cta">
        <a href="/products" class="ft-btn ft-btn--primary ft-btn--lg">Alışverişe başla</a>
        <a href="/collections" class="ft-btn ft-btn--outline ft-btn--lg">Koleksiyonları keşfet</a>
      </div>
    </div>
    <div class="ft-hero__visual">${imgHtml(heroImg, heroTitle, "ft-hero__photo")}</div>
  </div>
</section>`;
}

function homeTrustHtml() {
    return `<section class="ft-trust">
  <div class="ft-wrap ft-trust__grid">
    <div class="ft-trust__item"><span>🚚</span><strong>Hızlı kargo</strong><small>1–3 iş günü</small></div>
    <div class="ft-trust__item"><span>🔒</span><strong>Güvenli ödeme</strong><small>256-bit SSL</small></div>
    <div class="ft-trust__item"><span>↩</span><strong>Kolay iade</strong><small>14 gün garanti</small></div>
    <div class="ft-trust__item"><span>💬</span><strong>7/24 destek</strong><small>Canlı yardım</small></div>
  </div>
</section>`;
}

function homeCategoriesHtml(merged, title = "Popüler kategoriler", limit = 4) {
    const cols = (merged._vertical && merged._vertical.collections) || [];
    const imgs = (merged._assets && merged._assets.collections) || [];
    const items = cols.slice(0, limit).map(([label, href], i) => (
        `<a href="${href}" class="ft-cat"><div class="ft-cat__img">${imgHtml(imgs[i] || "", label, "ft-cat__photo")}</div><span>${esc(label)}</span></a>`
    )).join("");
    return `<section class="ft-categories"><div class="ft-wrap"><h2>${esc(title)}</h2><div class="ft-cat-grid">${items}</div></div></section>`;
}

function homeProductsHtml(merged, count = 8, title = "Öne çıkan ürünler") {
    return `<section class="ft-products"><div class="ft-wrap"><div class="ft-section-head"><h2>${esc(title)}</h2><a href="/products" class="ft-link">Tümünü gör →</a></div><div class="ft-product-grid">${productGridHtml(merged, count)}</div></div></section>`;
}

function homeSplitHtml(merged) {
    const splitCol = (merged._vertical.collections[4] || merged._vertical.collections[0] || ["Koleksiyon", "/collections", ""])[0];
    const splitImg = (merged._assets && merged._assets.split) || "";
    return `<section class="ft-split"><div class="ft-wrap ft-split__inner"><div class="ft-split__visual">${imgHtml(splitImg, "Kampanya", "ft-split__photo")}</div><div class="ft-split__copy"><span class="ft-eyebrow">Sınırlı süre</span><h2>%30'a varan indirim</h2><p>${esc(splitCol)} ve seçili ürünlerde geçerli. Stoklar tükenmeden yakalayın.</p><ul class="ft-split__list"><li>Ücretsiz kargo 500 ₺ üzeri</li><li>12 aya varan taksit</li><li>Hediye paketleme seçeneği</li></ul><a href="/collections/indirim" class="ft-btn ft-btn--primary">İndirimleri gör</a></div></div></section>`;
}

function homeFeaturesHtml(merged) {
    const brand = esc(merged.brand || "LYSIA");
    return `<section class="ft-features"><div class="ft-wrap"><h2>Neden ${brand}?</h2><div class="ft-feature-grid"><div class="ft-feature"><h3>Kalite garantisi</h3><p>Her ürün titizlikle seçilir ve test edilir.</p></div><div class="ft-feature"><h3>Sürdürülebilir paketleme</h3><p>Çevre dostu ambalaj ve karbon nötr kargo.</p></div><div class="ft-feature"><h3>Ücretsiz iade</h3><p>14 gün içinde koşulsuz iade hakkı.</p></div></div></div></section>`;
}

function homeReviewsHtml(merged) {
    return `<section class="ft-reviews"><div class="ft-wrap"><h2>Müşterilerimiz ne diyor?</h2><div class="ft-review-grid">${reviewsGridHtml(merged)}</div></div></section>`;
}

function homeGalleryHtml(merged) {
    const brand = esc(merged.brand || "LYSIA");
    return `<section class="ft-gallery"><div class="ft-wrap"><div class="ft-section-head"><h2>@ ${brand} Instagram</h2><a href="#" class="ft-link">Takip et →</a></div><div class="ft-gallery__grid">${galleryGridHtml(merged)}</div></div></section>`;
}

function homeNewsletterHtml() {
    return `<section class="ft-newsletter"><div class="ft-wrap ft-newsletter__box"><h2>Kampanyalardan haberdar olun</h2><p>İlk siparişinizde %10 indirim kuponu e-postanıza gelsin.</p><form class="ft-newsletter__form"><input type="email" placeholder="E-posta adresiniz" /><button type="button" class="ft-btn ft-btn--primary">Abone ol</button></form></div></section>`;
}

function homeFooterHtml(merged) {
    const brand = esc(merged.brand || "LYSIA");
    return `<footer class="ft-footer">
  <div class="ft-wrap ft-footer__grid">
    <div><strong class="ft-logo">${brand}</strong><p>${esc(merged.aboutExtra || "Premium online alışveriş deneyimi.")}</p></div>
    <div><h4>Mağaza</h4><a href="/products">Ürünler</a><a href="/collections">Koleksiyonlar</a><a href="/blog">Blog</a></div>
    <div><h4>Destek</h4><a href="/faq">SSS</a><a href="/contact">İletişim</a><a href="/shipping">Kargo</a></div>
    <div><h4>Yasal</h4><a href="/privacy">Gizlilik</a><a href="/terms">Şartlar</a><a href="/returns">İade</a></div>
  </div>
  ${footerExtrasHtml()}
  <div class="ft-wrap ft-footer__bottom"><span>© ${new Date().getFullYear()} ${brand}. Tüm hakları saklıdır.</span><span class="ft-footer__apps">📱 iOS &amp; Android uygulaması yakında</span></div>
</footer>
</div>`;
}

function buildFullHtml(cfg) {
    const merged = mergeCfg(cfg);
    const layout = merged.layout || "full";
    const parts = [homeTopHtml(merged), homeHeroHtml(merged)];

    if (layout === "minimal") {
        parts.push(homeTrustHtml(), homeProductsHtml(merged, 6, "Seçkin ürünler"), homeNewsletterHtml(), homeFooterHtml(merged));
        return parts.join("");
    }

    if (layout === "showcase") {
        parts.push(
            homeTrustHtml(),
            homeProductsHtml(merged, 12, "Vitrin ürünleri"),
            homeCategoriesHtml(merged, "Kategoriler"),
            homeSplitHtml(merged),
            homeReviewsHtml(merged),
            homeNewsletterHtml(),
            homeFooterHtml(merged)
        );
        return parts.join("");
    }

    if (layout === "marketplace") {
        parts.push(
            statsRowHtml(),
            homeCategoriesHtml(merged, "Tüm kategoriler", 8),
            homeProductsHtml(merged, 8, "Günün fırsatları"),
            flashSaleHtml(merged),
            homeSplitHtml(merged),
            brandsRowHtml(merged),
            homeReviewsHtml(merged),
            homeNewsletterHtml(),
            homeFooterHtml(merged)
        );
        return parts.join("");
    }

    parts.push(
        flashSaleHtml(merged),
        homeTrustHtml(),
        homeCategoriesHtml(merged),
        homeProductsHtml(merged, 8),
        homeSplitHtml(merged),
        brandsRowHtml(merged),
        homeFeaturesHtml(merged),
        homeReviewsHtml(merged),
        homeGalleryHtml(merged),
        homeNewsletterHtml(),
        homeFooterHtml(merged)
    );
    return parts.join("");
}

function buildFullCss(cfg) {
    const p = cfg.primary || "#0f172a";
    const a = cfg.accent || "#6366f1";
    const bg = cfg.background || "#ffffff";
    const text = cfg.text || "#0f172a";
    const muted = cfg.muted || "#64748b";
    const surface = cfg.surface || "#f8fafc";
    const radius = cfg.radius || "12px";
    const fontH = cfg.fontHeading || "'Inter', system-ui, sans-serif";
    const fontB = cfg.fontBody || "'Inter', system-ui, sans-serif";
    const dark = cfg.style === "dark";

    const headerBg = dark ? "#0b1220" : bg;
    const headerBorder = dark ? "rgba(255,255,255,.08)" : "#e2e8f0";
    const heroBg = dark
        ? `linear-gradient(135deg, ${p} 0%, #1e293b 100%)`
        : `linear-gradient(135deg, ${surface} 0%, ${bg} 100%)`;

    return `
.ft-root{font-family:${fontB};color:${dark ? "#e2e8f0" : text};background:${dark ? "#0f172a" : bg};line-height:1.5}
.ft-wrap{max-width:1200px;margin:0 auto;padding:0 24px}
.ft-promo{background:${a};color:#fff;text-align:center;padding:10px 16px;font-size:.8125rem;font-weight:600}
.ft-header{background:${headerBg};border-bottom:1px solid ${headerBorder};position:sticky;top:0;z-index:40}
.ft-header__inner{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px;flex-wrap:wrap}
.ft-logo{font-family:${fontH};font-weight:800;font-size:1.25rem;color:${dark ? "#fff" : text};text-decoration:none;letter-spacing:-.02em}
.ft-nav{display:flex;gap:20px;flex-wrap:wrap}
.ft-nav a{color:${dark ? "rgba(255,255,255,.75)" : muted};text-decoration:none;font-size:.875rem;font-weight:500}
.ft-nav a:hover{color:${dark ? "#fff" : text}}
.ft-header__actions{display:flex;gap:8px}
.ft-btn{border:none;border-radius:999px;padding:10px 18px;font-size:.875rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-family:inherit}
.ft-btn--primary{background:${p};color:#fff}
.ft-btn--outline{background:transparent;border:2px solid ${p};color:${p}}
.ft-btn--ghost{background:transparent;color:${dark ? "#fff" : text}}
.ft-btn--lg{padding:14px 28px;font-size:1rem}
.ft-btn--sm{padding:8px 14px;font-size:.8125rem;width:100%;margin-top:8px}
.ft-hero{padding:72px 0;background:${heroBg}}
.ft-hero__grid{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
.ft-hero__copy h1{font-family:${fontH};font-size:clamp(2rem,4vw,3.25rem);line-height:1.1;margin:12px 0 16px;color:${dark ? "#fff" : text}}
.ft-hero__copy p{font-size:1.125rem;color:${dark ? "rgba(255,255,255,.8)" : muted};max-width:520px;margin:0 0 28px}
.ft-eyebrow{display:inline-block;text-transform:uppercase;letter-spacing:.12em;font-size:.6875rem;font-weight:700;color:${a}}
.ft-hero__cta{display:flex;gap:12px;flex-wrap:wrap}
.ft-hero__visual{min-height:320px;border-radius:${radius};background:linear-gradient(135deg,${a}33,${p}22);border:1px solid ${headerBorder}}
.ft-trust{padding:28px 0;background:${dark ? "#111827" : surface};border-block:1px solid ${headerBorder}}
.ft-trust__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center}
.ft-trust__item span{font-size:1.5rem;display:block;margin-bottom:6px}
.ft-trust__item strong{display:block;font-size:.875rem;color:${dark ? "#fff" : text}}
.ft-trust__item small{font-size:.75rem;color:${muted}}
.ft-categories,.ft-products,.ft-features,.ft-reviews{padding:64px 0}
.ft-categories h2,.ft-products h2,.ft-features h2,.ft-reviews h2{font-family:${fontH};font-size:1.75rem;margin:0 0 28px;color:${dark ? "#fff" : text}}
.ft-cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.ft-cat{text-decoration:none;color:inherit;text-align:center}
.ft-cat__img{aspect-ratio:4/5;border-radius:${radius};background:${dark ? "#1e293b" : surface};margin-bottom:10px;border:1px solid ${headerBorder}}
.ft-cat span{font-weight:600;font-size:.875rem;color:${dark ? "#e2e8f0" : text}}
.ft-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:12px}
.ft-link{color:${a};text-decoration:none;font-weight:600;font-size:.875rem}
.ft-product-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.ft-product{border:1px solid ${headerBorder};border-radius:${radius};padding:0 0 14px;background:${dark ? "#111827" : bg};overflow:hidden}
.ft-product__img{aspect-ratio:1;background:${dark ? "#1e293b" : surface}}
.ft-product h3{font-size:.9375rem;margin:12px 14px 4px;color:${dark ? "#fff" : text}}
.ft-price{margin:0 14px 8px;font-weight:700;color:${dark ? "#fff" : text}}
.ft-split{padding:64px 0;background:${dark ? "#111827" : surface}}
.ft-split__inner{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center}
.ft-split__visual{min-height:280px;border-radius:${radius};background:linear-gradient(135deg,${p},${a})}
.ft-split__copy h2{font-family:${fontH};font-size:2rem;margin:8px 0 12px;color:${dark ? "#fff" : text}}
.ft-split__copy p{color:${muted};margin-bottom:20px}
.ft-feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.ft-feature{padding:24px;border-radius:${radius};background:${dark ? "#0f172a" : bg};border:1px solid ${headerBorder}}
.ft-feature h3{margin:0 0 8px;font-size:1rem;color:${dark ? "#fff" : text}}
.ft-feature p{margin:0;color:${muted};font-size:.875rem}
.ft-review-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.ft-review{margin:0;padding:20px;border-radius:${radius};background:${dark ? "#111827" : bg};border:1px solid ${headerBorder}}
.ft-review p{margin:0 0 12px;font-style:italic;color:${dark ? "#cbd5e1" : text}}
.ft-review cite{font-size:.8125rem;color:${muted};font-style:normal}
.ft-newsletter{padding:64px 0}
.ft-newsletter__box{text-align:center;padding:48px 32px;border-radius:${radius};background:${dark ? "#111827" : p};color:#fff}
.ft-newsletter__box h2{font-family:${fontH};margin:0 0 8px;font-size:1.75rem}
.ft-newsletter__box p{opacity:.85;margin:0 0 20px}
.ft-newsletter__form{display:flex;gap:8px;max-width:440px;margin:0 auto;flex-wrap:wrap;justify-content:center}
.ft-newsletter__form input{flex:1;min-width:200px;padding:12px 16px;border-radius:999px;border:none;font-size:.875rem}
.ft-footer{background:${dark ? "#0b1220" : p};color:rgba(255,255,255,.85);padding:48px 0 24px;margin-top:24px}
.ft-footer__grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:24px;margin-bottom:32px}
.ft-footer__grid h4{margin:0 0 12px;font-size:.875rem;color:#fff}
.ft-footer__grid a{display:block;color:rgba(255,255,255,.7);text-decoration:none;font-size:.8125rem;margin-bottom:6px}
.ft-footer__grid p{font-size:.8125rem;color:rgba(255,255,255,.6);margin:8px 0 0}
.ft-footer__bottom{border-top:1px solid rgba(255,255,255,.12);padding-top:16px;font-size:.75rem;color:rgba(255,255,255,.55)}
.ft-product{position:relative}
.ft-product__badge{position:absolute;top:10px;left:10px;z-index:2;background:${a};color:#fff;font-size:.6875rem;font-weight:700;padding:4px 10px;border-radius:999px}
.ft-product__rating{font-size:.75rem;color:#f59e0b;margin:8px 14px 0}
.ft-product__rating small{color:${muted};font-weight:400}
.ft-price-old{color:${muted};font-size:.8125rem;font-weight:400;margin-left:6px}
.ft-cat--rich small{display:block;font-size:.75rem;color:${muted};margin-top:4px;font-weight:400}
.ft-page-hero{padding:40px 0 32px;background:${dark ? "#111827" : surface};border-bottom:1px solid ${headerBorder}}
.ft-page-hero h1{font-family:${fontH};font-size:clamp(1.75rem,3vw,2.5rem);margin:12px 0 8px;color:${dark ? "#fff" : text}}
.ft-page-hero__sub{color:${muted};max-width:560px;margin:0;line-height:1.6}
.ft-breadcrumb{font-size:.8125rem;color:${muted};margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ft-breadcrumb a{color:${a};text-decoration:none}
.ft-breadcrumb__sep{opacity:.5}
.ft-filter-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.ft-filter-chip{border:1px solid ${headerBorder};background:${dark ? "#0f172a" : bg};color:${dark ? "#e2e8f0" : text};border-radius:999px;padding:8px 16px;font-size:.8125rem;font-weight:600;cursor:pointer;font-family:inherit}
.ft-filter-chip--active{background:${p};color:#fff;border-color:${p}}
.ft-blog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.ft-blog-card{border:1px solid ${headerBorder};border-radius:${radius};padding:0 0 16px;background:${dark ? "#111827" : bg};overflow:hidden}
.ft-blog-card__img{aspect-ratio:16/9;background:${dark ? "#1e293b" : surface}}
.ft-blog-card .ft-eyebrow{margin:14px 16px 0;display:block}
.ft-blog-card h3{font-size:1rem;margin:8px 16px;color:${dark ? "#fff" : text}}
.ft-blog-card__excerpt{margin:0 16px 8px;font-size:.875rem;color:${muted};line-height:1.5}
.ft-blog-card__meta{margin:0 16px 10px;font-size:.75rem;color:${muted}}
.ft-blog-card .ft-link{margin:0 16px}
.ft-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center;padding:32px 0;margin:24px 0;border-block:1px solid ${headerBorder}}
.ft-stats-row strong{display:block;font-size:1.5rem;color:${dark ? "#fff" : text}}
.ft-stats-row span{font-size:.8125rem;color:${muted}}
.ft-contact-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:32px;align-items:start}
.ft-contact-info{padding:24px;border-radius:${radius};background:${dark ? "#111827" : surface};border:1px solid ${headerBorder}}
.ft-contact-info h3{margin:0 0 16px;font-size:1rem;color:${dark ? "#fff" : text}}
.ft-contact-info p{margin:0 0 12px;font-size:.875rem;color:${muted};line-height:1.6}
.ft-contact-form{display:flex;flex-direction:column;gap:12px}
.ft-contact-form input,.ft-contact-form textarea{padding:12px 16px;border:1px solid ${headerBorder};border-radius:8px;font-family:inherit;font-size:.875rem;background:${dark ? "#0f172a" : bg};color:${dark ? "#e2e8f0" : text}}
.ft-cart-panel{border:1px solid ${headerBorder};border-radius:${radius};padding:24px;background:${dark ? "#111827" : bg}}
.ft-cart-row{display:grid;grid-template-columns:56px 1fr auto auto;gap:16px;align-items:center;padding:16px 0;border-bottom:1px solid ${headerBorder}}
.ft-cart-row__thumb{width:56px;height:56px;border-radius:8px;background:${dark ? "#1e293b" : surface}}
.ft-cart-row__info strong{display:block;font-size:.875rem;color:${dark ? "#fff" : text}}
.ft-cart-row__info small{font-size:.75rem;color:${muted}}
.ft-cart-row__qty{display:flex;align-items:center;gap:8px}
.ft-cart-row__qty button{width:28px;height:28px;border:1px solid ${headerBorder};border-radius:6px;background:transparent;cursor:pointer;color:${dark ? "#fff" : text}}
.ft-cart-promo{display:flex;gap:8px;margin:20px 0}
.ft-cart-promo input{flex:1;padding:10px 14px;border:1px solid ${headerBorder};border-radius:8px;font-family:inherit}
.ft-cart-summary div{display:flex;justify-content:space-between;padding:8px 0;font-size:.875rem;color:${muted}}
.ft-cart-summary__total{font-size:1.0625rem;color:${dark ? "#fff" : text};border-top:1px solid ${headerBorder};margin-top:8px;padding-top:16px}
.ft-cart-checkout{width:100%;margin-top:16px;text-align:center}
.ft-cart-note{text-align:center;font-size:.75rem;color:${muted};margin-top:12px}
.ft-checkout-layout{display:grid;grid-template-columns:1fr 380px;gap:32px;align-items:start}
.ft-checkout-form{display:flex;flex-direction:column;gap:12px}
.ft-checkout-form h3{margin:8px 0 4px;font-size:1rem;color:${dark ? "#fff" : text}}
.ft-checkout-form input,.ft-checkout-form select{padding:12px 16px;border:1px solid ${headerBorder};border-radius:8px;font-family:inherit;background:${dark ? "#0f172a" : bg};color:${dark ? "#fff" : text}}
.ft-checkout-radio{display:flex;align-items:center;gap:8px;font-size:.875rem;color:${muted}}
.ft-checkout-card-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ft-checkout-summary{border:1px solid ${headerBorder};border-radius:${radius};padding:24px;background:${dark ? "#111827" : surface}}
.ft-checkout-summary h3{margin:0 0 16px;font-size:1.0625rem;color:${dark ? "#fff" : text}}
.ft-checkout-summary__row{display:flex;justify-content:space-between;padding:8px 0;font-size:.875rem;color:${muted}}
.ft-checkout-summary__total{display:flex;justify-content:space-between;padding:16px 0 0;margin-top:8px;border-top:1px solid ${headerBorder};font-size:1.0625rem;color:${dark ? "#fff" : text}}
.ft-checkout-pay{width:100%;margin-top:16px;text-align:center}
.ft-checkout-trust{font-size:.75rem;color:${muted};margin-top:12px;line-height:1.6;text-align:center}
.ft-pagination{display:flex;justify-content:center;gap:8px;margin-top:32px}
.ft-pagination button{min-width:40px;height:40px;border:1px solid ${headerBorder};border-radius:8px;background:${dark ? "#0f172a" : bg};cursor:pointer;font-family:inherit;color:${dark ? "#fff" : text}}
.ft-pagination button.ft-pagination__active{background:${p};color:#fff;border-color:${p}}
.ft-promo__link{color:#fff;margin-left:8px;text-decoration:underline;font-weight:700}
.ft-header__inner{flex-wrap:wrap}
.ft-header__search{flex:1;min-width:200px;max-width:360px;display:flex;align-items:center;background:${dark ? "#111827" : surface};border:1px solid ${headerBorder};border-radius:999px;padding:4px 6px 4px 16px}
.ft-header__search input{flex:1;border:none;background:transparent;font-size:.875rem;outline:none;color:${dark ? "#fff" : text};font-family:inherit}
.ft-header__search-btn{border:none;background:${p};color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer}
.ft-header__icon{text-decoration:none;font-size:1.125rem;padding:8px;color:${dark ? "#fff" : text}}
.ft-header__cart{display:inline-flex;gap:6px;align-items:center}
.ft-header__cart-count{background:#fff;color:${p};font-size:.6875rem;font-weight:800;min-width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
.ft-hero__photo,.ft-split__photo,.ft-cat__photo,.ft-blog-card__photo,.ft-gallery__photo,.ft-flash__img,.ft-contact-map__photo,.ft-cart-row__photo{width:100%;height:100%;object-fit:cover;display:block}
.ft-hero__visual{min-height:320px;border-radius:${radius};overflow:hidden;border:1px solid ${headerBorder}}
.ft-hero__badges{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
.ft-hero__badges span{font-size:.75rem;font-weight:600;color:${muted};background:${dark ? "#111827" : bg};border:1px solid ${headerBorder};padding:6px 12px;border-radius:999px}
.ft-hero--boutique .ft-hero__grid{grid-template-columns:1fr;text-align:center}
.ft-hero--boutique .ft-hero__copy h1,.ft-hero--boutique .ft-hero__copy p{margin-left:auto;margin-right:auto}
.ft-hero--boutique .ft-hero__cta,.ft-hero--boutique .ft-hero__badges{justify-content:center}
.ft-hero--boutique .ft-hero__visual{max-width:760px;margin:28px auto 0}
.ft-hero--compact{padding:48px 0}
.ft-hero--compact .ft-hero__visual{min-height:240px}
.ft-hero--compact .ft-hero__copy h1{font-size:clamp(1.75rem,3vw,2.75rem)}
.ft-product__media{position:relative;overflow:hidden}
.ft-product__img{aspect-ratio:1;width:100%;transition:transform .35s ease}
.ft-product:hover .ft-product__img{transform:scale(1.04)}
.ft-product__overlay{position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;gap:8px;opacity:0;transition:opacity .25s}
.ft-product:hover .ft-product__overlay{opacity:1}
.ft-product__action{border:none;background:#fff;color:${text};padding:8px 14px;border-radius:999px;font-size:.75rem;font-weight:700;cursor:pointer}
.ft-product__action--wish{width:36px;height:36px;padding:0;border-radius:50%}
.ft-product__discount{position:absolute;top:10px;right:10px;z-index:2;background:#dc2626;color:#fff;font-size:.6875rem;font-weight:700;padding:4px 8px;border-radius:6px}
.ft-product h3 a{color:inherit;text-decoration:none}
.ft-product h3 a:hover{color:${a}}
.ft-product__swatches{display:flex;gap:6px;margin:0 14px 6px}
.ft-product__swatches span{width:14px;height:14px;border-radius:50%;border:1px solid ${headerBorder}}
.ft-installment{margin:0 14px 4px;font-size:.75rem;color:${a};font-weight:600}
.ft-product__stock{margin:0 14px 8px;font-size:.75rem;color:#16a34a}
.ft-cat__img{position:relative;overflow:hidden}
.ft-cat__count{position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,.65);color:#fff;font-size:.6875rem;padding:4px 8px;border-radius:6px}
.ft-flash{padding:48px 0;background:${dark ? "#111827" : surface}}
.ft-flash__inner{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center}
.ft-flash__media{border-radius:${radius};overflow:hidden;aspect-ratio:4/3}
.ft-flash__price{font-size:1.5rem;font-weight:800;color:${dark ? "#fff" : text}}
.ft-flash__price s{font-size:1rem;color:${muted};margin-left:8px;font-weight:400}
.ft-countdown{display:flex;gap:12px;margin:16px 0 24px}
.ft-countdown span{background:${dark ? "#0f172a" : bg};border:1px solid ${headerBorder};padding:10px 14px;border-radius:8px;font-size:.75rem;text-align:center}
.ft-countdown b{display:block;font-size:1.25rem;color:${dark ? "#fff" : text}}
.ft-brands{padding:28px 0;border-block:1px solid ${headerBorder};overflow:hidden}
.ft-brands__item{display:inline-block;margin:0 28px;font-weight:800;font-size:.875rem;letter-spacing:.14em;color:${muted};opacity:.7}
.ft-brands{display:flex;justify-content:center;flex-wrap:wrap;gap:8px}
.ft-gallery{padding:64px 0}
.ft-gallery__grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.ft-gallery__item{border-radius:${radius};overflow:hidden;aspect-ratio:1}
.ft-review__head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.ft-review__avatar{width:48px;height:48px;border-radius:50%;object-fit:cover}
.ft-review__stars{display:block;font-size:.75rem;color:#f59e0b}
.ft-team-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center}
.ft-team-card__photo{width:120px;height:120px;border-radius:50%;object-fit:cover;margin:0 auto 12px}
.ft-team-card span{display:block;font-size:.8125rem;color:${muted}}
.ft-shop-layout{display:grid;grid-template-columns:260px 1fr;gap:32px;align-items:start}
.ft-shop-sidebar{position:sticky;top:88px}
.ft-shop-filter{margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid ${headerBorder}}
.ft-shop-filter h3{margin:0 0 12px;font-size:.875rem;color:${dark ? "#fff" : text}}
.ft-shop-filter ul{list-style:none;margin:0;padding:0}
.ft-shop-filter li{margin-bottom:6px}
.ft-shop-filter a{color:${muted};text-decoration:none;font-size:.8125rem}
.ft-shop-filter a:hover{color:${a}}
.ft-range input{width:100%}
.ft-range__labels{display:flex;justify-content:space-between;font-size:.75rem;color:${muted};margin-top:6px}
.ft-size-grid,.ft-color-grid{display:flex;flex-wrap:wrap;gap:8px}
.ft-size-grid button{width:36px;height:36px;border:1px solid ${headerBorder};border-radius:8px;background:${dark ? "#0f172a" : bg};cursor:pointer;font-size:.75rem;font-family:inherit;color:${dark ? "#fff" : text}}
.ft-size-grid button.is-active,.ft-size-grid button.active{outline:2px solid ${a};background:${dark ? "#1e293b" : surface};font-weight:700}
.ft-color-swatch{width:32px;height:32px;min-width:32px;min-height:32px;border-radius:50%;border:2px solid ${headerBorder};padding:0;margin:0;cursor:pointer;display:inline-block;font-size:0;line-height:0;overflow:hidden;color:transparent}
.ft-color-swatch--black{background:#0f172a}
.ft-color-swatch--red{background:#dc2626}
.ft-color-swatch--blue{background:#2563eb}
.ft-color-swatch--white{background:#f8fafc;border-color:#cbd5e1}
.ft-color-swatch--green{background:#16a34a}
.ft-color-swatch--beige{background:#d6c4a8}
.ft-color-swatch.is-active,.ft-color-swatch.active{outline:2px solid ${a};outline-offset:2px}
.ft-product__swatches .ft-color-swatch{width:14px;height:14px;min-width:14px;min-height:14px;border-width:1px;cursor:default}
.ft-shop-check{display:flex;align-items:center;gap:8px;font-size:.8125rem;color:${muted};cursor:pointer;margin-bottom:8px}
.ft-shop-check input{accent-color:${a}}
.ft-shop-filter__apply{width:100%;margin-top:8px}
.ft-shop-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid ${headerBorder}}
.ft-shop-results{margin:0;font-size:.875rem;color:${muted}}
.ft-shop-results strong{color:${dark ? "#fff" : text}}
.ft-shop-toolbar__actions{display:flex;align-items:center;gap:12px}
.ft-shop-sort{display:flex;align-items:center;gap:8px;font-size:.8125rem;color:${muted}}
.ft-shop-sort select{padding:8px 12px;border:1px solid ${headerBorder};border-radius:8px;background:${dark ? "#0f172a" : bg};color:${dark ? "#fff" : text};font-family:inherit;font-size:.8125rem}
.ft-shop-view{display:flex;gap:4px}
.ft-shop-view button{width:36px;height:36px;border:1px solid ${headerBorder};border-radius:8px;background:${dark ? "#0f172a" : bg};cursor:pointer;color:${muted};font-size:1rem}
.ft-shop-view button.is-active{background:${p};color:#fff;border-color:${p}}
.ft-product-grid--shop{grid-template-columns:repeat(3,1fr);gap:20px}
.ft-products--shop{padding:32px 0 64px}
.ft-shop-trust{display:flex;flex-wrap:wrap;gap:16px;margin-top:28px;padding-top:20px;border-top:1px solid ${headerBorder};font-size:.75rem;color:${muted}}
.ft-shop-trust span{display:inline-flex;align-items:center;gap:6px}
.ft-sort{font-size:.875rem;color:${muted}}
.ft-contact-map{margin-top:20px;border-radius:${radius};overflow:hidden;aspect-ratio:16/9}
.ft-footer__extras{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;padding:20px 0;border-top:1px solid rgba(255,255,255,.12);margin-bottom:8px}
.ft-footer__payments{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.75rem;color:rgba(255,255,255,.6)}
.ft-pay-badge{background:rgba(255,255,255,.12);padding:4px 10px;border-radius:6px;font-weight:700;color:#fff;font-size:.6875rem}
.ft-footer__social{display:flex;gap:16px}
.ft-footer__social a{color:rgba(255,255,255,.75);text-decoration:none;font-size:.8125rem}
.ft-footer__apps{opacity:.7}
.ft-split__list{margin:0 0 20px;padding-left:18px;color:${muted};font-size:.875rem;line-height:1.8}
.ft-blog-card h3 a{color:inherit;text-decoration:none}
.ft-blog-card h3 a:hover{color:${a}}
@media(max-width:992px){.ft-hero__grid,.ft-split__inner,.ft-contact-grid,.ft-flash__inner,.ft-shop-layout,.ft-checkout-layout{grid-template-columns:1fr}.ft-header__search{order:3;flex:1 1 100%;max-width:none}.ft-cat-grid,.ft-product-grid,.ft-blog-grid{grid-template-columns:repeat(2,1fr)}.ft-product-grid--shop{grid-template-columns:repeat(2,1fr)}.ft-gallery__grid{grid-template-columns:repeat(3,1fr)}.ft-trust__grid,.ft-feature-grid,.ft-review-grid,.ft-footer__grid,.ft-stats-row,.ft-team-grid{grid-template-columns:1fr 1fr}.ft-cart-row{grid-template-columns:48px 1fr;grid-template-rows:auto auto}.ft-cart-row__qty,.ft-cart-row__price{grid-column:2}.ft-shop-sidebar{position:static}}
@media(max-width:640px){.ft-nav{display:none}.ft-cat-grid,.ft-product-grid,.ft-blog-grid,.ft-gallery__grid,.ft-product-grid--shop,.ft-trust__grid,.ft-feature-grid,.ft-review-grid,.ft-footer__grid,.ft-stats-row,.ft-team-grid{grid-template-columns:1fr}}
`.replace(/\s+/g, " ").trim();
}

function buildPageShellStart(cfg) {
    const merged = mergeCfg(cfg);
    const brand = esc(merged.brand || "LYSIA");
    const promo = esc(merged.promoText);
    return `<div class="ft-root" data-theme="${esc(merged.style || "modern")}">
<div class="ft-promo">${promo} <a href="/collections/indirim" class="ft-promo__link">Detaylar →</a></div>
<header class="ft-header">
  <div class="ft-wrap ft-header__inner">
    <a href="/" class="ft-logo">${brand}</a>
    ${headerNavHtml()}
    ${headerActionsHtml()}
  </div>
</header>`;
}

function buildPageShellEnd(cfg) {
    const merged = mergeCfg(cfg);
    const brand = esc(merged.brand || "LYSIA");
    return `<footer class="ft-footer">
  <div class="ft-wrap ft-footer__grid">
    <div><strong class="ft-logo">${brand}</strong><p>${esc(merged.aboutExtra || "Premium online alışveriş deneyimi.")}</p></div>
    <div><h4>Mağaza</h4><a href="/products">Ürünler</a><a href="/collections">Koleksiyonlar</a><a href="/blog">Blog</a></div>
    <div><h4>Destek</h4><a href="/faq">SSS</a><a href="/contact">İletişim</a><a href="/shipping">Kargo</a></div>
    <div><h4>Yasal</h4><a href="/privacy">Gizlilik</a><a href="/terms">Şartlar</a><a href="/returns">İade</a></div>
  </div>
  ${footerExtrasHtml()}
  <div class="ft-wrap ft-footer__bottom"><span>© ${new Date().getFullYear()} ${brand}. Tüm hakları saklıdır.</span></div>
</footer>
</div>`;
}

function paginationHtml() {
    return `<div class="ft-pagination"><button type="button" class="ft-pagination__active">1</button><button type="button">2</button><button type="button">3</button><button type="button">→</button></div>`;
}

/** Navigasyon sekmeleri için hazır alt sayfa HTML şablonları */
function buildGrapesPageData(cfg) {
    const merged = mergeCfg(cfg);
    const shellStart = buildPageShellStart(merged);
    const shellEnd = buildPageShellEnd(merged);
    const brandRaw = merged.brand || "LYSIA";
    const brand = esc(brandRaw);
    const brandEmail = String(brandRaw).toLowerCase().replace(/[^a-z0-9]/g, "") || "magaza";

    const pages = {
        products: productsPageHtml(cfg),

        collections: `${shellStart}
${pageHeroHtml("<h1>Koleksiyonlar</h1>", esc("Sezonun öne çıkan kategorilerini keşfedin — her koleksiyon özenle seçilmiş ürünlerden oluşur."), breadcrumbHtml([["Ana Sayfa", "/"], ["Koleksiyonlar", "/collections"]]))}
<section class="ft-categories"><div class="ft-wrap"><div class="ft-cat-grid">${collectionGridHtml(merged)}</div></div></section>
<section class="ft-products"><div class="ft-wrap"><div class="ft-section-head"><h2>Koleksiyon öne çıkanları</h2></div><div class="ft-product-grid">${productGridHtml(merged, 4)}</div></div></section>
<section class="ft-split"><div class="ft-wrap ft-split__inner"><div class="ft-split__visual">${imgHtml(merged._assets?.split || "", "Koleksiyon", "ft-split__photo")}</div><div class="ft-split__copy"><span class="ft-eyebrow">Öne çıkan</span><h2>Yeni sezon koleksiyonu</h2><p>En yeni parçalar tek sayfada — stoklar tükenmeden inceleyin.</p><a href="/collections/yeni" class="ft-btn ft-btn--primary">Koleksiyonu gör</a></div></div></section>
${shellEnd}`,

        blog: `${shellStart}
${pageHeroHtml("<h1>Blog</h1>", esc("Stil rehberleri, ürün incelemeleri, kampanyalar ve marka haberleri."), breadcrumbHtml([["Ana Sayfa", "/"], ["Blog", "/blog"]]))}
<section class="ft-features"><div class="ft-wrap"><div class="ft-blog-grid">${blogGridHtml(merged)}</div></div></section>
<section class="ft-newsletter"><div class="ft-wrap ft-newsletter__box"><h2>Yeni yazılardan haberdar olun</h2><p>Haftalık bülten — kampanya ve içerikler e-postanıza gelsin.</p><form class="ft-newsletter__form"><input type="email" placeholder="E-posta adresiniz" /><button type="button" class="ft-btn ft-btn--primary">Abone ol</button></form></div></section>
${shellEnd}`,

        about: `${shellStart}
${pageHeroHtml(`<span class="ft-eyebrow">Hakkımızda</span><h1>${brand} hikayesi</h1>`, esc(merged.aboutExtra), breadcrumbHtml([["Ana Sayfa", "/"], ["Hakkımızda", "/about"]]))}
${statsRowHtml()}
<section class="ft-features"><div class="ft-wrap"><h2>Değerlerimiz</h2><div class="ft-feature-grid"><div class="ft-feature"><h3>Kalite</h3><p>Seçkin tedarikçiler, sıkı kalite kontrolü ve orijinal ürün garantisi.</p></div><div class="ft-feature"><h3>Güven</h3><p>Şeffaf fiyatlandırma, güvenli ödeme ve 14 gün koşulsuz iade.</p></div><div class="ft-feature"><h3>Hizmet</h3><p>7/24 müşteri desteği, canlı chat ve hızlı çözüm odaklı ekip.</p></div></div></div></section>
<section class="ft-split"><div class="ft-wrap ft-split__inner"><div class="ft-split__copy"><span class="ft-eyebrow">Misyonumuz</span><h2>Her müşteriye premium deneyim</h2><p>Doğru ürünü, doğru fiyata, en hızlı şekilde ulaştırmak için çalışıyoruz.</p><a href="/products" class="ft-btn ft-btn--primary">Mağazayı keşfet</a></div><div class="ft-split__visual">${imgHtml(merged._assets?.hero || "", brand, "ft-split__photo")}</div></div></section>
<section class="ft-features"><div class="ft-wrap"><h2>Ekibimiz</h2><div class="ft-team-grid">${teamGridHtml(merged)}</div></div></section>
<section class="ft-reviews"><div class="ft-wrap"><h2>Müşterilerimiz ne diyor?</h2><div class="ft-review-grid">${reviewsGridHtml(merged)}</div></div></section>
${shellEnd}`,

        contact: `${shellStart}
${pageHeroHtml("<h1>İletişim</h1>", esc("Sorularınız, sipariş ve iade talepleriniz için bize ulaşın — en geç 24 saat içinde dönüş yaparız."), breadcrumbHtml([["Ana Sayfa", "/"], ["İletişim", "/contact"]]))}
<section class="ft-features" style="padding:0 0 64px"><div class="ft-wrap ft-contact-grid">
<form class="ft-contact-form">
  <input type="text" placeholder="Adınız Soyadınız" />
  <input type="email" placeholder="E-posta adresiniz" />
  <input type="tel" placeholder="Telefon (opsiyonel)" />
  <select class="ft-contact-form" style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px"><option>Konu seçin</option><option>Sipariş</option><option>İade</option><option>Ürün bilgisi</option><option>Diğer</option></select>
  <textarea placeholder="Mesajınız" rows="5"></textarea>
  <button type="button" class="ft-btn ft-btn--primary">Mesaj gönder</button>
</form>
<div class="ft-contact-info">
  <h3>İletişim bilgileri</h3>
  <p><strong>E-posta:</strong> destek@${brandEmail}.com</p>
  <p><strong>Telefon:</strong> 0850 000 00 00</p>
  <p><strong>Adres:</strong> Maslak Mah. Büyükdere Cad. No:1, Sarıyer / İstanbul</p>
  <h3 style="margin-top:24px">Çalışma saatleri</h3>
  <p>Pazartesi – Cuma: 09:00 – 18:00<br/>Cumartesi: 10:00 – 16:00<br/>Pazar: Kapalı</p>
  <p style="margin-top:16px"><strong>Canlı destek:</strong> 7/24 (chat &amp; WhatsApp)</p>
  <div class="ft-contact-map">${imgHtml(merged._assets?.contactMap || "", "Mağaza konumu", "ft-contact-map__photo")}</div>
</div>
</div></section>
${shellEnd}`,

        faq: `${shellStart}
${pageHeroHtml("<h1>Sık sorulan sorular</h1>", esc("Sipariş, kargo, iade ve ödeme hakkında merak ettikleriniz."), breadcrumbHtml([["Ana Sayfa", "/"], ["SSS", "/faq"]]))}
<section class="ft-features" style="padding:0 0 64px"><div class="ft-wrap"><div class="ft-feature-grid">
<div class="ft-feature"><h3>Siparişim ne zaman kargoya verilir?</h3><p>Stoktaki ürünler aynı gün veya en geç 1 iş günü içinde kargoya verilir. Hafta sonu verilen siparişler pazartesi işleme alınır.</p></div>
<div class="ft-feature"><h3>Kargo ne kadar sürer?</h3><p>1–3 iş günü içinde adresinize teslim edilir. Büyükşehirlerde çoğu sipariş ertesi gün ulaşır.</p></div>
<div class="ft-feature"><h3>İade nasıl yapılır?</h3><p>14 gün içinde kullanılmamış ürünleri ücretsiz iade kargo kodu ile gönderebilirsiniz. İade onayından sonra 3–5 iş günü içinde ödeme iadesi yapılır.</p></div>
<div class="ft-feature"><h3>Ödeme güvenli mi?</h3><p>Tüm ödemeler 256-bit SSL ile şifrelenir. Kredi kartı, banka kartı, havale/EFT ve kapıda ödeme seçenekleri mevcuttur.</p></div>
<div class="ft-feature"><h3>Ücretsiz kargo şartı nedir?</h3><p>500 ₺ ve üzeri siparişlerde kargo ücretsizdir. Kampanya dönemlerinde eşik tutar değişebilir.</p></div>
<div class="ft-feature"><h3>Ürün orijinal mi?</h3><p>Tüm ürünler yetkili distribütörlerden temin edilir. Sahte veya muadil ürün satışı yapılmaz.</p></div>
<div class="ft-feature"><h3>Fatura kesiliyor mu?</h3><p>Kurumsal ve bireysel e-fatura/e-arşiv fatura otomatik olarak e-postanıza gönderilir.</p></div>
<div class="ft-feature"><h3>Canlı destek var mı?</h3><p>7/24 canlı chat, WhatsApp ve telefon destek hattımız aktiftir. Ortalama yanıt süresi 2 dakikadır.</p></div>
</div><p style="text-align:center;margin-top:32px">Sorunuz mu var? <a href="/contact" class="ft-link">Bize yazın →</a></p></div></section>
${shellEnd}`,

        cart: `${shellStart}
${pageHeroHtml("<h1>Sepetiniz</h1>", esc("Siparişinizi gözden geçirin — ödeme adımına geçmeden önce ürünleri düzenleyebilirsiniz."), breadcrumbHtml([["Ana Sayfa", "/"], ["Sepet", "/cart"]]))}
<section class="ft-features" style="padding:0 0 64px"><div class="ft-wrap" style="max-width:800px">${cartTableHtml(merged)}</div></section>
<section class="ft-products"><div class="ft-wrap"><div class="ft-section-head"><h2>Bunları da beğenebilirsiniz</h2></div><div class="ft-product-grid">${productGridHtml(merged, 4)}</div></div></section>
${shellEnd}`,

        checkout: `${shellStart}
${pageHeroHtml("<h1>Ödeme</h1>", esc("Teslimat ve ödeme bilgilerinizi girin — siparişinizi güvenle tamamlayın."), breadcrumbHtml([["Ana Sayfa", "/"], ["Sepet", "/cart"], ["Ödeme", "/checkout"]]))}
<section class="ft-features" style="padding:0 0 64px"><div class="ft-wrap">${checkoutFormHtml(merged)}</div></section>
<section class="ft-trust"><div class="ft-wrap ft-trust__grid"><div><strong>256-bit SSL</strong><span>Güvenli ödeme</span></div><div><strong>14 gün</strong><span>Koşulsuz iade</span></div><div><strong>7/24</strong><span>Canlı destek</span></div></div></section>
${shellEnd}`,
    };

    const out = {};
    Object.entries(pages).forEach(([key, html]) => {
        out[key] = { html, css: "" };
    });
    return out;
}

/** Tüm Lysia tam vitrin temaları */
const THEME_PACKS = {
    // ─── AMİRAL TEMALAR (premium, e-ticaret odaklı) ──────────────────────────
    "atelier-luxe": {
        name: "Atelier Luxe",
        category: "Premium Moda",
        descriptionTr: "Lüks moda evi vitrini — yüksek kontrast, serif tipografi, editorial koleksiyon düzeni ve altın vurgular.",
        style: "boutique",
        layout: "showcase",
        vertical: "luxury",
        primary: "#0b0b0c",
        accent: "#b8860b",
        background: "#faf9f7",
        text: "#1a1a1a",
        brand: "ATELIER",
        heroTitle: "Zamansız zarafet, sınırlı üretim",
        fontHeading: "'Playfair Display', Georgia, serif",
        fontBody: "'Inter', system-ui, sans-serif",
        source: "Lysia Premium",
    },
    "volt-tech": {
        name: "Volt Tech",
        category: "Premium Elektronik",
        descriptionTr: "Teknoloji mağazası için koyu, enerjik vitrin — flash sale bandı, ürün grid, güven rozetleri ve neon vurgular.",
        style: "dark",
        layout: "showcase",
        vertical: "electronics",
        primary: "#38bdf8",
        accent: "#22d3ee",
        background: "#0b1120",
        text: "#e2e8f0",
        brand: "VOLT",
        heroTitle: "En yeni teknoloji, en hızlı teslimat",
        fontHeading: "'Exo 2', system-ui, sans-serif",
        source: "Lysia Premium",
    },
    "lumiere-beauty": {
        name: "Lumière Beauty",
        category: "Premium Kozmetik",
        descriptionTr: "Kozmetik ve bakım markaları için zarif, pastel vitrin — editorial hero, ürün ritüelleri ve hediye paketleme vurgusu.",
        style: "boutique",
        vertical: "beauty",
        primary: "#7c3146",
        accent: "#d8a7b1",
        background: "#fdf7f6",
        text: "#2a1b20",
        brand: "LUMIÈRE",
        heroTitle: "Cildinize özen, ritüele dönüşür",
        fontHeading: "'Cormorant Garamond', Georgia, serif",
        fontBody: "'Inter', system-ui, sans-serif",
        source: "Lysia Premium",
    },

    "modern-store": {
        name: "Modern Store",
        category: "Genel",
        descriptionTr: "Temiz, modern ve dönüşüm odaklı tam vitrin — header, ürün grid, bülten, footer.",
        style: "modern",
        primary: "#0f172a",
        accent: "#6366f1",
        brand: "MODERN",
        heroTitle: "Modern alışveriş deneyimi",
    },
    "dawn-trade": {
        name: "Dawn Trade",
        category: "Headless",
        descriptionTr: "Vercel Commerce tarzı minimal headless vitrin.",
        style: "modern",
        primary: "#000000",
        accent: "#0070f3",
        brand: "DAWN",
        heroTitle: "Headless e-ticaret vitrini",
    },
    "fashion-pro": {
        name: "Fashion Pro",
        category: "Moda",
        descriptionTr: "Moda markaları için şık tipografi ve koleksiyon vitrini.",
        style: "boutique",
        primary: "#18181b",
        accent: "#be185d",
        brand: "FASHION",
        heroTitle: "Yeni sezon koleksiyonu",
        fontHeading: "'Playfair Display', Georgia, serif",
    },
    "craft-boutique": {
        name: "Craft Boutique",
        category: "Butik",
        descriptionTr: "Zarif butik vitrin — el yapımı ve özel ürünler için.",
        style: "boutique",
        primary: "#4c1d95",
        accent: "#d97706",
        brand: "BOUTIQUE",
        heroTitle: "El yapımı özel parçalar",
        fontHeading: "'Playfair Display', Georgia, serif",
    },
    "spotlight-showcase": {
        name: "Spotlight Showcase",
        category: "Vitrin",
        descriptionTr: "Ürün odaklı showcase — 12 ürünlü vitrin grid, Medusa tarzı.",
        style: "modern",
        layout: "showcase",
        primary: "#111827",
        accent: "#10b981",
        brand: "SPOTLIGHT",
        heroTitle: "Öne çıkan koleksiyonlar",
    },
    "electronics-plus": {
        name: "Electronics Plus",
        category: "Elektronik",
        descriptionTr: "Karanlık tema, neon vurgular — teknoloji mağazaları için.",
        style: "dark",
        primary: "#06b6d4",
        accent: "#22d3ee",
        brand: "TECH+",
        heroTitle: "En yeni teknoloji ürünleri",
        background: "#0f172a",
        text: "#e2e8f0",
    },
    "minimal-luxury": {
        name: "Minimal Luxury",
        category: "Lüks",
        descriptionTr: "Sade lüks estetik — az bölüm, güçlü tipografi, 10 sayfa vitrin.",
        style: "minimal",
        layout: "minimal",
        primary: "#1c1917",
        accent: "#a8a29e",
        brand: "LUXE",
        heroTitle: "Zamansız lüks koleksiyon",
        fontHeading: "'Cormorant Garamond', Georgia, serif",
    },
    "beauty-store": {
        name: "Beauty Store",
        category: "Güzellik",
        descriptionTr: "Kozmetik ve bakım ürünleri için pastel, şık vitrin.",
        style: "boutique",
        primary: "#831843",
        accent: "#ec4899",
        brand: "BEAUTY",
        heroTitle: "Cildiniz için en iyisi",
    },
    "food-store": {
        name: "Food Store",
        category: "Gıda",
        descriptionTr: "Organik gıda ve market vitrini — sıcak doğal tonlar.",
        style: "modern",
        primary: "#166534",
        accent: "#84cc16",
        brand: "FRESH",
        heroTitle: "Taze ve organik ürünler",
    },
    "furniture-store": {
        name: "Furniture Store",
        category: "Mobilya",
        descriptionTr: "Mobilya ve ev dekorasyonu için geniş görsel vitrin.",
        style: "minimal",
        primary: "#44403c",
        accent: "#d97706",
        brand: "HOME",
        heroTitle: "Evinizi yeniden tasarlayın",
    },
    "lumiere-fashion": {
        name: "Lumière Fashion",
        category: "Moda",
        descriptionTr: "Paris butik estetiği — altın vurgular, zarif hero.",
        style: "boutique",
        primary: "#881337",
        accent: "#fbbf24",
        brand: "LUMIÈRE",
        heroTitle: "Işıltılı moda koleksiyonu",
        fontHeading: "'Playfair Display', Georgia, serif",
    },
    "luxury-brand": {
        name: "Luxury Brand",
        category: "Lüks",
        descriptionTr: "Premium marka vitrini — siyah-altın palet.",
        style: "dark",
        primary: "#ca8a04",
        accent: "#fbbf24",
        brand: "LUXURY",
        heroTitle: "Exclusive collection",
        background: "#09090b",
        text: "#fafafa",
    },
    "jewelry-store": {
        name: "Jewelry Store",
        category: "Mücevher",
        descriptionTr: "Mücevher ve aksesuar mağazası — elegant koyu vitrin.",
        style: "dark",
        primary: "#eab308",
        accent: "#fde047",
        brand: "JEWEL",
        heroTitle: "Parlak koleksiyonlar",
        background: "#0c0a09",
    },
    "kids-store": {
        name: "Kids Store",
        category: "Çocuk",
        descriptionTr: "Renkli, neşeli çocuk ürünleri vitrini.",
        style: "modern",
        primary: "#2563eb",
        accent: "#f97316",
        brand: "KIDS",
        heroTitle: "Minikler için en iyisi",
    },
    "pet-store": {
        name: "Pet Store",
        category: "Pet",
        descriptionTr: "Evcil hayvan ürünleri mağazası — sıcak friendly tasarım.",
        style: "modern",
        primary: "#0d9488",
        accent: "#14b8a6",
        brand: "PETSHOP",
        heroTitle: "Dostlarınız için en iyisi",
    },
    "sports-store": {
        name: "Sports Store",
        category: "Spor",
        descriptionTr: "Spor ve outdoor ekipman vitrini — dinamik enerjik tasarım.",
        style: "modern",
        primary: "#dc2626",
        accent: "#f97316",
        brand: "SPORT",
        heroTitle: "Performans için tasarlandı",
    },
    "home-decor": {
        name: "Home Decor",
        category: "Dekor",
        descriptionTr: "Ev dekorasyon ve aksesuar vitrini.",
        style: "minimal",
        primary: "#78716c",
        accent: "#a8a29e",
        brand: "DECOR",
        heroTitle: "Evinize stil katın",
    },
    "digital-products": {
        name: "Digital Products",
        category: "Dijital",
        descriptionTr: "Dijital ürün ve SaaS vitrini — modern gradient hero.",
        style: "modern",
        primary: "#7c3aed",
        accent: "#a78bfa",
        brand: "DIGITAL",
        heroTitle: "Dijital ürünlerinizi satın",
    },
    "marketplace-pro": {
        name: "Marketplace Pro",
        category: "Pazar Yeri",
        descriptionTr: "Çok satıcılı pazar yeri — 8 kategori, fırsat grid, istatistik bandı.",
        style: "modern",
        layout: "marketplace",
        primary: "#0369a1",
        accent: "#0ea5e9",
        brand: "MARKET",
        heroTitle: "Binlerce satıcı, milyonlarca ürün",
    },
    "vercel-commerce": {
        name: "Vercel Commerce",
        category: "OSS Headless",
        descriptionTr: "Vercel Commerce referans tam vitrin.",
        style: "modern",
        primary: "#000000",
        accent: "#0070f3",
        brand: "VERCEL",
        heroTitle: "Headless commerce storefront",
        source: "https://github.com/vercel/commerce",
    },
    "medusa-starter": {
        name: "Medusa Starter",
        category: "OSS Headless",
        descriptionTr: "Medusa Next.js starter — ürün vitrini öncelikli showcase düzeni.",
        style: "modern",
        layout: "showcase",
        primary: "#111827",
        accent: "#10b981",
        brand: "MEDUSA",
        source: "https://github.com/medusajs/nextjs-starter-medusa",
    },
    "saleor-storefront": {
        name: "Saleor Storefront",
        category: "OSS Headless",
        descriptionTr: "Saleor GraphQL vitrin — showcase ürün grid + koleksiyonlar.",
        style: "modern",
        layout: "showcase",
        primary: "#1e293b",
        accent: "#3b82f6",
        brand: "SALEOR",
        source: "https://github.com/saleor/storefront",
    },
    "shadcn-storefront": {
        name: "Shadcn UI Store",
        category: "OSS UI Kit",
        descriptionTr: "Shadcn UI estetiği — minimal lüks anasayfa, 10 tam sayfa.",
        style: "minimal",
        layout: "minimal",
        primary: "#09090b",
        accent: "#71717a",
        brand: "SHADCN",
        source: "https://ui.shadcn.com",
    },
    "tailwind-blocks": {
        name: "Tailwind Blocks",
        category: "OSS Blocks",
        descriptionTr: "Tailwind tabanlı tam vitrin blokları.",
        style: "modern",
        primary: "#4f46e5",
        accent: "#06b6d4",
        brand: "TAILWIND",
    },
    "commerce-daisy": {
        name: "DaisyUI Commerce",
        category: "OSS UI Kit",
        descriptionTr: "DaisyUI ile hızlı tam vitrin.",
        style: "modern",
        primary: "#570df8",
        accent: "#f000b8",
        brand: "DAISY",
        source: "https://daisyui.com",
    },
    "bootstrap-store": {
        name: "Bootstrap Store",
        category: "OSS Classic",
        descriptionTr: "Bootstrap grid tam e-ticaret vitrin.",
        style: "modern",
        primary: "#0d6efd",
        accent: "#6610f2",
        brand: "BOOTSTRAP",
        source: "https://getbootstrap.com",
    },
    "storefront-minimal": {
        name: "Minimal Storefront",
        category: "OSS Minimal",
        descriptionTr: "Minimal serif tipografi — sade hero, 6 ürün, bülten.",
        style: "minimal",
        layout: "minimal",
        primary: "#1c1917",
        accent: "#57534e",
        brand: "MINIMAL",
        fontHeading: "'Cormorant Garamond', Georgia, serif",
    },
    "boutique-elegant": {
        name: "Boutique Elegant",
        category: "OSS Fashion",
        descriptionTr: "Zarif butik tam vitrin.",
        style: "boutique",
        primary: "#4c1d95",
        accent: "#d97706",
        brand: "ELEGANT",
        fontHeading: "'Playfair Display', Georgia, serif",
    },
    "dark-commerce": {
        name: "Dark Commerce",
        category: "OSS Dark",
        descriptionTr: "Karanlık tema tam e-ticaret vitrin.",
        style: "dark",
        primary: "#06b6d4",
        accent: "#22d3ee",
        brand: "DARK",
        background: "#0f172a",
        text: "#e2e8f0",
    },
};

function buildThemePack(slug, cfg) {
    const merged = mergeCfg({ ...cfg, slug });
    const html = buildFullHtml(merged);
    const css = buildFullCss(merged);
    const pageData = buildGrapesPageData(merged);
    return {
        slug,
        name: cfg.name || slug,
        fallbackThemeSlug: cfg.fallbackThemeSlug || slug,
        previewColors: { primary: cfg.primary, accent: cfg.accent },
        variables: {
            colorPrimary: cfg.primary,
            colorAccent: cfg.accent,
            fontHeading: cfg.fontHeading || "'Inter', system-ui, sans-serif",
            fontBody: cfg.fontBody || "'Inter', system-ui, sans-serif",
            backgroundColor: cfg.background || "#ffffff",
            textPrimary: cfg.text || "#0f172a",
        },
        meta: {
            category: cfg.category || "E-Ticaret",
            descriptionTr: cfg.descriptionTr || "Tam e-ticaret vitrin şablonu.",
            source: cfg.source || "Lysia Theme Pack",
            license: "MIT",
            stack: ["HTML", "CSS", "GrapesJS"],
        },
        grapes: { html, css, pageData },
    };
}

function getAllThemePacks() {
    return Object.entries(THEME_PACKS).map(([slug, cfg]) => buildThemePack(slug, cfg));
}

function getThemePack(slug) {
    const cfg = THEME_PACKS[slug];
    if (!cfg) return null;
    return buildThemePack(slug, cfg);
}

module.exports = {
    THEME_PACKS,
    buildFullHtml,
    buildFullCss,
    buildGrapesPageData,
    buildThemePack,
    getAllThemePacks,
    getThemePack,
};
