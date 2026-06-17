import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    FaArrowLeft,
    FaPlus,
    FaInfoCircle,
    FaSearch,
    FaFilter,
    FaUpload,
    FaDownload,
    FaChevronRight,
    FaChevronDown,
    FaLayerGroup,
    FaBolt,
} from "react-icons/fa";
import { fetchStoreCategories } from "../../../services/storeApi";
import CategoryAddTypeModal from "./CategoryAddTypeModal";
import CategoryExportModal from "./CategoryExportModal";
import CategoryImportModal from "./CategoryImportModal";
import { sortCriteriaLabel } from "./categoryFormUtils";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

function flattenTree(nodes, expanded, depth = 0) {
    const rows = [];
    for (const node of nodes || []) {
        rows.push({ ...node, depth });
        if (node.children?.length && expanded.has(String(node._id))) {
            rows.push(...flattenTree(node.children, expanded, depth + 1));
        }
    }
    return rows;
}

const TreeRows = ({ nodes, expanded, tab, search, onToggle, onOpen }) => {
    const rows = useMemo(() => {
        const flat = flattenTree(nodes, expanded);
        const q = search.trim().toLowerCase();
        return flat.filter((node) => {
            const matchesTab =
                tab === "dynamic" ? node.categoryType === "dynamic" : node.categoryType !== "dynamic";
            if (!matchesTab) return false;
            if (!q) return true;
            return (
                node.name?.toLowerCase().includes(q) || node.path?.toLowerCase().includes(q)
            );
        });
    }, [nodes, expanded, tab, search]);

    if (!rows.length) {
        return (
            <tr>
                <td colSpan={3} className="ec-cat-list-empty">
                    Kategori bulunamadı.
                </td>
            </tr>
        );
    }

    return rows.map((node) => {
        const hasChildren = node.children?.length > 0;
        const isExpanded = expanded.has(String(node._id));
        const isDynamic = node.categoryType === "dynamic";
        return (
            <tr
                key={node._id}
                className="ec-cat-list-row"
                onClick={() => onOpen(node._id)}
            >
                <td>
                    <div className="ec-cat-list-name" style={{ paddingLeft: `${(node.depth || 0) * 18}px` }}>
                        {hasChildren ? (
                            <button
                                type="button"
                                className="ec-cat-list-expand"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle(String(node._id));
                                }}
                                aria-label={isExpanded ? "Daralt" : "Genişlet"}
                            >
                                {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                            </button>
                        ) : (
                            <span className="ec-cat-list-expand ec-cat-list-expand--spacer" />
                        )}
                        <div>
                            <strong>{node.name}</strong>
                            {node.parentName && (
                                <span className="ec-cat-list-parent">{node.parentName}</span>
                            )}
                        </div>
                    </div>
                </td>
                <td>
                    <span className="ec-cat-list-type">
                        {isDynamic ? <FaBolt /> : <FaLayerGroup />}
                        {isDynamic ? "Dinamik Kategori" : "Normal Kategori"}
                    </span>
                </td>
                <td>{sortCriteriaLabel(node.sortCriteria)}</td>
            </tr>
        );
    });
};

const StoreCategoriesPage = ({ onNavigate }) => {
    const [tab, setTab] = useState("normal");
    const [tree, setTree] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(() => new Set());
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCategories();
            setTree(res.tree || []);
        } catch (e) {
            setError(e.response?.data?.error || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const toggleExpand = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const openCategory = (id) => onNavigate?.(`ec-category-edit-${id}`);

    const onAddType = (type) => {
        setAddModalOpen(false);
        onNavigate?.(type === "dynamic" ? "ec-category-add-dynamic" : "ec-category-add-normal");
    };

    const filteredTree = tree;
    const hasAny = tree.length > 0;

    return (
        <div className="ec-prod-page">
            <div className="ec-prod-panel">
                <header className="ec-cat-list-head ec-prod-head">
                    <div className="ec-cat-list-head__left">
                        <button
                            type="button"
                            className="ec-prod-icon-btn"
                            onClick={() => onNavigate?.("ec-products-definitions")}
                        >
                            <FaArrowLeft />
                        </button>
                        <h1>
                            Kategoriler <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                        </h1>
                    </div>
                    <div className="ec-cat-list-head__actions">
                        <button type="button" className="ec-prod-btn" onClick={() => setExportOpen(true)}>
                            <FaUpload /> Dışa Aktar
                        </button>
                        <button type="button" className="ec-prod-btn" onClick={() => setImportOpen(true)}>
                            <FaDownload /> İçe Aktar
                        </button>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => setAddModalOpen(true)}
                        >
                            <FaPlus /> Kategori Ekle
                        </button>
                    </div>
                </header>

                <div className="ec-cat-tabs">
                    <button
                        type="button"
                        className={`ec-cat-tab${tab === "normal" ? " ec-cat-tab--active" : ""}`}
                        onClick={() => setTab("normal")}
                    >
                        Normal Kategori
                    </button>
                    <button
                        type="button"
                        className={`ec-cat-tab${tab === "dynamic" ? " ec-cat-tab--active" : ""}`}
                        onClick={() => setTab("dynamic")}
                    >
                        Dinamik Kategori
                    </button>
                </div>

                {error && <div className="ec-prod-form-error" style={{ padding: "0.75rem 1.15rem" }}>{error}</div>}

                {loading ? (
                    <p className="ec-prod-muted" style={{ padding: "1rem 1.15rem" }}>Yükleniyor…</p>
                ) : !hasAny ? (
                    <div className="ec-cat-empty">
                        <div className="ec-cat-empty__illus" />
                        <h2>Ürünlerinizi kategorilere ayırın</h2>
                        <p>
                            Ürünlerinizi çevrimiçi mağazanız için kategoriler ve galeriler halinde düzenleyin.
                        </p>
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={() => setAddModalOpen(true)}
                        >
                            Kategori Ekle
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="ec-prod-toolbar" style={{ padding: "0.75rem 1.15rem" }}>
                            <label className="ec-prod-search">
                                <FaSearch style={{ color: "var(--ec-muted)" }} />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Tabloda arama yapın"
                                />
                            </label>
                            <button type="button" className="ec-prod-btn">
                                <FaFilter /> Filtre
                            </button>
                        </div>

                        <div className="ec-prod-table-wrap">
                            <table className="ec-prod-table ec-cat-list-table">
                                <thead>
                                    <tr>
                                        <th>Ad</th>
                                        <th>Tür</th>
                                        <th>Sıralama Ölçütü</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <TreeRows
                                        nodes={filteredTree}
                                        expanded={expanded}
                                        tab={tab}
                                        search={search}
                                        onToggle={toggleExpand}
                                        onOpen={openCategory}
                                    />
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <CategoryAddTypeModal
                    open={addModalOpen}
                    onClose={() => setAddModalOpen(false)}
                    onSelect={onAddType}
                />
                <CategoryExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
                <CategoryImportModal
                    open={importOpen}
                    onClose={() => setImportOpen(false)}
                    onDone={() => load()}
                />
            </div>
        </div>
    );
};

export default StoreCategoriesPage;
