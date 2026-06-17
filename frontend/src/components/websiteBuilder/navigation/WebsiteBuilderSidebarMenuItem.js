import React, { useState, useMemo, useCallback } from "react";
import { FaGlobe, FaExternalLinkAlt, FaLock } from "react-icons/fa";
import {
    openWebsiteBuilder,
    getWbSidebarQuickActions,
} from "../../../utils/wbNavigation";

export default function WebsiteBuilderSidebarMenuItem({
    text,
    isLocked,
    sidebarExpanded,
    onLocked,
    onAfterOpen,
}) {
    const [quickHover, setQuickHover] = useState(false);
    const quickActions = useMemo(() => getWbSidebarQuickActions(), [quickHover]);

    const openMain = useCallback(() => {
        if (isLocked) {
            onLocked?.();
            return;
        }
        openWebsiteBuilder("/website-builder");
        onAfterOpen?.();
    }, [isLocked, onLocked, onAfterOpen]);

    const runQuickAction = useCallback((action, e) => {
        e.stopPropagation();
        if (isLocked) {
            onLocked?.();
            return;
        }
        if (action.disabled) return;
        if (action.external && action.href) {
            window.open(action.href, "_blank", "noopener,noreferrer");
        } else if (action.path) {
            openWebsiteBuilder(action.path);
        }
        onAfterOpen?.();
    }, [isLocked, onLocked, onAfterOpen]);

    const showQuick = quickHover;

    return (
        <div
            className="wb-erp-nav-wrap"
            onMouseEnter={() => setQuickHover(true)}
            onMouseLeave={() => setQuickHover(false)}
        >
            <div
                role="button"
                tabIndex={0}
                className={`menu-item menu-item--wb-workspace ${isLocked ? "menu-item--locked" : ""}`}
                onClick={openMain}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openMain();
                    }
                }}
                aria-label={`${text} — yeni sekmede aç`}
            >
                <div className="icon-wrapper icon-wrapper--wb">
                    <FaGlobe />
                </div>
                <span className="menu-text">{text}</span>
                {!isLocked && (
                    <FaExternalLinkAlt className="menu-item-wb-newtab" aria-hidden />
                )}
                {isLocked && (
                    <FaLock style={{ fontSize: 10, opacity: 0.55, marginLeft: 4 }} title="Paket yükseltmesi gerekli" />
                )}
                <span className="sidebar-tooltip wb-sidebar-tooltip-wb">
                    {text} — yeni sekmede açılır
                </span>
            </div>

            {showQuick && !isLocked && (
                <div
                    className={`wb-erp-quick-actions ${sidebarExpanded ? "wb-erp-quick-actions--inline" : "wb-erp-quick-actions--flyout"}`}
                    role="menu"
                    aria-label="Website Builder kısayolları"
                >
                    {quickActions.map((action) => (
                        <button
                            key={action.id}
                            type="button"
                            role="menuitem"
                            className={`wb-erp-quick-action ${action.disabled ? "wb-erp-quick-action--disabled" : ""}`}
                            title={action.title}
                            disabled={action.disabled}
                            onClick={(e) => runQuickAction(action, e)}
                        >
                            <span>{action.label}</span>
                            {!action.disabled && <FaExternalLinkAlt className="wb-erp-quick-action-icon" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
