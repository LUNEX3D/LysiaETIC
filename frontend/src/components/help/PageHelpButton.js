import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FaInfoCircle, FaTimes } from "react-icons/fa";
import { usePageHelp } from "../../context/PageHelpContext";
import { getPageHelp, resolveHelpPageId } from "../../content/pageHelpContent";
import "../../styles/pageHelp.css";

/**
 * (i) yardım — tıklanınca sayfa kullanım rehberi
 * @param {string} [pageId] — verilmezse context'teki aktif sayfa
 * @param {"fab"|"inline"|"header"} [variant]
 * @param {string} [className]
 * @param {string} [ariaLabel]
 */
export default function PageHelpButton({
    pageId: pageIdProp,
    variant = "inline",
    className = "",
    ariaLabel = "Bu sayfayı nasıl kullanırım?",
}) {
    const { pageId: ctxPageId } = usePageHelp();
    const resolvedId = resolveHelpPageId(pageIdProp || ctxPageId);
    const help = getPageHelp(resolvedId);
    const [open, setOpen] = useState(false);

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === "Escape") close(); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, close]);

    const btnClass = [
        "page-help-trigger",
        `page-help-trigger--${variant}`,
        className,
    ].filter(Boolean).join(" ");

    const modal = (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="page-help-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={close}
                    role="presentation"
                >
                    <motion.div
                        className="page-help-panel"
                        initial={{ opacity: 0, y: 16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.96 }}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-labelledby="page-help-title"
                        aria-modal="true"
                    >
                        <header className="page-help-panel-head">
                            <div className="page-help-panel-title-wrap">
                                <FaInfoCircle className="page-help-panel-icon" aria-hidden />
                                <h2 id="page-help-title">{help.title}</h2>
                            </div>
                            <button type="button" className="page-help-close" onClick={close} aria-label="Kapat">
                                <FaTimes />
                            </button>
                        </header>
                        <div className="page-help-panel-body">
                            {help.intro && <p className="page-help-intro">{help.intro}</p>}
                            {help.steps?.length > 0 && (
                                <section className="page-help-section">
                                    <h3>Nasıl kullanılır?</h3>
                                    <ol className="page-help-steps">
                                        {help.steps.map((step, i) => (
                                            <li key={i}>{step}</li>
                                        ))}
                                    </ol>
                                </section>
                            )}
                            {help.tips?.length > 0 && (
                                <section className="page-help-section page-help-section--tips">
                                    <h3>İpuçları</h3>
                                    <ul className="page-help-tips">
                                        {help.tips.map((tip, i) => (
                                            <li key={i}>{tip}</li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </div>
                        <footer className="page-help-panel-foot">
                            <button type="button" className="page-help-ok" onClick={close}>Anladım</button>
                        </footer>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <button
                type="button"
                className={btnClass}
                onClick={() => setOpen(true)}
                aria-label={ariaLabel}
                title={ariaLabel}
            >
                <FaInfoCircle aria-hidden />
                {variant === "header" && <span className="page-help-trigger-label">Yardım</span>}
            </button>
            {typeof document !== "undefined" && ReactDOM.createPortal(modal, document.body)}
        </>
    );
}

/** Sabit sağ alt — panel sayfalarında (ana sayfa ve Ürün Merkezi kendi başlığında yardım gösterir) */
export function PageHelpFloating() {
    const { pageId } = usePageHelp();
    const id = String(pageId || "");
    if (id === "dashboard" || id.startsWith("pm-center") || id === "pm-variants.editModal") {
        return null;
    }
    return <PageHelpButton variant="fab" ariaLabel="Sayfa yardımı" />;
}
