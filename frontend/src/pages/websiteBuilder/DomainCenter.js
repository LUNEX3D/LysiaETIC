import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import {
    Box, Grid, Card, CardContent, Typography, Alert, CircularProgress,
    IconButton, Tooltip, Chip, Button, MenuItem, FormControl, InputLabel, Select,
} from "@mui/material";
import { ContentCopyRounded, PublicRounded, StarRounded, DeleteOutlineRounded } from "@mui/icons-material";
import WBPageHeader from "../../components/websiteBuilder/layout/WBPageHeader";
import DomainConnectForm from "../../components/websiteBuilder/domain/DomainConnectForm";
import DomainStatusHero from "../../components/websiteBuilder/domain/DomainStatusHero";
import DomainDnsTable from "../../components/websiteBuilder/domain/DomainDnsTable";
import DomainSetupStepper from "../../components/websiteBuilder/domain/DomainSetupStepper";
import "../../styles/websiteBuilder/wbDesignSystem.css";
import "../../styles/ecPublishHub.css";
import { getLiveSiteUrls, getWbAppDomain } from "../../utils/wbStorefrontHost";
import * as wbApi from "../../services/websiteBuilderApi";

const DOMAIN_TYPE_LABELS = {
    primary: "Ana domain",
    alias: "Alias (www)",
    subdomain: "Alt domain",
};

const PENDING_STATUSES = ["pending_dns", "dns_verified", "ssl_provisioning"];

function DefaultAddressCard({ site }) {
    const urls = getLiveSiteUrls(site);
    const subdomain = site?.slug ? `${site.slug}.${getWbAppDomain()}` : getWbAppDomain();

    const copy = (text) => navigator.clipboard.writeText(text);

    return (
        <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
            <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <PublicRounded color="primary" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                        Varsayılan mağaza adresi
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Özel domain bağlamadan sitenize bu adresten erişilir.
                </Typography>
                <Box
                    sx={{
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "action.hover",
                        fontFamily: "monospace",
                        fontSize: 14,
                        wordBreak: "break-all",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                    }}
                >
                    <span>{urls.path || `https://${subdomain}`}</span>
                    <Tooltip title="Kopyala">
                        <IconButton size="small" onClick={() => copy(urls.path || `https://${subdomain}`)}>
                            <ContentCopyRounded fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </CardContent>
        </Card>
    );
}

function DomainListCard({ domain, isSelected, onSelect, onSetPrimary, onRemove, settingPrimary, removingId }) {
    const typeLabel = DOMAIN_TYPE_LABELS[domain.domainType] || domain.domainType || "Domain";
    const isPrimary = domain.isPrimary || domain.domainType === "primary";

    return (
        <Card
            variant="outlined"
            sx={{
                borderRadius: 2,
                cursor: "pointer",
                borderColor: isSelected ? "primary.main" : undefined,
                borderWidth: isSelected ? 2 : 1,
            }}
            onClick={onSelect}
        >
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: "monospace", flex: 1 }}>
                        {domain.domain}
                    </Typography>
                    {isPrimary && <Chip size="small" icon={<StarRounded />} label="Ana" color="primary" />}
                    <Chip size="small" label={typeLabel} variant="outlined" />
                    <Chip
                        size="small"
                        label={domain.status?.replace(/_/g, " ") || "—"}
                        color={domain.status === "active" ? "success" : "default"}
                    />
                </Box>
                <Box sx={{ display: "flex", gap: 1, mt: 1 }} onClick={(e) => e.stopPropagation()}>
                    {!isPrimary && domain.status === "active" && (
                        <Button size="small" onClick={onSetPrimary} disabled={settingPrimary}>
                            Ana yap
                        </Button>
                    )}
                    <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRounded />}
                        onClick={onRemove}
                        disabled={removingId === domain._id}
                    >
                        Kaldır
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
}

