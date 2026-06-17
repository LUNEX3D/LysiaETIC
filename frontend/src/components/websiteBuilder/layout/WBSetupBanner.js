import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert, Button, Chip, LinearProgress, Typography, Stack,
} from "@mui/material";
import { RocketLaunchRounded } from "@mui/icons-material";
import {
    getIncompleteSteps, getIncompleteStepCount, ONBOARDING_STEP_LABELS, SETUP_STEP_META,
} from "../setup/siteSetupProgress";

export default function WBSetupBanner({ setupProgress }) {
    const { siteId } = useParams();
    const navigate = useNavigate();

    if (!setupProgress || !siteId) return null;

    const remaining = getIncompleteStepCount(setupProgress, { includeOptional: false });
    const pending = getIncompleteSteps(setupProgress, { includeOptional: false });

    if (remaining === 0) return null;

    const pendingLabels = pending.map((step) => {
        const idx = SETUP_STEP_META.findIndex((m) => m.id === step.id);
        return ONBOARDING_STEP_LABELS[idx] || step.label;
    });

    return (
        <Alert
            severity="warning"
            icon={<RocketLaunchRounded />}
            sx={{
                mb: 2,
                borderRadius: 2,
                alignItems: "flex-start",
                "& .MuiAlert-message": { width: "100%" },
            }}
            action={
                <Button
                    color="inherit"
                    size="small"
                    variant="contained"
                    disableElevation
                    onClick={() => navigate(`/website-builder/${siteId}/onboarding`)}
                    sx={{ whiteSpace: "nowrap", mt: { xs: 1, sm: 0 } }}
                >
                    Kuruluma devam
                </Button>
            }
        >
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Sitenizi yayına almak için {remaining} adım kaldı
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
                Kurulum %{setupProgress.percent} tamamlandı ({setupProgress.completed}/{setupProgress.total}).
            </Typography>
            <LinearProgress
                variant="determinate"
                value={setupProgress.percent}
                sx={{ height: 6, borderRadius: 3, mb: 1.5, bgcolor: "rgba(0,0,0,0.08)" }}
            />
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {pendingLabels.map((label) => (
                    <Chip key={label} label={label} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                ))}
            </Stack>
        </Alert>
    );
}
