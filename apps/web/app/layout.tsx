// Module: app/layout.tsx
// Defines component(s)/export(s): BASE_URL, RootLayout
//
//

import './globals.css';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google';
import AppShell from './components/AppShell';
import { BASE_URL } from '@/lib/site';
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
    // Fixed to 'en': reading headers()/cookies() here to flip <html lang>
    // forced every page under this layout into dynamic rendering. For
    // routes using generateStaticParams + dynamicParams: true (companies,
    // skills, blog, careers, tools, jobs-in, batch, resume-for), any param
    // NOT in the pre-rendered set then hit DYNAMIC_SERVER_USAGE mid-render
    // on an on-demand static pass -> 500 in production, instead of just
    // rendering. Locale coverage is thin anyway (162 translated strings,
    // 1/40 blog posts per the earlier audit), so this cosmetic attribute
    // wasn't worth mass 500s. If per-locale <html lang> is wanted later,
    // read it inside blog/[slug] specifically -- no static-param conflict
    // there -- rather than globally in the root layout.
    return (<html lang="en">
      
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
