// Module: lib/toolVideos.ts
// The homepage "see the tools in action" videos. Each is a real screen recording of the live tool
// (public/videos/<slug>.mp4, poster at public/videos/<slug>.jpg), recorded with a made-up sample resume.
export interface ToolVideo {
    slug: string;
    title: string;
    body: string;
    href: string;
    /** Rounded video length in seconds, for VideoObject.duration. */
    seconds: number;
}

export const TOOL_VIDEO_UPLOAD_DATE = '2026-11-26';

export const TOOL_VIDEOS: ToolVideo[] = [
    { slug: 'ats-checker', title: 'ATS resume checker', body: 'Paste your resume, pick a role, and see your score and the keywords you are missing.', href: '/ats-checker', seconds: 18 },
    { slug: 'resume-builder', title: 'Resume builder', body: 'Fill in a clean, ATS-friendly template and watch the resume build as you type.', href: '/resume/builder', seconds: 18 },
    { slug: 'cover-letter', title: 'Cover letter generator', body: 'Add the company, the job post and your resume to get a first draft in seconds.', href: '/cover-letter', seconds: 18 },
    { slug: 'linkedin', title: 'LinkedIn optimizer', body: 'Rewrite your headline and About section so recruiters searching for your skills find you.', href: '/linkedin', seconds: 18 },
    { slug: 'job-search', title: 'Job search', body: 'Search live jobs and internships, with top companies and Big 4 listed first.', href: '/jobs', seconds: 18 },
    { slug: 'job-details', title: 'Job details and match score', body: 'Every listing shows eligibility, skills, how to prepare and how well you match.', href: '/jobs', seconds: 18 },
    { slug: 'tracker', title: 'Application tracker', body: 'Save jobs with one tap and track them from saved to offer, deadlines included.', href: '/tracker', seconds: 18 },
    { slug: 'auto-apply', title: 'Auto-apply', body: 'Upload your resume once, get matched to openings, and apply faster.', href: '/auto-apply', seconds: 18 },
    { slug: 'coding-practice', title: 'Coding practice', body: 'Blind 75 to Top 250 problems, filtered by company, topic and difficulty.', href: '/leetcode', seconds: 18 },
    { slug: 'companies', title: 'Companies hiring', body: 'See who is hiring right now, with every open role and the hiring process.', href: '/companies', seconds: 18 },
];
