import React, { useState } from "react";
import { Link } from "react-router-dom";
import { wbCartPath, wbSearchPath } from "../../utils/wbStorefrontPaths";

function NavLink({ item, pageTo }) {
    const children = (item.children || []).filter((c) => c.isVisible !== false);
    if (item.isMegaMenu && children.length > 0) {
        return (
            <div className="wb-sf-nav-mega">
                <button type="button" className="wb-sf-nav-mega__trigger">{item.label}</button>
                <div className="wb-sf-nav-mega__panel">
                    {children.map((child) => (
                        <Link key={child.id || child.url} to={pageTo(child.url)} className="wb-sf-nav-mega__link">
                            {child.label}
                        </Link>
                    ))}
                </div>
            </div>
        );
    }
    return (
        <Link to={pageTo(item.url)} target={item.target === "_blank" ? "_blank" : undefined} rel="noreferrer">
            {item.label}
        </Link>
    );
}

export default function WbStorefrontHeader({ site, headerNav, mobileNav, headerConfig, homeTo, pageTo, storeSlug, siteSlug }) {
    const cartTo = storeSlug && siteSlug ? wbCartPath(siteSlug) : null;
    const searchTo = siteSlug ? wbSearchPath(siteSlug) : "/search";
    const [menuOpen, setMenuOpen] = useState(false);
    const items = (headerNav?.items || []).filter((i) => i.isVisible !== false);
    const mobileItems = (mobileNav?.items?.length ? mobileNav.items : items).filter((i) => i.isVisible !== false);
    const cfg = headerConfig || {};

    return (
        <header className={`wb-sf-header${cfg.isSticky !== false ? " wb-sf-header--sticky" : ""}`}>
            <Link to={homeTo} className="wb-sf-logo">
                {site.logoUrl ? <img src={site.logoUrl} alt={site.name} height={36} /> : site.displayName || site.name}
            </Link>
            <nav className="wb-sf-nav wb-sf-nav--desktop">
                {items.map((item) => (
                    <NavLink key={item.id || item.url} item={item} pageTo={pageTo} />
                ))}
                {searchTo && cfg.showSearch !== false && <Link to={searchTo}>Ara</Link>}
                {cartTo && cfg.showCart !== false && <Link to={cartTo}>Sepet</Link>}
            </nav>
            <button type="button" className="wb-sf-nav-toggle" aria-label="Menü" onClick={() => setMenuOpen(!menuOpen)}>
                <span /><span /><span />
            </button>
            {menuOpen && (
                <nav className="wb-sf-nav wb-sf-nav--mobile">
                    {mobileItems.map((item) => (
                        <Link key={item.id || item.url} to={pageTo(item.url)} onClick={() => setMenuOpen(false)}>
                            {item.label}
                        </Link>
                    ))}
                    {searchTo && <Link to={searchTo} onClick={() => setMenuOpen(false)}>Ara</Link>}
                    {cartTo && <Link to={cartTo} onClick={() => setMenuOpen(false)}>Sepet</Link>}
                </nav>
            )}
        </header>
    );
}
