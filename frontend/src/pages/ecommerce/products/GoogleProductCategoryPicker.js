import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaSearch, FaChevronDown, FaChevronRight, FaTimes } from "react-icons/fa";
import { fetchGoogleProductCategories } from "../../../services/storeApi";

const TreeRow = ({ node, depth, expanded, childCache, loadingPaths, onToggle, onSelect }) => {
    const isOpen = expanded.has(node.path);
    const children = childCache[node.path];
    const loading = loadingPaths.has(node.path);

    return (
        <>
            <div
                className={`ec-prod-gcat-row ${node.hasChildren ? "" : "ec-prod-gcat-row--leaf"}`}
                style={{ paddingLeft: `${12 + depth * 18}px` }}
            >
                <button
                    type="button"
                    className="ec-prod-gcat-row__chevron"
                    onClick={() => (node.hasChildren ? onToggle(node) : onSelect(node))}
                    aria-label={node.hasChildren ? "Genişlet" : "Seç"}
                >
                    {node.hasChildren ? (
                        isOpen ? <FaChevronDown /> : <FaChevronRight />
                    ) : (
                        <span className="ec-prod-gcat-row__dot" />
                    )}
                </button>
                <button type="button" className="ec-prod-gcat-row__label" onClick={() => onSelect(node)}>
                    {node.name}
                </button>
            </div>
            {isOpen &&
                (loading ? (
                    <p className="ec-prod-muted ec-prod-gcat-loading" style={{ paddingLeft: `${30 + depth * 18}px` }}>
                        Yükleniyor…
                    </p>
                ) : (
                    (children || []).map((child) => (
                        <TreeRow
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            expanded={expanded}
                            childCache={childCache}
                            loadingPaths={loadingPaths}
                            onToggle={onToggle}
                            onSelect={onSelect}
                        />
                    ))
                ))}
        </>
    );
};

const GoogleProductCategoryPicker = ({ value, categoryId, onChange }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [roots, setRoots] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(new Set());
    const [childCache, setChildCache] = useState({});
    const [loadingPaths, setLoadingPaths] = useState(new Set());
    const wrapRef = useRef(null);

    const loadRoots = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchGoogleProductCategories();
            setRoots(res.nodes || []);
        } catch (e) {
            setError(e.response?.data?.error || "Kategoriler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        loadRoots();
        return undefined;
    }, [open, loadRoots]);

    useEffect(() => {
        if (!open) return undefined;
        const q = search.trim();
        if (q.length < 2) {
            setSearchResults([]);
            return undefined;
        }
        let cancelled = false;
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetchGoogleProductCategories({ q });
                if (!cancelled) setSearchResults(res.results || []);
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.error || "Arama başarısız");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 280);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [search, open]);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    const loadChildren = async (path) => {
        if (childCache[path]) return;
        setLoadingPaths((prev) => new Set(prev).add(path));
        try {
            const res = await fetchGoogleProductCategories({ parent: path });
            setChildCache((prev) => ({ ...prev, [path]: res.nodes || [] }));
        } catch (e) {
            setError(e.response?.data?.error || "Alt kategoriler yüklenemedi");
        } finally {
            setLoadingPaths((prev) => {
                const next = new Set(prev);
                next.delete(path);
                return next;
            });
        }
    };

    const handleToggle = (node) => {
        const next = new Set(expanded);
        if (next.has(node.path)) next.delete(node.path);
        else {
            next.add(node.path);
            if (node.hasChildren) loadChildren(node.path);
        }
        setExpanded(next);
    };

    const handleSelect = (node) => {
        onChange({ path: node.path, id: node.id });
        setOpen(false);
        setSearch("");
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange({ path: "", id: "" });
    };

    const isSearch = search.trim().length >= 2;

    return (
        <div className="ec-prod-gcat" ref={wrapRef}>
            <div className="ec-prod-gcat-input-wrap">
                <input
                    type="text"
                    readOnly
                    className="ec-prod-gcat-input"
                    value={value || ""}
                    placeholder="Kategori seçin"
                    onClick={() => setOpen((o) => !o)}
                />
                {value && (
                    <button type="button" className="ec-prod-gcat-clear" onClick={handleClear} aria-label="Temizle">
                        <FaTimes />
                    </button>
                )}
            </div>

            {open && (
                <div className="ec-prod-gcat-panel">
                    <label className="ec-prod-search ec-prod-gcat-search">
                        <FaSearch />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Kategori ara…"
                            autoFocus
                        />
                    </label>

                    {error && <div className="ec-prod-form-error ec-prod-gcat-error">{error}</div>}

                    <div className="ec-prod-gcat-list">
                        {loading && !isSearch && roots.length === 0 ? (
                            <p className="ec-prod-muted" style={{ padding: "1rem", textAlign: "center" }}>
                                Yükleniyor…
                            </p>
                        ) : isSearch ? (
                            searchResults.length === 0 && !loading ? (
                                <p className="ec-prod-muted" style={{ padding: "1rem", textAlign: "center" }}>
                                    Sonuç bulunamadı.
                                </p>
                            ) : (
                                searchResults.map((item) => (
                                    <button
                                        key={`${item.id}-${item.path}`}
                                        type="button"
                                        className="ec-prod-gcat-search-item"
                                        onClick={() => handleSelect(item)}
                                    >
                                        <span className="ec-prod-gcat-search-item__path">{item.path}</span>
                                    </button>
                                ))
                            )
                        ) : (
                            roots.map((node) => (
                                <TreeRow
                                    key={node.path}
                                    node={node}
                                    depth={0}
                                    expanded={expanded}
                                    childCache={childCache}
                                    loadingPaths={loadingPaths}
                                    onToggle={handleToggle}
                                    onSelect={handleSelect}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleProductCategoryPicker;
