import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    fetchPublicMarketingPopups,
    trackPublicAffiliateClick,
    trackPublicPopupEvent,
} from "../../services/storeApi";
import "./storefrontMarketing.css";

const REF_KEY = (slug) => `mkt_ref_${slug}`;
const POPUP_DISMISS_KEY = (slug, id) => `mkt_popup_${slug}_${id}`;

export function getMarketingCheckoutExtras(slug) {
    if (!slug) return {};
    try {
        const ref = localStorage.getItem(REF_KEY(slug));
        const popupId = sessionStorage.getItem(`mkt_popup_conv_${slug}`);
        const out = {};
        if (ref) out.ref = ref;
        if (popupId) {
            out.marketingChannel = "POPUP";
            out.popupId = popupId;
        }
        return out;
    } catch {
        return {};
    }
}

function StorefrontMarketing({ slug, children }) {
    const location = useLocation();
    const [popups, setPopups] = useState([]);
    const [activePopup, setActivePopup] = useState(null);
    const [email, setEmail] = useState("");

    const path = location.pathname;

    useEffect(() => {
        if (!slug) return;
        const params = new URLSearchParams(location.search);
        const ref = params.get("ref") || params.get("refCode");
        if (ref) {
            localStorage.setItem(REF_KEY(slug), ref);
            trackPublicAffiliateClick(slug, ref).catch(() => {});
        }
    }, [slug, location.search]);

    useEffect(() => {
        if (!slug) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchPublicMarketingPopups(slug, path);
                const list = (res.popups || []).filter((p) => !localStorage.getItem(POPUP_DISMISS_KEY(slug, p._id)));
                if (!cancelled) setPopups(list);
            } catch {
                /* ignore */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [slug, path]);

    useEffect(() => {
        if (!popups.length) return;
        const first = popups[0];
        const delay = Math.max(0, Number(first.displayRules?.delaySeconds) || 2) * 1000;
        const t = setTimeout(() => {
            setActivePopup(first);
            trackPublicPopupEvent(slug, first._id, "view").catch(() => {});
        }, delay);
        return () => clearTimeout(t);
    }, [popups, slug]);

    const dismissPopup = useCallback(
        (id) => {
            if (slug && id) localStorage.setItem(POPUP_DISMISS_KEY(slug, id), "1");
            setActivePopup(null);
            setPopups((prev) => prev.filter((p) => p._id !== id));
        },
        [slug]
    );

    const submitPopup = useCallback(async () => {
        if (!activePopup || !slug) return;
        try {
            await trackPublicPopupEvent(slug, activePopup._id, "convert", email);
            sessionStorage.setItem(`mkt_popup_conv_${slug}`, activePopup._id);
        } catch {
            /* ignore */
        }
        dismissPopup(activePopup._id);
    }, [activePopup, slug, email, dismissPopup]);

    const popupContent = useMemo(() => {
        if (!activePopup) return null;
        const cta = activePopup.content?.ctaText || "Devam";
        const title = activePopup.content?.title || activePopup.name;
        const body = activePopup.content?.body;
        const collect = activePopup.collectEmail || activePopup.content?.collectEmail;
        const type = activePopup.type || "modal";

        const inner = (
            <>
                <button type="button" className="sf-mkt-close" onClick={() => dismissPopup(activePopup._id)} aria-label="Kapat">
                    ×
                </button>
                {activePopup.content?.imageUrl && (
                    <img src={activePopup.content.imageUrl} alt="" className="sf-mkt-modal__img" />
                )}
                <h3>{title}</h3>
                {body && <p>{body}</p>}
                {collect && (
                    <input
                        type="email"
                        placeholder="E-posta adresiniz"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                )}
                <button type="button" className="sf-mkt-cta" onClick={submitPopup}>
                    {cta}
                </button>
            </>
        );

        if (type === "top_banner" || type === "bottom_banner" || type === "announcement") {
            const pos = type === "bottom_banner" ? "bottom" : "top";
            return (
                <div className={`sf-mkt-banner sf-mkt-banner--${pos}`} role="region" aria-label="Kampanya">
                    <div className="sf-mkt-banner__inner">{inner}</div>
                </div>
            );
        }

        return (
            <div className="sf-mkt-overlay" role="dialog" aria-modal="true">
                <div className="sf-mkt-modal">{inner}</div>
            </div>
        );
    }, [activePopup, dismissPopup, email, submitPopup]);

    return (
        <>
            {children}
            {popupContent}
        </>
    );
}

export default StorefrontMarketing;
