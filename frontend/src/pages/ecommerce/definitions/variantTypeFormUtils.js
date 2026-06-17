import { normalizeVariantOptionGroup } from "../../../utils/productVariantOptions";

export function emptyVariantTypeForm() {
    return {
        name: "",
        displayStyle: "list",
        values: [],
    };
}

export function variantTypeToForm(variantType) {
    if (!variantType) return emptyVariantTypeForm();
    const normalized = normalizeVariantOptionGroup({
        name: variantType.name,
        displayStyle: variantType.displayStyle,
        values: variantType.values,
    });
    return {
        name: normalized.name,
        displayStyle: normalized.displayStyle,
        values: normalized.values,
    };
}

export function formToVariantTypePayload(form) {
    const normalized = normalizeVariantOptionGroup(form);
    return {
        name: normalized.name,
        displayStyle: normalized.displayStyle,
        values: normalized.values,
    };
}

export function variantValuesPreviewText(variantType) {
    const values = variantType?.values || [];
    if (!values.length) return "";
    return values.map((v) => v.label).join(" ");
}
