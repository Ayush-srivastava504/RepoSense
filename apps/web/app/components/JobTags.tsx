// Module: app/components/JobTags.tsx
// Defines component(s)/export(s): JobTags
//
// FresherFlow's job cards (see the "Trade Apprentice" / "Intern - AI
// Engineer" examples) show a dense, descriptive chip row per listing:
// work mode, eligible education, source ATS, and a handful of individual
// skill tags — not just a title/company/one-line-blurb card. RepoSense's
// crawler pipeline already extracts all of this into `required_skills`,
// `allowed_courses`, `allowed_degrees`, `work_mode`, and `job_function`
// via structured_enrichment.py, and the API now returns those columns
// (see routes/jobs.py JOB_COLUMNS) — this component is what actually
// turns that data into the same kind of rich chip row on our cards.
//
// `variant="card"` caps the total chip count so job list cards stay a
// consistent height; `variant="detail"` renders everything for the job
// detail page.

import type { Job } from '@/lib/jobs';

const SOURCE_LABELS: Record<string, string> = {
    ashby: 'Ashby',
    company_portals: 'Company Site',
    cutshort: 'Cutshort',
    devfolio: 'Devfolio',
    devpost: 'Devpost',
    employment_news: 'Employment News',
    europe_arbeitnow: 'Arbeitnow',
    europe_himalayas: 'Himalayas',
    europe_jobicy: 'Jobicy',
    europe_remoteok: 'Remote OK',
    europe_remotive: 'Remotive',
    europe_weworkremotely: 'We Work Remotely',
    freejobalert: 'FreeJobAlert',
    generic_boards: 'Job Board',
    greenhouse: 'Greenhouse',
    hackerearth: 'HackerEarth',
    himalayas: 'Himalayas',
    hiringcafe: 'Hiring Cafe',
    internshala: 'Internshala',
    japan_internships: 'Japan Internships',
    japan_jobs: 'Japan Jobs',
    lever: 'Lever',
    linkedin: 'LinkedIn',
    remoteok: 'Remote OK',
    remotive: 'Remotive',
    smartrecruiters: 'SmartRecruiters',
    unstop: 'Unstop',
    unstop_hackathons: 'Unstop',
    weworkremotely: 'We Work Remotely',
    workable: 'Workable',
};

const WORK_MODE_LABELS: Record<string, { label: string; icon: string }> = {
    ONSITE: { label: 'Onsite', icon: '🏢' },
    REMOTE: { label: 'Remote', icon: '🏠' },
    HYBRID: { label: 'Hybrid', icon: '🔀' },
};

const DEGREE_LABELS: Record<string, string> = {
    TENTH: '10th',
    INTER: '12th / Inter',
    DIPLOMA: 'Diploma',
    DEGREE: 'Any Graduate',
    PG: 'Postgraduate',
};

function sourceLabel(source?: string): string | null {
    if (!source)
        return null;
    return SOURCE_LABELS[source] || source.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function educationLabel(job: Job): string | null {
    if (job.allowed_courses && job.allowed_courses.length > 0) {
        return job.allowed_courses.slice(0, 3).join(', ');
    }
    if (job.allowed_degrees && job.allowed_degrees.length > 0) {
        const labels = job.allowed_degrees.map((d) => DEGREE_LABELS[d] || d);
        return labels.slice(0, 2).join(', ');
    }
    return null;
}

export default function JobTags({ job, variant = 'card', className = '', }: {
    job: Job;
    variant?: 'card' | 'detail';
    className?: string;
}) {
    const skillCap = variant === 'detail' ? job.required_skills?.length ?? 0 : 4;
    const source = sourceLabel(job.source);
    const workMode = job.work_mode ? WORK_MODE_LABELS[job.work_mode] : undefined;
    const education = educationLabel(job);
    const skills = (job.required_skills || []).slice(0, skillCap);

    const hasAnyTag = Boolean(workMode || education || source || job.job_function || skills.length > 0);
    if (!hasAnyTag)
        return null;

    return (<div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {workMode && (<span className="chip chip-rust text-[11px]">
          {workMode.icon} {workMode.label}
        </span>)}

      {education && (<span className="chip chip-green text-[11px]">
          🎓 {education}
        </span>)}

      {source && (<span className="chip chip-purple text-[11px]">
          🔗 {source}
        </span>)}

      {job.job_function && (<span className="chip chip-indigo text-[11px]">
          {job.job_function}
        </span>)}

      {skills.map((skill) => (<span key={skill} className="chip chip-muted text-[11px]">
          # {skill}
        </span>))}

      {variant === 'card' && (job.required_skills?.length || 0) > skillCap && (<span className="chip chip-muted text-[11px]">
          +{(job.required_skills?.length || 0) - skillCap} more
        </span>)}
    </div>);
}
