// Module: app/skills/page.tsx
// Defines component(s)/export(s): SkillsIndexPage
//
//

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { BASE_URL } from '@/lib/jobs';
import { SKILLS, type SkillDefinition } from '@/app/skills/data';
import { breadcrumbSchema, faqSchema } from '@/lib/structuredData';
import FAQAccordion from '@/app/components/FAQAccordion';

export const metadata: Metadata = {
    title: 'Skills for Resume: Hard Skills, Soft Skills & Technical Skills',
    description: 'The exact skills to put on your resume — hard skills, soft skills, and technical skills, with real examples by field, how many to list, and live jobs by skill.',
    keywords: [
        'skills for resume',
        'hard skills',
        'skills to put on resume',
        'soft skills',
        'technical skills',
    ],
    alternates: { canonical: `${BASE_URL}/skills` },
    openGraph: {
        type: 'website',
        url: `${BASE_URL}/skills`,
        title: 'Skills for Resume: Hard Skills, Soft Skills & Technical Skills',
        description: 'The exact skills to put on your resume — hard skills, soft skills, and technical skills, with real examples by field.',
        images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: 'Skills for resume' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Skills for Resume: Hard Skills, Soft Skills & Technical Skills',
        description: 'The exact skills to put on your resume — hard skills, soft skills, and technical skills, with real examples by field.',
        images: [`${BASE_URL}/og-image.png`],
    },
};

const FAQS = [
    {
        q: 'What are the top 5 skills to put on a resume?',
        a: 'A strong default set: one core technical skill for your field (e.g. Python or SQL), one collaboration tool (Git), one soft skill shown through a bullet point (communication or ownership), one domain-specific tool (e.g. AWS or React), and one measurable achievement skill (e.g. data analysis or debugging). The exact five should always match the job description in front of you.',
    },
    {
        q: 'What are the 7 types of skills?',
        a: 'Most frameworks group skills into technical/hard skills, soft skills, transferable skills, workplace/professional skills, leadership skills, communication skills, and industry-specific skills. On a resume, only hard and soft skills are usually labeled explicitly — the rest show up inside your bullet points.',
    },
    {
        q: 'What are 10 life skills?',
        a: 'Common life-skill lists include time management, communication, financial literacy, problem-solving, adaptability, critical thinking, teamwork, self-discipline, conflict resolution, and basic tech literacy. These overlap with soft skills but are broader than what belongs on a resume.',
    },
    {
        q: 'What are the top 6 skills employers look for?',
        a: 'Across most entry-level tech and business roles: problem-solving, communication, one strong technical or tool skill for the role, adaptability, collaboration, and reliability (shipping on time). Employers weight the technical skill differently by field, but the other five stay fairly constant.',
    },
    {
        q: 'What are 10 good skills to develop?',
        a: 'A well-rounded starting list: one programming language, SQL, Git, a cloud platform (AWS, Azure, or GCP), data analysis basics, written communication, presenting, time management, debugging, and collaborating in a team workflow like Agile or Scrum.',
    },
    {
        q: 'What are 7 hard skills?',
        a: 'Seven common hard skills: coding in a language like Python or Java, SQL, data analysis, cloud computing (AWS or Azure), financial modeling, foreign language proficiency, and graphic design tools. Pick the ones relevant to your target role rather than listing all seven.',
    },
    {
        q: 'What are 20 hard skills?',
        a: 'A broad list spans Python, Java, JavaScript, SQL, AWS, Docker, Kubernetes, React, Node.js, Django, Excel, Power BI, data analysis, machine learning, statistics, financial modeling, project management software, CAD, foreign languages, and copywriting. Choose the subset that matches your field — a 20-item list on one resume is almost always too many.',
    },
    {
        q: 'What are 20 soft skills?',
        a: 'Commonly cited soft skills include communication, teamwork, adaptability, problem-solving, time management, leadership, critical thinking, conflict resolution, empathy, work ethic, creativity, decision-making, active listening, negotiation, emotional intelligence, stress management, attention to detail, flexibility, collaboration, and accountability. List 3–5 max, and prove them through bullets rather than a bare list.',
    },
    {
        q: 'What are the 10 most in-demand soft skills?',
        a: 'Recruiters most consistently screen for communication, teamwork, adaptability, problem-solving, time management, leadership, critical thinking, work ethic, collaboration, and emotional intelligence. Showing two or three of these through concrete examples outperforms listing all ten as bare words.',
    },
];

function groupByCategory(skills: SkillDefinition[]) {
    const groups = new Map<string, SkillDefinition[]>();
    for (const s of skills) {
        const list = groups.get(s.category) ?? [];
        list.push(s);
        groups.set(s.category, list);
    }
    return groups;
}

