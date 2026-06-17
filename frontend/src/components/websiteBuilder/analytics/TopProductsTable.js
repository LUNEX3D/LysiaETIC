import React from "react";
import {
    Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Avatar, Box, Skeleton,
} from "@mui/material";
import { ShoppingBagOutlined } from "@mui/icons-material";
import { formatNumber } from "./analyticsUtils";

export default function TopProductsTable({ products, loading }) {
    if (loading) {
        return (
            <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <CardContent><Skeleton variant="rounded" height={240} /></CardContent>
            </Card>
        );
    }

    const list = products || [];

    return (
        <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    En çok görüntülenen ürünler
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Vitrindeki ürün detay görüntülemeleri
                </Typography>
                {list.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                        Ürün görüntüleme eventi henüz yok.
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Ürün</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Görüntülenme</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {list.map((p, i) => (
                                    <TableRow key={p.productSlug || p._id || i} hover>
                                        <TableCell>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                                                <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14 }}>
                                                    <ShoppingBagOutlined sx={{ fontSize: 16 }} />
                                                </Avatar>
                                                <Typography variant="body2" fontWeight={500} noWrap>
                                                    {p.productSlug || "—"}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" fontWeight={600}>{formatNumber(p.views)}</Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </CardContent>
        </Card>
    );
}
