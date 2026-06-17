import React from "react";
import { FaTimes, FaInbox, FaCheckCircle, FaCircle } from "react-icons/fa";

/** Sayfa başlığı — simple: ikas tarzı düz başlık */
export function MarketingPageShell({ title, subtitle, icon: Icon, actions, children, className = "", variant = "simple" }) {
    const isHero = variant === "hero";
    return (
        <div className={`mkt-page ${className}`}>
            <header className={isHero ? "mkt-hero" : "mkt-page-header"}>
                {isHero && <div className="mkt-hero__glow" aria-hidden />}
                <div className={isHero ? "mkt-hero__main" : "mkt-page-header__main"}>
                    {Icon && (
                        <span className={isHero ? "mkt-hero__icon" : "mkt-page-header__icon"}>
                            <Icon />
                        </span>
                    )}
                    <div className={isHero ? "mkt-hero__text" : "mkt-page-header__text"}>
                        <h1>{title}</h1>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                </div>
                {actions && <div className={isHero ? "mkt-hero__actions" : "mkt-page-header__actions"}>{actions}</div>}
            </header>
            <div className="mkt-page__body">{children}</div>
        </div>
    );
}

export function MarketingInfoBox({ title, children, variant = "info" }) {
    return (
        <div className={`mkt-info-box mkt-info-box--${variant}`} role="note">
            {title && <strong>{title}</strong>}
            <div className="mkt-info-box__body">{children}</div>
        </div>
    );
}

export function MarketingWizardSteps({ steps, current }) {
    return (
        <ol className="mkt-wizard-steps" aria-label="Adımlar">
            {steps.map((label, i) => {
                const step = i + 1;
                const done = step < current;
                const active = step === current;
                return (
                    <li
                        key={label}
                        className={`mkt-wizard-steps__item${done ? " mkt-wizard-steps__item--done" : ""}${active ? " mkt-wizard-steps__item--active" : ""}`}
                    >
                        <span className="mkt-wizard-steps__num">{done ? "✓" : step}</span>
                        <span className="mkt-wizard-steps__label">{label}</span>
                    </li>
                );
            })}
        </ol>
    );
}

