// Module: lib/skillMatch.ts
// Defines function(s): matchSkillSlug
//
// Matches a free-text skill/keyword to a known /skills/[slug] hub page,
// if one exists. Extracted out of app/components/JobDetail.tsx (where it
// was previously a local, unexported function) so other job-page
// components can link the same keywords instead of duplicating the match
// logic or rendering dead-end chips.

import { SKILLS } from '@/app/skills/data';

export function matchSkillSlug(keyword: string): string | null {
    const normalized = keyword.trim().toLowerCase();
    const found = SKILLS.find((s) => s.name.toLowerCase() === normalized ||
        s.searchTerm.toLowerCase() === normalized ||
        s.slug === normalized.replace(/[^a-z0-9]+/g, '-'));
    return found ? found.slug : null;
}
