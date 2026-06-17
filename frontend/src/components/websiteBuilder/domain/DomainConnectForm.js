import React from "react";
import { Card, CardContent, Typography, TextField, Button, Alert, Box, InputAdornment, CircularProgress } from "@mui/material";
import { LanguageRounded, LinkRounded } from "@mui/icons-material";

export default function DomainConnectForm({ value, onChange, onSubmit, loading, defaultHost }) {
    return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Özel alan adı bağla
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Markanıza ait domaini bağlayın. Örn. <strong>www.markam.com</strong>
                </Typography>
                {defaultHost && (
                    <Alert severity="info" icon={<LinkRounded />} sx={{ mb: 2, borderRadius: 2 }}>
                        Varsayılan adres: <strong>{defaultHost}</strong> — özel domain aktif olunca bu adres yönlendirilir.
                    </Alert>
                )}
                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="www.markam.com"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LanguageRounded color="disabled" fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={onSubmit}
                        disabled={loading || !value.trim()}
                        sx={{ minWidth: { sm: 140 }, flexShrink: 0 }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : "Bağla"}
                    </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                    Pro plan ve DNS panel erişimi gerekir.
                </Typography>
            </CardContent>
        </Card>
    );
}
