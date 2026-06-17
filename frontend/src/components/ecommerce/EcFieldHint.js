import React, { useId, useState } from "react";
import { FaQuestionCircle } from "react-icons/fa";

/**
 * Label yanında ? ikonu — üzerine gelince açıklama balonu (ikas tarzı).
 */
const EcFieldHint = ({ text, label = "Bilgi" }) => {
    const tipId = useId();
    const [open, setOpen] = useState(false);

    if (!text?.trim()) return null;

    return (
        <span
            className="ec-field-hint"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
        >
            <button
                type="button"
                className="ec-field-hint__btn"
                aria-label={label}
                aria-describedby={open ? tipId : undefined}
                tabIndex={0}
            >
                <FaQuestionCircle aria-hidden="true" />
            </button>
            {open && (
                <span id={tipId} role="tooltip" className="ec-field-hint__tip">
                    {text}
                </span>
            )}
        </span>
    );
};

export default EcFieldHint;
