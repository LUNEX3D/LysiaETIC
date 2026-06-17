import React, { useState } from "react";
import {
    Switch, Tooltip, Box, Typography, Tabs, Tab, IconButton, Button,
} from "@mui/material";
import {
    DeleteRounded, ContentCopyRounded, LockRounded, LockOpenRounded,
    CloseRounded, ExtensionOutlined,
} from "@mui/icons-material";
import { BLOCK_TYPE_LABELS } from "../blocks/BlockRegistry";
import InspectorSpacingPanel from "./InspectorSpacingPanel";
import InspectorColorPicker from "./InspectorColorPicker";
import WbMediaUpload from "./WbMediaUpload";

const FIELD_WRAP_STYLE = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 14,
};

const FIELD_LABEL_STYLE = {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    lineHeight: 1.3,
};

const INPUT_STYLE = {
    height: 36,
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 13,
    color: "#111827",
    background: "#fff",
    outline: "none",
};

const TEXTAREA_STYLE = {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    color: "#111827",
    background: "#fff",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
};

function Field({ label, children }) {
    return (
        <div style={FIELD_WRAP_STYLE}>
            {label ? <label style={FIELD_LABEL_STYLE}>{label}</label> : null}
            {children}
        </div>
    );
}

function TextInput({ label, value, onChange, placeholder, multiline, rows }) {
    return (
        <Field label={label}>
            {multiline ? (
                <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows || 3} style={TEXTAREA_STYLE} />
            ) : (
                <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={INPUT_STYLE} />
            )}
        </Field>
    );
}

function ColorInput({ label, value, onChange }) {
    return (
        <Field label={label}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                    type="color"
                    value={value || "#000000"}
                    onChange={(e) => onChange(e.target.value)}
                    style={{ width: 40, height: 36, flex: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: 2, background: "#fff", cursor: "pointer" }}
                />
                <input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#000000"
                    style={{ ...INPUT_STYLE, flex: 1, fontFamily: "monospace" }}
                />
            </div>
        </Field>
    );
}

function SelectInput({ label, value, onChange, options }) {
    return (
        <Field label={label}>
            <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </Field>
    );
}

function ToggleInput({ label, value, onChange }) {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <label style={FIELD_LABEL_STYLE}>{label}</label>
            <Switch size="small" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        </div>
    );
}

function NumberInput({ label, value, onChange, min, max }) {
    return (
        <Field label={label}>
            <input type="number" value={value || 0} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} style={INPUT_STYLE} />
        </Field>
    );
}

function HeroContentPanel({ content, onChange, siteId }) {
    return (
        <>
            <TextInput label="Başlık" value={content.heading} onChange={(v) => onChange({ heading: v })} />
            <TextInput label="Alt başlık" value={content.subheading} onChange={(v) => onChange({ subheading: v })} multiline rows={2} />
            <TextInput label="Buton metni" value={content.ctaText} onChange={(v) => onChange({ ctaText: v })} placeholder="Alışverişe Başla" />
            <TextInput label="Buton linki" value={content.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} placeholder="/products" />
            <SelectInput label="Arka plan tipi" value={content.backgroundType} onChange={(v) => onChange({ backgroundType: v })}
                options={[{ value: "gradient", label: "Gradyan" }, { value: "color", label: "Düz renk" }, { value: "image", label: "Görsel" }]} />
            {content.backgroundType === "color" && <ColorInput label="Arka plan rengi" value={content.backgroundColor} onChange={(v) => onChange({ backgroundColor: v })} />}
            {(content.backgroundType === "image" || content.backgroundUrl) && (
                siteId ? (
                    <WbMediaUpload siteId={siteId} label="Arka plan görseli" value={content.backgroundUrl} onChange={(url) => onChange({ backgroundUrl: url, backgroundType: "image" })} />
                ) : (
                    <TextInput label="Görsel URL" value={content.backgroundUrl} onChange={(v) => onChange({ backgroundUrl: v })} placeholder="https://..." />
                )
            )}
            <ColorInput label="Yazı rengi" value={content.textColor} onChange={(v) => onChange({ textColor: v })} />
            <ColorInput label="Buton rengi" value={content.ctaBg} onChange={(v) => onChange({ ctaBg: v })} />
            <Field label="Min yükseklik">
                <input type="text" style={INPUT_STYLE} value={content.minHeight || "400px"} onChange={(e) => onChange({ minHeight: e.target.value })} />
            </Field>
            <SelectInput label="Metin hizalama" value={content.textAlign} onChange={(v) => onChange({ textAlign: v })}
                options={[{ value: "left", label: "Sol" }, { value: "center", label: "Orta" }, { value: "right", label: "Sağ" }]} />
        </>
    );
}

