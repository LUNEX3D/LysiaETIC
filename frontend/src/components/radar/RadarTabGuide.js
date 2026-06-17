import React, { useState, useCallback } from "react";
import {
    FaCrosshairs, FaBoxOpen, FaChartBar, FaInfoCircle,
    FaChevronDown, FaChevronUp, FaLightbulb, FaListUl,
} from "react-icons/fa";
import { RADAR_TAB_GUIDES } from "../../constants/radarTabGuides";

const TAB_ICONS = {
    crosshairs: FaCrosshairs,
    box: FaBoxOpen,
    chart: FaChartBar,
};

const storageKey = (tabKey) => `dashtock-radar-guide-${tabKey}`;

export default function RadarTabGuide({ tabKey }) {
    const guide = RADAR_TAB_GUIDES[tabKey];
    const [expanded, setExpanded] = useState(() => {
        try {
            return localStorage.getItem(storageKey(tabKey)) === "open";
        } catch {
            return false;
        }
    });

    const toggle = useCallback(() => {
        setExpanded((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(storageKey(tabKey), next ? "open" : "collapsed");
            } catch {
                /* ignore */
            }
            return next;
        });
    }, [tabKey]);

    if (!guide) return null;

    const Icon = TAB_ICONS[guide.icon] || FaInfoCircle;

    return (
        <section className="rp-guide rp-guide--v3" aria-label={`${guide.title} bilgilendirme`}>
            <button
                type="button"
                className="rp-guide-toggle"
                onClick={toggle}
                aria-expanded={expanded}
            >
                <span className="rp-guide-toggle-icon">
                    <Icon />
                </span>
                <span className="rp-guide-toggle-text">
                    <strong>{guide.title} — nasıl kullanılır?</strong>
                    <small>{guide.summary}</small>
                </span>
                {expanded ? <FaChevronUp aria-hidden /> : <FaChevronDown aria-hidden />}
            </button>

            {expanded && (
                <div className="rp-guide-body">
                    <div className="rp-guide-block">
                        <h4>
                            <FaLightbulb /> Bu sekme ne işe yarar?
                        </h4>
                        <ul>
                            {guide.purpose.map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ul>
                    </div>

                    {guide.actions?.length > 0 && (
                        <div className="rp-guide-block">
                            <h4>
                                <FaListUl /> Hızlı işlemler
                            </h4>
                            <dl className="rp-guide-dl">
                                {guide.actions.map((a) => (
                                    <div key={a.label} className="rp-guide-dl-row">
                                        <dt>{a.label}</dt>
                                        <dd>{a.desc}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}

                    <div className="rp-guide-block">
                        <h4>Veriler ne anlama gelir?</h4>
                        <dl className="rp-guide-dl rp-guide-dl--fields">
                            {guide.dataFields.map((f) => (
                                <div key={f.term} className="rp-guide-dl-row">
                                    <dt>{f.term}</dt>
                                    <dd>{f.desc}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {guide.note && (
                        <p className="rp-guide-note">
                            <FaInfoCircle aria-hidden />
                            {guide.note}
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}
