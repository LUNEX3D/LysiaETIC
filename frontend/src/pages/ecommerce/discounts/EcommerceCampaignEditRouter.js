import React, { useEffect, useState } from "react";
import { fetchStoreCampaign } from "../../../services/storeApi";
import EcommerceCampaignFormPage from "./EcommerceCampaignFormPage";
import EcommerceCouponFormPage from "./EcommerceCouponFormPage";

const EcommerceCampaignEditRouter = ({ campaignId, onNavigate }) => {
    const [kind, setKind] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setKind(null);
            setError("");
            try {
                const res = await fetchStoreCampaign(campaignId);
                if (!cancelled) setKind(res.campaign?.kind === "code" ? "code" : "automatic");
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.error || e.message || "Yüklenemedi");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [campaignId]);

    if (error) return <div className="ec-purchase-form-error">{error}</div>;
    if (!kind) return <div className="ec-prod-empty">Yükleniyor…</div>;
    if (kind === "code") {
        return <EcommerceCouponFormPage campaignId={campaignId} onNavigate={onNavigate} />;
    }
    return <EcommerceCampaignFormPage campaignId={campaignId} onNavigate={onNavigate} />;
};

export default EcommerceCampaignEditRouter;
