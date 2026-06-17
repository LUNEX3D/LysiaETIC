import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { checkoutPublic } from "../../services/storeApi";
import { getMarketingCheckoutExtras } from "../../components/storefront/StorefrontMarketing";
import "../../styles/storefront.css";

const StoreCheckoutPage = () => {
    const { slug } = useParams();
    const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
    const [address, setAddress] = useState({ city: "", district: "", line: "" });
    const [iframeUrl, setIframeUrl] = useState("");
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const data = await checkoutPublic(slug, {
                customer,
                shippingAddress: address,
                ...getMarketingCheckoutExtras(slug),
            });
            if (data.iframeUrl) {
                setIframeUrl(data.iframeUrl);
            } else {
                setError("Ödeme başlatılamadı");
            }
        } catch (err) {
            setError(err.response?.data?.error || "Hata");
        }
    };

    if (iframeUrl) {
        return (
            <div className="sf-root">
                <header className="sf-header">
                    <span>Ödeme — PayTR</span>
                </header>
                <main className="sf-main">
                    <iframe title="PayTR" src={iframeUrl} className="sf-pay-frame" />
                </main>
            </div>
        );
    }

    return (
        <div className="sf-root">
            <header className="sf-header">
                <Link to={`/shop/${slug}/cart`}>← Sepet</Link>
            </header>
            <main className="sf-main sf-form" style={{ maxWidth: 480 }}>
                <h2>Teslimat & ödeme</h2>
                {error && <p style={{ color: "#f87171" }}>{error}</p>}
                <form onSubmit={submit}>
                    <input required placeholder="Ad Soyad" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                    <input required type="email" placeholder="E-posta" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
                    <input placeholder="Telefon" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                    <input placeholder="İl" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    <input placeholder="İlçe" value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} />
                    <textarea placeholder="Adres" value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} rows={3} />
                    <button type="submit" className="sf-btn">
                        PayTR ile öde
                    </button>
                </form>
            </main>
        </div>
    );
};

export default StoreCheckoutPage;
