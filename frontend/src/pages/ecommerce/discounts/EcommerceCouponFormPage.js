import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaPercent,
    FaMoneyBillWave,
    FaTruck,
    FaGift,
    FaTrash,
    FaBox,
    FaShoppingBag,
    FaShoppingCart,
    FaUsers,
    FaUser,
    FaMousePointer,
    FaInfoCircle,
} from "react-icons/fa";
import {
    fetchStoreCampaign,
    createStoreCampaign,
    updateStoreCampaign,
    deleteStoreCampaign,
    fetchStoreProducts,
    fetchStoreCustomerGroups,
    fetchStoreCustomers,
    fetchStoreCartLinkSalesChannels,
    fetchStoreBrands,
    fetchStoreTags,
    fetchStoreCategories,
} from "../../../services/storeApi";
import CampaignOptionGrid from "./CampaignOptionGrid";
import CampaignFormAnchors from "./CampaignFormAnchors";
import EcMultiPicker from "../../../components/ecommerce/EcMultiPicker";
import EcSelect from "../../../components/ecommerce/EcSelect";
import EcSalesChannelPicker from "./EcSalesChannelPicker";
import EcCurrencyPicker from "./EcCurrencyPicker";
import CartLinkProductPickerModal from "../definitions/CartLinkProductPickerModal";
import CampaignCategoryPickerModal from "./CampaignCategoryPickerModal";
import {
    emptyCampaignForm,
    campaignToForm,
    formToCampaignPayload,
    TITLE_MAX,
    CODE_MAX,
} from "./campaignUtils";
import { customerFullName } from "../customers/customerUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceGiftCards.css";
import "../../../styles/ecommerceDiscounts.css";

const RequirementToggle = ({ checked, onChange, label, hint, children }) => (
    <div className="ec-gift-card-req">
        <div className="ec-gift-card-req__head">
            <label className="ec-gift-card-req__toggle">
                <span className="ec-gift-card-switch">
                    <input type="checkbox" checked={checked} onChange={onChange} />
                    <span aria-hidden />
                </span>
                <span>
                    <span className="ec-gift-card-req__label">{label}</span>
                    {hint ? <span className="ec-prod-muted ec-discount-req-hint">{hint}</span> : null}
                </span>
            </label>
        </div>
        {checked && children ? <div className="ec-gift-card-req__body">{children}</div> : null}
    </div>
);

const discountTypeOptions = [
    { id: "percentage", label: "Yüzdelik", icon: <FaPercent /> },
    { id: "fixed", label: "Sabit Tutar", icon: <FaMoneyBillWave /> },
    { id: "free_shipping", label: "Ücretsiz Kargo", icon: <FaTruck /> },
    { id: "buy_x_get_y", label: "X Al Y Kazan", icon: <FaGift /> },
];

const customerScopeOptions = [
    { id: "all", label: "Tüm Kişiler", icon: <FaUser /> },
    { id: "groups", label: "Müşteri Grubu & Segment", icon: <FaUsers /> },
    { id: "specific", label: "Spesifik Müşteriler", icon: <FaMousePointer /> },
];

const TARGET_OPTIONS = [
    { id: "products", label: "Ürünler" },
    { id: "categories", label: "Kategoriler" },
    { id: "brands", label: "Markalar" },
    { id: "tags", label: "Etiketler" },
];

function fmtTry(n) {
    try {
        return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
            Number(n) || 0
        );
    } catch {
        return `₺${Number(n || 0).toFixed(2)}`;
    }
}

function buildCouponPayload(form) {
    const requirements = {
        ...form.requirements,
        limitQuantity: form.buyRequirementMode === "quantity",
        limitPurchaseAmount: form.buyRequirementMode === "amount",
    };
    return formToCampaignPayload({
        ...form,
        kind: "code",
        requirements,
    });
}

