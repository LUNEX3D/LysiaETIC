import React, { useState, useEffect, useCallback } from "react";
import {
    fetchStore,
    fetchStoreProducts,
    fetchStorePurchase,
    createStorePurchase,
    patchStorePurchase,
} from "../../../services/storeApi";
import PurchaseFormHeader from "./PurchaseFormHeader";
import PurchaseFormSections from "./PurchaseFormSections";
import { emptyPurchaseForm, formToPayload, purchaseToForm } from "./purchaseFormUtils";

const EcommercePurchaseAddPage = ({ purchaseId, onNavigate }) => {
    const isEdit = Boolean(purchaseId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [storeName, setStoreName] = useState("");
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState(() => emptyPurchaseForm());

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const storeRes = await fetchStore();
            if (!storeRes.store) {
                setError("Önce mağazanızı oluşturun (Satış Kanalları).");
                return;
            }
            const name = storeRes.store.name || "Merkez Depo";
            setStoreName(name);

            const prodRes = await fetchStoreProducts();
            setProducts(prodRes.products || []);

            if (isEdit) {
                const res = await fetchStorePurchase(purchaseId);
                setForm(purchaseToForm(res.purchase, name));
            } else {
                setForm(emptyPurchaseForm(name));
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [isEdit, purchaseId]);

    useEffect(() => {
        load();
    }, [load]);

    const goBack = () => onNavigate?.("ec-products-purchase");

    const persist = async (approve) => {
        setSaving(true);
        setError("");
        try {
            const payload = formToPayload(form, { approve });
            if (isEdit) {
                await patchStorePurchase(purchaseId, payload);
                await load();
            } else {
                const res = await createStorePurchase(payload);
                const id = res.purchase?._id;
                if (id) {
                    onNavigate?.(`ec-purchase-edit-${id}`);
                }
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const handleSave = (approve) => {
        if (!form.supplierName.trim()) {
            setError("Tedarikçi gerekli");
            return;
        }
        if (!form.branchName.trim()) {
            setError("Sevk şubesi gerekli");
            return;
        }
        if (!form.referenceNumber.trim()) {
            setError("Referans numarası gerekli");
            return;
        }
        persist(approve);
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    if (error && !form.supplierName && !isEdit) {
        return (
            <div className="ec-prod-page">
                <div className="ec-prod-panel">
                    <div className="ec-prod-empty">
                        <p style={{ color: "var(--ec-red)" }}>{error}</p>
                        <button type="button" className="ec-prod-btn" onClick={goBack}>
                            Listeye dön
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page">
            <div className="ec-prod-form-shell">
                <PurchaseFormHeader
                    isEdit={isEdit}
                    status={form.status}
                    saving={saving}
                    onBack={goBack}
                    onSave={handleSave}
                    onSaveApprove={handleSave}
                />

                {error && (
                    <div className="ec-purchase-form-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="ec-prod-form-body">
                    <PurchaseFormSections
                        form={form}
                        setForm={setForm}
                        storeName={storeName}
                        products={products}
                    />
                </div>
            </div>
        </div>
    );
};

export default EcommercePurchaseAddPage;
