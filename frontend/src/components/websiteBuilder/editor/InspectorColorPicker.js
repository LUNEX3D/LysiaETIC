import React from "react";
import { Box, Typography, Button, Stack } from "@mui/material";
import { THEME_COLOR_TOKENS } from "./inspectorUtils";

function Field({ label, children }) {
    return (
        <div className="wb-prop-field">
            {label ? <label>{label}</label> : null}
            {children}
        </div>
    );
}

export default function InspectorColorPicker({ label, value, onChange, themeVariables }) {
    const swatches = THEME_COLOR_TOKENS
        .map((t) => themeVariables?.[t.key])
        .filter(Boolean);

    return (
        <Field label={label}>
            <Box className="wb-inspector-color-picker">
                <Box className="wb-inspector-color-preview">
                    <input
                        type="color"
                        className="wb-inspector-color-native"
                        value={value || "#000000"}
                        onChange={(e) => onChange(e.target.value)}
                        aria-label={`${label} seç`}
                    />
                    <input
                        type="text"
                        className="wb-prop-input wb-inspector-color-hex"
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="#000000"
                    />
                </Box>
                {swatches.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                            Tema renkleri
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.75}>
                            {THEME_COLOR_TOKENS.map((token) => {
                                const color = themeVariables?.[token.key];
                                if (!color) return null;
                                return (
                                    <Button
                                        key={token.key}
                                        size="small"
                                        variant="outlined"
                                        onClick={() => onChange(color)}
                                        title={token.label}
                                        sx={{
                                            minWidth: 28,
                                            width: 28,
                                            height: 28,
                                            p: 0,
                                            borderRadius: 1,
                                            border: value === color ? "2px solid" : "1px solid",
                                            borderColor: value === color ? "primary.main" : "divider",
                                            bgcolor: color,
                                        }}
                                    />
                                );
                            })}
                        </Stack>
                    </Box>
                )}
            </Box>
        </Field>
    );
}
