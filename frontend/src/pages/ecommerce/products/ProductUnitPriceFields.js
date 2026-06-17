import React, { useState, useRef, useEffect } from "react";
import { FaCheck } from "react-icons/fa";
import {
    UNIT_MEASURE_GROUPS,
    DEFAULT_PRODUCT_MEASURE_UNIT,
} from "../../../constants/productUnitMeasures";
import { formatUnitPriceLabel } from "../../../utils/productUnitPrice";

const UnitSelect = ({ value, placeholder, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    const selectedLabel =
        UNIT_MEASURE_GROUPS.flatMap((g) => g.units).find((u) => u.value === value)?.label ||
        placeholder;

    return (
        <div className={`ec-prod-unit-select ${open ? "ec-prod-unit-select--open" : ""}`} ref={ref}>
            <button
                type="button"
                className="ec-prod-unit-select__btn"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                {selectedLabel}
            </button>
            {open && (
                <div className="ec-prod-unit-select__menu" role="listbox">
                    {UNIT_MEASURE_GROUPS.map((group) => (
                        <div key={group.label} className="ec-prod-unit-select__group">
                            <div className="ec-prod-unit-select__group-label">{group.label}</div>
                            {group.units.map((u) => (
                                <button
                                    key={u.value}
                                    type="button"
                                    role="option"
                                    aria-selected={value === u.value}
                                    className={`ec-prod-unit-select__option ${
                                        value === u.value ? "ec-prod-unit-select__option--active" : ""
                                    }`}
                                    onClick={() => {
                                        onChange(u.value);
                                        setOpen(false);
                                    }}
                                >
                                    <span>{u.label}</span>
                                    {value === u.value && <FaCheck className="ec-prod-unit-select__check" />}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const MeasureInput = ({ value, unit, onValueChange, onUnitChange, unitPlaceholder }) => (
    <div className="ec-prod-unit-measure">
        <input
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder=""
        />
        <UnitSelect
            value={unit}
            placeholder={unitPlaceholder || "Seçiniz"}
            onChange={onUnitChange}
        />
    </div>
);

const ProductUnitPriceFields = ({ form, setForm }) => {
    if (!form.showUnitPrice) return null;

    const up = form.unitPrice || {};
    const setUnitPrice = (patch) =>
        setForm({
            ...form,
            unitPrice: { ...up, ...patch },
        });

    const displayLabel = formatUnitPriceLabel(
        form.price,
        up.soldUnitValue,
        up.soldUnitUnit || up.productMeasureUnit || DEFAULT_PRODUCT_MEASURE_UNIT
    );

    return (
        <div className="ec-prod-unit-price-row">
            <div className="ec-prod-field">
                <label>Ürünün Birim Ölçüsü</label>
                <MeasureInput
                    value={up.productMeasureValue ?? ""}
                    unit={up.productMeasureUnit || DEFAULT_PRODUCT_MEASURE_UNIT}
                    onValueChange={(v) => setUnitPrice({ productMeasureValue: v })}
                    onUnitChange={(u) => setUnitPrice({ productMeasureUnit: u })}
                />
            </div>
            <div className="ec-prod-field">
                <label>Satılan Birim</label>
                <MeasureInput
                    value={up.soldUnitValue ?? ""}
                    unit={up.soldUnitUnit || ""}
                    unitPlaceholder="Seçiniz"
                    onValueChange={(v) => setUnitPrice({ soldUnitValue: v })}
                    onUnitChange={(u) => setUnitPrice({ soldUnitUnit: u })}
                />
            </div>
            <div className="ec-prod-field">
                <label>Birim Fiyat</label>
                <div className="ec-prod-unit-price-display" aria-live="polite">
                    {displayLabel}
                </div>
            </div>
        </div>
    );
};

export default ProductUnitPriceFields;
