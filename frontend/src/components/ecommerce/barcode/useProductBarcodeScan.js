import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    buildProductBarcodeIndex,
    normalizeScanCode,
    resolveBarcodeHit,
} from "./productBarcodeUtils";
import { createBarcodeWedgeHandler } from "./barcodeWedge";

/**
 * Ürün barkod taraması — USB (Enter gerekmez), kamera, manuel.
 * @param {object} opts
 * @param {Array} opts.products
 * @param {function} opts.onScan — (hit, code) => void, hit: { product, variant }
 * @param {function} opts.pushToast — (type, message) => void
 */
export function useProductBarcodeScan({ products, onScan, pushToast }) {
    const [barcodeMode, setBarcodeMode] = useState(false);
    const [cameraOpen, setCameraOpen] = useState(false);
    const barcodeInputRef = useRef(null);
    const wedgeRef = useRef(null);

    const index = useMemo(() => buildProductBarcodeIndex(products), [products]);

    const processBarcode = useCallback(
        (rawCode) => {
            const code = normalizeScanCode(rawCode);
            if (!code) return false;

            const hit = resolveBarcodeHit(index, code);
            if (!hit) {
                pushToast("error", `Barkod bulunamadı: ${code}`);
                return false;
            }

            onScan(hit, code);
            return true;
        },
        [index, onScan, pushToast]
    );

    useEffect(() => {
        wedgeRef.current = createBarcodeWedgeHandler((code) => processBarcode(code));
        return () => wedgeRef.current?.destroy();
    }, [processBarcode]);

    const wedgeHandlers = useMemo(
        () => ({
            onKeyDown: (e) => wedgeRef.current?.onKeyDown(e),
            onInput: (e) => wedgeRef.current?.onInput(e),
        }),
        []
    );

    const toggleBarcodeMode = useCallback(() => {
        setBarcodeMode((prev) => {
            const next = !prev;
            if (next) {
                pushToast("success", "Barkod modu aktif.");
                setTimeout(() => barcodeInputRef.current?.focus(), 50);
            } else {
                pushToast("info", "Barkod modu kapatıldı.");
            }
            return next;
        });
    }, [pushToast]);

    useEffect(() => {
        if (!barcodeMode) return undefined;
        const refocus = () => {
            if (document.activeElement?.tagName === "TEXTAREA") return;
            if (document.activeElement?.type === "number") return;
            if (document.activeElement?.type === "date") return;
            barcodeInputRef.current?.focus();
        };
        const t = setInterval(refocus, 1500);
        return () => clearInterval(t);
    }, [barcodeMode]);

    const openCamera = useCallback(() => {
        if (!barcodeMode) {
            setBarcodeMode(true);
            pushToast("success", "Barkod modu aktif.");
        }
        setCameraOpen(true);
    }, [barcodeMode, pushToast]);

    return {
        barcodeMode,
        cameraOpen,
        setCameraOpen,
        barcodeInputRef,
        toggleBarcodeMode,
        openCamera,
        processBarcode,
        wedgeHandlers,
    };
}
