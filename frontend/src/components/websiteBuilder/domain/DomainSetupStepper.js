import React, { useMemo } from "react";
import { CheckRounded } from "@mui/icons-material";
import "../../../styles/websiteBuilder/wbDesignSystem.css";

const STEPS = [
    { id: "domain", label: "Domain gir" },
    { id: "dns", label: "DNS bağla" },
    { id: "ssl", label: "SSL aktif" },
    { id: "publish", label: "Yayına al" },
];

/**
 * Görsel kurulum adımları — mevcut domain/site state'ten türetilir (yeni API yok).
 */
export default function DomainSetupStepper({ site, domain }) {
    const activeIndex = useMemo(() => {
        if (!domain?.domain) return 0;
        const verified = domain.status === "verified" || domain.verifiedAt;
        if (!verified) return 1;
        const sslOk = site?.sslStatus === "active" || domain.sslStatus === "active";
        if (!sslOk) return 2;
        if (site?.status !== "published") return 3;
        return 4;
    }, [site, domain]);

    return (
        <nav className="wb-ds-stepper" aria-label="Domain kurulum adımları">
            {STEPS.map((step, index) => {
                const done = index < activeIndex;
                const active = index === activeIndex;
                return (
                    <div
                        key={step.id}
                        className={`wb-ds-step${done ? " is-done" : ""}${active ? " is-active" : ""}`}
                    >
                        <span className="wb-ds-step__dot">
                            {done ? <CheckRounded sx={{ fontSize: 16 }} /> : index + 1}
                        </span>
                        <span className="wb-ds-step__label">{step.label}</span>
                    </div>
                );
            })}
        </nav>
    );
}
