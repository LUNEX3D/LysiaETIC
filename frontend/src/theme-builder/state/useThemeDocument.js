import { useCallback, useReducer, useRef } from "react";

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function setNested(obj, path, value) {
    const next = clone(obj);
    const parts = path.split(".");
    let cur = next;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    return next;
}

function themeReducer(state, action) {
    switch (action.type) {
        case "LOAD":
            return {
                ...state,
                document: action.document,
                revision: action.revision || state.revision,
                dirty: false,
            };
        case "SET_DOCUMENT":
            return { ...state, document: action.document, dirty: true };
        case "SET_PAGE":
            return { ...state, activePageKey: action.pageKey };
        case "SET_LOCALE":
            return { ...state, activeLocale: action.locale };
        case "SET_DEVICE":
            return { ...state, device: action.device };
        case "SELECT":
            return {
                ...state,
                selection: action.selection,
            };
        case "UPDATE_SECTION": {
            const doc = clone(state.document);
            const apply = (sections) => sections.map((s) => (s.id === action.sectionId ? { ...s, ...action.patch } : s));
            if (state.activePageKey === "product") {
                doc.productPage.sections = apply(doc.productPage?.sections || []);
            } else {
                const page = doc.pages[state.activePageKey];
                if (!page) return state;
                page.sections = apply(page.sections);
            }
            return { ...state, document: doc, dirty: true };
        }
        case "REORDER_SECTIONS": {
            const doc = clone(state.document);
            if (state.activePageKey === "product") {
                doc.productPage = doc.productPage || { sections: [] };
                doc.productPage.sections = action.sections;
            } else {
                const page = doc.pages[state.activePageKey];
                if (!page) return state;
                page.sections = action.sections;
            }
            return { ...state, document: doc, dirty: true };
        }
        case "ADD_SECTION": {
            const doc = clone(state.document);
            const section = { ...action.section, order: 0 };
            if (state.activePageKey === "product") {
                doc.productPage = doc.productPage || { sections: [] };
                section.order = doc.productPage.sections.length;
                doc.productPage.sections = [...doc.productPage.sections, section];
            } else {
                const page = doc.pages[state.activePageKey];
                if (!page) return state;
                section.order = page.sections.length;
                page.sections = [...page.sections, section];
            }
            return { ...state, document: doc, dirty: true, selection: { type: "section", sectionId: section.id } };
        }
        case "REMOVE_SECTION": {
            const doc = clone(state.document);
            if (state.activePageKey === "product") {
                doc.productPage.sections = (doc.productPage?.sections || []).filter((s) => s.id !== action.sectionId);
            } else {
                const page = doc.pages[state.activePageKey];
                if (!page) return state;
                page.sections = page.sections.filter((s) => s.id !== action.sectionId);
            }
            return { ...state, document: doc, dirty: true, selection: null };
        }
        case "PATCH_GLOBAL": {
            const doc = setNested(state.document, action.path, action.value);
            return { ...state, document: doc, dirty: true };
        }
        case "PATCH_SECTION_FIELD": {
            const doc = clone(state.document);
            const { sectionId, field, value, locale } = action;
            const patchOne = (s) => {
                if (s.id !== sectionId) return s;
                if (locale && locale !== state.activeLocale) {
                    const translations = { ...(s.translations || {}) };
                    const loc = { ...(translations[locale] || {}) };
                    if (field.startsWith("content.")) {
                        const key = field.slice(8);
                        loc.content = { ...(loc.content || {}), [key]: value };
                    } else {
                        loc[field] = value;
                    }
                    translations[locale] = loc;
                    return { ...s, translations };
                }
                if (field.startsWith("content.")) {
                    const key = field.slice(8);
                    return { ...s, content: { ...(s.content || {}), [key]: value } };
                }
                if (field.startsWith("settings.")) {
                    const key = field.slice(9);
                    return { ...s, settings: { ...(s.settings || {}), [key]: value } };
                }
                return { ...s, [field]: value };
            };
            if (state.activePageKey === "product") {
                doc.productPage.sections = (doc.productPage?.sections || []).map(patchOne);
            } else {
                const page = doc.pages[state.activePageKey];
                if (!page) return state;
                page.sections = page.sections.map(patchOne);
            }
            return { ...state, document: doc, dirty: true };
        }
        case "PATCH_PAGE_SEO": {
            const doc = clone(state.document);
            const page = doc.pages[action.pageKey];
            if (!page) return state;
            page.seo = { ...(page.seo || {}), ...action.seo };
            return { ...state, document: doc, dirty: true };
        }
        case "DUPLICATE_SECTION":
        case "TOGGLE_SECTION_HIDE":
        case "MOVE_SECTION": {
            const doc = clone(state.document);
            const getSections = () => (state.activePageKey === "product"
                ? (doc.productPage?.sections || [])
                : (doc.pages[state.activePageKey]?.sections || []));
            const setSections = (sections) => {
                if (state.activePageKey === "product") {
                    doc.productPage = { ...(doc.productPage || {}), sections };
                } else {
                    const page = doc.pages[state.activePageKey];
                    if (!page) return false;
                    page.sections = sections;
                }
                return true;
            };
            let sections = getSections();
            if (action.type === "DUPLICATE_SECTION") {
                const src = sections.find((s) => s.id === action.sectionId);
                if (!src) return state;
                const copy = { ...clone(src), id: action.newId || `sec_${Date.now()}` };
                const idx = sections.findIndex((s) => s.id === action.sectionId);
                sections = [...sections.slice(0, idx + 1), copy, ...sections.slice(idx + 1)];
                if (!setSections(sections)) return state;
                return { ...state, document: doc, dirty: true, selection: { type: "section", sectionId: copy.id } };
            }
            if (action.type === "TOGGLE_SECTION_HIDE") {
                sections = sections.map((s) =>
                    s.id === action.sectionId
                        ? { ...s, settings: { ...(s.settings || {}), hidden: !s.settings?.hidden } }
                        : s
                );
                if (!setSections(sections)) return state;
                return { ...state, document: doc, dirty: true };
            }
            const idx = sections.findIndex((s) => s.id === action.sectionId);
            const next = idx + action.delta;
            if (idx < 0 || next < 0 || next >= sections.length) return state;
            const arr = [...sections];
            const [item] = arr.splice(idx, 1);
            arr.splice(next, 0, item);
            if (!setSections(arr)) return state;
            return { ...state, document: doc, dirty: true };
        }
        case "SET_REGISTRY":
            return { ...state, registry: action.registry, pageTemplates: action.pageTemplates || state.pageTemplates, locales: action.locales || state.locales };
        case "MARK_CLEAN":
            return { ...state, dirty: false };
        default:
            return state;
    }
}

export function useThemeDocument(initial = {}) {
    const [state, dispatch] = useReducer(themeReducer, {
        document: null,
        revision: 1,
        dirty: false,
        activePageKey: "home",
        activeLocale: "tr",
        device: "desktop",
        selection: null,
        registry: [],
        pageTemplates: [],
        locales: [],
        ...initial,
    });

    const historyRef = useRef({ past: [], future: [] });

    const pushHistory = useCallback((doc) => {
        historyRef.current.past.push(clone(doc));
        if (historyRef.current.past.length > 50) historyRef.current.past.shift();
        historyRef.current.future = [];
    }, []);

    const undo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (past.length < 2) return null;
        const current = past.pop();
        future.push(current);
        const prev = past[past.length - 1];
        dispatch({ type: "SET_DOCUMENT", document: clone(prev) });
        return prev;
    }, []);

    const redo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (!future.length) return null;
        const next = future.pop();
        past.push(next);
        dispatch({ type: "SET_DOCUMENT", document: clone(next) });
        return next;
    }, []);

    return { state, dispatch, pushHistory, undo, redo, historyRef };
}

export default useThemeDocument;
