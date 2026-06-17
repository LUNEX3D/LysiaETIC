import React from "react";
import SectionRenderer from "../sections/SectionRenderer";

// ─── Default content per block type ───────────────────────────────────────────
export const DEFAULT_CONTENT = {
    hero: {
        heading: "Mağazanıza Hoş Geldiniz",
        subheading: "En iyi ürünleri keşfedin ve alışverişin tadını çıkarın",
        ctaText: "Alışverişe Başla",
        ctaUrl: "/products",
        backgroundType: "gradient",
        backgroundGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        backgroundUrl: "",
        backgroundOverlay: "rgba(0,0,0,0.35)",
        textColor: "#ffffff",
        ctaColor: "#ffffff",
        ctaBg: "#1d4ed8",
        textAlign: "center",
        minHeight: "500px",
    },
    "product-grid": {
        heading: "Öne Çıkan Ürünler",
        columns: 4,
        limit: 8,
        filter: "featured",
        showPrice: true,
        showAddToCart: true,
        showBadge: true,
    },
    "category-grid": {
        heading: "Kategoriler",
        columns: 3,
        items: [],
        style: "card",
    },
    banner: {
        heading: "Özel Kampanya",
        text: "%50 İndirim Fırsatı",
        ctaText: "Hemen Al",
        ctaUrl: "/products",
        backgroundUrl: "",
        backgroundColor: "#1e293b",
        textColor: "#ffffff",
        textAlign: "center",
        minHeight: "280px",
        showOverlay: true,
    },
    slider: {
        slides: [
            { heading: "Slide 1", text: "Alt metin", ctaText: "İncele", ctaUrl: "/products", backgroundUrl: "", backgroundColor: "#3b82f6", textColor: "#fff" },
            { heading: "Slide 2", text: "Alt metin", ctaText: "İncele", ctaUrl: "/products", backgroundUrl: "", backgroundColor: "#8b5cf6", textColor: "#fff" },
        ],
        autoPlay: true,
        interval: 4000,
        showArrows: true,
        showDots: true,
        height: "500px",
    },
    text: {
        html: "<h2>Başlık</h2><p>İçerik buraya gelecek. Zengin metin editörü ile düzenleyebilirsiniz.</p>",
        textAlign: "left",
        maxWidth: "800px",
    },
    image: {
        url: "",
        altText: "",
        width: "100%",
        maxWidth: "1200px",
        borderRadius: "0px",
        linkUrl: "",
        openInNewTab: false,
    },
    video: {
        url: "",
        type: "youtube",
        autoPlay: false,
        muted: true,
        showControls: true,
        aspectRatio: "16/9",
    },
    testimonials: {
        heading: "Müşterilerimiz Ne Diyor?",
        items: [
            { id: "t1", name: "Ahmet Y.", text: "Harika ürünler ve hızlı teslimat. Çok memnunum!", stars: 5, avatar: "" },
            { id: "t2", name: "Zeynep K.", text: "Kalite ve fiyat dengesi mükemmel. Kesinlikle tavsiye ederim.", stars: 5, avatar: "" },
            { id: "t3", name: "Murat D.", text: "Müşteri hizmetleri çok ilgili ve yardımsever.", stars: 4, avatar: "" },
        ],
        columns: 3,
    },
    newsletter: {
        heading: "Bültenimize Abone Olun",
        subtext: "Kampanya ve yeni ürünlerden ilk haberdar olan siz olun.",
        placeholder: "E-posta adresiniz",
        buttonText: "Abone Ol",
        backgroundColor: "#3b82f6",
        textColor: "#ffffff",
        privacyText: "Spam göndermiyoruz. İstediğiniz zaman abonelikten çıkabilirsiniz.",
    },
    contact: {
        heading: "Bize Ulaşın",
        subtext: "Sorularınız için bize yazın, en kısa sürede dönelim.",
        email: "",
        fields: ["name", "email", "subject", "message"],
        submitText: "Mesaj Gönder",
        successText: "Mesajınız iletildi!",
    },
    countdown: {
        heading: "Fırsat Bitiyor!",
        subtext: "Bu fiyatları kaçırmayın",
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        showLabels: true,
        labelDays: "Gün",
        labelHours: "Saat",
        labelMinutes: "Dakika",
        labelSeconds: "Saniye",
        ctaText: "Fırsata Git",
        ctaUrl: "/products",
    },
    campaign: {
        heading: "Süper Kampanya",
        discount: "%50 İndirim",
        description: "Seçili ürünlerde büyük indirim!",
        ctaText: "Hemen Al",
        ctaUrl: "/products",
        backgroundColor: "#dc2626",
        textColor: "#ffffff",
        badgeText: "FIRSAT",
        minHeight: "200px",
    },
    html: {
        html: "<!-- Özel HTML buraya -->",
        css: "",
        js: "",
    },
    spacer: { height: "60px" },
    divider: { style: "solid", color: "#e2e8f0", thickness: "1px", width: "100%" },
    "product-gallery": {
        thumbnailPosition: "bottom",
        zoomEnabled: true,
        lightboxEnabled: true,
        videoEnabled: true,
        aspectRatio: "square",
        thumbnailCount: 5,
    },
    "product-price": {
        showOriginalPrice: true,
        showDiscount: true,
        showTax: "excluded",
        showInstallment: false,
        priceFormat: "full",
    },
    "product-variants": {
        displayStyle: "button",
        unavailableStyle: "strikethrough",
        autoSelectFirst: true,
        showStock: true,
        stockThreshold: 5,
    },
    "add-to-cart": {
        quantitySelector: true,
        maxQuantity: 10,
        buyNowButton: true,
        wishlistButton: true,
        shareButton: false,
        notifyButton: true,
        buttonText: "Sepete Ekle",
        buyNowText: "Hemen Satın Al",
        stickyOnMobile: true,
        cartDrawer: true,
    },
    "product-description": {
        source: "product_description",
        expandable: true,
        collapseThreshold: 200,
    },
    "product-specifications": { style: "table", groupByCategory: true, showCompare: false },
    "product-reviews": {
        displayStyle: "list",
        showSummary: true,
        showDistribution: true,
        perPage: 5,
        showImages: true,
        showVerified: true,
        allowSubmit: true,
    },
    "related-products": {
        algorithm: "same_category",
        limit: 4,
        columns: 4,
        heading: "Benzer Ürünler",
        showPrice: true,
        showAddToCart: true,
    },
};

