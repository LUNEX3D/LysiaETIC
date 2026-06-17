import React, { useState, useEffect, useMemo } from "react";
import { FaTimes, FaSearch, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { fetchStoreCategories, createStoreCategory } from "../../../services/storeApi";

const TreeRows = ({ nodes, depth, expanded, selected, onToggleExpand, onToggleSelect, parentName }) =>
    nodes.map((node) => {
        const id = String(node._id);
        const hasChildren = node.children?.length > 0;
        const isOpen = expanded.has(id);
        const checked = selected.has(id);
        return (
            <React.Fragment key={id}>
                <label
                    className={`ec-prod-cat-modal-row ${checked ? "ec-prod-cat-modal-row--checked" : ""}`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            className="ec-prod-cat-modal-row__chev"
                            onClick={(e) => {
                                e.preventDefault();
                                onToggleExpand(id);
                            }}
                        >
                            {isOpen ? <FaChevronDown /> : <FaChevronRight />}
                        </button>
                    ) : (
                        <span className="ec-prod-cat-modal-row__chev-spacer" />
                    )}
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleSelect(node)}
                    />
                    <span className="ec-prod-cat-modal-row__text">
                        <strong>{node.name}</strong>
                        {parentName || node.parentName ? (
                            <small>{parentName || node.parentName}</small>
                        ) : null}
                    </span>
                </label>
                {hasChildren && isOpen && (
                    <TreeRows
                        nodes={node.children}
                        depth={depth + 1}
                        expanded={expanded}
                        selected={selected}
                        onToggleExpand={onToggleExpand}
                        onToggleSelect={onToggleSelect}
                        parentName={node.name}
                    />
                )}
            </React.Fragment>
        );
    });

const ProductCategoryModal = ({ onClose, onSave, assigned = [] }) => {
    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState([]);
    const [flat, setFlat] = useState([]);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(new Set());
    const [selected, setSelected] = useState(() => new Set(assigned.map((a) => String(a.categoryId))));
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetchStoreCategories();
                if (!cancelled) {
                    setTree(res.tree || []);
                    setFlat(res.flat || []);
                    setExpanded(new Set((res.flat || []).filter((c) => !c.parentId).map((c) => String(c._id))));
                }
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.error || "Kategoriler yüklenemedi");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredFlat = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return flat.filter(
            (c) =>
                c.name?.toLowerCase().includes(q) ||
                c.path?.toLowerCase().includes(q) ||
                c.parentName?.toLowerCase().includes(q)
        );
    }, [flat, search]);

    const toggleExpand = (id) => {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpanded(next);
    };

    const toggleSelect = (node) => {
        const id = String(node._id);
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const handleNew = async () => {
        const name = window.prompt("Yeni kategori adı");
        if (!name?.trim()) return;
        setCreating(true);
        try {
            const res = await createStoreCategory({ name: name.trim() });
            if (res.category) {
                const reload = await fetchStoreCategories();
                setTree(reload.tree || []);
                setFlat(reload.flat || []);
                setSelected((prev) => new Set([...prev, String(res.category._id)]));
            }
        } catch (e) {
            setError(e.response?.data?.error || "Kategori oluşturulamadı");
        } finally {
            setCreating(false);
        }
    };

    const handleSave = () => {
        const picked = flat
            .filter((c) => selected.has(String(c._id)))
            .map((c) => ({
                categoryId: String(c._id),
                name: c.name,
                path: c.path,
                isPrimary: false,
            }));
        onSave(picked);
        onClose();
    };

    const selectedCount = selected.size;

    return (
        <div className="ec-prod-modal-backdrop" onClick={onClose}>
            <div className="ec-prod-modal ec-prod-modal--categories" onClick={(e) => e.stopPropagation()}>
                <div className="ec-prod-modal__head">
                    <h2>Kategori Ekle</h2>
                    <button type="button" className="ec-prod-modal__close" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </div>

                <div className="ec-prod-cf-modal-toolbar">
                    <label className="ec-prod-search ec-prod-cf-search">
                        <FaSearch />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara" />
                    </label>
                    <button type="button" className="ec-prod-btn" disabled={creating} onClick={handleNew}>
                        Yeni Ekle
                    </button>
                </div>

                {error && <div className="ec-prod-form-error" style={{ padding: "0 1.15rem" }}>{error}</div>}

                <div className="ec-prod-cf-modal-list">
                    {loading ? (
                        <p className="ec-prod-muted" style={{ padding: "1.5rem", textAlign: "center" }}>
                            Yükleniyor…
                        </p>
                    ) : search.trim() ? (
                        filteredFlat.length === 0 ? (
                            <p className="ec-prod-muted" style={{ padding: "1.5rem", textAlign: "center" }}>
                                Sonuç bulunamadı.
                            </p>
                        ) : (
                            filteredFlat.map((node) => {
                                const id = String(node._id);
                                const checked = selected.has(id);
                                return (
                                    <label
                                        key={id}
                                        className={`ec-prod-cat-modal-row ${checked ? "ec-prod-cat-modal-row--checked" : ""}`}
                                    >
                                        <span className="ec-prod-cat-modal-row__chev-spacer" />
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleSelect(node)}
                                        />
                                        <span className="ec-prod-cat-modal-row__text">
                                            <strong>{node.name}</strong>
                                            <small>{node.parentName || node.path}</small>
                                        </span>
                                    </label>
                                );
                            })
                        )
                    ) : tree.length === 0 ? (
                        <p className="ec-prod-muted" style={{ padding: "1.5rem", textAlign: "center" }}>
                            Henüz kategori yok. Tanımlamalar → Kategoriler veya Yeni Ekle ile oluşturun.
                        </p>
                    ) : (
                        <TreeRows
                            nodes={tree}
                            depth={0}
                            expanded={expanded}
                            selected={selected}
                            onToggleExpand={toggleExpand}
                            onToggleSelect={toggleSelect}
                        />
                    )}
                </div>

                <div className="ec-prod-cf-modal-footer ec-prod-cat-modal-footer">
                    <span className="ec-prod-muted">{selectedCount} Seçili</span>
                    <div className="ec-prod-cat-modal-footer__actions">
                        <button type="button" className="ec-prod-btn" onClick={onClose}>
                            Vazgeç
                        </button>
                        <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={handleSave}>
                            Kaydet
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductCategoryModal;
