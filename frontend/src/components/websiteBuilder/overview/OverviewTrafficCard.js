import React, { useMemo } from "react";
import {
    Card, CardContent, Typography, Box, Skeleton, Grid,
} from "@mui/material";
import { TrendingUpRounded, PeopleRounded } from "@mui/icons-material";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { formatOverviewNumber } from "./siteOverviewUtils";
import { formatPercent } from "../analytics/analyticsUtils";

function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <Box sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 1, px: 1.5, py: 1 }}>
            <Typography variant="caption" fontWeight={700}>{label}</Typography>
            {payload.map((p) => (
                <Typography key={p.dataKey} variant="caption" display="block">
                    {p.name}: {formatOverviewNumber(p.value)}
                </Typography>
            ))}
        </Box>
    );
}

export default function OverviewTrafficCard({
    summary30d,
    summary7d,
    todaySummary,
    loading,
}) {
    const chartData = useMemo(() => {
        if (!summary7d && !summary30d) return [];
        return [
            { period: "7 gün", ziyaretçi: summary7d?.summary?.visitors?.value ?? 0, görüntülenme: summary7d?.summary?.pageViews?.value ?? 0 },
            { period: "30 gün", ziyaretçi: summary30d?.summary?.visitors?.value ?? 0, görüntülenme: summary30d?.summary?.pageViews?.value ?? 0 },
        ];
    }, [summary7d, summary30d]);

    const visitors30 = summary30d?.summary?.visitors?.value ?? 0;
    const views30 = summary30d?.summary?.pageViews?.value ?? 0;
    const change30 = summary30d?.summary?.visitors?.change;
    const todayViews = todaySummary?.todayPageViews ?? todaySummary?.summary?.pageViews?.value ?? 0;
    const todayVisitors = todaySummary?.summary?.visitors?.value ?? 0;

    return (
        <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <TrendingUpRounded color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        Son 30 günlük trafik
                    </Typography>
                </Box>

                {loading ? (
                    <Skeleton variant="rounded" height={200} />
                ) : (
                    <>
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <PeopleRounded sx={{ color: "#22c55e", fontSize: 20 }} />
                                    <Box>
                                        <Typography variant="caption" color="text.secondary">Ziyaretçi (30g)</Typography>
                                        <Typography variant="h6" fontWeight={800}>{formatOverviewNumber(visitors30)}</Typography>
                                        {change30 != null && (
                                            <Typography variant="caption" color={change30 >= 0 ? "success.main" : "error.main"}>
                                                {formatPercent(change30)} önceki dönem
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Görüntülenme (30g)</Typography>
                                    <Typography variant="h6" fontWeight={800}>{formatOverviewNumber(views30)}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Bugün: {formatOverviewNumber(todayVisitors)} ziyaret · {formatOverviewNumber(todayViews)} görüntülenme
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>

                        {chartData.some((d) => d.ziyaretçi > 0 || d.görüntülenme > 0) ? (
                            <Box sx={{ width: "100%", height: 160 }}>
                                <ResponsiveContainer>
                                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip content={<ChartTip />} />
                                        <Bar dataKey="ziyaretçi" name="Ziyaretçi" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={48} />
                                        <Bar dataKey="görüntülenme" name="Görüntülenme" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={48} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        ) : (
                            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                                Henüz trafik verisi yok. Site yayınlandıktan sonra ziyaretler burada görünür.
                            </Typography>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
