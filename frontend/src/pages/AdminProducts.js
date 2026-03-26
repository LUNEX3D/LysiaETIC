import React, { useEffect, useMemo, useState } from "react";
import { FaSearch, FaBoxOpen } from "react-icons/fa";
import axios from "../services/api";
import AdminLayout from "../components/AdminLayout";
import "../styles/admin.css";

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
        return products.filter(product => {
            if (!q) return true;
            return (
                product.name?.toLowerCase().includes(q) ||
                product._id?.toLowerCase().includes(q)
            );
        });
    }, [products, query]);

    const deleteProduct = id => {
        axios
            .delete(`/admin/delete-product/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            })
            .then(() => setProducts(products.filter(product => product._id !== id)))
            .catch(err => console.error(err));
    };

    return (
        <AdminLayout
            title="Ürün Yönetimi"
            subtitle="Katalog, fiyat ve operasyon yönetimi"
            actions={
                <div className="admin-action-row">
                    <button className="admin-btn admin-btn--ghost" type="button">
                        Toplu aktarım
                    </button>
                    <button className="admin-btn admin-btn--primary" type="button">
                        Yeni ürün
                    </button>
                </div>
            }
        >
            {error && <div className="admin-alert admin-alert--error">{error}</div>}
            {loading && <div className="admin-loading">Ürünler yükleniyor...</div>}

            {!loading && (
                <>
                    <div className="admin-toolbar">
                        <div className="admin-search">
                            <FaSearch />
                            <input
                                type="text"
                                placeholder="Ürün adı veya ID ara"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                        </div>
                        <div className="admin-toolbar-meta">
                            {filteredProducts.length} ürün
                        </div>
                    </div>

                    <div className="admin-card admin-card--table">
                        <table className="admin-table">
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
                                            <div className="admin-cell">
                                                <FaBoxOpen />
                                                <span>{product.name}</span>
                                            </div>
                                        </td>
                                        <td>{product.price} TL</td>
                                        <td>
                                            <button
                                                className="admin-btn admin-btn--danger"
                                                type="button"
                                                onClick={() => deleteProduct(product._id)}
                                            >
                                                Sil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredProducts.length === 0 && (
                            <div className="admin-empty">Ürün bulunamadı.</div>
                        )}
                    </div>
                </>
            )}
        </AdminLayout>
    );
};

export default AdminProducts;