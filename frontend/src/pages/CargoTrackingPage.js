import React, { useState, useEffect } from "react";
import axios from "../services/api";
import "../styles/CargoTrackingPage.css";

const CargoTrackingPage = ({ userId, marketplaceId, marketplace }) => {
    const [orders, setOrders] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [statusFilter, setStatusFilter] = useState("all");
    const ordersPerPage = 12;
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem("token");

    // İlk yüklemede kargoları çek
    useEffect(() => {
        fetchCargoTrackingOrders();
    }, [marketplaceId]);

    const fetchCargoTrackingOrders = async () => {
        if (!marketplaceId || !marketplace) {
            alert("❌ Lütfen soldaki menüden bir pazaryeri seçin!");
            return;
        }

        try {
            setLoading(true);
            const params = new URLSearchParams({
                startDate: startDate ? new Date(startDate).toISOString().slice(0, 10) : "",
                endDate: endDate ? new Date(endDate).toISOString().slice(0, 10) : "",
                marketplace: marketplace.marketplaceName
            });

            const response = await axios.get(`/cargo/${userId}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log(`✅ ${marketplace.marketplaceName} Kargo API Yanıtı:`, response.data);

            const sortedOrders = response.data.orders.sort((a, b) => {
                if (a.status === "Shipped" && b.status !== "Shipped") return -1;
                if (a.status !== "Shipped" && b.status === "Shipped") return 1;
                return new Date(b.timestamp) - new Date(a.timestamp);
            });

            setOrders(sortedOrders);
            setTotalOrders(response.data.total);
            setCurrentPage(1);
        } catch (error) {
            console.error("❌ Cargo API Hatası:", error);
            alert(`❌ ${marketplace?.marketplaceName || ''} kargo siparişleri çekilirken hata oluştu!`);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        const statusLower = status?.toLowerCase() || "";
        if (statusLower.includes("shipped") || statusLower.includes("kargoda")) return "status-shipped";
        if (statusLower.includes("delivered") || statusLower.includes("teslim")) return "status-delivered";
        if (statusLower.includes("returned") || statusLower.includes("iade")) return "status-returned";
        return "status-default";
    };

    const getMarketplaceIcon = (marketplace) => {
        const mp = marketplace?.toLowerCase() || "";
        if (mp.includes("trendyol")) return "🛍️";
        if (mp.includes("n11")) return "🏪";
        if (mp.includes("hepsiburada")) return "🛒";
        return "📦";
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            (order.customerName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (order.orderNumber?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
            (order.trackingNumber?.toLowerCase() || "").includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

    // Durum istatistikleri
    const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="cargo-container">
            <div className="cargo-header">
                <h1>🚚 {marketplace?.name || marketplace?.marketplaceName || "Kargo"} Yönetimi</h1>
                <p className="cargo-subtitle">Kargo takip ve yönetim sistemi</p>
            </div>

            {/* İstatistik Kartları */}
            <div className="cargo-stats">
                <div className="stat-card stat-total">
                    <div className="stat-icon">📦</div>
                    <div className="stat-info">
                        <h3>{totalOrders}</h3>
                        <p>Toplam Kargo</p>
                    </div>
                </div>
                <div className="stat-card stat-shipped">
                    <div className="stat-icon">🚚</div>
                    <div className="stat-info">
                        <h3>{statusCounts["Shipped"] || 0}</h3>
                        <p>Kargoda</p>
                    </div>
                </div>
                <div className="stat-card stat-delivered">
                    <div className="stat-icon">✅</div>
                    <div className="stat-info">
                        <h3>{statusCounts["Delivered"] || 0}</h3>
                        <p>Teslim Edildi</p>
                    </div>
                </div>
                <div className="stat-card stat-returned">
                    <div className="stat-icon">↩️</div>
                    <div className="stat-info">
                        <h3>{statusCounts["Returned"] || 0}</h3>
                        <p>İade</p>
                    </div>
                </div>
            </div>

            {/* Filtreler */}
            <div className="cargo-filters">
                <div className="filter-group">
                    <label>📊 Durum</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">Tüm Durumlar</option>
                        <option value="Shipped">Kargoda</option>
                        <option value="Delivered">Teslim Edildi</option>
                        <option value="Returned">İade</option>
                        <option value="UnDelivered">Teslim Edilemedi</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>📅 Başlangıç</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="filter-input"
                    />
                </div>

                <div className="filter-group">
                    <label>📅 Bitiş</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="filter-input"
                    />
                </div>

                <div className="filter-group filter-search">
                    <label>🔍 Ara</label>
                    <input
                        type="text"
                        placeholder="Sipariş No, Müşteri, Takip No..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="filter-input"
                    />
                </div>

                <button
                    onClick={fetchCargoTrackingOrders}
                    disabled={loading}
                    className="refresh-button"
                >
                    {loading ? "⏳ Yükleniyor..." : "🔄 Güncelle"}
                </button>
            </div>

            {/* Kargo Kartları */}
            <div className="cargo-grid">
                {currentOrders.length ? (
                    currentOrders.map((order, index) => (
                        <div key={index} className="cargo-card">
                            <div className="cargo-card-header">
                                <div className="marketplace-badge">
                                    {getMarketplaceIcon(order.marketplace)} {order.marketplace}
                                </div>
                                <div className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                                    {order.status}
                                </div>
                            </div>

                            <div className="cargo-card-body">
                                <div className="order-info">
                                    <h3>📦 {order.orderNumber}</h3>
                                    <p className="order-date">📅 {order.orderDate}</p>
                                </div>

                                <div className="customer-info">
                                    <p><strong>👤 Müşteri:</strong> {order.customerName}</p>
                                </div>

                                <div className="cargo-info">
                                    <p><strong>🚚 Kargo:</strong> {order.cargoProviderName}</p>
                                    <p><strong>📌 Takip No:</strong> {order.trackingNumber}</p>
                                </div>

                                {order.products && order.products.length > 0 && (
                                    <div className="products-preview">
                                        <p><strong>📦 Ürünler:</strong> {order.products.length} adet</p>
                                        <div className="product-list">
                                            {order.products.slice(0, 2).map((product, idx) => (
                                                <div key={idx} className="product-item">
                                                    {product.imageUrl ? (
                                                        <img
                                                            src={product.imageUrl}
                                                            alt={product.productName || 'Ürün'}
                                                            className="product-thumb"
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect fill="%23e5e7eb" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="20"%3E📦%3C/text%3E%3C/svg%3E';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="product-thumb-placeholder">📦</div>
                                                    )}
                                                    <span>{product.productName?.substring(0, 30) || 'Ürün adı yok'}...</span>
                                                </div>
                                            ))}
                                            {order.products.length > 2 && (
                                                <span className="more-products">+{order.products.length - 2} daha</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="cargo-card-footer">
                                {order.cargoTrackingLink ? (
                                    <a
                                        href={order.cargoTrackingLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tracking-button"
                                    >
                                        📍 Kargoyu Takip Et
                                    </a>
                                ) : (
                                    <button className="tracking-button disabled" disabled>
                                        Takip Linki Yok
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-data">
                        <div className="no-data-icon">📭</div>
                        <h3>Kargo Bulunamadı</h3>
                        <p>{marketplace?.name || marketplace?.marketplaceName || 'Seçili pazaryeri'} için kargo siparişi bulunamadı.</p>
                    </div>
                )}
            </div>

            {/* Sayfalama */}
            {filteredOrders.length > ordersPerPage && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        ⬅ Önceki
                    </button>
                    <span className="pagination-info">
                        Sayfa {currentPage} / {Math.ceil(filteredOrders.length / ordersPerPage)}
                        <span className="pagination-total"> ({filteredOrders.length} kargo)</span>
                    </span>
                    <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={currentPage >= Math.ceil(filteredOrders.length / ordersPerPage)}
                    >
                        Sonraki ➡
                    </button>
                </div>
            )}
        </div>
    );
};

export default CargoTrackingPage;
