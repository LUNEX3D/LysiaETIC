import React, { useMemo } from "react";
import {
    Card, CardContent, Typography, Box, Skeleton, useTheme,
} from "@mui/material";
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell,
} from "recharts";
import { formatNumber, PERIOD_LABELS } from "./analyticsUtils";

const DEVICE_COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#94a3b8"];
const DEVICE_LABELS = { mobile: "Mobil", desktop: "Masaüstü", tablet: "Tablet", unknown: "Diğer" };

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <Box sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 1.5, px: 1.5, py: 1, boxShadow: 2 }}>
            <Typography variant="caption" fontWeight={700}>{label}</Typography>
            {payload.map((p) => (
                <Typography key={p.dataKey} variant="caption" display="block" sx={{ color: p.color }}>
                    {p.name}: {formatNumber(p.value)}
                </Typography>
            ))}
        </Box>
    );
}

export default function VisitorsChart({ periodComparison, devices, topSources, loading }) {
    const theme = useTheme();

    const trendData = useMemo(() => {
        if (!periodComparison?.length) return [];
        return periodComparison.map((row) => ({
            period: PERIOD_LABELS[row.period] || row.period,
            visitors: row.summary?.visitors?.value ?? 0,
            pageViews: row.summary?.pageViews?.value ?? 0,
        }));
    }, [periodComparison]);

    const deviceData = useMemo(() => {
        if (!devices || typeof devices !== "object") return [];
        return Object.entries(devices)
            .filter(([, count]) => count > 0)
            .map(([key, count]) => ({
                name: DEVICE_LABELS[key] || key,
                value: count,
            }));
    }, [devices]);

    const sourceData = useMemo(() => {
        return (topSources || []).slice(0, 6).map((s) => ({
            name: s.source || s._id || "—",
            sessions: s.count ?? 0,
        }));
    }, [topSources]);

    if (loading) {
        return (
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent><Skeleton variant="rounded" height={320} /></CardContent>
            </Card>
        );
    }

    const hasTrend = trendData.some((d) => d.visitors > 0 || d.pageViews > 0);
    const hasDevices = deviceData.length > 0;
    const hasSources = sourceData.length > 0;

    return (
        <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Trafik özeti
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Dönem karşılaştırması ve cihaz / kaynak dağılımı (canlı vitrin verileri).
                </Typography>

                {!hasTrend && !hasDevices && !hasSources ? (
                    <Box sx={{ py: 6, textAlign: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                            Henüz yeterli trafik yok. Yayınladığınız siteye ziyaret geldikçe grafikler dolacak.
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {hasTrend && (
                            <Box sx={{ width: "100%", height: { xs: 220, md: 260 } }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                                        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="pageViews" name="Görüntülenme" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={48} />
                                        <Line type="monotone" dataKey="visitors" name="Ziyaretçi" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </Box>
                        )}

                        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
                            {hasDevices && (
                                <Box sx={{ flex: 1, minWidth: 0, height: 200 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
                                        Cihazlar
                                    </Typography>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
                                                {deviceData.map((_, i) => (
                                                    <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => formatNumber(v)} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </Box>
                            )}
                            {hasSources && (
                                <Box sx={{ flex: 1, minWidth: 0, height: 200 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
                                        UTM kaynakları
                                    </Typography>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart layout="vertical" data={sourceData} margin={{ left: 8, right: 16 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                                            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                            <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                                            <Tooltip formatter={(v) => formatNumber(v)} />
                                            <Bar dataKey="sessions" name="Oturum" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={14} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
