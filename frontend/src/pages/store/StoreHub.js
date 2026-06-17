/**
 * Web Sitem — İkas benzeri mağaza yönetimi (kendi PayTR bilgileri)
 */
import React, { useState, useEffect, useCallback } from "react";
import { FaStore, FaGlobe, FaCreditCard, FaBox, FaClipboardList, FaRocket, FaExternalLinkAlt, FaSync } from "react-icons/fa";
import {
    fetchStore,
    createStore,
    updateStore,
    publishStore,
    unpublishStore,
    fetchStoreStats,
    fetchStorePayments,
    saveStorePayments,
    syncStoreProducts,
    fetchStoreProducts,
    patchStoreProduct,
    fetchStoreOrders,
    patchStoreOrder,
} from "../../services/storeApi";
import StoreDomainPanel from "./panels/StoreDomainPanel";
import StoreDesignPanel from "./panels/StoreDesignPanel";
import StoreOverviewPanel from "./panels/StoreOverviewPanel";
import "../../styles/storeHub.css";
import "../../styles/storeIkasPanels.css";

const TABS = [
    { id: "overview", label: "Özet", icon: <FaStore /> },
    { id: "design", label: "Tema", icon: <FaStore /> },
    { id: "payments", label: "PayTR", icon: <FaCreditCard /> },
    { id: "products", label: "Ürünler", icon: <FaBox /> },
    { id: "orders", label: "Siparişler", icon: <FaClipboardList /> },
    { id: "domain", label: "Domain", icon: <FaGlobe /> },
];

