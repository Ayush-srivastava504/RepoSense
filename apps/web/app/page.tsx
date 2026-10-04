// Module: app/page.tsx
// Defines component(s)/export(s): LandingPage

import type { Metadata } from 'next';
import AuthRedirect from '@/app/components/AuthRedirect';
import MultilingualLanding from '@/app/components/MultilingualLanding';
import { getFeaturedJobs, getJobs, BASE_URL } from '@/lib/jobs';
import { languageAlternates } from '@/lib/structuredData';

// SEO Metadata with international hreflang tags
export const metadata: Metadata = {
  title: { absolute: 'Fresher Jobs & Internships in India for B.Tech, BCA, MCA, MBA | InternFlow' },
  description: 'Find software engineer, data engineer, AI/ML and IT jobs and internships in India for B.Tech, BCA, MCA, B.Sc and MBA freshers. Updated daily, with a free ATS resume builder and cover letter tool.',
  alternates: {
    canonical: BASE_URL,
    languages: languageAlternates('/'),
  },
  openGraph: {
    title: 'Fresher Jobs & Internships in India — Software, Data & AI Roles',
    description: 'IT jobs and internships for B.Tech, BCA, MCA, B.Sc and MBA freshers in India, plus a free ATS resume builder and cover letter generator.',
    url: BASE_URL,
    siteName: 'InternFlow',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'InternFlow — AI Career Platform',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fresher Jobs & Internships in India | InternFlow',
    description: 'Software, data and AI jobs and internships for Indian freshers, plus free resume and ATS tools.',
    images: [`${BASE_URL}/og-image.png`],
  },
};

export default async function LandingPage() {
  const featured = await getFeaturedJobs({ limit: 6 });
  const previewJobs = featured.length > 0 ? featured : await getJobs({ sort: 'recent', limit: 6 });

  return (
    <>
      <AuthRedirect />
      <MultilingualLanding previewJobs={previewJobs} />
    </>
  );
}
