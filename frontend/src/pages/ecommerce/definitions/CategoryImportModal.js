import React, { useRef, useState } from "react";
import { FaTimes, FaUpload, FaDownload } from "react-icons/fa";
import { createStoreCategory, fetchStoreCategories } from "../../../services/storeApi";

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const split = (line) => {
        if (line.includes(";")) return line.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
        return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    };
    const headers = split(lines[0]).map((h) => h.toLowerCase());
    const nameIdx = headers.indexOf("name");
    const parentIdx = headers.indexOf("parent_path");
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
        const cols = split(lines[i]);
        rows.push({
            name: cols[nameIdx >= 0 ? nameIdx : 0],
            parentPath: parentIdx >= 0 ? cols[parentIdx] : "",
        });
    }
    return rows.filter((r) => r.name?.trim());
}

const CategoryImportModal = ({ open, onClose, onDone }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef(null);

    if (!open) return null;

    const handleImport = async () => {
        if (!file) {
            setError("Lütfen bir CSV dosyası seçin");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const text = await file.text();
            const rows = parseCsv(text);
            if (!rows.length) {
                setError("Dosyada geçerli satır bulunamadı");
                return;
            }
            const existing = await fetchStoreCategories();
            const flat = existing.flat || [];
            const pathToId = new Map(flat.map((c) => [c.path, String(c._id)]));
            let added = 0;
            for (const row of rows) {
                let parentId = null;
                if (row.parentPath?.trim()) {
                    parentId = pathToId.get(row.parentPath.trim()) || null;
                }
                const res = await createStoreCategory({ name: row.name.trim(), parentId });
                if (res.category) {
                    pathToId.set(res.category.path, String(res.category._id));
                    added += 1;
                }
            }
            onDone?.(added);
            onClose();
        } catch (e) {
            setError(e.response?.data?.error || "İçe aktarma başarısız");
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const csv = "name,parent_path,type,slug\nÖrnek Kategori,,\nAlt Kategori,Örnek Kategori,";
        const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "kategori-sablon.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="ec-prod-modal-backdrop" role="dialog" aria-modal="true">
            <div className="ec-prod-modal ec-prod-modal--io" onClick={(e) => e.stopPropagation()}>
                <header className="ec-prod-modal__head">
                    <h2>Kategorileri İçeri Aktar</h2>
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
                    <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <button type="button" className="ec-cat-template-link" onClick={downloadTemplate}>
                        <FaDownload /> Şablon dosya indir
                    </button>
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

export default CategoryImportModal;
