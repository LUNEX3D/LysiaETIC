import React from "react";
import { FaPaintBrush, FaRocket } from "react-icons/fa";

/**
 * Mağaza merkezi — tema sistemi sıfırdan yeniden kurulacak.
 */
export default function EcStoreCenterPage({ siteId, language = "tr", onNavigate }) {
    const en = language === "en";

    return (
        <div className="eph-page eph-page--light" style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
            <header className="eph-header" style={{ marginBottom: "1.5rem" }}>
                <div className="eph-header-icon">
                    <FaPaintBrush />
                </div>
                <div>
                    <h1>{en ? "Store appearance" : "Mağaza görünümü"}</h1>
                    <p>
                        {en
                            ? "Theme and visual editor modules are being rebuilt from scratch. Use publish and domain settings in the meantime."
                            : "Tema ve görsel editör modülleri sıfırdan yeniden kuruluyor. Bu arada yayın ve alan adı ayarlarını kullanabilirsiniz."}
                    </p>
                </div>
            </header>

            <div
                style={{
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 12,
                    padding: "1rem 1.25rem",
                    marginBottom: "1.25rem",
                    fontSize: "0.88rem",
                    lineHeight: 1.55,
                    color: "#334155",
                }}
            >
                {en
                    ? "Previous theme marketplace, Grapes editor and Ikas-style customizer have been removed from e-commerce. A new theme architecture will be added here."
                    : "Eski tema mağazası, Grapes editör ve İkas tarzı özelleştirici e-ticaret bölümünden kaldırıldı. Yeni tema mimarisi buraya eklenecek."}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <button
                    type="button"
                    className="ec-mp__back"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                    onClick={() => onNavigate?.("ec-wb-publish")}
                >
                    <FaRocket />
                    {en ? "Publish status" : "Yayın durumu"}
                </button>
                <button
                    type="button"
                    className="ec-mp__back"
                    onClick={() => onNavigate?.("ec-wb-domain")}
                >
                    {en ? "Domains" : "Alan adları"}
                </button>
            </div>

            {siteId && (
                <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                    site: {siteId}
                </p>
            )}
        </div>
    );
}
