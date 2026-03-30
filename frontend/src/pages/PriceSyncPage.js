/**
 * FİYAT EŞİTLEME SAYFASI
 *
 * - Tüm ürünleri listele
 * - Her ürünün her platformdaki fiyatını göster
 * - Platforma özel fiyat girme
 * - Toplu veya tekli fiyat gönderme
 */

import React, { useState, useEffect, useCallback } from "react";
import {
    FaSearch, FaSync, FaMoneyBillWave, FaPaperPlane,
    FaStore, FaBoxOpen, FaCheckCircle, FaTimesCircle,
    FaSpinner, FaArrowRight
} from "react-icons/fa";
import API from "../services/api";

const MARKETPLACES = ["Trendyol", "Hepsiburada", "N11", "Amazon", "ÇiçekSepeti"];

const PriceSyncPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [syncing, setSyncing] = useState({});
    const [message, setMessage] = useState({ text: "", type: "" });
    const [priceEdits, setPriceEdits] = useState({});
    const [userMarketplaces, setUserMarketplaces] = useState([]);

    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await API.get("/product-management/products?limit=100");
            setProducts(res.data.products || []);
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMarketplaces = useCallback(async () => {
        try {
            const res = await API.get("/marketplace/user-marketplaces/" + localStorage.getItem("userId"));
            setUserMarketplaces((res.data || []).map(m => m.marketplaceName));
        } catch {
            setUserMarketplaces([]);
        }
    }, []);

    useEffect(() => {
        loadProducts();
        loadMarketplaces();
    }, [loadProducts, loadMarketplaces]);

    const filteredProducts = products.filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.masterProduct?.name?.toLowerCase().includes(q) ||
            p.masterProduct?.barcode?.toLowerCase().includes(q) ||
            p.masterProduct?.sku?.toLowerCase().includes(q);
    });

    const getMPPrice = (product, mpName) => {
        const mapping = (product.marketplaceMappings || []).find(
            m => m.marketplaceName?.toLowerCase() === mpName.toLowerCase()
        );
        return mapping?.price || null;
    };

    const getMPStatus = (product, mpName) => {
        const mapping = (product.marketplaceMappings || []).find(
            m => m.marketplaceName?.toLowerCase() === mpName.toLowerCase()
        );
        if (!mapping) return "none";
        return mapping.isSynced ? "synced" : "pending";
    };

    const handlePriceChange = (productId, mpName, value) => {
        setPriceEdits(prev => ({
            ...prev,
            [`${productId}_${mpName}`]: value
        }));
    };

    const sendPrice = async (product, mpName) => {
        const key = `${product._id}_${mpName}`;
        const newPrice = parseFloat(priceEdits[key]);

        if (!newPrice || newPrice <= 0) {
            setMessage({ text: "Geçerli bir fiyat girin.", type: "error" });
            return;
        }

        setSyncing(prev => ({ ...prev, [key]: true }));
        setMessage({ text: "", type: "" });

        try {
            await API.post("/product-management/sync/price", {
                productMappingId: product._id,
                salePrice: newPrice,
                listPrice: newPrice
            });

            setMessage({
                text: `✅ ${product.masterProduct.name} → ${mpName} fiyatı ${newPrice} TL olarak güncellendi!`,
                type: "success"
            });

            // Listeyi yenile
            await loadProducts();

            // Edit'i temizle
            setPriceEdits(prev => {
                const copy = { ...prev };
                delete copy[key];
                return copy;
            });
        } catch (error) {
            setMessage({
                text: `❌ ${mpName} fiyat güncelleme hatası: ${error.response?.data?.error || error.message}`,
                type: "error"
            });
        } finally {
            setSyncing(prev => ({ ...prev, [key]: false }));
        }
    };

    const sendAllPrices = async (product) => {
        const keys = Object.keys(priceEdits).filter(k => k.startsWith(product._id));
        if (keys.length === 0) {
            setMessage({ text: "Fiyat değişikliği yapılmadı.", type: "error" });
            return;
        }

        for (const key of keys) {
            const mpName = key.split("_")[1];
            await sendPrice(product, mpName);
        }
    };

    const cardStyle = {
        background: "#111631",
        border: "1px solid rgba(99,102,241,0.08)",
        borderRadius: 16,
        padding: 22,
        transition: "all 0.2s"
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
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>
                        <FaMoneyBillWave style={{ marginRight: 10, color: "#6366f1" }} />
                        Fiyat Eşitleme
                    </h1>
                    <p style={{ color: "#64748b", fontSize: 14, margin: "6px 0 0" }}>
                        Platformlar arası fiyat yönetimi — her ürüne platforma özel fiyat girin ve gönderin
                    </p>
                </div>
                <button
                    onClick={loadProducts}
                    disabled={loading}
                    style={{
                        padding: "10px 18px",
                        borderRadius: 10,
                        border: "1px solid rgba(99,102,241,0.2)",
                        background: "rgba(99,102,241,0.1)",
                        color: "#a5b4fc",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                    }}
                >
                    <FaSync /> Yenile
                </button>
            </div>

            {/* Message */}
            {message.text && (
                <div style={{
                    padding: "14px 18px",
                    borderRadius: 10,
                    marginBottom: 20,
                    fontSize: 13,
                    fontWeight: 500,
                    background: message.type === "success" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                    color: message.type === "success" ? "#34d399" : "#f87171",
                    border: `1px solid ${message.type === "success" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`
                }}>
                    {message.text}
                </div>
            )}

            {/* Search */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderRadius: 10,
                background: "#111631",
                border: "1px solid rgba(99,102,241,0.08)",
                marginBottom: 20,
                maxWidth: 400
            }}>
                <FaSearch style={{ color: "#64748b", fontSize: 14 }} />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Ürün ara: isim, barkod, SKU..."
                    style={{
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        color: "#eef2ff",
                        fontSize: 13,
                        width: "100%",
                        fontFamily: "Inter, sans-serif"
                    }}
                />
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                    <FaSpinner style={{ animation: "spin 1s linear infinite", fontSize: 24, marginBottom: 10 }} />
                    <div>Ürünler yükleniyor...</div>
                </div>
            )}

            {/* Products */}
            {!loading && filteredProducts.map(product => {
                const mp = product.masterProduct;
                const activeMPs = MARKETPLACES.filter(name =>
                    userMarketplaces.some(um => um.toLowerCase() === name.toLowerCase())
                );

                return (
                    <div key={product._id} style={{ ...cardStyle, marginBottom: 16 }}>
                        {/* Product Info */}
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 14,
                                background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(167,139,250,0.15))",
                                display: "grid", placeItems: "center",
                                fontSize: 20, color: "#6366f1", flexShrink: 0
                            }}>
                                <FaBoxOpen />
                            </div>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>{mp.name}</div>
                                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                                    Barkod: {mp.barcode} | SKU: {mp.sku} | Stok: {product.stockTracking?.totalStock ?? mp.stock}
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: "#34d399" }}>{mp.price} TL</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>Ana Fiyat</div>
                            </div>
                        </div>

                        {/* Marketplace Prices */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                            {activeMPs.map(mpName => {
                                const currentPrice = getMPPrice(product, mpName);
                                const status = getMPStatus(product, mpName);
                                const editKey = `${product._id}_${mpName}`;
                                const editValue = priceEdits[editKey];
                                const isSyncing = syncing[editKey];

                                return (
                                    <div key={mpName} style={{
                                        padding: "14px 16px",
                                        borderRadius: 12,
                                        background: "rgba(99,102,241,0.03)",
                                        border: "1px solid rgba(99,102,241,0.08)"
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                            <FaStore style={{ color: "#a5b4fc", fontSize: 13 }} />
                                            <span style={{ fontWeight: 700, fontSize: 13 }}>{mpName}</span>
                                            {status === "synced" && <FaCheckCircle style={{ color: "#34d399", fontSize: 12, marginLeft: "auto" }} />}
                                            {status === "none" && <FaTimesCircle style={{ color: "#64748b", fontSize: 12, marginLeft: "auto" }} />}
                                        </div>

                                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                                            Mevcut: {currentPrice ? `${currentPrice} TL` : "—"}
                                        </div>

                                        <div style={{ display: "flex", gap: 6 }}>
                                            <input
                                                type="number"
                                                placeholder="Yeni fiyat"
                                                value={editValue || ""}
                                                onChange={e => handlePriceChange(product._id, mpName, e.target.value)}
                                                style={{
                                                    flex: 1,
                                                    padding: "8px 10px",
                                                    background: "#0c1021",
                                                    border: "1px solid rgba(99,102,241,0.15)",
                                                    borderRadius: 8,
                                                    color: "#eef2ff",
                                                    fontSize: 13,
                                                    outline: "none",
                                                    fontFamily: "Inter, sans-serif",
                                                    minWidth: 0
                                                }}
                                            />
                                            <button
                                                onClick={() => sendPrice(product, mpName)}
                                                disabled={isSyncing || !editValue}
                                                style={{
                                                    padding: "8px 12px",
                                                    borderRadius: 8,
                                                    border: "none",
                                                    background: editValue ? "#6366f1" : "rgba(99,102,241,0.2)",
                                                    color: "#fff",
                                                    cursor: (isSyncing || !editValue) ? "not-allowed" : "pointer",
                                                    fontSize: 12,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    opacity: (isSyncing || !editValue) ? 0.5 : 1
                                                }}
                                            >
                                                {isSyncing ? <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> : <FaPaperPlane />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Tümünü Gönder */}
                        {Object.keys(priceEdits).some(k => k.startsWith(product._id)) && (
                            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                                <button
                                    onClick={() => sendAllPrices(product)}
                                    style={{
                                        padding: "10px 20px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: "linear-gradient(135deg, #6366f1, #a78bfa)",
                                        color: "#fff",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        boxShadow: "0 4px 16px rgba(99,102,241,0.3)"
                                    }}
                                >
                                    <FaArrowRight /> Tüm Fiyatları Gönder
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            {!loading && filteredProducts.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                    <FaBoxOpen style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }} />
                    <div>Ürün bulunamadı.</div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
            `}</style>
        </div>
    );
};

export default PriceSyncPage;
