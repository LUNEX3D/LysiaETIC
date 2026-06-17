import {
    FaCheckSquare,
    FaHandPointer,
    FaPalette,
    FaCalendar,
    FaCalendarAlt,
    FaCode,
    FaImage,
    FaListUl,
    FaHashtag,
    FaCube,
    FaTable,
    FaFont,
} from "react-icons/fa";

export const CUSTOM_FIELD_TYPES = [
    { id: "boolean", label: "Doğru-Yanlış", Icon: FaCheckSquare },
    { id: "choice", label: "Seçim", Icon: FaHandPointer },
    { id: "color", label: "Renk", Icon: FaPalette },
    { id: "date", label: "Tarih", Icon: FaCalendar },
    { id: "datetime", label: "Tarih ve Saat", Icon: FaCalendarAlt },
    { id: "html", label: "HTML", Icon: FaCode },
    { id: "image", label: "Resim", Icon: FaImage },
    { id: "multiselect", label: "Çoklu Seçim", Icon: FaListUl },
    { id: "number", label: "Sayı", Icon: FaHashtag },
    { id: "product", label: "Ürün", Icon: FaCube },
    { id: "table", label: "Tablo", Icon: FaTable },
    { id: "text", label: "Yazı", Icon: FaFont },
];

const LEGACY_LABELS = {
    text: "Yazı",
    number: "Sayı",
    date: "Tarih",
};

export function getCustomFieldTypeMeta(typeId) {
    return CUSTOM_FIELD_TYPES.find((t) => t.id === typeId) || null;
}

export function getCustomFieldTypeLabel(typeId) {
    const meta = getCustomFieldTypeMeta(typeId);
    if (meta) return meta.label;
    return LEGACY_LABELS[typeId] || typeId || "—";
}

export function emptyCustomFieldForm() {
    return { name: "", type: "boolean" };
}

export function fieldToForm(field) {
    if (!field) return emptyCustomFieldForm();
    return {
        name: field.name || "",
        type: field.type || "html",
    };
}

export function formToCustomFieldPayload(form) {
    return {
        name: form.name.trim(),
        type: form.type,
    };
}

export function definedValuesLabel(field) {
    const opts = field?.options;
    if (!Array.isArray(opts) || !opts.length) return "";
    return opts.join(", ");
}
