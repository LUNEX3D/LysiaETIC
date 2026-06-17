import React from "react";
import {
    Card, CardContent, Typography, Box, LinearProgress, List, ListItem, ListItemIcon, ListItemText,
    ListItemButton, Chip,
} from "@mui/material";
import {
    CheckCircleRounded, RadioButtonUncheckedRounded, RocketLaunchRounded,
} from "@mui/icons-material";

export default function SetupProgressCard({ steps, percent, completed, total, onNavigate, loading }) {
    return (
        <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <RocketLaunchRounded color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        Kurulum durumu
                    </Typography>
                    <Chip
                        label={loading ? "…" : `%${percent}`}
                        size="small"
                        color={percent === 100 ? "success" : "primary"}
                        sx={{ ml: "auto", fontWeight: 700 }}
                    />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {loading
                        ? "Kontrol ediliyor…"
                        : `${completed} / ${total} adım tamamlandı — mağazanızı yayına hazırlayın.`}
                </Typography>

                <LinearProgress
                    variant={loading ? "indeterminate" : "determinate"}
                    value={percent}
                    sx={{ height: 8, borderRadius: 4, mb: 2.5, bgcolor: "action.hover" }}
                />

                <List dense disablePadding>
                    {steps.map((step) => (
                        <ListItem key={step.id} disablePadding sx={{ mb: 0.5 }}>
                            {step.href && !step.done ? (
                                <ListItemButton
                                    onClick={() => onNavigate(step.href)}
                                    sx={{ borderRadius: 1, py: 0.75 }}
                                >
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                        <RadioButtonUncheckedRounded fontSize="small" color="disabled" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={step.label}
                                        primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                                    />
                                </ListItemButton>
                            ) : (
                                <Box sx={{ display: "flex", alignItems: "center", width: "100%", px: 1, py: 0.75 }}>
                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                        {step.done ? (
                                            <CheckCircleRounded fontSize="small" color="success" />
                                        ) : (
                                            <RadioButtonUncheckedRounded fontSize="small" color="disabled" />
                                        )}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={step.label}
                                        primaryTypographyProps={{
                                            fontSize: 13,
                                            fontWeight: step.done ? 600 : 500,
                                            color: step.done ? "text.primary" : "text.secondary",
                                        }}
                                    />
                                </Box>
                            )}
                        </ListItem>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
}
