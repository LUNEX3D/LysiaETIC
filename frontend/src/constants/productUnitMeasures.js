/** Birim fiyat — ikas ile uyumlu hacim / ağırlık birimleri */
export const UNIT_MEASURE_GROUPS = [
    {
        label: "Hacim",
        units: [
            { value: "ml", label: "ml" },
            { value: "cl", label: "cl" },
            { value: "l", label: "l" },
            { value: "m3", label: "m3" },
        ],
    },
    {
        label: "Ağırlık",
        units: [
            { value: "mg", label: "mg" },
            { value: "g", label: "g" },
            { value: "kg", label: "kg" },
            { value: "ton", label: "ton" },
        ],
    },
];

export const ALL_UNIT_VALUES = UNIT_MEASURE_GROUPS.flatMap((g) => g.units.map((u) => u.value));

export const DEFAULT_PRODUCT_MEASURE_UNIT = "cl";
