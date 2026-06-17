import React, { useEffect, useState, useCallback } from "react";
import { trackWbEvent } from "../../services/wbTrackApi";

const FREQ_KEY = "wb_popup_seen_";

function freqOk(popup) {
    const key = FREQ_KEY + popup._id;
    const freq = popup.targeting?.frequency || "once_per_session";
    if (freq === "always") return true;
    try {
        if (freq === "once_per_session") return !sessionStorage.getItem(key);
        if (freq === "once_per_day") {
            const raw = localStorage.getItem(key);
            if (!raw) return true;
            return Date.now() - Number(raw) > 86400000;
        }
        if (freq === "once_per_week") {
            const raw = localStorage.getItem(key);
            if (!raw) return true;
            return Date.now() - Number(raw) > 7 * 86400000;
        }
    } catch {
        return true;
    }
    return true;
}

function markSeen(popup) {
    const key = FREQ_KEY + popup._id;
    try {
        sessionStorage.setItem(key, "1");
        localStorage.setItem(key, String(Date.now()));
    } catch {
        /* ignore */
    }
}

function PopupContent({ popup, onClose, onCta }) {
    const sections = [...(popup.design?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return (
        <div className="wb-sf-popup__card" style={{ maxWidth: popup.design?.width || "440px", borderRadius: popup.design?.borderRadius || "12px" }}>
            {popup.design?.showCloseButton !== false && (
                <button type="button" className="wb-sf-popup__close" onClick={onClose} aria-label="Kapat">×</button>
            )}
            {sections.map((sec) => (
                <div key={sec.id} className="wb-sf-popup__section">
                    {sec.type === "heading" && <h3>{sec.content?.text}</h3>}
                    {sec.type === "text" && <p>{sec.content?.text}</p>}
                    {sec.type === "button" && (
                        <button type="button" className="wb-sf-popup__cta" onClick={onCta}>{sec.content?.text || "Tamam"}</button>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function WbStorefrontPopups({ popups = [], siteSlug }) {
    const [visible, setVisible] = useState(null);

    const show = useCallback((popup) => {
        if (!freqOk(popup)) return;
        setVisible(popup);
        markSeen(popup);
        if (siteSlug) {
            trackWbEvent(siteSlug, {
                eventType: "popup_view",
                popupId: popup._id,
                abVariantId: popup._abVariantId || "",
            });
        }
    }, [siteSlug]);

    const close = (popup, reason = "close") => {
        if (popup && siteSlug) {
            trackWbEvent(siteSlug, {
                eventType: reason === "cta" ? "popup_click" : "popup_close",
                popupId: popup._id,
            });
        }
        setVisible(null);
    };

    useEffect(() => {
        const active = popups.filter((p) => p.status === "active");
        if (!active.length) return undefined;

        const timers = [];
        active.forEach((popup) => {
            const t = popup.trigger?.type;
            if (t === "immediate") {
                show(popup);
            } else if (t === "time_delay") {
                const id = setTimeout(() => show(popup), (popup.trigger?.delaySeconds ?? 3) * 1000);
                timers.push(id);
            } else if (t === "scroll_depth") {
                const onScroll = () => {
                    const max = document.documentElement.scrollHeight - window.innerHeight;
                    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
                    if (pct >= (popup.trigger?.scrollDepthPercent ?? 50)) {
                        show(popup);
                        window.removeEventListener("scroll", onScroll);
                    }
                };
                window.addEventListener("scroll", onScroll, { passive: true });
                timers.push(() => window.removeEventListener("scroll", onScroll));
            } else if (t === "exit_intent") {
                const onLeave = (e) => {
                    if (e.clientY <= 0) {
                        show(popup);
                        document.removeEventListener("mouseout", onLeave);
                    }
                };
                document.addEventListener("mouseout", onLeave);
                timers.push(() => document.removeEventListener("mouseout", onLeave));
            }
        });

        return () => {
            timers.forEach((x) => (typeof x === "function" ? x() : clearTimeout(x)));
        };
    }, [popups, show]);

    if (!visible) return null;

    return (
        <div className="wb-sf-popup" role="dialog" aria-modal="true">
            {visible.design?.overlay !== false && (
                <button type="button" className="wb-sf-popup__overlay" aria-label="Kapat" onClick={() => close(visible)} />
            )}
            <PopupContent popup={visible} onClose={() => close(visible)} onCta={() => close(visible, "cta")} />
        </div>
    );
}
