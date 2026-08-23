'use client';

import { useEffect, useState } from 'react';
import { getUserSkills, subscribeUserSkills } from '@/lib/userSkills';
import { computeMatchScore, matchLabel, matchChipClass } from '@/lib/matchScore';
import type { Job } from '@/lib/jobs';
import SkillsPrompt from './SkillsPrompt';

/**
 * Shows an "82% match" style chip on a job card/detail page, computed
 * against the skills the user entered via SkillsPrompt. Renders nothing
 * (well — a subtle CTA) until skills are set, so it never feels like a
 * broken/empty feature for first-time visitors.
 */
export default function MatchScoreBadge({
  job,
  variant = 'compact',
}: {
  job: Job;
  variant?: 'compact' | 'detailed';
}) {
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    setSkills(getUserSkills());
    return subscribeUserSkills(() => setSkills(getUserSkills()));
  }, []);

  if (!skills.length) {
    if (variant !== 'detailed') return null;
    return <SkillsPrompt compact />;
  }

  const { score, matched, missing } = computeMatchScore(skills, job);
  const label = matchLabel(score);
  const chipClass = matchChipClass(score);

  if (variant === 'compact') {
    return (
      <span className={`chip ${chipClass} text-[11px] font-semibold`}>
        {score}% match
      </span>
    );
  }

  return (
    <div className="panel flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className={`chip ${chipClass} text-sm font-semibold`}>
          {score}% match — {label}
        </span>
      </div>
      {matched.length > 0 && (
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            Skills that match
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {matched.map((s) => (
              <span key={s} className="chip chip-green text-[11px] capitalize">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
            Not mentioned in this listing
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {missing.map((s) => (
              <span key={s} className="chip chip-muted text-[11px] capitalize">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
