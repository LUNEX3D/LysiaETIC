import React, { useMemo, useState } from "react";
import {
    FaInfoCircle,
    FaSearch,
    FaBarcode,
    FaCamera,
    FaUpload,
    FaLock,
    FaTimes,
    FaBolt,
} from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcFieldLabel from "../../../components/ecommerce/EcFieldLabel";
import { EC_FIELD_HINTS } from "../../../constants/ecFieldHints";
import { normalizeScanCode, lineIdentity } from "../../../components/ecommerce/barcode/productBarcodeUtils";
import { useTransferBarcodeMode } from "./useTransferBarcodeMode";
import EcToast, { useEcToast } from "../../../components/ecommerce/EcToast";
import EcBarcodeCameraModal from "../../../components/ecommerce/barcode/EcBarcodeCameraModal";
import TransferCustomizeModal from "./TransferCustomizeModal";
import { buildBranchOptions, getProductStock } from "./transferFormUtils";

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

function productMatchesFilters(p, filters) {
    if (filters.categoryId) {
        const ok = (p.productCategories || []).some(
            (c) => String(c.categoryId) === String(filters.categoryId)
        );
        if (!ok) return false;
    }
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.tag && !(p.tags || []).includes(filters.tag)) return false;
    return true;
}

const TransferFormSections = ({ form, setForm, storeName, products, categories, onNavigate }) => {
    const [search, setSearch] = useState("");
    const [comment, setComment] = useState("");
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const { toasts, push: pushToast, dismiss: dismissToast } = useEcToast();

    const branches = useMemo(() => buildBranchOptions(storeName, products), [storeName, products]);

    const {
        barcodeMode,
        cameraOpen,
        setCameraOpen,
        barcodeInputRef,
        toggleBarcodeMode,
        openCamera,
        processBarcode,
        wedgeHandlers,
    } = useTransferBarcodeMode({ products, form, setForm, pushToast });

    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return products.filter((p) => productMatchesQuery(p, q)).slice(0, 8);
    }, [products, search]);

    const addProductLine = (p) => {
        const id = lineIdentity(p._id, "");
        if (form.lines.some((l) => lineIdentity(l.productId, l.variantBarcode) === id)) {
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
                    fromBranchStock: getProductStock(p),
                    quantity: 1,
                },
            ],
        });
        setSearch("");
        pushToast("success", `${p.title} eklendi`);
    };

    const runImport = (filters) => {
        const matched = products.filter((p) => productMatchesFilters(p, filters));
        if (!matched.length) {
            pushToast("error", "Filtrelere uyan ürün bulunamadı");
            return;
        }
        let added = 0;
        setForm((prev) => {
            const lines = [...prev.lines];
            for (const p of matched) {
                const id = lineIdentity(p._id, "");
                if (lines.some((l) => lineIdentity(l.productId, l.variantBarcode) === id)) continue;
                lines.push({
                    productId: p._id,
                    variantBarcode: "",
                    title: p.title,
                    fromBranchStock: getProductStock(p),
                    quantity: 1,
                });
                added += 1;
            }
            return { ...prev, lines, importFilters: filters };
        });
        pushToast("success", `${added} ürün içe aktarıldı`);
    };

    const updateLine = (idx, patch) => {
        setForm({ ...form, lines: form.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) });
    };

    const removeLine = (idx) => {
        setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
    };

    const sendComment = () => {
        const text = comment.trim();
        if (!text) return;
        setForm({
            ...form,
            timeline: [
                ...form.timeline,
                { text, authorName: "Siz", createdAt: new Date().toISOString() },
            ],
        });
        setComment("");
    };

    return (
        <>
            <EcToast toasts={toasts} onDismiss={dismissToast} />
            <EcBarcodeCameraModal
                open={cameraOpen}
                onClose={() => setCameraOpen(false)}
                onDetected={processBarcode}
            />
            <TransferCustomizeModal
                open={customizeOpen}
                onClose={() => setCustomizeOpen(false)}
                categories={categories}
                products={products}
                initial={form.importFilters}
                onSave={runImport}
            />

            <Section title="Transfer Detay">
                <div className="ec-prod-grid">
                    <div className="ec-prod-field ec-prod-field--full">
                        <label>İrsaliye No *</label>
                        <input
                            value={form.waybillNumber}
                            onChange={(e) => setForm({ ...form, waybillNumber: e.target.value })}
                        />
                    </div>
                    <div className="ec-prod-field">
                        <EcFieldLabel hint={EC_FIELD_HINTS.transferFromBranch}>Çıkış Şubesi *</EcFieldLabel>
                        <EcSelect
                            value={form.fromBranch}
                            onChange={(e) => setForm({ ...form, fromBranch: e.target.value })}
                        >
                            {branches.map((b) => (
                                <option key={b} value={b}>
                                    {b}
                                </option>
                            ))}
                        </EcSelect>
                    </div>
                    <div className="ec-prod-field">
                        <EcFieldLabel hint={EC_FIELD_HINTS.transferToBranch}>Giriş Şubesi *</EcFieldLabel>
                        <EcSelect
                            value={form.toBranch}
                            onChange={(e) => setForm({ ...form, toBranch: e.target.value })}
                        >
                            <option value="">Şube seçin</option>
                            {branches
                                .filter((b) => b !== form.fromBranch)
                                .map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                        </EcSelect>
                    </div>
                </div>
            </Section>

            <Section
                title="Ürünler"
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
                            <FaBarcode /> Barkod ile Okut
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn"
                            onClick={() => setCustomizeOpen(true)}
                        >
                            <FaUpload /> İçe Aktar
                        </button>
                        <button
                            type="button"
                            className="ec-prod-section-link"
                            onClick={() => onNavigate?.("ec-product-add-simple")}
                        >
                            Yeni Ürün Ekle
                        </button>
                    </div>
                }
            >
                {barcodeMode && (
                    <p className="ec-purchase-barcode-banner">
                        Barkod modu aktif — USB okuyucu ile okutun; Enter gerekmez.
                    </p>
                )}

                <input
                    ref={barcodeInputRef}
                    type="text"
                    className="ec-purchase-barcode-capture"
                    tabIndex={barcodeMode ? 0 : -1}
                    aria-label="Barkod okuyucu"
                    autoComplete="off"
                    {...(barcodeMode ? wedgeHandlers : {})}
                />

                <div className={`ec-purchase-product-search${barcodeMode ? " ec-purchase-product-search--scan" : ""}`}>
                    <FaSearch className="ec-purchase-product-search__icon" />
                    <input
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
                                    <button type="button" onClick={() => addProductLine(p)}>
                                        {p.title}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <table className="ec-prod-table ec-purchase-lines-table ec-transfer-lines-table">
                    <thead>
                        <tr>
                            <th>Ürün</th>
                            <th>Çıkış Şube Stoğu</th>
                            <th>Transfer Adedi</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {form.lines.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="ec-purchase-lines-hint">
                                    Ürün eklemek için barkod okutun, içe aktarın veya arayın.
                                </td>
                            </tr>
                        ) : (
                            form.lines.map((line, idx) => (
                                <tr key={`${line.productId}-${line.variantBarcode}-${idx}`}>
                                    <td>{line.title}</td>
                                    <td>{line.fromBranchStock ?? 0} adet</td>
                                    <td>
                                        <input
                                            type="number"
                                            min="0"
                                            className="ec-purchase-line-input"
                                            value={line.quantity}
                                            onChange={(e) =>
                                                updateLine(idx, { quantity: Number(e.target.value) })
                                            }
                                        />
                                    </td>
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
                            ))
                        )}
                    </tbody>
                </table>
            </Section>

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
        </>
    );
};

export default TransferFormSections;
