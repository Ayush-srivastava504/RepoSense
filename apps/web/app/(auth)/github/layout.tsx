// Module: app/(auth)/github/layout.tsx
//
// This page is a client component, so it cannot export `metadata` itself. Without a
// layout it inherited the ROOT layout's canonical (the homepage) plus the homepage
// title/description, telling Google every tool page is a duplicate of `/`.

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';

export const metadata: Metadata = {
    title: 'AI GitHub Code Review for Students & Early-Career Engineers',
    description: 'Connect your GitHub account and get an AI review of your repositories: code quality issues, suggested fixes, and portfolio-ready feedback.',
    alternates: { canonical: `${BASE_URL}/github` },
    openGraph: {
        type: 'website',
        url: `${BASE_URL}/github`,
        title: 'AI GitHub Code Review for Students & Early-Career Engineers',
        description: 'Connect your GitHub account and get an AI review of your repositories: code quality issues, suggested fixes, and portfolio-ready feedback.',
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
