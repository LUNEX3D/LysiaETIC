import React from "react";
import { LayoutTemplate, PanelTop, PanelBottom, CreditCard, Search, Globe, Palette } from "lucide-react";
import {
    GLOBAL_PANEL, HEADER_PANEL, FOOTER_PANEL, CHECKOUT_PANEL, SEO_PANEL,
} from "../../registry/constants";

const SETTINGS_ITEMS = [
    { id: HEADER_PANEL, icon: PanelTop, label: "Üst menü", desc: "Logo, navigasyon, sticky" },
    { id: FOOTER_PANEL, icon: PanelBottom, label: "Alt menü", desc: "Footer blokları, bülten" },
    { id: CHECKOUT_PANEL, icon: CreditCard, label: "Ödeme sayfası", desc: "Checkout marka renkleri" },
    { id: GLOBAL_PANEL, icon: Palette, label: "Tema renkleri", desc: "Global stil tokenları" },
    { id: SEO_PANEL, icon: Search, label: "Sayfa SEO", desc: "Meta başlık ve açıklama" },
];

export default function SettingsNavigator({ selection, onSelectGlobal, activePageKey, pageTemplates = [] }) {
    const activePanel = selection?.type === "global" ? selection.panel : null;
    const pageLabel = pageTemplates.find((p) => p.key === activePageKey)?.label || activePageKey;

    return (
        <aside className="tb-settings-nav">
            <div className="tb-navigator__title">Mağaza ayarları</div>
            <p className="tb-settings-nav__hint">
                <Globe size={14} /> Aktif sayfa: <strong>{pageLabel}</strong>
            </p>
            <div className="tb-settings-nav__list">
                {SETTINGS_ITEMS.map(({ id, icon: Icon, label, desc }) => (
                    <button
                        key={id}
                        type="button"
                        className={`tb-settings-nav__item${activePanel === id ? " tb-settings-nav__item--active" : ""}`}
                        onClick={() => onSelectGlobal(id)}
                    >
                        <span className="tb-settings-nav__icon"><Icon size={16} /></span>
                        <span>
                            <strong>{label}</strong>
                            <small>{desc}</small>
                        </span>
                    </button>
                ))}
            </div>
            <div className="tb-settings-nav__tip">
                <LayoutTemplate size={14} />
                <span>Bölüm düzenlemek için üstte <strong>Sayfa düzeni</strong> moduna geçin.</span>
            </div>
        </aside>
    );
}
