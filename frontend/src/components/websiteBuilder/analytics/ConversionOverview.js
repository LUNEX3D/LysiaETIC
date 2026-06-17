import React from "react";
import {
    Card, CardContent, Typography, Box, Skeleton, LinearProgress, Chip,
} from "@mui/material";
import { formatNumber } from "./analyticsUtils";

const STEP_COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"];

export default function ConversionOverview({ funnel, loading }) {
    if (loading) {
        return (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent><Skeleton variant="rounded" height={280} /></CardContent>
            </Card>
        );
    }

    const steps = funnel || [];
    const maxCount = Math.max(1, ...steps.map((s) => s.count || 0));

    return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2 }}>
                    <Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                            Dönüşüm hunisi
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Ziyaretten satın almaya dönüşüm adımları
                        </Typography>
                    </Box>
                    {steps.length > 0 && steps[steps.length - 1]?.count > 0 && (
                        <Chip
                            size="small"
                            label={`${formatNumber(steps[steps.length - 1].count)} satın alma`}
                            color="success"
                            variant="outlined"
                        />
                    )}
                </Box>

                {steps.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                        Dönüşüm verisi yok. Sepet ve ödeme eventleri kaydedildikçe görünür.
                    </Typography>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {steps.map((step, i) => {
                            const pct = Math.round(((step.count || 0) / maxCount) * 100);
                            return (
                                <Box key={step.step}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5, gap: 1 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {step.label || step.step}
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
                                            <Typography variant="body2" fontWeight={700}>
                                                {formatNumber(step.count)}
                                            </Typography>
                                            {i > 0 && step.conversionRate != null && (
                                                <Typography variant="caption" color="text.secondary">
                                                    ({step.conversionRate}%)
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={pct}
                                        sx={{
                                            height: 10,
                                            borderRadius: 5,
                                            bgcolor: "action.hover",
                                            "& .MuiLinearProgress-bar": {
                                                borderRadius: 5,
                                                bgcolor: STEP_COLORS[i % STEP_COLORS.length],
                                            },
                                        }}
                                    />
                                    {i > 0 && step.dropoffRate > 0 && (
                                        <Typography variant="caption" color="error.main" sx={{ mt: 0.25, display: "block" }}>
                                            Önceki adımdan %{step.dropoffRate} kayıp
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
