import React, { useCallback, useEffect, useState } from "react";
import {
    fetchStore,
    fetchStorePayments,
    saveStorePayments,
} from "../../../services/storeApi";
import { sbV5SegmentToPanel } from "../../../constants/storeBuilderV5";
import "../../../styles/ecommercePlatform.css";

const TABS = [
    { id: "general", label: "Genel" },
    { id: "payments", label: "Ödeme" },
    { id: "shipping", label: "Kargo" },
    { id: "legal", label: "Yasal" },
];

export default function EcommerceStoreSettingsHub({ onNavigate, initialTab = "general" }) {
    const [tab, setTab] = useState(initialTab);
    const [store, setStore] = useState(null);
    const [payments, setPayments] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [s, p] = await Promise.all([
                fetchStore(),
                fetchStorePayments().catch(() => ({ payments: null })),
            ]);
            setStore(s.store || s);
            setPayments(p.payments || p);
        } catch {
            setMessage("Mağaza ayarları yüklenemedi.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleSavePayments = async () => {
        if (!payments) return;
        setSaving(true);
        setMessage("");
        try {
            await saveStorePayments(payments);
            setMessage("Ödeme ayarları kaydedildi.");
        } catch (e) {
            setMessage(e.response?.data?.error || "Kaydedilemedi.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="ec-platform-settings ec-platform-settings--loading">Yükleniyor…</div>;
    }

    return (
        <div className="ec-platform-settings">
            <header className="ec-platform-settings__hero">
                <h1>Mağaza ayarları</h1>
                <p>Ödeme, kargo ve vitrin ayarları — İkas / Shopify mağaza yapılandırması.</p>
            </header>
            {message && <p className="ec-platform-settings__msg">{message}</p>}
            <div className="ec-platform-settings__tabs">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={tab === t.id ? "active" : ""}
                        onClick={() => setTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="ec-platform-settings__card">
                {tab === "general" && (
                    <>
                        <h3>Mağaza bilgisi</h3>
                        <dl className="ec-platform-settings__dl">
                            <dt>Ad</dt>
                            <dd>{store?.name || "—"}</dd>
                            <dt>Durum</dt>
                            <dd>{store?.status === "published" ? "Yayında" : "Taslak"}</dd>
                            <dt>Slug</dt>
                            <dd>{store?.slug || "—"}</dd>
                        </dl>
                        <button type="button" className="ec-platform-topbar__btn" onClick={() => onNavigate?.(sbV5SegmentToPanel("domain"))}>
                            Alan adı ve domain
                        </button>
                    </>
                )}
                {tab === "payments" && payments && (
                    <>
                        <h3>PayTR / ödeme</h3>
                        <label className="ec-platform-settings__field">
                            <span>Test modu</span>
                            <input
                                type="checkbox"
                                checked={!!payments.testMode}
                                onChange={(e) => setPayments((p) => ({ ...p, testMode: e.target.checked }))}
                            />
                        </label>
                        <label className="ec-platform-settings__field">
                            <span>Merchant ID</span>
                            <input
                                type="text"
                                value={payments.merchantId || ""}
                                onChange={(e) => setPayments((p) => ({ ...p, merchantId: e.target.value }))}
                            />
                        </label>
                        <button type="button" className="ec-platform-topbar__btn ec-platform-topbar__btn--primary" onClick={handleSavePayments} disabled={saving}>
                            {saving ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                    </>
                )}
                {tab === "shipping" && (
                    <p className="ec-platform-settings__hint">
                        Kargo bölgeleri ve ücretsiz kargo eşiği bir sonraki sürümde. Şimdilik sipariş ekranından manuel kargo girebilirsiniz.
                    </p>
                )}
                {tab === "legal" && (
                    <p className="ec-platform-settings__hint">
                        Mesafeli satış ve KVKK metinleri için Çevrimiçi Mağaza → SEO veya sayfa editöründen statik sayfa ekleyin.
                    </p>
                )}
            </div>
        </div>
    );
}
