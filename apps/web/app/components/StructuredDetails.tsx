// Module: app/components/StructuredDetails.tsx
// Defines component(s)/export(s): StructuredDetails
//
// Renders the structured job-detail breakdown (Education / Key Skills /
// Notes) populated by crawler/src/structured_enrichment.py. Every field
// is optional — a job that hasn't been through structured enrichment yet
// (or where extraction found nothing worth surfacing) renders nothing
// here at all, falling back to the plain description block that always
// renders below this component.

import type { Job } from '@/lib/jobs';

const DEGREE_LABELS: Record<string, string> = {
    TENTH: '10th',
    INTER: '12th / Intermediate',
    DIPLOMA: 'Diploma',
    DEGREE: "Bachelor's degree",
    PG: "Postgraduate",
};

export default function StructuredDetails({ job }: { job: Job }) {
    const hasEducation = (job.allowed_degrees && job.allowed_degrees.length > 0) ||
        (job.allowed_courses && job.allowed_courses.length > 0) ||
        (job.allowed_specializations && job.allowed_specializations.length > 0) ||
        (job.allowed_passout_years && job.allowed_passout_years.length > 0);
    const hasSkills = job.required_skills && job.required_skills.length > 0;
    const hasNotes = Boolean(job.notes_highlights);
    const hasExperience = typeof job.experience_max === 'number' && job.experience_max > 0;

    if (!hasEducation && !hasSkills && !hasNotes && !hasExperience && !job.work_mode && !job.job_function) {
        return null;
    }

    return (<div className="panel mt-5 flex flex-col gap-4 p-4 text-sm">
      {hasEducation && (<div>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Education
          </h3>
          <ul className="mt-1.5 space-y-1" style={{ color: 'var(--ink)' }}>
            {job.allowed_passout_years && job.allowed_passout_years.length > 0 && (<li>
                <span style={{ color: 'var(--ink-soft)' }}>Batch:</span>{' '}
                {job.allowed_passout_years.join(', ')}
              </li>)}
            {job.allowed_degrees && job.allowed_degrees.length > 0 && (<li>
                <span style={{ color: 'var(--ink-soft)' }}>Level:</span>{' '}
                {job.allowed_degrees.map((d) => DEGREE_LABELS[d] || d).join(', ')}
              </li>)}
            {job.allowed_courses && job.allowed_courses.length > 0 && (<li>
                <span style={{ color: 'var(--ink-soft)' }}>Courses:</span>{' '}
                {job.allowed_courses.join(', ')}
              </li>)}
            {job.allowed_specializations && job.allowed_specializations.length > 0 && (<li>
                <span style={{ color: 'var(--ink-soft)' }}>Specializations:</span>{' '}
                {job.allowed_specializations.join(', ')}
              </li>)}
          </ul>
        </div>)}

      {(hasExperience || job.work_mode || job.job_function) && (<div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
          {job.job_function && <span>{job.job_function}</span>}
          {job.work_mode && <span>{job.work_mode.charAt(0) + job.work_mode.slice(1).toLowerCase()}</span>}
          {hasExperience && (<span>
              {job.experience_min === 0 ? 'Fresher-friendly' : `${job.experience_min}-${job.experience_max} yrs experience`}
            </span>)}
        </div>)}

      {hasSkills && (<div>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Key Skills
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {job.required_skills!.map((skill) => (<span key={skill} className="chip chip-muted text-[0.65rem]">
                {skill}
              </span>))}
          </div>
        </div>)}

      {hasNotes && (<div>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Notes
          </h3>
          <p className="mt-1.5" style={{ color: 'var(--ink)' }}>
            {job.notes_highlights}
          </p>
        </div>)}
    </div>);
}
