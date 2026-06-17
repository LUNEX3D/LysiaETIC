import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaSearch } from "react-icons/fa";
import {
    getPhoneCountryByCode,
    phoneCountryListLabel,
    phoneCountryTriggerLabel,
    normalizePhoneCountryCode,
    filterPhoneCountries,
} from "../../constants/phoneCountries";

/**
 * Ülke kodu seçicili telefon alanı — aramalı özel açılır liste.
 */
const EcPhoneInput = ({
    phoneCountryCode = "+90",
    phone = "",
    onCountryCodeChange,
    onPhoneChange,
    placeholder = "5XX XXX XX XX",
    className = "",
    countryAriaLabel = "Ülke kodu",
    numberAriaLabel = "Telefon numarası",
    disabled = false,
}) => {
    const code = normalizePhoneCountryCode(phoneCountryCode);
    const selected = getPhoneCountryByCode(code);
    const [open, setOpen] = useState(false);
    const [countryQuery, setCountryQuery] = useState("");
    const rootRef = useRef(null);
    const searchRef = useRef(null);

    const filtered = useMemo(() => filterPhoneCountries(countryQuery), [countryQuery]);

    useEffect(() => {
        if (!open) return undefined;
        const t = setTimeout(() => searchRef.current?.focus(), 0);
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        window.addEventListener("keydown", onKey);
        return () => {
            clearTimeout(t);
            document.removeEventListener("mousedown", onDoc);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open) setCountryQuery("");
    }, [open]);

    const openMenu = () => {
        if (disabled) return;
        setOpen(true);
    };

    const closeMenu = () => {
        setOpen(false);
        setCountryQuery("");
    };

    const pick = (opt) => {
        onCountryCodeChange?.(opt.code);
        closeMenu();
    };

    return (
        <div className={`ec-phone-input ${className}`.trim()} ref={rootRef}>
            <div className={`ec-phone-country${open ? " ec-phone-country--open" : ""}`}>
                <button
                    type="button"
                    className="ec-phone-country__trigger"
                    onClick={() => (open ? closeMenu() : openMenu())}
                    aria-label={countryAriaLabel}
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    disabled={disabled}
                >
                    <span className="ec-phone-country__trigger-text">
                        {phoneCountryTriggerLabel(selected)}
                    </span>
                    <FaChevronDown className="ec-phone-country__chevron" aria-hidden />
                </button>
                {open && (
                    <div className="ec-phone-country__panel" role="presentation">
                        <div className="ec-phone-country__search">
                            <FaSearch className="ec-phone-country__search-icon" aria-hidden />
                            <input
                                ref={searchRef}
                                type="search"
                                className="ec-phone-country__search-input"
                                value={countryQuery}
                                onChange={(e) => setCountryQuery(e.target.value)}
                                placeholder="Ülke veya kod ara"
                                aria-label="Ülke ara"
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                        </div>
                        <ul className="ec-phone-country__menu" role="listbox" aria-label={countryAriaLabel}>
                            {filtered.length === 0 ? (
                                <li className="ec-phone-country__empty" role="presentation">
                                    Sonuç bulunamadı
                                </li>
                            ) : (
                                filtered.map((opt) => {
                                    const isOn = opt.code === code;
                                    return (
                                        <li key={opt.code} role="option" aria-selected={isOn}>
                                            <button
                                                type="button"
                                                className={`ec-phone-country__option${isOn ? " ec-phone-country__option--on" : ""}`}
                                                onClick={() => pick(opt)}
                                            >
                                                <span className="ec-phone-country__option-name">
                                                    {phoneCountryListLabel(opt)}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    </div>
                )}
            </div>
            <input
                type="tel"
                className="ec-phone-input__number"
                value={phone}
                onChange={(e) => onPhoneChange?.(e.target.value)}
                placeholder={placeholder}
                aria-label={numberAriaLabel}
                disabled={disabled}
                autoComplete="tel-national"
            />
        </div>
    );
};

export default EcPhoneInput;
