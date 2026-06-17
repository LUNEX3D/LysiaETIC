import React, { useState, useEffect, useCallback } from "react";
import {
    fetchStore,
    fetchStoreProducts,
    fetchStoreCategories,
    fetchStoreTransfer,
    createStoreTransfer,
    patchStoreTransfer,
} from "../../../services/storeApi";
import TransferFormHeader from "./TransferFormHeader";
import TransferFormSections from "./TransferFormSections";
import { emptyTransferForm, formToTransferPayload, transferToForm } from "./transferFormUtils";

const EcommerceTransferAddPage = ({ transferId, onNavigate }) => {
    const isEdit = Boolean(transferId);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [storeName, setStoreName] = useState("");
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(() => emptyTransferForm());

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

            const [prodRes, catRes] = await Promise.all([
                fetchStoreProducts(),
                fetchStoreCategories().catch(() => ({ categories: [] })),
            ]);
            setProducts(prodRes.products || []);
            setCategories(catRes.categories || []);

            if (isEdit) {
                const res = await fetchStoreTransfer(transferId);
                setForm(transferToForm(res.transfer, name));
            } else {
                setForm(emptyTransferForm(name));
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [isEdit, transferId]);

    useEffect(() => {
        load();
    }, [load]);

    const goBack = () => onNavigate?.("ec-products-transfers");

    const persist = async (approve) => {
        setSaving(true);
        setError("");
        try {
            const payload = formToTransferPayload(form, { approve });
            if (isEdit) {
                await patchStoreTransfer(transferId, payload);
                await load();
            } else {
                const res = await createStoreTransfer(payload);
                const id = res.transfer?._id;
                if (id) onNavigate?.(`ec-transfer-edit-${id}`);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const validate = () => {
        if (!form.waybillNumber.trim()) {
            setError("İrsaliye no gerekli");
            return false;
        }
        if (!form.fromBranch.trim()) {
            setError("Çıkış şubesi gerekli");
            return false;
        }
        if (!form.toBranch.trim()) {
            setError("Giriş şubesi gerekli");
            return false;
        }
        if (form.fromBranch === form.toBranch) {
            setError("Çıkış ve giriş şubesi farklı olmalı");
            return false;
        }
        return true;
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page">
            <div className="ec-prod-form-shell">
                <TransferFormHeader
                    saving={saving}
                    onBack={goBack}
                    onSaveDraft={() => validate() && persist(false)}
                    onSaveApprove={() => validate() && persist(true)}
                />
                {error && (
                    <div className="ec-purchase-form-error" role="alert">
                        {error}
                    </div>
                )}
                <div className="ec-prod-form-body">
                    <TransferFormSections
                        form={form}
                        setForm={setForm}
                        storeName={storeName}
                        products={products}
                        categories={categories}
                        onNavigate={onNavigate}
                    />
                </div>
            </div>
        </div>
    );
};

export default EcommerceTransferAddPage;
