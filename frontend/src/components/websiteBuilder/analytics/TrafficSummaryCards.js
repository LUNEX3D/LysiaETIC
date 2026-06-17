import React from "react";
import { Grid, Card, CardContent, Box, Typography, Skeleton } from "@mui/material";
import {
    VisibilityRounded, PeopleRounded, ShoppingCartRounded, TrendingUpRounded,
} from "@mui/icons-material";
import { formatNumber, formatPercent } from "./analyticsUtils";

const CARDS = [
    { key: "visitors", label: "Ziyaretçi", icon: PeopleRounded, color: "#22c55e", field: "visitors" },
    { key: "pageViews", label: "Görüntülenme", icon: TrendingUpRounded, color: "#6366f1", field: "pageViews" },
    { key: "orders", label: "Satış", icon: ShoppingCartRounded, color: "#f59e0b", field: "orders" },
    { key: "today", label: "Bugün (görüntülenme)", icon: VisibilityRounded, color: "#0ea5e9", field: "today" },
];

function SummaryCard({ label, value, change, icon: Icon, color, loading }) {
    if (loading) {
        return (
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent><Skeleton height={72} /></CardContent>
            </Card>
        );
    }
    const changeLabel = formatPercent(change);
    return (
        <Card
            variant="outlined"
            sx={{
                borderRadius: 2,
                height: "100%",
                transition: "box-shadow 0.2s, border-color 0.2s",
                "&:hover": { boxShadow: 2, borderColor: `${color}44` },
            }}
        >
            <CardContent sx={{ py: 2.25, "&:last-child": { pb: 2.25 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            {label}
                        </Typography>
                        <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                            {formatNumber(value)}
                        </Typography>
                        {changeLabel != null && (
                            <Typography
                                variant="caption"
                                fontWeight={600}
                                sx={{ color: Number(change) >= 0 ? "success.main" : "error.main", mt: 0.5, display: "block" }}
                            >
                                {changeLabel} önceki döneme göre
                            </Typography>
                        )}
                    </Box>
                    <Box
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            flexShrink: 0,
                            bgcolor: `${color}14`,
                            color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icon fontSize="small" />
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}

export default function TrafficSummaryCards({ summary, todayPageViews, loading }) {
    const s = summary || {};
    const values = {
        today: todayPageViews ?? 0,
        pageViews: s.pageViews?.value ?? 0,
        visitors: s.visitors?.value ?? 0,
        orders: s.orders?.value ?? 0,
    };
    const changes = {
        today: null,
        pageViews: s.pageViews?.change,
        visitors: s.visitors?.change,
        orders: s.orders?.change,
    };

    return (
        <Grid container spacing={2}>
            {CARDS.map((c) => (
                <Grid item key={c.key} xs={12} sm={6} lg={3}>
                    <SummaryCard
                        label={c.label}
                        value={values[c.field]}
                        change={changes[c.field]}
                        icon={c.icon}
                        color={c.color}
                        loading={loading}
                    />
                </Grid>
            ))}
        </Grid>
    );
}
