```tsx
'use client';

import { useState } from 'react';

const MONETAG_DIRECT_LINK = 'https://omg10.com/4/11238266';

export default function SponsoredCard() {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  return (
    <div className="panel relative flex h-full flex-col p-4 sm:p-5 transition-all hover:-translate-y-1 hover:shadow-lg">
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-2 top-2 z-10 rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
        aria-label="Close sponsored card"
        title="Close this sponsored content"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <a
        href={MONETAG_DIRECT_LINK}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex h-full flex-col"
      >
        <div className="flex items-center justify-between">
          <p className="eyebrow eyebrow-accent text-xs sm:text-sm">
            // sponsored
          </p>

          <span className="chip chip-muted text-[10px] sm:text-[11px]">
            AD
          </span>
        </div>

        <h2
          className="display mt-3 sm:mt-4 text-base sm:text-lg font-medium leading-snug"
          style={{ color: 'var(--ink)' }}
        >
          Sponsored Opportunity
        </h2>

        <p
          className="mt-1 text-xs sm:text-sm"
          style={{ color: 'var(--ink-soft)' }}
        >
          InternFlow Partner
        </p>

        <p
          className="mt-3 sm:mt-4 flex-1 text-xs sm:text-sm leading-6 sm:leading-7"
          style={{ color: 'var(--ink-soft)' }}
        >
          Explore a sponsored offer selected for InternFlow visitors.
        </p>

        <span className="mt-4 sm:mt-5 text-xs sm:text-sm font-medium">
          View Sponsored Offer →
        </span>
      </a>
    </div>
  );
}
```
