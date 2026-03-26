import React, { useEffect, useState } from "react";
import {
    Box, Typography, CircularProgress, Paper,
    Button, Alert, Grid, Chip, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import { Refresh as RefreshIcon, DateRange as DateRangeIcon } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { fetchTrendyolSettlements, fetchTrendyolSettlementsBulk } from "../../services/financeApi";
import FinanceTable from "./FinanceTable";

const quickRanges = [
    { label: "Bugün", value: [dayjs(), dayjs()] },
    { label: "Son 7 gün", value: [dayjs().subtract(7, "day"), dayjs()] },
    { label: "Bu Ay", value: [dayjs().startOf("month"), dayjs()] },
    { label: "Geçen Ay", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
    { label: "Son 3 Ay", value: [dayjs().subtract(3, "month"), dayjs()] },
    { label: "Bu Yıl", value: [dayjs().startOf("year"), dayjs()] },
    { label: "Özel Aralık", value: null, icon: <DateRangeIcon /> }
];

const StatementTab = ({ userId }) => {
    const [loading, setLoading] = useState(true);
    const [statements, setStatements] = useState([]);
    const [error, setError] = useState(null);
    const [dateRange, setDateRange] = useState([dayjs().subtract(15, "day"), dayjs()]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [customDateDialog, setCustomDateDialog] = useState(false);

    const loadStatements = async () => {
        try {
            setLoading(true);
            setError(null);

            const [start, end] = dateRange;
            const response = await fetchTrendyolSettlements({
                userId,
                startDate: start.valueOf(),
                endDate: end.valueOf(),
                transactionType: "PaymentOrder",
                size: 1000
            });

            setStatements(response.data.content || []);

        } catch (err) {
            console.error("Cari hesap verileri yüklenirken hata:", err);
            setError(err.message || "Veriler alınamadı!");
            setStatements([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch bulk data for long date ranges
    const fetchBulkData = async (start, end) => {
        try {
            setBulkLoading(true);
            setError(null);

            const result = await fetchTrendyolSettlementsBulk({
                userId,
                transactionType: "PaymentOrder",
                startDate: start.getTime(),
                endDate: end.getTime()
            });

            setStatements(result.data.content || []);
        } catch (error) {
            console.error("Toplu veri çekme hatası:", error);
            setError("Toplu veri çekme hatası: " + error.message);
            setStatements([]);
        } finally {
            setBulkLoading(false);
        }
    };

    // Handle quick range selection
    const handleQuickRangeSelect = (range) => {
        if (range.action) {
            range.action();
        } else {
            setDateRange(range.value);
            const daysDiff = range.value[1].diff(range.value[0], 'day');
            if (daysDiff > 15) {
                fetchBulkData(range.value[0], range.value[1]);
            } else {
                loadStatements();
            }
        }
    };

    useEffect(() => {
        const daysDiff = dateRange[1].diff(dateRange[0], 'day');
        if (daysDiff > 15) {
            fetchBulkData(dateRange[0], dateRange[1]);
        } else {
            loadStatements();
        }
    }, [userId, dateRange]);

    return (
        <Box>
            {/* Custom Date Dialog */}
            <Dialog
                open={customDateDialog}
                onClose={() => setCustomDateDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center">
                        <DateRangeIcon sx={{ mr: 1 }} />
                        Özel Tarih Aralığı Seçin
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={3} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <DatePicker
                                label="Başlangıç Tarihi"
                                value={dateRange[0]}
                                onChange={(newValue) => setDateRange([newValue, dateRange[1]])}
                                maxDate={dateRange[1]}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <DatePicker
                                label="Bitiş Tarihi"
                                value={dateRange[1]}
                                onChange={(newValue) => setDateRange([dateRange[0], newValue])}
                                minDate={dateRange[0]}
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small'
                                    }
                                }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setCustomDateDialog(false)}
                        color="error"
                    >
                        İptal
                    </Button>
                    <Button
                        onClick={() => {
                            setCustomDateDialog(false);
                            const daysDiff = dateRange[1].diff(dateRange[0], 'day');
                            if (daysDiff > 15) {
                                fetchBulkData(dateRange[0], dateRange[1]);
                            } else {
                                loadStatements();
                            }
                        }}
                        variant="contained"
                        disabled={bulkLoading}
                    >
                        Uygula
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Filter Area */}
            <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    {/* Quick Date Ranges */}
                    <Grid item xs={12} sm="auto">
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {quickRanges.map((range, index) => (
                                <Chip
                                    key={index}
                                    label={range.label}
                                    onClick={() => handleQuickRangeSelect(range)}
                                    icon={range.icon}
                                    sx={{
                                        cursor: 'pointer',
                                        ...(dayjs(dateRange[0]).isSame(range.value?.[0], 'day') &&
                                        dayjs(dateRange[1]).isSame(range.value?.[1], 'day') ? {
                                            bgcolor: 'primary.main',
                                            color: 'primary.contrastText'
                                        } : {})
                                    }}
                                />
                            ))}
                        </Box>
                    </Grid>

                    {/* Date Pickers */}
                    <Grid item xs={12} sm="auto">
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <DatePicker
                                label="Başlangıç"
                                value={dateRange[0]}
                                onChange={(date) => setDateRange([date, dateRange[1]])}
                                maxDate={dateRange[1]}
                                slotProps={{ textField: { size: 'small' } }}
                            />
                            <Typography>-</Typography>
                            <DatePicker
                                label="Bitiş"
                                value={dateRange[1]}
                                onChange={(date) => setDateRange([dateRange[0], date])}
                                minDate={dateRange[0]}
                                slotProps={{ textField: { size: 'small' } }}
                            />
                        </Box>
                    </Grid>

                    {/* Refresh Button */}
                    <Grid item xs={12} sm="auto">
                        <Button
                            variant="contained"
                            onClick={loadStatements}
                            startIcon={<RefreshIcon />}
                            sx={{ height: 40 }}
                            disabled={loading || bulkLoading}
                        >
                            Yenile
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Error Message */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                    <Button
                        onClick={loadStatements}
                        color="inherit"
                        size="small"
                        sx={{ ml: 2 }}
                    >
                        Yeniden Dene
                    </Button>
                </Alert>
            )}

            {/* Table */}
            <FinanceTable
                data={statements}
                title="Cari Hesap Ekstresi"
                loading={loading || bulkLoading}
            />
        </Box>
    );
};

export default StatementTab;
