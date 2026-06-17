"use strict";

const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");
const logger = require("../config/logger");

const RESPONSIVE_WIDTHS = [400, 800, 1200, 1600];

/**
 * Görsel upload sonrası WebP, AVIF ve responsive varyantlar üretir.
 * @returns {{ thumbnailUrl, variants, dimensions, optimizedSize }}
 */
async function optimizeUploadedImage(filePath, siteId, originalFilename) {
    const dir = path.dirname(filePath);
    const base = path.basename(originalFilename, path.extname(originalFilename));
    const relBase = `/uploads/wb-media/${siteId}/${base}`;

    const meta = await sharp(filePath).metadata();
    const dimensions = { width: meta.width || 0, height: meta.height || 0 };

    const variants = [];
    let thumbnailUrl = "";

    try {
        const thumbPath = path.join(dir, `${base}-thumb.webp`);
        await sharp(filePath).resize(400, 400, { fit: "inside" }).webp({ quality: 82 }).toFile(thumbPath);
        thumbnailUrl = `${relBase}-thumb.webp`;
        variants.push({ url: thumbnailUrl, format: "webp", width: 400, role: "thumb" });
    } catch (err) {
        logger.warn("[ImageOptimize] thumb:", err.message);
    }

    try {
        const webpPath = path.join(dir, `${base}.webp`);
        await sharp(filePath).webp({ quality: 82 }).toFile(webpPath);
        variants.push({ url: `${relBase}.webp`, format: "webp", width: dimensions.width, role: "primary" });
    } catch (err) {
        logger.warn("[ImageOptimize] webp:", err.message);
    }

    try {
        const avifPath = path.join(dir, `${base}.avif`);
        await sharp(filePath).avif({ quality: 75 }).toFile(avifPath);
        variants.push({ url: `${relBase}.avif`, format: "avif", width: dimensions.width, role: "primary" });
    } catch (err) {
        logger.warn("[ImageOptimize] avif:", err.message);
    }

    for (const w of RESPONSIVE_WIDTHS) {
        if (dimensions.width && w >= dimensions.width) continue;
        try {
            const rw = path.join(dir, `${base}-${w}w.webp`);
            await sharp(filePath).resize(w, null, { withoutEnlargement: true }).webp({ quality: 80 }).toFile(rw);
            variants.push({ url: `${relBase}-${w}w.webp`, format: "webp", width: w, role: "responsive" });
        } catch {
            /* skip width */
        }
    }

    let optimizedSize = 0;
    try {
        const st = await fs.stat(path.join(dir, `${base}.webp`));
        optimizedSize = st.size;
    } catch {
        /* ignore */
    }

    return { thumbnailUrl, variants, dimensions, optimizedSize };
}

module.exports = { optimizeUploadedImage, RESPONSIVE_WIDTHS };
