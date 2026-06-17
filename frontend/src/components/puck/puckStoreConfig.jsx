import React from "react";

export const PUCK_DEFAULT_DATA = {
    root: { props: { title: "Mağaza vitrini" } },
    content: [
        {
            type: "Hero",
            props: {
                id: "hero-1",
                baslik: "Mağazanıza hoş geldiniz",
                altBaslik: "Kaliteli ürünler, hızlı kargo ve güvenli ödeme.",
                butonMetni: "Alışverişe başla",
                butonLink: "/products",
                arkaPlan: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            },
        },
        {
            type: "UrunGrid",
            props: {
                id: "grid-1",
                baslik: "Öne çıkan ürünler",
                sutun: 4,
            },
        },
        {
            type: "Bulten",
            props: {
                id: "news-1",
                baslik: "Kampanyalardan haberdar olun",
                aciklama: "E-posta bültenimize abone olun.",
                butonMetni: "Abone ol",
            },
        },
    ],
    zones: {},
};

export const puckStoreConfig = {
    root: {
        label: "Sayfa",
        fields: {
            title: { type: "text", label: "Sayfa başlığı" },
        },
        render: ({ children }) => <div className="puck-store-root">{children}</div>,
    },
    categories: {
        yapi: { title: "Yapı", components: ["UstMenu", "AltBilgi"] },
        vitrin: { title: "Vitrin", components: ["Hero", "UrunGrid", "Ozellikler"] },
        icerik: { title: "İçerik", components: ["Metin", "Bulten"] },
    },
    components: {
        UstMenu: {
            label: "Üst menü",
            fields: {
                marka: { type: "text", label: "Mağaza adı" },
                arkaPlan: { type: "text", label: "Arka plan rengi" },
                metinRengi: { type: "text", label: "Metin rengi" },
            },
            defaultProps: { marka: "LYSIA", arkaPlan: "#0f172a", metinRengi: "#ffffff" },
            render: ({ marka, arkaPlan, metinRengi }) => (
                <header
                    style={{
                        background: arkaPlan || "#0f172a",
                        color: metinRengi || "#fff",
                        padding: "14px 24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                    }}
                >
                    <a href="/" style={{ fontWeight: 800, fontSize: "1.125rem", color: "inherit", textDecoration: "none" }}>
                        {marka}
                    </a>
                    <nav style={{ display: "flex", gap: 20, fontSize: "0.9375rem" }}>
                        {["Ürünler", "Koleksiyonlar", "Hakkımızda"].map((l) => (
                            <a key={l} href="#" style={{ color: "inherit", opacity: 0.85, textDecoration: "none" }}>{l}</a>
                        ))}
                    </nav>
                    <button
                        type="button"
                        style={{
                            background: "rgba(255,255,255,0.15)",
                            border: "1px solid rgba(255,255,255,0.25)",
                            color: "inherit",
                            borderRadius: 8,
                            padding: "8px 14px",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                        }}
                    >
                        Sepet (0)
                    </button>
                </header>
            ),
        },
        AltBilgi: {
            label: "Alt bilgi",
            fields: {
                metin: { type: "text", label: "Telif metni" },
            },
            defaultProps: { metin: "© Lysia Mağaza — Tüm hakları saklıdır." },
            render: ({ metin }) => (
                <footer
                    style={{
                        background: "#0f172a",
                        color: "#94a3b8",
                        padding: "32px 24px",
                        textAlign: "center",
                        fontSize: "0.875rem",
                    }}
                >
                    {metin}
                </footer>
            ),
        },
        Hero: {
            label: "Ana vitrin",
            fields: {
                baslik: { type: "text", label: "Başlık" },
                altBaslik: { type: "textarea", label: "Alt başlık" },
                butonMetni: { type: "text", label: "Buton metni" },
                butonLink: { type: "text", label: "Buton linki" },
                arkaPlan: { type: "text", label: "Arka plan (CSS)" },
                metinRengi: { type: "text", label: "Metin rengi" },
            },
            defaultProps: {
                baslik: "Mağazanıza hoş geldiniz",
                altBaslik: "En yeni koleksiyonları keşfedin.",
                butonMetni: "Alışverişe başla",
                butonLink: "/products",
                arkaPlan: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                metinRengi: "#ffffff",
            },
            render: ({ baslik, altBaslik, butonMetni, butonLink, arkaPlan, metinRengi }) => {
                const textColor = metinRengi || "#ffffff";
                const isLight = textColor === "#000000" || textColor === "#18181b" || textColor === "#212529";
                return (
                <section
                    style={{
                        background: arkaPlan,
                        color: textColor,
                        padding: "80px 24px",
                        textAlign: "center",
                    }}
                >
                    <h1 style={{ fontSize: "clamp(2rem,4vw,3rem)", margin: "0 0 16px", fontWeight: 800 }}>{baslik}</h1>
                    <p style={{ fontSize: "1.125rem", opacity: 0.92, maxWidth: 560, margin: "0 auto 28px" }}>{altBaslik}</p>
                    <a
                        href={butonLink || "#"}
                        style={{
                            display: "inline-block",
                            background: isLight ? "#0f172a" : "#fff",
                            color: isLight ? "#fff" : "#4f46e5",
                            padding: "14px 28px",
                            borderRadius: 999,
                            fontWeight: 700,
                            textDecoration: "none",
                        }}
                    >
                        {butonMetni}
                    </a>
                </section>
                );
            },
        },
        UrunGrid: {
            label: "Ürün vitrini",
            fields: {
                baslik: { type: "text", label: "Başlık" },
                sutun: { type: "number", label: "Sütun sayısı", min: 2, max: 6 },
            },
            defaultProps: { baslik: "Öne çıkan ürünler", sutun: 4 },
            render: ({ baslik, sutun }) => (
                <section style={{ padding: "64px 24px", maxWidth: 1200, margin: "0 auto" }}>
                    <h2 style={{ textAlign: "center", marginBottom: 32, fontSize: "1.75rem" }}>{baslik}</h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${sutun || 4}, minmax(0, 1fr))`,
                            gap: 20,
                        }}
                    >
                        {Array.from({ length: sutun || 4 }).map((_, i) => (
                            <article
                                key={i}
                                style={{
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 12,
                                    overflow: "hidden",
                                }}
                            >
                                <div style={{ aspectRatio: "1", background: `hsl(${i * 40}, 35%, 88%)` }} />
                                <div style={{ padding: "12px 14px" }}>
                                    <div style={{ fontWeight: 600 }}>Ürün {i + 1}</div>
                                    <div style={{ color: "#64748b", marginTop: 4 }}>₺199,00</div>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ),
        },
        Ozellikler: {
            label: "Özellikler",
            fields: {
                baslik: { type: "text", label: "Başlık" },
            },
            defaultProps: { baslik: "Neden biz?" },
            render: ({ baslik }) => (
                <section style={{ padding: "56px 24px", background: "#f8fafc" }}>
                    <h2 style={{ textAlign: "center", marginBottom: 32 }}>{baslik}</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, maxWidth: 960, margin: "0 auto" }}>
                        {["Hızlı kargo", "Güvenli ödeme", "7/24 destek"].map((t) => (
                            <div key={t} style={{ textAlign: "center", padding: 16 }}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                                <strong>{t}</strong>
                            </div>
                        ))}
                    </div>
                </section>
            ),
        },
        Metin: {
            label: "Metin bloğu",
            fields: {
                baslik: { type: "text", label: "Başlık" },
                icerik: { type: "textarea", label: "İçerik" },
            },
            defaultProps: { baslik: "Hakkımızda", icerik: "Markanızı tanıtan kısa bir metin yazın." },
            render: ({ baslik, icerik }) => (
                <section style={{ padding: "48px 24px", maxWidth: 720, margin: "0 auto" }}>
                    <h2>{baslik}</h2>
                    <p style={{ lineHeight: 1.7, color: "#475569" }}>{icerik}</p>
                </section>
            ),
        },
        Bulten: {
            label: "Bülten kaydı",
            fields: {
                baslik: { type: "text", label: "Başlık" },
                aciklama: { type: "text", label: "Açıklama" },
                butonMetni: { type: "text", label: "Buton metni" },
            },
            defaultProps: {
                baslik: "Kampanyalardan haberdar olun",
                aciklama: "E-posta bültenimize abone olun.",
                butonMetni: "Abone ol",
            },
            render: ({ baslik, aciklama, butonMetni }) => (
                <section
                    style={{
                        padding: "48px 24px",
                        background: "#0f172a",
                        color: "#fff",
                        textAlign: "center",
                    }}
                >
                    <h2 style={{ margin: "0 0 8px" }}>{baslik}</h2>
                    <p style={{ opacity: 0.85, marginBottom: 20 }}>{aciklama}</p>
                    <button
                        type="button"
                        style={{
                            background: "#6366f1",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "12px 24px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {butonMetni}
                    </button>
                </section>
            ),
        },
    },
};
