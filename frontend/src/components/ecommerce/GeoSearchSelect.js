import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaTimes } from "react-icons/fa";

/**
 * Aramalı tek seçim — ülke / il / ilçe için.
 */
const GeoSearchSelect = ({
    label,
    value = "",
    onChange,
    options = [],
    placeholder = "Seçiniz",
    disabled = false,
    required = false,
    allowCustom = false,
    emptyTitle = "Sonuç bulunamadı",
    emptyHint = "Aramaya devam edin veya listeden seçin",
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef(null);
    const inputRef = useRef(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const list = options || [];
        if (!q) return list;
        return list.filter((o) => o.toLowerCase().includes(q));
    }, [options, query]);

    useEffect(() => {
        if (!open) {
            setQuery("");
            return undefined;
        }
        const t = setTimeout(() => inputRef.current?.focus(), 0);
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => {
            clearTimeout(t);
            document.removeEventListener("mousedown", onDoc);
        };
    }, [open]);

    const pick = (v) => {
        onChange?.(v);
        setOpen(false);
        setQuery("");
    };

    const clear = (e) => {
        e.stopPropagation();
        onChange?.("");
        setQuery("");
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) {
                pick(filtered[0]);
            } else if (allowCustom && query.trim()) {
                pick(query.trim());
            }
            return;
        }
        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    const display = value || placeholder;
    const hasValue = !!value;

    return (
        <div
            className={`ec-geo-select${open ? " ec-geo-select--open" : ""}${disabled ? " ec-geo-select--disabled" : ""}`}
            ref={rootRef}
        >
            {label && (
                <label className="ec-geo-select__label">
                    {label}
                    {required && <span className="ec-geo-select__req"> *</span>}
                </label>
            )}
            <div className="ec-geo-select__control">
                <button
                    type="button"
                    className={`ec-geo-select__trigger${hasValue ? "" : " ec-geo-select__trigger--placeholder"}`}
                    disabled={disabled}
                    onClick={() => !disabled && setOpen((o) => !o)}
                    aria-expanded={open}
                >
                    <span className="ec-geo-select__trigger-text">{display}</span>
                    {hasValue && !disabled && (
                        <span
                            className="ec-geo-select__clear"
                            role="button"
                            tabIndex={-1}
                            onClick={clear}
                            aria-label="Temizle"
                        >
                            <FaTimes />
                        </span>
                    )}
                    <FaChevronDown className="ec-geo-select__chevron" aria-hidden />
                </button>
                {open && (
                    <div className="ec-geo-select__panel">
                        <div className="ec-geo-select__search">
                            <input
                                ref={inputRef}
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder={placeholder}
                            />
                        </div>
                        <ul className="ec-geo-select__menu" role="listbox">
                            {filtered.length === 0 ? (
                                <li className="ec-geo-select__empty" role="presentation">
                                    <strong>{emptyTitle}</strong>
                                    <p>{allowCustom && query.trim() ? "ENTER ile yazdığınız değeri kullanın" : emptyHint}</p>
                                </li>
                            ) : (
                                filtered.map((opt) => (
                                    <li key={opt}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={opt === value}
                                            className={opt === value ? "ec-geo-select__option--on" : ""}
                                            onClick={() => pick(opt)}
                                        >
                                            {opt}
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeoSearchSelect;
