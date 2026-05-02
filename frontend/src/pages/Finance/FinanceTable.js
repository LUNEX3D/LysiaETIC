import React, { useState } from "react";
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Typography, Chip, Tooltip, Box, useTheme,
    TablePagination, IconButton, LinearProgress, TableFooter, Avatar
} from "@mui/material";
import {
    AttachMoney as AttachMoneyIcon,
    MoneyOff as MoneyOffIcon,
    LocalShipping as LocalShippingIcon,
    Discount as DiscountIcon,
    AssignmentReturn as AssignmentReturnIcon,
    FirstPage as FirstPageIcon,
    LastPage as LastPageIcon,
    KeyboardArrowLeft,
    KeyboardArrowRight
} from "@mui/icons-material";
import { formatCurrency, formatDate } from "../../utils/helpers";

const TransactionTypeIcon = ({ type }) => {
    const icons = {
        "Satış": <AttachMoneyIcon fontSize="small" color="success" />,
        "İİade": <AssignmentReturnIcon fontSize="small" color="error" />,
        "İndirim": <DiscountIcon fontSize="small" color="warning" />,
        "Kupon": <DiscountIcon fontSize="small" color="secondary" />,
        "Kargo Faturası": <LocalShippingIcon fontSize="small" color="info" />,
        "Ödeme": <MoneyOffIcon fontSize="small" color="primary" />
    };

    return icons[type] || <AttachMoneyIcon fontSize="small" />;
};

