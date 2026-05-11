/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BrainAutonomy — Otonom Kontrol Merkezi
 * ───────────────────────────────────────────────────────────────────────────
 * Kullanıcı AI'ın hareket alanını burada şekillendirir:
 *   • Mod (manual / supervised / autonomous)
 *   • Hazır şablonlar (Tutucu / Dengeli / Agresif)
 *   • Kâr & Fiyat eşikleri (sliderlar)
 *   • Aksiyon izinleri (checkbox)
 *   • Çalışma saatleri
 *   • Kategori bazlı kurallar
 *   • Ürün whitelist / blacklist
 *
 * Tüm değişiklikler `/ai-engine/autonomy-config` endpoint'i ile kaydedilir.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import API from "../../../services/api";
import { T } from "../styles";
import { Card, CardHeader, Btn, Badge, EmptyState, LoadingState, PageHeader } from "./shared/SharedUI";

/* ─────────────────────────────────────────────────────────────────────────
 * Slider Bileşeni — okunabilir, etiketli
 * ───────────────────────────────────────────────────────────────────────── */
const Slider = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = "%", helper, color = T.accent, hint }) => {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <label style={{ fontSize: T.fz.sm, color: T.textSec, fontWeight: 600, letterSpacing: "0.01em" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: T.fz.lg, fontWeight: 800, color: color, fontFamily: T.fontMono }}>{value}</span>
                    <span style={{ fontSize: T.fz.sm, color: T.textMuted }}>{unit}</span>
                </div>
            </div>
            <div style={{ position: "relative", height: 8, background: T.bgInput, borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                    position: "absolute", inset: 0, width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}66, ${color})`,
                    transition: "width 0.2s ease",
                    borderRadius: 999,
                }} />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", margin: 0 }}
                    aria-label={label}
                />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.fz.xs, color: T.textMuted }}>
                <span>{min}{unit}</span>
                {helper && <span style={{ color: T.textDim }}>{helper}</span>}
                <span>{max}{unit}</span>
            </div>
            {hint && <div style={{ fontSize: T.fz.xs, color: T.textDim, marginTop: -2, fontStyle: "italic" }}>{hint}</div>}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────
 * Toggle (Switch)
 * ───────────────────────────────────────────────────────────────────────── */
const Toggle = ({ label, value, onChange, hint, color = T.accent }) => (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 16px", background: T.bgGlass, borderRadius: T.rSm, border: `1px solid ${T.border}`, cursor: "pointer" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: T.fz.base, color: T.text, fontWeight: 600 }}>{label}</span>
            {hint && <span style={{ fontSize: T.fz.xs, color: T.textDim }}>{hint}</span>}
        </div>
        <div role="switch" aria-checked={value} onClick={() => onChange(!value)} style={{
            position: "relative", width: 48, height: 26, borderRadius: 999,
            background: value ? color : T.bgInput,
            border: `1px solid ${value ? color : T.borderStrong}`,
            transition: "all 0.2s",
            cursor: "pointer", flexShrink: 0,
        }}>
            <div style={{
                position: "absolute", top: 2, left: value ? 24 : 2, width: 20, height: 20, borderRadius: "50%",
                background: T.textBright, transition: "left 0.2s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }} />
        </div>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
    </label>
);

/* ─────────────────────────────────────────────────────────────────────────
 * Number Input
 * ───────────────────────────────────────────────────────────────────────── */
const NumInput = ({ label, value, onChange, min = 0, max = 1000000, suffix, hint }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: T.fz.sm, color: T.textSec, fontWeight: 600 }}>{label}</label>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                min={min}
                max={max}
                style={{
                    flex: 1, padding: "10px 14px", paddingRight: suffix ? 50 : 14,
                    background: T.bgInput, border: `1px solid ${T.border}`,
                    borderRadius: T.rSm, color: T.text, fontSize: T.fz.base, fontFamily: T.fontMono, fontWeight: 600,
                    outline: "none",
                }}
            />
            {suffix && <span style={{ position: "absolute", right: 14, color: T.textDim, fontSize: T.fz.sm, fontWeight: 600 }}>{suffix}</span>}
        </div>
        {hint && <span style={{ fontSize: T.fz.xs, color: T.textDim, fontStyle: "italic" }}>{hint}</span>}
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────
 * Mod Kartı — büyük seçilebilir kart
 * ───────────────────────────────────────────────────────────────────────── */
const ModeCard = ({ mode, active, onClick, title, icon, description, color, badge }) => (
    <button onClick={onClick}
        className="lysia-hover-lift lysia-focus"
        style={{
            flex: 1, minWidth: 240, padding: "20px",
            background: active ? `${color}18` : T.bgGlass,
            border: `2px solid ${active ? color : T.border}`,
            borderRadius: T.rMd, cursor: "pointer",
            textAlign: "left", color: T.text,
            transition: "all 0.25s ease",
            boxShadow: active ? `0 0 24px ${color}30` : "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: "1.8rem" }}>{icon}</div>
            {active && <Badge color={color} size="sm">AKTİF</Badge>}
        </div>
        <h4 style={{ fontSize: T.fz.lg, fontWeight: 800, margin: "0 0 6px", color: active ? color : T.text }}>{title}</h4>
        <p style={{ fontSize: T.fz.sm, color: T.textDim, margin: 0, lineHeight: 1.5 }}>{description}</p>
        {badge && <div style={{ marginTop: 12, fontSize: T.fz.xs, color: T.textMuted, fontStyle: "italic" }}>{badge}</div>}
    </button>
);

/* ═════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═════════════════════════════════════════════════════════════════════════ */
const BrainAutonomy = ({ t = (k) => k, onError }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(null);
    const [status, setStatus] = useState(null);
    const [presets, setPresets] = useState({});
    const [dirty, setDirty] = useState(false);
    const [toast, setToast] = useState(null);
    const [newCategoryRule, setNewCategoryRule] = useState({ category: "", maxDiscountPercent: 30, minProfitMarginPercent: 5 });

    const showToast = useCallback((message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    /* ─────────── Load ─────────── */
    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [cfgRes, stRes] = await Promise.all([
                API.get("/ai-engine/autonomy-config"),
                API.get("/ai-engine/autonomy-config/status"),
            ]);
            setConfig(cfgRes.data.config);
            setPresets(cfgRes.data.presets || {});
            setStatus(stRes.data.status);
            setDirty(false);
        } catch (e) {
            const msg = e?.response?.data?.message || e.message;
            onError && onError(msg);
            showToast(msg, "error");
        } finally {
            setLoading(false);
        }
    }, [onError, showToast]);

    useEffect(() => { load(); }, [load]);

    /* ─────────── Save ─────────── */
    const save = useCallback(async () => {
        if (!config) return;
        try {
            setSaving(true);
            const { _id, userId, createdAt, updatedAt, __v, ...payload } = config;
            const res = await API.put("/ai-engine/autonomy-config", payload);
            setConfig(res.data.config);
            setDirty(false);
            showToast("Kurallar kaydedildi ✓", "success");
        } catch (e) {
            showToast(e?.response?.data?.message || e.message, "error");
        } finally {
            setSaving(false);
        }
    }, [config, showToast]);

    const applyPreset = useCallback(async (name) => {
        if (!window.confirm(`'${name.toUpperCase()}' şablonu mevcut tüm kuralları değiştirecek. Devam edilsin mi?`)) return;
        try {
            setSaving(true);
            const res = await API.post(`/ai-engine/autonomy-config/preset/${name}`);
            setConfig(res.data.config);
            setDirty(false);
            showToast(`'${name}' şablonu uygulandı ✓`, "success");
        } catch (e) {
            showToast(e?.response?.data?.message || e.message, "error");
        } finally {
            setSaving(false);
        }
    }, [showToast]);

    /* ─────────── Patcher ─────────── */
    const patch = useCallback((updates) => {
        setConfig(prev => ({ ...prev, ...updates }));
        setDirty(true);
    }, []);

    /* ─────────── Loading / empty ─────────── */
    if (loading) return <LoadingState message="Otonomi kuralları yükleniyor..." />;
    if (!config) return <EmptyState icon="⚠️" title="Konfigürasyon yüklenemedi" description="Daha sonra tekrar deneyin" action={<Btn onClick={load}>Tekrar Dene</Btn>} />;

    const allActions = [
        { id: "update_price", label: "Fiyat Güncelleme", icon: "💰" },
        { id: "apply_discount", label: "İndirim Uygulama", icon: "🏷️" },
        { id: "create_stock_order", label: "Stok Siparişi", icon: "📦" },
        { id: "review_strategy", label: "Strateji İnceleme", icon: "📋" },
        { id: "investigate", label: "Araştırma / Soruşturma", icon: "🔍" },
    ];

    const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

    const modeLabel = config.mode === "manual" ? "Manuel" : config.mode === "supervised" ? "Denetimli" : "Tam Otonom";
    const modeColor = config.mode === "autonomous" ? T.red : config.mode === "supervised" ? T.accent : T.textSec;
    const tldrAutonomy = (() => {
        const parts = [`AI şu an "${modeLabel}" modda çalışıyor.`];
        if (config.mode === "manual") parts.push("Hiçbir aksiyon otomatik uygulanmıyor — her şey senin onayını bekliyor.");
        else if (config.mode === "supervised") parts.push("Küçük/güvenli aksiyonlar oto, kritik olanlar onay bekliyor.");
        else parts.push("AI tüm kuralların içinde özgürce karar veriyor — yakından izle.");
        if (status?.withinWorkHours === false) parts.push("⏰ Şu an çalışma saatleri dışında, AI pasif.");
        return parts.join(" ");
    })();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <PageHeader
                icon="🎛️"
                title="Otonom Kontrol Merkezi"
                subtitle="AI'nın çalışma kurallarını sen belirle — burada yaptığın her değişiklik tüm önerileri ve aksiyonları şekillendirir"
                tldr={tldrAutonomy}
                status={config.mode === "autonomous" ? "warning" : config.mode === "supervised" ? "good" : "info"}
                kpis={[
                    { label: "Mod", value: modeLabel, color: modeColor },
                    { label: "Çalışma Saatleri", value: status?.withinWorkHours ? "İçinde" : "Dışında", color: status?.withinWorkHours ? T.green : T.red },
                    { label: "Saatlik", value: `${status?.rateLimit?.hourly || 0}/${status?.rateLimit?.limit || 0}`, color: T.blue, hint: "Bu saatte uygulanan aksiyon / limit" },
                    { label: "Bugün", value: status?.rateLimit?.daily || 0, color: T.purple, hint: "Bugün toplam aksiyon" },
                    { label: "Whitelist", value: status?.whitelistCount || 0, color: (status?.whitelistCount || 0) > 0 ? T.green : T.textMuted, hint: "Sadece bu ürünlere AI dokunabilir" },
                    { label: "Blacklist", value: status?.blacklistCount || 0, color: (status?.blacklistCount || 0) > 0 ? T.red : T.textMuted, hint: "AI bu ürünlere asla dokunmaz" },
                    { label: "Kategori Kuralı", value: status?.categoryRuleCount || 0, color: T.cyan },
                ]}
                actions={dirty ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge color={T.yellow} pulse>Kaydedilmemiş</Badge>
                        <Btn color={T.accent} onClick={save} loading={saving} glow>💾 Kaydet</Btn>
                        <Btn variant="ghost" onClick={load}>İptal</Btn>
                    </div>
                ) : null}
            />

            {/* ═════ HAZIR ŞABLONLAR ═════ */}
            <Card>
                <CardHeader icon="✨" title="Hazır Şablonlar" subtitle="Tek tıkla AI'ın davranışını çevir — sonra ince ayar yap" color={T.purple} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                    <PresetCard name="conservative" current={config.presetUsed} onClick={() => applyPreset("conservative")}
                        icon="🛡️" title="Tutucu" color={T.green}
                        bullets={["Min %12 kâr marjı", "Max %15 indirim", "Saatte 20 aksiyon", "Daima onay gerektirir"]}
                        description="Düşük risk, sıkı limitler. Yeni sezonda veya rakip değişimlerinde."
                    />
                    <PresetCard name="balanced" current={config.presetUsed} onClick={() => applyPreset("balanced")}
                        icon="⚖️" title="Dengeli" color={T.accent}
                        bullets={["Min %5 kâr marjı", "Max %30 indirim", "Saatte 50 aksiyon", "100₺ altı oto onay"]}
                        description="Tavsiye edilen başlangıç — risk ve etki dengeli."
                    />
                    <PresetCard name="aggressive" current={config.presetUsed} onClick={() => applyPreset("aggressive")}
                        icon="🚀" title="Agresif" color={T.red}
                        bullets={["Min %3 kâr marjı", "Max %50 indirim", "Saatte 100 aksiyon", "Otonom mod aktif"]}
                        description="Hızlı testler / kampanya dönemleri. Yakından izlemen önerilir."
                    />
                </div>
            </Card>

            {/* ═════ MOD SEÇİMİ ═════ */}
            <Card>
                <CardHeader icon="🎚️" title="AI Operasyon Modu" subtitle="AI ne kadar otonom çalışsın?" color={T.blue} />
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <ModeCard mode="manual" active={config.mode === "manual"} onClick={() => patch({ mode: "manual" })}
                        icon="✋" title="Manuel" color={T.textDim}
                        description="AI yalnızca öneri üretir, hiçbir aksiyon otomatik uygulanmaz. Her şeyi sen onaylarsın." />
                    <ModeCard mode="supervised" active={config.mode === "supervised"} onClick={() => patch({ mode: "supervised" })}
                        icon="👁️" title="Denetimli" color={T.accent}
                        description="Küçük etki + yüksek güvenli aksiyonlar otomatik, kritik olanlar onay bekler. Tavsiye edilen mod."
                        badge="Tavsiye edilen başlangıç" />
                    <ModeCard mode="autonomous" active={config.mode === "autonomous"} onClick={() => patch({ mode: "autonomous" })}
                        icon="🤖" title="Tam Otonom" color={T.red}
                        description="AI tüm güvenlik limitleri içinde özgürce çalışır. Sadece guardrail tetiklenirse onay ister."
                        badge="⚠ Yakın takip önerilir" />
                </div>
            </Card>

            {/* ═════ KÂR & FİYAT KURALLARI ═════ */}
            <Card>
                <CardHeader icon="💰" title="Kâr & Fiyat Kuralları" subtitle="AI hangi marjın altına asla düşemez? Tek seferde ne kadar fiyat değişikliği yapabilir?" color={T.green} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                    <Slider label="🎯 Hedef Kâr Marjı"
                        value={config.targetProfitMarginPercent} onChange={(v) => patch({ targetProfitMarginPercent: v })}
                        min={0} max={50} color={T.green}
                        hint="AI öneri üretirken bu marjı hedefler" />
                    <Slider label="🛡️ Min Kâr Marjı (Zarar Koruması)"
                        value={config.minProfitMarginPercent} onChange={(v) => patch({ minProfitMarginPercent: v })}
                        min={0} max={50} color={T.red}
                        hint="Bu marjın altına ASLA düşürmez (önce onay ister)" />
                    <Slider label="📈 Maks Fiyat Artışı"
                        value={config.maxPriceIncreasePercent} onChange={(v) => patch({ maxPriceIncreasePercent: v })}
                        min={1} max={100} color={T.blue}
                        hint="Tek seferde fiyat ne kadar yükselebilir?" />
                    <Slider label="📉 Maks Fiyat Düşüşü"
                        value={config.maxPriceChangePercent} onChange={(v) => patch({ maxPriceChangePercent: v })}
                        min={1} max={100} color={T.orange}
                        hint="Tek seferde fiyat ne kadar düşebilir?" />
                    <Slider label="🏷️ Maks İndirim Yüzdesi"
                        value={config.maxDiscountPercent} onChange={(v) => patch({ maxDiscountPercent: v })}
                        min={0} max={90} color={T.purple}
                        hint="Tek seferde uygulanabilecek maks indirim" />
                    <Slider label="⏬ Min İndirim Yüzdesi"
                        value={config.minDiscountPercent} onChange={(v) => patch({ minDiscountPercent: v })}
                        min={0} max={20} color={T.textDim}
                        hint="Bunun altındaki indirimler atlanır (anlamsız)" />
                </div>
            </Card>

            {/* ═════ HIZ & ONAY POLİTİKASI ═════ */}
            <Card>
                <CardHeader icon="⚡" title="Hız & Onay Politikası" subtitle="Saatte kaç aksiyon? Hangileri otomatik onaylanır?" color={T.cyan} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
                    <Slider label="⚡ Saatte Maks Aksiyon"
                        value={config.maxActionsPerHour} onChange={(v) => patch({ maxActionsPerHour: v })}
                        min={1} max={200} unit="" color={T.cyan}
                        hint="AI saatte bu sayıdan fazla aksiyon yapmaz" />
                    <Slider label="⏱️ Aynı Ürün Cooldown"
                        value={config.cooldownMinutes} onChange={(v) => patch({ cooldownMinutes: v })}
                        min={0} max={120} unit=" dk" color={T.yellow}
                        hint="Aynı ürüne tekrar müdahale arası min süre" />
                    <NumInput label="💸 Oto Onay Eşiği (₺ etki)"
                        value={config.autoApproveBelowImpactTRY} onChange={(v) => patch({ autoApproveBelowImpactTRY: v })}
                        min={0} max={100000} suffix="₺"
                        hint="Bu TRY etkinin altındaki aksiyonlar oto onaylanır" />
                    <Slider label="🎯 Oto Onay Min Güven"
                        value={config.autoApproveOnlyIfConfidence} onChange={(v) => patch({ autoApproveOnlyIfConfidence: v })}
                        min={0} max={100} color={T.accent}
                        hint="AI güveni bu eşiğin üstündeyse oto onay" />
                </div>
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    <Toggle label="🚨 Kritik aksiyonlar için her zaman onay iste"
                        value={config.requireApprovalForCritical}
                        onChange={(v) => patch({ requireApprovalForCritical: v })}
                        hint="Önerilir: yüksek riskli aksiyonlar için ek güvenlik" />
                    <Toggle label="📦 Otomatik stok siparişi"
                        value={config.enableAutoRestock}
                        onChange={(v) => patch({ enableAutoRestock: v })}
                        hint="Kapalıyken: stok önerileri daima onay bekler" />
                </div>
            </Card>

            {/* ═════ AKSİYON İZİNLERİ ═════ */}
            <Card>
                <CardHeader icon="🔐" title="Aksiyon İzinleri" subtitle="Hangi aksiyon tiplerini AI yapabilir?" color={T.pink} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    {allActions.map(act => {
                        const enabled = (config.allowedActions || []).includes(act.id);
                        return (
                            <label key={act.id} className="lysia-hover-lift" style={{
                                display: "flex", alignItems: "center", gap: 12, padding: "14px",
                                background: enabled ? `${T.accent}12` : T.bgGlass,
                                border: `1px solid ${enabled ? T.accent : T.border}`,
                                borderRadius: T.rSm, cursor: "pointer",
                            }}>
                                <input type="checkbox" checked={enabled}
                                    onChange={(e) => {
                                        const cur = config.allowedActions || [];
                                        if (e.target.checked) patch({ allowedActions: [...cur, act.id] });
                                        else patch({ allowedActions: cur.filter(a => a !== act.id) });
                                    }}
                                    style={{ width: 18, height: 18, accentColor: T.accent, cursor: "pointer" }} />
                                <span style={{ fontSize: "1.25rem" }}>{act.icon}</span>
                                <span style={{ fontSize: T.fz.base, color: enabled ? T.text : T.textDim, fontWeight: 600 }}>{act.label}</span>
                            </label>
                        );
                    })}
                </div>
            </Card>

            {/* ═════ ÇALIŞMA SAATLERİ ═════ */}
            <Card>
                <CardHeader icon="⏰" title="Çalışma Saatleri" subtitle="AI yalnızca seçilen saat aralığında otonom aksiyon alır" color={T.orange} />
                <Toggle label="Çalışma saatleri kısıtlamasını aktif et"
                    value={!!config.workHours?.enabled}
                    onChange={(v) => patch({ workHours: { ...(config.workHours || {}), enabled: v } })}
                    hint="Kapalı: AI 7/24 çalışır" />

                {config.workHours?.enabled && (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginTop: 20 }}>
                            <NumInput label="Başlangıç saati"
                                value={config.workHours?.startHour ?? 9}
                                onChange={(v) => patch({ workHours: { ...(config.workHours || {}), startHour: Math.max(0, Math.min(23, v)) } })}
                                min={0} max={23} suffix=":00"
                                hint="0-23 arası" />
                            <NumInput label="Bitiş saati"
                                value={config.workHours?.endHour ?? 22}
                                onChange={(v) => patch({ workHours: { ...(config.workHours || {}), endHour: Math.max(0, Math.min(23, v)) } })}
                                min={0} max={23} suffix=":00" />
                        </div>
                        <div style={{ marginTop: 20 }}>
                            <label style={{ fontSize: T.fz.sm, color: T.textSec, fontWeight: 600, marginBottom: 10, display: "block" }}>Aktif günler</label>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {dayNames.map((d, idx) => {
                                    const active = (config.workHours?.daysOfWeek || []).includes(idx);
                                    return (
                                        <button key={idx} className="lysia-hover-lift" onClick={() => {
                                            const cur = config.workHours?.daysOfWeek || [];
                                            const newDays = active ? cur.filter(x => x !== idx) : [...cur, idx];
                                            patch({ workHours: { ...(config.workHours || {}), daysOfWeek: newDays } });
                                        }} style={{
                                            padding: "10px 16px",
                                            background: active ? T.accent : T.bgGlass,
                                            color: active ? T.textOnAccent : T.textDim,
                                            border: `1px solid ${active ? T.accent : T.border}`,
                                            borderRadius: T.rSm, cursor: "pointer", fontWeight: 700, fontSize: T.fz.sm,
                                        }}>{d}</button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </Card>

            {/* ═════ KATEGORİ KURALLARI ═════ */}
            <Card>
                <CardHeader icon="📂" title="Kategori Bazlı Kurallar" subtitle="Belirli kategoriler için özel limitler (genel kuralları geçersiz kılar)" color={T.cyan} />
                {(config.categoryRules || []).length === 0 && (
                    <EmptyState icon="📂" title="Henüz kategori kuralı eklenmedi" description="Aşağıdan ekleyebilirsin — örn. 'Elektronik' için min %20 marj" />
                )}
                {(config.categoryRules || []).length > 0 && (
                    <div style={{ overflow: "auto", marginBottom: 20 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: T.fz.sm }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                    <th style={{ textAlign: "left", padding: 10, color: T.textDim, fontWeight: 600 }}>Kategori</th>
                                    <th style={{ textAlign: "left", padding: 10, color: T.textDim, fontWeight: 600 }}>Maks İndirim</th>
                                    <th style={{ textAlign: "left", padding: 10, color: T.textDim, fontWeight: 600 }}>Min Marj</th>
                                    <th style={{ textAlign: "left", padding: 10, color: T.textDim, fontWeight: 600 }}>Hedef Marj</th>
                                    <th style={{ width: 60 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {config.categoryRules.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                                        <td style={{ padding: 10, color: T.text, fontWeight: 600 }}>{r.category}</td>
                                        <td style={{ padding: 10, color: T.purple, fontFamily: T.fontMono }}>%{r.maxDiscountPercent ?? "—"}</td>
                                        <td style={{ padding: 10, color: T.red, fontFamily: T.fontMono }}>%{r.minProfitMarginPercent ?? "—"}</td>
                                        <td style={{ padding: 10, color: T.green, fontFamily: T.fontMono }}>%{r.targetProfitMarginPercent ?? "—"}</td>
                                        <td style={{ padding: 10 }}>
                                            <button onClick={() => patch({ categoryRules: config.categoryRules.filter((_, idx) => idx !== i) })}
                                                style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: "1.1rem" }}
                                                aria-label="Sil">✕</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: T.fz.sm, color: T.textSec, fontWeight: 600 }}>Kategori adı</label>
                        <input type="text" value={newCategoryRule.category}
                            onChange={(e) => setNewCategoryRule(p => ({ ...p, category: e.target.value }))}
                            placeholder="örn. Elektronik"
                            style={{ padding: "10px 14px", background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: T.rSm, color: T.text, fontSize: T.fz.base }} />
                    </div>
                    <NumInput label="Maks İndirim" value={newCategoryRule.maxDiscountPercent}
                        onChange={(v) => setNewCategoryRule(p => ({ ...p, maxDiscountPercent: v }))} min={0} max={90} suffix="%" />
                    <NumInput label="Min Marj" value={newCategoryRule.minProfitMarginPercent}
                        onChange={(v) => setNewCategoryRule(p => ({ ...p, minProfitMarginPercent: v }))} min={0} max={100} suffix="%" />
                    <NumInput label="Hedef Marj" value={newCategoryRule.targetProfitMarginPercent || 15}
                        onChange={(v) => setNewCategoryRule(p => ({ ...p, targetProfitMarginPercent: v }))} min={0} max={200} suffix="%" />
                    <Btn color={T.cyan} onClick={() => {
                        if (!newCategoryRule.category?.trim()) return showToast("Kategori adı boş olamaz", "error");
                        const exists = (config.categoryRules || []).some(r => r.category === newCategoryRule.category.trim());
                        if (exists) return showToast("Bu kategori zaten ekli", "error");
                        patch({
                            categoryRules: [...(config.categoryRules || []), {
                                category: newCategoryRule.category.trim(),
                                maxDiscountPercent: Number(newCategoryRule.maxDiscountPercent),
                                minProfitMarginPercent: Number(newCategoryRule.minProfitMarginPercent),
                                targetProfitMarginPercent: Number(newCategoryRule.targetProfitMarginPercent || 15),
                            }],
                        });
                        setNewCategoryRule({ category: "", maxDiscountPercent: 30, minProfitMarginPercent: 5, targetProfitMarginPercent: 15 });
                    }}>+ Ekle</Btn>
                </div>
            </Card>

            {/* ═════ ÜRÜN WHITELIST / BLACKLIST ═════ */}
            <Card>
                <CardHeader icon="🧬" title="Ürün Listeleri" subtitle="Whitelist boş ise AI tüm ürünleri yönetebilir. Blacklist'teki ürünlere asla dokunulmaz." color={T.purple} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                    <div>
                        <label style={{ fontSize: T.fz.base, color: T.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                            ✓ Whitelist <Badge color={T.green} size="sm">{(config.productWhitelist || []).length}</Badge>
                        </label>
                        <p style={{ fontSize: T.fz.xs, color: T.textDim, margin: "4px 0 8px" }}>Barkodları satır satır yapıştır. Boş = tüm ürünler aktif.</p>
                        <textarea
                            value={(config.productWhitelist || []).join("\n")}
                            onChange={(e) => patch({ productWhitelist: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                            placeholder="örn.&#10;8690000000001&#10;8690000000002"
                            style={{ width: "100%", minHeight: 160, padding: 12, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: T.rSm, color: T.text, fontSize: T.fz.sm, fontFamily: T.fontMono, resize: "vertical" }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: T.fz.base, color: T.red, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                            ✗ Blacklist <Badge color={T.red} size="sm">{(config.productBlacklist || []).length}</Badge>
                        </label>
                        <p style={{ fontSize: T.fz.xs, color: T.textDim, margin: "4px 0 8px" }}>Bu barkodlu ürünlere AI ASLA dokunmaz.</p>
                        <textarea
                            value={(config.productBlacklist || []).join("\n")}
                            onChange={(e) => patch({ productBlacklist: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                            placeholder="örn.&#10;8690000000099"
                            style={{ width: "100%", minHeight: 160, padding: 12, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: T.rSm, color: T.text, fontSize: T.fz.sm, fontFamily: T.fontMono, resize: "vertical" }}
                        />
                    </div>
                </div>
            </Card>

            {/* ═════ KAYDET (Sticky Footer) ═════ */}
            {dirty && (
                <div style={{ position: "sticky", bottom: 0, padding: "16px 20px", background: `linear-gradient(180deg, transparent, ${T.bg})`, display: "flex", justifyContent: "flex-end", gap: 12, zIndex: 10 }}>
                    <Btn variant="ghost" onClick={load}>İptal</Btn>
                    <Btn color={T.accent} onClick={save} loading={saving} glow>💾 Tüm Kuralları Kaydet</Btn>
                </div>
            )}

            {/* ═════ TOAST ═════ */}
            {toast && (
                <div style={{ position: "fixed", top: 24, right: 24, padding: "12px 20px", background: toast.type === "error" ? T.redDim : T.greenDim, color: toast.type === "error" ? T.red : T.green, border: `1px solid ${toast.type === "error" ? T.red : T.green}`, borderRadius: T.rSm, fontWeight: 700, zIndex: 9999, boxShadow: T.shadowLg }}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────
 * Helper components
 * ───────────────────────────────────────────────────────────────────────── */
const StatusChip = ({ label, value, color = T.accent }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: `${color}15`, border: `1px solid ${color}33`, borderRadius: 999, fontSize: T.fz.xs }}>
        <span style={{ color: T.textDim, fontWeight: 600 }}>{label}:</span>
        <span style={{ color, fontWeight: 700 }}>{value}</span>
    </div>
);

const PresetCard = ({ name, current, onClick, icon, title, color, bullets, description }) => {
    const active = current === name;
    return (
        <button onClick={onClick} className="lysia-hover-lift lysia-focus" style={{
            padding: 20, background: active ? `${color}15` : T.bgGlass,
            border: `2px solid ${active ? color : T.border}`,
            borderRadius: T.rMd, cursor: "pointer", textAlign: "left", color: T.text,
            transition: "all 0.25s ease",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: "1.8rem" }}>{icon}</div>
                {active && <Badge color={color} size="sm">UYGULANMIŞ</Badge>}
            </div>
            <h4 style={{ fontSize: T.fz.lg, fontWeight: 800, margin: "0 0 6px", color: active ? color : T.text }}>{title}</h4>
            <p style={{ fontSize: T.fz.sm, color: T.textDim, margin: "0 0 14px", lineHeight: 1.5 }}>{description}</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {bullets.map((b, i) => (
                    <li key={i} style={{ fontSize: T.fz.xs, color: T.textSec, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color }}>•</span> {b}
                    </li>
                ))}
            </ul>
        </button>
    );
};

export default BrainAutonomy;
