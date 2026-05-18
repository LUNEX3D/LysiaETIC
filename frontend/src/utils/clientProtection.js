/**
 * Üretim ortamında geliştirici araçları / kaynak görüntülemeyi zorlaştırır.
 * Not: Tarayıcıya inen JS tamamen gizlenemez; bu katman caydırıcıdır.
 * Geliştirme: localhost veya REACT_APP_DISABLE_CLIENT_GUARD=true ile kapalı.
 */

const GUARD_STYLE_ID = "py-client-guard-style";
const GUARD_OVERLAY_ID = "py-client-guard-overlay";

function isGuardEnabled() {
    if (process.env.REACT_APP_DISABLE_CLIENT_GUARD === "true") return false;
    if (process.env.NODE_ENV !== "production") return false;
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    if (host === "localhost" || host === "127.0.0.1") return false;
    return true;
}

function blockReactDevTools() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook && typeof hook === "object") {
        hook.inject = function noop() {};
        hook.renderers = new Map();
    }
}

function ensureOverlay() {
    let el = document.getElementById(GUARD_OVERLAY_ID);
    if (el) return el;

    if (!document.getElementById(GUARD_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = GUARD_STYLE_ID;
        style.textContent = `
            #${GUARD_OVERLAY_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: rgba(6, 6, 17, 0.97);
                color: #e9e9f0;
                font-family: Inter, system-ui, sans-serif;
                text-align: center;
            }
            #${GUARD_OVERLAY_ID} h2 {
                margin: 0 0 12px;
                font-size: 1.35rem;
                font-weight: 700;
            }
            #${GUARD_OVERLAY_ID} p {
                margin: 0;
                max-width: 420px;
                font-size: 0.95rem;
                line-height: 1.55;
                color: #9ca3af;
            }
        `;
        document.head.appendChild(style);
    }

    el = document.createElement("div");
    el.id = GUARD_OVERLAY_ID;
    el.setAttribute("role", "alert");
    el.innerHTML =
        "<div><h2>Geliştirici araçları kapalı</h2><p>Bu uygulamanın kaynak kodu koruma altındadır. Devam etmek için F12 veya geliştirici konsolunu kapatıp sayfayı yenileyin.</p></div>";
    document.body.appendChild(el);
    return el;
}

function showGuardOverlay() {
    if (!document.body) return;
    ensureOverlay().style.display = "flex";
    document.documentElement.style.overflow = "hidden";
}

function hideGuardOverlay() {
    const el = document.getElementById(GUARD_OVERLAY_ID);
    if (el) el.style.display = "none";
    document.documentElement.style.overflow = "";
}

function isDevtoolsLikelyOpen() {
    const threshold = 140;
    const widthGap = window.outerWidth - window.innerWidth > threshold;
    const heightGap = window.outerHeight - window.innerHeight > threshold;
    return widthGap || heightGap;
}

function attachKeyboardBlock() {
    document.addEventListener(
        "keydown",
        (e) => {
            const key = e.key?.toLowerCase();
            if (key === "f12") {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            if (e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(key)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            if (e.metaKey && e.altKey && key === "i") {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            if (e.ctrlKey && key === "u") {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            if (e.ctrlKey && key === "s") {
                e.preventDefault();
                return false;
            }
            return undefined;
        },
        true
    );
}

function attachContextMenuBlock() {
    document.addEventListener(
        "contextmenu",
        (e) => {
            e.preventDefault();
            return false;
        },
        true
    );
}

function attachDevtoolsProbe() {
    let tripped = false;

    const check = () => {
        if (isDevtoolsLikelyOpen()) {
            if (!tripped) {
                tripped = true;
                showGuardOverlay();
            }
        } else if (tripped) {
            tripped = false;
            hideGuardOverlay();
        }
    };

    window.addEventListener("resize", check);
    setInterval(check, 800);

    // Konsol açıldığında tetiklenen klasik getter tuzağı (caydırıcı)
    const bait = /./;
    bait.toString = function () {
        showGuardOverlay();
        return "";
    };
    setInterval(() => {
        // eslint-disable-next-line no-console
        console.log(bait);
        // eslint-disable-next-line no-console
        console.clear();
    }, 1200);
}

/** Üretimde istemci koruma katmanını başlat */
export function initClientProtection() {
    if (!isGuardEnabled()) return;

    blockReactDevTools();
    attachKeyboardBlock();
    attachContextMenuBlock();
    attachDevtoolsProbe();
}
