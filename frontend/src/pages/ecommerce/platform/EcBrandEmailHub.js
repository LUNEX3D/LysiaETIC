/**
 * EcBrandEmailHub — E-posta gönderimi, marka iletişim ve özel domain DNS doğrulama
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    FaEnvelope, FaStore, FaCheckCircle, FaInfoCircle, FaSave, FaSpinner,
    FaExclamationTriangle, FaSync, FaCopy,
} from "react-icons/fa";
import * as wbApi from "../../../services/websiteBuilderApi";
import "../../../styles/ecPublishHub.css";

export default function EcBrandEmailHub({ siteId }) {
    const [site, setSite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [emailDns, setEmailDns] = useState(null);
    const [dnsLoading, setDnsLoading] = useState(false);
    const [copied, setCopied] = useState("");
    const pollRef = useRef(null);
    const [form, setForm] = useState({
        senderMode: "platform",
        replyToEmail: "",
        supportEmail: "",
        customFromEmail: "",
        contactEmail: "",
        contactPhone: "",
    });

    const loadEmailDns = useCallback(async () => {
        if (!siteId) return;
        setDnsLoading(true);
        try {
            const d = await wbApi.getEmailDomainStatus(siteId);
            setEmailDns(d);
        } catch {
            setEmailDns(null);
        } finally {
            setDnsLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        if (!siteId) return;
        wbApi.getSite(siteId)
            .then((d) => {
                const s = d.site || {};
                setSite(s);
                setForm({
                    senderMode: s.emailSettings?.senderMode || "platform",
                    replyToEmail: s.emailSettings?.replyToEmail || s.contactEmail || "",
                    supportEmail: s.emailSettings?.supportEmail || "",
                    customFromEmail: s.emailSettings?.customFromEmail || "",
                    contactEmail: s.contactEmail || "",
                    contactPhone: s.contactPhone || "",
                });
            })
            .catch(() => setError("Mağaza bilgisi yüklenemedi"))
            .finally(() => setLoading(false));
    }, [siteId]);

    useEffect(() => {
        if (form.senderMode !== "custom" || !form.customFromEmail?.includes("@")) {
            setEmailDns(null);
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }
        loadEmailDns();
        pollRef.current = setInterval(loadEmailDns, 30000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [form.senderMode, form.customFromEmail, loadEmailDns]);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            await wbApi.updateSite(siteId, {
                contactEmail: form.contactEmail,
                contactPhone: form.contactPhone,
                emailSettings: {
                    senderMode: form.senderMode,
                    replyToEmail: form.replyToEmail,
                    supportEmail: form.supportEmail,
                    customFromEmail: form.customFromEmail,
                },
            });
            setSuccess("Ayarlar kaydedildi");
            if (form.senderMode === "custom") await loadEmailDns();
            setTimeout(() => setSuccess(""), 3000);
        } catch (e) {
            setError(e?.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyDns = async () => {
        setDnsLoading(true);
        try {
            const r = await wbApi.verifyEmailDomain(siteId);
            setEmailDns(r);
            if (r.verified) setSuccess("E-posta domain doğrulandı");
        } catch (e) {
            setError(e?.response?.data?.error || "Doğrulama başarısız");
        } finally {
            setDnsLoading(false);
        }
    };

    const copyValue = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(""), 2000);
    };

    if (loading) {
        return (
            <div className="eph-page eph-page--light">
                <div className="eph-loading"><FaSpinner className="eph-spin" /><p>Yükleniyor…</p></div>
            </div>
        );
    }

    const showDnsPanel = form.senderMode === "custom" && form.customFromEmail?.includes("@");

    return (
        <div className="eph-page eph-page--light">
            <header className="eph-header">
                <div className="eph-header-icon"><FaEnvelope /></div>
                <div>
                    <h1>E-posta & Marka</h1>
                    <p>Sipariş ve müşteri e-postaları — teknik bilgi gerektirmeden</p>
                </div>
            </header>

            {error && <div className="eph-banner eph-banner--error"><span>{error}</span></div>}
            {success && <div className="eph-banner eph-banner--success"><FaCheckCircle /><span>{success}</span></div>}

            <section className="eph-panel">
                <h3><FaStore /> Gönderen adresi</h3>
                <div className="eph-radio-group">
                    <label className={`eph-radio ${form.senderMode === "platform" ? "is-active" : ""}`}>
                        <input
                            type="radio"
                            name="senderMode"
                            checked={form.senderMode === "platform"}
                            onChange={() => setForm({ ...form, senderMode: "platform" })}
                        />
                        <div>
                            <strong>Hızlı başlangıç (önerilen)</strong>
                            <p>
                                Gönderen: <code>Magazam &lt;noreply@notify.dashtock.com&gt;</code>
                                <br />
                                Yanıtlar sizin belirlediğiniz adrese gider.
                            </p>
                        </div>
                    </label>
                    <label className={`eph-radio ${form.senderMode === "custom" ? "is-active" : ""}`}>
                        <input
                            type="radio"
                            name="senderMode"
                            checked={form.senderMode === "custom"}
                            onChange={() => setForm({ ...form, senderMode: "custom" })}
                        />
                        <div>
                            <strong>Özel domain e-postası</strong>
                            <p>info@magazam.com gibi — SPF, DKIM ve DMARC DNS kayıtları gerekir.</p>
                        </div>
                    </label>
                </div>
            </section>

            <section className="eph-form-grid">
                <label>
                    Yanıt adresi (Reply-To)
                    <input
                        type="email"
                        placeholder="destek@magazam.com"
                        value={form.replyToEmail}
                        onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })}
                    />
                    <small>Müşteri “Yanıtla” dediğinde bu adrese gelir</small>
                </label>
                <label>
                    Destek e-postası
                    <input
                        type="email"
                        placeholder="destek@magazam.com"
                        value={form.supportEmail}
                        onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                    />
                </label>
                <label>
                    İletişim e-postası (sitede görünür)
                    <input
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    />
                </label>
                <label>
                    Telefon
                    <input
                        type="tel"
                        value={form.contactPhone}
                        onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    />
                </label>
                {form.senderMode === "custom" && (
                    <label className="eph-form-full">
                        Özel gönderen
                        <input
                            type="email"
                            placeholder="info@magazam.com"
                            value={form.customFromEmail}
                            onChange={(e) => setForm({ ...form, customFromEmail: e.target.value })}
                        />
                    </label>
                )}
            </section>

            {showDnsPanel && (
                <section className="eph-panel">
                    <div className="eph-seo-toolbar">
                        <h3 style={{ margin: 0 }}>E-posta DNS kayıtları</h3>
                        <button type="button" className="eph-btn-ghost eph-btn-sm" onClick={handleVerifyDns} disabled={dnsLoading}>
                            {dnsLoading ? <FaSpinner className="eph-spin" /> : <FaSync />}
                            Şimdi kontrol et
                        </button>
                    </div>
                    {emailDns?.status === "verified" ? (
                        <div className="eph-banner eph-banner--success" style={{ marginTop: "0.75rem" }}>
                            <FaCheckCircle />
                            <span>{emailDns.message || "Domain doğrulandı — özel adresten gönderim aktif"}</span>
                        </div>
                    ) : (
                        <div className="eph-banner eph-banner--error" style={{ marginTop: "0.75rem", borderColor: "rgba(251, 191, 36, 0.35)", background: "rgba(251, 191, 36, 0.08)", color: "var(--eph-warn)" }}>
                            <FaExclamationTriangle />
                            <span>{emailDns?.message || "DNS kayıtlarını ekleyin; sistem otomatik kontrol eder (30 sn)"}</span>
                        </div>
                    )}
                    {emailDns?.records?.length > 0 && (
                        <div className="eph-table-wrap" style={{ marginTop: "0.75rem" }}>
                            <table className="eph-table">
                                <thead>
                                    <tr>
                                        <th>Tip</th>
                                        <th>Ad</th>
                                        <th>Değer</th>
                                        <th>Durum</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {emailDns.records.map((rec, i) => (
                                        <tr key={`${rec.type}-${rec.name}-${i}`}>
                                            <td>{rec.type}</td>
                                            <td><code>{rec.name}</code></td>
                                            <td className="eph-dns-value"><code>{rec.value}</code></td>
                                            <td>
                                                {rec.verified ? (
                                                    <span className="eph-badge eph-badge--ok"><FaCheckCircle /> OK</span>
                                                ) : (
                                                    <span className="eph-badge eph-badge--warn">Bekliyor</span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="eph-btn-ghost eph-btn-sm"
                                                    onClick={() => copyValue(rec.value, `rec-${i}`)}
                                                >
                                                    {copied === `rec-${i}` ? "Kopyalandı" : <FaCopy />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            <aside className="eph-info">
                <FaInfoCircle />
                <p>
                    E-posta gönderimi platform üzerinden yapılır. Özel domain modunda SPF/DKIM/DMARC
                    kayıtlarını DNS panelinize ekleyin; doğrulama otomatik yapılır.
                </p>
            </aside>

            <div className="eph-form-actions">
                <button type="button" className="eph-btn-publish" onClick={handleSave} disabled={saving}>
                    {saving ? <FaSpinner className="eph-spin" /> : <FaSave />}
                    Kaydet
                </button>
            </div>
        </div>
    );
}
