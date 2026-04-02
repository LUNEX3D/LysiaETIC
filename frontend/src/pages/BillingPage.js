import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaFileInvoice, FaFileInvoiceDollar, FaTruck, FaSearch,
    FaPlus, FaTimes, FaExclamationTriangle, FaSpinner,
    FaMoneyBillWave,
    FaDownload, FaPrint, FaEye,
    FaCog, FaLink,
    FaCheckCircle, FaTimesCircle, FaClock,
    FaInfoCircle, FaArrowRight, FaClipboardList, FaSyncAlt,
    FaChartBar, FaChartPie, FaCalendarAlt, FaBuilding, FaHashtag,
    FaPercentage, FaCoins, FaChevronDown, FaChevronUp
} from "react-icons/fa";

/* ═══════════════════════════════════════════════════════════
   RENK PALETİ (UserDashboard ile uyumlu)
   ═══════════════════════════════════════════════════════════ */
const C = {
    bg: "#0f1419",
    card: "rgba(26, 31, 53, 0.85)",
    border: "rgba(78, 205, 196, 0.18)",
    accent: "#4ecdc4",
    green: "#22c55e",
    red: "#ef4444",
    yellow: "#f59e0b",
    purple: "#8b5cf6",
    blue: "#06b6d4",
    pink: "#ec4899",
    orange: "#f97316",
    text: "#e2e8f0",
    muted: "#94a3b8",
    dim: "#64748b",
    glass: "rgba(255,255,255,0.03)",
    glassBr: "rgba(255,255,255,0.06)",
};

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const fmtCurrency = (v) => {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(v || 0));
    } catch { return Number(v || 0).toFixed(2) + " TL"; }
};

const fmtDate = (d) => {
    if (!d) return "—";
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return String(d); }
};

/* ═══════════════════════════════════════════════════════════
   E-FATURA SAĞLAYICI TANIMLARI
   ═══════════════════════════════════════════════════════════ */
const PROVIDERS = [
    {
        id: "trendyol-efaturam",
        name: "Trendyol E-Faturam",
        logo: "🛍️",
        color: "#f27a1a",
        description: "Trendyol E-Faturam ile e-Fatura, e-Arşiv ve e-İrsaliye işlemlerinizi yönetin.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "Mükellef Sorgulama"],
        authType: "trendyol",
        fields: [
            { key: "username", label: "Partner Kullanıcı Adı", type: "text", required: true, hint: "Trendyol E-Faturam partner hesabınız" },
            { key: "password", label: "Partner Şifre", type: "password", required: true, hint: "Partner hesap şifreniz" },
            { key: "customerUsername", label: "Müşteri Kullanıcı Adı", type: "text", required: true, hint: "Firma e-Fatura kullanıcı adı" },
            { key: "customerPassword", label: "Müşteri Şifre", type: "password", required: true, hint: "Firma e-Fatura şifresi" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "stage-apigateway.trendyolefaturam.com" },
            { id: "production", label: "Canlı Ortam", url: "apigateway.trendyolecozum.com" },
        ],
        searchEndpoint: "/api/e-invoice/trendyol/documents/search",
    },
    {
        id: "qnb-esolutions",
        name: "QNB eFinans",
        logo: "🏦",
        color: "#7c3aed",
        description: "QNB eFinans (eSolutions) ile e-Fatura, e-Arşiv, e-İrsaliye ve e-Defter işlemlerinizi yönetin. Türkiye'nin en büyük e-belge pazarında lider.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "e-Defter", "Mükellef Sorgulama"],
        authType: "qnb",
        fields: [
            { key: "username", label: "Kullanıcı Adı", type: "text", required: true, hint: "QNB eFinans kullanıcı adınız" },
            { key: "password", label: "Şifre", type: "password", required: true, hint: "QNB eFinans şifreniz" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "testapi.qnbefinans.com" },
            { id: "production", label: "Canlı Ortam", url: "api.qnbefinans.com" },
        ],
        searchEndpoint: "/api/e-invoice/qnb/documents/search",
    },
    {
        id: "sovos",
        name: "Sovos (Foriba)",
        logo: "🌐",
        color: "#10b981",
        description: "Sovos (eski Foriba) ile global e-Fatura, e-Arşiv ve e-İrsaliye entegrasyonu. OAuth 2.0 tabanlı güvenli API. 100.000+ müşteri.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "e-Defter", "Global Uyum"],
        authType: "sovos",
        fields: [
            { key: "apiKey", label: "API Key", type: "text", required: true, hint: "Sovos Developer Hub'dan aldığınız API Key" },
            { key: "apiSecret", label: "API Secret", type: "password", required: true, hint: "Sovos Developer Hub'dan aldığınız Secret" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "api-test.sovos.com" },
            { id: "production", label: "Canlı Ortam", url: "api.sovos.com" },
        ],
        searchEndpoint: "/api/e-invoice/sovos/documents/search",
    },
    {
        id: "parasut",
        name: "Paraşüt",
        logo: "🪂",
        color: "#6366f1",
        description: "Paraşüt ile muhasebe, e-Fatura, e-Arşiv ve e-SMM entegrasyonu. OAuth 2.0 tabanlı güvenli API. Satış faturaları, müşteri/tedarikçi, ürün ve stok yönetimi.",
        features: ["e-Fatura", "e-Arşiv", "e-SMM", "Muhasebe", "Stok Yönetimi"],
        authType: "parasut",
        fields: [
            { key: "clientId", label: "Client ID", type: "text", required: true, hint: "Paraşüt'ten aldığınız Client ID (destek@parasut.com)" },
            { key: "clientSecret", label: "Client Secret", type: "password", required: true, hint: "Paraşüt'ten aldığınız Client Secret" },
            { key: "email", label: "E-posta", type: "email", required: true, hint: "Paraşüt hesap e-posta adresiniz" },
            { key: "password", label: "Şifre", type: "password", required: true, hint: "Paraşüt hesap şifreniz" },
        ],
        environments: [
            { id: "production", label: "Canlı Ortam", url: "api.parasut.com" },
        ],
        searchEndpoint: "/api/e-invoice/parasut/documents/search",
    },
    {
        id: "odeal",
        name: "Ödeal E-FaturaPos",
        logo: "💳",
        color: "#e11d48",
        description: "Ödeal E-FaturaPos ile VUK 507 uyumlu e-Fatura, e-Arşiv ve ödeme entegrasyonu. Sepet yönetimi, işlem raporlama ve webhook bildirimleri.",
        features: ["e-Fatura", "e-Arşiv", "Sepet Yönetimi", "Raporlama", "Webhook"],
        authType: "odeal",
        fields: [
            { key: "serviceKey", label: "Servis Anahtarı", type: "password", required: true, hint: "Ödeal'dan aldığınız Service Key" },
            { key: "merchantKey", label: "Merchant Key (İşyeri Anahtarı)", type: "password", required: false, hint: "İşyeri tanımlama anahtarı (opsiyonel)" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "stage.odealapp.com" },
            { id: "production", label: "Canlı Ortam", url: "api.odeal.com" },
        ],
        searchEndpoint: "/api/e-invoice/odeal/documents/search",
    },
    {
        id: "logo",
        name: "Logo e-Fatura",
        logo: "📊",
        color: "#0ea5e9",
        description: "Logo Yazılım e-Fatura entegrasyonu. (Yakında)",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye"],
        comingSoon: true
    }
];

/* ═══════════════════════════════════════════════════════════
   YARDIMCI BİLEŞENLER
   ═══════════════════════════════════════════════════════════ */
const GlassCard = ({ children, style, onClick }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={onClick}
        style={{
            background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.85) 100%)",
            border: "1px solid " + C.border,
            borderRadius: 16,
            padding: "1.5rem",
            ...style,
        }}
    >
        {children}
    </motion.div>
);

const Pill = ({ color, children }) => (
    <span style={{
        background: color + "15",
        border: "1px solid " + color + "35",
        padding: "0.25rem 0.6rem",
        borderRadius: 8,
        color: color,
        fontSize: "0.72rem",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
    }}>
        {children}
    </span>
);

const StatusBadge = ({ status }) => {
    const s = (status || "").toLowerCase();
    const config = {
        approved: { color: C.green, icon: <FaCheckCircle />, label: "Onaylandı" },
        succeed: { color: C.green, icon: <FaCheckCircle />, label: "Başarılı" },
        completed: { color: C.green, icon: <FaCheckCircle />, label: "Tamamlandı" },
        sent: { color: C.blue, icon: <FaArrowRight />, label: "Gönderildi" },
        waiting: { color: C.yellow, icon: <FaClock />, label: "Beklemede" },
        pending: { color: C.yellow, icon: <FaClock />, label: "Beklemede" },
        queued: { color: C.yellow, icon: <FaClock />, label: "Sırada" },
        cancelled: { color: C.red, icon: <FaTimesCircle />, label: "İptal" },
        failed: { color: C.red, icon: <FaTimesCircle />, label: "Başarısız" },
        error: { color: C.red, icon: <FaTimesCircle />, label: "Hata" },
        received: { color: C.purple, icon: <FaDownload />, label: "Alındı" },
        draft: { color: C.dim, icon: <FaFileInvoice />, label: "Taslak" },
    };
    const c = config[s] || { color: C.dim, icon: <FaFileInvoice />, label: status || "Bilinmiyor" };
    return <Pill color={c.color}>{c.icon} {c.label}</Pill>;
};

const TypeBadge = ({ type }) => {
    const config = {
        "e-arsiv": { color: C.accent, label: "e-Arşiv" },
        "e-fatura": { color: C.orange, label: "e-Fatura" },
        "e-fatura-gelen": { color: C.purple, label: "Gelen e-Fatura" },
        "e-irsaliye": { color: C.pink, label: "e-İrsaliye" },
    };
    const c = config[type] || { color: C.dim, label: type };
    return <Pill color={c.color}>{c.label}</Pill>;
};

