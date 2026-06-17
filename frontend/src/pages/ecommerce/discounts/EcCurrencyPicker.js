import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaTimes } from "react-icons/fa";
import {
    formatCurrencyLine,
    currencyCountryLabel,
    filterCurrencies,
    getCurrencyByCode,
} from "../../../constants/worldCurrencies";
import "../../../styles/ecommercePickers.css";
import "../../../styles/ecommerceDiscounts.css";

/**
 * ikas tarzı kur seçici: sembol / kod / ad + ülke, arama, çoklu seçim.
 */
const EcCurrencyPicker = ({ label = "Geçerli olacak kurlar", value = [], onChange, disabled = false }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef(null);

    const filtered = useMemo(() => {
        const selected = new Set((value || []).map(String));
        return filterCurrencies(query).filter((c) => !selected.has(c.code));
    }, [query, value]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    const addCode = (code) => {
        const key = String(code).toUpperCase();
        if (!key || value.map(String).includes(key)) return;
        onChange?.([...value.map(String), key]);
        setQuery("");
    };

    const removeCode = (code) => {
        onChange?.(value.map(String).filter((x) => x !== String(code)));
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) addCode(filtered[0].code);
            return;
        }
        if (e.key === "Escape") setOpen(false);
    };

    return (
        <div
            className={`ec-currency-picker${open ? " ec-currency-picker--open" : ""}${disabled ? " ec-currency-picker--disabled" : ""}`}
            ref={rootRef}
        >
            <label className="ec-multi-picker__label">{label}</label>
            <div className="ec-multi-picker__control ec-currency-picker__control">
                {(value || []).length > 0 && (
                    <div className="ec-multi-picker__chips">
                        {value.map((code) => {
                            const cur = getCurrencyByCode(code);
                            return (
                                <span key={code} className="ec-multi-picker__chip ec-currency-picker__chip">
                                    {formatCurrencyLine(cur || { code, symbol: "", name: code })}
                                    {!disabled && (
                                        <button
                                            type="button"
                                            aria-label={`${code} kaldır`}
                                            onClick={() => removeCode(code)}
                                        >
                                            <FaTimes />
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                )}
                <input
                    type="text"
                    className="ec-multi-picker__input"
                    value={query}
                    disabled={disabled}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => !disabled && setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder={(value || []).length ? "Kur ara…" : "Kur Seç"}
                />
                <button
                    type="button"
                    className="ec-multi-picker__chevron-btn"
                    tabIndex={-1}
                    disabled={disabled}
                    aria-expanded={open}
                    onClick={() => !disabled && setOpen((o) => !o)}
                >
                    <FaChevronDown />
                </button>
            </div>
            {open && !disabled && (
                <div className="ec-currency-picker__menu" role="listbox">
                    {filtered.length === 0 ? (
                        <div className="ec-multi-picker__empty">
                            <strong>Kur bulunamadı</strong>
                            <p>Farklı bir kod, ülke veya para birimi adı deneyin.</p>
                        </div>
                    ) : (
                        <ul className="ec-currency-picker__list">
                            {filtered.slice(0, 80).map((c) => (
                                <li key={c.code}>
                                    <button
                                        type="button"
                                        role="option"
                                        onClick={() => {
                                            addCode(c.code);
                                            setOpen(true);
                                        }}
                                    >
                                        <span className="ec-currency-picker__line">
                                            {formatCurrencyLine(c)}
                                        </span>
                                        <span className="ec-currency-picker__country">
                                            {currencyCountryLabel(c)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {filtered.length > 80 && (
                        <p className="ec-currency-picker__more">
                            +{filtered.length - 80} sonuç daha — aramayı daraltın
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default EcCurrencyPicker;
