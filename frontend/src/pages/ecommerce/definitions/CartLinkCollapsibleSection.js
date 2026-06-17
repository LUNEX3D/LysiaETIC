import React from "react";
import { FaChevronDown } from "react-icons/fa";

const CartLinkCollapsibleSection = ({
    id,
    title,
    hint,
    open,
    onToggle,
    children,
    className = "",
}) => (
    <section
        id={id}
        className={`ec-prod-section ec-cart-link-section ${open ? "ec-cart-link-section--open" : ""} ${className}`.trim()}
    >
        <button
            type="button"
            className="ec-cart-link-section__head"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={id ? `${id}-body` : undefined}
        >
            <span className="ec-cart-link-section__head-text">
                <span className="ec-cart-link-section__title">{title}</span>
                {hint ? <span className="ec-cart-link-section__hint">{hint}</span> : null}
            </span>
            <span className="ec-cart-link-section__chev-wrap" aria-hidden="true">
                <FaChevronDown className="ec-cart-link-section__chev" />
            </span>
        </button>
        <div
            id={id ? `${id}-body` : undefined}
            className="ec-cart-link-section__body"
            hidden={!open}
        >
            {children}
        </div>
    </section>
);

export default CartLinkCollapsibleSection;
