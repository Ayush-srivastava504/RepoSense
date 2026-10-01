// Module: lib/content/toolGuides.ts
// Editorial content for the Tools section: the /tools hub guide (rendered by
// app/components/SectionGuide.tsx with section="tools"), the grouping of tools on the hub,
// and a short motto + notes block for each /tools/[slug] page.
//
// Editing rule: keep claims durable. No pricing, limits or competitor figures that go
// stale. Anything about how a tool stores data must match the code (the tracker and the
// skill list used by the match score live in localStorage; see lib/tracker.ts and
// lib/userSkills.ts).

import type { SectionGuideContent } from '@/lib/content/sectionGuides';

export const TOOLS_GUIDE: SectionGuideContent = {
    motto: 'Build it once. Aim it well. Track what you send.',
    heading: 'How to use these tools without wasting an evening',
    intro:
        'Eight tools can feel like eight chores. They are not meant to be used all at once. Each one does one job in the path from "I have some projects" to "I sent a good application and I know what happened to it". This guide shows the order that saves the most effort.',
    topics: [
        {
            title: 'The order that works',
            body: [
                'Start with your raw material: a resume and a GitHub profile you would be happy for a stranger to open. Then check the resume, tailor it to a listing, apply, and track what you sent.',
                'Skipping ahead is the usual mistake. A cover letter written on top of a weak resume just repeats the weakness more politely.',
            ],
            link: { href: '/tools/resume-builder', label: 'Start with the resume builder' },
        },
        {
            title: 'Let your projects do the talking',
            body: [
                'For a fresher, projects are the experience. The resume builder and the README generator both start from your repositories, so the quality of those repositories sets the ceiling. Clear commits, a working setup and a short description beat a long list of half-finished ones.',
                'Pick the two or three projects that fit the role you want and let the rest sit lower down or off the page.',
            ],
            link: { href: '/tools/github-readme-generator', label: 'See the README generator' },
        },
        {
            title: 'What an ATS score can and cannot tell you',
            body: [
                'An applicant tracking system is software that stores and sorts applications. A checker estimates how cleanly such software can read your file: sensible section headers, no layout that scrambles the text, and the keywords the role normally asks for.',
                'A good score removes technical reasons to be filtered. It does not decide whether a recruiter likes your work. Fix the formatting issues, then spend your remaining time on the content.',
            ],
            link: { href: '/tools/ats-resume-checker', label: 'About the ATS checker' },
        },
        {
            title: 'Treat AI drafts as drafts',
            body: [
                'The cover letter and LinkedIn tools give you a first version so you are not facing a blank page. Read it aloud, replace anything you would not actually say, and add one detail only you know, such as a bug you fixed or a decision you made.',
                'Recruiters read a lot of letters. The ones that feel written by a person are the ones that get remembered.',
            ],
            link: { href: '/tools/cover-letter-generator', label: 'About the cover letter tool' },
        },
        {
            title: 'Check the fit before you spend time',
            body: [
                'The job match score compares the skills you list with a listing and shows which ones matched and which are missing. Use it to decide where to spend your evening, not to talk yourself out of a role you could grow into.',
                'A missing skill is a to-do item. Two or three missing skills on a role you really want is a reason to learn them, not to skip it.',
            ],
            link: { href: '/tools/job-match-score', label: 'About the match score' },
        },
        {
            title: 'Track it, or you will forget it',
            body: [
                'Applications scatter across emails, portals and chat messages quickly. The tracker keeps them in one list with a status and a deadline, so a follow-up date does not slip past.',
                'It stores that list in your own browser rather than on an account. That keeps it private and needs no sign-up, but clearing your browser data will clear the list too.',
            ],
            link: { href: '/tools/application-tracker', label: 'Open the tracker page' },
        },
        {
            title: 'Automation: powerful, so be careful',
            body: [
                'The auto-apply engine can find listings and fill forms for you, and it has a dry-run mode that lets you see what would be submitted first. Use it, and read every filled field before anything goes out live.',
                'Some sites restrict automated submissions in their terms, and a form filled with the wrong detail costs more than a form filled slowly. Use it for the routine fields, and apply by hand to the roles you care most about.',
            ],
            link: { href: '/tools/auto-apply-engine', label: 'About the auto-apply engine' },
        },
    ],
    faqs: [
        {
            question: 'Which tool should I use first?',
            answer:
                'The resume builder if you do not have a resume yet, or the ATS checker if you do. Everything else, such as the cover letter, the match score and the tracker, works better once the resume is in good shape.',
        },
        {
            question: 'Do I need an account to use these tools?',
            answer:
                'It depends on the tool. The application tracker and the job match score work in your browser without sign-up. The README generator needs you to connect GitHub so it can read the repository. The other tools open for guests, and each tool page says what it needs.',
        },
        {
            question: 'Where is my data stored?',
            answer:
                'The tracker list and the skill list behind the match score are kept in your own browser, not uploaded. For tools that generate text from your resume or repository, such as the cover letter, LinkedIn and README tools, the content you give them is processed to produce the draft. Do not paste anything into any online tool that you would not want processed.',
        },
        {
            question: 'Will these tools get me an interview?',
            answer:
                'No tool can promise that. They remove avoidable problems, such as unreadable formatting, blank sections and generic letters, so a person can judge your actual work. The work itself still has to be good.',
        },
        {
            question: 'Can I send an AI-written cover letter or LinkedIn summary as it is?',
            answer:
                'You can, but you should not. Edit it so it sounds like you, check that every claim is true, and add one specific detail from your own work. A draft you have not read is a risk, because you are the one answering questions about it in the interview.',
        },
        {
            question: 'Is it safe to use the auto-apply engine on every job?',
            answer:
                'Treat it as a helper for routine fields, not as a way to send hundreds of applications. Use the dry-run preview, review what was filled, and apply manually where the role matters to you. Some sites limit automated submissions, so read the rules of any portal you use it on.',
        },
        {
            question: 'How are the tools different from other resume and ATS sites?',
            answer:
                'They are built around engineering students: roles such as software, AI/ML, DevOps and data, resumes that start from GitHub projects, and a link to live job and internship listings. Each tool page has comparison pages that go through the differences with specific alternatives.',
        },
    ],
    related: [
        { href: '/jobs', label: 'Browse jobs', note: 'Put your resume to work on live roles.' },
        { href: '/internships', label: 'Browse internships', note: 'Good first targets for a fresh resume.' },
        { href: '/resume-for', label: 'Resume guides by role', note: 'Role-specific advice before you build.' },
        { href: '/careers', label: 'Career paths', note: 'Pick the direction your resume should point at.' },
        { href: '/leetcode', label: 'LeetCode practice', note: 'Prepare for the technical round.' },
        { href: '/blog', label: 'Blog', note: 'Longer guides on resumes, GitHub and interviews.' },
    ],
};

