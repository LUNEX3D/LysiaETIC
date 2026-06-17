import React, { useState, useRef, useEffect } from "react";
import { FaPencilAlt, FaEllipsisH, FaLayerGroup, FaTrash } from "react-icons/fa";
import ProductCategoryModal from "./ProductCategoryModal";

const ProductFormCategorySection = ({ form, setForm, visible, onNavigate }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [menuIndex, setMenuIndex] = useState(null);
    const menuRef = useRef(null);

    const categories = form.productCategories || [];

    useEffect(() => {
        if (menuIndex == null) return undefined;
        const close = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuIndex(null);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [menuIndex]);

    if (!visible) return null;

    const applySelection = (picked) => {
        const prevPrimary = categories.find((c) => c.isPrimary);
        const next = picked.map((c, i) => ({
            ...c,
            isPrimary: prevPrimary
                ? String(c.categoryId) === String(prevPrimary.categoryId)
                : i === 0,
        }));
        if (next.length && !next.some((c) => c.isPrimary)) next[0].isPrimary = true;
        setForm({ ...form, productCategories: next });
    };

    const setPrimary = (index) => {
        setForm({
            ...form,
            productCategories: categories.map((c, i) => ({ ...c, isPrimary: i === index })),
        });
        setMenuIndex(null);
    };

    const removeAt = (index) => {
        const next = categories.filter((_, i) => i !== index);
        if (next.length && !next.some((c) => c.isPrimary)) next[0].isPrimary = true;
        setForm({ ...form, productCategories: next });
        setMenuIndex(null);
    };

    return (
        <>
            <section className="ec-prod-section" id="ec-sec-category">
                <div className="ec-prod-section__head">
                    <h3>Kategori</h3>
                    <button
                        type="button"
                        className="ec-prod-section-link"
                        onClick={() => onNavigate?.("ec-products-definitions-categories")}
                    >
                        <FaPencilAlt /> Kategorileri Düzenle
                    </button>
                </div>

                {categories.length === 0 ? (
                    <>
                        <p className="ec-prod-muted">
                            Henüz bir kategori eklemediniz. Tanımlamalarda oluşturduğunuz kategorilerden seçin.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => setModalOpen(true)}
                        >
                            Kategori Ekle
                        </button>
                    </>
                ) : (
                    <ul className="ec-prod-category-list">
                        {categories.map((c, i) => (
                            <li key={`${c.categoryId}-${i}`} className="ec-prod-category-card">
                                <div className="ec-prod-category-card__text">
                                    <span className="ec-prod-category-card__path">{c.path || c.name}</span>
                                    {c.isPrimary && <span className="ec-prod-badge">Ana Kategori</span>}
                                </div>
                                <div className="ec-prod-category-card__menu-wrap" ref={menuIndex === i ? menuRef : null}>
                                    <button
                                        type="button"
                                        className="ec-prod-icon-btn"
                                        aria-label="Seçenekler"
                                        onClick={() => setMenuIndex(menuIndex === i ? null : i)}
                                    >
                                        <FaEllipsisH />
                                    </button>
                                    {menuIndex === i && (
                                        <div className="ec-prod-category-menu">
                                            {!c.isPrimary && (
                                                <button type="button" onClick={() => setPrimary(i)}>
                                                    <FaLayerGroup /> Ana Kategori Yap
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="ec-prod-category-menu__danger"
                                                onClick={() => removeAt(i)}
                                            >
                                                <FaTrash /> Kaldır
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {categories.length > 0 && (
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        style={{ marginTop: "0.75rem" }}
                        onClick={() => setModalOpen(true)}
                    >
                        Kategori Ekle
                    </button>
                )}
            </section>

            {modalOpen && (
                <ProductCategoryModal
                    assigned={categories}
                    onClose={() => setModalOpen(false)}
                    onSave={applySelection}
                />
            )}
        </>
    );
};

export default ProductFormCategorySection;
