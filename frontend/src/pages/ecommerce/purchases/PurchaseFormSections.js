import React, { useMemo, useState } from "react";
import {
    FaInfoCircle,
    FaSearch,
    FaBarcode,
    FaCamera,
    FaLock,
    FaTimes,
    FaBolt,
} from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcFieldLabel from "../../../components/ecommerce/EcFieldLabel";
import { EC_FIELD_HINTS } from "../../../constants/ecFieldHints";
import { PURCHASE_CURRENCIES, computePurchaseTotals, fmtMoney, lineTotal } from "./purchaseFormUtils";
import { normalizeScanCode } from "../../../components/ecommerce/barcode/productBarcodeUtils";
import { usePurchaseBarcodeMode } from "./usePurchaseBarcodeMode";
import EcToast, { useEcToast } from "../../../components/ecommerce/EcToast";
import EcBarcodeCameraModal from "../../../components/ecommerce/barcode/EcBarcodeCameraModal";

const Section = ({ title, extra, children }) => (
    <section className="ec-prod-section ec-purchase-section">
        <div className="ec-prod-section__head">
            <h3>
                {title} <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
            </h3>
            {extra}
        </div>
        {children}
    </section>
);

function productMatchesQuery(product, q) {
    if (product.title?.toLowerCase().includes(q)) return true;
    if (product.barcode?.toLowerCase().includes(q)) return true;
    if (product.sku?.toLowerCase().includes(q)) return true;
    for (const v of product.variants || []) {
        if (v.title?.toLowerCase().includes(q)) return true;
        if (v.barcode?.toLowerCase().includes(q)) return true;
        if (v.sku?.toLowerCase().includes(q)) return true;
    }
    return false;
}

