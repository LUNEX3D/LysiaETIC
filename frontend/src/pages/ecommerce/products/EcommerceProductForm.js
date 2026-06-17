import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaArrowRight } from "react-icons/fa";
import {
    fetchStore,
    fetchStoreProduct,
    createStoreProduct,
    patchStoreProduct,
    deleteStoreProduct,
} from "../../../services/storeApi";
import {
    PRODUCT_FORM_TABS_SIMPLE,
    PRODUCT_FORM_TABS_VARIANT,
    PRODUCT_FORM_TABS_EDIT_SIMPLE,
    DEFAULT_LOCATIONS,
} from "../../../constants/ecommerceProductForm";
import { DEFAULT_PRODUCT_MEASURE_UNIT } from "../../../constants/productUnitMeasures";
import { normalizeUnitPricePayload } from "../../../utils/productUnitPrice";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import ProductFormHeader, { ProductFormTabs } from "./ProductFormHeader";
import ProductFormSections from "./ProductFormSections";
import ProductTranslationsPanel from "./ProductTranslationsPanel";

const emptyForm = (type) => ({
    productType: type,
    productKind: "physical",
    saleStatus: "on_sale",
    title: "",
    price: "",
    compareAtPrice: "",
    costPrice: "",
    showUnitPrice: false,
    unitPrice: {
        productMeasureValue: "",
        productMeasureUnit: DEFAULT_PRODUCT_MEASURE_UNIT,
        soldUnitValue: "",
        soldUnitUnit: "",
    },
    description: "",
    images: [],
    videos: [],
    brand: "",
    tags: [],
    supplier: "",
    googleCategory: "",
    googleCategoryId: "",
    categories: [],
    productCategories: [],
    sku: "",
    barcode: "",
    stock: "",
    inventory: {
        desi: "",
        hsCode: "",
        continueSellingWhenOutOfStock: false,
        locations: DEFAULT_LOCATIONS.map((l) => ({ ...l })),
    },
    seo: { slug: "", metaTitle: "", metaDescription: "", noindex: false, canonicalUrl: "" },
    customFields: [],
    variantOptionGroups: [],
    variants: [],
});

