// Module: app/components/CompanyLogo.tsx
// Defines component(s)/export(s): CompanyLogo
//
//

'use client';
import { useState } from 'react';
import Image from 'next/image';
import { companyInitial, companyColor } from '@/lib/avatar';
export default function CompanyLogo({ company, logoDomain, size = 44, }: {
    company?: string;
    logoDomain?: string;
    size?: number;
}) {
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
      <Image key={src} src={src} alt={company ? `${company} logo` : 'Company logo'} width={size} height={size} className="h-full w-full object-contain p-1.5" onError={() => setStage(stage === 'logoDev' ? 'favicon' : 'initials')}/>
    </div>);
}
