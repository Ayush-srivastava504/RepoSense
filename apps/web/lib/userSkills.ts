// lib/userSkills.ts Backs the "AI Job Match Score" feature (see lib/matchScore.ts and
// app/components/MatchScoreBadge.tsx). Stores a short, user-entered list of skills
// client-side so match scoring works instantly without forcing anyone through the full
// resume builder first. If the user later builds a resume, that flow can call

const STORAGE_KEY = 'reposense:user-skills:v1';
const EVENT_NAME = 'reposense:skills-changed';
function isBrowser() {
    return typeof window !== 'undefined';
}
export function getUserSkills(): string[] {
    if (!isBrowser())
        return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    }
    catch {
        return [];
    }
}
export function setUserSkills(skills: string[]) {
    if (!isBrowser())
        return;
    const cleaned = Array.from(new Set(skills
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase())));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
}
export function hasUserSkills(): boolean {
    return getUserSkills().length > 0;
}
export function subscribeUserSkills(callback: () => void): () => void {
    if (!isBrowser())
        return () => { };
    const handler = () => callback();
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
        window.removeEventListener(EVENT_NAME, handler);
        window.removeEventListener('storage', handler);
    };
}
