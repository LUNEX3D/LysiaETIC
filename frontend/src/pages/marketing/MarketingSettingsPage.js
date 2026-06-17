import React, { useCallback, useEffect, useState } from "react";
import { FaCog, FaEnvelope, FaSms } from "react-icons/fa";
import { fetchMarketingSettings, updateMarketingSettings } from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingButton,
    MarketingField,
    MarketingAlert,
    MarketingSetupChecklist,
    MarketingSection,
    MarketingInfoBox,
} from "./components/MarketingUi";

const SMS_PROVIDERS = [
    { id: "", label: "Henüz seçilmedi" },
    { id: "netgsm", label: "Netgsm" },
];

const MarketingSettingsPage = ({ onNavigate }) => {
    const [settings, setSettings] = useState(null);
    const [smsApiKey, setSmsApiKey] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [msgType, setMsgType] = useState("success");

    const load = useCallback(async () => {
        const res = await fetchMarketingSettings();
        setSettings(res.settings || {});
        setSmsApiKey("");
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const save = async () => {
        setSaving(true);
        setMsg("");
        try {
            const payload = { ...settings };
            if (smsApiKey.trim()) {
                payload.smsProvider = {
                    ...settings.smsProvider,
                    apiKey: smsApiKey.trim(),
                };
            }
            const res = await updateMarketingSettings(payload);
            setSettings(res.settings);
            setSmsApiKey("");
            setMsgType("success");
            setMsg("Ayarlarınız kaydedildi. Artık kampanya gönderebilirsiniz.");
        } catch (e) {
            setMsgType("error");
            setMsg(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    if (!settings) return <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>;

    const emailReady = !!(settings.emailFromAddress?.trim());
    const smsReady =
        settings.smsProvider?.provider === "netgsm" &&
        settings.smsProvider?.apiUser &&
        settings.smsProvider?.hasApiKey;

    const checklist = [
        {
            id: "email",
            title: "E-posta gönderimi",
            hint: emailReady ? "Gönderen adresi tanımlı" : "Mağazanızdan hangi adresten mail gideceğini yazın",
            done: emailReady,
            action: !emailReady ? { label: "Aşağıya git", onClick: () => document.getElementById("mkt-email-setup")?.scrollIntoView({ behavior: "smooth" }) } : null,
        },
        {
            id: "sms",
            title: "SMS gönderimi (Netgsm)",
            hint: smsReady ? "Netgsm bağlantısı hazır" : "Netgsm kullanıcı adı ve şifrenizi girin",
            done: smsReady,
            action: !smsReady ? { label: "Aşağıya git", onClick: () => document.getElementById("mkt-sms-setup")?.scrollIntoView({ behavior: "smooth" }) } : null,
        },
        {
            id: "campaign",
            title: "İlk kampanyanızı gönderin",
            hint: "E-posta veya SMS listesinden başlayın",
            done: false,
            action: { label: "E-posta gönder", onClick: () => onNavigate?.("mkt-campaigns-email") },
        },
    ];

    return (
        <MarketingPageShell
            title="Kurulum ve ayarlar"
            subtitle="Gönderim için bir kez ayarlayın; sonra kampanyalardan tek tıkla mesaj iletin."
            icon={FaCog}
            actions={
                <MarketingButton variant="primary" onClick={save} disabled={saving}>
                    {saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
                </MarketingButton>
            }
        >
            {msg && <MarketingAlert type={msgType}>{msg}</MarketingAlert>}

            <MarketingSection title="Kurulum kontrol listesi">
                <MarketingSetupChecklist items={checklist} />
            </MarketingSection>

            <MarketingInfoBox title="E-posta hakkında" variant="tip">
                Sunucunuzda e-posta altyapısı (Resend) yöneticiniz tarafından tanımlanır. Burada yalnızca müşterilerin
                göreceği gönderen adı ve adresini belirlersiniz. Domain doğrulaması gerekebilir.
            </MarketingInfoBox>

            <div className="mkt-settings-grid">
                <div className="mkt-settings-card" id="mkt-email-setup">
                    <h2>
                        <FaEnvelope /> E-posta gönderen bilgisi
                    </h2>
                    <MarketingField label="Mağaza / marka adı">
                        <input
                            value={settings.emailFromName || ""}
                            onChange={(e) => setSettings((s) => ({ ...s, emailFromName: e.target.value }))}
                            placeholder="Örn. Dashtock Mağazam"
                        />
                    </MarketingField>
                    <MarketingField label="Gönderen e-posta adresi" hint="Doğrulanmış bir adres kullanın (örn. info@siteniz.com)">
                        <input
                            type="email"
                            value={settings.emailFromAddress || ""}
                            onChange={(e) => setSettings((s) => ({ ...s, emailFromAddress: e.target.value }))}
                            placeholder="info@magaza.com"
                        />
                    </MarketingField>
                </div>

                <div className="mkt-settings-card" id="mkt-sms-setup">
                    <h2>
                        <FaSms /> SMS (Netgsm)
                    </h2>
                    <MarketingField label="SMS firması">
                        <select
                            value={settings.smsProvider?.provider || ""}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    smsProvider: { ...s.smsProvider, provider: e.target.value },
                                }))
                            }
                        >
                            {SMS_PROVIDERS.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </MarketingField>
                    <MarketingField label="Netgsm kullanıcı kodu">
                        <input
                            value={settings.smsProvider?.apiUser || ""}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    smsProvider: { ...s.smsProvider, apiUser: e.target.value },
                                }))
                            }
                        />
                    </MarketingField>
                    <MarketingField
                        label="Netgsm şifre"
                        hint={settings.smsProvider?.hasApiKey ? `Kayıtlı şifre: ${settings.smsProvider.apiKeyMasked}` : "Panel şifrenizi girin"}
                    >
                        <input
                            type="password"
                            value={smsApiKey}
                            onChange={(e) => setSmsApiKey(e.target.value)}
                            placeholder={settings.smsProvider?.hasApiKey ? "Değiştirmek için yazın" : ""}
                            autoComplete="new-password"
                        />
                    </MarketingField>
                    <MarketingField label="SMS başlığı (gönderen adı)">
                        <input
                            value={settings.smsProvider?.senderId || ""}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    smsProvider: { ...s.smsProvider, senderId: e.target.value },
                                }))
                            }
                            placeholder="MAGAZA"
                        />
                    </MarketingField>
                </div>

                <div className="mkt-settings-card">
                    <h2>Sessiz saatler</h2>
                    <p className="mkt-settings-card__desc">Bu saatlerde otomatik SMS ve e-posta gönderilmez.</p>
                    <label className="mkt-check">
                        <input
                            type="checkbox"
                            checked={settings.quietHours?.enabled !== false}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    quietHours: { ...s.quietHours, enabled: e.target.checked },
                                }))
                            }
                        />
                        Sessiz saatleri kullan
                    </label>
                    <div className="mkt-settings-row-2">
                        <MarketingField label="Başlangıç">
                            <input
                                type="time"
                                value={settings.quietHours?.start || "22:00"}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        quietHours: { ...s.quietHours, start: e.target.value },
                                    }))
                                }
                            />
                        </MarketingField>
                        <MarketingField label="Bitiş">
                            <input
                                type="time"
                                value={settings.quietHours?.end || "09:00"}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        quietHours: { ...s.quietHours, end: e.target.value },
                                    }))
                                }
                            />
                        </MarketingField>
                    </div>
                </div>

                <div className="mkt-settings-card">
                    <h2>Günlük gönderim limiti</h2>
                    <p className="mkt-settings-card__desc">Aynı kişiye 24 saatte en fazla kaç mesaj gidebileceğini belirler.</p>
                    <div className="mkt-settings-row-2">
                        <MarketingField label="E-posta limiti">
                            <input
                                type="number"
                                min={1}
                                value={settings.limits?.emailPer24h ?? 2}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        limits: { ...s.limits, emailPer24h: Number(e.target.value) },
                                    }))
                                }
                            />
                        </MarketingField>
                        <MarketingField label="SMS limiti">
                            <input
                                type="number"
                                min={1}
                                value={settings.limits?.smsPer24h ?? 3}
                                onChange={(e) =>
                                    setSettings((s) => ({
                                        ...s,
                                        limits: { ...s.limits, smsPer24h: Number(e.target.value) },
                                    }))
                                }
                            />
                        </MarketingField>
                    </div>
                </div>
            </div>
        </MarketingPageShell>
    );
};

export default MarketingSettingsPage;