export default function SkillsIndexPage() {
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Skills', url: `${BASE_URL}/skills` },
    ]);
    const faqs = faqSchema(FAQS.map((f) => ({ question: f.q, answer: f.a })));
    const grouped = groupByCategory(SKILLS);

    return (<main className="w-full">
      <Script id="skills-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Script id="skills-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <p className="eyebrow eyebrow-accent">// skills for resume</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
          Skills for Resume: Hard Skills, Soft Skills &amp; Technical Skills
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          List a mix of hard skills (things you can prove), technical skills (tools and languages
          specific to your field), and a small number of soft skills (how you work) — and skip
          anything you can&apos;t back up in an interview. Here&apos;s exactly what to put on your
          resume, with real examples.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/ats-checker" className="btn btn-primary w-full text-center sm:w-auto">
            Check my resume — free
          </Link>
          <Link href="/tools/resume-builder" className="btn w-full text-center sm:w-auto">
            Build a resume
          </Link>
        </div>

        {/* Hard vs soft vs technical */}
        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Hard skills vs. soft skills vs. technical skills</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            These three terms get used loosely on most resumes — here&apos;s the plain,
            point-by-point breakdown of what separates them and how each gets checked.
          </p>

          <div className="mt-4 -mx-3 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[640px] border-collapse text-sm sm:min-w-0">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--line-strong)' }}>
                  <th className="px-3 py-3 text-left font-medium">Type</th>
                  <th className="px-3 py-3 text-left font-medium">What it means</th>
                  <th className="px-3 py-3 text-left font-medium">Examples</th>
                  <th className="px-3 py-3 text-left font-medium">How it&apos;s verified</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    type: 'Hard skills',
                    meaning: 'Learnable, testable abilities — you either can do them or you can\'t.',
                    examples: 'SQL, financial modeling, welding, a foreign language.',
                    verified: 'Portfolio, project, certification, or a practical test.',
                  },
                  {
                    type: 'Technical skills',
                    meaning: 'A subset of hard skills specific to a technical field.',
                    examples: 'Python, React, AWS, Docker, machine learning frameworks.',
                    verified: 'Code, GitHub history, technical interview, live coding round.',
                  },
                  {
                    type: 'Soft skills',
                    meaning: 'Behavioral traits — harder to prove on paper than to describe.',
                    examples: 'Communication, teamwork, time management, adaptability.',
                    verified: 'Bullet-point evidence, references, behavioral interview.',
                  },
                ].map((row) => (<tr key={row.type} className="border-b align-top" style={{ borderColor: 'var(--line)' }}>
                    <td className="px-3 py-3 font-medium whitespace-nowrap">{row.type}</td>
                    <td className="px-3 py-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{row.meaning}</td>
                    <td className="px-3 py-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{row.examples}</td>
                    <td className="px-3 py-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{row.verified}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Quick rule: every technical skill is a hard skill, but not every hard skill is
            technical. An ATS mostly scans for hard and technical keywords that match the job
            description exactly — soft skills matter more once a human is reading, and land best
            inside a bullet point rather than a standalone list.
          </p>
        </section>

        {/* Technical skills examples */}
        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Technical skills to put on your resume</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Don&apos;t write &quot;proficient in technology.&quot; List specific, searchable names —
            only what you&apos;ve actually used on a project, class assignment, or job.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Cloud computing', items: ['AWS', 'Azure', 'Google Cloud Platform', 'Docker', 'Kubernetes'] },
              { label: 'Backend development', items: ['Node.js', 'Django', 'Spring Boot', 'REST APIs', 'PostgreSQL'] },
              { label: 'Frontend development', items: ['React', 'JavaScript', 'TypeScript', 'Responsive design'] },
              { label: 'Data & analytics', items: ['SQL', 'Python (pandas)', 'Data warehousing', 'Excel', 'Power BI'] },
              { label: 'Machine learning', items: ['scikit-learn', 'TensorFlow', 'Model evaluation', 'Feature engineering'] },
              { label: 'Tools & workflow', items: ['Git', 'CI/CD', 'Agile/Scrum', 'Jira'] },
            ].map((group) => (<div key={group.label} className="panel p-4">
                <p className="text-sm font-medium">{group.label}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {group.items.map((item) => (<li key={item} className="chip chip-muted text-xs">{item}</li>))}
                </ul>
              </div>))}
          </div>
        </section>

        {/* Soft skills */}
        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Soft skills that actually help you get hired</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            The mistake most resumes make is listing soft skills as isolated words with nothing
            behind them. Fold them into your experience bullets instead:
          </p>
          <ul className="mt-4 space-y-2">
            <li className="panel p-4 text-sm leading-relaxed">
              Instead of &quot;good communication skills&quot; → &quot;Presented weekly project
              updates to a 6-person cross-functional team&quot;
            </li>
            <li className="panel p-4 text-sm leading-relaxed">
              Instead of &quot;team player&quot; → &quot;Coordinated with 3 backend engineers to
              ship a feature two days ahead of schedule&quot;
            </li>
            <li className="panel p-4 text-sm leading-relaxed">
              Instead of &quot;problem solver&quot; → &quot;Debugged a production issue that was
              causing a 12% checkout drop-off&quot;
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            If you want a short dedicated soft-skills line, keep it to 3–5 and make sure at least
            one shows up demonstrated elsewhere on the page.
          </p>
        </section>

        {/* How many skills */}
        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">How many skills should you list?</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            There&apos;s no single right number, but a good working range: <strong>5–8 technical or
            hard skills</strong> in your primary skills section, <strong>3–5 soft skills</strong>{' '}
            (ideally shown through bullets rather than listed alone), and{' '}
            <strong>10–15 total</strong> as a reasonable ceiling for a one-page resume. Beyond that,
            an ATS parser and a human reader both start skimming instead of reading.
          </p>
        </section>

        {/* Browse by skill (existing utility, kept) */}
        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Browse live jobs &amp; internships by skill</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Pick a skill to see live jobs and internships that need it, the companies hiring for it
            right now, and the resume and interview-prep tools to match.
          </p>
          {Array.from(grouped.entries()).map(([category, skills]) => (<div key={category} className="mt-6">
              <h3 className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>{category}</h3>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((s) => (<li key={s.slug}>
                    <Link href={`/skills/${s.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                      {s.name}
                      <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                    </Link>
                  </li>))}
              </ul>
            </div>))}
        </section>

        {/* FAQ */}
        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium mb-6">Frequently asked questions</h2>
          <FAQAccordion items={FAQS.map((f) => ({ question: f.q, answer: f.a }))} />
        </section>
      </div>
    </main>);
}