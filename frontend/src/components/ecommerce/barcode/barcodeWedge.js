export const WEDGE_IDLE_MS = 90;
export const WEDGE_CHAR_GAP_MS = 55;
export const MIN_BARCODE_LENGTH = 3;

export function createBarcodeWedgeHandler(onScan) {
    let idleTimer = null;
    let lastCharAt = 0;
    let capturing = false;

    const clearIdle = () => {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
    };

    const flush = (el) => {
        clearIdle();
        capturing = false;
        const value = (el?.value ?? "").trim();
        if (el) el.value = "";
        if (value.length >= MIN_BARCODE_LENGTH) {
            onScan(value);
        }
    };

    const scheduleFlush = (el) => {
        clearIdle();
        idleTimer = setTimeout(() => flush(el), WEDGE_IDLE_MS);
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            flush(e.currentTarget);
            return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const now = Date.now();
            if (capturing && now - lastCharAt > WEDGE_CHAR_GAP_MS) {
                flush(e.currentTarget);
            }
            capturing = true;
            lastCharAt = now;
            scheduleFlush(e.currentTarget);
        }
    };

    const onInput = (e) => {
        scheduleFlush(e.currentTarget);
    };

    const destroy = () => clearIdle();

    return { onKeyDown, onInput, destroy, flush };
}
