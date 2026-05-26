import React from "react";
import { scoreColor } from "./radarUtils";

export default function RadarScoreBar({ label, value, color, icon }) {
    const v = Number(value) || 0;
    const barColor = color || scoreColor(v);
    return (
        <div className="rp-score-row">
            {icon && <span className="rp-score-icon">{icon}</span>}
            <span className="rp-score-label">{label}</span>
            <div className="rp-score-track">
                <div
                    className="rp-score-fill"
                    style={{ width: `${Math.min(100, v)}%`, background: barColor }}
                />
            </div>
            <span className="rp-score-val" style={{ color: barColor }}>
                {v}
            </span>
        </div>
    );
}
