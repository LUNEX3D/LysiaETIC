import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { resolvePublicStore, fetchPublicProducts } from "../../services/storeApi";
import "../../styles/storefront.css";

const StoreShopPage = () => {
    const { slug } = useParams();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const r = await resolvePublicStore(slug);
                setStore(r.store);
                document.documentElement.style.setProperty("--sf-accent", r.store?.themeOverrides?.primaryColor || "#4ecdc4");
                const p = await fetchPublicProducts(slug);
                setProducts(p.products || []);
            } catch (e) {
                setError(e.response?.data?.error || "Mağaza bulunamadı");
            }
        })();
    }, [slug]);

    if (error) {
        return <div className="sf-root sf-main"><p>{error}</p></div>;
    }

    return (
        <div className="sf-root">
            <header className="sf-header">
                <h1>{store?.name || "Mağaza"}</h1>
                <Link to={`/shop/${slug}/cart`}>Sepet</Link>
            </header>
            <main className="sf-main">
                <div className="sf-grid">
                    {products.map((p) => (
                        <Link key={p._id} to={`/shop/${slug}/urun/${p.slug}`} className="sf-card" style={{ textDecoration: "none", color: "inherit" }}>
                            {p.images?.[0] ? <img src={p.images[0]} alt="" /> : <div style={{ aspectRatio: 1, background: "#1a1f35" }} />}
                            <div className="sf-card-body">
                                <h3>{p.title}</h3>
                                <span className="sf-price">{p.price} ₺</span>
                            </div>
                        </Link>
                    ))}
                </div>
                {!products.length && <p style={{ color: "#94a3b8" }}>Henüz ürün yok.</p>}
            </main>
        </div>
    );
};

export default StoreShopPage;
