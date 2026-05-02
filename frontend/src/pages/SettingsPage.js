import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/AppContext";
import axios from "../services/api";
import {
    FaPalette, FaBell, FaUser, FaShieldAlt,
    FaSun, FaMoon, FaDesktop, FaSave, FaCheck,
    FaEye, FaEyeSlash, FaBox,
    FaArrowUp, FaArrowDown, FaBarcode, FaTag, FaFont,
    FaStore, FaFileInvoice, FaKey, FaCopy, FaTrash,
    FaPlus, FaTimes, FaClock, FaPercent,
    FaLaptop, FaSignOutAlt, FaMapMarkerAlt,
    FaBuilding, FaIdCard, FaCalendarAlt, FaTable, FaDollarSign,
    FaInfoCircle, FaShippingFast
} from "react-icons/fa";
import AutoOrderSettings from "./AutoOrderSettings";
import {
    updateProductMatchPriority,
    getUserPreferences, updateUserPreferences,
    getActiveSessions, revokeSession, revokeAllSessions,
    generateApiKey, revokeApiKey,
    getAutoInvoiceConfig, updateAutoInvoiceConfig, toggleAutoInvoice,
    toggleMarketplaceInvoice, getMarketplaceInvoiceStats
} from "../services/productManagementApi";

/* 
   SPINNER
    */
