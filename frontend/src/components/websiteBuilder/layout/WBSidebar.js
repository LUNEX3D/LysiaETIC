import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getLiveSiteUrls } from "../../../utils/wbStorefrontHost";
import {
    List, ListItemButton, ListItemIcon, ListItemText, Divider, Box, Typography, Button,
} from "@mui/material";
import {
    DashboardRounded, EditRounded, ShoppingBagRounded, PaletteRounded, MenuRounded,
    ArticleRounded, PermMediaRounded, LanguageRounded, SearchRounded, SettingsRounded,
    AutoAwesomeRounded, ArrowBackRounded, OpenInNewRounded, BarChartRounded,
    RocketLaunchRounded,
} from "@mui/icons-material";

function buildNav(setupProgress) {
    const items = [
        { segment: "", label: "Genel bakış", icon: DashboardRounded },
    ];
    if (setupProgress && !setupProgress.checks?.publish) {
        items.push({ segment: "onboarding", label: "Kurulum sihirbazı", icon: RocketLaunchRounded });
    }
    items.push(
    { segment: "editor", label: "Sayfalar", icon: EditRounded },
    { segment: "product-page", label: "Ürün sayfası", icon: ShoppingBagRounded },
    { segment: "themes", label: "Tema mağazası", icon: PaletteRounded },
    { segment: "themes/editor", label: "Tema editörü", icon: EditRounded },
    { segment: "themes/my", label: "Temalarım", icon: PaletteRounded },
    { segment: "navigation", label: "Menü", icon: MenuRounded },
    { segment: "blog", label: "Blog", icon: ArticleRounded },
    { segment: "media", label: "Medya", icon: PermMediaRounded },
    { segment: "domain", label: "Domain Merkezi", icon: LanguageRounded },
    { segment: "seo", label: "SEO", icon: SearchRounded },
    { segment: "analytics", label: "Analitik", icon: BarChartRounded },
    { segment: "ai", label: "AI Stüdyo", icon: AutoAwesomeRounded },
    { segment: "settings", label: "Ayarlar", icon: SettingsRounded },
    );
    return items;
}

export default function WBSidebar({ site, setupProgress }) {
    const nav = buildNav(setupProgress);
    const { siteId } = useParams();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const base = `/website-builder/${siteId}`;

    const isActive = (segment) => {
        if (!segment) return pathname === base || pathname === `${base}/`;
        const full = `${base}/${segment}`;
        if (segment === "themes") {
            return pathname === full || pathname === `${full}/` || pathname === `${base}/themes/my`;
        }
        if (segment === "themes/editor") {
            return pathname === full || pathname.startsWith(`${full}/`);
        }
        if (segment === "themes/my") {
            return pathname === full || pathname.startsWith(`${full}/`);
        }
        return pathname === full || pathname.startsWith(`${full}/`);
    };

    return (
        <Box
            component="nav"
            sx={{
                width: 240,
                flexShrink: 0,
                borderRight: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
            }}
        >
            <Box sx={{ p: 2, pb: 1 }}>
                <Button
                    size="small"
                    startIcon={<ArrowBackRounded />}
                    onClick={() => navigate("/website-builder")}
                    color="inherit"
                    sx={{ mb: 1.5, textTransform: "none" }}
                >
                    Tüm siteler
                </Button>
                <Typography variant="subtitle2" fontWeight={700} noWrap title={site?.name}>
                    {site?.name || "Site"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    /{site?.slug}
                </Typography>
            </Box>
            <Divider />
            <List dense sx={{ flex: 1, py: 1 }}>
                {nav.map(({ segment, label, icon: Icon }) => (
                    <ListItemButton
                        key={segment || "overview"}
                        selected={isActive(segment)}
                        onClick={() => navigate(segment ? `${base}/${segment}` : base)}
                        sx={{ mx: 1, borderRadius: 1.5, mb: 0.25 }}
                    >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                            <Icon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13, fontWeight: isActive(segment) ? 600 : 400 }} />
                    </ListItemButton>
                ))}
            </List>
            {site?.status === "published" && (() => {
                const live = getLiveSiteUrls(site);
                const href = live.path || live.primary;
                if (!href) return null;
                return (
                    <Box sx={{ p: 2, pt: 0 }}>
                        <Button
                            fullWidth
                            size="small"
                            variant="contained"
                            disableElevation
                            endIcon={<OpenInNewRounded />}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textTransform: "none", borderRadius: 2 }}
                        >
                            Canlı siteyi aç
                        </Button>
                    </Box>
                );
            })()}
        </Box>
    );
}
