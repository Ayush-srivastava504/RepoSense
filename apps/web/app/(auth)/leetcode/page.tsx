// Module: app/(auth)/leetcode/page.tsx
// Defines component(s)/export(s): LeetCodePage
//
//

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/jobs';
import LeetCodeClient from './LeetCodeClient';
export const metadata: Metadata = {
    title: 'Free LeetCode Practice — Blind 75, Top 150 & Top 250 by Company',
    description: 'Practice curated LeetCode problem sets — Blind 75, Top 150, and Top 250 — filterable by company, category, and difficulty. Solve select problems right in the browser against real test cases, or jump straight to LeetCode.',
    keywords: [
        'leetcode practice',
        'blind 75',
        'leetcode top 150',
        'leetcode by company',
        'coding interview questions',
        'data structures and algorithms practice',
    ],
    alternates: {
        canonical: `${BASE_URL}/leetcode`,
    },
    openGraph: {
        title: 'Free LeetCode Practice — Blind 75, Top 150 & Top 250 by Company',
        description: 'Curated LeetCode problem sets filterable by company, category, and difficulty, with an in-browser judge for select problems.',
        url: `${BASE_URL}/leetcode`,
        type: 'website',
    },
};
export default function LeetCodePage() {
    const itemListSchema = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'LeetCode Practice',
        description: 'Curated Blind 75, Top 150, and Top 250 LeetCode problem sets, filterable by company, category, and difficulty.',
        url: `${BASE_URL}/leetcode`,
    };
    return (<>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}/>
      <LeetCodeClient />
    </>);
}
