import React, { useState, useEffect } from "react";
import {
    Box, Typography, CircularProgress, Paper, TableContainer, Table, TableHead,
    TableRow, TableCell, TableBody, Tooltip, IconButton, MenuItem, Select,
    FormControl, InputLabel, LinearProgress, Alert, Chip, useTheme, Grid,
    Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from "@mui/material";
import {
    InfoOutlined as InfoOutlinedIcon,
    Refresh as RefreshIcon,
    FilterAlt as FilterAltIcon,
    DateRange as DateRangeIcon
} from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { formatCurrency } from "../../utils/helpers";
import { fetchTrendyolSettlements, fetchTrendyolSettlementsBulk } from "../../services/financeApi";
import FinanceTable from "./FinanceTable";

const transactionTypes = [
    { value: "Sale", label: "Satış" },
    { value: "Return", label: "İİade" },
    { value: "Discount", label: "İndirim" },
    { value: "Coupon", label: "Kupon" },
    { value: "ProvisionPositive", label: "Provizyon (+)" },
    { value: "ProvisionNegative", label: "Provizyon (-)" },
];

const quickRanges = [
    { label: "Bugün", value: [dayjs(), dayjs()] },
    { label: "Son 7 gün", value: [dayjs().subtract(7, "day"), dayjs()] },
    { label: "Bu Ay", value: [dayjs().startOf("month"), dayjs()] },
    { label: "Geçen Ay", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
    { label: "Son 15 gün", value: [dayjs().subtract(15, "day"), dayjs()] },
    { label: "Son 30 gün", value: [dayjs().subtract(30, "day"), dayjs()] },
    { label: "Son 1 Yıl", value: [dayjs().subtract(1, "year"), dayjs()] },
    { label: "Özel Aralık", value: null, icon: <DateRangeIcon /> }
];

const EarningsTab = ({ userId, dateRange: initialDateRange }) => {
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [selected, setSelected] = useState(null);
    const [dateRange, setDateRange] = useState(initialDateRange || [dayjs().subtract(15, "day"), dayjs()]);
    const [search, setSearch] = useState("");
    const [transactionType, setTransactionType] = useState("Sale");
    const [error, setError] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [customDateDialog, setCustomDateDialog] = useState(false);

    // Load data
    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [start, end] = dateRange;
            const response = await fetchTrendyolSettlements({
                userId,
                startDate: start.valueOf(),
                endDate: end.valueOf(),
                transactionType,
                size: 1000
            });

            setData(response.data.content || []);

        } catch (err) {
            console.error("Hakediş verileri yüklenirken hata:", err);
            setError(err.message || "Veriler yüklenirken hata oluştu");
            setData([]);
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
                transactionType: "Sale",
                startDate: start.getTime(),
                endDate: end.getTime()
            });

            setData(result.data.content || []);
        } catch (error) {
            console.error("Toplu veri çekme hatası:", error);
            setError("Toplu veri çekme hatası: " + error.message);
            setData([]);
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
                loadData();
            }
        }
    };

    useEffect(() => {
        const daysDiff = dateRange[1].diff(dateRange[0], 'day');
        if (daysDiff > 15) {
            fetchBulkData(dateRange[0], dateRange[1]);
        } else {
            loadData();
        }
    }, [userId, dateRange, transactionType]);

    // Calculate totals
    const totals = data.reduce((acc, item) => ({
        credit: acc.credit + (item.credit || 0),
        commission: acc.commission + (item.commissionAmount || 0),
        revenue: acc.revenue + (item.sellerRevenue || 0)
    }), { credit: 0, commission: 0, revenue: 0 });

    if (error) {
        return (
            <Alert severity="error" sx={{ my: 2 }}>
                {error}
                <Button
                    onClick={loadData}
                    startIcon={<RefreshIcon />}
                    sx={{ mt: 1 }}
                >
                    Yeniden Dene
                </Button>
            </Alert>
        );
    }

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
                                loadData();
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
            <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
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
                                            backgroundColor: 'primary.main',
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

                    {/* Transaction Type Select */}
                    <Grid item xs={12} sm="auto">
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>İşlem Türü</InputLabel>
                            <Select
                                value={transactionType}
                                onChange={(e) => setTransactionType(e.target.value)}
                                label="İşlem Türü"
                            >
                                {transactionTypes.map((type) => (
                                    <MenuItem key={type.value} value={type.value}>
                                        {type.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Search */}
                    <Grid item xs={12} sm="auto">
                        <TextField
                            label="Sipariş No veya Barkod Ara"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            size="small"
                            fullWidth
                        />
                    </Grid>

                    {/* Refresh Button */}
                    <Grid item xs={12} sm="auto">
                        <Button
                            variant="contained"
                            onClick={loadData}
                            startIcon={<RefreshIcon />}
                            sx={{ height: 40 }}
                            disabled={loading || bulkLoading}
                        >
                            Yenile
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Totals */}
            {!loading && data.length > 0 && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Paper elevation={1} sx={{ p: 1.5, minWidth: 180 }}>
                        <Typography variant="body2" color="text.secondary">Toplam Alacak</Typography>
                        <Typography variant="h6" fontWeight={700}>
                            {formatCurrency(totals.credit)}
                        </Typography>
                    </Paper>
                    <Paper elevation={1} sx={{ p: 1.5, minWidth: 180 }}>
                        <Typography variant="body2" color="text.secondary">Toplam Komisyon</Typography>
                        <Typography variant="h6" fontWeight={700} color="error">
                            -{formatCurrency(totals.commission)}
                        </Typography>
                    </Paper>
                    <Paper elevation={1} sx={{ p: 1.5, minWidth: 180 }}>
                        <Typography variant="body2" color="text.secondary">Toplam Hakediş</Typography>
                        <Typography variant="h6" fontWeight={700} color="success.main">
                            {formatCurrency(totals.revenue)}
                        </Typography>
                    </Paper>
                </Box>
            )}

            {/* Table */}
            <FinanceTable
                data={data.filter(item =>
                    !search ||
                    String(item.orderNumber).includes(search) ||
                    String(item.barcode).includes(search)
                )}
                title={`${transactionTypes.find(t => t.value === transactionType)?.label || ''} İşlemleri`}
                loading={loading || bulkLoading}
                onRowClick={setSelected}
            />

            {/* Detail Dialog */}
            <Dialog
                open={!!selected}
                onClose={() => setSelected(null)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>İşlem Detayları</DialogTitle>
                <DialogContent dividers>
                    {selected && (
                        <Box sx={{ p: 2 }}>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Sipariş No</Typography>
                                    <Typography>{selected.orderNumber || '-'}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Barkod</Typography>
                                    <Typography>{selected.barcode || '-'}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">İşlem Tarihi</Typography>
                                    <Typography>
                                        {new Date(selected.transactionDate).toLocaleString('tr-TR')}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Ödeme Tarihi</Typography>
                                    <Typography>
                                        {selected.paymentDate ?
                                            new Date(selected.paymentDate).toLocaleString('tr-TR') : '-'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">İşlem Türü</Typography>
                                    <Typography>{selected.transactionType || '-'}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Vİade Süresi</Typography>
                                    <Typography>{selected.paymentPeriod || '-'} gün</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Alacak</Typography>
                                    <Typography fontWeight={600}>
                                        {formatCurrency(selected.credit)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Komisyon</Typography>
                                    <Typography color="error" fontWeight={600}>
                                        -{formatCurrency(selected.commissionAmount)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Komisyon Oranı</Typography>
                                    <Typography>
                                        {selected.commissionRate ? `${selected.commissionRate}%` : '-'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2" color="text.secondary">Hakediş</Typography>
                                    <Typography color="success.main" fontWeight={600}>
                                        {formatCurrency(selected.sellerRevenue)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="text.secondary">Açıklama</Typography>
                                    <Typography>{selected.description || '-'}</Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelected(null)}>Kapat</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EarningsTab;