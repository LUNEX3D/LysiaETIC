import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaArrowLeft,
    FaInfoCircle,
    FaSearch,
    FaBarcode,
    FaCamera,
    FaUpload,
} from "react-icons/fa";
import {
    fetchStore,
    fetchStoreProducts,
    fetchStoreStockCount,
    patchStoreStockCount,
    createStoreStockCount,
} from "../../../services/storeApi";
import EcToast, { useEcToast } from "../../../components/ecommerce/EcToast";
import EcBarcodeCameraModal from "../../../components/ecommerce/barcode/EcBarcodeCameraModal";
import {
    normalizeScanCode,
    lineIdentity,
} from "../../../components/ecommerce/barcode/productBarcodeUtils";
import { useStockCountBarcodeMode } from "./useStockCountBarcodeMode";
import {
    stockCountToForm,
    formToStockCountPayload,
    buildCountLineFromProduct,
    loadStockCountDraft,
    clearStockCountDraft,
} from "./stockCountFormUtils";
import StockCountProductPickerModal from "./StockCountProductPickerModal";
import StockCountImportModal from "./StockCountImportModal";

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

const EcommerceStockCountWorkPage = ({ countId, onNavigate }) => {
    const isNew = countId === "new";
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(() => stockCountToForm(null));
    const [search, setSearch] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const { toasts, push: pushToast, dismiss: dismissToast } = useEcToast();

    const {
        barcodeMode,
        cameraOpen,
        setCameraOpen,
        barcodeInputRef,
        toggleBarcodeMode,
        openCamera,
        processBarcode,
        wedgeHandlers,
    } = useStockCountBarcodeMode({ products, form, setForm, pushToast });

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const storeRes = await fetchStore();
            if (!storeRes.store) {
                setError("Mağaza yok");
                return;
            }
            const prodRes = await fetchStoreProducts();
            setProducts(prodRes.products || []);

            if (isNew) {
                const draft = loadStockCountDraft();
                if (!draft) {
                    setError("Sayım oturumu bulunamadı. Lütfen yeniden başlatın.");
                    return;
                }
                setForm(stockCountToForm(draft, draft.locationName));
                return;
            }

            const countRes = await fetchStoreStockCount(countId);
            setForm(stockCountToForm(countRes.stockCount));
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, [countId, isNew]);

    useEffect(() => {
        load();
    }, [load]);

    const filteredLines = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return form.lines;
        return form.lines.filter((l) => l.title?.toLowerCase().includes(q));
    }, [form.lines, search]);

    const searchResults = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return products.filter((p) => productMatchesQuery(p, q)).slice(0, 8);
    }, [products, search]);

    const addLineToForm = (line, actionText) => {
        setForm((prev) => ({
            ...prev,
            lines: [...prev.lines, line],
            recentActions: [
                { text: actionText || `${line.title} listeye eklendi`, createdAt: new Date().toISOString() },
                ...prev.recentActions,
            ].slice(0, 30),
        }));
    };

    const addProductFromSearch = (p) => {
        const id = lineIdentity(p._id, "");
        if (form.lines.some((l) => lineIdentity(l.productId, l.variantBarcode) === id)) {
            pushToast("info", `${p.title} zaten listede`);
            return;
        }
        const line = buildCountLineFromProduct(p, null, form.locationName);
        line.countedQty = 1;
        addLineToForm(line);
        setSearch("");
        pushToast("success", `${p.title} listeye eklendi`);
    };

    const handlePickerAdd = (line) => {
        const id = lineIdentity(line.productId, line.variantBarcode);
        if (form.lines.some((l) => lineIdentity(l.productId, l.variantBarcode) === id)) return;
        line.countedQty = line.countedQty || 1;
        addLineToForm(line);
        pushToast("success", `${line.title} listeye eklendi`);
    };

    const handleImportLines = (lines, { skipped = 0 } = {}) => {
        setForm((prev) => ({
            ...prev,
            lines: [...prev.lines, ...lines],
            recentActions: [
                {
                    text: `${lines.length} ürün içe aktarıldı${skipped ? ` (${skipped} eşleşmedi)` : ""}`,
                    createdAt: new Date().toISOString(),
                },
                ...prev.recentActions,
            ].slice(0, 30),
        }));
        pushToast("success", `${lines.length} ürün içe aktarıldı`);
    };

    const goBack = () => {
        if (isNew) clearStockCountDraft();
        onNavigate?.("ec-products-stock-count");
    };

    const persist = async (submit) => {
        setSaving(true);
        setError("");
        try {
            if (isNew) {
                const res = await createStoreStockCount(formToStockCountPayload(form, { submit }));
                clearStockCountDraft();
                const id = res.stockCount?._id;
                if (submit) {
                    pushToast("success", "Sayım onaya gönderildi");
                    onNavigate?.("ec-products-stock-count");
                } else {
                    pushToast("success", "Taslak kaydedildi");
                    if (id) onNavigate?.(`ec-stock-count-work-${id}`);
                }
                return;
            }

            await patchStoreStockCount(countId, formToStockCountPayload(form, { submit }));
            if (submit) {
                pushToast("success", "Sayım onaya gönderildi");
                onNavigate?.("ec-products-stock-count");
            } else {
                pushToast("success", "Taslak kaydedildi");
                await load();
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setSaving(false);
        }
    };

    const updateLineQty = (productId, variantBarcode, qty) => {
        const id = `${productId}:${variantBarcode || ""}`;
        setForm((prev) => ({
            ...prev,
            lines: prev.lines.map((l) =>
                `${l.productId}:${l.variantBarcode || ""}` === id
                    ? { ...l, countedQty: qty }
                    : l
            ),
        }));
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={goBack}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <span>Stok Sayımları &gt; Stok Sayımı Ekle</span>
                        </nav>
                    </div>
                    <div className="ec-prod-head-actions">
                        <button
                            type="button"
                            className="ec-prod-btn"
                            disabled={saving || form.lines.length === 0}
                            onClick={() => persist(false)}
                        >
                            Taslak Olarak Kaydet
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            disabled={saving || form.lines.length === 0}
                            onClick={() => persist(true)}
                        >
                            Kaydet ve Onaya Gönder
                        </button>
                    </div>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <EcToast toasts={toasts} onDismiss={dismissToast} />
                <EcBarcodeCameraModal
                    open={cameraOpen}
                    onClose={() => setCameraOpen(false)}
                    onDetected={processBarcode}
                />
                <StockCountProductPickerModal
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    products={products}
                    locationName={form.locationName}
                    existingLines={form.lines}
                    onAdd={handlePickerAdd}
                />
                <StockCountImportModal
                    open={importOpen}
                    onClose={() => setImportOpen(false)}
                    products={products}
                    locationName={form.locationName}
                    existingLines={form.lines}
                    onImport={handleImportLines}
                />

                <div className="ec-prod-form-body ec-stock-count-work">
                    <div className="ec-stock-count-work-main">
                        <section className="ec-prod-section">
                            <div className="ec-prod-section__head">
                                <h3>
                                    Ürünler <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                                </h3>
                                <div className="ec-purchase-scan-actions">
                                    <button
                                        type="button"
                                        className="ec-prod-icon-btn ec-purchase-camera-btn"
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
                                        onClick={() => setImportOpen(true)}
                                    >
                                        <FaUpload /> İçe Aktar
                                    </button>
                                    <button
                                        type="button"
                                        className="ec-prod-section-link"
                                        onClick={() => setPickerOpen(true)}
                                    >
                                        Yeni Ürün Ekle
                                    </button>
                                </div>
                            </div>

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
                                aria-label="Barkod"
                                autoComplete="off"
                                {...(barcodeMode ? wedgeHandlers : {})}
                            />

                            <div
                                className={`ec-purchase-product-search${barcodeMode ? " ec-purchase-product-search--scan" : ""}`}
                            >
                                <FaSearch className="ec-purchase-product-search__icon" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key !== "Enter" || !search.trim()) return;
                                        const code = normalizeScanCode(search);
                                        if (code.length >= 3 && processBarcode(code)) {
                                            setSearch("");
                                            return;
                                        }
                                        if (searchResults.length === 1) {
                                            addProductFromSearch(searchResults[0]);
                                        }
                                    }}
                                    placeholder="Ürün ara..."
                                />
                                {searchResults.length > 0 && (
                                    <ul className="ec-purchase-product-suggest">
                                        {searchResults.map((p) => (
                                            <li key={p._id}>
                                                <button type="button" onClick={() => addProductFromSearch(p)}>
                                                    {p.title}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {form.lines.length === 0 ? (
                                <div className="ec-stock-count-products-empty">
                                    <p>
                                        <strong>Ürünleri Ekleyin</strong>
                                    </p>
                                    <p>Stok sayımına eklediğiniz ürünler burada gözükecek.</p>
                                </div>
                            ) : (
                                <table className="ec-prod-table ec-purchase-lines-table">
                                    <thead>
                                        <tr>
                                            <th>Ürün</th>
                                            <th>Sistem Stoğu</th>
                                            <th>Sayılan</th>
                                            <th>Fark</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLines.map((line) => {
                                            const key = `${line.productId}-${line.variantBarcode}`;
                                            const diff =
                                                Number(line.countedQty || 0) -
                                                Number(line.systemStock || 0);
                                            return (
                                                <tr key={key}>
                                                    <td>{line.title}</td>
                                                    <td>{line.systemStock ?? 0}</td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="ec-purchase-line-input"
                                                            value={line.countedQty}
                                                            onChange={(e) =>
                                                                updateLineQty(
                                                                    line.productId,
                                                                    line.variantBarcode,
                                                                    Number(e.target.value)
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td
                                                        className={
                                                            diff !== 0
                                                                ? "ec-stock-count-diff"
                                                                : ""
                                                        }
                                                    >
                                                        {diff > 0 ? `+${diff}` : diff}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </section>
                    </div>

                    <aside className="ec-prod-section ec-stock-count-actions-panel">
                        <h3>Son Aksiyonlar</h3>
                        {form.recentActions.length === 0 ? (
                            <p className="ec-purchase-lines-hint">Henüz aksiyon yok.</p>
                        ) : (
                            <ul className="ec-stock-count-actions-list">
                                {form.recentActions.map((a, i) => (
                                    <li key={i}>
                                        <span>
                                            {a.createdAt
                                                ? new Date(a.createdAt).toLocaleTimeString("tr-TR")
                                                : ""}
                                        </span>
                                        <p>{a.text}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default EcommerceStockCountWorkPage;
