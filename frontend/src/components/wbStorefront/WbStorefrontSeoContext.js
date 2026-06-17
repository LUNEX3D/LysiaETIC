import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import WbStorefrontHead from "./WbStorefrontHead";

const WbStorefrontSeoContext = createContext(null);

export function WbStorefrontSeoProvider({ children, initialSeo = null }) {
    const [seo, setSeo] = useState(initialSeo);

    const applySeo = useCallback((payload) => {
        if (!payload) return;
        setSeo({
            metaTags: payload.metaTags || payload.seo?.metaTags || {},
            jsonLd: payload.jsonLd || payload.seo?.jsonLd || [],
            baseUrl: payload.baseUrl || payload.seo?.baseUrl || "",
        });
    }, []);

    const value = useMemo(() => ({ seo, setSeo, applySeo }), [seo, applySeo]);

    return (
        <WbStorefrontSeoContext.Provider value={value}>
            <WbStorefrontHead seo={seo} />
            {children}
        </WbStorefrontSeoContext.Provider>
    );
}

export function useWbStorefrontSeo() {
    const ctx = useContext(WbStorefrontSeoContext);
    if (!ctx) throw new Error("useWbStorefrontSeo must be used within WbStorefrontSeoProvider");
    return ctx;
}
