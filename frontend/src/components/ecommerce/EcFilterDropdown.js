import React, { useState, useRef, useEffect } from "react";
import { FaChevronDown } from "react-icons/fa";

/**
 * ikas tarzı açılır filtre menüsü
 */
const EcFilterDropdown = ({
    label,
    icon: Icon,
    options = [],
    value,
    onChange,
    align = "left",
    wide = false,
    footer = null,
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onDoc = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const selected = options.find((o) => o.value === value);

    return (
        <div className={`ec-filter-dd ${wide ? "ec-filter-dd--wide" : ""}`} ref={ref}>
            <button type="button" className={`ec-filter-dd__trigger ${open ? "ec-filter-dd__trigger--open" : ""}`} onClick={() => setOpen(!open)}>
                {Icon && <Icon className="ec-filter-dd__trigger-icon" />}
                <span className="ec-filter-dd__trigger-label">{selected?.triggerLabel || selected?.label || label}</span>
                <FaChevronDown className={`ec-filter-dd__chev ${open ? "ec-filter-dd__chev--open" : ""}`} />
            </button>
            {open && (
                <div className={`ec-filter-dd__menu ec-filter-dd__menu--${align}`}>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={`ec-filter-dd__item ${value === opt.value ? "ec-filter-dd__item--active" : ""}`}
                            onClick={() => {
                                onChange(opt.value, opt);
                                if (!opt.keepOpen) setOpen(false);
                            }}
                        >
                            {opt.icon && <span className="ec-filter-dd__item-icon">{opt.icon}</span>}
                            <span className="ec-filter-dd__item-text">
                                <strong>{opt.label}</strong>
                                {opt.description && <span>{opt.description}</span>}
                            </span>
                        </button>
                    ))}
                    {footer}
                </div>
            )}
        </div>
    );
};

export default EcFilterDropdown;
