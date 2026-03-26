import React, { useState, useEffect } from "react";
import axios from "../services/api";
import "../styles/StockManagement.css";

const StockManagement = ({ userId, marketplaceId, marketplace }) => {
    const [products, setProducts] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [modalImage, setModalImage] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const productsPerPage = 12;
    const token = localStorage.getItem("token");

    useEffect(() => {
        fetchProducts();
    }, [marketplaceId]);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`/products/all/${userId}?marketplaceId=${marketplaceId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(response.data.products);
        } catch (error) {
            alert(`❌ ${marketplace?.name || ''} ürünleri çekerken hata oluştu!`);
        } finally {
            setIsLoading(false);
        }
    };

    const indexOfLastProduct = currentPage * productsPerPage;
    const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
    const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);

    return (
        <div className="stock-container">
            <h1>
                📦 Stok Yönetimi - {marketplace?.name || 'Tüm Pazaryerleri'}
                <span className="total-products">Toplam Ürün: {products.length}</span>
            </h1>

            {isLoading ? (
                <div className="loading-spinner">Yükleniyor...</div>
            ) : (
                <>
                    <div className="product-grid">
                        {currentProducts.map((product, index) => (
                            <div key={index} className="product-card">
                                <img
                                    src={product.productImage}
                                    alt={product.productName}
                                    className="product-img"
                                    onClick={() => setModalImage(product.productImage)}
                                />
                                <div className="product-info">
                                    <h3 className="product-title">{product.productName}</h3>
                                    <p><strong>Pazaryeri:</strong> {product.marketplace}</p>
                                    <p><strong>Barkod:</strong> {product.barcode}</p>
                                    <p><strong>Kategori:</strong> {product.categoryName}</p>
                                    <p><strong>Renk:</strong> {product.color} | <strong>Beden:</strong> {product.size}</p>
                                    <p><strong>Fiyat:</strong> {product.price} ₺</p>
                                    <p><strong>Komisyon:</strong> {product.commissionRate}</p>
                                    <p><strong>Termin Süresi:</strong> {product.deliveryTime}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sayfalama Butonları */}
                    <div className="pagination">
                        <button
                            className="pagination-btn"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                        >
                            ⬅
                        </button>
                        <span>Sayfa {currentPage} / {Math.ceil(products.length / productsPerPage)}</span>
                        <button
                            className="pagination-btn"
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            disabled={currentPage >= Math.ceil(products.length / productsPerPage)}
                        >
                            ➡
                        </button>
                    </div>
                </>
            )}

            {/* Modal Popup */}
            {modalImage && (
                <div className="modal" onClick={() => setModalImage(null)}>
                    <img src={modalImage} alt="Ürün Büyük" />
                </div>
            )}
        </div>
    );
};

export default StockManagement;