// Module: app/(auth)/resume/builder/layout.tsx
//
// This page is a client component, so it cannot export `metadata` itself. Without a
// layout it inherited the ROOT layout's canonical (the homepage) plus the homepage
// title/description, telling Google every tool page is a duplicate of `/`.

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';
import ToolVideoGuide from '@/app/components/ToolVideoGuide';

export const metadata: Metadata = {
    title: 'ATS-Friendly Resume Builder for Students',
    description: 'Build an ATS-friendly resume with AI-assisted writing. Add your experience, education, and projects in a clean, recruiter-readable layout.',
    alternates: { canonical: `${BASE_URL}/resume/builder` },
    openGraph: {
        type: 'website',
        url: `${BASE_URL}/resume/builder`,
        title: 'ATS-Friendly Resume Builder for Students & Early-Career Engineers',
        description: 'Build an ATS-friendly resume with AI-assisted writing. Add your experience, education, and projects in a clean, recruiter-readable layout.',
    },
};

// The tool UI renders client-side (nothing in the server HTML), so the server-rendered video guide
// below is what crawlers read first. The min-height reserves the tool's space so the guide does not
// jump down when the tool mounts.
export default function Layout({ children }: { children: React.ReactNode }) {
    return (<>
      <div className="min-h-[85vh]">{children}</div>
      <ToolVideoGuide slug="resume-builder" className="mx-auto mt-16 max-w-6xl"/>
    </>);
}