const EcommerceProductForm = ({ mode, productId, onNavigate }) => {
    const isEdit = !!productId;
    const isVariantMode = mode === "variant";
    const { rootStyle, rootClassName } = useDashtockTheme();
    const bodyRef = useRef(null);
    const [tab, setTab] = useState("basic");
    const [form, setForm] = useState(emptyForm(isVariantMode ? "variant" : "simple"));
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [storeHost, setStoreHost] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [channelsOpen, setChannelsOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [channelHidden, setChannelHidden] = useState(false);
    const [channelQtyLimits, setChannelQtyLimits] = useState(false);
    const [translationsOpen, setTranslationsOpen] = useState(false);

    const isVariantProduct = isVariantMode || form.productType === "variant";
    const tabs = useMemo(() => {
        if (isEdit && !isVariantProduct) return PRODUCT_FORM_TABS_EDIT_SIMPLE;
        if (isVariantProduct) return PRODUCT_FORM_TABS_VARIANT;
        return PRODUCT_FORM_TABS_SIMPLE;
    }, [isEdit, isVariantProduct]);

    const load = useCallback(async () => {
        if (!productId) return;
        setLoading(true);
        try {
            const [res, storeRes] = await Promise.all([
                fetchStoreProduct(productId),
                fetchStore().catch(() => ({ store: null })),
            ]);
            const p = res.product;
            if (storeRes.store?.subdomain) setStoreHost(`${storeRes.store.subdomain}.dashtock.com`);
            else if (storeRes.store?.customDomain) setStoreHost(storeRes.store.customDomain);

            setForm({
                productType: p.productType || "simple",
                productKind: p.productKind || "physical",
                saleStatus: p.saleStatus || "on_sale",
                title: p.title || "",
                price: p.price ?? "",
                compareAtPrice: p.compareAtPrice ?? "",
                costPrice: p.costPrice ?? "",
                showUnitPrice: !!p.showUnitPrice,
                unitPrice: {
                    productMeasureValue: p.unitPrice?.productMeasureValue ?? "",
                    productMeasureUnit: p.unitPrice?.productMeasureUnit || DEFAULT_PRODUCT_MEASURE_UNIT,
                    soldUnitValue: p.unitPrice?.soldUnitValue ?? "",
                    soldUnitUnit: p.unitPrice?.soldUnitUnit || "",
                },
                description: p.description || "",
                images: p.images || [],
                videos: p.videos || [],
                brand: p.brand || "",
                tags: p.tags || [],
                supplier: p.supplier || "",
                googleCategory: p.googleCategory || "",
                googleCategoryId: p.googleCategoryId ?? "",
                categories: p.categories || [],
                productCategories: p.productCategories || [],
                sku: p.sku || "",
                barcode: p.barcode || "",
                stock: p.stock ?? "",
                inventory: {
                    desi: p.inventory?.desi ?? "",
                    hsCode: p.inventory?.hsCode || "",
                    continueSellingWhenOutOfStock: !!p.inventory?.continueSellingWhenOutOfStock,
                    locations: p.inventory?.locations?.length
                        ? p.inventory.locations
                        : DEFAULT_LOCATIONS.map((l) => ({ ...l })),
                },
                seo: {
                    slug: p.seo?.slug || p.slug || "",
                    metaTitle: p.seo?.metaTitle || "",
                    metaDescription: p.seo?.metaDescription || "",
                    noindex: !!p.seo?.noindex,
                    canonicalUrl: p.seo?.canonicalUrl || "",
                },
                customFields: p.customFields || [],
                variantOptionGroups: p.variantOptionGroups || [],
                variants: (p.variants || []).map((v) => ({
                    ...v,
                    options:
                        v.options && typeof v.options === "object" && !(v.options instanceof Map)
                            ? v.options
                            : v.options
                              ? Object.fromEntries(v.options)
                              : {},
                })),
            });
        } catch (e) {
            setError(e.response?.data?.error || "Ürün yüklenemedi");
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!isEdit) return undefined;
        fetchStore()
            .then((r) => {
                if (r.store?.subdomain) setStoreHost(`${r.store.subdomain}.dashtock.com`);
                else if (r.store?.customDomain) setStoreHost(r.store.customDomain);
            })
            .catch(() => {});
    }, [isEdit]);

    const payload = useMemo(
        () => ({
            productType: form.productType,
            productKind: form.productKind,
            saleStatus: form.saleStatus,
            title: form.title,
            price: Number(form.price) || 0,
            compareAtPrice: form.compareAtPrice !== "" ? Number(form.compareAtPrice) : undefined,
            costPrice: form.costPrice !== "" ? Number(form.costPrice) : undefined,
            showUnitPrice: form.showUnitPrice,
            unitPrice: form.showUnitPrice ? normalizeUnitPricePayload(form.unitPrice) : undefined,
            description: form.description,
            images: form.images,
            videos: form.videos,
            brand: form.brand,
            tags: form.tags,
            supplier: form.supplier,
            googleCategory: form.googleCategory,
            googleCategoryId:
                form.googleCategoryId !== "" && form.googleCategoryId != null
                    ? Number(form.googleCategoryId)
                    : undefined,
            categories: form.categories,
            sku: form.sku,
            barcode: form.barcode,
            stock: Number(form.stock) || 0,
            inventory: {
                ...form.inventory,
                desi: form.inventory.desi !== "" ? Number(form.inventory.desi) : undefined,
            },
            seo: form.seo,
            customFields: (form.customFields || []).map((f) => ({
                fieldId: f.fieldId,
                value: f.value ?? "",
            })),
            variantOptionGroups: form.variantOptionGroups,
            variants: form.variants,
        }),
        [form]
    );

    const save = async (closed) => {
        setSaving(true);
        setError("");
        try {
            const body = { ...payload, saleStatus: closed ? "closed" : form.saleStatus };
            if (isEdit) {
                await patchStoreProduct(productId, body);
            } else {
                await createStoreProduct(body);
            }
            onNavigate("ec-products");
        } catch (e) {
            setError(e.response?.data?.error || "Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const scrollToTab = (tabId) => {
        setTab(tabId);
        if (!isEdit) return;
        const el = document.getElementById(`ec-sec-${tabId}`);
        const container = bodyRef.current;
        if (!el || !container) return;
        const top = el.offsetTop - container.offsetTop - 12;
        container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };

    const handleCopy = async () => {
        setMoreOpen(false);
        if (!window.confirm("Bu ürünün bir kopyasını oluşturmak istiyor musunuz?")) return;
        try {
            const res = await createStoreProduct({
                ...payload,
                title: `${form.title} (Kopya)`,
            });
            if (res.product?._id) onNavigate(`ec-product-edit-${res.product._id}`);
        } catch (e) {
            setError(e.response?.data?.error || "Kopyalanamadı");
        }
    };

    const handleDelete = async () => {
        setMoreOpen(false);
        if (!window.confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
        try {
            await deleteStoreProduct(productId);
            onNavigate("ec-products");
        } catch (e) {
            setError(e.response?.data?.error || "Silinemedi");
        }
    };

    if (loading) {
        return <div className="ec-prod-empty">Yükleniyor…</div>;
    }

    if (translationsOpen && isEdit) {
        return (
            <div className={`ec-theme-root ${rootClassName} ec-prod-form-shell ec-prod-form-shell--edit`} style={rootStyle}>
                <ProductTranslationsPanel
                    productTitle={form.title}
                    onClose={() => setTranslationsOpen(false)}
                />
            </div>
        );
    }

    return (
        <div
            className={`ec-theme-root ${rootClassName} ec-prod-form-shell${isEdit ? " ec-prod-form-shell--edit" : ""}`}
            style={rootStyle}
        >
            <ProductFormHeader
                isEdit={isEdit}
                isVariant={isVariantProduct}
                title={form.title}
                saving={saving}
                storeHost={storeHost}
                channelsOpen={channelsOpen}
                setChannelsOpen={setChannelsOpen}
                channelHidden={channelHidden}
                setChannelHidden={setChannelHidden}
                channelQtyLimits={channelQtyLimits}
                setChannelQtyLimits={setChannelQtyLimits}
                moreOpen={moreOpen}
                setMoreOpen={setMoreOpen}
                onBack={() => onNavigate("ec-products")}
                onSave={() => save(false)}
                onSaveClosed={() => save(true)}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onTranslations={() => setTranslationsOpen(true)}
            />

            {!isEdit && (
                <button type="button" className="ec-prod-link-advanced" onClick={() => onNavigate("pm-center")}>
                    Gelişmiş Ürün Eklemeye Geç <FaArrowRight />
                </button>
            )}

            <ProductFormTabs
                tabs={tabs}
                tab={tab}
                isEdit={isEdit}
                onTab={scrollToTab}
                onTranslations={() => setTranslationsOpen(true)}
            />

            {error && <div className="ec-prod-form-error">{error}</div>}

            <div className="ec-prod-form-body" ref={bodyRef}>
                <ProductFormSections
                    form={form}
                    setForm={setForm}
                    tab={tab}
                    isEdit={isEdit}
                    isVariant={isVariantProduct}
                    storeHost={storeHost}
                    tagInput={tagInput}
                    setTagInput={setTagInput}
                    onNavigate={onNavigate}
                />
            </div>

            {!isEdit && (
                <footer className="ec-prod-form-footer">
                    <button type="button" className="ec-prod-btn" disabled={saving} onClick={() => save(true)}>
                        Satışa Kapalı Kaydet
                    </button>
                    <button
                        type="button"
                        className="ec-prod-btn ec-prod-btn--primary"
                        disabled={saving}
                        onClick={() => save(false)}
                    >
                        Kaydet
                    </button>
                </footer>
            )}
        </div>
    );
};

export default EcommerceProductForm;
