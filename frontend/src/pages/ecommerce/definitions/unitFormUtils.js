export const UNIT_NAME_MAX = 100;

export function emptyUnitForm() {
    return { name: "" };
}

export function unitToForm(unit) {
    if (!unit) return emptyUnitForm();
    return { name: unit.name || "" };
}

export function formToUnitPayload(form) {
    return { name: form.name.trim().slice(0, UNIT_NAME_MAX) };
}
