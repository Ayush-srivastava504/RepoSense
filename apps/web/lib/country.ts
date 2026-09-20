// Module: lib/country.ts
// Turns the free-text `jobs.country` column into an ISO 3166-1 alpha-2 code
// for schema.org `addressCountry` / `applicantLocationRequirements`.
//
// The column is not clean: scrapers write real country names ('India',
// 'Japan'), regions that are NOT countries ('Europe', 'Worldwide'), and -- for
// several remote feeds and ATS scrapers -- the *location* string itself
// ('Berlin, Germany'). Google's JobPosting validator resolves the value to a
// country; anything else is invalid data, so return null and let the caller
// omit the field instead of asserting a wrong or made-up country.

const ALIASES: Record<string, string> = {
    usa: 'US',
    'u.s.': 'US',
    'u.s.a.': 'US',
    'united states of america': 'US',
    america: 'US',
    uk: 'GB',
    'u.k.': 'GB',
    'great britain': 'GB',
    britain: 'GB',
    england: 'GB',
    scotland: 'GB',
    wales: 'GB',
    'northern ireland': 'GB',
    uae: 'AE',
    korea: 'KR',
    'south korea': 'KR',
    'republic of korea': 'KR',
    russia: 'RU',
    vietnam: 'VN',
    'czech republic': 'CZ',
    czechia: 'CZ',
    turkey: 'TR',
    turkiye: 'TR',
    'türkiye': 'TR',
    netherlands: 'NL',
    'the netherlands': 'NL',
    holland: 'NL',
    'ivory coast': 'CI',
};

// Values that describe an area or a work arrangement, never a country.
const NOT_A_COUNTRY = new Set([
    'worldwide', 'global', 'anywhere', 'remote', 'europe', 'emea', 'apac', 'latam', 'asia',
    'africa', 'north america', 'south america', 'eu', 'european union', 'international',
]);

// ICU knows these as "regions" but none is a country (or, for UK, is not the
// ISO code -- GB is).
const PSEUDO_REGIONS = new Set(['EU', 'UN', 'EZ', 'UK', 'QO', 'ZZ', 'XA', 'XB', 'AC', 'CP', 'DG', 'EA', 'IC', 'TA', 'XK']);

let nameToCode: Map<string, string> | null = null;
let validCodes: Set<string> | null = null;

function buildTables(): void {
    nameToCode = new Map();
    validCodes = new Set();
    let names: Intl.DisplayNames | null = null;
    try {
        names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    }
    catch {
        names = null;
    }
    const A = 65;
    for (let i = 0; i < 26; i++) {
        for (let j = 0; j < 26; j++) {
            const code = String.fromCharCode(A + i, A + j);
            let name: string | undefined;
            try {
                name = names?.of(code);
            }
            catch {
                name = undefined;
            }
            if (name && name !== code && !PSEUDO_REGIONS.has(code)) {
                validCodes.add(code);
                nameToCode.set(name.toLowerCase(), code);
            }
        }
    }
    for (const [alias, code] of Object.entries(ALIASES))
        nameToCode.set(alias, code);
}

function lookup(candidate: string): string | null {
    if (!nameToCode || !validCodes)
        buildTables();
    const key = candidate.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key || NOT_A_COUNTRY.has(key))
        return null;
    const aliased = nameToCode!.get(key);
    if (aliased)
        return aliased;
    if (/^[a-z]{2}$/.test(key)) {
        const code = key.toUpperCase();
        return validCodes!.has(code) ? code : null;
    }
    return null;
}

/**
 * 'India' -> 'IN', 'IN' -> 'IN', 'Berlin, Germany' -> 'DE'.
 * 'Europe' / 'Worldwide' / 'San Francisco, CA' / '' -> null.
 */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
    if (!raw)
        return null;
    const whole = lookup(raw);
    if (whole)
        return whole;
    // Location strings put the country last: 'Bengaluru, Karnataka, India'.
    const parts = raw.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
        const last = parts[parts.length - 1];
        // A bare 2-letter tail is ambiguous here ('San Francisco, CA' is
        // California, not Canada), so only full names count for location strings.
        if (last.length > 2)
            return lookup(last);
    }
    return null;
}
