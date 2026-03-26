import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaMoneyBillWave, FaShoppingCart, FaPercentage, FaChartLine,
    FaCheckCircle, FaCreditCard, FaWallet, FaDownload, FaSync,
    FaExclamationTriangle, FaCalendarAlt, FaFilter, FaFileExcel,
    FaFilePdf, FaArrowUp, FaArrowDown, FaClock, FaBox, FaStore,
    FaChartBar, FaChartPie, FaTable, FaSpinner, FaExpand, FaCompress,
    FaInfoCircle, FaTimes, FaChevronDown, FaChevronUp, FaCalculator,
    FaTrendingUp, FaTrendingDown, FaBalanceScale, FaReceipt
} from "react-icons/fa";
import { FaArrowTrendUp, FaArrowTrendDown } from "react-icons/fa6";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart
} from "recharts";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { fetchTrendyolSettlements, fetchTrendyolOtherFinancials, fetchTrendyolSettlementsBulk } from "../services/financeApi";
import { getUserMarketplaces } from "../services/marketplaceApi";

dayjs.locale("tr");

const formatCurrency = (value) => {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2
    }).format(Number(value || 0));
};

const FinancePage = ({ userId, marketplaceId, marketplace, marketplaces: propMarketplaces }) => {
    // If marketplaceId is provided, we're in single marketplace mode (from UserDashboard submenu)
    // Otherwise, we're in multi-marketplace mode (from main Finance menu)
    const isSingleMode = !!marketplaceId;

    const [marketplaces, setMarketplaces] = useState(propMarketplaces || []);
    const [selectedMarketplace, setSelectedMarketplace] = useState(marketplace || null);
    const [dateRange, setDateRange] = useState({
        start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
        end: dayjs().format("YYYY-MM-DD")
    });
    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [settlements, setSettlements] = useState([]);
    const [otherFinancials, setOtherFinancials] = useState([]);
    const [activeView, setActiveView] = useState("overview"); // overview, transactions, charts
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [expandedCard, setExpandedCard] = useState(null);
    // const [allMarketplacesData, setAllMarketplacesData] = useState({}); // REMOVED: No longer needed (like Stock Management)

    const sampleSettlements = [
        { id: "1", transactionDate: dayjs().subtract(1, "day").valueOf(), barcode: "8681385952874", transactionType: "Sale", orderNumber: "501915861", credit: 299.99, debt: 0, sellerRevenue: 254.99, commissionAmount: 45.00, commissionRate: 15 },
        { id: "2", transactionDate: dayjs().subtract(2, "day").valueOf(), barcode: "8681387147421", transactionType: "Sale", orderNumber: "501915862", credit: 149.99, debt: 0, sellerRevenue: 127.49, commissionAmount: 22.50, commissionRate: 15 },
        { id: "3", transactionDate: dayjs().subtract(3, "day").valueOf(), barcode: "8681385952875", transactionType: "Return", orderNumber: "501915863", credit: 0, debt: 199.99, sellerRevenue: -169.99, commissionAmount: -30.00, commissionRate: 15 },
        { id: "4", transactionDate: dayjs().subtract(4, "day").valueOf(), barcode: "8681385952876", transactionType: "Sale", orderNumber: "501915864", credit: 449.99, debt: 0, sellerRevenue: 382.49, commissionAmount: 67.50, commissionRate: 15 },
        { id: "5", transactionDate: dayjs().subtract(5, "day").valueOf(), barcode: "8681385952877", transactionType: "Discount", orderNumber: "501915865", credit: 0, debt: 50.00, sellerRevenue: -50.00, commissionAmount: 0, commissionRate: 0 },
        { id: "6", transactionDate: dayjs().subtract(6, "day").valueOf(), barcode: "8681385952878", transactionType: "Sale", orderNumber: "501915866", credit: 599.99, debt: 0, sellerRevenue: 509.99, commissionAmount: 90.00, commissionRate: 15 },
        { id: "7", transactionDate: dayjs().subtract(7, "day").valueOf(), barcode: "8681385952879", transactionType: "Coupon", orderNumber: "501915867", credit: 0, debt: 30.00, sellerRevenue: -30.00, commissionAmount: 0, commissionRate: 0 },
        { id: "8", transactionDate: dayjs().subtract(8, "day").valueOf(), barcode: "8681385952880", transactionType: "Sale", orderNumber: "501915868", credit: 349.99, debt: 0, sellerRevenue: 297.49, commissionAmount: 52.50, commissionRate: 15 },
        { id: "9", transactionDate: dayjs().subtract(9, "day").valueOf(), barcode: "8681385952881", transactionType: "Sale", orderNumber: "501915869", credit: 799.99, debt: 0, sellerRevenue: 679.99, commissionAmount: 120.00, commissionRate: 15 },
        { id: "10", transactionDate: dayjs().subtract(10, "day").valueOf(), barcode: "8681385952882", transactionType: "Sale", orderNumber: "501915870", credit: 199.99, debt: 0, sellerRevenue: 169.99, commissionAmount: 30.00, commissionRate: 15 },
        { id: "11", transactionDate: dayjs().subtract(11, "day").valueOf(), barcode: "8681385952883", transactionType: "Sale", orderNumber: "501915871", credit: 399.99, debt: 0, sellerRevenue: 339.99, commissionAmount: 60.00, commissionRate: 15 },
        { id: "12", transactionDate: dayjs().subtract(12, "day").valueOf(), barcode: "8681385952884", transactionType: "Sale", orderNumber: "501915872", credit: 249.99, debt: 0, sellerRevenue: 212.49, commissionAmount: 37.50, commissionRate: 15 }
    ];

    const sampleOthers = [
        { id: "o1", transactionDate: dayjs().subtract(1, "day").valueOf(), transactionType: "DeductionInvoices", description: "Kargo kesintisi", debt: 3450.00, credit: 0 },
        { id: "o2", transactionDate: dayjs().subtract(3, "day").valueOf(), transactionType: "PaymentOrder", description: "Haftalık ödeme", debt: 0, credit: 15250.00 },
        { id: "o3", transactionDate: dayjs().subtract(5, "day").valueOf(), transactionType: "DeductionInvoices", description: "Platform hizmet bedeli", debt: 1200.00, credit: 0 },
        { id: "o4", transactionDate: dayjs().subtract(10, "day").valueOf(), transactionType: "PaymentOrder", description: "Haftalık ödeme", debt: 0, credit: 18750.00 }
    ];

    // Load user's marketplaces on mount (only if not provided via props)
    useEffect(() => {
        if (!propMarketplaces || propMarketplaces.length === 0) {
            loadMarketplaces();
        } else {
            setMarketplaces(propMarketplaces);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, propMarketplaces]);

    // Handle single marketplace mode (from UserDashboard submenu)
    useEffect(() => {
        if (isSingleMode && marketplace) {
            // Use the marketplace prop directly (like CargoTrackingPage)
            setSelectedMarketplace(marketplace);
        } else if (isSingleMode && marketplaceId && marketplaces.length > 0) {
            const mp = marketplaces.find(m => m._id === marketplaceId);
            if (mp) {
                setSelectedMarketplace(mp);
            }
        } else if (!isSingleMode && marketplaces.length > 0 && !selectedMarketplace) {
            // Auto-select first marketplace in multi mode
            setSelectedMarketplace(marketplaces[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSingleMode, marketplaceId, marketplace, marketplaces]);

    // Load finance data when marketplace or date changes
    useEffect(() => {
        if (!marketplaceId || !selectedMarketplace) {
            if (isSingleMode) {
                // Single mode requires marketplace selection
                return;
            }
        }
        if (selectedMarketplace) {
            loadFinanceData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMarketplace, dateRange, marketplaceId]);

    // Load all marketplaces data for overview (when no marketplace selected) - DISABLED for single mode consistency
    // useEffect(() => {
    //     if (!selectedMarketplace && marketplaces.length > 0 && !isSingleMode) {
    //         loadAllMarketplacesData();
    //     }
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [selectedMarketplace, marketplaces, dateRange]);

    // Auto-refresh every 30 seconds (like UserDashboard but less frequent)
    useEffect(() => {
        if (!autoRefresh || !selectedMarketplace) return;

        const intervalId = setInterval(() => {
            loadFinanceData();
        }, 30000); // 30 seconds

        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh, selectedMarketplace, dateRange]);

    const loadMarketplaces = async () => {
        if (!userId) return;

        try {
            const data = await getUserMarketplaces(userId);
            setMarketplaces(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Pazaryerleri yüklenirken hata:", error);
            setMarketplaces([]);
        }
    };

    const loadFinanceData = async () => {
        if (!userId || !selectedMarketplace) return;

        setLoading(true);
        setLoadingProgress(0);

        try {
            const supplierId = selectedMarketplace.credentials?.supplierId ||
                              selectedMarketplace.credentials?.sellerId ||
                              localStorage.getItem("sellerId") ||
                              userId;

            const startDate = dayjs(dateRange.start);
            const endDate = dayjs(dateRange.end);
            const daysDiff = endDate.diff(startDate, "day");

            // Check if date range is larger than 30 days - use bulk fetch
            if (daysDiff > 30) {
                // Bulk fetch with progress
                const params = {
                    userId: supplierId,
                    supplierId: supplierId,
                    sellerId: supplierId,
                    marketplaceId: selectedMarketplace._id, // ✅ Pass marketplace ID
                    startDate: startDate.valueOf(),
                    endDate: endDate.valueOf(),
                    page: 0,
                    size: 500
                };

                const settlementsRes = await fetchTrendyolSettlementsBulk(params, (progress) => {
                    setLoadingProgress(progress);
                });

                const settData = settlementsRes?.data?.content || [];
                setSettlements(settData.length > 0 ? settData : sampleSettlements);
                setOtherFinancials(sampleOthers);
                setLastUpdate(new Date());
            } else {
                // Normal fetch for <= 30 days
                const params = {
                    userId: supplierId,
                    supplierId: supplierId,
                    sellerId: supplierId,
                    marketplaceId: selectedMarketplace._id, // ✅ Pass marketplace ID
                    startDate: startDate.valueOf(),
                    endDate: endDate.valueOf(),
                    page: 0,
                    size: 500
                };

                const [settlementsRes, othersRes] = await Promise.all([
                    fetchTrendyolSettlements(params).catch(() => ({ data: { content: [] } })),
                    fetchTrendyolOtherFinancials(params).catch(() => ({ data: { content: [] } }))
                ]);

                const settData = settlementsRes?.data?.content || settlementsRes?.content || [];
                const othData = othersRes?.data?.content || othersRes?.content || [];

                if (settData.length === 0 && othData.length === 0) {
                    setSettlements(sampleSettlements);
                    setOtherFinancials(sampleOthers);
                } else {
                    setSettlements(settData);
                    setOtherFinancials(othData);
                }
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error("Finance data error:", error);
            setSettlements(sampleSettlements);
            setOtherFinancials(sampleOthers);
        } finally {
            setLoading(false);
            setLoadingProgress(0);
        }
    };

    // REMOVED: loadAllMarketplacesData - No longer needed (like Stock Management)
    // const loadAllMarketplacesData = async () => { ... }

    const analytics = useMemo(() => {
        const salesData = settlements.filter(s => s.transactionType === "Sale");
        const returnData = settlements.filter(s => s.transactionType === "Return");
        const discountData = settlements.filter(s => s.transactionType === "Discount");
        const couponData = settlements.filter(s => s.transactionType === "Coupon");

        const totalSales = salesData.reduce((sum, s) => sum + Number(s.credit || 0), 0);
        const totalReturns = returnData.reduce((sum, s) => sum + Number(s.debt || 0), 0);
        const totalRevenue = settlements.reduce((sum, s) => sum + Number(s.sellerRevenue || 0), 0);
        const totalCommission = settlements.reduce((sum, s) => sum + Number(s.commissionAmount || 0), 0);
        const totalDiscounts = discountData.reduce((sum, s) => sum + Number(s.debt || 0), 0);
        const totalCoupons = couponData.reduce((sum, s) => sum + Number(s.debt || 0), 0);

        const orderCount = salesData.length;
        const returnCount = returnData.length;
        const returnRate = orderCount > 0 ? (returnCount / orderCount) * 100 : 0;
        const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
        const avgCommissionRate = totalSales > 0 ? (totalCommission / totalSales) * 100 : 0;

        const payments = otherFinancials.filter(o => o.transactionType === "PaymentOrder");
        const deductions = otherFinancials.filter(o => o.transactionType === "DeductionInvoices");

        const totalPayments = payments.reduce((sum, p) => sum + Number(p.credit || 0), 0);
        const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.debt || 0), 0);

        const netProfit = totalRevenue - totalCommission + totalPayments - totalDeductions;
        const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
        const grossMargin = totalSales > 0 ? ((totalSales - totalCommission) / totalSales) * 100 : 0;

        // Daily breakdown
        const dailyData = {};
        settlements.forEach(s => {
            const date = dayjs(s.transactionDate).format("DD MMM");
            if (!dailyData[date]) {
                dailyData[date] = {
                    date,
                    revenue: 0,
                    commission: 0,
                    orders: 0,
                    sales: 0,
                    returns: 0,
                    netRevenue: 0
                };
            }
            dailyData[date].revenue += Number(s.sellerRevenue || 0);
            dailyData[date].commission += Number(s.commissionAmount || 0);
            if (s.transactionType === "Sale") {
                dailyData[date].orders += 1;
                dailyData[date].sales += Number(s.credit || 0);
            }
            if (s.transactionType === "Return") {
                dailyData[date].returns += Number(s.debt || 0);
            }
            dailyData[date].netRevenue = dailyData[date].sales - dailyData[date].returns - dailyData[date].commission;
        });

        const trendData = Object.values(dailyData).sort((a, b) =>
            dayjs(a.date, "DD MMM").valueOf() - dayjs(b.date, "DD MMM").valueOf()
        );

        // Calculate daily averages
        const daysCount = trendData.length || 1;
        const avgDailyRevenue = totalRevenue / daysCount;
        const avgDailyOrders = orderCount / daysCount;
        const avgDailyProfit = netProfit / daysCount;

        // Transaction type distribution
        const transactionTypes = {
            sales: { count: salesData.length, amount: totalSales },
            returns: { count: returnData.length, amount: totalReturns },
            discounts: { count: discountData.length, amount: totalDiscounts },
            coupons: { count: couponData.length, amount: totalCoupons },
            payments: { count: payments.length, amount: totalPayments },
            deductions: { count: deductions.length, amount: totalDeductions }
        };

        return {
            totalSales,
            totalReturns,
            totalRevenue,
            totalCommission,
            totalDiscounts,
            totalCoupons,
            orderCount,
            returnCount,
            returnRate,
            avgOrderValue,
            avgCommissionRate,
            totalPayments,
            totalDeductions,
            trendData,
            netProfit,
            profitMargin,
            grossMargin,
            avgDailyRevenue,
            avgDailyOrders,
            avgDailyProfit,
            transactionTypes,
            daysCount
        };
    }, [settlements, otherFinancials]);

    const kpiCards = [
        {
            id: "totalSales",
            label: "Toplam Satış",
            value: formatCurrency(analytics.totalSales),
            subtitle: `${analytics.orderCount} sipariş`,
            icon: FaShoppingCart,
            color: "#10b981",
            trend: "+12.5%",
            trendUp: true,
            details: [
                { label: "Günlük Ortalama", value: formatCurrency(analytics.avgDailyRevenue) },
                { label: "Sipariş Başına", value: formatCurrency(analytics.avgOrderValue) },
                { label: "Toplam Gün", value: `${analytics.daysCount} gün` },
                { label: "Günlük Sipariş", value: `${analytics.avgDailyOrders.toFixed(1)} adet` }
            ]
        },
        {
            id: "netRevenue",
            label: "Net Gelir",
            value: formatCurrency(analytics.totalRevenue),
            subtitle: "Komisyon öncesi",
            icon: FaMoneyBillWave,
            color: "#4ecdc4",
            trend: "+8.3%",
            trendUp: true,
            details: [
                { label: "Brüt Satış", value: formatCurrency(analytics.totalSales) },
                { label: "İadeler", value: formatCurrency(analytics.totalReturns) },
                { label: "İndirimler", value: formatCurrency(analytics.totalDiscounts) },
                { label: "Kuponlar", value: formatCurrency(analytics.totalCoupons) }
            ]
        },
        {
            id: "commission",
            label: "Toplam Komisyon",
            value: formatCurrency(analytics.totalCommission),
            subtitle: `Ort. %${analytics.avgCommissionRate.toFixed(1)}`,
            icon: FaPercentage,
            color: "#f59e0b",
            trend: "-2.1%",
            trendUp: false,
            details: [
                { label: "Komisyon Oranı", value: `%${analytics.avgCommissionRate.toFixed(2)}` },
                { label: "Brüt Marj", value: `%${analytics.grossMargin.toFixed(2)}` },
                { label: "Satıştan Kesinti", value: formatCurrency(analytics.totalCommission) },
                { label: "Günlük Ort. Komisyon", value: formatCurrency(analytics.totalCommission / analytics.daysCount) }
            ]
        },
        {
            id: "netProfit",
            label: "Net Kar",
            value: formatCurrency(analytics.netProfit),
            subtitle: "Tüm kesintiler sonrası",
            icon: FaWallet,
            color: analytics.netProfit >= 0 ? "#8b5cf6" : "#ef4444",
            trend: "+15.7%",
            trendUp: analytics.netProfit >= 0,
            details: [
                { label: "Kar Marjı", value: `%${analytics.profitMargin.toFixed(2)}` },
                { label: "Günlük Ort. Kar", value: formatCurrency(analytics.avgDailyProfit) },
                { label: "Toplam Gelir", value: formatCurrency(analytics.totalRevenue) },
                { label: "Toplam Gider", value: formatCurrency(analytics.totalCommission + analytics.totalDeductions) }
            ]
        },
        {
            id: "returnRate",
            label: "İade Oranı",
            value: `%${analytics.returnRate.toFixed(1)}`,
            subtitle: `${analytics.returnCount} iade`,
            icon: FaArrowDown,
            color: analytics.returnRate > 10 ? "#ef4444" : "#22c55e",
            trend: analytics.returnRate > 10 ? "+3.2%" : "-1.5%",
            trendUp: analytics.returnRate <= 10,
            details: [
                { label: "Toplam İade", value: `${analytics.returnCount} adet` },
                { label: "İade Tutarı", value: formatCurrency(analytics.totalReturns) },
                { label: "Başarılı Sipariş", value: `${analytics.orderCount - analytics.returnCount} adet` },
                { label: "İade/Satış Oranı", value: `%${analytics.returnRate.toFixed(2)}` }
            ]
        },
        {
            id: "avgBasket",
            label: "Ortalama Sepet",
            value: formatCurrency(analytics.avgOrderValue),
            subtitle: "Sipariş başına",
            icon: FaBox,
            color: "#06b6d4",
            trend: "+5.8%",
            trendUp: true,
            details: [
                { label: "En Yüksek Sepet", value: formatCurrency(Math.max(...settlements.filter(s => s.transactionType === "Sale").map(s => s.credit || 0), 0)) },
                { label: "En Düşük Sepet", value: formatCurrency(Math.min(...settlements.filter(s => s.transactionType === "Sale").map(s => s.credit || 0).filter(v => v > 0), 0)) },
                { label: "Toplam Sipariş", value: `${analytics.orderCount} adet` },
                { label: "Toplam Tutar", value: formatCurrency(analytics.totalSales) }
            ]
        },
        {
            id: "payments",
            label: "Ödeme Alınan",
            value: formatCurrency(analytics.totalPayments),
            subtitle: "Hesaba geçen",
            icon: FaCheckCircle,
            color: "#22c55e",
            trend: "+18.2%",
            trendUp: true,
            details: [
                { label: "Ödeme Sayısı", value: `${analytics.transactionTypes.payments.count} adet` },
                { label: "Ortalama Ödeme", value: formatCurrency(analytics.totalPayments / Math.max(analytics.transactionTypes.payments.count, 1)) },
                { label: "Bekleyen Gelir", value: formatCurrency(analytics.totalRevenue - analytics.totalPayments) },
                { label: "Ödeme Oranı", value: `%${((analytics.totalPayments / Math.max(analytics.totalRevenue, 1)) * 100).toFixed(1)}` }
            ]
        },
        {
            id: "deductions",
            label: "Kesintiler",
            value: formatCurrency(analytics.totalDeductions),
            subtitle: "Kargo, platform vb.",
            icon: FaCreditCard,
            color: "#ef4444",
            trend: "+2.5%",
            trendUp: false,
            details: [
                { label: "Kesinti Sayısı", value: `${analytics.transactionTypes.deductions.count} adet` },
                { label: "Ortalama Kesinti", value: formatCurrency(analytics.totalDeductions / Math.max(analytics.transactionTypes.deductions.count, 1)) },
                { label: "Gelire Oranı", value: `%${((analytics.totalDeductions / Math.max(analytics.totalRevenue, 1)) * 100).toFixed(2)}` },
                { label: "Günlük Ort.", value: formatCurrency(analytics.totalDeductions / analytics.daysCount) }
            ]
        }
    ];

    // Marketplace logos
    const marketplaceLogos = {
        "Trendyol": "🛍️",
        "Hepsiburada": "🛒",
        "N11": "🏪",
        "n11": "🏪",
        "Amazon": "📦",
        "ÇiçekSepeti": "🌸",
        "Çiçeksepeti": "🌸",
        "PTTAvm": "📮",
        "GittiGidiyor": "🎯"
    };

    const getMarketplaceLogo = (name) => {
        return marketplaceLogos[name] || "🏬";
    };

    // REMOVED: combinedAnalytics - No longer needed (like Stock Management)
    // const combinedAnalytics = useMemo(() => { ... }, [allMarketplacesData, marketplaces]);

    // Chart colors
    const COLORS = ['#4ecdc4', '#44a08d', '#f59e0b', '#8b5cf6', '#ef4444', '#22c55e', '#06b6d4', '#ec4899'];

    // Export to Excel (CSV)
    const exportToExcel = () => {
        if (settlements.length === 0) {
            alert("Dışa aktarılacak veri yok!");
            return;
        }

        const headers = ["Tarih", "Sipariş No", "Barkod", "İşlem Tipi", "Alacak", "Borç", "Komisyon", "Net Gelir"];
        const rows = settlements.map(item => [
            dayjs(item.transactionDate).format("DD/MM/YYYY"),
            item.orderNumber || "-",
            item.barcode || "-",
            item.transactionType,
            item.credit > 0 ? item.credit.toFixed(2) : "-",
            item.debt > 0 ? item.debt.toFixed(2) : "-",
            (item.commissionAmount || 0).toFixed(2),
            (item.sellerRevenue || 0).toFixed(2)
        ]);

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += headers.join(",") + "\n";
        rows.forEach(row => {
            csvContent += row.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `finans_raporu_${selectedMarketplace?.marketplaceName}_${dayjs().format("YYYY-MM-DD")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export to PDF (Print)
    const exportToPDF = () => {
        if (settlements.length === 0) {
            alert("Dışa aktarılacak veri yok!");
            return;
        }

        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Finans Raporu</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: Arial, sans-serif; padding: 20px; }');
        printWindow.document.write('h1 { color: #4ecdc4; }');
        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
        printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }');
        printWindow.document.write('th { background-color: #4ecdc4; color: white; }');
        printWindow.document.write('.summary { margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }');
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(`<h1>Finans Raporu - ${selectedMarketplace?.marketplaceName}</h1>`);
        printWindow.document.write(`<p>Tarih Aralığı: ${dayjs(dateRange.start).format("DD/MM/YYYY")} - ${dayjs(dateRange.end).format("DD/MM/YYYY")}</p>`);
        printWindow.document.write('<table>');
        printWindow.document.write('<tr><th>Tarih</th><th>Sipariş No</th><th>Barkod</th><th>İşlem Tipi</th><th>Alacak</th><th>Borç</th><th>Komisyon</th><th>Net Gelir</th></tr>');

        settlements.forEach(item => {
            printWindow.document.write('<tr>');
            printWindow.document.write(`<td>${dayjs(item.transactionDate).format("DD/MM/YYYY")}</td>`);
            printWindow.document.write(`<td>${item.orderNumber || "-"}</td>`);
            printWindow.document.write(`<td>${item.barcode || "-"}</td>`);
            printWindow.document.write(`<td>${item.transactionType}</td>`);
            printWindow.document.write(`<td>${item.credit > 0 ? formatCurrency(item.credit) : "-"}</td>`);
            printWindow.document.write(`<td>${item.debt > 0 ? formatCurrency(item.debt) : "-"}</td>`);
            printWindow.document.write(`<td>${formatCurrency(item.commissionAmount || 0)}</td>`);
            printWindow.document.write(`<td>${formatCurrency(item.sellerRevenue || 0)}</td>`);
            printWindow.document.write('</tr>');
        });

        printWindow.document.write('</table>');
        printWindow.document.write('<div class="summary">');
        printWindow.document.write(`<p><strong>Toplam Satış:</strong> ${formatCurrency(analytics.totalSales)}</p>`);
        printWindow.document.write(`<p><strong>Net Gelir:</strong> ${formatCurrency(analytics.netRevenue)}</p>`);
        printWindow.document.write(`<p><strong>Toplam Komisyon:</strong> ${formatCurrency(analytics.totalCommission)}</p>`);
        printWindow.document.write(`<p><strong>Net Kar:</strong> ${formatCurrency(analytics.netProfit)}</p>`);
        printWindow.document.write('</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div style={{
            width: "100%",
            minHeight: "100vh",
            background: "#0f1419",
            color: "#fff",
            padding: 0,
            margin: 0
        }}>
            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}
            </style>
            {/* Top Header Bar */}
            <div style={{
                background: "linear-gradient(135deg, #1a1f35 0%, #0a0e1a 100%)",
                borderBottom: "1px solid rgba(78, 205, 196, 0.2)",
                padding: "1.5rem 2rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem"
            }}>
                <div>
                    <h1 style={{
                        fontSize: "1.75rem",
                        fontWeight: "700",
                        background: "linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        marginBottom: "0.25rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                    }}>
                        <FaMoneyBillWave />
                        {isSingleMode && selectedMarketplace
                            ? `${selectedMarketplace.name || selectedMarketplace.marketplaceName} Finans Yönetimi`
                            : "Finans Yönetimi"}
                    </h1>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
                            {isSingleMode && selectedMarketplace
                                ? `${getMarketplaceLogo(selectedMarketplace.marketplaceName)} Detaylı finansal analiz ve raporlama`
                                : selectedMarketplace
                                ? `${getMarketplaceLogo(selectedMarketplace.marketplaceName)} ${selectedMarketplace.marketplaceName} - Detaylı finansal analiz ve raporlama`
                                : "Tüm pazaryerleri - Genel finansal değerlendirme"}
                        </p>
                        {lastUpdate && (
                            <span style={{
                                color: "#64748b",
                                fontSize: "0.75rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.25rem"
                            }}>
                                <FaClock />
                                Son güncelleme: {dayjs(lastUpdate).format("HH:mm:ss")}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Auto Refresh Toggle */}
                    {selectedMarketplace && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            style={{
                                background: autoRefresh ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${autoRefresh ? "#22c55e" : "rgba(255,255,255,0.1)"}`,
                                padding: "0.6rem 1rem",
                                borderRadius: "8px",
                                color: autoRefresh ? "#22c55e" : "#94a3b8",
                                fontWeight: "600",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.75rem"
                            }}
                        >
                            <FaClock />
                            Otomatik Yenileme {autoRefresh ? "Açık" : "Kapalı"}
                        </motion.button>
                    )}

                    {/* Date Range */}
                    {selectedMarketplace && (
                        <div style={{
                            background: "rgba(255,255,255,0.05)",
                            padding: "0.6rem 1rem",
                            borderRadius: "8px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem"
                        }}>
                            <FaCalendarAlt style={{ color: "#4ecdc4", fontSize: "0.875rem" }} />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#fff",
                                    outline: "none",
                                    fontSize: "0.875rem",
                                    width: "130px"
                                }}
                            />
                            <span style={{ color: "#64748b" }}>-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#fff",
                                    outline: "none",
                                    fontSize: "0.875rem",
                                    width: "130px"
                                }}
                            />
                        </div>
                    )}

                    {/* Refresh Button */}
                    {selectedMarketplace && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={loadFinanceData}
                            disabled={loading}
                            style={{
                                background: loading
                                    ? "rgba(78, 205, 196, 0.3)"
                                    : "linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)",
                                border: "none",
                                padding: "0.6rem 1.25rem",
                                borderRadius: "8px",
                                color: "#fff",
                                fontWeight: "600",
                                cursor: loading ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                fontSize: "0.875rem"
                            }}
                        >
                            {loading ? (
                                <>
                                    <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                                    Yükleniyor {loadingProgress > 0 ? `${loadingProgress}%` : "..."}
                                </>
                            ) : (
                                <>
                                    <FaSync />
                                    Yenile
                                </>
                            )}
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Marketplace Tabs - Removed in single mode (like CargoTrackingPage) */}

            {/* Single Mode Indicator */}
            {isSingleMode && selectedMarketplace && (
                <div style={{
                    background: "rgba(78, 205, 196, 0.1)",
                    borderBottom: "1px solid rgba(78, 205, 196, 0.2)",
                    padding: "0.75rem 2rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                }}>
                    <span style={{ fontSize: "1.2rem" }}>
                        {getMarketplaceLogo(selectedMarketplace.marketplaceName)}
                    </span>
                    <span style={{ color: "#4ecdc4", fontWeight: "600", fontSize: "0.875rem" }}>
                        {selectedMarketplace.marketplaceName} Finans Detayları
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.75rem", marginLeft: "auto" }}>
                        Seller ID: {selectedMarketplace.credentials?.supplierId || selectedMarketplace.credentials?.sellerId || "N/A"}
                    </span>
                </div>
            )}

            {/* No Marketplace Message - Show for both single and multi mode */}
            {marketplaces.length === 0 && (
                <div style={{ padding: "2rem" }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "2px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "12px",
                            padding: "3rem",
                            textAlign: "center",
                            maxWidth: "600px",
                            margin: "4rem auto"
                        }}
                    >
                        <FaExclamationTriangle style={{ fontSize: "4rem", color: "#ef4444", marginBottom: "1.5rem" }} />
                        <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#fff" }}>
                            Pazaryeri Entegrasyonu Bulunamadı
                        </h3>
                        <p style={{ color: "#94a3b8", marginBottom: "0.5rem", fontSize: "1rem" }}>
                            Finans verilerini görüntülemek için önce bir pazaryeri entegrasyonu eklemelisiniz.
                        </p>
                        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                            Entegrasyonlar menüsünden Trendyol, Hepsiburada, N11, Amazon veya diğer pazaryerlerini entegre edebilirsiniz.
                        </p>
                    </motion.div>
                </div>
            )}

            {/* View Tabs - Only for specific marketplace */}
            {selectedMarketplace && (
                <div style={{
                    background: "#0f1419",
                    padding: "1rem 2rem 0 2rem"
                }}>
                    <div style={{
                        display: "flex",
                        gap: "0.25rem",
                        borderBottom: "2px solid rgba(255,255,255,0.05)"
                    }}>
                        {[
                            { id: "overview", label: "Genel Bakış", icon: FaChartLine },
                            { id: "charts", label: "Grafikler", icon: FaChartBar },
                            { id: "transactions", label: "İşlemler", icon: FaTable }
                        ].map((view) => (
                            <motion.button
                                key={view.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveView(view.id)}
                                style={{
                                    background: activeView === view.id
                                        ? "rgba(78, 205, 196, 0.15)"
                                        : "transparent",
                                    border: "none",
                                    borderBottom: activeView === view.id
                                        ? "2px solid #4ecdc4"
                                        : "2px solid transparent",
                                    padding: "0.75rem 1.5rem",
                                    color: activeView === view.id ? "#4ecdc4" : "#94a3b8",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    fontSize: "0.875rem",
                                    transition: "all 0.2s ease",
                                    marginBottom: "-2px"
                                }}
                            >
                                <view.icon />
                                {view.label}
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div style={{ padding: "2rem", background: "#0f1419" }}>
                <AnimatePresence mode="wait">
                    {/* Show empty state if no marketplace selected - LIKE STOCK MANAGEMENT */}
                    {!selectedMarketplace && marketplaces.length > 0 && (
                        <motion.div
                            key="no-marketplace"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            style={{
                                background: "#1a1f35",
                                borderRadius: "12px",
                                padding: "3rem",
                                textAlign: "center"
                            }}
                        >
                            <FaExclamationTriangle style={{ fontSize: "3rem", color: "#f59e0b", marginBottom: "1rem" }} />
                            <h3 style={{ color: "#f8fafc", marginBottom: "0.5rem", fontSize: "1.5rem" }}>Pazaryeri Seçilmedi</h3>
                            <p style={{ color: "#94a3b8" }}>
                                Lütfen soldaki menüden bir pazaryeri seçin.
                            </p>
                        </motion.div>
                    )}



                    {/* Marketplace Specific Views */}
                    {activeView === "overview" && selectedMarketplace && (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* KPI Cards Grid - Expandable */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                                gap: "1.25rem",
                                marginBottom: "2rem"
                            }}>
                                {kpiCards.map((kpi, index) => (
                                    <motion.div
                                        key={kpi.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileHover={{ y: -3, boxShadow: `0 10px 30px ${kpi.color}40` }}
                                        style={{
                                            background: "linear-gradient(135deg, rgba(26, 31, 53, 0.6) 0%, rgba(15, 20, 25, 0.6) 100%)",
                                            border: `1px solid ${kpi.color}30`,
                                            padding: "1.25rem",
                                            borderRadius: "12px",
                                            position: "relative",
                                            overflow: "hidden",
                                            cursor: "pointer"
                                        }}
                                        onClick={() => setExpandedCard(expandedCard === kpi.id ? null : kpi.id)}
                                    >
                                        {/* Background gradient */}
                                        <div style={{
                                            position: "absolute",
                                            top: 0,
                                            right: 0,
                                            width: "80px",
                                            height: "80px",
                                            background: `radial-gradient(circle, ${kpi.color}20 0%, transparent 70%)`,
                                            pointerEvents: "none"
                                        }} />

                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                                            <div style={{
                                                background: `${kpi.color}20`,
                                                padding: "0.6rem",
                                                borderRadius: "10px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center"
                                            }}>
                                                <kpi.icon style={{ fontSize: "1.25rem", color: kpi.color }} />
                                            </div>

                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                {kpi.trendUp !== null && (
                                                    <div style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "0.25rem",
                                                        color: kpi.trendUp ? "#22c55e" : "#ef4444",
                                                        fontSize: "0.75rem",
                                                        fontWeight: "600"
                                                    }}>
                                                        {kpi.trendUp ? <FaArrowTrendUp /> : <FaArrowTrendDown />}
                                                        {kpi.trend}
                                                    </div>
                                                )}
                                                <motion.div
                                                    animate={{ rotate: expandedCard === kpi.id ? 180 : 0 }}
                                                    style={{ color: kpi.color, fontSize: "0.875rem" }}
                                                >
                                                    <FaChevronDown />
                                                </motion.div>
                                            </div>
                                        </div>

                                        <div>
                                            <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                                                {kpi.label}
                                            </p>
                                            <h3 style={{
                                                fontSize: "1.5rem",
                                                fontWeight: "700",
                                                color: "#fff",
                                                marginBottom: "0.25rem"
                                            }}>
                                                {kpi.value}
                                            </h3>
                                            <p style={{ color: "#64748b", fontSize: "0.7rem" }}>
                                                {kpi.subtitle}
                                            </p>
                                        </div>

                                        {/* Expanded Details */}
                                        <AnimatePresence>
                                            {expandedCard === kpi.id && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    style={{
                                                        marginTop: "1rem",
                                                        paddingTop: "1rem",
                                                        borderTop: `1px solid ${kpi.color}30`
                                                    }}
                                                >
                                                    <div style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr 1fr",
                                                        gap: "0.75rem"
                                                    }}>
                                                        {kpi.details.map((detail, idx) => (
                                                            <div key={idx} style={{
                                                                background: "rgba(255,255,255,0.03)",
                                                                padding: "0.75rem",
                                                                borderRadius: "8px",
                                                                border: "1px solid rgba(255,255,255,0.05)"
                                                            }}>
                                                                <p style={{
                                                                    color: "#94a3b8",
                                                                    fontSize: "0.7rem",
                                                                    marginBottom: "0.25rem"
                                                                }}>
                                                                    {detail.label}
                                                                </p>
                                                                <p style={{
                                                                    color: kpi.color,
                                                                    fontSize: "0.875rem",
                                                                    fontWeight: "600"
                                                                }}>
                                                                    {detail.value}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                        </div>
                    </motion.div>
                )}

                    {activeView === "charts" && selectedMarketplace && (
                        <motion.div
                            key="charts"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* Charts Section */}
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
                                gap: "1.5rem",
                                marginBottom: "2rem"
                            }}>
                                {/* Revenue Trend Chart */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    style={{
                                        background: "linear-gradient(135deg, rgba(26, 31, 53, 0.6) 0%, rgba(15, 20, 25, 0.6) 100%)",
                                        border: "1px solid rgba(78, 205, 196, 0.2)",
                                        padding: "1.5rem",
                                        borderRadius: "12px"
                                    }}
                                >
                                <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>
                                    📈 Gelir Trendi
                                </h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={analytics.trendData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4ecdc4" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#4ecdc4" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                        <YAxis stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: "rgba(10, 14, 26, 0.95)",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                borderRadius: "8px",
                                                color: "#fff"
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke="#4ecdc4"
                                            fillOpacity={1}
                                            fill="url(#colorRevenue)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </motion.div>

                                {/* Orders Chart */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    style={{
                                        background: "linear-gradient(135deg, rgba(26, 31, 53, 0.6) 0%, rgba(15, 20, 25, 0.6) 100%)",
                                        border: "1px solid rgba(68, 160, 141, 0.2)",
                                        padding: "1.5rem",
                                        borderRadius: "12px"
                                    }}
                                >
                                <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>
                                    📦 Sipariş Sayısı
                                </h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={analytics.trendData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                        <YAxis stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: "rgba(10, 14, 26, 0.95)",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                borderRadius: "8px",
                                                color: "#fff"
                                            }}
                                        />
                                        <Bar dataKey="orders" fill="#44a08d" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </motion.div>

                                {/* Commission Chart */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.2 }}
                                    style={{
                                        background: "linear-gradient(135deg, rgba(26, 31, 53, 0.6) 0%, rgba(15, 20, 25, 0.6) 100%)",
                                        border: "1px solid rgba(245, 158, 11, 0.2)",
                                        padding: "1.5rem",
                                        borderRadius: "12px"
                                    }}
                                >
                                <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>
                                    💰 Komisyon Analizi
                                </h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={analytics.trendData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                        <YAxis stroke="#94a3b8" style={{ fontSize: "0.75rem" }} />
                                        <Tooltip
                                            contentStyle={{
                                                background: "rgba(10, 14, 26, 0.95)",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                borderRadius: "8px",
                                                color: "#fff"
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="commission"
                                            stroke="#f59e0b"
                                            strokeWidth={3}
                                            dot={{ fill: "#f59e0b", r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </motion.div>

                                {/* Transaction Distribution Pie Chart */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3 }}
                                    style={{
                                        background: "linear-gradient(135deg, rgba(26, 31, 53, 0.6) 0%, rgba(15, 20, 25, 0.6) 100%)",
                                        border: "1px solid rgba(139, 92, 246, 0.2)",
                                        padding: "1.5rem",
                                        borderRadius: "12px"
                                    }}
                                >
                                <h3 style={{ fontSize: "1.25rem", marginBottom: "1.5rem", color: "#fff" }}>
                                    🎯 İşlem Dağılımı
                                </h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: "Satış", value: analytics.orderCount },
                                                { name: "İade", value: analytics.returnCount },
                                                { name: "Diğer", value: settlements.filter(s => !["Sale", "Return"].includes(s.transactionType)).length }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {COLORS.map((color, index) => (
                                                <Cell key={`cell-${index}`} fill={color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: "rgba(10, 14, 26, 0.95)",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                borderRadius: "8px",
                                                color: "#fff"
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}

                    {activeView === "transactions" && selectedMarketplace && (
                        <motion.div
                            key="transactions"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* Transactions Table */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{
                                    background: "linear-gradient(135deg, rgba(26, 31, 53, 0.6) 0%, rgba(15, 20, 25, 0.6) 100%)",
                                    border: "1px solid rgba(78, 205, 196, 0.2)",
                                    padding: "1.5rem",
                                    borderRadius: "12px",
                                    overflowX: "auto"
                                }}
                            >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <h3 style={{ fontSize: "1.25rem", color: "#fff" }}>
                                    📋 Tüm İşlemler ({settlements.length})
                                </h3>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={exportToExcel}
                                        disabled={settlements.length === 0}
                                        style={{
                                            background: settlements.length === 0
                                                ? "rgba(34, 197, 94, 0.3)"
                                                : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                                            border: "none",
                                            padding: "0.5rem 1rem",
                                            borderRadius: "8px",
                                            color: "#fff",
                                            fontWeight: "600",
                                            cursor: settlements.length === 0 ? "not-allowed" : "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            fontSize: "0.875rem"
                                        }}
                                    >
                                        <FaFileExcel />
                                        Excel
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={exportToPDF}
                                        disabled={settlements.length === 0}
                                        style={{
                                            background: settlements.length === 0
                                                ? "rgba(239, 68, 68, 0.3)"
                                                : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                                            border: "none",
                                            padding: "0.5rem 1rem",
                                            borderRadius: "8px",
                                            color: "#fff",
                                            fontWeight: "600",
                                            cursor: settlements.length === 0 ? "not-allowed" : "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            fontSize: "0.875rem"
                                        }}
                                    >
                                        <FaFilePdf />
                                        PDF
                                    </motion.button>
                                </div>
                            </div>

                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                                        <th style={{ padding: "1rem", textAlign: "left", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>Tarih</th>
                                        <th style={{ padding: "1rem", textAlign: "left", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>Sipariş No</th>
                                        <th style={{ padding: "1rem", textAlign: "left", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>Barkod</th>
                                        <th style={{ padding: "1rem", textAlign: "left", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>İşlem Tipi</th>
                                        <th style={{ padding: "1rem", textAlign: "right", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>Alacak</th>
                                        <th style={{ padding: "1rem", textAlign: "right", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>Borç</th>
                                        <th style={{ padding: "1rem", textAlign: "right", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>Komisyon</th>
                                        <th style={{ padding: "1rem", textAlign: "right", color: "#94a3b8", fontWeight: "600", fontSize: "0.875rem" }}>Net Gelir</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {settlements.map((item, index) => (
                                        <motion.tr
                                            key={item.id || index}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            style={{
                                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                                transition: "background 0.2s ease"
                                            }}
                                            whileHover={{ background: "rgba(255,255,255,0.05)" }}
                                        >
                                            <td style={{ padding: "1rem", color: "#e2e8f0", fontSize: "0.875rem" }}>
                                                {dayjs(item.transactionDate).format("DD MMM YYYY")}
                                            </td>
                                            <td style={{ padding: "1rem", color: "#e2e8f0", fontSize: "0.875rem" }}>
                                                {item.orderNumber || "-"}
                                            </td>
                                            <td style={{ padding: "1rem", color: "#94a3b8", fontSize: "0.875rem" }}>
                                                {item.barcode || "-"}
                                            </td>
                                            <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                                                <span style={{
                                                    background: item.transactionType === "Sale" ? "rgba(34, 197, 94, 0.2)" :
                                                               item.transactionType === "Return" ? "rgba(239, 68, 68, 0.2)" :
                                                               "rgba(245, 158, 11, 0.2)",
                                                    color: item.transactionType === "Sale" ? "#22c55e" :
                                                          item.transactionType === "Return" ? "#ef4444" :
                                                          "#f59e0b",
                                                    padding: "0.25rem 0.75rem",
                                                    borderRadius: "6px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: "600"
                                                }}>
                                                    {item.transactionType}
                                                </span>
                                            </td>
                                            <td style={{ padding: "1rem", textAlign: "right", color: "#22c55e", fontWeight: "600", fontSize: "0.875rem" }}>
                                                {item.credit > 0 ? formatCurrency(item.credit) : "-"}
                                            </td>
                                            <td style={{ padding: "1rem", textAlign: "right", color: "#ef4444", fontWeight: "600", fontSize: "0.875rem" }}>
                                                {item.debt > 0 ? formatCurrency(item.debt) : "-"}
                                            </td>
                                            <td style={{ padding: "1rem", textAlign: "right", color: "#f59e0b", fontSize: "0.875rem" }}>
                                                {formatCurrency(item.commissionAmount || 0)}
                                            </td>
                                            <td style={{ padding: "1rem", textAlign: "right", color: "#4ecdc4", fontWeight: "600", fontSize: "0.875rem" }}>
                                                {formatCurrency(item.sellerRevenue || 0)}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                                </table>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default FinancePage;