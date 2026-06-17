/** Maske boyalı alanları komşu piksellerden doldurur (sunucu API yoksa). */
export function inpaintFromMask(sourceCanvas, maskCanvas, passes = 56) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const maskCtx = maskCanvas.getContext("2d");
    const maskImg = maskCtx.getImageData(0, 0, w, h);
    const data = img.data;
    const m = maskImg.data;

    const masked = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        masked[i] = m[p] > 80 || m[p + 3] > 80 ? 1 : 0;
    }

    for (let pass = 0; pass < passes; pass++) {
        const next = new Uint8ClampedArray(data);
        let changed = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                if (!masked[idx]) continue;
                let r = 0;
                let g = 0;
                let b = 0;
                let n = 0;
                const neighbors = [
                    [x - 1, y],
                    [x + 1, y],
                    [x, y - 1],
                    [x, y + 1],
                ];
                for (const [nx, ny] of neighbors) {
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    const j = ny * w + nx;
                    if (masked[j]) continue;
                    const p = j * 4;
                    r += data[p];
                    g += data[p + 1];
                    b += data[p + 2];
                    n += 1;
                }
                if (n > 0) {
                    const p = idx * 4;
                    next[p] = Math.round(r / n);
                    next[p + 1] = Math.round(g / n);
                    next[p + 2] = Math.round(b / n);
                    next[p + 3] = 255;
                    masked[idx] = 0;
                    changed = true;
                }
            }
        }
        data.set(next);
        if (!changed) break;
    }
    ctx.putImageData(img, 0, 0);
}

export function maskCanvasFromStrokes(width, height, strokes, brushSize) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    for (const stroke of strokes) {
        if (!stroke.length) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
    }
    return canvas;
}

export function upscaleCanvas(sourceCanvas, scale = 2) {
    const w = Math.min(Math.round(sourceCanvas.width * scale), 4096);
    const h = Math.min(Math.round(sourceCanvas.height * scale), 4096);
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceCanvas, 0, 0, w, h);
    return out;
}

export async function canvasToBlob(canvas, type = "image/png") {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Görsel dönüştürülemedi"));
        }, type, 0.95);
    });
}

/** Sunucuda API anahtarı yoksa — basit kenar yumuşatmalı şeffaf PNG (yedek). */
export async function removeBackgroundClient(imageUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Görsel yüklenemedi"));
        img.src = imageUrl;
    });

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = (r + g + b) / 3;
        const isBg =
            lum > 238 &&
            Math.abs(r - g) < 18 &&
            Math.abs(g - b) < 18 &&
            Math.abs(r - b) < 18;
        if (isBg) {
            data[i + 3] = 0;
        } else if (lum > 210) {
            data[i + 3] = Math.round(255 - (lum - 210) * 8);
        }
    }
    ctx.putImageData(new ImageData(data, w, h), 0, 0);
    return canvasToBlob(canvas);
}