const StoreHub = ({ initialTab = "overview", embeddedNav = false, onAfterLoad }) => {
    const [tab, setTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [store, setStore] = useState(null);
    const [themes, setThemes] = useState([]);
    const [publicUrl, setPublicUrl] = useState("");
    const [payments, setPayments] = useState(null);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState(null);

    const [wizard, setWizard] = useState({ name: "", slug: "", themeId: "minimal" });
    const [payForm, setPayForm] = useState({
        merchantId: "",
        merchantKey: "",
        merchantSalt: "",
        enabled: false,
        testMode: true,
    });
    const [dnsRecords, setDnsRecords] = useState([]);
    const [dnsCnameTarget, setDnsCnameTarget] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await fetchStore();
            setStore(data.store);
            setThemes(data.themes || []);
            setPublicUrl(data.publicUrl || "");
            setPayments(data.payments);
            setDnsRecords(data.dnsRecords || []);
            setDnsCnameTarget(data.dnsCnameTarget || "");
            if (data.store) {
                const st = await fetchStoreStats();
                setStats(st);
                onAfterLoad?.(data.store);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, [onAfterLoad]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    const loadProducts = async () => {
        const data = await fetchStoreProducts();
        setProducts(data.products || []);
    };

    const loadOrders = async () => {
        const data = await fetchStoreOrders();
        setOrders(data.orders || []);
    };

    useEffect(() => {
        if (!store) return;
        if (tab === "products") loadProducts();
        if (tab === "orders") loadOrders();
        if (tab === "payments") {
            fetchStorePayments().then((d) => {
                setPayments(d.payments);
                const p = d.payments?.paytr;
                setPayForm((f) => ({
                    ...f,
                    merchantId: p?.merchantId || "",
                    enabled: !!p?.enabled,
                    testMode: p?.testMode !== false,
                }));
            });
        }
    }, [tab, store]);

    const handleCreate = async () => {
        try {
            await createStore(wizard);
            await load();
        } catch (e) {
            setError(e.response?.data?.error || "Oluşturulamadı");
        }
    };

    const handleSaveTheme = async (themeId) => {
        await updateStore({ themeId });
        await load();
    };

    const handleSavePayments = async () => {
        try {
            await saveStorePayments({
                paytr: {
                    merchantId: payForm.merchantId,
                    merchantKey: payForm.merchantKey || undefined,
                    merchantSalt: payForm.merchantSalt || undefined,
                    enabled: payForm.enabled,
                    testMode: payForm.testMode,
                },
            });
            setPayForm((f) => ({ ...f, merchantKey: "", merchantSalt: "" }));
            const d = await fetchStorePayments();
            setPayments(d.payments);
            alert("PayTR ayarları kaydedildi");
        } catch (e) {
            alert(e.response?.data?.error || "Kayıt başarısız");
        }
    };

    const handlePublish = async () => {
        try {
            const d = await publishStore();
            setPublicUrl(d.publicUrl);
            await load();
        } catch (e) {
            alert(e.response?.data?.error || "Yayınlanamadı");
        }
    };

    if (loading) {
        return <div className="store-hub"><p>Mağaza yükleniyor…</p></div>;
    }

    if (!store) {
        return (
            <div className="store-hub">
                <div className="store-hub-card">
                    <h3><FaRocket /> Web mağazanızı oluşturun</h3>
                    <p className="store-hub-hint">
                        Kendi domain ve PayTR bilgilerinizle müşterilerinizden ödeme alın. Ürünler Ürün Yönetim Merkezi ile
                        senkronize edilir.
                    </p>
                    {error && <p style={{ color: "#f87171" }}>{error}</p>}
                    <div className="store-hub-field">
                        <label>Mağaza adı</label>
                        <input value={wizard.name} onChange={(e) => setWizard({ ...wizard, name: e.target.value })} placeholder="Markam Mağaza" />
                    </div>
                    <div className="store-hub-field">
                        <label>Adres (slug)</label>
                        <input value={wizard.slug} onChange={(e) => setWizard({ ...wizard, slug: e.target.value })} placeholder="markam-magaza" />
                    </div>
                    <div className="store-hub-field">
                        <label>Tema</label>
                        <select value={wizard.themeId} onChange={(e) => setWizard({ ...wizard, themeId: e.target.value })}>
                            {(themes.length ? themes : [{ id: "minimal", name: "Minimal" }]).map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <button type="button" className="store-hub-btn primary" onClick={handleCreate}>
                        Mağazayı oluştur
                    </button>
                </div>
            </div>
        );
    }

    const ikasLayout = embeddedNav && ["overview", "design", "domain"].includes(tab);

    return (
        <div className={`store-hub${ikasLayout ? " store-hub--ikas" : ""}`}>
            {!ikasLayout && (
            <header style={{ marginBottom: 16 }}>
                <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    <FaStore /> {store.name}
                    <span className={`store-hub-badge ${store.status === "published" ? "live" : "draft"}`}>
                        {store.status === "published" ? "Yayında" : "Taslak"}
                    </span>
                </h2>
                <p className="store-hub-hint" style={{ marginTop: 8 }}>
                    Subdomain: <strong>{store.subdomain || `${store.slug}.sites.dashtock.com`}</strong>
                    {publicUrl && (
                        <>
                            {" · "}
                            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: "#4ecdc4" }}>
                                Mağazayı aç <FaExternalLinkAlt style={{ fontSize: 10 }} />
                            </a>
                        </>
                    )}
                </p>
            </header>
            )}

            {!embeddedNav && (
                <div className="store-hub-tabs">
                    {TABS.map((t) => (
                        <button key={t.id} type="button" className={`store-hub-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {tab === "overview" && (
                <StoreOverviewPanel
                    store={store}
                    stats={stats}
                    publicUrl={publicUrl}
                    onPublish={handlePublish}
                    onUnpublish={() => unpublishStore().then(load)}
                    onSyncProducts={() => syncStoreProducts().then(loadProducts)}
                />
            )}

            {tab === "design" && (
                <StoreDesignPanel store={store} themes={themes} onSelectTheme={handleSaveTheme} />
            )}

            {tab === "payments" && (
                <div className="store-hub-card">
                    <h3>Kendi PayTR mağazanız</h3>
                    <p className="store-hub-hint">
                        PayTR&apos;de ayrı mağaza açın; ödemeler doğrudan sizin hesabınıza gider. Dashtock abonelik PayTR&apos;inden bağımsızdır.
                    </p>
                    {payments?.paytr?.notifyUrl && (
                        <p className="store-hub-hint">
                            <strong>Bildirim URL (PayTR paneline yapıştırın):</strong>
                            <br />
                            <code style={{ wordBreak: "break-all" }}>{payments.paytr.notifyUrl}</code>
                        </p>
                    )}
                    <div className="store-hub-field">
                        <label>Mağaza No (merchant_id)</label>
                        <input value={payForm.merchantId} onChange={(e) => setPayForm({ ...payForm, merchantId: e.target.value })} />
                    </div>
                    <div className="store-hub-field">
                        <label>Mağaza Parola (merchant_key) {payments?.paytr?.merchantKeyMasked && `— kayıtlı: ${payments.paytr.merchantKeyMasked}`}</label>
                        <input type="password" placeholder="Değiştirmek için yazın" value={payForm.merchantKey} onChange={(e) => setPayForm({ ...payForm, merchantKey: e.target.value })} />
                    </div>
                    <div className="store-hub-field">
                        <label>Mağaza Gizli Anahtar (merchant_salt) {payments?.paytr?.merchantSaltMasked && `— kayıtlı: ${payments.paytr.merchantSaltMasked}`}</label>
                        <input type="password" placeholder="Değiştirmek için yazın" value={payForm.merchantSalt} onChange={(e) => setPayForm({ ...payForm, merchantSalt: e.target.value })} />
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <input type="checkbox" checked={payForm.enabled} onChange={(e) => setPayForm({ ...payForm, enabled: e.target.checked })} />
                        Ödeme aktif
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 8 }}>
                        <input type="checkbox" checked={payForm.testMode} onChange={(e) => setPayForm({ ...payForm, testMode: e.target.checked })} />
                        Test modu
                    </label>
                    <div className="store-hub-actions">
                        <button type="button" className="store-hub-btn primary" onClick={handleSavePayments}>
                            Kaydet
                        </button>
                    </div>
                </div>
            )}

            {tab === "products" && (
                <div className="store-hub-card">
                    <h3>Mağaza ürünleri</h3>
                    <button type="button" className="store-hub-btn secondary" onClick={() => syncStoreProducts().then(loadProducts)}>
                        <FaSync /> Ürün merkezinden çek
                    </button>
                    <div style={{ marginTop: 16 }}>
                        {products.map((p) => (
                            <div key={p._id} className="store-hub-product-row">
                                <span style={{ flex: 1 }}>{p.title}</span>
                                <span>{p.price} ₺</span>
                                <span>Stok: {p.stock}</span>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={p.visible}
                                        onChange={(e) => patchStoreProduct(p._id, { visible: e.target.checked }).then(loadProducts)}
                                    />{" "}
                                    Vitrin
                                </label>
                            </div>
                        ))}
                        {!products.length && <p className="store-hub-hint">Henüz ürün yok — senkronize edin.</p>}
                    </div>
                </div>
            )}

            {tab === "orders" && (
                <div className="store-hub-card">
                    <h3>Web siparişleri</h3>
                    {orders.map((o) => (
                        <div key={o._id} className="store-hub-product-row" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                            <div>
                                <strong>{o.orderNumber}</strong> — {o.total} ₺ — {o.status} — ödeme: {o.payment?.status}
                            </div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>
                                {o.customer?.name} · {o.customer?.email}
                            </div>
                        </div>
                    ))}
                    {!orders.length && <p className="store-hub-hint">Henüz sipariş yok.</p>}
                </div>
            )}

            {tab === "domain" && (
                <StoreDomainPanel
                    store={store}
                    publicUrl={publicUrl}
                    dnsRecords={dnsRecords}
                    dnsCnameTarget={dnsCnameTarget}
                    onReload={load}
                />
            )}
        </div>
    );
};

export default StoreHub;
