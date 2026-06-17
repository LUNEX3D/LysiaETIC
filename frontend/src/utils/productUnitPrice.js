import { ALL_UNIT_VALUES } from "../constants/productUnitMeasures";

/** Taban birime çevir (ml veya g) */
const toBase = (value, unit) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return 0;
    switch (unit) {
        case "ml":
            return v;
        case "cl":
            return v * 10;
        case "l":
            return v * 1000;
        case "m3":
            return v * 1_000_000;
        case "mg":
            return v / 1000;
        case "g":
            return v;
        case "kg":
            return v * 1000;
        case "ton":
            return v * 1_000_000;
        default:
            return 0;
    }
};

const isVolume = (unit) => ["ml", "cl", "l", "m3"].includes(unit);
const isWeight = (unit) => ["mg", "g", "kg", "ton"].includes(unit);

export function formatUnitPriceLabel(price, soldValue, soldUnit) {
    const p = Number(price) || 0;
    const sold = Number(soldValue) || 0;
    const unit = soldUnit || "cl";
    if (!sold) {
        return `₺ 0.00 / 0.00 ${unit}`;
    }
    const perOne = p / sold;
    const qtyStr = sold % 1 === 0 ? String(sold) : sold.toFixed(2);
    return `₺ ${perOne.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${qtyStr} ${unit}`;
}

export function normalizeUnitPricePayload(raw) {
    if (!raw || typeof raw !== "object") return undefined;
    const productMeasureUnit = ALL_UNIT_VALUES.includes(raw.productMeasureUnit)
        ? raw.productMeasureUnit
        : "cl";
    const soldUnitUnit =
        raw.soldUnitUnit && ALL_UNIT_VALUES.includes(raw.soldUnitUnit) ? raw.soldUnitUnit : "";
    return {
        productMeasureValue:
            raw.productMeasureValue !== "" && raw.productMeasureValue != null
                ? Number(raw.productMeasureValue)
                : undefined,
        productMeasureUnit,
        soldUnitValue:
            raw.soldUnitValue !== "" && raw.soldUnitValue != null
                ? Number(raw.soldUnitValue)
                : undefined,
        soldUnitUnit,
    };
}

export { toBase, isVolume, isWeight };
