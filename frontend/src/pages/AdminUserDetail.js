/**
 * AdminUserDetail — Kullanıcı Detay Sayfası
 * LysiaETIC Admin Panel
 *
 * Bir kullanıcının TÜM DB verilerini tek ekâranda organize şekilde gösterir:
 *   - Profil & Firma Bilgileri (User + companyInfo)
 *   - Pazaryeri Entegrasyonları (Marketplace credentials)
 *   - Ürün & Sipariş İstatistikleri
 *   - e-Fatura / e-Arşiv Ayarları (AutoInvoiceConfig + QNB credentials)
 *   - Kesilen Faturalar (Invoice)
 *   - Otomatik Sipariş Ayarları (AutoOrderConfig)
 *   - Abonelik & Ödeme Geçmişi
 *   - Destek Talepleri
 */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    FaArrowLeft, FaUser, FaBuilding, FaPlug, FaBoxOpen,
    FaClipboardList, FaFileInvoiceDollar, FaFileInvoice,
    FaCrown, FaCreditCard, FaTicketAlt, FaTruck,
    FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
    FaCopy, FaShieldAlt
} from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";

// ═══════════════════════════════════════════════════════════════════════════
//  YARDIMCI BİLEŞENLER
// ═══════════════════════════════════════════════════════════════════════════

const Section = ({ icon, title, badge, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="ap-card" style={{ marginBottom: "1rem" }}>
            <div
                onClick={() => setOpen(!open)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "0.75rem 1rem", borderBottom: open ? "1px solid var(--ap-border)" : "none" }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "0.95rem" }}>
                    {icon} {title}
                    {badge !== undefined && <span className="ap-badge ap-badge--blue" style={{ marginLeft: 6 }}>{badge}</span>}
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--ap-muted)" }}>{open ? "▲" : "▼"}</span>
            </div>
            {open && <div style={{ padding: "0.75rem 1rem" }}>{children}</div>}
        </div>
    );
};

