// lib/logoDomain.ts
// Decides whether a domain can be used to look up a company's logo.
//
// Job boards and applicant-tracking hosts are NOT the employer: asking a favicon/logo
// service for "linkedin.com" returns LinkedIn's logo on every company whose listing
// was scraped from LinkedIn. A domain on this list is treated as "no logo domain" so
// the caller shows the letter avatar instead.
const NON_EMPLOYER_DOMAINS = [
    // job boards / aggregators (superset of AGGREGATOR_DOMAINS in crawler trust.py)
    'linkedin.com', 'indeed.com', 'glassdoor.com', 'naukri.com', 'internshala.com',
    'unstop.com', 'cutshort.in', 'freejobalert.com', 'remoteok.com', 'remoteok.io',
    'weworkremotely.com', 'remotive.com', 'wayup.com', 'hiring.cafe', 'jobicy.com',
    'arbeitnow.com', 'wellfound.com', 'angel.co', 'ycombinator.com', 'monster.com',
    'ziprecruiter.com', 'simplyhired.com', 'foundit.in', 'shine.com', 'apna.co',
    // applicant-tracking systems and form hosts (they serve many employers)
    'greenhouse.io', 'lever.co', 'myworkdayjobs.com', 'workday.com', 'ashbyhq.com',
    'smartrecruiters.com', 'icims.com', 'bamboohr.com', 'jobvite.com', 'breezy.hr',
    'recruitee.com', 'workable.com', 'taleo.net', 'successfactors.com', 'oraclecloud.com',
    'zohorecruit.com', 'darwinbox.in', 'keka.com', 'freshteam.com', 'pinpointhq.com',
    'forms.gle', 'docs.google.com', 'typeform.com', 'bit.ly', 'tinyurl.com',
    // social
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.me', 'whatsapp.com',
];

function normalise(domain: string): string {
    return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

/** Returns a clean domain safe to use for a logo lookup, or undefined when there isn't one. */
export function usableLogoDomain(domain?: string | null): string | undefined {
    if (!domain)
        return undefined;
    const d = normalise(domain);
    if (!d || !d.includes('.'))
        return undefined;
    const blocked = NON_EMPLOYER_DOMAINS.some((b) => d === b || d.endsWith(`.${b}`));
    return blocked ? undefined : d;
}
