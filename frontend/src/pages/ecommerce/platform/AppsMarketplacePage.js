import React from "react";

const APPS = [
    { id: "reviews", nameTr: "Ürün yorumları", nameEn: "Product reviews", status: "soon" },
    { id: "whatsapp", nameTr: "WhatsApp sipariş", nameEn: "WhatsApp orders", status: "soon" },
    { id: "loyalty", nameTr: "Sadakat puanı", nameEn: "Loyalty points", status: "soon" },
    { id: "analytics", nameTr: "Gelişmiş analitik", nameEn: "Advanced analytics", status: "soon" },
];

export default function AppsMarketplacePage({ language = "tr" }) {
    const en = language === "en";

    return (
        <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
            <h1 style={{ fontSize: "1.35rem", marginBottom: 8 }}>
                {en ? "App Store" : "Uygulama Mağazası"}
            </h1>
            <p style={{ color: "#64748b", marginBottom: 24 }}>
                {en
                    ? "Extend your store with integrations."
                    : "Mağazanızı entegrasyonlarla genişletin."}
            </p>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 16,
                }}
            >
                {APPS.map((app) => (
                    <div
                        key={app.id}
                        style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 12,
                            padding: 16,
                            background: "#fff",
                        }}
                    >
                        <strong>{en ? app.nameEn : app.nameTr}</strong>
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 8 }}>
                            {en ? "Coming soon" : "Yakında"}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
