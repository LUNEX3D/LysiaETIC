import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchPublicOrderStatus } from "../../services/storeApi";
import "../../styles/storefront.css";

const StoreOrderResultPage = () => {
    const { slug } = useParams();
    const [search] = useSearchParams();
    const token = search.get("token");
    const [order, setOrder] = useState(null);

    useEffect(() => {
        if (token) {
            fetchPublicOrderStatus(slug, token).then((d) => setOrder(d.order));
        }
    }, [slug, token]);

    return (
        <div className="sf-root sf-main">
            <h2>Sipariş sonucu</h2>
            {order ? (
                <>
                    <p>
                        Sipariş no: <strong>{order.orderNumber}</strong>
                    </p>
                    <p>Durum: {order.status}</p>
                    <p>Ödeme: {order.paymentStatus}</p>
                    <p>Toplam: {order.total} ₺</p>
                </>
            ) : (
                <p>Sipariş bilgisi yükleniyor veya bulunamadı.</p>
            )}
            <Link to={`/shop/${slug}`} className="sf-btn" style={{ marginTop: 20, display: "inline-block" }}>
                Mağazaya dön
            </Link>
        </div>
    );
};

export default StoreOrderResultPage;
