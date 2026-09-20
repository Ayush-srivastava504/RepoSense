// Module: app/(auth)/ats-checker/layout.tsx
//
// This page is a client component, so it cannot export `metadata` itself. Without a
// layout it inherited the ROOT layout's canonical (the homepage) plus the homepage
// title/description, telling Google every tool page is a duplicate of `/`.

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';

export const metadata: Metadata = {
    title: 'Free ATS Resume Checker — Score Your Resume Like an ATS',
    description: 'Check how applicant tracking systems read your resume. Get an ATS score, see keyword gaps, and fix them before you apply.',
    alternates: { canonical: `${BASE_URL}/ats-checker` },
    openGraph: {
        type: 'website',
        url: `${BASE_URL}/ats-checker`,
        title: 'Free ATS Resume Checker — Score Your Resume Like an ATS',
        description: 'Check how applicant tracking systems read your resume. Get an ATS score, see keyword gaps, and fix them before you apply.',
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
