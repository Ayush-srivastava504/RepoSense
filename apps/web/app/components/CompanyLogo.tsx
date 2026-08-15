'use client';

import { useState } from 'react';
import Image from 'next/image';
import { companyInitial, companyColor } from '@/lib/avatar';

/**
 * Real logo when we can resolve one, falling back to the deterministic
 * initial avatar otherwise — covers three cases:
 *  1. No apply_domain on the job at all (fall back immediately, no request).
 *  2. Clearbit has no logo for that domain (its endpoint 404s, onError fires).
 *  3. Everything works (common case for recognizable companies).
 *
 * Clearbit's logo endpoint is free, keyless, and needs no attribution —
 * fine for this volume. If that ever changes, swap the `src` below for
 * another provider; the fallback behavior doesn't need to change.
 */
export default function CompanyLogo({
  company,
  applyDomain,
  size = 44,
}: {
  company?: string;
  applyDomain?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const { bg, fg } = companyColor(company);

  if (!applyDomain || failed) {
    return (
      <div
        aria-hidden="true"
        className="flex flex-none items-center justify-center rounded-xl text-base font-semibold"
        style={{ background: bg, color: fg, width: size, height: size }}
      >
        {companyInitial(company)}
      </div>
    );
  }

  return (
    <div
      className="flex flex-none items-center justify-center overflow-hidden rounded-xl border"
      style={{ width: size, height: size, borderColor: 'var(--line)', background: '#fff' }}
    >
      <Image
        src={`https://logo.clearbit.com/${applyDomain}?size=128`}
        alt={company ? `${company} logo` : 'Company logo'}
        width={size}
        height={size}
        className="h-full w-full object-contain p-1.5"
        onError={() => setFailed(true)}
        unoptimized={false}
      />
    </div>
  );
}