export const PRODUCT_BLOCK_CATALOG = [
    {
        category: "Ürün",
        categoryId: "product",
        blocks: [
            { type: "product-gallery" },
            { type: "product-price" },
            { type: "product-variants" },
            { type: "add-to-cart" },
            { type: "product-description" },
            { type: "product-specifications" },
            { type: "product-reviews" },
            { type: "related-products" },
        ],
    },
];

export function formatPreviewPrice(amount) {
    if (amount == null || Number.isNaN(Number(amount))) return "—";
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(amount));
}

// ─── Block catalog (Block Library — kategoriler) ────────────────────────────────
export const BLOCK_CATALOG = [
    {
        category: "Hero",
        categoryId: "hero",
        blocks: [{ type: "hero" }],
    },
    {
        category: "Commerce",
        categoryId: "commerce",
        blocks: [
            { type: "product-grid" },
            { type: "category-grid" },
        ],
    },
    {
        category: "Content",
        categoryId: "content",
        blocks: [
            { type: "text" },
            { type: "slider" },
            { type: "testimonials" },
            { type: "spacer" },
            { type: "divider" },
            { type: "html" },
        ],
    },
    {
        category: "Media",
        categoryId: "media",
        blocks: [
            { type: "image" },
            { type: "video" },
        ],
    },
    {
        category: "Marketing",
        categoryId: "marketing",
        blocks: [
            { type: "banner" },
            { type: "campaign" },
            { type: "newsletter" },
            { type: "countdown" },
        ],
    },
    {
        category: "Forms",
        categoryId: "forms",
        blocks: [{ type: "contact" }],
    },
];

export const BLOCK_TYPE_LABELS = {
    hero: "Hero Banner",
    "product-grid": "Ürün Listesi",
    banner: "Banner",
    text: "Metin Bloğu",
    image: "Görsel",
    slider: "Slider",
    video: "Video",
    testimonials: "Yorumlar",
    newsletter: "Bülten",
    contact: "İletişim Formu",
    countdown: "Geri Sayım",
    campaign: "Kampanya",
    "category-grid": "Kategoriler",
    html: "Özel içerik",
    spacer: "Boşluk",
    divider: "Çizgi",
    "product-gallery": "Galeri",
    "product-price": "Fiyat",
    "product-variants": "Varyantlar",
    "add-to-cart": "Sepete Ekle",
    "product-description": "Açıklama",
    "product-reviews": "Yorumlar",
    "related-products": "Benzer Ürünler",
    "product-specifications": "Özellikler",
};

// ─── Block preview renderer (delegates to unified SectionRenderer) ─────────────
export function BlockPreview({ section, themeVariables, isSelected, device, previewProduct }) {
    return (
        <SectionRenderer
            section={section}
            mode="editor"
            themeVariables={themeVariables}
            device={device}
            isSelected={isSelected}
            previewProduct={previewProduct}
        />
    );
}

export default { BLOCK_CATALOG, DEFAULT_CONTENT, BlockPreview };
