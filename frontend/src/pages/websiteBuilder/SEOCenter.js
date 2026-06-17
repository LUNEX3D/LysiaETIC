import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Box, Button, Tabs, Tab, Typography, Alert, CircularProgress, TextField,
    Table, TableBody, TableCell, TableHead, TableRow, IconButton, Chip, Paper,
} from "@mui/material";
import { SaveRounded, AddRounded, DeleteRounded, OpenInNewRounded } from "@mui/icons-material";
import * as wbApi from "../../services/websiteBuilderApi";
import WBIkasPageHeader from "../../components/websiteBuilder/layout/WBIkasPageHeader";
import SEOSettings from "./SEOSettings";
import "../../styles/websiteBuilder/wbProductionMobile.css";

export default function SEOCenter({ siteId: siteIdProp, embeddedMetaOnly }) {
    const { siteId: routeSiteId } = useParams();
    const siteId = siteIdProp || routeSiteId;
    const [tab, setTab] = useState(0);
    const [center, setCenter] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [seo, setSeo] = useState({});
    const [saving, setSaving] = useState(false);
    const [newRedirect, setNewRedirect] = useState({ fromPath: "", toPath: "", type: "301" });

    const load = () => {
        setLoading(true);
        wbApi.getSeoCenter(siteId).then((d) => {
            setCenter(d);
            setSeo(d.site?.seo || {});
        }).catch(() => setError("SEO verisi yüklenemedi")).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [siteId]);

    const saveSeoExtras = async () => {
        setSaving(true);
        try {
            await wbApi.updateSite(siteId, {
                seo: {
                    ...seo,
                    customRobots: seo.customRobots,
                    structuredData: seo.structuredData,
                    canonicalUrl: seo.canonicalUrl,
                },
            });
            load();
        } catch {
            setError("Kaydedilemedi");
        } finally {
            setSaving(false);
        }
    };

    const addRedirect = async () => {
        try {
            await wbApi.createRedirect(siteId, newRedirect);
            setNewRedirect({ fromPath: "", toPath: "", type: "301" });
            load();
        } catch (e) {
            setError(e.response?.data?.error || "Yönlendirme eklenemedi");
        }
    };

    const deleteRedirect = async (id) => {
        await wbApi.deleteRedirect(siteId, id);
        load();
    };

    if (embeddedMetaOnly) return <SEOSettings siteId={siteId} />;

    if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>;

    const tabs = ["Meta & OG", "Sitemap", "Robots", "Yönlendirme", "Schema & Canonical"];

    return (
        <Box className="wb-ikas-page">
            <WBIkasPageHeader
                title="SEO Merkezi"
                subtitle="Sitemap, robots, meta, OpenGraph, yönlendirme ve schema — tek panel."
            />
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
                {tabs.map((label, i) => <Tab key={label} label={label} value={i} />)}
            </Tabs>

            {tab === 0 && <SEOSettings siteId={siteId} />}

            {tab === 1 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                        <Typography fontWeight={600}>Sitemap</Typography>
                        {center?.urls?.sitemap && (
                            <Button size="small" endIcon={<OpenInNewRounded />} href={center.urls.sitemap} target="_blank" rel="noreferrer">
                                Canlı sitemap
                            </Button>
                        )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Yayınlanmış sayfalar ve blog yazıları otomatik eklenir.
                    </Typography>
                    <TextField fullWidth multiline minRows={12} value={center?.sitemapPreview || ""}
                        InputProps={{ readOnly: true, style: { fontFamily: "monospace", fontSize: 11 } }} />
                </Paper>
            )}

            {tab === 2 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight={600} gutterBottom>robots.txt</Typography>
                    <TextField fullWidth multiline minRows={6} label="Özel robots kuralları (site geneli)"
                        value={seo.customRobots || ""} onChange={(e) => setSeo({ ...seo, customRobots: e.target.value })}
                        helperText="Boş bırakılırsa varsayılan robots üretilir." sx={{ mb: 2 }} />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Önizleme</Typography>
                    <TextField fullWidth multiline minRows={8} value={center?.robotsPreview || ""}
                        InputProps={{ readOnly: true, style: { fontFamily: "monospace", fontSize: 11 } }} />
                    <Button sx={{ mt: 2 }} variant="contained" startIcon={<SaveRounded />} onClick={saveSeoExtras} disabled={saving}>
                        Robots kaydet
                    </Button>
                </Paper>
            )}

            {tab === 3 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight={600} gutterBottom>URL yönlendirmeleri</Typography>
                    <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
                        <TextField size="small" label="/eski-yol" value={newRedirect.fromPath}
                            onChange={(e) => setNewRedirect({ ...newRedirect, fromPath: e.target.value })} />
                        <TextField size="small" label="/yeni-yol" value={newRedirect.toPath}
                            onChange={(e) => setNewRedirect({ ...newRedirect, toPath: e.target.value })} />
                        <TextField size="small" select label="Tip" value={newRedirect.type} SelectProps={{ native: true }}
                            onChange={(e) => setNewRedirect({ ...newRedirect, type: e.target.value })} sx={{ width: 90 }}>
                            <option value="301">301</option>
                            <option value="302">302</option>
                        </TextField>
                        <Button variant="contained" startIcon={<AddRounded />} onClick={addRedirect}>Ekle</Button>
                    </Box>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Kaynak</TableCell>
                                <TableCell>Hedef</TableCell>
                                <TableCell>Tip</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {(center?.redirects || []).map((r) => (
                                <TableRow key={r._id}>
                                    <TableCell><code>{r.fromPath}</code></TableCell>
                                    <TableCell><code>{r.toPath}</code></TableCell>
                                    <TableCell><Chip size="small" label={r.type} /></TableCell>
                                    <TableCell>
                                        <IconButton size="small" color="error" onClick={() => deleteRedirect(r._id)}>
                                            <DeleteRounded fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {tab === 4 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography fontWeight={600} gutterBottom>Schema.org (JSON-LD) & Canonical</Typography>
                    <TextField fullWidth label="Canonical URL (site ana)" value={seo.canonicalUrl || ""}
                        onChange={(e) => setSeo({ ...seo, canonicalUrl: e.target.value })} sx={{ mb: 2 }} />
                    <TextField fullWidth multiline minRows={10} label="Organization / WebSite JSON-LD"
                        value={typeof seo.structuredData === "string" ? seo.structuredData : JSON.stringify(seo.structuredData || {}, null, 2)}
                        onChange={(e) => setSeo({ ...seo, structuredData: e.target.value })}
                        helperText="Geçerli JSON-LD yapıştırın veya boş bırakın." />
                    <Button sx={{ mt: 2 }} variant="contained" startIcon={<SaveRounded />} onClick={saveSeoExtras} disabled={saving}>
                        Schema kaydet
                    </Button>
                </Paper>
            )}
        </Box>
    );
}
