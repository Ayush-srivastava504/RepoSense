// Module: app/(auth)/cover-letter/layout.tsx
//
// This page is a client component, so it cannot export `metadata` itself. Without a
// layout it inherited the ROOT layout's canonical (the homepage) plus the homepage
// title/description, telling Google every tool page is a duplicate of `/`.

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';

export const metadata: Metadata = {
    title: 'AI Cover Letter Generator — Tailored to the Job',
    description: 'Generate a cover letter tailored to the specific job and your background instead of filling in a generic template.',
    alternates: { canonical: `${BASE_URL}/cover-letter` },
    openGraph: {
        type: 'website',
        url: `${BASE_URL}/cover-letter`,
        title: 'AI Cover Letter Generator — Tailored to the Job',
        description: 'Generate a cover letter tailored to the specific job and your background instead of filling in a generic template.',
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
