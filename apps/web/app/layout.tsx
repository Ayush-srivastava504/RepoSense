// Module: app/layout.tsx
// Defines component(s)/export(s): BASE_URL, RootLayout
//
//

import './globals.css';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { cookies, headers } from 'next/headers';
import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google';
import AppShell from './components/AppShell';
import { BASE_URL } from '@/lib/site';
import { i18n, type Locale } from '@/i18n/config';
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
export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: {
        default: 'InternFlow — High Paying Jobs, Remote Jobs & Internships + AI Resume Builder',
        template: '%s | InternFlow',
    },
    description: 'Find high paying jobs, remote jobs, government jobs, and internships, plus an ATS-friendly resume builder, cover letter generator, and AI GitHub code review.',
    keywords: [
        'high paying jobs',
        'remote jobs',
        'remote job opportunities',
        'part time remote job',
        'remote jobs hiring',
        'best remote jobs',
        'fully remote jobs',
        'remote government jobs',
        'jobs near me',
        'jobs hiring near me',
        'indeed jobs',
        'amazon jobs',
        'entry level jobs',
        'data entry jobs',
        'engineering jobs',
        'ai engineer jobs',
        'devops jobs',
        'remote devops jobs',
        'data engineer jobs',
        'data engineer salary',
        'aws data engineer certification',
        'cover letter templates',
        'cover letter example',
        'how to write a cover letter',
        'resume builder free',
        'ATS resume template',
        'ATS friendly resume',
        'resume generator',
        'software engineer intern',
        'marketing intern',
        'finance intern',
        'cybersecurity internships',
        'internships near me',
        'computer science internships',
        'data analyst internship',
        'star method for interviews',
        'common interview questions',
        'LinkedIn profile',
        'LinkedIn jobs',
        'internship platform India',
        'AI code review for students',
        'GitHub code review tool',
        'ATS resume generator',
        'B.Tech internship',
    ],
    authors: [{ name: 'InternFlow', url: BASE_URL }],
    creator: 'InternFlow',
    publisher: 'InternFlow',
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
        type: 'website',
        url: BASE_URL,
        siteName: 'InternFlow',
        title: 'InternFlow — High Paying Jobs, Remote Jobs & Internships + AI Resume Builder',
        description: 'High paying jobs, remote jobs, government jobs, and internships — plus an ATS-friendly resume builder, cover letter generator, and AI GitHub code review, all in one place.',
        images: [
            {
                url: `${BASE_URL}/og-image.png`,
                width: 1200,
                height: 630,
                alt: 'InternFlow — Jobs, Internships, Resume Builder & AI Code Review',
            },
        ],
        locale: 'en_IN',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'InternFlow — High Paying Jobs, Remote Jobs & Internships',
        description: 'High paying jobs, remote jobs, government jobs, and internships — plus an ATS-friendly resume builder, cover letter generator, and AI GitHub code review.',
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
            {
                url: '/favicon.ico',
            },
            {
                url: '/favicon-16x16.png',
                sizes: '16x16',
                type: 'image/png',
            },
            {
                url: '/favicon-32x32.png',
                sizes: '32x32',
                type: 'image/png',
            },
        ],
        apple: [
            {
                url: '/apple-touch-icon.png',
                sizes: '180x180',
            },
        ],
    },
    manifest: '/site.webmanifest',
};
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#ffffff',
};
const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'InternFlow',
    url: BASE_URL,
    logo: `${BASE_URL}/og-image.png`,
    sameAs: ['https://twitter.com/internflow_in'],
    description: 'AI-powered platform that reviews student GitHub code and generates ATS-ready resumes.',
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
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    // Same locale-detection pattern already used by app/blog/page.tsx and
    // app/blog/[slug]/page.tsx: x-locale (set by middleware.ts) first, then
    // the NEXT_LOCALE cookie it also sets (covers the header-propagation
    // edge cases), then 'en'.
    const headerLocale = headers().get('x-locale');
    const cookieLocale = cookies().get('NEXT_LOCALE')?.value;
    const candidate = headerLocale || cookieLocale || i18n.defaultLocale;
    const lang: Locale = (i18n.locales as readonly string[]).includes(candidate)
        ? (candidate as Locale)
        : i18n.defaultLocale;
    return (<html lang={lang}>
      
      <body className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} font-sans antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
        }}/>

        <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
        }}/>

        
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-2SC90HTR7G" strategy="afterInteractive"/>

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];

            function gtag() {
              dataLayer.push(arguments);
            }

            window.gtag = gtag;

            gtag('js', new Date());

            gtag('config', 'G-2SC90HTR7G', {
              page_path: window.location.pathname,
            });
          `}
        </Script>

        <AppShell>{children}</AppShell>
      </body>
    </html>);
}
