import { useEffect, useState } from "react";

/** Mobil / tablet — tüm modern tarayıcılar (matchMedia) */
export const MQ_MOBILE = "(max-width: 767.98px)";
export const MQ_TABLET = "(max-width: 1023.98px)";

const readMatches = () => {
    if (typeof window === "undefined") {
        return { isMobile: false, isTablet: false, isTouch: false };
    }
    const isMobile = window.matchMedia(MQ_MOBILE).matches;
    const isTablet = window.matchMedia(MQ_TABLET).matches;
    return {
        isMobile,
        isTablet: isTablet && !isMobile,
        isTouch: "ontouchstart" in window || navigator.maxTouchPoints > 0
    };
};

/**
 * Viewport sınıfı + isteğe bağlı menü açıkken body scroll kilidi.
 * App kökünde bir kez; panel layout'larda lockScroll ile.
 */
const useMobileShell = (options = {}) => {
    const { lockScroll = false, scrollLocked = false, setHtmlClasses = true } = options;
    const [state, setState] = useState(readMatches);

    useEffect(() => {
        const mqMobile = window.matchMedia(MQ_MOBILE);
        const mqTablet = window.matchMedia(MQ_TABLET);

        const sync = () => {
            const next = readMatches();
            setState(next);
            if (setHtmlClasses) {
                document.documentElement.classList.toggle("is-mobile-view", next.isMobile);
                document.documentElement.classList.toggle("is-tablet-view", next.isTablet);
                document.documentElement.classList.toggle("is-touch-view", next.isTouch);
            }
        };

        sync();
        mqMobile.addEventListener("change", sync);
        mqTablet.addEventListener("change", sync);
        return () => {
            mqMobile.removeEventListener("change", sync);
            mqTablet.removeEventListener("change", sync);
            if (setHtmlClasses) {
                document.documentElement.classList.remove("is-mobile-view", "is-tablet-view", "is-touch-view");
            }
        };
    }, [setHtmlClasses]);

    useEffect(() => {
        if (!lockScroll) return undefined;
        const cls = "mobile-menu-open";
        if (scrollLocked && state.isMobile) {
            document.body.classList.add(cls);
        } else {
            document.body.classList.remove(cls);
        }
        return () => document.body.classList.remove(cls);
    }, [lockScroll, scrollLocked, state.isMobile]);

    return state;
};

export default useMobileShell;