export function MarketingSetupChecklist({ items }) {
    return (
        <ul className="mkt-setup-checklist">
            {items.map((item) => (
                <li key={item.id} className={`mkt-setup-checklist__item${item.done ? " mkt-setup-checklist__item--done" : ""}`}>
                    {item.done ? <FaCheckCircle className="mkt-setup-checklist__icon" /> : <FaCircle className="mkt-setup-checklist__icon" />}
                    <div>
                        <strong>{item.title}</strong>
                        {item.hint && <p>{item.hint}</p>}
                    </div>
                    {item.action && !item.done && (
                        <button type="button" className="mkt-btn mkt-btn--sm mkt-btn--ghost" onClick={item.action.onClick}>
                            {item.action.label}
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}

export function MarketingPillTabs({ items, value, onChange }) {
    return (
        <div className="mkt-pills" role="tablist">
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={value === item.id}
                    className={`mkt-pill${value === item.id ? " mkt-pill--active" : ""}`}
                    onClick={() => onChange(item.id)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

export function MarketingStatCard({ label, value, hint, icon: Icon, accent = "teal" }) {
    return (
        <article className={`mkt-stat mkt-stat--${accent}`}>
            <div className="mkt-stat__top">
                {Icon && (
                    <span className="mkt-stat__icon">
                        <Icon />
                    </span>
                )}
                <span className="mkt-stat__label">{label}</span>
            </div>
            <div className="mkt-stat__value">{value}</div>
            {hint && <div className="mkt-stat__hint">{hint}</div>}
        </article>
    );
}

export function MarketingSection({ title, action, children, className = "" }) {
    return (
        <section className={`mkt-section ${className}`}>
            {(title || action) && (
                <div className="mkt-section__head">
                    {title && <h2>{title}</h2>}
                    {action}
                </div>
            )}
            {children}
        </section>
    );
}

const STATUS_LABELS = {
    draft: "Taslak",
    scheduled: "Planlandı",
    sending: "Gönderiliyor",
    sent: "Gönderildi",
    paused: "Duraklatıldı",
    cancelled: "İptal",
    active: "Aktif",
};

export function MarketingBadge({ status, children }) {
    const s = status || children;
    const norm = String(s || "").toLowerCase();
    const label = children || STATUS_LABELS[norm] || s;
    return <span className={`mkt-badge mkt-badge--${norm}`}>{label}</span>;
}

export function MarketingButton({ variant = "primary", size, icon: Icon, children, className = "", ...props }) {
    const sizeClass = size === "sm" ? " mkt-btn--sm" : "";
    return (
        <button
            type="button"
            className={`mkt-btn mkt-btn--${variant}${sizeClass} ${className}`.trim()}
            {...props}
        >
            {Icon && <Icon aria-hidden />}
            {children}
        </button>
    );
}

export function MarketingDataTable({ columns, rows, emptyTitle = "Kayıt yok", emptyHint, action }) {
    if (!rows?.length) {
        return <MarketingEmptyState title={emptyTitle} hint={emptyHint} action={action} />;
    }
    return (
        <div className="mkt-table-wrap">
            <table className="mkt-table">
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key || col.label} style={col.width ? { width: col.width } : undefined}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id}>
                            {columns.map((col) => (
                                <td key={col.key || col.label}>{col.render ? col.render(row) : row[col.key]}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function MarketingEmptyState({ title, hint, action }) {
    return (
        <div className="mkt-empty">
            <span className="mkt-empty__icon">
                <FaInbox />
            </span>
            <h3>{title}</h3>
            {hint && <p>{hint}</p>}
            {action}
        </div>
    );
}

export function MarketingAlert({ type = "error", children, onClose }) {
    return (
        <div className={`mkt-alert mkt-alert--${type}`} role="alert">
            <span>{children}</span>
            {onClose && (
                <button type="button" className="mkt-alert__close" onClick={onClose} aria-label="Kapat">
                    <FaTimes />
                </button>
            )}
        </div>
    );
}

export function MarketingModal({ open, title, subtitle, onClose, footer, children, wide }) {
    if (!open) return null;
    return (
        <div className="mkt-modal-backdrop" onMouseDown={onClose}>
            <div
                className={`mkt-modal${wide ? " mkt-modal--wide" : ""}`}
                role="dialog"
                aria-modal="true"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="mkt-modal__head">
                    <div>
                        <h2>{title}</h2>
                        {subtitle && <p>{subtitle}</p>}
                    </div>
                    <button type="button" className="mkt-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="mkt-modal__body">{children}</div>
                {footer && <footer className="mkt-modal__foot">{footer}</footer>}
            </div>
        </div>
    );
}

export function MarketingField({ label, children, hint }) {
    return (
        <div className="mkt-field">
            {label && <label>{label}</label>}
            {children}
            {hint && <span className="mkt-field__hint">{hint}</span>}
        </div>
    );
}

export function MarketingSkeletonGrid({ count = 8 }) {
    return (
        <div className="mkt-stat-grid mkt-stat-grid--loading">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="mkt-skeleton mkt-skeleton--stat" />
            ))}
        </div>
    );
}

export function MarketingToolbar({ children }) {
    return <div className="mkt-toolbar">{children}</div>;
}

export function MarketingCampaignCard({ campaign, isEmail, onSend, onDelete, sending }) {
    return (
        <article className="mkt-campaign-card">
            <div className="mkt-campaign-card__head">
                <strong>{campaign.name}</strong>
                <MarketingBadge status={campaign.status} />
            </div>
            {isEmail && campaign.subject && <p className="mkt-campaign-card__subject">{campaign.subject}</p>}
            <div className="mkt-campaign-card__stats">
                <span>
                    <em>Gönderilen</em> {campaign.stats?.delivered ?? campaign.stats?.sent ?? 0}
                </span>
                <span>
                    <em>Dönüşüm</em> {campaign.stats?.converted ?? 0}
                </span>
            </div>
            <div className="mkt-campaign-card__actions">
                {campaign.status !== "sent" && campaign.status !== "sending" && (
                    <MarketingButton variant="primary" size="sm" disabled={sending} onClick={onSend}>
                        {sending ? "Gönderiliyor…" : "Şimdi gönder"}
                    </MarketingButton>
                )}
                <MarketingButton variant="ghost" size="sm" onClick={onDelete}>
                    Sil
                </MarketingButton>
            </div>
        </article>
    );
}
