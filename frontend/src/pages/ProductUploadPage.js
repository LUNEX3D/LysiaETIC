/**
 * GELİŞMİŞ ÜRÜN YÜKLEME SAYFASI
 *
 * - Trendyol'dan kategori çekme (arama ile)
 * - Ürün bilgileri formu
 * - "Kaydet" ve "Kaydet ve Dağıt" butonları
 * - Dağıt seçilince entegre pazaryerlerini tikle
 * - Yeni yüklenen ürün yeşil border ile gösterilir
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    FaBoxOpen, FaSave, FaRocket, FaSearch, FaSpinner,
    FaTimes, FaCheck, FaStore, FaArrowLeft, FaImage
} from "react-icons/fa";
import API from "../services/api";

const ProductUploadPage = () => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    // Kategori
    const [categorySearch, setCategorySearch] = useState("");
    const [categories, setCategories] = useState([]);
    const [catLoading, setCatLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Pazaryerleri
    const [marketplaces, setMarketplaces] = useState([]);
    const [selectedMPs, setSelectedMPs] = useState([]);


    // Form
    const [form, setForm] = useState({
        name: "",
        barcode: "",
        sku: "",
        description: "",
        price: "",
        listPrice: "",
        stock: "",
        brand: "",
        images: ""
    });

    // Kullanıcının entegre pazaryerlerini yükle
    useEffect(() => {
        const loadMarketplaces = async () => {
            try {
                const res = await API.get("/marketplace/user-marketplaces");
                setMarketplaces(res.data || []);
            } catch {
                setMarketplaces([]);
            }
        };
        loadMarketplaces();
    }, []);

    // Trendyol kategorilerini ara
    const searchCategories = useCallback(async (query) => {
        if (!query || query.length < 2) {
            setCategories([]);
            return;
        }
        setCatLoading(true);
        try {
            const res = await API.get(`/product-management/trendyol/categories?search=${encodeURIComponent(query)}`);
            setCategories(res.data.categories || []);
        } catch {
            setCategories([]);
        } finally {
            setCatLoading(false);
        }
    }, []);

    // Debounced kategori arama
    useEffect(() => {
        const timer = setTimeout(() => {
            searchCategories(categorySearch);
        }, 400);
        return () => clearTimeout(timer);
    }, [categorySearch, searchCategories]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const toggleMP = (mpName) => {
        setSelectedMPs(prev =>
            prev.includes(mpName) ? prev.filter(n => n !== mpName) : [...prev, mpName]
        );
    };

    // Kaydet
    const handleSave = async (distribute = false) => {
        if (!form.name || !form.barcode || !form.sku || !form.price) {
            setMessage({ text: "Ürün adı, barkod, SKU ve fiyat zorunludur.", type: "error" });
            return;
        }

        if (distribute && selectedMPs.length === 0) {
            setMessage({ text: "En az bir pazaryeri seçmelisiniz.", type: "error" });
            return;
        }

        setSaving(true);
        setMessage({ text: "", type: "" });

        try {
            const productData = {
                name: form.name,
                barcode: form.barcode,
                sku: form.sku,
                description: form.description,
                price: parseFloat(form.price),
                listPrice: parseFloat(form.listPrice || form.price),
                stock: parseInt(form.stock || "0"),
                brand: form.brand,
                images: form.images ? form.images.split(",").map(s => s.trim()).filter(Boolean) : [],
                category: selectedCategory ? selectedCategory.path : "",
                marketplaceMappings: distribute
                    ? selectedMPs.map(mpName => ({
                        marketplaceName: mpName,
                        categoryId: selectedCategory ? String(selectedCategory.id) : "",
                        categoryName: selectedCategory ? selectedCategory.name : ""
                    }))
                    : []
            };

            const res = await API.post("/product-management/products", productData);

            if (res.data.success) {
                // Yeni ürün ID'sini localStorage'a kaydet (yeşil border için)
                const newIds = JSON.parse(localStorage.getItem("newProductIds") || "[]");
                newIds.push(res.data.product._id);
                localStorage.setItem("newProductIds", JSON.stringify(newIds));

                if (distribute && res.data.product._id) {
                    // Dağıtım yap
                    try {
                        await API.post("/product-management/sync/distribute", {
                            productMappingId: res.data.product._id,
                            targetMarketplaces: selectedMPs
                        });
                        setMessage({
                            text: `✅ Ürün kaydedildi ve ${selectedMPs.join(", ")} pazaryerlerine dağıtıldı!`,
                            type: "success"
                        });
                    } catch {
                        setMessage({
                            text: "Ürün kaydedildi ama dağıtımda hata oluştu. Ürünlerim sayfasından tekrar dağıtabilirsiniz.",
                            type: "warn"
                        });
                    }
                } else {
                    setMessage({ text: "✅ Ürün başarıyla kaydedildi!", type: "success" });
                }

                // 2 saniye sonra ürünlerim sayfasına yönlendir
                setTimeout(() => navigate("/product-management"), 2000);
            }
        } catch (error) {
            const errData = error.response?.data;
            if (error.response?.status === 409 && errData?.type) {
                // 🛡️ Duplike ürün hatası — kullanıcıya detaylı bilgi göster
                const conflict = errData.conflicts?.[errData.type];
                const typeLabel = errData.type === "sku" ? "Model Kodu" : errData.type === "barcode" ? "Stok Kodu" : "Ürün";
                const conflictInfo = conflict
                    ? `\n\nMevcut ürün: "${conflict.name}"\nModel: ${conflict.sku || "-"} | Stok Kodu: ${conflict.barcode || "-"}`
                    : "";
                setMessage({ text: `⚠️ ${typeLabel} zaten kullanılıyor!\n${errData.error}${conflictInfo}`, type: "error" });
            } else {
                setMessage({ text: errData?.error || "Ürün kaydedilemedi.", type: "error" });
            }
        } finally {
            setSaving(false);
        }
    };

    const inputStyle = {
        width: "100%",
        padding: "12px 14px",
        background: "#0c1021",
        border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: 10,
        color: "#eef2ff",
        fontSize: 14,
        fontFamily: "Inter, sans-serif",
        outline: "none",
        transition: "border-color 0.2s"
    };

    const labelStyle = {
        fontSize: 12,
        fontWeight: 700,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 6,
        display: "block"
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "#06080f",
            color: "#eef2ff",
            fontFamily: "Inter, -apple-system, sans-serif",
            padding: "32px"
        }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
                <button
                    onClick={() => navigate("/product-management")}
                    style={{
                        background: "rgba(99,102,241,0.1)",
                        border: "1px solid rgba(99,102,241,0.2)",
                        borderRadius: 10,
                        color: "#a5b4fc",
                        padding: "10px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600
                    }}
                >
                    <FaArrowLeft /> Geri
                </button>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>
                        <FaBoxOpen style={{ marginRight: 10, color: "#6366f1" }} />
                        Yeni Ürün Yükle
                    </h1>
                    <p style={{ color: "#64748b", fontSize: 14, margin: "4px 0 0" }}>
                        Ürün bilgilerini girin, Trendyol'dan kategori seçin ve pazaryerlerine dağıtın
                    </p>
                </div>
            </div>

            {/* Messages */}
            {message.text && (
                <div style={{
                    padding: "14px 18px",
                    borderRadius: 10,
                    marginBottom: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    background: message.type === "success" ? "rgba(52,211,153,0.12)" :
                        message.type === "warn" ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)",
                    color: message.type === "success" ? "#34d399" :
                        message.type === "warn" ? "#fbbf24" : "#f87171",
                    border: `1px solid ${message.type === "success" ? "rgba(52,211,153,0.2)" :
                        message.type === "warn" ? "rgba(251,191,36,0.2)" : "rgba(248,113,113,0.2)"}`
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 1100 }}>
                {/* Sol: Ürün Bilgileri */}
                <div style={{
                    background: "#111631",
                    border: "1px solid rgba(99,102,241,0.08)",
                    borderRadius: 16,
                    padding: 24
                }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                        <FaBoxOpen style={{ color: "#6366f1" }} /> Ürün Bilgileri
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Ürün Adı *</label>
                            <input name="name" value={form.name} onChange={handleChange} placeholder="Ürün adını girin" style={inputStyle} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                                <label style={labelStyle}>Barkod *</label>
                                <input name="barcode" value={form.barcode} onChange={handleChange} placeholder="8680..." style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>SKU *</label>
                                <input name="sku" value={form.sku} onChange={handleChange} placeholder="SKU-001" style={inputStyle} />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Açıklama</label>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                placeholder="Ürün açıklaması..."
                                rows={3}
                                style={{ ...inputStyle, resize: "vertical" }}
                            />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                            <div>
                                <label style={labelStyle}>Satış Fiyatı (TL) *</label>
                                <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="0.00" style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Liste Fiyatı (TL)</label>
                                <input name="listPrice" type="number" value={form.listPrice} onChange={handleChange} placeholder="0.00" style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Stok Adedi</label>
                                <input name="stock" type="number" value={form.stock} onChange={handleChange} placeholder="0" style={inputStyle} />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Marka</label>
                            <input name="brand" value={form.brand} onChange={handleChange} placeholder="Marka adı" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}><FaImage style={{ marginRight: 4 }} /> Görsel URL'leri (virgülle ayırın)</label>
                            <input name="images" value={form.images} onChange={handleChange} placeholder="https://..., https://..." style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* Sağ: Kategori + Dağıtım */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Kategori Seçimi */}
                    <div style={{
                        background: "#111631",
                        border: "1px solid rgba(99,102,241,0.08)",
                        borderRadius: 16,
                        padding: 24
                    }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <FaSearch style={{ color: "#6366f1" }} /> Trendyol Kategori Seçimi
                        </h3>

                        {selectedCategory ? (
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "12px 16px",
                                background: "rgba(52,211,153,0.08)",
                                border: "1px solid rgba(52,211,153,0.2)",
                                borderRadius: 10,
                                marginBottom: 12
                            }}>
                                <FaCheck style={{ color: "#34d399" }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedCategory.name}</div>
                                    <div style={{ fontSize: 11, color: "#64748b" }}>{selectedCategory.path}</div>
                                </div>
                                <button
                                    onClick={() => { setSelectedCategory(null); setCategorySearch(""); }}
                                    style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16 }}
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{ position: "relative", marginBottom: 12 }}>
                                    <FaSearch style={{ position: "absolute", left: 14, top: 14, color: "#64748b", fontSize: 14 }} />
                                    <input
                                        value={categorySearch}
                                        onChange={e => setCategorySearch(e.target.value)}
                                        placeholder="Kategori ara: telefon, ayakkabı, elektronik..."
                                        style={{ ...inputStyle, paddingLeft: 40 }}
                                    />
                                    {catLoading && <FaSpinner style={{ position: "absolute", right: 14, top: 14, color: "#6366f1", animation: "spin 1s linear infinite" }} />}
                                </div>
                                {categories.length > 0 && (
                                    <div style={{
                                        maxHeight: 220,
                                        overflowY: "auto",
                                        borderRadius: 10,
                                        border: "1px solid rgba(99,102,241,0.1)"
                                    }}>
                                        {categories.map(cat => (
                                            <div
                                                key={cat.id}
                                                onClick={() => { setSelectedCategory(cat); setCategories([]); setCategorySearch(cat.name); }}
                                                style={{
                                                    padding: "10px 14px",
                                                    cursor: "pointer",
                                                    borderBottom: "1px solid rgba(99,102,241,0.06)",
                                                    transition: "background 0.15s",
                                                    fontSize: 13
                                                }}
                                                onMouseEnter={e => e.target.style.background = "rgba(99,102,241,0.08)"}
                                                onMouseLeave={e => e.target.style.background = "transparent"}
                                            >
                                                <div style={{ fontWeight: 600 }}>{cat.name}</div>
                                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{cat.path}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Pazaryeri Dağıtım */}
                    <div style={{
                        background: "#111631",
                        border: "1px solid rgba(99,102,241,0.08)",
                        borderRadius: 16,
                        padding: 24
                    }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <FaStore style={{ color: "#6366f1" }} /> Pazaryeri Dağıtımı
                        </h3>

                        {marketplaces.length === 0 ? (
                            <p style={{ color: "#64748b", fontSize: 13 }}>Henüz entegre pazaryeri yok.</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {marketplaces.map(mp => {
                                    const name = mp.marketplaceName;
                                    const isSelected = selectedMPs.includes(name);
                                    return (
                                        <div
                                            key={mp._id}
                                            onClick={() => toggleMP(name)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: "12px 16px",
                                                borderRadius: 10,
                                                cursor: "pointer",
                                                border: `1px solid ${isSelected ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.08)"}`,
                                                background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
                                                transition: "all 0.15s"
                                            }}
                                        >
                                            <div style={{
                                                width: 22, height: 22, borderRadius: 6,
                                                border: `2px solid ${isSelected ? "#6366f1" : "#64748b"}`,
                                                background: isSelected ? "#6366f1" : "transparent",
                                                display: "grid", placeItems: "center",
                                                transition: "all 0.15s"
                                            }}>
                                                {isSelected && <FaCheck style={{ color: "#fff", fontSize: 10 }} />}
                                            </div>
                                            <FaStore style={{ color: isSelected ? "#a5b4fc" : "#64748b" }} />
                                            <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Butonlar */}
                    <div style={{ display: "flex", gap: 12 }}>
                        <button
                            onClick={() => handleSave(false)}
                            disabled={saving}
                            style={{
                                flex: 1,
                                padding: "14px 20px",
                                borderRadius: 12,
                                border: "1px solid rgba(99,102,241,0.2)",
                                background: "rgba(99,102,241,0.1)",
                                color: "#a5b4fc",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: saving ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                opacity: saving ? 0.5 : 1,
                                transition: "all 0.2s"
                            }}
                        >
                            <FaSave /> Kaydet
                        </button>
                        <button
                            onClick={() => handleSave(true)}
                            disabled={saving || selectedMPs.length === 0}
                            style={{
                                flex: 1,
                                padding: "14px 20px",
                                borderRadius: 12,
                                border: "none",
                                background: "linear-gradient(135deg, #6366f1, #a78bfa)",
                                color: "#fff",
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: (saving || selectedMPs.length === 0) ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                opacity: (saving || selectedMPs.length === 0) ? 0.5 : 1,
                                boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
                                transition: "all 0.2s"
                            }}
                        >
                            {saving ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaRocket />}
                            Kaydet ve Dağıt
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input:focus, textarea:focus, select:focus {
                    border-color: #6366f1 !important;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
                }
                @media (max-width: 768px) {
                    div[style*="grid-template-columns: 1fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ProductUploadPage;
