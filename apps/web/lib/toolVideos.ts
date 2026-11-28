// Module: lib/toolVideos.ts
// Short screen recordings of each tool on the live site (public/videos/<slug>.mp4, poster at
// public/videos/<slug>.jpg, both 960x540), recorded with a made-up sample resume.
//
// Where they appear:
//  - Homepage: the hero plays HERO_VIDEO; the feature rows and the About section each play one more,
//    and the "more tools" cards show posters that link to each tool's page.
//  - /about plays ABOUT_VIDEO.
//  - Each tool's own page renders its recording with <ToolVideoGuide>, which also emits that page's
//    VideoObject. Google indexes a video only when it is the main content of its page, so the
//    VideoObject lives on the tool page rather than in a homepage list of ten.
import { BASE_URL } from '@/lib/site';

export interface ToolVideo {
    slug: string;
    title: string;
    body: string;
    href: string;
    /** Rounded video length in seconds, for VideoObject.duration. */
    seconds: number;
    /** Three short steps describing what the recording shows, rendered next to the video. */
    steps: [string, string, string];
}

export const TOOL_VIDEO_UPLOAD_DATE = '2026-11-26';

export const TOOL_VIDEOS: ToolVideo[] = [
    {
        slug: 'ats-checker', title: 'ATS resume checker', href: '/ats-checker', seconds: 18,
        body: 'Paste your resume, pick a role, and see your score and the keywords you are missing.',
        steps: ['Paste your resume text', 'Pick the role you are applying for', 'Fix the missing keywords and failed checks'],
    },
    {
        slug: 'resume-builder', title: 'Resume builder', href: '/resume/builder', seconds: 18,
        body: 'Fill in a clean, ATS-friendly template and watch the resume build as you type.',
        steps: ['Add education, projects and experience', 'Watch the one-page preview update as you type', 'Download a recruiter-readable PDF'],
    },
    {
        slug: 'cover-letter', title: 'Cover letter generator', href: '/cover-letter', seconds: 18,
        body: 'Add the company, the job post and your resume to get a first draft in seconds.',
        steps: ['Enter the company and paste the job post', 'Add your resume', 'Edit the draft and send it'],
    },
    {
        slug: 'linkedin', title: 'LinkedIn optimizer', href: '/linkedin', seconds: 18,
        body: 'Rewrite your headline and About section so recruiters searching for your skills find you.',
        steps: ['Paste your headline and About section', 'See which recruiter checks you miss', 'Copy the rewritten version'],
    },
    {
        slug: 'job-search', title: 'Job search', href: '/jobs', seconds: 18,
        body: 'Search live jobs and internships, with top companies and Big 4 listed first.',
        steps: ['Search by role, skill or company', 'Filter by city, batch or remote', 'Open a listing and apply on the company page'],
    },
    {
        slug: 'job-details', title: 'Job details and match score', href: '/jobs', seconds: 18,
        body: 'Every listing shows eligibility, skills, how to prepare and how well you match.',
        steps: ['Check eligibility and required skills', 'See your match score', 'Read how to prepare before you apply'],
    },
    {
        slug: 'tracker', title: 'Application tracker', href: '/tracker', seconds: 18,
        body: 'Save jobs with one tap and track them from saved to offer, deadlines included.',
        steps: ['Save a job with one tap', 'Move it from Applied to Interviewing to Offer', 'Get a reminder before the deadline'],
    },
    {
        slug: 'auto-apply', title: 'Auto-apply', href: '/auto-apply', seconds: 18,
        body: 'Upload your resume once, get matched to openings, and apply faster.',
        steps: ['Upload your resume once', 'Review the openings it matches', 'Apply to the ones you pick'],
    },
    {
        slug: 'coding-practice', title: 'Coding practice', href: '/leetcode', seconds: 18,
        body: 'Blind 75 to Top 250 problems, filtered by company, topic and difficulty.',
        steps: ['Pick Blind 75, Top 150 or Top 250', 'Filter by company, topic or difficulty', 'Track what you have solved'],
    },
    {
        slug: 'companies', title: 'Companies hiring', href: '/companies', seconds: 18,
        body: 'See who is hiring right now, with every open role and the hiring process.',
        steps: ['Browse companies with open roles', 'Open a company to see every listing', 'Read its hiring process before you apply'],
    },
];

export function getToolVideo(slug: string): ToolVideo {
    const v = TOOL_VIDEOS.find((t) => t.slug === slug);
    if (!v)
        throw new Error(`Unknown tool video: ${slug}`);
    return v;
}

/** The homepage hero recording. */
export const HERO_VIDEO = getToolVideo('job-search');
/** The recording in the homepage About section and on /about. */
export const ABOUT_VIDEO = getToolVideo('companies');

/** VideoObject for a page whose main content is this recording. */
export function videoObjectSchema(v: ToolVideo, pageUrl: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: `${v.title}: InternFlow walkthrough`,
        description: v.body,
        thumbnailUrl: `${BASE_URL}/videos/${v.slug}.jpg`,
        contentUrl: `${BASE_URL}/videos/${v.slug}.mp4`,
        url: pageUrl,
        uploadDate: TOOL_VIDEO_UPLOAD_DATE,
        duration: `PT${v.seconds}S`,
        publisher: { '@type': 'Organization', name: 'InternFlow', url: BASE_URL },
    };
}