/** The hub groups tools by the stage of an application they help with. */
export interface ToolGroup {
    key: string;
    step: string;
    title: string;
    blurb: string;
    slugs: string[];
}

export const TOOL_GROUPS: ToolGroup[] = [
    {
        key: 'build',
        step: '01',
        title: 'Build your proof',
        blurb: 'Turn your projects and profile into something a stranger can read in a minute.',
        slugs: ['resume-builder', 'github-readme-generator', 'linkedin-optimizer'],
    },
    {
        key: 'check',
        step: '02',
        title: 'Check and tailor',
        blurb: 'Make sure software can read it, and that the letter and the listing actually fit.',
        slugs: ['ats-resume-checker', 'cover-letter-generator', 'job-match-score'],
    },
    {
        key: 'apply',
        step: '03',
        title: 'Apply and keep track',
        blurb: 'Send the applications, then remember what you sent and when to follow up.',
        slugs: ['auto-apply-engine', 'application-tracker'],
    },
];

/** Per-tool extras shown on /tools/[slug]: a motto, what to have ready, and a short note. */
export interface ToolNote {
    motto: string;
    prepare: string[];
    notes: string[];
}

export const TOOL_NOTES: Record<string, ToolNote> = {
    'auto-apply-engine': {
        motto: 'Let it do the typing. You do the judging.',
        prepare: [
            'A current PDF resume',
            'The roles and locations you are aiming for',
            'Time to review every filled field',
        ],
        notes: [
            'The engine saves time on the repetitive parts of an application: contact details, education and standard questions. It cannot know which roles you actually care about, so decide that first and keep the list short.',
            'Always run the dry-run preview before a live submission, and read the screenshots. A wrong phone number or a pasted answer to the wrong question is an easy mistake and a hard one to undo.',
        ],
    },
    'github-readme-generator': {
        motto: 'Your repo is a first impression. Make the README count.',
        prepare: [
            'A repository that runs, even if it is small',
            'A GitHub account to connect',
            'A screenshot or demo link, if you have one',
        ],
        notes: [
            'A recruiter or a reviewer often reads the README and nothing else. It should say what the project does, how to run it and what you built, in that order, within the first screen.',
            'Treat the generated text as a draft. Check that the setup steps really work on a clean machine and add the part only you know, such as why you chose a certain approach.',
        ],
    },
    'ats-resume-checker': {
        motto: 'Fix what the software cannot read, then fix what the person will not.',
        prepare: [
            'Your resume as a PDF or as text',
            'The role you are targeting',
            'A job description, if you want to compare keywords',
        ],
        notes: [
            'Use the score as a list of problems to fix, not as a grade to chase. Broken headers, text inside tables or images and missing sections are worth fixing. Stuffing keywords you cannot back up is not.',
            'Re-run the check after each round of changes, but stop when the issues are gone. A resume tuned for a score alone usually reads worse to the human who comes next.',
        ],
    },
    'resume-builder': {
        motto: 'One page. Your best work first. No decoration.',
        prepare: [
            'Your education details and dates',
            'Two or three projects you can talk about for five minutes',
            'The role you want the resume to point at',
        ],
        notes: [
            'Write a version for the role you want most, not a version for everyone. If you apply to different kinds of roles, save a separate version for each and change the order of your projects and skills.',
            'Every bullet should say what you did and what came of it. If you cannot put a real number on it, a plain, specific sentence is better than an invented figure.',
        ],
    },
    'linkedin-optimizer': {
        motto: 'Be easy to find, and easy to believe.',
        prepare: [
            'Your target role and a second-choice role',
            'Your current headline and About text',
            'Your resume, so the two match',
        ],
        notes: [
            'Recruiters search by role and skill, so the headline matters more than any other line. Say what you are and what you want to do, in words someone would actually type into a search box.',
            'Keep the profile and the resume telling the same story. A mismatch in dates or projects is the kind of detail a careful reader notices.',
        ],
    },
    'cover-letter-generator': {
        motto: 'Short, specific, and written to one reader.',
        prepare: [
            'The full job description',
            'Your resume text',
            'One detail from your own work that fits the role',
        ],
        notes: [
            'A cover letter has one task: to give a reason why you and this role belong together. Three short paragraphs are enough, and the first one should name the role and why it interests you.',
            'Before you send, delete any sentence that could be pasted into a letter for a different company. What remains is usually the part worth reading.',
        ],
    },
    'application-tracker': {
        motto: 'If it is not written down, it did not happen.',
        prepare: [
            'Nothing. It works without an account',
            'A habit of updating status after every action',
            'A note of when you plan to follow up',
        ],
        notes: [
            'Update the status the moment something changes, not at the end of the week. The point is to know at a glance what is waiting on you and what is waiting on them.',
            'The list lives in your browser, so use the same browser and device, and avoid clearing site data. If a particular application matters, keep a copy of the listing text as well.',
        ],
    },
    'job-match-score': {
        motto: 'Know the gap before you apply, not after.',
        prepare: [
            'A short list of your real skills',
            'A few listings you are considering',
            'A rough idea of what you are willing to learn',
        ],
        notes: [
            'List the skills you could talk about in an interview, not every tool you have opened once. A score built on honest input tells you something. A score built on an inflated list only flatters you.',
            'Use the missing skills as a study list. If the same gap shows up across several roles you like, that is the most useful thing the score can tell you.',
        ],
    },
};
