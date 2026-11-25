// Module: app/page.tsx
// Defines component(s)/export(s): LandingPage

import type { Metadata } from 'next';
import AuthRedirect from '@/app/components/AuthRedirect';
import MultilingualLanding from '@/app/components/MultilingualLanding';
import { getFeaturedJobs, getJobs, BASE_URL } from '@/lib/jobs';
import { languageAlternates, safeJsonLd } from '@/lib/structuredData';
import { TOOL_VIDEOS, TOOL_VIDEO_UPLOAD_DATE } from '@/lib/toolVideos';

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

// One VideoObject per homepage tool recording, so the videos can appear in Google video results.
const toolVideosSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'InternFlow tools in action',
  itemListElement: TOOL_VIDEOS.map((v, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'VideoObject',
      name: `${v.title}: InternFlow walkthrough`,
      description: v.body,
      thumbnailUrl: `${BASE_URL}/videos/${v.slug}.jpg`,
      contentUrl: `${BASE_URL}/videos/${v.slug}.mp4`,
      uploadDate: TOOL_VIDEO_UPLOAD_DATE,
      duration: `PT${v.seconds}S`,
    },
  })),
};

export default async function LandingPage() {
  const featured = await getFeaturedJobs({ limit: 6 });
  const previewJobs = featured.length > 0 ? featured : await getJobs({ sort: 'recent', limit: 6 });

  return (
    <>
      <script id="tool-videos-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(toolVideosSchema) }} />
      <AuthRedirect />
      <MultilingualLanding previewJobs={previewJobs} />
    </>
  );
}
