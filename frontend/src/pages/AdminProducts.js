import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaBoxOpen, FaTrash } from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";

const AdminProducts = () => {
    const [products, setProducts] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await axios.get("/admin/products", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                });
                setProducts(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error(err);
                setError("Ürün verileri alınamadı.");
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };
        loadProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter(p => !q || p.name?.toLowerCase().includes(q) || p._id?.toLowerCase().includes(q));
    }, [products, query]);

    const deleteProduct = id => {
        if (!window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
        axios
            .delete(`/admin/delete-product/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            })
            .then(() => setProducts(products.filter(p => p._id !== id)))
            .catch(err => console.error(err));
    };

    return (
        <AdminLayout
            title="Ürün Yönetimi"
            subtitle="Katalog, fiyat ve operasyon yönetimi"
            actions={
                <div className="ap-actions">
                    <button className="ap-btn ap-btn--ghost">Toplu Aktarım</button>
                    <button className="ap-btn ap-btn--primary">Yeni Ürün</button>
                </div>
            }
        >
            {error && <div className="ap-alert ap-alert--error">{error}</div>}
            {loading && <div className="ap-loading">Ürünler yükleniyor...</div>}

            {!loading && (
                <>
                    <div className="ap-toolbar">
                        <div className="ap-search">
                            <FaSearch />
                            <input
                                type="text"
                                placeholder="Ürün adı veya ID ara"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                        </div>
                        <div className="ap-toolbar-count">
                            <FaBoxOpen style={{ marginRight: 4 }} />
                            {filteredProducts.length} ürün
                        </div>
                    </div>

                    <div className="ap-table-wrap">
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Ürün Adı</th>
                                    <th>Fiyat</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map(product => (
                                    <tr key={product._id}>
                                        <td className="mono">{product._id}</td>
                                        <td>
                                            <div className="ap-table-cell">
                                                <FaBoxOpen style={{ color: "var(--ap-primary)", fontSize: 14 }} />
                                                <span style={{ fontWeight: 600 }}>{product.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{product.price} TL</td>
                                        <td>
                                            <button
                                                className="ap-btn ap-btn--danger ap-btn--sm"
                                                onClick={() => deleteProduct(product._id)}
                                            >
                                                <FaTrash /> Sil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && (
                            <div className="ap-empty">Ürün bulunamadı.</div>
                        )}
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminProducts;
