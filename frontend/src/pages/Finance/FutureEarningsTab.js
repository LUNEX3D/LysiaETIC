import React, { useEffect, useState } from "react";
import {
    Box, Paper, Typography, Table, TableHead,
    TableRow, TableCell, TableBody, CircularProgress,
    LinearProgress, Alert, Chip, useTheme, Card, CardContent
} from "@mui/material";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip as ChartTooltip,
    Legend,
    Filler
} from 'chart.js';
import { fetchTrendyolSettlements } from "../../services/financeApi";
import { formatCurrency } from "../../utils/helpers";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    ChartTooltip,
    Legend,
    Filler
);

const FutureEarningsTab = ({ userId, dateRange, compact }) => {
    const theme = useTheme();
    const [futureData, setFutureData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState(null);

    useEffect(() => {
        const loadFutureEarnings = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get earnings from 1 week later to 1 month later
                const now = new Date();
                const future = new Date(now);
                future.setDate(now.getDate() + 7);
                const oneMonthLater = new Date(now);
                oneMonthLater.setMonth(now.getMonth() + 1);

                const response = await fetchTrendyolSettlements({
                    userId,
                    transactionType: "Sale",
                    startDate: future.getTime(),
                    endDate: oneMonthLater.getTime(),
                    size: 1000
                });

                const data = response.data.content || [];
                setFutureData(data);

                // Prepare chart data
                if (data.length > 0) {
                    const groupedByDate = data.reduce((acc, item) => {
                        const date = new Date(item.paymentDate || item.transactionDate).toLocaleDateString('tr-TR');
                        acc[date] = (acc[date] || 0) + (item.sellerRevenue || 0);
                        return acc;
                    }, {});

                    const chartLabels = Object.keys(groupedByDate).sort();
                    const chartValues = chartLabels.map(date => groupedByDate[date]);

                    setChartData({
                        labels: chartLabels,
                        datasets: [
                            {
                                label: 'Hakediş Tutarı',
                                data: chartValues,
                                borderColor: theme.palette.primary.main,
                                backgroundColor: theme.palette.primary.light,
                                tension: 0.4,
                                fill: true
                            }
                        ]
                    });
                }

            } catch (err) {
                console.error("Gelecek hakedişler yüklenirken hata:", err);
                setError(err.message || "Veriler alınamadı!");
                setFutureData([]);
            } finally {
                setLoading(false);
            }
        };

        loadFutureEarnings();
    }, [userId, theme]);

    if (compact) {
        const totalFutureEarnings = futureData.reduce((sum, item) => sum + (item.sellerRevenue || 0), 0);

        return (
            <>
                <Typography variant="h4" fontWeight={700}>
                    {formatCurrency(totalFutureEarnings)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Önümüzdeki 1 ay içinde beklenen {futureData.length} hakediş
                </Typography>
            </>
        );
    }

    return (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
                <TrendingUpIcon sx={{ fontSize: 32, color: "primary.main" }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Gelecek Hakedişler
                </Typography>
                <Chip
                    label={`${futureData.length} Kayıt`}
                    color="primary"
                    size="small"
                    sx={{ ml: 'auto' }}
                />
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ textAlign: "center" }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        Gelecek hakedişler yükleniyor...
                    </Typography>
                </Box>
            ) : (
                <>
                    {chartData && (
                        <Box sx={{ height: 300, mb: 4 }}>
                            <Line
                                data={chartData}
                                options={{
                                    responsive: true,
                                    plugins: {
                                        legend: {
                                            position: 'top',
                                        },
                                        title: {
                                            display: true,
                                            text: 'Gelecek Hakediş Dağılımı',
                                            font: {
                                                size: 16
                                            }
                                        },
                                        tooltip: {
                                            callbacks: {
                                                label: function(context) {
                                                    return formatCurrency(context.raw);
                                                }
                                            }
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            ticks: {
                                                callback: function(value) {
                                                    return formatCurrency(value);
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </Box>
                    )}

                    <Box sx={{ overflowX: 'auto', maxHeight: 400 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Tarih</TableCell>
                                    <TableCell>Hakediş</TableCell>
                                    <TableCell>Sipariş No</TableCell>
                                    <TableCell>Barkod</TableCell>
                                    <TableCell>Komisyon</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {futureData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                            <Typography color="text.secondary">
                                                Gelecek hakediş bulunamadı
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    futureData.map((row, index) => (
                                        <TableRow key={index} hover>
                                            <TableCell>
                                                {row.paymentDate
                                                    ? new Date(row.paymentDate).toLocaleDateString('tr-TR')
                                                    : new Date(row.transactionDate).toLocaleDateString('tr-TR')}
                                            </TableCell>
                                            <TableCell>
                                                {formatCurrency(row.sellerRevenue || 0)}
                                            </TableCell>
                                            <TableCell>{row.orderNumber}</TableCell>
                                            <TableCell>{row.barcode}</TableCell>
                                            <TableCell>
                                                {formatCurrency(row.commissionAmount || 0)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                </>
            )}
        </Paper>
    );
};

export default FutureEarningsTab;