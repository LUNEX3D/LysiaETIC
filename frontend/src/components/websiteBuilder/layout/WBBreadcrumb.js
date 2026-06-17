import React from "react";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
import { Breadcrumbs, Link, Typography } from "@mui/material";
import { NavigateNextRounded } from "@mui/icons-material";

const SEGMENT_LABELS = {
    editor: "Sayfa editörü",
    "product-page": "Ürün sayfası",
    themes: "Temalar",
    navigation: "Menü",
    blog: "Blog",
    media: "Medya",
    domain: "Domain",
    seo: "SEO",
    settings: "Ayarlar",
    ai: "AI Stüdyo",
    new: "Yeni",
};

export default function WBBreadcrumb({ siteName }) {
    const { siteId } = useParams();
    const { pathname } = useLocation();
    const base = `/website-builder/${siteId}`;
    const tail = pathname.replace(base, "").split("/").filter(Boolean);

    const crumbs = [{ label: "Website Builder", to: "/website-builder" }];
    if (siteId) {
        crumbs.push({ label: siteName || "Site", to: base });
    }
    let pathAcc = base;
    tail.forEach((seg, i) => {
        pathAcc += `/${seg}`;
        const isLast = i === tail.length - 1;
        const label = SEGMENT_LABELS[seg] || (seg.length > 12 ? "Düzenle" : seg);
        crumbs.push({ label, to: isLast ? null : pathAcc });
    });

    return (
        <Breadcrumbs separator={<NavigateNextRounded fontSize="small" />} sx={{ mb: 1.5, "& .MuiBreadcrumbs-li": { fontSize: 13 } }}>
            {crumbs.map((c, idx) => {
                const isLast = idx === crumbs.length - 1;
                if (isLast || !c.to) {
                    return (
                        <Typography key={`${c.label}-${idx}`} color="text.primary" fontSize={13} fontWeight={isLast ? 600 : 400}>
                            {c.label}
                        </Typography>
                    );
                }
                return (
                    <Link key={c.to} component={RouterLink} to={c.to} underline="hover" color="text.secondary" fontSize={13}>
                        {c.label}
                    </Link>
                );
            })}
        </Breadcrumbs>
    );
}
