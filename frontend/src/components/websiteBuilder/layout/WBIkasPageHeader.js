import React from "react";

export default function WBIkasPageHeader({ title, subtitle, actions }) {
    return (
        <header className="wb-ikas-page-header">
            <div className="wb-ikas-page-header-row">
                <div>
                    <h1>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div>{actions}</div>}
            </div>
        </header>
    );
}
