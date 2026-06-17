import React from "react";
import { Link } from "react-router-dom";

function FooterPaymentBadge({ method }) {
    const labels = { visa: "VISA", mastercard: "MC", amex: "AMEX", paypal: "PayPal", iyzico: "iyzico", paytr: "PayTR", stripe: "Stripe", "bank-transfer": "EFT/Havale", cod: "Kapıda Ödeme" };
    const label = labels[method] || method;
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "3px 8px", border: "1px solid var(--color-border, #e2e8f0)",
            borderRadius: "4px", fontSize: 11, fontWeight: 700,
            color: "var(--color-text-secondary, #64748b)", background: "rgba(255,255,255,0.05)",
            letterSpacing: "0.02em",
        }}>
            {label}
        </span>
    );
}

function SocialIcon({ type }) {
    const icons = {
        instagram: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
        ),
        facebook: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
        ),
        twitter: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
        youtube: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12z" />
            </svg>
        ),
        tiktok: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34v-7.7a8.18 8.18 0 0 0 4.78 1.52v-3.4a4.85 4.85 0 0 1-1.02-.03z" />
            </svg>
        ),
        whatsapp: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M11.857 2C6.44 2 2 6.44 2 11.857c0 1.905.557 3.683 1.523 5.18L2.06 21.94l4.997-1.434a9.82 9.82 0 0 0 4.8 1.25c5.417 0 9.857-4.44 9.857-9.857S17.274 2 11.857 2zm0 17.857a8 8 0 0 1-4.195-1.187l-.3-.18-3.108.893.907-3.032-.196-.31A8.02 8.02 0 0 1 3.857 11.857c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
            </svg>
        ),
    };
    return icons[type] || null;
}

export default function WbStorefrontFooter({ site, footerNav, footerConfig, pageTo, homeTo }) {
    const cfg = footerConfig || footerNav?.footerConfig || {};
    const footerItems = (footerNav?.items || []).filter((i) => i.isVisible !== false);
    const social = site?.socialLinks || cfg.socialLinks || {};
    const paymentMethods = cfg.paymentMethods || site?.paymentMethods || [];
    const columns = cfg.columns || [];
    const copyright = cfg.copyrightText || `© ${new Date().getFullYear()} ${site?.displayName || site?.name || "Mağaza"}`;
    const contactEmail = cfg.contactEmail || site?.contactEmail;
    const contactPhone = cfg.contactPhone || site?.contactPhone;
    const address = cfg.address || site?.address;

    const hasSocial = Object.values(social).some(Boolean);
    const hasColumns = columns.length > 0;
    const hasContactInfo = contactEmail || contactPhone || address;

    const textCol = "var(--color-text-secondary, #64748b)";
    const bgCol = "var(--color-surface, #f8fafc)";
    const borderCol = "var(--color-border, #e2e8f0)";
    const primaryCol = "var(--color-primary, #3b82f6)";

    return (
        <footer style={{
            background: bgCol,
            borderTop: `1px solid ${borderCol}`,
            fontFamily: "var(--font-body, Inter, sans-serif)",
            color: textCol,
        }}>
            {(hasColumns || hasContactInfo || hasSocial) && (
                <div style={{
                    maxWidth: "var(--container-width, 1280px)",
                    margin: "0 auto",
                    padding: "48px 24px 32px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "32px",
                }}>
                    {/* Marka kolonu */}
                    <div>
                        {site?.logoUrl
                            ? <img src={site.logoUrl} alt={site.name} style={{ height: 32, marginBottom: 12, display: "block" }} />
                            : <span style={{ fontWeight: 800, fontSize: 18, color: "var(--color-text-primary, #0f172a)", display: "block", marginBottom: 12 }}>{site?.displayName || site?.name}</span>
                        }
                        {site?.description && (
                            <p style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 16px", maxWidth: 220 }}>{site.description}</p>
                        )}
                        {hasContactInfo && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {contactEmail && (
                                    <a href={`mailto:${contactEmail}`} style={{ fontSize: 13, color: textCol, textDecoration: "none" }}>{contactEmail}</a>
                                )}
                                {contactPhone && (
                                    <a href={`tel:${contactPhone}`} style={{ fontSize: 13, color: textCol, textDecoration: "none" }}>{contactPhone}</a>
                                )}
                                {address && (
                                    <span style={{ fontSize: 13 }}>{address}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Dinamik kolonlar (NavigationBuilder'dan) */}
                    {hasColumns && columns.map((col, i) => (
                        <div key={i}>
                            {col.heading && (
                                <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px", color: "var(--color-text-primary, #0f172a)" }}>
                                    {col.heading}
                                </h4>
                            )}
                            <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {(col.links || []).map((link, j) => (
                                    <Link key={j} to={pageTo ? pageTo(link.url) : (link.url || "/")} style={{ fontSize: 14, color: textCol, textDecoration: "none", transition: "color 0.15s" }}
                                        onMouseEnter={(e) => { e.target.style.color = primaryCol; }}
                                        onMouseLeave={(e) => { e.target.style.color = textCol; }}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    ))}

                    {/* Footer navigasyonu */}
                    {!hasColumns && footerItems.length > 0 && (
                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px", color: "var(--color-text-primary, #0f172a)" }}>
                                Linkler
                            </h4>
                            <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {footerItems.map((item) => (
                                    <Link key={item.id || item.url} to={pageTo ? pageTo(item.url) : (item.url || "/")}
                                        style={{ fontSize: 14, color: textCol, textDecoration: "none" }}>
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    )}

                    {/* Sosyal medya */}
                    {hasSocial && (
                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px", color: "var(--color-text-primary, #0f172a)" }}>
                                Sosyal Medya
                            </h4>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                                {Object.entries(social).filter(([, url]) => url).map(([type, url]) => (
                                    <a key={type} href={url} target="_blank" rel="noreferrer"
                                        aria-label={type}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            width: 36, height: 36, borderRadius: "50%",
                                            border: `1px solid ${borderCol}`,
                                            color: textCol, textDecoration: "none",
                                            transition: "color 0.15s, border-color 0.15s",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = primaryCol; e.currentTarget.style.borderColor = primaryCol; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = textCol; e.currentTarget.style.borderColor = borderCol; }}
                                    >
                                        <SocialIcon type={type} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Alt şerit */}
            <div style={{
                borderTop: `1px solid ${borderCol}`,
                padding: "16px 24px",
                maxWidth: "var(--container-width, 1280px)",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
            }}>
                <span style={{ fontSize: 13 }}>{copyright}</span>

                {paymentMethods.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {paymentMethods.map((m) => <FooterPaymentBadge key={m} method={m} />)}
                    </div>
                )}

                {footerItems.length > 0 && !hasColumns && (
                    <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {footerItems.map((item) => (
                            <Link key={item.id || item.url} to={pageTo ? pageTo(item.url) : (item.url || "/")}
                                style={{ fontSize: 13, color: textCol, textDecoration: "none" }}>
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </div>
        </footer>
    );
}
