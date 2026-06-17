import React from "react";
import { Box, Typography, LinearProgress, Stepper, Step, StepLabel, Chip, useMediaQuery, useTheme } from "@mui/material";
import { ONBOARDING_STEP_LABELS } from "../setup/siteSetupProgress";

export default function OnboardingProgressHeader({ activeStep, percent, completed, total }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                    Kurulum ilerlemesi
                </Typography>
                <Chip label={`%${percent} · ${completed}/${total}`} size="small" color={percent === 100 ? "success" : "primary"} sx={{ fontWeight: 700 }} />
            </Box>
            <LinearProgress
                variant="determinate"
                value={percent}
                sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: "action.hover" }}
            />
            {!isMobile && (
                <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 1 }}>
                    {ONBOARDING_STEP_LABELS.map((label) => (
                        <Step key={label}>
                            <StepLabel
                                StepIconProps={{ sx: { "&.Mui-completed": { color: "success.main" } } }}
                            >
                                <Typography variant="caption" sx={{ display: { xs: "none", lg: "block" } }}>
                                    {label}
                                </Typography>
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>
            )}
            {isMobile && (
                <Typography variant="body2" fontWeight={600}>
                    Adım {activeStep + 1} / {ONBOARDING_STEP_LABELS.length}: {ONBOARDING_STEP_LABELS[activeStep]}
                </Typography>
            )}
        </Box>
    );
}
