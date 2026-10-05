// Module: app/components/FooterHiring.tsx
// Server component: the sitewide footer "Hiring now" + "Fresh openings" link rows.
//
// Rendered from app/layout.tsx and handed to the (client) AppShell/Footer as a prop, because a client
// component cannot import an async server component directly. The data fetches use the same
// revalidate window as the rest of the site, so the lists refresh hourly and every page that shows
// the footer gets a fresh internal link to the newest jobs -- a crawl path for brand-new job URLs
// that Google has not discovered through the sitemap yet.
//
// Real <a> links with descriptive anchor text, no nofollow, no JS needed. On any API failure a row
// is simply left out rather than showing stale or placeholder links.

import Link from 'next/link';
import { getCompanies } from '@/lib/companies';
import { getJobs } from '@/lib/jobs';
import {
    companyHref,
    jobAnchorText,
    jobHref,
    pickFreshJobs,
    pickHiringCompanies,
} from '@/lib/footerHiring';

const labelStyle = { color: 'var(--ink)' } as const;
const linkStyle = { color: 'var(--ink-soft)' } as const;
const linkClass = 'underline underline-offset-2 transition hover:opacity-80';

function Sep() {
    return <span aria-hidden="true"> · </span>;
}

export default async function FooterHiring() {
    const [companiesRes, recentJobs] = await Promise.all([
        getCompanies(60),
        // Over-fetch: pickFreshJobs drops thin/stale jobs and keeps one per company.
        getJobs({ sort: 'recent', limit: 80, excludeGovernment: true }),
    ]);

    const companies = pickHiringCompanies([
        ...companiesRes.top.companies,
        ...companiesRes.mass_hire.companies,
        ...companiesRes.startup.companies,
    ]);
    const jobs = pickFreshJobs(recentJobs);

    if (companies.length === 0 && jobs.length === 0)
        return null;

    return (
        <div className="mt-5 space-y-4 text-[13px] leading-relaxed">
            {companies.length > 0 && (
                <nav aria-label="Companies hiring now">
                    <p style={linkStyle}>
                        <strong className="font-semibold" style={labelStyle}>Hiring now:</strong>{' '}
                        {companies.map((c, i) => (
                            <span key={c.company}>
                                {i > 0 && <Sep />}
                                <Link href={companyHref(c)} className={linkClass} style={linkStyle}>
                                    {c.company}
                                </Link>
                            </span>
                        ))}
                        <Sep />
                        <Link href="/companies" className={linkClass} style={labelStyle}>
                            All companies →
                        </Link>
                    </p>
                </nav>
            )}

            {jobs.length > 0 && (
                <nav aria-label="Fresh job openings">
                    <p style={linkStyle}>
                        <strong className="font-semibold" style={labelStyle}>Fresh openings:</strong>{' '}
                        {jobs.map((j, i) => (
                            <span key={j.id}>
                                {i > 0 && <Sep />}
                                <Link href={jobHref(j)} className={linkClass} style={linkStyle}>
                                    {jobAnchorText(j)}
                                </Link>
                            </span>
                        ))}
                        <Sep />
                        <Link href="/jobs" className={linkClass} style={labelStyle}>
                            All jobs →
                        </Link>
                    </p>
                </nav>
            )}
        </div>
    );
}