const spinCSS = `@keyframes stSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;
const Spinner = ({ size = 18, color }) => (
    <>
        <style>{spinCSS}</style>
        <span style={{
            display: "inline-block", width: size, height: size,
            border: `2.5px solid transparent`, borderTopColor: color || "#888",
            borderRightColor: color || "#888",
            borderRadius: "50%", animation: "stSpin 0.6s linear infinite",
        }} />
    </>
);

/* 
   SABTLER
    */
const PLATFORMS = ["Trendyol", "Hepsiburada", "N11", "Amazon", "iekSepeti"];
const PL_COLOR = { Trendyol: "#f27a1a", Hepsiburada: "#ff6000", N11: "#8b5cf6", Amazon: "#f59e0b", iekSepeti: "#ec4899" };
const PL_SHORT = { Trendyol: "TY", Hepsiburada: "HB", N11: "N11", Amazon: "AZ", iekSepeti: "S" };

/* 
   COMPONENT
    */
const SettingsPage = ({ userId }) => {
    const { theme: C, themeMode, setTheme, language, setLanguage, t } = useApp();
    const tr = language === "tr";
    const tabBarRef = useRef(null);

    const [activeTab, setActiveTab] = useState("appearance");
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState("");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    //  Profile 
    const [profileForm, setProfileForm] = useState({
        name: "", email: "", phone: "", company: "",
        taxNumber: "", taxOffice: "",
        street: "", city: "", state: "", zipCode: ""
    });

    //  Notifications 
    const [notifPrefs, setNotifPrefs] = useState({
        orderNotif: true, stockNotif: true, financeNotif: true,
        syncErrorNotif: true, emailNotif: true, smsNotif: false, pushNotif: true,
        lowStockThreshold: 10
    });

    //  Password 
    const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

    //  Product Match Priority 
    const [matchPriority, setMatchPriority] = useState({ primary: "sku", secondary: "barcode", tertiary: "name" });
    const [matchLoading, setMatchLoading] = useState(false);
    const [matchMsg, setMatchMsg] = useState({ type: "", text: "" });

    //  Product Management Prefs 
    const [prodPrefs, setProdPrefs] = useState({
        defaultSafetyStock: 0, defaultVatRate: 20,
        autoSyncEnabled: true, autoSyncStock: true, autoSyncPrice: true, autoSyncInterval: 5
    });
    const [prodPrefsLoading, setProdPrefsLoading] = useState(false);
    const [prodPrefsMsg, setProdPrefsMsg] = useState({ type: "", text: "" });

    //  Marketplace Prefs 
    const [mpPrefs, setMpPrefs] = useState({
        multipliers: { Trendyol: 0, Hepsiburada: 0, N11: 0, Amazon: 0, iekSepeti: 0 },
        commissions: { Trendyol: 0, Hepsiburada: 0, N11: 0, Amazon: 0, iekSepeti: 0 }
    });
    const [mpPrefsLoading, setMpPrefsLoading] = useState(false);
    const [mpPrefsMsg, setMpPrefsMsg] = useState({ type: "", text: "" });

    //  Display Prefs 
    const [displayPrefs, setDisplayPrefs] = useState({
        currency: "TRY", timezone: "Europe/Istanbul",
        dateFormat: "DD/MM/YYYY", tablePageSize: 25
    });

    //  Invoice Config 
    const [invoiceConfig, setInvoiceConfig] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [invoiceMsg, setInvoiceMsg] = useState({ type: "", text: "" });
    const [mpStats, setMpStats] = useState(null); // Pazaryeri bazl fatura istatistikleri

    //  Sessions 
    const [sessions, setSessions] = useState({ activeSessions: [], loginHistory: [] });
    const [sessionsLoading, setSessionsLoading] = useState(false);

    //  API Keys 
    const [apiKeys, setApiKeys] = useState([]);
    const [newKeyName, setNewKeyName] = useState("");
    const [newKeyResult, setNewKeyResult] = useState(null);
    const [apiKeyLoading, setApiKeyLoading] = useState(false);

    const token = localStorage.getItem("token");

    /* 
       RGBA HELPER
        */
    const rgba = (hex, alpha) => {
        if (!hex || hex.charAt(0) !== "#") return `rgba(128,128,128,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    /* 
       DATA LOADING
        */
    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [userRes, prefsRes] = await Promise.all([
                    axios.get("/user/profile", { headers: { Authorization: `Bearer ${token}` } }),
                    getUserPreferences().catch(() => null)
                ]);
                const u = userRes.data;
                setUser(u);
                setProfileForm({
                    name: u.name || "", email: u.email || "",
                    phone: u.profile?.phone || "", company: u.profile?.company || "",
                    taxNumber: u.profile?.taxInfo?.taxNumber || "",
                    taxOffice: u.profile?.taxInfo?.taxOffice || "",
                    street: u.profile?.address?.street || "",
                    city: u.profile?.address?.city || "",
                    state: u.profile?.address?.state || "",
                    zipCode: u.profile?.address?.zipCode || ""
                });
                setApiKeys(u.apiKeys || []);
                const p = prefsRes?.preferences || u.preferences || {};
                setNotifPrefs({
                    orderNotif: p.orderNotifications !== false,
                    stockNotif: p.stockNotifications !== false,
                    financeNotif: p.financeNotifications !== false,
                    syncErrorNotif: p.syncErrorNotifications !== false,
                    emailNotif: p.notifications?.email !== false,
                    smsNotif: p.notifications?.sms === true,
                    pushNotif: p.notifications?.push !== false,
                    lowStockThreshold: p.lowStockAlertThreshold || 10
                });
                setDisplayPrefs({
                    currency: p.currency || "TRY", timezone: p.timezone || "Europe/Istanbul",
                    dateFormat: p.dateFormat || "DD/MM/YYYY", tablePageSize: p.tablePageSize || 25
                });
                setProdPrefs({
                    defaultSafetyStock: p.defaultSafetyStock || 0,
                    defaultVatRate: p.defaultVatRate != null ? p.defaultVatRate : 20,
                    autoSyncEnabled: p.autoSyncEnabled !== false,
                    autoSyncStock: p.autoSyncStock !== false,
                    autoSyncPrice: p.autoSyncPrice !== false,
                    autoSyncInterval: p.autoSyncInterval || 5
                });
                setMpPrefs({
                    multipliers: p.platformPriceMultipliers || { Trendyol: 0, Hepsiburada: 0, N11: 0, Amazon: 0, iekSepeti: 0 },
                    commissions: p.platformCommissionRates || { Trendyol: 0, Hepsiburada: 0, N11: 0, Amazon: 0, iekSepeti: 0 }
                });
                const mp = p.productMatchPriority;
                if (mp?.primary) setMatchPriority(mp);
            } catch (e) {
                console.error("Settings fetch error:", e);
            } finally { setLoading(false); }
        };
        fetchAll();
    }, [token]);

    useEffect(() => {
        if (activeTab === "invoice" && !invoiceConfig) {
            getAutoInvoiceConfig().then(res => {
                if (res?.config) setInvoiceConfig(res.config);
                else if (res?.data) setInvoiceConfig(res.data);
                else setInvoiceConfig({});
            }).catch(() => setInvoiceConfig({}));
            // Pazaryeri bazl istatistikleri de ykle
            getMarketplaceInvoiceStats().then(res => {
                if (res?.data) setMpStats(res.data);
            }).catch(() => {});
        }
        if (activeTab === "security" && sessions.activeSessions.length === 0) {
            setSessionsLoading(true);
            getActiveSessions().then(res => {
                setSessions({ activeSessions: res.activeSessions || [], loginHistory: res.loginHistory || [] });
            }).catch(() => {}).finally(() => setSessionsLoading(false));
        }
    }, [activeTab, invoiceConfig, sessions.activeSessions.length]);

    /* 
       SAVE HANDLERS
        */
    const flash = (setter, type, text, ms = 3000) => {
        setter({ type, text });
        setTimeout(() => setter({ type: "", text: "" }), ms);
    };

    const handleSaveProfile = async () => {
        setSaving(true); setSaveMsg("");
        try {
            await axios.put("/user/profile", {
                name: profileForm.name, phone: profileForm.phone, company: profileForm.company,
                address: { street: profileForm.street, city: profileForm.city, state: profileForm.state, zipCode: profileForm.zipCode },
                taxInfo: { taxNumber: profileForm.taxNumber, taxOffice: profileForm.taxOffice }
            }, { headers: { Authorization: `Bearer ${token}` } });
            localStorage.setItem("userName", profileForm.name);
            setSaveMsg("success"); setTimeout(() => setSaveMsg(""), 2500);
        } catch { setSaveMsg("error"); setTimeout(() => setSaveMsg(""), 3000); }
        finally { setSaving(false); }
    };

    const handleSaveDisplayPrefs = async () => {
        setSaving(true);
        try { await updateUserPreferences(displayPrefs); setSaveMsg("success"); setTimeout(() => setSaveMsg(""), 2500); }
        catch { setSaveMsg("error"); setTimeout(() => setSaveMsg(""), 3000); }
        finally { setSaving(false); }
    };

    const handleSaveNotifications = async () => {
        setSaving(true);
        try {
            await updateUserPreferences({
                orderNotifications: notifPrefs.orderNotif, stockNotifications: notifPrefs.stockNotif,
                financeNotifications: notifPrefs.financeNotif, syncErrorNotifications: notifPrefs.syncErrorNotif,
                lowStockAlertThreshold: notifPrefs.lowStockThreshold,
                notifications: { email: notifPrefs.emailNotif, sms: notifPrefs.smsNotif, push: notifPrefs.pushNotif }
            });
            setSaveMsg("success"); setTimeout(() => setSaveMsg(""), 2500);
        } catch { setSaveMsg("error"); setTimeout(() => setSaveMsg(""), 3000); }
        finally { setSaving(false); }
    };

    const handleSaveProdPrefs = async () => {
        setProdPrefsLoading(true);
        try { await updateUserPreferences(prodPrefs); flash(setProdPrefsMsg, "success", tr ? "ürün ayarlar kaydedildi!" : "Product settings saved!"); }
        catch { flash(setProdPrefsMsg, "error", tr ? "Kaydetme hatas!" : "Save error!", 4000); }
        finally { setProdPrefsLoading(false); }
    };

    const handleSaveMatchPriority = async () => {
        setMatchLoading(true);
        try { await updateProductMatchPriority(matchPriority); flash(setMatchMsg, "success", tr ? "ncelik sras kaydedildi!" : "Priority saved!"); }
        catch (e) { flash(setMatchMsg, "error", e.response?.data?.message || (tr ? "Kaydetme hatas!" : "Save error!"), 4000); }
        finally { setMatchLoading(false); }
    };

    const handleSaveMpPrefs = async () => {
        setMpPrefsLoading(true);
        try { await updateUserPreferences({ platformPriceMultipliers: mpPrefs.multipliers, platformCommissionRates: mpPrefs.commissions }); flash(setMpPrefsMsg, "success", tr ? "Pazaryeri ayarlar kaydedildi!" : "Marketplace settings saved!"); }
        catch { flash(setMpPrefsMsg, "error", tr ? "Kaydetme hatas!" : "Save error!", 4000); }
        finally { setMpPrefsLoading(false); }
    };

    const handleSaveInvoice = async () => {
        setInvoiceLoading(true);
        try { await updateAutoInvoiceConfig(invoiceConfig); flash(setInvoiceMsg, "success", tr ? "Fatura ayarlar kaydedildi!" : "Invoice settings saved!"); }
        catch { flash(setInvoiceMsg, "error", tr ? "Kaydetme hatas!" : "Save error!", 4000); }
        finally { setInvoiceLoading(false); }
    };

    const handleToggleInvoice = async () => {
        try { const res = await toggleAutoInvoice(); setInvoiceConfig(prev => ({ ...prev, enabled: res.enabled ?? !prev?.enabled })); }
        catch (e) { console.error(e); }
    };

    const handleToggleMarketplace = async (mpName) => {
        try {
            const res = await toggleMarketplaceInvoice(mpName);
            if (res.success) {
                setInvoiceConfig(prev => ({ ...prev, enabledMarketplaces: res.enabledMarketplaces || [] }));
                // mpStats' da güncelle
                setMpStats(prev => {
                    if (!prev?.marketplaces) return prev;
                    return {
                        ...prev,
                        marketplaces: prev.marketplaces.map(m =>
                            m.marketplace === res.marketplace ? { ...m, enabled: res.enabled } : m
                        )
                    };
                });
            }
        } catch (e) { console.error(e); }
    };

    const handleChangePassword = async () => {
        setPasswordMsg({ type: "", text: "" });
        if (passwordForm.newPassword !== passwordForm.confirmPassword) { flash(setPasswordMsg, "error", tr ? "şifreler eşleşmiyor!" : "Passwords don't match!"); return; }
        if (passwordForm.newPassword.length < 6) { flash(setPasswordMsg, "error", tr ? "şifre en az 6 karakter olmal!" : "Min 6 characters!"); return; }
        setSaving(true);
        try {
            await axios.put("/user/change-password", { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }, { headers: { Authorization: `Bearer ${token}` } });
            flash(setPasswordMsg, "success", tr ? "şifre başarıyla değiştirildi!" : "Password changed!");
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (e) { flash(setPasswordMsg, "error", e.response?.data?.message || (tr ? "şifre değiştirilemedi!" : "Failed!")); }
        finally { setSaving(false); }
    };

    const handleCreateApiKey = async () => {
        if (!newKeyName.trim()) return;
        setApiKeyLoading(true);
        try {
            const res = await generateApiKey(newKeyName.trim());
            setNewKeyResult(res.key);
            setApiKeys(prev => [...prev, { _id: res._id || Date.now(), name: res.name, key: res.key, createdAt: res.createdAt }]);
            setNewKeyName("");
        } catch (e) { console.error(e); }
        finally { setApiKeyLoading(false); }
    };

    const handleRevokeApiKey = async (keyId) => { try { await revokeApiKey(keyId); setApiKeys(prev => prev.filter(k => k._id !== keyId)); } catch (e) { console.error(e); } };
    const handleRevokeSession = async (sid) => { try { await revokeSession(sid); setSessions(prev => ({ ...prev, activeSessions: prev.activeSessions.filter(s => s.id !== sid) })); } catch (e) { console.error(e); } };
    const handleRevokeAllSessions = async () => { try { await revokeAllSessions(); setSessions(prev => ({ ...prev, activeSessions: [] })); } catch (e) { console.error(e); } };

    const movePriority = (field, direction) => {
        const order = [matchPriority.primary, matchPriority.secondary, matchPriority.tertiary];
        const idx = order.indexOf(field);
        if (idx < 0) return;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx > 2) return;
        [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
        setMatchPriority({ primary: order[0], secondary: order[1], tertiary: order[2] });
    };

    /* 
       STYLES
        */
    const card = {
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
        padding: "1.5rem", backdropFilter: "blur(20px)",
    };
    const inp = {
        width: "100%", padding: "0.65rem 0.9rem", background: C.inputBg || C.glass,
        border: `1px solid ${C.inputBorder || C.glassBr}`, borderRadius: 10, color: C.text,
        fontSize: "0.88rem", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
        boxSizing: "border-box",
    };
    const sel = { ...inp, cursor: "pointer", appearance: "auto" };
    const btnP = {
        padding: "0.6rem 1.4rem", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
        border: "none", borderRadius: 10, color: "#fff", fontSize: "0.84rem",
        fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.45rem",
        boxShadow: `0 4px 14px ${rgba(C.accent, 0.25)}`,
    };
    const focusRing = (e, clr) => { e.target.style.borderColor = clr || C.accent; e.target.style.boxShadow = `0 0 0 3px ${rgba(clr || C.accent, 0.12)}`; };
    const blurRing = (e) => { e.target.style.borderColor = C.inputBorder || C.glassBr; e.target.style.boxShadow = "none"; };

    /* 
       REUSABLE COMPONENTS
        */
    const SH = ({ icon, title, desc }) => (
        <div style={{ marginBottom: "1rem" }}>
            <h3 style={{ color: C.text, fontSize: "0.95rem", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ fontSize: "1.05rem" }}>{icon}</span> {title}
            </h3>
            {desc && <p style={{ color: C.muted, fontSize: "0.78rem", margin: "0.25rem 0 0 0", lineHeight: 1.5 }}>{desc}</p>}
        </div>
    );

    const Info = ({ children, color }) => (
        <div style={{
            padding: "0.75rem 1rem", borderRadius: 10, marginBottom: "1rem",
            background: rgba(color || C.accent, 0.05), border: `1px solid ${rgba(color || C.accent, 0.12)}`,
            display: "flex", alignItems: "flex-start", gap: "0.5rem",
        }}>
            <FaInfoCircle style={{ color: color || C.accent, fontSize: "0.85rem", marginTop: "0.15rem", flexShrink: 0 }} />
            <p style={{ color: C.muted, fontSize: "0.78rem", margin: 0, lineHeight: 1.55 }}>{children}</p>
        </div>
    );

    const Msg = ({ msg }) => {
        if (!msg?.text) return null;
        const ok = msg.type === "success";
        const clr = ok ? (C.green || "#22c55e") : (C.red || "#ef4444");
        return (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                style={{ color: clr, fontSize: "0.82rem", fontWeight: 600, margin: "0 0 0.75rem 0", padding: "0.55rem 0.9rem", borderRadius: 10, background: rgba(clr, 0.07), border: `1px solid ${rgba(clr, 0.18)}`, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                {ok ? "" : ""} {msg.text}
            </motion.div>
        );
    };

    const Save = ({ onClick, loading: l, disabled, extra }) => (
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={onClick} disabled={l || disabled}
            style={{ ...btnP, opacity: (l || disabled) ? 0.5 : 1, cursor: (l || disabled) ? "not-allowed" : "pointer", ...extra }}>
            {l ? <Spinner size={15} color="#fff" /> : <FaSave />}
            {l ? (tr ? "Kaydediliyor..." : "Saving...") : (tr ? "Kaydet" : "Save")}
        </motion.button>
    );

    const Toggle = ({ value, onChange }) => (
        <motion.div whileTap={{ scale: 0.9 }} onClick={() => onChange(!value)}
            style={{
                width: 46, height: 25, borderRadius: 13, cursor: "pointer",
                background: value ? C.accent : rgba(C.dim, 0.25),
                border: `1.5px solid ${value ? C.accent : rgba(C.dim, 0.3)}`,
                position: "relative", transition: "background 0.25s", flexShrink: 0,
            }}>
            <motion.div animate={{ x: value ? 21 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{ width: 19, height: 19, borderRadius: "50%", background: value ? "#fff" : C.muted, position: "absolute", top: 2, boxShadow: value ? `0 2px 6px ${rgba(C.accent, 0.35)}` : "none" }} />
        </motion.div>
    );

    const TR = ({ icon, label, desc, value, onChange }) => (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0.75rem 1rem", background: rgba(C.text, 0.02),
            border: `1px solid ${rgba(C.text, 0.05)}`, borderRadius: 11, gap: "0.75rem",
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "1.15rem", flexShrink: 0 }}>{icon}</span>
                <div style={{ minWidth: 0 }}>
                    <p style={{ color: C.text, fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>{label}</p>
                    {desc && <p style={{ color: C.dim, fontSize: "0.72rem", margin: "0.1rem 0 0 0", lineHeight: 1.35 }}>{desc}</p>}
                </div>
            </div>
            <Toggle value={value} onChange={onChange} />
        </div>
    );

    const IF = ({ icon, label, value, onChange, disabled, type = "text", placeholder, help }) => (
        <div>
            <label style={{ color: C.muted, fontSize: "0.73rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.35rem" }}>
                {icon} {label}
            </label>
            <input type={type} value={value} placeholder={placeholder}
                onChange={e => !disabled && onChange(e.target.value)} disabled={disabled}
                style={{ ...inp, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "text", background: disabled ? rgba(C.dim, 0.06) : (C.inputBg || C.glass) }}
                onFocus={e => { if (!disabled) focusRing(e); }} onBlur={blurRing} />
            {help && <p style={{ color: C.dim, fontSize: "0.68rem", margin: "0.25rem 0 0 0", lineHeight: 1.35 }}>{help}</p>}
        </div>
    );

    const SF = ({ icon, label, value, onChange, children, help }) => (
        <div>
            <label style={{ color: C.muted, fontSize: "0.73rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.35rem" }}>
                {icon} {label}
            </label>
            <select value={value} onChange={e => onChange(e.target.value)} style={sel} onFocus={focusRing} onBlur={blurRing}>
                {children}
            </select>
            {help && <p style={{ color: C.dim, fontSize: "0.68rem", margin: "0.25rem 0 0 0", lineHeight: 1.35 }}>{help}</p>}
        </div>
    );

    /* 
       TABS
        */
    const tabs = [
        { id: "appearance", icon: <FaPalette />, label: tr ? "Grnm" : "Appearance" },
        { id: "notifications", icon: <FaBell />, label: tr ? "Bildirimler" : "Notifications" },
        { id: "productMatch", icon: <FaBox />, label: tr ? "ürün Yönetimi" : "Products" },
        { id: "marketplace", icon: <FaStore />, label: tr ? "Pazaryeri" : "Marketplace" },
        { id: "autoOrder", icon: <FaShippingFast />, label: tr ? "Sipariş leme" : "Order Processing" },
        { id: "invoice", icon: <FaFileInvoice />, label: tr ? "Fatura" : "Invoice" },
        { id: "account", icon: <FaUser />, label: tr ? "Hesap" : "Account" },
        { id: "security", icon: <FaShieldAlt />, label: tr ? "Güvenlik" : "Security" },
    ];

    /* 
       RENDER
        */
    return (
        <div style={{ padding: "clamp(0.75rem, 2vw, 1.5rem)", color: C.text, minHeight: "100vh" }}>

            {/*  HEADER  */}
            <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                    <h1 style={{
                        fontSize: "clamp(1.3rem, 2.8vw, 1.7rem)", fontWeight: 800, margin: 0,
                        background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                         {t("settings.title")}
                    </h1>
                    <p style={{ color: C.muted, fontSize: "0.8rem", margin: "0.2rem 0 0 0" }}>
                        {tr ? "Tüm program ayarlarınızı buradan yönetin" : "Manage all your application settings here"}
                    </p>
                </div>
            </div>

            {/*  TOP TAB BAR  */}
            <div ref={tabBarRef} style={{
                display: "flex", gap: "0.35rem", marginBottom: "1.25rem",
                overflowX: "auto", overflowY: "hidden",
                padding: "0.4rem", borderRadius: 14,
                background: C.card, border: `1px solid ${C.border}`,
                backdropFilter: "blur(20px)",
                scrollbarWidth: "none", msOverflowStyle: "none",
            }}>
                <style>{`div::-webkit-scrollbar { height: 0; width: 0; }`}</style>
                {tabs.map(tab => {
                    const active = activeTab === tab.id;
                    return (
                        <motion.button key={tab.id}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.45rem",
                                padding: "0.6rem 1.1rem", borderRadius: 10, cursor: "pointer",
                                whiteSpace: "nowrap", flexShrink: 0,
                                background: active ? `linear-gradient(135deg, ${rgba(C.accent, 0.15)}, ${rgba(C.purple, 0.1)})` : "transparent",
                                border: active ? `1.5px solid ${rgba(C.accent, 0.35)}` : "1.5px solid transparent",
                                color: active ? C.accent : C.muted,
                                fontSize: "0.82rem", fontWeight: active ? 700 : 500,
                                transition: "all 0.2s",
                                boxShadow: active ? `0 2px 8px ${rgba(C.accent, 0.12)}` : "none",
                            }}>
                            <span style={{ fontSize: "0.9rem" }}>{tab.icon}</span>
                            <span>{tab.label}</span>
                            {active && (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, marginLeft: "0.15rem" }} />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/*  CONTENT  */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}>

{/* 
    TAB 1: GRNM
     */}
{activeTab === "appearance" && (
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

    {/* Tema  sol st */}
    <div style={card}>
        <SH icon="" title={tr ? "Tema Seimi" : "Theme Selection"}
            desc={tr ? "Koyu tema gz yorgunluunu azaltr, ak tema gn nda daha iyi okunur." : "Dark theme reduces eye strain, light theme is better in daylight."} />
        <div style={{ display: "flex", gap: "0.6rem" }}>
            {[
                { id: "dark", icon: <FaMoon />, label: tr ? "Koyu" : "Dark", color: "#8b5cf6" },
                { id: "light", icon: <FaSun />, label: tr ? "Ak" : "Light", color: "#f59e0b" },
                { id: "system", icon: <FaDesktop />, label: tr ? "Sistem" : "System", color: C.accent },
            ].map(o => {
                const s = themeMode === o.id;
                return (
                    <motion.button key={o.id} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setTheme(o.id)}
                        style={{
                            flex: 1, padding: "1rem 0.5rem", borderRadius: 12, cursor: "pointer",
                            background: s ? rgba(o.color, 0.1) : rgba(C.text, 0.02),
                            border: s ? `2px solid ${o.color}` : `1.5px solid ${rgba(C.text, 0.07)}`,
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem",
                        }}>
                        <span style={{ fontSize: "1.4rem", color: s ? o.color : C.dim }}>{o.icon}</span>
                        <span style={{ color: s ? o.color : C.text, fontSize: "0.8rem", fontWeight: 700 }}>{o.label}</span>
                        {s && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: 18, height: 18, borderRadius: "50%", background: o.color, display: "flex", alignItems: "center", justifyContent: "center" }}><FaCheck style={{ color: "#fff", fontSize: "0.5rem" }} /></motion.div>}
                    </motion.button>
                );
            })}
        </div>
    </div>

    {/* Dil  sa st */}
    <div style={card}>
        <SH icon="" title={tr ? "Arayz Dili" : "Interface Language"}
            desc={tr ? "Tüm men ve aklamalaürün gösterilecei dili sein. Annda uygulanr." : "Choose the language for all menus. Applied instantly."} />
        <div style={{ display: "flex", gap: "0.6rem" }}>
            {[
                { id: "tr", flag: "", label: "Trke" },
                { id: "en", flag: "", label: "English" },
            ].map(o => {
                const s = language === o.id;
                return (
                    <motion.button key={o.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setLanguage(o.id)}
                        style={{
                            flex: 1, padding: "1rem", borderRadius: 12, cursor: "pointer",
                            background: s ? rgba(C.accent, 0.1) : rgba(C.text, 0.02),
                            border: s ? `2px solid ${C.accent}` : `1.5px solid ${rgba(C.text, 0.07)}`,
                            display: "flex", alignItems: "center", gap: "0.7rem",
                        }}>
                        <span style={{ fontSize: "1.8rem" }}>{o.flag}</span>
                        <span style={{ color: s ? C.accent : C.text, fontSize: "0.9rem", fontWeight: 700 }}>{o.label}</span>
                        {s && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ marginLeft: "auto", width: 20, height: 20, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}><FaCheck style={{ color: "#fff", fontSize: "0.55rem" }} /></motion.div>}
                    </motion.button>
                );
            })}
        </div>
    </div>

    {/* Grntleme Tercihleri  tam genilik */}
    <div style={{ ...card, gridColumn: "1 / -1" }}>
        <SH icon="" title={tr ? "Grntleme Tercihleri" : "Display Preferences"}
            desc={tr ? "Tablolarda, raporlarda ve faturalarda kullanılacak para birimi, tarih formatı ve sayfa boyutu." : "Currency, date format and page size used in tables, reports and invoices."} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
            <SF icon={<FaDollarSign />} label={tr ? "Para Birimi" : "Currency"} value={displayPrefs.currency} onChange={v => setDisplayPrefs(p => ({ ...p, currency: v }))} help={tr ? "Fiyat ve raporlarda" : "In prices & reports"}>
                <option value="TRY"> TRY</option><option value="USD">$ USD</option><option value="EUR"> EUR</option>
            </SF>
            <SF icon={<FaClock />} label={tr ? "Zaman Dilimi" : "Timezone"} value={displayPrefs.timezone} onChange={v => setDisplayPrefs(p => ({ ...p, timezone: v }))} help={tr ? "Sipariş zamanlar" : "Order timestamps"}>
                <option value="Europe/Istanbul">Istanbul (UTC+3)</option><option value="Europe/London">London (UTC+0)</option><option value="Europe/Berlin">Berlin (UTC+1)</option><option value="America/New_York">New York (UTC-5)</option>
            </SF>
            <SF icon={<FaCalendarAlt />} label={tr ? "Tarih Format" : "Date Format"} value={displayPrefs.dateFormat} onChange={v => setDisplayPrefs(p => ({ ...p, dateFormat: v }))} help={tr ? "Tüm tarih gösterimleri" : "All date displays"}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </SF>
            <SF icon={<FaTable />} label={tr ? "Tablo Satr" : "Page Size"} value={displayPrefs.tablePageSize} onChange={v => setDisplayPrefs(p => ({ ...p, tablePageSize: Number(v) }))} help={tr ? "Sayfa ba satr" : "Rows per page"}>
                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </SF>
        </div>
        <div style={{ marginTop: "1.25rem" }}><Save onClick={handleSaveDisplayPrefs} loading={saving} /></div>
    </div>
</div>
)}

{/* 
    TAB 2: BLDRMLER
     */}
{activeTab === "notifications" && (
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
    <div style={{ gridColumn: "1 / -1" }}>
        <Info color={C.accent}>
            {tr ? "Bildirim ayarları, hangi olaylarda ve hangi kanallardan haberdar olacağınızı belirler. Kritik stok uyarıları her zaman aktiftir." : "Notification settings determine which events and channels you'll be notified through. Critical stock alerts are always active."}
        </Info>
    </div>

    {/* Sol: Bildirim Trleri */}
    <div style={card}>
        <SH icon="" title={tr ? "Bildirim Trleri" : "Notification Types"}
            desc={tr ? "Hangi olaylarda bildirim almak istediİşinizi sein." : "Choose which events trigger notifications."} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <TR icon="" label={tr ? "Sipariş Bildirimleri" : "Order Notifications"} desc={tr ? "Yeni sipariş, iptal, iİade" : "New order, cancel, return"} value={notifPrefs.orderNotif} onChange={v => setNotifPrefs(p => ({ ...p, orderNotif: v }))} />
            <TR icon="" label={tr ? "Stok Bildirimleri" : "Stock Notifications"} desc={tr ? "Dk stok, tkenen ürün" : "Low stock, out of stock"} value={notifPrefs.stockNotif} onChange={v => setNotifPrefs(p => ({ ...p, stockNotif: v }))} />
            <TR icon="" label={tr ? "Finans Bildirimleri" : "Finance Notifications"} desc={tr ? "Fatura, deme, komisyon" : "Invoice, payment, commission"} value={notifPrefs.financeNotif} onChange={v => setNotifPrefs(p => ({ ...p, financeNotif: v }))} />
            <TR icon="" label={tr ? "Sync Hata Bildirimleri" : "Sync Error Notifications"} desc={tr ? "Platform balant hatalar" : "Platform connection errors"} value={notifPrefs.syncErrorNotif} onChange={v => setNotifPrefs(p => ({ ...p, syncErrorNotif: v }))} />
        </div>
    </div>

    {/* Sa: Kanallar + Eik */}
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={card}>
            <SH icon="" title={tr ? "Bildirim Kanallar" : "Channels"}
                desc={tr ? "Bildirimlerin hangi yollarla ulaacan belirleyin." : "Choose how notifications reach you."} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <TR icon="" label={tr ? "E-posta" : "Email"} desc={tr ? "nemli güncellemeler" : "Important updates"} value={notifPrefs.emailNotif} onChange={v => setNotifPrefs(p => ({ ...p, emailNotif: v }))} />
                <TR icon="" label="SMS" desc={tr ? "Acil bildirimler (ek cret)" : "Urgent (extra charge)"} value={notifPrefs.smsNotif} onChange={v => setNotifPrefs(p => ({ ...p, smsNotif: v }))} />
                <TR icon="" label="Push" desc={tr ? "Tarayc anlk bildirim" : "Browser push"} value={notifPrefs.pushNotif} onChange={v => setNotifPrefs(p => ({ ...p, pushNotif: v }))} />
            </div>
        </div>
        <div style={card}>
            <SH icon="" title={tr ? "Kritik Stok Eşiği" : "Low Stock Threshold"}
                desc={tr ? "Stok bu sayının altına düşünce bildirim gönderilir." : "Notification sent when stock falls below this."} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input type="number" min={0} max={1000} value={notifPrefs.lowStockThreshold}
                    onChange={e => setNotifPrefs(p => ({ ...p, lowStockThreshold: Number(e.target.value) || 0 }))}
                    style={{ ...inp, width: 100, textAlign: "center", fontSize: "1rem", fontWeight: 700 }}
                    onFocus={focusRing} onBlur={blurRing} />
                <span style={{ color: C.dim, fontSize: "0.82rem", fontWeight: 600 }}>{tr ? "İadet" : "units"}</span>
            </div>
        </div>
    </div>

    <div style={{ gridColumn: "1 / -1" }}><Save onClick={handleSaveNotifications} loading={saving} /></div>
</div>
)}

{/* 
    TAB 3: RN YNETM
     */}
{activeTab === "productMatch" && (
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
    <div style={{ gridColumn: "1 / -1" }}>
        <Info color={C.purple}>
            {tr ? "Bu ayarlar, ürünlerin pazaryerleri arasında nasıl eşleştirileceğini, stok/fiyat senkâronizasyonunu ve yeni ürünler için varsayılan değerleri belirler." : "These settings control how products are matched across marketplaces, stock/price sync, and default values for new products."}
        </Info>
    </div>

    {/* Sol: Eletirme ncelii */}
    <div style={card}>
        <SH icon="" title={tr ? "Eletirme ncelik Sras" : "Matching Priority"}
            desc={tr ? "Pazaryerlerinden ürün ekerken hangi alann ncelikli kullanlacan belirler." : "Determines which field is used first when matching products."} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "1rem" }}>
            {[matchPriority.primary, matchPriority.secondary, matchPriority.tertiary].map((field, idx) => {
                const labels = {
                    sku: { label: tr ? "Model Kodu (SKU)" : "SKU", icon: <FaTag />, color: "#8b5cf6", desc: tr ? "retici model numaras" : "Manufacturer model" },
                    barcode: { label: tr ? "Barkod" : "Barcode", icon: <FaBarcode />, color: "#f59e0b", desc: tr ? "EAN/UPC barkod" : "EAN/UPC barcode" },
                    name: { label: tr ? "ürün Ad" : "Name", icon: <FaFont />, color: "#22c55e", desc: tr ? "Balk eletirme" : "Title matching" }
                };
                const info = labels[field] || { label: field, icon: <FaBox />, color: C.accent, desc: "" };
                return (
                    <div key={field} style={{
                        display: "flex", alignItems: "center", gap: "0.6rem",
                        padding: "0.75rem 0.9rem", borderRadius: 11,
                        background: rgba(info.color, 0.05), border: `1px solid ${rgba(info.color, 0.18)}`,
                    }}>
                        <span style={{ width: 26, height: 26, borderRadius: 7, background: rgba(info.color, 0.15), color: info.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
                        <span style={{ color: info.color, fontSize: "1rem", flexShrink: 0 }}>{info.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: C.text, fontSize: "0.84rem", fontWeight: 700, margin: 0 }}>{info.label}</p>
                            <p style={{ color: C.dim, fontSize: "0.68rem", margin: "0.05rem 0 0 0" }}>{info.desc}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <motion.button whileTap={{ scale: 0.85 }} onClick={() => movePriority(field, "up")} disabled={idx === 0}
                                style={{ background: idx === 0 ? "transparent" : rgba(C.accent, 0.1), border: `1px solid ${idx === 0 ? rgba(C.dim, 0.12) : rgba(C.accent, 0.25)}`, borderRadius: 5, padding: "3px 6px", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? C.dim : C.accent, fontSize: "0.6rem", opacity: idx === 0 ? 0.3 : 1 }}>
                                <FaArrowUp />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.85 }} onClick={() => movePriority(field, "down")} disabled={idx === 2}
                                style={{ background: idx === 2 ? "transparent" : rgba(C.accent, 0.1), border: `1px solid ${idx === 2 ? rgba(C.dim, 0.12) : rgba(C.accent, 0.25)}`, borderRadius: 5, padding: "3px 6px", cursor: idx === 2 ? "default" : "pointer", color: idx === 2 ? C.dim : C.accent, fontSize: "0.6rem", opacity: idx === 2 ? 0.3 : 1 }}>
                                <FaArrowDown />
                            </motion.button>
                        </div>
                    </div>
                );
            })}
        </div>
        <Msg msg={matchMsg} />
        <Save onClick={handleSaveMatchPriority} loading={matchLoading} />
    </div>

    {/* Sa: Sync + Varsaylanlar */}
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={card}>
            <SH icon="" title={tr ? "Otomatik Senkâronizasyon" : "Auto Sync"}
                desc={tr ? "Stok ve fiyat değişikliklerinin platformlara otomatik yanstlmas." : "Auto-push stock and price changes to platforms."} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                <TR icon="" label={tr ? "Otomatik Sync" : "Auto Sync"} desc={tr ? "Ana anahtar" : "Master switch"} value={prodPrefs.autoSyncEnabled} onChange={v => setProdPrefs(p => ({ ...p, autoSyncEnabled: v }))} />
                <TR icon="" label={tr ? "Stok Sync" : "Stock Sync"} value={prodPrefs.autoSyncStock} onChange={v => setProdPrefs(p => ({ ...p, autoSyncStock: v }))} />
                <TR icon="" label={tr ? "Fiyat Sync" : "Price Sync"} value={prodPrefs.autoSyncPrice} onChange={v => setProdPrefs(p => ({ ...p, autoSyncPrice: v }))} />
            </div>
            <SF icon={<FaClock />} label={tr ? "Sync Aral" : "Sync Interval"} value={prodPrefs.autoSyncInterval} onChange={v => setProdPrefs(p => ({ ...p, autoSyncInterval: Number(v) }))} help={tr ? "Platformlar bu aralkta güncellenir" : "Platforms updated at this interval"}>
                <option value={5}>5 dk</option><option value={10}>10 dk</option><option value={15}>15 dk</option><option value={30}>30 dk</option><option value={60}>60 dk</option>
            </SF>
        </div>
        <div style={card}>
            <SH icon="" title={tr ? "Varsaylan Deerler" : "Defaults"}
                desc={tr ? "Yeni ürün eklerken otomatik atanacak deerler." : "Auto-assigned values for new products."} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                    <label style={{ color: C.muted, fontSize: "0.73rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.35rem" }}> {tr ? "Güvenlik Stoğu" : "Safety Stock"}</label>
                    <input type="number" min={0} max={9999} value={prodPrefs.defaultSafetyStock} onChange={e => setProdPrefs(p => ({ ...p, defaultSafetyStock: Number(e.target.value) || 0 }))} style={inp} onFocus={focusRing} onBlur={blurRing} />
                    <p style={{ color: C.dim, fontSize: "0.66rem", margin: "0.2rem 0 0 0" }}>{tr ? "Platform stok = gerek  güvenlik" : "Platform = real  safety"}</p>
                </div>
                <SF icon={<FaPercent />} label={tr ? "KDV Oran" : "VAT Rate"} value={prodPrefs.defaultVatRate} onChange={v => setProdPrefs(p => ({ ...p, defaultVatRate: Number(v) }))} help={tr ? "Yeni ürünlere atanr" : "Assigned to new products"}>
                    <option value={0}>%0</option><option value={1}>%1</option><option value={10}>%10</option><option value={20}>%20</option>
                </SF>
            </div>
        </div>
    </div>

    <div style={{ gridColumn: "1 / -1" }}>
        <Msg msg={prodPrefsMsg} />
        <Save onClick={handleSaveProdPrefs} loading={prodPrefsLoading} />
    </div>
</div>
)}

{/* 
    TAB 4: PAZARYERI
     */}
{activeTab === "marketplace" && (
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
    <div style={{ gridColumn: "1 / -1" }}>
        <Info color="#f27a1a">
            {tr ? "Her pazaryerinin komisyon oranını ve fiyat çarpanını ayarlayın. Komisyon kâr hesabında, çarpan otomatik fiyatlandırmada kullanılır." : "Set commission rates and price multipliers. Commission is used in profit calculation, multiplier in automatic priçing."}
        </Info>
    </div>

    {/* Sol: Komisyon */}
    <div style={card}>
        <SH icon="" title={tr ? "Komisyon Oranlar" : "Commission Rates"}
            desc={tr ? "Net kâr hesaplamasnda sat fiyatndan dlr." : "Deducted from sale price in net profit calculation."} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {PLATFORMS.map(pl => (
                <div key={pl} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.65rem 0.85rem", borderRadius: 10, background: rgba(PL_COLOR[pl], 0.04), border: `1px solid ${rgba(PL_COLOR[pl], 0.12)}` }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: rgba(PL_COLOR[pl], 0.12), color: PL_COLOR[pl], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 }}>{PL_SHORT[pl]}</span>
                    <span style={{ color: C.text, fontSize: "0.84rem", fontWeight: 600, flex: 1 }}>{pl}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span style={{ color: C.dim, fontSize: "0.78rem" }}>%</span>
                        <input type="number" min={0} max={100} step={0.1} value={mpPrefs.commissions[pl] || 0}
                            onChange={e => setMpPrefs(p => ({ ...p, commissions: { ...p.commissions, [pl]: Number(e.target.value) || 0 } }))}
                            style={{ ...inp, width: 72, textAlign: "center", padding: "0.45rem", fontWeight: 700 }}
                            onFocus={e => focusRing(e, PL_COLOR[pl])} onBlur={blurRing} />
                    </div>
                </div>
            ))}
        </div>
    </div>

    {/* Sa: arpanlar */}
    <div style={card}>
        <SH icon="" title={tr ? "Fiyat arpanlar" : "Price Multipliers"}
            desc={tr ? "Platforma gönderilen fiyata eklenen % fark. Negatif = indirim." : "% difference added to platform price. Negative = discount."} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {PLATFORMS.map(pl => (
                <div key={pl} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.65rem 0.85rem", borderRadius: 10, background: rgba(C.text, 0.02), border: `1px solid ${rgba(C.text, 0.05)}` }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: rgba(PL_COLOR[pl], 0.12), color: PL_COLOR[pl], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 }}>{PL_SHORT[pl]}</span>
                    <span style={{ color: C.text, fontSize: "0.84rem", fontWeight: 600, flex: 1 }}>{pl}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span style={{ color: C.dim, fontSize: "0.78rem" }}>+%</span>
                        <input type="number" min={-50} max={100} step={0.5} value={mpPrefs.multipliers[pl] || 0}
                            onChange={e => setMpPrefs(p => ({ ...p, multipliers: { ...p.multipliers, [pl]: Number(e.target.value) || 0 } }))}
                            style={{ ...inp, width: 72, textAlign: "center", padding: "0.45rem", fontWeight: 700 }}
                            onFocus={e => focusRing(e, PL_COLOR[pl])} onBlur={blurRing} />
                    </div>
                </div>
            ))}
        </div>
    </div>

    <div style={{ gridColumn: "1 / -1" }}>
        <Msg msg={mpPrefsMsg} />
        <Save onClick={handleSaveMpPrefs} loading={mpPrefsLoading} />
    </div>
</div>
)}

{/* 
    TAB 5: FATURA
     */}
{activeTab === "autoOrder" && (
<div style={{ margin: "-0.5rem" }}>
    <AutoOrderSettings embedded />
</div>
)}

{activeTab === "invoice" && (
<div>
    {!invoiceConfig ? (
        <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
            <Spinner size={22} color={C.muted} />
            <p style={{ color: C.muted, marginTop: "0.6rem", fontSize: "0.82rem" }}>{tr ? "Fatura ayarlar yükleniyor..." : "Loading..."}</p>
        </div>
    ) : (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <div style={{ gridColumn: "1 / -1" }}>
            <Info color={C.purple}>
                {tr ? "Otomatik fatura sistemi, yeni sipariş geldiğinde e-Arşiv fatura keser. Sağlayıcı API bilgilerinin doğru olduğundan emin olun." : "Auto invoice generates e-Archive invoices on new orders. Make sure your provider API credentials are correct."}
            </Info>
        </div>

        {/* Sol: Genel Ayarlar */}
        <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <SH icon="" title={tr ? "Otomatik Fatura" : "Auto Invoice"} desc={tr ? "Sipariş geldiğinde otomatik e-Arşiv fatura kesilir." : "Auto e-Archive invoice on new orders."} />
                <Toggle value={invoiceConfig.enabled || false} onChange={handleToggleInvoice} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <SF icon="" label={tr ? "Sağlayıcı" : "Provider"} value={invoiceConfig.provider || "qnb"} onChange={v => setInvoiceConfig(p => ({ ...p, provider: v }))}>
                    <option value="qnb">QNB Finansbank</option><option value="sovos">Sovos</option><option value="parasut">Parat</option><option value="odeal">Odeal</option>
                </SF>
                <SF icon="" label={tr ? "Belge Tipi" : "Doc Type"} value={invoiceConfig.documentType || "EARSIVFATURA"} onChange={v => setInvoiceConfig(p => ({ ...p, documentType: v }))}>
                    <option value="EARSIVFATURA">e-Arşiv Fatura</option><option value="TICARIFATURA">Ticari Fatura</option><option value="TEMELFATURA">Temel Fatura</option>
                </SF>
                <IF icon="" label={tr ? "Seri Kodu" : "Series Code"} value={invoiceConfig.invoiceSeriesCode || "LYS"} onChange={v => setInvoiceConfig(p => ({ ...p, invoiceSeriesCode: v }))} help={tr ? "Maks. 5 karakter" : "Max 5 chars"} />
                <SF icon={<FaPercent />} label={tr ? "KDV %" : "VAT %"} value={invoiceConfig.defaultVatRate ?? 20} onChange={v => setInvoiceConfig(p => ({ ...p, defaultVatRate: Number(v) }))}>
                    <option value={0}>%0</option><option value={1}>%1</option><option value={10}>%10</option><option value={20}>%20</option>
                </SF>
            </div>
        </div>

        {/* Sa: Firma Bilgileri */}
        <div style={card}>
            <SH icon="" title={tr ? "Firma Bilgileri" : "Company Info"}
                desc={tr ? "Faturalarda görünecek firma bilgileri. Yasal zorunluluktur." : "Company info on invoices. Legally required."} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <IF icon="" label={tr ? "VKN / TCKN" : "Tax ID"} value={invoiceConfig.supplier?.vkn || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, vkn: v } }))} />
                <IF icon="" label={tr ? "Firma Ad" : "Company"} value={invoiceConfig.supplier?.name || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, name: v } }))} />
                <IF icon="" label={tr ? "Vergi Dairesi" : "Tax Office"} value={invoiceConfig.supplier?.taxOffice || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, taxOffice: v } }))} />
                <IF icon="" label={tr ? "Adres" : "Address"} value={invoiceConfig.supplier?.street || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, street: v } }))} />
                <IF icon="" label={tr ? "le" : "District"} value={invoiceConfig.supplier?.district || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, district: v } }))} />
                <IF icon="" label={tr ? "l" : "City"} value={invoiceConfig.supplier?.city || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, city: v } }))} />
                <IF icon="" label={tr ? "Telefon" : "Phone"} value={invoiceConfig.supplier?.phone || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, phone: v } }))} />
                <IF icon="" label="E-posta" value={invoiceConfig.supplier?.email || ""} onChange={v => setInvoiceConfig(p => ({ ...p, supplier: { ...p.supplier, email: v } }))} />
            </div>
        </div>

        {/* Fatura Notu  tam genilik */}
        <div style={{ ...card, gridColumn: "1 / -1" }}>
            <SH icon="" title={tr ? "Varsaylan Fatura Notu" : "Default Invoice Note"}
                desc={tr ? "Her faturann altna otomatik eklenen not." : "Note automatically added to every invoice."} />
            <textarea value={invoiceConfig.defaultNote || ""} onChange={e => setInvoiceConfig(p => ({ ...p, defaultNote: e.target.value }))}
                rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
                placeholder={tr ? "ÖÖrn: Bizi tercih ettiğiniz için teşekkür ederiz..." : "E.g.: Thank you for choosing us..."}
                onFocus={focusRing} onBlur={blurRing} />
        </div>

        {/* Pazaryeri Bazl Otomatik Fatura  tam genilik */}
        <div style={{ ...card, gridColumn: "1 / -1" }}>
            <SH icon="" title={tr ? "Pazaryeri Bazl Otomatik Fatura" : "Per-Marketplace Auto Invoice"}
                desc={tr ? "Her pazaryeri için otomatik faturayı ayrı ayrı açıp kapatabilirsiniz. Boş bırakırsanız tüm pazaryerleri aktif olur." : "Enable/disable auto invoice per marketplace. Leave empty to enable all."} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.7rem", marginTop: "0.8rem" }}>
                {[
                    { name: "Trendyol", icon: "", color: "#f27a1a" },
                    { name: "Hepsiburada", icon: "", color: "#ff6000" },
                    { name: "N11", icon: "", color: "#4a90d9" },
                    { name: "iekSepeti", icon: "", color: "#e91e63" },
                    { name: "Amazon Trkiye", icon: "", color: "#ff9900" },
                    { name: "Amazon Europe", icon: "", color: "#ff9900" },
                    { name: "Amazon USA", icon: "", color: "#ff9900" },
                ].map(mp => {
                    const enabledList = (invoiceConfig.enabledMarketplaces || []);
                    // Bo liste = tüm aktif
                    const isActive = enabledList.length === 0 || enabledList.includes(mp.name);
                    const mpStat = mpStats?.marketplaces?.find(m => m.marketplace === mp.name);
                    return (
                        <div key={mp.name}
                            onClick={() => handleToggleMarketplace(mp.name)}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.6rem",
                                padding: "0.65rem 0.85rem", borderRadius: "10px", cursor: "pointer",
                                background: isActive ? `${mp.color}15` : "rgba(255,255,255,0.03)",
                                border: isActive ? `2px solid ${mp.color}50` : `1px solid rgba(255,255,255,0.08)`,
                                transition: "all 0.2s ease",
                                opacity: isActive ? 1 : 0.55,
                            }}>
                            <span style={{ fontSize: "1.2rem" }}>{mp.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: isActive ? mp.color : C.muted }}>{mp.name}</div>
                                {mpStat && mpStat.totalOrders > 0 && (
                                    <div style={{ fontSize: "0.65rem", color: C.muted, marginTop: "2px" }}>
                                        {mpStat.invoicedCount}/{mpStat.totalOrders} {tr ? "fatural" : "invoiced"}
                                    </div>
                                )}
                            </div>
                            <div style={{
                                width: 18, height: 18, borderRadius: "50%",
                                background: isActive ? mp.color : "rgba(255,255,255,0.1)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.65rem", color: "#fff", fontWeight: 700,
                                transition: "all 0.2s ease",
                            }}>
                                {isActive ? "" : ""}
                            </div>
                        </div>
                    );
                })}
            </div>
            {(invoiceConfig.enabledMarketplaces || []).length === 0 && (
                <div style={{ marginTop: "0.6rem", fontSize: "0.72rem", color: C.muted, fontStyle: "italic" }}>
                     {tr ? "Hiçbir pazaryeri seçilmedi  tüm pazaryerlerinden gelen siparişler otomatik faturalanır." : "No marketplace selected  orders from all marketplaces will be auto-invoiced."}
                </div>
            )}
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
            <Msg msg={invoiceMsg} />
            <Save onClick={handleSaveInvoice} loading={invoiceLoading} />
        </div>
    </div>
    )}
