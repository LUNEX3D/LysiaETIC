import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBoxOpen, FaBarcode, FaTag, FaImage, FaDollarSign,
    FaLayerGroup, FaCheck, FaTimes, FaPlus, FaTrash,
    FaArrowRight, FaArrowLeft, FaSave, FaSpinner, FaInfoCircle
} from "react-icons/fa";
import { createProduct } from "../services/productManagementApi";
import { getUserMarketplaces } from "../services/marketplaceApi";
import "../styles/ProductManagementPages.css";

const STEPS = [
    { id: 1, title: "Temel Bilgiler", icon: <FaBoxOpen />, desc: "Ürün adı, barkod, SKU ve marka" },
    { id: 2, title: "Fiyat & Stok", icon: <FaDollarSign />, desc: "Fiyatlandırma ve stok bilgileri" },
    { id: 3, title: "Görseller & Açıklama", icon: <FaImage />, desc: "Ürün görselleri ve detayları" },
    { id: 4, title: "Kategori & Özellikler", icon: <FaLayerGroup />, desc: "Kategori ve ürün özellikleri" },
    { id: 5, title: "Pazaryeri & Kategori Eşleştirme", icon: <FaTag />, desc: "Pazaryeri seçimi ve özel kategori ayarları" },
    { id: 6, title: "Onay & Yükleme", icon: <FaCheck />, desc: "Son kontrol ve yükleme" }
];

// Pazaryeri bazlı kategori önerileri
const MARKETPLACE_CATEGORY_HINTS = {
    Trendyol: {
        placeholder: "Örn: Giyim & Aksesuar > Kadın > Elbise",
        idPlaceholder: "Örn: 1007",
        hint: "Trendyol kategori ID'sini Trendyol Satıcı Paneli > Ürün Yönetimi > Kategori bölümünden bulabilirsiniz."
    },
    Hepsiburada: {
        placeholder: "Örn: Giyim > Kadın Giyim > Elbise",
        idPlaceholder: "Örn: HB-CAT-1234",
        hint: "Hepsiburada kategori bilgisini Hepsiburada Merchant Portal'dan alabilirsiniz."
    },
    N11: {
        placeholder: "Örn: Giyim & Aksesuar > Kadın Giyim",
        idPlaceholder: "Örn: 1000476 (sayısal ID)",
        hint: "N11 REST API ile kategori ağacını çekebilir veya N11 Mağaza Paneli'nden kategori ID'sini öğrenebilirsiniz. Mandatory özellikler zorunludur."
    },
    n11: {
        placeholder: "Örn: Giyim & Aksesuar > Kadın Giyim",
        idPlaceholder: "Örn: 1000476 (sayısal ID)",
        hint: "N11 REST API ile kategori ağacını çekebilir veya N11 Mağaza Paneli'nden kategori ID'sini öğrenebilirsiniz. Mandatory özellikler zorunludur."
    },
    Amazon: {
        placeholder: "Örn: Clothing > Women > Dresses",
        idPlaceholder: "Örn: ASIN veya node ID",
        hint: "Amazon kategori bilgisini Amazon Seller Central'dan alabilirsiniz."
    },
    ÇiçekSepeti: {
        placeholder: "Örn: Çiçek & Bitki > Saksı Çiçeği",
        idPlaceholder: "Örn: CS-1234",
        hint: "ÇiçekSepeti kategori bilgisini tedarikçi panelinizden alabilirsiniz."
    }
};

