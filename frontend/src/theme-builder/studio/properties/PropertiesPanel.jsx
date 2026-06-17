import React from "react";
import SchemaFormRenderer from "./SchemaFormRenderer";
import SectionPropertiesTabs from "./SectionPropertiesTabs";
import HeaderBuilderPanel from "../panels/HeaderBuilderPanel";
import FooterBuilderPanel from "../panels/FooterBuilderPanel";
import CheckoutBuilderPanel from "../panels/CheckoutBuilderPanel";
import GlobalStylesPanel from "../panels/GlobalStylesPanel";
import SeoPanel from "../panels/SeoPanel";
import {
    GLOBAL_PANEL, HEADER_PANEL, FOOTER_PANEL, CHECKOUT_PANEL, SEO_PANEL,
} from "../../registry/constants";

const PANEL_META = {
    [HEADER_PANEL]: { title: "Üst Menü", subtitle: "Logo, navigasyon ve header davranışı" },
    [FOOTER_PANEL]: { title: "Alt Menü", subtitle: "Footer blokları ve telif metni" },
    [CHECKOUT_PANEL]: { title: "Ödeme Sayfası", subtitle: "Checkout marka ve renk ayarları" },
    [GLOBAL_PANEL]: { title: "Tema Ayarları", subtitle: "Renkler, fontlar ve genel stil" },
    [SEO_PANEL]: { title: "Sayfa SEO", subtitle: "Başlık, açıklama ve meta etiketler" },
};

function PropsShell({ title, subtitle, children }) {
    return (
        <div className="tb-properties">
            <div className="tb-properties__head">
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="tb-properties__body">{children}</div>
        </div>
    );
}

export default function PropertiesPanel({
    selection,
    document,
    activePageKey,
    activeLocale,
    registry,
    siteId,
    onPatchSection,
    onPatchGlobal,
    onPatchPageSeo,
    editorMode = "sections",
}) {
    if (!document) return null;

    if (selection?.type === "global") {
        const meta = PANEL_META[selection.panel] || { title: "Ayarlar" };
        switch (selection.panel) {
            case HEADER_PANEL:
                return (
                    <PropsShell title={meta.title} subtitle={meta.subtitle}>
                        <HeaderBuilderPanel header={document.header} onChange={(header) => onPatchGlobal("header", header)} />
                    </PropsShell>
                );
            case FOOTER_PANEL:
                return (
                    <PropsShell title={meta.title} subtitle={meta.subtitle}>
                        <FooterBuilderPanel footer={document.footer} onChange={(footer) => onPatchGlobal("footer", footer)} />
                    </PropsShell>
                );
            case CHECKOUT_PANEL:
                return (
                    <PropsShell title={meta.title} subtitle={meta.subtitle}>
                        <CheckoutBuilderPanel checkout={document.checkout} onChange={(checkout) => onPatchGlobal("checkout", checkout)} />
                    </PropsShell>
                );
            case GLOBAL_PANEL:
                return (
                    <PropsShell title={meta.title} subtitle={meta.subtitle}>
                        <GlobalStylesPanel styles={document.globalStyles} onChange={(globalStyles) => onPatchGlobal("globalStyles", globalStyles)} />
                    </PropsShell>
                );
            case SEO_PANEL: {
                const page = document.pages?.[activePageKey];
                return (
                    <PropsShell title={meta.title} subtitle={meta.subtitle}>
                        <SeoPanel seo={page?.seo || {}} onChange={(seo) => onPatchPageSeo(activePageKey, seo)} />
                    </PropsShell>
                );
            }
            default:
                return null;
        }
    }

    if (selection?.type === "section") {
        const page = document.pages?.[activePageKey];
        const section = activePageKey === "product"
            ? (document.productPage?.sections || []).find((s) => s.id === selection.sectionId)
            : page?.sections?.find((s) => s.id === selection.sectionId);
        if (!section) return <p className="tb-props-empty">Bölüm bulunamadı</p>;

        const reg = registry.find((r) => r.key === section.type || r.defaults?.type === section.type)
            || registry.find((r) => r.defaults?.type === section.type);
        const schema = reg?.settingsSchema || [];

        const values = { ...(section.content || {}) };
        schema.forEach((f) => {
            if (values[f.id] === undefined && f.defaultValue !== undefined) values[f.id] = f.defaultValue;
        });

        return (
            <PropsShell title={reg?.label || section.type} subtitle="İçerik, tasarım ve yerleşim ayarları">
                <SectionPropertiesTabs
                    schema={schema}
                    values={values}
                    siteId={siteId}
                    onChange={(fieldId, value) => onPatchSection(section.id, `content.${fieldId}`, value, activeLocale)}
                    onPatchSettings={(fieldId, value) => onPatchSection(section.id, `settings.${fieldId}`, value, activeLocale)}
                />
            </PropsShell>
        );
    }

    if (editorMode === "brand") {
        return (
            <div className="tb-properties tb-properties--empty">
                <p>Marka ayarları sol panelde. Canlı önizleme ortada güncellenir.</p>
            </div>
        );
    }

    return (
        <div className="tb-properties tb-properties--empty">
            <p>Sol panelden bir bölüm, header/footer veya mağaza ayarı seçin.</p>
        </div>
    );
}
