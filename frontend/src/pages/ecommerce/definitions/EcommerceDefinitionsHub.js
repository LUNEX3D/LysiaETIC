import React from "react";
import {
    FaFolderOpen,
    FaTags,
    FaTruck,
    FaAward,
    FaFileAlt,
    FaLayerGroup,
    FaThLarge,
    FaPaintBrush,
    FaCube,
    FaLink,
} from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

/**
 * Sıra: grid-auto-flow column ile 3 sütun (ikas düzeni)
 * Sütun 1: Kategoriler, Varyant, Kişiselleştirme, Sepet Linki
 * Sütun 2: Markalar, Ürün Grupları, Etiketler
 * Sütun 3: Özel Alanlar, Tedarikçiler, Ürün Birimleri
 */
const DEFINITION_ITEMS = [
    {
        id: "ec-products-definitions-categories",
        icon: FaFolderOpen,
        title: "Kategoriler",
        text: "Ürünlerinizi kategorilere ayırarak ziyaretçilerinizin aradıkları ürünü daha hızlı bulmalarını sağlayın.",
        active: true,
    },
    {
        id: "ec-products-definitions-variant-types",
        icon: FaLayerGroup,
        title: "Varyant Türleri",
        text: "Ürünlerinize beden, renk, boyut gibi varyasyon türleri ekleyerek çeşitlilik sağlayın.",
        active: true,
    },
    {
        id: "ec-products-definitions-personalizations",
        icon: FaPaintBrush,
        title: "Ürün Kişiselleştirmeleri",
        text: "Ürünlerinize yazı, resim yükleme ve renk seçimleri gibi kişiselleştirmeler ekleyin.",
        active: true,
    },
    {
        id: "ec-products-definitions-cart-link",
        icon: FaLink,
        title: "Sepet Linki",
        text: "Kullanıcıları doğrudan sepet sayfasına yönlendiren hemen satın al linki oluşturun.",
        active: true,
    },
    {
        id: "ec-products-definitions-brands",
        icon: FaAward,
        title: "Markalar",
        text: "Marka detay sayfalarında aynı marka ürünleri gösterin ve marka bazlı raporlar oluşturun.",
        active: true,
    },
    {
        id: "ec-products-definitions-product-groups",
        icon: FaThLarge,
        title: "Ürün Grupları",
        text: "Ürünlerinizi belirli kriterlere göre gruplayarak detay sayfasında nasıl görüneceklerini ayarlayın.",
        active: true,
    },
    {
        id: "ec-products-definitions-tags",
        icon: FaTags,
        title: "Etiketler",
        text: "Ürünlerinize etiketler ekleyerek dışa aktarma işlemleri için filtrelemeyi kolaylaştırın.",
        active: true,
    },
    {
        id: "ec-products-definitions-custom",
        icon: FaFileAlt,
        title: "Özel Alanlar",
        text: "Sezon Bilgisi, Cinsiyet gibi özel alanlar tanımlayarak ürün filtreleri oluşturun ve temanızda gösterin.",
        active: true,
    },
    {
        id: "ec-products-definitions-suppliers",
        icon: FaTruck,
        title: "Tedarikçiler",
        text: "Tedarikçilerinizin iletişim bilgilerini girerek satın alma ve ürün tedarik sürecini kolaylaştırın.",
        active: true,
    },
    {
        id: "ec-products-definitions-units",
        icon: FaCube,
        title: "Ürün Birimleri",
        text: "Servis, adet gibi özel birimler tanımlayarak ürün birim fiyatlarını detay ve satın alma adımlarında gösterin.",
        active: true,
    },
];

const EcommerceDefinitionsHub = ({ onNavigate }) => {
    const { rootClassName, rootStyle, isDark } = useDashtockTheme();

    return (
        <div
            className={`dashboard-home-layout ec-theme-root ${rootClassName}${isDark ? "" : " dashboard-home-layout--light"}`}
            style={rootStyle}
        >
            <div className="ec-page-body">
                <div className="ec-prod-page">
                    <div className="ec-def-page">
                        <h1 className="ec-def-page__title">Tanımlamalar</h1>
                        <div className="ec-def-grid ec-def-grid--ikas">
                            {DEFINITION_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const disabled = !item.active;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={`ec-def-card${disabled ? " ec-def-card--disabled" : ""}`}
                                        disabled={disabled}
                                        onClick={() => item.active && onNavigate?.(item.id)}
                                        aria-disabled={disabled}
                                    >
                                        <span className="ec-def-card__icon-wrap" aria-hidden="true">
                                            <Icon className="ec-def-card__icon" />
                                        </span>
                                        <span className="ec-def-card__body">
                                            <strong>{item.title}</strong>
                                            <p>{item.text}</p>
                                        </span>
                                        {disabled && (
                                            <span className="ec-def-card__badge">Yakında</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EcommerceDefinitionsHub;
