import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getLiveSiteUrls, getWbAppDomain } from "../../../utils/wbStorefrontHost";
import {
    ArrowBackRounded, SearchRounded, PublicRounded, GridViewRounded,
    MenuRounded, MenuBookRounded, SettingsRounded, BoltRounded,
    NotificationsNoneRounded, PaymentRounded, PeopleRounded,
    LocalShippingRounded, ExtensionRounded,
} from "@mui/icons-material";
import "../../../styles/websiteBuilder/wbSiteWorkspace.css";

/** İkas site sidebar — düz menü */
const IKAS_NAV = [
    { segment: "themes/my", label: "Temalarım", icon: GridViewRounded },
    { segment: "themes", label: "Tema Mağazası", icon: GridViewRounded },
    { segment: "seo", label: "SEO ve Alan Adı", icon: SearchRounded },
    { segment: null, label: "Otomasyonlar", icon: BoltRounded, disabled: true },
    { segment: null, label: "Bildirimler", icon: NotificationsNoneRounded, disabled: true },
    { segment: "settings", label: "Lokalizasyon", icon: SettingsRounded },
    { segment: null, label: "Ödeme Ayarları", icon: PaymentRounded, disabled: true },
    { segment: null, label: "Müşteri Ayarları", icon: PeopleRounded, disabled: true },
    { segment: null, label: "Kargo Ayarları", icon: LocalShippingRounded, disabled: true },
    { segment: null, label: "Eklentiler", icon: ExtensionRounded, disabled: true },
    { segment: "blog", label: "Blog", icon: MenuBookRounded },
    { segment: "navigation", label: "Menü", icon: MenuRounded, sub: true },
    { segment: "domain", label: "Alan adı", icon: PublicRounded, sub: true },
];

function resolveDisplayHost(site) {
    if (site?.customDomain) {
        return site.customDomain.replace(/^https?:\/\//, "");
    }
    if (site?.slug) {
        return `${site.slug}.${getWbAppDomain()}`;
    }
    return "mağaza";
}

export default function WBSiteWorkspaceSidebar({
    site,
    embedded = false,
    activeSegment = "themes",
    onSegmentChange,
    onBack,
    onExitToProgram,
}) {
    const { siteId: routeSiteId } = useParams();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const siteId = site?._id || routeSiteId;
    const base = `/website-builder/${siteId}`;

    const displayHost = resolveDisplayHost(site);

    const isActive = (segment) => {
        if (embedded) return activeSegment === segment;
        if (!segment) return false;
        const full = `${base}/${segment}`;
        if (segment === "themes" || segment === "themes/my") {
            return pathname === full || pathname === `${full}/`
                || pathname.includes(`${base}/themes`);
        }
        return pathname === full || pathname.startsWith(`${full}/`);
    };

    const live = site ? getLiveSiteUrls(site) : null;
    const liveHref = live?.path || live?.primary;

    const handleNav = (segment) => {
        if (embedded && onSegmentChange) {
            onSegmentChange(segment);
            return;
        }
        if (segment) navigate(`${base}/${segment}`);
    };

    const handleBack = () => {
        if (onBack) {
            onBack();
            return;
        }
        navigate("/website-builder");
    };

    return (
        <aside
            className={[
                "wb-site-workspace-sidebar",
                "wb-site-workspace-sidebar--ikas",
                embedded ? "wb-site-workspace-sidebar--embedded" : "",
            ].filter(Boolean).join(" ")}
            aria-label="Site menüsü"
        >
            <div className="wb-site-workspace-sidebar-head">
                <button
                    type="button"
                    className="wb-site-workspace-back"
                    onClick={handleBack}
                    aria-label="Geri"
                    title={embedded ? "Mağaza paneline dön" : "Geri"}
                >
                    <ArrowBackRounded sx={{ fontSize: 18 }} />
                </button>
                {embedded && onExitToProgram && (
                    <button
                        type="button"
                        className="wb-site-workspace-exit-erp"
                        onClick={onExitToProgram}
                        title="Ana programa dön"
                    >
                        ERP
                    </button>
                )}
                <div className="wb-site-workspace-site-chip">
                    <PublicRounded sx={{ fontSize: 16 }} />
                </div>
                <span className="wb-site-workspace-host" title={displayHost}>
                    {displayHost}
                </span>
            </div>

            <nav className="wb-site-workspace-nav">
                {IKAS_NAV.map((item) => {
                    const Icon = item.icon;
                    const active = item.segment != null && isActive(item.segment);
                    return (
                        <button
                            key={item.label}
                            type="button"
                            disabled={item.disabled}
                            className={[
                                "wb-site-workspace-nav-item",
                                active ? "active" : "",
                                item.sub ? "sub" : "",
                                item.disabled ? "disabled" : "",
                            ].filter(Boolean).join(" ")}
                            onClick={() => {
                                if (!item.disabled && item.segment) {
                                    handleNav(item.segment);
                                }
                            }}
                        >
                            <Icon className="wb-site-workspace-nav-icon" />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {liveHref && !embedded && (
                <div className="wb-site-workspace-footer">
                    <a
                        href={liveHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wb-site-workspace-live-link"
                    >
                        Canlı siteyi aç
                    </a>
                </div>
            )}
        </aside>
    );
}
