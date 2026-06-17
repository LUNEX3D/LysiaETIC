import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaSearch, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { fetchStoreCategories } from "../../../services/storeApi";

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

const CampaignCategoryPickerModal = ({ open, onClose, selectedIds = [], onSave }) => {
    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState([]);
    const [flat, setFlat] = useState([]);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(new Set());
    const [selected, setSelected] = useState(() => new Set(selectedIds.map(String)));
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        setSelected(new Set(selectedIds.map(String)));
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetchStoreCategories();
                if (!cancelled) {
                    setTree(res.tree || []);
                    setFlat(res.flat || []);
                    setExpanded(
                        new Set((res.flat || []).filter((c) => !c.parentId).map((c) => String(c._id)))
                    );
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
    }, [open, selectedIds]);

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
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelect = (node) => {
        const id = String(node._id);
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = () => {
        onSave?.([...selected]);
        onClose();
    };

    if (!open) return null;

    return createPortal(
        <div
            className="ec-cart-link-picker-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-cat-picker-title"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="ec-cart-link-picker ec-cart-link-picker--category"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="ec-cart-link-picker__head">
                    <h3 id="campaign-cat-picker-title">Kategori Ekle</h3>
                    <button
                        type="button"
                        className="ec-cart-link-picker__close"
                        onClick={onClose}
                        aria-label="Kapat"
                    >
                        <FaTimes />
                    </button>
                </header>

                <div className="ec-cart-link-picker__toolbar ec-cart-link-picker__toolbar--solo">
                    <label className="ec-cart-link-picker__search">
                        <FaSearch aria-hidden="true" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Kategori ara"
                            autoFocus
                        />
                    </label>
                </div>

                <div className="ec-cart-link-picker__body ec-cart-link-picker__body--tree">
                    {error && <p className="ec-purchase-form-error">{error}</p>}
                    {loading ? (
                        <p className="ec-prod-muted">Yükleniyor…</p>
                    ) : search.trim() ? (
                        filteredFlat.length === 0 ? (
                            <p className="ec-prod-muted">Kategori bulunamadı.</p>
                        ) : (
                            filteredFlat.map((c) => {
                                const id = String(c._id);
                                const checked = selected.has(id);
                                return (
                                    <label
                                        key={id}
                                        className={`ec-prod-cat-modal-row ${checked ? "ec-prod-cat-modal-row--checked" : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleSelect(c)}
                                        />
                                        <span className="ec-prod-cat-modal-row__text">
                                            <strong>{c.name}</strong>
                                            {c.parentName ? <small>{c.parentName}</small> : null}
                                        </span>
                                    </label>
                                );
                            })
                        )
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

                <footer className="ec-cart-link-picker__foot">
                    <div className="ec-cart-link-picker__foot-actions ec-cart-link-picker__foot-actions--end">
                        <button
                            type="button"
                            className="ec-cart-link-picker__btn ec-cart-link-picker__btn--ghost"
                            onClick={onClose}
                        >
                            İptal Et
                        </button>
                        <button
                            type="button"
                            className="ec-cart-link-picker__btn ec-cart-link-picker__btn--primary"
                            onClick={handleSave}
                        >
                            Kaydet
                        </button>
                    </div>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default CampaignCategoryPickerModal;
