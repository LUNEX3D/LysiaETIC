export const TAG_NAME_MAX = 100;

export function emptyTagForm() {
    return { name: "" };
}

export function tagToForm(tag) {
    if (!tag) return emptyTagForm();
    return { name: tag.name || "" };
}

export function formToTagPayload(form) {
    return { name: form.name.trim().slice(0, TAG_NAME_MAX) };
}
