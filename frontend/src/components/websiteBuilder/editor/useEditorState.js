import { useReducer, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "../../../utils/uuid";

const MAX_HISTORY = 50;

const INITIAL_STATE = {
    siteId: null,
    pageId: null,
    sections: [],
    selectedSectionId: null,
    device: "desktop",
    isDirty: false,
    isSaving: false,
    saveError: null,
    history: [],
    historyIndex: -1,
    dragOverIndex: null,
};

function cloneSections(sections) {
    return JSON.parse(JSON.stringify(sections));
}

function pushHistory(state, sections) {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(cloneSections(sections));
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
}

function editorReducer(state, action) {
    switch (action.type) {
        case "INIT": {
            const sections = action.payload.sections || [];
            return {
                ...INITIAL_STATE,
                siteId: action.payload.siteId,
                pageId: action.payload.pageId,
                sections,
                history: [cloneSections(sections)],
                historyIndex: 0,
            };
        }

        case "SET_DEVICE":
            return { ...state, device: action.payload };

        case "SELECT_SECTION":
            return { ...state, selectedSectionId: action.payload };

        case "DESELECT":
            return { ...state, selectedSectionId: null };

        case "ADD_SECTION": {
            const { sectionType, insertAfterIndex } = action.payload;
            const newSection = {
                id: uuidv4(),
                type: sectionType,
                order: 0,
                settings: {},
                content: action.payload.defaultContent || {},
                mobileOverride: {},
                translations: {},
                isLocked: false,
                version: 1,
            };

            let newSections = cloneSections(state.sections);
            const idx = insertAfterIndex !== undefined ? insertAfterIndex + 1 : newSections.length;
            newSections.splice(idx, 0, newSection);
            newSections = newSections.map((s, i) => ({ ...s, order: i }));

            return {
                ...state,
                sections: newSections,
                selectedSectionId: newSection.id,
                isDirty: true,
                ...pushHistory(state, newSections),
            };
        }

        case "REMOVE_SECTION": {
            const newSections = cloneSections(state.sections)
                .filter((s) => s.id !== action.payload)
                .map((s, i) => ({ ...s, order: i }));
            return {
                ...state,
                sections: newSections,
                selectedSectionId: state.selectedSectionId === action.payload ? null : state.selectedSectionId,
                isDirty: true,
                ...pushHistory(state, newSections),
            };
        }

        case "UPDATE_SECTION_CONTENT": {
            const { sectionId, content } = action.payload;
            const newSections = state.sections.map((s) =>
                s.id === sectionId ? { ...s, content: { ...s.content, ...content }, version: (s.version || 1) + 1 } : s
            );
            return { ...state, sections: newSections, isDirty: true };
        }

        case "UPDATE_SECTION_SETTINGS": {
            const { sectionId, settings } = action.payload;
            const newSections = state.sections.map((s) =>
                s.id === sectionId ? { ...s, settings: { ...s.settings, ...settings } } : s
            );
            return { ...state, sections: newSections, isDirty: true };
        }

        case "UPDATE_SECTION_MOBILE": {
            const { sectionId, mobileOverride } = action.payload;
            const newSections = state.sections.map((s) =>
                s.id === sectionId
                    ? { ...s, mobileOverride: { ...s.mobileOverride, ...mobileOverride } }
                    : s
            );
            return { ...state, sections: newSections, isDirty: true };
        }

        case "COMMIT_UPDATE": {
            return { ...state, ...pushHistory(state, state.sections) };
        }

        case "REORDER_SECTIONS": {
            const newSections = action.payload.map((s, i) => ({ ...s, order: i }));
            return {
                ...state,
                sections: newSections,
                isDirty: true,
                ...pushHistory(state, newSections),
            };
        }

        case "DUPLICATE_SECTION": {
            const src = state.sections.find((s) => s.id === action.payload);
            if (!src) return state;
            const dup = { ...cloneSections([src])[0], id: uuidv4() };
            const srcIdx = state.sections.findIndex((s) => s.id === action.payload);
            const newSections = cloneSections(state.sections);
            newSections.splice(srcIdx + 1, 0, dup);
            newSections.forEach((s, i) => { s.order = i; });
            return {
                ...state,
                sections: newSections,
                selectedSectionId: dup.id,
                isDirty: true,
                ...pushHistory(state, newSections),
            };
        }

        case "MOVE_SECTION_UP": {
            const idx = state.sections.findIndex((s) => s.id === action.payload);
            if (idx <= 0) return state;
            const newSections = cloneSections(state.sections);
            [newSections[idx - 1], newSections[idx]] = [newSections[idx], newSections[idx - 1]];
            newSections.forEach((s, i) => { s.order = i; });
            return { ...state, sections: newSections, isDirty: true, ...pushHistory(state, newSections) };
        }

        case "MOVE_SECTION_DOWN": {
            const idx = state.sections.findIndex((s) => s.id === action.payload);
            if (idx < 0 || idx >= state.sections.length - 1) return state;
            const newSections = cloneSections(state.sections);
            [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
            newSections.forEach((s, i) => { s.order = i; });
            return { ...state, sections: newSections, isDirty: true, ...pushHistory(state, newSections) };
        }

        case "TOGGLE_LOCK": {
            const newSections = state.sections.map((s) =>
                s.id === action.payload ? { ...s, isLocked: !s.isLocked } : s
            );
            return { ...state, sections: newSections };
        }

        case "TOGGLE_VISIBILITY": {
            const newSections = state.sections.map((s) => {
                if (s.id !== action.payload) return s;
                const hidden = !s.settings?.hidden;
                return { ...s, settings: { ...s.settings, hidden } };
            });
            return {
                ...state,
                sections: newSections,
                isDirty: true,
                ...pushHistory(state, newSections),
            };
        }

        case "SET_DRAG_OVER":
            return { ...state, dragOverIndex: action.payload };

        case "UNDO": {
            if (state.historyIndex <= 0) return state;
            const newIndex = state.historyIndex - 1;
            return {
                ...state,
                sections: cloneSections(state.history[newIndex]),
                historyIndex: newIndex,
                selectedSectionId: null,
                isDirty: true,
            };
        }

        case "REDO": {
            if (state.historyIndex >= state.history.length - 1) return state;
            const newIndex = state.historyIndex + 1;
            return {
                ...state,
                sections: cloneSections(state.history[newIndex]),
                historyIndex: newIndex,
                selectedSectionId: null,
                isDirty: true,
            };
        }

        case "SAVE_START":
            return { ...state, isSaving: true, saveError: null };

        case "SAVE_SUCCESS":
            return { ...state, isSaving: false, isDirty: false, saveError: null };

        case "SAVE_ERROR":
            return { ...state, isSaving: false, saveError: action.payload };

        case "SECTIONS_LOADED": {
            const sections = action.payload || [];
            return {
                ...state,
                sections,
                history: [cloneSections(sections)],
                historyIndex: 0,
                isDirty: false,
            };
        }

        default:
            return state;
    }
}

export function useEditorState() {
    const [state, dispatch] = useReducer(editorReducer, INITIAL_STATE);
    const updateTimerRef = useRef(null);

    const init = useCallback((siteId, pageId, sections) => {
        dispatch({ type: "INIT", payload: { siteId, pageId, sections } });
    }, []);

    const setDevice = useCallback((device) => dispatch({ type: "SET_DEVICE", payload: device }), []);
    const selectSection = useCallback((id) => dispatch({ type: "SELECT_SECTION", payload: id }), []);
    const deselect = useCallback(() => dispatch({ type: "DESELECT" }), []);

    const addSection = useCallback((sectionType, defaultContent, insertAfterIndex) => {
        dispatch({ type: "ADD_SECTION", payload: { sectionType, defaultContent, insertAfterIndex } });
    }, []);

    const removeSection = useCallback((id) => dispatch({ type: "REMOVE_SECTION", payload: id }), []);
    const duplicateSection = useCallback((id) => dispatch({ type: "DUPLICATE_SECTION", payload: id }), []);
    const moveSectionUp = useCallback((id) => dispatch({ type: "MOVE_SECTION_UP", payload: id }), []);
    const moveSectionDown = useCallback((id) => dispatch({ type: "MOVE_SECTION_DOWN", payload: id }), []);
    const toggleLock = useCallback((id) => dispatch({ type: "TOGGLE_LOCK", payload: id }), []);
    const toggleSectionVisibility = useCallback((id) => dispatch({ type: "TOGGLE_VISIBILITY", payload: id }), []);

    const updateSectionContent = useCallback((sectionId, content) => {
        dispatch({ type: "UPDATE_SECTION_CONTENT", payload: { sectionId, content } });
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
            dispatch({ type: "COMMIT_UPDATE" });
        }, 800);
    }, []);

    const updateSectionSettings = useCallback((sectionId, settings) => {
        dispatch({ type: "UPDATE_SECTION_SETTINGS", payload: { sectionId, settings } });
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
            dispatch({ type: "COMMIT_UPDATE" });
        }, 800);
    }, []);

    const updateSectionMobile = useCallback((sectionId, mobileOverride) => {
        dispatch({ type: "UPDATE_SECTION_MOBILE", payload: { sectionId, mobileOverride } });
    }, []);

    const reorderSections = useCallback((newOrder) => {
        dispatch({ type: "REORDER_SECTIONS", payload: newOrder });
    }, []);

    const setDragOver = useCallback((idx) => dispatch({ type: "SET_DRAG_OVER", payload: idx }), []);

    const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
    const redo = useCallback(() => dispatch({ type: "REDO" }), []);

    const setSaveStart = useCallback(() => dispatch({ type: "SAVE_START" }), []);
    const setSaveSuccess = useCallback(() => dispatch({ type: "SAVE_SUCCESS" }), []);
    const setSaveError = useCallback((msg) => dispatch({ type: "SAVE_ERROR", payload: msg }), []);

    const canUndo = state.historyIndex > 0;
    const canRedo = state.historyIndex < state.history.length - 1;
    const selectedSection = state.sections.find((s) => s.id === state.selectedSectionId) || null;

    return {
        state,
        selectedSection,
        canUndo,
        canRedo,
        init,
        setDevice,
        selectSection,
        deselect,
        addSection,
        removeSection,
        duplicateSection,
        moveSectionUp,
        moveSectionDown,
        toggleLock,
        toggleSectionVisibility,
        updateSectionContent,
        updateSectionSettings,
        updateSectionMobile,
        reorderSections,
        setDragOver,
        undo,
        redo,
        setSaveStart,
        setSaveSuccess,
        setSaveError,
    };
}
