// Module: app/components/CompanyLogo.tsx
// Defines component(s)/export(s): CompanyLogo
//
//

'use client';
import { useState } from 'react';
import Image from 'next/image';
import { companyInitial, companyColor } from '@/lib/avatar';
import { usableLogoDomain } from '@/lib/logoDomain';
// Google's favicon service answers 200 with a ~16px grey globe for domains it has no icon
// for, so onError never fires. Anything this small is a placeholder, not a logo.
const MIN_REAL_LOGO_PX = 32;
export default function CompanyLogo({ company, logoDomain: rawLogoDomain, size = 44, }: {
    company?: string;
    logoDomain?: string;
    size?: number;
}) {
    // Job boards / ATS hosts are not the employer -> letter avatar, never their logo.
    const logoDomain = usableLogoDomain(rawLogoDomain);
    const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
    const [stage, setStage] = useState<'logoDev' | 'favicon' | 'initials'>(logoDomain ? (logoDevToken ? 'logoDev' : 'favicon') : 'initials');
    const { bg, fg } = companyColor(company);
    if (stage === 'initials' || !logoDomain) {
        return (<div aria-hidden="true" className="flex flex-none items-center justify-center rounded-xl text-base font-semibold" style={{ background: bg, color: fg, width: size, height: size }}>
        {companyInitial(company)}
      </div>);
    }
    const src = stage === 'logoDev'
        ? `https://img.logo.dev/${logoDomain}?token=${logoDevToken}&size=128&retina=true&format=webp`
        : `https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128`;
    return (<div className="flex flex-none items-center justify-center overflow-hidden rounded-xl border" style={{ width: size, height: size, borderColor: 'var(--line)', background: '#fff' }}>
      <Image key={src} src={src} alt={company ? `${company} logo` : 'Company logo'} width={size} height={size} className="h-full w-full object-contain p-1.5" onError={() => setStage(stage === 'logoDev' ? 'favicon' : 'initials')} onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth > 0 && img.naturalWidth < MIN_REAL_LOGO_PX)
            setStage(stage === 'logoDev' ? 'favicon' : 'initials');
    }}/>
    </div>);
}
