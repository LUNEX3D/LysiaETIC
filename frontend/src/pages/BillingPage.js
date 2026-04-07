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

import { useApp } from "../context/AppContext";

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
        name: "QNB eSolutions",
        logo: "🏦",
        color: "#7c3aed",
        description: "QNB eSolutions ile e-Fatura, e-Arşiv, e-İrsaliye ve e-Defter işlemlerinizi yönetin. Türkiye'nin en büyük e-belge pazarında lider. SOAP API entegrasyonu.",
        features: ["e-Fatura", "e-Arşiv", "e-İrsaliye", "Fatura Oluşturma", "Mükellef Sorgulama"],
        authType: "qnb",
        fields: [
            { key: "username", label: "Kullanıcı Adı", type: "text", required: true, hint: "QNB eSolutions kullanıcı adınız (VKN veya VKN.portaltest)" },
            { key: "password", label: "Şifre", type: "password", required: true, hint: "QNB eSolutions şifreniz" },
        ],
        environments: [
            { id: "test", label: "Test Ortamı", url: "connectortest.qnbesolutions.com.tr" },
            { id: "production", label: "Canlı Ortam", url: "connector.qnbesolutions.com.tr" },
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
   RENK SABİTLERİ
   ═══════════════════════════════════════════════════════════ */
const C = {
    bg: "#050a12", card: "rgba(10, 18, 40, 0.85)",
    border: "rgba(0, 240, 255, 0.12)",
    accent: "#00f0ff",
    green: "#00ff88", red: "#ff3366", yellow: "#ffcc00",
    purple: "#a855f7", blue: "#3b82f6", pink: "#ff61d8",
    orange: "#ff8c00",
    text: "#e8edf5", muted: "#7a8ba8", dim: "#4a5568",
    glass: "rgba(255,255,255,0.02)", glassBr: "rgba(255,255,255,0.05)",
};

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
    const { theme: C, t } = useApp();
    // ── Sekmeler ──
    const [activeTab, setActiveTab] = useState("overview");
    // ── Sağlayıcı bağlantı (localStorage ile kalıcı) ──
    const [connectedProviders, setConnectedProviders] = useState(() => {
        try {
            const saved = localStorage.getItem("lysia_connected_providers");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) { /* ignore */ }
        return [];
    });
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
    const [createStep, setCreateStep] = useState(1); // 1=tip, 2=form, 3=sonuç
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createResult, setCreateResult] = useState(null);
    const [invoiceForm, setInvoiceForm] = useState({
        // Alıcı
        customerName: "", customerVkn: "", customerFirstName: "", customerLastName: "",
        customerStreet: "", customerDistrict: "", customerCity: "Istanbul", customerTaxOffice: "",
        customerEmail: "", customerPhone: "",
        // Kalemler
        lines: [{ name: "", quantity: 1, unit: "adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }],
        // Genel
        note: "", currency: "TRY", sendingType: "ELEKTRONIK",
    });
    // ── Belge detay modalı ──
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    // ── Belge detay ham veri açılır/kapanır ──
    const [rawDataOpen, setRawDataOpen] = useState(false);
    // ── Fetch guard (sonsuz döngü önleme) ──
    const hasFetchedRef = useRef(false);
    // ── Otomatik Fatura ──
    const [autoInvoiceConfig, setAutoInvoiceConfig] = useState(null);
    const [autoInvoiceStats, setAutoInvoiceStats] = useState(null);
    const [autoInvoices, setAutoInvoices] = useState([]);
    const [autoInvoiceLoading, setAutoInvoiceLoading] = useState(false);
    const [autoInvoiceSaving, setAutoInvoiceSaving] = useState(false);
    const [autoInvoiceError, setAutoInvoiceError] = useState("");
    const [showAutoInvoiceConfig, setShowAutoInvoiceConfig] = useState(false);
    const [autoConfigForm, setAutoConfigForm] = useState(null);
    const [selectedAutoInvoice, setSelectedAutoInvoice] = useState(null);
    const [processAllLoading, setProcessAllLoading] = useState(false);
    const [processAllResult, setProcessAllResult] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(null);

    const isConnected = connectedProviders.length > 0;

    const tabs = [
        { id: "overview", label: "Genel Bakış", icon: <FaFileInvoiceDollar /> },
        { id: "analysis", label: "Gelişmiş Analiz", icon: <FaChartBar /> },
        { id: "invoices", label: "Faturalar", icon: <FaFileInvoice /> },
        { id: "e-archive", label: "e-Arşiv", icon: <FaClipboardList /> },
        { id: "e-invoice", label: "e-Fatura", icon: <FaFileInvoiceDollar /> },
        { id: "e-despatch", label: "e-İrsaliye", icon: <FaTruck /> },
        { id: "auto-invoice", label: "Otomatik Fatura", icon: <FaSyncAlt /> },
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
                // QNB credential'ları localStorage'a kaydet (session expire olunca otomatik yeniden login için)
                try {
                    localStorage.setItem("lysia_qnb_form", JSON.stringify({
                        username: providerForm.username,
                        password: providerForm.password,
                        env: selectedEnv
                    }));
                } catch (e) { /* ignore */ }
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

            const updatedProviders = [...connectedProviders, newProvider];
            setConnectedProviders(updatedProviders);
            // localStorage'a kaydet (sessionId dahil — sayfa yenilenince korunsun)
            try {
                localStorage.setItem("lysia_connected_providers", JSON.stringify(updatedProviders));
            } catch (e) { /* ignore */ }
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
            const disconnecting = connectedProviders.find(p => p.id === providerId);
            const updated = connectedProviders.filter(p => p.id !== providerId);
            setConnectedProviders(updated);
            // localStorage'dan da kaldır
            try {
                if (updated.length > 0) {
                    localStorage.setItem("lysia_connected_providers", JSON.stringify(updated));
                } else {
                    localStorage.removeItem("lysia_connected_providers");
                }
                // QNB ise credential'ları da temizle
                if (disconnecting && disconnecting.authType === "qnb") {
                    localStorage.removeItem("lysia_qnb_form");
                }
            } catch (e) { /* ignore */ }
            setInvoices([]);
            setLastFetchTime(null);
            setFetchError("");
            hasReconnectedRef.current = false;
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
                // QNB giden belge sorgusu tarih aralığı zorunlu tutuyor — son 30 gün varsayılan
                const defaultSearchParams = {};
                if (provider.authType === "qnb") {
                    const now = new Date();
                    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    const fmt = (d) => d.toISOString().split("T")[0].replace(/-/g, "");
                    defaultSearchParams.startDate = fmt(thirtyDaysAgo);
                    defaultSearchParams.endDate = fmt(now);
                }
                const bodyData = {
                    token: apiToken,
                    documentType: dt.apiType,
                    searchParams: defaultSearchParams,
                    env: provider.env
                };
                // QNB backend "sessionId" bekliyor, genel endpoint "token" bekliyor
                if (provider.authType === "qnb") {
                    bodyData.sessionId = provider.sessionId || apiToken;
                    bodyData.vkn = provider.vkn || "7610650466";
                }
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

    // ── Sayfa yüklendiğinde kaydedilmiş QNB session'ı yenile ──
    // Sunucu restart veya session expire olmuş olabilir — her zaman yeniden login dene
    const hasReconnectedRef = useRef(false);
    useEffect(() => {
        if (!isConnected || hasReconnectedRef.current) return;
        hasReconnectedRef.current = true;

        const provider = connectedProviders[0];
        if (provider && provider.authType === "qnb") {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const savedForm = localStorage.getItem("lysia_qnb_form");
            if (savedForm && token) {
                try {
                    const creds = JSON.parse(savedForm);
                    fetch(API_URL + "/api/e-invoice/qnb/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                        body: JSON.stringify(creds)
                    }).then(r => r.json()).then(data => {
                        if (data.success && data.data) {
                            const refreshed = {
                                ...provider,
                                sessionId: data.data.sessionId,
                                apiToken: data.data.sessionId,
                                connectedAt: new Date().toISOString(),
                            };
                            const updated = [refreshed];
                            setConnectedProviders(updated);
                            try { localStorage.setItem("lysia_connected_providers", JSON.stringify(updated)); } catch (e) { /* */ }
                        }
                        // Başarısız olursa bağlantıyı silme — kullanıcı zaten bağlı görünsün
                        // Sadece session geçersiz olur, belge çekme hata verir ama bağlantı korunur
                    }).catch(() => {});
                } catch (e) { /* ignore */ }
            }
        }
    }, [isConnected, connectedProviders]);

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
       OTOMATİK FATURA — API ÇAĞRILARI
       ═══════════════════════════════════════════════════════ */
    const fetchAutoInvoiceData = useCallback(async () => {
        setAutoInvoiceLoading(true);
        setAutoInvoiceError("");
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const headers = { Authorization: "Bearer " + token };
            const [configRes, statsRes, invoicesRes] = await Promise.all([
                fetch(API_URL + "/api/auto-invoice/config", { headers }).then(r => r.json()),
                fetch(API_URL + "/api/auto-invoice/stats", { headers }).then(r => r.json()),
                fetch(API_URL + "/api/auto-invoice/invoices?limit=50", { headers }).then(r => r.json()),
            ]);
            if (configRes.success) setAutoInvoiceConfig(configRes.data);
            if (statsRes.success) setAutoInvoiceStats(statsRes.data);
            if (invoicesRes.success) setAutoInvoices(invoicesRes.data || []);
        } catch (err) {
            setAutoInvoiceError("Veriler yüklenemedi: " + err.message);
        } finally {
            setAutoInvoiceLoading(false);
        }
    }, []);

    const saveAutoInvoiceConfig = async (configData) => {
        setAutoInvoiceSaving(true);
        setAutoInvoiceError("");
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const res = await fetch(API_URL + "/api/auto-invoice/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                body: JSON.stringify(configData),
            });
            const data = await res.json();
            if (data.success) {
                setAutoInvoiceConfig(data.data);
                setShowAutoInvoiceConfig(false);
                await fetchAutoInvoiceData();
            } else {
                setAutoInvoiceError(data.message || "Kaydetme hatası");
            }
        } catch (err) {
            setAutoInvoiceError("Kaydetme hatası: " + err.message);
        } finally {
            setAutoInvoiceSaving(false);
        }
    };

    const toggleAutoInvoice = async () => {
        setAutoInvoiceError("");
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const res = await fetch(API_URL + "/api/auto-invoice/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            });
            const data = await res.json();
            if (data.success) {
                setAutoInvoiceConfig(prev => prev ? { ...prev, enabled: data.enabled } : prev);
                await fetchAutoInvoiceData();
            } else {
                setAutoInvoiceError(data.message || "Toggle hatası");
            }
        } catch (err) {
            setAutoInvoiceError("Toggle hatası: " + err.message);
        }
    };

    const processAllUninvoiced = async () => {
        setProcessAllLoading(true);
        setProcessAllResult(null);
        setAutoInvoiceError("");
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const res = await fetch(API_URL + "/api/auto-invoice/process-all", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
                body: JSON.stringify({ limit: 50 })
            });
            const data = await res.json();
            if (data.success) {
                setProcessAllResult(data);
                await fetchAutoInvoiceData();
            } else {
                setAutoInvoiceError(data.message || "Toplu faturalama hatası");
            }
        } catch (err) {
            setAutoInvoiceError("Toplu faturalama hatası: " + err.message);
        } finally {
            setProcessAllLoading(false);
        }
    };

    const downloadInvoicePdf = async (invoiceId, invoiceNumber) => {
        setPdfLoading(invoiceId);
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const res = await fetch(API_URL + "/api/auto-invoice/invoices/" + invoiceId + "/pdf", {
                headers: { Authorization: "Bearer " + token }
            });
            if (res.ok) {
                const contentType = res.headers.get("content-type") || "";
                if (contentType.includes("zip") || contentType.includes("octet")) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = (invoiceNumber || "fatura") + ".zip";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } else {
                    const data = await res.json();
                    if (data.success && data.data) {
                        alert("PDF verisi alındı (format: JSON). Konsolu kontrol edin.");
                        console.log("[PDF Data]", data.data);
                    } else {
                        setAutoInvoiceError(data.message || "PDF indirilemedi");
                    }
                }
            } else {
                const data = await res.json().catch(() => ({}));
                setAutoInvoiceError(data.message || "PDF indirme hatası (" + res.status + ")");
            }
        } catch (err) {
            setAutoInvoiceError("PDF indirme hatası: " + err.message);
        } finally {
            setPdfLoading(null);
        }
    };

    const resetAutoInvoiceErrors = async () => {
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const res = await fetch(API_URL + "/api/auto-invoice/reset-errors", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            });
            const data = await res.json();
            if (data.success) await fetchAutoInvoiceData();
        } catch (err) { /* ignore */ }
    };

    const initAutoConfigForm = () => {
        const cfg = autoInvoiceConfig || {};
        setAutoConfigForm({
            enabled: cfg.enabled || false,
            provider: cfg.provider || "qnb",
            enabledMarketplaces: cfg.enabledMarketplaces || [],
            triggerStatuses: cfg.triggerStatuses || ["Shipped", "Delivered"],
            documentType: cfg.documentType || "EARSIVFATURA",
            invoiceTypeCode: cfg.invoiceTypeCode || "SATIS",
            invoiceSeriesCode: cfg.invoiceSeriesCode || "LYS",
            currency: cfg.currency || "TRY",
            sendingType: cfg.sendingType || "ELEKTRONIK",
            defaultVatRate: cfg.defaultVatRate || 20,
            defaultNote: cfg.defaultNote || "",
            supplier: {
                vkn: cfg.supplier?.vkn || "",
                name: cfg.supplier?.name || "",
                taxOffice: cfg.supplier?.taxOffice || "",
                street: cfg.supplier?.street || "",
                district: cfg.supplier?.district || "",
                city: cfg.supplier?.city || "",
                country: cfg.supplier?.country || "Turkiye",
                phone: cfg.supplier?.phone || "",
                email: cfg.supplier?.email || "",
            },
            defaultCustomer: {
                vkn: cfg.defaultCustomer?.vkn || "22222222222",
                name: cfg.defaultCustomer?.name || "",
                firstName: cfg.defaultCustomer?.firstName || "",
                lastName: cfg.defaultCustomer?.lastName || "",
                city: cfg.defaultCustomer?.city || "Istanbul",
                district: cfg.defaultCustomer?.district || "Merkez",
                country: cfg.defaultCustomer?.country || "Turkiye",
            },
            qnbCredentials: {
                username: cfg.qnbCredentials?.username || "",
                password: cfg.qnbCredentials?.password || "",
                env: cfg.qnbCredentials?.env || "test",
            },
        });
    };

    // Otomatik fatura tab'ına geçildiğinde verileri yükle
    useEffect(() => {
        if (activeTab === "auto-invoice" && !autoInvoiceConfig) {
            fetchAutoInvoiceData();
        }
    }, [activeTab, autoInvoiceConfig, fetchAutoInvoiceData]);

    /* ═══════════════════════════════════════════════════════
       RENDER: OTOMATİK FATURA
       ═══════════════════════════════════════════════════════ */
    const renderAutoInvoice = () => {
        if (autoInvoiceLoading && !autoInvoiceConfig) {
            return (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                    <FaSpinner style={{ animation: "spin 1s linear infinite", fontSize: "2rem", color: C.accent }} />
                    <p style={{ color: C.muted, marginTop: "1rem" }}>Yükleniyor...</p>
                </div>
            );
        }

        const config = autoInvoiceConfig || {};
        const st = autoInvoiceStats || {};
        const isEnabled = config.enabled || false;
        const hasConfig = config.supplier && config.supplier.vkn;
        const consecutiveErrors = config.stats?.consecutiveErrors || 0;

        // ── Ayar Formu (inline) ──
        if (showAutoInvoiceConfig) {
            return renderAutoInvoiceConfigForm();
        }

        return (
            <div>
                {/* Başlık + Toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                        <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FaSyncAlt style={{ color: C.accent }} /> Otomatik Fatura Kesme
                        </h3>
                        <p style={{ color: C.dim, fontSize: "0.8rem", margin: "0.25rem 0 0" }}>
                            Pazaryerinden sipariş geldiğinde otomatik e-Arşiv fatura kesilir
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => { initAutoConfigForm(); setShowAutoInvoiceConfig(true); }}
                            style={{
                                background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10,
                                padding: "0.6rem 1.1rem", cursor: "pointer", color: C.muted,
                                fontSize: "0.82rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.4rem",
                            }}>
                            <FaCog /> Ayarlar
                        </motion.button>
                        {hasConfig && (
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={toggleAutoInvoice}
                                style={{
                                    background: isEnabled ? C.green + "20" : C.red + "20",
                                    border: "1px solid " + (isEnabled ? C.green + "50" : C.red + "50"),
                                    borderRadius: 10, padding: "0.6rem 1.1rem", cursor: "pointer",
                                    color: isEnabled ? C.green : C.red,
                                    fontSize: "0.82rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem",
                                }}>
                                {isEnabled ? <><FaCheckCircle /> Aktif</> : <><FaTimesCircle /> Devre Dışı</>}
                            </motion.button>
                        )}
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={fetchAutoInvoiceData}
                            style={{
                                background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10,
                                padding: "0.6rem", cursor: "pointer", color: C.muted, fontSize: "0.9rem",
                            }}>
                            <FaSyncAlt style={autoInvoiceLoading ? { animation: "spin 1s linear infinite" } : {}} />
                        </motion.button>
                    </div>
                </div>

                {autoInvoiceError && (
                    <div style={{ background: C.red + "15", border: "1px solid " + C.red + "40", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <FaExclamationTriangle style={{ color: C.red, flexShrink: 0 }} />
                        <span style={{ color: C.red, fontSize: "0.82rem" }}>{autoInvoiceError}</span>
                    </div>
                )}

                {/* Ardışık hata uyarısı */}
                {consecutiveErrors >= 3 && (
                    <div style={{ background: C.yellow + "15", border: "1px solid " + C.yellow + "40", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FaExclamationTriangle style={{ color: C.yellow, flexShrink: 0 }} />
                            <span style={{ color: C.yellow, fontSize: "0.82rem" }}>
                                {consecutiveErrors} ardışık hata oluştu. {consecutiveErrors >= 5 ? "Otomatik fatura devre dışı bırakıldı." : "5 hatada otomatik devre dışı kalır."}
                                {config.stats?.lastError && <><br /><span style={{ color: C.dim }}>Son hata: {config.stats.lastError}</span></>}
                            </span>
                        </div>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={resetAutoInvoiceErrors}
                            style={{ background: C.yellow + "25", border: "1px solid " + C.yellow + "50", borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer", color: C.yellow, fontSize: "0.75rem", fontWeight: 600, flexShrink: 0 }}>
                            Sıfırla
                        </motion.button>
                    </div>
                )}

                {/* Ayar yapılmamış uyarısı */}
                {!hasConfig && (
                    <GlassCard style={{ textAlign: "center", padding: "2.5rem 1.5rem", marginBottom: "1.5rem" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>⚙️</div>
                        <p style={{ color: C.muted, fontSize: "1rem", fontWeight: 600, margin: "0 0 0.35rem" }}>Ayarlar Yapılmadı</p>
                        <p style={{ color: C.dim, fontSize: "0.82rem", margin: "0 0 1.25rem", maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
                            Otomatik fatura kesme için firma bilgilerinizi ve QNB bağlantı ayarlarınızı yapmanız gerekiyor.
                        </p>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => { initAutoConfigForm(); setShowAutoInvoiceConfig(true); }}
                            style={{ background: "linear-gradient(135deg, " + C.accent + " 0%, #06b6d4 100%)", border: "none", borderRadius: 10, padding: "0.7rem 1.5rem", cursor: "pointer", color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>
                            <FaCog style={{ marginRight: "0.4rem" }} /> Ayarları Yapılandır
                        </motion.button>
                    </GlassCard>
                )}

                {/* Toplu Faturalama Sonucu */}
                {processAllResult && (
                    <div style={{ background: C.green + "15", border: "1px solid " + C.green + "40", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FaCheckCircle style={{ color: C.green, flexShrink: 0 }} />
                            <span style={{ color: C.green, fontSize: "0.82rem", fontWeight: 600 }}>{processAllResult.message}</span>
                        </div>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setProcessAllResult(null)}
                            style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.85rem" }}>✕</motion.button>
                    </div>
                )}

                {/* İstatistik Kartları */}
                {hasConfig && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                        {[
                            { label: "Toplam Fatura", value: st.totalInvoices || 0, icon: <FaFileInvoice />, color: C.accent },
                            { label: "Bugün Kesilen", value: st.todayInvoices || 0, icon: <FaCalendarAlt />, color: C.green },
                            { label: "Toplam Tutar", value: fmtCurrency(st.totalAmount || 0), icon: <FaMoneyBillWave />, color: C.purple },
                            { label: "Faturasız Sipariş", value: st.uninvoicedOrders || 0, icon: <FaExclamationTriangle />, color: st.uninvoicedOrders > 0 ? C.yellow : C.dim },
                        ].map((card, i) => (
                            <GlassCard key={i} style={{ padding: "1.15rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <div>
                                        <p style={{ color: C.dim, fontSize: "0.72rem", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>{card.label}</p>
                                        <p style={{ color: "#fff", fontSize: "1.35rem", fontWeight: 800, margin: "0.35rem 0 0" }}>{card.value}</p>
                                    </div>
                                    <div style={{ color: card.color, fontSize: "1.3rem", opacity: 0.7 }}>{card.icon}</div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}

                {/* Tümünü Faturala Butonu */}
                {hasConfig && (st.uninvoicedOrders || 0) > 0 && (
                    <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={processAllUninvoiced}
                            disabled={processAllLoading}
                            style={{
                                background: "linear-gradient(135deg, " + C.accent + " 0%, #06b6d4 100%)",
                                border: "none", borderRadius: 10, padding: "0.7rem 1.5rem",
                                cursor: processAllLoading ? "not-allowed" : "pointer",
                                color: "#fff", fontSize: "0.85rem", fontWeight: 700,
                                display: "flex", alignItems: "center", gap: "0.5rem",
                                opacity: processAllLoading ? 0.7 : 1,
                            }}>
                            {processAllLoading
                                ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Faturalar Kesiliyor...</>
                                : <><FaFileInvoice /> Faturasız Siparişleri Faturala ({Math.min(50, st.uninvoicedOrders)})</>}
                        </motion.button>
                        <span style={{ color: C.dim, fontSize: "0.75rem" }}>
                            Tek seferde en fazla 50 sipariş faturalanır. {(st.uninvoicedOrders || 0) > 50 ? "Kalan siparişler için tekrar çalıştırın." : ""}
                        </span>
                    </div>
                )}

                {/* Durum Bilgisi */}
                {hasConfig && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                        {/* Mevcut Ayarlar Özeti */}
                        <GlassCard>
                            <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <FaCog style={{ color: C.accent }} /> Mevcut Ayarlar
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                {[
                                    { label: "Durum", value: isEnabled ? "Aktif" : "Devre Dışı", color: isEnabled ? C.green : C.red },
                                    { label: "Sağlayıcı", value: (config.provider || "qnb").toUpperCase() },
                                    { label: "Belge Tipi", value: config.documentType || "EARSIVFATURA" },
                                    { label: "Fatura Serisi", value: config.invoiceSeriesCode || "LYS" },
                                    { label: "KDV Oranı", value: "%" + (config.defaultVatRate || 20) },
                                    { label: "Firma VKN", value: config.supplier?.vkn || "—" },
                                    { label: "Firma Adı", value: config.supplier?.name || "—" },
                                    { label: "Ortam", value: config.qnbCredentials?.env === "production" ? "Canlı" : "Test" },
                                    { label: "Pazaryerleri", value: config.enabledMarketplaces?.length > 0 ? config.enabledMarketplaces.join(", ") : "Tümü" },
                                    { label: "Tetikleme Durumları", value: config.triggerStatuses?.length > 0 ? config.triggerStatuses.join(", ") : "Tümü" },
                                ].map((row, i) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                        <span style={{ color: C.dim, fontSize: "0.78rem" }}>{row.label}</span>
                                        <span style={{ color: row.color || C.text, fontSize: "0.78rem", fontWeight: 600 }}>{row.value}</span>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>

                        {/* Pazaryeri Kırılımı + Son Hata */}
                        <GlassCard>
                            <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <FaChartPie style={{ color: C.purple }} /> Pazaryeri Kırılımı
                            </h4>
                            {(st.byMarketplace && st.byMarketplace.length > 0) ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {st.byMarketplace.map((mp, i) => {
                                        const total = st.totalInvoices || 1;
                                        const pct = ((mp.count / total) * 100).toFixed(0);
                                        const colors = { Trendyol: "#f27a1a", Hepsiburada: "#ff6000", N11: "#7b2d8e", "ÇiçekSepeti": "#e91e63" };
                                        const barColor = colors[mp.marketplace] || C.accent;
                                        return (
                                            <div key={i}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                                    <span style={{ color: C.text, fontSize: "0.78rem", fontWeight: 600 }}>{mp.marketplace}</span>
                                                    <span style={{ color: C.dim, fontSize: "0.75rem" }}>{mp.count} fatura ({pct}%)</span>
                                                </div>
                                                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                                                    <div style={{ background: barColor, height: "100%", width: pct + "%", borderRadius: 4, transition: "width 0.5s" }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: C.dim, fontSize: "0.8rem", textAlign: "center", padding: "1rem 0" }}>Henüz fatura kesilmedi</p>
                            )}

                            {/* Son fatura bilgisi */}
                            {config.stats?.lastInvoiceDate && (
                                <div style={{ marginTop: "1rem", padding: "0.65rem 0.85rem", background: C.green + "10", border: "1px solid " + C.green + "25", borderRadius: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: C.green, fontSize: "0.75rem", fontWeight: 600 }}>
                                        <FaCheckCircle /> Son fatura: {fmtDate(config.stats.lastInvoiceDate)}
                                    </div>
                                    <p style={{ color: C.dim, fontSize: "0.72rem", margin: "0.2rem 0 0" }}>
                                        Toplam {config.stats.totalInvoicesCreated || 0} fatura kesildi
                                    </p>
                                </div>
                            )}

                            {/* Son hata */}
                            {config.stats?.lastError && (
                                <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.85rem", background: C.red + "10", border: "1px solid " + C.red + "25", borderRadius: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: C.red, fontSize: "0.75rem", fontWeight: 600 }}>
                                        <FaTimesCircle /> Son hata
                                    </div>
                                    <p style={{ color: C.dim, fontSize: "0.72rem", margin: "0.2rem 0 0", wordBreak: "break-word" }}>
                                        {config.stats.lastError}
                                    </p>
                                </div>
                            )}
                        </GlassCard>
                    </div>
                )}

                {/* Fatura Listesi */}
                {hasConfig && autoInvoices.length > 0 && (
                    <GlassCard style={{ marginBottom: "1.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <FaFileInvoice style={{ color: C.accent }} /> Kesilen Faturalar ({autoInvoices.length})
                            </h4>
                        </div>
                        {/* Tablo Başlık */}
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr 1fr 1fr", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: "0.5rem" }}>
                            {["Fatura No", "Müşteri", "Sipariş", "Tutar", "Durum", "Tarih"].map((h, i) => (
                                <span key={i} style={{ color: C.dim, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</span>
                            ))}
                        </div>
                        {/* Fatura Satırları */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: 400, overflowY: "auto" }}>
                            {autoInvoices.map((inv, idx) => {
                                const statusConfig = {
                                    created: { color: C.blue, label: "Oluşturuldu" },
                                    sent: { color: C.accent, label: "Gönderildi" },
                                    accepted: { color: C.green, label: "Onaylandı" },
                                    rejected: { color: C.red, label: "Reddedildi" },
                                    cancelled: { color: C.yellow, label: "İptal" },
                                    error: { color: C.red, label: "Hata" },
                                };
                                const sc = statusConfig[inv.status] || { color: C.dim, label: inv.status || "—" };
                                return (
                                    <motion.div
                                        key={inv._id || idx}
                                        whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                                        onClick={() => setSelectedAutoInvoice(selectedAutoInvoice?._id === inv._id ? null : inv)}
                                        style={{
                                            display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr 1fr 1fr", gap: "0.5rem",
                                            padding: "0.65rem 0.75rem", borderRadius: 8, cursor: "pointer",
                                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                                            background: selectedAutoInvoice?._id === inv._id ? "rgba(99,102,241,0.08)" : "transparent",
                                        }}
                                    >
                                        <span style={{ color: C.accent, fontSize: "0.8rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {inv.invoiceNumber || "—"}
                                        </span>
                                        <span style={{ color: C.text, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {inv.customer?.name || "—"}
                                        </span>
                                        <span style={{ color: C.muted, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {inv.marketplaceName ? (inv.marketplaceName + " #" + (inv.orderNumber || "")) : (inv.orderNumber || "—")}
                                        </span>
                                        <span style={{ color: C.green, fontSize: "0.8rem", fontWeight: 700 }}>
                                            {fmtCurrency(inv.totals?.payableAmount || 0)}
                                        </span>
                                        <span style={{ color: sc.color, fontSize: "0.72rem", fontWeight: 600, background: sc.color + "15", padding: "0.15rem 0.5rem", borderRadius: 6, textAlign: "center", whiteSpace: "nowrap" }}>
                                            {sc.label}
                                        </span>
                                        <span style={{ color: C.dim, fontSize: "0.75rem" }}>
                                            {fmtDate(inv.issueDate || inv.createdAt)}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Seçili Fatura Detayı */}
                        {selectedAutoInvoice && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                style={{ marginTop: "1rem", padding: "1rem", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12 }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                                    <h5 style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>
                                        {selectedAutoInvoice.invoiceNumber} — Detay
                                    </h5>
                                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                        onClick={() => setSelectedAutoInvoice(null)}
                                        style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "1rem" }}>
                                        ✕
                                    </motion.button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                                    {[
                                        { label: "UUID (ETTN)", value: selectedAutoInvoice.uuid || "—" },
                                        { label: "Profil", value: selectedAutoInvoice.profileId || "—" },
                                        { label: "Fatura Tipi", value: selectedAutoInvoice.invoiceTypeCode || "—" },
                                        { label: "Sağlayıcı", value: (selectedAutoInvoice.provider || "qnb").toUpperCase() },
                                        { label: "Ortam", value: selectedAutoInvoice.env === "production" ? "Canlı" : "Test" },
                                        { label: "Oluşturma", value: selectedAutoInvoice.createdBy === "auto" ? "Otomatik" : "Manuel" },
                                        { label: "Müşteri VKN", value: selectedAutoInvoice.customer?.vkn || "—" },
                                        { label: "Vergi Dairesi", value: selectedAutoInvoice.customer?.taxOffice || "—" },
                                    ].map((item, i) => (
                                        <div key={i} style={{ padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                            <p style={{ color: C.dim, fontSize: "0.68rem", fontWeight: 600, margin: 0, textTransform: "uppercase" }}>{item.label}</p>
                                            <p style={{ color: C.text, fontSize: "0.8rem", fontWeight: 600, margin: "0.15rem 0 0", wordBreak: "break-all" }}>{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Tutar Özeti */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: "0.75rem" }}>
                                    {[
                                        { label: "KDV Hariç", value: fmtCurrency(selectedAutoInvoice.totals?.lineExtensionAmount || 0), color: C.text },
                                        { label: "KDV", value: fmtCurrency(selectedAutoInvoice.totals?.totalTax || 0), color: C.purple },
                                        { label: "KDV Dahil", value: fmtCurrency(selectedAutoInvoice.totals?.taxInclusiveAmount || 0), color: C.blue },
                                        { label: "Ödenecek", value: fmtCurrency(selectedAutoInvoice.totals?.payableAmount || 0), color: C.green },
                                    ].map((t, i) => (
                                        <div key={i} style={{ textAlign: "center" }}>
                                            <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>{t.label}</p>
                                            <p style={{ color: t.color, fontSize: "0.9rem", fontWeight: 700, margin: "0.15rem 0 0" }}>{t.value}</p>
                                        </div>
                                    ))}
                                </div>
                                {/* Kalemler */}
                                {selectedAutoInvoice.lines && selectedAutoInvoice.lines.length > 0 && (
                                    <div>
                                        <p style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Kalemler</p>
                                        {selectedAutoInvoice.lines.map((line, li) => (
                                            <div key={li} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <div>
                                                    <span style={{ color: C.text, fontSize: "0.78rem", fontWeight: 600 }}>{line.name || "Ürün"}</span>
                                                    <span style={{ color: C.dim, fontSize: "0.7rem", marginLeft: "0.5rem" }}>{line.quantity} {line.unit} × {fmtCurrency(line.unitPrice)}</span>
                                                    <span style={{ color: C.purple, fontSize: "0.7rem", marginLeft: "0.5rem" }}>%{line.vatRate} KDV</span>
                                                </div>
                                                <span style={{ color: C.green, fontSize: "0.8rem", fontWeight: 700 }}>{fmtCurrency(line.lineTotal + (line.vatAmount || 0))}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* QNB Yanıt */}
                                {selectedAutoInvoice.providerResponse?.resultCode && (
                                    <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                                        <p style={{ color: C.dim, fontSize: "0.68rem", fontWeight: 600, margin: 0 }}>QNB YANIT</p>
                                        <p style={{ color: C.text, fontSize: "0.78rem", margin: "0.15rem 0 0" }}>
                                            Kod: {selectedAutoInvoice.providerResponse.resultCode} — {selectedAutoInvoice.providerResponse.resultText || ""}
                                        </p>
                                    </div>
                                )}
                                {/* PDF İndir Butonu */}
                                <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
                                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        onClick={(e) => { e.stopPropagation(); downloadInvoicePdf(selectedAutoInvoice._id, selectedAutoInvoice.invoiceNumber); }}
                                        disabled={pdfLoading === selectedAutoInvoice._id}
                                        style={{
                                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                            border: "none", borderRadius: 8, padding: "0.55rem 1.2rem",
                                            cursor: pdfLoading === selectedAutoInvoice._id ? "not-allowed" : "pointer",
                                            color: "#fff", fontSize: "0.8rem", fontWeight: 700,
                                            display: "flex", alignItems: "center", gap: "0.4rem",
                                            opacity: pdfLoading === selectedAutoInvoice._id ? 0.7 : 1,
                                        }}>
                                        {pdfLoading === selectedAutoInvoice._id
                                            ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> İndiriliyor...</>
                                            : <><FaDownload /> PDF / ZIP İndir</>}
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}
                    </GlassCard>
                )}

                {/* Fatura yoksa bilgi mesajı */}
                {hasConfig && autoInvoices.length === 0 && (
                    <GlassCard style={{ textAlign: "center", padding: "1.5rem", marginBottom: "1.5rem" }}>
                        <FaFileInvoice style={{ fontSize: "2rem", color: C.dim, marginBottom: "0.5rem" }} />
                        <p style={{ color: C.muted, fontSize: "0.85rem", fontWeight: 600, margin: "0 0 0.25rem" }}>Henüz Fatura Kesilmedi</p>
                        <p style={{ color: C.dim, fontSize: "0.78rem", margin: 0 }}>
                            Pazaryerinden yeni sipariş geldiğinde otomatik fatura kesilecektir.
                        </p>
                    </GlassCard>
                )}

                {/* Nasıl Çalışır */}
                <GlassCard style={{ marginBottom: "1.5rem" }}>
                    <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <FaInfoCircle style={{ color: C.blue }} /> Nasıl Çalışır?
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                        {[
                            { step: "1", title: "Sipariş Gelir", desc: "Trendyol, Hepsiburada, N11 veya ÇiçekSepeti'nden sipariş sync edilir", icon: "📦" },
                            { step: "2", title: "Durum Kontrolü", desc: "Sipariş durumu ayarlardaki tetikleme durumlarına uyuyor mu kontrol edilir", icon: "🔍" },
                            { step: "3", title: "Fatura Kesilir", desc: "QNB eSolutions üzerinden otomatik e-Arşiv fatura oluşturulur ve imzalanır", icon: "📄" },
                            { step: "4", title: "Kayıt Yapılır", desc: "Fatura bilgileri DB'ye kaydedilir ve siparişe bağlanır", icon: "✅" },
                        ].map((s, i) => (
                            <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: C.accent + "15", border: "1px solid " + C.accent + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                                    {s.icon}
                                </div>
                                <div>
                                    <p style={{ color: C.text, fontSize: "0.82rem", fontWeight: 700, margin: 0 }}>{s.title}</p>
                                    <p style={{ color: C.dim, fontSize: "0.72rem", margin: "0.15rem 0 0", lineHeight: 1.4 }}>{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════
       RENDER: OTOMATİK FATURA AYAR FORMU
       ═══════════════════════════════════════════════════════ */
    const renderAutoInvoiceConfigForm = () => {
        const formData = autoConfigForm || {};

        const updateField = (path, value) => {
            setAutoConfigForm(prev => {
                const copy = JSON.parse(JSON.stringify(prev));
                const keys = path.split(".");
                let obj = copy;
                for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
                obj[keys[keys.length - 1]] = value;
                return copy;
            });
        };

        const allMarketplaces = ["Trendyol", "Hepsiburada", "N11", "ÇiçekSepeti", "Amazon"];
        const allStatuses = ["Created", "Shipped", "Delivered", "Picking", "Invoiced"];

        const toggleArrayItem = (path, item) => {
            setAutoConfigForm(prev => {
                const copy = JSON.parse(JSON.stringify(prev));
                const keys = path.split(".");
                let obj = copy;
                for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
                const arr = obj[keys[keys.length - 1]] || [];
                const idx = arr.indexOf(item);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(item);
                obj[keys[keys.length - 1]] = arr;
                return copy;
            });
        };

        const inputStyle = {
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.82rem",
            width: "100%", outline: "none", boxSizing: "border-box",
        };
        const labelStyle = { color: C.muted, fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.3rem", display: "block" };
        const sectionTitle = (icon, title) => (
            <h4 style={{ color: "#fff", fontSize: "0.9rem", fontWeight: 700, margin: "1.5rem 0 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {icon} {title}
            </h4>
        );

        return (
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                    <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>⚙️ Otomatik Fatura Ayarları</h3>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setShowAutoInvoiceConfig(false)}
                        style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 8, padding: "0.5rem 0.9rem", cursor: "pointer", color: C.dim, fontSize: "0.8rem" }}>
                        <FaTimes /> Geri
                    </motion.button>
                </div>

                <GlassCard>
                    {/* ── Firma Bilgileri ── */}
                    {sectionTitle(<FaBuilding style={{ color: C.accent }} />, "Firma Bilgileri (Satıcı)")}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>VKN / TCKN *</label><input style={inputStyle} value={formData.supplier.vkn} onChange={e => updateField("supplier.vkn", e.target.value)} placeholder="10 veya 11 haneli" /></div>
                        <div><label style={labelStyle}>Firma Adı *</label><input style={inputStyle} value={formData.supplier.name} onChange={e => updateField("supplier.name", e.target.value)} placeholder="Firma ünvanı" /></div>
                        <div><label style={labelStyle}>Vergi Dairesi</label><input style={inputStyle} value={formData.supplier.taxOffice} onChange={e => updateField("supplier.taxOffice", e.target.value)} placeholder="Vergi dairesi adı" /></div>
                        <div><label style={labelStyle}>Adres</label><input style={inputStyle} value={formData.supplier.street} onChange={e => updateField("supplier.street", e.target.value)} placeholder="Cadde/Sokak" /></div>
                        <div><label style={labelStyle}>İlçe</label><input style={inputStyle} value={formData.supplier.district} onChange={e => updateField("supplier.district", e.target.value)} placeholder="İlçe" /></div>
                        <div><label style={labelStyle}>İl</label><input style={inputStyle} value={formData.supplier.city} onChange={e => updateField("supplier.city", e.target.value)} placeholder="İl" /></div>
                        <div><label style={labelStyle}>Telefon</label><input style={inputStyle} value={formData.supplier.phone} onChange={e => updateField("supplier.phone", e.target.value)} placeholder="05xx xxx xxxx" /></div>
                        <div><label style={labelStyle}>E-posta</label><input style={inputStyle} value={formData.supplier.email} onChange={e => updateField("supplier.email", e.target.value)} placeholder="firma@ornek.com" /></div>
                    </div>

                    {/* ── QNB Bağlantı ── */}
                    {sectionTitle(<FaLink style={{ color: C.purple }} />, "QNB eSolutions Bağlantısı")}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>Kullanıcı Adı *</label><input style={inputStyle} value={formData.qnbCredentials.username} onChange={e => updateField("qnbCredentials.username", e.target.value)} placeholder="VKN.portaltest" /></div>
                        <div><label style={labelStyle}>Şifre *</label><input style={inputStyle} type="password" value={formData.qnbCredentials.password} onChange={e => updateField("qnbCredentials.password", e.target.value)} placeholder="••••••" /></div>
                        <div>
                            <label style={labelStyle}>Ortam</label>
                            <select style={{ ...inputStyle, cursor: "pointer" }} value={formData.qnbCredentials.env} onChange={e => updateField("qnbCredentials.env", e.target.value)}>
                                <option value="test">Test Ortamı</option>
                                <option value="production">Canlı Ortam</option>
                            </select>
                        </div>
                    </div>

                    {/* ── Fatura Ayarları ── */}
                    {sectionTitle(<FaFileInvoice style={{ color: C.green }} />, "Fatura Ayarları")}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>Fatura Seri Kodu</label><input style={inputStyle} value={formData.invoiceSeriesCode} onChange={e => updateField("invoiceSeriesCode", e.target.value)} placeholder="LYS" maxLength={3} /></div>
                        <div><label style={labelStyle}>Varsayılan KDV (%)</label><input style={inputStyle} type="number" value={formData.defaultVatRate} onChange={e => updateField("defaultVatRate", Number(e.target.value))} min={0} max={100} /></div>
                        <div>
                            <label style={labelStyle}>Belge Tipi</label>
                            <select style={{ ...inputStyle, cursor: "pointer" }} value={formData.documentType} onChange={e => updateField("documentType", e.target.value)}>
                                <option value="EARSIVFATURA">e-Arşiv Fatura</option>
                                <option value="TICARIFATURA">Ticari Fatura</option>
                                <option value="TEMELFATURA">Temel Fatura</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Gönderim Şekli</label>
                            <select style={{ ...inputStyle, cursor: "pointer" }} value={formData.sendingType} onChange={e => updateField("sendingType", e.target.value)}>
                                <option value="ELEKTRONIK">Elektronik</option>
                                <option value="KAGIT">Kağıt</option>
                            </select>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Fatura Notu</label><input style={inputStyle} value={formData.defaultNote} onChange={e => updateField("defaultNote", e.target.value)} placeholder="Faturaya eklenecek not (opsiyonel)" /></div>
                    </div>

                    {/* ── Varsayılan Alıcı ── */}
                    {sectionTitle(<FaBuilding style={{ color: C.orange }} />, "Varsayılan Alıcı (Müşteri bilgisi gelmezse)")}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        <div><label style={labelStyle}>TCKN / VKN</label><input style={inputStyle} value={formData.defaultCustomer.vkn} onChange={e => updateField("defaultCustomer.vkn", e.target.value)} placeholder="11 haneli TCKN" /></div>
                        <div><label style={labelStyle}>Ad</label><input style={inputStyle} value={formData.defaultCustomer.firstName} onChange={e => updateField("defaultCustomer.firstName", e.target.value)} placeholder="Ad" /></div>
                        <div><label style={labelStyle}>Soyad</label><input style={inputStyle} value={formData.defaultCustomer.lastName} onChange={e => updateField("defaultCustomer.lastName", e.target.value)} placeholder="Soyad" /></div>
                        <div><label style={labelStyle}>İl</label><input style={inputStyle} value={formData.defaultCustomer.city} onChange={e => updateField("defaultCustomer.city", e.target.value)} placeholder="İl" /></div>
                    </div>

                    {/* ── Pazaryeri & Durum Filtreleri ── */}
                    {sectionTitle(<FaClipboardList style={{ color: C.blue }} />, "Tetikleme Ayarları")}
                    <div style={{ marginBottom: "1rem" }}>
                        <label style={labelStyle}>Aktif Pazaryerleri <span style={{ color: C.dim, fontWeight: 400 }}>(boş = tümü)</span></label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.35rem" }}>
                            {allMarketplaces.map(mp => {
                                const active = formData.enabledMarketplaces.includes(mp);
                                return (
                                    <motion.button key={mp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleArrayItem("enabledMarketplaces", mp)}
                                        style={{
                                            background: active ? C.accent + "20" : C.glass,
                                            border: "1px solid " + (active ? C.accent + "50" : C.glassBr),
                                            borderRadius: 8, padding: "0.4rem 0.85rem", cursor: "pointer",
                                            color: active ? C.accent : C.dim, fontSize: "0.78rem", fontWeight: 600,
                                        }}>
                                        {active ? "✓ " : ""}{mp}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Tetikleme Durumları <span style={{ color: C.dim, fontWeight: 400 }}>(sipariş bu durumlardayken fatura kesilir)</span></label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.35rem" }}>
                            {allStatuses.map(st => {
                                const active = formData.triggerStatuses.includes(st);
                                return (
                                    <motion.button key={st} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        onClick={() => toggleArrayItem("triggerStatuses", st)}
                                        style={{
                                            background: active ? C.green + "20" : C.glass,
                                            border: "1px solid " + (active ? C.green + "50" : C.glassBr),
                                            borderRadius: 8, padding: "0.4rem 0.85rem", cursor: "pointer",
                                            color: active ? C.green : C.dim, fontSize: "0.78rem", fontWeight: 600,
                                        }}>
                                        {active ? "✓ " : ""}{st}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Kaydet ── */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setShowAutoInvoiceConfig(false)}
                            style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.65rem 1.25rem", cursor: "pointer", color: C.dim, fontSize: "0.82rem", fontWeight: 600 }}>
                            İptal
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => saveAutoInvoiceConfig(formData)}
                            disabled={autoInvoiceSaving || !formData.supplier.vkn || !formData.supplier.name}
                            style={{
                                background: (!formData.supplier.vkn || !formData.supplier.name) ? C.dim + "30" : "linear-gradient(135deg, " + C.accent + " 0%, #06b6d4 100%)",
                                border: "none", borderRadius: 10, padding: "0.65rem 1.5rem", cursor: (!formData.supplier.vkn || !formData.supplier.name) ? "not-allowed" : "pointer",
                                color: "#fff", fontSize: "0.82rem", fontWeight: 700,
                                display: "flex", alignItems: "center", gap: "0.4rem", opacity: autoInvoiceSaving ? 0.7 : 1,
                            }}>
                            {autoInvoiceSaving ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaCheckCircle />}
                            {autoInvoiceSaving ? "Kaydediliyor..." : "Kaydet"}
                        </motion.button>
                    </div>
                </GlassCard>
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
                        {activeTab === "auto-invoice" && renderAutoInvoice()}
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
                        onClick={() => { if (!createLoading) { setShowCreateModal(false); setCreateStep(1); setCreateError(""); setCreateResult(null); } }}
                        style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", overflowY: "auto" }}>
                        <motion.div initial={{ scale: 0.92, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 40 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: "linear-gradient(135deg, " + C.card + " 0%, rgba(15,20,25,0.98) 100%)",
                                border: "1px solid " + C.border, borderRadius: 20,
                                padding: "2rem", maxWidth: createStep === 2 ? 780 : 600, width: "100%", maxHeight: "92vh", overflowY: "auto",
                            }}>
                            {/* Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    {createStep > 1 && createStep < 3 && (
                                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                            onClick={() => { setCreateStep(createStep - 1); setCreateError(""); }}
                                            style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 8, padding: "0.35rem 0.6rem", cursor: "pointer", color: C.accent, fontSize: "0.75rem" }}>
                                            ← Geri
                                        </motion.button>
                                    )}
                                    <h3 style={{ background: "linear-gradient(135deg, " + C.accent + ", " + C.purple + ")", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "1.15rem", fontWeight: 800, margin: 0 }}>
                                        {createStep === 1 ? "📄 Yeni Belge Oluştur" : createStep === 2 ? "📝 Fatura Bilgileri" : "✅ Fatura Oluşturuldu"}
                                    </h3>
                                </div>
                                <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => { if (!createLoading) { setShowCreateModal(false); setCreateStep(1); setCreateError(""); setCreateResult(null); } }}
                                    style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red, fontSize: "0.9rem" }}>
                                    <FaTimes />
                                </motion.button>
                            </div>

                            {/* Adım göstergesi */}
                            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                                {[1, 2, 3].map(s => (
                                    <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= createStep ? C.accent : C.glass, transition: "background 0.3s" }} />
                                ))}
                            </div>

                            {/* ═══ ADIM 1: TİP SEÇİMİ ═══ */}
                            {createStep === 1 && (
                                <>
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
                                                style={{ background: createType === t.id ? t.color + "15" : C.glass, border: createType === t.id ? "2px solid " + t.color : "1px solid " + C.glassBr, borderRadius: 12, padding: "1rem", cursor: "pointer", textAlign: "left" }}>
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
                                                style={{ background: "linear-gradient(135deg, " + C.accent + ", #44a08d)", border: "none", borderRadius: 10, padding: "0.6rem 1.25rem", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                                                <FaLink style={{ marginRight: "0.3rem" }} /> Sağlayıcı Bağla
                                            </motion.button>
                                        </div>
                                    ) : (
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            onClick={() => setCreateStep(2)}
                                            style={{ width: "100%", background: "linear-gradient(135deg, " + C.accent + ", #44a08d)", border: "none", borderRadius: 10, padding: "0.75rem", color: "#fff", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                                            <FaArrowRight /> Devam Et
                                        </motion.button>
                                    )}
                                </>
                            )}

                            {/* ═══ ADIM 2: FATURA FORMU ═══ */}
                            {createStep === 2 && (() => {
                                const iF = invoiceForm;
                                const setF = (key, val) => setInvoiceForm(prev => ({ ...prev, [key]: val }));
                                const setLine = (idx, key, val) => {
                                    const newLines = [...iF.lines];
                                    newLines[idx] = { ...newLines[idx], [key]: val };
                                    setF("lines", newLines);
                                };
                                const addLine = () => setF("lines", [...iF.lines, { name: "", quantity: 1, unit: "adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }]);
                                const removeLine = (idx) => { if (iF.lines.length > 1) setF("lines", iF.lines.filter((_, i) => i !== idx)); };

                                // Hesaplamalar
                                const calcLines = iF.lines.map(l => {
                                    const qty = Number(l.quantity || 1);
                                    const price = Number(l.unitPrice || 0);
                                    const disc = Number(l.discountAmount || 0);
                                    const lineTotal = (qty * price) - disc;
                                    const vat = lineTotal * (Number(l.vatRate || 20) / 100);
                                    return { lineTotal, vat, total: lineTotal + vat };
                                });
                                const subTotal = calcLines.reduce((s, l) => s + l.lineTotal, 0);
                                const totalVat = calcLines.reduce((s, l) => s + l.vat, 0);
                                const grandTotal = subTotal + totalVat;

                                const inputStyle = { width: "100%", background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 8, padding: "0.55rem 0.75rem", color: "#fff", fontSize: "0.82rem", outline: "none", boxSizing: "border-box" };
                                const labelStyle = { color: C.muted, fontSize: "0.72rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" };

                                const handleSubmit = async () => {
                                    setCreateError("");
                                    // Validasyon
                                    if (!iF.customerName && !iF.customerVkn) { setCreateError("Alıcı adı veya VKN/TCKN gerekli"); return; }
                                    if (iF.lines.some(l => !l.name || !l.unitPrice)) { setCreateError("Tüm kalemlerde ürün adı ve birim fiyat gerekli"); return; }

                                    const provider = connectedProviders[0];
                                    const isQnb = provider.authType === "qnb";
                                    if (!isQnb) { setCreateError("Şu an sadece QNB eSolutions ile fatura oluşturma desteklenmektedir."); return; }

                                    setCreateLoading(true);
                                    try {
                                        const token = localStorage.getItem("token");
                                        const customerIsIndividual = (iF.customerVkn || "").length === 11;
                                        const res = await fetch(API_URL + "/api/e-invoice/qnb/earchive/create-from-form", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
                                            body: JSON.stringify({
                                                sessionId: provider.sessionId,
                                                vkn: provider.vkn || "7610650466",
                                                env: provider.env || "test",
                                                invoiceData: {
                                                    invoiceTypeCode: "SATIS",
                                                    currency: iF.currency || "TRY",
                                                    note: iF.note || "",
                                                    sendingType: iF.sendingType || "ELEKTRONIK",
                                                    supplier: {
                                                        vkn: provider.vkn || "7610650466",
                                                        name: provider.supplierName || "TEST FIRMA LTD STI",
                                                        taxOffice: provider.taxOffice || "Kadikoy VD",
                                                        street: provider.street || "Test Caddesi No:1",
                                                        district: provider.district || "Kadikoy",
                                                        city: provider.city || "Istanbul",
                                                        country: "Turkiye"
                                                    },
                                                    customer: {
                                                        vkn: iF.customerVkn || "11111111111",
                                                        name: iF.customerName || (iF.customerFirstName + " " + iF.customerLastName).trim(),
                                                        firstName: customerIsIndividual ? (iF.customerFirstName || iF.customerName.split(" ")[0] || "") : "",
                                                        lastName: customerIsIndividual ? (iF.customerLastName || iF.customerName.split(" ").slice(1).join(" ") || "") : "",
                                                        taxOffice: iF.customerTaxOffice || "",
                                                        street: iF.customerStreet || "",
                                                        district: iF.customerDistrict || "Merkez",
                                                        city: iF.customerCity || "Istanbul",
                                                        country: "Turkiye",
                                                        email: iF.customerEmail || "",
                                                        phone: iF.customerPhone || "",
                                                    },
                                                    lines: iF.lines.map(l => ({
                                                        name: l.name,
                                                        quantity: Number(l.quantity || 1),
                                                        unit: l.unit || "adet",
                                                        unitPrice: Number(l.unitPrice || 0),
                                                        vatRate: Number(l.vatRate != null ? l.vatRate : 20),
                                                        discountAmount: Number(l.discountAmount || 0),
                                                    }))
                                                }
                                            })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            setCreateResult(data.data);
                                            setCreateStep(3);
                                            // Belgeleri yenile
                                            setTimeout(() => fetchAllDocuments(), 1500);
                                        } else {
                                            setCreateError(data.message || "Fatura oluşturulamadı");
                                        }
                                    } catch (err) {
                                        setCreateError("Bağlantı hatası: " + (err.message || "Sunucuya erişilemiyor"));
                                    } finally {
                                        setCreateLoading(false);
                                    }
                                };

                                return (
                                    <>
                                        {/* Alıcı Bilgileri */}
                                        <div style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 14, padding: "1.15rem", marginBottom: "1rem" }}>
                                            <h4 style={{ color: C.accent, fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                <FaBuilding /> Alıcı Bilgileri
                                            </h4>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                                <div>
                                                    <label style={labelStyle}>VKN / TCKN *</label>
                                                    <input value={iF.customerVkn} onChange={e => setF("customerVkn", e.target.value)} placeholder="10 veya 11 haneli" style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Firma / Kişi Adı *</label>
                                                    <input value={iF.customerName} onChange={e => setF("customerName", e.target.value)} placeholder="Alıcı adı" style={inputStyle} />
                                                </div>
                                                {(iF.customerVkn || "").length === 11 && (
                                                    <>
                                                        <div>
                                                            <label style={labelStyle}>Ad</label>
                                                            <input value={iF.customerFirstName} onChange={e => setF("customerFirstName", e.target.value)} placeholder="Ad" style={inputStyle} />
                                                        </div>
                                                        <div>
                                                            <label style={labelStyle}>Soyad</label>
                                                            <input value={iF.customerLastName} onChange={e => setF("customerLastName", e.target.value)} placeholder="Soyad" style={inputStyle} />
                                                        </div>
                                                    </>
                                                )}
                                                <div>
                                                    <label style={labelStyle}>Vergi Dairesi</label>
                                                    <input value={iF.customerTaxOffice} onChange={e => setF("customerTaxOffice", e.target.value)} placeholder="Vergi dairesi" style={inputStyle} />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>İl</label>
                                                    <input value={iF.customerCity} onChange={e => setF("customerCity", e.target.value)} placeholder="İl" style={inputStyle} />
                                                </div>
                                                <div style={{ gridColumn: "1 / -1" }}>
                                                    <label style={labelStyle}>Adres</label>
                                                    <input value={iF.customerStreet} onChange={e => setF("customerStreet", e.target.value)} placeholder="Sokak / Cadde / No" style={inputStyle} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fatura Kalemleri */}
                                        <div style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 14, padding: "1.15rem", marginBottom: "1rem" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                                                <h4 style={{ color: C.accent, fontSize: "0.88rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                                    <FaClipboardList /> Fatura Kalemleri
                                                </h4>
                                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={addLine}
                                                    style={{ background: C.accent + "15", border: "1px solid " + C.accent + "30", borderRadius: 8, padding: "0.3rem 0.7rem", cursor: "pointer", color: C.accent, fontSize: "0.72rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                                    <FaPlus /> Kalem Ekle
                                                </motion.button>
                                            </div>

                                            {iF.lines.map((line, idx) => (
                                                <div key={idx} style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.75rem", marginBottom: "0.5rem" }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.7fr 0.7fr 1fr 0.7fr 0.3fr", gap: "0.5rem", alignItems: "end" }}>
                                                        <div>
                                                            <label style={labelStyle}>Ürün/Hizmet *</label>
                                                            <input value={line.name} onChange={e => setLine(idx, "name", e.target.value)} placeholder="Ürün adı" style={inputStyle} />
                                                        </div>
                                                        <div>
                                                            <label style={labelStyle}>Miktar</label>
                                                            <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => setLine(idx, "quantity", e.target.value)} style={inputStyle} />
                                                        </div>
                                                        <div>
                                                            <label style={labelStyle}>Birim</label>
                                                            <select value={line.unit} onChange={e => setLine(idx, "unit", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                                                {["adet", "kg", "lt", "m", "m2", "paket", "kutu", "saat", "gun", "ay"].map(u => (
                                                                    <option key={u} value={u} style={{ background: "#1a1f35" }}>{u}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label style={labelStyle}>Birim Fiyat (₺) *</label>
                                                            <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={e => setLine(idx, "unitPrice", e.target.value)} style={inputStyle} />
                                                        </div>
                                                        <div>
                                                            <label style={labelStyle}>KDV %</label>
                                                            <select value={line.vatRate} onChange={e => setLine(idx, "vatRate", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                                                {[0, 1, 10, 20].map(r => (
                                                                    <option key={r} value={r} style={{ background: "#1a1f35" }}>%{r}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            {iF.lines.length > 1 && (
                                                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removeLine(idx)}
                                                                    style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: 6, padding: "0.45rem", cursor: "pointer", color: C.red, fontSize: "0.75rem", display: "flex", width: "100%", justifyContent: "center" }}>
                                                                    <FaTimes />
                                                                </motion.button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Kalem toplamı */}
                                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.4rem", paddingTop: "0.35rem", borderTop: "1px solid " + C.glassBr }}>
                                                        <span style={{ color: C.dim, fontSize: "0.68rem" }}>Tutar: {fmtCurrency(calcLines[idx]?.lineTotal || 0)}</span>
                                                        <span style={{ color: C.purple, fontSize: "0.68rem" }}>KDV: {fmtCurrency(calcLines[idx]?.vat || 0)}</span>
                                                        <span style={{ color: C.green, fontSize: "0.68rem", fontWeight: 700 }}>Toplam: {fmtCurrency(calcLines[idx]?.total || 0)}</span>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Genel Toplam */}
                                            <div style={{ background: C.green + "08", border: "1px solid " + C.green + "25", borderRadius: 10, padding: "0.85rem", marginTop: "0.75rem" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                                                    <div style={{ textAlign: "center", flex: 1 }}>
                                                        <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>Ara Toplam</p>
                                                        <p style={{ color: "#fff", fontSize: "0.95rem", fontWeight: 700, margin: "0.15rem 0 0" }}>{fmtCurrency(subTotal)}</p>
                                                    </div>
                                                    <div style={{ textAlign: "center", flex: 1 }}>
                                                        <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>KDV Toplam</p>
                                                        <p style={{ color: C.purple, fontSize: "0.95rem", fontWeight: 700, margin: "0.15rem 0 0" }}>{fmtCurrency(totalVat)}</p>
                                                    </div>
                                                    <div style={{ textAlign: "center", flex: 1 }}>
                                                        <p style={{ color: C.dim, fontSize: "0.68rem", margin: 0 }}>Genel Toplam</p>
                                                        <p style={{ color: C.green, fontSize: "1.15rem", fontWeight: 800, margin: "0.15rem 0 0" }}>{fmtCurrency(grandTotal)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Not */}
                                        <div style={{ marginBottom: "1rem" }}>
                                            <label style={labelStyle}>Fatura Notu (opsiyonel)</label>
                                            <input value={iF.note} onChange={e => setF("note", e.target.value)} placeholder="Fatura ile ilgili not..." style={inputStyle} />
                                        </div>

                                        {/* Hata */}
                                        {createError && (
                                            <div style={{ background: C.red + "15", border: "1px solid " + C.red + "30", borderRadius: 10, padding: "0.6rem 0.85rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <FaExclamationTriangle style={{ color: C.red, flexShrink: 0 }} />
                                                <span style={{ color: C.red, fontSize: "0.8rem" }}>{createError}</span>
                                            </div>
                                        )}

                                        {/* Gönder */}
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            onClick={handleSubmit} disabled={createLoading}
                                            style={{
                                                width: "100%", background: createLoading ? C.accent + "50" : "linear-gradient(135deg, " + C.accent + ", #44a08d)",
                                                border: "none", borderRadius: 10, padding: "0.85rem",
                                                color: "#fff", fontSize: "0.92rem", fontWeight: 700,
                                                cursor: createLoading ? "not-allowed" : "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                                            }}>
                                            {createLoading ? <><FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Fatura Oluşturuluyor...</> : <><FaFileInvoice /> Fatura Oluştur ({fmtCurrency(grandTotal)})</>}
                                        </motion.button>
                                    </>
                                );
                            })()}

                            {/* ═══ ADIM 3: SONUÇ ═══ */}
                            {createStep === 3 && createResult && (
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
                                    <h3 style={{ color: C.green, fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>Fatura Başarıyla Oluşturuldu!</h3>
                                    <p style={{ color: C.muted, fontSize: "0.85rem", margin: "0 0 1.5rem" }}>Faturanız QNB eSolutions üzerinden başarıyla oluşturuldu ve imzalandı.</p>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem", textAlign: "left" }}>
                                        {[
                                            { label: "Fatura No", value: createResult.invoiceNumber || "—", color: C.accent },
                                            { label: "UUID", value: (createResult.uuid || "—").substring(0, 18) + "...", color: C.blue },
                                            { label: "Toplam Tutar", value: createResult.totals ? fmtCurrency(createResult.totals.payableAmount) : "—", color: C.green },
                                            { label: "KDV", value: createResult.totals ? fmtCurrency(createResult.totals.totalTax) : "—", color: C.purple },
                                        ].map(f => (
                                            <div key={f.label} style={{ background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.85rem" }}>
                                                <p style={{ color: C.dim, fontSize: "0.68rem", fontWeight: 600, margin: "0 0 0.2rem" }}>{f.label}</p>
                                                <p style={{ color: f.color, fontSize: "0.92rem", fontWeight: 700, margin: 0, fontFamily: "monospace", wordBreak: "break-all" }}>{f.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            onClick={() => { setShowCreateModal(false); setCreateStep(1); setCreateResult(null); setCreateError(""); setInvoiceForm({ customerName: "", customerVkn: "", customerFirstName: "", customerLastName: "", customerStreet: "", customerDistrict: "", customerCity: "Istanbul", customerTaxOffice: "", customerEmail: "", customerPhone: "", lines: [{ name: "", quantity: 1, unit: "adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }], note: "", currency: "TRY", sendingType: "ELEKTRONIK" }); }}
                                            style={{ flex: 1, background: C.glass, border: "1px solid " + C.glassBr, borderRadius: 10, padding: "0.7rem", cursor: "pointer", color: C.muted, fontSize: "0.85rem", fontWeight: 600 }}>
                                            Kapat
                                        </motion.button>
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            onClick={() => { setCreateStep(1); setCreateResult(null); setCreateError(""); setInvoiceForm({ customerName: "", customerVkn: "", customerFirstName: "", customerLastName: "", customerStreet: "", customerDistrict: "", customerCity: "Istanbul", customerTaxOffice: "", customerEmail: "", customerPhone: "", lines: [{ name: "", quantity: 1, unit: "adet", unitPrice: 0, vatRate: 20, discountAmount: 0 }], note: "", currency: "TRY", sendingType: "ELEKTRONIK" }); }}
                                            style={{ flex: 1, background: "linear-gradient(135deg, " + C.accent + ", #44a08d)", border: "none", borderRadius: 10, padding: "0.7rem", cursor: "pointer", color: "#fff", fontSize: "0.85rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                                            <FaPlus /> Yeni Fatura Oluştur
                                        </motion.button>
                                    </div>
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
