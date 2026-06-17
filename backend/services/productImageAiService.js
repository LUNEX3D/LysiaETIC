const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const crypto = require("crypto");

let sharp;
try {
    sharp = require("sharp");
} catch {
    sharp = null;
}

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "product-images");

function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function saveBufferAsPng(buffer) {
    ensureUploadDir();
    const filename = `ai-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.png`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    return filename;
}

function publicUrl(req, filename) {
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    return `${base}/uploads/product-images/${filename}`;
}

async function resolveImageBuffer(imageUrl, reqHost) {
    const raw = String(imageUrl || "").trim();
    if (!raw) throw new Error("Görsel URL gerekli");

    if (raw.startsWith("data:image")) {
        const b64 = raw.split(",")[1];
        if (!b64) throw new Error("Geçersiz data URL");
        return Buffer.from(b64, "base64");
    }

    let fetchUrl = raw;
    if (raw.startsWith("/uploads/")) {
        const localPath = path.join(__dirname, "..", raw.replace(/^\//, ""));
        if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
        fetchUrl = `${reqHost}${raw}`;
    }

    const res = await axios.get(fetchUrl, {
        responseType: "arraybuffer",
        timeout: 45000,
        maxContentLength: 12 * 1024 * 1024,
    });
    return Buffer.from(res.data);
}

async function removeBackgroundRemoveBg(buffer) {
    const key = process.env.REMOVE_BG_API_KEY;
    if (!key) return null;

    const form = new FormData();
    form.append("image_file", buffer, { filename: "image.png", contentType: "image/png" });
    form.append("size", "full");
    form.append("type", "product");
    form.append("format", "png");

    const res = await axios.post("https://api.remove.bg/v1.0/removebg", form, {
        headers: { ...form.getHeaders(), "X-Api-Key": key },
        responseType: "arraybuffer",
        timeout: 90000,
    });
    return Buffer.from(res.data);
}

async function removeBackgroundClipdrop(buffer) {
    const key = process.env.CLIPDROP_API_KEY;
    if (!key) return null;

    const form = new FormData();
    form.append("image_file", buffer, { filename: "image.png", contentType: "image/png" });

    const res = await axios.post("https://clipdrop-api.co/remove-background/v1", form, {
        headers: { ...form.getHeaders(), "x-api-key": key },
        responseType: "arraybuffer",
        timeout: 90000,
    });
    return Buffer.from(res.data);
}

async function removeObjectClipdrop(imageBuffer, maskBuffer) {
    const key = process.env.CLIPDROP_API_KEY;
    if (!key) return null;

    const form = new FormData();
    form.append("image_file", imageBuffer, { filename: "image.png", contentType: "image/png" });
    form.append("mask_file", maskBuffer, { filename: "mask.png", contentType: "image/png" });

    const res = await axios.post("https://clipdrop-api.co/cleanup/v1", form, {
        headers: { ...form.getHeaders(), "x-api-key": key },
        responseType: "arraybuffer",
        timeout: 120000,
    });
    return Buffer.from(res.data);
}

async function upscaleWithSharp(buffer, scale = 2) {
    if (!sharp) return null;
    const meta = await sharp(buffer).metadata();
    const w = Math.min(Math.round((meta.width || 800) * scale), 4096);
    const h = Math.min(Math.round((meta.height || 800) * scale), 4096);
    return sharp(buffer)
        .resize(w, h, { kernel: sharp.kernel.lanczos3, fit: "inside" })
        .sharpen({ sigma: 0.8, m1: 0.5, m2: 2.5 })
        .png({ quality: 95, compressionLevel: 6 })
        .toBuffer();
}

async function processImageEdit(req, { imageUrl, action, maskBase64 }) {
    const reqHost = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const buffer = await resolveImageBuffer(imageUrl, reqHost);

    if (action === "remove_bg") {
        let out =
            (await removeBackgroundRemoveBg(buffer)) ||
            (await removeBackgroundClipdrop(buffer));
        if (!out) {
            return { useClient: true, message: "Sunucuda API anahtarı yok; tarayıcıda işlenecek." };
        }
        if (sharp) {
            out = await sharp(out).png({ quality: 95 }).toBuffer();
        }
        const filename = saveBufferAsPng(out);
        return { url: publicUrl(req, filename), processedOn: "server" };
    }

    if (action === "upscale") {
        let out = await upscaleWithSharp(buffer, 2);
        if (!out) {
            return { useClient: true, scale: 2, message: "Yüksek çözünürlük tarayıcıda uygulanacak." };
        }
        const filename = saveBufferAsPng(out);
        return { url: publicUrl(req, filename), processedOn: "server" };
    }

    if (action === "remove_object") {
        if (!maskBase64) return { error: "Maske gerekli — kaldırılacak alanı boyayın" };
        const maskRaw = String(maskBase64).replace(/^data:image\/\w+;base64,/, "");
        const maskBuffer = Buffer.from(maskRaw, "base64");
        const out = await removeObjectClipdrop(buffer, maskBuffer);
        if (!out) {
            return { useClient: true, message: "Nesne kaldırma tarayıcıda uygulanacak." };
        }
        const filename = saveBufferAsPng(out);
        return { url: publicUrl(req, filename), processedOn: "server" };
    }

    return { error: "Geçersiz işlem" };
}

module.exports = {
    processImageEdit,
    resolveImageBuffer,
    saveBufferAsPng,
    publicUrl,
};
