import React from "react";
import SchemaFormRenderer from "../properties/SchemaFormRenderer";

const CHECKOUT_SCHEMA = [
    { id: "logoUrl", type: "image_picker", label: "Logo" },
    { id: "primaryColor", type: "color", label: "Ana renk", defaultValue: "#111827" },
    { id: "backgroundColor", type: "color", label: "Arka plan", defaultValue: "#f8fafc" },
    { id: "buttonRadius", type: "text", label: "Buton köşesi", defaultValue: "8px" },
    { id: "fontFamily", type: "text", label: "Font", defaultValue: "Inter, sans-serif" },
];

export default function CheckoutBuilderPanel({ checkout = {}, onChange }) {
    return (
        <div className="tb-properties">
            <h3 className="tb-properties__title">Ödeme Sayfası</h3>
            <SchemaFormRenderer
                schema={CHECKOUT_SCHEMA}
                values={checkout}
                onChange={(fieldId, value) => onChange({ ...checkout, [fieldId]: value })}
            />
        </div>
    );
}
