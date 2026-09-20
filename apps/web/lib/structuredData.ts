// lib/structuredData.ts Reusable JSON-LD builders. Every function returns a plain object
// meant to be dropped straight into a <Script type="application/ld+json"> tag via
// JSON.stringify. Keeping these in one place means every page emits schema in the same
// shape, which is what Google's Rich Results tooling actually rewards.

import { normalizeCountryCode } from './country';
import { hreflangLinks } from './hreflang';
import { BASE_URL, type Job } from './jobs';
export const ORG_NAME = 'InternFlow';
export const ORG_LOGO = `${BASE_URL}/og-image.png`;
export function organizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: ORG_NAME,
        url: BASE_URL,
        logo: ORG_LOGO,
        sameAs: [
            'https://github.com/reposense',
            'https://www.linkedin.com/company/internflow',
        ],
        description: 'InternFlow helps engineering students land internships and jobs with AI-powered GitHub code review, resume, LinkedIn, and ATS tools.',
    };
}
export function breadcrumbSchema(items: {
    name: string;
    url: string;
}[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };
}
// Blank column -> 'IN' (the crawler's own default for on-site jobs). A
// non-blank value that isn't a resolvable country ('Europe', 'Worldwide', a
// city) -> null, so callers omit the field instead of emitting invalid data.
function jobCountryCode(raw: string | null | undefined): string | null {
    if (!raw || !raw.trim())
        return 'IN';
    return normalizeCountryCode(raw);
}
// Builds the full hreflang map (including x-default) for a given relative
// path, e.g. languageAlternates('/jobs') ->
// { 'x-default': BASE_URL+'/jobs', en: BASE_URL+'/jobs', es: BASE_URL+'/es/jobs', ... }.
// Every locale in i18n/config.ts is served at BASE_URL/{locale}{path} via the
// middleware rewrite, so every indexable page should point to all nine
// variants here — not just the homepage — or Google has no way to know the
// other-language URLs exist.
export function languageAlternates(path: string): Record<string, string> {
    // {} while HREFLANG_ENABLED is false (see lib/hreflang.ts): Next renders no
    // <link rel="alternate" hreflang> tags for an empty map.
    return Object.fromEntries(hreflangLinks(path).map((l) => [l.lang, l.href]));
}
export function faqSchema(faqs: {
    question: string;
    answer: string;
}[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };
}
export function howToSchema(params: {
    name: string;
    description: string;
    steps: {
        name: string;
        text: string;
    }[];
    totalTimeMinutes?: number;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: params.name,
        description: params.description,
        ...(params.totalTimeMinutes
            ? { totalTime: `PT${params.totalTimeMinutes}M` }
            : {}),
        step: params.steps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.name,
            text: step.text,
        })),
    };
}
export function softwareApplicationSchema(params: {
    name: string;
    description: string;
    url: string;
    category?: string;
    ratingValue?: number;
    ratingCount?: number;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: params.name,
        description: params.description,
        url: params.url,
        applicationCategory: params.category ?? 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
        ...(params.ratingValue
            ? {
                aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: params.ratingValue,
                    ratingCount: params.ratingCount ?? 1,
                },
            }
            : {}),
    };
}
export function eventSchema(params: {
    name: string;
    description?: string;
    url: string;
    startDate?: string;
    endDate?: string;
    isOnline: boolean;
    location?: string;
    country?: string;
    organizer?: string;
    imageUrl?: string;
}) {
    const schema: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: params.name,
        description: params.description || params.name,
        url: params.url,
        ...(params.startDate ? { startDate: params.startDate } : {}),
        ...(params.endDate ? { endDate: params.endDate } : {}),
        eventAttendanceMode: params.isOnline
            ? 'https://schema.org/OnlineEventAttendanceMode'
            : 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        ...(params.imageUrl ? { image: [params.imageUrl] } : {}),
        organizer: {
            '@type': 'Organization',
            name: params.organizer || ORG_NAME,
        },
    };
    if (params.isOnline) {
        schema.location = {
            '@type': 'VirtualLocation',
            url: params.url,
        };
    }
    else {
        schema.location = {
            '@type': 'Place',
            name: params.location || params.country || 'TBA',
            address: {
                '@type': 'PostalAddress',
                addressLocality: params.location,
                // ISO code or omitted -- never a free-text guess.
                ...(normalizeCountryCode(params.country) ? { addressCountry: normalizeCountryCode(params.country) } : {}),
            },
        };
    }
    return schema;
}
// Currency detection for scraped pay strings ("USD 50000-80000", "₹8 LPA", "€45k", ...).
// Returns null when nothing identifies the currency.
const CURRENCY_PATTERNS: [RegExp, string][] = [
    [/₹|\bINR\b|\bRs\.?(?=\s*\d)|\blpa\b|\blakhs?\b|\blacs?\b/i, 'INR'],
    [/\bUSD\b|\bUS\$|\$/i, 'USD'],
    [/€|\bEUR\b/i, 'EUR'],
    [/£|\bGBP\b/i, 'GBP'],
    [/¥|\bJPY\b|\bYEN\b/i, 'JPY'],
    [/\bCAD\b/i, 'CAD'],
    [/\bAUD\b/i, 'AUD'],
    [/\bSGD\b/i, 'SGD'],
];
function detectCurrency(text: string): string | null {
    for (const [re, code] of CURRENCY_PATTERNS) {
        if (re.test(text)) return code;
    }
    return null;
}
function detectSalaryUnit(text: string): 'YEAR' | 'MONTH' | 'WEEK' | 'HOUR' | null {
    if (/\b(per\s+)?(year|annum|yr|annual(ly)?|p\.?a\.?)\b|\/\s*(yr|year)\b|\blpa\b/i.test(text)) return 'YEAR';
    if (/\b(per\s+)?month(ly)?\b|\/\s*(mo|month)\b|\bp\.?m\.?\b/i.test(text)) return 'MONTH';
    if (/\b(per\s+)?week(ly)?\b|\/\s*wk\b/i.test(text)) return 'WEEK';
    if (/\b(per\s+)?(hour|hr)(ly)?\b|\/\s*(hr|hour)\b/i.test(text)) return 'HOUR';
    return null;
}
// Pulls up to two amounts ("10-20", "50,000 - 80,000", "8 LPA", "45k") and applies
// k / lakh multipliers. Returns null when no usable number is present.
function parseSalaryAmounts(text: string): number[] | null {
    const isLakh = /\blpa\b|\blakhs?\b|\blacs?\b/i.test(text);
    const amounts: number[] = [];
    const re = /(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && amounts.length < 2) {
        let n = Number(m[1].replace(/,/g, ''));
        if (!Number.isFinite(n) || n <= 0) continue;
        if (m[2]) n *= 1000;
        else if (isLakh && n < 1000) n *= 100000;
        amounts.push(n);
    }
    return amounts.length ? amounts : null;
}
/**
 * JobPosting.baseSalary from a scraped pay string, or null when it can't be stated
 * correctly. Previously EVERY job was emitted as INR and only the first number was
 * read, so "USD 50000-80000" became 50000 INR, "€45k" became 45 INR, and "8 LPA"
 * became 8 INR/year - wrong figures in structured data. Now: the currency must be
 * identifiable (bare numbers are only assumed INR for Indian/unspecified-country
 * jobs), lakh/k multipliers are applied, ranges become min/max, and the pay period
 * must be stated (internship stipends default to monthly).
 */