function ProductGridContentPanel({ content, onChange }) {
    return (
        <>
            <TextInput label="Başlık" value={content.heading} onChange={(v) => onChange({ heading: v })} />
            <NumberInput label="Sütun sayısı" value={content.columns} onChange={(v) => onChange({ columns: v })} min={1} max={6} />
            <NumberInput label="Ürün sayısı" value={content.limit} onChange={(v) => onChange({ limit: v })} min={1} max={24} />
            <SelectInput label="Filtre" value={content.filter} onChange={(v) => onChange({ filter: v })}
                options={[{ value: "all", label: "Tümü" }, { value: "featured", label: "Öne Çıkanlar" }, { value: "new", label: "Yeni Gelenler" }, { value: "bestseller", label: "Çok Satanlar" }]} />
            <ToggleInput label="Fiyat göster" value={content.showPrice} onChange={(v) => onChange({ showPrice: v })} />
            <ToggleInput label="Sepete ekle butonu" value={content.showAddToCart} onChange={(v) => onChange({ showAddToCart: v })} />
        </>
    );
}

function ImageContentPanel({ content, onChange, siteId }) {
    return (
        <>
            {siteId ? (
                <WbMediaUpload siteId={siteId} label="Görsel" value={content.url} onChange={(url) => onChange({ url })} />
            ) : (
                <TextInput label="Görsel URL" value={content.url} onChange={(v) => onChange({ url: v })} placeholder="https://..." />
            )}
            <TextInput label="Alt metin" value={content.altText} onChange={(v) => onChange({ altText: v })} />
            <TextInput label="Link" value={content.linkUrl} onChange={(v) => onChange({ linkUrl: v })} placeholder="/products" />
        </>
    );
}

function BannerContentPanel({ content, onChange, siteId }) {
    return (
        <>
            <TextInput label="Başlık" value={content.heading} onChange={(v) => onChange({ heading: v })} />
            <TextInput label="Metin" value={content.text} onChange={(v) => onChange({ text: v })} multiline rows={2} />
            <TextInput label="Buton metni" value={content.ctaText} onChange={(v) => onChange({ ctaText: v })} />
            <TextInput label="Buton linki" value={content.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} placeholder="/products" />
            {siteId ? (
                <WbMediaUpload siteId={siteId} label="Banner görseli" value={content.backgroundUrl} onChange={(url) => onChange({ backgroundUrl: url })} />
            ) : (
                <TextInput label="Görsel URL" value={content.backgroundUrl} onChange={(v) => onChange({ backgroundUrl: v })} placeholder="https://..." />
            )}
            <ColorInput label="Arka plan rengi" value={content.backgroundColor} onChange={(v) => onChange({ backgroundColor: v })} />
            <ColorInput label="Yazı rengi" value={content.textColor} onChange={(v) => onChange({ textColor: v })} />
            <ToggleInput label="Overlay göster" value={content.showOverlay} onChange={(v) => onChange({ showOverlay: v })} />
            <Field label="Min yükseklik">
                <input type="text" style={INPUT_STYLE} value={content.minHeight || "200px"} onChange={(e) => onChange({ minHeight: e.target.value })} />
            </Field>
        </>
    );
}

