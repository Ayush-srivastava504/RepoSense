// Module: app/components/SkillsPrompt.tsx
// Defines component(s)/export(s): SkillsPrompt
//
//

'use client';
import { useState } from 'react';
import { getUserSkills, setUserSkills } from '@/lib/userSkills';
import { trackEvent } from '@/lib/analytics';
export default function SkillsPrompt({ onSaved, compact = false, }: {
    onSaved?: () => void;
    compact?: boolean;
}) {
    const [value, setValue] = useState(() => getUserSkills().join(', '));
    const [open, setOpen] = useState(!compact);
    const save = () => {
        const skills = value.split(',').map((s) => s.trim()).filter(Boolean);
        setUserSkills(skills);
        trackEvent('match_score_skills_saved', { skill_count: skills.length });
        setOpen(false);
        onSaved?.();
    };
    if (compact && !open) {
        return (<button type="button" onClick={() => setOpen(true)} className="text-xs font-medium underline underline-offset-2" style={{ color: 'var(--indigo)' }}>
        Add your skills to see match scores →
      </button>);
    }
    return (<div className="panel flex flex-col gap-2 p-4">
      <label className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
        Your skills
      </label>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Comma-separated (e.g. React, Python, SQL, Figma). Used only in this
        browser to score how well jobs match you — nothing is uploaded.
      </p>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={2} placeholder="React, Python, SQL, AWS, Figma..." className="w-full rounded-md p-2 text-sm" style={{
            border: '1px solid var(--line-strong)',
            background: 'transparent',
            color: 'var(--ink)',
        }}/>
      <div className="flex gap-2">
        <button type="button" onClick={save} className="btn btn-primary px-3 py-1.5 text-xs">
          Save skills
        </button>
        {compact && (<button type="button" onClick={() => setOpen(false)} className="btn px-3 py-1.5 text-xs">
            Cancel
          </button>)}
      </div>
    </div>);
}
