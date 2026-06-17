export const emptyTransferForm = (branchDefault = "") => ({
    waybillNumber: "",
    fromBranch: branchDefault,
    toBranch: "",
    lines: [],
    timeline: [],
    importFilters: { categoryId: "", brand: "", tag: "" },
    status: "draft",
});

export function transferToForm(transfer, branchDefault = "") {
    if (!transfer) return emptyTransferForm(branchDefault);
    return {
        waybillNumber: transfer.waybillNumber || "",
        fromBranch: transfer.fromBranch || branchDefault,
        toBranch: transfer.toBranch || "",
        lines: (transfer.lines || []).map((l) => ({ ...l })),
        timeline: transfer.timeline || [],
        importFilters: transfer.importFilters || { categoryId: "", brand: "", tag: "" },
        status: transfer.status || "draft",
        transferNumber: transfer.transferNumber,
    };
}

export function formToTransferPayload(form, { approve = false } = {}) {
    return {
        waybillNumber: form.waybillNumber,
        fromBranch: form.fromBranch,
        toBranch: form.toBranch,
        lines: form.lines,
        timeline: form.timeline,
        importFilters: form.importFilters,
        approve,
    };
}

export function getProductStock(product) {
    return Number(product?.stock ?? 0);
}

export function buildBranchOptions(storeName, products) {
    const set = new Set();
    if (storeName) set.add(storeName);
    set.add("Merkez Depo");
    for (const p of products || []) {
        for (const loc of p.inventory?.locations || []) {
            if (loc?.name) set.add(loc.name);
        }
    }
    return [...set];
}
