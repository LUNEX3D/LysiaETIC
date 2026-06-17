import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { resolvePublicStore, fetchPublicProduct, addToPublicCart } from "../../services/storeApi";
import "../../styles/storefront.css";

const StoreProductPage = () => {
    const { slug, productSlug } = useParams();
    const [store, setStore] = useState(null);
    const [product, setProduct] = useState(null);
    const [qty, setQty] = useState(1);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        resolvePublicStore(slug).then((r) => setStore(r.store));
        fetchPublicProduct(slug, productSlug).then((r) => setProduct(r.product));
    }, [slug, productSlug]);

    const addCart = async () => {
        try {
            await addToPublicCart(slug, product._id, qty);
            setMsg("Sepete eklendi");
        } catch (e) {
            setMsg(e.response?.data?.error || "Eklenemedi");
        }
    };

    if (!product) return <div className="sf-root sf-main">Yükleniyor…</div>;

    return (
        <div className="sf-root">
            <header className="sf-header">
                <Link to={`/shop/${slug}`}>← {store?.name || "Mağaza"}</Link>
                <Link to={`/shop/${slug}/cart`}>Sepet</Link>
            </header>
            <main className="sf-main" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                    {product.images?.[0] ? (
                        <img src={product.images[0]} alt="" style={{ width: "100%", borderRadius: 12 }} />
                    ) : null}
                </div>
                <div>
                    <h1 style={{ marginTop: 0 }}>{product.title}</h1>
                    <p className="sf-price" style={{ fontSize: 24 }}>{product.price} ₺</p>
                    <p style={{ color: "#94a3b8", fontSize: 14 }}>{product.description}</p>
                    <p>Stok: {product.stock}</p>
                    <input type="number" min={1} max={product.stock} value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ width: 80, marginRight: 8 }} />
                    <button type="button" className="sf-btn" onClick={addCart}>
                        Sepete ekle
                    </button>
                    {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
                </div>
            </main>
        </div>
    );
};

export default StoreProductPage;
