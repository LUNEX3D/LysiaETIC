import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaPlus, FaSearch, FaTag, FaPercent, FaToggleOn, FaToggleOff,
    FaTrash, FaEdit, FaCopy, FaHistory, FaChartPie
} from "react-icons/fa";
import AdminLayout from "../components/AdminLayout";
import {
    getCouponStats,
    listCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCoupon,
    listRedemptions
} from "../services/adminCouponApi";

const EMPTY_FORM = {
    code: "",
    name: "",
    description: "",
    campaignTag: "",
    type: "percent",
    value: 10,
    maxDiscountAmount: "",
    minPurchaseAmount: 0,
    applicablePlans: [],
    applicableBillingCycles: [],
    usageLimit: "",
    perUserLimit: 1,
    validFrom: "",
    validUntil: "",
    isActive: true
};

const PLAN_OPTS = [
    { id: "basic", label: "Basic" },
    { id: "pro", label: "Pro" },
    { id: "enterprise", label: "Enterprise" }
];

const fmtDate = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");
const fmtMoney = (n) => `₺${Number(n || 0).toLocaleString("tr-TR")}`;

const AdminCouponsCampaigns = () => {
    const [tab, setTab] = useState("coupons");
    const [stats, setStats] = useState(null);
    const [coupons, setCoupons] = useState([]);
    const [redemptions, setRedemptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [campaignFilter, setCampaignFilter] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = {};
            if (search.trim()) params.q = search.trim();
            if (campaignFilter) params.campaign = campaignFilter;
            if (activeFilter !== "all") params.active = activeFilter;

            const [statsRes, couponsRes, redRes] = await Promise.all([
                getCouponStats(),
                listCoupons(params),
                listRedemptions({ limit: 30 })
            ]);
            setStats(statsRes.data?.stats || null);
            setCoupons(couponsRes.data?.coupons || []);
            setRedemptions(redRes.data?.redemptions || []);
        } catch (err) {
            setError(err.response?.data?.message || "Veriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [search, campaignFilter, activeFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const campaigns = useMemo(() => {
        const tags = new Set((coupons || []).map((c) => c.campaignTag).filter(Boolean));
        if (stats?.topCoupons) {
            stats.topCoupons.forEach((c) => c.campaignTag && tags.add(c.campaignTag));
        }
        return [...tags];
    }, [coupons, stats]);

    const openCreate = () => {
        setEditing(null);
        setForm({
            ...EMPTY_FORM,
            code: `PY${Date.now().toString().slice(-6)}`
        });
        setModalOpen(true);
    };

    const openEdit = (c) => {
        setEditing(c);
        setForm({
            code: c.code,
            name: c.name,
            description: c.description || "",
            campaignTag: c.campaignTag || "",
            type: c.type,
            value: c.value,
            maxDiscountAmount: c.maxDiscountAmount ?? "",
            minPurchaseAmount: c.minPurchaseAmount || 0,
            applicablePlans: c.applicablePlans || [],
            applicableBillingCycles: c.applicableBillingCycles || [],
            usageLimit: c.usageLimit ?? "",
            perUserLimit: c.perUserLimit ?? 1,
            validFrom: c.validFrom ? new Date(c.validFrom).toISOString().slice(0, 16) : "",
            validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 16) : "",
            isActive: c.isActive !== false
        });
        setModalOpen(true);
    };

    const togglePlan = (planId) => {
        setForm((prev) => {
            const has = prev.applicablePlans.includes(planId);
            return {
                ...prev,
                applicablePlans: has
                    ? prev.applicablePlans.filter((p) => p !== planId)
                    : [...prev.applicablePlans, planId]
            };
        });
    };

    const toggleCycle = (cycle) => {
        setForm((prev) => {
            const has = prev.applicableBillingCycles.includes(cycle);
            return {
                ...prev,
                applicableBillingCycles: has
                    ? prev.applicableBillingCycles.filter((c) => c !== cycle)
                    : [...prev.applicableBillingCycles, cycle]
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...form,
                code: form.code.trim().toUpperCase(),
                value: Number(form.value),
                maxDiscountAmount: form.maxDiscountAmount === "" ? null : Number(form.maxDiscountAmount),
                minPurchaseAmount: Number(form.minPurchaseAmount) || 0,
                usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
                perUserLimit: Number(form.perUserLimit) || 1,
                validFrom: form.validFrom || null,
                validUntil: form.validUntil || null
            };
            if (editing) {
                await updateCoupon(editing._id, payload);
            } else {
                await createCoupon(payload);
            }
            setModalOpen(false);
            load();
        } catch (err) {
            alert(err.response?.data?.message || "Kayıt başarısız");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (c) => {
        if (!window.confirm(`"${c.code}" kuponunu silmek istediğinize emin misiniz?`)) return;
        try {
            await deleteCoupon(c._id);
            load();
        } catch (err) {
            alert(err.response?.data?.message || "Silinemedi");
        }
    };

    const handleToggle = async (c) => {
        try {
            await toggleCoupon(c._id);
            load();
        } catch (err) {
            alert(err.response?.data?.message || "Durum güncellenemedi");
        }
    };

    return (
        <AdminLayout
            title="Kupon & Kampanyalar"
            subtitle="İndirim kodları oluşturun, kampanyaları yönetin ve kullanımı izleyin"
            actions={
                <button type="button" className="ap-btn ap-btn--primary" onClick={openCreate}>
                    <FaPlus /> Yeni Kupon
                </button>
            }
        >
            {error && <div className="ap-alert ap-alert--error">{error}</div>}

            {stats && (
                <div className="ap-kpi-grid" style={{ marginBottom: "1rem" }}>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--purple"><FaTag /></div>
                        <div className="ap-kpi-label">Toplam Kupon</div>
                        <div className="ap-kpi-value">{stats.total}</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--green"><FaToggleOn /></div>
                        <div className="ap-kpi-label">Aktif</div>
                        <div className="ap-kpi-value">{stats.active}</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--blue"><FaHistory /></div>
                        <div className="ap-kpi-label">Kullanım</div>
                        <div className="ap-kpi-value">{stats.redemptions}</div>
                    </div>
                    <div className="ap-kpi">
                        <div className="ap-kpi-icon ap-kpi-icon--yellow"><FaChartPie /></div>
                        <div className="ap-kpi-label">Toplam İndirim</div>
                        <div className="ap-kpi-value">{fmtMoney(stats.totalDiscountGiven)}</div>
                    </div>
                </div>
            )}

            <div className="ap-card" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {[
                        { id: "coupons", label: "Kuponlar" },
                        { id: "redemptions", label: "Kullanım Geçmişi" }
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className={`ap-btn ${tab === t.id ? "ap-btn--primary" : ""}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "coupons" && (
                <>
                    <div className="ap-card">
                        <div className="ap-toolbar">
                            <div className="ap-search">
                                <FaSearch />
                                <input
                                    type="text"
                                    placeholder="Kod, ad, kampanya ara..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <select
                                className="ap-select"
                                value={campaignFilter}
                                onChange={(e) => setCampaignFilter(e.target.value)}
                            >
                                <option value="">Tüm kampanyalar</option>
                                {campaigns.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <select
                                className="ap-select"
                                value={activeFilter}
                                onChange={(e) => setActiveFilter(e.target.value)}
                            >
                                <option value="all">Tüm durumlar</option>
                                <option value="true">Aktif</option>
                                <option value="false">Pasif</option>
                            </select>
                            <span className="ap-toolbar-count">{coupons.length} kupon</span>
                        </div>
                    </div>

                    <div className="ap-card">
                        {loading ? (
                            <p style={{ padding: "1rem" }}>Yükleniyor…</p>
                        ) : (
                            <div className="ap-table-wrap">
                                <table className="ap-table">
                                    <thead>
                                        <tr>
                                            <th>Kod</th>
                                            <th>Kampanya</th>
                                            <th>İndirim</th>
                                            <th>Paketler</th>
                                            <th>Kullanım</th>
                                            <th>Geçerlilik</th>
                                            <th>Durum</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {coupons.map((c) => (
                                            <tr key={c._id}>
                                                <td>
                                                    <strong>{c.code}</strong>
                                                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{c.name}</div>
                                                </td>
                                                <td>{c.campaignTag || "—"}</td>
                                                <td>
                                                    {c.type === "percent" ? (
                                                        <><FaPercent style={{ fontSize: "0.7rem" }} /> %{c.value}</>
                                                    ) : (
                                                        <>{fmtMoney(c.value)}</>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: "0.75rem" }}>
                                                    {(c.applicablePlans?.length
                                                        ? c.applicablePlans.join(", ")
                                                        : "Tümü")}
                                                    <br />
                                                    {(c.applicableBillingCycles?.length
                                                        ? c.applicableBillingCycles.join("/")
                                                        : "Aylık+Yıllık")}
                                                </td>
                                                <td>
                                                    {c.usageCount}
                                                    {c.usageLimit != null ? ` / ${c.usageLimit}` : " / ∞"}
                                                </td>
                                                <td style={{ fontSize: "0.72rem" }}>
                                                    {fmtDate(c.validFrom)}
                                                    <br />
                                                    {fmtDate(c.validUntil)}
                                                </td>
                                                <td>
                                                    <span className={`ap-badge ap-badge--${c.isActive ? "green" : "gray"}`}>
                                                        {c.isActive ? "Aktif" : "Pasif"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: "0.25rem" }}>
                                                        <button type="button" className="ap-btn ap-btn--sm" title="Kopyala" onClick={() => navigator.clipboard.writeText(c.code)}>
                                                            <FaCopy />
                                                        </button>
                                                        <button type="button" className="ap-btn ap-btn--sm" onClick={() => openEdit(c)}>
                                                            <FaEdit />
                                                        </button>
                                                        <button type="button" className="ap-btn ap-btn--sm" onClick={() => handleToggle(c)}>
                                                            {c.isActive ? <FaToggleOn /> : <FaToggleOff />}
                                                        </button>
                                                        <button type="button" className="ap-btn ap-btn--sm ap-btn--danger" onClick={() => handleDelete(c)}>
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {coupons.length === 0 && (
                                    <p style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}>
                                        Henüz kupon yok. Yeni Kupon ile başlayın.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {tab === "redemptions" && (
                <div className="ap-card">
                    {loading ? (
                        <p style={{ padding: "1rem" }}>Yükleniyor…</p>
                    ) : (
                        <div className="ap-table-wrap">
                            <table className="ap-table">
                                <thead>
                                    <tr>
                                        <th>Tarih</th>
                                        <th>Kupon</th>
                                        <th>Kullanıcı</th>
                                        <th>Paket</th>
                                        <th>İndirim</th>
                                        <th>Ödenen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {redemptions.map((r) => (
                                        <tr key={r._id}>
                                            <td>{fmtDate(r.redeemedAt)}</td>
                                            <td><strong>{r.code}</strong></td>
                                            <td>
                                                {r.user?.name || "—"}
                                                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{r.user?.email}</div>
                                            </td>
                                            <td>{r.plan} / {r.billingCycle}</td>
                                            <td>{fmtMoney(r.discountAmount)}</td>
                                            <td>{fmtMoney(r.finalAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {redemptions.length === 0 && (
                                <p style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}>
                                    Henüz kupon kullanımı yok.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {modalOpen && (
                <div className="ap-modal-overlay" onClick={() => !saving && setModalOpen(false)}>
                    <div className="ap-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <h3 style={{ marginTop: 0 }}>{editing ? "Kuponu Düzenle" : "Yeni Kupon Oluştur"}</h3>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                            <label>
                                Kupon kodu *
                                <input
                                    className="ap-input"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    disabled={!!editing}
                                />
                            </label>
                            <label>
                                Kampanya etiketi
                                <input
                                    className="ap-input"
                                    placeholder="ör. Yaz2026"
                                    value={form.campaignTag}
                                    onChange={(e) => setForm({ ...form, campaignTag: e.target.value })}
                                />
                            </label>
                            <label style={{ gridColumn: "1 / -1" }}>
                                Görünen ad *
                                <input
                                    className="ap-input"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </label>
                            <label style={{ gridColumn: "1 / -1" }}>
                                Açıklama
                                <textarea
                                    className="ap-input"
                                    rows={2}
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </label>
                            <label>
                                İndirim tipi
                                <select className="ap-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                                    <option value="percent">Yüzde (%)</option>
                                    <option value="fixed">Sabit tutar (₺)</option>
                                </select>
                            </label>
                            <label>
                                Değer *
                                <input
                                    type="number"
                                    className="ap-input"
                                    min={0}
                                    max={form.type === "percent" ? 100 : undefined}
                                    value={form.value}
                                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                                />
                            </label>
                            {form.type === "percent" && (
                                <label>
                                    Maks. indirim (₺)
                                    <input
                                        type="number"
                                        className="ap-input"
                                        placeholder="Boş = limitsiz"
                                        value={form.maxDiscountAmount}
                                        onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                                    />
                                </label>
                            )}
                            <label>
                                Min. sepet (₺)
                                <input
                                    type="number"
                                    className="ap-input"
                                    value={form.minPurchaseAmount}
                                    onChange={(e) => setForm({ ...form, minPurchaseAmount: e.target.value })}
                                />
                            </label>
                            <label>
                                Toplam kullanım limiti
                                <input
                                    type="number"
                                    className="ap-input"
                                    placeholder="Boş = sınırsız"
                                    value={form.usageLimit}
                                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                                />
                            </label>
                            <label>
                                Kullanıcı başına limit
                                <input
                                    type="number"
                                    className="ap-input"
                                    min={1}
                                    value={form.perUserLimit}
                                    onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                                />
                            </label>
                            <label>
                                Başlangıç
                                <input
                                    type="datetime-local"
                                    className="ap-input"
                                    value={form.validFrom}
                                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                                />
                            </label>
                            <label>
                                Bitiş
                                <input
                                    type="datetime-local"
                                    className="ap-input"
                                    value={form.validUntil}
                                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                                />
                            </label>
                        </div>

                        <div style={{ marginTop: "0.75rem" }}>
                            <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Geçerli paketler (boş = hepsi)</div>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                {PLAN_OPTS.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className={`ap-btn ap-btn--sm ${form.applicablePlans.includes(p.id) ? "ap-btn--primary" : ""}`}
                                        onClick={() => togglePlan(p.id)}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: "0.75rem" }}>
                            <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Ödeme periyodu (boş = ikisi)</div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                {["monthly", "yearly"].map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        className={`ap-btn ap-btn--sm ${form.applicableBillingCycles.includes(c) ? "ap-btn--primary" : ""}`}
                                        onClick={() => toggleCycle(c)}
                                    >
                                        {c === "monthly" ? "Aylık" : "Yıllık"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem" }}>
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                            />
                            Kupon aktif
                        </label>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                            <button type="button" className="ap-btn" onClick={() => setModalOpen(false)} disabled={saving}>
                                İptal
                            </button>
                            <button type="button" className="ap-btn ap-btn--primary" onClick={handleSave} disabled={saving}>
                                {saving ? "Kaydediliyor…" : "Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminCouponsCampaigns;
