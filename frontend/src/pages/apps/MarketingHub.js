/**
 * Pazarlama modülleri — ikas menü yapısı (Faz: özet + yakında ekranları)
 */
import React, { useState } from "react";
import { FaEnvelope, FaRobot, FaUsers, FaWindowMaximize, FaTag, FaChartPie } from "react-icons/fa";
import "../../styles/appStoreHub.css";

const TABS = [
    { id: "overview", label: "Özet", icon: FaChartPie },
    { id: "email", label: "E-Posta & SMS", icon: FaEnvelope, panel: "marketing-email" },
    { id: "automation", label: "Otomasyon", icon: FaRobot, panel: "marketing-automation" },
    { id: "segments", label: "Müşteri Segmentleri", icon: FaUsers, panel: "marketing-segments" },
    { id: "popup", label: "Popup", icon: FaWindowMaximize, panel: "marketing-popup" },
    { id: "discounts", label: "İndirimler", icon: FaTag, panel: "marketing-discounts" },
];

const COPY = {
    overview: {
        title: "Pazarlama Özeti",
        text: "E-posta, SMS, otomasyon ve segment performansınız tek ekranda. Modüller kademeli olarak açılacak.",
    },
    email: { title: "E-Posta & SMS", text: "Kampanya oluşturma, şablonlar ve otomatik tetikleyiciler yakında." },
    automation: { title: "Pazarlama Otomasyonu", text: "Sepet terk, hoş geldin ve sipariş sonrası akışlar yakında." },
    segments: { title: "Müşteri Segmentleri", text: "Davranış ve sipariş geçmişine göre canlı segmentler yakında." },
    popup: { title: "Popup & Dönüşüm", text: "Çıkış intent ve indirim popup’ları yakında." },
    discounts: { title: "İndirimler & Kuponlar", text: "Mağaza kuponları ve kampanya kodları yakında." },
};

const MarketingHub = ({ initialTab = "overview" }) => {
    const [tab, setTab] = useState(initialTab);
    const copy = COPY[tab] || COPY.overview;

    return (
        <div className="marketing-hub">
            <div className="app-store-hero">
                <h1>Pazarlama</h1>
                <p>Müşterilerinize ulaşın, otomasyon kurun, dönüşümü artırın.</p>
            </div>

            <div className="marketing-hub-tabs">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`marketing-hub-tab ${tab === t.id ? "active" : ""}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="marketing-coming">
                <h2>{copy.title}</h2>
                <p>{copy.text}</p>
                {tab !== "overview" && (
                    <p style={{ marginTop: "1rem", fontSize: "0.8rem", opacity: 0.5 }}>
                        Uygulama Mağazasından ilgili modülü kurarak hazır olduğunda bildirim alacaksınız.
                    </p>
                )}
            </div>
        </div>
    );
};

export default MarketingHub;
