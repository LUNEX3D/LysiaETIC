import { useEffect, useState } from "react";
import axios from "axios";
import { resolveUploadUrl } from "../utils/resolveUploadUrl";
import { LOGIN_PARTNER_TEMPLATES } from "../constants/loginPartnerTemplates";

const FALLBACK = {
    hero: {
        titleLine1: "Pazaryerinden faturaya,",
        titleLine2: "stoktan kargoya",
        titleEmphasis: "tek panel",
        description1: "Trendyol, Hepsiburada, Amazon, N11 ve Çiçeksepeti siparişlerinizi tek yerden yönetin.",
        description2: "Otomatik e-Arşiv, iade sonrası fatura iptali, gelişmiş analiz ve AI destekli araçlar.",
    },
    partners: {
        enabled: true,
        kicker: "Referanslarımız",
        title: "Bize güvenen iş ortaklarımız",
        subtitle: "Türkiye'nin önde gelen markaları Dashtock ile operasyonlarını yönetiyor",
        useTemplateWhenEmpty: true,
        items: LOGIN_PARTNER_TEMPLATES.map((t, i) => ({ ...t, order: i, isTemplate: true })),
        usingTemplate: true,
    },
    sections: {},
};

function getPublicLoginPageUrl() {
    const envBase = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
    if (envBase) return `${envBase}/api/public/login-page`;
    return "/api/public/login-page";
}

export default function useLoginPageConfig() {
    const [config, setConfig] = useState(FALLBACK);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await axios.get(getPublicLoginPageUrl(), { timeout: 10000 });
                if (!cancelled && res.data?.success && res.data.data) {
                    setConfig(res.data.data);
                }
            } catch {
                /* fallback şablon */
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const partners = (config.partners?.items || []).map((p) => ({
        ...p,
        logoUrl: resolveUploadUrl(p.logoUrl),
    }));

    return { config, loading, partners };
}