function TablePaginationActions({ count, page, rowsPerPage, onPageChange }) {
    const theme = useTheme();

    const handleFirstPageButtonClick = (event) => {
        onPageChange(event, 0);
    };

    const handleBackButtonClick = (event) => {
        onPageChange(event, page - 1);
    };

    const handleNextButtonClick = (event) => {
        onPageChange(event, page + 1);
    };

    const handleLastPageButtonClick = (event) => {
        onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
    };

    return (
        <Box sx={{ flexShrink: 0, ml: 2.5 }}>
            <IconButton
                onClick={handleFirstPageButtonClick}
                disabled={page === 0}
                aria-label="first page"
            >
                {theme.direction === 'rtl' ? <LastPageIcon /> : <FirstPageIcon />}
            </IconButton>
            <IconButton
                onClick={handleBackButtonClick}
                disabled={page === 0}
                aria-label="previous page"
            >
                {theme.direction === 'rtl' ? <KeyboardArrowRight /> : <KeyboardArrowLeft />}
            </IconButton>
            <IconButton
                onClick={handleNextButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="next page"
            >
                {theme.direction === 'rtl' ? <KeyboardArrowLeft /> : <KeyboardArrowRight />}
            </IconButton>
            <IconButton
                onClick={handleLastPageButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="last page"
            >
                {theme.direction === 'rtl' ? <FirstPageIcon /> : <LastPageIcon />}
            </IconButton>
        </Box>
    );
}

const FinanceTable = ({ data = [], title = "Finansal Hareketler", onRowClick, loading }) => {
    const theme = useTheme();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    if (!data || data.length === 0) {
        return (
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
                <Typography color="text.secondary">
                    {loading ? "Veriler yükleniyor..." : "Gösterilecek veri bulunamadı"}
                </Typography>
                {loading && <LinearProgress sx={{ mt: 2 }} />}
            </Paper>
        );
    }

    return (
        <TableContainer
            component={Paper}
            elevation={3}
            sx={{
                mt: 2,
                mb: 4,
                borderRadius: 2,
                '& .MuiTableCell-root': {
                    py: 1.5,
                    fontSize: '0.875rem'
                },
                position: 'relative'
            }}
        >
            {loading && (
                <LinearProgress
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2
                    }}
                />
            )}

            <Box sx={{
                p: 2,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: theme.palette.background.paper
            }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {title} ({data.length} kayıt)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Sayfa {page + 1} / {Math.ceil(data.length / rowsPerPage)}
                </Typography>
            </Box>

            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow sx={{ bgcolor: theme.palette.background.default }}>
                        <TableCell sx={{ fontWeight: 700 }}>Tarih</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Tür</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Açıklama</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Barkod</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Sipariş No</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Tahsilat</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Borç</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Alacak</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Komisyon</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Hakediş</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Komisyon Oranı</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Fatura No</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Ödeme Tarihi</TableCell>
                    </TableRow>
                </TableHead>

                <TableBody>
                    {(rowsPerPage > 0
                            ? data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                            : data
                    ).map((row, index) => (
                        <TableRow
                            key={index}
                            hover
                            onClick={() => onRowClick && onRowClick(row)}
                            sx={{
                                cursor: onRowClick ? 'pointer' : 'default',
                                '&:hover': {
                                    backgroundColor: theme.palette.action.hover
                                }
                            }}
                        >
                            <TableCell>
                                {formatDate(row.transactionDate)}
                            </TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Avatar sx={{
                                        width: 24,
                                        height: 24,
                                        bgcolor: theme.palette.background.paper
                                    }}>
                                        <TransactionTypeIcon type={row.transactionType} />
                                    </Avatar>
                                    <Chip
                                        label={row.transactionType}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                            borderColor: theme.palette.primary.main,
                                            color: theme.palette.text.primary,
                                            ...(row.transactionType === 'Satış' && {
                                                borderColor: theme.palette.success.main,
                                                color: theme.palette.success.main
                                            }),
                                            ...(row.transactionType === 'İİade' && {
                                                borderColor: theme.palette.error.main,
                                                color: theme.palette.error.main
                                            }),
                                            ...(row.transactionType === 'Kargo Faturası' && {
                                                borderColor: theme.palette.secondary.main,
                                                color: theme.palette.secondary.main
                                            })
                                        }}
                                    />
                                </Box>
                            </TableCell>
                            <TableCell>
                                <Tooltip title={row.description || "-"} arrow>
                                    <Typography
                                        sx={{
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            maxWidth: 200
                                        }}
                                    >
                                        {row.description || "-"}
                                    </Typography>
                                </Tooltip>
                            </TableCell>
                            <TableCell>{row.barcode || "-"}</TableCell>
                            <TableCell>{row.orderNumber || "-"}</TableCell>
                            <TableCell align="right">
                                {row.credit ? (
                                    <Typography fontWeight={500}>
                                        {formatCurrency(row.credit)}
                                    </Typography>
                                ) : "-"}
                            </TableCell>
                            <TableCell align="right">
                                {row.debt ? (
                                    <Typography color="error" fontWeight={500}>
                                        -{formatCurrency(row.debt)}
                                    </Typography>
                                ) : "-"}
                            </TableCell>
                            <TableCell align="right">
                                {row.sellerRevenue ? (
                                    <Typography color="success.main" fontWeight={500}>
                                        {formatCurrency(row.sellerRevenue)}
                                    </Typography>
                                ) : "-"}
                            </TableCell>
                            <TableCell align="right">
                                {row.commissionAmount ? (
                                    <Typography color="error" fontWeight={500}>
                                        -{formatCurrency(row.commissionAmount)}
                                    </Typography>
                                ) : "-"}
                            </TableCell>
                            <TableCell align="right">
                                {row.sellerRevenue ? (
                                    <Typography color="success.main" fontWeight={500}>
                                        {formatCurrency(row.sellerRevenue)}
                                    </Typography>
                                ) : "-"}
                            </TableCell>
                            <TableCell align="right">
                                {row.commissionRate != null ? `${row.commissionRate}%` : "-"}
                            </TableCell>
                            <TableCell>
                                {row.commissionInvoiceSerialNumber || "-"}
                            </TableCell>
                            <TableCell>
                                {row.paymentDate ? formatDate(row.paymentDate) : "-"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>

                <TableFooter>
                    <TableRow>
                        <TablePagination
                            rowsPerPageOptions={[10, 20, 50, { label: 'Tümü', value: -1 }]}
                            colSpan={13}
                            count={data.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            SelectProps={{
                                inputProps: {
                                    'aria-label': 'sayfa başına satır',
                                },
                                native: true,
                            }}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            ActionsComponent={TablePaginationActions}
                            labelRowsPerPage="Sayfa başına satır:"
                            labelDisplayedRows={({ from, to, count }) =>
                                `${from}-${to} / ${count !== -1 ? count : `more than ${to}`}`
                            }
                        />
                    </TableRow>
                </TableFooter>
            </Table>
        </TableContainer>
    );
};

export default FinanceTable;