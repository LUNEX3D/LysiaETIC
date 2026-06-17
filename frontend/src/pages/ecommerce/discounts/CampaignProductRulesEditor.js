import React, { useMemo, useState } from "react";
import { FaTrash, FaPlus } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcMultiPicker from "../../../components/ecommerce/EcMultiPicker";
import CartLinkProductPickerModal from "../definitions/CartLinkProductPickerModal";
import CampaignCategoryPickerModal from "./CampaignCategoryPickerModal";

export const RULE_FIELD_OPTIONS = [
    { id: "products", label: "Ürünler" },
    { id: "categories", label: "Kategoriler" },
    { id: "brands", label: "Markalar" },
    { id: "tags", label: "Etiketler" },
];

export function emptyProductRule(field = "products") {
    return { field, mode: "include", values: [] };
}

export function normalizeProductRulesForForm(rules) {
    if (!Array.isArray(rules) || rules.length === 0) {
        return [emptyProductRule("products")];
    }
    return rules.map((r) => ({
        field: RULE_FIELD_OPTIONS.some((o) => o.id === r.field) ? r.field : "products",
        mode: r.mode === "exclude" ? "exclude" : "include",
        values: Array.isArray(r.values) ? r.values.map(String) : [],
    }));
}

function mergeIds(existing, addId) {
    return [...new Set([...(existing || []).map(String), String(addId)])];
}

const CampaignProductRulesEditor = ({
    rules,
    onChange,
    products = [],
    categoryNameById = new Map(),
    brandOptions = [],
    tagOptions = [],
}) => {
    const [productPickerRow, setProductPickerRow] = useState(null);
    const [categoryPickerRow, setCategoryPickerRow] = useState(null);

    const updateRow = (index, patch) => {
        onChange(rules.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    };

    const removeRow = (index) => {
        if (rules.length <= 1) {
            onChange([emptyProductRule(rules[0]?.field || "products")]);
            return;
        }
        onChange(rules.filter((_, i) => i !== index));
    };

    const addRow = () => {
        onChange([...rules, emptyProductRule("products")]);
    };

    const removeValue = (index, id) => {
        updateRow(index, {
            values: (rules[index].values || []).filter((x) => String(x) !== String(id)),
        });
    };

    const productTitleById = useMemo(() => {
        const m = new Map();
        products.forEach((p) => m.set(String(p._id), p.title || p.name || String(p._id)));
        return m;
    }, [products]);

    const activeProductRule =
        productPickerRow != null ? rules[productPickerRow] : null;
    const activeCategoryRule =
        categoryPickerRow != null ? rules[categoryPickerRow] : null;

    return (
        <div className="ec-campaign-rules">
            <div className="ec-campaign-rules__box">
                {rules.map((rule, index) => {
                    const values = rule.values || [];
                    const showChips =
                        (rule.field === "products" || rule.field === "categories") &&
                        values.length > 0;

                    return (
                        <div
                            key={index}
                            className={
                                showChips
                                    ? "ec-campaign-rules__block ec-campaign-rules__block--chips"
                                    : "ec-campaign-rules__block"
                            }
                        >
                            <div className="ec-campaign-rules__row">
                                <EcSelect
                                    wrapperClassName="ec-campaign-rules__field"
                                    value={rule.field}
                                    onChange={(e) =>
                                        updateRow(index, {
                                            field: e.target.value,
                                            values: [],
                                        })
                                    }
                                    aria-label="Koşul türü"
                                >
                                    {RULE_FIELD_OPTIONS.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.label}
                                        </option>
                                    ))}
                                </EcSelect>

                                <div className="ec-campaign-rules__value">
                                    {rule.field === "products" && (
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary ec-campaign-rules__action-btn"
                                            onClick={() => setProductPickerRow(index)}
                                        >
                                            Ürün Ekle
                                        </button>
                                    )}
                                    {rule.field === "categories" && (
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary ec-campaign-rules__action-btn"
                                            onClick={() => setCategoryPickerRow(index)}
                                        >
                                            Kategori Ekle
                                        </button>
                                    )}
                                    {rule.field === "brands" && (
                                        <EcMultiPicker
                                            className="ec-campaign-rules__picker"
                                            placeholder="Marka Seç"
                                            emptyTitle="Marka bulunamadı"
                                            emptyHint="Arama yapın veya listeden seçin"
                                            options={brandOptions}
                                            value={values}
                                            onChange={(v) => updateRow(index, { values: v })}
                                        />
                                    )}
                                    {rule.field === "tags" && (
                                        <EcMultiPicker
                                            className="ec-campaign-rules__picker"
                                            placeholder="Etiket Seç"
                                            emptyTitle="Etiket bulunamadı"
                                            emptyHint="Arama yapın veya listeden seçin"
                                            options={tagOptions}
                                            value={values}
                                            onChange={(v) => updateRow(index, { values: v })}
                                        />
                                    )}
                                </div>

                                <button
                                    type="button"
                                    className="ec-campaign-rules__remove"
                                    onClick={() => removeRow(index)}
                                    aria-label="Koşulu kaldır"
                                    title="Koşulu kaldır"
                                >
                                    <FaTrash />
                                </button>
                            </div>

                            {showChips && (
                                <ul className="ec-campaign-rules__chips">
                                    {values.map((id) => {
                                        const label =
                                            rule.field === "products"
                                                ? productTitleById.get(String(id))
                                                : categoryNameById.get(String(id));
                                        return (
                                            <li key={id}>
                                                <span>{label || id}</span>
                                                <button
                                                    type="button"
                                                    aria-label="Kaldır"
                                                    onClick={() => removeValue(index, id)}
                                                >
                                                    ×
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>

            <button type="button" className="ec-campaign-rules__add" onClick={addRow}>
                <FaPlus aria-hidden /> Koşul Ekle
            </button>

            <CartLinkProductPickerModal
                open={productPickerRow != null}
                onClose={() => setProductPickerRow(null)}
                products={products}
                existingProductIds={activeProductRule?.values || []}
                onAdd={(product) => {
                    if (productPickerRow == null) return;
                    updateRow(productPickerRow, {
                        values: mergeIds(rules[productPickerRow]?.values, product._id),
                    });
                }}
            />

            <CampaignCategoryPickerModal
                open={categoryPickerRow != null}
                onClose={() => setCategoryPickerRow(null)}
                selectedIds={activeCategoryRule?.values || []}
                onSave={(ids) => {
                    if (categoryPickerRow == null) return;
                    updateRow(categoryPickerRow, { values: ids.map(String) });
                }}
            />
        </div>
    );
};

export default CampaignProductRulesEditor;
