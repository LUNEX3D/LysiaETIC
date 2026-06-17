/**
 * Domain & SSL — ikas benzeri alan adı bağlama ekranı
 */
import React, { useState, useEffect } from "react";
import {
    FaGlobe, FaCopy, FaExternalLinkAlt, FaCheckCircle, FaClock, FaExclamationTriangle,
    FaShieldAlt, FaLink, FaTrash, FaSync,
} from "react-icons/fa";
import { verifyStoreDomain, disconnectStoreDomain, updateStore } from "../../../services/storeApi";

const STATUS_META = {
    none: { label: "Bağlı değil", className: "neutral", icon: FaGlobe },
    pending: { label: "Doğrulama bekleniyor", className: "pending", icon: FaClock },
    verified: { label: "Doğrulandı", className: "verified", icon: FaCheckCircle },
    failed: { label: "Başarısız", className: "failed", icon: FaExclamationTriangle },
};

function CopyBtn({ text, label = "Kopyala" }) {
    const [ok, setOk] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setOk(true);
            setTimeout(() => setOk(false), 2000);
        } catch {
            // ignore
        }
    };
    return (
        <button type="button" className="store-ikas-btn store-ikas-btn--ghost store-ikas-btn--sm" onClick={copy} title={label}>
            <FaCopy /> {ok ? "Kopyalandı" : label}
        </button>
    );
}

