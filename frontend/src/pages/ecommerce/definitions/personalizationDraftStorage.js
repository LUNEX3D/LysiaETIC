export const PERSONALIZATION_DRAFT_KEY = "ec_personalization_draft";

export function savePersonalizationDraft(draft) {
    try {
        sessionStorage.setItem(PERSONALIZATION_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        // no-op
    }
}

export function loadPersonalizationDraft() {
    try {
        const raw = sessionStorage.getItem(PERSONALIZATION_DRAFT_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearPersonalizationDraft() {
    try {
        sessionStorage.removeItem(PERSONALIZATION_DRAFT_KEY);
    } catch {
        // no-op
    }
}

export function getPersonalizationReturnPanel(personalizationId) {
    return personalizationId ? `ec-personalization-edit-${personalizationId}` : "ec-personalization-add";
}
