import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaPercent,
    FaMoneyBillWave,
    FaTruck,
    FaGift,
    FaTrash,
    FaBox,
    FaFilter,
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
import CampaignProductRulesEditor, {
    normalizeProductRulesForForm,
} from "./CampaignProductRulesEditor";
import CampaignFormAnchors from "./CampaignFormAnchors";
import EcMultiPicker from "../../../components/ecommerce/EcMultiPicker";
import EcSalesChannelPicker from "./EcSalesChannelPicker";
import EcCurrencyPicker from "./EcCurrencyPicker";
import {
    emptyCampaignForm,
    campaignToForm,
    formToCampaignPayload,
    productRulesForPayload,
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

const ANCHORS_AUTO = [
    { id: "sec-title", label: "Başlık" },
    { id: "sec-type", label: "İndirim Türü" },
    { id: "sec-value", label: "İndirim Oranı" },
    { id: "sec-scope", label: "Koşullar" },
    { id: "sec-requirements", label: "Gereksinimler" },
    { id: "sec-limits", label: "Kullanım Limitleri" },
    { id: "sec-customers", label: "Müşteriler" },
    { id: "sec-settings", label: "Ayarlar" },
    { id: "sec-dates", label: "Aktif Tarihler" },
];

const ANCHORS_BUY = [
    { id: "sec-title", label: "Başlık" },
    { id: "sec-type", label: "İndirim Türü" },
    { id: "sec-buy", label: "Müşterinin Aldıkları" },
    { id: "sec-get", label: "Müşterinin Kazandıkları" },
    { id: "sec-limits", label: "Kullanım Limitleri" },
    { id: "sec-customers", label: "Müşteriler" },
    { id: "sec-settings", label: "Ayarlar" },
    { id: "sec-dates", label: "Aktif Tarihler" },
];

const discountTypeOptions = [
    { id: "percentage", label: "Yüzdelik", icon: <FaPercent /> },
    { id: "fixed", label: "Sabit Tutar", icon: <FaMoneyBillWave /> },
    { id: "free_shipping", label: "Ücretsiz Kargo", icon: <FaTruck /> },
    { id: "buy_x_get_y", label: "X Al Y Kazan", icon: <FaGift /> },
];

const scopeOptions = [
    { id: "all_products", label: "Tüm Ürünler", icon: <FaBox /> },
    { id: "specific_products", label: "Belirli Ürünler", icon: <FaFilter /> },
];

const customerScopeOptions = [
    { id: "all", label: "Tüm Kişiler", icon: <FaUser /> },
    { id: "groups", label: "Müşteri Grubu & Segment", icon: <FaUsers /> },
    { id: "specific", label: "Spesifik Müşteriler", icon: <FaMousePointer /> },
];

const EcommerceCampaignFormPage = ({ campaignId, initialKind = "automatic", onNavigate }) => {
    const isEdit = !!campaignId;
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState(() => emptyCampaignForm(initialKind));
    const [products, setProducts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [channels, setChannels] = useState([]);
    const [hasStorefront, setHasStorefront] = useState(false);
    const [brands, setBrands] = useState([]);
    const [tags, setTags] = useState([]);
    const [categoriesFlat, setCategoriesFlat] = useState([]);

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
            setForm(emptyCampaignForm(initialKind));
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await fetchStoreCampaign(campaignId);
            setForm(campaignToForm(res.campaign));
        } catch (e) {
            setError(e.response?.data?.error || e.message || "Yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [campaignId, initialKind, isEdit, loadMeta]);

    useEffect(() => {
        load();
    }, [load]);

    const anchors = useMemo(() => {
        if (form.discountType === "buy_x_get_y") return ANCHORS_BUY;
        return ANCHORS_AUTO.map((a) =>
            a.id === "sec-value"
                ? {
                      ...a,
                      label:
                          form.discountType === "fixed"
                              ? "İndirim Tutarı"
                              : form.discountType === "free_shipping"
                                ? "Kargo"
                                : "İndirim Oranı",
                  }
                : a
        ).filter((a) => form.discountType !== "free_shipping" || a.id !== "sec-value");
    }, [form.discountType]);

    const isCode = form.kind === "code";
    const isBuyX = form.discountType === "buy_x_get_y";
    const listPanel = isCode ? "ec-discounts-coupons" : "ec-discounts-campaigns";
    const createLabel = isCode ? "İndirim Kodu Ekle" : "Otomatik İndirim Ekle";

    const save = async () => {
        if (!form.title.trim()) {
            setError("İndirim başlığı gerekli");
            return;
        }
        if (isCode && !form.code.trim()) {
            setError("İndirim kodu gerekli");
            return;
        }
        if (
            !isBuyX &&
            form.scope === "specific_products" &&
            productRulesForPayload(form).length === 0
        ) {
            setError("Belirli ürünler için en az bir koşul seçin");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const payload = formToCampaignPayload(form);
            if (isEdit) {
                await updateStoreCampaign(campaignId, payload);
                onNavigate?.(`ec-campaign-edit-${campaignId}`);
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
            onNavigate?.(listPanel);
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    const goBack = () => onNavigate?.(listPanel);

    const productOptions = useMemo(
        () =>
            products.map((p) => ({
                id: String(p._id),
                label: p.title || p.name || String(p._id),
            })),
        [products]
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
        () => new Map(categoriesFlat.map((c) => [String(c._id), c.path || c.name || String(c._id)])),
        [categoriesFlat]
    );

    const brandOptions = useMemo(
        () => brands.map((b) => ({ id: String(b._id), label: b.name || String(b._id) })),
        [brands]
    );

    const tagOptions = useMemo(
        () => tags.map((t) => ({ id: String(t._id), label: t.name || String(t._id) })),
        [tags]
    );

    const onScopeChange = (scope) => {
        if (scope === "specific_products") {
            setField({
                scope,
                productRules: normalizeProductRulesForForm(form.productRules),
            });
        } else {
            setField({ scope, productRules: [] });
        }
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
                                İndirimler
                            </button>
                            <span className="ec-prod-breadcrumb__sep">&gt;</span>
                            <span>{isEdit ? form.title || "Düzenle" : createLabel}</span>
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
                                placeholder="ör. Yeni yıl indirimi"
                                onChange={(e) => setField({ title: e.target.value })}
                            />
                            <p className="ec-prod-muted">
                                Müşteriler bu başlığı alışveriş sepetinde ve ödeme sırasında görecektir.
                            </p>
                        </div>
                        {isCode && (
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
                        )}
                    </section>

                    <section id="sec-type" className="ec-prod-section">
                        <h2>İndirim Türü</h2>
                        <CampaignOptionGrid
                            options={discountTypeOptions}
                            value={form.discountType}
                            onChange={(discountType) => setField({ discountType })}
                        />
                    </section>

                    {!isBuyX && form.discountType !== "free_shipping" && (
                        <section id="sec-value" className="ec-prod-section">
                            <h2>{form.discountType === "fixed" ? "İndirim Tutarı" : "İndirim Oranı"}</h2>
                            <div className="ec-prod-field">
                                <label>{form.discountType === "fixed" ? "İndirim Tutarı *" : "İndirim Oranı *"}</label>
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

                    {!isBuyX && (
                        <section id="sec-scope" className="ec-prod-section">
                            <h2>
                                Koşullar{" "}
                                <FaInfoCircle
                                    className="ec-coupon-info-icon"
                                    title="Kampanyanın geçerli olacağı ürünleri belirleyin"
                                />
                            </h2>
                            <div className="ec-discount-scope-block">
                                <CampaignOptionGrid
                                    options={scopeOptions}
                                    value={form.scope}
                                    onChange={onScopeChange}
                                    columns={2}
                                />
                                {form.scope === "specific_products" && (
                                    <CampaignProductRulesEditor
                                        rules={form.productRules}
                                        onChange={(productRules) => setField({ productRules })}
                                        products={products}
                                        categoryNameById={categoryNameById}
                                        brandOptions={brandOptions}
                                        tagOptions={tagOptions}
                                    />
                                )}
                            </div>
                            <label className="ec-discount-check ec-discount-scope-check">
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
                    )}

                    {!isBuyX && (
                        <section id="sec-requirements" className="ec-prod-section">
                            <h2>Gereksinimler</h2>
                            <p className="ec-prod-muted">
                                Kampanya, müşterinin sepetinde aşağıdaki şartları sağlarsa uygulanacaktır.
                            </p>
                            <RequirementToggle
                                checked={form.requirements.limitPurchaseAmount}
                                onChange={(e) =>
                                    setNested("requirements", { limitPurchaseAmount: e.target.checked })
                                }
                                label="Satın alma tutarını sınırla"
                                hint="Sepetteki toplam satın alma tutarına uygulanacak sınırları belirleyin."
                            >
                                <div className="ec-prod-seo-split">
                                    <div className="ec-prod-field">
                                        <label>Minimum tutar (₺)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={form.requirements.minPurchaseAmount}
                                            onChange={(e) =>
                                                setNested("requirements", {
                                                    minPurchaseAmount: Number(e.target.value) || 0,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </RequirementToggle>
                            <RequirementToggle
                                checked={form.requirements.limitQuantity}
                                onChange={(e) =>
                                    setNested("requirements", { limitQuantity: e.target.checked })
                                }
                                label="Ürün adetini sınırla"
                                hint="Sepetteki toplam ürün adet sayısına uygulanacak sınırları belirleyin."
                            >
                                <div className="ec-prod-field">
                                    <label>Minimum adet</label>
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
                            </RequirementToggle>
                        </section>
                    )}

                    {isBuyX && (
                        <>
                            <section id="sec-buy" className="ec-prod-section">
                                <h2>Müşterinin Aldıkları</h2>
                                <p className="ec-prod-muted">
                                    Kampanya, müşterinin sepette aşağıdaki şartlar sağlandığında geçerli olacaktır.
                                </p>
                                <CampaignOptionGrid
                                    options={[
                                        { id: "quantity", label: "Minimum ürün adedi", icon: <FaBox /> },
                                        { id: "amount", label: "Minimum satın alma tutarı", icon: <FaTruck /> },
                                    ]}
                                    value={form.buyXGetY.buyCondition}
                                    onChange={(buyCondition) => setNested("buyXGetY", { buyCondition })}
                                    columns={2}
                                />
                                <div className="ec-prod-seo-split">
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
                                </div>
                                <EcMultiPicker
                                    label="Ürünler (isteğe bağlı)"
                                    placeholder="Ürün ara veya seçin"
                                    options={productOptions}
                                    value={form.buyXGetY.buyProductIds || []}
                                    onChange={(buyProductIds) => setNested("buyXGetY", { buyProductIds })}
                                />
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
                                                        getDiscountPercent: Number(e.target.value) || 0,
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
                                <label className="ec-discount-check">
                                    <input
                                        type="checkbox"
                                        checked={form.buyXGetY.autoAddToCart}
                                        onChange={(e) =>
                                            setNested("buyXGetY", { autoAddToCart: e.target.checked })
                                        }
                                    />
                                    Şartlar sağlandığında ürünü otomatik olarak sepete ekle
                                </label>
                            </section>
                        </>
                    )}

                    <section id="sec-limits" className="ec-prod-section">
                        <h2>Kullanım Limitleri</h2>
                        <RequirementToggle
                            checked={form.usageLimits.totalEnabled}
                            onChange={(e) => setNested("usageLimits", { totalEnabled: e.target.checked })}
                            label="Toplam kullanım limiti belirle"
                            hint="Toplamda kaç kere kullanılabileceğini kısıtlayın."
                        >
                            <p className="ec-discount-inline-limit">
                                İndirim toplamda
                                <span className="ec-discount-inline-limit__field">
                                    <input
                                        type="number"
                                        min={1}
                                        aria-label="Toplam kullanım"
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
                        <RequirementToggle
                            checked={form.usageLimits.perUserEnabled}
                            onChange={(e) => setNested("usageLimits", { perUserEnabled: e.target.checked })}
                            label="Kullanıcı başına limit belirle"
                            hint="Her müşteri tarafından kaç kere kullanılabileceğini kısıtlayın."
                        >
                            <p className="ec-discount-inline-limit">
                                Bir kişi maksimum
                                <span className="ec-discount-inline-limit__field">
                                    <input
                                        type="number"
                                        min={1}
                                        aria-label="Kişi başına limit"
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
                                emptyTitle="Grup bulunamadı"
                                emptyHint="Önce müşteri grubu oluşturun veya listeden seçin"
                                options={groupOptions}
                                value={form.customers.groupNames}
                                onChange={(groupNames) => setNested("customers", { groupNames })}
                            />
                        )}
                        {form.customers.scope === "specific" && (
                            <EcMultiPicker
                                label="Spesifik Müşteri *"
                                placeholder="Müşteri ara veya seçin"
                                emptyTitle="Müşteri bulunamadı"
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
                        <RequirementToggle
                            checked={form.settings.perOrderLimitEnabled}
                            onChange={(e) =>
                                setNested("settings", { perOrderLimitEnabled: e.target.checked })
                            }
                            label="Sipariş başına limit belirle"
                            hint="Bir siparişte kaç kez kullanılabileceğini kısıtlayın"
                        >
                            <div className="ec-prod-field ec-discount-limit-field">
                                <label>Sipariş başına kullanım</label>
                                <div className="ec-discount-value-input ec-discount-value-input--narrow">
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
        </div>
    );
};

export default EcommerceCampaignFormPage;