const StoreDomainPanel = ({ store, publicUrl, dnsRecords = [], dnsCnameTarget, onReload }) => {
    const [domainInput, setDomainInput] = useState(store?.customDomain || "");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    useEffect(() => {
        setDomainInput(store?.customDomain || "");
    }, [store?.customDomain]);

    const subdomain = store?.subdomain || `${store?.slug}.sites.dashtock.com`;
    const status = store?.domainStatus || "none";
    const statusMeta = STATUS_META[status] || STATUS_META.none;
    const StatusIcon = statusMeta.icon;
    const hasCustom = !!store?.customDomain;
    const sslActive = status === "verified" || (!hasCustom && store?.status === "published");

    const showDnsSteps = hasCustom && status !== "verified";

    const handleConnect = async () => {
        const dom = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
        if (!dom) {
            setMsg({ type: "error", text: "Geçerli bir alan adı girin (ör. www.markam.com)" });
            return;
        }
        setBusy(true);
        setMsg({ type: "", text: "" });
        try {
            await updateStore({ customDomain: dom });
            setMsg({ type: "success", text: "Alan adı kaydedildi. DNS kayıtlarını ekleyip doğrulayın." });
            onReload?.();
        } catch (e) {
            setMsg({ type: "error", text: e.response?.data?.error || e.message });
        } finally {
            setBusy(false);
        }
    };

    const handleVerify = async () => {
        setBusy(true);
        setMsg({ type: "", text: "" });
        try {
            const data = await verifyStoreDomain();
            if (data.verified) {
                setMsg({ type: "success", text: "Alan adı doğrulandı. SSL birkaç dakika içinde aktif olur." });
            }
            onReload?.();
        } catch (e) {
            setMsg({ type: "error", text: e.response?.data?.error || e.message });
        } finally {
            setBusy(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm("Özel alan adı bağlantısı kaldırılsın mı?")) return;
        setBusy(true);
        try {
            await disconnectStoreDomain();
            setDomainInput("");
            setMsg({ type: "success", text: "Özel alan adı kaldırıldı." });
            onReload?.();
        } catch (e) {
            setMsg({ type: "error", text: e.response?.data?.error || e.message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="store-ikas-page">
            <header className="store-ikas-page-header">
                <div>
                    <h1 className="store-ikas-title">Alan Adı & SSL</h1>
                    <p className="store-ikas-subtitle">
                        Mağazanızı Dashtock adresinde veya kendi domaininizde yayınlayın.
                    </p>
                </div>
            </header>

            {msg.text && (
                <div className={`store-ikas-alert store-ikas-alert--${msg.type === "error" ? "error" : "success"}`}>
                    {msg.text}
                </div>
            )}

            {/* Varsayılan adres */}
            <section className="store-ikas-card">
                <div className="store-ikas-card-head">
                    <div className="store-ikas-card-icon store-ikas-card-icon--teal">
                        <FaLink />
                    </div>
                    <div>
                        <h2>Varsayılan mağaza adresi</h2>
                        <p>Her mağazaya otomatik tanımlanan Dashtock adresi</p>
                    </div>
                    <span className={`store-ikas-pill store-ikas-pill--${store?.status === "published" ? "success" : "neutral"}`}>
                        {store?.status === "published" ? "Yayında" : "Taslak"}
                    </span>
                </div>

                <div className="store-ikas-url-box">
                    <div className="store-ikas-url-box__main">
                        <span className="store-ikas-url-box__label">Adres</span>
                        <a href={publicUrl || `https://${subdomain}`} target="_blank" rel="noreferrer" className="store-ikas-url-box__url">
                            {publicUrl || `https://${subdomain}`}
                        </a>
                    </div>
                    <div className="store-ikas-url-box__actions">
                        <CopyBtn text={publicUrl || `https://${subdomain}`} />
                        <a
                            href={publicUrl || `https://${subdomain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="store-ikas-btn store-ikas-btn--ghost store-ikas-btn--sm"
                        >
                            <FaExternalLinkAlt /> Ziyaret et
                        </a>
                    </div>
                </div>

                <div className="store-ikas-meta-row">
                    <div className="store-ikas-meta-item">
                        <FaGlobe />
                        <span>Subdomain</span>
                        <strong>{subdomain}</strong>
                    </div>
                    <div className="store-ikas-meta-item">
                        <FaShieldAlt />
                        <span>SSL</span>
                        <strong className={sslActive ? "text-success" : ""}>{sslActive ? "Aktif" : "Yayın sonrası"}</strong>
                    </div>
                </div>
            </section>

            {/* Özel domain */}
            <section className="store-ikas-card">
                <div className="store-ikas-card-head">
                    <div className="store-ikas-card-icon store-ikas-card-icon--purple">
                        <FaGlobe />
                    </div>
                    <div>
                        <h2>Özel alan adı</h2>
                        <p>www.siteniz.com gibi kendi domaininizi bağlayın</p>
                    </div>
                    {hasCustom && (
                        <span className={`store-ikas-pill store-ikas-pill--${statusMeta.className}`}>
                            <StatusIcon /> {statusMeta.label}
                        </span>
                    )}
                </div>

                {!hasCustom ? (
                    <>
                        <div className="store-ikas-field">
                            <label htmlFor="custom-domain">Alan adınız</label>
                            <div className="store-ikas-input-group">
                                <span className="store-ikas-input-prefix">https://</span>
                                <input
                                    id="custom-domain"
                                    type="text"
                                    placeholder="www.markam.com"
                                    value={domainInput}
                                    onChange={(e) => setDomainInput(e.target.value)}
                                />
                            </div>
                            <p className="store-ikas-field-hint">
                                Domain sağlayıcınızda (GoDaddy, Natro, Cloudflare vb.) DNS ayarlarına erişiminiz olmalıdır.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="store-ikas-btn store-ikas-btn--primary"
                            disabled={busy}
                            onClick={handleConnect}
                        >
                            Alan adını bağla
                        </button>
                    </>
                ) : (
                    <>
                        <div className="store-ikas-connected-domain">
                            <div>
                                <span className="store-ikas-connected-domain__label">Bağlı domain</span>
                                <strong>https://{store.customDomain}</strong>
                            </div>
                            <div className="store-ikas-connected-domain__actions">
                                <CopyBtn text={`https://${store.customDomain}`} />
                                {status === "verified" && (
                                    <a
                                        href={`https://${store.customDomain}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="store-ikas-btn store-ikas-btn--ghost store-ikas-btn--sm"
                                    >
                                        <FaExternalLinkAlt /> Aç
                                    </a>
                                )}
                                <button
                                    type="button"
                                    className="store-ikas-btn store-ikas-btn--danger store-ikas-btn--sm"
                                    disabled={busy}
                                    onClick={handleDisconnect}
                                >
                                    <FaTrash /> Kaldır
                                </button>
                            </div>
                        </div>

                        {showDnsSteps && (
                            <>
                                <ol className="store-ikas-steps">
                                    <li className="store-ikas-steps__item store-ikas-steps__item--done">
                                        <span className="store-ikas-steps__num">1</span>
                                        <div>
                                            <strong>Alan adı eklendi</strong>
                                            <p>{store.customDomain} panelde kayıtlı</p>
                                        </div>
                                    </li>
                                    <li className={`store-ikas-steps__item ${dnsRecords?.length ? "store-ikas-steps__item--active" : ""}`}>
                                        <span className="store-ikas-steps__num">2</span>
                                        <div>
                                            <strong>DNS kayıtlarını ekleyin</strong>
                                            <p>Domain panelinizde aşağıdaki kayıtları oluşturun</p>
                                        </div>
                                    </li>
                                    <li className="store-ikas-steps__item">
                                        <span className="store-ikas-steps__num">3</span>
                                        <div>
                                            <strong>Doğrula</strong>
                                            <p>Yayılım sonrası &quot;DNS Doğrula&quot; ile kontrol edin (24–48 saat sürebilir)</p>
                                        </div>
                                    </li>
                                </ol>

                                <div className="store-ikas-dns-block">
                                    <div className="store-ikas-dns-block__head">
                                        <h3>DNS kayıtları</h3>
                                        <span className="store-ikas-field-hint">Hedef: {dnsCnameTarget || "sites.dashtock.com"}</span>
                                    </div>
                                    <div className="store-ikas-dns-table-wrap">
                                        <table className="store-ikas-dns-table">
                                            <thead>
                                                <tr>
                                                    <th>Tür</th>
                                                    <th>Ad / Host</th>
                                                    <th>Değer</th>
                                                    <th>TTL</th>
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(dnsRecords || []).map((row) => (
                                                    <tr key={row.id}>
                                                        <td><span className="store-ikas-dns-type">{row.type}</span></td>
                                                        <td>
                                                            <code>{row.name}</code>
                                                            <div className="store-ikas-dns-host">{row.host}</div>
                                                        </td>
                                                        <td>
                                                            <code className="store-ikas-dns-value">{row.value}</code>
                                                            {row.description && (
                                                                <div className="store-ikas-field-hint">{row.description}</div>
                                                            )}
                                                        </td>
                                                        <td>{row.ttl}</td>
                                                        <td>
                                                            <CopyBtn text={row.value} label="Kopyala" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="store-ikas-actions-row">
                                    <button
                                        type="button"
                                        className="store-ikas-btn store-ikas-btn--primary"
                                        disabled={busy}
                                        onClick={handleVerify}
                                    >
                                        <FaSync className={busy ? "store-ikas-spin" : ""} /> DNS doğrula
                                    </button>
                                </div>
                            </>
                        )}

                        {status === "verified" && (
                            <div className="store-ikas-ssl-banner">
                                <FaShieldAlt />
                                <div>
                                    <strong>SSL sertifikası aktif</strong>
                                    <p>Özel alan adınız HTTPS ile güvenli şekilde yayınlanıyor.</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            <section className="store-ikas-card store-ikas-card--muted">
                <h3 className="store-ikas-card-title-sm">Sık sorulanlar</h3>
                <ul className="store-ikas-faq">
                    <li>
                        <strong>www ve kök domain (@)</strong>
                        <p>Müşterileriniz için <code>www</code> CNAME kaydını kullanın. Kök domain yönlendirmesi domain sağlayıcınızdan www&apos;ye yönlendirme ile yapılır.</p>
                    </li>
                    <li>
                        <strong>DNS ne zaman güncellenir?</strong>
                        <p>Değişiklikler genelde birkaç saat içinde, bazen 48 saate kadar yayılabilir.</p>
                    </li>
                </ul>
            </section>
        </div>
    );
};

export default StoreDomainPanel;