const MASTER_CATEGORIES = [
    { group: "👕 Giyim & Moda", items: [
        "Giyim > Kadın Giyim", "Giyim > Erkek Giyim", "Giyim > Çocuk Giyim",
        "Giyim > Ayakkabı", "Giyim > Çanta", "Giyim > Aksesuar"
    ]},
    { group: "📱 Elektronik", items: [
        "Elektronik > Telefon & Tablet", "Elektronik > Telefon Aksesuarları",
        "Elektronik > Bilgisayar", "Elektronik > Bilgisayar Aksesuarları",
        "Elektronik > TV & Ses Sistemleri", "Elektronik > Kamera & Fotoğraf",
        "Elektronik > Oyun & Oyun Konsolları"
    ]},
    { group: "🏠 Ev & Yaşam", items: [
        "Ev & Yaşam > Mobilya", "Ev & Yaşam > Ev Dekorasyon",
        "Ev & Yaşam > Ev Tekstili", "Ev & Yaşam > Mutfak",
        "Ev & Yaşam > Banyo", "Ev & Yaşam > Aydınlatma"
    ]},
    { group: "💄 Kozmetik & Kişisel Bakım", items: [
        "Kozmetik > Makyaj", "Kozmetik > Cilt Bakımı",
        "Kozmetik > Saç Bakımı", "Kozmetik > Parfüm", "Kozmetik > Kişisel Bakım"
    ]},
    { group: "⚽ Spor & Outdoor", items: [
        "Spor > Spor Giyim", "Spor > Spor Ayakkabı",
        "Spor > Spor Ekipmanları", "Spor > Outdoor", "Spor > Bisiklet"
    ]},
    { group: "🧸 Bebek & Çocuk", items: [
        "Bebek > Bebek Giyim", "Bebek > Bebek Bakım",
        "Bebek > Bebek Odası", "Bebek > Oyuncak"
    ]},
    { group: "📚 Kitap & Kırtasiye", items: [
        "Kitap > Kitap", "Kitap > Dergi", "Kitap > Kırtasiye", "Kitap > Hobi"
    ]},
    { group: "🚗 Otomotiv", items: [
        "Otomotiv > Oto Aksesuar", "Otomotiv > Oto Yedek Parça",
        "Otomotiv > Motosiklet", "Otomotiv > Oto Bakım"
    ]},
    { group: "🔧 Yapı Market", items: [
        "Yapı Market > Hırdavat", "Yapı Market > Elektrik",
        "Yapı Market > Bahçe", "Yapı Market > El Aletleri"
    ]},
    { group: "🐾 Pet Shop", items: [
        "Pet Shop > Kedi", "Pet Shop > Köpek", "Pet Shop > Kuş", "Pet Shop > Balık"
    ]},
    { group: "🍽️ Süpermarket & Gıda", items: [
        "Süpermarket > Gıda", "Süpermarket > İçecek",
        "Süpermarket > Atıştırmalık", "Süpermarket > Temizlik"
    ]},
    { group: "🎁 Diğer", items: [
        "Diğer > Hediyelik Eşya", "Diğer > Ofis & Kırtasiye", "Diğer > Hobi & Eğlence"
    ]}
];

