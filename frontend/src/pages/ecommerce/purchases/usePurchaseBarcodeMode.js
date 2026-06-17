import { useCallback } from "react";
import {
    buildPurchaseLineFromProduct,
    lineIdentity,
} from "../../../components/ecommerce/barcode/productBarcodeUtils";
import { useProductBarcodeScan } from "../../../components/ecommerce/barcode/useProductBarcodeScan";

export function usePurchaseBarcodeMode({ products, form, setForm, pushToast }) {
    const onScan = useCallback(
        (hit, code) => {
            const line = buildPurchaseLineFromProduct(hit.product, hit.variant, code);
            const existed = form.lines.some(
                (l) =>
                    lineIdentity(l.productId, l.variantBarcode) ===
                    lineIdentity(line.productId, line.variantBarcode)
            );

            setForm((prev) => {
                const id = lineIdentity(line.productId, line.variantBarcode);
                const idx = prev.lines.findIndex(
                    (l) => lineIdentity(l.productId, l.variantBarcode) === id
                );
                if (idx >= 0) {
                    const lines = prev.lines.map((l, i) =>
                        i === idx ? { ...l, quantity: Number(l.quantity || 0) + 1 } : l
                    );
                    return { ...prev, lines };
                }
                return { ...prev, lines: [...prev.lines, line] };
            });

            pushToast(
                "success",
                existed
                    ? `${line.title} — adet artırıldı`
                    : `${line.title} listeye eklendi`
            );
        },
        [form.lines, setForm, pushToast]
    );

    return useProductBarcodeScan({ products, onScan, pushToast });
}