function TextContentPanel({ content, onChange }) {
    return (
        <>
            <Field label="İçerik">
                <textarea
                    value={content.html || ""}
                    onChange={(e) => onChange({ html: e.target.value })}
                    rows={8}
                    style={TEXTAREA_STYLE}
                />
            </Field>
            <SelectInput label="Metin hizalama" value={content.textAlign} onChange={(v) => onChange({ textAlign: v })}
                options={[{ value: "left", label: "Sol" }, { value: "center", label: "Orta" }, { value: "right", label: "Sağ" }]} />
            <Field label="Maks. genişlik">
                <input type="text" style={INPUT_STYLE} value={content.maxWidth || "800px"} onChange={(e) => onChange({ maxWidth: e.target.value })} placeholder="800px" />
            </Field>
        </>
    );
}

function NewsletterContentPanel({ content, onChange }) {
    return (
        <>
            <TextInput label="Başlık" value={content.heading} onChange={(v) => onChange({ heading: v })} />
            <TextInput label="Alt metin" value={content.subtext} onChange={(v) => onChange({ subtext: v })} multiline rows={2} />
            <TextInput label="Yer tutucu" value={content.placeholder} onChange={(v) => onChange({ placeholder: v })} />
            <TextInput label="Buton metni" value={content.buttonText} onChange={(v) => onChange({ buttonText: v })} />
            <ColorInput label="Arka plan rengi" value={content.backgroundColor} onChange={(v) => onChange({ backgroundColor: v })} />
            <ColorInput label="Yazı rengi" value={content.textColor} onChange={(v) => onChange({ textColor: v })} />
            <TextInput label="Gizlilik metni" value={content.privacyText} onChange={(v) => onChange({ privacyText: v })} multiline rows={2} />
        </>
    );
}

function CountdownContentPanel({ content, onChange }) {
    return (
        <>
            <TextInput label="Başlık" value={content.heading} onChange={(v) => onChange({ heading: v })} />
            <TextInput label="Alt metin" value={content.subtext} onChange={(v) => onChange({ subtext: v })} />
            <Field label="Hedef tarih">
                <input type="datetime-local" style={INPUT_STYLE} value={content.targetDate ? content.targetDate.slice(0, 16) : ""} onChange={(e) => onChange({ targetDate: new Date(e.target.value).toISOString() })} />
            </Field>
            <ToggleInput label="Etiketleri göster" value={content.showLabels} onChange={(v) => onChange({ showLabels: v })} />
            <TextInput label="Buton metni" value={content.ctaText} onChange={(v) => onChange({ ctaText: v })} />
            <TextInput label="Buton linki" value={content.ctaUrl} onChange={(v) => onChange({ ctaUrl: v })} />
        </>
    );
}

function SpacerContentPanel({ content, onChange }) {
    return (
        <Field label="Yükseklik">
            <input type="text" style={INPUT_STYLE} value={content.height || "60px"} onChange={(e) => onChange({ height: e.target.value })} placeholder="60px" />
        </Field>
    );
}

function HtmlContentPanel({ content, onChange }) {
    return (
        <Field label="HTML içerik">
            <textarea value={content.html || ""} onChange={(e) => onChange({ html: e.target.value })} rows={8} style={{ ...TEXTAREA_STYLE, fontFamily: "monospace", fontSize: 12 }} />
        </Field>
    );
}

function GenericContentPlaceholder({ onOpenAdvanced }) {
    return (
        <Box className="wb-inspector-empty-state">
            <ExtensionOutlined className="wb-inspector-empty-state-icon" />
            <Typography variant="subtitle2" fontWeight={700}>
                Bu blok için görsel düzenleyici yok
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                İçerik ve yapılandırma ayarlarını Gelişmiş sekmesinden JSON olarak düzenleyebilirsiniz.
            </Typography>
            {onOpenAdvanced && (
                <Button size="small" variant="outlined" onClick={onOpenAdvanced} sx={{ mt: 1 }}>
                    Gelişmiş sekmesine git
                </Button>
            )}
        </Box>
    );
}

function JsonContentEditor({ content, onChange }) {
    return (
        <Field label="Blok verisi (JSON)">
            <textarea
                value={JSON.stringify(content, null, 2)}
                onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch { /* ignore */ } }}
                rows={12}
                style={{ ...TEXTAREA_STYLE, fontFamily: "monospace", fontSize: 11 }}
            />
        </Field>
    );
}

