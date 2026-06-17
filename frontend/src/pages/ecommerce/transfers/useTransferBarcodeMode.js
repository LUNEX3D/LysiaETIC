import { useCallback } from "react";
import {
    buildTransferLineFromProduct,
    lineIdentity,
} from "../../../components/ecommerce/barcode/productBarcodeUtils";
import { useProductBarcodeScan } from "../../../components/ecommerce/barcode/useProductBarcodeScan";
import { getProductStock } from "./transferFormUtils";

export function useTransferBarcodeMode({ products, form, setForm, pushToast }) {
    const onScan = useCallback(
        (hit, code) => {
            const stock = getProductStock(hit.product);
            const line = buildTransferLineFromProduct(hit.product, hit.variant, code, stock);
            const id = lineIdentity(line.productId, line.variantBarcode);
            const existed = form.lines.some(
                (l) => lineIdentity(l.productId, l.variantBarcode) === id
            );

            setForm((prev) => {
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
                    ? `${line.title} — transfer adedi artırıldı`
                    : `${line.title} listeye eklendi`
            );
        },
        [form.lines, setForm, pushToast]
    );

    return useProductBarcodeScan({ products, onScan, pushToast });
}
