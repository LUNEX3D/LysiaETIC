import React, { useEffect, useState, useMemo, useCallback } from "react";

import { Outlet, useLocation, useParams, useNavigate } from "react-router-dom";

import { Box, CircularProgress, Alert } from "@mui/material";

import { getLiveSiteUrls } from "../../../utils/wbStorefrontHost";
import { rememberWbSiteContext, shouldSkipOnboardingRedirect } from "../../../utils/wbNavigation";

import {

    loadSiteSetupBundle,

    shouldShowSetupReminder,

    isOverviewIndexPath,

    isOnboardingPath,

} from "../setup/siteSetupProgress";

import WBSiteWorkspaceSidebar from "./WBSiteWorkspaceSidebar";
import "../../../styles/websiteBuilder/wbSiteWorkspace.css";

import WBSetupBanner from "./WBSetupBanner";
import "../../../styles/websiteBuilder/wbIkasWorkspace.css";
import "../../../styles/websiteBuilder/wbEmptyState.css";
import "../../../styles/websiteBuilder/wbStoreBuilder.css";



const FULL_BLEED_SUFFIXES = ["/editor", "/product-page", "/store/pages"];
const WORKSPACE_WIDE_SUFFIXES = [];
const WORKSPACE_EDITOR_SUFFIXES = ["/store/pages"];

const EDITOR_FOCUS_SUFFIXES = ["/editor", "/product-page", "/store/pages"];



function isEditorFocusPath(pathname) {

    return EDITOR_FOCUS_SUFFIXES.some((s) => pathname.endsWith(s));

}



export default function WBLayout() {

    const { siteId } = useParams();

    const { pathname } = useLocation();

    const navigate = useNavigate();

    const [site, setSite] = useState(null);

    const [setupProgress, setSetupProgress] = useState(null);

    const [error, setError] = useState("");

    const [loading, setLoading] = useState(true);



    const fullBleed = FULL_BLEED_SUFFIXES.some((s) => pathname.endsWith(s));

    const workspaceEditor = WORKSPACE_EDITOR_SUFFIXES.some((s) => pathname.endsWith(s));

    const workspaceWide = WORKSPACE_WIDE_SUFFIXES.some((s) =>
        pathname.endsWith(s) || pathname.includes(`${s}/`)
    );

    const editorFocus = isEditorFocusPath(pathname);

    const useSiteWorkspace = !editorFocus && !fullBleed;

    const showSetupBanner = !editorFocus && setupProgress && shouldShowSetupReminder(setupProgress);



    const reloadSetup = useCallback(async () => {

        if (!siteId) return null;

        const bundle = await loadSiteSetupBundle(siteId);

        setSite(bundle.site);

        setSetupProgress(bundle.progress);

        return bundle;

    }, [siteId]);



    useEffect(() => {

        let cancelled = false;

        setLoading(true);

        setError("");

        loadSiteSetupBundle(siteId)

            .then((bundle) => {

                if (cancelled) return;

                setSite(bundle.site);

                setSetupProgress(bundle.progress);

            })

            .catch((e) => {

                if (!cancelled) setError(e.response?.data?.error || "Site yüklenemedi");

            })

            .finally(() => {

                if (!cancelled) setLoading(false);

            });

        return () => { cancelled = true; };

    }, [siteId]);



    useEffect(() => {

        if (loading || !setupProgress || isOnboardingPath(pathname)) return;

        if (shouldSkipOnboardingRedirect(siteId)) return;

        if (shouldShowSetupReminder(setupProgress) && isOverviewIndexPath(pathname, siteId)) {

            navigate(`/website-builder/${siteId}/onboarding`, { replace: true });

        }

    }, [loading, setupProgress, pathname, siteId, navigate]);



    const publicUrl = useMemo(() => {

        if (!site) return "";

        return getLiveSiteUrls(site).primary || "";

    }, [site]);



    const liveSiteUrl = useMemo(() => {

        if (!site) return "";

        return getLiveSiteUrls(site).path || getLiveSiteUrls(site).primary || "";

    }, [site]);



    useEffect(() => {

        if (!siteId) return;

        const live = site ? getLiveSiteUrls(site) : null;

        const publicUrl = live?.canOpen ? (live.path || live.primary) : null;

        rememberWbSiteContext(siteId, publicUrl);

    }, [siteId, site]);



    const outletContext = useMemo(

        () => ({

            site,

            publicUrl,

            liveSiteUrl,

            setupProgress,

            reloadSetup,

        }),

        [site, publicUrl, liveSiteUrl, setupProgress, reloadSetup]

    );



    if (loading) {

        return (

            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>

                <CircularProgress />

            </Box>

        );

    }



    if (error || !site) {

        return (

            <Box sx={{ p: 3, maxWidth: 480, mx: "auto" }}>

                <Alert severity="error">{error || "Site bulunamadı"}</Alert>

            </Box>

        );

    }



    if (editorFocus) {

        return <Outlet context={outletContext} />;

    }

    if (useSiteWorkspace || workspaceEditor) {

        return (

            <Box className="wb-site-workspace-layout wb-site-workspace-layout--ikas" sx={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>

                <WBSiteWorkspaceSidebar site={site} />

                <Box
                    component="main"
                    className={`wb-ikas-workspace-main ${workspaceEditor ? "wb-site-workspace-main--editor" : ""}`}
                    sx={{ flex: 1, minWidth: 0, overflow: workspaceEditor ? "hidden" : "auto", display: "flex", flexDirection: "column" }}
                >
                    {!workspaceEditor && showSetupBanner && (
                        <Box sx={{ px: { xs: 2, md: 4 }, pt: 2 }}>
                            <WBSetupBanner setupProgress={setupProgress} />
                        </Box>
                    )}
                    <Box sx={{ flex: 1, minHeight: 0, px: workspaceEditor ? 0 : { xs: 2, md: 4 }, pb: workspaceEditor ? 0 : 4, width: "100%" }}>
                        <Outlet context={outletContext} />
                    </Box>
                </Box>

            </Box>

        );

    }

    if (fullBleed) {

        return (

            <Box sx={{ minHeight: "calc(100vh - 64px)", bgcolor: "background.default" }}>

                {showSetupBanner && (

                    <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, maxWidth: 1200, mx: "auto" }}>

                        <WBSetupBanner setupProgress={setupProgress} />

                    </Box>

                )}

                <Outlet context={outletContext} />

            </Box>

        );

    }



    return <Outlet context={outletContext} />;

}


