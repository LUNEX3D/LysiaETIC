import React from "react";
import {
    Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, LinearProgress, Box, Skeleton,
} from "@mui/material";
import { pageSlugLabel, formatNumber } from "./analyticsUtils";

export default function TopPagesTable({ rows, loading, maxViews }) {
    const peak = maxViews || Math.max(1, ...(rows || []).map((r) => r.views || 0));

    if (loading) {
        return (
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent><Skeleton variant="rounded" height={280} /></CardContent>
            </Card>
        );
    }

    const list = rows || [];

    return (
        <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    En çok görüntülenen sayfalar
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Seçili dönemdeki sayfa performansı
                </Typography>
                {list.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                        Sayfa görüntüleme kaydı yok.
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Sayfa</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Görüntülenme</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, display: { xs: "none", sm: "table-cell" } }}>
                                        Ziyaretçi
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700, width: "28%", display: { xs: "none", md: "table-cell" } }}>
                                        Pay
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {list.map((row, i) => {
                                    const slug = row.pageSlug ?? row._id ?? "";
                                    const views = row.views ?? 0;
                                    const visitors = row.uniqueVisitors;
                                    return (
                                        <TableRow key={slug || i} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: { xs: 140, sm: 220 } }}>
                                                    {pageSlugLabel(slug)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight={600}>{formatNumber(views)}</Typography>
                                            </TableCell>
                                            <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>
                                                {visitors != null ? formatNumber(visitors) : "—"}
                                            </TableCell>
                                            <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={Math.min(100, (views / peak) * 100)}
                                                    sx={{ height: 6, borderRadius: 3, bgcolor: "action.hover" }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </CardContent>
        </Card>
    );
}
