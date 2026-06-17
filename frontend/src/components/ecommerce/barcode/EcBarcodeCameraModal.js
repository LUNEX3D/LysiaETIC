import React, { useEffect, useRef, useState, useCallback } from "react";
import { FaTimes, FaBarcode, FaImage } from "react-icons/fa";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { decodeBarcodeFromImageFile } from "./decodeBarcodeFromImage";

const HTML5_FORMATS = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.PDF_417,
    Html5QrcodeSupportedFormats.AZTEC,
];

const REGION_ID = "ec-barcode-camera-region";
const MIN_QRBOX = 50;

/** html5-qrcode en az 50px qrbox ister */
function calcQrbox(viewfinderWidth, viewfinderHeight) {
    const vw = Math.max(MIN_QRBOX, Math.floor(viewfinderWidth));
    const vh = Math.max(MIN_QRBOX, Math.floor(viewfinderHeight));
    const width = Math.max(MIN_QRBOX, Math.min(Math.floor(vw * 0.85), 320));
    const height = Math.max(MIN_QRBOX, Math.min(Math.floor(vh * 0.45), 160));
    return { width, height };
}

async function stopScannerSafe(scanner, isRunning) {
    if (!scanner) return;
    if (isRunning) {
        try {
            await scanner.stop();
        } catch {
            /* zaten durmuş */
        }
    }
    try {
        await scanner.clear();
    } catch {
        /* ignore */
    }
}

const EcBarcodeCameraModal = ({ open, onClose, onDetected }) => {
    const scannerRef = useRef(null);
    const isRunningRef = useRef(false);
    const fileInputRef = useRef(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [photoScanning, setPhotoScanning] = useState(false);

    const stopActiveScanner = useCallback(async () => {
        const scanner = scannerRef.current;
        const wasRunning = isRunningRef.current;
        scannerRef.current = null;
        isRunningRef.current = false;
        await stopScannerSafe(scanner, wasRunning);
    }, []);

    useEffect(() => {
        if (!open) return undefined;

        let cancelled = false;
        setError("");
        setLoading(true);
        isRunningRef.current = false;
        scannerRef.current = null;

        const start = async () => {
            let scanner = null;
            try {
                scanner = new Html5Qrcode(REGION_ID, {
                    formatsToSupport: HTML5_FORMATS,
                    verbose: false,
                });

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: calcQrbox,
                        aspectRatio: 1.333,
                    },
                    (decodedText) => {
                        if (cancelled || !decodedText) return;
                        onDetected(decodedText);
                        onClose();
                    },
                    () => {
                        /* kare başına — sessiz */
                    }
                );

                if (cancelled) {
                    await stopScannerSafe(scanner, true);
                    return;
                }

                scannerRef.current = scanner;
                isRunningRef.current = true;
                setLoading(false);
            } catch (e) {
                if (scanner) {
                    await stopScannerSafe(scanner, isRunningRef.current);
                }
                if (!cancelled) {
                    setError(
                        e?.message ||
                            "Kamera açılamadı. İzin verin veya fotoğraf yükleyin."
                    );
                    setLoading(false);
                }
            }
        };

        const t = setTimeout(start, 150);

        return () => {
            cancelled = true;
            clearTimeout(t);
            const scanner = scannerRef.current;
            const wasRunning = isRunningRef.current;
            scannerRef.current = null;
            isRunningRef.current = false;
            stopScannerSafe(scanner, wasRunning);
        };
    }, [open, onClose, onDetected]);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        setError("");
        setPhotoScanning(true);
        await stopActiveScanner();

        try {
            const text = await decodeBarcodeFromImageFile(file);
            onDetected(text);
            onClose();
        } catch (err) {
            setError(
                err?.message ||
                    "Barkod veya QR kodu okunamadı. Daha net bir fotoğraf deneyin."
            );
        } finally {
            setPhotoScanning(false);
        }
    };

    const handleClose = () => {
        stopActiveScanner().finally(onClose);
    };

    if (!open) return null;

    return (
        <div className="ec-purchase-camera-backdrop" role="dialog" aria-modal="true" aria-label="Kamera ile barkod oku">
            <div className="ec-purchase-camera-modal">
                <header className="ec-purchase-camera-modal__head">
                    <h4>
                        <FaBarcode /> Kamera ile okut
                    </h4>
                    <button type="button" className="ec-prod-icon-btn" onClick={handleClose} aria-label="Kapat">
                        <FaTimes />
                    </button>
                </header>

                {error && !loading && !photoScanning && (
                    <p className="ec-purchase-camera-modal__error">{error}</p>
                )}

                <div className="ec-purchase-camera-modal__viewport">
                    <div id={REGION_ID} className="ec-barcode-camera-region" />
                    {(loading || photoScanning) && (
                        <span className="ec-purchase-camera-modal__hint ec-purchase-camera-modal__hint--overlay">
                            {photoScanning ? "Görüntü analiz ediliyor…" : "Kamera açılıyor…"}
                        </span>
                    )}
                    {!loading && !photoScanning && !error && (
                        <span className="ec-purchase-camera-modal__hint ec-purchase-camera-modal__hint--overlay">
                            Barkod veya QR kodu çerçeveye hizalayın
                        </span>
                    )}
                </div>

                <footer className="ec-purchase-camera-modal__foot">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="ec-purchase-barcode-capture"
                        onChange={handleFile}
                    />
                    <button
                        type="button"
                        className="ec-prod-btn"
                        disabled={photoScanning}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FaImage /> {photoScanning ? "Okunuyor…" : "Fotoğraf yükle"}
                    </button>
                    <p className="ec-purchase-camera-modal__formats">
                        EAN, UPC, Code 128/39, QR, Data Matrix ve diğer formatlar desteklenir.
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default EcBarcodeCameraModal;
