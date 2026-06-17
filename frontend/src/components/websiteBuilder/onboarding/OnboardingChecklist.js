import React from "react";
import {
    Card, CardContent, Typography, List, ListItem, ListItemIcon, ListItemText, Box, Chip,
} from "@mui/material";
import { CheckCircleRounded, RadioButtonUncheckedRounded } from "@mui/icons-material";
import { ONBOARDING_STEP_LABELS, SETUP_STEP_META } from "../setup/siteSetupProgress";

export default function OnboardingChecklist({ steps, activeStep, percent }) {
    return (
        <Card variant="outlined" sx={{ borderRadius: 2, position: { md: "sticky" }, top: { md: 16 } }}>
            <CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Kurulum listesi
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                    Site Özeti ile aynı adımlar
                </Typography>
                <Chip label={`%${percent}`} size="small" color="primary" sx={{ mb: 2, fontWeight: 700 }} />
                <List dense disablePadding>
                    {SETUP_STEP_META.map((meta, index) => {
                        const step = steps.find((s) => s.id === meta.id);
                        const done = step?.done;
                        const isCurrent = index === activeStep;
                        return (
                            <ListItem key={meta.id} disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    {done ? (
                                        <CheckCircleRounded fontSize="small" color="success" />
                                    ) : (
                                        <RadioButtonUncheckedRounded fontSize="small" color={isCurrent ? "primary" : "disabled"} />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    primary={ONBOARDING_STEP_LABELS[index]}
                                    secondary={meta.id === "domain" ? "Opsiyonel" : null}
                                    primaryTypographyProps={{
                                        fontSize: 13,
                                        fontWeight: isCurrent ? 700 : done ? 600 : 400,
                                        color: isCurrent ? "primary.main" : "text.primary",
                                    }}
                                    secondaryTypographyProps={{ fontSize: 11 }}
                                />
                            </ListItem>
                        );
                    })}
                </List>
                <Box sx={{ mt: 1.5, p: 1.25, bgcolor: "action.hover", borderRadius: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">
                        Domain adımını atlayabilirsiniz; varsayılan <strong>*.sites</strong> adresiyle yayın devam eder.
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}
