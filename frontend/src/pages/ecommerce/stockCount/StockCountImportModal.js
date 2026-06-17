import React, { useRef, useState } from "react";
import { FaTimes, FaUpload } from "react-icons/fa";
import { normalizeScanCode, lineIdentity } from "../../../components/ecommerce/barcode/productBarcodeUtils";
import { buildCountLineFromProduct } from "./stockCountFormUtils";

function parseCsvRows(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return [];

    const split = (line) => {
        if (line.includes(";")) return line.split(";").map((c) => c.trim());
        return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    };

    const headers = split(lines[0]).map((h) => h.toLowerCase());
    const codeIdx = headers.findIndex((h) =>
        ["barkod", "barcode", "sku", "stok kodu", "stok_kodu"].includes(h)
    );
    const qtyIdx = headers.findIndex((h) =>
        ["sayılan", "sayilan", "adet", "miktar", "counted", "countedqty", "counted_qty"].includes(h)
    );

    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
        const cols = split(lines[i]);
        if (!cols.some(Boolean)) continue;
        const code = codeIdx >= 0 ? cols[codeIdx] : cols[0];
        const qtyRaw = qtyIdx >= 0 ? cols[qtyIdx] : cols[1];
        rows.push({ code, qty: Number(qtyRaw) || 0 });
    }
    return rows;
}

function findProductByCode(products, code) {
    const key = normalizeScanCode(code);
    if (!key) return null;
    for (const p of products || []) {
        if (normalizeScanCode(p.barcode) === key || normalizeScanCode(p.sku) === key) {
            return { product: p, variant: null };
        }
        for (const v of p.variants || []) {
            if (normalizeScanCode(v.barcode) === key || normalizeScanCode(v.sku) === key) {
                return { product: p, variant: v };
            }
        }
    }
    return null;
}

const StockCountImportModal = ({ open, onClose, products, locationName, existingLines, onImport }) => {
    const [file, setFile] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const fileRef = useRef(null);

    if (!open) return null;

    const onFileChange = (e) => {
        setFile(e.target.files?.[0] || null);
        setError("");
    };

    const handleImport = async () => {
        if (!file) {
            setError("Lütfen bir CSV veya XLSX dosyası seçin");
            return;
        }
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext !== "csv") {
            setError("Şimdilik yalnızca CSV dosyası destekleniyor");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const text = await file.text();
            const rows = parseCsvRows(text);
            if (!rows.length) {
                setError("Dosyada geçerli satır bulunamadı");
                return;
            }

            const existing = new Set(
                existingLines.map((l) => lineIdentity(l.productId, l.variantBarcode))
            );
            const added = [];
            const skipped = [];

            for (const row of rows) {
                const hit = findProductByCode(products, row.code);
                if (!hit) {
                    skipped.push(row.code);
                    continue;
                }
                const line = buildCountLineFromProduct(hit.product, hit.variant, locationName);
                line.countedQty = row.qty;
                const id = lineIdentity(line.productId, line.variantBarcode);
                if (existing.has(id)) continue;
                existing.add(id);
                added.push(line);
            }

            if (!added.length) {
                setError("Eşleşen ürün bulunamadı. Barkod veya SKU sütununu kontrol edin.");
                return;
            }

            onImport(added, { skipped: skipped.length });
            setFile(null);
            onClose();
        } catch {
            setError("Dosya okunamadı");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ec-prod-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ec-prod-modal ec-prod-modal--io" onClick={(e) => e.stopPropagation()}>
                <header className="ec-prod-modal__head">
                    <h2>Ürün Stok Sayımı İçe Aktar</h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-prod-io-body">
                    {error && <div className="ec-prod-form-error">{error}</div>}
                    <div
                        className="ec-prod-io-dropzone"
                        role="button"
                        tabIndex={0}
                        onClick={() => fileRef.current?.click()}
                        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                    >
                        <FaUpload />
                        <p>
                            <strong>Dosya yüklemek için tıklayın ya da dosyayı bu alana sürükleyin</strong>
                        </p>
                        <p className="ec-prod-io-hint">CSV ya da XLSX dosyası olarak içe aktarın.</p>
                        {file && <p className="ec-prod-io-filename">{file.name}</p>}
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        hidden
                        onChange={onFileChange}
                    />
                </div>
                <footer className="ec-prod-io-footer">
                    <button type="button" className="ec-prod-btn" onClick={onClose} disabled={loading}>
                        Kapat
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={handleImport}
                        disabled={loading}
                    >
                        {loading ? "Aktarılıyor…" : "İçe Aktar"}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default StockCountImportModal;
