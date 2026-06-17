import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaInfoCircle, FaSearch, FaFilter, FaPlus } from "react-icons/fa";
import { fetchStoreGiftCards } from "../../../services/storeApi";
import {
    fmtTry,
    fmtGiftCardDateTime,
    giftCardStatusLabel,
    giftCardStatusClass,
    customerDisplay,
    remainingBalance,
} from "./giftCardUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceGiftCards.css";
import "../../../styles/ecommerceProducts.css";

const PAGE_SIZE = 20;

const EcommerceGiftCardsListPage = ({ onNavigate }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cards, setCards] = useState([]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreGiftCards();
            setCards(res.giftCards || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setPage(1);
    }, [search]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return cards;
        return cards.filter(
            (c) =>
                c.code?.toLowerCase().includes(q) ||
                c.customer?.name?.toLowerCase().includes(q) ||
                c.customer?.email?.toLowerCase().includes(q)
        );
    }, [cards, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageStart = (safePage - 1) * PAGE_SIZE;
    const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

    if (loading && !cards.length) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-orders-page ec-gift-cards-page">
            <div className="ec-prod-panel">
                <header className="ec-prod-head">
                    <h1>
                        Hediye Kartları{" "}
                        <FaInfoCircle style={{ fontSize: 14, opacity: 0.5 }} />
                    </h1>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        onClick={() => onNavigate?.("ec-gift-card-create")}
                    >
                        <FaPlus /> Hediye Kartı Oluştur
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
                            <h2>Hediye kartı yok</h2>
                            <p>Müşterilerinize hediye kartı oluşturarak satışlarınızı artırın.</p>
                            <button
                                type="button"
                                className="ec-prod-btn ec-prod-btn--primary"
                                style={{ marginTop: "1rem" }}
                                onClick={() => onNavigate?.("ec-gift-card-create")}
                            >
                                Hediye Kartı Oluştur
                            </button>
                        </div>
                    ) : (
                        <table className="ec-orders-table">
                            <thead>
                                <tr>
                                    <th>Hediye Kartı Kodu</th>
                                    <th>Oluşturulma Tarihi</th>
                                    <th>Müşteri</th>
                                    <th>Durum</th>
                                    <th>İlk Tutar / Kullanılan</th>
                                    <th>Satış Kanalları</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map((c) => {
                                    const id = String(c._id);
                                    const channels =
                                        (c.salesChannelLabels || []).join(", ") || "—";
                                    return (
                                        <tr
                                            key={id}
                                            onClick={() => onNavigate?.(`ec-gift-card-${id}`)}
                                        >
                                            <td>
                                                <span className="ec-orders-table__order-no">
                                                    {c.code}
                                                </span>
                                            </td>
                                            <td className="ec-orders-table__date">
                                                {fmtGiftCardDateTime(c.createdAt)}
                                            </td>
                                            <td className="ec-orders-table__customer">
                                                <strong>{customerDisplay(c)}</strong>
                                                {c.customer?.email ? (
                                                    <small>{c.customer.email}</small>
                                                ) : null}
                                            </td>
                                            <td>
                                                <span
                                                    className={`ec-gift-card-badge ${giftCardStatusClass(c)}`}
                                                >
                                                    {giftCardStatusLabel(c)}
                                                </span>
                                            </td>
                                            <td>
                                                {fmtTry(c.initialAmount)}
                                                <br />
                                                <small style={{ opacity: 0.8 }}>
                                                    Kullanılan: {fmtTry(c.usedAmount)} · Kalan:{" "}
                                                    {fmtTry(remainingBalance(c))}
                                                </small>
                                            </td>
                                            <td className="ec-orders-table__channel">{channels}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {paged.length > 0 && (
                    <footer className="ec-orders-foot">
                        <span>
                            {filtered.length ? pageStart + 1 : 0} –{" "}
                            {Math.min(pageStart + PAGE_SIZE, filtered.length)} / {filtered.length}{" "}
                            adet
                        </span>
                        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                            <button
                                type="button"
                                className="ec-prod-btn"
                                disabled={safePage <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Önceki
                            </button>
                            <span>{safePage}</span>
                            <button
                                type="button"
                                className="ec-prod-btn"
                                disabled={safePage >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Sonraki
                            </button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default EcommerceGiftCardsListPage;
