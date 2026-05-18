import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSeoForPath } from "../content/seoMeta";
import { BRAND_NAME } from "../constants/brand";
import { APP_SITE_URL } from "../constants/domain";

/**
 * Sayfa bazlı title, meta description, canonical, robots
 */
export default function SeoHead({ title, description, noindex, canonical }) {
    const { pathname } = useLocation();
    const fromRoute = getSeoForPath(pathname);
    const finalTitle = title || fromRoute.title;
    const finalDesc = description || fromRoute.description;
    const finalNoindex = noindex ?? fromRoute.noindex;
    const finalCanonical = canonical || fromRoute.canonical;

    useEffect(() => {
        document.title = finalTitle;

        const setMeta = (name, content, isProperty = false) => {
            if (!content) return;
            const attr = isProperty ? "property" : "name";
            let el = document.querySelector(`meta[${attr}="${name}"]`);
            if (!el) {
                el = document.createElement("meta");
                el.setAttribute(attr, name);
                document.head.appendChild(el);
            }
            el.setAttribute("content", content);
        };

        setMeta("description", finalDesc);
        setMeta("og:title", finalTitle, true);
        setMeta("og:description", finalDesc, true);
        setMeta("og:url", finalCanonical, true);
        setMeta("og:site_name", BRAND_NAME, true);
        setMeta("twitter:card", "summary_large_image");
        setMeta("twitter:title", finalTitle);
        setMeta("twitter:description", finalDesc);

        let canonicalEl = document.querySelector('link[rel="canonical"]');
        if (!canonicalEl) {
            canonicalEl = document.createElement("link");
            canonicalEl.rel = "canonical";
            document.head.appendChild(canonicalEl);
        }
        canonicalEl.href = finalCanonical;

        let robotsEl = document.querySelector('meta[name="robots"]');
        if (finalNoindex) {
            if (!robotsEl) {
                robotsEl = document.createElement("meta");
                robotsEl.name = "robots";
                document.head.appendChild(robotsEl);
            }
            robotsEl.content = "noindex, nofollow";
        } else if (robotsEl) {
            robotsEl.content = "index, follow";
        }
    }, [finalTitle, finalDesc, finalCanonical, finalNoindex]);

    return null;
}

/** JSON-LD — index.html ile birlikte; SPA route değişiminde güncellenmez (statik yeterli) */
export function injectOrganizationSchema() {
    const id = "pazaryonet-org-schema";
    if (document.getElementById(id)) return;
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                name: BRAND_NAME,
                url: APP_SITE_URL,
                logo: `${APP_SITE_URL}/brand/pazaryonet-logo.svg`,
                email: "info@pazaryonet.com",
                sameAs: [],
            },
            {
                "@type": "SoftwareApplication",
                name: BRAND_NAME,
                applicationCategory: "BusinessApplication",
                operatingSystem: "Web",
                offers: { "@type": "Offer", price: "0", priceCurrency: "TRY" },
                description:
                    "Pazaryeri entegrasyonu ve e-ticaret yönetim SaaS platformu.",
            },
        ],
    });
    document.head.appendChild(script);
}
