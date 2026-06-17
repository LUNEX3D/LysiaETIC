import React, { useEffect } from "react";

import { useNavigate } from "react-router-dom";

import { CircularProgress, Box } from "@mui/material";

import { parseStudioMode } from "../../../theme-builder/registry/editorModes";



/** E-ticaret panelinden tam ekran v3 Theme Studio'ya yönlendirir */

export default function EcThemeStudioRedirect({ siteId, language = "tr", mode }) {

    const navigate = useNavigate();

    const en = language === "en";



    useEffect(() => {

        if (siteId) {

            const parsed = parseStudioMode(mode);

            const qs = parsed !== "sections" ? `?mode=${parsed}` : "";

            navigate(`/website-builder/${siteId}/themes/editor${qs}`, { replace: false });

        }

    }, [siteId, navigate, mode]);



    if (!siteId) {

        return (

            <Box sx={{ p: 4, textAlign: "center", color: "#64748b" }}>

                {en ? "Select a store first." : "Önce bir mağaza seçin."}

            </Box>

        );

    }



    return (

        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 10, gap: 2 }}>

            <CircularProgress sx={{ color: "#6366f1" }} />

            <p style={{ color: "#64748b", fontSize: 14 }}>

                {en ? "Opening theme editor…" : "Tema editörü açılıyor…"}

            </p>

        </Box>

    );

}

