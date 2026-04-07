import { useEffect } from "react";

/**
 * useViewportHeight — Fixes the mobile browser address bar height issue
 *
 * ✅ WEB APP FIRST: On mobile browsers (iOS Safari, Chrome Android),
 * 100vh includes the address bar area, causing content to be hidden.
 * This hook sets a CSS custom property --vh that represents the actual
 * visible viewport height.
 *
 * Usage in CSS:
 *   height: calc(var(--vh, 1vh) * 100);
 *
 * Usage in components:
 *   import useViewportHeight from "../utils/useViewportHeight";
 *   useViewportHeight(); // Call once in App or layout component
 */
const useViewportHeight = () => {
    useEffect(() => {
        const setVH = () => {
            // Get the actual visible viewport height
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty("--vh", `${vh}px`);

            // Also set the full viewport width (useful for preventing overflow)
            const vw = document.documentElement.clientWidth * 0.01;
            document.documentElement.style.setProperty("--vw", `${vw}px`);
        };

        // Set on mount
        setVH();

        // Update on resize (includes orientation change, keyboard open/close)
        window.addEventListener("resize", setVH);

        // Also update on orientation change (some older devices)
        window.addEventListener("orientationchange", () => {
            // Delay to let the browser finish rotating
            setTimeout(setVH, 150);
        });

        // ✅ Visual Viewport API — more accurate on mobile
        // Handles virtual keyboard appearance on iOS/Android
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", setVH);
        }

        return () => {
            window.removeEventListener("resize", setVH);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener("resize", setVH);
            }
        };
    }, []);
};

export default useViewportHeight;
