import React, { useState, useEffect } from "react";
import axios from "../services/api";
import "../styles/OrdersPage.css";

const OrdersPage = ({ marketplaceId }) => {
    const [orders, setOrders] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchType, setSearchType] = useState("customerName");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [modalOrder, setModalOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    const userId = localStorage.getItem("userId");
    const token = localStorage.getItem("token");

    const ordersPerPage = 10;

    useEffect(() => {
        if (marketplaceId) {
            fetchOrders(marketplaceId);
        }
    }, [marketplaceId]);

    const fetchOrders = async (marketplaceId) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                startDate: startDate || "",
                endDate: endDate || "",
                marketplaceId: marketplaceId,
            });

            const response = await axios.get(`/orders/all/${userId}?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const sortedOrders = response.data.orders.sort((a, b) => {
                if (a.status === "Shipped" && b.status !== "Shipped") return -1;
                if (a.status !== "Shipped" && b.status === "Shipped") return 1;
                return new Date(b.orderDate) - new Date(a.orderDate);
            });

            setOrders(sortedOrders);
            setFilteredOrders(sortedOrders);
            setCurrentPage(1);
        } catch (error) {
            console.error("❌ API Hatası:", error);
            alert(error.response?.data?.error || "Siparişleri çekerken hata oluştu!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const filtered = orders.filter((order) =>
            searchType === "customerName"
                ? order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
                : order.orderNumber.includes(searchQuery)
        );
        setFilteredOrders(filtered);
        setCurrentPage(1);
    }, [searchQuery, searchType, orders]);

    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

    return (
        <div className="order-container">
            <h1>
                📦 Sipariş Yönetimi -{" "}
                <span className="total-orders">Toplam Sipariş: {orders.length}</span>
            </h1>

            <div className="filter-section">
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="filter-input"
                />
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="filter-input"
                />
                <button onClick={() => fetchOrders(marketplaceId)} disabled={loading} className="filter-button">
                    {loading ? "Yükleniyor..." : "🔍 Filtrele"}
                </button>

                <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="filter-select"
                >
                    <option value="customerName">Müşteri Adı</option>
                    <option value="orderNumber">Sipariş No</option>
                </select>
                <input
                    type="text"
                    placeholder="Arama..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>

            {loading && (
                <div className="loading-animation">
                    <div className="spinner"></div>
                    <p>Yükleniyor...</p>
                </div>
            )}

            {!loading && (
                <div className="order-grid">
                    {currentOrders.length ? (
                        currentOrders.map((order, index) => (
                            <div
                                key={index}
                                className={`order-card ${order.status === "Shipped" ? "shipped-highlight" : ""}`}
                            >
                                <h3 className="order-title">📦 Sipariş No: {order.orderNumber}</h3>
                                <p><strong>📅 Tarih:</strong> {order.orderDate}</p>
                                <p><strong>👤 Müşteri:</strong> {order.customerName}</p>
                                <p><strong>💰 Tutar:</strong> {order.totalPrice} ₺</p>
                                <p><strong>📦 Durum:</strong> {order.status}</p>
                                <p><strong>🚚 Takip No:</strong> {order.trackingNumber}</p>
                                {order.products.length > 0 && (
                                    <img
                                        src={order.products[0].imageUrl || "https://via.placeholder.com/150"}
                                        alt={order.products[0].productName}
                                        className="order-image"
                                    />
                                )}
                                <button className="details-button" onClick={() => setModalOrder(order)}>
                                    📜 Detaylar
                                </button>
                            </div>
                        ))
                    ) : (
                        <p>Gösterilecek sipariş bulunamadı.</p>
                    )}
                </div>
            )}

            {!loading && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        ⬅
                    </button>
                    <span>
                        Sayfa {currentPage} / {Math.ceil(filteredOrders.length / ordersPerPage)}
                    </span>
                    <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                        disabled={currentPage >= Math.ceil(filteredOrders.length / ordersPerPage)}
                    >
                        ➡
                    </button>
                </div>
            )}

            {modalOrder && (
                <div className="modal" onClick={() => setModalOrder(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>📜 Sipariş Detayları</h2>
                        <p><strong>📦 Sipariş No:</strong> {modalOrder.orderNumber}</p>
                        <p><strong>📅 Tarih:</strong> {modalOrder.orderDate}</p>
                        <p><strong>👤 Müşteri:</strong> {modalOrder.customerName}</p>
                        <p><strong>💰 Tutar:</strong> {modalOrder.totalPrice} ₺</p>
                        <p><strong>📦 Durum:</strong> {modalOrder.status}</p>
                        <p><strong>🚚 Takip No:</strong> {modalOrder.trackingNumber}</p>
                        <h3>🛍 Ürünler</h3>
                        <div className="modal-product-list">
                            {modalOrder.products.map((product, idx) => (
                                <div key={idx} className="modal-product-card">
                                    <img src={product.imageUrl || "https://via.placeholder.com/100"} alt={product.productName} className="modal-product-image" />
                                    <p><strong>{product.productName}</strong></p>
                                    <p>📦 Adet: {product.quantity}</p>
                                </div>
                            ))}
                        </div>
                        <button className="close-modal" onClick={() => setModalOrder(null)}>❌ Kapat</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
