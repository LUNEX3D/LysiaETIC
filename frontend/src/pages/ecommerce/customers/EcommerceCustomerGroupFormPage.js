import React, { useCallback, useEffect, useState } from "react";
import { FaArrowLeft, FaTrash, FaUsers } from "react-icons/fa";
import {
    fetchStoreCustomerGroup,
    createStoreCustomerGroup,
    updateStoreCustomerGroup,
    deleteStoreCustomerGroup,
} from "../../../services/storeApi";
import { customerFullName } from "./customerUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

const GROUP_NAME_MAX = 100;

const EcommerceCustomerGroupFormPage = ({ groupId, onNavigate }) => {
    const isEdit = !!groupId;
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [name, setName] = useState("");
    const [type, setType] = useState("static");
    const [members, setMembers] = useState([]);

    const load = useCallback(async () => {
        if (!isEdit) {
            setName("");
            setType("static");
            setMembers([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCustomerGroup(groupId);
            setName(res.group?.name || "");
            setType(res.group?.type || "static");
            setMembers(res.members || []);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [groupId, isEdit]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!toast) return undefined;
        const t = setTimeout(() => setToast(""), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    const save = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Müşteri grubu adı gerekli");
            return;
        }
        setSaving(true);
        setError("");
        try {
            if (isEdit) {
                await updateStoreCustomerGroup(groupId, { name: trimmed });
                setToast("Müşteri Grubu kaydedildi");
                await load();
            } else {
                const res = await createStoreCustomerGroup({ name: trimmed, type: "static" });
                setToast("Müşteri Grubu kaydedildi");
                onNavigate?.(`ec-customer-group-edit-${res.group._id}`);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!isEdit) return;
        if (!window.confirm(`"${name}" müşteri grubu silinsin mi? Gruptaki müşterilerden grup kaldırılır.`)) return;
        try {
            await deleteStoreCustomerGroup(groupId);
            onNavigate?.("ec-customers-groups");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    const goBack = () => onNavigate?.("ec-customers-groups");

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page ec-customer-group-form-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar ec-cat-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button type="button" className="ec-prod-icon-btn" onClick={goBack} aria-label="Geri">
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button type="button" className="ec-prod-breadcrumb__link" onClick={goBack}>
                                Müşteri Grubu
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{isEdit ? "Müşteri Grubunu Düzenle" : "Müşteri Grubu Ekle"}</span>
                        </nav>
                        {isEdit && name.trim() && <strong className="ec-cat-form-title">{name.trim()}</strong>}
                    </div>
                    <div className="ec-prod-head-actions">
                        {isEdit && (
                            <button type="button" className="ec-prod-btn ec-prod-btn--danger" onClick={remove}>
                                <FaTrash /> Sil
                            </button>
                        )}
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            disabled={saving || !name.trim()}
                            onClick={save}
                        >
                            {saving ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                    </div>
                </header>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-prod-form-body ec-cat-form-body">
                    <section className="ec-prod-section ec-customer-group-card">
                        <header className="ec-customer-group-card__head">
                            <h2>Temel Bilgiler</h2>
                            <span className="ec-customer-group-card__badge">
                                <FaUsers aria-hidden /> Müşteri Grubu
                            </span>
                        </header>
                        <div className="ec-prod-field ec-prod-field--full">
                            <label>Müşteri Grubu Adı *</label>
                            <div className="ec-prod-char-field">
                                <input
                                    value={name}
                                    maxLength={GROUP_NAME_MAX}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Müşteri Grubu Adı"
                                />
                                <span className="ec-prod-char-count">
                                    {name.length}/{GROUP_NAME_MAX}
                                </span>
                            </div>
                        </div>
                    </section>

                    {isEdit && (
                        <section className="ec-prod-section ec-customer-group-card">
                            <header className="ec-customer-group-card__head">
                                <h2>Müşteriler</h2>
                            </header>
                            {members.length === 0 ? (
                                <div className="ec-customer-group-members-empty">
                                    <div className="ec-customer-group-members-empty__illus" aria-hidden />
                                    <h3>Müşteri Grubunuza Uygun Müşterileri Görüntüleyin</h3>
                                    <p>
                                        Tanımladığınız müşteri grubu koşullarına uygun bir müşteri bulunamadı. Müşteri
                                        düzenleme ekranından bu gruba müşteri ekleyebilirsiniz.
                                    </p>
                                </div>
                            ) : (
                                <ul className="ec-customer-group-members-list">
                                    {members.map((m) => (
                                        <li key={m._id}>
                                            <button
                                                type="button"
                                                className="ec-customer-group-members-list__link"
                                                onClick={() => onNavigate?.(`ec-customer-${m._id}`)}
                                            >
                                                <strong>{customerFullName(m)}</strong>
                                                {m.email && <span>{m.email}</span>}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                </div>
            </div>

            {toast && (
                <div className="ec-purchase-toast-stack ec-customer-group-toast">
                    <div className="ec-purchase-toast ec-purchase-toast--success" role="status">
                        <span className="ec-purchase-toast__icon">✓</span>
                        <span className="ec-purchase-toast__text">{toast}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EcommerceCustomerGroupFormPage;
