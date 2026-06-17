import React, { useEffect, useState } from "react";
import { CheckCircleRounded, RadioButtonUncheckedRounded } from "@mui/icons-material";
import { fetchSetupProgress } from "../../../services/storeFacadeApi";
import {
    EC_WB_EDITOR_PANEL,
    EC_WB_MY_THEMES_PANEL,
} from "../../../constants/ecommerceMenu";

/**
 * Shopify Home / İkas onboarding — mağaza kurulum adımları (Store Facade)
 */
export default function EcommerceSetupChecklist({ siteId, onNavigate }) {
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchSetupProgress(siteId);
                if (!cancelled) setProgress(res.progress);
            } catch {
                /* optional */
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [siteId]);

    if (loading || !progress) return null;

    const steps = progress.steps || [];
    const done = steps.filter((s) => s.done).length;
    if (progress.percent >= 100 || done >= steps.length) return null;

    const actionFor = (id) => {
        switch (id) {
            case "appearance":
                return { panel: EC_WB_MY_THEMES_PANEL, label: "Görünümü düzenle" };
            case "first_product":
                return { panel: "ec-product-add-simple", label: "Ürün ekle" };
            case "payment":
                return { panel: "ec-store-settings", label: "Ödeme ayarları" };
            case "domain":
                return { panel: "ec-domain-wizard", label: "Alan adı" };
            case "publish":
                return { panel: "ec-wb-publish", label: "Yayınla" };
            default:
                return null;
        }
    };

    const items = steps
        .filter((s) => s.id !== "store_created")
        .map((s) => {
            const action = actionFor(s.id);
            return {
                id: s.id,
                done: s.done,
                label: s.labelTr || s.id,
                hint: "",
                action: action ? () => onNavigate?.(action.panel) : null,
                actionLabel: action?.label,
            };
        });

    return (
        <section className="ec-setup-checklist">
            <header className="ec-setup-checklist__head">
                <h3>Mağaza kurulumu</h3>
                <span>{progress.percent}% · {done} / {steps.length}</span>
            </header>
            <div
                className="ec-setup-checklist__bar"
                style={{
                    height: 6,
                    background: "#e2e8f0",
                    borderRadius: 999,
                    marginBottom: 12,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${progress.percent}%`,
                        height: "100%",
                        background: "#008060",
                        transition: "width 0.3s",
                    }}
                />
            </div>
            <ul className="ec-setup-checklist__list">
                {items.map((item) => (
                    <li key={item.id} className={item.done ? "done" : ""}>
                        {item.done ? (
                            <CheckCircleRounded sx={{ fontSize: 20, color: "#008060" }} />
                        ) : (
                            <RadioButtonUncheckedRounded sx={{ fontSize: 20, color: "#c4c4c4" }} />
                        )}
                        <div className="ec-setup-checklist__body">
                            <strong>{item.label}</strong>
                            {item.hint && <span>{item.hint}</span>}
                        </div>
                        {!item.done && item.action && (
                            <button type="button" className="ec-setup-checklist__cta" onClick={item.action}>
                                {item.actionLabel}
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
