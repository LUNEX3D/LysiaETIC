import React from "react";
import { Card, CardContent, Box, Typography, Skeleton } from "@mui/material";

export default function OverviewMetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    color = "#3b82f6",
    loading,
    action,
    onClick,
}) {
    const clickable = Boolean(onClick);

    return (
        <Card
            variant="outlined"
            onClick={onClick}
            sx={{
                borderRadius: 2,
                height: "100%",
                cursor: clickable ? "pointer" : "default",
                transition: "box-shadow 0.2s, border-color 0.2s",
                "&:hover": clickable ? { boxShadow: 3, borderColor: `${color}55` } : undefined,
            }}
        >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            flexShrink: 0,
                            bgcolor: `${color}18`,
                            color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {Icon && <Icon fontSize="small" />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                {title}
                            </Typography>
                            {action}
                        </Box>
                        {loading ? (
                            <Skeleton width="60%" height={36} sx={{ mt: 0.5 }} />
                        ) : (
                            <Typography
                                variant="h5"
                                fontWeight={800}
                                sx={{ mt: 0.25, letterSpacing: "-0.02em", lineHeight: 1.2 }}
                                noWrap={typeof value === "string" && value.length > 28}
                            >
                                {value ?? "—"}
                            </Typography>
                        )}
                        {subtitle && !loading && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }} noWrap>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
