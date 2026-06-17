import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";

/** Eski editör rotalarını sayfa yöneticisine yönlendirir */
export default function StoreEditorRedirect() {
    const { siteId } = useParams();
    const navigate = useNavigate();

    React.useEffect(() => {
        navigate(`/website-builder/${siteId}/pages`, { replace: true });
    }, [siteId, navigate]);

    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
            <CircularProgress />
        </Box>
    );
}
