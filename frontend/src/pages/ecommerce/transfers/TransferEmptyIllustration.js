import React from "react";

const TransferEmptyIllustration = () => (
    <svg
        className="ec-purchase-empty__art"
        viewBox="0 0 220 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <rect x="20" y="70" width="72" height="56" rx="8" fill="var(--ec-glass)" stroke="var(--ec-border)" />
        <rect x="74" y="48" width="72" height="56" rx="8" fill="var(--ec-card)" stroke="var(--ec-border)" />
        <path
            d="M98 76h40M118 56v40"
            stroke="var(--ec-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
        />
        <path
            d="M128 90 L158 60"
            stroke="var(--ec-accent)"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <polygon points="158,60 148,62 152,72" fill="var(--ec-accent)" opacity="0.8" />
    </svg>
);

export default TransferEmptyIllustration;
