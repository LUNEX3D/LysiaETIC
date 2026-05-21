import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getPageHelp, resolveHelpPageId } from "../content/pageHelpContent";

const PageHelpContext = createContext(null);

export function PageHelpProvider({ children, activePanel = null }) {
    const [overridePageId, setOverridePageId] = useState(null);

    const setHelpPageId = useCallback((id) => {
        setOverridePageId(id || null);
    }, []);

    const pageId = useMemo(() => {
        if (overridePageId) return resolveHelpPageId(overridePageId);
        return resolveHelpPageId(activePanel);
    }, [overridePageId, activePanel]);

    const help = useMemo(() => getPageHelp(pageId), [pageId]);

    const value = useMemo(
        () => ({ pageId, help, setHelpPageId, setOverridePageId: setHelpPageId }),
        [pageId, help, setHelpPageId]
    );

    return (
        <PageHelpContext.Provider value={value}>
            {children}
        </PageHelpContext.Provider>
    );
}

export function usePageHelp() {
    const ctx = useContext(PageHelpContext);
    if (!ctx) {
        return {
            pageId: "default",
            help: getPageHelp("default"),
            setHelpPageId: () => {},
        };
    }
    return ctx;
}
