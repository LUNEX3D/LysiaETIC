import React, { useState, useEffect } from "react";
import axios from "../services/api";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    IconButton,
    CircularProgress,
    LinearProgress,
    Chip,
    Alert,
    Tooltip,
    Grid,
    Paper,
    Divider,
    Badge,
    Collapse
} from "@mui/material";
import {
    Psychology as PsychologyIcon,
    Bolt as BoltIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    AttachMoney as AttachMoneyIcon,
    Inventory as InventoryIcon,
    Campaign as CampaignIcon,
    AutoFixHigh as AutoFixHighIcon,
    PlayArrow as PlayArrowIcon,
    Refresh as RefreshIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Speed as SpeedIcon,
    Timeline as TimelineIcon,
    Assessment as AssessmentIcon,
    Notifications as NotificationsIcon
} from "@mui/icons-material";
import "../styles/AIDecisionCenter.css";

const AIDecisionCenter = () => {
    // State Management
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [decisions, setDecisions] = useState([]);
    const [analysis, setAnalysis] = useState(null);
    const [summary, setSummary] = useState(null);
    const [executed, setExecuted] = useState([]);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState("");
    const [expandedDecision, setExpandedDecision] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Load AI Decisions
    useEffect(() => {
        loadDecisions();
        loadStats();
    }, []);

    const loadDecisions = async () => {
        setLoading(true);
        setError("");

        try {
            const response = await axios.get("/ai/decisions");

            if (response.data.success) {
                setDecisions(response.data.decisions || []);
                setAnalysis(response.data.analysis);
                setSummary(response.data.summary);
                setExecuted(response.data.executed || []);
                setLastUpdate(new Date());
            }
        } catch (err) {
            console.error("AI Decisions Error:", err);
            setError(err.response?.data?.error || "AI kararları yüklenemedi!");
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await axios.get("/ai/action-stats");
            if (response.data.success) {
                setStats(response.data.stats);
            }
        } catch (err) {
            console.error("Stats Error:", err);
        }
    };

    const handleAutoOptimize = async () => {
        setOptimizing(true);
        setError("");

        try {
            const response = await axios.post("/ai/auto-optimize");

            if (response.data.success) {
                // Reload decisions
                await loadDecisions();
                await loadStats();
            }
        } catch (err) {
            console.error("Auto Optimize Error:", err);
            setError(err.response?.data?.error || "Otomatik optimizasyon başarısız!");
        } finally {
            setOptimizing(false);
        }
    };

    const handleExecuteAction = async (decision) => {
        try {
            const response = await axios.post("/ai/execute-action", { decision });

            if (response.data.success) {
                // Reload decisions
                await loadDecisions();
                await loadStats();
            }
        } catch (err) {
            console.error("Execute Action Error:", err);
            setError(err.response?.data?.error || "Aksiyon uygulanamadı!");
        }
    };

    // Helper Functions
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'critical': return '#ef4444';
            case 'high': return '#f59e0b';
            case 'medium': return '#3b82f6';
            case 'low': return '#10b981';
            default: return '#6b7280';
        }
    };

    const getPriorityIcon = (priority) => {
        switch (priority) {
            case 'critical': return <ErrorIcon />;
            case 'high': return <WarningIcon />;
            case 'medium': return <NotificationsIcon />;
            case 'low': return <CheckCircleIcon />;
            default: return <NotificationsIcon />;
        }
    };

    const getDecisionIcon = (type) => {
        switch (type) {
            case 'price_increase':
            case 'price_decrease':
                return <AttachMoneyIcon />;
            case 'stock_alert':
                return <InventoryIcon />;
            case 'campaign':
                return <CampaignIcon />;
            case 'optimization':
                return <AutoFixHighIcon />;
            default:
                return <BoltIcon />;
        }
    };

    const getDecisionTitle = (type) => {
        switch (type) {
            case 'price_increase': return 'Fiyat Artırma';
            case 'price_decrease': return 'Fiyat Düşürme';
            case 'stock_alert': return 'Stok Uyarısı';
            case 'campaign': return 'Kampanya Önerisi';
            case 'optimization': return 'Optimizasyon';
            default: return type;
        }
    };

    const getHealthColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    };

    const getHealthStatus = (score) => {
        if (score >= 80) return 'Mükemmel';
        if (score >= 60) return 'İyi';
        if (score >= 40) return 'Orta';
        return 'Kötü';
    };

    if (loading) {
        return (
            <Box className="ai-decision-center">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                    <CircularProgress size={60} sx={{ mb: 2 }} />
                    <Typography variant="h6">AI Karar Motoru Yükleniyor...</Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box className="ai-decision-center">
            {/* Header */}
            <Box className="decision-header">
                <Box>
                    <Typography variant="h3" className="gradient-text" sx={{ fontWeight: 800, mb: 1 }}>
                        <PsychologyIcon sx={{ fontSize: '3rem', mr: 2, verticalAlign: 'middle' }} />
                        AI Decision Center
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        🧠 Akıllı Karar Motoru • ⚡ Otomatik Aksiyonlar • 📊 Gerçek Zamanlı Analiz
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {lastUpdate && (
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                            🕐 {lastUpdate.toLocaleTimeString('tr-TR')}
                        </Typography>
                    )}
                    <Tooltip title="Yenile">
                        <IconButton onClick={loadDecisions} className="icon-button">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={optimizing ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <BoltIcon />}
                        onClick={handleAutoOptimize}
                        disabled={optimizing}
                        className="auto-optimize-btn"
                        sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            px: 4,
                            py: 1.5,
                            fontSize: '1.1rem',
                            fontWeight: 700
                        }}
                    >
                        {optimizing ? 'Optimize Ediliyor...' : '⚡ Otomatik Optimize Et'}
                    </Button>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
                    {error}
                </Alert>
            )}

            {/* Overall Health Score */}
            {summary?.overallHealth && (
                <Card className="health-score-card" sx={{ mb: 4 }}>
                    <CardContent>
                        <Grid container spacing={4} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ mb: 2, opacity: 0.8 }}>
                                        Sistem Sağlık Skoru
                                    </Typography>
                                    <Box className="health-circle" sx={{
                                        width: 180,
                                        height: 180,
                                        margin: '0 auto',
                                        borderRadius: '50%',
                                        background: `conic-gradient(${getHealthColor(summary.overallHealth.score)} ${summary.overallHealth.score}%, rgba(255,255,255,0.1) 0)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative'
                                    }}>
                                        <Box sx={{
                                            width: 150,
                                            height: 150,
                                            borderRadius: '50%',
                                            background: 'rgba(15, 12, 41, 0.95)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Typography variant="h2" sx={{ fontWeight: 800, color: getHealthColor(summary.overallHealth.score) }}>
                                                {summary.overallHealth.score}
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                                {getHealthStatus(summary.overallHealth.score)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={8}>
                                <Grid container spacing={2}>
                                    {Object.entries(summary.overallHealth.breakdown || {}).map(([key, value]) => (
                                        <Grid item xs={6} key={key}>
                                            <Paper sx={{ p: 2, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 2 }}>
                                                <Typography variant="caption" sx={{ opacity: 0.7, textTransform: 'capitalize' }}>
                                                    {key === 'products' ? '📦 Ürünler' :
                                                     key === 'sales' ? '💰 Satışlar' :
                                                     key === 'stock' ? '📊 Stok' :
                                                     key === 'profit' ? '💵 Kar' : key}
                                                </Typography>
                                                <Typography variant="h5" sx={{ fontWeight: 700, color: getHealthColor(value), mt: 1 }}>
                                                    {value.toFixed(0)}
                                                </Typography>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={value}
                                                    sx={{
                                                        mt: 1,
                                                        height: 8,
                                                        borderRadius: 4,
                                                        '& .MuiLinearProgress-bar': {
                                                            background: getHealthColor(value)
                                                        }
                                                    }}
                                                />
                                            </Paper>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Summary Stats */}
            {summary && (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card className="stat-card">
                            <CardContent sx={{ textAlign: 'center' }}>
                                <AssessmentIcon sx={{ fontSize: '3rem', color: '#3b82f6', mb: 1 }} />
                                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                                    {summary.totalDecisions}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                    Toplam Karar
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card className="stat-card">
                            <CardContent sx={{ textAlign: 'center' }}>
                                <CheckCircleIcon sx={{ fontSize: '3rem', color: '#10b981', mb: 1 }} />
                                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                                    {summary.autoExecuted}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                    Otomatik Uygulanan
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card className="stat-card">
                            <CardContent sx={{ textAlign: 'center' }}>
                                <WarningIcon sx={{ fontSize: '3rem', color: '#f59e0b', mb: 1 }} />
                                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                                    {summary.requiresApproval}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                    Onay Bekleyen
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card className="stat-card">
                            <CardContent sx={{ textAlign: 'center' }}>
                                <TimelineIcon sx={{ fontSize: '3rem', color: '#8b5cf6', mb: 1 }} />
                                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                                    {stats?.last24Hours || 0}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                                    Son 24 Saat
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Decisions List */}
            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                        <BoltIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        AI Kararları ({decisions.length})
                    </Typography>

                    {decisions.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CheckCircleIcon sx={{ fontSize: '4rem', color: '#10b981', mb: 2 }} />
                            <Typography variant="h6">
                                Harika! Şu anda aksiyon gerektiren karar yok.
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                                Sisteminiz optimal durumda çalışıyor.
                            </Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={2}>
                            {decisions.map((decision, index) => (
                                <Grid item xs={12} key={index}>
                                    <Paper
                                        className="decision-card"
                                        sx={{
                                            p: 3,
                                            borderLeft: `5px solid ${getPriorityColor(decision.priority)}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateX(5px)',
                                                boxShadow: `0 4px 20px ${getPriorityColor(decision.priority)}40`
                                            }
                                        }}
                                        onClick={() => setExpandedDecision(expandedDecision === index ? null : index)}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                    {getDecisionIcon(decision.type)}
                                                    <Typography variant="h6" sx={{ ml: 1, fontWeight: 700 }}>
                                                        {getDecisionTitle(decision.type)}
                                                    </Typography>
                                                    <Chip
                                                        label={decision.priority.toUpperCase()}
                                                        size="small"
                                                        sx={{
                                                            ml: 2,
                                                            background: getPriorityColor(decision.priority),
                                                            color: 'white',
                                                            fontWeight: 'bold'
                                                        }}
                                                    />
                                                    <Chip
                                                        label={`${(decision.confidence * 100).toFixed(0)}% Güven`}
                                                        size="small"
                                                        sx={{ ml: 1 }}
                                                    />
                                                </Box>
                                                <Typography variant="body1" sx={{ mb: 1 }}>
                                                    <strong>Ürün:</strong> {decision.product?.name}
                                                </Typography>
                                                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                                    {decision.reason}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                {!decision.autoExecute && (
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={<PlayArrowIcon />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleExecuteAction(decision);
                                                        }}
                                                        sx={{
                                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                        }}
                                                    >
                                                        Uygula
                                                    </Button>
                                                )}
                                                <IconButton size="small">
                                                    {expandedDecision === index ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </Box>
                                        </Box>

                                        <Collapse in={expandedDecision === index}>
                                            <Divider sx={{ my: 2 }} />
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} md={6}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                                        Mevcut Durum:
                                                    </Typography>
                                                    {Object.entries(decision.current || {}).map(([key, value]) => (
                                                        <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
                                                            • {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                                                        </Typography>
                                                    ))}
                                                </Grid>
                                                <Grid item xs={12} md={6}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                                        Önerilen:
                                                    </Typography>
                                                    {Object.entries(decision.recommended || {}).map(([key, value]) => (
                                                        <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
                                                            • {key}: {typeof value === 'number' ? value.toFixed(2) : Array.isArray(value) ? value.join(', ') : value}
                                                        </Typography>
                                                    ))}
                                                </Grid>
                                                {decision.impact && (
                                                    <Grid item xs={12}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                                            Beklenen Etki:
                                                        </Typography>
                                                        {Object.entries(decision.impact).map(([key, value]) => (
                                                            <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
                                                                • {key}: {value}
                                                            </Typography>
                                                        ))}
                                                    </Grid>
                                                )}
                                            </Grid>
                                        </Collapse>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </CardContent>
            </Card>

            {/* Executed Actions */}
            {executed.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                            <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#10b981' }} />
                            Uygulanan Aksiyonlar ({executed.length})
                        </Typography>
                        <Grid container spacing={2}>
                            {executed.map((item, index) => (
                                <Grid item xs={12} md={6} key={index}>
                                    <Paper sx={{ p: 2, background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981' }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                            {getDecisionTitle(item.decision.type)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                            {item.decision.product?.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                                            {new Date(item.executedAt).toLocaleString('tr-TR')}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

export default AIDecisionCenter;
