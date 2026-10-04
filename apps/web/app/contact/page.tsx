// Module: app/contact/page.tsx
// Defines component(s)/export(s): ContactPage

import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';

export const metadata: Metadata = {
    title: 'Contact Us',
    description: 'Get in touch with the InternFlow team for support, feedback, partnerships or listing removal requests.',
    alternates: { canonical: `${BASE_URL}/contact` },
};

export default function ContactPage() {
    return (<div className="container-xl py-10 max-w-3xl">
      <p className="eyebrow eyebrow-accent">// contact</p>
      <h1 className="display mt-2 text-2xl font-medium sm:text-3xl">Contact us</h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Questions, feedback, partnership requests, privacy requests, or a job/internship listing you would like
        removed — email us and we will reply as soon as we can.
      </p>
      <div className="panel mt-6 p-6 max-w-md">
        <p className="eyebrow">email</p>
        <a href="mailto:creatoramplified@gmail.com" className="mt-2 inline-block text-sm font-medium underline">
          creatoramplified@gmail.com
        </a>
      </div>
    </div>);
}
