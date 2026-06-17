import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const NATIVE_FORMATS = [
    "qr_code",
    "ean_13",
    "ean_8",
    "upc_a",
    "upc_e",
    "code_128",
    "code_39",
    "code_93",
    "itf",
    "codabar",
    "data_matrix",
    "pdf417",
    "aztec",
];

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

const SCANNER_HOST_ID = "ec-barcode-scanner-host";

function getOrCreateScannerHost() {
    let el = document.getElementById(SCANNER_HOST_ID);
    if (!el) {
        el = document.createElement("div");
        el.id = SCANNER_HOST_ID;
        el.setAttribute("aria-hidden", "true");
        el.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;";
        document.body.appendChild(el);
    }
    return el;
}

function createFileScanner() {
    getOrCreateScannerHost();
    return new Html5Qrcode(SCANNER_HOST_ID, {
        formatsToSupport: HTML5_FORMATS,
        verbose: false,
    });
}

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Görüntü yüklenemedi"));
        };
        img.src = url;
    });
}

function renderCanvas(img, { scale = 1, rotateDeg = 0, filter = "none", binarize = false }) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const rad = (rotateDeg * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const rotW = w * cos + h * sin;
    const rotH = w * sin + h * cos;
    const maxDim = 2400;
    const fit = Math.min(1, maxDim / Math.max(rotW, rotH));
    const s = scale * fit;
    const cw = Math.max(1, Math.round(rotW * s));
    const ch = Math.max(1, Math.round(rotH * s));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.filter = filter;
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, (-w * s) / 2, (-h * s) / 2, w * s, h * s);

    if (binarize) {
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const v = lum > 140 ? 255 : 0;
            d[i] = v;
            d[i + 1] = v;
            d[i + 2] = v;
        }
        ctx.putImageData(imageData, 0, 0);
    }
    return canvas;
}

async function tryNativeOnCanvas(canvas) {
    if (typeof window.BarcodeDetector === "undefined" || !canvas) return null;
    try {
        const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
        const codes = await detector.detect(canvas);
        const value = codes?.[0]?.rawValue;
        return value ? String(value).trim() : null;
    } catch {
        return null;
    }
}

function canvasToFile(canvas, name = "scan.png") {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Görüntü dönüştürülemedi"));
                return;
            }
            resolve(new File([blob], name, { type: "image/png" }));
        }, "image/png");
    });
}

async function tryHtml5ScanFile(scanner, file) {
    try {
        const text = await scanner.scanFile(file, false);
        return text ? String(text).trim() : null;
    } catch {
        return null;
    }
}

async function tryHtml5ScanCanvas(scanner, canvas) {
    try {
        const file = await canvasToFile(canvas);
        return tryHtml5ScanFile(scanner, file);
    } catch {
        return null;
    }
}

/**
 * Fotoğraftan QR + 1D barkod (html5-qrcode + tarayıcı API).
 */
export async function decodeBarcodeFromImageFile(file) {
    const scanner = createFileScanner();

    try {
        let text = await tryHtml5ScanFile(scanner, file);
        if (text) return text;

        const img = await loadImageFromFile(file);
        const scales = [1, 1.35, 1.75, 2.25, 0.75];
        const rotations = [0, 90, 180, 270];
        const filters = [
            "none",
            "grayscale(1) contrast(1.35)",
            "grayscale(1) contrast(2) brightness(1.05)",
            "grayscale(1) contrast(2.5) brightness(0.95)",
        ];

        for (const scale of scales) {
            for (const rotateDeg of rotations) {
                for (const filter of filters) {
                    const canvas = renderCanvas(img, {
                        scale,
                        rotateDeg,
                        filter: filter === "none" ? "none" : filter,
                    });
                    if (!canvas) continue;

                    text = await tryNativeOnCanvas(canvas);
                    if (text) return text;

                    text = await tryHtml5ScanCanvas(scanner, canvas);
                    if (text) return text;
                }

                const canvas = renderCanvas(img, {
                    scale,
                    rotateDeg,
                    filter: "grayscale(1) contrast(1.5)",
                    binarize: true,
                });
                if (canvas) {
                    text = await tryNativeOnCanvas(canvas);
                    if (text) return text;
                    text = await tryHtml5ScanCanvas(scanner, canvas);
                    if (text) return text;
                }
            }
        }

        throw new Error("Fotoğrafta okunabilir barkod veya QR kodu bulunamadı.");
    } finally {
        try {
            await scanner.clear();
        } catch {
            /* ignore */
        }
    }
}
