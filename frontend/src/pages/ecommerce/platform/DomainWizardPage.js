import React, { useState } from "react";
import { getActiveEcSite } from "../../../utils/ecStoreContext";

const STEPS = [
    { id: "choose", title: "Alan adınızı seçin", hint: "Kendi domaininizi bağlayın veya geçici adresi kullanın." },
    { id: "dns", title: "DNS kayıtlarını ekleyin", hint: "Alan adı sağlayıcınızda CNAME kaydı oluşturun." },
    { id: "verify", title: "Doğrulayın", hint: "DNS yayılımı tamamlandığında doğrulama yapılır." },
];

export default function DomainWizardPage({ onNavigate, language = "tr" }) {
    const en = language === "en";
    const site = getActiveEcSite();
    const [step, setStep] = useState(0);

    return (
        <div className="ec-domain-wizard" style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
            <h1 style={{ fontSize: "1.35rem", marginBottom: 8 }}>
                {en ? "Connect your domain" : "Alan adınızı bağlayın"}
            </h1>
            <p style={{ color: "#64748b", marginBottom: 24 }}>
                {site?.host
                    ? en
                        ? `Current address: ${site.host}`
                        : `Geçerli adres: ${site.host}`
                    : en
                      ? "Select a store first."
                      : "Önce bir mağaza seçin."}
            </p>

            <ol style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
                {STEPS.map((s, i) => (
                    <li
                        key={s.id}
                        style={{
                            padding: "12px 16px",
                            border: `1px solid ${i === step ? "#6366f1" : "#e2e8f0"}`,
                            borderRadius: 10,
                            marginBottom: 8,
                            background: i === step ? "#eef2ff" : "#fff",
                            cursor: "pointer",
                        }}
                        onClick={() => setStep(i)}
                    >
                        <strong>{en ? s.title : s.title}</strong>
                        <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{s.hint}</div>
                    </li>
                ))}
            </ol>

            <button
                type="button"
                className="ec-platform-topbar__btn ec-platform-topbar__btn--primary"
                onClick={() => onNavigate?.("ec-wb-domain")}
            >
                {en ? "Open domain settings" : "Alan adı ayarlarına git"}
            </button>
        </div>
    );
}
