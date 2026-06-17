import React, { useState, useEffect, useMemo } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import usePlanEntitlements from "../../../hooks/usePlanEntitlements";
import PersonalizationOptionForm from "./PersonalizationOptionForm";
import {
    emptyOptionForm,
    optionToForm,
    PAID_PRICING_FEATURE,
} from "./personalizationFormUtils";
import {
    loadPersonalizationDraft,
    savePersonalizationDraft,
} from "./personalizationDraftStorage";
import "../../../styles/ecommerceDefinitions.css";
import "../../../styles/ecommerceProducts.css";

const StoreProductPersonalizationOptionPage = ({ optionKey, onNavigate }) => {
    const isEdit = !!optionKey;
    const { C } = useDashtockTheme();
    const { canAccess, planDisplayName, loading: planLoading } = usePlanEntitlements();
    const allowPaidPricing = canAccess(PAID_PRICING_FEATURE);

    const [draft, setDraft] = useState(emptyOptionForm);
    const [allOptions, setAllOptions] = useState([]);
    const [returnPanel, setReturnPanel] = useState("ec-products-definitions-personalizations");
    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const workspace = loadPersonalizationDraft();
        if (!workspace) {
            onNavigate?.("ec-products-definitions-personalizations");
            return;
        }

        setReturnPanel(workspace.returnPanel || "ec-personalization-add");
        setAllOptions(workspace.options || []);

        if (isEdit) {
            const existing = (workspace.options || []).find(
                (o) => String(o._id || o.clientKey) === String(optionKey)
            );
            if (!existing) {
                onNavigate?.(workspace.returnPanel || "ec-personalization-add");
                return;
            }
            setDraft(optionToForm(existing));
        } else {
            setDraft(emptyOptionForm());
        }
        setReady(true);
    }, [isEdit, optionKey, onNavigate]);

    const showOptionLevelPrice = draft.type !== "selection";
    const showValuePrices = draft.type === "selection" && allowPaidPricing;
    const showPriceTab = showOptionLevelPrice || showValuePrices;

    const tabs = useMemo(() => {
        const items = [{ id: "pers-type", label: "Kişiselleştirme Türü" }];
        if (showPriceTab) items.push({ id: "pers-price", label: "Fiyat" });
        items.push({ id: "pers-settings", label: "Ayarlar" });
        return items;
    }, [showPriceTab]);

    const handleSave = () => {
        if (!draft.title.trim()) {
            setError("Ürün sayfası başlığı gerekli");
            document.getElementById("pers-type")?.scrollIntoView({ behavior: "smooth" });
            return;
        }
        if (draft.type === "selection" && !draft.values.length) {
            setError("En az bir seçim değeri ekleyin");
            document.getElementById("pers-values")?.scrollIntoView({ behavior: "smooth" });
            return;
        }
        if (draft.type === "file" && !draft.allowedExtensions.length) {
            setError("En az bir dosya uzantısı ekleyin");
            document.getElementById("pers-type")?.scrollIntoView({ behavior: "smooth" });
            return;
        }

        const workspace = loadPersonalizationDraft();
        if (!workspace) {
            onNavigate?.(returnPanel);
            return;
        }

        const saved = {
            ...draft,
            sortOrder: isEdit
                ? workspace.options.find((o) => String(o._id || o.clientKey) === String(optionKey))?.sortOrder ?? 0
                : workspace.options.length,
        };
        const key = String(saved._id || saved.clientKey);
        const idx = workspace.options.findIndex((o) => String(o._id || o.clientKey) === key);
        const options =
            idx >= 0
                ? workspace.options.map((o, i) => (i === idx ? saved : o))
                : [...workspace.options, saved];

        savePersonalizationDraft({ ...workspace, options });
        onNavigate?.(workspace.returnPanel || returnPanel);
    };

    const goBack = () => {
        onNavigate?.(returnPanel);
    };

    if (!ready || planLoading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page ec-pers-option-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar ec-cat-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button type="button" className="ec-prod-icon-btn" onClick={goBack}>
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button
                                type="button"
                                className="ec-prod-breadcrumb__link"
                                onClick={() => onNavigate?.("ec-products-definitions-personalizations")}
                            >
                                Ürün Kişiselleştirmeleri
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>Kişiselleştirme Seçeneği</span>
                        </nav>
                    </div>
                    <div className="ec-prod-head-actions">
                        <button
                            type="button"
                            className="ec-prod-btn ec-prod-btn--primary"
                            onClick={handleSave}
                        >
                            {isEdit ? "Kaydet" : "Ekle"}
                        </button>
                    </div>
                </header>

                <nav className="ec-pers-option-tabs" aria-label="Kişiselleştirme bölümleri">
                    {tabs.map((tab) => (
                        <a key={tab.id} href={`#${tab.id}`}>
                            {tab.label}
                        </a>
                    ))}
                </nav>

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-prod-form-body ec-pers-option-body">
                    <PersonalizationOptionForm
                        draft={draft}
                        setDraft={setDraft}
                        allOptions={allOptions}
                        allowPaidPricing={allowPaidPricing}
                        planDisplayName={planDisplayName}
                        accentColor={C.accent}
                    />
                </div>
            </div>
        </div>
    );
};

export default StoreProductPersonalizationOptionPage;
