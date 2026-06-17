import React from "react";
import { FaInfoCircle, FaPlus, FaTimes } from "react-icons/fa";
import ProductFormSeoSection from "./ProductFormSeoSection";
import ProductFormCustomSection from "./ProductFormCustomSection";
import ProductUnitPriceFields from "./ProductUnitPriceFields";
import GoogleProductCategoryPicker from "./GoogleProductCategoryPicker";
import ProductMediaSection from "./ProductMediaSection";
import ProductFormCategorySection from "./ProductFormCategorySection";
import ProductDescriptionEditor from "./ProductDescriptionEditor";
import ProductFormVariantSection from "./ProductFormVariantSection";
import EcSelect from "../../../components/ecommerce/EcSelect";

const Section = ({ id, title, children, extra, visible }) => {
    if (!visible) return null;
    return (
        <section className="ec-prod-section" id={id ? `ec-sec-${id}` : undefined}>
            <div className="ec-prod-section__head">
                <h3>
                    {title} <FaInfoCircle style={{ opacity: 0.45, fontSize: 12 }} />
                </h3>
                {extra}
            </div>
            {children}
        </section>
    );
};

const MoneyInput = ({ label, required, value, onChange }) => (
    <div className="ec-prod-field">
        <label>
            {label}
            {required ? " *" : ""}
        </label>
        <div className="ec-prod-money">
            <span>₺</span>
            <input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    </div>
);

