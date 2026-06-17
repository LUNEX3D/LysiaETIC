/**
 * Referans firmalar — kayar logo bandı
 */
import React from "react";
import { resolveUploadUrl } from "../../utils/resolveUploadUrl";

const PartnerMarquee = ({ partners = {}, items = [] }) => {
    if (partners.enabled === false) return null;

    const list = items.filter((p) => p.logoUrl || p.name);
    if (!list.length) return null;

    const doubled = [...list, ...list];

    return (
        <section className="auth-partners" aria-label="Referans firmalar">
            <div className="auth-partners-head">
                <p className="auth-partners-kicker">{partners.kicker || "Referanslarımız"}</p>
                <h3 className="auth-partners-title">{partners.title || "Bize güvenen iş ortaklarımız"}</h3>
                {partners.subtitle && (
                    <p className="auth-partners-sub">{partners.subtitle}</p>
                )}
            </div>
            <div className="auth-partners-track-wrap">
                <div className="auth-partners-track">
                    {doubled.map((p, i) => {
                        const logoSrc = p.logoUrl ? resolveUploadUrl(p.logoUrl) : "";
                        const inner = (
                            <>
                                {logoSrc ? (
                                    <img
                                        src={logoSrc}
                                        alt={p.name}
                                        className="auth-partners-logo"
                                        loading="lazy"
                                        onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                            const fallback = e.currentTarget.nextElementSibling;
                                            if (fallback) fallback.style.display = "inline";
                                        }}
                                    />
                                ) : null}
                                <span
                                    className="auth-partners-name"
                                    style={logoSrc ? { display: "none" } : undefined}
                                >
                                    {p.name}
                                </span>
                            </>
                        );
                        const chipClass = `auth-partners-chip${p.isTemplate ? " auth-partners-chip--template" : ""}`;
                        return p.website ? (
                            <a
                                key={`${p._id || p.name}-${i}`}
                                href={p.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={chipClass}
                                title={p.name}
                            >
                                {inner}
                            </a>
                        ) : (
                            <div key={`${p._id || p.name}-${i}`} className={chipClass} title={p.name}>
                                {inner}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default PartnerMarquee;
