import { useCallback } from "react";
import {
    buildTransferLineFromProduct,
    lineIdentity,
} from "../../../components/ecommerce/barcode/productBarcodeUtils";
import { useProductBarcodeScan } from "../../../components/ecommerce/barcode/useProductBarcodeScan";
import { getProductStockAtLocation } from "./stockCountFormUtils";

function toCountLine(hit, code, locationName) {
    const stock = getProductStockAtLocation(hit.product, locationName);
    const base = buildTransferLineFromProduct(hit.product, hit.variant, code, stock);
    return {
        productId: base.productId,
        variantBarcode: base.variantBarcode,
        title: base.title,
        systemStock: base.fromBranchStock,
        countedQty: 1,
    };
}

export function useStockCountBarcodeMode({ products, form, setForm, pushToast }) {
    const onScan = useCallback(
        (hit, code) => {
            const line = toCountLine(hit, code, form.locationName);
            const id = lineIdentity(line.productId, line.variantBarcode);
            let actionText = "";

            setForm((prev) => {
                const idx = prev.lines.findIndex(
                    (l) => lineIdentity(l.productId, l.variantBarcode) === id
                );
                let lines;
                if (idx >= 0) {
                    lines = prev.lines.map((l, i) =>
                        i === idx
                            ? { ...l, countedQty: Number(l.countedQty || 0) + 1 }
                            : l
                    );
                    actionText = `${line.title} — sayıldı (${lines[idx].countedQty} adet)`;
                } else {
                    lines = [...prev.lines, line];
                    actionText = `${line.title} listeye eklendi`;
                }
                return {
                    ...prev,
                    lines,
                    recentActions: [
                        { text: actionText, createdAt: new Date().toISOString() },
                        ...prev.recentActions,
                    ].slice(0, 30),
                };
            });

            pushToast("success", actionText);
        },
        [setForm, pushToast, form.locationName]
    );

    return useProductBarcodeScan({ products, onScan, pushToast });
}
