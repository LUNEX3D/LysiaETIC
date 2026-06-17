import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaArrowLeft, FaInfoCircle, FaTrash, FaCopy } from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import {
    fetchStoreProducts,
    fetchStoreCartLinkSalesChannels,
    fetchStoreCartLink,
    createStoreCartLink,
    updateStoreCartLink,
} from "../../../services/storeApi";
import CartLinkCollapsibleSection from "./CartLinkCollapsibleSection";
import CartLinkProductPickerModal from "./CartLinkProductPickerModal";
import {
    emptyCartLinkForm,
    cartLinkToForm,
    formToCartLinkPayload,
    canSubmitCartLink,
} from "./cartLinkFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const COUPON_OPTIONS = [
    {
        id: "none",
        title: "Kupon kodu olmadan link oluştur",
        text: "Oluşturduğunuz linkte indiriminiz ya da kullanıcıların kendi ekledikleri kupon kodu ile ödeme yapılmasını sağlayın.",
    },
    {
        id: "with_code",
        title: "Kupon kodu ile link oluştur",
        text: "Oluşturduğunuz linke kupon kodu ekleyerek kullanıcının kupon kodu girmeden hızlıca ödeme yapmasını sağlayın.",
    },
];

const StoreCartLinkFormPage = ({ cartLinkId, onNavigate }) => {
    const isEdit = !!cartLinkId;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(emptyCartLinkForm);
    const [channels, setChannels] = useState([]);
    const [products, setProducts] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [openTracking, setOpenTracking] = useState(true);
    const [openCoupon, setOpenCoupon] = useState(true);
    const [createdUrl, setCreatedUrl] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [chRes, prodRes] = await Promise.all([
                fetchStoreCartLinkSalesChannels(),
                fetchStoreProducts(),
            ]);
            const ch = chRes.channels || [];
            setChannels(ch);
            setProducts(prodRes.products || []);

            if (isEdit) {
                const res = await fetchStoreCartLink(cartLinkId);
                const f = cartLinkToForm(res.cartLink, ch);
                const byId = new Map((prodRes.products || []).map((p) => [String(p._id), p]));
                f.products = (f.products || []).map((line) => ({
                    ...line,
                    title: byId.get(String(line.productId))?.title || line.title || "Ürün",
                }));
                setForm(f);
                if (res.cartLink?.generatedUrl) setCreatedUrl(res.cartLink.generatedUrl);
            } else {
                setForm(emptyCartLinkForm());
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [cartLinkId, isEdit]);

    useEffect(() => {
        load();
    }, [load]);

    const existingProductIds = useMemo(
        () => form.products.map((p) => String(p.productId)),
        [form.products]
    );

    const selectChannel = (channelId) => {
        const ch = channels.find((c) => c.id === channelId);
        if (!ch) return;
        setForm((prev) => ({
            ...prev,
            salesChannelId: ch.id,
            salesChannelLabel: ch.label,
            basePath: ch.basePath,
        }));
    };

    const addProduct = (product) => {
        if (existingProductIds.includes(String(product._id))) return;
        setForm((prev) => ({
            ...prev,
            products: [
                ...prev.products,
                {
                    productId: String(product._id),
                    quantity: 1,
                    variantBarcode: "",
                    title: product.title,
                },
            ],
        }));
    };

    const removeProduct = (productId) => {
        setForm((prev) => ({
            ...prev,
            products: prev.products.filter((p) => String(p.productId) !== String(productId)),
        }));
    };

    const submit = async () => {
        if (!canSubmitCartLink(form)) {
            setError("Satış kanalı ve en az bir ürün seçin. Kupon modunda kod girin.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToCartLinkPayload(form);
            if (isEdit) {
                const res = await updateStoreCartLink(cartLinkId, payload);
                setCreatedUrl(res.cartLink?.generatedUrl || "");
                setForm((prev) => ({ ...prev, generatedUrl: res.cartLink?.generatedUrl }));
            } else {
                const res = await createStoreCartLink(payload);
                setCreatedUrl(res.cartLink?.generatedUrl || "");
                onNavigate?.(`ec-cart-link-edit-${res.cartLink._id}`);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const copyUrl = async () => {
        const url = createdUrl || form.generatedUrl;
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // no-op
        }
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    const displayUrl = createdUrl || form.generatedUrl;

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page ec-cart-link-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar ec-cat-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.("ec-products-definitions")}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-products-definitions")}
                            >
                                Tanımlamalar
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>Sepet Linki</span>
                        </nav>
                    </div>
                    <div className="ec-prod-head-actions">
                        <button
                            type="button"
                            className="ec-prod-btn"
                            onClick={() => onNavigate?.("ec-products-definitions")}
                        >
                            Vazgeç
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            disabled={saving || !canSubmitCartLink(form)}
                            onClick={submit}
                        >
                            {saving ? "Oluşturuluyor…" : "Link Oluştur"}
                        </button>
                    </div>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-prod-form-body ec-cat-form-body ec-cart-link-body">
                    <div className="ec-cart-link-stack">
                    <section className="ec-prod-section ec-cart-link-main">
                        <div className="ec-cart-link-main__head">
                            <h2 className="ec-cart-link-main__title">
                                Sepet Linki{" "}
                                <FaInfoCircle className="ec-cart-link-main__info" aria-hidden="true" />
                            </h2>
                            <p className="ec-cart-link-main__desc">
                                Kullanıcıları doğrudan sepet sayfasına yönlendiren hemen satın al butonu
                                oluşturun.
                            </p>
                        </div>

                        <div className="ec-cart-link-field">
                            <label className="ec-cart-link-field__label" htmlFor="cart-link-channel">
                                Satış Kanalı <span className="ec-cart-link-required">*</span>
                            </label>
                            <EcSelect
                                id="cart-link-channel"
                                value={form.salesChannelId}
                                onChange={(e) => selectChannel(e.target.value)}
                            >
                                <option value="">Satış Kanalı Seçin</option>
                                {channels.map((ch) => (
                                    <option key={ch.id} value={ch.id}>
                                        {ch.label}
                                    </option>
                                ))}
                            </EcSelect>
                        </div>

                        <div className="ec-cart-link-products-block">
                            <h3 className="ec-cart-link-products-block__title">Ürünler</h3>
                            {!form.products.length ? (
                                <div className="ec-cart-link-products-empty">
                                    <div className="ec-cart-link-products-empty__icon" />
                                    <p className="ec-cart-link-products-empty__title">
                                        Henüz bir ürün eklemediniz.
                                    </p>
                                    <p className="ec-cart-link-products-empty__text">
                                        Linkini oluşturmak istediğiniz ürünleri seçin.
                                    </p>
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--primary"
                                        onClick={() => setPickerOpen(true)}
                                    >
                                        Ürün Ekle
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <ul className="ec-cart-link-products-list">
                                        {form.products.map((line) => (
                                            <li key={line.productId}>
                                                <span className="ec-cart-link-products-list__name">
                                                    {line.title || "Ürün"}
                                                </span>
                                                <label className="ec-cart-link-qty">
                                                    <span>Adet</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={line.quantity}
                                                        onChange={(e) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                products: prev.products.map((p) =>
                                                                    String(p.productId) ===
                                                                    String(line.productId)
                                                                        ? {
                                                                              ...p,
                                                                              quantity: e.target.value,
                                                                          }
                                                                        : p
                                                                ),
                                                            }))
                                                        }
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                                                    title="Kaldır"
                                                    onClick={() => removeProduct(line.productId)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--primary ec-cart-link-add-more"
                                        onClick={() => setPickerOpen(true)}
                                    >
                                        Ürün Ekle
                                    </button>
                                </>
                            )}
                        </div>
                    </section>

                    <CartLinkCollapsibleSection
                        id="cart-link-tracking"
                        title="Sipariş Kaynağı Takibi"
                        open={openTracking}
                        onToggle={() => setOpenTracking((v) => !v)}
                    >
                        <label
                            className={`ec-cart-link-option-row ec-cart-link-option-row--check${form.trackUtm ? " ec-cart-link-option-row--active" : ""}`}
                        >
                            <input
                                type="checkbox"
                                checked={form.trackUtm}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, trackUtm: e.target.checked }))
                                }
                            />
                            <span className="ec-cart-link-option-row__content">
                                <strong>Takip edilebilir link oluştur</strong>
                            </span>
                        </label>
                        <p className="ec-cart-link-tracking-hint">
                            Bu seçenekle oluşturulan linklere UTM parametreleri eklenir. Böylece
                            siparişlerin kaynağını{" "}
                            <code>utm_source=cart_link</code> ve <code>utm_medium=cart_link</code>{" "}
                            bilgileriyle takip edebilirsiniz.
                        </p>
                    </CartLinkCollapsibleSection>

                    <CartLinkCollapsibleSection
                        id="cart-link-coupon"
                        title="Kupon Kodu"
                        hint="Oluşturduğunuz linke kupon kodu ekleyerek kullanıcının kupon kodu girmeden hızlıca ödeme yapmasını sağlayın."
                        open={openCoupon}
                        onToggle={() => setOpenCoupon((v) => !v)}
                    >
                        <div className="ec-cart-link-option-list" role="radiogroup" aria-label="Kupon kodu">
                            {COUPON_OPTIONS.map((opt) => {
                                const active = form.couponMode === opt.id;
                                return (
                                    <label
                                        key={opt.id}
                                        className={`ec-cart-link-option-row ec-cart-link-option-row--radio${active ? " ec-cart-link-option-row--active" : ""}`}
                                    >
                                        <input
                                            type="radio"
                                            name="cart-link-coupon-mode"
                                            checked={active}
                                            onChange={() =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    couponMode: opt.id,
                                                    couponCode:
                                                        opt.id === "none" ? "" : prev.couponCode,
                                                }))
                                            }
                                        />
                                        <span className="ec-cart-link-option-row__content">
                                            <strong>{opt.title}</strong>
                                            <p>{opt.text}</p>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        {form.couponMode === "with_code" && (
                            <div className="ec-cart-link-field ec-cart-link-field--nested">
                                <label className="ec-cart-link-field__label" htmlFor="cart-link-coupon-code">
                                    Kupon Kodu
                                </label>
                                <input
                                    id="cart-link-coupon-code"
                                    className="ec-cart-link-input"
                                    value={form.couponCode}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, couponCode: e.target.value }))
                                    }
                                    placeholder="Kupon kodunu girin"
                                />
                                <p className="ec-cart-link-field__hint">
                                    Mağazanızda geçerli kupon kodunu yazın; link açıldığında sepete
                                    uygulanır.
                                </p>
                            </div>
                        )}
                    </CartLinkCollapsibleSection>

                    {displayUrl && (
                        <section className="ec-prod-section ec-cart-link-result">
                            <h3 className="ec-cart-link-result__title">Oluşturulan link</h3>
                            <div className="ec-cart-link-result__row">
                                <input
                                    className="ec-cart-link-input"
                                    readOnly
                                    value={displayUrl}
                                />
                                <button
                                    type="button"
                                    className="ec-prod-btn"
                                    onClick={copyUrl}
                                    title="Kopyala"
                                >
                                    <FaCopy /> Kopyala
                                </button>
                            </div>
                        </section>
                    )}
                    </div>
                </div>
            </div>

            <CartLinkProductPickerModal
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                products={products}
                existingProductIds={existingProductIds}
                onAdd={addProduct}
            />
        </div>
    );
};

export default StoreCartLinkFormPage;
