import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Box, Alert, CircularProgress, ToggleButtonGroup, ToggleButton } from "@mui/material";
import WBPageHeader from "../../components/websiteBuilder/layout/WBPageHeader";
import TrafficSummaryCards from "../../components/websiteBuilder/analytics/TrafficSummaryCards";
import VisitorsChart from "../../components/websiteBuilder/analytics/VisitorsChart";
import TopPagesTable from "../../components/websiteBuilder/analytics/TopPagesTable";
import TopProductsTable from "../../components/websiteBuilder/analytics/TopProductsTable";
import ConversionOverview from "../../components/websiteBuilder/analytics/ConversionOverview";
import { PERIOD_OPTIONS } from "../../components/websiteBuilder/analytics/analyticsUtils";
import * as wbApi from "../../services/websiteBuilderApi";
import "../../styles/websiteBuilder/wbDesignSystem.css";
import "../../styles/websiteBuilder/wbIkasWorkspace.css";

const COMPARE_PERIODS = ["7d", "30d", "90d"];

export default function SiteAnalytics() {
    const { siteId } = useParams();
    const [period, setPeriod] = useState("30d");
    const [summary, setSummary] = useState(null);
    const [todayPageViews, setTodayPageViews] = useState(0);
    const [pageStats, setPageStats] = useState([]);
    const [funnel, setFunnel] = useState([]);
    const [periodComparison, setPeriodComparison] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");

        Promise.all([
            wbApi.getAnalyticsSummary(siteId, { period }),
            wbApi.getAnalyticsSummary(siteId, { period: "today" }),
            wbApi.getAnalyticsPages(siteId, { period }),
            wbApi.getAnalyticsFunnel(siteId, { period }),
            ...COMPARE_PERIODS.map((p) => wbApi.getAnalyticsSummary(siteId, { period: p })),
        ])
            .then(([main, today, pagesRes, funnelRes, ...comparisons]) => {
                if (cancelled) return;
                setSummary(main?.summary);
                setTodayPageViews(main?.todayPageViews ?? today?.todayPageViews ?? 0);
                setPageStats(pagesRes?.stats?.length ? pagesRes.stats : main?.topPages || []);
                setFunnel(funnelRes?.funnel || []);
                setPeriodComparison(
                    COMPARE_PERIODS.map((p, i) => ({
                        period: p,
                        summary: comparisons[i]?.summary,
                        devices: comparisons[i]?.devices,
                        topSources: comparisons[i]?.topSources,
                        topProducts: comparisons[i]?.topProducts,
                    }))
                );
            })
            .catch((e) => {
                if (!cancelled) setError(e.response?.data?.error || "Analitik yüklenemedi");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [siteId, period]);

    const periodRow = useMemo(
        () => periodComparison.find((p) => p.period === period) || {},
        [periodComparison, period]
    );

    const maxPageViews = useMemo(
        () => Math.max(1, ...(pageStats || []).map((r) => r.views || 0)),
        [pageStats]
    );

    if (loading && !summary) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box className="wb-ikas-page wb-ds-analytics-page wb-ws-page--premium" sx={{ pb: 4 }}>
            <WBPageHeader
                title="Analitik"
                subtitle="Ziyaretçi, görüntülenme, dönüşüm ve satış — İkas tarzı özet"
                actions={
                    <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
                        {PERIOD_OPTIONS.map((o) => (
                            <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                }
            />

            <div className="wb-ds-metrics-row">
                <TrafficSummaryCards summary={summary} todayPageViews={todayPageViews} loading={loading} />
            </div>

            <div className="wb-ds-chart-row">
                <VisitorsChart
                    periodComparison={periodComparison}
                    devices={periodRow.devices}
                    topSources={periodRow.topSources}
                    loading={loading}
                />
            </div>

            <div className="wb-ds-tables-row">
                <TopPagesTable rows={pageStats} loading={loading} maxViews={maxPageViews} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <TopProductsTable products={periodRow.topProducts} loading={loading} />
                    <ConversionOverview funnel={funnel} loading={loading} />
                </Box>
            </div>
        </Box>
    );
}
