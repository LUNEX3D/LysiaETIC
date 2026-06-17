import React from "react";
import {
    Card, CardContent, Typography, Alert, List, ListItem,
    Box, Chip, IconButton, Tooltip, Divider, Button, CircularProgress,
} from "@mui/material";
import { ContentCopyRounded, RefreshRounded } from "@mui/icons-material";

function DnsRecordRow({ record, onCopy }) {
    return (
        <ListItem disableGutters divider sx={{ py: 1.75, flexDirection: "column", alignItems: "stretch" }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
                <Chip
                    label={record.type}
                    size="small"
                    color={record.type === "TXT" ? "warning" : "primary"}
                    sx={{ fontFamily: "monospace", fontWeight: 700, minWidth: 52 }}
                />
                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all", fontWeight: 500 }}>
                    {record.name}
                </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary", wordBreak: "break-all", flex: 1 }}>
                    {record.value}
                </Typography>
                <Tooltip title="Kopyala">
                    <IconButton size="small" onClick={() => onCopy(record.value)}>
                        <ContentCopyRounded fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            {record.description && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {record.description}
                </Typography>
            )}
        </ListItem>
    );
}

export default function DomainDnsTable({ records, onCopy, onVerify, verifying, hideManualVerify }) {
    if (!records?.length) return null;

    return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    DNS kayıtları
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Alan adı sağlayıcınızın paneline aşağıdaki kayıtları ekleyin. Yayılma 24–48 saat sürebilir.
                </Typography>
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    Turuncu bulut (Cloudflare proxy) kapalı olmalı; aksi halde SSL doğrulaması başarısız olabilir.
                </Alert>
                <List disablePadding sx={{ bgcolor: "action.hover", borderRadius: 2, px: 1 }}>
                    {records.map((record, i) => (
                        <DnsRecordRow key={`${record.type}-${record.name}-${i}`} record={record} onCopy={onCopy} />
                    ))}
                </List>
                <Divider sx={{ my: 2 }} />
                {hideManualVerify ? (
                    <Typography variant="body2" color="text.secondary">
                        DNS kayıtları otomatik kontrol ediliyor — &quot;Sorgula&quot; butonuna gerek yok.
                    </Typography>
                ) : (
                    <Button
                        variant="contained"
                        disableElevation
                        startIcon={verifying ? <CircularProgress size={16} color="inherit" /> : <RefreshRounded />}
                        onClick={onVerify}
                        disabled={verifying}
                    >
                        {verifying ? "Kontrol ediliyor…" : "DNS kayıtlarını doğrula"}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
