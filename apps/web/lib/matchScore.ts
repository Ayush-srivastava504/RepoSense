// lib/matchScore.ts Feature: AI Job Match Score ---------------------------- Every job board
// shows the same listings; what none of them show is how well a listing actually fits *you*.
// This computes a 0–100 match score between the user's skill list (lib/userSkills.ts) and a
// job, plus which skills matched and which are missing — surfaced as a badge on JobCard and

export interface MatchResult {
    score: number;
    matched: string[];
    missing: string[];
}
function normalize(text: string): string {
    return text.toLowerCase();
}
function skillAppearsIn(skill: string, haystack: string): boolean {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    return pattern.test(haystack);
}
export function computeMatchScore(userSkills: string[], job: {
    title?: string;
    description?: string;
    enriched_keywords?: string[];
}): MatchResult {
    if (!userSkills.length) {
        return { score: 0, matched: [], missing: [] };
    }
    const titleText = normalize(job.title || '');
    const keywordText = normalize((job.enriched_keywords || []).join(' '));
    const descriptionText = normalize(job.description || '');
    const matched: string[] = [];
    const missing: string[] = [];
    let weightedHits = 0;
    const maxWeight = 3;
    for (const skill of userSkills) {
        const inTitle = skillAppearsIn(skill, titleText);
        const inKeywords = skillAppearsIn(skill, keywordText);
        const inDescription = skillAppearsIn(skill, descriptionText);
        if (inTitle || inKeywords || inDescription) {
            matched.push(skill);
            weightedHits += inTitle || inKeywords ? maxWeight : 1;
        }
        else {
            missing.push(skill);
        }
    }
    const maxPossible = userSkills.length * maxWeight;
    const score = Math.round((weightedHits / maxPossible) * 100);
    return { score: Math.min(100, score), matched, missing };
}
export function matchLabel(score: number): string {
    if (score >= 75)
        return 'Strong match';
    if (score >= 45)
        return 'Good match';
    if (score >= 20)
        return 'Partial match';
    return 'Low match';
}
export function matchChipClass(score: number): string {
    if (score >= 75)
        return 'chip-green';
    if (score >= 45)
        return 'chip-indigo';
    if (score >= 20)
        return 'chip-muted';
    return 'chip-rust';
}
