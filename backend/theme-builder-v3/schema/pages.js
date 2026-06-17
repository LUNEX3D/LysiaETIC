"use strict";

/** Theme Studio v3 — sayfa şablonları */
const PAGE_TEMPLATES = [
    { key: "home", label: "Anasayfa", type: "home", slug: "", isHomePage: true },
    { key: "category", label: "Koleksiyon", type: "products", slug: "products" },
    { key: "product", label: "Ürün", type: "product", slug: "product" },
    { key: "search", label: "Arama", type: "search", slug: "search" },
    { key: "cart", label: "Sepet", type: "cart", slug: "cart" },
    { key: "checkout", label: "Ödeme", type: "checkout", slug: "checkout" },
    { key: "blog", label: "Blog", type: "blog", slug: "blog" },
    { key: "contact", label: "İletişim", type: "contact", slug: "contact" },
    { key: "account", label: "Hesap", type: "account", slug: "account" },
    { key: "wishlist", label: "İstek Listesi", type: "favorites", slug: "favorites" },
    { key: "404", label: "404", type: "custom", slug: "404" },
];

const SUPPORTED_LOCALES = [
    { code: "tr", label: "Türkçe", direction: "ltr" },
    { code: "en", label: "English", direction: "ltr" },
    { code: "de", label: "Deutsch", direction: "ltr" },
    { code: "fr", label: "Français", direction: "ltr" },
    { code: "ar", label: "العربية", direction: "rtl" },
    { code: "ru", label: "Русский", direction: "ltr" },
];

module.exports = { PAGE_TEMPLATES, SUPPORTED_LOCALES };
