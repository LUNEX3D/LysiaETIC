import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaInfoCircle, FaPlus, FaTrash } from "react-icons/fa";
import { createStoreOrder, fetchStoreProducts } from "../../../services/storeApi";
import CartLinkProductPickerModal from "../definitions/CartLinkProductPickerModal";
import {
    emptyOrderCreateForm,
    productToLineItem,
    computeOrderTotals,
    emptyAddress,
} from "./orderFormUtils";
import { fmtTry } from "./orderUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceDefinitions.css";

const EcommerceOrderCreatePage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(emptyOrderCreateForm);
    const [pickerOpen, setPickerOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchStoreProducts();
            setProducts(res.products || []);
        } catch (e) {
            setError(e.response?.data?.error || "Ürünler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const existingProductIds = useMemo(
        () => form.lineItems.map((l) => String(l.storeProductId)),
        [form.lineItems]
    );

    const totals = useMemo(
        () =>
            computeOrderTotals({
                lineItems: form.lineItems,
                shippingCost: form.shippingCost,
                taxPercent: form.applyTax ? Number(form.taxPercent) || 0 : 0,
                taxIncluded: false,
            }),
        [form.lineItems, form.shippingCost, form.taxPercent, form.applyTax]
    );

    const addProduct = (product) => {
        setForm((f) => ({
            ...f,
            lineItems: [...f.lineItems, productToLineItem(product)],
        }));
    };

    const updateLine = (index, patch) => {
        setForm((f) => ({
            ...f,
            lineItems: f.lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)),
        }));
    };

    const removeLine = (index) => {
        setForm((f) => ({
            ...f,
            lineItems: f.lineItems.filter((_, i) => i !== index),
        }));
    };

    const submit = async (asDraft) => {
        if (!form.lineItems.length) {
            setError("En az bir ürün ekleyin");
            return;
        }
        if (!form.customerName.trim() && !form.customerEmail.trim()) {
            setError("Müşteri adı veya e-posta girin");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const billing = form.sameBilling ? form.shipping : form.billing;
            const res = await createStoreOrder({
                isDraft: asDraft,
                customer: {
                    name: form.customerName.trim() || "Misafir",
                    email: form.customerEmail.trim(),
                    phone: form.customerPhone.trim(),
                },
                shippingAddress: form.shipping,
                billingAddress: billing,
                shippingCarrier: form.shippingCarrier.trim(),
                trackingNumber: form.trackingNumber.trim(),
                lineItems: form.lineItems.map((li) => ({
                    storeProductId: li.storeProductId,
                    title: li.title,
                    quantity: li.quantity,
                    unitPrice: li.unitPrice,
                    barcode: li.barcode,
                })),
                subtotal: totals.subtotal,
                shippingCost: totals.shippingCost,
                taxAmount: totals.taxAmount,
                total: totals.total,
                salesChannel: "Manuel Sipariş",
                paymentStatus: "pending",
            });
            if (asDraft) onNavigate?.("ec-orders-drafts");
            else onNavigate?.(`ec-order-${res.order._id}`);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Oluşturulamadı");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="ec-prod-page ec-order-create-page">
                <div className="ec-prod-empty">Yükleniyor…</div>
            </div>
        );
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page ec-order-create-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.("ec-orders")}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-orders")}
                            >
                                Siparişler
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>Sipariş Oluştur</span>
                        </nav>
                    </div>
                    <div className="ec-prod-head-actions">
                        <button
                            type="button"
                            className="ec-prod-btn"
                            disabled={saving}
                            onClick={() => submit(true)}
                        >
                            Taslak Kaydet
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            disabled={saving}
                            onClick={() => submit(false)}
                        >
                            {saving ? "Kaydediliyor…" : "Sipariş Oluştur"}
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="ec-purchase-form-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="ec-prod-form-body ec-order-create-body">
                    <div className="ec-order-create-layout">
                        <div className="ec-order-create-main">
                            <section className="ec-prod-section">
                                <div className="ec-prod-section__head">
                                    <h3>
                                        Ürünler{" "}
                                        <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                                    </h3>
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--primary"
                                        onClick={() => setPickerOpen(true)}
                                    >
                                        <FaPlus /> Ürün Ekle
                                    </button>
                                </div>
                                {!form.lineItems.length ? (
                                    <div className="ec-order-create-products-empty">
                                        <p>Henüz ürün eklemediniz.</p>
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary"
                                            onClick={() => setPickerOpen(true)}
                                        >
                                            Ürün Ekle
                                        </button>
                                    </div>
                                ) : (
                                    <table className="ec-order-lines-table">
                                        <thead>
                                            <tr>
                                                <th>Ürün</th>
                                                <th style={{ width: 90 }}>Adet</th>
                                                <th style={{ width: 110 }}>Birim Fiyat</th>
                                                <th style={{ width: 110 }}>Toplam</th>
                                                <th style={{ width: 44 }} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.lineItems.map((li, idx) => (
                                                <tr key={`${li.storeProductId}-${idx}`}>
                                                    <td>
                                                        <div className="ec-order-lines-table__product">
                                                            {li.imageUrl ? (
                                                                <img
                                                                    src={li.imageUrl}
                                                                    alt=""
                                                                    className="ec-order-lines-table__thumb ec-order-lines-table__thumb--img"
                                                                />
                                                            ) : (
                                                                <span
                                                                    className="ec-order-lines-table__thumb"
                                                                    aria-hidden
                                                                />
                                                            )}
                                                            <span>{li.title}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            className="ec-order-create-qty"
                                                            value={li.quantity}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    quantity: Math.max(
                                                                        1,
                                                                        Number(e.target.value) || 1
                                                                    ),
                                                                })
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="0.01"
                                                            className="ec-order-create-price"
                                                            value={li.unitPrice}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    unitPrice: Math.max(
                                                                        0,
                                                                        Number(e.target.value) || 0
                                                                    ),
                                                                })
                                                            }
                                                        />
                                                    </td>
                                                    <td>
                                                        {fmtTry(
                                                            (li.quantity || 0) * (li.unitPrice || 0)
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                                                            title="Kaldır"
                                                            onClick={() => removeLine(idx)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </section>

                            <section className="ec-prod-section">
                                <h3>Müşteri</h3>
                                <div className="ec-prod-grid ec-purchase-grid--2">
                                    <div className="ec-prod-field ec-prod-field--full">
                                        <label>Ad Soyad *</label>
                                        <input
                                            value={form.customerName}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    customerName: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="ec-prod-field">
                                        <label>E-posta</label>
                                        <input
                                            type="email"
                                            value={form.customerEmail}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    customerEmail: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="ec-prod-field">
                                        <label>Telefon</label>
                                        <input
                                            value={form.customerPhone}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    customerPhone: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="ec-prod-section">
                                <h3>Sevkiyat Adresi</h3>
                                <div className="ec-prod-field">
                                    <label>Adres</label>
                                    <input
                                        value={form.shipping.line}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                shipping: { ...f.shipping, line: e.target.value },
                                            }))
                                        }
                                    />
                                </div>
                                <div className="ec-prod-grid ec-purchase-grid--2">
                                    <div className="ec-prod-field">
                                        <label>İlçe</label>
                                        <input
                                            value={form.shipping.district}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    shipping: {
                                                        ...f.shipping,
                                                        district: e.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="ec-prod-field">
                                        <label>Şehir</label>
                                        <input
                                            value={form.shipping.city}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    shipping: { ...f.shipping, city: e.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="ec-prod-field">
                                        <label>Posta Kodu</label>
                                        <input
                                            value={form.shipping.zip}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    shipping: { ...f.shipping, zip: e.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="ec-prod-section">
                                <label className="ec-order-create-same-bill">
                                    <input
                                        type="checkbox"
                                        checked={form.sameBilling}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                sameBilling: e.target.checked,
                                            }))
                                        }
                                    />
                                    Fatura adresi sevkiyat ile aynı
                                </label>
                                {!form.sameBilling && (
                                    <>
                                        <h3 style={{ marginTop: "1rem" }}>Fatura Adresi</h3>
                                        <div className="ec-prod-field">
                                            <label>Adres</label>
                                            <input
                                                value={form.billing.line}
                                                onChange={(e) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        billing: {
                                                            ...f.billing,
                                                            line: e.target.value,
                                                        },
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="ec-prod-grid ec-purchase-grid--2">
                                            <div className="ec-prod-field">
                                                <label>İlçe</label>
                                                <input
                                                    value={form.billing.district}
                                                    onChange={(e) =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            billing: {
                                                                ...f.billing,
                                                                district: e.target.value,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ec-prod-field">
                                                <label>Şehir</label>
                                                <input
                                                    value={form.billing.city}
                                                    onChange={(e) =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            billing: {
                                                                ...f.billing,
                                                                city: e.target.value,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </section>

                            <section className="ec-prod-section">
                                <h3>Kargo</h3>
                                <div className="ec-prod-grid ec-purchase-grid--2">
                                    <div className="ec-prod-field">
                                        <label>Kargo Şirketi</label>
                                        <input
                                            value={form.shippingCarrier}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    shippingCarrier: e.target.value,
                                                }))
                                            }
                                            placeholder="Örn. Aras Kargo"
                                        />
                                    </div>
                                    <div className="ec-prod-field">
                                        <label>Takip Numarası</label>
                                        <input
                                            value={form.trackingNumber}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    trackingNumber: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>

                        <aside className="ec-order-create-side">
                            <section className="ec-prod-section ec-order-create-summary">
                                <h3>Sipariş Özeti</h3>
                                <p className="ec-prod-muted">Manuel Sipariş</p>
                                <div className="ec-order-summary-rows">
                                    <div>
                                        <span>Ara Toplam</span>
                                        <span>{fmtTry(totals.subtotal)}</span>
                                    </div>
                                    <div className="ec-order-create-summary__edit">
                                        <span>Kargo Tutarı</span>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={form.shippingCost}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    shippingCost: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <label className="ec-order-create-tax-row">
                                        <input
                                            type="checkbox"
                                            checked={form.applyTax}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    applyTax: e.target.checked,
                                                }))
                                            }
                                        />
                                        <span>
                                            Vergi (%{form.taxPercent || 0})
                                        </span>
                                        <span>{fmtTry(totals.taxAmount)}</span>
                                    </label>
                                    {form.applyTax && (
                                        <div className="ec-prod-field" style={{ marginTop: "0.35rem" }}>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={form.taxPercent}
                                                onChange={(e) =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        taxPercent: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    )}
                                    <div className="ec-order-summary-rows__total">
                                        <span>Toplam</span>
                                        <span>{fmtTry(totals.total)}</span>
                                    </div>
                                </div>
                            </section>
                        </aside>
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

export default EcommerceOrderCreatePage;
