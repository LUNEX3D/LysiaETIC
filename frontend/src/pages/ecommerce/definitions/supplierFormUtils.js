export const SUPPLIER_NAME_MAX = 100;

export { PHONE_COUNTRY_OPTIONS } from "../../../constants/phoneCountries";

export function emptySupplierForm() {
    return {
        name: "",
        email: "",
        phoneCountryCode: "+90",
        phone: "",
        company: "",
        contactName: "",
        taxNumber: "",
        taxOffice: "",
        address: "",
    };
}

export function supplierToForm(supplier) {
    if (!supplier) return emptySupplierForm();
    return {
        name: supplier.name || "",
        email: supplier.email || "",
        phoneCountryCode: supplier.phoneCountryCode || "+90",
        phone: supplier.phone || "",
        company: supplier.company || "",
        contactName: supplier.contactName || "",
        taxNumber: supplier.taxNumber || "",
        taxOffice: supplier.taxOffice || "",
        address: supplier.address || "",
    };
}

export function formToSupplierPayload(form) {
    return {
        name: form.name.trim().slice(0, SUPPLIER_NAME_MAX),
        email: form.email.trim(),
        phoneCountryCode: form.phoneCountryCode || "+90",
        phone: form.phone.trim(),
        company: form.company.trim(),
        contactName: form.contactName.trim(),
        taxNumber: form.taxNumber.trim(),
        taxOffice: form.taxOffice.trim(),
        address: form.address.trim(),
    };
}

export function formatSupplierPhone(row) {
    if (!row?.phone) return "";
    const code = row.phoneCountryCode || "";
    return code ? `${code} ${row.phone}`.trim() : row.phone;
}
