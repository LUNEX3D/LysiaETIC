import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import EcPhoneInput from "../../../components/ecommerce/EcPhoneInput";
import GeoSearchSelect from "../../../components/ecommerce/GeoSearchSelect";
import { useDashtockTheme } from "../../../hooks/useDashtockTheme";
import { normalizePhoneCountryCode } from "../../../constants/phoneCountries";
import {
    getCountryNames,
    getCitiesForCountry,
    getDistrictsForCity,
    countrySupportsCustomCity,
    countryOptionLabel,
} from "../../../constants/addressGeo";
import { emptyAddress } from "./customerUtils";
import "../../../styles/ecommerceOrders.css";
import "../../../styles/ecommerceProducts.css";
import "../../../styles/ecommerceCustomers.css";

const CustomerAddressModal = ({ open, onClose, initial, onSave, customerDefaults }) => {
    const { rootClassName, rootStyle } = useDashtockTheme();
    const [form, setForm] = useState(emptyAddress);

    useEffect(() => {
        if (open) {
            const base = emptyAddress();
            setForm({
                ...base,
                ...initial,
                firstName: initial?.firstName || customerDefaults?.firstName || "",
                lastName: initial?.lastName || customerDefaults?.lastName || "",
                line1: initial?.line1 || initial?.line || "",
            });
        }
    }, [open, initial, customerDefaults]);

    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    const countryNames = useMemo(() => getCountryNames(), []);
    const cityOptions = useMemo(
        () => getCitiesForCountry(form.country),
        [form.country]
    );
    const districtOptions = useMemo(
        () => getDistrictsForCity(form.country, form.city),
        [form.country, form.city]
    );
    const allowCustomCity = countrySupportsCustomCity(form.country);
    const countryLabels = useMemo(
        () => countryNames.map((n) => countryOptionLabel(n)),
        [countryNames]
    );

    const setCountry = (label) => {
        if (!label) {
            setForm((f) => ({ ...f, country: "", city: "", district: "" }));
            return;
        }
        const name =
            countryNames.find((n) => countryOptionLabel(n) === label) ||
            countryNames.find((n) => n === label) ||
            label;
        setForm((f) => ({
            ...f,
            country: name,
            city: "",
            district: "",
        }));
    };

    const countryDisplay = form.country ? countryOptionLabel(form.country) : "";

    if (!open) return null;

    const submit = () => {
        if (!form.line1?.trim() || !form.country?.trim() || !form.city?.trim() || !form.district?.trim()) {
            return;
        }
        onSave({ ...form, line1: form.line1.trim() });
        onClose();
    };

    return createPortal(
        <div
            className="ec-order-label-modal-backdrop"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`ec-order-label-modal ec-customer-address-modal ${rootClassName}`}
                style={rootStyle}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="ec-order-label-modal__head">
                    <h3>Adres Ekle</h3>
                    <button type="button" className="ec-prod-icon-btn" onClick={onClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>
                <div className="ec-order-label-modal__body">
                    <div className="ec-prod-field">
                        <label>Başlık *</label>
                        <input
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Ev, İş..."
                        />
                    </div>
                    <div className="ec-prod-grid ec-purchase-grid--2">
                        <div className="ec-prod-field">
                            <label>Ad *</label>
                            <input
                                value={form.firstName}
                                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                            />
                        </div>
                        <div className="ec-prod-field">
                            <label>Soyad *</label>
                            <input
                                value={form.lastName}
                                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="ec-prod-field">
                        <label>TC Kimlik No</label>
                        <input
                            value={form.identityNumber}
                            onChange={(e) => setForm((f) => ({ ...f, identityNumber: e.target.value }))}
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>Adres *</label>
                        <input
                            value={form.line1}
                            onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                        />
                    </div>
                    <div className="ec-prod-grid ec-purchase-grid--2">
                        <div className="ec-prod-field">
                            <label>Adres 2</label>
                            <input
                                value={form.line2}
                                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                            />
                        </div>
                        <div className="ec-prod-field">
                            <label>Posta Kodu</label>
                            <input
                                value={form.zip}
                                onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                            />
                        </div>
                    </div>
                    <GeoSearchSelect
                        label="Ülke"
                        required
                        value={countryDisplay}
                        onChange={setCountry}
                        options={countryLabels}
                        placeholder="Ülke seçin"
                        emptyTitle="Ülke bulunamadı"
                    />
                    <div className="ec-prod-grid ec-purchase-grid--2 ec-customer-geo-row">
                        <GeoSearchSelect
                            label="Şehir"
                            required
                            value={form.city}
                            onChange={(city) =>
                                setForm((f) => ({
                                    ...f,
                                    city,
                                    district: "",
                                }))
                            }
                            options={cityOptions}
                            placeholder={form.country ? "Şehir seçin" : "Önce ülke seçin"}
                            disabled={!form.country}
                            allowCustom={allowCustomCity}
                            emptyTitle="Şehir bulunamadı"
                            emptyHint="Listeden seçin veya ENTER ile yazın"
                        />
                        <GeoSearchSelect
                            label="İlçe"
                            required
                            value={form.district}
                            onChange={(district) => setForm((f) => ({ ...f, district }))}
                            options={districtOptions}
                            placeholder={form.city ? "İlçe seçin" : "Önce şehir seçin"}
                            disabled={!form.city}
                            allowCustom={allowCustomCity || districtOptions.length === 0}
                            emptyTitle="İlçe bulunamadı"
                            emptyHint="Listeden seçin veya ENTER ile yazın"
                        />
                    </div>
                    <div className="ec-prod-field">
                        <label>Telefon Numarası</label>
                        <EcPhoneInput
                            phoneCountryCode={form.phoneCountryCode}
                            phone={form.phone}
                            onCountryCodeChange={(phoneCountryCode) =>
                                setForm((f) => ({
                                    ...f,
                                    phoneCountryCode: normalizePhoneCountryCode(phoneCountryCode),
                                }))
                            }
                            onPhoneChange={(phone) => setForm((f) => ({ ...f, phone }))}
                        />
                    </div>
                    <label className="ec-order-create-same-bill ec-customer-address-default">
                        <input
                            type="checkbox"
                            checked={form.isDefault}
                            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                        />
                        Varsayılan adres olarak ayarla
                    </label>

                    <div className="ec-customer-invoice-block">
                        <div className="ec-customer-invoice-types">
                            <label className="ec-order-create-same-bill">
                                <input
                                    type="checkbox"
                                    checked={form.invoiceType === "individual"}
                                    onChange={() =>
                                        setForm((f) => ({
                                            ...f,
                                            invoiceType: "individual",
                                        }))
                                    }
                                />
                                Bireysel Fatura
                            </label>
                            <label className="ec-order-create-same-bill">
                                <input
                                    type="checkbox"
                                    checked={form.invoiceType === "corporate"}
                                    onChange={() =>
                                        setForm((f) => ({
                                            ...f,
                                            invoiceType: "corporate",
                                        }))
                                    }
                                />
                                Kurumsal Fatura
                            </label>
                        </div>

                        {form.invoiceType === "corporate" && (
                            <div className="ec-customer-invoice-corporate">
                                <div className="ec-prod-field ec-prod-field--full">
                                    <label>Şirket Adı</label>
                                    <input
                                        value={form.companyName}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                companyName: e.target.value,
                                            }))
                                        }
                                        placeholder="Şirket adını girin"
                                    />
                                </div>
                                <div className="ec-prod-grid ec-purchase-grid--2">
                                    <div className="ec-prod-field">
                                        <label>Vergi Numarası</label>
                                        <input
                                            value={form.taxNumber}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    taxNumber: e.target.value,
                                                }))
                                            }
                                            placeholder="Vergi numarası"
                                        />
                                    </div>
                                    <div className="ec-prod-field">
                                        <label>Vergi Dairesi</label>
                                        <input
                                            value={form.taxOffice}
                                            onChange={(e) =>
                                                setForm((f) => ({
                                                    ...f,
                                                    taxOffice: e.target.value,
                                                }))
                                            }
                                            placeholder="Vergi dairesi"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <footer className="ec-order-label-modal__foot">
                    <button type="button" className="ec-prod-btn" onClick={onClose}>
                        Kapat
                    </button>
                    <button type="button" className="ec-prod-btn ec-prod-btn--primary" onClick={submit}>
                        Kaydet
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default CustomerAddressModal;
