import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FaArrowLeft, FaInfoCircle, FaSyncAlt, FaBuilding, FaFilter } from "react-icons/fa";
import {
    fetchStore,
    fetchStoreProducts,
    fetchStoreCategories,
} from "../../../services/storeApi";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcFieldLabel from "../../../components/ecommerce/EcFieldLabel";
import { EC_FIELD_HINTS } from "../../../constants/ecFieldHints";
import StockCountFilterModal from "./StockCountFilterModal";
import {
    buildBranchOptions,
    defaultCountTitle,
    extractFilterOptions,
    saveStockCountDraft,
    productsMatchingFilters,
    linesFromProductsForCount,
} from "./stockCountFormUtils";

const EcommerceStockCountAddPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [storeName, setStoreName] = useState("");
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [locationName, setLocationName] = useState("Ana Depo");
    const [title, setTitle] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const storeRes = await fetchStore();
            if (!storeRes.store) {
                setError("Önce mağazanızı oluşturun.");
                return;
            }
            const name = storeRes.store.name || "";
            setStoreName(name);
            const [prodRes, catRes] = await Promise.all([
                fetchStoreProducts(),
                fetchStoreCategories().catch(() => ({ categories: [] })),
            ]);
            const prods = prodRes.products || [];
            setProducts(prods);
            setCategories(catRes.categories || []);
            const branches = buildBranchOptions(name, prods);
            const defaultLoc = branches.includes("Ana Depo") ? "Ana Depo" : branches[0] || "Ana Depo";
            setLocationName(defaultLoc);
            setTitle(defaultCountTitle(defaultLoc));
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const branches = useMemo(() => buildBranchOptions(storeName, products), [storeName, products]);
    const filterOptions = useMemo(
        () => extractFilterOptions(products, categories),
        [products, categories]
    );

    const validateDetail = () => {
        const errs = {};
        if (!locationName.trim()) errs.locationName = "Stok Lokasyonu zorunludur.";
        if (!title.trim()) errs.title = "Ad zorunludur.";
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const onLocationChange = (loc) => {
        setLocationName(loc);
        setTitle(defaultCountTitle(loc));
        setFieldErrors((prev) => ({ ...prev, locationName: "" }));
    };

    const onTitleChange = (value) => {
        setTitle(value);
        if (value.trim()) setFieldErrors((prev) => ({ ...prev, title: "" }));
    };

    const startManual = () => {
        if (!validateDetail()) return;
        saveStockCountDraft({
            locationName,
            title,
            method: "manual",
            lines: [],
            filters: [],
            recentActions: [],
        });
        onNavigate?.("ec-stock-count-work-new");
    };

    const openFilterModal = () => {
        if (!validateDetail()) return;
        setFilterOpen(true);
    };

    const startWithFilters = (filters) => {
        if (!validateDetail()) return;
        const matched = productsMatchingFilters(products, filters);
        const lines = linesFromProductsForCount(matched, locationName);
        saveStockCountDraft({
            locationName,
            title,
            method: "filter",
            filters,
            lines,
            recentActions: [],
        });
        onNavigate?.("ec-stock-count-work-new");
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
                            onClick={() => onNavigate?.("ec-products-stock-count")}
                        >
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-products-stock-count")}
                            >
                                Stok Sayımları
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>Stok Sayımı Ekle</span>
                        </nav>
                    </div>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-prod-form-body">
                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>
                                Stok Sayımı Detay <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                            </h3>
                        </div>
                        <div className="ec-prod-grid ec-purchase-grid--2">
                            <div className={`ec-prod-field${fieldErrors.locationName ? " ec-prod-field--error" : ""}`}>
                                <EcFieldLabel hint={EC_FIELD_HINTS.stockCountLocation}>
                                    Stok Lokasyonu *
                                </EcFieldLabel>
                                <EcSelect
                                    value={locationName}
                                    onChange={(e) => onLocationChange(e.target.value)}
                                >
                                    {branches.map((b) => (
                                        <option key={b} value={b}>
                                            {b}
                                        </option>
                                    ))}
                                </EcSelect>
                                {fieldErrors.locationName && (
                                    <p className="ec-prod-field__error">{fieldErrors.locationName}</p>
                                )}
                            </div>
                            <div className={`ec-prod-field${fieldErrors.title ? " ec-prod-field--error" : ""}`}>
                                <EcFieldLabel hint={EC_FIELD_HINTS.stockCountName}>Ad *</EcFieldLabel>
                                <input
                                    value={title}
                                    onChange={(e) => onTitleChange(e.target.value)}
                                />
                                {fieldErrors.title && (
                                    <p className="ec-prod-field__error">{fieldErrors.title}</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="ec-prod-section">
                        <div className="ec-prod-section__head">
                            <h3>
                                Stok Sayım Yöntemi{" "}
                                <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                            </h3>
                        </div>
                        <div className="ec-stock-count-methods">
                            <div className="ec-stock-count-method-card">
                                <h4>Sayarak Ekle</h4>
                                <p>
                                    Depoda ürünleri tek tek sayarak veya barkod okuyarak stokları güncelleyin.
                                </p>
                                <ul>
                                    <li>
                                        <FaSyncAlt /> Hızlı, sahada sayım yapan ekipler için idealdir.
                                    </li>
                                    <li>
                                        <FaBuilding /> Yalnızca okuttuğunuz veya saydığınız ürünlerin stokları
                                        güncellenir.
                                    </li>
                                    <li>Barkod okuyucu ile hata riskini azaltın.</li>
                                </ul>
                                <button
                                    type="button"
                                    className="ec-prod-btn ec-prod-btn--primary"
                                    disabled={false}
                                    onClick={startManual}
                                >
                                    Sayarak Sayım Başlat
                                </button>
                            </div>
                            <div className="ec-stock-count-method-card">
                                <h4>Filtreye Göre Ekle</h4>
                                <p>Belirli kriterlere göre bir sayım listesi oluşturun.</p>
                                <ul>
                                    <li>
                                        <FaFilter /> Sayım sonrası yalnızca saydığınız ürünler güncellenir.
                                    </li>
                                    <li>Geniş ürün portföyü için önerilir.</li>
                                    <li>Sistem, seçtiğiniz filtreye göre ürünleri listeler.</li>
                                </ul>
                                <button
                                    type="button"
                                    className="ec-prod-btn ec-prod-btn--primary"
                                    disabled={false}
                                    onClick={openFilterModal}
                                >
                                    Filtreye Göre Sayım Ekle
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                <StockCountFilterModal
                    open={filterOpen}
                    onClose={() => setFilterOpen(false)}
                    filterOptions={filterOptions}
                    onStart={startWithFilters}
                />
            </div>
        </div>
    );
};

export default EcommerceStockCountAddPage;
