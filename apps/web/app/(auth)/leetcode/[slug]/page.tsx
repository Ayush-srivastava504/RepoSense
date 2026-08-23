// Module: app/(auth)/leetcode/[slug]/page.tsx
// Defines component(s)/export(s): API_BASE_URL, SolvePage
// Defines function(s): getProblem, truncate, generateMetadata
// Defines type(s): ProblemSummary

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/jobs';
import { breadcrumbSchema } from '@/lib/structuredData';
import SolveClient from './SolveClient';
const API_BASE_URL = process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';
interface ProblemSummary {
    slug: string;
    title: string;
    difficulty: string;
    description: string;
}
async function getProblem(slug: string): Promise<ProblemSummary | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/leetcode/problems/${encodeURIComponent(slug)}`, { next: { revalidate: 3600 } });
        if (!res.ok)
            return null;
        return (await res.json()) as ProblemSummary;
    }
    catch (err) {
        console.error('Failed to fetch leetcode problem for metadata:', err);
        return null;
    }
}
function truncate(text: string, max: number): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= max)
        return clean;
    return `${clean.slice(0, max - 1).trimEnd()}…`;
}
export async function generateMetadata({ params, }: {
    params: {
        slug: string;
    };
}): Promise<Metadata> {
    const problem = await getProblem(params.slug);
    if (!problem) {
        return {
            title: 'LeetCode Problem — Practice',
            alternates: {
                canonical: `${BASE_URL}/leetcode/${params.slug}`,
            },
        };
    }
    const title = `${problem.title} (${problem.difficulty}) — LeetCode Practice`;
    const description = `Solve "${problem.title}", a ${problem.difficulty.toLowerCase()} LeetCode problem, right in your browser against real test cases. ${truncate(problem.description, 120)}`;
    return {
        title,
        description,
        alternates: {
            canonical: `${BASE_URL}/leetcode/${problem.slug}`,
        },
        openGraph: {
            title,
            description,
            url: `${BASE_URL}/leetcode/${problem.slug}`,
            type: 'article',
        },
    };
}
export default async function SolvePage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const problem = await getProblem(params.slug);
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'LeetCode', url: `${BASE_URL}/leetcode` },
        {
            name: problem?.title || params.slug,
            url: `${BASE_URL}/leetcode/${params.slug}`,
        },
    ]);
    return (<>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <SolveClient />
    </>);
}
