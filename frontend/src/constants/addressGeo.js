import turkeyRaw from "./data/turkey_cities_districts.json";

/** Türkiye il / ilçe (Mernis kaynaklı JSON) */
export const TURKEY_CITIES = Object.values(turkeyRaw)
    .map((p) => ({
        name: p.province,
        districts: (p.districts || []).map((d) => d.name).sort((a, b) => a.localeCompare(b, "tr")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

/** Diğer ülkeler — başlıca şehir ve ilçe */
const INTL_LOCATIONS = {
    Almanya: [
        { name: "Berlin", districts: ["Mitte", "Charlottenburg", "Neukölln", "Kreuzberg"] },
        { name: "Münih", districts: ["Altstadt", "Schwabing", "Sendling"] },
        { name: "Hamburg", districts: ["Altona", "Eimsbüttel", "Harburg"] },
        { name: "Frankfurt", districts: ["Innenstadt", "Sachsenhausen", "Bockenheim"] },
    ],
    ABD: [
        { name: "New York", districts: ["Manhattan", "Brooklyn", "Queens"] },
        { name: "Los Angeles", districts: ["Downtown", "Hollywood", "Santa Monica"] },
        { name: "Chicago", districts: ["Loop", "Lincoln Park", "Hyde Park"] },
    ],
    İngiltere: [
        { name: "Londra", districts: ["Westminster", "Camden", "Greenwich"] },
        { name: "Manchester", districts: ["City Centre", "Salford", "Didsbury"] },
    ],
    Fransa: [
        { name: "Paris", districts: ["1er", "8e", "15e", "20e"] },
        { name: "Lyon", districts: ["1er", "2e", "3e"] },
        { name: "Marsilya", districts: ["1er", "8e"] },
    ],
    Hollanda: [
        { name: "Amsterdam", districts: ["Centrum", "Noord", "Zuid"] },
        { name: "Rotterdam", districts: ["Centrum", "Charlois"] },
        { name: "Lahey", districts: ["Centrum", "Escamp"] },
    ],
};

export const ADDRESS_COUNTRIES = [
    { name: "Türkiye", flag: "🇹🇷" },
    { name: "Almanya", flag: "🇩🇪" },
    { name: "ABD", flag: "🇺🇸" },
    { name: "İngiltere", flag: "🇬🇧" },
    { name: "Fransa", flag: "🇫🇷" },
    { name: "Hollanda", flag: "🇳🇱" },
    { name: "Belçika", flag: "🇧🇪" },
    { name: "İtalya", flag: "🇮🇹" },
    { name: "İspanya", flag: "🇪🇸" },
    { name: "İsviçre", flag: "🇨🇭" },
    { name: "Avusturya", flag: "🇦🇹" },
    { name: "Azerbaycan", flag: "🇦🇿" },
    { name: "Gürcistan", flag: "🇬🇪" },
    { name: "BAE", flag: "🇦🇪" },
    { name: "Suudi Arabistan", flag: "🇸🇦" },
];

export function countryOptionLabel(countryName) {
    const c = ADDRESS_COUNTRIES.find((x) => x.name === countryName);
    return c ? `${c.flag} ${c.name}` : countryName;
}

export function getCountryNames() {
    return ADDRESS_COUNTRIES.map((c) => c.name);
}

export function getCitiesForCountry(countryName) {
    if (!countryName) return [];
    if (countryName === "Türkiye") {
        return TURKEY_CITIES.map((c) => c.name);
    }
    const rows = INTL_LOCATIONS[countryName];
    return rows ? rows.map((c) => c.name) : [];
}

export function getDistrictsForCity(countryName, cityName) {
    if (!countryName || !cityName) return [];
    if (countryName === "Türkiye") {
        const city = TURKEY_CITIES.find((c) => c.name === cityName);
        return city?.districts || [];
    }
    const rows = INTL_LOCATIONS[countryName];
    const city = rows?.find((c) => c.name === cityName);
    return city?.districts || [];
}

export function hasGeoHierarchy(countryName) {
    if (countryName === "Türkiye") return true;
    return !!INTL_LOCATIONS[countryName];
}

export function countrySupportsCustomCity(countryName) {
    return !hasGeoHierarchy(countryName);
}