export const ProductFormSections = ({ form, setForm, tab, isEdit, isVariant, storeHost, tagInput, setTagInput, onNavigate }) => {
    const show = (sections) => (isEdit ? true : sections.includes(tab));

    const addTag = () => {
        const t = tagInput.trim();
        if (!t || form.tags.includes(t)) return;
        setForm({ ...form, tags: [...form.tags, t] });
        setTagInput("");
    };

    const removeTag = (t) => setForm({ ...form, tags: form.tags.filter((x) => x !== t) });

    return (
        <>
            <Section id="basic" title="Temel Bilgi" visible={show(["basic"])}>
                <div className="ec-prod-grid">
                    <div className="ec-prod-field ec-prod-field--full">
                        <label>Ürün Adı *</label>
                        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="ec-prod-field">
                        <label>Ürün Türü *</label>
                        <EcSelect
                            value={form.productKind}
                            onChange={(e) => setForm({ ...form, productKind: e.target.value })}
                        >
                            <option value="physical">Fiziksel</option>
                            <option value="digital">Dijital</option>
                        </EcSelect>
                    </div>
                    <MoneyInput
                        label="Satış Fiyatı"
                        required
                        value={form.price}
                        onChange={(v) => setForm({ ...form, price: v })}
                    />
                    <MoneyInput
                        label="İndirimli Fiyat"
                        value={form.compareAtPrice}
                        onChange={(v) => setForm({ ...form, compareAtPrice: v })}
                    />
                    <MoneyInput
                        label="Alış Fiyatı"
                        value={form.costPrice}
                        onChange={(v) => setForm({ ...form, costPrice: v })}
                    />
                    <div className="ec-prod-field ec-prod-field--full">
                        <label className="ec-prod-check-label">
                            <input
                                type="checkbox"
                                checked={form.showUnitPrice}
                                onChange={(e) =>
                                    setForm({ ...form, showUnitPrice: e.target.checked })
                                }
                            />
                            Bu ürün için birim fiyat göster
                        </label>
                    </div>
                    <ProductUnitPriceFields form={form} setForm={setForm} />
                </div>
            </Section>

            <ProductMediaSection form={form} setForm={setForm} visible={show(["basic", "media", "detail"])} />

            <Section id="detail" title="Ürün Detayı" visible={show(["basic", "media", "detail"])}>
                <div className="ec-prod-grid ec-prod-grid--2">
                    <div className="ec-prod-field">
                        <label>Marka</label>
                        <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    </div>
                    <div className="ec-prod-field">
                        <label>Etiket</label>
                        <div className="ec-prod-tags">
                            {form.tags.map((t) => (
                                <span key={t} className="ec-prod-tag">
                                    {t}
                                    <button type="button" onClick={() => removeTag(t)} aria-label="Kaldır">
                                        <FaTimes />
                                    </button>
                                </span>
                            ))}
                            <input
                                className="ec-prod-tags-input"
                                value={tagInput}
                                placeholder={form.tags.length ? "" : "Etiket ekle…"}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                                onBlur={addTag}
                            />
                        </div>
                    </div>
                    <div className="ec-prod-field">
                        <label>Google Ürün Kategorisi</label>
                        <GoogleProductCategoryPicker
                            value={form.googleCategory}
                            categoryId={form.googleCategoryId}
                            onChange={({ path, id }) =>
                                setForm({
                                    ...form,
                                    googleCategory: path,
                                    googleCategoryId: id !== "" && id != null ? id : "",
                                })
                            }
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>Tedarikçi</label>
                        <input
                            value={form.supplier}
                            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                        />
                    </div>
                </div>
            </Section>

            <ProductFormCategorySection
                form={form}
                setForm={setForm}
                visible={show(["media", "detail"])}
                onNavigate={onNavigate}
            />

            <ProductDescriptionEditor form={form} setForm={setForm} visible={show(["detail"])} />

            <ProductFormVariantSection form={form} setForm={setForm} visible={show(["variant"])} />

            <Section id="inventory" title="Envanter" visible={show(["inventory"])}>
                <div className="ec-prod-grid">
                    <div className="ec-prod-field">
                        <label>SKU</label>
                        <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                    </div>
                    <div className="ec-prod-field">
                        <label>Barkod</label>
                        <input
                            value={form.barcode}
                            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                        />
                    </div>
                </div>
            </Section>

            <Section id="cargo" title="Kargo" visible={show(["inventory"])}>
                <div className="ec-prod-grid">
                    <div className="ec-prod-field">
                        <label>Desi</label>
                        <input
                            type="number"
                            value={form.inventory.desi}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    inventory: { ...form.inventory, desi: e.target.value },
                                })
                            }
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>HS Kodu</label>
                        <input
                            value={form.inventory.hsCode}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    inventory: { ...form.inventory, hsCode: e.target.value },
                                })
                            }
                        />
                    </div>
                </div>
            </Section>

            <Section id="stock" title="Stok ve Lokasyon" visible={show(["inventory"])}>
                <table className="ec-prod-stock-table">
                    <thead>
                        <tr>
                            <th>Lokasyon</th>
                            <th>Stok</th>
                            <th>Gelen Stok</th>
                        </tr>
                    </thead>
                    <tbody>
                        {form.inventory.locations.map((loc, idx) => (
                            <tr key={loc.name}>
                                <td>{loc.name}</td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        value={loc.stock}
                                        onChange={(e) => {
                                            const locations = [...form.inventory.locations];
                                            locations[idx] = {
                                                ...locations[idx],
                                                stock: Number(e.target.value) || 0,
                                            };
                                            const total = locations.reduce(
                                                (s, l) => s + (Number(l.stock) || 0),
                                                0
                                            );
                                            setForm({
                                                ...form,
                                                stock: total,
                                                inventory: { ...form.inventory, locations },
                                            });
                                        }}
                                    />
                                </td>
                                <td className="ec-prod-muted">—</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <label className="ec-prod-check-label" style={{ marginTop: 12 }}>
                    <input
                        type="checkbox"
                        checked={form.inventory.continueSellingWhenOutOfStock}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                inventory: {
                                    ...form.inventory,
                                    continueSellingWhenOutOfStock: e.target.checked,
                                },
                            })
                        }
                    />
                    Stoğu tükenince satmaya devam et
                </label>
            </Section>

            <ProductFormSeoSection
                form={form}
                setForm={setForm}
                storeHost={storeHost}
                visible={show(["inventory", "seo", "custom", "personalize"])}
            />

            <ProductFormCustomSection
                form={form}
                setForm={setForm}
                visible={show(["custom", "personalize"])}
            />

            <Section id="personalize" title="Ürün Özelleştirmesi" visible={show(["personalize"])}>
                <p className="ec-prod-muted">
                    Ürününüze yeni kişiselleştirme alanları ekleyebilir veya düzenleyebilirsiniz.
                </p>
                <EcSelect className="ec-prod-select-full" defaultValue="">
                    <option value="">Seçin</option>
                </EcSelect>
            </Section>
        </>
    );
};

export default ProductFormSections;
