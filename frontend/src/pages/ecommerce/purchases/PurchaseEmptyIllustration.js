import React from "react";

/** ikas tarzı üst üste kart illüstrasyonu */
const PurchaseEmptyIllustration = () => (
    <svg
        className="ec-purchase-empty__art"
        viewBox="0 0 220 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <rect x="28" y="52" width="88" height="72" rx="10" fill="var(--ec-glass)" stroke="var(--ec-border)" strokeWidth="1.5" />
        <rect x="58" y="32" width="88" height="72" rx="10" fill="var(--ec-card)" stroke="var(--ec-border)" strokeWidth="1.5" />
        <rect x="88" y="18" width="96" height="80" rx="10" fill="var(--ec-card)" stroke="var(--ec-border)" strokeWidth="1.5" />
        <rect
            x="108"
            y="38"
            width="56"
            height="40"
            rx="6"
            fill="rgba(45, 212, 191, 0.08)"
            stroke="rgba(45, 212, 191, 0.35)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
        />
        <path
            d="M128 58h16M136 50v16"
            stroke="var(--ec-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
        />
        <circle cx="178" cy="42" r="4" fill="rgba(45, 212, 191, 0.25)" />
        <circle cx="42" cy="118" r="3" fill="rgba(45, 212, 191, 0.2)" />
    </svg>
);

export default PurchaseEmptyIllustration;
