// Module: app/sitemap-skills.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL, getJobsOrThrow } from '@/lib/jobs';
import { sitemapOk, sitemapUnavailable } from '@/lib/sitemapResponse';
import { SKILLS } from '@/app/skills/data';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import { SKILL_MIN_JOBS, belowHubThreshold } from '@/lib/seo/hubThresholds';
export const dynamic = 'force-dynamic';
export async function GET() {
    // PHASE_PLAN.md Phase 3 item 2: a sitemap entry for a page that then
    // renders noindex (below SKILL_MIN_JOBS) is a conflicting signal — skip
    // it here the same way the hub page itself skips indexing. Mirrors the
    // per-skill job/internship fetch app/skills/[skill]/page.tsx's
    // generateMetadata makes, just run for every skill up front.
    // getJobsOrThrow: an API failure would otherwise count as 0 jobs and drop EVERY skill hub from the sitemap.
    let counts: number[];
    try {
        counts = await Promise.all(SKILLS.map(async (skill) => {
            const [jobs, internships] = await Promise.all([
                getJobsOrThrow({ skill: skill.searchTerm, type: undefined, limit: 9, sort: 'ranked' }),
                getJobsOrThrow({ skill: skill.searchTerm, type: 'internship', limit: 6, sort: 'ranked' }),
            ]);
            return jobs.length + internships.length;
        }));
    }
    catch (err) {
        return sitemapUnavailable('skills', err);
    }
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/skills`, changefreq: 'weekly', priority: 0.8 },
        ...SKILLS
            .filter((_, i) => !belowHubThreshold(counts[i], SKILL_MIN_JOBS))
            .map((skill) => ({
                loc: `${BASE_URL}/skills/${skill.slug}`,
                changefreq: 'daily' as const,
                priority: 0.7,
            })),
    ]);
    return sitemapOk(xml);
}
