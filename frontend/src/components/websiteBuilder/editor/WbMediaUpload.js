import React, { useRef, useState } from "react";
import { CloudUploadRounded, ImageOutlined } from "@mui/icons-material";
import * as wbApi from "../../../services/websiteBuilderApi";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

function resolveMediaUrl(path) {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
        return path;
    }
    const base = API_BASE.replace(/\/$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function WbMediaUpload({
    siteId,
    label,
    value,
    onChange,
    accept = "image/*",
    hint = "Görsel yüklemek için tıklayın ya da bu alana sürükleyin",
}) {
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    const uploadFile = async (file) => {
        if (!siteId || !file) return;
        setUploading(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await wbApi.uploadMedia(siteId, fd);
            const url = res.media?.url || res.media?.path || res.url;
            if (url) onChange?.(resolveMediaUrl(url));
            else setError("Yükleme tamamlandı ancak URL alınamadı");
        } catch (e) {
            setError(e.response?.data?.error || "Görsel yüklenemedi");
        } finally {
            setUploading(false);
        }
    };

    const onPick = (e) => {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
        e.target.value = "";
    };

    const onDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) uploadFile(file);
    };

    const previewUrl = value ? resolveMediaUrl(value) : "";

    return (
        <div className="wb-media-upload">
            {label && <div className="wb-media-upload__label">{label}</div>}
            <div
                className={`wb-media-upload__zone${uploading ? " wb-media-upload__zone--busy" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
            >
                <input ref={inputRef} type="file" accept={accept} hidden onChange={onPick} />
                {previewUrl ? (
                    <img src={previewUrl} alt="" className="wb-media-upload__preview" onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                    <div className="wb-media-upload__placeholder">
                        <CloudUploadRounded sx={{ fontSize: 28, color: "#7c3aed" }} />
                        <span>{uploading ? "Yükleniyor…" : hint}</span>
                    </div>
                )}
            </div>
            {value && (
                <div className="wb-media-upload__url-row">
                    <ImageOutlined sx={{ fontSize: 16, color: "#71717a" }} />
                    <input
                        type="text"
                        className="wb-te-field__input"
                        value={value}
                        placeholder="https://..."
                        onChange={(e) => onChange?.(e.target.value)}
                    />
                </div>
            )}
            {error && <div className="wb-media-upload__error">{error}</div>}
        </div>
    );
}

export { resolveMediaUrl };
