import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaTimes } from "react-icons/fa";
import "../../styles/ecommercePickers.css";

/**
 * Aranabilir çoklu seçim — chip + dropdown (ikas tarzı).
 * options: { id: string, label: string }[]
 * value: string[] (ids)
 */
const EcMultiPicker = ({
    className = "",
    label,
    placeholder = "Ara veya seçin",
    emptyTitle = "Sonuç bulunamadı",
    emptyHint = "Listeden bir öğe seçin",
    options = [],
    value = [],
    onChange,
    disabled = false,
    renderOptionIcon,
    renderChipIcon,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef(null);

    const optionMap = useMemo(() => {
        const m = new Map();
        for (const o of options) {
            if (o?.id != null) m.set(String(o.id), o.label || String(o.id));
        }
        return m;
    }, [options]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const selected = new Set((value || []).map(String));
        return options.filter((o) => {
            const id = String(o.id);
            if (selected.has(id)) return false;
            if (!q) return true;
            const labelText = (o.label || id).toLowerCase();
            return labelText.includes(q) || id.toLowerCase().includes(q);
        });
    }, [options, value, query]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    const addId = (id) => {
        const key = String(id);
        if (!key || value.map(String).includes(key)) return;
        onChange?.([...value.map(String), key]);
        setQuery("");
    };

    const removeId = (id) => {
        const key = String(id);
        onChange?.(value.map(String).filter((x) => x !== key));
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) addId(filtered[0].id);
            return;
        }
        if (e.key === "Escape") setOpen(false);
    };

    const showEmpty = open && filtered.length === 0;

    return (
        <div
            className={`ec-multi-picker${open ? " ec-multi-picker--open" : ""}${disabled ? " ec-multi-picker--disabled" : ""} ${className}`.trim()}
            ref={rootRef}
        >
            {label ? <label className="ec-multi-picker__label">{label}</label> : null}
            <div className="ec-multi-picker__control">
                {(value || []).length > 0 && (
                    <div className="ec-multi-picker__chips">
                        {value.map((id) => {
                            const opt = options.find((o) => String(o.id) === String(id));
                            return (
                            <span key={String(id)} className="ec-multi-picker__chip">
                                {renderChipIcon ? (
                                    <span className="ec-multi-picker__chip-icon">{renderChipIcon(opt)}</span>
                                ) : null}
                                {optionMap.get(String(id)) || String(id)}
                                {!disabled && (
                                    <button
                                        type="button"
                                        aria-label="Kaldır"
                                        onClick={() => removeId(id)}
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
                    placeholder={(value || []).length ? "" : placeholder}
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
                <div className="ec-multi-picker__menu" role="listbox">
                    {showEmpty ? (
                        <div className="ec-multi-picker__empty">
                            <strong>{emptyTitle}</strong>
                            <p>{emptyHint}</p>
                        </div>
                    ) : (
                        <ul className="ec-multi-picker__list">
                            {filtered.map((o) => (
                                <li key={String(o.id)}>
                                    <button
                                        type="button"
                                        role="option"
                                        onClick={() => {
                                            addId(o.id);
                                            setOpen(true);
                                        }}
                                    >
                                        {renderOptionIcon ? (
                                            <span className="ec-multi-picker__option-icon">
                                                {renderOptionIcon(o)}
                                            </span>
                                        ) : null}
                                        <span>{o.label || o.id}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default EcMultiPicker;
