import './globals.css';
import type { Metadata } from 'next';
import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google';
import { GoogleAnalytics } from '@next/third-parties/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  preload: false,
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  preload: false,
  display: 'swap',
});

const BASE_URL = 'https://intern-flow.in';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: 'InternFlow — AI Code Review & Internship Platform for Students',
    template: '%s | InternFlow',
  },

  description:
    'InternFlow helps B.Tech and engineering students land internships faster. Get AI-powered code reviews on your GitHub commits and generate ATS-ready resume bullets automatically.',

  keywords: [
    'internship platform India',
    'AI code review for students',
    'GitHub code review tool',
    'resume builder for engineers',
    'ATS resume generator',
    'internship finder India',
    'B.Tech internship',
    'software internship 2025',
    'AI resume builder',
    'code review tool',
  ],

  authors: [{ name: 'InternFlow', url: BASE_URL }],
  creator: 'InternFlow',
  publisher: 'InternFlow',

  alternates: {
    canonical: BASE_URL,
  },

  openGraph: {
    type: 'website',
    url: BASE_URL,
    siteName: 'InternFlow',
    title: 'InternFlow — AI Code Review & Internship Platform',
    description:
      'Connect your GitHub, get AI reviews on every commit, and turn your real work into a resume that gets you hired.',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'InternFlow — AI Code Review & Internship Platform',
      },
    ],
    locale: 'en_IN',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'InternFlow — AI Code Review & Internship Platform',
    description:
      'Connect your GitHub, get AI reviews on every commit, and turn your real work into a resume that gets you hired.',
    images: [`${BASE_URL}/og-image.png`],
    creator: '@internflow_in',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },

  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },

  manifest: '/site.webmanifest',
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'InternFlow',
  url: BASE_URL,
  logo: `${BASE_URL}/og-image.png`,
  sameAs: ['https://twitter.com/internflow_in'],
  description:
    'AI-powered platform that reviews student GitHub code and generates ATS-ready resumes.',
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'InternFlow',
  url: BASE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BASE_URL}/jobs?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {children}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}