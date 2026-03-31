import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/AppContext";
import axios from "../services/api";
import {
    FaPalette, FaGlobe, FaBell, FaUser, FaShieldAlt,
    FaSun, FaMoon, FaDesktop, FaSave, FaCheck,
    FaEye, FaEyeSlash, FaSpinner
} from "react-icons/fa";

const SettingsPage = ({ userId }) => {
    const { theme: C, themeMode, setTheme, language, setLanguage, t } = useApp();

    const [activeTab, setActiveTab] = useState("appearance");
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState("");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Profile form
    const [profileForm, setProfileForm] = useState({
        name: "", email: "", phone: "", company: ""
    });

    // Notification prefs
    const [notifPrefs, setNotifPrefs] = useState({
        orderNotif: true, stockNotif: true, soundNotif: true, emailNotif: true
    });

    // Password form
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "", newPassword: "", confirmPassword: ""
    });
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

    const token = localStorage.getItem("token");

    // Fetch user data
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await axios.get(`/user/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const u = res.data;
                setUser(u);
                setProfileForm({
                    name: u.name || "",
                    email: u.email || "",
                    phone: u.profile?.phone || "",
                    company: u.profile?.company || "",
                });
                setNotifPrefs({
                    orderNotif: u.preferences?.orderNotifications !== false,
                    stockNotif: u.preferences?.stockNotifications !== false,
                    soundNotif: true,
                    emailNotif: u.preferences?.notifications?.email !== false,
                });
            } catch (e) {
                console.error("User fetch error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [token]);

    // Save profile
    const handleSaveProfile = async () => {
        setSaving(true);
        setSaveMsg("");
        try {
            await axios.put(`/user/profile`, {
                name: profileForm.name,
                profile: {
                    phone: profileForm.phone,
                    company: profileForm.company,
                }
            }, { headers: { Authorization: `Bearer ${token}` } });
            localStorage.setItem("userName", profileForm.name);
            setSaveMsg("success");
            setTimeout(() => setSaveMsg(""), 2500);
        } catch (e) {
            setSaveMsg("error");
            setTimeout(() => setSaveMsg(""), 3000);
        } finally {
            setSaving(false);
        }
    };

    // Change password
    const handleChangePassword = async () => {
        setPasswordMsg({ type: "", text: "" });
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordMsg({ type: "error", text: language === "tr" ? "Şifreler eşleşmiyor!" : "Passwords don't match!" });
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            setPasswordMsg({ type: "error", text: language === "tr" ? "Şifre en az 6 karakter olmalı!" : "Password must be at least 6 characters!" });
            return;
        }
        setSaving(true);
        try {
            await axios.put(`/user/change-password`, {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            }, { headers: { Authorization: `Bearer ${token}` } });
            setPasswordMsg({ type: "success", text: language === "tr" ? "Şifre başarıyla değiştirildi!" : "Password changed successfully!" });
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (e) {
            setPasswordMsg({ type: "error", text: e.response?.data?.message || (language === "tr" ? "Şifre değiştirilemedi!" : "Failed to change password!") });
        } finally {
            setSaving(false);
        }
    };

    /* ═══════════════════════════════════════════════════════
       STYLES
       ═══════════════════════════════════════════════════════ */
    const cardStyle = {
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: "1.5rem", backdropFilter: "blur(20px)", marginBottom: "1rem",
    };
    const labelStyle = { color: C.text, fontSize: "0.92rem", fontWeight: 700, margin: "0 0 0.25rem 0" };
    const descStyle = { color: C.muted, fontSize: "0.78rem", margin: "0 0 0.75rem 0" };
    const inputStyle = {
        width: "100%", padding: "0.7rem 1rem", background: C.inputBg,
        border: `1px solid ${C.inputBorder}`, borderRadius: 10, color: C.text,
        fontSize: "0.88rem", outline: "none", transition: "border-color 0.2s",
    };
    const btnPrimary = {
        padding: "0.65rem 1.5rem", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
        border: "none", borderRadius: 10, color: "#000", fontSize: "0.85rem",
        fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem",
    };

    const tabs = [
        { id: "appearance", icon: <FaPalette />, label: t("settings.appearance") },
        { id: "notifications", icon: <FaBell />, label: t("settings.notifications") },
        { id: "account", icon: <FaUser />, label: t("settings.account") },
        { id: "security", icon: <FaShieldAlt />, label: t("settings.security") },
    ];

    /* ═══════════════════════════════════════════════════════
       TOGGLE COMPONENT
       ═══════════════════════════════════════════════════════ */
    const Toggle = ({ value, onChange }) => (
        <motion.div whileTap={{ scale: 0.95 }}
            onClick={() => onChange(!value)}
            style={{
                width: 48, height: 26, borderRadius: 13, cursor: "pointer",
                background: value ? C.accent : `${C.dim}40`,
                border: `1px solid ${value ? C.accent : C.glassBr}`,
                position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}>
            <motion.div animate={{ x: value ? 22 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
                style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: value ? "#000" : C.muted,
                    position: "absolute", top: 2,
                }} />
        </motion.div>
    );

    /* ═══════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div style={{ padding: "clamp(1rem, 2.5vw, 2rem)", color: C.text, minHeight: "100vh" }}>
            {/* Header */}
            <div style={{ marginBottom: "1.5rem" }}>
                <h1 style={{
                    fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 800, margin: 0,
                    background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                    ⚙️ {t("settings.title")}
                </h1>
                <p style={{ color: C.muted, fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>
                    {t("settings.subtitle")}
                </p>
            </div>

            {/* Layout: Tabs + Content */}
            <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* Tab Navigation */}
                <div style={{
                    ...cardStyle, padding: "0.75rem", minWidth: 200, flex: "0 0 auto",
                    display: "flex", flexDirection: "column", gap: "0.25rem",
                    position: "sticky", top: "1rem",
                }}>
                    {tabs.map(tab => (
                        <motion.button key={tab.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: "flex", alignItems: "center", gap: "0.6rem",
                                padding: "0.7rem 1rem", borderRadius: 10, cursor: "pointer",
                                background: activeTab === tab.id ? `${C.accent}15` : "transparent",
                                border: activeTab === tab.id ? `1px solid ${C.accent}40` : "1px solid transparent",
                                color: activeTab === tab.id ? C.accent : C.muted,
                                fontSize: "0.85rem", fontWeight: activeTab === tab.id ? 700 : 500,
                                transition: "all 0.2s", width: "100%", textAlign: "left",
                            }}>
                            {tab.icon}
                            <span>{tab.label}</span>
                        </motion.button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, maxWidth: 700 }}>
                    <AnimatePresence mode="wait">
                        <motion.div key={activeTab}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}>

                            {/* ═══ GÖRÜNÜM ═══ */}
                            {activeTab === "appearance" && (
                                <div>
                                    {/* Tema Seçimi */}
                                    <div style={cardStyle}>
                                        <p style={labelStyle}>{t("settings.theme")}</p>
                                        <p style={descStyle}>{t("settings.themeDesc")}</p>
                                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                            {[
                                                { id: "dark", icon: <FaMoon />, label: t("settings.dark"), color: "#8b5cf6" },
                                                { id: "light", icon: <FaSun />, label: t("settings.light"), color: "#f59e0b" },
                                                { id: "system", icon: <FaDesktop />, label: t("settings.system"), color: C.accent },
                                            ].map(opt => (
                                                <motion.button key={opt.id} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                                    onClick={() => setTheme(opt.id)}
                                                    style={{
                                                        flex: "1 1 120px", padding: "1.25rem 1rem", borderRadius: 14, cursor: "pointer",
                                                        background: themeMode === opt.id ? `${opt.color}15` : C.glass,
                                                        border: themeMode === opt.id ? `2px solid ${opt.color}` : `1px solid ${C.glassBr}`,
                                                        display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                                                        transition: "all 0.2s",
                                                    }}>
                                                    <span style={{ fontSize: "1.5rem", color: themeMode === opt.id ? opt.color : C.dim }}>{opt.icon}</span>
                                                    <span style={{ color: themeMode === opt.id ? opt.color : C.muted, fontSize: "0.82rem", fontWeight: 700 }}>{opt.label}</span>
                                                    {themeMode === opt.id && (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                            style={{ width: 20, height: 20, borderRadius: "50%", background: opt.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                            <FaCheck style={{ color: "#000", fontSize: "0.6rem" }} />
                                                        </motion.div>
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dil Seçimi */}
                                    <div style={cardStyle}>
                                        <p style={labelStyle}>{t("settings.language")}</p>
                                        <p style={descStyle}>{t("settings.languageDesc")}</p>
                                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                            {[
                                                { id: "tr", flag: "🇹🇷", label: t("settings.turkish") },
                                                { id: "en", flag: "🇬🇧", label: t("settings.english") },
                                            ].map(opt => (
                                                <motion.button key={opt.id} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                                    onClick={() => setLanguage(opt.id)}
                                                    style={{
                                                        flex: "1 1 150px", padding: "1.25rem 1.5rem", borderRadius: 14, cursor: "pointer",
                                                        background: language === opt.id ? `${C.accent}15` : C.glass,
                                                        border: language === opt.id ? `2px solid ${C.accent}` : `1px solid ${C.glassBr}`,
                                                        display: "flex", alignItems: "center", gap: "0.75rem",
                                                        transition: "all 0.2s",
                                                    }}>
                                                    <span style={{ fontSize: "2rem" }}>{opt.flag}</span>
                                                    <div style={{ textAlign: "left" }}>
                                                        <span style={{ color: language === opt.id ? C.accent : C.text, fontSize: "0.92rem", fontWeight: 700, display: "block" }}>{opt.label}</span>
                                                    </div>
                                                    {language === opt.id && (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                            style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                            <FaCheck style={{ color: "#000", fontSize: "0.65rem" }} />
                                                        </motion.div>
                                                    )}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ═══ BİLDİRİMLER ═══ */}
                            {activeTab === "notifications" && (
                                <div style={cardStyle}>
                                    <p style={labelStyle}>{t("settings.notifications")}</p>
                                    <p style={descStyle}>{t("settings.notifDesc")}</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                        {[
                                            { key: "orderNotif", label: t("settings.orderNotif"), desc: t("settings.orderNotifDesc"), icon: "📦" },
                                            { key: "stockNotif", label: t("settings.stockNotif"), desc: t("settings.stockNotifDesc"), icon: "📊" },
                                            { key: "soundNotif", label: t("settings.soundNotif"), desc: t("settings.soundNotifDesc"), icon: "🔔" },
                                            { key: "emailNotif", label: t("settings.emailNotif"), desc: t("settings.emailNotifDesc"), icon: "📧" },
                                        ].map(item => (
                                            <div key={item.key} style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                                padding: "1rem 1.25rem", background: C.glass, border: `1px solid ${C.glassBr}`,
                                                borderRadius: 12, gap: "1rem",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                                                    <span style={{ fontSize: "1.3rem" }}>{item.icon}</span>
                                                    <div>
                                                        <p style={{ color: C.text, fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>{item.label}</p>
                                                        <p style={{ color: C.dim, fontSize: "0.75rem", margin: "0.15rem 0 0 0" }}>{item.desc}</p>
                                                    </div>
                                                </div>
                                                <Toggle value={notifPrefs[item.key]} onChange={v => setNotifPrefs(p => ({ ...p, [item.key]: v }))} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ═══ HESAP ═══ */}
                            {activeTab === "account" && (
                                <div>
                                    <div style={cardStyle}>
                                        <p style={labelStyle}>{t("settings.account")}</p>
                                        <p style={descStyle}>{t("settings.accountDesc")}</p>

                                        {loading ? (
                                            <div style={{ textAlign: "center", padding: "2rem", color: C.muted }}>
                                                <FaSpinner className="fa-spin" style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }} />
                                                <p>{t("common.loading")}</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                                {[
                                                    { key: "name", label: t("settings.name"), icon: "👤" },
                                                    { key: "email", label: t("settings.email"), icon: "📧", disabled: true },
                                                    { key: "phone", label: t("settings.phone"), icon: "📱" },
                                                    { key: "company", label: t("settings.company"), icon: "🏢" },
                                                ].map(field => (
                                                    <div key={field.key}>
                                                        <label style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.35rem" }}>
                                                            {field.icon} {field.label}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={profileForm[field.key]}
                                                            onChange={e => !field.disabled && setProfileForm(p => ({ ...p, [field.key]: e.target.value }))}
                                                            disabled={field.disabled}
                                                            style={{
                                                                ...inputStyle,
                                                                opacity: field.disabled ? 0.5 : 1,
                                                                cursor: field.disabled ? "not-allowed" : "text",
                                                            }}
                                                            onFocus={e => { if (!field.disabled) e.target.style.borderColor = C.accent; }}
                                                            onBlur={e => e.target.style.borderColor = C.inputBorder}
                                                        />
                                                    </div>
                                                ))}

                                                {/* Abonelik Bilgisi */}
                                                {user?.subscription && (
                                                    <div style={{
                                                        padding: "1rem 1.25rem", background: `${C.accent}08`,
                                                        border: `1px solid ${C.accent}25`, borderRadius: 12,
                                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                                    }}>
                                                        <div>
                                                            <p style={{ color: C.muted, fontSize: "0.72rem", margin: 0 }}>{t("settings.subscription")}</p>
                                                            <p style={{ color: C.accent, fontSize: "0.95rem", fontWeight: 800, margin: "0.15rem 0 0 0" }}>
                                                                {t(`settings.plan${(user.subscription.plan || "free").charAt(0).toUpperCase() + (user.subscription.plan || "free").slice(1)}`)}
                                                            </p>
                                                        </div>
                                                        <span style={{
                                                            background: user.subscription.status === "active" ? `${C.green}15` : `${C.red}15`,
                                                            color: user.subscription.status === "active" ? C.green : C.red,
                                                            padding: "0.3rem 0.75rem", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700,
                                                            border: `1px solid ${user.subscription.status === "active" ? C.green : C.red}30`,
                                                        }}>
                                                            {user.subscription.status === "active" ? (language === "tr" ? "Aktif" : "Active") : (language === "tr" ? "Pasif" : "Inactive")}
                                                        </span>
                                                    </div>
                                                )}

                                                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                    onClick={handleSaveProfile} disabled={saving}
                                                    style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, alignSelf: "flex-start", marginTop: "0.5rem" }}>
                                                    {saving ? <FaSpinner className="fa-spin" /> : saveMsg === "success" ? <FaCheck /> : <FaSave />}
                                                    {saving ? t("settings.saving") : saveMsg === "success" ? t("settings.saved") : t("settings.save")}
                                                </motion.button>

                                                {saveMsg === "error" && (
                                                    <p style={{ color: C.red, fontSize: "0.8rem", margin: "0.5rem 0 0 0" }}>
                                                        {language === "tr" ? "Kaydetme hatası!" : "Save error!"}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ═══ GÜVENLİK ═══ */}
                            {activeTab === "security" && (
                                <div>
                                    <div style={cardStyle}>
                                        <p style={labelStyle}>{t("settings.security")}</p>
                                        <p style={descStyle}>{t("settings.securityDesc")}</p>

                                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                            {[
                                                { key: "currentPassword", label: t("settings.currentPassword"), show: "current" },
                                                { key: "newPassword", label: t("settings.newPassword"), show: "new" },
                                                { key: "confirmPassword", label: t("settings.confirmPassword"), show: "confirm" },
                                            ].map(field => (
                                                <div key={field.key}>
                                                    <label style={{ color: C.muted, fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.35rem", display: "block" }}>
                                                        🔒 {field.label}
                                                    </label>
                                                    <div style={{ position: "relative" }}>
                                                        <input
                                                            type={showPasswords[field.show] ? "text" : "password"}
                                                            value={passwordForm[field.key]}
                                                            onChange={e => setPasswordForm(p => ({ ...p, [field.key]: e.target.value }))}
                                                            style={{ ...inputStyle, paddingRight: "2.5rem" }}
                                                            onFocus={e => e.target.style.borderColor = C.accent}
                                                            onBlur={e => e.target.style.borderColor = C.inputBorder}
                                                        />
                                                        <button
                                                            onClick={() => setShowPasswords(p => ({ ...p, [field.show]: !p[field.show] }))}
                                                            style={{
                                                                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                                                                background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: "0.9rem",
                                                            }}>
                                                            {showPasswords[field.show] ? <FaEyeSlash /> : <FaEye />}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {passwordMsg.text && (
                                                <p style={{
                                                    color: passwordMsg.type === "success" ? C.green : C.red,
                                                    fontSize: "0.82rem", fontWeight: 600, margin: 0,
                                                    padding: "0.5rem 0.75rem", borderRadius: 8,
                                                    background: passwordMsg.type === "success" ? `${C.green}10` : `${C.red}10`,
                                                }}>
                                                    {passwordMsg.type === "success" ? "✅" : "⚠️"} {passwordMsg.text}
                                                </p>
                                            )}

                                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                onClick={handleChangePassword} disabled={saving || !passwordForm.currentPassword || !passwordForm.newPassword}
                                                style={{
                                                    ...btnPrimary, alignSelf: "flex-start",
                                                    opacity: (!passwordForm.currentPassword || !passwordForm.newPassword || saving) ? 0.5 : 1,
                                                }}>
                                                {saving ? <FaSpinner className="fa-spin" /> : <FaShieldAlt />}
                                                {t("settings.changePassword")}
                                            </motion.button>
                                        </div>
                                    </div>

                                    {/* Danger Zone */}
                                    <div style={{
                                        ...cardStyle, borderColor: `${C.red}30`,
                                        background: `linear-gradient(135deg, ${C.card} 0%, rgba(239,68,68,0.03) 100%)`,
                                    }}>
                                        <p style={{ ...labelStyle, color: C.red }}>⚠️ {t("settings.dangerZone")}</p>
                                        <p style={descStyle}>{t("settings.deleteAccountDesc")}</p>
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            style={{
                                                padding: "0.6rem 1.25rem", background: `${C.red}15`,
                                                border: `1px solid ${C.red}40`, borderRadius: 10,
                                                color: C.red, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                            }}>
                                            {t("settings.deleteAccount")}
                                        </motion.button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
