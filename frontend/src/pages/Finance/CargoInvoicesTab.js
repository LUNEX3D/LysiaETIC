    import React, { useEffect, useState } from "react";
    import {
        Box, Typography, CircularProgress, Paper, Table,
        TableHead, TableRow, TableCell, TableBody, TableContainer,
        Select, MenuItem, Button, Grid, TextField, Alert,
        LinearProgress, Chip, Dialog, DialogTitle,
        DialogContent, DialogActions
    } from "@mui/material";
    import {
        Refresh as RefreshIcon,
        Description as DescriptionIcon,
        LocalShipping as LocalShippingIcon,
        DateRange as DateRangeIcon
    } from "@mui/icons-material";
    import { DatePicker } from "@mui/x-date-pickers/DatePicker";
    import dayjs from "dayjs";
    import { fetchTrendyolOtherFinancials, fetchTrendyolCargoInvoiceItems } from "../../services/financeApi";
    import { formatCurrency } from "../../utils/helpers";

    const quickRanges = [
        { label: "Bugün", value: [dayjs(), dayjs()] },
        { label: "Son 7 gün", value: [dayjs().subtract(7, "day"), dayjs()] },
        { label: "Bu Ay", value: [dayjs().startOf("month"), dayjs()] },
        { label: "Geçen Ay", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
        { label: "Son 3 Ay", value: [dayjs().subtract(3, "month"), dayjs()] },
        { label: "Bu Yıl", value: [dayjs().startOf("year"), dayjs()] },
        { label: "Özel Aralık", value: null, icon: <DateRangeIcon /> }
    ];

    const CargoInvoicesTab = ({ userId }) => {
        const [loading, setLoading] = useState(true);
        const [invoices, setInvoices] = useState([]);
        const [items, setItems] = useState([]);
        const [selectedInvoice, setSelectedInvoice] = useState("");
        const [dateRange, setDateRange] = useState([dayjs().subtract(15, "day"), dayjs()]);
        const [search, setSearch] = useState("");
        const [error, setError] = useState(null);
        const [customDateDialog, setCustomDateDialog] = useState(false);

        // Load cargo invoices
        const loadInvoices = async () => {
            try {
                setLoading(true);
                setError(null);

                const [start, end] = dateRange;
                const response = await fetchTrendyolOtherFinancials({
                    userId,
                    startDate: start.valueOf(),
                    endDate: end.valueOf(),
                    transactionType: "DeductionInvoices",
                    size: 1000
                });

                // Filter only cargo invoices
                const cargoInvoices = (response.data.content || [])
                    .filter(x => x.transactionType.includes("Kargo"))
                    .sort((a, b) => b.transactionDate - a.transactionDate);

                setInvoices(cargoInvoices);

                if (cargoInvoices.length > 0) {
                    setSelectedInvoice(cargoInvoices[0].commissionInvoiceSerialNumber);
                } else {
                    setSelectedInvoice("");
                    setItems([]);
                }

            } catch (err) {
                console.error("Kargo faturaları yüklenirken hata:", err);
                setError(err.message || "Kargo faturaları yüklenirken hata oluştu");
                setInvoices([]);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        // Load details for selected invoice
        const loadInvoiceItems = async () => {
            if (!selectedInvoice) {
                setItems([]);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const response = await fetchTrendyolCargoInvoiceItems({
                    userId,
                    invoiceSerialNumber: selectedInvoice
                });

                setItems(response.data.content || []);

            } catch (err) {
                console.error("Kargo fatura detayları yüklenirken hata:", err);
                setError(err.message || "Kargo fatura detayları yüklenirken hata oluştu");
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        // Handle quick range selection
        const handleQuickRangeSelect = (range) => {
            if (range.action) {
                range.action();
            } else {
                setDateRange(range.value);
                loadInvoices();
            }
        };

        useEffect(() => {
            loadInvoices();
        }, [userId, dateRange]);

        useEffect(() => {
            if (selectedInvoice) {
                loadInvoiceItems();
            }
        }, [selectedInvoice]);

        // Filtered items
        const filteredItems = items.filter(item =>
            String(item.orderNumber).includes(search) ||
            String(item.parcelUniqueId).includes(search)
        );

        // Total cargo cost
        const totalAmount = filteredItems.reduce((sum, item) => sum + (item.amount || 0), 0);

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
                                loadInvoices();
                            }}
                            variant="contained"
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
                                onClick={loadInvoices}
                                startIcon={<RefreshIcon />}
                                sx={{ height: 40 }}
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
                    </Alert>
                )}

                {/* Loading State */}
                {loading && <LinearProgress />}

                {/* No Data Warning */}
                {!loading && invoices.length === 0 && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Seçili tarih aralığında kargo faturası bulunamadı
                    </Alert>
                )}

                {/* Invoice Selection */}
                {invoices.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            Kargo Faturası Seçin
                        </Typography>
                        <Select
                            value={selectedInvoice}
                            onChange={(e) => setSelectedInvoice(e.target.value)}
                            fullWidth
                            size="small"
                            sx={{ mb: 2 }}
                        >
                            {invoices.map((invoice, index) => (
                                <MenuItem
                                    key={index}
                                    value={invoice.commissionInvoiceSerialNumber}
                                >
                                    {invoice.commissionInvoiceSerialNumber} -
                                    {new Date(invoice.transactionDate).toLocaleDateString('tr-TR')} -
                                    {formatCurrency(invoice.debt)}
                                </MenuItem>
                            ))}
                        </Select>
                    </Box>
                )}

                {/* Invoice Details */}
                {selectedInvoice && !loading && (
                    <>
                        {/* Search and Total */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <TextField
                                label="Sipariş No veya Kargo Takip No Ara"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                size="small"
                                sx={{ width: 300 }}
                            />
                            <Typography variant="h6">
                                Toplam: <strong>{formatCurrency(totalAmount)}</strong>
                            </Typography>
                        </Box>

                        {/* Cargo Details Table */}
                        <TableContainer component={Paper} elevation={3}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Paket Tipi</TableCell>
                                        <TableCell>Kargo Takip No</TableCell>
                                        <TableCell>Sipariş No</TableCell>
                                        <TableCell align="right">Tutar</TableCell>
                                        <TableCell align="right">Desi</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                                <Typography color="text.secondary">
                                                    {items.length === 0
                                                        ? "Fatura detayları bulunamadı"
                                                        : "Filtreye uygun kayıt bulunamadı"}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((item, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {item.shipmentPackageType === 'Gönderi Kargo Bedeli' ? (
                                                            <LocalShippingIcon color="primary" fontSize="small" />
                                                        ) : (
                                                            <DescriptionIcon color="secondary" fontSize="small" />
                                                        )}
                                                        {item.shipmentPackageType}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{item.parcelUniqueId}</TableCell>
                                                <TableCell>{item.orderNumber}</TableCell>
                                                <TableCell align="right">
                                                    {formatCurrency(item.amount)}
                                                </TableCell>
                                                <TableCell align="right">{item.desi}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </Box>
        );
    };

    export default CargoInvoicesTab;