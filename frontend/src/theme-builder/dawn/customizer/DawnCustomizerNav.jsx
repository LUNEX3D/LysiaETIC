import React, { useState } from "react";
import { ChevronDown, ChevronRight, LayoutTemplate, Settings, Layers, PanelTop, PanelBottom } from "lucide-react";
import NavigatorPanel from "../../studio/navigator/NavigatorPanel";
import DawnThemeSettingsPanel from "./DawnThemeSettingsPanel";
import {
    GLOBAL_PANEL, HEADER_PANEL, FOOTER_PANEL, CHECKOUT_PANEL, SEO_PANEL,
} from "../../registry/constants";

const DAWN_TEMPLATES = [
    { key: "home", label: "Anasayfa" },
    { key: "product", label: "Ürün" },
    { key: "category", label: "Koleksiyon" },
    { key: "cart", label: "Sepet" },
    { key: "search", label: "Arama" },
    { key: "blog", label: "Blog" },
    { key: "contact", label: "İletişim" },
    { key: "404", label: "404" },
    { key: "list-collections", label: "Koleksiyon listesi" },
    { key: "article", label: "Blog yazısı" },
    { key: "password", label: "Şifre sayfası" },
];

function Accordion({ title, icon: Icon, open, onToggle, children }) {
    return (
        <div className="dawn-acc">
            <button type="button" className="dawn-acc__head" onClick={onToggle}>
                {Icon && <Icon size={16} />}
                <span>{title}</span>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {open && <div className="dawn-acc__body">{children}</div>}
        </div>
    );
}

/** Shopify Online Store 2.0 tarzı sol özelleştirme paneli */
export default function DawnCustomizerNav(props) {
    const {
        manifest,
        document,
        activePageKey,
        onPageChange,
        onPatchGlobal,
        ...navProps
    } = props;

    const [settingsOpen, setSettingsOpen] = useState(true);
    const [themeOpen, setThemeOpen] = useState(false);

    const version = manifest?.themeInfo?.version || "15.4.1";

    return (
        <aside className="dawn-customizer">
            <div className="dawn-customizer__brand">
                <strong>Dawn</strong>
                <span>v{version} · Shopify</span>
            </div>

            <div className="dawn-customizer__template">
                <label>
                    <LayoutTemplate size={14} />
                    Şablon
                </label>
                <select
                    value={activePageKey}
                    onChange={(e) => onPageChange?.(e.target.value)}
                >
                    {DAWN_TEMPLATES.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                </select>
            </div>

            <Accordion
                title="Tema ayarları"
                icon={Settings}
                open={themeOpen}
                onToggle={() => setThemeOpen((o) => !o)}
            >
                <DawnThemeSettingsPanel
                    groups={manifest?.settingsGroups || []}
                    values={document?.globalStyles?.dawnSettings || {}}
                    onChange={(path, value) => {
                        const dawnSettings = { ...(document?.globalStyles?.dawnSettings || {}), [path]: value };
                        onPatchGlobal?.("globalStyles", { ...document.globalStyles, dawnSettings });
                    }}
                />
            </Accordion>

            <div className="dawn-customizer__global">
                <button type="button" onClick={() => navProps.onSelectGlobal?.(HEADER_PANEL)}>
                    <PanelTop size={14} /> Üst bilgi
                </button>
                <button type="button" onClick={() => navProps.onSelectGlobal?.(FOOTER_PANEL)}>
                    <PanelBottom size={14} /> Alt bilgi
                </button>
                <button type="button" onClick={() => navProps.onSelectGlobal?.(GLOBAL_PANEL)}>
                    <Settings size={14} /> Renkler & font
                </button>
                <button type="button" onClick={() => navProps.onSelectGlobal?.(CHECKOUT_PANEL)}>
                    Ödeme
                </button>
                <button type="button" onClick={() => navProps.onSelectGlobal?.(SEO_PANEL)}>
                    SEO
                </button>
            </div>

            <Accordion
                title="Bölümler"
                icon={Layers}
                open={settingsOpen}
                onToggle={() => setSettingsOpen((o) => !o)}
            >
                <div className="dawn-customizer__sections">
                    <NavigatorPanel {...navProps} activePageKey={activePageKey} />
                </div>
            </Accordion>
        </aside>
    );
}