/* Boş durum bileşeni */
const EmptyState = ({ icon, title, description, action }) => (
    <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: C.dim }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>{icon}</div>
        <p style={{ color: C.muted, fontSize: "1rem", fontWeight: 600, margin: "0 0 0.35rem" }}>{title}</p>
        <p style={{ fontSize: "0.82rem", margin: "0 0 1rem", maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>{description}</p>
        {action}
    </div>
);

/* ═══════════════════════════════════════════════════════════
   GELİŞMİŞ ANALİZ BİLEŞENİ v2 — Tamamen bağımsız, saf React
   BillingPage state değişikliklerinden etkilenmez.
   Framer-motion KULLANMAZ — sadece CSS transition.
   ═══════════════════════════════════════════════════════════ */
const AdvancedAnalysis = React.memo(({ invoices, onInvoiceClick }) => {
    const [openSections, setOpenSections] = useState({ score: true, type: true, status: true });
    const toggleSection = (id) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

    /* ── Tüm hesaplamalar tek useMemo ── */
    const data = useMemo(() => {
        if (!invoices || invoices.length === 0) return null;

        const TC = { "e-arsiv": C.accent, "e-fatura": C.orange, "e-fatura-gelen": C.purple, "e-irsaliye": C.pink };
        const TL = { "e-arsiv": "e-Arşiv", "e-fatura": "e-Fatura", "e-fatura-gelen": "Gelen e-Fatura", "e-irsaliye": "e-İrsaliye" };

        /* ── Temel istatistikler ── */
        const amounts = invoices.map(i => i.total || 0).filter(a => a > 0);
        const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);
        const totalTax = invoices.reduce((s, i) => s + (i.tax || 0), 0);
        const avgAmount = amounts.length > 0 ? totalAmount / amounts.length : 0;
        const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
        const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
        const sortedAmounts = [...amounts].sort((a, b) => a - b);
        const medianAmount = sortedAmounts.length > 0 ? sortedAmounts[Math.floor(sortedAmounts.length / 2)] : 0;
        const netAmount = totalAmount - totalTax;
        const taxRate = netAmount > 0 ? ((totalTax / netAmount) * 100) : 0;

        /* ── Standart sapma ── */
        const variance = amounts.length > 1 ? amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length : 0;
        const stdDev = Math.sqrt(variance);

        /* ── Tip kırılımı ── */
        const byType = {};
        invoices.forEach(inv => {
            const t = inv.type || "diger";
            if (!byType[t]) byType[t] = { count: 0, total: 0, tax: 0, items: [] };
            byType[t].count++;
            byType[t].total += (inv.total || 0);
            byType[t].tax += (inv.tax || 0);
            byType[t].items.push(inv);
        });

        /* ── Durum kırılımı ── */
        const byStatus = {};
        invoices.forEach(inv => {
            const s = inv.status || "bilinmiyor";
            if (!byStatus[s]) byStatus[s] = { count: 0, total: 0, items: [] };
            byStatus[s].count++;
            byStatus[s].total += (inv.total || 0);
            byStatus[s].items.push(inv);
        });

        /* ── Müşteri kırılımı ── */
        const custMap = {};
        invoices.forEach(inv => {
            const c = inv.customer || "Belirtilmemiş";
            if (!custMap[c]) custMap[c] = { count: 0, total: 0, tax: 0, vkn: inv.vkn || "", types: {}, items: [] };
            custMap[c].count++;
            custMap[c].total += (inv.total || 0);
            custMap[c].tax += (inv.tax || 0);
            custMap[c].types[inv.type || "diger"] = (custMap[c].types[inv.type || "diger"] || 0) + 1;
            custMap[c].items.push(inv);
        });
        const allCustomers = Object.entries(custMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);
        const topCustomers = allCustomers.slice(0, 20);

        /* ── Pareto (80/20) analizi ── */
        let paretoRunning = 0;
        let pareto80Count = 0;
        const pareto80Threshold = totalAmount * 0.8;
        for (const cust of allCustomers) {
            paretoRunning += cust.total;
            pareto80Count++;
            if (paretoRunning >= pareto80Threshold) break;
        }
        const paretoRatio = allCustomers.length > 0 ? ((pareto80Count / allCustomers.length) * 100) : 0;

        /* ── Aylık kırılım ── */
        const monthMap = {};
        invoices.forEach(inv => {
            if (!inv.date) return;
            try {
                const d = new Date(inv.date);
                if (isNaN(d.getTime())) return;
                const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
                const label = d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
                if (!monthMap[key]) monthMap[key] = { key, label, count: 0, total: 0, tax: 0, types: {}, items: [] };
                monthMap[key].count++;
                monthMap[key].total += (inv.total || 0);
                monthMap[key].tax += (inv.tax || 0);
                monthMap[key].types[inv.type || "diger"] = (monthMap[key].types[inv.type || "diger"] || 0) + 1;
                monthMap[key].items.push(inv);
            } catch { /* skip */ }
        });
        const monthly = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));

        /* ── Aylık büyüme oranları ── */
        const monthlyGrowth = monthly.map((m, i) => {
            if (i === 0) return { ...m, growth: null };
            const prev = monthly[i - 1].total;
            const growth = prev > 0 ? ((m.total - prev) / prev) * 100 : null;
            return { ...m, growth };
        });

        /* ── Haftanın günü analizi ── */
        const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
        const byDayOfWeek = Array(7).fill(null).map(() => ({ count: 0, total: 0 }));
        invoices.forEach(inv => {
            if (!inv.date) return;
            try {
                const d = new Date(inv.date);
                if (!isNaN(d.getTime())) {
                    byDayOfWeek[d.getDay()].count++;
                    byDayOfWeek[d.getDay()].total += (inv.total || 0);
                }
            } catch { /* skip */ }
        });
        const dayData = byDayOfWeek.map((d, i) => ({ name: dayNames[i], ...d }));
        const busiestDay = dayData.reduce((best, d) => d.count > best.count ? d : best, dayData[0]);

        /* ── Tutar dağılım aralıkları ── */
        const ranges = [
            { label: "0 - 1.000 ₺", min: 0, max: 1000, count: 0, total: 0, color: C.blue },
            { label: "1.000 - 5.000 ₺", min: 1000, max: 5000, count: 0, total: 0, color: C.accent },
            { label: "5.000 - 25.000 ₺", min: 5000, max: 25000, count: 0, total: 0, color: C.green },
            { label: "25.000 - 100.000 ₺", min: 25000, max: 100000, count: 0, total: 0, color: C.orange },
            { label: "100.000 ₺+", min: 100000, max: Infinity, count: 0, total: 0, color: C.red },
        ];
        invoices.forEach(inv => {
            const t = inv.total || 0;
            for (const r of ranges) {
                if (t >= r.min && t < r.max) { r.count++; r.total += t; break; }
            }
        });

        /* ── Para birimi ── */
        const byCurrency = {};
        invoices.forEach(inv => {
            const cur = inv.currency || "TRY";
            if (!byCurrency[cur]) byCurrency[cur] = { count: 0, total: 0 };
            byCurrency[cur].count++;
            byCurrency[cur].total += (inv.total || 0);
        });

        /* ── Sağlayıcı kırılımı ── */
        const byProvider = {};
        invoices.forEach(inv => {
            const p = inv.provider || "bilinmiyor";
            if (!byProvider[p]) byProvider[p] = { count: 0, total: 0 };
            byProvider[p].count++;
            byProvider[p].total += (inv.total || 0);
        });

        /* ── En yüksek / en düşük 5 fatura ── */
        const sortedByTotal = [...invoices].filter(i => (i.total || 0) > 0).sort((a, b) => (b.total || 0) - (a.total || 0));
        const top5 = sortedByTotal.slice(0, 5);
        const bottom5 = sortedByTotal.slice(-5).reverse();

        /* ── Finansal Sağlık Skoru (0-100) ── */
        let healthScore = 50;
        // Çeşitlilik bonusu
        if (allCustomers.length >= 5) healthScore += 8;
        if (allCustomers.length >= 10) healthScore += 5;
        // Düzenlilik bonusu
        if (monthly.length >= 3) healthScore += 7;
        if (monthly.length >= 6) healthScore += 5;
        // Büyüme bonusu
        const recentGrowths = monthlyGrowth.filter(m => m.growth !== null).slice(-3);
        const avgGrowth = recentGrowths.length > 0 ? recentGrowths.reduce((s, m) => s + m.growth, 0) / recentGrowths.length : 0;
        if (avgGrowth > 10) healthScore += 10;
        else if (avgGrowth > 0) healthScore += 5;
        else if (avgGrowth < -10) healthScore -= 10;
        // Onay oranı
        const approvedCount = (byStatus["approved"]?.count || 0) + (byStatus["succeed"]?.count || 0) + (byStatus["completed"]?.count || 0) + (byStatus["sent"]?.count || 0);
        const approvalRate = invoices.length > 0 ? (approvedCount / invoices.length) * 100 : 0;
        if (approvalRate > 90) healthScore += 10;
        else if (approvalRate > 70) healthScore += 5;
        else if (approvalRate < 50) healthScore -= 10;
        // Pareto riski
        if (paretoRatio < 20) healthScore -= 5; // Çok yoğunlaşmış
        healthScore = Math.max(0, Math.min(100, healthScore));

        const healthLabel = healthScore >= 80 ? "Mükemmel" : healthScore >= 60 ? "İyi" : healthScore >= 40 ? "Orta" : "Dikkat";
        const healthColor = healthScore >= 80 ? C.green : healthScore >= 60 ? C.accent : healthScore >= 40 ? C.yellow : C.red;

        return {
            TC, TL, totalAmount, totalTax, netAmount, avgAmount, maxAmount, minAmount, medianAmount, taxRate, stdDev,
            byType, byStatus, topCustomers, allCustomers, monthly, monthlyGrowth, byCurrency, byProvider,
            paretoRatio, pareto80Count, dayData, busiestDay, ranges, top5, bottom5,
            healthScore, healthLabel, healthColor, approvalRate, avgGrowth,
        };
    }, [invoices]);

    if (!data) return (
        <EmptyState icon="📊" title="Analiz için veri yok" description="Gelişmiş analiz görüntülemek için önce belgelerinizin yüklenmesi gerekiyor." />
    );

    /* ── Yardımcı fonksiyonlar ── */
    const pct = (val, max) => max > 0 ? Math.min((val / max) * 100, 100) : 0;

    /* ── Yardımcı bileşenler (sabit referans, render dışında tanımlı gibi davranır) ── */
    const ACard = ({ children, style: s }) => (
        <div style={{ background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.88) 100%)", border: "1px solid " + C.border, borderRadius: 16, marginBottom: "1rem", overflow: "hidden", ...s }}>{children}</div>
    );

    const SectionHead = ({ id, icon, title, color, badge, subtitle }) => (
        <div onClick={() => toggleSection(id)}
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 1.25rem", cursor: "pointer", userSelect: "none", borderBottom: openSections[id] ? "1px solid " + C.glassBr : "none", transition: "background 0.15s" }}>
            <div style={{ background: color + "20", padding: "0.5rem", borderRadius: 10, fontSize: "0.95rem", display: "flex", color }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <span style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700 }}>{title}</span>
                {subtitle && <p style={{ color: C.dim, fontSize: "0.68rem", margin: "0.1rem 0 0" }}>{subtitle}</p>}
            </div>
            {badge && <span style={{ background: color + "15", border: "1px solid " + color + "25", borderRadius: 6, padding: "0.15rem 0.5rem", color, fontSize: "0.7rem", fontWeight: 700 }}>{badge}</span>}
            <FaChevronDown style={{ color: C.dim, fontSize: "0.7rem", transform: openSections[id] ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.25s ease" }} />
        </div>
    );

    const Bar = ({ value, max, color, height, label }) => (
        <div style={{ position: "relative" }}>
            <div style={{ height: height || 7, background: C.glass, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: pct(value, max) + "%", background: "linear-gradient(90deg, " + color + ", " + color + "aa)", borderRadius: 4, transition: "width 0.4s ease" }} />
            </div>
            {label && <span style={{ position: "absolute", right: 0, top: -16, color: C.dim, fontSize: "0.6rem" }}>{label}</span>}
        </div>
    );

    const InvoiceChip = ({ inv, color }) => (
        <span onClick={() => onInvoiceClick(inv)}
            style={{ background: color + "10", border: "1px solid " + color + "25", borderRadius: 6, padding: "0.15rem 0.45rem", fontSize: "0.64rem", color, cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s", display: "inline-block" }}
            onMouseEnter={e => { e.target.style.background = color + "25"; e.target.style.transform = "scale(1.05)"; }}
            onMouseLeave={e => { e.target.style.background = color + "10"; e.target.style.transform = "scale(1)"; }}>
            {inv.number || inv.id}
        </span>
    );

    const maxTypeTotal = Math.max(...Object.values(data.byType).map(d => d.total), 1);
    const maxMonthTotal = data.monthly.length > 0 ? Math.max(...data.monthly.map(d => d.total), 1) : 1;
    const maxCustTotal = data.topCustomers.length > 0 ? data.topCustomers[0].total : 1;
    const maxDayCount = Math.max(...data.dayData.map(d => d.count), 1);
    const maxRangeCount = Math.max(...data.ranges.map(r => r.count), 1);

    return (
        <div>
            {/* ════════════════════════════════════════════════
                0. FİNANSAL SAĞLIK SKORU
               ════════════════════════════════════════════════ */}
            <ACard>
                <div style={{ padding: "1.5rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Skor Göstergesi */}
                    <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                        <svg viewBox="0 0 120 120" style={{ width: 120, height: 120, transform: "rotate(-90deg)" }}>
                            <circle cx="60" cy="60" r="52" fill="none" stroke={C.glass} strokeWidth="8" />
                            <circle cx="60" cy="60" r="52" fill="none" stroke={data.healthColor} strokeWidth="8"
                                strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - data.healthScore / 100)}
                                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: data.healthColor, fontSize: "1.8rem", fontWeight: 900, lineHeight: 1 }}>{data.healthScore}</span>
                            <span style={{ color: C.dim, fontSize: "0.6rem", fontWeight: 600, marginTop: 2 }}>{data.healthLabel}</span>
                        </div>
                    </div>

                    {/* Skor Detayları */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 800, margin: "0 0 0.15rem" }}>Finansal Sağlık Skoru</h3>
                        <p style={{ color: C.dim, fontSize: "0.75rem", margin: "0 0 0.85rem" }}>Fatura verilerinize dayalı genel değerlendirme</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            {[
                                { label: "Onay Oranı", value: "%" + data.approvalRate.toFixed(0), color: data.approvalRate > 80 ? C.green : data.approvalRate > 50 ? C.yellow : C.red },
                                { label: "Müşteri Çeşitliliği", value: data.allCustomers.length + " müşteri", color: data.allCustomers.length >= 5 ? C.green : C.yellow },
                                { label: "Ort. Büyüme", value: (data.avgGrowth >= 0 ? "+" : "") + data.avgGrowth.toFixed(1) + "%", color: data.avgGrowth > 0 ? C.green : data.avgGrowth < -5 ? C.red : C.yellow },
                                { label: "Düzenlilik", value: data.monthly.length + " aktif ay", color: data.monthly.length >= 3 ? C.green : C.yellow },
                            ].map(item => (
                                <div key={item.label} style={{ background: C.glass, borderRadius: 8, padding: "0.5rem 0.65rem" }}>
                                    <span style={{ color: C.dim, fontSize: "0.62rem", fontWeight: 600 }}>{item.label}</span>
                                    <p style={{ color: item.color, fontSize: "0.88rem", fontWeight: 700, margin: "0.1rem 0 0" }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ACard>

            {/* ════════════════════════════════════════════════
                1. ÜST ÖZET KARTLARI (10 KPI)
               ════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.7rem", marginBottom: "1.25rem" }}>
                {[
                    { icon: <FaFileInvoice />, label: "Toplam Belge", value: invoices.length, color: C.accent },
                    { icon: <FaMoneyBillWave />, label: "Brüt Ciro", value: fmtCurrency(data.totalAmount), color: C.green },
                    { icon: <FaCoins />, label: "Net Ciro", value: fmtCurrency(data.netAmount), color: C.green },
                    { icon: <FaPercentage />, label: "Toplam KDV", value: fmtCurrency(data.totalTax), color: C.purple },
                    { icon: <FaChartBar />, label: "Ortalama", value: fmtCurrency(data.avgAmount), color: C.blue },
                    { icon: <FaChevronUp />, label: "En Yüksek", value: fmtCurrency(data.maxAmount), color: C.green },
                    { icon: <FaChevronDown />, label: "En Düşük", value: fmtCurrency(data.minAmount), color: C.yellow },
                    { icon: <FaHashtag />, label: "Medyan", value: fmtCurrency(data.medianAmount), color: C.orange },
                    { icon: <FaPercentage />, label: "Ort. KDV", value: "%" + data.taxRate.toFixed(1), color: C.pink },
                    { icon: <FaBuilding />, label: "Müşteri", value: data.allCustomers.length, color: C.blue },
                ].map(k => (
                    <div key={k.label} style={{ background: "linear-gradient(135deg, " + C.card + ", rgba(15,20,25,0.92))", border: "1px solid " + k.color + "22", borderRadius: 12, padding: "0.9rem", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: -10, right: -10, width: 50, height: 50, background: "radial-gradient(circle, " + k.color + "12 0%, transparent 70%)", pointerEvents: "none" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.35rem" }}>
                            <span style={{ color: k.color, fontSize: "0.8rem" }}>{k.icon}</span>
                            <span style={{ color: C.dim, fontSize: "0.66rem", fontWeight: 600 }}>{k.label}</span>
                        </div>
                        <p style={{ color: "#fff", fontSize: "1.08rem", fontWeight: 800, margin: 0 }}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* ════════════════════════════════════════════════
                2. BELGE TİPİ KIRILIMI
               ════════════════════════════════════════════════ */}
            <ACard>
                <SectionHead id="type" icon={<FaChartPie />} title="Belge Tipi Kırılımı" color={C.accent} badge={Object.keys(data.byType).length + " tip"} subtitle="Belge türlerine göre dağılım ve ciro analizi" />
                {openSections["type"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        {/* Pasta grafik benzeri yatay dağılım */}
                        <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: "1rem", gap: 2 }}>
                            {Object.entries(data.byType).map(([type, d]) => (
                                <div key={type} title={(data.TL[type] || type) + ": " + d.count + " belge"} style={{ flex: d.count, background: data.TC[type] || C.dim, transition: "flex 0.3s" }} />
                            ))}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                            {Object.entries(data.byType).map(([type, d]) => {
                                const typeColor = data.TC[type] || C.dim;
                                const pctVal = invoices.length > 0 ? ((d.count / invoices.length) * 100).toFixed(1) : "0";
                                return (
                                    <div key={type}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <div style={{ width: 10, height: 10, borderRadius: 3, background: typeColor, flexShrink: 0 }} />
                                                <Pill color={typeColor}>{data.TL[type] || type}</Pill>
                                                <span style={{ color: C.muted, fontSize: "0.75rem" }}>{d.count} belge</span>
                                                <span style={{ color: C.dim, fontSize: "0.68rem" }}>(%{pctVal})</span>
                                            </div>
                                            <div style={{ textAlign: "right" }}>
                                                <span style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700 }}>{fmtCurrency(d.total)}</span>
                                                {d.tax > 0 && <span style={{ color: C.dim, fontSize: "0.68rem", marginLeft: "0.5rem" }}>KDV: {fmtCurrency(d.tax)}</span>}
                                            </div>
                                        </div>
                                        <Bar value={d.total} max={maxTypeTotal} color={typeColor} height={7} />
                                        <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                            {d.items.slice(0, 10).map(inv => <InvoiceChip key={inv.id} inv={inv} color={typeColor} />)}
                                            {d.items.length > 10 && <span style={{ color: C.dim, fontSize: "0.64rem", padding: "0.15rem 0.3rem", alignSelf: "center" }}>+{d.items.length - 10} daha</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ACard>

            {/* ════════════════════════════════════════════════
                3. DURUM DAĞILIMI
               ════════════════════════════════════════════════ */}
            <ACard>
                <SectionHead id="status" icon={<FaCheckCircle />} title="Durum Dağılımı" color={C.green} badge={Object.keys(data.byStatus).length + " durum"} subtitle="Belge onay ve işlem durumları" />
                {openSections["status"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
                            {Object.entries(data.byStatus).map(([status, d]) => {
                                const pctVal = invoices.length > 0 ? ((d.count / invoices.length) * 100).toFixed(1) : "0";
                                return (
                                    <div key={status} style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 12, padding: "0.9rem", transition: "border-color 0.2s" }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + "40"}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = C.glassBr}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                                            <StatusBadge status={status} />
                                            <span style={{ color: "#fff", fontSize: "1rem", fontWeight: 800 }}>{d.count}</span>
                                        </div>
                                        <p style={{ color: C.muted, fontSize: "0.78rem", margin: "0 0 0.4rem", fontWeight: 600 }}>{fmtCurrency(d.total)}</p>
                                        <Bar value={d.count} max={invoices.length} color={C.accent} height={5} />
                                        <p style={{ color: C.dim, fontSize: "0.65rem", margin: "0.25rem 0 0" }}>Toplam belgelerin %{pctVal}'i</p>
                                        {/* İlk 3 fatura chip */}
                                        <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                                            {d.items.slice(0, 4).map(inv => <InvoiceChip key={inv.id} inv={inv} color={C.accent} />)}
                                            {d.items.length > 4 && <span style={{ color: C.dim, fontSize: "0.6rem", alignSelf: "center" }}>+{d.items.length - 4}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </ACard>

            {/* ════════════════════════════════════════════════
                4. AYLIK CİRO TRENDİ + BÜYÜME
               ════════════════════════════════════════════════ */}
            <ACard>
                <SectionHead id="month" icon={<FaCalendarAlt />} title="Aylık Ciro Trendi" color={C.blue} badge={data.monthly.length + " ay"} subtitle="Aylık ciro değişimi ve büyüme oranları" />
                {openSections["month"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        {data.monthlyGrowth.length > 0 ? (
                            <>
                                {/* Mini bar chart */}
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginBottom: "1rem", padding: "0 0.25rem" }}>
                                    {data.monthlyGrowth.map((m, i) => (
                                        <div key={m.key} title={m.label + ": " + fmtCurrency(m.total)}
                                            style={{ flex: 1, background: "linear-gradient(to top, " + C.blue + ", " + C.blue + "60)", borderRadius: "4px 4px 0 0", height: pct(m.total, maxMonthTotal) + "%", minHeight: 4, transition: "height 0.3s", cursor: "pointer", position: "relative" }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(to top, " + C.accent + ", " + C.accent + "60)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(to top, " + C.blue + ", " + C.blue + "60)"; }}>
                                        </div>
                                    ))}
                                </div>
                                {/* Ay listesi */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                    {data.monthlyGrowth.map((m, i) => (
                                        <div key={m.key}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <span style={{ color: C.text, fontSize: "0.84rem", fontWeight: 600 }}>{m.label}</span>
                                                    {m.growth !== null && (
                                                        <span style={{ background: (m.growth >= 0 ? C.green : C.red) + "15", border: "1px solid " + (m.growth >= 0 ? C.green : C.red) + "30", borderRadius: 5, padding: "0.1rem 0.4rem", fontSize: "0.62rem", fontWeight: 700, color: m.growth >= 0 ? C.green : C.red }}>
                                                            {m.growth >= 0 ? "▲" : "▼"} {Math.abs(m.growth).toFixed(1)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                                    <span style={{ color: C.dim, fontSize: "0.7rem" }}>{m.count} belge</span>
                                                    {m.tax > 0 && <span style={{ color: C.purple, fontSize: "0.68rem" }}>KDV: {fmtCurrency(m.tax)}</span>}
                                                    <span style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700 }}>{fmtCurrency(m.total)}</span>
                                                </div>
                                            </div>
                                            <Bar value={m.total} max={maxMonthTotal} color={C.blue} height={8} />
                                            {Object.keys(m.types).length > 1 && (
                                                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.25rem" }}>
                                                    {Object.entries(m.types).map(([t, cnt]) => (
                                                        <span key={t} style={{ color: data.TC[t] || C.dim, fontSize: "0.6rem" }}>{data.TL[t] || t}: {cnt}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : <p style={{ color: C.dim, fontSize: "0.82rem" }}>Tarih bilgisi olan belge bulunamadı.</p>}
                    </div>
                )}
            </ACard>

            {/* ════════════════════════════════════════════════
                5. MÜŞTERİ ANALİZİ + PARETO
               ════════════════════════════════════════════════ */}
            <ACard>
                <SectionHead id="customer" icon={<FaBuilding />} title="Müşteri Analizi" color={C.orange} badge={"Top " + data.topCustomers.length} subtitle={"Pareto: Cironun %80'i " + data.pareto80Count + " müşteriden (%" + data.paretoRatio.toFixed(0) + ")"} />
                {openSections["customer"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        {/* Pareto uyarısı */}
                        {data.paretoRatio < 30 && data.allCustomers.length > 3 && (
                            <div style={{ background: C.yellow + "10", border: "1px solid " + C.yellow + "25", borderRadius: 10, padding: "0.65rem 0.85rem", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FaExclamationTriangle style={{ color: C.yellow, flexShrink: 0, fontSize: "0.85rem" }} />
                                <span style={{ color: C.yellow, fontSize: "0.75rem" }}>
                                    <strong>Yoğunlaşma Riski:</strong> Cironuzun %80'i sadece {data.pareto80Count} müşteriden geliyor. Müşteri çeşitliliğini artırmanız önerilir.
                                </span>
                            </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                            {data.topCustomers.map((cust, i) => (
                                <div key={cust.name + i}
                                    style={{ background: i < 3 ? C.orange + "06" : "transparent", border: "1px solid " + (i < 3 ? C.orange + "20" : C.glassBr), borderRadius: 12, padding: "0.75rem 0.95rem", transition: "border-color 0.2s, background 0.2s" }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.orange + "40"; e.currentTarget.style.background = C.orange + "08"; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = i < 3 ? C.orange + "20" : C.glassBr; e.currentTarget.style.background = i < 3 ? C.orange + "06" : "transparent"; }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ color: i < 3 ? C.orange : C.dim, fontSize: "0.75rem", fontWeight: 800, minWidth: 24, textAlign: "center" }}>
                                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1)}
                                            </span>
                                            <div>
                                                <p style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>{cust.name}</p>
                                                {cust.vkn && <p style={{ color: C.dim, fontSize: "0.62rem", margin: 0, fontFamily: "monospace" }}>{cust.vkn}</p>}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <p style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>{fmtCurrency(cust.total)}</p>
                                            <p style={{ color: C.dim, fontSize: "0.62rem", margin: 0 }}>{cust.count} belge • KDV: {fmtCurrency(cust.tax)} • %{(data.totalAmount > 0 ? (cust.total / data.totalAmount * 100) : 0).toFixed(1)} pay</p>
                                        </div>
                                    </div>
                                    <Bar value={cust.total} max={maxCustTotal} color={i < 3 ? C.orange : C.dim} height={5} />
                                    <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.3rem", flexWrap: "wrap", alignItems: "center" }}>
                                        {Object.entries(cust.types).map(([t, cnt]) => (
                                            <span key={t} style={{ background: (data.TC[t] || C.dim) + "10", border: "1px solid " + (data.TC[t] || C.dim) + "20", borderRadius: 5, padding: "0.1rem 0.35rem", fontSize: "0.6rem", color: data.TC[t] || C.dim }}>
                                                {data.TL[t] || t}: {cnt}
                                            </span>
                                        ))}
                                        {/* İlk 3 fatura chip */}
                                        {cust.items.slice(0, 3).map(inv => <InvoiceChip key={inv.id} inv={inv} color={C.orange} />)}
                                        {cust.items.length > 3 && <span style={{ color: C.dim, fontSize: "0.6rem" }}>+{cust.items.length - 3}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ACard>

            {/* ════════════════════════════════════════════════
                6. HAFTANIN GÜNÜ ANALİZİ
               ════════════════════════════════════════════════ */}
            <ACard>
                <SectionHead id="dayofweek" icon={<FaCalendarAlt />} title="Haftanın Günü Analizi" color={C.pink} badge={"En yoğun: " + data.busiestDay.name} subtitle="Hangi günlerde daha fazla fatura kesiliyor?" />
                {openSections["dayofweek"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 100, marginBottom: "0.5rem" }}>
                            {data.dayData.map((d, i) => {
                                const isBusiest = d.name === data.busiestDay.name;
                                return (
                                    <div key={d.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                                        <span style={{ color: isBusiest ? C.pink : C.dim, fontSize: "0.6rem", fontWeight: 700 }}>{d.count}</span>
                                        <div style={{ width: "100%", background: isBusiest ? "linear-gradient(to top, " + C.pink + ", " + C.pink + "60)" : "linear-gradient(to top, " + C.glass + ", " + C.glassBr + ")", borderRadius: "4px 4px 0 0", height: pct(d.count, maxDayCount) + "%", minHeight: 4, transition: "height 0.3s" }} />
                                        <span style={{ color: isBusiest ? C.pink : C.muted, fontSize: "0.62rem", fontWeight: isBusiest ? 700 : 500 }}>{d.name.slice(0, 3)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.5rem", marginTop: "0.75rem" }}>
                            {data.dayData.filter(d => d.count > 0).map(d => (
                                <div key={d.name} style={{ background: C.glass, borderRadius: 8, padding: "0.5rem 0.65rem", textAlign: "center" }}>
                                    <p style={{ color: C.muted, fontSize: "0.68rem", margin: 0, fontWeight: 600 }}>{d.name}</p>
                                    <p style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 700, margin: "0.1rem 0 0" }}>{fmtCurrency(d.total)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ACard>

            {/* ════════════════════════════════════════════════
                7. TUTAR DAĞILIM ARALIKLARI
               ════════════════════════════════════════════════ */}
            <ACard>
                <SectionHead id="ranges" icon={<FaChartBar />} title="Tutar Dağılım Analizi" color={C.blue} badge={invoices.length + " belge"} subtitle="Fatura tutarlarının aralıklara göre dağılımı" />
                {openSections["ranges"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                            {data.ranges.filter(r => r.count > 0).map(r => (
                                <div key={r.label}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                                            <span style={{ color: C.text, fontSize: "0.82rem", fontWeight: 600 }}>{r.label}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                            <span style={{ color: C.dim, fontSize: "0.7rem" }}>{r.count} belge (%{(r.count / invoices.length * 100).toFixed(1)})</span>
                                            <span style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>{fmtCurrency(r.total)}</span>
                                        </div>
                                    </div>
                                    <Bar value={r.count} max={maxRangeCount} color={r.color} height={7} />
                                </div>
                            ))}
                        </div>
                        {/* Standart sapma bilgisi */}
                        <div style={{ marginTop: "1rem", background: C.glass, borderRadius: 10, padding: "0.75rem 0.85rem", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                            <div>
                                <span style={{ color: C.dim, fontSize: "0.65rem", fontWeight: 600 }}>Standart Sapma</span>
                                <p style={{ color: C.accent, fontSize: "0.88rem", fontWeight: 700, margin: "0.1rem 0 0" }}>{fmtCurrency(data.stdDev)}</p>
                            </div>
                            <div>
                                <span style={{ color: C.dim, fontSize: "0.65rem", fontWeight: 600 }}>Değişkenlik Katsayısı</span>
                                <p style={{ color: C.accent, fontSize: "0.88rem", fontWeight: 700, margin: "0.1rem 0 0" }}>%{data.avgAmount > 0 ? ((data.stdDev / data.avgAmount) * 100).toFixed(1) : "0"}</p>
                            </div>
                            <div>
                                <span style={{ color: C.dim, fontSize: "0.65rem", fontWeight: 600 }}>Aralık (Max - Min)</span>
                                <p style={{ color: C.accent, fontSize: "0.88rem", fontWeight: 700, margin: "0.1rem 0 0" }}>{fmtCurrency(data.maxAmount - data.minAmount)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </ACard>

            {/* ════════════════════════════════════════════════
                8. EN YÜKSEK & EN DÜŞÜK FATURALAR
               ════════════════════════════════════════════════ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                {/* En Yüksek 5 */}
                <ACard style={{ marginBottom: 0 }}>
                    <SectionHead id="top5" icon={<FaChevronUp />} title="En Yüksek 5 Fatura" color={C.green} />
                    {openSections["top5"] && (
                        <div style={{ padding: "0.85rem 1.15rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {data.top5.map((inv, i) => (
                                <div key={inv.id} onClick={() => onInvoiceClick(inv)}
                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.65rem", background: C.glass, borderRadius: 8, cursor: "pointer", transition: "background 0.15s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = C.green + "10"}
                                    onMouseLeave={e => e.currentTarget.style.background = C.glass}>
                                    <span style={{ color: C.green, fontSize: "0.72rem", fontWeight: 800, minWidth: 20 }}>#{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customer || inv.number || "—"}</p>
                                        <p style={{ color: C.dim, fontSize: "0.62rem", margin: 0, fontFamily: "monospace" }}>{inv.number || inv.id}</p>
                                    </div>
                                    <span style={{ color: C.green, fontSize: "0.85rem", fontWeight: 700, flexShrink: 0 }}>{fmtCurrency(inv.total)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </ACard>

                {/* En Düşük 5 */}
                <ACard style={{ marginBottom: 0 }}>
                    <SectionHead id="bottom5" icon={<FaChevronDown />} title="En Düşük 5 Fatura" color={C.yellow} />
                    {openSections["bottom5"] && (
                        <div style={{ padding: "0.85rem 1.15rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {data.bottom5.map((inv, i) => (
                                <div key={inv.id} onClick={() => onInvoiceClick(inv)}
                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.65rem", background: C.glass, borderRadius: 8, cursor: "pointer", transition: "background 0.15s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = C.yellow + "10"}
                                    onMouseLeave={e => e.currentTarget.style.background = C.glass}>
                                    <span style={{ color: C.yellow, fontSize: "0.72rem", fontWeight: 800, minWidth: 20 }}>#{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customer || inv.number || "—"}</p>
                                        <p style={{ color: C.dim, fontSize: "0.62rem", margin: 0, fontFamily: "monospace" }}>{inv.number || inv.id}</p>
                                    </div>
                                    <span style={{ color: C.yellow, fontSize: "0.85rem", fontWeight: 700, flexShrink: 0 }}>{fmtCurrency(inv.total)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </ACard>
            </div>

            {/* ════════════════════════════════════════════════
                9. PARA BİRİMİ DAĞILIMI (birden fazla varsa)
               ════════════════════════════════════════════════ */}
            {Object.keys(data.byCurrency).length > 1 && (
                <ACard>
                    <SectionHead id="currency" icon={<FaCoins />} title="Para Birimi Dağılımı" color={C.purple} badge={Object.keys(data.byCurrency).length + " birim"} />
                    {openSections["currency"] && (
                        <div style={{ padding: "1.15rem 1.25rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.75rem" }}>
                                {Object.entries(data.byCurrency).map(([cur, d]) => (
                                    <div key={cur} style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 12, padding: "1rem", textAlign: "center", transition: "border-color 0.2s" }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = C.purple + "40"}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = C.glassBr}>
                                        <p style={{ color: C.purple, fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.2rem" }}>{cur}</p>
                                        <p style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>{d.count} belge</p>
                                        <p style={{ color: C.muted, fontSize: "0.78rem", margin: "0.15rem 0 0" }}>{fmtCurrency(d.total)}</p>
                                        <p style={{ color: C.dim, fontSize: "0.65rem", margin: "0.1rem 0 0" }}>%{(d.count / invoices.length * 100).toFixed(1)} oran</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ACard>
            )}

            {/* ════════════════════════════════════════════════
                10. SAĞLAYICI DAĞILIMI (birden fazla varsa)
               ════════════════════════════════════════════════ */}
            {Object.keys(data.byProvider).length > 1 && (
                <ACard>
                    <SectionHead id="provider" icon={<FaLink />} title="Sağlayıcı Bazlı Dağılım" color={C.accent} badge={Object.keys(data.byProvider).length + " sağlayıcı"} />
                    {openSections["provider"] && (
                        <div style={{ padding: "1.15rem 1.25rem" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
                                {Object.entries(data.byProvider).map(([pid, d]) => {
                                    const prov = PROVIDERS.find(p => p.id === pid);
                                    return (
                                        <div key={pid} style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 12, padding: "0.9rem", display: "flex", alignItems: "center", gap: "0.7rem", transition: "border-color 0.2s" }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + "40"}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = C.glassBr}>
                                            <span style={{ fontSize: "1.5rem" }}>{prov ? prov.logo : "📄"}</span>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>{prov ? prov.name : pid}</p>
                                                <p style={{ color: C.dim, fontSize: "0.7rem", margin: "0.1rem 0 0" }}>{d.count} belge • {fmtCurrency(d.total)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </ACard>
            )}

            {/* ════════════════════════════════════════════════
                11. KDV / VERGİ ANALİZİ
               ════════════════════════════════════════════════ */}
            <ACard>
                <SectionHead id="tax" icon={<FaPercentage />} title="KDV & Vergi Analizi" color={C.purple} subtitle="Vergi yükü ve KDV oranı detayları" />
                {openSections["tax"] && (
                    <div style={{ padding: "1.15rem 1.25rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
                            {[
                                { label: "Toplam KDV", value: fmtCurrency(data.totalTax), color: C.purple },
                                { label: "Net Tutar (KDV Hariç)", value: fmtCurrency(data.netAmount), color: C.green },
                                { label: "Efektif KDV Oranı", value: "%" + data.taxRate.toFixed(2), color: C.orange },
                                { label: "KDV / Brüt Oran", value: "%" + (data.totalAmount > 0 ? (data.totalTax / data.totalAmount * 100).toFixed(2) : "0"), color: C.pink },
                            ].map(item => (
                                <div key={item.label} style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.85rem", textAlign: "center" }}>
                                    <p style={{ color: C.dim, fontSize: "0.68rem", fontWeight: 600, margin: "0 0 0.2rem" }}>{item.label}</p>
                                    <p style={{ color: item.color, fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>{item.value}</p>
                                </div>
                            ))}
                        </div>
                        {/* Tip bazlı KDV */}
                        <p style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Belge Tipine Göre KDV Dağılımı</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                            {Object.entries(data.byType).filter(([, d]) => d.tax > 0).map(([type, d]) => (
                                <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                    <div style={{ width: 8, height: 8, borderRadius: 2, background: data.TC[type] || C.dim, flexShrink: 0 }} />
                                    <span style={{ color: C.text, fontSize: "0.78rem", fontWeight: 500, minWidth: 100 }}>{data.TL[type] || type}</span>
                                    <div style={{ flex: 1 }}><Bar value={d.tax} max={data.totalTax} color={data.TC[type] || C.dim} height={5} /></div>
                                    <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 700, minWidth: 90, textAlign: "right" }}>{fmtCurrency(d.tax)}</span>
                                    <span style={{ color: C.dim, fontSize: "0.65rem", minWidth: 40, textAlign: "right" }}>%{(data.totalTax > 0 ? (d.tax / data.totalTax * 100) : 0).toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ACard>
        </div>
    );
});

/* ═══════════════════════════════════════════════════════════
   ANA BİLEŞEN
   ═══════════════════════════════════════════════════════════ */
const BillingPage = () => {
    // ── Sekmeler ──
    const [activeTab, setActiveTab] = useState("overview");
    // ── Sağlayıcı bağlantı ──
    const [connectedProviders, setConnectedProviders] = useState([]);
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [providerForm, setProviderForm] = useState({});
    const [selectedEnv, setSelectedEnv] = useState("test");
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState("");
    // ── Gerçek fatura verileri (API'den gelecek) ──
    const [invoices, setInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState(null);
    const [fetchError, setFetchError] = useState("");
    // ── Fatura listesi filtreleri ──
    const [filterType, setFilterType] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    // ── Fatura oluşturma ──
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState("e-arsiv");
    // ── Belge detay modalı ──
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    // ── Belge detay ham veri açılır/kapanır ──
    const [rawDataOpen, setRawDataOpen] = useState(false);
    // ── Fetch guard (sonsuz döngü önleme) ──
    const hasFetchedRef = useRef(false);

    const isConnected = connectedProviders.length > 0;

    const tabs = [
        { id: "overview", label: "Genel Bakış", icon: <FaFileInvoiceDollar /> },
        { id: "analysis", label: "Gelişmiş Analiz", icon: <FaChartBar /> },
        { id: "invoices", label: "Faturalar", icon: <FaFileInvoice /> },
        { id: "e-archive", label: "e-Arşiv", icon: <FaClipboardList /> },
        { id: "e-invoice", label: "e-Fatura", icon: <FaFileInvoiceDollar /> },
        { id: "e-despatch", label: "e-İrsaliye", icon: <FaTruck /> },
        { id: "providers", label: "Sağlayıcılar", icon: <FaLink /> },
    ];

    /* ═══════════════════════════════════════════════════════
       GERÇEK VERİ HESAPLAMALARI
       ═══════════════════════════════════════════════════════ */
    const stats = useMemo(() => {
        const eArchive = invoices.filter(i => i.type === "e-arsiv");
        const eInvoice = invoices.filter(i => i.type === "e-fatura" || i.type === "e-fatura-gelen");
        const eDespatch = invoices.filter(i => i.type === "e-irsaliye");
        const pending = invoices.filter(i => i.status === "pending" || i.status === "waiting" || i.status === "queued");
        const totalAmount = invoices.reduce((s, i) => s + (i.total || 0), 0);

        return {
            totalInvoices: invoices.length,
            totalAmount,
            pendingCount: pending.length,
            eArchiveCount: eArchive.length,
            eInvoiceCount: eInvoice.length,
            eDespatchCount: eDespatch.length,
        };
    }, [invoices]);

    // ── Filtrelenmiş faturalar ──
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            if (filterType !== "all" && inv.type !== filterType) return false;
            if (filterStatus !== "all" && inv.status !== filterStatus) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    (inv.number || "").toLowerCase().includes(q) ||
                    (inv.customer || "").toLowerCase().includes(q) ||
                    (inv.vkn || "").includes(q)
                );
            }
            return true;
        });
    }, [invoices, filterType, filterStatus, searchQuery]);

    // ── Tab'a göre filtreleme ──
    const tabInvoices = useMemo(() => {
        switch (activeTab) {
            case "e-archive": return invoices.filter(i => i.type === "e-arsiv");
            case "e-invoice": return invoices.filter(i => i.type === "e-fatura" || i.type === "e-fatura-gelen");
            case "e-despatch": return invoices.filter(i => i.type === "e-irsaliye");
            default: return filteredInvoices;
        }
    }, [activeTab, invoices, filteredInvoices]);

    /* ═══════════════════════════════════════════════════════
       SAĞLAYICI BAĞLANTI — GERÇEK API
       ═══════════════════════════════════════════════════════ */
    const handleConnect = useCallback(async () => {
        if (!selectedProvider) return;
        setConnecting(true);
        setConnectionError("");

        // Zorunlu alan kontrolü
        const missing = (selectedProvider.fields || []).filter(f => f.required && !providerForm[f.key]);
        if (missing.length > 0) {
            setConnectionError("Lütfen tüm zorunlu alanları doldurun: " + missing.map(f => f.label).join(", "));
            setConnecting(false);
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const authType = selectedProvider.authType || "trendyol";
            let newProvider = null;

            // ═══ TRENDYOL E-FATURAM ═══
            if (authType === "trendyol") {
                // 1. Partner Login
                const partnerRes = await fetch(API_URL + "/api/e-invoice/trendyol/partner-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({
                        username: providerForm.username,
                        password: providerForm.password,
                        env: selectedEnv
                    })
                });
                const partnerData = await partnerRes.json();

                if (!partnerData.success) {
                    setConnectionError("Partner giriş başarısız: " + (partnerData.message || "Bilinmeyen hata"));
                    setConnecting(false);
                    return;
                }

                const partnerToken = partnerData.data && partnerData.data.accessToken;

                // 2. Customer Login
                const customerRes = await fetch(API_URL + "/api/e-invoice/trendyol/customer-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({
                        partnerToken: partnerToken,
                        customerUsername: providerForm.customerUsername,
                        customerPassword: providerForm.customerPassword,
                        env: selectedEnv
                    })
                });
                const customerData = await customerRes.json();

                if (!customerData.success) {
                    setConnectionError("Müşteri giriş başarısız: " + (customerData.message || "Bilinmeyen hata"));
                    setConnecting(false);
                    return;
                }

                newProvider = {
                    ...selectedProvider,
                    env: selectedEnv,
                    connectedAt: new Date().toISOString(),
                    partnerToken: partnerToken,
                    customerToken: customerData.data && customerData.data.accessToken,
                    companyId: customerData.data && customerData.data.companyId,
                    userId: customerData.data && customerData.data.userId,
                    apiToken: customerData.data && customerData.data.accessToken,
                };
            }

            // ═══ QNB eSolutions ═══
            else if (authType === "qnb") {
                const loginRes = await fetch(API_URL + "/api/e-invoice/qnb/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({
                        username: providerForm.username,
                        password: providerForm.password,
                        env: selectedEnv
                    })
                });
                const loginData = await loginRes.json();

                if (!loginData.success) {
                    setConnectionError("QNB giriş başarısız: " + (loginData.message || "Bilinmeyen hata"));
                    setConnecting(false);
                    return;
                }

                newProvider = {
                    ...selectedProvider,
                    env: selectedEnv,
                    connectedAt: new Date().toISOString(),
                    apiToken: loginData.data && (loginData.data.accessToken || loginData.data.sessionId),
                    sessionId: loginData.data && loginData.data.sessionId,
                };
            }

            // ═══ SOVOS (Foriba) ═══
            else if (authType === "sovos") {
                const tokenRes = await fetch(API_URL + "/api/e-invoice/sovos/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({
                        apiKey: providerForm.apiKey,
                        apiSecret: providerForm.apiSecret,
                        env: selectedEnv
                    })
                });
                const tokenData = await tokenRes.json();

                if (!tokenData.success) {
                    setConnectionError("Sovos OAuth başarısız: " + (tokenData.message || "Bilinmeyen hata"));
                    setConnecting(false);
                    return;
                }

                newProvider = {
                    ...selectedProvider,
                    env: selectedEnv,
                    connectedAt: new Date().toISOString(),
                    apiToken: tokenData.data && tokenData.data.accessToken,
                    expiresIn: tokenData.data && tokenData.data.expiresIn,
                    apiKey: providerForm.apiKey,
                    apiSecret: providerForm.apiSecret,
                };
            }

            // ═══ PARAŞÜT ═══
            else if (authType === "parasut") {
                const tokenRes = await fetch(API_URL + "/api/e-invoice/parasut/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({
                        clientId: providerForm.clientId,
                        clientSecret: providerForm.clientSecret,
                        email: providerForm.email,
                        password: providerForm.password,
                    })
                });
                const tokenData = await tokenRes.json();

                if (!tokenData.success) {
                    setConnectionError("Paraşüt OAuth başarısız: " + (tokenData.message || "Bilinmeyen hata"));
                    setConnecting(false);
                    return;
                }

                const parasutData = tokenData.data || {};
                const companies = parasutData.companies || [];

                newProvider = {
                    ...selectedProvider,
                    env: selectedEnv,
                    connectedAt: new Date().toISOString(),
                    apiToken: parasutData.accessToken,
                    refreshToken: parasutData.refreshToken,
                    expiresIn: parasutData.expiresIn,
                    companyId: companies.length > 0 ? companies[0].id : null,
                    companies: companies,
                    userId: parasutData.userId,
                    clientId: providerForm.clientId,
                    clientSecret: providerForm.clientSecret,
                };
            }

            // ═══ ÖDEAL (E-FaturaPos) ═══
            else if (authType === "odeal") {
                const validateRes = await fetch(API_URL + "/api/e-invoice/odeal/validate-key", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify({
                        serviceKey: providerForm.serviceKey,
                        merchantKey: providerForm.merchantKey || null,
                        env: selectedEnv
                    })
                });
                const validateData = await validateRes.json();

                if (!validateData.success) {
                    setConnectionError("Ödeal doğrulama başarısız: " + (validateData.message || "Bilinmeyen hata"));
                    setConnecting(false);
                    return;
                }

                const odealData = validateData.data || {};

                newProvider = {
                    ...selectedProvider,
                    env: selectedEnv,
                    connectedAt: new Date().toISOString(),
                    apiToken: providerForm.serviceKey,
                    serviceKey: providerForm.serviceKey,
                    merchantKey: providerForm.merchantKey || null,
                    units: odealData.units || null,
                };
            }

            if (!newProvider) {
                setConnectionError("Bilinmeyen sağlayıcı tipi");
                setConnecting(false);
                return;
            }

            setConnectedProviders(prev => [...prev, newProvider]);
            setShowProviderModal(false);
            setProviderForm({});
            setSelectedProvider(null);
            setConnectionError("");

        } catch (err) {
            setConnectionError("Bağlantı hatası: " + (err.message || "Sunucuya erişilemiyor"));
        } finally {
            setConnecting(false);
        }
    }, [selectedProvider, providerForm, selectedEnv]);

    const handleDisconnect = (providerId) => {
        if (window.confirm("Bu sağlayıcı bağlantısını kaldırmak istediğinize emin misiniz?")) {
            setConnectedProviders(prev => prev.filter(p => p.id !== providerId));
            setInvoices([]);
            setLastFetchTime(null);
            setFetchError("");
        }
    };

    /* ═══════════════════════════════════════════════════════
       BELGELERİ API'DEN ÇEK (Çoklu sağlayıcı desteği)
       ═══════════════════════════════════════════════════════ */
    // connectedProviders ref ile takip — useCallback bağımlılık döngüsünü kırar
    const connectedProvidersRef = useRef(connectedProviders);
    connectedProvidersRef.current = connectedProviders;

    const isFetchingRef = useRef(false);

    const fetchAllDocuments = useCallback(async () => {
        const providers = connectedProvidersRef.current;
        if (!providers || providers.length === 0) return;
        if (isFetchingRef.current) return; // Zaten çekiliyor, tekrar çekme

        const provider = providers[0];
        const apiToken = provider.apiToken || provider.customerToken || provider.partnerToken;
        if (!apiToken) {
            setFetchError("Geçerli bir oturum token'ı bulunamadı. Lütfen sağlayıcıyı yeniden bağlayın.");
            return;
        }

        isFetchingRef.current = true;
        setInvoicesLoading(true);
        setFetchError("");

        const token = localStorage.getItem("token");
        const searchEndpoint = provider.searchEndpoint || "/api/e-invoice/documents/search";

        const docTypes = [
            { apiType: "earchive", localType: "e-arsiv" },
            { apiType: "outgoing-einvoice", localType: "e-fatura" },
            { apiType: "incoming-einvoice", localType: "e-fatura-gelen" },
            { apiType: "despatch-advice", localType: "e-irsaliye" },
        ];

        let allDocs = [];
        let hasError = false;

        for (const dt of docTypes) {
            try {
                const bodyData = {
                    token: apiToken,
                    documentType: dt.apiType,
                    searchParams: {},
                    env: provider.env
                };
                if (provider.authType === "parasut" && provider.companyId) {
                    bodyData.companyId = provider.companyId;
                }

                const res = await fetch(API_URL + searchEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                    body: JSON.stringify(bodyData)
                });
                const data = await res.json();

                if (data.success && data.data) {
                    const docs = Array.isArray(data.data) ? data.data : (data.data.content || data.data.documents || data.data.items || []);
                    const normalized = docs.map((doc, idx) => ({
                        id: doc.id || doc.uuid || doc.documentId || doc.referenceId || (dt.apiType + "-" + idx),
                        type: dt.localType,
                        number: doc.invoiceNumber || doc.documentNumber || doc.number || doc.invoiceNo || "",
                        date: doc.invoiceDate || doc.documentDate || doc.date || doc.createDate || "",
                        customer: doc.receiverName || doc.customerName || doc.title || doc.receiverTitle || "",
                        vkn: doc.receiverTaxNumber || doc.receiverIdentifier || doc.vkn || doc.taxNumber || "",
                        amount: Number(doc.amount || doc.totalAmount || 0),
                        tax: Number(doc.taxAmount || doc.totalTax || doc.vatAmount || 0),
                        total: Number(doc.payableAmount || doc.totalPayable || doc.total || doc.grandTotal || 0),
                        status: (doc.status || doc.documentStatus || doc.state || "").toLowerCase(),
                        currency: doc.currency || doc.currencyCode || "TRY",
                        provider: provider.id,
                        raw: doc,
                    }));
                    allDocs = [...allDocs, ...normalized];
                }
            } catch (err) {
                console.error("[BillingPage] " + dt.apiType + " çekme hatası:", err);
                hasError = true;
            }
        }

        setInvoices(allDocs);
        setLastFetchTime(new Date());
        if (hasError && allDocs.length === 0) {
            setFetchError("Belgeler çekilirken hata oluştu. Sağlayıcı bağlantınızı kontrol edin.");
        }
        setInvoicesLoading(false);
        isFetchingRef.current = false;
    }, []); // BOŞ bağımlılık — ref üzerinden okur, asla yeniden oluşmaz

    // ── Sağlayıcı bağlandığında otomatik belge çek (tek seferlik) ──
    useEffect(() => {
        if (isConnected && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            fetchAllDocuments();
        }
        if (!isConnected) {
            hasFetchedRef.current = false;
        }
    }, [isConnected, fetchAllDocuments]);

    /* ═══════════════════════════════════════════════════════
       RENDER: BAĞLANTI YOK DURUMU
       ═══════════════════════════════════════════════════════ */
    const renderNoConnection = () => (
        <EmptyState
            icon="🔗"
            title="E-Fatura Sağlayıcısı Bağlı Değil"
            description="Faturalandırma özelliklerini kullanabilmek için önce bir e-Fatura sağlayıcısı bağlamanız gerekiyor. Sağlayıcılar sekmesinden bağlantı kurabilirsiniz."
            action={
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTab("providers")}
                    style={{
                        background: "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                        border: "none", borderRadius: 10, padding: "0.7rem 1.5rem",
                        color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    }}>
                    <FaLink /> Sağlayıcı Bağla
                </motion.button>
            }
        />
    );

    /* ═══════════════════════════════════════════════════════
       RENDER: YÜKLEME DURUMU
       ═══════════════════════════════════════════════════════ */
    const renderLoading = () => (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
            <FaSpinner style={{ fontSize: "2rem", color: C.accent, animation: "spin 1s linear infinite", marginBottom: "0.75rem" }} />
            <p style={{ color: C.muted, fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Belgeler yükleniyor...</p>
            <p style={{ color: C.dim, fontSize: "0.8rem", margin: 0 }}>Sağlayıcınızdan veriler çekiliyor, lütfen bekleyin.</p>
        </div>
    );

    /* ═══════════════════════════════════════════════════════
       RENDER: GENEL BAKIŞ
       ═══════════════════════════════════════════════════════ */
    const renderOverview = () => {
        if (!isConnected) return renderNoConnection();
        if (invoicesLoading && invoices.length === 0) return renderLoading();

        return (
            <div>
                {/* Hata mesajı */}
                {fetchError && (
                    <div style={{ background: C.red + "10", border: "1px solid " + C.red + "30", borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <FaExclamationTriangle style={{ color: C.red, flexShrink: 0 }} />
                        <span style={{ color: C.red, fontSize: "0.82rem", flex: 1 }}>{fetchError}</span>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={fetchAllDocuments}
                            style={{ background: C.red + "20", border: "1px solid " + C.red + "40", borderRadius: 8, padding: "0.3rem 0.7rem", cursor: "pointer", color: C.red, fontSize: "0.75rem", fontWeight: 600, flexShrink: 0 }}>
                            Tekrar Dene
                        </motion.button>
                    </div>
                )}

                {/* KPI Kartları */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                    {[
                        { icon: <FaFileInvoice />, label: "Toplam Belge", value: stats.totalInvoices, sub: stats.totalInvoices === 0 ? "Henüz belge yok" : stats.totalInvoices + " adet belge", color: C.accent },
                        { icon: <FaMoneyBillWave />, label: "Toplam Tutar", value: fmtCurrency(stats.totalAmount), sub: "KDV dahil toplam", color: C.green },
                        { icon: <FaClock />, label: "Bekleyen", value: stats.pendingCount, sub: stats.pendingCount === 0 ? "Bekleyen belge yok" : "Onay bekliyor", color: C.yellow },
                        { icon: <FaClipboardList />, label: "e-Arşiv", value: stats.eArchiveCount, sub: stats.eArchiveCount === 0 ? "Henüz e-Arşiv yok" : stats.eArchiveCount + " belge", color: C.blue },
                        { icon: <FaFileInvoiceDollar />, label: "e-Fatura", value: stats.eInvoiceCount, sub: stats.eInvoiceCount === 0 ? "Henüz e-Fatura yok" : stats.eInvoiceCount + " belge", color: C.orange },
                        { icon: <FaTruck />, label: "e-İrsaliye", value: stats.eDespatchCount, sub: stats.eDespatchCount === 0 ? "Henüz e-İrsaliye yok" : stats.eDespatchCount + " belge", color: C.pink },
                    ].map((kpi, i) => (
                        <motion.div key={kpi.label}
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            whileHover={{ y: -3, boxShadow: "0 12px 32px " + kpi.color + "25" }}
                            style={{
                                background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.9) 100%)",
                                border: "1px solid " + kpi.color + "30",
                                borderRadius: 14, padding: "1.25rem", position: "relative", overflow: "hidden",
                            }}
                        >
                            <div style={{ position: "absolute", top: 0, right: 0, width: 100, height: 100, background: "radial-gradient(circle, " + kpi.color + "12 0%, transparent 70%)", pointerEvents: "none" }} />
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
                                <div style={{ background: kpi.color + "20", padding: "0.5rem", borderRadius: 10, fontSize: "1.1rem", display: "flex", color: kpi.color }}>{kpi.icon}</div>
                                <span style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600 }}>{kpi.label}</span>
                            </div>
                            <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", margin: 0 }}>{kpi.value}</h3>
                            <p style={{ color: C.dim, fontSize: "0.72rem", margin: "0.25rem 0 0", fontWeight: 500 }}>{kpi.sub}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Bağlı Sağlayıcılar + Son Belgeler */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
                    {/* Bağlı Sağlayıcılar */}
                    <GlassCard>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FaLink style={{ color: C.accent }} /> Sağlayıcılar
                            </h3>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveTab("providers")}
                                style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.accent, fontSize: "0.7rem", fontWeight: 600 }}>
                                Yönet →
                            </motion.button>
                        </div>
                        {connectedProviders.map(p => (
                            <div key={p.id} style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.75rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                <span style={{ fontSize: "1.5rem" }}>{p.logo}</span>
                                <div style={{ flex: 1 }}>
                                    <p style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>{p.name}</p>
                                    <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>{p.env === "production" ? "🟢 Canlı" : "🟡 Test"} ortam</p>
                                </div>
                                <Pill color={C.green}><FaCheckCircle /> Bağlı</Pill>
                            </div>
                        ))}

                        {/* Yenile butonu */}
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={fetchAllDocuments}
                            disabled={invoicesLoading}
                            style={{
                                width: "100%", marginTop: "0.75rem",
                                background: invoicesLoading ? C.accent + "30" : C.accent + "15",
                                border: "1px solid " + C.accent + "30", borderRadius: 8,
                                padding: "0.5rem", cursor: invoicesLoading ? "not-allowed" : "pointer",
                                color: C.accent, fontSize: "0.78rem", fontWeight: 600,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                            }}>
                            {invoicesLoading ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Yükleniyor...</> : <><FaSyncAlt /> Belgeleri Yenile</>}
                        </motion.button>

                        {lastFetchTime && (
                            <p style={{ color: C.dim, fontSize: "0.65rem", textAlign: "center", margin: "0.4rem 0 0" }}>
                                Son güncelleme: {lastFetchTime.toLocaleTimeString("tr-TR")}
                            </p>
                        )}
                    </GlassCard>

                    {/* Son Belgeler */}
                    <GlassCard>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FaFileInvoice style={{ color: C.accent }} /> Son Belgeler
                            </h3>
                            {invoices.length > 0 && (
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={() => setActiveTab("invoices")}
                                    style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", color: C.accent, fontSize: "0.7rem", fontWeight: 600 }}>
                                    Tümünü Gör →
                                </motion.button>
                            )}
                        </div>
                        {invoicesLoading && invoices.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                                <FaSpinner style={{ fontSize: "1.5rem", color: C.accent, animation: "spin 1s linear infinite", marginBottom: "0.5rem" }} />
                                <p style={{ color: C.muted, fontSize: "0.82rem", margin: 0 }}>Belgeler yükleniyor...</p>
                            </div>
                        ) : invoices.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                {invoices.slice(0, 6).map((inv, i) => (
                                    <motion.div key={inv.id}
                                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.04 }}
                                        whileHover={{ backgroundColor: "rgba(78,205,196,0.06)" }}
                                        onClick={() => { setSelectedInvoice(inv); setShowDetailModal(true); }}
                                        style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.7rem 0.85rem", display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                                                <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace" }}>{inv.number || "—"}</span>
                                                <TypeBadge type={inv.type} />
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <span style={{ color: C.muted, fontSize: "0.72rem" }}>{inv.customer || "—"}</span>
                                                <span style={{ color: C.dim, fontSize: "0.65rem" }}>{fmtDate(inv.date)}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                            <p style={{ color: C.green, fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>{inv.total > 0 ? fmtCurrency(inv.total) : "—"}</p>
                                            <StatusBadge status={inv.status} />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon="📭"
                                title="Henüz belge yok"
                                description="Sağlayıcınızda kayıtlı belge bulunamadı. Yeni belge oluşturmak için 'Yeni Belge' butonunu kullanabilirsiniz."
                            />
                        )}
                    </GlassCard>
                </div>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════
       RENDER: FATURA LİSTESİ
       ═══════════════════════════════════════════════════════ */
    const renderInvoiceList = (listInvoices, title, showFilters) => {
        if (!isConnected) return renderNoConnection();
        if (invoicesLoading && invoices.length === 0) return renderLoading();

        return (
            <div>
                {/* Filtreler */}
                {showFilters !== false && (
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ flex: "1 1 250px", position: "relative" }}>
                            <FaSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.dim, fontSize: "0.8rem" }} />
                            <input
                                type="text" placeholder="Fatura no, müşteri adı veya VKN ara..."
                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: "100%", background: C.glass, border: "1px solid " + C.glassBr,
                                    borderRadius: 10, padding: "0.65rem 0.75rem 0.65rem 2.2rem",
                                    color: "#fff", fontSize: "0.82rem", outline: "none",
                                }}
                            />
                        </div>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}
                            style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.65rem 0.75rem", color: "#fff", fontSize: "0.8rem", outline: "none", cursor: "pointer" }}>
                            <option value="all" style={{ background: "#1a1f35" }}>Tüm Tipler</option>
                            <option value="e-arsiv" style={{ background: "#1a1f35" }}>e-Arşiv</option>
                            <option value="e-fatura" style={{ background: "#1a1f35" }}>e-Fatura</option>
                            <option value="e-fatura-gelen" style={{ background: "#1a1f35" }}>Gelen e-Fatura</option>
                            <option value="e-irsaliye" style={{ background: "#1a1f35" }}>e-İrsaliye</option>
                        </select>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.65rem 0.75rem", color: "#fff", fontSize: "0.8rem", outline: "none", cursor: "pointer" }}>
                            <option value="all" style={{ background: "#1a1f35" }}>Tüm Durumlar</option>
                            <option value="approved" style={{ background: "#1a1f35" }}>Onaylandı</option>
                            <option value="succeed" style={{ background: "#1a1f35" }}>Başarılı</option>
                            <option value="sent" style={{ background: "#1a1f35" }}>Gönderildi</option>
                            <option value="pending" style={{ background: "#1a1f35" }}>Beklemede</option>
                            <option value="cancelled" style={{ background: "#1a1f35" }}>İptal</option>
                            <option value="received" style={{ background: "#1a1f35" }}>Alındı</option>
                        </select>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={fetchAllDocuments}
                            disabled={invoicesLoading}
                            style={{
                                background: C.glass, border: "1px solid " + C.glassBr,
                                borderRadius: 10, padding: "0.65rem 0.85rem",
                                color: C.accent, fontSize: "0.82rem", fontWeight: 600, cursor: invoicesLoading ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", gap: "0.4rem",
                            }}>
                            {invoicesLoading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaSyncAlt />} Yenile
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setShowCreateModal(true)}
                            style={{
                                background: "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                                border: "none", borderRadius: 10, padding: "0.65rem 1.25rem",
                                color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: "0.4rem",
                            }}>
                            <FaPlus /> Yeni Belge
                        </motion.button>
                    </div>
                )}

                {/* Tab-specific header with refresh for sub-tabs */}
                {showFilters === false && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ color: C.muted, fontSize: "0.82rem" }}>{listInvoices.length} belge</span>
                            {lastFetchTime && <span style={{ color: C.dim, fontSize: "0.7rem" }}>• Son güncelleme: {lastFetchTime.toLocaleTimeString("tr-TR")}</span>}
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={fetchAllDocuments}
                                disabled={invoicesLoading}
                                style={{
                                    background: C.glass, border: "1px solid " + C.glassBr,
                                    borderRadius: 8, padding: "0.45rem 0.75rem",
                                    color: C.accent, fontSize: "0.78rem", fontWeight: 600, cursor: invoicesLoading ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                }}>
                                {invoicesLoading ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaSyncAlt />} Yenile
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => setShowCreateModal(true)}
                                style={{
                                    background: "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                                    border: "none", borderRadius: 8, padding: "0.45rem 1rem",
                                    color: "#fff", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: "0.3rem",
                                }}>
                                <FaPlus /> Yeni Belge
                            </motion.button>
                        </div>
                    </div>
                )}

                {listInvoices.length > 0 ? (
                    <>
                        {/* Tablo Header */}
                        <div style={{
                            display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr 0.8fr",
                            gap: "0.5rem", padding: "0.6rem 1rem", marginBottom: "0.4rem",
                            borderBottom: "2px solid " + C.accent + "20",
                        }}>
                            {["Belge No", "Tip", "Müşteri / VKN", "Tarih", "Tutar", "Durum", "İşlem"].map(h => (
                                <span key={h} style={{ color: C.muted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                            ))}
                        </div>

                        {/* Satırlar */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {listInvoices.map((inv, idx) => (
                                <motion.div key={inv.id}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                                    whileHover={{ backgroundColor: "rgba(78,205,196,0.04)" }}
                                    style={{
                                        display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1fr 1fr 0.8fr",
                                        gap: "0.5rem", alignItems: "center", padding: "0.7rem 1rem",
                                        borderRadius: 8, background: idx % 2 === 0 ? C.glass : "transparent",
                                        border: "1px solid transparent", transition: "all 0.15s",
                                    }}>
                                    <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 600, fontFamily: "monospace" }}>{inv.number || "—"}</span>
                                    <TypeBadge type={inv.type} />
                                    <div>
                                        <p style={{ color: C.text, fontSize: "0.78rem", margin: 0, fontWeight: 500 }}>{inv.customer || "—"}</p>
                                        <p style={{ color: C.dim, fontSize: "0.65rem", margin: 0, fontFamily: "monospace" }}>{inv.vkn || ""}</p>
                                    </div>
                                    <span style={{ color: C.muted, fontSize: "0.78rem" }}>{fmtDate(inv.date)}</span>
                                    <span style={{ color: C.green, fontSize: "0.82rem", fontWeight: 700 }}>{inv.total > 0 ? fmtCurrency(inv.total) : "—"}</span>
                                    <StatusBadge status={inv.status} />
                                    <div style={{ display: "flex", gap: "0.3rem" }}>
                                        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} title="Görüntüle"
                                            onClick={() => { setSelectedInvoice(inv); setShowDetailModal(true); }}
                                            style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 6, padding: "0.35rem", cursor: "pointer", color: C.accent, fontSize: "0.75rem", display: "flex" }}>
                                            <FaEye />
                                        </motion.button>
                                        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} title="İndir"
                                            style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 6, padding: "0.35rem", cursor: "pointer", color: C.blue, fontSize: "0.75rem", display: "flex" }}>
                                            <FaDownload />
                                        </motion.button>
                                        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} title="Yazdır"
                                            style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 6, padding: "0.35rem", cursor: "pointer", color: C.muted, fontSize: "0.75rem", display: "flex" }}>
                                            <FaPrint />
                                        </motion.button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Alt bilgi */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid " + C.glassBr }}>
                            <span style={{ color: C.dim, fontSize: "0.75rem" }}>{listInvoices.length} belge gösteriliyor</span>
                            <span style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 600 }}>
                                Toplam: {fmtCurrency(listInvoices.reduce((s, i) => s + (i.total || 0), 0))}
                            </span>
                        </div>
                    </>
                ) : (
                    <EmptyState
                        icon="📭"
                        title="Belge bulunamadı"
                        description={
                            invoicesLoading
                                ? "Belgeler yükleniyor..."
                                : "Bu kategoride sağlayıcınızda kayıtlı belge bulunamadı. Yeni belge oluşturmak için 'Yeni Belge' butonunu kullanabilirsiniz."
                        }
                    />
                )}
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════
       RENDER: SAĞLAYICILAR
       ═══════════════════════════════════════════════════════ */
    const renderProviders = () => (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div>
                    <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>E-Fatura Sağlayıcıları</h3>
                    <p style={{ color: C.dim, fontSize: "0.8rem", margin: "0.25rem 0 0" }}>Kullanmak istediğiniz e-Fatura sağlayıcısını seçin ve bağlayın</p>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
                {PROVIDERS.map((provider, i) => {
                    const providerConnected = connectedProviders.some(p => p.id === provider.id);
                    const connectedData = connectedProviders.find(p => p.id === provider.id);
                    return (
                        <motion.div key={provider.id}
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            whileHover={{ y: -4, boxShadow: "0 12px 40px " + provider.color + "20" }}
                            style={{
                                background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.9) 100%)",
                                border: "1px solid " + (providerConnected ? C.green + "40" : provider.color + "25"),
                                borderRadius: 16, padding: "1.5rem", position: "relative", overflow: "hidden",
                            }}
                        >
                            <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, background: "radial-gradient(circle, " + provider.color + "15 0%, transparent 70%)", pointerEvents: "none" }} />

                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                                <div style={{ fontSize: "2rem", width: 48, height: 48, borderRadius: 12, background: provider.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {provider.logo}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, margin: 0 }}>{provider.name}</h4>
                                    {providerConnected && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.2rem" }}>
                                            <Pill color={C.green}><FaCheckCircle /> Bağlı</Pill>
                                            <span style={{ color: C.dim, fontSize: "0.65rem" }}>
                                                {connectedData && connectedData.env === "production" ? "Canlı" : "Test"}
                                            </span>
                                        </div>
                                    )}
                                    {provider.comingSoon && <Pill color={C.yellow}><FaClock /> Yakında</Pill>}
                                </div>
                            </div>

                            <p style={{ color: C.muted, fontSize: "0.8rem", margin: "0 0 1rem", lineHeight: 1.5 }}>{provider.description}</p>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "1.25rem" }}>
                                {provider.features.map(f => (
                                    <span key={f} style={{
                                        background: provider.color + "10", border: "1px solid " + provider.color + "25",
                                        borderRadius: 6, padding: "0.2rem 0.5rem", color: provider.color,
                                        fontSize: "0.68rem", fontWeight: 600,
                                    }}>{f}</span>
                                ))}
                            </div>

                            {provider.comingSoon ? (
                                <div style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.6rem", textAlign: "center" }}>
                                    <span style={{ color: C.dim, fontSize: "0.8rem", fontWeight: 600 }}>🔜 Çok yakında kullanıma açılacak</span>
                                </div>
                            ) : providerConnected ? (
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        style={{ flex: 1, background: C.green + "15", border: "1px solid " + C.green + "30", borderRadius: 10, padding: "0.6rem", cursor: "pointer", color: C.green, fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                                        <FaCog /> Ayarlar
                                    </motion.button>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        onClick={() => handleDisconnect(provider.id)}
                                        style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: 10, padding: "0.6rem 1rem", cursor: "pointer", color: C.red, fontSize: "0.8rem", fontWeight: 600 }}>
                                        <FaTimes />
                                    </motion.button>
                                </div>
                            ) : (
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => { setSelectedProvider(provider); setShowProviderModal(true); setConnectionError(""); setProviderForm({}); setSelectedEnv("test"); }}
                                    style={{
                                        width: "100%", background: "linear-gradient(135deg, " + provider.color + " 0%, " + provider.color + "cc 100%)",
                                        border: "none", borderRadius: 10, padding: "0.7rem", cursor: "pointer",
                                        color: "#fff", fontSize: "0.85rem", fontWeight: 700,
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                                        boxShadow: "0 4px 16px " + provider.color + "40",
                                    }}>
                                    <FaLink /> Bağlan
                                </motion.button>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════════════════════
       ANA RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div style={{ width: "100%", minHeight: "100vh", background: C.bg, padding: 0, margin: 0 }}>

            {/* ── HEADER ── */}
            <div style={{
                background: "linear-gradient(135deg, #1a1f35 0%, #0f1419 100%)",
                borderBottom: "1px solid " + C.border,
                padding: "1.25rem clamp(1rem, 4vw, 2rem)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                        <h1 style={{
                            background: "linear-gradient(135deg, " + C.accent + " 0%, " + C.purple + " 100%)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", fontWeight: 800, margin: 0,
                            display: "flex", alignItems: "center", gap: "0.5rem",
                        }}>
                            <FaFileInvoiceDollar style={{ WebkitTextFillColor: C.accent }} /> Faturalandırma & e-Belge Yönetimi
                        </h1>
                        <p style={{ color: C.dim, fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
                            e-Fatura, e-Arşiv, e-İrsaliye — Tüm e-belge işlemlerinizi tek yerden yönetin
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        {isConnected && (
                            <Pill color={C.green}><FaCheckCircle /> {connectedProviders[0].name} — {connectedProviders[0].env === "production" ? "Canlı" : "Test"}</Pill>
                        )}
                        {isConnected && (
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={() => setShowCreateModal(true)}
                                style={{
                                    background: "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                                    border: "none", borderRadius: 10, padding: "0.6rem 1.25rem",
                                    color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: "0.4rem",
                                }}>
                                <FaPlus /> Yeni Belge
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SEKMELER ── */}
            <div style={{
                background: C.bg, padding: "0 clamp(1rem, 4vw, 2rem)",
                borderBottom: "2px solid rgba(255,255,255,0.05)",
            }}>
                <div style={{ display: "flex", gap: "0.15rem", overflowX: "auto" }}>
                    {tabs.map(tab => (
                        <motion.button key={tab.id}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: activeTab === tab.id ? C.accent + "15" : "transparent",
                                border: "none",
                                borderBottom: activeTab === tab.id ? "2px solid " + C.accent : "2px solid transparent",
                                padding: "0.85rem 1.25rem", cursor: "pointer",
                                color: activeTab === tab.id ? C.accent : C.muted,
                                fontSize: "0.82rem", fontWeight: 600,
                                display: "flex", alignItems: "center", gap: "0.4rem",
                                transition: "all 0.2s", marginBottom: "-2px", flexShrink: 0,
                            }}>
                            {tab.icon} {tab.label}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* ── İÇERİK ── */}
            <div style={{ padding: "clamp(1rem, 3vw, 1.75rem) clamp(1rem, 4vw, 2rem)" }}>
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                        {activeTab === "overview" && renderOverview()}
                        {activeTab === "analysis" && (
                            !isConnected ? renderNoConnection() :
                            (invoicesLoading && invoices.length === 0) ? renderLoading() :
                            <AdvancedAnalysis invoices={invoices} onInvoiceClick={(inv) => { setSelectedInvoice(inv); setShowDetailModal(true); }} />
                        )}
                        {activeTab === "invoices" && renderInvoiceList(filteredInvoices, "Tüm Belgeler", true)}
                        {activeTab === "e-archive" && renderInvoiceList(tabInvoices, "e-Arşiv Belgeleri", false)}
                        {activeTab === "e-invoice" && renderInvoiceList(tabInvoices, "e-Fatura Belgeleri", false)}
                        {activeTab === "e-despatch" && renderInvoiceList(tabInvoices, "e-İrsaliye Belgeleri", false)}
                        {activeTab === "providers" && renderProviders()}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ═══ SAĞLAYICI BAĞLANTI MODAL ═══ */}
            <AnimatePresence>
                {showProviderModal && selectedProvider && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => { if (!connecting) setShowProviderModal(false); }}
                        style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
                        <motion.div initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.98) 100%)",
                                border: "1px solid " + C.border, borderRadius: 20,
                                padding: "2rem", maxWidth: 520, width: "100%",
                            }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span style={{ fontSize: "2rem" }}>{selectedProvider.logo}</span>
                                    <div>
                                        <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>{selectedProvider.name}</h3>
                                        <p style={{ color: C.dim, fontSize: "0.75rem", margin: 0 }}>Bağlantı Kurulumu</p>
                                    </div>
                                </div>
                                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => { if (!connecting) setShowProviderModal(false); }}
                                    style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red, fontSize: "0.9rem" }}>
                                    <FaTimes />
                                </motion.button>
                            </div>

                            {/* Ortam Seçimi */}
                            {selectedProvider.environments && (
                                <div style={{ marginBottom: "1.25rem" }}>
                                    <label style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Ortam Seçimi</label>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        {selectedProvider.environments.map(env => (
                                            <motion.button key={env.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                onClick={() => setSelectedEnv(env.id)}
                                                style={{
                                                    flex: 1, background: selectedEnv === env.id ? C.accent + "20" : C.glass,
                                                    border: selectedEnv === env.id ? "2px solid " + C.accent : "1px solid " + C.glassBr,
                                                    borderRadius: 10, padding: "0.6rem", cursor: "pointer", textAlign: "center",
                                                }}>
                                                <p style={{ color: selectedEnv === env.id ? C.accent : "#fff", fontSize: "0.82rem", fontWeight: 600, margin: 0 }}>{env.label}</p>
                                                <p style={{ color: C.dim, fontSize: "0.65rem", margin: "0.15rem 0 0", fontFamily: "monospace" }}>{env.url}</p>
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Credential Alanları */}
                            {(selectedProvider.fields || []).map(field => (
                                <div key={field.key} style={{ marginBottom: "1rem" }}>
                                    <label style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                                        {field.label} {field.required && <span style={{ color: C.red }}>*</span>}
                                    </label>
                                    <input
                                        type={field.type || "text"}
                                        placeholder={field.hint || field.label + " girin..."}
                                        value={providerForm[field.key] || ""}
                                        onChange={e => setProviderForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        style={{
                                            width: "100%", background: C.glass, border: "1px solid " + C.glassBr,
                                            borderRadius: 10, padding: "0.65rem 0.85rem",
                                            color: "#fff", fontSize: "0.85rem", outline: "none",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    {field.hint && <p style={{ color: C.dim, fontSize: "0.68rem", margin: "0.2rem 0 0" }}>💡 {field.hint}</p>}
                                </div>
                            ))}

                            {connectionError && (
                                <div style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: 10, padding: "0.6rem 0.85rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FaExclamationTriangle style={{ color: C.red, flexShrink: 0 }} />
                                    <span style={{ color: C.red, fontSize: "0.8rem" }}>{connectionError}</span>
                                </div>
                            )}

                            <div style={{ background: C.accent + "08", border: "1px solid " + C.accent + "20", borderRadius: 10, padding: "0.6rem 0.85rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                                <FaInfoCircle style={{ color: C.accent, flexShrink: 0, marginTop: "0.1rem" }} />
                                <span style={{ color: C.muted, fontSize: "0.75rem", lineHeight: 1.5 }}>
                                    Bağlantı bilgileriniz şifreli olarak saklanır. Test ortamında gerçek fatura kesilmez.
                                </span>
                            </div>

                            <div style={{ display: "flex", gap: "0.75rem" }}>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={handleConnect} disabled={connecting}
                                    style={{
                                        flex: 1, background: connecting ? C.accent + "50" : "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                                        border: "none", borderRadius: 10, padding: "0.75rem",
                                        color: "#fff", fontSize: "0.88rem", fontWeight: 700,
                                        cursor: connecting ? "not-allowed" : "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                                    }}>
                                    {connecting ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Bağlanıyor...</> : <><FaLink /> Bağlan</>}
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => { if (!connecting) setShowProviderModal(false); }}
                                    style={{
                                        background: C.glass, border: "1px solid " + C.glassBr,
                                        borderRadius: 10, padding: "0.75rem 1.5rem",
                                        color: C.muted, fontSize: "0.88rem", fontWeight: 600, cursor: "pointer",
                                    }}>
                                    İptal
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ YENİ BELGE OLUŞTURMA MODAL ═══ */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowCreateModal(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
                        <motion.div initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.98) 100%)",
                                border: "1px solid " + C.border, borderRadius: 20,
                                padding: "2rem", maxWidth: 600, width: "100%",
                            }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <h3 style={{
                                    background: "linear-gradient(135deg, " + C.accent + ", " + C.purple + ")",
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    fontSize: "1.2rem", fontWeight: 800, margin: 0,
                                }}>
                                    📄 Yeni Belge Oluştur
                                </h3>
                                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => setShowCreateModal(false)}
                                    style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red, fontSize: "0.9rem" }}>
                                    <FaTimes />
                                </motion.button>
                            </div>

                            <label style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Belge Tipi</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.5rem" }}>
                                {[
                                    { id: "e-arsiv", label: "e-Arşiv Fatura", icon: <FaFileInvoice />, desc: "Bireysel müşteriler için", color: C.accent },
                                    { id: "e-fatura", label: "e-Fatura", icon: <FaFileInvoiceDollar />, desc: "Tüzel kişiler için", color: C.orange },
                                    { id: "e-irsaliye", label: "e-İrsaliye", icon: <FaTruck />, desc: "Sevk irsaliyesi", color: C.pink },
                                    { id: "e-fatura-gelen", label: "Gelen e-Fatura", icon: <FaDownload />, desc: "Gelen faturaları görüntüle", color: C.purple },
                                ].map(t => (
                                    <motion.button key={t.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        onClick={() => setCreateType(t.id)}
                                        style={{
                                            background: createType === t.id ? t.color + "15" : C.glass,
                                            border: createType === t.id ? "2px solid " + t.color : "1px solid " + C.glassBr,
                                            borderRadius: 12, padding: "1rem", cursor: "pointer", textAlign: "left",
                                        }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                                            <span style={{ color: t.color, fontSize: "1rem" }}>{t.icon}</span>
                                            <span style={{ color: createType === t.id ? t.color : "#fff", fontSize: "0.85rem", fontWeight: 600 }}>{t.label}</span>
                                        </div>
                                        <p style={{ color: C.dim, fontSize: "0.7rem", margin: 0 }}>{t.desc}</p>
                                    </motion.button>
                                ))}
                            </div>

                            {!isConnected ? (
                                <div style={{ background: C.yellow + "10", border: "1px solid " + C.yellow + "30", borderRadius: 12, padding: "1.25rem", textAlign: "center" }}>
                                    <FaExclamationTriangle style={{ color: C.yellow, fontSize: "1.5rem", marginBottom: "0.5rem" }} />
                                    <p style={{ color: C.yellow, fontSize: "0.88rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Sağlayıcı Bağlantısı Gerekli</p>
                                    <p style={{ color: C.muted, fontSize: "0.78rem", margin: "0 0 0.75rem" }}>Belge oluşturmak için önce bir e-Fatura sağlayıcısı bağlamanız gerekiyor.</p>
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => { setShowCreateModal(false); setActiveTab("providers"); }}
                                        style={{
                                            background: "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                                            border: "none", borderRadius: 10, padding: "0.6rem 1.25rem",
                                            color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                        }}>
                                        <FaLink style={{ marginRight: "0.3rem" }} /> Sağlayıcı Bağla
                                    </motion.button>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ color: C.muted, fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                                        Bağlı sağlayıcı: <strong style={{ color: C.accent }}>{connectedProviders[0].name}</strong> ({connectedProviders[0].env === "production" ? "Canlı" : "Test"})
                                    </p>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        style={{
                                            width: "100%", background: "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                                            border: "none", borderRadius: 10, padding: "0.75rem",
                                            color: "#fff", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                                        }}>
                                        <FaPlus /> {createType === "e-fatura-gelen" ? "Gelen Faturaları Sorgula" : "Belge Oluşturmaya Başla"}
                                    </motion.button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ BELGE DETAY MODAL ═══ */}
            <AnimatePresence>
                {showDetailModal && selectedInvoice && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowDetailModal(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
                        <motion.div initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.98) 100%)",
                                border: "1px solid " + C.border, borderRadius: 20,
                                padding: "2rem", maxWidth: 640, width: "100%", maxHeight: "85vh", overflowY: "auto",
                            }}>
                            {/* Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                                        <h3 style={{ color: "#fff", fontSize: "1.15rem", fontWeight: 800, margin: 0, fontFamily: "monospace" }}>
                                            {selectedInvoice.number || "Belge #" + selectedInvoice.id}
                                        </h3>
                                        <TypeBadge type={selectedInvoice.type} />
                                    </div>
                                    <StatusBadge status={selectedInvoice.status} />
                                </div>
                                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => setShowDetailModal(false)}
                                    style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red, fontSize: "0.9rem", flexShrink: 0 }}>
                                    <FaTimes />
                                </motion.button>
                            </div>

                            {/* Tutar Kartı */}
                            <div style={{ background: C.green + "08", border: "1px solid " + C.green + "25", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem", textAlign: "center" }}>
                                <p style={{ color: C.dim, fontSize: "0.75rem", fontWeight: 600, margin: "0 0 0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Toplam Tutar</p>
                                <p style={{ color: C.green, fontSize: "1.8rem", fontWeight: 800, margin: 0 }}>{selectedInvoice.total > 0 ? fmtCurrency(selectedInvoice.total) : "—"}</p>
                                <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "0.6rem" }}>
                                    <div>
                                        <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>Ara Toplam</p>
                                        <p style={{ color: C.text, fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>{fmtCurrency(selectedInvoice.amount)}</p>
                                    </div>
                                    <div>
                                        <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>KDV</p>
                                        <p style={{ color: C.purple, fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>{fmtCurrency(selectedInvoice.tax)}</p>
                                    </div>
                                    <div>
                                        <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>Para Birimi</p>
                                        <p style={{ color: C.blue, fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>{selectedInvoice.currency || "TRY"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Detay Alanları */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                                {[
                                    { icon: <FaBuilding />, label: "Müşteri", value: selectedInvoice.customer || "—", color: C.accent },
                                    { icon: <FaHashtag />, label: "VKN / TCKN", value: selectedInvoice.vkn || "—", color: C.orange, mono: true },
                                    { icon: <FaCalendarAlt />, label: "Tarih", value: fmtDate(selectedInvoice.date), color: C.blue },
                                    { icon: <FaLink />, label: "Sağlayıcı", value: (PROVIDERS.find(p => p.id === selectedInvoice.provider) || {}).name || selectedInvoice.provider || "—", color: C.green },
                                ].map((field, i) => (
                                    <div key={field.label} style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.85rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                                            <span style={{ color: field.color, fontSize: "0.75rem" }}>{field.icon}</span>
                                            <span style={{ color: C.dim, fontSize: "0.7rem", fontWeight: 600 }}>{field.label}</span>
                                        </div>
                                        <p style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 600, margin: 0, fontFamily: field.mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{field.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Ham Veri (raw) — Accordion */}
                            {selectedInvoice.raw && (
                                <div style={{ marginBottom: "1.25rem" }}>
                                    <div
                                        onClick={() => setRawDataOpen(prev => !prev)}
                                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 0.85rem", background: C.glass, border: "1px solid " + C.glassBr, borderRadius: rawDataOpen ? "10px 10px 0 0" : 10, cursor: "pointer", transition: "background 0.2s" }}>
                                        <FaInfoCircle style={{ color: C.accent, fontSize: "0.8rem" }} />
                                        <span style={{ color: C.muted, fontSize: "0.78rem", fontWeight: 600, flex: 1 }}>Sağlayıcı Ham Verisi (API Response)</span>
                                        <FaChevronDown style={{ color: C.dim, fontSize: "0.7rem", transform: rawDataOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                                    </div>
                                    {rawDataOpen && (
                                        <pre style={{
                                            background: "rgba(0,0,0,0.3)", border: "1px solid " + C.glassBr, borderTop: "none",
                                            borderRadius: "0 0 10px 10px", padding: "1rem", margin: 0,
                                            color: C.muted, fontSize: "0.7rem", lineHeight: 1.5,
                                            maxHeight: 300, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                                        }}>
                                            {JSON.stringify(selectedInvoice.raw, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}

                            {/* Alt Butonlar */}
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    style={{ flex: 1, background: C.blue + "15", border: "1px solid " + C.blue + "30", borderRadius: 10, padding: "0.65rem", cursor: "pointer", color: C.blue, fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                                    <FaDownload /> İndir
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    style={{ flex: 1, background: C.muted + "15", border: "1px solid " + C.muted + "30", borderRadius: 10, padding: "0.65rem", cursor: "pointer", color: C.muted, fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                                    <FaPrint /> Yazdır
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowDetailModal(false)}
                                    style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.65rem 1.25rem", cursor: "pointer", color: C.dim, fontSize: "0.82rem", fontWeight: 600 }}>
                                    Kapat
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default BillingPage;
