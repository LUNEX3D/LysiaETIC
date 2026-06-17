const xlsx = require("xlsx");
const StoreProduct = require("../models/StoreProduct");
const storeCustomFieldService = require("./storeCustomFieldService");
const storeProductService = require("./storeProductService");

const SCOPES = new Set(["products", "custom_fields_variant", "custom_fields_product"]);

function csvEscape(val) {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function rowsToCsv(headers, rows) {
    const lines = [headers.map(csvEscape).join(",")];
    for (const row of rows) {
        lines.push(row.map(csvEscape).join(","));
    }
    return Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8");
}

function rowsToXls(headers, rows, sheetName) {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    xlsx.utils.book_append_sheet(wb, ws, sheetName || "Veri");
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

function normalizeScope(scope) {
    return SCOPES.has(scope) ? scope : "products";
}

function buildProductRows(products) {
    const headers = [
        "Ürün ID",
        "Ürün Adı",
        "SKU",
        "Barkod",
        "Açıklama",
        "Fiyat",
        "Karşılaştırma Fiyatı",
        "Maliyet",
        "Stok",
        "Marka",
        "Etiketler",
        "Ürün Türü",
        "Satış Durumu",
        "Görsel URL 1",
        "Görsel URL 2",
        "Google Kategori",
    ];
    const rows = products.map((p) => [
        String(p._id),
        p.title || "",
        p.sku || "",
        p.barcode || "",
        (p.description || "").replace(/\s+/g, " ").slice(0, 5000),
        p.price ?? 0,
        p.compareAtPrice ?? "",
        p.costPrice ?? "",
        p.stock ?? 0,
        p.brand || "",
        (p.tags || []).join("; "),
        p.productType || "simple",
        p.saleStatus || "on_sale",
        (p.images || [])[0] || "",
        (p.images || [])[1] || "",
        p.googleCategory || "",
    ]);
    return { headers, rows, sheetName: "Ürünler" };
}

function buildCustomFieldsProductRows(products, definitions) {
    const headers = ["Ürün ID", "Ürün Adı", "Alan Anahtarı", "Alan Adı", "Alan Türü", "Değer"];
    const defById = new Map(definitions.map((d) => [String(d._id), d]));
    const rows = [];
    for (const p of products) {
        for (const cf of p.customFields || []) {
            const def = defById.get(String(cf.fieldId));
            rows.push([
                String(p._id),
                p.title || "",
                def?.key || cf.key || "",
                def?.name || cf.name || "",
                def?.type || cf.type || "html",
                cf.value || "",
            ]);
        }
    }
    return { headers, rows, sheetName: "Özel Alanlar Ürün" };
}

function buildCustomFieldsVariantRows(products) {
    const headers = [
        "Ürün ID",
        "Ürün Adı",
        "Varyant Türü",
        "Seçim Stili",
        "Listelemede Ayrı Göster",
        "Değer",
        "Renk HEX",
        "Görsel URL",
    ];
    const rows = [];
    for (const p of products) {
        for (const g of p.variantOptionGroups || []) {
            for (const v of g.values || []) {
                rows.push([
                    String(p._id),
                    p.title || "",
                    g.name || "",
                    g.displayStyle || "list",
                    g.showOnListingPages ? "evet" : "hayır",
                    v.label || "",
                    v.colorHex || "",
                    v.imageUrl || "",
                ]);
            }
        }
    }
    return { headers, rows, sheetName: "Özel Alanlar Varyant" };
}

async function exportStoreProducts(storeId, { format = "csv", scope = "products" } = {}) {
    const products = await StoreProduct.find({ storeId }).sort({ sortOrder: 1, title: 1 }).lean();
    const definitions = await storeCustomFieldService.listDefinitions(storeId);
    const normalizedScope = normalizeScope(scope);
    const ext = format === "xls" ? "xlsx" : "csv";

    let built;
    if (normalizedScope === "custom_fields_product") {
        const enriched = await Promise.all(
            products.map(async (p) => {
                const full = await storeProductService.getStoreProduct(storeId, p._id);
                return full.product || p;
            })
        );
        built = buildCustomFieldsProductRows(enriched, definitions);
    } else if (normalizedScope === "custom_fields_variant") {
        built = buildCustomFieldsVariantRows(products);
    } else {
        built = buildProductRows(products);
    }

    const date = new Date().toISOString().slice(0, 10);
    const filename = `magaza-${normalizedScope}-${date}.${ext}`;

    if (format === "xls") {
        return {
            buffer: rowsToXls(built.headers, built.rows, built.sheetName),
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename,
        };
    }

    return {
        buffer: rowsToCsv(built.headers, built.rows),
        contentType: "text/csv; charset=utf-8",
        filename,
    };
}

function parseUploadBuffer(buffer) {
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (raw.length < 2) return { headers: [], rows: [] };
    const headers = raw[0].map((h) => String(h || "").trim());
    const rows = raw.slice(1).filter((r) => r.some((c) => String(c || "").trim()));
    return { headers, rows };
}

function headerIndex(headers, names) {
    const lower = headers.map((h) => h.toLowerCase());
    for (const name of names) {
        const i = lower.indexOf(name.toLowerCase());
        if (i >= 0) return i;
    }
    return -1;
}

function cell(row, idx) {
    if (idx < 0) return "";
    return String(row[idx] ?? "").trim();
}

async function importStoreProducts(storeId, buffer, scope = "products") {
    const normalizedScope = normalizeScope(scope);
    const { headers, rows } = parseUploadBuffer(buffer);
    if (!rows.length) return { error: "Dosyada veri satırı bulunamadı" };

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    if (normalizedScope === "products") {
        const iTitle = headerIndex(headers, ["Ürün Adı", "urun adi", "title", "name"]);
        const iSku = headerIndex(headers, ["SKU", "sku", "Stok Kodu"]);
        const iBarcode = headerIndex(headers, ["Barkod", "barcode"]);
        const iPrice = headerIndex(headers, ["Fiyat", "price"]);
        const iStock = headerIndex(headers, ["Stok", "stock"]);
        const iDesc = headerIndex(headers, ["Açıklama", "description"]);
        const iBrand = headerIndex(headers, ["Marka", "brand"]);
        const iId = headerIndex(headers, ["Ürün ID", "product id", "_id"]);

        if (iTitle < 0) return { error: "Dosyada 'Ürün Adı' sütunu bulunamadı" };

        for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri];
            const title = cell(row, iTitle);
            if (!title) {
                results.skipped += 1;
                continue;
            }
            const id = cell(row, iId);
            const sku = cell(row, iSku);
            const barcode = cell(row, iBarcode);
            const payload = {
                title,
                sku,
                barcode,
                price: Number(cell(row, iPrice)) || 0,
                stock: Number(cell(row, iStock)) || 0,
                description: cell(row, iDesc),
                brand: cell(row, iBrand),
                saleStatus: "on_sale",
            };

            try {
                if (id) {
                    const out = await storeProductService.patchStoreProduct(storeId, id, payload);
                    if (out.error) {
                        results.errors.push(`Satır ${ri + 2}: ${out.error}`);
                    } else {
                        results.updated += 1;
                    }
                } else if (sku || barcode) {
                    const existing = await StoreProduct.findOne({
                        storeId,
                        $or: [
                            ...(sku ? [{ sku }] : []),
                            ...(barcode ? [{ barcode }] : []),
                        ],
                    });
                    if (existing) {
                        const out = await storeProductService.patchStoreProduct(
                            storeId,
                            existing._id,
                            payload
                        );
                        if (out.error) results.errors.push(`Satır ${ri + 2}: ${out.error}`);
                        else results.updated += 1;
                    } else {
                        const out = await storeProductService.createStoreProduct(storeId, payload);
                        if (out.error) results.errors.push(`Satır ${ri + 2}: ${out.error}`);
                        else results.created += 1;
                    }
                } else {
                    const out = await storeProductService.createStoreProduct(storeId, payload);
                    if (out.error) results.errors.push(`Satır ${ri + 2}: ${out.error}`);
                    else results.created += 1;
                }
            } catch (e) {
                results.errors.push(`Satır ${ri + 2}: ${e.message}`);
            }
        }
        return results;
    }

    if (normalizedScope === "custom_fields_product") {
        const iId = headerIndex(headers, ["Ürün ID", "product id"]);
        const iKey = headerIndex(headers, ["Alan Anahtarı", "key"]);
        const iValue = headerIndex(headers, ["Değer", "value"]);
        if (iId < 0 || iValue < 0) {
            return { error: "Dosyada 'Ürün ID' ve 'Değer' sütunları gerekli" };
        }
        const definitions = await storeCustomFieldService.listDefinitions(storeId);
        const defByKey = new Map(definitions.map((d) => [d.key, d]));

        for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri];
            const productId = cell(row, iId);
            const key = cell(row, iKey);
            const value = cell(row, iValue);
            if (!productId) continue;
            const def = defByKey.get(key);
            if (!def) {
                results.skipped += 1;
                continue;
            }
            const out = await storeProductService.getStoreProduct(storeId, productId);
            if (out.error) {
                results.errors.push(`Satır ${ri + 2}: ürün bulunamadı`);
                continue;
            }
            const cfs = [...(out.product.customFields || [])];
            const idx = cfs.findIndex((f) => String(f.fieldId) === String(def._id));
            const entry = { fieldId: String(def._id), value };
            if (idx >= 0) cfs[idx] = { ...cfs[idx], ...entry };
            else cfs.push(entry);
            const patch = await storeProductService.patchStoreProduct(storeId, productId, {
                customFields: cfs.map((f) => ({ fieldId: f.fieldId, value: f.value ?? "" })),
            });
            if (patch.error) results.errors.push(`Satır ${ri + 2}: ${patch.error}`);
            else results.updated += 1;
        }
        return results;
    }

    return {
        error:
            "Varyant özel alan içe aktarma henüz desteklenmiyor. Önce dışa aktarıp şablonu inceleyebilirsiniz.",
    };
}

module.exports = {
    exportStoreProducts,
    importStoreProducts,
    SCOPES,
};
