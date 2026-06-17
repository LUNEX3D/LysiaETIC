import React from "react";
import {
    FaCheck,
    FaThumbsUp,
    FaListUl,
    FaPalette,
    FaCalendarAlt,
    FaFileAlt,
    FaFont,
    FaAlignLeft,
    FaPlus,
    FaTrash,
    FaChevronUp,
    FaChevronDown,
    FaInfoCircle,
    FaTimes,
} from "react-icons/fa";
import EcSelect from "../../../components/ecommerce/EcSelect";
import {
    PERSONALIZATION_TYPES,
    SELECTION_STYLE_OPTIONS,
    VALUE_PRICE_TYPES,
    addSelectionValue,
    removeSelectionValue,
    addExtension,
    removeExtension,
    getOptionLabel,
} from "./personalizationFormUtils";

const TYPE_ICONS = {
    toggle: FaThumbsUp,
    list: FaListUl,
    color: FaPalette,
    date: FaCalendarAlt,
    file: FaFileAlt,
    text: FaFont,
    paragraph: FaAlignLeft,
};

const PersonalizationOptionForm = ({
    draft,
    setDraft,
    allOptions = [],
    allowPaidPricing = false,
    planDisplayName = "",
    accentColor = "#2dd4bf",
}) => {
    const setField = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

    const otherOptions = allOptions.filter(
        (o) => String(o._id || o.clientKey) !== String(draft._id || draft.clientKey)
    );

    const showOptionLevelPrice = draft.type !== "selection";
    const showValuePrices = draft.type === "selection" && allowPaidPricing;
    const showPriceSection = showOptionLevelPrice || showValuePrices;

    const moveValue = (index, direction) => {
        const next = index + direction;
        if (next < 0 || next >= draft.values.length) return;
        const values = [...draft.values];
        [values[index], values[next]] = [values[next], values[index]];
        setField({ values: values.map((v, i) => ({ ...v, sortOrder: i })) });
    };

    return (
        <>
            <section id="pers-type" className="ec-prod-section ec-pers-option-section">
                <h3 className="ec-pers-option-section__title">Kişiselleştirme Türü</h3>

                <div className="ec-pers-opt-field">
                    <label className="ec-pers-opt-field__label" htmlFor="pers-opt-title">
                        Ürün Sayfasındaki Başlık *
                    </label>
                    <input
                        id="pers-opt-title"
                        className="ec-pers-opt-input"
                        value={draft.title}
                        onChange={(e) => setField({ title: e.target.value })}
                        placeholder="Başlık"
                    />
                    <p className="ec-pers-field-hint">
                        Müşteriler ürün detay sayfasında bu ismi görecektir.
                    </p>
                </div>

                <label className="ec-pers-check">
                    <input
                        type="checkbox"
                        checked={draft.showDescription}
                        onChange={(e) => setField({ showDescription: e.target.checked })}
                    />
                    Kişiselleştirmeye ek açıklama ekleyin
                </label>
                {draft.showDescription && (
                    <div className="ec-pers-nested">
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label" htmlFor="pers-opt-desc">
                                Açıklama
                            </label>
                            <textarea
                                id="pers-opt-desc"
                                className="ec-pers-opt-input"
                                rows={3}
                                value={draft.description}
                                onChange={(e) => setField({ description: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                <div className="ec-pers-type-grid ec-pers-type-grid--ikas">
                    {PERSONALIZATION_TYPES.map((t) => {
                        const Icon = TYPE_ICONS[t.icon] || FaListUl;
                        const active = draft.type === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                className={`ec-pers-type-card ${active ? "ec-pers-type-card--active" : ""}`}
                                onClick={() => setField({ type: t.id })}
                            >
                                {active && <FaCheck className="ec-pers-type-card__check" />}
                                <Icon />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {draft.type === "selection" && (
                    <div className="ec-prod-seo-split ec-pers-opt-split">
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label">Seçim Türü *</label>
                            <EcSelect
                                value={draft.selectionStyle}
                                onChange={(e) => setField({ selectionStyle: e.target.value })}
                            >
                                {SELECTION_STYLE_OPTIONS.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.label}
                                    </option>
                                ))}
                            </EcSelect>
                        </div>
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label">Maksimum Seçim Sayısı</label>
                            <input
                                className="ec-pers-opt-input"
                                type="number"
                                min={1}
                                value={draft.maxSelection}
                                onChange={(e) => setField({ maxSelection: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {(draft.type === "text" || draft.type === "paragraph") && (
                    <div className="ec-prod-seo-split ec-pers-opt-split">
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label">Minimum Karakter Sayısı</label>
                            <input
                                className="ec-pers-opt-input"
                                type="number"
                                min={0}
                                value={draft.minChars}
                                onChange={(e) => setField({ minChars: e.target.value })}
                            />
                        </div>
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label">Maksimum Karakter Sayısı</label>
                            <input
                                className="ec-pers-opt-input"
                                type="number"
                                min={0}
                                value={draft.maxChars}
                                onChange={(e) => setField({ maxChars: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {draft.type === "date" && (
                    <div className="ec-prod-seo-split ec-pers-opt-split">
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label">Başlangıç Tarihi</label>
                            <div className="ec-pers-days-field">
                                <input
                                    className="ec-pers-opt-input"
                                    type="number"
                                    min={0}
                                    value={draft.dateStartDays}
                                    onChange={(e) => setField({ dateStartDays: e.target.value })}
                                />
                                <span>gün sonra</span>
                            </div>
                        </div>
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label">Bitiş Tarihi</label>
                            <div className="ec-pers-days-field">
                                <input
                                    className="ec-pers-opt-input"
                                    type="number"
                                    min={0}
                                    value={draft.dateEndDays}
                                    onChange={(e) => setField({ dateEndDays: e.target.value })}
                                />
                                <span>gün sonra</span>
                            </div>
                        </div>
                    </div>
                )}

                {draft.type === "file" && (
                    <>
                        <div className="ec-prod-seo-split ec-pers-opt-split">
                            <div className="ec-pers-opt-field">
                                <label className="ec-pers-opt-field__label">Minimum Dosya Sayısı</label>
                                <input
                                    className="ec-pers-opt-input"
                                    type="number"
                                    min={0}
                                    value={draft.minFiles}
                                    onChange={(e) => setField({ minFiles: e.target.value })}
                                />
                            </div>
                            <div className="ec-pers-opt-field">
                                <label className="ec-pers-opt-field__label">Maksimum Dosya Sayısı</label>
                                <input
                                    className="ec-pers-opt-input"
                                    type="number"
                                    min={1}
                                    value={draft.maxFiles}
                                    onChange={(e) => setField({ maxFiles: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="ec-pers-opt-field">
                            <label className="ec-pers-opt-field__label">İzin Verilen Dosya Uzantıları *</label>
                            <div className="ec-pers-ext-input">
                                <input
                                    className="ec-pers-opt-input"
                                    value={draft.extensionInput}
                                    onChange={(e) => setField({ extensionInput: e.target.value })}
                                    placeholder=".pdf, .zip"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            setDraft((prev) => addExtension(prev));
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="ec-prod-btn"
                                    onClick={() => setDraft((prev) => addExtension(prev))}
                                >
                                    Ekle
                                </button>
                            </div>
                            {draft.allowedExtensions.length > 0 && (
                                <div className="ec-pg-type-tags">
                                    {draft.allowedExtensions.map((ext) => (
                                        <span key={ext} className="ec-pg-type-tag">
                                            {ext}
                                            <button
                                                type="button"
                                                onClick={() => setDraft((prev) => removeExtension(prev, ext))}
                                            >
                                                <FaTimes />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {draft.type === "selection" && (
                    <div id="pers-values" className="ec-pers-values-block">
                        <h4 className="ec-pers-values-block__title">Değerler</h4>
                        {draft.values.length === 0 ? (
                            <p className="ec-prod-muted">Henüz değer eklenmedi.</p>
                        ) : (
                            <div className="ec-prod-table-wrap">
                                <table className="ec-prod-table ec-pers-values-table">
                                    <thead>
                                        <tr>
                                            <th aria-label="Sıra" />
                                            <th>Seçim Değerleri</th>
                                            {showValuePrices && <th>Tür</th>}
                                            {showValuePrices && <th>Fiyat</th>}
                                            <th aria-label="Sil" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {draft.values.map((v, i) => (
                                            <tr key={`${v.label}-${i}`}>
                                                <td className="ec-pg-sort-cell">
                                                    <div className="ec-pg-sort-btns">
                                                        <button
                                                            type="button"
                                                            className="ec-prod-icon-btn"
                                                            disabled={i === 0}
                                                            onClick={() => moveValue(i, -1)}
                                                        >
                                                            <FaChevronUp />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="ec-prod-icon-btn"
                                                            disabled={i === draft.values.length - 1}
                                                            onClick={() => moveValue(i, 1)}
                                                        >
                                                            <FaChevronDown />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        className="ec-pers-opt-input"
                                                        value={v.label}
                                                        onChange={(e) => {
                                                            const values = [...draft.values];
                                                            values[i] = { ...values[i], label: e.target.value };
                                                            setField({ values });
                                                        }}
                                                        placeholder="Değer giriniz..."
                                                    />
                                                </td>
                                                {showValuePrices && (
                                                    <td>
                                                        <EcSelect
                                                            value={v.priceType}
                                                            onChange={(e) => {
                                                                const values = [...draft.values];
                                                                values[i] = {
                                                                    ...values[i],
                                                                    priceType: e.target.value,
                                                                };
                                                                setField({ values });
                                                            }}
                                                        >
                                                            {VALUE_PRICE_TYPES.map((pt) => (
                                                                <option key={pt.id} value={pt.id}>
                                                                    {pt.label}
                                                                </option>
                                                            ))}
                                                        </EcSelect>
                                                    </td>
                                                )}
                                                {showValuePrices && (
                                                    <td>
                                                        <div className="ec-pers-price-input">
                                                            <span>₺</span>
                                                            <input
                                                                className="ec-pers-opt-input"
                                                                type="number"
                                                                min={0}
                                                                step="0.01"
                                                                value={v.price}
                                                                onChange={(e) => {
                                                                    const values = [...draft.values];
                                                                    values[i] = {
                                                                        ...values[i],
                                                                        price: e.target.value,
                                                                    };
                                                                    setField({ values });
                                                                }}
                                                            />
                                                        </div>
                                                    </td>
                                                )}
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="ec-prod-icon-btn ec-prod-icon-btn--danger"
                                                        onClick={() =>
                                                            setDraft((prev) => removeSelectionValue(prev, i))
                                                        }
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="ec-pers-add-value">
                            <input
                                className="ec-pers-opt-input"
                                value={draft.valueInput}
                                onChange={(e) => setField({ valueInput: e.target.value })}
                                placeholder="Değer giriniz..."
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        setDraft((prev) => addSelectionValue(prev));
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="ec-prod-btn"
                                onClick={() => setDraft((prev) => addSelectionValue(prev))}
                            >
                                <FaPlus /> Değer Ekle
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {showPriceSection && (
                <section id="pers-price" className="ec-prod-section ec-pers-option-section">
                    <h3 className="ec-pers-option-section__title">Fiyat</h3>
                    {!allowPaidPricing ? (
                        <div className="ec-pers-plan-lock">
                            <FaInfoCircle style={{ color: accentColor }} />
                            <div>
                                <strong>Ücretli kişiselleştirme paketinizde kullanılamıyor</strong>
                                <p>
                                    Sabit fiyat veya ürün fiyatının yüzdesi ile ücretlendirme{" "}
                                    <strong>Pro</strong> paket ve üzeri planlarda kullanılabilir.
                                    {planDisplayName ? ` Mevcut paket: ${planDisplayName}.` : ""}
                                </p>
                            </div>
                        </div>
                    ) : showOptionLevelPrice ? (
                        <>
                            <label className="ec-pers-check">
                                <input
                                    type="checkbox"
                                    checked={draft.isPaid}
                                    onChange={(e) => setField({ isPaid: e.target.checked })}
                                />
                                Bu kişiselleştirme ücretli olsun
                            </label>
                            {draft.isPaid && (
                                <div className="ec-pers-nested ec-pers-price-block">
                                    <div className="ec-pers-radio-group">
                                        <label className="ec-pers-radio">
                                            <input
                                                type="radio"
                                                name="priceType"
                                                checked={draft.priceType === "fixed"}
                                                onChange={() => setField({ priceType: "fixed" })}
                                            />
                                            Sabit Fiyat
                                        </label>
                                        <label className="ec-pers-radio">
                                            <input
                                                type="radio"
                                                name="priceType"
                                                checked={draft.priceType === "percent"}
                                                onChange={() => setField({ priceType: "percent" })}
                                            />
                                            Ürün Fiyatının Yüzdesi
                                        </label>
                                    </div>
                                    {draft.priceType === "fixed" ? (
                                        <div className="ec-pers-opt-field">
                                            <label className="ec-pers-opt-field__label">Fiyat</label>
                                            <div className="ec-pers-price-input">
                                                <span>₺</span>
                                                <input
                                                    className="ec-pers-opt-input"
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={draft.fixedPrice}
                                                    onChange={(e) => setField({ fixedPrice: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="ec-pers-opt-field">
                                            <label className="ec-pers-opt-field__label">Yüzde</label>
                                            <div className="ec-pers-percent-field">
                                                Ana ürün fiyatının %
                                                <input
                                                    className="ec-pers-opt-input"
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.01"
                                                    value={draft.pricePercent}
                                                    onChange={(e) => setField({ pricePercent: e.target.value })}
                                                />
                                                yüzdesi kişiselleştirme fiyatıdır
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="ec-prod-muted">
                            Seçim türünde her değer için fiyat yukarıdaki tabloda tanımlanır.
                        </p>
                    )}
                </section>
            )}

            <section id="pers-settings" className="ec-prod-section ec-pers-option-section">
                <h3 className="ec-pers-option-section__title">Ayarlar</h3>
                {otherOptions.length > 0 ? (
                    <>
                        <label className="ec-pers-check">
                            <input
                                type="checkbox"
                                checked={!!draft.dependsOnOptionId}
                                onChange={(e) =>
                                    setField({
                                        dependsOnOptionId: e.target.checked
                                            ? String(otherOptions[0]._id || otherOptions[0].clientKey)
                                            : "",
                                    })
                                }
                            />
                            Bu kişiselleştirme başka bir kişiselleştirme seçilince aktif olsun
                        </label>
                        {!!draft.dependsOnOptionId && (
                            <div className="ec-pers-nested">
                                <div className="ec-pers-opt-field">
                                    <label className="ec-pers-opt-field__label">Bağlı olacağı seçenek</label>
                                    <EcSelect
                                        value={draft.dependsOnOptionId}
                                        onChange={(e) => setField({ dependsOnOptionId: e.target.value })}
                                    >
                                        {otherOptions.map((o) => (
                                            <option
                                                key={o._id || o.clientKey}
                                                value={String(o._id || o.clientKey)}
                                            >
                                                {getOptionLabel(o)}
                                            </option>
                                        ))}
                                    </EcSelect>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <label className="ec-pers-check ec-pers-check--disabled">
                        <input type="checkbox" disabled />
                        Bu kişiselleştirme başka bir kişiselleştirme seçilince aktif olsun
                    </label>
                )}
                <label className="ec-pers-check">
                    <input
                        type="checkbox"
                        checked={draft.required}
                        onChange={(e) => setField({ required: e.target.checked })}
                    />
                    Bu kişiselleştirme zorunlu olsun
                </label>
            </section>
        </>
    );
};

export default PersonalizationOptionForm;