const PurchaseFormSections = ({ form, setForm, storeName, products }) => {
    const [search, setSearch] = useState("");
    const [comment, setComment] = useState("");
    const { toasts, push: pushToast, dismiss: dismissToast } = useEcToast();

    const {
        barcodeMode,
        cameraOpen,
        setCameraOpen,
        barcodeInputRef,
        searchInputRef,
        toggleBarcodeMode,
        openCamera,
        processBarcode,
        wedgeHandlers,
    } = usePurchaseBarcodeMode({ products, form, setForm, pushToast });

    const totals = useMemo(() => computePurchaseTotals(form), [form]);

    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return products.filter((p) => productMatchesQuery(p, q)).slice(0, 8);
    }, [products, search]);

    const addProduct = (p) => {
        const exists = form.lines.some(
            (l) => String(l.productId) === String(p._id) && !l.variantBarcode
        );
        if (exists) {
            pushToast("info", `${p.title} zaten listede`);
            return;
        }
        setForm({
            ...form,
            lines: [
                ...form.lines,
                {
                    productId: p._id,
                    variantBarcode: "",
                    title: p.title,
                    quantity: 1,
                    unitCost: Number(p.costPrice ?? p.price ?? 0),
                },
            ],
        });
        setSearch("");
        pushToast("success", `${p.title} listeye eklendi`);
    };

    const updateLine = (idx, patch) => {
        const lines = form.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
        setForm({ ...form, lines });
    };

    const removeLine = (idx) => {
        setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
    };

    const addAdjustment = () => {
        setForm({
            ...form,
            adjustments: [...form.adjustments, { label: "İndirim", amount: 0 }],
        });
    };

    const updateAdjustment = (idx, patch) => {
        setForm({
            ...form,
            adjustments: form.adjustments.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
        });
    };

    const removeAdjustment = (idx) => {
        setForm({ ...form, adjustments: form.adjustments.filter((_, i) => i !== idx) });
    };

    const sendComment = () => {
        const text = comment.trim();
        if (!text) return;
        setForm({
            ...form,
            timeline: [
                ...form.timeline,
                {
                    text,
                    authorName: "Siz",
                    createdAt: new Date().toISOString(),
                },
            ],
        });
        setComment("");
    };

    const branchOptions = storeName ? [storeName] : ["Merkez Depo"];

    return (
        <>
            <EcToast toasts={toasts} onDismiss={dismissToast} />
            <EcBarcodeCameraModal
                open={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onDetected={processBarcode}
            />

            <Section title="Temel Bilgi">
                <div className="ec-prod-grid ec-purchase-grid--2">
                    <div className="ec-prod-field">
                        <EcFieldLabel hint={EC_FIELD_HINTS.purchaseSupplier}>Tedarikçi *</EcFieldLabel>
                        <input
                            value={form.supplierName}
                            onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                            placeholder="Tedarikçi adı"
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>Sevk Edilecek Şube *</label>
                        <EcSelect
                            value={form.branchName}
                            onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                        >
                            {branchOptions.map((b) => (
                                <option key={b} value={b}>
                                    {b}
                                </option>
                            ))}
                        </EcSelect>
                    </div>
                    <div className="ec-prod-field">
                        <label>Referans Numarası *</label>
                        <input
                            value={form.referenceNumber}
                            onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                            placeholder="REF-001"
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>Para Birimi *</label>
                        <EcSelect
                            value={form.currency}
                            onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        >
                            {PURCHASE_CURRENCIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </EcSelect>
                    </div>
                </div>
            </Section>

            <Section title="Kargo Detayları">
                <div className="ec-prod-grid">
                    <div className="ec-prod-field">
                        <label>Beklenen Sevk Tarihi</label>
                        <input
                            type="date"
                            value={form.expectedShipmentAt}
                            onChange={(e) => setForm({ ...form, expectedShipmentAt: e.target.value })}
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>Takip Numarası</label>
                        <input
                            value={form.trackingNumber}
                            onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>Kargo Firması</label>
                        <input
                            value={form.shippingCompany}
                            onChange={(e) => setForm({ ...form, shippingCompany: e.target.value })}
                        />
                    </div>
                </div>
            </Section>

            <Section
                title="Ürün Ekle"
                extra={
                    <div className="ec-purchase-scan-actions">
                        <button
                            type="button"
                            className="ec-prod-icon-btn ec-purchase-camera-btn"
                            title="Kamera ile okut"
                            onClick={openCamera}
                        >
                            <FaCamera />
                        </button>
                        <button
                            type="button"
                            className={`ec-prod-btn ec-purchase-scan-btn${barcodeMode ? " ec-purchase-scan-btn--active" : ""}`}
                            onClick={toggleBarcodeMode}
                        >
                            <FaBarcode /> {barcodeMode ? "Barkod Modu Açık" : "Barkod ile Okut"}
                        </button>
                    </div>
                }
            >
                {barcodeMode && (
                    <p className="ec-purchase-barcode-banner">
                        Barkod modu aktif — USB okuyucu ile okutun; Enter gerekmez. Kamera veya fotoğraf
                        için yan taraftaki simgeyi kullanın.
                    </p>
                )}

                <input
                    ref={barcodeInputRef}
                    type="text"
                    className="ec-purchase-barcode-capture"
                    tabIndex={barcodeMode ? 0 : -1}
                    aria-label="Barkod okuyucu girişi"
                    autoComplete="off"
                    {...(barcodeMode ? wedgeHandlers : {})}
                />

                <div className={`ec-purchase-product-search${barcodeMode ? " ec-purchase-product-search--scan" : ""}`}>
                    <FaSearch className="ec-purchase-product-search__icon" />
                    <input
                        ref={searchInputRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key !== "Enter" || !search.trim()) return;
                            const exact = normalizeScanCode(search);
                            if (exact.length < 3) return;
                            e.preventDefault();
                            if (processBarcode(exact)) setSearch("");
                        }}
                        placeholder={barcodeMode ? "Barkod okutun veya ürün ara…" : "Ürün ara..."}
                    />
                    {searchResults.length > 0 && (
                        <ul className="ec-purchase-product-suggest">
                            {searchResults.map((p) => (
                                <li key={p._id}>
                                    <button type="button" onClick={() => addProduct(p)}>
                                        <span>{p.title}</span>
                                        {p.barcode && (
                                            <small className="ec-purchase-suggest-code">{p.barcode}</small>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {form.lines.length > 0 ? (
                    <table className="ec-prod-table ec-purchase-lines-table">
                        <thead>
                            <tr>
                                <th>Ürün</th>
                                <th>Adet</th>
                                <th>Birim maliyet</th>
                                <th>Toplam</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {form.lines.map((line, idx) => (
                                <tr key={`${line.productId || line.title}-${idx}`}>
                                    <td>{line.title}</td>
                                    <td>
                                        <input
                                            type="number"
                                            min="1"
                                            className="ec-purchase-line-input"
                                            value={line.quantity}
                                            onChange={(e) =>
                                                updateLine(idx, { quantity: Number(e.target.value) })
                                            }
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="ec-purchase-line-input"
                                            value={line.unitCost}
                                            onChange={(e) =>
                                                updateLine(idx, { unitCost: Number(e.target.value) })
                                            }
                                        />
                                    </td>
                                    <td>{fmtMoney(lineTotal(line), form.currency)}</td>
                                    <td>
                                        <button
                                            type="button"
                                            className="ec-prod-icon-btn"
                                            aria-label="Kaldır"
                                            onClick={() => removeLine(idx)}
                                        >
                                            <FaTimes />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="ec-purchase-lines-hint">
                        Ürün eklemek için arayın, barkod okutun veya kamera ile okuyun.
                    </p>
                )}
            </Section>

            <div className="ec-purchase-lower">
                <Section title="Zaman Çizelgesi">
                    <div className="ec-purchase-timeline-compose">
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Yorum yaz..."
                            rows={3}
                        />
                        <div className="ec-purchase-timeline-compose__actions">
                            <span className="ec-purchase-timeline-compose__icons">@ #</span>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                disabled={!comment.trim()}
                                onClick={sendComment}
                            >
                                Gönder
                            </button>
                        </div>
                        <p className="ec-purchase-timeline-privacy">
                            <FaLock /> Yorumları sadece siz ve diğer personel görebilir
                        </p>
                    </div>
                    {form.timeline.length === 0 ? (
                        <div className="ec-purchase-timeline-empty">
                            <FaBolt />
                            <span>Veri Yok</span>
                        </div>
                    ) : (
                        <ul className="ec-purchase-timeline-list">
                            {form.timeline.map((entry, i) => (
                                <li key={i}>
                                    <strong>{entry.authorName || "Kullanıcı"}</strong>
                                    <span>
                                        {entry.createdAt
                                            ? new Date(entry.createdAt).toLocaleString("tr-TR")
                                            : ""}
                                    </span>
                                    <p>{entry.text}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>

                <aside className="ec-prod-section ec-purchase-summary">
                    <h3>
                        Sipariş Özeti <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                    </h3>
                    <dl className="ec-purchase-summary__rows">
                        <div>
                            <dt>KDV</dt>
                            <dd>{fmtMoney(totals.vatAmount, form.currency)}</dd>
                        </div>
                        <div>
                            <dt>Ara Toplam</dt>
                            <dd>{fmtMoney(totals.subtotal, form.currency)}</dd>
                        </div>
                        <div className="ec-purchase-summary__row--action">
                            <dt>Kargo</dt>
                            <dd>
                                {form.showShipping ? (
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="ec-purchase-line-input"
                                        value={form.shippingCost}
                                        onChange={(e) =>
                                            setForm({ ...form, shippingCost: Number(e.target.value) })
                                        }
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className="ec-purchase-summary__link"
                                        onClick={() => setForm({ ...form, showShipping: true, shippingCost: 0 })}
                                    >
                                        Kargo Ücreti Ekle
                                    </button>
                                )}
                            </dd>
                        </div>
                        <div className="ec-purchase-summary__row--action">
                            <dt>Fiyat Düzenlemeleri</dt>
                            <dd>
                                <button
                                    type="button"
                                    className="ec-purchase-summary__link"
                                    onClick={addAdjustment}
                                >
                                    + Ekle
                                </button>
                            </dd>
                        </div>
                    </dl>
                    {form.adjustments.length > 0 && (
                        <ul className="ec-purchase-adjustments">
                            {form.adjustments.map((adj, idx) => (
                                <li key={idx}>
                                    <input
                                        value={adj.label}
                                        onChange={(e) => updateAdjustment(idx, { label: e.target.value })}
                                        placeholder="Açıklama"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={adj.amount}
                                        onChange={(e) =>
                                            updateAdjustment(idx, { amount: Number(e.target.value) })
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="ec-prod-icon-btn"
                                        onClick={() => removeAdjustment(idx)}
                                    >
                                        <FaTimes />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="ec-purchase-summary__total">
                        <span>Toplam</span>
                        <strong>{fmtMoney(totals.total, form.currency)}</strong>
                    </div>
                </aside>
            </div>
        </>
    );
};

export default PurchaseFormSections;