export default function DomainCenter({ siteId: siteIdProp, embedded = false }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const { site: outletSite } = useOutletContext() || {};
    const [site, setSite] = useState(outletSite || null);
    const [domains, setDomains] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [inputDomain, setInputDomain] = useState("");
    const [domainType, setDomainType] = useState("primary");
    const [adding, setAdding] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [removingId, setRemovingId] = useState(null);
    const [settingPrimary, setSettingPrimary] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [copied, setCopied] = useState(false);
    const [lastAutoCheck, setLastAutoCheck] = useState(null);
    const pollRef = useRef(null);

    const selectedDomain = useMemo(
        () => domains.find((d) => String(d._id) === String(selectedId)) || domains[0] || null,
        [domains, selectedId]
    );

    const primaryDomain = useMemo(
        () => domains.find((d) => d.isPrimary || d.domainType === "primary") || domains[0] || null,
        [domains]
    );

    const isAutoPolling = domains.some((d) => PENDING_STATUSES.includes(d.status));

    const defaultHost = useMemo(() => {
        if (!site?.slug) return "";
        return `${site.slug}.${getWbAppDomain()}`;
    }, [site?.slug]);

    const liveUrl = useMemo(() => {
        if (!site) return "";
        return getLiveSiteUrls(site).primary || "";
    }, [site]);

    const fetchDomains = useCallback(async () => {
        try {
            const data = await wbApi.listDomains(siteId);
            const list = data.domains || [];
            setDomains(list);
            setSelectedId((prev) => {
                if (prev && list.some((d) => String(d._id) === String(prev))) return prev;
                const primary = list.find((d) => d.isPrimary || d.domainType === "primary");
                return primary?._id || list[0]?._id || null;
            });
        } catch {
            try {
                const legacy = await wbApi.getDomain(siteId);
                const one = legacy.domain ? [legacy.domain] : [];
                setDomains(one);
                setSelectedId(one[0]?._id || null);
            } catch {
                setDomains([]);
                setSelectedId(null);
            }
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => { fetchDomains(); }, [fetchDomains]);

    useEffect(() => {
        if (!siteId || !isAutoPolling) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            return;
        }

        const runCheck = async () => {
            try {
                const data = await wbApi.listDomains(siteId);
                const pending = (data.domains || []).filter((d) => PENDING_STATUSES.includes(d.status));
                await Promise.all(pending.map((d) => wbApi.verifyDomain(siteId, d._id)));
                await fetchDomains();
                setLastAutoCheck(new Date());
            } catch {
                /* sessiz */
            }
        };

        runCheck();
        pollRef.current = setInterval(runCheck, 30000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [siteId, isAutoPolling, fetchDomains]);

    useEffect(() => {
        if (outletSite) {
            setSite(outletSite);
            return;
        }
        if (!siteId) return;
        wbApi.getSite(siteId)
            .then((d) => setSite(d.site))
            .catch(() => setSite(null));
    }, [outletSite, siteId]);

    const handleAddDomain = async () => {
        if (!inputDomain.trim()) return;
        setAdding(true);
        setError("");
        try {
            const data = await wbApi.addDomain(siteId, inputDomain.trim(), domainType);
            await fetchDomains();
            if (data.domain?._id) setSelectedId(data.domain._id);
            setInputDomain("");
            setSuccess("Domain eklendi. DNS kayıtlarını ekleyip doğrulayın.");
        } catch (e) {
            setError(e.response?.data?.error || "Domain eklenemedi");
        } finally {
            setAdding(false);
        }
    };

    const handleVerify = async (domainId) => {
        setVerifying(true);
        setError("");
        try {
            const data = await wbApi.verifyDomain(siteId, domainId || selectedDomain?._id);
            await fetchDomains();
            if (data.verified) {
                setSuccess(data.message);
            } else {
                setError(data.message || "Doğrulama başarısız");
            }
        } catch (e) {
            setError(e.response?.data?.error || "Doğrulama hatası");
        } finally {
            setVerifying(false);
        }
    };

    const handleRemove = async (domainId) => {
        const id = domainId || selectedDomain?._id;
        if (!id || !window.confirm("Bu domain bağlantısını kaldırmak istediğinizden emin misiniz?")) return;
        setRemovingId(id);
        try {
            await wbApi.removeDomainById(siteId, id);
            await fetchDomains();
            setSelectedId(null);
            setSuccess("Domain bağlantısı kaldırıldı");
        } catch (e) {
            setError(e.response?.data?.error || "Kaldırılamadı");
        } finally {
            setRemovingId(null);
        }
    };

    const handleSetPrimary = async (domainId) => {
        setSettingPrimary(true);
        try {
            await wbApi.setPrimaryDomain(siteId, domainId);
            await fetchDomains();
            setSuccess("Ana domain güncellendi");
        } catch (e) {
            setError(e.response?.data?.error || "Güncellenemedi");
        } finally {
            setSettingPrimary(false);
        }
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const selectedPolling = selectedDomain && PENDING_STATUSES.includes(selectedDomain.status);

    return (
        <Box className="wb-ikas-page wb-ws-page--premium" sx={{ pb: embedded ? 2 : 4 }}>
            {!embedded && (
                <WBPageHeader
                    title="Alan Adları"
                    subtitle="Birden fazla domain bağlayın — DNS otomatik kontrol edilir, SSL otomatik üretilir"
                />
            )}

            {isAutoPolling && (
                <div className="eph-auto-poll">
                    <span className="eph-auto-poll-dot" />
                    <span>
                        DNS kayıtları otomatik kontrol ediliyor
                        {lastAutoCheck && (
                            <> · Son kontrol: {Math.max(0, Math.round((Date.now() - lastAutoCheck.getTime()) / 1000))} sn önce</>
                        )}
                    </span>
                </div>
            )}

            {!loading && <DomainSetupStepper site={site} domain={primaryDomain} />}

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}
            {copied && <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>Kopyalandı</Alert>}

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={2}>
                    <Grid item xs={12} md={domains.length ? 5 : 12}>
                        <DefaultAddressCard site={site} />
                    </Grid>

                    {domains.length > 0 && (
                        <Grid item xs={12} md={7}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                Bağlı domainler ({domains.length})
                            </Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                {domains.map((d) => (
                                    <DomainListCard
                                        key={d._id}
                                        domain={d}
                                        isSelected={String(d._id) === String(selectedId)}
                                        onSelect={() => setSelectedId(d._id)}
                                        onSetPrimary={() => handleSetPrimary(d._id)}
                                        onRemove={() => handleRemove(d._id)}
                                        settingPrimary={settingPrimary}
                                        removingId={removingId}
                                    />
                                ))}
                            </Box>
                        </Grid>
                    )}

                    <Grid item xs={12} md={domains.length ? 12 : 7}>
                        <Box sx={{ mb: 1.5 }}>
                            <FormControl size="small" sx={{ minWidth: 180, mb: 1.5 }}>
                                <InputLabel>Domain tipi</InputLabel>
                                <Select
                                    value={domainType}
                                    label="Domain tipi"
                                    onChange={(e) => setDomainType(e.target.value)}
                                >
                                    <MenuItem value="primary">Ana domain</MenuItem>
                                    <MenuItem value="alias">Alias (www)</MenuItem>
                                    <MenuItem value="subdomain">Alt domain</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <DomainConnectForm
                            value={inputDomain}
                            onChange={setInputDomain}
                            onSubmit={handleAddDomain}
                            loading={adding}
                            defaultHost={defaultHost}
                        />
                    </Grid>

                    {selectedDomain && (
                        <Grid item xs={12}>
                            <DomainStatusHero
                                domain={selectedDomain}
                                onVerify={() => handleVerify(selectedDomain._id)}
                                onRemove={() => handleRemove(selectedDomain._id)}
                                verifying={verifying}
                                removing={!!removingId}
                                liveUrl={liveUrl}
                                autoPolling={selectedPolling}
                                lastAutoCheck={lastAutoCheck}
                            />
                            <DomainDnsTable
                                records={selectedDomain.requiredDnsRecords}
                                onCopy={handleCopy}
                                onVerify={() => handleVerify(selectedDomain._id)}
                                verifying={verifying}
                                hideManualVerify={selectedPolling}
                            />
                        </Grid>
                    )}
                </Grid>
            )}
        </Box>
    );
}
