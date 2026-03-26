import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaUser, FaLock, FaPlug, FaChartLine, FaBell, FaKey,
    FaFileInvoice, FaSave, FaCamera, FaShoppingCart, FaMoneyBillWave,
    FaBox, FaStore, FaCheckCircle, FaExclamationTriangle,
    FaCopy, FaTrash, FaEye, FaEyeSlash, FaQrcode, FaShieldAlt,
    FaGlobe, FaClock, FaMapMarkerAlt, FaPhone, FaBuilding,
    FaEnvelope, FaSpinner, FaCog, FaInfoCircle
} from "react-icons/fa";
import axios from "../services/api";
import "../styles/userProfile.css";

const UserProfilePage = ({ userId, marketplaces }) => {
    const [activeTab, setActiveTab] = useState("profile");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        name: "",
        email: "",
        phone: "",
        company: "",
        address: {
            street: "",
            city: "",
            state: "",
            zipCode: "",
            country: "TR"
        },
        taxInfo: {
            taxNumber: "",
            taxOffice: ""
        }
    });

    // Security form state
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    // Password strength indicator
    const [passwordStrength, setPasswordStrength] = useState({
        score: 0,
        label: "",
        color: ""
    });

    // Show current password feature
    const [showCurrentPasswordModal, setShowCurrentPasswordModal] = useState(false);
    const [verifyPasswordInput, setVerifyPasswordInput] = useState("");
    const [verifiedCurrentPassword, setVerifiedCurrentPassword] = useState("");
    const [verifying, setVerifying] = useState(false);

    // Notification settings
    const [notifications, setNotifications] = useState({
        email: true,
        sms: false,
        push: true,
        orderNotifications: true,
        stockNotifications: true,
        financeNotifications: true
    });

    // API Keys
    const [apiKeys, setApiKeys] = useState([]);
    const [showApiKey, setShowApiKey] = useState({});
    const [newApiKeyName, setNewApiKeyName] = useState("");

    // Stats
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalRevenue: 0,
        activeProducts: 0,
        marketplaceCount: 0
    });

    useEffect(() => {
        loadUserProfile();
        loadUserStats();
    }, [userId]);

    const loadUserProfile = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("token");
            console.log("🔑 Token:", token ? "Mevcut" : "YOK!");
            console.log("📡 API çağrısı yapılıyor: /user/profile");

            const response = await axios.get("/user/profile", {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log("✅ Profil yüklendi:", response.data);

            // Handle both response formats
            const userData = response.data.success ? response.data : response.data;
            setUser(userData);

            setProfileForm({
                name: userData.name || "",
                email: userData.email || "",
                phone: userData.profile?.phone || "",
                company: userData.profile?.company || "",
                address: userData.profile?.address || {
                    street: "",
                    city: "",
                    state: "",
                    zipCode: "",
                    country: "TR"
                },
                taxInfo: userData.profile?.taxInfo || {
                    taxNumber: "",
                    taxOffice: ""
                }
            });

            setNotifications({
                email: userData.preferences?.notifications?.email ?? true,
                sms: userData.preferences?.notifications?.sms ?? false,
                push: userData.preferences?.notifications?.push ?? true,
                orderNotifications: userData.preferences?.orderNotifications ?? true,
                stockNotifications: userData.preferences?.stockNotifications ?? true,
                financeNotifications: userData.preferences?.financeNotifications ?? true
            });

            setApiKeys(userData.apiKeys || []);
        } catch (error) {
            console.error("❌ Profil yüklenirken hata:", error);
            console.error("❌ Error response:", error.response);
            console.error("❌ Error message:", error.message);

            const errorMessage = error.response?.data?.message || error.message || "Profil bilgileri yüklenemedi!";
            showMessage("error", errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const loadUserStats = async () => {
        try {
            const response = await axios.get("/user/stats", {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });

            console.log("📊 İstatistikler yüklendi:", response.data);

            const statsData = response.data.success ? response.data : response.data;
            setStats(statsData);
        } catch (error) {
            console.error("⚠️ İstatistikler yüklenirken hata:", error);
            // Set default values on error
            setStats({
                totalOrders: 0,
                totalRevenue: 0,
                activeProducts: 0,
                marketplaceCount: marketplaces?.length || 0
            });
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            console.log("📝 Profil güncelleniyor:", profileForm);

            const response = await axios.put("/user/profile", profileForm, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });

            console.log("✅ Profil güncelleme yanıtı:", response.data);

            if (response.data.success) {
                showMessage("success", "Profil bilgileri başarıyla güncellendi!");
                loadUserProfile();
            } else {
                showMessage("error", response.data.message || "Profil güncellenemedi!");
            }
        } catch (error) {
            console.error("❌ Profil güncellenirken hata:", error);
            const errorMessage = error.response?.data?.message || "Profil güncellenemedi!";
            showMessage("error", errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showMessage("error", "Yeni şifreler eşleşmiyor!");
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            showMessage("error", "Şifre en az 6 karakter olmalıdır!");
            return;
        }

        setSaving(true);

        try {
            console.log("🔒 Şifre değiştiriliyor...");

            const response = await axios.put("/user/change-password", {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });

            console.log("✅ Şifre değiştirme yanıtı:", response.data);

            if (response.data.success) {
                showMessage("success", "Şifre başarıyla değiştirildi!");
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            } else {
                showMessage("error", response.data.message || "Şifre değiştirilemedi!");
            }
        } catch (error) {
            console.error("❌ Şifre değiştirilirken hata:", error);
            const errorMessage = error.response?.data?.message || "Şifre değiştirilemedi!";
            showMessage("error", errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleNotificationUpdate = async () => {
        setSaving(true);

        try {
            console.log("🔔 Bildirim tercihleri güncelleniyor:", notifications);

            const response = await axios.put("/user/notifications", notifications, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });

            console.log("✅ Bildirim güncelleme yanıtı:", response.data);

            if (response.data.success) {
                showMessage("success", "Bildirim tercihleri güncellendi!");
            } else {
                showMessage("error", response.data.message || "Bildirim tercihleri güncellenemedi!");
            }
        } catch (error) {
            console.error("❌ Bildirimler güncellenirken hata:", error);
            const errorMessage = error.response?.data?.message || "Bildirim tercihleri güncellenemedi!";
            showMessage("error", errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const generateApiKey = async () => {
        if (!newApiKeyName.trim()) {
            showMessage("error", "API anahtarı için bir isim girin!");
            return;
        }

        setSaving(true);

        try {
            console.log("🔑 API anahtarı oluşturuluyor:", newApiKeyName);

            const response = await axios.post("/user/api-key", {
                name: newApiKeyName
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });

            console.log("✅ API anahtarı oluşturuldu:", response.data);

            if (response.data.success || response.data.key) {
                const newKey = response.data.success ? response.data : response.data;
                setApiKeys([...apiKeys, newKey]);
                setNewApiKeyName("");
                showMessage("success", "API anahtarı oluşturuldu!");
            } else {
                showMessage("error", response.data.message || "API anahtarı oluşturulamadı!");
            }
        } catch (error) {
            console.error("❌ API anahtarı oluşturulurken hata:", error);
            const errorMessage = error.response?.data?.message || "API anahtarı oluşturulamadı!";
            showMessage("error", errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const revokeApiKey = async (keyId) => {
        if (!window.confirm("Bu API anahtarını iptal etmek istediğinizden emin misiniz?")) {
            return;
        }

        try {
            console.log("🗑️ API anahtarı iptal ediliyor:", keyId);

            const response = await axios.delete(`/user/api-key/${keyId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });

            console.log("✅ API anahtarı iptal edildi:", response.data);

            if (response.data.success) {
                setApiKeys(apiKeys.filter(k => k._id !== keyId));
                showMessage("success", "API anahtarı iptal edildi!");
            } else {
                showMessage("error", response.data.message || "API anahtarı iptal edilemedi!");
            }
        } catch (error) {
            console.error("❌ API anahtarı iptal edilirken hata:", error);
            const errorMessage = error.response?.data?.message || "API anahtarı iptal edilemedi!";
            showMessage("error", errorMessage);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showMessage("success", "Panoya kopyalandı!");
    };

    // Password strength calculator
    const calculatePasswordStrength = (password) => {
        if (!password) {
            return { score: 0, label: "", color: "" };
        }

        let score = 0;

        // Length check
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;

        // Character variety
        if (/[a-z]/.test(password)) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^a-zA-Z0-9]/.test(password)) score += 1;

        let label = "";
        let color = "";

        if (score <= 2) {
            label = "Zayıf";
            color = "#ef4444";
        } else if (score <= 4) {
            label = "Orta";
            color = "#f59e0b";
        } else {
            label = "Güçlü";
            color = "#22c55e";
        }

        return { score, label, color };
    };

    // Verify and show current password
    const handleShowCurrentPassword = async () => {
        if (!verifyPasswordInput) {
            showMessage("error", "Lütfen şifrenizi girin");
            return;
        }

        setVerifying(true);

        try {
            const response = await axios.post("/user/verify-password", {
                password: verifyPasswordInput
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });

            if (response.data.success) {
                setVerifiedCurrentPassword(verifyPasswordInput);
                setShowCurrentPasswordModal(false);
                setVerifyPasswordInput("");
                showMessage("success", "Şifre doğrulandı!");

                // Hide after 30 seconds
                setTimeout(() => {
                    setVerifiedCurrentPassword("");
                }, 30000);
            } else {
                showMessage("error", "Şifre yanlış!");
            }
        } catch (error) {
            console.error("❌ Şifre doğrulama hatası:", error);
            showMessage("error", error.response?.data?.message || "Şifre doğrulanamadı!");
        } finally {
            setVerifying(false);
        }
    };

    // Update password strength when new password changes
    useEffect(() => {
        if (passwordForm.newPassword) {
            const strength = calculatePasswordStrength(passwordForm.newPassword);
            setPasswordStrength(strength);
        } else {
            setPasswordStrength({ score: 0, label: "", color: "" });
        }
    }, [passwordForm.newPassword]);

    const tabs = [
        { id: "profile", label: "Profil Bilgileri", icon: FaUser },
        { id: "security", label: "Güvenlik", icon: FaLock },
        { id: "integrations", label: "Entegrasyonlar", icon: FaPlug },
        { id: "stats", label: "İstatistikler", icon: FaChartLine },
        { id: "notifications", label: "Bildirimler", icon: FaBell },
        { id: "api", label: "API Anahtarları", icon: FaKey }
    ];

    const formatCurrency = (value) => {
        return new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 0
        }).format(value || 0);
    };

    const formatDate = (date) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    if (loading) {
        return (
            <div className="user-profile-loading">
                <FaSpinner className="spinner" />
                <p>Profil yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="user-profile-page">
            {/* Message Toast */}
            <AnimatePresence>
                {message.text && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className={`profile-message ${message.type}`}
                    >
                        {message.type === "success" ? <FaCheckCircle /> : <FaExclamationTriangle />}
                        {message.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="profile-header">
                <div className="profile-header-content">
                    <div className="profile-avatar-section">
                        <div className="profile-avatar">
                            <img
                                src={user?.profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=4ecdc4&color=fff&size=200`}
                                alt={user?.name}
                            />
                            <button className="avatar-upload-btn">
                                <FaCamera />
                            </button>
                        </div>
                        <div className="profile-header-info">
                            <h1>{user?.name}</h1>
                            <p className="profile-email">
                                <FaEnvelope /> {user?.email}
                            </p>
                            <span className={`role-badge role-${user?.role}`}>
                                {user?.role === "admin" ? "Yönetici" :
                                 user?.role === "seller" ? "Satıcı" :
                                 user?.role === "dev" ? "Geliştirici" : "Kullanıcı"}
                            </span>
                        </div>
                    </div>
                    <div className="profile-header-stats">
                        <div className="header-stat">
                            <FaStore />
                            <span>{marketplaces?.length || 0}</span>
                            <p>Pazaryeri</p>
                        </div>
                        <div className="header-stat">
                            <FaClock />
                            <span>Aktif</span>
                            <p>Durum</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="profile-tabs">
                {tabs.map(tab => (
                    <motion.button
                        key={tab.id}
                        className={`profile-tab ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <tab.icon />
                        <span>{tab.label}</span>
                    </motion.button>
                ))}
            </div>

            {/* Content */}
            <div className="profile-content">
                <AnimatePresence mode="wait">
                    {/* Profile Tab */}
                    {activeTab === "profile" && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="profile-section"
                        >
                            <h2><FaUser /> Profil Bilgileri</h2>
                            <form onSubmit={handleProfileUpdate} className="profile-form">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Ad Soyad *</label>
                                        <input
                                            type="text"
                                            value={profileForm.name}
                                            onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>E-posta *</label>
                                        <input
                                            type="email"
                                            value={profileForm.email}
                                            onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label><FaPhone /> Telefon</label>
                                        <input
                                            type="tel"
                                            value={profileForm.phone}
                                            onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                                            placeholder="+90 5XX XXX XX XX"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label><FaBuilding /> Şirket</label>
                                        <input
                                            type="text"
                                            value={profileForm.company}
                                            onChange={(e) => setProfileForm({...profileForm, company: e.target.value})}
                                            placeholder="Şirket adı"
                                        />
                                    </div>
                                </div>

                                <h3><FaMapMarkerAlt /> Adres Bilgileri</h3>
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label>Adres</label>
                                        <input
                                            type="text"
                                            value={profileForm.address.street}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                address: {...profileForm.address, street: e.target.value}
                                            })}
                                            placeholder="Sokak, Mahalle, No"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Şehir</label>
                                        <input
                                            type="text"
                                            value={profileForm.address.city}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                address: {...profileForm.address, city: e.target.value}
                                            })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>İlçe</label>
                                        <input
                                            type="text"
                                            value={profileForm.address.state}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                address: {...profileForm.address, state: e.target.value}
                                            })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Posta Kodu</label>
                                        <input
                                            type="text"
                                            value={profileForm.address.zipCode}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                address: {...profileForm.address, zipCode: e.target.value}
                                            })}
                                        />
                                    </div>
                                </div>

                                <h3>Vergi Bilgileri</h3>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Vergi Numarası</label>
                                        <input
                                            type="text"
                                            value={profileForm.taxInfo.taxNumber}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                taxInfo: {...profileForm.taxInfo, taxNumber: e.target.value}
                                            })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Vergi Dairesi</label>
                                        <input
                                            type="text"
                                            value={profileForm.taxInfo.taxOffice}
                                            onChange={(e) => setProfileForm({
                                                ...profileForm,
                                                taxInfo: {...profileForm.taxInfo, taxOffice: e.target.value}
                                            })}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <FaSpinner className="spinner" /> : <FaSave />}
                                    {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* Security Tab */}
                    {activeTab === "security" && (
                        <motion.div
                            key="security"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="profile-section"
                        >
                            <h2><FaLock /> Güvenlik Ayarları</h2>

                            {/* Current Password Display */}
                            <div className="security-card">
                                <h3><FaKey /> Mevcut Şifre</h3>
                                <p className="security-info">
                                    Güvenlik nedeniyle şifrenizi görmek için doğrulama yapmanız gerekir.
                                </p>

                                {verifiedCurrentPassword ? (
                                    <div className="current-password-display">
                                        <div className="password-reveal">
                                            <FaCheckCircle style={{ color: "#22c55e" }} />
                                            <span className="password-text">{verifiedCurrentPassword}</span>
                                            <button
                                                onClick={() => copyToClipboard(verifiedCurrentPassword)}
                                                className="btn-icon"
                                                title="Kopyala"
                                            >
                                                <FaCopy />
                                            </button>
                                        </div>
                                        <p className="password-warning">
                                            <FaExclamationTriangle /> Bu şifre 30 saniye sonra gizlenecek
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowCurrentPasswordModal(true)}
                                        className="btn-secondary"
                                    >
                                        <FaEye /> Mevcut Şifremi Göster
                                    </button>
                                )}
                            </div>

                            {/* Password Verification Modal */}
                            {showCurrentPasswordModal && (
                                <div className="modal-overlay" onClick={() => setShowCurrentPasswordModal(false)}>
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="modal-content"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <h3><FaShieldAlt /> Şifre Doğrulama</h3>
                                        <p>Mevcut şifrenizi görmek için lütfen şifrenizi girin:</p>

                                        <div className="form-group">
                                            <input
                                                type="password"
                                                value={verifyPasswordInput}
                                                onChange={(e) => setVerifyPasswordInput(e.target.value)}
                                                placeholder="Şifrenizi girin"
                                                autoFocus
                                                onKeyPress={(e) => e.key === 'Enter' && handleShowCurrentPassword()}
                                            />
                                        </div>

                                        <div className="modal-actions">
                                            <button
                                                onClick={() => {
                                                    setShowCurrentPasswordModal(false);
                                                    setVerifyPasswordInput("");
                                                }}
                                                className="btn-secondary"
                                            >
                                                İptal
                                            </button>
                                            <button
                                                onClick={handleShowCurrentPassword}
                                                className="btn-primary"
                                                disabled={verifying || !verifyPasswordInput}
                                            >
                                                {verifying ? <FaSpinner className="spinner" /> : <FaCheckCircle />}
                                                {verifying ? "Doğrulanıyor..." : "Doğrula"}
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}

                            <div className="security-card">
                                <h3><FaShieldAlt /> Şifre Değiştir</h3>
                                <form onSubmit={handlePasswordChange} className="password-form">
                                    <div className="form-group">
                                        <label>Mevcut Şifre</label>
                                        <div className="password-input">
                                            <input
                                                type={showPasswords.current ? "text" : "password"}
                                                value={passwordForm.currentPassword}
                                                onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                                            >
                                                {showPasswords.current ? <FaEyeSlash /> : <FaEye />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Yeni Şifre</label>
                                        <div className="password-input">
                                            <input
                                                type={showPasswords.new ? "text" : "password"}
                                                value={passwordForm.newPassword}
                                                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                                            >
                                                {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                                            </button>
                                        </div>

                                        {/* Password Strength Indicator */}
                                        {passwordForm.newPassword && (
                                            <div className="password-strength">
                                                <div className="strength-bar">
                                                    <div
                                                        className="strength-fill"
                                                        style={{
                                                            width: `${(passwordStrength.score / 6) * 100}%`,
                                                            backgroundColor: passwordStrength.color
                                                        }}
                                                    />
                                                </div>
                                                <span style={{ color: passwordStrength.color, fontSize: "0.875rem", fontWeight: "600" }}>
                                                    {passwordStrength.label}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Yeni Şifre (Tekrar)</label>
                                        <div className="password-input">
                                            <input
                                                type={showPasswords.confirm ? "text" : "password"}
                                                value={passwordForm.confirmPassword}
                                                onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                                            >
                                                {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                                            </button>
                                        </div>

                                        {/* Password Match Indicator */}
                                        {passwordForm.confirmPassword && (
                                            <div style={{ marginTop: "0.5rem" }}>
                                                {passwordForm.newPassword === passwordForm.confirmPassword ? (
                                                    <span style={{ color: "#22c55e", fontSize: "0.875rem" }}>
                                                        <FaCheckCircle /> Şifreler eşleşiyor
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#ef4444", fontSize: "0.875rem" }}>
                                                        <FaExclamationTriangle /> Şifreler eşleşmiyor
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Password Requirements */}
                                    <div className="password-requirements">
                                        <p style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "0.5rem" }}>
                                            Güçlü bir şifre için:
                                        </p>
                                        <ul style={{ fontSize: "0.8rem", color: "#64748b", paddingLeft: "1.5rem" }}>
                                            <li style={{ color: passwordForm.newPassword?.length >= 8 ? "#22c55e" : "#64748b" }}>
                                                En az 8 karakter
                                            </li>
                                            <li style={{ color: /[A-Z]/.test(passwordForm.newPassword) ? "#22c55e" : "#64748b" }}>
                                                Büyük harf içermeli
                                            </li>
                                            <li style={{ color: /[a-z]/.test(passwordForm.newPassword) ? "#22c55e" : "#64748b" }}>
                                                Küçük harf içermeli
                                            </li>
                                            <li style={{ color: /[0-9]/.test(passwordForm.newPassword) ? "#22c55e" : "#64748b" }}>
                                                Rakam içermeli
                                            </li>
                                            <li style={{ color: /[^a-zA-Z0-9]/.test(passwordForm.newPassword) ? "#22c55e" : "#64748b" }}>
                                                Özel karakter içermeli (!@#$%^&*)
                                            </li>
                                        </ul>
                                    </div>

                                    <button type="submit" className="btn-primary" disabled={saving}>
                                        {saving ? <FaSpinner className="spinner" /> : <FaSave />}
                                        {saving ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
                                    </button>
                                </form>
                            </div>

                            <div className="security-card">
                                <h3><FaQrcode /> İki Faktörlü Doğrulama (2FA)</h3>
                                <p className="security-info">
                                    İki faktörlü doğrulama ile hesabınızı daha güvenli hale getirin.
                                </p>
                                <button className="btn-secondary">
                                    2FA'yı Etkinleştir (Yakında)
                                </button>
                            </div>

                            <div className="security-card">
                                <h3><FaClock /> Oturum Geçmişi</h3>
                                <p className="security-info">
                                    Son oturum açma işlemlerinizi görüntüleyin.
                                </p>
                                <div className="login-history">
                                    <div className="history-item">
                                        <div className="history-icon">
                                            <FaGlobe />
                                        </div>
                                        <div className="history-details">
                                            <p className="history-device">Windows 10 - Chrome</p>
                                            <p className="history-location">İstanbul, Türkiye</p>
                                            <p className="history-time">{formatDate(new Date())}</p>
                                        </div>
                                        <span className="history-badge current">Mevcut Oturum</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Integrations Tab */}
                    {activeTab === "integrations" && (
                        <motion.div
                            key="integrations"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="profile-section"
                        >
                            <h2><FaPlug /> Pazaryeri Entegrasyonları</h2>

                            {marketplaces && marketplaces.length > 0 ? (
                                <div className="integrations-grid">
                                    {marketplaces.map(mp => (
                                        <div key={mp._id} className="integration-card">
                                            <div className="integration-header">
                                                {mp.logo ? (
                                                    <img src={mp.logo} alt={mp.marketplaceName} className="integration-logo" />
                                                ) : (
                                                    <div className="integration-logo-placeholder">
                                                        <FaStore />
                                                    </div>
                                                )}
                                                <h3>{mp.marketplaceName || mp.name}</h3>
                                            </div>
                                            <div className="integration-details">
                                                <p><strong>Seller ID:</strong> {mp.credentials?.sellerId || mp.credentials?.supplierId || "N/A"}</p>
                                                <p><strong>Durum:</strong> <span className="status-badge active">Aktif</span></p>
                                                <p><strong>Son Güncelleme:</strong> {formatDate(mp.updatedAt)}</p>
                                            </div>
                                            <button className="btn-secondary">
                                                <FaCog /> Ayarlar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <FaPlug />
                                    <h3>Henüz entegrasyon yok</h3>
                                    <p>Entegrasyonlar sayfasından pazaryeri ekleyebilirsiniz.</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Stats Tab */}
                    {activeTab === "stats" && (
                        <motion.div
                            key="stats"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="profile-section"
                        >
                            <h2><FaChartLine /> İstatistikler</h2>

                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.2)" }}>
                                        <FaShoppingCart style={{ color: "#10b981" }} />
                                    </div>
                                    <div className="stat-content">
                                        <h3>Toplam Sipariş</h3>
                                        <p className="stat-value">{stats.totalOrders?.toLocaleString("tr-TR") || 0}</p>
                                        <span className="stat-change positive">+12% bu ay</span>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: "rgba(78, 205, 196, 0.2)" }}>
                                        <FaMoneyBillWave style={{ color: "#4ecdc4" }} />
                                    </div>
                                    <div className="stat-content">
                                        <h3>Toplam Gelir</h3>
                                        <p className="stat-value">{formatCurrency(stats.totalRevenue || 0)}</p>
                                        <span className="stat-change positive">+8% bu ay</span>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: "rgba(6, 182, 212, 0.2)" }}>
                                        <FaBox style={{ color: "#06b6d4" }} />
                                    </div>
                                    <div className="stat-content">
                                        <h3>Aktif Ürün</h3>
                                        <p className="stat-value">{stats.activeProducts?.toLocaleString("tr-TR") || 0}</p>
                                        <span className="stat-change neutral">Sabit</span>
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: "rgba(139, 92, 246, 0.2)" }}>
                                        <FaStore style={{ color: "#8b5cf6" }} />
                                    </div>
                                    <div className="stat-content">
                                        <h3>Pazaryeri</h3>
                                        <p className="stat-value">{marketplaces?.length || 0}</p>
                                        <span className="stat-change neutral">Aktif</span>
                                    </div>
                                </div>
                            </div>

                            <div className="performance-section">
                                <h3>Son 7 Günlük Performans</h3>
                                <div className="performance-chart">
                                    <div className="chart-bars">
                                        {[
                                            { day: "Pzt", orders: 45, revenue: 12500 },
                                            { day: "Sal", orders: 52, revenue: 15200 },
                                            { day: "Çar", orders: 38, revenue: 10800 },
                                            { day: "Per", orders: 61, revenue: 18900 },
                                            { day: "Cum", orders: 55, revenue: 16400 },
                                            { day: "Cmt", orders: 42, revenue: 11200 },
                                            { day: "Paz", orders: 35, revenue: 9500 }
                                        ].map((data, index) => {
                                            const maxOrders = 70;
                                            const height = (data.orders / maxOrders) * 100;
                                            return (
                                                <div key={index} className="chart-bar-container">
                                                    <div className="chart-bar-wrapper">
                                                        <div
                                                            className="chart-bar"
                                                            style={{ height: `${height}%` }}
                                                            title={`${data.orders} sipariş - ${formatCurrency(data.revenue)}`}
                                                        >
                                                            <span className="bar-value">{data.orders}</span>
                                                        </div>
                                                    </div>
                                                    <span className="chart-label">{data.day}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="chart-legend">
                                        <div className="legend-item">
                                            <div className="legend-color" style={{ background: "linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)" }}></div>
                                            <span>Günlük Sipariş Sayısı</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="performance-insights">
                                    <h4>Önemli Bilgiler</h4>
                                    <div className="insights-grid">
                                        <div className="insight-card">
                                            <FaCheckCircle style={{ color: "#22c55e" }} />
                                            <div>
                                                <strong>En Yüksek Satış</strong>
                                                <p>Perşembe günü 61 sipariş ile en yüksek satış gerçekleşti</p>
                                            </div>
                                        </div>
                                        <div className="insight-card">
                                            <FaChartLine style={{ color: "#3b82f6" }} />
                                            <div>
                                                <strong>Haftalık Ortalama</strong>
                                                <p>Günlük ortalama 47 sipariş alındı</p>
                                            </div>
                                        </div>
                                        <div className="insight-card">
                                            <FaMoneyBillWave style={{ color: "#4ecdc4" }} />
                                            <div>
                                                <strong>Toplam Gelir</strong>
                                                <p>Son 7 günde {formatCurrency(94500)} gelir elde edildi</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === "notifications" && (
                        <motion.div
                            key="notifications"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="profile-section"
                        >
                            <h2><FaBell /> Bildirim Tercihleri</h2>
                            <div className="notification-info-card">
                                <FaInfoCircle />
                                <div>
                                    <strong>Bildirim Sistemi Hakkında</strong>
                                    <p>
                                        Bildirim tercihlerinizi buradan yönetebilirsiniz. Seçtiğiniz kanallara göre
                                        önemli olaylar (yeni sipariş, stok azalması, ödeme bildirimleri vb.) size
                                        iletilecektir. E-posta bildirimleri anında, SMS bildirimleri acil durumlar için,
                                        push bildirimleri ise tarayıcınız üzerinden gönderilir.
                                    </p>
                                </div>
                            </div>

                            <div className="notification-groups">
                                <div className="notification-group">
                                    <h3>Bildirim Kanalları</h3>
                                    <div className="notification-item">
                                        <div className="notification-info">
                                            <FaEnvelope />
                                            <div>
                                                <h4>E-posta Bildirimleri</h4>
                                                <p>Önemli güncellemeler e-posta ile gönderilsin</p>
                                            </div>
                                        </div>
                                        <label className="toggle">
                                            <input
                                                type="checkbox"
                                                checked={notifications.email}
                                                onChange={(e) => setNotifications({...notifications, email: e.target.checked})}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="notification-item">
                                        <div className="notification-info">
                                            <FaPhone />
                                            <div>
                                                <h4>SMS Bildirimleri</h4>
                                                <p>Acil durumlar için SMS gönderilsin</p>
                                            </div>
                                        </div>
                                        <label className="toggle">
                                            <input
                                                type="checkbox"
                                                checked={notifications.sms}
                                                onChange={(e) => setNotifications({...notifications, sms: e.target.checked})}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="notification-item">
                                        <div className="notification-info">
                                            <FaBell />
                                            <div>
                                                <h4>Push Bildirimleri</h4>
                                                <p>Tarayıcı bildirimleri aktif olsun</p>
                                            </div>
                                        </div>
                                        <label className="toggle">
                                            <input
                                                type="checkbox"
                                                checked={notifications.push}
                                                onChange={(e) => setNotifications({...notifications, push: e.target.checked})}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>

                                <div className="notification-group">
                                    <h3>Bildirim Türleri</h3>
                                    <div className="notification-item">
                                        <div className="notification-info">
                                            <FaShoppingCart />
                                            <div>
                                                <h4>Sipariş Bildirimleri</h4>
                                                <p>Yeni sipariş, iptal, iade bildirimleri</p>
                                            </div>
                                        </div>
                                        <label className="toggle">
                                            <input
                                                type="checkbox"
                                                checked={notifications.orderNotifications}
                                                onChange={(e) => setNotifications({...notifications, orderNotifications: e.target.checked})}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="notification-item">
                                        <div className="notification-info">
                                            <FaBox />
                                            <div>
                                                <h4>Stok Bildirimleri</h4>
                                                <p>Stok azalma, tükenme bildirimleri</p>
                                            </div>
                                        </div>
                                        <label className="toggle">
                                            <input
                                                type="checkbox"
                                                checked={notifications.stockNotifications}
                                                onChange={(e) => setNotifications({...notifications, stockNotifications: e.target.checked})}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    <div className="notification-item">
                                        <div className="notification-info">
                                            <FaMoneyBillWave />
                                            <div>
                                                <h4>Finans Bildirimleri</h4>
                                                <p>Ödeme, fatura bildirimleri</p>
                                            </div>
                                        </div>
                                        <label className="toggle">
                                            <input
                                                type="checkbox"
                                                checked={notifications.financeNotifications}
                                                onChange={(e) => setNotifications({...notifications, financeNotifications: e.target.checked})}
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleNotificationUpdate} className="btn-primary" disabled={saving}>
                                {saving ? <FaSpinner className="spinner" /> : <FaSave />}
                                {saving ? "Kaydediliyor..." : "Tercihleri Kaydet"}
                            </button>
                        </motion.div>
                    )}

                    {/* API Keys Tab */}
                    {activeTab === "api" && (
                        <motion.div
                            key="api"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="profile-section"
                        >
                            <h2><FaKey /> API Anahtarları</h2>
                            <div className="api-info-card">
                                <h3><FaInfoCircle /> API Anahtarları Nedir?</h3>
                                <p className="section-description">
                                    API anahtarları, harici uygulamalar, mobil uygulamalar veya otomatik sistemlerin
                                    LysiaETIC platformuna güvenli bir şekilde erişmesini sağlar.
                                </p>
                                <div className="api-use-cases">
                                    <h4>Kullanım Alanları:</h4>
                                    <ul>
                                        <li><FaCheckCircle /> <strong>Mobil Uygulama:</strong> Kendi mobil uygulamanızı geliştirirken API anahtarı kullanabilirsiniz</li>
                                        <li><FaCheckCircle /> <strong>Otomasyon:</strong> Stok, sipariş ve fiyat güncellemelerini otomatik yapabilirsiniz</li>
                                        <li><FaCheckCircle /> <strong>Entegrasyon:</strong> Kendi ERP, WMS veya muhasebe sisteminizle entegre edebilirsiniz</li>
                                        <li><FaCheckCircle /> <strong>Raporlama:</strong> Özel raporlama araçları için veri çekebilirsiniz</li>
                                        <li><FaCheckCircle /> <strong>Webhook:</strong> Gerçek zamanlı bildirimler alabilirsiniz</li>
                                    </ul>
                                </div>
                                <div className="api-security-warning">
                                    <FaExclamationTriangle />
                                    <div>
                                        <strong>Güvenlik Uyarısı:</strong>
                                        <p>API anahtarlarınızı asla başkalarıyla paylaşmayın ve güvenli bir yerde saklayın.
                                        Şüpheli bir durum fark ederseniz hemen anahtarı iptal edin ve yeni bir tane oluşturun.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="api-key-create">
                                <input
                                    type="text"
                                    placeholder="API anahtarı adı (örn: Mobil Uygulama)"
                                    value={newApiKeyName}
                                    onChange={(e) => setNewApiKeyName(e.target.value)}
                                />
                                <button onClick={generateApiKey} className="btn-primary" disabled={saving}>
                                    {saving ? <FaSpinner className="spinner" /> : <FaKey />}
                                    Yeni Anahtar Oluştur
                                </button>
                            </div>

                            {apiKeys.length > 0 ? (
                                <div className="api-keys-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>İsim</th>
                                                <th>Anahtar</th>
                                                <th>Oluşturulma</th>
                                                <th>Son Kullanım</th>
                                                <th>İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {apiKeys.map(key => (
                                                <tr key={key._id}>
                                                    <td>{key.name}</td>
                                                    <td className="api-key-cell">
                                                        <code>
                                                            {showApiKey[key._id] ? key.key : "••••••••••••••••"}
                                                        </code>
                                                        <button
                                                            onClick={() => setShowApiKey({...showApiKey, [key._id]: !showApiKey[key._id]})}
                                                            className="btn-icon"
                                                        >
                                                            {showApiKey[key._id] ? <FaEyeSlash /> : <FaEye />}
                                                        </button>
                                                        <button
                                                            onClick={() => copyToClipboard(key.key)}
                                                            className="btn-icon"
                                                        >
                                                            <FaCopy />
                                                        </button>
                                                    </td>
                                                    <td>{formatDate(key.createdAt)}</td>
                                                    <td>{key.lastUsed ? formatDate(key.lastUsed) : "Hiç kullanılmadı"}</td>
                                                    <td>
                                                        <button
                                                            onClick={() => revokeApiKey(key._id)}
                                                            className="btn-danger-small"
                                                        >
                                                            <FaTrash /> İptal Et
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <FaKey />
                                    <h3>Henüz API anahtarı yok</h3>
                                    <p>Yukarıdaki formu kullanarak yeni bir API anahtarı oluşturabilirsiniz.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default UserProfilePage;
