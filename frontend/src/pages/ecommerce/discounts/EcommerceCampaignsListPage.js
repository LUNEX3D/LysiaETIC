import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaInfoCircle,
    FaPlus,
    FaSearch,
    FaFilter,
    FaPercent,
    FaShoppingCart,
    FaTruck,
    FaGift,
} from "react-icons/fa";
import { fetchStoreCampaigns } from "../../../services/storeApi";
import CampaignAddTypeModal from "./CampaignAddTypeModal";
import { campaignTypeLabel, fmtCampaignDate } from "./campaignUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceDiscounts.css";

const PAGE_SIZE = 20;

function typeIcon(c) {
    if (c?.kind === "code") return <FaPercent />;
    if (c?.discountType === "buy_x_get_y") return <FaGift />;
    if (c?.discountType === "free_shipping") return <FaTruck />;
    if (c?.discountType === "fixed") return <FaShoppingCart />;
    return <FaShoppingCart />;
}

const EcommerceCampaignsListPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [campaigns, setCampaigns] = useState([]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [addOpen, setAddOpen] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCampaigns({ kind: "automatic" });
            setCampaigns(res.campaigns || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return campaigns;
        return campaigns.filter((c) => (c.title || "").toLowerCase().includes(q));
    }, [campaigns, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const onAddType = (kind) => {
        setAddOpen(false);
        if (kind === "code") onNavigate?.("ec-campaign-code-create");
        else onNavigate?.("ec-campaign-auto-create");
    };

    if (loading && !campaigns.length) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-discounts-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Kampanyalar <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => setAddOpen(true)}
                    >
                        <FaPlus /> Kampanya Ekle
                    </button>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-orders-toolbar">
                    <label className="ec-orders-search">
                        <FaSearch />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tabloda arama yapın"
                        />
                    </label>
                    <button type="button" className="ec-prod-btn" disabled title="Yakında">
                        <FaFilter /> Filtre
                    </button>
                </div>

                <div className="ec-orders-table-wrap">
                    {paged.length === 0 ? (
                        <div className="ec-orders-empty">
                            <h2>Henüz kampanya yok</h2>
                            <p>Otomatik indirim veya sepette uygulanan kampanyalarınızı buradan yönetin.</p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                style={{ marginTop: "1rem" }}
                                onClick={() => setAddOpen(true)}
                            >
                                Kampanya Ekle
                            </button>
                        </div>
                    ) : (
                        <table className="ec-orders-table">
                            <thead>
                                <tr>
                                    <th>Başlık</th>
                                    <th>Tür</th>
                                    <th>Kullanım</th>
                                    <th>Tarih</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((c) => (
                                    <tr
                                        key={c._id}
                                        className="ec-orders-table__row--click"
                                        onClick={() => onNavigate?.(`ec-campaign-edit-${c._id}`)}
                                    >
                                        <td>
                                            <strong>{c.title}</strong>
                                        </td>
                                        <td>
                                            <span className="ec-discount-table-type">
                                                {typeIcon(c)}
                                                {campaignTypeLabel(c)}
                                            </span>
                                        </td>
                                        <td>{c.usageCount ?? 0}</td>
                                        <td>{fmtCampaignDate(c)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {paged.length > 0 && (
                    <footer className="ec-customers-foot">
                        <span>
                            {pageStart + 1} - {Math.min(pageStart + PAGE_SIZE, filtered.length)} /{" "}
                            {filtered.length} adet
                        </span>
                    </footer>
                )}
            </div>

            <CampaignAddTypeModal open={addOpen} onClose={() => setAddOpen(false)} onSelect={onAddType} />
        </div>
    );
};

export default EcommerceCampaignsListPage;
