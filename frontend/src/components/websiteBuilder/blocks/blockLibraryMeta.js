/**
 * Block Library — tek metadata kaynağı (thumbnail, kategori, açıklama, ikon).
 * BLOCK_CATALOG / PRODUCT_BLOCK_CATALOG bu meta ile zenginleştirilir.
 */

export const LIBRARY_CATEGORIES = [
    { id: "hero", label: "Hero" },
    { id: "commerce", label: "Commerce" },
    { id: "content", label: "Content" },
    { id: "media", label: "Media" },
    { id: "marketing", label: "Marketing" },
    { id: "forms", label: "Forms" },
    { id: "product", label: "Ürün" },
];

/** Sayfa editörü — sık kullanılanlar */
export const FEATURED_BLOCK_TYPES = ["hero", "product-grid", "banner", "newsletter"];

/**
 * @typedef {object} BlockLibraryMeta
 * @property {string} label
 * @property {string} description
 * @property {string} categoryId
 * @property {string} preview — BlockThumbnail variant
 * @property {string} [muiIcon] — @mui/icons-material adı
 * @property {boolean} [featured]
 */

/** @type {Record<string, BlockLibraryMeta>} */
export const BLOCK_LIBRARY_META = {
    hero: {
        label: "Ana vitrin",
        description: "Büyük başlık ve CTA alanı",
        categoryId: "hero",
        preview: "hero",
        muiIcon: "ViewCarouselOutlined",
        featured: true,
    },
    banner: {
        label: "Banner",
        description: "Görsel ve metinli tanıtım bandı",
        categoryId: "marketing",
        preview: "banner",
        muiIcon: "CampaignOutlined",
        featured: true,
    },
    campaign: {
        label: "Kampanya Banner",
        description: "İndirim ve fırsat vurgusu",
        categoryId: "marketing",
        preview: "campaign",
        muiIcon: "LocalOfferOutlined",
    },
    "product-grid": {
        label: "Öne çıkan ürünler",
        description: "Ürünleri vitrin halinde göster",
        categoryId: "commerce",
        preview: "product-grid",
        muiIcon: "GridViewOutlined",
        featured: true,
    },
    "category-grid": {
        label: "Kategori Grid",
        description: "Kategori kartları listesi",
        categoryId: "commerce",
        preview: "category-grid",
        muiIcon: "CategoryOutlined",
    },
    text: {
        label: "Metin Bloğu",
        description: "Başlık ve paragraf içeriği",
        categoryId: "content",
        preview: "text",
        muiIcon: "ArticleOutlined",
    },
    slider: {
        label: "Slider",
        description: "Dönen görsel slayt alanı",
        categoryId: "content",
        preview: "slider",
        muiIcon: "ViewCarouselOutlined",
    },
    testimonials: {
        label: "Müşteri Yorumları",
        description: "Sosyal kanıt ve puanlar",
        categoryId: "content",
        preview: "testimonials",
        muiIcon: "FormatQuoteOutlined",
    },
    spacer: {
        label: "Boşluk",
        description: "Bölümler arası dikey boşluk",
        categoryId: "content",
        preview: "spacer",
        muiIcon: "HeightOutlined",
    },
    divider: {
        label: "Ayırıcı",
        description: "Yatay çizgi ayırıcı",
        categoryId: "content",
        preview: "divider",
        muiIcon: "HorizontalRuleOutlined",
    },
    html: {
        label: "Özel içerik",
        description: "Metin, duyuru veya özel alan",
        categoryId: "content",
        preview: "html",
        muiIcon: "CodeOutlined",
    },
    image: {
        label: "Görsel",
        description: "Tek tam genişlik görsel",
        categoryId: "media",
        preview: "image",
        muiIcon: "ImageOutlined",
    },
    video: {
        label: "Video",
        description: "YouTube veya Vimeo gömme",
        categoryId: "media",
        preview: "video",
        muiIcon: "PlayCircleOutline",
    },
    newsletter: {
        label: "Newsletter",
        description: "E-posta toplama formu",
        categoryId: "marketing",
        preview: "newsletter",
        muiIcon: "MailOutline",
        featured: true,
    },
    countdown: {
        label: "Geri Sayım",
        description: "Kampanya bitiş sayacı",
        categoryId: "marketing",
        preview: "countdown",
        muiIcon: "TimerOutlined",
    },
    contact: {
        label: "İletişim Formu",
        description: "Mesaj ve iletişim alanları",
        categoryId: "forms",
        preview: "contact",
        muiIcon: "ContactMailOutlined",
    },
    "product-gallery": {
        label: "Ürün Galerisi",
        description: "Ürün görselleri ve zoom",
        categoryId: "product",
        preview: "product-gallery",
        muiIcon: "PhotoLibraryOutlined",
    },
    "product-price": {
        label: "Fiyat",
        description: "Fiyat, indirim ve taksit",
        categoryId: "product",
        preview: "product-price",
        muiIcon: "SellOutlined",
    },
    "product-variants": {
        label: "Varyantlar",
        description: "Renk ve beden seçimi",
        categoryId: "product",
        preview: "product-variants",
        muiIcon: "PaletteOutlined",
    },
    "add-to-cart": {
        label: "Sepete Ekle",
        description: "Satın alma ve miktar",
        categoryId: "product",
        preview: "add-to-cart",
        muiIcon: "ShoppingCartOutlined",
    },
    "product-description": {
        label: "Ürün Açıklaması",
        description: "Detaylı ürün metni",
        categoryId: "product",
        preview: "product-description",
        muiIcon: "DescriptionOutlined",
    },
    "product-specifications": {
        label: "Özellikler",
        description: "Teknik özellik tablosu",
        categoryId: "product",
        preview: "product-specifications",
        muiIcon: "TableChartOutlined",
    },
    "product-reviews": {
        label: "Yorumlar",
        description: "Müşteri değerlendirmeleri",
        categoryId: "product",
        preview: "product-reviews",
        muiIcon: "StarOutlineOutlined",
    },
    "related-products": {
        label: "Benzer Ürünler",
        description: "Önerilen ürün carousel",
        categoryId: "product",
        preview: "related-products",
        muiIcon: "LinkOutlined",
    },
};

/** Katalog bloklarını meta ile birleştir */
export function enrichBlockCatalog(catalog) {
    return catalog.flatMap((group) =>
        group.blocks.map((block) => {
            const meta = BLOCK_LIBRARY_META[block.type] || {};
            return {
                type: block.type,
                label: meta.label || block.label,
                description: meta.description || block.description || "",
                categoryId: meta.categoryId || group.categoryId || "content",
                preview: meta.preview || block.type,
                muiIcon: meta.muiIcon || "WidgetsOutlined",
                featured: Boolean(meta.featured),
            };
        })
    );
}

export function getCategoriesForCatalog(allBlocks) {
    const ids = new Set(allBlocks.map((b) => b.categoryId));
    return LIBRARY_CATEGORIES.filter((c) => ids.has(c.id));
}

export function getBlockMeta(type) {
    return BLOCK_LIBRARY_META[type] || {
        label: type,
        description: "",
        categoryId: "content",
        preview: "generic",
        muiIcon: "WidgetsOutlined",
    };
}
