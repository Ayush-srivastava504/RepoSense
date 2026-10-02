// Module: lib/jobFaq.ts
// One source of truth for a job page's FAQ: the visible <JobFAQ/> and the FAQPage JSON-LD both call buildJobFaq(),
// so the markup always matches what a reader sees. Every answer is either built from fields the job really has
// (never filled in when the field is empty) or comes from the validator-grounded AI sections.
// table_only-tier jobs (low legitimacy) get no FAQ, same rule as before.
import type { Job } from './jobs';

export interface JobFaqItem {
    question: string;
    answer: string;
}

const DEGREE_LABELS: Record<string, string> = {
    TENTH: '10th pass',
    INTER: '12th / Intermediate',
    DIPLOMA: 'Diploma',
    DEGREE: "Bachelor's degree",
    PG: 'Postgraduate degree',
};
const MAX_FAQ = 8;

function list(values?: string[] | null): string {
    return (values ?? []).filter(Boolean).join(', ');
}

function factFaqs(job: Job): JobFaqItem[] {
    const out: JobFaqItem[] = [];
    const role = `${job.title} role at ${job.company}`;
    const degrees = (job.allowed_degrees ?? []).map((d) => DEGREE_LABELS[d] || d);
    const eligibility: string[] = [];
    if (degrees.length)
        eligibility.push(`The listing asks for ${list(degrees)}${job.allowed_courses?.length ? ` (${list(job.allowed_courses.slice(0, 6))})` : ''}`);
    else if (job.allowed_courses?.length)
        eligibility.push(`The listing names these courses: ${list(job.allowed_courses.slice(0, 6))}`);
    if (job.allowed_passout_years?.length)
        eligibility.push(`graduating batches ${list(job.allowed_passout_years.map(String))}`);
    if (typeof job.experience_max === 'number' && job.experience_max > 0)
        eligibility.push(`${job.experience_min ?? 0}-${job.experience_max} years of experience`);
    else if (job.experience_min === 0)
        eligibility.push('freshers are welcome');
    if (eligibility.length)
        out.push({ question: `Who can apply for the ${role}?`, answer: `${eligibility.join('; ')}.` });

    if (job.required_skills?.length)
        out.push({ question: `What skills does the ${job.title} role require?`, answer: `The listing highlights ${list(job.required_skills.slice(0, 10))}. Show each of these in a project or past role on your resume.` });

    const comp = job.stipend || job.salary;
    out.push({
        question: `What is the ${job.type === 'internship' ? 'stipend' : 'salary'} for this ${job.type === 'internship' ? 'internship' : 'role'}?`,
        answer: comp
            ? `${job.company} lists ${comp}. The final offer is confirmed by the company during hiring.`
            : `${job.company} has not stated compensation in the listing. Check the original posting or ask during the application process.`,
    });

    const mode = job.work_mode ? job.work_mode.toLowerCase() : job.is_remote ? 'remote' : null;
    if (mode || job.location)
        out.push({
            question: `Is the ${job.title} position remote, hybrid or onsite?`,
            answer: mode ? `The listing marks this role as ${mode}${job.location ? `, with ${job.location} as the location` : ''}.` : `The listing gives ${job.location} as the location and does not state a work mode.`,
        });

    out.push({
        question: 'What is the application deadline?',
        answer: job.deadline
            ? `Applications close on ${new Date(job.deadline).toISOString().slice(0, 10)}.`
            : `${job.company} has not listed a fixed deadline, so apply early in case the opening is filled.`,
    });

    out.push({
        question: `How do I apply for the ${job.title} role?`,
        answer: job.url
            ? `Use the Apply button on this page. It opens the original listing${job.apply_domain ? ` on ${job.apply_domain}` : ''}, where you submit your application with the company.`
            : 'Sign in and use the Apply button on this page to continue to the application.',
    });
    return out;
}

export function buildJobFaq(job: Job): JobFaqItem[] {
    if (job.content_tier === 'table_only')
        return [];
    const seen = new Set<string>();
    const merged: JobFaqItem[] = [];
    const ai = (job.enriched_sections?.faqs ?? []).map((f) => ({ question: f.q, answer: f.a }));
    // Fact-based answers lead (always correct for this job); AI answers add the role-specific ones.
    for (const item of [...factFaqs(job), ...ai]) {
        const key = item.question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (!item.answer.trim() || seen.has(key))
            continue;
        seen.add(key);
        merged.push(item);
    }
    return merged.slice(0, MAX_FAQ);
}