</div>
)}

{/* 
    TAB 6: HESAP
     */}
{activeTab === "account" && (
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
    <div style={{ gridColumn: "1 / -1" }}>
        <Info>
            {tr ? "Hesap bilgileriniz faturalarda, kargo etiketlerinde ve resmi yazışmalarda kullanılır. Güncel tutun." : "Your account info is used in invoices, shipping labels and official correspondence. Keep it up to date."}
        </Info>
    </div>

    {/* Sol: Kiisel + Vergi */}
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={card}>
            <SH icon="" title={tr ? "Kiisel Bilgiler" : "Personal Info"}
                desc={tr ? "Hesap sahibinin temel iletişim bilgileri." : "Account holder's basic contact info."} />
            {loading ? <div style={{ textAlign: "center", padding: "1.5rem" }}><Spinner size={22} color={C.muted} /></div> : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                    <IF icon="" label={tr ? "Ad Soyad" : "Full Name"} value={profileForm.name} onChange={v => setProfileForm(p => ({ ...p, name: v }))} />
                    <IF icon="" label="E-posta" value={profileForm.email} disabled help={tr ? "Değiştirilemez" : "Cannot be changed"} />
                    <IF icon="" label={tr ? "Telefon" : "Phone"} value={profileForm.phone} onChange={v => setProfileForm(p => ({ ...p, phone: v }))} placeholder="05XX XXX XX XX" />
                    <IF icon="" label={tr ? "irket" : "Company"} value={profileForm.company} onChange={v => setProfileForm(p => ({ ...p, company: v }))} />
                </div>
            )}
        </div>
        <div style={card}>
            <SH icon="" title={tr ? "Vergi Bilgileri" : "Tax Info"}
                desc={tr ? "Fatura ve resmi işlemler için gerekli. Doğru girilmesi yasal zorunluluktur." : "Required for invoiçing. Accurate entry is legally required."} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <IF icon={<FaIdCard />} label={tr ? "VKN / TCKN" : "Tax Number"} value={profileForm.taxNumber} onChange={v => setProfileForm(p => ({ ...p, taxNumber: v }))} help={tr ? "10 veya 11 hane" : "10 or 11 digits"} />
                <IF icon={<FaBuilding />} label={tr ? "Vergi Dairesi" : "Tax Office"} value={profileForm.taxOffice} onChange={v => setProfileForm(p => ({ ...p, taxOffice: v }))} />
            </div>
        </div>
    </div>

    {/* Sa: Adres + Abonelik */}
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={card}>
            <SH icon="" title={tr ? "Adres Bilgileri" : "Address"}
                desc={tr ? "Fatura adresi ve kargo gönderim adresi olarak kullanlr." : "Used as invoice and shipping origin address."} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <IF icon={<FaMapMarkerAlt />} label={tr ? "Sokak / Cadde" : "Street"} value={profileForm.street} onChange={v => setProfileForm(p => ({ ...p, street: v }))} placeholder={tr ? "Mahalle, sokak, bina no" : "Street, building no"} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                    <IF icon="" label={tr ? "le" : "District"} value={profileForm.state} onChange={v => setProfileForm(p => ({ ...p, state: v }))} />
                    <IF icon="" label={tr ? "l" : "City"} value={profileForm.city} onChange={v => setProfileForm(p => ({ ...p, city: v }))} />
                </div>
                <IF icon="" label={tr ? "Posta Kodu" : "Zip Code"} value={profileForm.zipCode} onChange={v => setProfileForm(p => ({ ...p, zipCode: v }))} help={tr ? "5 haneli" : "5-digit"} />
            </div>
        </div>
        {user?.subscription && (
            <div style={card}>
                <SH icon="" title={tr ? "Abonelik" : "Subscription"} />
                <div style={{ padding: "0.9rem 1rem", background: rgba(C.accent, 0.05), border: `1px solid ${rgba(C.accent, 0.12)}`, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <p style={{ color: C.muted, fontSize: "0.7rem", margin: 0, fontWeight: 600 }}>{tr ? "Mevcut Plan" : "Current Plan"}</p>
                        <p style={{ color: C.accent, fontSize: "0.95rem", fontWeight: 800, margin: "0.15rem 0 0 0", textTransform: "capitalize" }}>{user.subscription.plan || "trial"}</p>
                        {user.subscription.endDate && <p style={{ color: C.dim, fontSize: "0.7rem", margin: "0.2rem 0 0 0" }}>{tr ? "Biti:" : "Expires:"} {new Date(user.subscription.endDate).toLocaleDateString("tr-TR")}</p>}
                    </div>
                    <span style={{ background: user.subscription.status === "active" ? rgba(C.green || "#22c55e", 0.1) : rgba(C.red || "#ef4444", 0.1), color: user.subscription.status === "active" ? (C.green || "#22c55e") : (C.red || "#ef4444"), padding: "0.3rem 0.7rem", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700, border: `1px solid ${user.subscription.status === "active" ? rgba(C.green || "#22c55e", 0.2) : rgba(C.red || "#ef4444", 0.2)}` }}>
                        {user.subscription.status === "active" ? (tr ? " Aktif" : " Active") : (tr ? "Pasif" : "Inactive")}
                    </span>
                </div>
            </div>
        )}
    </div>

    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Save onClick={handleSaveProfile} loading={saving} />
        {saveMsg === "success" && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: C.green || "#22c55e", fontSize: "0.82rem", fontWeight: 600 }}> {tr ? "Kaydedildi!" : "Saved!"}</motion.span>}
        {saveMsg === "error" && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: C.red || "#ef4444", fontSize: "0.82rem", fontWeight: 600 }}> {tr ? "Hata!" : "Error!"}</motion.span>}
    </div>
