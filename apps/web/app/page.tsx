// Module: app/page.tsx
// Defines component(s)/export(s): LandingPage

import type { Metadata } from 'next';
import AuthRedirect from '@/app/components/AuthRedirect';
import MultilingualLanding from '@/app/components/MultilingualLanding';
import { getFeaturedJobs, getJobs, BASE_URL } from '@/lib/jobs';

// SEO Metadata with international hreflang tags
export const metadata: Metadata = {
  title: 'InternFlow — High Paying Jobs, Remote Jobs & Internships + AI Career Tools',
  description: 'Find high paying jobs, remote DevOps jobs, AI engineer roles, and internships. Free AI resume generator, cover letter templates, and ATS-friendly resume builder.',
  keywords: [
    'high paying jobs',
    'remote jobs',
    'ai engineer jobs',
    'devops jobs',
    'data engineer jobs',
    'resume builder free',
    'ATS friendly resume',
    'internships',
    'computer science internships',
    'cover letter generator',
  ],
  alternates: {
    canonical: BASE_URL,
    languages: {
      'x-default': BASE_URL,
      'en': BASE_URL,
      'es': `${BASE_URL}/es`,
      'ja': `${BASE_URL}/ja`,
      'fr': `${BASE_URL}/fr`,
      'de': `${BASE_URL}/de`,
      'pt': `${BASE_URL}/pt`,
      'ko': `${BASE_URL}/ko`,
      'it': `${BASE_URL}/it`,
      'hi': `${BASE_URL}/hi`,
    },
  },
  openGraph: {
    title: 'InternFlow — AI-Powered Career Platform for High Paying Jobs & Internships',
    description: 'Get AI code reviews, generate ATS-friendly resumes, and find high paying jobs, remote devops jobs, and internships. Free tools for students.',
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
    title: 'InternFlow — Find High Paying Jobs & Internships',
    description: 'AI-powered resume builder, cover letter templates, and job search platform for students.',
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
