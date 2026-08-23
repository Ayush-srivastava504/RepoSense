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
        datePosted: job.posted_at,
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
        schema.applicantLocationRequirements = {
            '@type': 'Country',
            name: job.country || 'IN',
        };
    }
    else if (job.location) {
        schema.jobLocation = {
            '@type': 'Place',
            address: {
                '@type': 'PostalAddress',
                addressLocality: job.location,
                addressCountry: job.country || 'IN',
            },
        };
    }
    const compensationText = job.salary || job.stipend;
    const compensationValue = compensationText ? parseFirstNumber(compensationText) : null;
    if (compensationValue) {
        schema.baseSalary = {
            '@type': 'MonetaryAmount',
            currency: 'INR',
            value: {
                '@type': 'QuantitativeValue',
                value: compensationValue,
                unitText: /year|annum|lpa/i.test(compensationText || '') ? 'YEAR' : 'MONTH',
            },
        };
    }
    return schema;
}
