import React from "react";
import ProductRichHtmlEditor from "./ProductRichHtmlEditor";

const ProductDescriptionEditor = ({ form, setForm, visible }) => {
    const scrollForm = (where) => {
        const container = document.querySelector(".ec-prod-form-body");
        if (!container) return;
        container.scrollTo({
            top: where === "bottom" ? container.scrollHeight : 0,
            behavior: "smooth",
        });
    };

    if (!visible) return null;

    return (
        <section className="ec-prod-section ec-prod-desc-section" id="ec-sec-description">
            <div className="ec-prod-section__head ec-prod-section__head--desc">
                <h3>Açıklama</h3>
                <div className="ec-prod-desc-scroll-actions">
                        <button type="button" onClick={() => scrollForm("top")}>
                            ↑ Başa
                        </button>
                        <button type="button" onClick={() => scrollForm("bottom")}>
                            ↓ Sona
                        </button>
                    </div>
            </div>

            <ProductRichHtmlEditor
                value={form.description || ""}
                onChange={(html) => setForm((prev) => ({ ...prev, description: html }))}
                loadKey={form.title}
                placeholder="Ürün açıklaması…"
                showAi
                aiContext={{ title: form.title, brand: form.brand, price: form.price }}
            />
        </section>
    );
};

export default ProductDescriptionEditor;