const CONTENT_PANELS = {
    hero: HeroContentPanel,
    "product-grid": ProductGridContentPanel,
    banner: BannerContentPanel,
    image: ImageContentPanel,
    text: TextContentPanel,
    newsletter: NewsletterContentPanel,
    countdown: CountdownContentPanel,
    spacer: SpacerContentPanel,
    html: HtmlContentPanel,
};

function ColorPanel({ settings, onChange, themeVariables }) {
    return (
        <>
            <InspectorColorPicker
                label="Arka plan rengi"
                value={settings.backgroundColor}
                onChange={(v) => onChange({ backgroundColor: v })}
                themeVariables={themeVariables}
            />
            <Field label="Arka plan görseli">
                <input type="text" className="wb-prop-input" value={settings.backgroundImage || ""} onChange={(e) => onChange({ backgroundImage: e.target.value })} placeholder="https://..." />
            </Field>
        </>
    );
}

function VisibilityPanel({ settings, onChange }) {
    return (
        <>
            <ToggleInput label="Bölümü gizle" value={settings.hidden} onChange={(v) => onChange({ hidden: v })} />
            <ToggleInput label="Mobilde gizle" value={settings.hiddenOnMobile} onChange={(v) => onChange({ hiddenOnMobile: v })} />
            <ToggleInput label="Masaüstünde gizle" value={settings.hiddenOnDesktop} onChange={(v) => onChange({ hiddenOnDesktop: v })} />
        </>
    );
}

function ResponsivePanel({ mobileOverride, onChange }) {
    return (
        <>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                Mobil önizlemede geçerli ek ayarlar.
            </Typography>
            <Field label="Mobil üst boşluk">
                <input type="text" style={INPUT_STYLE} value={mobileOverride.paddingTop || ""} onChange={(e) => onChange({ paddingTop: e.target.value })} placeholder="Varsayılan" />
            </Field>
            <Field label="Mobil alt boşluk">
                <input type="text" style={INPUT_STYLE} value={mobileOverride.paddingBottom || ""} onChange={(e) => onChange({ paddingBottom: e.target.value })} placeholder="Varsayılan" />
            </Field>
            <ToggleInput label="Mobilde tam genişlik" value={mobileOverride.fullWidth} onChange={(v) => onChange({ fullWidth: v })} />
        </>
    );
}

function AdvancedPanel({ section, settings, mobileOverride, onContentChange, onSettingsChange, onMobileChange }) {
    const isGeneric = !CONTENT_PANELS[section.type];
    const isHtml = section.type === "html";

    return (
        <Box sx={{ pt: 1 }}>
            <Field label="Özel CSS sınıfı">
                <input type="text" className="wb-prop-input" value={settings.customCssClass || ""} onChange={(e) => onSettingsChange(section.id, { customCssClass: e.target.value })} placeholder="my-class" />
            </Field>
            <ResponsivePanel
                mobileOverride={mobileOverride}
                onChange={(u) => onMobileChange(section.id, u)}
            />
            {isHtml && (
                <Field label="Özel CSS">
                    <textarea
                        className="wb-prop-input"
                        value={section.content?.css || ""}
                        onChange={(e) => onContentChange(section.id, { css: e.target.value })}
                        rows={4}
                        style={{ resize: "vertical", fontFamily: "monospace", fontSize: 11 }}
                    />
                </Field>
            )}
            {isGeneric && (
                <JsonContentEditor
                    content={section.content || {}}
                    onChange={(updates) => onContentChange(section.id, updates)}
                />
            )}
        </Box>
    );
}