const ProductUploadPage = ({ userId, marketplaces: propMarketplaces }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [marketplaces, setMarketplaces] = useState(propMarketplaces || []);

    const [formData, setFormData] = useState({
        name: "",
        barcode: "",
        sku: "",
        description: "",
        images: [""],
        price: "",
        listPrice: "",
        stock: "",
        category: "",
        brand: "",
        vatRate: 18,
        currencyType: "TRY",
        weight: "",
        color: "",
        size: "",
        selectedMarketplaces: [],
        marketplaceCategoryOverrides: {}
    });

    useEffect(() => {
        if (!propMarketplaces || propMarketplaces.length === 0) {
            const uid = userId || localStorage.getItem("userId");
            if (uid) {
                getUserMarketplaces(uid).then(data => {
                    const list = Array.isArray(data) ? data : (data.marketplaces || data.data || []);
                    setMarketplaces(list.map(m => ({
                        ...m,
                        name: m.marketplaceName || m.name || ""
                    })));
                }).catch(err => {
                    console.error("Pazaryerleri yüklenemedi:", err);
                });
            }
        } else {
            setMarketplaces(propMarketplaces.map(m => ({
                ...m,
                name: m.marketplaceName || m.name || ""
            })));
        }
    }, [userId, propMarketplaces]);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError("");
    };

    const addImageField = () => {
        setFormData(prev => ({ ...prev, images: [...prev.images, ""] }));
    };

    const removeImageField = (index) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const updateImage = (index, value) => {
        setFormData(prev => {
            const images = [...prev.images];
            images[index] = value;
            return { ...prev, images };
        });
    };

    const toggleMarketplace = (name) => {
        setFormData(prev => {
            const selected = prev.selectedMarketplaces.includes(name)
                ? prev.selectedMarketplaces.filter(m => m !== name)
                : [...prev.selectedMarketplaces, name];
            return { ...prev, selectedMarketplaces: selected };
        });
    };

    const updateMarketplaceCategory = (mpName, field, value) => {
        setFormData(prev => ({
            ...prev,
            marketplaceCategoryOverrides: {
                ...prev.marketplaceCategoryOverrides,
                [mpName]: {
                    ...prev.marketplaceCategoryOverrides[mpName],
                    [field]: value
                }
            }
        }));
    };

    // Seçilen ana kategoriye göre pazaryeri kategorilerini otomatik doldur
    const autoFillMarketplaceCategories = (masterCategory) => {
        if (!masterCategory) return;
        setFormData(prev => {
            const newOverrides = { ...prev.marketplaceCategoryOverrides };
            prev.selectedMarketplaces.forEach(mpName => {
                if (!newOverrides[mpName]) newOverrides[mpName] = {};
                if (!newOverrides[mpName].categoryName) {
                    newOverrides[mpName] = {
                        ...newOverrides[mpName],
                        categoryName: masterCategory
                    };
                }
            });
            return { ...prev, marketplaceCategoryOverrides: newOverrides };
        });
    };

    const validateStep = () => {
        switch (currentStep) {
            case 1:
                if (!formData.name.trim()) return "Ürün adı zorunludur";
                if (!formData.barcode.trim()) return "Barkod zorunludur";
                if (!formData.sku.trim()) return "SKU/Stok kodu zorunludur";
                return null;
            case 2:
                if (!formData.price || Number(formData.price) <= 0) return "Geçerli bir satış fiyatı girin";
                if (!formData.stock || Number(formData.stock) < 0) return "Geçerli bir stok miktarı girin";
                return null;
            case 5:
                if (formData.selectedMarketplaces.length === 0) return "En az bir pazaryeri seçin";
                return null;
            default:
                return null;
        }
    };

    const nextStep = () => {
        const err = validateStep();
        if (err) { setError(err); return; }
        setError("");
        if (currentStep === 4 && formData.category) {
            autoFillMarketplaceCategories(formData.category);
        }
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    };

    const prevStep = () => {
        setError("");
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            const payload = {
                name: formData.name,
                barcode: formData.barcode,
                sku: formData.sku,
                description: formData.description,
                images: formData.images.filter(img => img.trim()),
                price: Number(formData.price),
                listPrice: Number(formData.listPrice) || Number(formData.price),
                stock: Number(formData.stock),
                category: formData.category,
                brand: formData.brand,
                attributes: {
                    color: formData.color,
                    size: formData.size,
                    weight: Number(formData.weight) || 0
                },
                marketplaceMappings: formData.selectedMarketplaces.map(mpName => ({
                    marketplaceName: mpName,
                    categoryId: formData.marketplaceCategoryOverrides[mpName]?.categoryId || "",
                    categoryName: formData.marketplaceCategoryOverrides[mpName]?.categoryName || formData.category,
                    syncStatus: "pending"
                }))
            };
            await createProduct(payload);
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || "Ürün yüklenirken hata oluştu");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: "", barcode: "", sku: "", description: "", images: [""],
            price: "", listPrice: "", stock: "", category: "", brand: "",
            vatRate: 18, currencyType: "TRY", weight: "", color: "", size: "",
            selectedMarketplaces: [], marketplaceCategoryOverrides: {}
        });
        setCurrentStep(1);
        setSuccess(false);
        setError("");
    };

    if (success) {
        return (
            <div className="pm-page">
                <motion.div
                    className="pm-success-card"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <div className="pm-success-icon">✅</div>
                    <h2>Ürün Başarıyla Oluşturuldu!</h2>
                    <p>
                        <strong>{formData.name}</strong> ürünü sisteme eklendi ve seçili
                        pazaryerlerine dağıtım kuyruğuna alındı.
                    </p>
                    <div className="pm-success-details">
                        <span>📦 Barkod: {formData.barcode}</span>
                        <span>💰 Fiyat: {formData.price} TL</span>
                        <span>📊 Stok: {formData.stock}</span>
                        <span>🏪 Pazaryeri: {formData.selectedMarketplaces.join(", ")}</span>
                    </div>
                    <div className="pm-success-actions">
                        <button className="pm-btn pm-btn-primary" onClick={resetForm}>
                            <FaPlus /> Yeni Ürün Ekle
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="pm-form-grid">
                        <div className="pm-form-group pm-full">
                            <label>Ürün Adı *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => updateField("name", e.target.value)}
                                placeholder="Ürün adını girin..."
                                className="pm-input"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label><FaBarcode /> Barkod *</label>
                            <input
                                type="text"
                                value={formData.barcode}
                                onChange={e => updateField("barcode", e.target.value)}
                                placeholder="Barkod numarası (EAN/GTIN)"
                                className="pm-input"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>SKU / Stok Kodu *</label>
                            <input
                                type="text"
                                value={formData.sku}
                                onChange={e => updateField("sku", e.target.value)}
                                placeholder="Stok kodu (benzersiz)"
                                className="pm-input"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>Marka</label>
                            <input
                                type="text"
                                value={formData.brand}
                                onChange={e => updateField("brand", e.target.value)}
                                placeholder="Marka adı"
                                className="pm-input"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>Para Birimi</label>
                            <select
                                value={formData.currencyType}
                                onChange={e => updateField("currencyType", e.target.value)}
                                className="pm-input"
                            >
                                <option value="TRY">TRY (₺)</option>
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                            </select>
                        </div>
                        <div className="pm-form-group pm-full" style={{
                            background: "rgba(78,205,196,0.08)",
                            border: "1px solid rgba(78,205,196,0.2)",
                            borderRadius: "10px",
                            padding: "1rem"
                        }}>
                            <FaInfoCircle style={{ color: "#4ecdc4" }} />
                            <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                                Barkod ve SKU tüm pazaryerlerinde ürünü eşleştirmek için kullanılır.
                                Benzersiz ve doğru olduğundan emin olun.
                            </span>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="pm-form-grid">
                        <div className="pm-form-group">
                            <label><FaDollarSign /> Satış Fiyatı *</label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={e => updateField("price", e.target.value)}
                                placeholder="0.00"
                                className="pm-input"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>Liste Fiyatı (Piyasa / Üstü Çizili)</label>
                            <input
                                type="number"
                                value={formData.listPrice}
                                onChange={e => updateField("listPrice", e.target.value)}
                                placeholder="0.00"
                                className="pm-input"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>📦 Stok Miktarı *</label>
                            <input
                                type="number"
                                value={formData.stock}
                                onChange={e => updateField("stock", e.target.value)}
                                placeholder="0"
                                className="pm-input"
                                min="0"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>KDV Oranı (%)</label>
                            <select
                                value={formData.vatRate}
                                onChange={e => updateField("vatRate", Number(e.target.value))}
                                className="pm-input"
                            >
                                <option value={0}>%0</option>
                                <option value={1}>%1</option>
                                <option value={8}>%8</option>
                                <option value={10}>%10</option>
                                <option value={18}>%18</option>
                                <option value={20}>%20</option>
                            </select>
                        </div>
                        {formData.price && formData.listPrice && Number(formData.listPrice) > Number(formData.price) && (
                            <div className="pm-discount-badge pm-full">
                                🏷️ İndirim Oranı: %{((1 - Number(formData.price) / Number(formData.listPrice)) * 100).toFixed(1)}
                                &nbsp;|&nbsp; Tasarruf: {(Number(formData.listPrice) - Number(formData.price)).toFixed(2)} {formData.currencyType}
                            </div>
                        )}
                    </div>
                );

            case 3:
                return (
                    <div className="pm-form-grid">
                        <div className="pm-form-group pm-full">
                            <label>Ürün Açıklaması</label>
                            <textarea
                                value={formData.description}
                                onChange={e => updateField("description", e.target.value)}
                                placeholder="Ürün açıklamasını girin... (SEO dostu, detaylı açıklama önerilir)"
                                className="pm-input pm-textarea"
                                rows={5}
                            />
                        </div>
                        <div className="pm-form-group pm-full">
                            <label><FaImage /> Ürün Görselleri (URL)</label>
                            {formData.images.map((img, idx) => (
                                <div key={idx} className="pm-image-row">
                                    <input
                                        type="text"
                                        value={img}
                                        onChange={e => updateImage(idx, e.target.value)}
                                        placeholder={`Görsel URL ${idx + 1} (https://...)`}
                                        className="pm-input"
                                    />
                                    {formData.images.length > 1 && (
                                        <button
                                            className="pm-btn-icon pm-btn-danger"
                                            onClick={() => removeImageField(idx)}
                                        >
                                            <FaTrash />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                className="pm-btn pm-btn-outline pm-btn-sm"
                                onClick={addImageField}
                                style={{ marginTop: "0.5rem" }}
                            >
                                <FaPlus /> Görsel Ekle
                            </button>
                        </div>
                        {formData.images.filter(i => i.trim()).length > 0 && (
                            <div className="pm-image-preview pm-full">
                                {formData.images.filter(i => i.trim()).map((img, idx) => (
                                    <div key={idx} className="pm-preview-thumb">
                                        <img
                                            src={img}
                                            alt={`Görsel ${idx + 1}`}
                                            onError={e => { e.target.src = "https://via.placeholder.com/100?text=Hata"; }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 4:
                return (
                    <div className="pm-form-grid">
                        <div className="pm-form-group pm-full">
                            <label><FaLayerGroup /> Ana Kategori Seçin</label>
                            <select
                                value={formData.category}
                                onChange={e => updateField("category", e.target.value)}
                                className="pm-input"
                            >
                                <option value="">-- Kategori Seçin --</option>
                                {MASTER_CATEGORIES.map(group => (
                                    <optgroup key={group.group} label={group.group}>
                                        {group.items.map(item => (
                                            <option key={item} value={item}>{item}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <small style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.5rem", display: "block" }}>
                                💡 Bu kategori tüm pazaryerleri için temel kategoridir. Sonraki adımda her pazaryeri için özel kategori belirleyebilirsiniz.
                            </small>
                        </div>
                        <div className="pm-form-group">
                            <label>Renk</label>
                            <input
                                type="text"
                                value={formData.color}
                                onChange={e => updateField("color", e.target.value)}
                                placeholder="Örn: Siyah, Beyaz, Kırmızı"
                                className="pm-input"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>Beden / Boyut</label>
                            <input
                                type="text"
                                value={formData.size}
                                onChange={e => updateField("size", e.target.value)}
                                placeholder="Örn: S, M, L, XL, 38, 40"
                                className="pm-input"
                            />
                        </div>
                        <div className="pm-form-group">
                            <label>Ağırlık (gram)</label>
                            <input
                                type="number"
                                value={formData.weight}
                                onChange={e => updateField("weight", e.target.value)}
                                placeholder="0"
                                className="pm-input"
                                min="0"
                            />
                        </div>
                    </div>
                );

            case 5:
                return (
                    <div className="pm-marketplace-selection">
                        <div className="pm-hint">
                            <strong>📋 Pazaryeri Seçimi ve Kategori Eşleştirme</strong><br />
                            Ürünün yükleneceği pazaryerlerini seçin. Her pazaryerinin kendi kategori sistemi
                            farklı olabilir — aşağıda her pazaryeri için özel kategori ve ID girebilirsiniz.
                            Boş bırakırsanız ana kategori kullanılır.
                        </div>

                        <div className="pm-mp-grid">
                            {marketplaces.length === 0 ? (
                                <div className="pm-empty-state">
                                    <p>⚠️ Henüz pazaryeri entegrasyonu yapılmamış. Lütfen önce entegrasyon ekleyin.</p>
                                </div>
                            ) : (
                                marketplaces.map(mp => {
                                    const mpName = mp.marketplaceName || mp.name;
                                    const isSelected = formData.selectedMarketplaces.includes(mpName);
                                    const hints = MARKETPLACE_CATEGORY_HINTS[mpName] || {
                                        placeholder: "Kategori adı",
                                        idPlaceholder: "Kategori ID",
                                        hint: "Bu pazaryeri için kategori bilgisi girin."
                                    };
                                    const override = formData.marketplaceCategoryOverrides[mpName] || {};

                                    return (
                                        <motion.div
                                            key={mp._id || mpName}
                                            className={`pm-mp-card ${isSelected ? "selected" : ""}`}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div
                                                className="pm-mp-card-header"
                                                onClick={() => toggleMarketplace(mpName)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                    <div style={{
                                                        width: "40px", height: "40px", borderRadius: "10px",
                                                        background: isSelected
                                                            ? "linear-gradient(135deg,#4ecdc4,#44a08d)"
                                                            : "rgba(255,255,255,0.1)",
                                                        display: "flex", alignItems: "center",
                                                        justifyContent: "center", fontSize: "1.25rem"
                                                    }}>
                                                        🏪
                                                    </div>
                                                    <div>
                                                        <span className="pm-mp-name">{mpName}</span>
                                                        {isSelected && (
                                                            <div style={{ color: "#4ecdc4", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                                                                ✓ Seçildi
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`pm-mp-check ${isSelected ? "checked" : ""}`}>
                                                    {isSelected && <FaCheck />}
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <motion.div
                                                    className="pm-mp-category-override"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <div style={{
                                                        background: "rgba(78,205,196,0.08)",
                                                        border: "1px solid rgba(78,205,196,0.2)",
                                                        borderRadius: "8px",
                                                        padding: "0.75rem",
                                                        marginBottom: "0.75rem",
                                                        fontSize: "0.82rem",
                                                        color: "#94a3b8",
                                                        lineHeight: "1.5"
                                                    }}>
                                                        💡 {hints.hint}
                                                    </div>

                                                    <label>{mpName} Kategori Adı</label>
                                                    <input
                                                        type="text"
                                                        className="pm-input pm-input-sm"
                                                        placeholder={hints.placeholder}
                                                        value={override.categoryName || ""}
                                                        onChange={e => updateMarketplaceCategory(mpName, "categoryName", e.target.value)}
                                                    />

                                                    <label>{mpName} Kategori ID</label>
                                                    <input
                                                        type="text"
                                                        className="pm-input pm-input-sm"
                                                        placeholder={hints.idPlaceholder}
                                                        value={override.categoryId || ""}
                                                        onChange={e => updateMarketplaceCategory(mpName, "categoryId", e.target.value)}
                                                    />

                                                    {formData.category && !override.categoryName && (
                                                        <button
                                                            className="pm-btn pm-btn-outline pm-btn-sm"
                                                            style={{ marginTop: "0.5rem" }}
                                                            onClick={() => updateMarketplaceCategory(mpName, "categoryName", formData.category)}
                                                        >
                                                            Ana kategoriyi kullan: "{formData.category}"
                                                        </button>
                                                    )}
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>

                        {formData.selectedMarketplaces.length > 0 && (
                            <div style={{
                                background: "rgba(34,197,94,0.1)",
                                border: "1px solid rgba(34,197,94,0.3)",
                                borderRadius: "10px",
                                padding: "1rem",
                                marginTop: "1rem"
                            }}>
                                <strong style={{ color: "#22c55e" }}>
                                    ✅ {formData.selectedMarketplaces.length} pazaryeri seçildi:
                                </strong>
                                <span style={{ color: "#94a3b8", marginLeft: "0.5rem" }}>
                                    {formData.selectedMarketplaces.join(" • ")}
                                </span>
                            </div>
                        )}
                    </div>
                );

            case 6:
                return (
                    <div className="pm-review">
                        <h3 className="pm-review-title">📋 Ürün Özeti - Son Kontrol</h3>
                        <div className="pm-review-grid">
                            <div className="pm-review-section">
                                <h4>Temel Bilgiler</h4>
                                <div className="pm-review-row"><span>Ürün Adı:</span><strong>{formData.name}</strong></div>
                                <div className="pm-review-row"><span>Barkod:</span><strong>{formData.barcode}</strong></div>
                                <div className="pm-review-row"><span>SKU:</span><strong>{formData.sku}</strong></div>
                                <div className="pm-review-row"><span>Marka:</span><strong>{formData.brand || "—"}</strong></div>
                            </div>
                            <div className="pm-review-section">
                                <h4>Fiyat & Stok</h4>
                                <div className="pm-review-row"><span>Satış Fiyatı:</span><strong>{formData.price} {formData.currencyType}</strong></div>
                                <div className="pm-review-row"><span>Liste Fiyatı:</span><strong>{formData.listPrice || formData.price} {formData.currencyType}</strong></div>
                                <div className="pm-review-row"><span>Stok:</span><strong>{formData.stock} adet</strong></div>
                                <div className="pm-review-row"><span>KDV:</span><strong>%{formData.vatRate}</strong></div>
                            </div>
                            <div className="pm-review-section">
                                <h4>Kategori & Özellikler</h4>
                                <div className="pm-review-row"><span>Ana Kategori:</span><strong>{formData.category || "—"}</strong></div>
                                <div className="pm-review-row"><span>Renk:</span><strong>{formData.color || "—"}</strong></div>
                                <div className="pm-review-row"><span>Beden:</span><strong>{formData.size || "—"}</strong></div>
                                <div className="pm-review-row"><span>Ağırlık:</span><strong>{formData.weight ? `${formData.weight} gr` : "—"}</strong></div>
                            </div>
                            <div className="pm-review-section">
                                <h4>Pazaryeri Dağıtımı</h4>
                                {formData.selectedMarketplaces.map(mp => {
                                    const override = formData.marketplaceCategoryOverrides[mp] || {};
                                    return (
                                        <div key={mp} style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ color: "#4ecdc4", fontWeight: 700, marginBottom: "0.25rem" }}>🏪 {mp}</div>
                                            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                                                Kategori: {override.categoryName || formData.category || "—"}
                                                {override.categoryId && ` (ID: ${override.categoryId})`}
                                            </div>
                                        </div>
                                    );
                                })}
                                {formData.selectedMarketplaces.length === 0 && (
                                    <div style={{ color: "#ef4444" }}>⚠️ Pazaryeri seçilmedi</div>
                                )}
                            </div>
                        </div>

                        {formData.images.filter(i => i.trim()).length > 0 && (
                            <div className="pm-review-section" style={{ marginTop: "1rem" }}>
                                <h4>Görseller ({formData.images.filter(i => i.trim()).length} adet)</h4>
                                <div className="pm-image-preview">
                                    {formData.images.filter(i => i.trim()).map((img, idx) => (
                                        <div key={idx} className="pm-preview-thumb">
                                            <img
                                                src={img}
                                                alt={`Görsel ${idx + 1}`}
                                                onError={e => { e.target.src = "https://via.placeholder.com/100?text=Hata"; }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="pm-page">
            <div className="pm-header">
                <h1 className="pm-title"><FaBoxOpen /> Yeni Ürün Yükleme</h1>
                <p className="pm-subtitle">
                    Ürün bilgilerini adım adım doldurun. Sistem arka planda seçtiğiniz
                    pazaryerlerine otomatik olarak dağıtacaktır.
                </p>
            </div>

            {/* Stepper */}
            <div className="pm-stepper">
                {STEPS.map((step, idx) => (
                    <div
                        key={step.id}
                        className={`pm-step ${currentStep === step.id ? "active" : ""} ${currentStep > step.id ? "completed" : ""}`}
                    >
                        <div
                            className="pm-step-circle"
                            onClick={() => { if (step.id < currentStep) setCurrentStep(step.id); }}
                        >
                            {currentStep > step.id ? <FaCheck /> : step.id}
                        </div>
                        <span className="pm-step-label">{step.title}</span>
                        {idx < STEPS.length - 1 && <div className="pm-step-line" />}
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentStep}
                    className="pm-step-content"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                >
                    <div className="pm-step-header">
                        <span className="pm-step-icon">{STEPS[currentStep - 1].icon}</span>
                        <div>
                            <h2>{STEPS[currentStep - 1].title}</h2>
                            <p>{STEPS[currentStep - 1].desc}</p>
                        </div>
                    </div>
                    {renderStepContent()}
                </motion.div>
            </AnimatePresence>

            {/* Error */}
            {error && (
                <motion.div
                    className="pm-error"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <FaTimes /> {error}
                </motion.div>
            )}

            {/* Navigation */}
            <div className="pm-nav">
                {currentStep > 1 && (
                    <button className="pm-btn pm-btn-outline" onClick={prevStep}>
                        <FaArrowLeft /> Geri
                    </button>
                )}
                <div className="pm-nav-spacer" />
                {currentStep < STEPS.length ? (
                    <button className="pm-btn pm-btn-primary" onClick={nextStep}>
                        İleri <FaArrowRight />
                    </button>
                ) : (
                    <button
                        className="pm-btn pm-btn-success"
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading
                            ? <><FaSpinner className="pm-spin" /> Yükleniyor...</>
                            : <><FaSave /> Ürünü Kaydet & Dağıt</>
                        }
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProductUploadPage;
