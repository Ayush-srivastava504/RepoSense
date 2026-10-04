// Module: app/privacy/page.tsx
// Defines component(s)/export(s): PrivacyPage

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'How InternFlow collects, uses and protects your information, including cookies and Google AdSense advertising.',
    alternates: { canonical: `${BASE_URL}/privacy` },
};

const UPDATED = 'October 5, 2026';

export default function PrivacyPage() {
    return (<div className="container-xl py-10 max-w-3xl">
      <p className="eyebrow eyebrow-accent">// legal</p>
      <h1 className="display mt-2 text-2xl font-medium sm:text-3xl">Privacy Policy</h1>
      <p className="eyebrow mt-2">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        <p>
          This Privacy Policy explains how InternFlow (&quot;we&quot;, &quot;us&quot;) collects, uses and
          shares information when you use {BASE_URL.replace('https://', '')} and related services.
        </p>

        <section>
          <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>Information we collect</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Account details you provide, such as your email address and name.</li>
            <li>Content you submit to our tools, such as resume text or GitHub repository data you choose to connect.</li>
            <li>Usage data such as pages viewed, device and browser type, and approximate location derived from your IP address.</li>
            <li>Cookies and similar technologies (see below).</li>
          </ul>
        </section>

        <section>
          <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>How we use information</h2>
          <p className="mt-2">
            To operate and improve the service, authenticate you, generate AI reviews and resumes you request,
            prevent abuse, analyse traffic, and show advertising that keeps the site free.
          </p>
        </section>

        <section>
          <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>Cookies, Google Analytics and advertising</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>We use Google Analytics to understand how the site is used.</li>
            <li>
              We use Google AdSense to display ads. Google and its partners, as third-party vendors, use cookies
              (including the DoubleClick cookie) to serve ads based on your prior visits to this and other websites.
            </li>
            <li>
              Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your
              visit to our site and/or other sites on the Internet.
            </li>
            <li>
              You can opt out of personalised advertising by visiting{' '}
              <a className="underline" href="https://www.google.com/settings/ads" rel="noopener noreferrer" target="_blank">Google Ads Settings</a>{' '}
              or{' '}
              <a className="underline" href="https://www.aboutads.info" rel="noopener noreferrer" target="_blank">www.aboutads.info</a>.
            </li>
            <li>
              Learn how Google uses data from sites that use its services:{' '}
              <a className="underline" href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer" target="_blank">policies.google.com/technologies/partner-sites</a>.
            </li>
            <li>
              Where required by law (for example in the EEA, UK and Switzerland), personalised ads are shown only with
              your consent. You can also block or delete cookies in your browser settings; parts of the site may not work without them.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>Sharing</h2>
          <p className="mt-2">
            We do not sell your personal information. We share data with service providers who help us run the
            site (hosting, analytics, email, payments, AI processing) and when required by law.
          </p>
        </section>

        <section>
          <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>Retention and your rights</h2>
          <p className="mt-2">
            We keep data only as long as needed for the purposes above. You may request access, correction or
            deletion of your data at any time by emailing us.
          </p>
        </section>

        <section>
          <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>Children</h2>
          <p className="mt-2">InternFlow is not directed to children under 13, and we do not knowingly collect their data.</p>
        </section>

        <section>
          <h2 className="display text-lg font-medium" style={{ color: 'var(--ink)' }}>Changes and contact</h2>
          <p className="mt-2">
            We may update this policy and will change the date above when we do. Questions:{' '}
            <a className="underline" href="mailto:creatoramplified@gmail.com">creatoramplified@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>);
}
