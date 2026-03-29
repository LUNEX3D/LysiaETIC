import React, { useState, useEffect } from "react";
import { FaGlobe, FaKey, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import World3D from "../components/World3D";
import "../styles/MarketplaceIntegration.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ✅ Kullanıcının pazaryeri entegrasyonlarını getir
const getUserIntegrations = async (userId) => {
    try {
        const token = localStorage.getItem("token");

        if (!token) {
            console.error("❌ Token eksik! Kullanıcı giriş yapmamış olabilir.");
            return [];
        }

        const response = await fetch(`${API_URL}/api/marketplace/user-marketplaces/${userId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // 404 hatası normal (henüz entegrasyon yoksa)
            if (response.status === 404) {
                console.log("ℹ️ Henüz entegrasyon bulunmuyor.");
                return [];
            }
            throw new Error(`API Hatası: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("📢 Yüklenen Entegrasyonlar:", data);

        // Tüm entegrasyon objesini döndür (ID dahil)
        return data;
    } catch (error) {
        console.error("❌ API Hatası:", error);
        return [];
    }
};

const MarketplaceIntegration = () => {
    // Bölgeler ve Platformlar - Gerçek API Bilgileri
    const regions = [
        {
            name: "Türkiye",
            platforms: [
                // ✅ ÇALIŞIYOR - Dokunma
                {
                    name: "Trendyol",
                    fields: ["apiKey", "apiSecret", "sellerId"],
                    description: "Trendyol Entegratör API - Supplier ID, API Key ve API Secret gereklidir"
                },
                // 🔧 HEPSİBURADA - Gerçek API Bilgileri
                {
                    name: "Hepsiburada",
                    fields: ["merchantId", "apiKey"],
                    fieldLabels: {
                        merchantId: "Mağaza ID",
                        apiKey: "Servis Anahtarı"
                    },
                    description: "Hepsiburada Merchant API - Mağaza ID ve Servis Anahtarı gereklidir. Satıcı Paneli > Entegrasyonlar > API Entegrasyonları bölümünden alabilirsiniz."
                },
                // ✅ ÇALIŞIYOR
                {
                    name: "n11",
                    fields: ["apiKey", "secretKey", "shipmentTemplate"],
                    fieldLabels: {
                        apiKey:           "App Key",
                        secretKey:        "App Secret",
                        shipmentTemplate: "Kargo Şablon Adı"
                    },
                    fieldDefaults: {
                        shipmentTemplate: "STANDART"
                    },
                    fieldHints: {
                        shipmentTemplate: "N11 Paneli → Hesabım → Teslimat Bilgileri → Şablon Adı sütunundaki değer. Boş bırakırsanız 'STANDART' kullanılır."
                    },
                    description: "N11 REST API — App Key ve App Secret zorunludur. Kargo şablonu için N11 Paneli > Hesabım > Teslimat Bilgileri'nde 'STANDART' adında bir şablon oluşturun."
                },
                // 🔧 AMAZON TÜRKİYE - Gerçek API Bilgileri
                {
                    name: "Amazon Türkiye",
                    fields: ["sellerId", "mwsAuthToken", "accessKey", "secretKey", "marketplaceId"],
                    description: "Amazon MWS API - Seller ID, MWS Auth Token, Access Key, Secret Key ve Marketplace ID gereklidir"
                },
                // 🔧 ÇİÇEKSEPETİ - Gerçek API Bilgileri
                {
                    name: "ÇiçekSepeti",
                    fields: ["apiKey", "apiPassword", "supplierId"],
                    description: "ÇiçekSepeti Entegrasyon API - API Key, API Password ve Supplier ID gereklidir"
                },
                // 🔧 GİTTİGİDİYOR - Gerçek API Bilgileri (Kapatıldı ama eski entegrasyonlar için)
                {
                    name: "GittiGidiyor",
                    fields: ["apiKey", "secretKey", "role", "nick"],
                    description: "GittiGidiyor API (Kapatıldı) - API Key, Secret Key, Role ve Nick gereklidir"
                },
                // 🔧 MORHİPO - Gerçek API Bilgileri
                {
                    name: "Morhipo",
                    fields: ["supplierId", "apiKey", "apiSecret"],
                    description: "Morhipo Entegrasyon API - Supplier ID, API Key ve API Secret gereklidir"
                },
                // 🔧 PTTAVM - Gerçek API Bilgileri
                {
                    name: "PttAVM",
                    fields: ["merchantCode", "apiKey", "apiSecret"],
                    description: "PttAVM Entegrasyon API - Merchant Code, API Key ve API Secret gereklidir"
                },
                // 🔧 TEKNOSA - Gerçek API Bilgileri
                {
                    name: "Teknosa",
                    fields: ["supplierId", "apiKey", "apiPassword"],
                    description: "Teknosa Marketplace API - Supplier ID, API Key ve API Password gereklidir"
                },
                // 🔧 ePTTAVM - Gerçek API Bilgileri
                {
                    name: "ePttAVM",
                    fields: ["merchantId", "apiKey", "apiSecret"],
                    description: "ePttAVM Entegrasyon API - Merchant ID, API Key ve API Secret gereklidir"
                }
            ]
        },
        {
            name: "Avrupa",
            platforms: [
                // 🔧 AMAZON EUROPE - Gerçek API Bilgileri
                {
                    name: "Amazon Europe",
                    fields: ["sellerId", "mwsAuthToken", "accessKey", "secretKey", "marketplaceId"],
                    description: "Amazon MWS/SP-API - Seller ID, MWS Auth Token, Access Key, Secret Key ve Marketplace ID (A1PA6795UKMFR9 vb.) gereklidir"
                },
                // 🔧 EBAY - Gerçek API Bilgileri
                {
                    name: "eBay",
                    fields: ["appId", "devId", "certId", "userToken", "siteId"],
                    description: "eBay Trading API - App ID, Dev ID, Cert ID, User Token ve Site ID gereklidir"
                },
                // 🔧 ETSY - Gerçek API Bilgileri
                {
                    name: "Etsy",
                    fields: ["apiKey", "sharedSecret", "shopId", "accessToken"],
                    description: "Etsy API v3 - API Key, Shared Secret, Shop ID ve OAuth Access Token gereklidir"
                },
                // 🔧 ALLEGRO - Gerçek API Bilgileri
                {
                    name: "Allegro",
                    fields: ["clientId", "clientSecret", "refreshToken"],
                    description: "Allegro REST API - Client ID, Client Secret ve Refresh Token gereklidir"
                }
            ]
        },
        {
            name: "Asya",
            platforms: [
                // 🔧 ALIEXPRESS - Gerçek API Bilgileri
                {
                    name: "AliExpress",
                    fields: ["appKey", "appSecret", "sessionKey"],
                    description: "AliExpress Open Platform API - App Key, App Secret ve Session Key gereklidir"
                },
                // 🔧 RAKUTEN - Gerçek API Bilgileri
                {
                    name: "Rakuten",
                    fields: ["serviceSecret", "licenseKey", "shopUrl"],
                    description: "Rakuten RMS API - Service Secret, License Key ve Shop URL gereklidir"
                },
                // 🔧 LAZADA - Gerçek API Bilgileri
                {
                    name: "Lazada",
                    fields: ["appKey", "appSecret", "accessToken"],
                    description: "Lazada Open Platform API - App Key, App Secret ve Access Token gereklidir"
                },
                // 🔧 SHOPEE - Gerçek API Bilgileri
                {
                    name: "Shopee",
                    fields: ["partnerId", "partnerKey", "shopId", "accessToken"],
                    description: "Shopee Open Platform API - Partner ID, Partner Key, Shop ID ve Access Token gereklidir"
                }
            ]
        },
        {
            name: "Amerika",
            platforms: [
                // 🔧 AMAZON USA - Gerçek API Bilgileri
                {
                    name: "Amazon USA",
                    fields: ["sellerId", "mwsAuthToken", "accessKey", "secretKey", "marketplaceId"],
                    description: "Amazon SP-API - Seller ID, MWS Auth Token, Access Key, Secret Key ve Marketplace ID (ATVPDKIKX0DER) gereklidir"
                },
                // 🔧 WALMART - Gerçek API Bilgileri
                {
                    name: "Walmart",
                    fields: ["clientId", "clientSecret", "consumerId"],
                    description: "Walmart Marketplace API - Client ID, Client Secret ve Consumer ID gereklidir"
                },
                // 🔧 SHOPIFY - Gerçek API Bilgileri
                {
                    name: "Shopify",
                    fields: ["shopName", "apiKey", "apiSecret", "accessToken"],
                    description: "Shopify Admin API - Shop Name, API Key, API Secret ve Access Token gereklidir"
                }
            ]
        }
    ];

    const [selectedRegion, setSelectedRegion] = useState(regions[0]);
    const [integrations, setIntegrations] = useState([]); // { marketplaceName, _id } formatında
    const [formData, setFormData] = useState({}); // { platformName: { field: value } } formatında
    const userId = localStorage.getItem("userId");

    // Entegrasyonları Yükle
    useEffect(() => {
        const fetchIntegrations = async () => {
            try {
                const data = await getUserIntegrations(userId);
                console.log("📢 Güncellenmiş Entegrasyonlar:", data);

                // ✅ API'den gelen entegrasyonları ID ile birlikte sakla
                setIntegrations(data); // data = [{ _id, marketplaceName, credentials, ... }]
            } catch (error) {
                console.error('❌ Entegrasyonlar yüklenemedi:', error);
            }
        };

        if (userId) fetchIntegrations();
    }, [userId]);

    // Entegrasyon İşlemi (Ekleme veya Güncelleme)
    const handleIntegration = async (platform) => {
        const token = localStorage.getItem("token");
        const userId = localStorage.getItem("userId");

        if (!token || !userId) {
            console.error("❌ Yetkilendirme hatası: Kullanıcı giriş yapmamış olabilir!");
            alert("Yetkilendirme hatası! Lütfen tekrar giriş yapın.");
            return;
        }

        // Bu platform için form verilerini al
        const platformFormData = formData[platform.name] || {};

        // Credentials oluştur — fieldDefaults varsa boş alanlar için varsayılan değeri kullan
        const credentials = {};
        platform.fields.forEach(field => {
            credentials[field] = platformFormData[field] || platform.fieldDefaults?.[field] || "";
        });

        // Boş alan kontrolü — fieldDefaults olan alanlar zaten dolu gelir
        const hasEmptyFields = platform.fields.some(field => {
            const val = credentials[field];
            return !val || !val.trim();
        });
        if (hasEmptyFields) {
            alert(`❌ Lütfen ${platform.name} için tüm API bilgilerini doldurun!`);
            return;
        }

        const integrationData = {
            userId,
            marketplaceName: platform.name,
            credentials
        };

        console.log("📢 API'ye Gönderilecek Veri:", integrationData);

        try {
            const response = await fetch(`${API_URL}/api/marketplace/integrate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(integrationData)
            });

            const data = await response.json();
            console.log("📢 API Yanıtı:", data);

            if (response.ok) {
                if (data.isUpdate) {
                    alert(`✅ ${platform.name} entegrasyonu güncellendi!`);
                } else {
                    alert(`✅ ${platform.name} entegrasyonu başarılı!`);
                }

                // Entegrasyonları yeniden yükle
                const updatedIntegrations = await getUserIntegrations(userId);
                setIntegrations(updatedIntegrations);

                // Sadece bu platform için form verilerini temizle
                setFormData(prev => ({
                    ...prev,
                    [platform.name]: {}
                }));
            } else {
                alert(`❌ Entegrasyon hatası: ${data.message}`);
            }
        } catch (error) {
            console.error("❌ Entegrasyon sırasında hata:", error);
            alert("❌ Entegrasyon başarısız! Sunucuya erişilemiyor.");
        }
    };

    // Entegrasyon Silme İşlemi
    const handleDeleteIntegration = async (platform) => {
        const token = localStorage.getItem("token");
        const userId = localStorage.getItem("userId");

        if (!token || !userId) {
            alert("Yetkilendirme hatası! Lütfen tekrar giriş yapın.");
            return;
        }

        // Silinecek entegrasyonu bul
        const integrationToDelete = integrations.find(
            int => int.marketplaceName === platform.name
        );

        if (!integrationToDelete) {
            alert("❌ Silinecek entegrasyon bulunamadı!");
            return;
        }

        // Kullanıcıdan onay al
        const confirmDelete = window.confirm(
            `${platform.name} entegrasyonunu silmek istediğinize emin misiniz?`
        );

        if (!confirmDelete) return;

        console.log("🗑️ Silinecek Entegrasyon ID:", integrationToDelete._id);

        try {
            const response = await fetch(`${API_URL}/api/marketplace/${integrationToDelete._id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log("📢 Silme API Yanıtı:", data);

            if (response.ok) {
                alert(`✅ ${platform.name} entegrasyonu başarıyla silindi!`);

                // Entegrasyonları yeniden yükle
                const updatedIntegrations = await getUserIntegrations(userId);
                setIntegrations(updatedIntegrations);

                // Bu platform için form verilerini temizle
                setFormData(prev => ({
                    ...prev,
                    [platform.name]: {}
                }));
            } else {
                alert(`❌ Silme hatası: ${data.message}`);
            }
        } catch (error) {
            console.error("❌ Silme sırasında hata:", error);
            alert("❌ Silme işlemi başarısız! Sunucuya erişilemiyor.");
        }
    };

    return (
        <div className="integration-container">
            {/* 3D Dünya */}
            <div className="integration-visual">
                <World3D />
            </div>

            {/* Global Başlık */}
            <div className="global-title">
                <FaGlobe className="title-icon" />
                <h1>Global LysiaETIC Entegrasyon</h1>
            </div>

            {/* Bölge Butonları */}
            <div className="region-buttons">
                {regions.map(region => (
                    <button
                        key={region.name}
                        className={`region-btn ${selectedRegion?.name === region.name ? 'active' : ''}`}
                        onClick={() => setSelectedRegion(region)}
                    >
                        {region.name}
                    </button>
                ))}
            </div>

            {/* Entegrasyon Modal */}
            {selectedRegion && (
                <div className="integration-modal">
                    <div className="modal-header">
                        <h2>{selectedRegion.name} Entegrasyonları</h2>
                        <FaTimes
                            className="close-icon"
                            onClick={() => setSelectedRegion(null)}
                        />
                    </div>

                    {/* Platform Grid */}
                    <div className="platform-grid">
                        {selectedRegion.platforms.map(platform => {
                            // Bu platform için entegrasyon var mı kontrol et
                            const isConnected = integrations.some(
                                int => int.marketplaceName === platform.name
                            );

                            return (
                                <div key={platform.name} className="platform-card">
                                    <div className="platform-header">
                                        <h3>{platform.name}</h3>
                                        <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
                                            {isConnected ? '✅ Bağlı' : '⚪ Bağlı Değil'}
                                        </span>
                                    </div>

                                    {/* Platform Açıklaması */}
                                    {platform.description && (
                                        <div className="platform-description">
                                            <small>ℹ️ {platform.description}</small>
                                        </div>
                                    )}

                                    {/* API Giriş Alanları */}
                                    <div className="api-fields">
                                        {platform.fields.map(field => {
                                            // fieldLabels varsa kullan, yoksa field adından otomatik üret
                                            const label = platform.fieldLabels?.[field]
                                                || field.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
                                            // fieldHints varsa ipucu göster
                                            const hint = platform.fieldHints?.[field];
                                            // shipmentTemplate gibi hassas olmayan alanlar text tipinde göster
                                            const sensitiveFields = ["apiKey","secretKey","appKey","appSecret","apiSecret","apiPassword","accessToken","sessionKey","clientSecret","mwsAuthToken","userToken","certId","partnerKey","licenseKey","serviceSecret"];
                                            const inputType = sensitiveFields.includes(field) ? "password" : "text";
                                            const defaultVal = platform.fieldDefaults?.[field] || "";
                                            return (
                                                <div key={field} className="input-group">
                                                    <label htmlFor={`${platform.name}-${field}`}>
                                                        {label}
                                                    </label>
                                                    <input
                                                        id={`${platform.name}-${field}`}
                                                        type={inputType}
                                                        placeholder={hint || (defaultVal ? `Varsayılan: ${defaultVal}` : `${label} girin...`)}
                                                        className="api-input"
                                                        value={(formData[platform.name]?.[field]) || ""}
                                                        onChange={(e) => setFormData(prev => ({
                                                            ...prev,
                                                            [platform.name]: {
                                                                ...(prev[platform.name] || {}),
                                                                [field]: e.target.value.trim()
                                                            }
                                                        }))}
                                                    />
                                                    {hint && (
                                                        <small className="field-hint">💡 {hint}</small>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Gerekli Alan Sayısı */}
                                    <div className="field-count">
                                        <small>📋 {platform.fields.length} alan gerekli</small>
                                    </div>

                                    {/* Butonlar */}
                                    <div className="action-buttons">
                                        {isConnected ? (
                                            <>
                                                <button
                                                    className="btn update-btn"
                                                    onClick={() => handleIntegration(platform)}
                                                    title="API bilgilerini güncelle"
                                                >
                                                    <FaEdit /> Güncelle
                                                </button>
                                                <button
                                                    className="btn delete-btn"
                                                    onClick={() => handleDeleteIntegration(platform)}
                                                    title="Entegrasyonu kaldır"
                                                >
                                                    <FaTrash /> Sil
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                className="btn connect-btn"
                                                onClick={() => handleIntegration(platform)}
                                                title="Pazaryeri entegrasyonu başlat"
                                            >
                                                <FaKey /> Entegre Et
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketplaceIntegration;
