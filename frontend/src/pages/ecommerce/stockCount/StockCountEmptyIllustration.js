import React from "react";

const StockCountEmptyIllustration = () => (
    <svg
        className="ec-purchase-empty__art"
        viewBox="0 0 220 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <rect x="24" y="58" width="80" height="64" rx="10" fill="var(--ec-glass)" stroke="var(--ec-border)" />
        <rect x="54" y="38" width="80" height="64" rx="10" fill="var(--ec-card)" stroke="var(--ec-border)" />
        <rect x="84" y="22" width="88" height="72" rx="10" fill="var(--ec-card)" stroke="var(--ec-border)" />
        <path d="M108 42h28M122 28v28" stroke="var(--ec-accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

export default StockCountEmptyIllustration;
