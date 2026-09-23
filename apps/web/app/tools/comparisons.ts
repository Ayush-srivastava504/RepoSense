// Module: app/tools/comparisons.ts
// Defines component(s)/export(s): COMPARISONS
// Defines function(s): getComparison, getComparisonsForTool, getComparisonParams
// Defines type(s): ComparisonRow, ToolComparison
//
// Same content-model-as-data-file approach as app/tools/data.ts: each
// /tools/[tool]/vs/[competitor] page is generated from one entry here rather
// than hand-written, so adding a new comparison is a data change, not a new
// page component.

import type { ToolFaq } from '@/app/tools/data';

export interface ComparisonRow {
    feature: string;
    internflow: string;
    competitor: string;
}

export interface ToolComparison {
    /** Must match a ToolDefinition.slug in app/tools/data.ts */
    toolSlug: string;
    /** URL segment: /tools/{toolSlug}/vs/{competitorSlug} */
    competitorSlug: string;
    competitorName: string;
    metaTitle: string;
    metaDescription: string;
    intro: string;
    rows: ComparisonRow[];
    /** Short, honest take on when each option actually fits better. */
    verdict: string;
    faqs: ToolFaq[];
}

export const COMPARISONS: ToolComparison[] = [
    {
        toolSlug: 'ats-resume-checker',
        competitorSlug: 'jobscan',
        competitorName: 'Jobscan',
        metaTitle: 'InternFlow vs Jobscan: Free ATS Resume Checker Comparison',
        metaDescription: 'Comparing InternFlow and Jobscan for ATS resume scoring — pricing, keyword matching, and which one fits student job applications better.',
        intro: 'Jobscan is one of the best-known ATS resume checkers, built for job seekers across every industry. InternFlow\'s ATS Resume Checker is built specifically for engineering students applying to Software Engineer, AI/ML, DevOps, Data Engineer, and Data Analyst roles.',
        rows: [
            { feature: 'Price', internflow: 'Free', competitor: 'Free scan limit, then paid plans' },
            { feature: 'Built for', internflow: 'Engineering students & new grads', competitor: 'General job seekers, all industries' },
            { feature: 'Role-specific keyword rules', internflow: 'Yes — 5 preset tech roles', competitor: 'Matches against a pasted job description' },
            { feature: 'Formatting checks', internflow: 'Tables, columns, images, section headers', competitor: 'Tables, columns, images, section headers' },
            { feature: 'Resume builder included', internflow: 'Yes, in the same account', competitor: 'No' },
        ],
        verdict: 'If you\'re a student applying to tech roles and want your resume checked, built, and matched to internships in one free workflow, InternFlow is the tighter fit. If you\'re scanning against a specific job posting outside tech, Jobscan\'s broader keyword matching may serve you better.',
        faqs: [
            { question: 'Is InternFlow\'s ATS checker really free?', answer: 'Yes, checking your resume against InternFlow\'s ATS rules is free for students, with no scan limit.' },
            { question: 'Does InternFlow work like Jobscan?', answer: 'Both flag formatting issues and keyword gaps, but InternFlow\'s checks are tuned to the five tech roles students apply to most, rather than a general-purpose scan.' },
        ],
    },
    {
        toolSlug: 'ats-resume-checker',
        competitorSlug: 'rezi',
        competitorName: 'Rezi',
        metaTitle: 'InternFlow vs Rezi: ATS Resume Checker Comparison',
        metaDescription: 'How InternFlow\'s free ATS Resume Checker compares to Rezi\'s AI resume scoring for students applying to software and engineering roles.',
        intro: 'Rezi bundles an ATS score into its resume-builder subscription. InternFlow gives students a free, standalone ATS check tuned to five specific engineering roles, with an optional resume builder alongside it.',
        rows: [
            { feature: 'Price', internflow: 'Free', competitor: 'Free trial, then subscription' },
            { feature: 'Standalone ATS check', internflow: 'Yes, no account lock-in required to see your score', competitor: 'Tied to the Rezi resume builder' },
            { feature: 'Role-specific keyword rules', internflow: 'Yes — 5 preset tech roles', competitor: 'General ATS keyword scoring' },
            { feature: 'GitHub-aware resume bullets', internflow: 'Yes, via the resume builder', competitor: 'No' },
        ],
        verdict: 'If you want an ATS score without committing to a subscription, or you specifically need tech-role keyword rules, InternFlow is the lower-friction option. Rezi\'s bundled builder can be worth it if you also want its wider template library.',
        faqs: [
            { question: 'Do I need to pay to see my ATS score on InternFlow?', answer: 'No, the ATS Resume Checker is free — you don\'t need a paid plan to see your score and fixes.' },
        ],
    },
    {
        toolSlug: 'resume-builder',
        competitorSlug: 'novoresume',
        competitorName: 'Novoresume',
        metaTitle: 'InternFlow vs Novoresume: AI Resume Builder Comparison',
        metaDescription: 'Comparing InternFlow and Novoresume for building an ATS-friendly resume as an engineering student, including pricing and GitHub import.',
        intro: 'Novoresume is a general-purpose resume builder with polished templates. InternFlow\'s Resume Builder is built around one specific problem: turning GitHub projects and coursework into resume bullets recruiters actually read.',
        rows: [
            { feature: 'Price', internflow: 'Free', competitor: 'Free tier, PDF export requires a paid plan' },
            { feature: 'GitHub project import', internflow: 'Yes, pulls repos automatically', competitor: 'No, manual entry only' },
            { feature: 'ATS-safe layout', internflow: 'Single-column by default', competitor: 'Some templates use multi-column layouts' },
            { feature: 'Template variety', internflow: 'One clean, ATS-safe template', competitor: 'Dozens of visual templates' },
        ],
        verdict: 'If your experience is mostly GitHub projects and coursework, InternFlow saves you the step of describing them yourself. If you want more visual template choice and don\'t mind manual entry, Novoresume has a wider design library.',
        faqs: [
            { question: 'Can I export a PDF for free on InternFlow?', answer: 'Yes, exporting your finished resume as a PDF is free.' },
        ],
    },
    {
        toolSlug: 'cover-letter-generator',
        competitorSlug: 'kickresume',
        competitorName: 'Kickresume',
        metaTitle: 'InternFlow vs Kickresume: AI Cover Letter Generator Comparison',
        metaDescription: 'How InternFlow\'s free AI cover letter generator compares to Kickresume for tailoring letters to a specific internship or job posting.',
        intro: 'Kickresume\'s cover letter tool is part of a broader resume-and-portfolio platform. InternFlow\'s Cover Letter Generator focuses on one input pair — your resume and the job description — to draft a short, specific letter.',
        rows: [
            { feature: 'Price', internflow: 'Free', competitor: 'Free trial, then subscription' },
            { feature: 'Pulls from your existing resume', internflow: 'Yes, automatically', competitor: 'Yes, if built on Kickresume' },
            { feature: 'Job-description matching', internflow: 'Yes, paste the posting directly', competitor: 'Yes' },
            { feature: 'Letter length', internflow: 'Kept short by default', competitor: 'Template-dependent' },
        ],
        verdict: 'InternFlow is the simpler choice if you just need a tailored letter fast and already have a resume on the platform. Kickresume can make sense if you also want its portfolio-website builder in the same subscription.',
        faqs: [
            { question: 'Do I need an InternFlow resume to generate a cover letter?', answer: 'Linking your resume gives better results, but you can also paste in your experience directly.' },
        ],
    },
    {
        toolSlug: 'github-readme-generator',
        competitorSlug: 'readme-so',
        competitorName: 'readme.so',
        metaTitle: 'InternFlow vs readme.so: GitHub README Generator Comparison',
        metaDescription: 'Comparing InternFlow\'s AI GitHub README generator to readme.so\'s template editor for student and open-source projects.',
        intro: 'readme.so is a manual drag-and-drop README template editor. InternFlow reads your actual repository — commits, file structure, and code — and writes the README for you.',
        rows: [
            { feature: 'Price', internflow: 'Free', competitor: 'Free' },
            { feature: 'Reads your actual code', internflow: 'Yes, via GitHub OAuth', competitor: 'No, you fill in every section manually' },
            { feature: 'Tech-stack detection', internflow: 'Automatic', competitor: 'Manual (badge picker)' },
            { feature: 'Setup instructions', internflow: 'Generated from your project', competitor: 'Written by you' },
        ],
        verdict: 'If you want a README written from your repo\'s actual contents, InternFlow does that in one step. If you\'d rather hand-pick every section and badge yourself, readme.so\'s editor gives you more manual control.',
        faqs: [
            { question: 'Does InternFlow work on private repositories?', answer: 'Yes, as long as you authorize InternFlow to read that repository through GitHub OAuth.' },
        ],
    },
];

export function getComparison(toolSlug: string, competitorSlug: string): ToolComparison | undefined {
    return COMPARISONS.find((c) => c.toolSlug === toolSlug && c.competitorSlug === competitorSlug);
}

export function getComparisonsForTool(toolSlug: string): ToolComparison[] {
    return COMPARISONS.filter((c) => c.toolSlug === toolSlug);
}

export function getComparisonParams(): { tool: string; competitor: string }[] {
    return COMPARISONS.map((c) => ({ tool: c.toolSlug, competitor: c.competitorSlug }));
}
