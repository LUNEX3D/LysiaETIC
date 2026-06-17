import React from "react";
import { FaImage } from "react-icons/fa";
import { variantValuesPreviewText } from "./variantTypeFormUtils";

const VariantValuesPreview = ({ variantType }) => {
    const values = variantType?.values || [];
    if (!values.length) return null;

    if (variantType.displayStyle === "color_image") {
        return (
            <div className="ec-vt-values-preview">
                {values.map((val, idx) => (
                    <span
                        key={`${val.label}-${idx}`}
                        className="ec-vt-values-preview__swatch"
                        title={val.label}
                        style={
                            val.imageUrl
                                ? { background: `center/cover url(${val.imageUrl})` }
                                : { background: val.colorHex || "#9ca3af" }
                        }
                    >
                        {!val.imageUrl && !val.colorHex && <FaImage aria-hidden="true" />}
                    </span>
                ))}
            </div>
        );
    }

    return <span className="ec-vt-values-preview__text">{variantValuesPreviewText(variantType)}</span>;
};

export default VariantValuesPreview;
