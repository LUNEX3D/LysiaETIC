/**
 * e-Arşiv logo / imza yükleme alanı
 */
import React, { useRef, useState } from "react";
import { FaCloudUploadAlt, FaSpinner, FaTimes, FaImage } from "react-icons/fa";
import { colors, helpTextStyle, inputStyle, labelStyle } from "../styles";
import { resolveMediaUrl } from "../utils";

const zoneStyle = (busy) => ({
    border: "2px dashed " + (busy ? colors.accent + "55" : "rgba(255,255,255,0.18)"),
    borderRadius: 12,
    padding: "0.85rem",
    background: "rgba(255,255,255,0.03)",
    cursor: busy ? "wait" : "pointer",
    textAlign: "center",
    transition: "border-color 0.2s, background 0.2s",
});

const EArchiveImageUpload = ({
    label,
    uploadLabel = "Görsel yükle",
    hint = "PNG, JPG veya WEBP — bilgisayarınızdan veya telefonunuzdan seçin",
    value,
    onChange,
    onUpload,
    previewHeight = 72,
}) => {
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [localError, setLocalError] = useState("");

    const previewUrl = value ? resolveMediaUrl(value) : "";

    const handleFile = async (file) => {
        if (!file || !onUpload) return;
        if (!file.type.startsWith("image/")) {
            setLocalError("Yalnızca görsel dosyaları yüklenebilir.");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setLocalError("Dosya boyutu en fazla 2 MB olabilir.");
            return;
        }
        setLocalError("");
        setUploading(true);
        try {
            const result = await onUpload(file);
            if (result.error) {
                setLocalError(result.error);
                return;
            }
            if (result.url) onChange?.(result.url);
        } finally {
            setUploading(false);
        }
    };

    const onPick = (e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = "";
    };

    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <div
                role="button"
                tabIndex={0}
                style={zoneStyle(uploading)}
                onClick={() => !uploading && inputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && !uploading && inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    hidden
                    onChange={onPick}
                />
                {previewUrl ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                        <img
                            src={previewUrl}
                            alt=""
                            style={{
                                maxHeight: previewHeight,
                                maxWidth: "100%",
                                objectFit: "contain",
                                borderRadius: 8,
                                background: "rgba(0,0,0,0.2)",
                                padding: "0.35rem",
                            }}
                            onError={(e) => { e.target.style.display = "none"; }}
                        />
                        <span style={{ color: colors.textMuted, fontSize: "0.78rem" }}>
                            {uploading ? "Yükleniyor..." : "Değiştirmek için tıklayın"}
                        </span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.45rem", padding: "0.35rem 0" }}>
                        {uploading
                            ? <FaSpinner style={{ color: colors.accent, fontSize: "1.4rem", animation: "spin 1s linear infinite" }} />
                            : <FaCloudUploadAlt style={{ color: colors.accent, fontSize: "1.5rem" }} />}
                        <span style={{ color: colors.text, fontSize: "0.82rem", fontWeight: 600 }}>
                            {uploading ? "Yükleniyor..." : uploadLabel}
                        </span>
                        <span style={{ color: colors.textMuted, fontSize: "0.76rem", lineHeight: 1.45, maxWidth: 280 }}>
                            {hint}
                        </span>
                    </div>
                )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginTop: "0.5rem" }}>
                <FaImage style={{ color: colors.textMuted, fontSize: "0.75rem", flexShrink: 0 }} />
                <input
                    style={{ ...inputStyle, fontSize: "0.8rem" }}
                    value={value || ""}
                    placeholder="https://... veya yüklenen dosya yolu"
                    onChange={(e) => onChange?.(e.target.value)}
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange?.("")}
                        title="Temizle"
                        style={{
                            background: colors.glass,
                            border: "1px solid " + colors.glassBr,
                            borderRadius: 8,
                            padding: "0.45rem 0.55rem",
                            cursor: "pointer",
                            color: colors.red,
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <FaTimes />
                    </button>
                )}
            </div>
            {localError && (
                <p style={{ ...helpTextStyle, color: colors.red, marginTop: "0.35rem" }}>{localError}</p>
            )}
        </div>
    );
};

export default EArchiveImageUpload;
