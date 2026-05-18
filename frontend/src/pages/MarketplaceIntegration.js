import React, { useState, useEffect, useCallback } from "react";
import { FaGlobe, FaKey, FaEdit, FaTrash, FaTimes, FaCheck, FaPlug, FaRocket, FaFlag } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import API from "../services/api";
import { useApp } from "../context/AppContext";
import World3D from "../components/World3D";
import "../styles/MarketplaceIntegration.css";

// ✅ FIX #3: fetch() → api.js (axios) — 401 interceptor + token refresh çalışır
const getUserIntegrations = async () => {
    try {
        const response = await API.get("/marketplace/user-marketplaces");
        return response.data || [];
    } catch (error) {
        if (error.response?.status === 404) return [];
        return [];
    }
};

/* ═══════════════════════════════════════════════════════════
   Country flag emojis & region config
   ═══════════════════════════════════════════════════════════ */
const REGION_CONFIG = {
    "Türkiye": { icon: <FaFlag />, color: "#e74c3c" },
    "Avrupa":  { icon: <FaGlobe />, color: "#3498db" },
    "Asya":    { icon: <FaGlobe />, color: "#e67e22" },
    "Amerika": { icon: <FaGlobe />, color: "#2ecc71" },
};

const MarketplaceIntegration = () => {
    const { t } = useApp();
    const regions = [
        {
            name: "Türkiye",
            platforms: [
                { name: "Trendyol", fields: ["apiKey", "apiSecret", "sellerId"], description: "Trendyol Entegratör API - Supplier ID, API Key ve API Secret gereklidir" },
                { name: "Hepsiburada", fields: ["merchantId", "secretKey", "userAgent", "useSit"], fieldLabels: { merchantId: "Merchant ID (Mağaza ID)", secretKey: "Secret Key (Servis Anahtarı)", userAgent: "Developer Username (User-Agent)", useSit: "API Ortamı" }, fieldHints: { merchantId: "Hepsiburada'nın size verdiği Merchant ID (UUID formatında)", secretKey: "Satıcı Paneli → Entegrasyon → Entegratör Bilgileri → Servis Anahtarı", userAgent: "Hepsiburada'nın size verdiği Developer Username (ör: firmaadi_dev)", useSit: "Test hesabı için SIT, gerçek mağaza için Canlı seçin" }, fieldTypes: { useSit: "toggle" }, fieldDefaults: { useSit: false }, description: "Hepsiburada Merchant API — Merchant ID, Secret Key ve Developer Username gereklidir. Basic Auth: base64(merchantId:secretKey)" },
                { name: "n11", fields: ["apiKey", "secretKey", "shipmentTemplate"], fieldLabels: { apiKey: "App Key", secretKey: "App Secret", shipmentTemplate: "Kargo Şablon Adı" }, fieldDefaults: { shipmentTemplate: "STANDART" }, fieldHints: { shipmentTemplate: "N11 Paneli → Hesabım → Teslimat Bilgileri → Şablon Adı" }, description: "N11 REST API — App Key ve App Secret zorunludur." },
                { name: "Amazon Türkiye", fields: ["sellerId", "clientId", "clientSecret", "refreshToken", "accessKeyId", "secretAccessKey", "marketplaceId"], fieldLabels: { sellerId: "Seller ID", clientId: "LWA Client ID", clientSecret: "LWA Client Secret", refreshToken: "LWA Refresh Token", accessKeyId: "AWS Access Key ID", secretAccessKey: "AWS Secret Access Key", marketplaceId: "Marketplace ID" }, fieldDefaults: { marketplaceId: "A33AVAJ2PDY3EV" }, fieldHints: { sellerId: "Seller Central → Hesap Bilgileri → Satıcı ID", clientId: "Developer Central → LWA Credentials → Client ID", clientSecret: "Developer Central → LWA Credentials → Client Secret", refreshToken: "SP-API uygulaması yetkilendirildikten sonra alınan token", accessKeyId: "AWS IAM → Kullanıcı → Access Key ID", secretAccessKey: "AWS IAM → Kullanıcı → Secret Access Key", marketplaceId: "Türkiye: A33AVAJ2PDY3EV" }, description: "Amazon SP-API — Seller ID, LWA Credentials ve AWS IAM Keys gereklidir" },
                { name: "ÇiçekSepeti", fields: ["apiKey", "sellerId", "integratorName"], fieldLabels: { apiKey: "API Key (x-api-key)", sellerId: "Satıcı ID", integratorName: "Entegratör Adı (opsiyonel)" }, fieldHints: { apiKey: "Satıcı Paneli → Hesap Yönetimi → Entegrasyon Bilgilerim", sellerId: "Satıcı Paneli → Entegrasyon Bilgilerim → Satıcı ID", integratorName: "Entegratör firma ile çalışıyorsanız doldurun, yoksa boş bırakın" }, fieldRequired: { apiKey: true, sellerId: true, integratorName: false }, description: "ÇiçekSepeti Marketplace API — API Key ve Satıcı ID zorunludur. Canlı ortam: apis.ciceksepeti.com" },
                { name: "GittiGidiyor", fields: ["apiKey", "secretKey", "role", "nick"], description: "GittiGidiyor API (Kapatıldı) - Eski entegrasyonlar için" },
                { name: "Morhipo", fields: ["supplierId", "apiKey", "apiSecret"], description: "Morhipo Entegrasyon API - Supplier ID, API Key ve API Secret gereklidir" },
                { name: "PttAVM", fields: ["merchantCode", "apiKey", "apiSecret"], description: "PttAVM Entegrasyon API - Merchant Code, API Key ve API Secret gereklidir" },
                { name: "Teknosa", fields: ["supplierId", "apiKey", "apiPassword"], description: "Teknosa Marketplace API - Supplier ID, API Key ve API Password gereklidir" },
                { name: "ePttAVM", fields: ["merchantId", "apiKey", "apiSecret"], description: "ePttAVM Entegrasyon API - Merchant ID, API Key ve API Secret gereklidir" }
            ]
        },
        {
            name: "Avrupa",
            platforms: [
                { name: "Amazon Europe", fields: ["sellerId", "clientId", "clientSecret", "refreshToken", "accessKeyId", "secretAccessKey", "marketplaceId"], fieldLabels: { sellerId: "Seller ID", clientId: "LWA Client ID", clientSecret: "LWA Client Secret", refreshToken: "LWA Refresh Token", accessKeyId: "AWS Access Key ID", secretAccessKey: "AWS Secret Access Key", marketplaceId: "Marketplace ID" }, fieldDefaults: { marketplaceId: "A1PA6795UKMFR9" }, fieldHints: { sellerId: "Seller Central → Account Info → Merchant Token", clientId: "Developer Central → LWA Credentials", clientSecret: "Developer Central → LWA Credentials", refreshToken: "SP-API app authorization token", accessKeyId: "AWS IAM → User → Access Key", secretAccessKey: "AWS IAM → User → Secret Key", marketplaceId: "DE: A1PA6795UKMFR9, UK: A1F83G8C2ARO7P, FR: A13V1IB3VIYZZH, IT: APJ6JRA9NG5V4, ES: A1RKKUPIHCS9HS" }, description: "Amazon SP-API Europe — Seller ID, LWA Credentials ve AWS IAM Keys gereklidir" },
                { name: "eBay", fields: ["appId", "devId", "certId", "userToken", "siteId"], description: "eBay Trading API - App ID, Dev ID, Cert ID, User Token ve Site ID gereklidir" },
                { name: "Etsy", fields: ["apiKey", "sharedSecret", "shopId", "accessToken"], description: "Etsy API v3 - API Key, Shared Secret, Shop ID ve OAuth Access Token gereklidir" },
                { name: "Allegro", fields: ["clientId", "clientSecret", "refreshToken"], description: "Allegro REST API - Client ID, Client Secret ve Refresh Token gereklidir" }
            ]
        },
        {
            name: "Asya",
            platforms: [
                { name: "AliExpress", fields: ["appKey", "appSecret", "sessionKey"], description: "AliExpress Open Platform API - App Key, App Secret ve Session Key gereklidir" },
                { name: "Rakuten", fields: ["serviceSecret", "licenseKey", "shopUrl"], description: "Rakuten RMS API - Service Secret, License Key ve Shop URL gereklidir" },
                { name: "Lazada", fields: ["appKey", "appSecret", "accessToken"], description: "Lazada Open Platform API - App Key, App Secret ve Access Token gereklidir" },
                { name: "Shopee", fields: ["partnerId", "partnerKey", "shopId", "accessToken"], description: "Shopee Open Platform API - Partner ID, Partner Key, Shop ID ve Access Token gereklidir" }
            ]
        },
        {
            name: "Amerika",
            platforms: [
                { name: "Amazon USA", fields: ["sellerId", "clientId", "clientSecret", "refreshToken", "accessKeyId", "secretAccessKey", "marketplaceId"], fieldLabels: { sellerId: "Seller ID", clientId: "LWA Client ID", clientSecret: "LWA Client Secret", refreshToken: "LWA Refresh Token", accessKeyId: "AWS Access Key ID", secretAccessKey: "AWS Secret Access Key", marketplaceId: "Marketplace ID" }, fieldDefaults: { marketplaceId: "ATVPDKIKX0DER" }, fieldHints: { sellerId: "Seller Central → Account Info → Merchant Token", clientId: "Developer Central → LWA Credentials", clientSecret: "Developer Central → LWA Credentials", refreshToken: "SP-API app authorization token", accessKeyId: "AWS IAM → User → Access Key", secretAccessKey: "AWS IAM → User → Secret Key", marketplaceId: "US: ATVPDKIKX0DER, CA: A2EUQ1WTGCTBG2, MX: A1AM78C64UM0Y8" }, description: "Amazon SP-API North America — Seller ID, LWA Credentials ve AWS IAM Keys gereklidir" },
                { name: "Walmart", fields: ["clientId", "clientSecret", "consumerId"], description: "Walmart Marketplace API - Client ID, Client Secret ve Consumer ID gereklidir" },
                { name: "Shopify", fields: ["shopName", "apiKey", "apiSecret", "accessToken"], description: "Shopify Admin API - Shop Name, API Key, API Secret ve Access Token gereklidir" }
            ]
        }
    ];

    const [selectedRegion, setSelectedRegion] = useState(null);
    const [expandedPlatform, setExpandedPlatform] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [formData, setFormData] = useState({});
    const userId = localStorage.getItem("userId");

    /** Sunucudaki kayıtlı SIT/Canlı seçimini forma yansıt (maskeli güncellemede yanlışlıkla Canlı'ya dönmesini önler) */
    const hydrateHepsiburadaToggleFromApi = useCallback(() => {
        const row = integrations.find((i) => i.marketplaceName === "Hepsiburada");
        const sit = row?.integrationHints?.useSit;
        if (typeof sit !== "boolean") return;
        setFormData((prev) => ({
            ...prev,
            Hepsiburada: { ...(prev.Hepsiburada || {}), useSit: sit }
        }));
    }, [integrations]);

    useEffect(() => {
        const fetchIntegrations = async () => {
            try {
                const data = await getUserIntegrations();
                setIntegrations(data);
            } catch { /* silently handle */ }
        };
        if (userId) fetchIntegrations();
    }, [userId]);

    const handleIntegration = async (platform) => {
        const uid = localStorage.getItem("userId");
        if (!uid) { alert(t("mi.authError")); return; }

        const platformFormData = formData[platform.name] || {};
        const credentials = {};
        platform.fields.forEach(field => {
            const val = platformFormData[field];
            if (field === "useSit") {
                credentials[field] =
                    typeof val === "boolean"
                        ? val
                        : (platform.fieldDefaults?.[field] ?? false);
                return;
            }
            credentials[field] = val !== undefined && val !== null && val !== ""
                ? val
                : (platform.fieldDefaults?.[field] ?? "");
        });

        const hasEmptyRequiredFields = platform.fields.some(field => {
            const isRequired = platform.fieldRequired ? platform.fieldRequired[field] !== false : true;
            const val = credentials[field];
            if (typeof val === "boolean") return false; // checkbox alanları boş sayılmaz
            return isRequired && (!val || !String(val).trim());
        });
        if (hasEmptyRequiredFields) { alert(`❌ ${t("mi.fillRequired")}`); return; }

        try {
            const response = await API.post("/marketplace/integrate", {
                userId: uid, marketplaceName: platform.name, credentials
            });
            const data = response.data;
            alert(data.isUpdate ? `✅ ${platform.name} ${t("mi.updated")}` : `✅ ${platform.name} ${t("mi.integrationSuccess")}`);
            const updated = await getUserIntegrations();
            setIntegrations(updated);
            setFormData(prev => ({ ...prev, [platform.name]: {} }));
            setExpandedPlatform(null);
        } catch (error) {
            alert(`❌ ${error.response?.data?.message || t("mi.serverError")}`);
        }
    };

    const handleDeleteIntegration = async (platform) => {
        const toDelete = integrations.find(int => int.marketplaceName === platform.name);
        if (!toDelete) return;
        if (!window.confirm(`${platform.name} ${t("mi.deleteConfirm")}`)) return;

        try {
            await API.delete(`/marketplace/${toDelete._id}`);
            alert(`✅ ${platform.name} ${t("mi.deleted")}`);
            const updated = await getUserIntegrations();
            setIntegrations(updated);
            setFormData(prev => ({ ...prev, [platform.name]: {} }));
        } catch (error) {
            alert(`❌ ${error.response?.data?.message || t("mi.deleteFailed")}`);
        }
    };

    const connectedCount = integrations.length;
    const totalPlatforms = regions.reduce((sum, r) => sum + r.platforms.length, 0);

    return (
        <div className="mi-page">
            {/* ═══ GALAXY BACKGROUND — sticky, stays behind while scrolling ═══ */}
            <div className="mi-galaxy">
                <World3D />
                {/* Gradient fade at bottom so content blends in */}
                <div className="mi-galaxy-fade" />
            </div>

            {/* ═══ HERO OVERLAY — sits on top of galaxy ═══ */}
            <div className="mi-hero">
                <motion.div
                    className="mi-brand"
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                >
                    <div className="mi-brand-logo">
                        <span className="mi-brand-main">PazarYonet</span>
                        <span className="mi-brand-sub">Platform</span>
                    </div>
                    <p className="mi-brand-tagline">Global Pazaryeri Entegrasyon Merkezi</p>
                    <p className="mi-brand-hint">🖱️ Fareyi sürükleyerek uzayda gezinin · Scroll ile yakınlaşın</p>
                </motion.div>

                <motion.div
                    className="mi-stats"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                >
                    <div className="mi-stat-card">
                        <FaGlobe className="mi-stat-icon" />
                        <span className="mi-stat-num">{regions.length}</span>
                        <span className="mi-stat-label">Bölge</span>
                    </div>
                    <div className="mi-stat-card">
                        <FaPlug className="mi-stat-icon" />
                        <span className="mi-stat-num">{totalPlatforms}</span>
                        <span className="mi-stat-label">Pazaryeri</span>
                    </div>
                    <div className="mi-stat-card mi-stat-card--glow">
                        <FaRocket className="mi-stat-icon" />
                        <span className="mi-stat-num">{connectedCount}</span>
                        <span className="mi-stat-label">Aktif</span>
                    </div>
                </motion.div>
            </div>

            {/* ═══ MAIN CONTENT — below galaxy ═══ */}
            <div className="mi-body">

                {/* Region Selector */}
                <section className="mi-section">
                    <h2 className="mi-section-title">
                        <FaGlobe style={{ color: '#4ecdc4' }} /> Bölge Seçin
                    </h2>
                    <div className="mi-region-grid">
                        {regions.map((region, idx) => {
                            const cfg = REGION_CONFIG[region.name] || {};
                            const regionConnected = region.platforms.filter(p =>
                                integrations.some(i => i.marketplaceName === p.name)
                            ).length;
                            const isSelected = selectedRegion?.name === region.name;

                            return (
                                <motion.div
                                    key={region.name}
                                    className={`mi-region-card ${isSelected ? "mi-region-card--active" : ""}`}
                                    onClick={() => {
                                        setSelectedRegion(isSelected ? null : region);
                                        setExpandedPlatform(null);
                                    }}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.08, duration: 0.35 }}
                                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                                    style={{ '--rc': cfg.color || '#4ecdc4' }}
                                >
                                    <div className="mi-region-flag">{cfg.icon}</div>
                                    <div className="mi-region-info">
                                        <h3>{region.name}</h3>
                                        <span className="mi-region-count">{region.platforms.length} pazaryeri</span>
                                    </div>
                                    <div className="mi-region-status">
                                        <span className="mi-region-num">{regionConnected}</span>
                                        <span className="mi-region-lbl">aktif</span>
                                    </div>
                                    {isSelected && <div className="mi-region-bar" />}
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                {/* Platform List */}
                <AnimatePresence mode="wait">
                    {selectedRegion && (
                        <motion.section
                            key={selectedRegion.name}
                            className="mi-section"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <div className="mi-section-head">
                                <h2>
                                    {REGION_CONFIG[selectedRegion.name]?.icon} {selectedRegion.name} Pazaryerleri
                                </h2>
                                <button className="mi-close-btn" onClick={() => setSelectedRegion(null)}>
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="mi-platform-grid">
                                {selectedRegion.platforms.map((platform, idx) => {
                                    const isConnected = integrations.some(i => i.marketplaceName === platform.name);
                                    const isExpanded = expandedPlatform === platform.name;

                                    return (
                                        <motion.div
                                            key={platform.name}
                                            className={`mi-pcard ${isConnected ? "mi-pcard--on" : ""}`}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05, duration: 0.25 }}
                                        >
                                            <div className="mi-pcard-head" onClick={() => {
                                                const next = isExpanded ? null : platform.name;
                                                setExpandedPlatform(next);
                                                if (next === "Hepsiburada") hydrateHepsiburadaToggleFromApi();
                                            }}>
                                                <div className="mi-pcard-left">
                                                    <div className={`mi-pcard-dot ${isConnected ? "mi-pcard-dot--on" : ""}`} />
                                                    <h3>{platform.name}</h3>
                                                </div>
                                                <span className={`mi-pcard-badge ${isConnected ? "mi-pcard-badge--on" : ""}`}>
                                                    {isConnected ? <><FaCheck /> Bağlı</> : "Bağlı Değil"}
                                                </span>
                                            </div>

                                            {platform.description && (
                                                <p className="mi-pcard-desc">{platform.description}</p>
                                            )}

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        className="mi-pcard-form"
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <div className="mi-fields">
                                                            {platform.fields.map(field => {
                                                                const label = platform.fieldLabels?.[field] || field.replace(/([A-Z])/g, ' $1').trim();
                                                                const hint = platform.fieldHints?.[field];
                                                                const isOptional = platform.fieldRequired && platform.fieldRequired[field] === false;
                                                                const fieldType = platform.fieldTypes?.[field];
                                                                const sensitive = ["apiKey","secretKey","appKey","appSecret","apiSecret","apiPassword","accessToken","sessionKey","clientSecret","mwsAuthToken","userToken","certId","partnerKey","licenseKey","serviceSecret"];
                                                                const inputType = fieldType === "checkbox" ? "checkbox" : (sensitive.includes(field) ? "password" : "text");
                                                                const defaultVal = platform.fieldDefaults?.[field] || "";

                                                                // Toggle buton alanı (Canlı Ortam / SIT Ortamı)
                                                                if (fieldType === "toggle" || fieldType === "checkbox") {
                                                                    const isActive = !!(formData[platform.name]?.[field]);
                                                                    return (
                                                                        <div key={field} className="mi-field mi-field--toggle">
                                                                            <label className="mi-toggle-label">{label}</label>
                                                                            <div className="mi-toggle-buttons">
                                                                                <button
                                                                                    type="button"
                                                                                    className={`mi-toggle-btn ${!isActive ? "mi-toggle-btn--active mi-toggle-btn--live" : ""}`}
                                                                                    onClick={() => setFormData(prev => ({
                                                                                        ...prev,
                                                                                        [platform.name]: {
                                                                                            ...(prev[platform.name] || {}),
                                                                                            [field]: false
                                                                                        }
                                                                                    }))}
                                                                                >
                                                                                    🟢 Canlı Ortam
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    className={`mi-toggle-btn ${isActive ? "mi-toggle-btn--active mi-toggle-btn--sit" : ""}`}
                                                                                    onClick={() => setFormData(prev => ({
                                                                                        ...prev,
                                                                                        [platform.name]: {
                                                                                            ...(prev[platform.name] || {}),
                                                                                            [field]: true
                                                                                        }
                                                                                    }))}
                                                                                >
                                                                                    🧪 SIT Ortamı
                                                                                </button>
                                                                            </div>
                                                                            {hint && <small className="mi-field-hint">💡 {hint}</small>}
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <div key={field} className="mi-field">
                                                                        <label>{label}{isOptional && <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: '0.4rem', fontWeight: 400 }}>(opsiyonel)</span>}</label>
                                                                        <input
                                                                            type={inputType}
                                                                            placeholder={hint || (defaultVal ? `Varsayılan: ${defaultVal}` : `${label} girin...`)}
                                                                            value={(formData[platform.name]?.[field]) || ""}
                                                                            onChange={(e) => setFormData(prev => ({
                                                                                ...prev,
                                                                                [platform.name]: {
                                                                                    ...(prev[platform.name] || {}),
                                                                                    [field]: e.target.value.trim()
                                                                                }
                                                                            }))}
                                                                        />
                                                                        {hint && <small className="mi-field-hint">💡 {hint}</small>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mi-actions">
                                                            {isConnected ? (
                                                                <>
                                                                    <button className="mi-btn mi-btn--update" onClick={() => handleIntegration(platform)}>
                                                                        <FaEdit /> Güncelle
                                                                    </button>
                                                                    <button className="mi-btn mi-btn--delete" onClick={() => handleDeleteIntegration(platform)}>
                                                                        <FaTrash /> Sil
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button className="mi-btn mi-btn--connect" onClick={() => handleIntegration(platform)}>
                                                                    <FaKey /> Entegre Et
                                                                </button>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {!isExpanded && (
                                                <button
                                                    className="mi-pcard-toggle"
                                                    onClick={() => {
                                                        setExpandedPlatform(platform.name);
                                                        if (platform.name === "Hepsiburada") hydrateHepsiburadaToggleFromApi();
                                                    }}
                                                >
                                                    {isConnected ? "Düzenle" : "Bağlan"}
                                                </button>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MarketplaceIntegration;
