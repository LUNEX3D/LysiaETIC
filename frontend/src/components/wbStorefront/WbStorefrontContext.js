import React, { createContext, useContext } from "react";

export const WbStorefrontContext = createContext(null);

export function useWbStorefront() {
    const ctx = useContext(WbStorefrontContext);
    if (!ctx) throw new Error("WbStorefrontContext gerekli");
    return ctx;
}
