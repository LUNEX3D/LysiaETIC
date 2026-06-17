import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicCart, updatePublicCartItem } from "../../services/storeApi";
import { wbCheckoutPath, wbProductsPath } from "../../utils/wbStorefrontPaths";

export default function WbCartWidget({ storeSlug, siteSlug }) {
    const [cart, setCart] = useState({ items: [], subtotal: 0 });
    const [shipping, setShipping] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = () => {
        if (!storeSlug) {
            setLoading(false);
            return;
        }
        fetchPublicCart(storeSlug)
            .then((d) => {
                setCart(d.cart || { items: [], subtotal: 0 });
                setShipping(d.shipping || 0);
                setTotal(d.total || 0);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, [storeSlug]);

    if (!storeSlug) {
        return (
            <div className="wb-sf-cart wb-sf-cart--empty" style={{ padding: 32, textAlign: "center" }}>
                <p>Mağaza sepeti henüz bağlı değil. Panelden mağazanızı bu siteye bağlayın.</p>
            </div>
        );
    }

    if (loading) return <p style={{ padding: 24 }}>Sepet yükleniyor…</p>;

    const items = cart.items || [];

    return (
        <div className="wb-sf-cart" style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
            {items.length === 0 ? (
                <div className="wb-sf-cart--empty" style={{ textAlign: "center", padding: 48 }}>
                    <h2 style={{ marginBottom: 8 }}>Sepetiniz boş</h2>
                    <p style={{ color: "#64748b", marginBottom: 20 }}>Alışverişe başlayın.</p>
                    <Link to={wbProductsPath(siteSlug)} className="wb-sf-btn" style={{ display: "inline-block", padding: "12px 24px", background: "var(--color-primary, #3b82f6)", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
                        Ürünlere git
                    </Link>
                </div>
            ) : (
                <>
                    <div className="wb-sf-cart__lines">
                        {items.map((item) => (
                            <div key={item.storeProductId} className="wb-sf-cart__line" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--color-border, #e2e8f0)" }}>
                                <div>
                                    <strong>{item.title}</strong>
                                    <div style={{ fontSize: 14, color: "#64748b" }}>Adet: {item.quantity}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div>{item.lineTotal} ₺</div>
                                    <button
                                        type="button"
                                        onClick={() => updatePublicCartItem(storeSlug, item.storeProductId, 0).then(load)}
                                        style={{ marginTop: 6, fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}
                                    >
                                        Kaldır
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 24, padding: 20, background: "var(--color-surface, #f8fafc)", borderRadius: 12 }}>
                        <p>Ara toplam: <strong>{cart.subtotal} ₺</strong></p>
                        <p>Kargo: <strong>{shipping} ₺</strong></p>
                        <p style={{ fontSize: 18, marginTop: 8 }}>Toplam: <strong>{total} ₺</strong></p>
                        <Link
                            to={wbCheckoutPath(siteSlug)}
                            style={{ display: "block", marginTop: 16, textAlign: "center", padding: "14px", background: "var(--color-primary, #3b82f6)", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
                        >
                            Ödemeye geç
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
