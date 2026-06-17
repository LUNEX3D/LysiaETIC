export const BULK_EDIT_FIELD_OPTIONS = [
    { id: "tags", label: "Etiket", valueType: "text", placeholder: "ör. yaz, kış" },
    { id: "brand", label: "Marka", valueType: "text", placeholder: "Marka adı" },
    { id: "categories", label: "Kategori", valueType: "text", placeholder: "Virgülle ayırın" },
    { id: "saleStatus", label: "Satış durumu", valueType: "select" },
    { id: "price", label: "Satış Fiyatı", valueType: "number", placeholder: "0.00" },
    { id: "compareAtPrice", label: "İndirimli Fiyat", valueType: "number", placeholder: "0.00" },
    { id: "costPrice", label: "Alış Fiyatı", valueType: "number", placeholder: "0.00" },
    { id: "stock", label: "Stok", valueType: "number", placeholder: "0" },
    {
        id: "continueSellingWhenOutOfStock",
        label: "Stoğu tükenince satmaya devam et",
        valueType: "boolean",
    },
];

export const BULK_EDIT_MODES = [{ id: "set", label: "Güncelle" }];

export function fieldMeta(fieldId) {
    return BULK_EDIT_FIELD_OPTIONS.find((f) => f.id === fieldId);
}

export function availableBulkFields(usedIds) {
    const used = new Set(usedIds);
    return BULK_EDIT_FIELD_OPTIONS.filter((f) => !used.has(f.id));
}
