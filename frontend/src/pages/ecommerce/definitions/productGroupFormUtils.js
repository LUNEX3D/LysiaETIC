export const MAX_PRODUCT_GROUP_TYPES = 3;

export function emptyManualForm() {
    return {
        name: "",
        variantTypeLabels: [],
        typeInput: "",
        items: [],
    };
}

export function emptyAutomaticForm() {
    return {
        name: "",
        groupingFieldId: "",
        typeSource: "variant",
        typeCustomFieldId: "",
    };
}

export function groupToManualForm(group) {
    if (!group) return emptyManualForm();
    return {
        name: group.name || "",
        variantTypeLabels: [...(group.variantTypeLabels || [])],
        typeInput: "",
        items: (group.items || []).map((item, i) => ({
            productId: String(item.productId),
            productTitle: item.productTitle || "",
            sortOrder: item.sortOrder ?? i,
            values: { ...(item.values || {}) },
        })),
    };
}

export function manualFormToPayload(form) {
    return {
        groupType: "manual",
        name: form.name.trim(),
        variantTypeLabels: form.variantTypeLabels,
        items: form.items.map((item, i) => ({
            productId: item.productId,
            sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : i,
            values: item.values || {},
        })),
    };
}

export function automaticFormToPayload(form) {
    return {
        groupType: "automatic",
        mode: "automatic",
        name: form.name.trim(),
        groupingFieldId: form.groupingFieldId,
        typeSource: form.typeSource,
        typeCustomFieldId: form.typeSource === "custom_field" ? form.typeCustomFieldId : null,
    };
}

export function addVariantTypeLabel(form) {
    const label = String(form.typeInput || "").trim();
    if (!label) return form;
    if (form.variantTypeLabels.includes(label)) return { ...form, typeInput: "" };
    if (form.variantTypeLabels.length >= MAX_PRODUCT_GROUP_TYPES) return form;
    const variantTypeLabels = [...form.variantTypeLabels, label];
    const items = form.items.map((item) => ({
        ...item,
        values: { ...item.values, [label]: item.values[label] || "" },
    }));
    return { ...form, variantTypeLabels, items, typeInput: "" };
}

export function removeVariantTypeLabel(form, label) {
    const variantTypeLabels = form.variantTypeLabels.filter((l) => l !== label);
    const items = form.items.map((item) => {
        const values = { ...item.values };
        delete values[label];
        return { ...item, values };
    });
    return { ...form, variantTypeLabels, items };
}

export function addProductToForm(form, product) {
    if (!product?._id) return form;
    const id = String(product._id);
    if (form.items.some((item) => String(item.productId) === id)) return form;
    const values = {};
    for (const label of form.variantTypeLabels) values[label] = "";
    return {
        ...form,
        items: [
            ...form.items,
            {
                productId: id,
                productTitle: product.title || "",
                sortOrder: form.items.length,
                values,
            },
        ],
    };
}

export function removeProductFromForm(form, productId) {
    return {
        ...form,
        items: form.items
            .filter((item) => String(item.productId) !== String(productId))
            .map((item, i) => ({ ...item, sortOrder: i })),
    };
}

export function moveProductInForm(form, productId, direction) {
    const idx = form.items.findIndex((item) => String(item.productId) === String(productId));
    if (idx < 0) return form;
    const next = idx + direction;
    if (next < 0 || next >= form.items.length) return form;
    const items = [...form.items];
    [items[idx], items[next]] = [items[next], items[idx]];
    return {
        ...form,
        items: items.map((item, i) => ({ ...item, sortOrder: i })),
    };
}

export function setItemValue(form, productId, label, value) {
    return {
        ...form,
        items: form.items.map((item) =>
            String(item.productId) === String(productId)
                ? { ...item, values: { ...item.values, [label]: value } }
                : item
        ),
    };
}

export function setItemSortOrder(form, productId, sortOrder) {
    const order = Math.max(0, Number(sortOrder) || 0);
    const items = form.items.map((item) =>
        String(item.productId) === String(productId) ? { ...item, sortOrder: order } : item
    );
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    return { ...form, items: items.map((item, i) => ({ ...item, sortOrder: i })) };
}

export const GROUP_TYPE_LABELS = {
    manual: "Manuel",
    automatic: "Otomatik",
};
