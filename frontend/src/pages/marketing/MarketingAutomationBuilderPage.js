import React, { useCallback, useEffect, useState } from "react";
import { FaRobot, FaArrowLeft, FaPlay, FaPause, FaSave } from "react-icons/fa";
import { fetchAutomation, updateAutomation } from "../../services/marketingApi";
import {
    MarketingPageShell,
    MarketingButton,
    MarketingBadge,
    MarketingAlert,
    MarketingSection,
    MarketingEmptyState,
    MarketingField,
} from "./components/MarketingUi";

const NODE_LABELS = {
    trigger: "Tetikleyici",
    delay: "Bekleme",
    action: "Aksiyon",
    condition: "Koşul",
};

const MarketingAutomationBuilderPage = ({ automationId, onNavigate }) => {
    const [auto, setAuto] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchAutomation(automationId);
            setAuto(res.automation || null);
            setNodes(res.automation?.nodes || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [automationId]);

    useEffect(() => {
        load();
    }, [load]);

    const toggleStatus = async () => {
        const res = await updateAutomation(automationId, {
            status: auto.status === "active" ? "paused" : "active",
        });
        setAuto(res.automation);
    };

    const updateNodeConfig = (nodeId, patch) => {
        setNodes((prev) =>
            prev.map((n) => (n.id === nodeId ? { ...n, config: { ...n.config, ...patch } } : n))
        );
    };

    const saveFlow = async () => {
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const res = await updateAutomation(automationId, { nodes });
            setAuto(res.automation);
            setNodes(res.automation?.nodes || nodes);
            setSuccess("Akış kaydedildi.");
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="mkt-empty mkt-empty--inline">Yükleniyor…</p>;
    if (!auto) {
        return (
            <MarketingPageShell title="Otomasyon" icon={FaRobot}>
                <MarketingEmptyState title="Otomasyon bulunamadı" hint="Listeye dönüp tekrar deneyin." />
            </MarketingPageShell>
        );
    }

    return (
        <MarketingPageShell
            title={auto.name}
            subtitle="Adımları düzenleyin ve «Yayınla» ile otomasyonu açın."
            icon={FaRobot}
            actions={
                <div className="mkt-btn-group">
                    <MarketingButton variant="ghost" icon={FaArrowLeft} onClick={() => onNavigate?.("mkt-automations")}>
                        Geri
                    </MarketingButton>
                    <MarketingBadge status={auto.status} />
                    <MarketingButton variant="ghost" icon={FaSave} onClick={saveFlow} disabled={saving}>
                        {saving ? "Kaydediliyor…" : "Kaydet"}
                    </MarketingButton>
                    <MarketingButton variant="primary" icon={auto.status === "active" ? FaPause : FaPlay} onClick={toggleStatus}>
                        {auto.status === "active" ? "Duraklat" : "Yayınla"}
                    </MarketingButton>
                </div>
            }
        >
            {error && <MarketingAlert type="error">{error}</MarketingAlert>}
            {success && <MarketingAlert type="success">{success}</MarketingAlert>}

            <MarketingSection title="Akış adımları">
                {nodes.length === 0 ? (
                    <MarketingEmptyState title="Akış boş" hint="Listeden hoş geldin şablonu ile otomasyon oluşturun." />
                ) : (
                    <div className="mkt-workflow mkt-workflow--editable">
                        {nodes.map((node, i) => (
                            <React.Fragment key={node.id}>
                                <div className={`mkt-workflow-node mkt-workflow-node--${node.type}`}>
                                    <strong>{NODE_LABELS[node.type] || node.type}</strong>
                                    {node.type === "delay" && (
                                        <MarketingField label="Dakika">
                                            <input
                                                type="number"
                                                min={0}
                                                value={node.config?.minutes ?? 0}
                                                onChange={(e) =>
                                                    updateNodeConfig(node.id, {
                                                        minutes: Number(e.target.value),
                                                        label: `${e.target.value} dakika bekle`,
                                                    })
                                                }
                                            />
                                        </MarketingField>
                                    )}
                                    {node.type === "action" && (
                                        <>
                                            <MarketingField label="Aksiyon">
                                                <select
                                                    value={node.config?.actionType || "send_email"}
                                                    onChange={(e) => updateNodeConfig(node.id, { actionType: e.target.value })}
                                                >
                                                    <option value="send_email">E-posta gönder</option>
                                                    <option value="send_sms">SMS gönder</option>
                                                </select>
                                            </MarketingField>
                                            {node.config?.actionType !== "send_sms" ? (
                                                <MarketingField label="Konu">
                                                    <input
                                                        value={node.config?.subject || ""}
                                                        onChange={(e) => updateNodeConfig(node.id, { subject: e.target.value })}
                                                    />
                                                </MarketingField>
                                            ) : null}
                                            <MarketingField label={node.config?.actionType === "send_sms" ? "SMS metni" : "İçerik"}>
                                                <textarea
                                                    rows={3}
                                                    value={node.config?.text || ""}
                                                    onChange={(e) => updateNodeConfig(node.id, { text: e.target.value })}
                                                    placeholder="Merhaba {{name}}"
                                                />
                                            </MarketingField>
                                        </>
                                    )}
                                    {node.type === "trigger" && (
                                        <p className="mkt-workflow-node__hint">{node.config?.label || auto.trigger?.type}</p>
                                    )}
                                </div>
                                {i < nodes.length - 1 && (
                                    <div className="mkt-workflow-connector" aria-hidden>
                                        <span />
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </MarketingSection>
        </MarketingPageShell>
    );
};

export default MarketingAutomationBuilderPage;
