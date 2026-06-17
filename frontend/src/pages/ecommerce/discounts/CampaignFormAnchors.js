import React, { useCallback, useEffect, useRef, useState } from "react";

function findScrollRoot(startEl) {
    let el = startEl?.parentElement;
    while (el) {
        const { overflowY } = window.getComputedStyle(el);
        if (/(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1) {
            return el;
        }
        el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
}

function sectionTopInRoot(sectionEl, scrollRoot) {
    if (!sectionEl || !scrollRoot) return 0;
    if (scrollRoot === document.documentElement || scrollRoot === document.body) {
        return sectionEl.getBoundingClientRect().top + window.scrollY;
    }
    const rootRect = scrollRoot.getBoundingClientRect();
    const elRect = sectionEl.getBoundingClientRect();
    return elRect.top - rootRect.top + scrollRoot.scrollTop;
}

function sectionViewportTop(sectionEl, scrollRoot) {
    if (!sectionEl || !scrollRoot) return 0;
    if (scrollRoot === document.documentElement || scrollRoot === document.body) {
        return sectionEl.getBoundingClientRect().top;
    }
    const rootRect = scrollRoot.getBoundingClientRect();
    return sectionEl.getBoundingClientRect().top - rootRect.top;
}

const CampaignFormAnchors = ({ anchors = [] }) => {
    const navRef = useRef(null);
    const scrollRootRef = useRef(null);
    const clickLockRef = useRef(false);
    const clickTimerRef = useRef(null);
    const [activeId, setActiveId] = useState(() => anchors[0]?.id || "");
    const [scrollOffset, setScrollOffset] = useState(64);

    const measureOffset = useCallback(() => {
        const navH = navRef.current?.offsetHeight || 48;
        setScrollOffset(navH + 14);
    }, []);

    useEffect(() => {
        scrollRootRef.current = findScrollRoot(navRef.current);
        measureOffset();
        const root = scrollRootRef.current;
        const onResize = () => measureOffset();
        window.addEventListener("resize", onResize);
        root?.addEventListener?.("scroll", onResize, { passive: true });
        return () => {
            window.removeEventListener("resize", onResize);
            root?.removeEventListener?.("scroll", onResize);
        };
    }, [measureOffset, anchors]);

    useEffect(() => {
        if (!anchors.length) return;
        setActiveId((prev) => {
            const ids = anchors.map((a) => a.id);
            return ids.includes(prev) ? prev : ids[0];
        });
    }, [anchors]);

    const scrollToSection = useCallback(
        (id) => {
            const el = document.getElementById(id);
            const root = scrollRootRef.current;
            if (!el || !root) return;
            setActiveId(id);
            clickLockRef.current = true;
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            const top = Math.max(0, sectionTopInRoot(el, root) - scrollOffset);
            root.scrollTo({ top, behavior: "smooth" });
            clickTimerRef.current = setTimeout(() => {
                clickLockRef.current = false;
            }, 700);
        },
        [scrollOffset]
    );

    useEffect(() => {
        if (!anchors.length) return undefined;
        const root = scrollRootRef.current || findScrollRoot(navRef.current);

        const updateActive = () => {
            if (clickLockRef.current) return;
            let current = anchors[0].id;
            for (const a of anchors) {
                const el = document.getElementById(a.id);
                if (!el) continue;
                const top = sectionViewportTop(el, root);
                if (top <= scrollOffset + 20) {
                    current = a.id;
                }
            }
            setActiveId(current);
        };

        updateActive();
        root.addEventListener("scroll", updateActive, { passive: true });
        window.addEventListener("resize", updateActive);
        return () => {
            root.removeEventListener("scroll", updateActive);
            window.removeEventListener("resize", updateActive);
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        };
    }, [anchors, scrollOffset]);

    if (!anchors.length) return null;

    return (
        <nav
            ref={navRef}
            className="ec-discount-form-anchors"
            aria-label="Bölümler"
            style={{ "--ec-discount-scroll-offset": `${scrollOffset}px` }}
        >
            <div className="ec-discount-form-anchors__inner">
                {anchors.map((a) => (
                    <a
                        key={a.id}
                        href={`#${a.id}`}
                        className={activeId === a.id ? "is-active" : undefined}
                        aria-current={activeId === a.id ? "true" : undefined}
                        onClick={(e) => {
                            e.preventDefault();
                            scrollToSection(a.id);
                        }}
                    >
                        {a.label}
                    </a>
                ))}
            </div>
        </nav>
    );
};

export default CampaignFormAnchors;
