import React, { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildGrapesSrcDoc } from "../../utils/grapesHtmlNormalize";

export default function WbGrapesPageView({ html, css, baseHref = "", siteBasePath = "" }) {
    const iframeRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const srcDoc = useMemo(() => buildGrapesSrcDoc(html, css, baseHref), [html, css, baseHref]);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        iframe.srcdoc = srcDoc;
    }, [srcDoc]);

    useEffect(() => {
        const onMessage = (event) => {
            if (event.source !== iframeRef.current?.contentWindow) return;
            if (event.data?.type !== "wb-grapes-navigate") return;

            let href = String(event.data.href || "").trim();
            if (!href || /^https?:/i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) {
                return;
            }

            const qs = location.search || "";
            const hash = location.hash || "";

            if (href === "/" || href === "") {
                navigate(`${siteBasePath || "/"}${qs}${hash}`);
                return;
            }

            if (!href.startsWith("/")) href = `/${href}`;
            navigate(`${siteBasePath}${href}${qs}${hash}`);
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [navigate, siteBasePath, location.search, location.hash]);

    return (
        <iframe
            ref={iframeRef}
            title="Mağaza"
            className="wb-grapes-page-view"
            sandbox="allow-scripts allow-same-origin"
            style={{
                display: "block",
                width: "100%",
                minHeight: "100vh",
                border: "none",
                background: "#fff",
            }}
        />
    );
}
