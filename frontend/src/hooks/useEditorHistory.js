import { useCallback, useRef, useState } from "react";

/**
 * Tema editörü undo/redo — sections + themeVariables snapshot stack
 */
export function useEditorHistory(maxDepth = 60) {
    const stackRef = useRef([]);
    const indexRef = useRef(-1);
    const [, bump] = useState(0);

    const syncFlags = useCallback(() => {
        bump((n) => n + 1);
    }, []);

    const reset = useCallback((snapshot) => {
        if (!snapshot) {
            stackRef.current = [];
            indexRef.current = -1;
            syncFlags();
            return;
        }
        const snap = JSON.parse(JSON.stringify(snapshot));
        stackRef.current = [snap];
        indexRef.current = 0;
        syncFlags();
    }, [syncFlags]);

    const push = useCallback((snapshot) => {
        if (!snapshot) return;
        const snap = JSON.parse(JSON.stringify(snapshot));
        const stack = stackRef.current.slice(0, indexRef.current + 1);
        stack.push(snap);
        if (stack.length > maxDepth) stack.shift();
        else indexRef.current += 1;
        stackRef.current = stack;
        if (stack.length > maxDepth) indexRef.current = stack.length - 1;
        syncFlags();
    }, [maxDepth, syncFlags]);

    const undo = useCallback(() => {
        if (indexRef.current <= 0) return null;
        indexRef.current -= 1;
        syncFlags();
        return JSON.parse(JSON.stringify(stackRef.current[indexRef.current]));
    }, [syncFlags]);

    const redo = useCallback(() => {
        if (indexRef.current >= stackRef.current.length - 1) return null;
        indexRef.current += 1;
        syncFlags();
        return JSON.parse(JSON.stringify(stackRef.current[indexRef.current]));
    }, [syncFlags]);

    const canUndo = indexRef.current > 0;
    const canRedo = indexRef.current < stackRef.current.length - 1 && stackRef.current.length > 0;

    return { reset, push, undo, redo, canUndo, canRedo };
}