const InfoRow = ({ label, value, mono, copyable }) => {
    const display = value || "—";
    const handleCopy = () => { if (value) navigator.clipboard.writeText(value); };
    return (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid var(--ap-border)", fontSize: "0.85rem" }}>
            <span style={{ color: "var(--ap-muted)", minWidth: 160 }}>{label}</span>
            <span style={{ fontFamily: mono ? "monospace" : "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                {display}
                {copyable && value && (
                    <FaCopy onClick={handleCopy} style={{ cursor: "pointer", fontSize: 11, color: "var(--ap-muted)" }} title="Kopyala" />
                )}
            </span>
        </div>
    );
};

const StatusBadge = ({ active, trueText = "Aktif", falseText = "Pasif" }) => (
    <span className={`ap-badge ${active ? "ap-badge--green" : "ap-badge--red"}`}>
        {active ? <><FaCheckCircle style={{ marginRight: 3 }} />{trueText}</> : <><FaTimesCircle style={{ marginRight: 3 }} />{falseText}</>}
    </span>
);

const MiniTable = ({ columns, rows, emptyText = "Veri yok" }) => {
    if (!rows || rows.length === 0) {
        return <div style={{ padding: "1rem", textAlign: "center", color: "var(--ap-muted)", fontSize: "0.85rem" }}>{emptyText}</div>;
    }
    return (
        <div style={{ overflowX: "auto" }}>
            <table className="ap-table" style={{ fontSize: "0.82rem" }}>
                <thead>
                    <tr>{columns.map((col, i) => <th key={i}>{col.label}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((row, ri) => (
                        <tr key={ri}>
                            {columns.map((col, ci) => (
                                <td key={ci} style={col.mono ? { fontFamily: "monospace", fontSize: "0.78rem" } : {}}>
                                    {col.render ? col.render(row) : (row[col.key] ?? "—")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const formatDate = (d) => d ? new Date(d).toLocaleString("tr-TR") : "—";
const formatMoney = (n) => typeof n === "number" ? n.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺" : "—";

// ═══════════════════════════════════════════════════════════════════════════
//  ANA BİLEŞEN
// ═══════════════════════════════════════════════════════════════════════════

const AdminUserDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await axios.get(`/saas-admin/tenants/${id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                });
                if (res.data.success) {
                    setData(res.data);
                } else {
                    setError(res.data.message || "Veri alınamadı");
                }
            } catch (err) {
                setError(err.response?.data?.message || err.message || "Sunucu hatası");
            } finally {
                setLoading(false);
            }
        };
        if (id) load();
    }, [id]);

    if (loading) return <AdminLayout title="Kullanıcı Detay"><div className="ap-loading">Yükleniyor...</div></AdminLayout>;
    if (error) return (
        <AdminLayout title="Kullanıcı Detay">
            <div className="ap-card" style={{ padding: "2rem", textAlign: "center" }}>
                <FaExclamationTriangle style={{ fontSize: 32, color: "var(--ap-red)", marginBottom: 8 }} />
                <p>{error}</p>
                <button className="ap-btn ap-btn--ghost" onClick={() => navigate(-1)} style={{ marginTop: 12 }}>
                    <FaArrowLeft /> Geri Dön
                </button>
            </div>
        </AdminLayout>
    );

    const t = data.tenant || {};
    const ci = t.companyInfo || {};
    const profile = t.profile || {};
    const sub = t.subscription || data.subscription || {};
    const mps = data.marketplaces || [];
    const ic = data.invoiceConfig || {};
    const is_ = data.invoiceStats || {};
    const os_ = data.orderStats || {};
    const aocs = data.autoOrderConfigs || [];

    const planMap = { free: "Ücretsiz", trial: "Deneme", basic: "Temel", pro: "Profesyonel", enterprise: "Kurumsal" };
    const statusMap = { active: "Aktif", trial: "Deneme", cancelled: "İptal", expired: "Süresi Dolmuş", suspended: "Askıda" };

    return (
        <AdminLayout
            title={t.name || "Kullanıcı Detay"}
            subtitle={t.email || id}
            actions={
                <button className="ap-btn ap-btn--ghost" onClick={() => navigate(-1)}>
                    <FaArrowLeft style={{ marginRight: 4 }} /> Geri
                </button>
            }
        >
            {/* ═══ 1. KULLANICI PROFİLİ ═══ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
                <Section icon={<FaUser style={{ color: "var(--ap-blue)" }} />} title="Kullanıcı Profili">
                    <InfoRow label="ID" value={t._id} mono copyable />
                    <InfoRow label="Ad Soyad" value={`${t.name || ""} ${t.surname || ""}`.trim()} />
                    <InfoRow label="E-posta" value={t.email} copyable />
                    <InfoRow label="Telefon" value={profile.phone || t.phone || ci.phone} />
                    <InfoRow label="Rol" value={t.role} />
                    <InfoRow label="Auth" value={t.authProvider || "local"} />
                    <InfoRow label="E-posta Doğrulanmış" value={t.emailVerified ? "✅ Evet" : "❌ Hayır"} />
                    <InfoRow label="2FA" value={t.security?.twoFactorEnabled ? "✅ Aktif" : "❌ Pasif"} />
                    <InfoRow label="Kayıt Tarihi" value={formatDate(t.createdAt)} />
                    <InfoRow label="Son Güncelleme" value={formatDate(t.updatedAt)} />
                </Section>

                {/* ═══ 2. FİRMA BİLGİLERİ ═══ */}
                <Section icon={<FaBuilding style={{ color: "var(--ap-purple)" }} />} title="Firma Bilgileri (companyInfo)">
                    <InfoRow label="VKN / TCKN" value={ci.vkn} mono copyable />
                    <InfoRow label="Firma Adı" value={ci.companyName} />
                    <InfoRow label="Vergi Dairesi" value={ci.taxOffice} />
                    <InfoRow label="Ad" value={ci.firstName} />
                    <InfoRow label="Soyad" value={ci.lastName} />
                    <InfoRow label="Adres" value={ci.street} />
                    <InfoRow label="İlçe" value={ci.district} />
                    <InfoRow label="İl" value={ci.city} />
                    <InfoRow label="Ülke" value={ci.country} />
                    <InfoRow label="Telefon" value={ci.phone} />
                    <InfoRow label="E-posta" value={ci.email} />
                    {ci.qnb && (
                        <>
                            <div style={{ borderTop: "2px solid var(--ap-border)", margin: "0.5rem 0", paddingTop: "0.5rem" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ap-blue)" }}>🔗 QNB eSolutions</span>
                            </div>
                            <InfoRow label="e-Arşiv Kullanıcı" value={ci.qnb.earsivUsername} mono />
                            <InfoRow label="e-Arşiv Şifre" value={ci.qnb.earsivPassword} />
                            <InfoRow label="e-Fatura Kullanıcı" value={ci.qnb.efaturaUsername} mono />
                            <InfoRow label="e-Fatura Şifre" value={ci.qnb.efaturaPassword} />
                            <InfoRow label="Ortam" value={ci.qnb.env === "production" ? "🟢 Canlı" : "🟡 Test"} />
                        </>
                    )}
                </Section>
            </div>

            {/* ═══ 3. ABONELİK ═══ */}
            <Section icon={<FaCrown style={{ color: "var(--ap-yellow)" }} />} title="Abonelik" badge={planMap[sub.plan] || sub.plan}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem" }}>
                    <InfoRow label="Plan" value={planMap[sub.plan] || sub.plan} />
                    <InfoRow label="Durum" value={statusMap[sub.status] || sub.status} />
                    <InfoRow label="Başlangıç" value={formatDate(sub.startDate)} />
                    <InfoRow label="Bitiş" value={formatDate(sub.endDate)} />
                    <InfoRow label="Deneme Başlangıç" value={formatDate(sub.trialStartDate)} />
                    <InfoRow label="Deneme Bitiş" value={formatDate(sub.trialEndDate)} />
                    <InfoRow label="Otomatik Yenileme" value={sub.autoRenew ? "✅ Evet" : "❌ Hayır"} />
                </div>
            </Section>

            {/* ═══ 4. PAZARYERI ENTEGRASYONLARI ═══ */}
            <Section icon={<FaPlug style={{ color: "var(--ap-green)" }} />} title="Pazaryeri Entegrasyonları" badge={mps.length}>
                {mps.length === 0 ? (
                    <div style={{ padding: "1rem", textAlign: "center", color: "var(--ap-muted)" }}>Entegrasyon yok</div>
                ) : (
                    mps.map((mp, i) => (
                        <div key={i} style={{ marginBottom: i < mps.length - 1 ? "1rem" : 0, padding: "0.75rem", background: "var(--ap-bg-alt)", borderRadius: 8, border: "1px solid var(--ap-border)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>🏪 {mp.marketplaceName}</span>
                                <StatusBadge active={mp.isActive} />
                            </div>
                            {mp.credentials && Object.entries(mp.credentials).map(([key, val]) => (
                                <InfoRow key={key} label={key} value={String(val || "")} mono={key.toLowerCase().includes("id") || key.toLowerCase().includes("key")} />
                            ))}
                            <InfoRow label="Bağlantı Tarihi" value={formatDate(mp.createdAt)} />
                        </div>
                    ))
                )}
            </Section>

            {/* ═══ 5. SİPARİŞ İSTATİSTİKLERİ ═══ */}
            <Section icon={<FaClipboardList style={{ color: "var(--ap-cyan)" }} />} title="Sipariş İstatistikleri" badge={os_.total}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                    <div className="ap-card" style={{ padding: "1rem", textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{os_.total || 0}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ap-muted)" }}>Toplam Sipariş</div>
                    </div>
                    <div className="ap-card" style={{ padding: "1rem", textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{formatMoney(os_.revenue)}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ap-muted)" }}>Toplam Ciro</div>
                    </div>
                    <div className="ap-card" style={{ padding: "1rem", textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{data.productCount || 0}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ap-muted)" }}>Ürün Eşleşme</div>
                    </div>
                </div>
                {os_.byMarketplace && os_.byMarketplace.length > 0 && (
                    <MiniTable
                        columns={[
                            { label: "Pazaryeri", key: "marketplace" },
                            { label: "Sipariş", key: "count" },
                            { label: "Ciro", render: r => formatMoney(r.revenue) },
                        ]}
                        rows={os_.byMarketplace}
                    />
                )}
            </Section>

            {/* ═══ 6. E-FATURA / E-ARŞİV AYARLARI ═══ */}
            <Section
                icon={<FaFileInvoiceDollar style={{ color: "var(--ap-orange)" }} />}
                title="e-Fatura / e-Arşiv Ayarları"
                badge={ic.enabled ? "AKTİF" : "PASİF"}
            >
                {!ic._id ? (
                    <div style={{ padding: "1rem", textAlign: "center", color: "var(--ap-muted)" }}>Fatura ayarları yapılmamış</div>
                ) : (
                    <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
                            <div>
                                <h5 style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--ap-blue)" }}>⚙️ Genel Ayarlar</h5>
                                <InfoRow label="Durum" value={ic.enabled ? "✅ Aktif" : "❌ Pasif"} />
                                <InfoRow label="Sağlayıcı" value={ic.provider} />
                                <InfoRow label="Belge Tipi" value={ic.documentType} />
                                <InfoRow label="Fatura Tipi" value={ic.invoiceTypeCode} />
                                <InfoRow label="Seri Kodu" value={ic.invoiceSeriesCode} />
                                <InfoRow label="KDV Oranı" value={ic.defaultVatRate ? `%${ic.defaultVatRate}` : ""} />
                                <InfoRow label="KDV Dahil" value={ic.pricesIncludeVat ? "Evet" : "Hayır"} />
                                <InfoRow label="Para Birimi" value={ic.currency} />
                            </div>
                            <div>
                                <h5 style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--ap-purple)" }}>🏢 Satıcı (Fatura Config)</h5>
                                <InfoRow label="VKN" value={ic.supplier?.vkn} mono />
                                <InfoRow label="Firma" value={ic.supplier?.name} />
                                <InfoRow label="Vergi Dairesi" value={ic.supplier?.taxOffice} />
                                <InfoRow label="Adres" value={`${ic.supplier?.street || ""} ${ic.supplier?.district || ""} ${ic.supplier?.city || ""}`.trim()} />
                            </div>
                            <div>
                                <h5 style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--ap-green)" }}>🔗 QNB Credentials (Config)</h5>
                                <InfoRow label="e-Arşiv Kullanıcı" value={ic.qnbCredentials?.earsivUsername} mono />
                                <InfoRow label="e-Arşiv Şifre" value={ic.qnbCredentials?.earsivPassword} />
                                <InfoRow label="e-Fatura Kullanıcı" value={ic.qnbCredentials?.efaturaUsername} mono />
                                <InfoRow label="e-Fatura Şifre" value={ic.qnbCredentials?.efaturaPassword} />
                                <InfoRow label="Ortam" value={ic.qnbCredentials?.env === "production" ? "🟢 Canlı" : "🟡 Test"} />
                            </div>
                        </div>
                        {ic.stats && (
                            <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "var(--ap-bg-alt)", borderRadius: 6, fontSize: "0.82rem" }}>
                                <strong>İstatistikler:</strong>{" "}
                                Toplam Fatura: {ic.stats.totalInvoicesCreated || 0} |{" "}
                                Ardışık Hata: {ic.stats.conseçutiveErrors || 0} |{" "}
                                Son Hata: {ic.stats.lastError || "Yok"} |{" "}
                                Son Fatura: {formatDate(ic.stats.lastInvoiceDate)}
                            </div>
                        )}
                        {ic.enabledMarketplaces && ic.enabledMarketplaces.length > 0 && (
                            <div style={{ marginTop: "0.5rem", fontSize: "0.82rem" }}>
                                <strong>Aktif Pazaryerleri:</strong>{" "}
                                {ic.enabledMarketplaces.map((m, i) => (
                                    <span key={i} className="ap-chip" style={{ marginRight: 4 }}>{m}</span>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </Section>

            {/* ═══ 7. KESİLEN FATURALAR ═══ */}
            <Section
                icon={<FaFileInvoice style={{ color: "var(--ap-teal)" }} />}
                title="Kesilen Faturalar"
                badge={is_.total || 0}
                defaultOpen={false}
            >
                {is_.byStatus && is_.byStatus.length > 0 && (
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                        {is_.byStatus.map((s, i) => (
                            <div key={i} className="ap-card" style={{ padding: "0.5rem 1rem", textAlign: "center", minWidth: 100 }}>
                                <div style={{ fontWeight: 700 }}>{s.count}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--ap-muted)" }}>{s.status || "?"}</div>
                                <div style={{ fontSize: "0.75rem" }}>{formatMoney(s.total)}</div>
                            </div>
                        ))}
                    </div>
                )}
                <MiniTable
                    columns={[
                        { label: "Fatura No", key: "invoiceNumber", mono: true },
                        { label: "Tarih", render: r => formatDate(r.issueDate) },
                        { label: "Müşteri", key: "customer" },
                        { label: "Tutar", render: r => formatMoney(r.total) },
                        { label: "Profil", key: "profileId" },
                        { label: "Pazaryeri", key: "marketplace" },
                        { label: "Durum", key: "status" },
                        { label: "Oluşturan", key: "createdBy" },
                    ]}
                    rows={data.recentInvoices || []}
                    emptyText="Henüz fatura kesilmemiş"
                />
            </Section>

            {/* ═══ 8. OTOMATİK SİPARİŞ AYARLARI ═══ */}
            {aocs.length > 0 && (
                <Section icon={<FaTruck style={{ color: "var(--ap-indigo)" }} />} title="Otomatik Sipariş Ayarları" badge={aocs.length} defaultOpen={false}>
                    <MiniTable
                        columns={[
                            { label: "Pazaryeri", key: "marketplace" },
                            { label: "Durum", render: r => <StatusBadge active={r.enabled} /> },
                            { label: "Birincil Kargo", key: "primaryCargo" },
                            { label: "Yedek Kargo", key: "fallbackCargo" },
                            { label: "İşlenen", render: r => r.stats?.totalProcessed || 0 },
                            { label: "Başarılı", render: r => r.stats?.totalSuccess || 0 },
                            { label: "Başarısız", render: r => r.stats?.totalFailed || 0 },
                        ]}
                        rows={aocs}
                    />
                </Section>
            )}

            {/* ═══ 9. SON SİPARİŞLER ═══ */}
            <Section icon={<FaClipboardList style={{ color: "var(--ap-blue)" }} />} title="Son Siparişler" badge={data.recentOrders?.length} defaultOpen={false}>
                <MiniTable
                    columns={[
                        { label: "Sipariş No", render: r => r.trackingNumber || r.orderNumber || r._id?.toString().slice(-8), mono: true },
                        { label: "Pazaryeri", key: "marketplaceName" },
                        { label: "Durum", key: "status" },
                        { label: "Tutar", render: r => formatMoney(r.totalPrice) },
                        { label: "Müşteri", key: "customerName" },
                        { label: "Fatura", render: r => r.invoiceId ? "✅" : "—" },
                        { label: "Tarih", render: r => formatDate(r.createdAt) },
                    ]}
                    rows={data.recentOrders || []}
                    emptyText="Sipariş yok"
                />
            </Section>

            {/* ═══ 10. ÖDEME GEÇMİŞİ ═══ */}
            <Section icon={<FaCreditCard style={{ color: "var(--ap-pink)" }} />} title="Ödeme Geçmişi" badge={data.payments?.length} defaultOpen={false}>
                <MiniTable
                    columns={[
                        { label: "ID", render: r => r._id?.toString().slice(-8), mono: true },
                        { label: "Tutar", render: r => formatMoney(r.amount) },
                        { label: "Durum", key: "status" },
                        { label: "Yöntem", key: "method" },
                        { label: "Tarih", render: r => formatDate(r.createdAt) },
                    ]}
                    rows={data.payments || []}
                    emptyText="Ödeme kaydı yok"
                />
            </Section>

            {/* ═══ 11. DESTEK TALEPLERİ ═══ */}
            <Section icon={<FaTicketAlt style={{ color: "var(--ap-red)" }} />} title="Destek Talepleri" badge={data.tickets?.length} defaultOpen={false}>
                <MiniTable
                    columns={[
                        { label: "Konu", key: "subject" },
                        { label: "Durum", key: "status" },
                        { label: "Öncelik", key: "priority" },
                        { label: "Tarih", render: r => formatDate(r.createdAt) },
                    ]}
                    rows={data.tickets || []}
                    emptyText="Destek talebi yok"
                />
            </Section>

            {/* ═══ 12. GÜVENLİK BİLGİLERİ ═══ */}
            <Section icon={<FaShieldAlt style={{ color: "var(--ap-red)" }} />} title="Güvenlik" defaultOpen={false}>
                <InfoRow label="2FA Aktif" value={t.security?.twoFactorEnabled ? "✅ Evet" : "❌ Hayır"} />
                <InfoRow label="Son Şifre Değişikliği" value={formatDate(t.security?.lastPasswordChange)} />
                <InfoRow label="Yasal Onay" value={t.legalAcceptance?.accepted ? `✅ ${formatDate(t.legalAcceptance.acceptedAt)}` : "❌ Onaylanmamış"} />
                <InfoRow label="Onay IP" value={t.legalAcceptance?.ipAddress} mono />
                {t.security?.loginHistory && t.security.loginHistory.length > 0 && (
                    <>
                        <div style={{ marginTop: "0.5rem", fontSize: "0.82rem", fontWeight: 600 }}>Son Giriş Geçmişi:</div>
                        <MiniTable
                            columns={[
                                { label: "IP", key: "ip", mono: true },
                                { label: "Cihaz", render: r => (r.device || "").substring(0, 50) },
                                { label: "Tarih", render: r => formatDate(r.timestamp) },
                            ]}
                            rows={t.security.loginHistory.slice(-5).reverse()}
                        />
                    </>
                )}
            </Section>
        </AdminLayout>
    );
};

export default AdminUserDetail;
