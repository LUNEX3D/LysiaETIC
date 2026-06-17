import React, { useState } from "react";
import { Link } from "react-router-dom";
import { checkoutPublic } from "../../services/storeApi";
import { getMarketingCheckoutExtras } from "../storefront/StorefrontMarketing";
import { wbCartPath } from "../../utils/wbStorefrontPaths";

export default function WbCheckoutWidget({ storeSlug, siteSlug }) {
    const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
    const [address, setAddress] = useState({ city: "", district: "", line: "" });
    const [iframeUrl, setIframeUrl] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (!storeSlug) {
        return (
            <div style={{ padding: 32, textAlign: "center" }}>
                <p>Ödeme için mağaza bağlantısı gerekli.</p>
            </div>
        );
    }

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            const data = await checkoutPublic(storeSlug, {
                customer,
                shippingAddress: address,
                ...getMarketingCheckoutExtras(storeSlug),
            });
            if (data.iframeUrl) setIframeUrl(data.iframeUrl);
            else setError("Ödeme başlatılamadı");
        } catch (err) {
            setError(err.response?.data?.error || "Ödeme hatası");
        } finally {
            setSubmitting(false);
        }
    };

    if (iframeUrl) {
        return (
            <div style={{ padding: 16 }}>
                <iframe title="Ödeme" src={iframeUrl} style={{ width: "100%", minHeight: 640, border: "none", borderRadius: 12 }} />
            </div>
        );
    }

    return (
        <div className="wb-sf-checkout" style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
            <Link to={wbCartPath(siteSlug)} style={{ fontSize: 14, color: "var(--color-primary, #3b82f6)" }}>← Sepete dön</Link>
            <h2 style={{ margin: "16px 0" }}>Teslimat ve ödeme</h2>
            {error && <p style={{ color: "#dc2626", marginBottom: 12 }}>{error}</p>}
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input required placeholder="Ad Soyad" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} style={{ padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <input required type="email" placeholder="E-posta" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} style={{ padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <input placeholder="Telefon" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} style={{ padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <input placeholder="İl" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} style={{ padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <input placeholder="İlçe" value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} style={{ padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <textarea placeholder="Adres" value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} rows={3} style={{ padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <button type="submit" disabled={submitting} style={{ padding: 14, background: "var(--color-primary, #3b82f6)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                    {submitting ? "İşleniyor…" : "PayTR ile öde"}
                </button>
            </form>
        </div>
    );
}
