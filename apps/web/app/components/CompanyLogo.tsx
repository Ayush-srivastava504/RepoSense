'use client';

import { useState } from 'react';
import Image from 'next/image';
import { companyInitial, companyColor } from '@/lib/avatar';

/**
 * Real company logo, in three tiers, falling back automatically at
 * each stage:
 *
 *  1. Logo.dev — the officially-recommended successor to Clearbit's
 *     Logo API (which was permanently shut down Dec 8, 2025; every
 *     logo.clearbit.com request has failed since). Best quality,
 *     50M+ companies, but needs a free publishable token — sign up
 *     at https://www.logo.dev/signup (2 minutes, 500K requests/month
 *     free) and set NEXT_PUBLIC_LOGO_DEV_TOKEN in your env. Safe to
 *     expose client-side — it's a publishable key, same model as a
 *     Stripe publishable key, not a secret.
 *  2. Google's favicon service — no signup, no key, works today.
 *     Lower resolution (favicon-sized, not a full logo mark) but a
 *     real fetched image rather than a generated placeholder, so
 *     it's the fallback while a Logo.dev token isn't configured yet,
 *     or for the rare domain Logo.dev doesn't have.
 *  3. The deterministic initial avatar — only when there's no
 *     logoDomain at all (e.g. an aggregator-sourced job with no known
 *     official domain — see processors/trust.py logo_domain), or when
 *     both image sources fail to load.
 */
export default function CompanyLogo({
  company,
  logoDomain,
  size = 44,
}: {
  company?: string;
  logoDomain?: string;
  size?: number;
}) {
  const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const [stage, setStage] = useState<'logoDev' | 'favicon' | 'initials'>(
    logoDomain ? (logoDevToken ? 'logoDev' : 'favicon') : 'initials',
  );

  const { bg, fg } = companyColor(company);

  if (stage === 'initials' || !logoDomain) {
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

  const src =
    stage === 'logoDev'
      ? `https://img.logo.dev/${logoDomain}?token=${logoDevToken}&size=128&retina=true&format=webp`
      : `https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128`;

  return (
    <div
      className="flex flex-none items-center justify-center overflow-hidden rounded-xl border"
      style={{ width: size, height: size, borderColor: 'var(--line)', background: '#fff' }}
    >
      <Image
        key={src}
        src={src}
        alt={company ? `${company} logo` : 'Company logo'}
        width={size}
        height={size}
        className="h-full w-full object-contain p-1.5"
        onError={() => setStage(stage === 'logoDev' ? 'favicon' : 'initials')}
      />
    </div>
  );
}
