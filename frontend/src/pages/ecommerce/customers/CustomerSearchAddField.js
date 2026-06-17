import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaTimes } from "react-icons/fa";

/**
 * ikas tarzı: ara, listeden seç veya ENTER ile yeni değer ekle.
 */
const CustomerSearchAddField = ({
    label,
    placeholder,
    emptyTitle,
    emptyHint,
    values = [],
    onChange,
    suggestions = [],
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef(null);

    const allSuggestions = useMemo(() => {
        const set = new Set([...suggestions, ...values]);
        return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "tr"));
    }, [suggestions, values]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return allSuggestions.filter((item) => {
            if (values.includes(item)) return false;
            if (!q) return true;
            return item.toLowerCase().includes(q);
        });
    }, [allSuggestions, values, query]);

    const showEmpty = open && filtered.length === 0;

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

    const addValue = (raw) => {
        const v = String(raw || "").trim();
        if (!v || values.includes(v)) return;
        onChange?.([...values, v]);
        setQuery("");
    };

    const removeValue = (v) => {
        onChange?.(values.filter((x) => x !== v));
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) {
                addValue(filtered[0]);
            } else {
                addValue(query);
            }
            return;
        }
        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <div
            className={`ec-cust-picker${open ? " ec-cust-picker--open" : ""}`}
            ref={rootRef}
        >
            {label && <label className="ec-cust-picker__label">{label}</label>}
            <div className="ec-cust-picker__control">
                {values.length > 0 && (
                    <div className="ec-cust-picker__chips">
                        {values.map((v) => (
                            <span key={v} className="ec-cust-picker__chip">
                                {v}
                                <button
                                    type="button"
                                    aria-label={`${v} kaldır`}
                                    onClick={() => removeValue(v)}
                                >
                                    <FaTimes />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <input
                    type="text"
                    className="ec-cust-picker__input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    className="ec-cust-picker__chevron-btn"
                    tabIndex={-1}
                    aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}
                >
                    <FaChevronDown />
                </button>
            </div>
            {open && (
                <div className="ec-cust-picker__menu" role="listbox">
                    {showEmpty ? (
                        <div className="ec-cust-picker__empty">
                            <div className="ec-cust-picker__empty-illus" aria-hidden />
                            <strong>{emptyTitle}</strong>
                            <p>{emptyHint}</p>
                        </div>
                    ) : (
                        <ul className="ec-cust-picker__list">
                            {filtered.map((item) => (
                                <li key={item}>
                                    <button
                                        type="button"
                                        role="option"
                                        onClick={() => {
                                            addValue(item);
                                            setOpen(true);
                                        }}
                                    >
                                        {item}
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

export default CustomerSearchAddField;

export function collectCustomerFieldValues(customers, field) {
    const set = new Set();
    for (const c of customers || []) {
        for (const v of c[field] || []) {
            const t = String(v).trim();
            if (t) set.add(t);
        }
    }
    return [...set];
}
