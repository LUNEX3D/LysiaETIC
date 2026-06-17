import React, { useState, useEffect, useMemo } from "react";
import { FaTimes, FaSearch } from "react-icons/fa";
import { fetchStoreCustomFields, createStoreCustomField } from "../../../services/storeApi";
import { getCustomFieldTypeLabel, getCustomFieldTypeMeta } from "../definitions/customFieldFormUtils";
const ProductCustomFieldsModal = ({ onClose, onSave, assignedFieldIds = [] }) => {
    const [loading, setLoading] = useState(true);
    const [definitions, setDefinitions] = useState([]);
    const [selected, setSelected] = useState(() => new Set(assignedFieldIds.map(String)));
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetchStoreCustomFields();
                if (!cancelled) setDefinitions(res.fields || []);
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.error || "Alanlar yüklenemedi");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return definitions;
        return definitions.filter(
            (d) =>
                d.name?.toLowerCase().includes(q) ||
                d.type?.toLowerCase().includes(q) ||
                d.key?.toLowerCase().includes(q)
        );
    }, [definitions, search]);

    const toggle = (id) => {
        const next = new Set(selected);
        const key = String(id);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelected(next);
    };

    const handleNew = async () => {
        const name = window.prompt("Yeni özel alan adı");
        if (!name?.trim()) return;
        setCreating(true);
        setError("");
        try {
            const res = await createStoreCustomField({ name: name.trim(), type: "html" });
            if (res.field) {
                setDefinitions((prev) => [...prev, res.field].sort((a, b) => a.sortOrder - b.sortOrder));
                setSelected((prev) => new Set([...prev, String(res.field._id)]));
            }
        } catch (e) {
            setError(e.response?.data?.error || "Alan oluşturulamadı");
        } finally {
            setCreating(false);
        }
    };

    const handleSave = () => {
        const picked = definitions.filter((d) => selected.has(String(d._id)));
        onSave(picked);
        onClose();
    };

    return (
        <div className="ec-prod-modal-backdrop" onClick={onClose}>
            <div className="ec-prod-modal ec-prod-modal--custom-fields" onClick={(e) => e.stopPropagation()}>
                <div className="ec-prod-modal__head">
                    <h2>Özel Alan Ekle</h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </div>

                <div className="ec-prod-cf-modal-toolbar">
                    <label className="ec-prod-search ec-prod-cf-search">
                        <FaSearch />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Ara"
                        />
                    </label>
                    <button
                        type="button"
                        className="ec-prod-btn"
                        disabled={creating}
                        onClick={handleNew}
                    >
                        Yeni Ekle
                    </button>
                </div>

                {error && <div className="ec-prod-form-error" style={{ padding: "0 1.15rem" }}>{error}</div>}

                <div className="ec-prod-cf-modal-list">
                    {loading ? (
                        <p className="ec-prod-muted" style={{ padding: "1.5rem", textAlign: "center" }}>
                            Yükleniyor…
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="ec-prod-muted" style={{ padding: "1.5rem", textAlign: "center" }}>
                            Sonuç bulunamadı.
                        </p>
                    ) : (
                        filtered.map((def) => {
                            const id = String(def._id);
                            const checked = selected.has(id);
                            const typeMeta = getCustomFieldTypeMeta(def.type);
                            const TypeIcon = typeMeta?.Icon;
                            return (
                                <label
                                    key={id}
                                    className={`ec-prod-cf-row ${checked ? "ec-prod-cf-row--checked" : ""}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggle(id)}
                                    />
                                    <span className="ec-prod-cf-row__icon">
                                        {TypeIcon ? <TypeIcon /> : null}
                                    </span>
                                    <span className="ec-prod-cf-row__text">
                                        <strong>{def.name}</strong>
                                        <small>{getCustomFieldTypeLabel(def.type)}</small>
                                    </span>
                                </label>
                            );
                        })
                    )}
                </div>

                <div className="ec-prod-cf-modal-footer">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Vazgeç
                    </button>
                    <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={handleSave}>
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductCustomFieldsModal;
