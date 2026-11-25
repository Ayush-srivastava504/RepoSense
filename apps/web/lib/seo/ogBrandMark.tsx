// Module: lib/seo/ogBrandMark.tsx
// The InternFlow mark for next/og ImageResponse cards (satori renders inline <svg>). Same drawing as
// app/components/Logo.tsx and public/icon.svg.
export function OgBrandMark({ size = 40 }: { size?: number }) {
    return (<svg width={size} height={size} viewBox="0 0 48 48" style={{ marginRight: 14 }}>
      <rect width="48" height="48" rx="12" fill="#1F5C40"/>
      <circle cx="16" cy="13.2" r="3.7" fill="#E9C46A"/>
      <path d="M16 21.4V26.6C16 31.5 19.6 35 24.6 35H33" fill="none" stroke="#FFFFFF" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
}
