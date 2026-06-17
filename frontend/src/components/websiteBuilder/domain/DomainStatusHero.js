import React from "react";
import {
    Card, CardContent, Typography, Box, Chip, Button, Alert, Stepper, Step, StepLabel,
    IconButton, Tooltip, CircularProgress, Grid,
} from "@mui/material";
import {
    CheckCircleRounded, RefreshRounded, DeleteRounded, LockRounded,
    WarningRounded, OpenInNewRounded, ContentCopyRounded,
} from "@mui/icons-material";
import { STATUS_CONFIG, SSL_STATUS_LABELS, STATUS_STEPS, STATUS_STEP_MAP } from "./domainConstants";

export default function DomainStatusHero({
    domain,
    onVerify,
    onRemove,
    verifying,
    removing,
    liveUrl,
    autoPolling,
    lastAutoCheck,
}) {
    if (!domain) return null;

    const cfg = STATUS_CONFIG[domain.status] || { label: domain.status, color: "default" };
    const activeStep = STATUS_STEP_MAP[domain.status] ?? 0;
    const showStepper = domain.status !== "active";

    return (
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 2, borderColor: domain.status === "active" ? "success.main" : "divider" }}>
            <CardContent>
                <Grid container spacing={2} alignItems="flex-start">
                    <Grid item xs={12} md={8}>
                        <Typography variant="overline" color="text.secondary" fontWeight={600}>
                            Bağlı domain
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
                            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.02em", wordBreak: "break-all" }}>
                                {domain.domain}
                            </Typography>
                            {liveUrl && domain.status === "active" && (
                                <Tooltip title="Siteyi aç">
                                    <IconButton size="small" href={liveUrl} target="_blank" rel="noopener noreferrer">
                                        <OpenInNewRounded fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
                            <Chip label={cfg.label} color={cfg.color} size="small" />
                            {domain.sslStatus && domain.sslStatus !== "none" && (
                                <Chip
                                    label={`SSL: ${SSL_STATUS_LABELS[domain.sslStatus] || domain.sslStatus}`}
                                    size="small"
                                    variant="outlined"
                                    icon={<LockRounded sx={{ fontSize: "14px !important" }} />}
                                />
                            )}
                        </Box>
                        {cfg.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {cfg.description}
                            </Typography>
                        )}
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Box sx={{ display: "flex", gap: 1, justifyContent: { md: "flex-end" }, flexWrap: "wrap" }}>
                            {!autoPolling && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={verifying ? <CircularProgress size={14} /> : <RefreshRounded />}
                                    onClick={onVerify}
                                    disabled={verifying || domain.status === "active"}
                                >
                                    Doğrula
                                </Button>
                            )}
                            {autoPolling && (
                                <Chip
                                    size="small"
                                    label={
                                        lastAutoCheck
                                            ? `Otomatik kontrol · ${Math.max(0, Math.round((Date.now() - lastAutoCheck.getTime()) / 1000))}sn önce`
                                            : "Otomatik kontrol aktif"
                                    }
                                    color="info"
                                    variant="outlined"
                                />
                            )}
                            <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                startIcon={<DeleteRounded />}
                                onClick={onRemove}
                                disabled={removing}
                            >
                                Kaldır
                            </Button>
                        </Box>
                    </Grid>
                </Grid>

                {domain.status === "active" && (
                    <Alert severity="success" icon={<CheckCircleRounded />} sx={{ mt: 2, borderRadius: 2 }}>
                        Site <strong>https://{domain.domain}</strong> üzerinden yayında.
                        {liveUrl && (
                            <Button size="small" sx={{ ml: 1 }} endIcon={<OpenInNewRounded />} href={liveUrl} target="_blank" rel="noopener noreferrer">
                                Aç
                            </Button>
                        )}
                    </Alert>
                )}
                {domain.status === "ssl_provisioning" && (
                    <Alert severity="info" icon={<LockRounded />} sx={{ mt: 2, borderRadius: 2 }}>
                        DNS tamam. SSL sertifikası hazırlanıyor; birkaç dakika içinde otomatik tamamlanır.
                    </Alert>
                )}
                {domain.status === "dns_verified" && (
                    <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                        TXT doğrulandı. CNAME kaydını ekleyip tekrar doğrulayın.
                    </Alert>
                )}
                {domain.status === "failed" && (
                    <Alert severity="error" icon={<WarningRounded />} sx={{ mt: 2, borderRadius: 2 }}>
                        {domain.errorMessage || "Doğrulama başarısız. DNS kayıtlarını kontrol edin."}
                    </Alert>
                )}
                {domain.status === "expired" && (
                    <Alert severity="error" icon={<WarningRounded />} sx={{ mt: 2, borderRadius: 2 }}>
                        SSL süresi doldu. Özel domain erişimi geçici olarak kapalı olabilir.
                    </Alert>
                )}

                {showStepper && (
                    <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: "divider" }}>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                            Kurulum adımları
                        </Typography>
                        <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 1 }}>
                            {STATUS_STEPS.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
