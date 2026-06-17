import React from "react";
import { Box, Typography, Button, Slider, Stack } from "@mui/material";
import { SPACING_PRESETS, parseSpacingPx, formatSpacingPx } from "./inspectorUtils";

function Field({ label, children }) {
    return (
        <div className="wb-prop-field">
            {label ? <label>{label}</label> : null}
            {children}
        </div>
    );
}

function SpacingSlider({ label, value, onChange }) {
    const px = parseSpacingPx(value);
    return (
        <Field label={`${label} (${px}px)`}>
            <Slider
                size="small"
                value={px}
                min={0}
                max={120}
                step={4}
                onChange={(_, v) => onChange(formatSpacingPx(v))}
                valueLabelDisplay="auto"
                sx={{ mt: 0.5, color: "primary.main" }}
            />
        </Field>
    );
}

export default function InspectorSpacingPanel({ settings, onChange }) {
    const applyPreset = (preset) => {
        onChange({
            paddingTop: formatSpacingPx(preset.top),
            paddingBottom: formatSpacingPx(preset.bottom),
        });
    };

    return (
        <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
                Boşluk ön ayarları
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 2 }}>
                {SPACING_PRESETS.map((preset) => (
                    <Button
                        key={preset.label}
                        size="small"
                        variant="outlined"
                        onClick={() => applyPreset(preset)}
                        className="wb-inspector-preset-btn"
                    >
                        {preset.label}
                    </Button>
                ))}
            </Stack>
            <SpacingSlider
                label="Üst boşluk"
                value={settings.paddingTop}
                onChange={(v) => onChange({ paddingTop: v })}
            />
            <SpacingSlider
                label="Alt boşluk"
                value={settings.paddingBottom}
                onChange={(v) => onChange({ paddingBottom: v })}
            />
            <div className="wb-prop-toggle">
                <label>Tam genişlik</label>
                <input
                    type="checkbox"
                    checked={Boolean(settings.fullWidth)}
                    onChange={(e) => onChange({ fullWidth: e.target.checked })}
                    className="wb-inspector-checkbox"
                />
            </div>
        </Box>
    );
}
