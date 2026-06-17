import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchPublicCart, updatePublicCartItem } from "../../services/storeApi";
import "../../styles/storefront.css";

const StoreCartPage = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [cart, setCart] = useState({ items: [], subtotal: 0 });
    const [shipping, setShipping] = useState(0);
    const [total, setTotal] = useState(0);

    const load = () => {
        fetchPublicCart(slug).then((d) => {
            setCart(d.cart || { items: [], subtotal: 0 });
            setShipping(d.shipping || 0);
            setTotal(d.total || 0);
        });
    };

    useEffect(() => {
        load();
    }, [slug]);

    return (
        <div className="sf-root">
            <header className="sf-header">
                <Link to={`/shop/${slug}`}>← Alışverişe devam</Link>
            </header>
            <main className="sf-main">
                <h2>Sepet</h2>
                {cart.items?.map((item) => (
                    <div key={item.storeProductId} className="sf-cart-line">
                        <span>
                            {item.title} × {item.quantity}
                        </span>
                        <span>
                            {item.lineTotal} ₺
                            <button
                                type="button"
                                className="sf-btn outline"
                                style={{ marginLeft: 8, padding: "4px 8px", fontSize: 11 }}
                                onClick={() => updatePublicCartItem(slug, item.storeProductId, 0).then(load)}
                            >
                                Kaldır
                            </button>
                        </span>
                    </div>
                ))}
                <p>Ara toplam: {cart.subtotal} ₺</p>
                <p>Kargo: {shipping} ₺</p>
                <p>
                    <strong>Toplam: {total} ₺</strong>
                </p>
                {cart.items?.length > 0 && (
                    <button type="button" className="sf-btn" onClick={() => navigate(`/shop/${slug}/checkout`)}>
                        Ödemeye geç
                    </button>
                )}
            </main>
        </div>
    );
};

export default StoreCartPage;
