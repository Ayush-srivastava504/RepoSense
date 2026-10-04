// Module: app/terms/page.tsx
// Defines component(s)/export(s): TermsPage

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';

export const metadata: Metadata = {
    title: 'Terms of Service',
    description: 'The terms that govern your use of InternFlow.',
    alternates: { canonical: `${BASE_URL}/terms` },
};

const UPDATED = 'October 5, 2026';

const sections: { title: string; body: string }[] = [
    { title: 'Using InternFlow', body: 'By accessing or using InternFlow you agree to these terms. You must use the service lawfully and must not attempt to disrupt it, scrape it in violation of our robots rules, or access other users\' data.' },
    { title: 'Accounts', body: 'You are responsible for activity under your account and for keeping your credentials secure.' },
    { title: 'Job and internship listings', body: 'Listings are aggregated from third-party sources and employer career pages. We do not guarantee their accuracy, availability or the outcome of any application. Always verify details with the employer and never pay a fee to apply for a job.' },
    { title: 'AI-generated content', body: 'Code reviews, resumes and other AI output are suggestions and may contain errors. You are responsible for reviewing anything before you rely on or submit it.' },
    { title: 'Advertising and third-party links', body: 'The site displays advertising, including Google AdSense, and links to third-party websites. We are not responsible for third-party content, products or practices.' },
    { title: 'Intellectual property', body: 'The InternFlow site, branding and software are owned by us or our licensors. You keep ownership of the content you submit and grant us a licence to process it to provide the service.' },
    { title: 'Disclaimer and liability', body: 'The service is provided "as is" without warranties. To the maximum extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the service.' },
    { title: 'Changes and contact', body: 'We may update these terms; continued use means you accept the changes. Contact: creatoramplified@gmail.com.' },
];

export default function TermsPage() {
    return (<div className="container-xl py-10 max-w-3xl">
      <p className="eyebrow eyebrow-accent">// legal</p>
      <h1 className="display mt-2 text-2xl font-medium sm:text-3xl">Terms of Service</h1>
      <p className="eyebrow mt-2">Last updated: {UPDATED}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {sections.map((s) => (<section key={s.title}>
            <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>{s.title}</h2>
            <p className="mt-2">{s.body}</p>
          </section>))}
      </div>
    </div>);
}
