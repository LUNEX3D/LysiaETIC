import React, { useState } from "react";
import { FaInfoCircle, FaLayerGroup, FaPen, FaTrash } from "react-icons/fa";
import ProductVariantModal from "./ProductVariantModal";
import {
    buildVariantsFromOptionGroups,
    VARIANT_STYLE_LABELS,
} from "../../../utils/productVariantOptions";

const ProductFormVariantSection = ({ form, setForm, visible }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [editIndex, setEditIndex] = useState(null);

    const groups = form.variantOptionGroups || [];
    const variantRows = form.variants || [];

    const applyGroups = (nextGroups) => {
        setForm((prev) => ({
            ...prev,
            productType: nextGroups.length ? "variant" : prev.productType,
            variantOptionGroups: nextGroups,
            variants: buildVariantsFromOptionGroups(
                nextGroups,
                prev.variants,
                Number(prev.price) || 0
            ),
        }));
    };

    if (!visible) return null;

    const openAdd = () => {
        setEditIndex(null);
        setModalOpen(true);
    };

    const openEdit = (index) => {
        setEditIndex(index);
        setModalOpen(true);
    };

    const handleModalSave = (group) => {
        const next = [...groups];
        if (editIndex != null) next[editIndex] = group;
        else next.push(group);
        applyGroups(next);
    };

    const removeGroup = (index) => {
        const next = groups.filter((_, i) => i !== index);
        applyGroups(next);
    };

    return (
        <>
            <section className="ec-prod-section ec-prod-var-section" id="ec-sec-variant">
                <div className="ec-prod-section__head ec-prod-var-section__head">
                    <h3>
                        Varyant <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                    </h3>
                    <button type="button" className="ec-prod-btn ec-prod-btn--outline" onClick={openAdd}>
                        Varyant Ekle
                    </button>
                </div>

                {groups.length === 0 ? (
                    <div className="ec-prod-empty ec-prod-empty--compact">
                        <FaLayerGroup size={36} style={{ opacity: 0.35, marginBottom: 8 }} />
                        <p className="ec-prod-muted">Renk, boyut gibi ürün varyantı ekleyiniz.</p>
                    </div>
                ) : (
                    <>
                        <div className="ec-prod-var-groups">
                            {groups.map((group, index) => (
                                <div key={`${group.name}-${index}`} className="ec-prod-var-group-card">
                                    <div className="ec-prod-var-group-card__head">
                                        <div>
                                            <strong>{group.name}</strong>
                                            <span className="ec-prod-badge">
                                                {VARIANT_STYLE_LABELS[group.displayStyle] || "Liste"}
                                            </span>
                                        </div>
                                        <div className="ec-prod-var-group-card__actions">
                                            <button
                                                type="button"
                                                className="ec-prod-icon-btn"
                                                aria-label="Düzenle"
                                                onClick={() => openEdit(index)}
                                            >
                                                <FaPen />
                                            </button>
                                            <button
                                                type="button"
                                                className="ec-prod-icon-btn"
                                                aria-label="Sil"
                                                onClick={() => removeGroup(index)}
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="ec-prod-var-chips">
                                        {(group.values || []).map((val, vi) => (
                                            <span key={`${val.label}-${vi}`} className="ec-prod-var-chip">
                                                {group.displayStyle === "color_image" && (
                                                    <span
                                                        className="ec-prod-var-chip__swatch"
                                                        style={{
                                                            background: val.imageUrl
                                                                ? `center/cover url(${val.imageUrl})`
                                                                : val.colorHex || "#9ca3af",
                                                        }}
                                                    />
                                                )}
                                                {val.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {variantRows.length > 0 && (
                            <div className="ec-prod-var-combos">
                                <h4 className="ec-prod-var-combos__title">
                                    Oluşturulan varyantlar ({variantRows.length})
                                </h4>
                                <ul className="ec-prod-variant-list">
                                    {variantRows.map((v, i) => (
                                        <li key={v.title || i}>
                                            <strong>{v.title}</strong>
                                            <span>{v.stock ?? 0} adet</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </section>

            {modalOpen && (
                <ProductVariantModal
                    initialGroup={editIndex != null ? groups[editIndex] : null}
                    onClose={() => setModalOpen(false)}
                    onSave={handleModalSave}
                />
            )}
        </>
    );
};

export default ProductFormVariantSection;
