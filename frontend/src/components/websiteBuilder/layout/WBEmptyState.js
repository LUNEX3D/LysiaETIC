import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { Layers, Palette, LayoutGrid, Store } from "lucide-react";

const ICONS = {
    sections: Layers,
    theme: Palette,
    grid: LayoutGrid,
    store: Store,
};

export default function WBEmptyState({
    variant = "sections",
    title,
    description,
    actionLabel,
    onAction,
    compact = false,
}) {
    const Icon = ICONS[variant] || Layers;

    return (
        <Box className={`wb-empty-state${compact ? " wb-empty-state--compact" : ""}`}>
            <div className="wb-empty-state__illus" aria-hidden>
                <Icon size={compact ? 28 : 40} strokeWidth={1.5} />
            </div>
            <Typography className="wb-empty-state__title" component="h3">
                {title}
            </Typography>
            {description && (
                <Typography className="wb-empty-state__desc" component="p">
                    {description}
                </Typography>
            )}
            {actionLabel && onAction && (
                <Button
                    variant="contained"
                    size="small"
                    disableElevation
                    className="wb-empty-state__cta lysia-transition"
                    onClick={onAction}
                    sx={{
                        mt: 1.5,
                        textTransform: "none",
                        borderRadius: "var(--lysia-radius-md)",
                        bgcolor: "var(--lysia-brand-600)",
                        fontWeight: 600,
                        "&:hover": { bgcolor: "var(--lysia-brand-700)" },
                    }}
                >
                    {actionLabel}
                </Button>
            )}
        </Box>
    );
}
