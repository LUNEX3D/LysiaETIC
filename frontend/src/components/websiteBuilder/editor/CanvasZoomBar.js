import React from "react";
import { Tooltip } from "@mui/material";

const ZOOM_OPTIONS = [
    { value: 50, label: "%50" },
    { value: 75, label: "%75" },
    { value: 100, label: "%100" },
    { value: "fit", label: "Sığdır" },
];

export default function CanvasZoomBar({ zoom, onZoomChange }) {
    return (
        <div className="wb-canvas-zoom-bar">
            <span className="wb-canvas-zoom-label">Yakınlaştır</span>
            {ZOOM_OPTIONS.map((opt) => (
                <Tooltip key={String(opt.value)} title={opt.label}>
                    <button
                        type="button"
                        className={`wb-canvas-zoom-btn ${zoom === opt.value ? "active" : ""}`}
                        onClick={() => onZoomChange(opt.value)}
                    >
                        {opt.label}
                    </button>
                </Tooltip>
            ))}
        </div>
    );
}