export function salaryToBaseSalary(
    text: string | undefined | null,
    opts: { country?: string | null; isInternship?: boolean } = {},
): Record<string, any> | null {
    if (!text) return null;
    const amounts = parseSalaryAmounts(text);
    if (!amounts) return null;
    let currency = detectCurrency(text);
    if (!currency) {
        const country = (opts.country || '').trim().toLowerCase();
        const isIndian = country === '' || country === 'in' || country === 'india';
        if (!isIndian) return null;
        currency = 'INR';
    }
    let unit = detectSalaryUnit(text) ?? (opts.isInternship ? 'MONTH' : null);
    // Remote-feed strings like "USD 50000-80000" state no period; in these currencies a
    // figure that large is an annual salary, not a monthly one.
    if (!unit && ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'].includes(currency) && Math.max(...amounts) >= 20000) {
        unit = 'YEAR';
    }
    if (!unit) return null;
    const [first, second] = amounts;
    const value: Record<string, any> = { '@type': 'QuantitativeValue', unitText: unit };
    if (second !== undefined && second > first) {
        value.minValue = first;
        value.maxValue = second;
    } else {
        value.value = first;
    }
    return { '@type': 'MonetaryAmount', currency, value };
}
// Escapes characters that would let external content (e.g. a scraped job
// description containing a literal "</script>") break out of the <script>
// tag this gets embedded in via dangerouslySetInnerHTML. A broken-out script
// tag corrupts the rest of the page's HTML and makes the JSON-LD unparsable,
// which Google silently treats as an invalid/missing structured data item —
// this is the difference between a JobPosting counting in Search Console and
// silently not counting. Use this instead of a bare JSON.stringify() for any
// schema built from external/user-supplied text.
export function safeJsonLd(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
export function jobPostingSchema(job: Job, canonicalUrl: string) {
    const employmentType = /intern/i.test(job.type ?? '')
        ? 'INTERN'
        : /part.?time/i.test(job.type ?? '')
            ? 'PART_TIME'
            : /contract/i.test(job.type ?? '')
                ? 'CONTRACTOR'
                : 'FULL_TIME';
    const description = job.enriched_overview
        ? `${job.enriched_overview}\n\n${job.description || ''}`.trim()
        : job.description || `${job.title} at ${job.company}`;
    // Google requires datePosted. created_at is the true creation timestamp
    // (added to JOB_COLUMNS -- see jobs.py); posted_at is the source's own
    // stated date when we have it; last_seen_at ("when we first saw this
    // listing") is the last resort since it moves on every crawl and can
    // mislead Google about how fresh a listing actually is.
    const datePosted = job.posted_at || job.created_at || job.last_seen_at;
    // Google requires validThrough (or treats the posting as stale); fall back to
    // datePosted + 45 days, or 30 days out, when neither posted_at nor last_seen_at
    // is available.
    const validThrough = job.deadline
        ?? (datePosted
            ? new Date(new Date(datePosted).getTime() + 45 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    const schema: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: job.title,
        description,
        identifier: {
            '@type': 'PropertyValue',
            name: job.company,
            value: job.id,
        },
        // Omit rather than emit an empty/invalid datePosted when the source gave us
        // neither a posted date nor a last-seen timestamp.
        ...(datePosted ? { datePosted } : {}),
        validThrough,
        employmentType,
        hiringOrganization: {
            '@type': 'Organization',
            name: job.company,
            ...(job.apply_domain ? { sameAs: `https://${job.apply_domain}` } : {}),
            ...(job.logo_domain ? { logo: `https://www.google.com/s2/favicons?domain=${job.logo_domain}&sz=256` } : {}),
        },
        // These listings redirect off-site to the employer's own application flow rather
        // than accepting an application directly on this URL.
        directApply: false,
        url: canonicalUrl,
    };
    if (job.is_remote) {
        schema.jobLocationType = 'TELECOMMUTE';
        // 'Europe' / 'Worldwide' / a city string are not countries: omit the
        // requirement rather than assert one Google can't resolve. A blank
        // column keeps the site's long-standing India default.
        const remoteCountry = jobCountryCode(job.country);
        if (remoteCountry)
            schema.applicantLocationRequirements = { '@type': 'Country', name: remoteCountry };
    }
    else if (job.location) {
        schema.jobLocation = {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                addressLocality: job.location,
                ...(jobCountryCode(job.country) ? { addressCountry: jobCountryCode(job.country) } : {}),
            },
        };
    }
    else {
        // No city string and not remote — Google's Jobs rich result requires
        // jobLocation for non-TELECOMMUTE postings, so fall back to a
        // country-level Place rather than omitting the field (which is what
        // was producing the "Missing field jobLocation" validation error).
        schema.jobLocation = {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                ...(jobCountryCode(job.country) ? { addressCountry: jobCountryCode(job.country) } : {}),
            },
        };
    }
    // Structured breakdown fields (structured_enrichment.py) feed the
    // skills/education/experience properties Google's Jobs rich result
    // actually surfaces to searchers filtering by qualification — these
    // were previously only rendered in StructuredDetails.tsx (visible to
    // people) but never passed into the JobPosting schema (visible to
    // Google). A job with no structured breakdown yet simply omits these,
    // same optional-field pattern as the rest of this function.
    if (job.required_skills && job.required_skills.length > 0) {
        schema.skills = job.required_skills.join(', ');
    }
    const educationParts = [
        ...(job.allowed_degrees ?? []),
        ...(job.allowed_courses ?? []),
    ];
    if (educationParts.length > 0) {
        schema.educationRequirements = {
            '@type': 'EducationalOccupationalCredential',
            credentialCategory: educationParts.join(', '),
        };
    }
    if (typeof job.experience_min === 'number') {
        schema.experienceRequirements = {
            '@type': 'OccupationalExperienceRequirements',
            monthsOfExperience: Math.round(job.experience_min * 12),
        };
    }
    const baseSalary = salaryToBaseSalary(job.salary || job.stipend, {
        country: job.country,
        isInternship: employmentType === 'INTERN',
    });
    if (baseSalary) {
        schema.baseSalary = baseSalary;
    }
    return schema;
}
