import React, { useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import ProductCustomFieldsModal from "./ProductCustomFieldsModal";
import ProductRichHtmlEditor from "./ProductRichHtmlEditor";

const ProductFormCustomSection = ({ form, setForm, visible }) => {
    const [modalOpen, setModalOpen] = useState(false);

    const updateValue = (fieldId, value) => {
        setForm((prev) => ({
            ...prev,
            customFields: (prev.customFields || []).map((f) =>
                String(f.fieldId) === String(fieldId) ? { ...f, value } : f
            ),
        }));
    };

    if (!visible) return null;

    const fields = form.customFields || [];
    const assignedIds = fields.map((f) => String(f.fieldId));
    const count = fields.length;

    const applySelection = (definitions) => {
        const existing = new Map(fields.map((f) => [String(f.fieldId), f]));
        const next = definitions.map((def) => {
            const id = String(def._id);
            const prev = existing.get(id);
            return {
                fieldId: id,
                name: def.name,
                type: def.type || "html",
                key: def.key || "",
                value: prev?.value ?? "",
            };
        });
        setForm({ ...form, customFields: next });
    };

    return (
        <>
            <section className="ec-prod-section ec-prod-cf-section" id="ec-sec-custom">
                <div className="ec-prod-section__head ec-prod-cf-section__head">
                    <div className="ec-prod-cf-section__title">
                        <h3>
                            Özel Alanlar <FaInfoCircle className="ec-prod-cf-info" aria-hidden />
                        </h3>
                        {count > 0 && (
                            <span className="ec-prod-cf-count">
                                {count} özel alan eklendi
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--outline"
                        onClick={() => setModalOpen(true)}
                    >
                        Özel Alanları Düzenle
                    </button>
                </div>

                {count === 0 ? (
                    <p className="ec-prod-muted">
                        Ürünlerinize beden tablosu, son kullanma tarihi, sezon bilgisi gibi özel alanlar
                        ekleyebilirsiniz.
                    </p>
                ) : (
                    <div className="ec-prod-cf-assigned">
                        {fields.map((field) => (
                            <div key={field.fieldId} className="ec-prod-cf-field">
                                <label className="ec-prod-cf-field__label" htmlFor={`ec-cf-${field.fieldId}`}>
                                    {field.name}
                                </label>
                                {field.type === "html" ? (
                                    <ProductRichHtmlEditor
                                        value={field.value || ""}
                                        onChange={(html) => updateValue(field.fieldId, html)}
                                        loadKey={`${field.fieldId}-${form.title || ""}`}
                                        placeholder={`${field.name}…`}
                                        compact
                                        className="ec-prod-cf-field__editor"
                                    />
                                ) : (
                                    <input
                                        id={`ec-cf-${field.fieldId}`}
                                        type={
                                            field.type === "number"
                                                ? "number"
                                                : field.type === "date"
                                                  ? "date"
                                                  : "text"
                                        }
                                        className="ec-prod-input ec-prod-cf-field__input"
                                        value={field.value || ""}
                                        onChange={(e) => updateValue(field.fieldId, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {modalOpen && (
                <ProductCustomFieldsModal
                    assignedFieldIds={assignedIds}
                    onClose={() => setModalOpen(false)}
                    onSave={applySelection}
                />
            )}
        </>
    );
};

export default ProductFormCustomSection;
