// Module: app/(auth)/linkedin/layout.tsx
//
// This page is a client component, so it cannot export `metadata` itself. Without a
// layout it inherited the ROOT layout's canonical (the homepage) plus the homepage
// title/description, telling Google every tool page is a duplicate of `/`.

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';
import ToolVideoGuide from '@/app/components/ToolVideoGuide';

export const metadata: Metadata = {
    title: 'LinkedIn Profile Optimizer & Rewriter',
    description: 'Score your LinkedIn profile against 14 recruiter-relevant checks, then get an AI-rewritten headline, about section, and a prioritized list of fixes.',
    alternates: { canonical: `${BASE_URL}/linkedin` },
    openGraph: {
        type: 'website',
        url: `${BASE_URL}/linkedin`,
        title: 'LinkedIn Profile Optimizer — Score & Rewrite Your Profile',
        description: 'Score your LinkedIn profile against 14 recruiter-relevant checks, then get an AI-rewritten headline, about section, and a prioritized list of fixes.',
    },
};

// The tool UI renders client-side (nothing in the server HTML), so the server-rendered video guide
// below is what crawlers read first. The min-height reserves the tool's space so the guide does not
// jump down when the tool mounts.
export default function Layout({ children }: { children: React.ReactNode }) {
    return (<>
      <div className="min-h-[85vh]">{children}</div>
      <ToolVideoGuide slug="linkedin" className="mx-auto mt-16 max-w-6xl"/>
    </>);
}