export default function PropertiesPanel({
    siteId,
    section,
    themeVariables,
    onContentChange,
    onSettingsChange,
    onMobileChange,
    onRemove,
    onDuplicate,
    onToggleLock,
    onClose,
}) {
    const [tab, setTab] = useState(0);

    if (!section) return null;

    const ContentPanel = CONTENT_PANELS[section.type] || GenericContentPlaceholder;
    const isGeneric = !CONTENT_PANELS[section.type];
    const settings = section.settings || {};
    const mobileOverride = section.mobileOverride || {};
    const locked = section.isLocked;
    const blockLabel = BLOCK_TYPE_LABELS[section.type] || section.type;

    const actionBtnStyle = {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 34,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        color: "#374151",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
    };

    return (
        <div className="wb-properties wb-inspector">
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "14px 16px 10px",
                    borderBottom: "1px solid #f1f5f9",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: "#eef2ff",
                            color: "#4f46e5",
                            flexShrink: 0,
                        }}
                    >
                        <ExtensionOutlined sx={{ fontSize: 18 }} />
                    </span>
                    <span
                        style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#111827",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {blockLabel}
                    </span>
                </div>
                {onClose && (
                    <IconButton size="small" onClick={onClose} aria-label="Inspector kapat">
                        <CloseRounded fontSize="small" />
                    </IconButton>
                )}
            </div>

            <div style={{ display: "flex", gap: 8, padding: "10px 16px" }}>
                <button
                    type="button"
                    style={actionBtnStyle}
                    onClick={() => onToggleLock(section.id)}
                    title={section.isLocked ? "Kilidi aç" : "Kilitle"}
                >
                    {section.isLocked ? <LockRounded sx={{ fontSize: 16 }} /> : <LockOpenRounded sx={{ fontSize: 16 }} />}
                    {section.isLocked ? "Kilitli" : "Kilitle"}
                </button>
                <button
                    type="button"
                    style={actionBtnStyle}
                    onClick={() => onDuplicate(section.id)}
                    title="Çoğalt"
                >
                    <ContentCopyRounded sx={{ fontSize: 16 }} />
                    Kopyala
                </button>
                <button
                    type="button"
                    style={{
                        ...actionBtnStyle,
                        color: section.isLocked ? "#9ca3af" : "#dc2626",
                        borderColor: section.isLocked ? "#e5e7eb" : "#fecaca",
                        background: section.isLocked ? "#fff" : "#fef2f2",
                        cursor: section.isLocked ? "not-allowed" : "pointer",
                    }}
                    disabled={section.isLocked}
                    onClick={() => !section.isLocked && onRemove(section.id)}
                    title="Sil"
                >
                    <DeleteRounded sx={{ fontSize: 16 }} />
                    Sil
                </button>
            </div>

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="fullWidth"
                className="wb-inspector-tabs"
                sx={{
                    minHeight: 40,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "& .MuiTab-root": { minHeight: 40, fontSize: 12, fontWeight: 600, textTransform: "none" },
                }}
            >
                <Tab label="İçerik" />
                <Tab label="Stil" />
                <Tab label="Gelişmiş" />
            </Tabs>

            {locked && (
                <Box className="wb-inspector-locked-banner">
                    Blok kilitli — düzenlemek için kilidi açın.
                </Box>
            )}

            <Box className="wb-inspector-body" sx={{ opacity: locked ? 0.5 : 1, pointerEvents: locked ? "none" : "auto" }}>
                {tab === 0 && (
                    <Box sx={{ p: 2 }}>
                        {isGeneric ? (
                            <GenericContentPlaceholder onOpenAdvanced={() => setTab(2)} />
                        ) : (
                            <ContentPanel
                                content={section.content || {}}
                                onChange={(updates) => onContentChange(section.id, updates)}
                                siteId={siteId}
                            />
                        )}
                    </Box>
                )}
                {tab === 1 && (
                    <Box sx={{ p: 2 }}>
                        <InspectorSpacingPanel settings={settings} onChange={(u) => onSettingsChange(section.id, u)} />
                        <Box sx={{ mt: 2 }}>
                            <ColorPanel settings={settings} themeVariables={themeVariables} onChange={(u) => onSettingsChange(section.id, u)} />
                        </Box>
                        <Box sx={{ mt: 2 }}>
                            <VisibilityPanel settings={settings} onChange={(u) => onSettingsChange(section.id, u)} />
                        </Box>
                    </Box>
                )}
                {tab === 2 && (
                    <Box sx={{ p: 2 }}>
                        <AdvancedPanel
                            section={section}
                            settings={settings}
                            mobileOverride={mobileOverride}
                            onContentChange={onContentChange}
                            onSettingsChange={onSettingsChange}
                            onMobileChange={onMobileChange}
                        />
                    </Box>
                )}
            </Box>
        </div>
    );
}
