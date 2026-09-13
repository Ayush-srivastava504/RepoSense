// lib/structuredData.ts Reusable JSON-LD builders. Every function returns a plain object
// meant to be dropped straight into a <Script type="application/ld+json"> tag via
// JSON.stringify. Keeping these in one place means every page emits schema in the same
// shape, which is what Google's Rich Results tooling actually rewards.

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
// Builds the full hreflang map (including x-default) for a given relative
// path, e.g. languageAlternates('/jobs') ->
// { 'x-default': BASE_URL+'/jobs', en: BASE_URL+'/jobs', es: BASE_URL+'/es/jobs', ... }.
// Every locale in i18n/config.ts is served at BASE_URL/{locale}{path} via the
// middleware rewrite, so every indexable page should point to all nine
// variants here — not just the homepage — or Google has no way to know the
// other-language URLs exist.
export function languageAlternates(path: string): Record<string, string> {
    const clean = path === '/' ? '' : path;
    return {
        'x-default': `${BASE_URL}${clean}`,
        en: `${BASE_URL}${clean}`,
        es: `${BASE_URL}/es${clean}`,
        ja: `${BASE_URL}/ja${clean}`,
        fr: `${BASE_URL}/fr${clean}`,
        de: `${BASE_URL}/de${clean}`,
        pt: `${BASE_URL}/pt${clean}`,
        ko: `${BASE_URL}/ko${clean}`,
        it: `${BASE_URL}/it${clean}`,
        hi: `${BASE_URL}/hi${clean}`,
    };
}
// Job detail pages (jobs/remote-jobs/government-jobs/internships) were only
// setting title/description/canonical — no openGraph or twitter block at all —
// so every job link shared on WhatsApp/LinkedIn/Slack rendered the generic
// site card instead of the job itself. This builds a per-job OG/Twitter block
// so shares carry the actual title, company, and page URL.
export function jobOpenGraphMeta(params: {
    title: string;
    description: string;
    url: string;
    imageAlt: string;
}) {
    return {
        openGraph: {
            type: 'website' as const,
            url: params.url,
            title: params.title,
            description: params.description,
            images: [{ url: ORG_LOGO, width: 1200, height: 630, alt: params.imageAlt }],
        },
        twitter: {
            card: 'summary_large_image' as const,
            title: params.title,
            description: params.description,
            images: [ORG_LOGO],
        },
    };
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
                addressCountry: params.country,
            },
        };
    }
    return schema;
}
function parseFirstNumber(text: string): number | null {
    const match = text.replace(/,/g, '').match(/[\d.]+/);
    return match ? Number(match[0]) : null;
}
// The crawlers write whatever free-text string each source gives them into
// `country` — "India", "Japan", "Europe", "Worldwide", or (for several remote
// job sources) a raw city/region string like "Berlin, Germany" or "London, UK".
// Two fields in the JobPosting schema depend on turning that into a real
// country: `jobLocation.address.addressCountry`, which Google's structured-data
// docs require to be the two-letter ISO 3166-1 alpha-2 code (not a country
// name — this was silently failing rich-result validation for every
// non-Indian listing), and `baseSalary.currency`, which was hardcoded to INR
// regardless of where the job actually is. Both get fixed by resolving the
// country once and deriving iso/currency/display name from it.
const COUNTRY_LOOKUP: Record<string, {
    iso: string;
    currency: string;
    name: string;
}> = {
    india: { iso: 'IN', currency: 'INR', name: 'India' },
    japan: { iso: 'JP', currency: 'JPY', name: 'Japan' },
    'united states': { iso: 'US', currency: 'USD', name: 'United States' },
    usa: { iso: 'US', currency: 'USD', name: 'United States' },
    'united kingdom': { iso: 'GB', currency: 'GBP', name: 'United Kingdom' },
    uk: { iso: 'GB', currency: 'GBP', name: 'United Kingdom' },
    england: { iso: 'GB', currency: 'GBP', name: 'United Kingdom' },
    germany: { iso: 'DE', currency: 'EUR', name: 'Germany' },
    france: { iso: 'FR', currency: 'EUR', name: 'France' },
    netherlands: { iso: 'NL', currency: 'EUR', name: 'Netherlands' },
    spain: { iso: 'ES', currency: 'EUR', name: 'Spain' },
    italy: { iso: 'IT', currency: 'EUR', name: 'Italy' },
    portugal: { iso: 'PT', currency: 'EUR', name: 'Portugal' },
    ireland: { iso: 'IE', currency: 'EUR', name: 'Ireland' },
    poland: { iso: 'PL', currency: 'PLN', name: 'Poland' },
    sweden: { iso: 'SE', currency: 'SEK', name: 'Sweden' },
    switzerland: { iso: 'CH', currency: 'CHF', name: 'Switzerland' },
    canada: { iso: 'CA', currency: 'CAD', name: 'Canada' },
    australia: { iso: 'AU', currency: 'AUD', name: 'Australia' },
    singapore: { iso: 'SG', currency: 'SGD', name: 'Singapore' },
    'united arab emirates': { iso: 'AE', currency: 'AED', name: 'United Arab Emirates' },
    uae: { iso: 'AE', currency: 'AED', name: 'United Arab Emirates' },
};
// Region/placeholder values our own crawlers write instead of a real country —
// never pass these through as addressCountry, they'd fail ISO validation.
const NON_COUNTRY_VALUES = new Set(['europe', 'worldwide', 'remote', 'global']);
const DEFAULT_COUNTRY = COUNTRY_LOOKUP.india;
function resolveCountry(country?: string): {
    iso: string;
    currency: string;
    name: string;
} {
    const key = country?.trim().toLowerCase() ?? '';
    if (key && !NON_COUNTRY_VALUES.has(key)) {
        if (COUNTRY_LOOKUP[key])
            return COUNTRY_LOOKUP[key];
        // Substring match for messy values like "Berlin, Germany" that some
        // remote-job sources write straight into the country field.
        const match = Object.entries(COUNTRY_LOOKUP).find(([name]) => key.includes(name));
        if (match)
            return match[1];
    }
    // Default to the primary market rather than guessing on an unrecognized
    // value — this only affects the minority of listings we can't place.
    return DEFAULT_COUNTRY;
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
    // Google requires validThrough (or treats the posting as stale); fall back to
    // posted_at + 45 days, or 30 days out, when the source never gave us a deadline.
    const validThrough = job.deadline
        ?? (job.posted_at
            ? new Date(new Date(job.posted_at).getTime() + 45 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    // datePosted is a REQUIRED field for JobPosting rich results — if the source
    // never gave us posted_at, emitting `datePosted: undefined` drops the key
    // from the JSON entirely (JSON.stringify skips undefined), which is an
    // instant invalid-item in Search Console. Fall back to last_seen_at, then
    // "yesterday" (datePosted must be in the past), rather than omitting it.
    const datePosted = job.posted_at
        || job.last_seen_at
        || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { iso: countryIso, currency, name: countryName } = resolveCountry(job.country);
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
        datePosted,
        validThrough,
        employmentType,
        hiringOrganization: {
            '@type': 'Organization',
            name: job.company,
            ...(job.apply_domain ? { sameAs: `https://${job.apply_domain}` } : {}),
            logo: job.logo_domain
                ? `https://www.google.com/s2/favicons?domain=${job.logo_domain}&sz=256`
                : ORG_LOGO,
        },
        // These listings redirect off-site to the employer's own application flow rather
        // than accepting an application directly on this URL.
        directApply: false,
        url: canonicalUrl,
    };
    if (job.is_remote) {
        schema.jobLocationType = 'TELECOMMUTE';
        schema.applicantLocationRequirements = {
            '@type': 'Country',
            name: countryName,
        };
    }
    else if (job.location) {
        schema.jobLocation = {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                addressLocality: job.location,
                // Google's structured-data requirements for JobPosting specify the
                // two-letter ISO 3166-1 alpha-2 code here, not a country name.
                addressCountry: countryIso,
            },
        };
    }
    const compensationText = job.salary || job.stipend;
    const compensationValue = compensationText ? parseFirstNumber(compensationText) : null;
    if (compensationValue) {
        schema.baseSalary = {
            '@type': 'MonetaryAmount',
            currency,
            value: {
                '@type': 'QuantitativeValue',
                value: compensationValue,
                unitText: /year|annum|lpa/i.test(compensationText || '') ? 'YEAR' : 'MONTH',
            },
        };
    }
    return schema;
}