</div>
)}

{/* 
    TAB 7: GVENLK
     */}
{activeTab === "security" && (
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
    <div style={{ gridColumn: "1 / -1" }}>
        <Info color={C.red || "#ef4444"}>
            {tr ? "Hesap güvenliğiniz için şifrenizi düzenli değiştirin, tanımadığınız oturumları sonlandırın ve API anahtarlarınızı güvende tutun." : "Change your password regularly, revoke unknown sessions, and keep your API keys safe."}
        </Info>
    </div>

    {/* Sol: şifre */}
    <div style={card}>
        <SH icon="" title={tr ? "şifre Değiştir" : "Change Password"}
            desc={tr ? "Gl şifre: en az 8 karakter, byk/kk harf ve rakam." : "Strong password: min 8 chars, upper/lowercase and numbers."} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {[
                { key: "currentPassword", label: tr ? "Mevcut şifre" : "Current Password", show: "current" },
                { key: "newPassword", label: tr ? "Yeni şifre" : "New Password", show: "new" },
                { key: "confirmPassword", label: tr ? "Şifre Tekrar" : "Confirm Password", show: "confirm" },
            ].map(f => (
                <div key={f.key}>
                    <label style={{ color: C.muted, fontSize: "0.73rem", fontWeight: 600, marginBottom: "0.35rem", display: "flex", alignItems: "center", gap: "0.3rem" }}> {f.label}</label>
                    <div style={{ position: "relative" }}>
                        <input type={showPasswords[f.show] ? "text" : "password"} value={passwordForm[f.key]}
                            onChange={e => setPasswordForm(p => ({ ...p, [f.key]: e.target.value }))}
                            style={{ ...inp, paddingRight: "2.5rem" }} onFocus={focusRing} onBlur={blurRing} />
                        <button onClick={() => setShowPasswords(p => ({ ...p, [f.show]: !p[f.show] }))}
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.9rem", padding: "0.2rem", display: "flex" }}>
                            {showPasswords[f.show] ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                </div>
            ))}
            <Msg msg={passwordMsg} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleChangePassword} disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword}
                    style={{ ...btnP, opacity: (!passwordForm.currentPassword || !passwordForm.newPassword || saving) ? 0.5 : 1, cursor: (!passwordForm.currentPassword || !passwordForm.newPassword || saving) ? "not-allowed" : "pointer" }}>
                    {saving ? <Spinner size={14} color="#fff" /> : <FaShieldAlt />}
                    {tr ? "şifreyi Değiştir" : "Change Password"}
                </motion.button>
                {user?.security?.lastPasswordChange && <p style={{ color: C.dim, fontSize: "0.7rem", margin: 0 }}>{tr ? "Son:" : "Last:"} {new Date(user.security.lastPasswordChange).toLocaleDateString("tr-TR")}</p>}
            </div>
        </div>
    </div>

    {/* Sa: Oturumlar */}
    <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <SH icon="" title={tr ? "Aktif Oturumlar" : "Active Sessions"}
                desc={tr ? "Hesabınıza bal cihazlar." : "Devices connected to your account."} />
            {sessions.activeSessions.length > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleRevokeAllSessions}
                    style={{ padding: "0.4rem 0.7rem", background: rgba(C.red || "#ef4444", 0.07), border: `1px solid ${rgba(C.red || "#ef4444", 0.2)}`, borderRadius: 8, color: C.red || "#ef4444", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                    <FaSignOutAlt /> {tr ? "Tümünü Kapat" : "Revoke All"}
                </motion.button>
            )}
        </div>
        {sessionsLoading ? <div style={{ textAlign: "center", padding: "1.5rem" }}><Spinner size={20} color={C.muted} /></div>
        : sessions.activeSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "1.25rem", background: rgba(C.text, 0.02), borderRadius: 10, border: `1px solid ${rgba(C.text, 0.05)}` }}>
                <FaLaptop style={{ color: C.dim, fontSize: "1.3rem", marginBottom: "0.4rem" }} />
                <p style={{ color: C.dim, fontSize: "0.8rem", margin: 0 }}>{tr ? "Aktif oturum yok" : "No active sessions"}</p>
            </div>
        ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {sessions.activeSessions.map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 0.85rem", background: rgba(C.text, 0.02), border: `1px solid ${rgba(C.text, 0.05)}`, borderRadius: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: rgba(C.accent, 0.1), display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FaLaptop style={{ color: C.accent, fontSize: "0.8rem" }} />
                            </span>
                            <div>
                                <p style={{ color: C.text, fontSize: "0.8rem", fontWeight: 600, margin: 0 }}>{s.device || (tr ? "Bilinmeyen" : "Unknown")}</p>
                                <p style={{ color: C.dim, fontSize: "0.66rem", margin: "0.1rem 0 0 0" }}>{new Date(s.createdAt).toLocaleDateString("tr-TR")}</p>
                            </div>
                        </div>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleRevokeSession(s.id)}
                            style={{ background: rgba(C.red || "#ef4444", 0.07), border: `1px solid ${rgba(C.red || "#ef4444", 0.18)}`, borderRadius: 7, padding: "0.3rem 0.55rem", color: C.red || "#ef4444", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.2rem" }}>
                            <FaTimes /> {tr ? "Kapat" : "Revoke"}
                        </motion.button>
                    </div>
                ))}
            </div>
        )}
    </div>

    {/* API Anahtarlar  tam genilik */}
    <div style={{ ...card, gridColumn: "1 / -1" }}>
        <SH icon="" title={tr ? "API Anahtarlar" : "API Keys"}
            desc={tr ? "Harici uygulamalar için API anahtarı oluşturun. Anahtarlar yalnızca oluşturulduğunda gösterilir." : "Generate API keys for external apps. Keys are only shown once when created."} />

        {apiKeys.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1rem" }}>
                {apiKeys.map(k => (
                    <div key={k._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 0.85rem", background: rgba(C.text, 0.02), border: `1px solid ${rgba(C.text, 0.05)}`, borderRadius: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                            <span style={{ width: 32, height: 32, borderRadius: 8, background: rgba(C.purple, 0.1), display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <FaKey style={{ color: C.purple, fontSize: "0.8rem" }} />
                            </span>
                            <div>
                                <p style={{ color: C.text, fontSize: "0.8rem", fontWeight: 600, margin: 0 }}>{k.name}</p>
                                <p style={{ color: C.dim, fontSize: "0.66rem", margin: "0.1rem 0 0 0", fontFamily: "monospace" }}>{k.key ? `${k.key.substring(0, 14)}...` : ""}</p>
                            </div>
                        </div>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleRevokeApiKey(k._id)}
                            style={{ background: rgba(C.red || "#ef4444", 0.07), border: `1px solid ${rgba(C.red || "#ef4444", 0.18)}`, borderRadius: 7, padding: "0.3rem 0.55rem", color: C.red || "#ef4444", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.2rem" }}>
                            <FaTrash /> {tr ? "İptal" : "Revoke"}
                        </motion.button>
                    </div>
                ))}
            </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.85rem", background: rgba(C.text, 0.02), border: `1px solid ${rgba(C.text, 0.05)}`, borderRadius: 10 }}>
            <FaPlus style={{ color: C.dim, flexShrink: 0 }} />
            <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                placeholder={tr ? "Anahtar ad (Örn: Mobil App)" : "Key name (e.g.: Mobile App)"}
                style={{ ...inp, flex: 1 }} onKeyDown={e => e.key === "Enter" && handleCreateApiKey()} onFocus={focusRing} onBlur={blurRing} />
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleCreateApiKey} disabled={apiKeyLoading || !newKeyName.trim()}
                style={{ ...btnP, padding: "0.55rem 1rem", opacity: (!newKeyName.trim() || apiKeyLoading) ? 0.5 : 1, cursor: (!newKeyName.trim() || apiKeyLoading) ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {apiKeyLoading ? <Spinner size={13} color="#fff" /> : <FaPlus />}
                {tr ? "Olutur" : "Create"}
            </motion.button>
        </div>

        {newKeyResult && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: "0.85rem", padding: "0.85rem 1rem", borderRadius: 10, background: rgba(C.green || "#22c55e", 0.06), border: `1px solid ${rgba(C.green || "#22c55e", 0.18)}` }}>
                <p style={{ color: C.green || "#22c55e", fontSize: "0.78rem", fontWeight: 700, margin: "0 0 0.4rem 0" }}>
                     {tr ? "Anahtar oluşturuldu! Şimdi kopyalayın - tekrar gösterilmeyecek:" : "Key created! Copy now - won't be shown again:"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <code style={{ color: C.text, fontSize: "0.73rem", background: rgba(C.text, 0.04), padding: "0.45rem 0.65rem", borderRadius: 7, flex: 1, wordBreak: "break-all", border: `1px solid ${rgba(C.text, 0.07)}`, fontFamily: "monospace" }}>{newKeyResult}</code>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigator.clipboard.writeText(newKeyResult)}
                        style={{ background: rgba(C.accent, 0.1), border: `1px solid ${rgba(C.accent, 0.22)}`, borderRadius: 7, padding: "0.45rem 0.65rem", color: C.accent, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <FaCopy /> {tr ? "Kopyala" : "Copy"}
                    </motion.button>
                </div>
            </motion.div>
        )}
    </div>

    {/* Danger Zone  tam genilik */}
    <div style={{ ...card, gridColumn: "1 / -1", borderColor: rgba(C.red || "#ef4444", 0.18), background: `linear-gradient(135deg, ${C.card}, ${rgba(C.red || "#ef4444", 0.02)})` }}>
        <SH icon="" title={tr ? "Tehlikeli Blge" : "Danger Zone"}
            desc={tr ? "Bu ilem geri alnamaz! Hesabınız, tüm ürünleriniz ve entegrasyonlarnz kalc olarak silinir." : "This action is irreversible! Your account, all products and integrations will be permanently deleted."} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ padding: "0.6rem 1.1rem", background: rgba(C.red || "#ef4444", 0.08), border: `1px solid ${rgba(C.red || "#ef4444", 0.25)}`, borderRadius: 10, color: C.red || "#ef4444", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <FaTrash /> {tr ? "Hesabm Kalc Olarak Sil" : "Permanently Delete My Account"}
        </motion.button>
    </div>
</div>
)}

                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default SettingsPage;