const EcommerceCouponFormPage = ({ campaignId, onNavigate }) => {
    const isEdit = !!campaignId;
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(() => emptyCampaignForm("code"));
    const [products, setProducts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [channels, setChannels] = useState([]);
    const [hasStorefront, setHasStorefront] = useState(false);
    const [brands, setBrands] = useState([]);
    const [tags, setTags] = useState([]);
    const [categoriesFlat, setCategoriesFlat] = useState([]);
    const [productPicker, setProductPicker] = useState(null);
    const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

    const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));
    const setNested = (key, patch) =>
        setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

    const loadMeta = useCallback(async () => {
        try {
            const [pRes, gRes, cRes, chRes, bRes, tRes, catRes] = await Promise.all([
                fetchStoreProducts(),
                fetchStoreCustomerGroups(),
                fetchStoreCustomers(),
                fetchStoreCartLinkSalesChannels(),
                fetchStoreBrands().catch(() => ({ brands: [] })),
                fetchStoreTags().catch(() => ({ tags: [] })),
                fetchStoreCategories().catch(() => ({ flat: [] })),
            ]);
            setProducts(pRes.products || []);
            setGroups(gRes.groups || []);
            setCustomers(cRes.customers || []);
            setChannels(chRes.campaignChannels || chRes.channels || []);
            setHasStorefront(!!chRes.hasStorefront);
            setBrands(bRes.brands || []);
            setTags(tRes.tags || []);
            setCategoriesFlat(catRes.flat || []);
        } catch {
            /* optional */
        }
    }, []);

    const load = useCallback(async () => {
        await loadMeta();
        if (!isEdit) {
            setForm(emptyCampaignForm("code"));
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCampaign(campaignId);
            const f = campaignToForm(res.campaign);
            if (f.kind !== "code") {
                onNavigate?.(`ec-campaign-edit-${campaignId}`);
                return;
            }
            setForm(f);
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [campaignId, isEdit, loadMeta, onNavigate]);

    useEffect(() => {
        load();
    }, [load]);

    const isBuyX = form.discountType === "buy_x_get_y";
    const showValue = !isBuyX && form.discountType !== "free_shipping";

    const ruleValues = useMemo(() => {
        const r = (form.productRules || []).find((x) => x.field === form.buyRuleTarget);
        return r?.values || [];
    }, [form.productRules, form.buyRuleTarget]);

    const setRuleValues = (values) => {
        setField({
            productRules:
                values.length > 0
                    ? [{ field: form.buyRuleTarget, mode: "include", values }]
                    : [],
        });
    };

    const anchors = useMemo(() => {
        const list = [
            { id: "sec-title", label: "Başlık" },
            { id: "sec-type", label: "İndirim Türü" },
        ];
        if (showValue) list.push({ id: "sec-value", label: form.discountType === "fixed" ? "İndirim Tutarı" : "İndirim Oranı" });
        list.push({ id: "sec-extras", label: "Ek İndirimler" });
        if (isBuyX) {
            list.push({ id: "sec-buy", label: "Müşterinin Aldıkları" });
            list.push({ id: "sec-get", label: "Müşterinin Kazandıkları" });
        } else {
            list.push({ id: "sec-buy", label: "Müşterinin Aldıkları" });
        }
        list.push(
            { id: "sec-limits", label: "Kullanım Limitleri" },
            { id: "sec-customers", label: "Müşteriler" },
            { id: "sec-settings", label: "Ayarlar" },
            { id: "sec-dates", label: "Aktif Tarihler" }
        );
        return list;
    }, [showValue, isBuyX, form.discountType]);

    const productOptions = useMemo(
        () =>
            products.map((p) => ({
                id: String(p._id),
                label: p.title || p.name || String(p._id),
            })),
        [products]
    );

    const brandOptions = useMemo(
        () => brands.map((b) => ({ id: String(b._id), label: b.name || String(b._id) })),
        [brands]
    );

    const tagOptions = useMemo(
        () => tags.map((t) => ({ id: String(t._id), label: t.name || String(t._id) })),
        [tags]
    );

    const groupOptions = useMemo(
        () => groups.map((g) => ({ id: g.name, label: g.name })),
        [groups]
    );

    const customerOptions = useMemo(
        () =>
            customers.map((c) => ({
                id: String(c._id),
                label: [customerFullName(c), c.email].filter(Boolean).join(" — "),
            })),
        [customers]
    );

    const categoryNameById = useMemo(
        () => new Map(categoriesFlat.map((c) => [String(c._id), c.name])),
        [categoriesFlat]
    );

    const targetAddLabel =
        form.buyRuleTarget === "categories"
            ? "Kategori Ekle"
            : form.buyRuleTarget === "brands"
              ? "Marka Seç"
              : form.buyRuleTarget === "tags"
                ? "Etiket Seç"
                : "Ürün Ekle";

    const orderLimitInfo = useMemo(() => {
        const min = form.buyRequirementMode === "amount" ? form.requirements.minPurchaseAmount : 0;
        const limit = form.settings.perOrderLimit || 1;
        if (!form.settings.perOrderLimitEnabled) {
            return "Sipariş başına kullanım limiti belirlemediğinizde her minimum tutar için kampanya geçerli olacaktır. Örneğin; minimum tutar karşılandığında aşağıda belirtilen ödül birden fazla kez kazanılabilir.";
        }
        return `Minimum ${fmtTry(min)} satın alma tutarına sahip müşteriler sipariş başına en fazla ${limit} kez bu kampanyadan yararlanabilir.`;
    }, [form.buyRequirementMode, form.requirements.minPurchaseAmount, form.settings.perOrderLimitEnabled, form.settings.perOrderLimit]);

    const save = async () => {
        if (!form.title.trim()) {
            setError("İndirim başlığı gerekli");
            return;
        }
        if (!form.code.trim()) {
            setError("İndirim kodu gerekli");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = buildCouponPayload(form);
            if (isEdit) {
                await updateStoreCampaign(campaignId, payload);
            } else {
                const res = await createStoreCampaign(payload);
                onNavigate?.(`ec-campaign-edit-${res.campaign._id}`);
            }
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!isEdit) return;
        if (!window.confirm(`"${form.title}" silinsin mi?`)) return;
        try {
            await deleteStoreCampaign(campaignId);
            onNavigate?.("ec-discounts-coupons");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    const goBack = () => onNavigate?.("ec-discounts-coupons");

    const mergeProductIds = (ids, addId) => [...new Set([...ids.map(String), String(addId)])];

    const addRuleProduct = (product) => {
        setRuleValues(mergeProductIds(ruleValues, product._id));
    };

    const addRewardProduct = (product) => {
        setNested("extraDiscounts", {
            rewardProductIds: mergeProductIds(form.extraDiscounts.rewardProductIds, product._id),
        });
    };

    const openTargetPicker = () => {
        if (form.buyRuleTarget === "products") setProductPicker("rule");
        else if (form.buyRuleTarget === "categories") setCategoryPickerOpen(true);
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    return (
        <div className="ec-prod-page ec-purchase-page ec-purchase-form-page ec-discount-form-page">
            <div className="ec-prod-form-shell">
                <header className="ec-prod-form-topbar ec-purchase-form-topbar ec-cat-form-topbar">
                    <div className="ec-prod-form-topbar__left">
                        <button type="button" className="ec-prod-icon-btn" onClick={goBack}>
                            <FaArrowLeft />
                        </button>
                        <nav className="ec-prod-breadcrumb">
                            <button type="button" className="ec-prod-breadcrumb__link" onClick={goBack}>
                                Kuponlar
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{isEdit ? form.title || "Düzenle" : "Kupon Ekle"}</span>
                        </nav>
                        {isEdit && form.title && <strong className="ec-cat-form-title">{form.title}</strong>}
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
                            disabled={saving || !form.title.trim()}
                            onClick={save}
                        >
                            {saving ? "Kaydediliyor…" : "Kaydet"}
                        </button>
                    </div>
                </header>

                <CampaignFormAnchors anchors={anchors} />

                {error && <div className="ec-purchase-form-error">{error}</div>}

                <div className="ec-prod-form-body ec-discount-form-body">
                    <section id="sec-title" className="ec-prod-section">
                        <h2>Başlık</h2>
                        <div className="ec-prod-field ec-prod-field--full">
                            <label>İndirim Başlığı *</label>
                            <input
                                value={form.title}
                                maxLength={TITLE_MAX}
                                placeholder="ör. Yeni yıl kuponu"
                                onChange={(e) => setField({ title: e.target.value })}
                            />
                            <p className="ec-prod-muted">
                                Müşteriler bu başlığı alışveriş sepetinde ve ödeme sırasında görecektir.
                            </p>
                        </div>
                        <div className="ec-prod-field ec-prod-field--full">
                            <label>İndirim Kodu *</label>
                            <input
                                value={form.code}
                                maxLength={CODE_MAX}
                                placeholder="SOVOL3D"
                                onChange={(e) =>
                                    setField({ code: e.target.value.toUpperCase().slice(0, CODE_MAX) })
                                }
                            />
                        </div>
                    </section>

                    <section id="sec-type" className="ec-prod-section">
                        <h2>
                            İndirim Türü{" "}
                            <FaInfoCircle className="ec-coupon-info-icon" title="Kupon indirim türü" />
                        </h2>
                        <CampaignOptionGrid
                            options={discountTypeOptions}
                            value={form.discountType}
                            onChange={(discountType) => setField({ discountType })}
                            columns={4}
                        />
                    </section>

                    {showValue && (
                        <section id="sec-value" className="ec-prod-section">
                            <h2>{form.discountType === "fixed" ? "İndirim Tutarı" : "İndirim Oranı"}</h2>
                            <div className="ec-prod-field">
                                <label>
                                    {form.discountType === "fixed" ? "İndirim Tutarı *" : "İndirim Oranı *"}
                                </label>
                                <div className="ec-discount-value-input">
                                    <span>{form.discountType === "fixed" ? "₺" : "%"}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={form.discountValue}
                                        onChange={(e) =>
                                            setField({ discountValue: Number(e.target.value) || 0 })
                                        }
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    <section id="sec-extras" className="ec-prod-section">
                        <h2>Ek İndirimler</h2>
                        <div className="ec-coupon-extras-box">
                            {form.discountType !== "free_shipping" && (
                                <RequirementToggle
                                    checked={form.extraDiscounts.freeShippingOnCode}
                                    onChange={(e) =>
                                        setNested("extraDiscounts", {
                                            freeShippingOnCode: e.target.checked,
                                        })
                                    }
                                    label="Kargo Ücretsiz Olsun"
                                    hint="İndirim kodu girildiğinde kargoyu ücretsiz yap"
                                />
                            )}
                            <RequirementToggle
                                checked={form.extraDiscounts.addRewardProduct}
                                onChange={(e) =>
                                    setNested("extraDiscounts", { addRewardProduct: e.target.checked })
                                }
                                label="Sepete İndirimli Ürün Ekle"
                                hint="İndirim kodu girildiğinde sepete ücretsiz veya indirimli ürün ekle"
                            >
                                <div className="ec-coupon-extras-reward">
                                    <button
                                        type="button"
                                        className="ec-prod-btn ec-prod-btn--primary"
                                        onClick={() => setProductPicker("reward")}
                                    >
                                        Ürün Ekle
                                    </button>
                                    {form.extraDiscounts.rewardProductIds.length > 0 && (
                                        <ul className="ec-coupon-selected-chips">
                                            {form.extraDiscounts.rewardProductIds.map((id) => {
                                                const p = products.find((x) => String(x._id) === String(id));
                                                return (
                                                    <li key={id}>
                                                        <span>{p?.title || id}</span>
                                                        <button
                                                            type="button"
                                                            aria-label="Kaldır"
                                                            onClick={() =>
                                                                setNested("extraDiscounts", {
                                                                    rewardProductIds:
                                                                        form.extraDiscounts.rewardProductIds.filter(
                                                                            (x) => String(x) !== String(id)
                                                                        ),
                                                                })
                                                            }
                                                        >
                                                            ×
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </RequirementToggle>
                        </div>
                    </section>

                    {!isBuyX && (
                        <section id="sec-buy" className="ec-prod-section">
                            <h2>Müşterinin Aldıkları</h2>
                            <p className="ec-prod-muted">
                                Kampanya, müşterinin sepette aşağıdaki şartlar sağlandığında geçerli olacaktır.
                            </p>
                            <CampaignOptionGrid
                                options={[
                                    {
                                        id: "quantity",
                                        label: "Minimum ürün adedi",
                                        icon: <FaShoppingBag />,
                                    },
                                    {
                                        id: "amount",
                                        label: "Minimum satın alma tutarı",
                                        icon: <FaShoppingCart />,
                                    },
                                ]}
                                value={form.buyRequirementMode}
                                onChange={(buyRequirementMode) => setField({ buyRequirementMode })}
                                columns={2}
                            />
                            <div className="ec-coupon-buy-panel">
                                <div className="ec-coupon-buy-panel__cols">
                                    <div className="ec-coupon-buy-panel__col">
                                        {form.buyRequirementMode === "quantity" ? (
                                            <>
                                                <div className="ec-prod-field">
                                                    <label>Adet *</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={form.requirements.minQuantity}
                                                        onChange={(e) =>
                                                            setNested("requirements", {
                                                                minQuantity: Number(e.target.value) || 0,
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <label className="ec-discount-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.requirements.maxQuantityEnabled}
                                                        onChange={(e) =>
                                                            setNested("requirements", {
                                                                maxQuantityEnabled: e.target.checked,
                                                                maxQuantity: e.target.checked
                                                                    ? form.requirements.maxQuantity ?? 0
                                                                    : null,
                                                            })
                                                        }
                                                    />
                                                    Maksimum ürün adedi belirle
                                                </label>
                                                {form.requirements.maxQuantityEnabled && (
                                                    <div className="ec-prod-field">
                                                        <label>Maksimum adet</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={form.requirements.maxQuantity ?? ""}
                                                            onChange={(e) =>
                                                                setNested("requirements", {
                                                                    maxQuantity:
                                                                        Number(e.target.value) || 0,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className="ec-prod-field">
                                                    <label>Satın Alma Tutarı *</label>
                                                    <div className="ec-discount-value-input">
                                                        <span>₺</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={form.requirements.minPurchaseAmount}
                                                            onChange={(e) =>
                                                                setNested("requirements", {
                                                                    minPurchaseAmount:
                                                                        Number(e.target.value) || 0,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                                <label className="ec-discount-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.requirements.maxPurchaseAmountEnabled}
                                                        onChange={(e) =>
                                                            setNested("requirements", {
                                                                maxPurchaseAmountEnabled: e.target.checked,
                                                                maxPurchaseAmount: e.target.checked
                                                                    ? form.requirements.maxPurchaseAmount ?? 0
                                                                    : null,
                                                            })
                                                        }
                                                    />
                                                    Maksimum ürün satın alma tutarı belirle
                                                </label>
                                                {form.requirements.maxPurchaseAmountEnabled && (
                                                    <div className="ec-prod-field">
                                                        <label>Maksimum tutar (₺)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={form.requirements.maxPurchaseAmount ?? ""}
                                                            onChange={(e) =>
                                                                setNested("requirements", {
                                                                    maxPurchaseAmount:
                                                                        Number(e.target.value) || 0,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {form.buyRequirementMode === "amount" && (
                                        <div className="ec-coupon-buy-panel__col ec-coupon-buy-panel__col--limit">
                                            <RequirementToggle
                                                checked={form.settings.perOrderLimitEnabled}
                                                onChange={(e) =>
                                                    setNested("settings", {
                                                        perOrderLimitEnabled: e.target.checked,
                                                    })
                                                }
                                                label="Sipariş başına limit belirle"
                                            >
                                                <div className="ec-prod-field ec-discount-limit-field">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={form.settings.perOrderLimit}
                                                        onChange={(e) =>
                                                            setNested("settings", {
                                                                perOrderLimit: Number(e.target.value) || 1,
                                                            })
                                                        }
                                                    />
                                                </div>
                                            </RequirementToggle>
                                            <div
                                                className={`ec-coupon-info-box${form.settings.perOrderLimitEnabled ? "" : " ec-coupon-info-box--warn"}`}
                                            >
                                                {orderLimitInfo}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="ec-coupon-target-row">
                                    <EcSelect
                                        value={form.buyRuleTarget}
                                        onChange={(e) =>
                                            setField({
                                                buyRuleTarget: e.target.value,
                                                productRules: [],
                                            })
                                        }
                                    >
                                        {TARGET_OPTIONS.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </EcSelect>
                                    {(form.buyRuleTarget === "products" ||
                                        form.buyRuleTarget === "categories") && (
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary"
                                            onClick={openTargetPicker}
                                        >
                                            {targetAddLabel}
                                        </button>
                                    )}
                                </div>
                                {form.buyRuleTarget === "brands" && (
                                    <EcMultiPicker
                                        label="Markalar"
                                        placeholder="Marka ara veya seçin"
                                        options={brandOptions}
                                        value={ruleValues}
                                        onChange={setRuleValues}
                                    />
                                )}
                                {form.buyRuleTarget === "tags" && (
                                    <EcMultiPicker
                                        label="Etiketler"
                                        placeholder="Etiket ara veya seçin"
                                        options={tagOptions}
                                        value={ruleValues}
                                        onChange={setRuleValues}
                                    />
                                )}
                                {(form.buyRuleTarget === "products" ||
                                    form.buyRuleTarget === "categories") &&
                                    ruleValues.length > 0 && (
                                        <ul className="ec-coupon-selected-chips">
                                            {ruleValues.map((id) => {
                                                const label =
                                                    form.buyRuleTarget === "products"
                                                        ? products.find((p) => String(p._id) === String(id))
                                                              ?.title
                                                        : categoryNameById.get(String(id)) || id;
                                                return (
                                                    <li key={id}>
                                                        <span>{label || id}</span>
                                                        <button
                                                            type="button"
                                                            aria-label="Kaldır"
                                                            onClick={() =>
                                                                setRuleValues(
                                                                    ruleValues.filter(
                                                                        (x) => String(x) !== String(id)
                                                                    )
                                                                )
                                                            }
                                                        >
                                                            ×
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                            </div>
                            <label className="ec-discount-check">
                                <input
                                    type="checkbox"
                                    checked={form.includeDiscountedProducts}
                                    onChange={(e) =>
                                        setField({ includeDiscountedProducts: e.target.checked })
                                    }
                                />
                                İndirimli ürünleri kampanyaya dahil et
                            </label>
                            <fieldset className="ec-coupon-price-basis">
                                <legend>Uygulanacak Fiyat</legend>
                                <label className="ec-discount-radio">
                                    <input
                                        type="radio"
                                        name="priceBasis"
                                        checked={form.priceBasis === "sale"}
                                        onChange={() => setField({ priceBasis: "sale" })}
                                    />
                                    Satış Fiyatı Üstünden
                                </label>
                                <label className="ec-discount-radio">
                                    <input
                                        type="radio"
                                        name="priceBasis"
                                        checked={form.priceBasis === "discounted"}
                                        onChange={() => setField({ priceBasis: "discounted" })}
                                    />
                                    İndirimli Fiyat Üstünden
                                </label>
                            </fieldset>
                        </section>
                    )}

                    {isBuyX && (
                        <>
                            <section id="sec-buy" className="ec-prod-section">
                                <h2>Müşterinin Aldıkları</h2>
                                <p className="ec-prod-muted">
                                    Kampanya, müşterinin sepette aşağıdaki şartlar sağlandığında geçerli
                                    olacaktır.
                                </p>
                                <CampaignOptionGrid
                                    options={[
                                        { id: "quantity", label: "Minimum ürün adedi", icon: <FaBox /> },
                                        {
                                            id: "amount",
                                            label: "Minimum satın alma tutarı",
                                            icon: <FaShoppingCart />,
                                        },
                                    ]}
                                    value={form.buyXGetY.buyCondition}
                                    onChange={(buyCondition) => setNested("buyXGetY", { buyCondition })}
                                    columns={2}
                                />
                                <div className="ec-coupon-buy-panel">
                                    {form.buyXGetY.buyCondition === "quantity" ? (
                                        <div className="ec-prod-field">
                                            <label>Adet *</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={form.buyXGetY.buyQuantity}
                                                onChange={(e) =>
                                                    setNested("buyXGetY", {
                                                        buyQuantity: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <div className="ec-prod-field">
                                            <label>Satın Alma Tutarı *</label>
                                            <div className="ec-discount-value-input">
                                                <span>₺</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={form.buyXGetY.buyAmount}
                                                    onChange={(e) =>
                                                        setNested("buyXGetY", {
                                                            buyAmount: Number(e.target.value) || 0,
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="ec-coupon-target-row">
                                        <EcSelect value="products" disabled>
                                            <option value="products">Ürünler</option>
                                        </EcSelect>
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary"
                                            onClick={() => setProductPicker("buyX")}
                                        >
                                            Ürün Ekle
                                        </button>
                                    </div>
                                    {(form.buyXGetY.buyProductIds || []).length > 0 && (
                                        <EcMultiPicker
                                            label="Seçili ürünler"
                                            placeholder="Ürün"
                                            options={productOptions}
                                            value={form.buyXGetY.buyProductIds || []}
                                            onChange={(buyProductIds) =>
                                                setNested("buyXGetY", { buyProductIds })
                                            }
                                        />
                                    )}
                                </div>
                                <label className="ec-discount-check">
                                    <input
                                        type="checkbox"
                                        checked={form.includeDiscountedProducts}
                                        onChange={(e) =>
                                            setField({ includeDiscountedProducts: e.target.checked })
                                        }
                                    />
                                    İndirimli ürünleri kampanyaya dahil et
                                </label>
                            </section>

                            <section id="sec-get" className="ec-prod-section">
                                <h2>Müşterinin Kazandıkları</h2>
                                <p className="ec-prod-muted">
                                    Müşterinin sepet koşullarını sağladığında kazanabileceklerini belirleyin.
                                </p>
                                <div className="ec-coupon-buy-panel">
                                    <div className="ec-prod-seo-split">
                                        <div className="ec-prod-field">
                                            <label>Adet *</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={form.buyXGetY.getQuantity}
                                                onChange={(e) =>
                                                    setNested("buyXGetY", {
                                                        getQuantity: Number(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </div>
                                        <div className="ec-prod-field">
                                            <label>İndirim Oranı *</label>
                                            <div className="ec-discount-value-input">
                                                <span>%</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    disabled={form.buyXGetY.getFree}
                                                    value={form.buyXGetY.getDiscountPercent}
                                                    onChange={(e) =>
                                                        setNested("buyXGetY", {
                                                            getDiscountPercent:
                                                                Number(e.target.value) || 0,
                                                        })
                                                    }
                                                />
                                            </div>
                                            <label className="ec-discount-check">
                                                <input
                                                    type="checkbox"
                                                    checked={form.buyXGetY.getFree}
                                                    onChange={(e) =>
                                                        setNested("buyXGetY", { getFree: e.target.checked })
                                                    }
                                                />
                                                Ücretsiz
                                            </label>
                                        </div>
                                    </div>
                                    <div className="ec-coupon-target-row">
                                        <EcSelect value="products" disabled>
                                            <option value="products">Ürünler</option>
                                        </EcSelect>
                                        <button
                                            type="button"
                                            className="ec-prod-btn ec-prod-btn--primary"
                                            onClick={() => setProductPicker("getX")}
                                        >
                                            Ürün Ekle
                                        </button>
                                    </div>
                                    {(form.buyXGetY.getProductIds || []).length > 0 && (
                                        <EcMultiPicker
                                            label="Kazanılacak ürünler"
                                            placeholder="Ürün"
                                            options={productOptions}
                                            value={form.buyXGetY.getProductIds || []}
                                            onChange={(getProductIds) =>
                                                setNested("buyXGetY", { getProductIds })
                                            }
                                        />
                                    )}
                                </div>
                                <label className="ec-discount-check">
                                    <input
                                        type="checkbox"
                                        checked={form.buyXGetY.autoAddToCart}
                                        onChange={(e) =>
                                            setNested("buyXGetY", { autoAddToCart: e.target.checked })
                                        }
                                    />
                                    Şartlar sağlanırsa ürünü otomatik olarak sepete ekle
                                </label>
                            </section>
                        </>
                    )}

                    <section id="sec-limits" className="ec-prod-section">
                        <h2>Kullanım Limitleri</h2>
                        <div className="ec-coupon-extras-box">
                            <RequirementToggle
                                checked={form.usageLimits.totalEnabled}
                                onChange={(e) =>
                                    setNested("usageLimits", { totalEnabled: e.target.checked })
                                }
                                label="Toplam kullanım limiti belirle"
                                hint="Toplamda kaç kere kullanılabileceğini kısıtlayın"
                            >
                                <p className="ec-discount-inline-limit">
                                    İndirim toplamda
                                    <span className="ec-discount-inline-limit__field">
                                        <input
                                            type="number"
                                            min={1}
                                            value={form.usageLimits.totalLimit ?? ""}
                                            onChange={(e) =>
                                                setNested("usageLimits", {
                                                    totalLimit: Number(e.target.value) || null,
                                                })
                                            }
                                        />
                                    </span>
                                    kez kullanılabilir
                                </p>
                            </RequirementToggle>
                            {form.usageLimits.totalEnabled && form.usageLimits.perUserEnabled && (
                                <span className="ec-coupon-and-badge">VE</span>
                            )}
                            <RequirementToggle
                                checked={form.usageLimits.perUserEnabled}
                                onChange={(e) =>
                                    setNested("usageLimits", { perUserEnabled: e.target.checked })
                                }
                                label="Kullanıcı başına limit belirle"
                                hint="Bir müşteri tarafından kaç kere kullanılabileceğini kısıtlayın"
                            >
                                <p className="ec-discount-inline-limit">
                                    Bir kişi maksimum
                                    <span className="ec-discount-inline-limit__field">
                                        <input
                                            type="number"
                                            min={1}
                                            value={form.usageLimits.perUserLimit ?? ""}
                                            onChange={(e) =>
                                                setNested("usageLimits", {
                                                    perUserLimit: Number(e.target.value) || null,
                                                })
                                            }
                                        />
                                    </span>
                                    kez indirim kullanabilir
                                </p>
                            </RequirementToggle>
                        </div>
                    </section>

                    <section id="sec-customers" className="ec-prod-section">
                        <h2>Müşteriler</h2>
                        <CampaignOptionGrid
                            options={customerScopeOptions}
                            value={form.customers.scope}
                            onChange={(scope) => setNested("customers", { scope })}
                            columns={3}
                        />
                        {form.customers.scope === "groups" && (
                            <EcMultiPicker
                                label="Müşteri Grubu ve Segmentleri *"
                                placeholder="Grup ara veya seçin"
                                options={groupOptions}
                                value={form.customers.groupNames}
                                onChange={(groupNames) => setNested("customers", { groupNames })}
                            />
                        )}
                        {form.customers.scope === "specific" && (
                            <EcMultiPicker
                                label="Spesifik Müşteri *"
                                placeholder="Müşteri ara veya seçin"
                                options={customerOptions}
                                value={form.customers.customerIds}
                                onChange={(customerIds) => setNested("customers", { customerIds })}
                            />
                        )}
                        <label className="ec-discount-check">
                            <input
                                type="checkbox"
                                checked={form.customers.accountOnly}
                                onChange={(e) => setNested("customers", { accountOnly: e.target.checked })}
                            />
                            Kampanyadan sadece müşteri hesabı olanlar yararlanabilsin
                        </label>
                    </section>

                    <section id="sec-settings" className="ec-prod-section">
                        <h2>Ayarlar</h2>
                        <RequirementToggle
                            checked={form.settings.combineWithOthers}
                            onChange={(e) =>
                                setNested("settings", { combineWithOthers: e.target.checked })
                            }
                            label="Diğer kampanyalarla birleştirilsin"
                            hint="Bu kampanya diğer kampanyalarla birleştirilebilir olsun"
                        />
                        <RequirementToggle
                            checked={form.settings.channelsEnabled}
                            onChange={(e) =>
                                setNested("settings", { channelsEnabled: e.target.checked })
                            }
                            label="Satış kanallarını ve kurları belirle"
                            hint="Bu kampanyanın kullanılabileceği satış kanallarını ve kurları kısıtlayın"
                        >
                            <div className="ec-discount-settings-pickers">
                                <EcSalesChannelPicker
                                    channels={channels}
                                    hasStorefront={hasStorefront}
                                    value={form.settings.salesChannelIds}
                                    onChange={(salesChannelIds) =>
                                        setNested("settings", { salesChannelIds })
                                    }
                                    onNavigate={onNavigate}
                                />
                                <EcCurrencyPicker
                                    value={form.settings.currencies}
                                    onChange={(currencies) => setNested("settings", { currencies })}
                                />
                            </div>
                        </RequirementToggle>
                    </section>

                    <section id="sec-dates" className="ec-prod-section">
                        <h2>Aktif Tarihler</h2>
                        <RequirementToggle
                            checked={form.dates.startEnabled}
                            onChange={(e) => setNested("dates", { startEnabled: e.target.checked })}
                            label="Başlangıç tarihi ekle"
                        >
                            <input
                                type="datetime-local"
                                value={form.dates.startDate}
                                onChange={(e) => setNested("dates", { startDate: e.target.value })}
                            />
                        </RequirementToggle>
                        <RequirementToggle
                            checked={form.dates.endEnabled}
                            onChange={(e) => setNested("dates", { endEnabled: e.target.checked })}
                            label="Bitiş tarihi ekle"
                        >
                            <input
                                type="datetime-local"
                                value={form.dates.endDate}
                                onChange={(e) => setNested("dates", { endDate: e.target.value })}
                            />
                        </RequirementToggle>
                    </section>
                </div>
            </div>

            <CartLinkProductPickerModal
                open={!!productPicker}
                onClose={() => setProductPicker(null)}
                products={products}
                existingProductIds={
                    productPicker === "reward"
                        ? form.extraDiscounts.rewardProductIds
                        : productPicker === "rule"
                          ? ruleValues
                          : productPicker === "buyX"
                            ? form.buyXGetY.buyProductIds || []
                            : productPicker === "getX"
                              ? form.buyXGetY.getProductIds || []
                              : []
                }
                onAdd={(product) => {
                    if (productPicker === "reward") addRewardProduct(product);
                    else if (productPicker === "rule") addRuleProduct(product);
                    else if (productPicker === "buyX") {
                        setNested("buyXGetY", {
                            buyProductIds: mergeProductIds(
                                form.buyXGetY.buyProductIds || [],
                                product._id
                            ),
                        });
                    } else if (productPicker === "getX") {
                        setNested("buyXGetY", {
                            getProductIds: mergeProductIds(
                                form.buyXGetY.getProductIds || [],
                                product._id
                            ),
                        });
                    }
                }}
            />

            <CampaignCategoryPickerModal
                open={categoryPickerOpen}
                onClose={() => setCategoryPickerOpen(false)}
                selectedIds={ruleValues}
                onSave={(ids) => setRuleValues(ids)}
            />
        </div>
    );
};

export default EcommerceCouponFormPage;
