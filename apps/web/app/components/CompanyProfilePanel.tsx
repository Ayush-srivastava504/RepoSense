// Module: app/components/CompanyProfilePanel.tsx
// Defines component(s)/export(s): CompanyProfilePanel
//
// Renders the fact-only company profile built by
// services/api/src/services/company_facts_service.py (GET
// /api/companies/{company}/profile). Every number here is an aggregate over
// the company's own currently-listed jobs; nothing is guessed. The API
// already withholds a profile (404) when there aren't enough substantive
// facts to say anything real, so this component just renders what it's
// given — a null `profile` prop (fetch failed, or no profile exists yet)
// renders nothing, same as StructuredDetails.tsx does for jobs.

import type { CompanyProfile } from '@/lib/companies';

const WORK_MODE_LABELS: Record<string, string> = {
    ONSITE: 'On-site',
    REMOTE: 'Remote',
    HYBRID: 'Hybrid',
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CompanyProfilePanel({ profile }: { profile: CompanyProfile | null }) {
    if (!profile || !profile.overview)
        return null;

    const { facts } = profile;
    const workModeEntries = Object.entries(facts.work_modes || {}).filter(([, n]) => n > 0);
    const hasLocations = facts.locations && facts.locations.length > 0;
    const hasFunctions = facts.job_functions && facts.job_functions.length > 0;
    const hasSkills = facts.skills && facts.skills.length > 0;
    const hasCourses = facts.courses && facts.courses.length > 0;
    const hasExperience = facts.experience !== null;

    return (<section className="panel mt-6 flex flex-col gap-4 p-5 text-sm">
      <div>
        <h2 className="display text-lg font-medium">About {profile.company}</h2>
        <p className="mt-2 leading-relaxed" style={{ color: 'var(--ink)' }}>{profile.overview}</p>
      </div>

      {(hasLocations || workModeEntries.length > 0 || hasFunctions) && (<div className="grid gap-4 sm:grid-cols-3">
          {hasLocations && (<div>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Locations</h3>
              <ul className="mt-1.5 space-y-0.5" style={{ color: 'var(--ink)' }}>
                {facts.locations.map((l) => (<li key={l.name}>{l.name} <span style={{ color: 'var(--ink-soft)' }}>({l.count})</span></li>))}
              </ul>
            </div>)}
          {workModeEntries.length > 0 && (<div>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Work mode</h3>
              <ul className="mt-1.5 space-y-0.5" style={{ color: 'var(--ink)' }}>
                {workModeEntries.map(([mode, n]) => (<li key={mode}>{WORK_MODE_LABELS[mode] || mode} <span style={{ color: 'var(--ink-soft)' }}>({n})</span></li>))}
              </ul>
            </div>)}
          {hasFunctions && (<div>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Role families</h3>
              <ul className="mt-1.5 space-y-0.5" style={{ color: 'var(--ink)' }}>
                {facts.job_functions.map((f) => (<li key={f.name}>{f.name} <span style={{ color: 'var(--ink-soft)' }}>({f.count})</span></li>))}
              </ul>
            </div>)}
        </div>)}

      {hasSkills && (<div>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>Frequently listed skills</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {facts.skills.map((s) => (<span key={s.name} className="chip chip-muted text-[0.65rem]">{s.name} ({s.count})</span>))}
          </div>
        </div>)}

      {(hasCourses || hasExperience) && (<div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
          {hasCourses && <span>Courses: {facts.courses.map((c) => c.name).join(', ')}</span>}
          {hasExperience && facts.experience!.fresher_listings > 0 && (<span>{facts.experience!.fresher_listings} fresher-friendly listing{facts.experience!.fresher_listings === 1 ? '' : 's'}</span>)}
        </div>)}

      {facts.latest_posted && (<p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          As of {formatDate(facts.as_of)} — latest listing posted {formatDate(facts.latest_posted)}.
        </p>)}
    </section>);
}
