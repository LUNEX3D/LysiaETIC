import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaInfoCircle, FaTimes } from "react-icons/fa";
import { useDashtockTheme } from "../../hooks/useDashtockTheme";
import { getPageHelp } from "../../content/pageHelpContent";
import "../../styles/pageHelp.css";

/**
 * ikas tarzı "Kullanım Rehberi" — başlık yanında pill, sağdan rehber paneli
 */
export default function EcUsageGuideButton({ pageId, className = "" }) {
    const [open, setOpen] = useState(false);
    const help = getPageHelp(pageId);
    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") close();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, close]);

    const scrollToSection = (sectionId) => {
        const el = document.getElementById(`ec-guide-section-${sectionId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const { rootClassName, rootStyle } = useDashtockTheme();

    const drawer =
        open && typeof document !== "undefined"
            ? createPortal(
                  <div
                      className="ec-guide-backdrop ec-guide-backdrop--open"
                      onClick={close}
                      role="presentation"
                  >
                      <div className="ec-guide-backdrop__shade" aria-hidden="true" />
                      <aside
                          className={`ec-guide-panel ${rootClassName}`}
                          style={rootStyle}
                          onClick={(e) => e.stopPropagation()}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="ec-guide-title"
                      >
                          <header className="ec-guide-panel__head">
                              <h2 id="ec-guide-title">{help.title}</h2>
                              <button
                                  type="button"
                                  className="ec-guide-panel__close"
                                  onClick={close}
                                  aria-label="Kapat"
                              >
                                  <FaTimes />
                              </button>
                          </header>

                          <div className="ec-guide-panel__body">
                              {help.intro && <p className="ec-guide-intro">{help.intro}</p>}
                              {help.introExtra && <p className="ec-guide-intro">{help.introExtra}</p>}

                              {help.toc?.length > 0 && (
                                  <nav className="ec-guide-toc" aria-label="Bu sayfada">
                                      <h3>Bu Sayfada</h3>
                                      <ul>
                                          {help.toc.map((item) => (
                                              <li key={item.id}>
                                                  <button type="button" onClick={() => scrollToSection(item.id)}>
                                                      {item.label}
                                                  </button>
                                              </li>
                                          ))}
                                      </ul>
                                  </nav>
                              )}

                              {help.sections?.map((section) => (
                                  <section
                                      key={section.id}
                                      id={`ec-guide-section-${section.id}`}
                                      className="ec-guide-section"
                                  >
                                      <h3>{section.title}</h3>
                                      {section.paragraphs?.map((p, i) => (
                                          <p key={i} className="ec-guide-p">
                                              {p}
                                          </p>
                                      ))}
                                      {section.steps?.length > 0 && (
                                          <ol className="ec-guide-steps">
                                              {section.steps.map((step, i) => (
                                                  <li key={i}>{step}</li>
                                              ))}
                                          </ol>
                                      )}
                                  </section>
                              ))}

                              {!help.sections?.length && help.steps?.length > 0 && (
                                  <section className="ec-guide-section">
                                      <h3>Nasıl kullanılır?</h3>
                                      <ol className="ec-guide-steps">
                                          {help.steps.map((step, i) => (
                                              <li key={i}>{step}</li>
                                          ))}
                                      </ol>
                                  </section>
                              )}

                              {help.tips?.length > 0 && (
                                  <section className="ec-guide-section ec-guide-section--tips">
                                      <h3>İpuçları</h3>
                                      <ul className="ec-guide-tips">
                                          {help.tips.map((tip, i) => (
                                              <li key={i}>{tip}</li>
                                          ))}
                                      </ul>
                                  </section>
                              )}
                          </div>
                      </aside>
                  </div>,
                  document.body
              )
            : null;

    return (
        <>
            <button
                type="button"
                className={`ec-guide-trigger ${className}`.trim()}
                onClick={() => setOpen(true)}
                aria-label="Kullanım rehberi"
            >
                <FaInfoCircle aria-hidden="true" />
                Kullanım Rehberi
            </button>
            {drawer}
        </>
    );
}
