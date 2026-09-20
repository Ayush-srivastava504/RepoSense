// Module: app/(auth)/linkedin/layout.tsx
//
// This page is a client component, so it cannot export `metadata` itself. Without a
// layout it inherited the ROOT layout's canonical (the homepage) plus the homepage
// title/description, telling Google every tool page is a duplicate of `/`.

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';

export const metadata: Metadata = {
    title: 'LinkedIn Profile Optimizer — Score & Rewrite Your Profile',
    description: 'Score your LinkedIn profile against 14 recruiter-relevant checks, then get an AI-rewritten headline, about section, and a prioritized list of fixes.',
    alternates: { canonical: `${BASE_URL}/linkedin` },
    openGraph: {
        type: 'website',
        url: `${BASE_URL}/linkedin`,
        title: 'LinkedIn Profile Optimizer — Score & Rewrite Your Profile',
        description: 'Score your LinkedIn profile against 14 recruiter-relevant checks, then get an AI-rewritten headline, about section, and a prioritized list of fixes.',
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
