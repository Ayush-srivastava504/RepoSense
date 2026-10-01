// Module: lib/content/hubGuides.ts
// Editorial content for the hub/index pages: /companies, /jobs-in, /batch, /careers,
// /resume-for, /japan-jobs and /europe-jobs. Same shape as sectionGuides.ts and rendered
// by the same SectionGuide component. Every hub has its own motto, topics and FAQ.
//
// Editing rule: keep claims durable. No salary figures, vacancy counts, visa thresholds or
// fee amounts that go stale; point readers to the listing or the official source instead.

import type { SectionGuideContent } from '@/lib/content/sectionGuides';

export type HubKey =
    | 'companies'
    | 'jobs-in'
    | 'batch'
    | 'careers'
    | 'resume-for'
    | 'japan-jobs'
    | 'europe-jobs';

export const HUB_GUIDES: Record<HubKey, SectionGuideContent> = {
    companies: {
        motto: 'Know who you are applying to before they know you.',
        heading: 'How to research a company before you apply',
        intro:
            'A company with an open role is not automatically a good place to start your career. A few minutes of checking before you apply saves weeks of regret later, and it makes your application sharper too.',
        topics: [
            {
                title: 'What the three groups on this page mean',
                body: [
                    'Top Companies are established names: big tech, IT services, banks and well-known consumer brands. Mass Hiring shows companies running many openings at the same time, which usually means a genuine hiring drive. Startups covers smaller and newer employers.',
                    'The groups describe the kind of employer, not how good a job is. Use them to decide where to look first.',
                ],
            },
            {
                title: 'Service company or product company?',
                body: [
                    'Service companies, such as the large IT outsourcers, mostly build software for other businesses and hire in big batches, often with structured training. Product companies build and own a product, hire fewer people and usually expect stronger fundamentals at the interview.',
                    'Neither is better in general. Service roles are easier to enter, product roles tend to give more ownership early. Decide which matters more to you right now.',
                ],
            },
            {
                title: 'What mass hiring really tells you',
                body: [
                    'A company with dozens of open listings is expanding or replacing people quickly. For a fresher that is good news, because large drives are more open to people without experience. It can also mean high churn, so ask in the interview how long the typical team member has been there.',
                ],
            },
            {
                title: 'Working at a startup: the honest trade-offs',
                body: [
                    'You will probably get more responsibility, faster. You may also get less training, less structure and pay that depends on the company staying funded. Ask how long the current funding lasts and what happens to your role if the next round does not close.',
                ],
            },
            {
                title: 'Check that the company exists',
                body: [
                    'Look for a working company website, a careers page that lists the same role, an active professional profile with real employees and a registered company name. You can look up a registered Indian company on the Ministry of Corporate Affairs website. If the only trace of a company is a chat number, treat the offer as suspect.',
                ],
            },
            {
                title: 'Read the terms before the offer, not after',
                body: [
                    'Service agreements, notice periods and training bonds are common in Indian hiring and are legal when clearly stated. Ask for the terms early. A bond of one or two years with a heavy penalty should change how you compare two offers.',
                ],
            },
            {
                title: 'Use the company page to find the right door',
                body: [
                    'Each company page lists its current openings, so you can see whether they hire for your role before you invest time. Apply through the company\'s own careers page where the listing points there, and mention the team you are targeting in your cover note.',
                ],
                link: { href: '/jobs', label: 'Browse all jobs' },
            },
        ],
        faqs: [
            {
                question: 'How does a company get into the Top Companies group?',
                answer:
                    'Top Companies combines a curated list of well-known employers with companies that show sustained hiring on our listings, meaning several active postings with trustworthy apply links. A company outside the group is not a bad employer; it may simply be newer or smaller.',
            },
            {
                question: 'What does "mass hiring" mean here?',
                answer:
                    'It means a company currently has a large number of active listings at once. The threshold is stated in the Mass Hiring section of the page. It signals a genuine hiring drive rather than a single replacement hire.',
            },
            {
                question: 'Does a company appearing here mean InternFlow endorses it?',
                answer:
                    'No. A company appears because it has at least one active listing in our feed. We cannot vouch for every employer, so do your own checks on the company website, reviews from current and former employees and the written terms of any offer.',
            },
            {
                question: 'Should a fresher prefer a big company or a startup?',
                answer:
                    'It depends on what you need. A large company offers structure, training and a recognisable name on your resume. A startup offers wider responsibility and faster learning with more risk. Many people start in one and move to the other after a couple of years.',
            },
            {
                question: 'How can I tell if a company is genuine?',
                answer:
                    'Check that the website and careers page match the listing, that recruiters write from a company email address, that the company is registered, and that no one asks for money. If a listing exists only on social media or a messaging app, be cautious.',
            },
            {
                question: 'What is a training bond and should I accept one?',
                answer:
                    'A bond is an agreement to stay with the company for a fixed period, usually after paid training, or repay a penalty. It is legal in India when stated up front. Read the duration and amount carefully and compare it against what the training and salary are worth.',
            },
            {
                question: 'Can I apply to a company that has no open listing for my role?',
                answer:
                    'You can write to the team or a recruiter with a short, specific note, but your chances are better when there is an open role. Save the company, check its page regularly, and apply when a matching position appears.',
            },
        ],
        related: [
            { href: '/jobs', label: 'Jobs', note: 'All open roles' },
            { href: '/internships', label: 'Internships', note: 'For students and recent graduates' },
            { href: '/jobs-in', label: 'Jobs by city', note: 'Who is hiring where' },
            { href: '/careers', label: 'Career paths', note: 'Pick a role to aim at' },
            { href: '/tools', label: 'Career tools', note: 'Resume and cover letter help' },
        ],
    },

    'jobs-in': {
        motto: 'The right city changes the job, and the life around it.',
        heading: 'Choosing a city for your first job',
        intro:
            'Where you work shapes your salary, your rent, your commute and the people you meet. For a first job it can matter as much as the company, so it is worth thinking about on purpose.',
        topics: [
            {
                title: 'Salary and cost of living go together',
                body: [
                    'A higher salary in a big metro can leave you with less in hand once rent, food and commuting are paid. Compare offers on what remains after your actual monthly costs, not on the headline figure.',
                    'If the company offers relocation help or subsidised housing, count it as pay.',
                ],
            },
            {
                title: 'Each metro has its own job mix',
                body: [
                    'Bangalore is known for startups, product companies and global capability centres. Hyderabad has large tech campuses alongside pharma and life sciences. Chennai combines IT services with manufacturing and automotive work. Pune mixes IT parks with engineering and automotive firms. Delhi NCR spreads across Gurugram\'s corporate and consulting offices, Noida\'s IT and media sector, and Delhi itself.',
                ],
            },
            {
                title: 'Work mode changes the map',
                body: [
                    'A hybrid job asks you to live near the office. A remote job lets you stay in a cheaper city or at home. Before you move for a role, ask how many days you are expected in the office and whether that policy is written down.',
                ],
                link: { href: '/remote-jobs', label: 'See remote roles' },
            },
            {
                title: 'Moving for a job: a short checklist',
                body: [
                    'Find temporary housing for the first month before committing to a long lease. Ask the employer about joining dates and any relocation allowance. Understand the deposit norms in that city, and check the commute from where you plan to live at peak hours, not on a quiet Sunday.',
                ],
            },
            {
                title: 'Do not ignore the smaller cities',
                body: [
                    'Many companies hire in tier-2 cities and offer lower living costs and shorter commutes. Fewer listings are tagged to those cities on this page, so search by city name on the main jobs list as well.',
                ],
                link: { href: '/jobs', label: 'Search all jobs' },
            },
            {
                title: 'Internships follow the same logic',
                body: [
                    'A stipend that works in a smaller city can be tight in a metro. If an internship is on-site, work out the rent for the full duration first. Remote and hybrid internships often make the numbers easier.',
                ],
                link: { href: '/internships', label: 'Browse internships' },
            },
        ],
        faqs: [
            {
                question: 'Which Indian city has the most jobs for freshers?',
                answer:
                    'Bangalore, Hyderabad, Pune, Chennai and Delhi NCR are the most common for fresher tech hiring. The right choice depends on your field: product and startup roles cluster in some cities, IT services and manufacturing in others. The live counts on each city page show what is open now.',
            },
            {
                question: 'Why does a city show fewer jobs than I expected?',
                answer:
                    'Jobs are matched by the location written in the listing. A role listed as "India" or "Remote" will not appear under a city, and a few companies write the location in an unusual way. Search the main jobs list too.',
            },
            {
                question: 'Can I apply to jobs in a city I do not live in?',
                answer:
                    'Yes. Many companies interview remotely and handle relocation after an offer. Mention in your application that you are willing to relocate and give a realistic joining date, since that is a common question.',
            },
            {
                question: 'Is a metro salary always better than a smaller city salary?',
                answer:
                    'Not after costs. Metros usually pay more, but rent and commuting can absorb the difference. Compare what you would keep each month and what the role offers for learning.',
            },
            {
                question: 'What should I ask an employer when relocating?',
                answer:
                    'Ask about a relocation allowance, the first-day joining location, whether temporary accommodation is provided, and how many days a week you need to be on-site. Get answers in writing when they affect your decision.',
            },
            {
                question: 'Are remote jobs tied to a city?',
                answer:
                    'Some are open to anyone in India and some are tied to a state or city for legal or tax reasons. The listing or the first recruiter call should say. If it does not, ask before you apply.',
            },
        ],
        related: [
            { href: '/jobs', label: 'Jobs', note: 'Everything, filterable' },
            { href: '/remote-jobs', label: 'Remote jobs', note: 'Not tied to one city' },
            { href: '/companies', label: 'Companies', note: 'Who is hiring now' },
            { href: '/batch', label: 'Batch pages', note: 'Openings by graduating year' },
            { href: '/internships', label: 'Internships', note: 'Early-career options' },
        ],
    },

    batch: {
        motto: 'Your passout year is your starting line. Know where it is.',
        heading: 'What your passout batch means when you apply',
        intro:
            'Most fresher listings state which graduating years they accept. Understanding why, and how to use that rule, avoids wasted applications and helps you plan from the day you start college.',
        topics: [
            {
                title: 'Why companies ask for a specific batch',
                body: [
                    'Companies plan campus and off-campus hiring around graduating classes. A role that targets one batch expects candidates available to join around that batch\'s graduation date. Applying with a different year often means an automatic rejection, however strong the profile.',
                ],
            },
            {
                title: 'Check eligibility beyond the year',
                body: [
                    'Besides the batch, listings often require a specific degree, a minimum score and no active backlogs. Some accept a gap year, some do not. Read that line first, because it decides whether to apply at all.',
                ],
            },
            {
                title: 'If you are in your final year',
                body: [
                    'Your final academic year is when most fresher hiring closes in on you. Apply early, keep your resume updated, and be ready to explain your projects in detail. Many offers are given months before graduation, with joining after results.',
                ],
            },
            {
                title: 'If you are in pre-final year',
                body: [
                    'This is the best time to chase internships. A summer internship at the end of the third year is often the route to a pre-placement offer. Pick one or two skills, build a project in each and start applying while the pressure is still low.',
                ],
                link: { href: '/internships', label: 'Browse internships' },
            },
            {
                title: 'Earlier years: build, do not rush',
                body: [
                    'In your first and second years, few listings are open to you, and that is fine. Learn the fundamentals, join a project team, try a hackathon and keep a GitHub account that shows steady progress. By the time listings open to you, you will have something real to show.',
                ],
                link: { href: '/hackathons', label: 'Find hackathons' },
            },
            {
                title: 'Already graduated?',
                body: [
                    'Recent graduates compete for the same roles as the current batch, and many companies keep listings open to the previous batch. Explain any gap honestly and show what you have built since. Pages for earlier batches are on the list for that reason.',
                ],
            },
        ],
        faqs: [
            {
                question: 'What does passout batch mean?',
                answer:
                    'It is the year you complete your degree. If you finish your four-year course in the summer of 2027, you belong to the 2027 batch. Companies use it to match candidates to hiring cycles.',
            },
            {
                question: 'Can I apply if my batch is not listed?',
                answer:
                    'You can, but the odds are lower. Some companies accept adjacent years, and some say so in the listing. If a role does not specify, a short note to the recruiter explaining your joining date is reasonable.',
            },
            {
                question: 'Do I need to wait until final year to start applying?',
                answer:
                    'No. Internships are open to pre-final-year students, and starting early gives you time to build proof of skill. Fresher jobs mostly target the final-year batch, but internships are the usual route to them.',
            },
            {
                question: 'What if I have a backlog?',
                answer:
                    'Many companies ask for no active backlogs at the time of joining, though a few accept cleared ones. Check the eligibility line. If you have one, clear it as soon as possible and be ready to explain it.',
            },
            {
                question: 'Does a gap year hurt my chances?',
                answer:
                    'It depends on the company and on how you explain it. Some listings state a maximum gap. A clear reason and evidence that you used the time, such as a course, a project or work, matters more than the gap itself.',
            },
            {
                question: 'What is the difference between on-campus and off-campus hiring?',
                answer:
                    'On-campus hiring happens through your college\'s placement cell. Off-campus means you apply directly through listings like these. Off-campus is open to everyone, but you handle the process yourself.',
            },
        ],
        related: [
            { href: '/jobs', label: 'Jobs', note: 'All open roles' },
            { href: '/internships', label: 'Internships', note: 'The usual way in' },
            { href: '/hackathons', label: 'Hackathons', note: 'Build something to show' },
            { href: '/careers', label: 'Career paths', note: 'Pick a direction' },
            { href: '/resume-for', label: 'Resume guides', note: 'Role-specific advice' },
        ],
    },

    careers: {
        motto: 'Pick a direction, test it small, then commit.',
        heading: 'Choosing a tech career path without guessing',
        intro:
            'Most students pick a path from a YouTube video or a friend\'s offer letter. A better way is to understand what each role does all day, and try a small piece of it before you commit months of study.',
        topics: [
            {
                title: 'Look at the daily work, not the salary headline',
                body: [
                    'A data analyst answers business questions with queries and charts. A software engineer writes and maintains product code. A DevOps engineer keeps systems deployable and running. An ML engineer trains and ships models. A data engineer builds the pipelines the others depend on. Ask which of those days you would not mind repeating.',
                ],
            },
            {
                title: 'The roles overlap more than they seem',
                body: [
                    'SQL and Python appear in almost every one of these paths. Git and basic cloud knowledge show up in most. This overlap means your first months of learning are rarely wasted, even if you change direction later.',
                ],
                link: { href: '/skills', label: 'Browse skills' },
            },
            {
                title: 'Some paths have an easier first step',
                body: [
                    'Software engineering and data analysis have the most entry-level openings. Data engineering often starts from a software or analyst role. DevOps and ML engineering have fewer true fresher positions, and many people reach them after one or two years elsewhere. That is not a reason to avoid them, only to plan the route.',
                ],
            },
            {
                title: 'Test a path with a two-week project',
                body: [
                    'Build one small thing for the role: a dashboard from a public dataset, a small API, a deployed container, a simple classifier. If you enjoy the process, you have a signal. If you dread it, you have saved yourself a semester.',
                ],
            },
            {
                title: 'What fresher hiring actually looks like',
                body: [
                    'Expect an online assessment, a technical round on fundamentals and projects, and a conversation about how you think. Companies rarely expect polish, but they do expect that you can explain what you built and why.',
                ],
                link: { href: '/leetcode', label: 'Practice coding questions' },
            },
            {
                title: 'Changing direction is normal',
                body: [
                    'Many people move between these paths in the first few years. The skills carry over, and the first job mostly teaches you how engineering teams work. Choose the best available start and treat it as a start.',
                ],
            },
        ],
        faqs: [
            {
                question: 'Which tech career is best for freshers?',
                answer:
                    'There is no single best. Software engineering and data analysis have the broadest entry-level hiring. The best choice for you is the one that matches what you enjoy and what you can show a project for.',
            },
            {
                question: 'Do I need a degree in computer science?',
                answer:
                    'Not always, but many fresher listings ask for an engineering or related degree. If your degree is in another field, projects, certifications and internships carry more weight, and some roles like data analysis are more open.',
            },
            {
                question: 'Is AI/ML a good path for a fresher?',
                answer:
                    'It is competitive and expects solid maths, programming and a portfolio. Many people begin as software or data roles and move into ML later. If you love the subject, build real projects, not only course certificates.',
            },
            {
                question: 'How long does it take to be job ready?',
                answer:
                    'It varies with your starting point and the time you spend. A focused learner with steady practice and a few projects can be ready for entry-level applications in months, not weeks. Be wary of anyone promising a fixed date.',
            },
            {
                question: 'Should I learn many skills or go deep on one?',
                answer:
                    'Go deep on a small set first, then widen. Two or three skills you can demonstrate with a project beat a long list you cannot back up.',
            },
            {
                question: 'Can I switch from one path to another later?',
                answer:
                    'Yes. SQL, Python, Git and problem-solving carry across the paths. A year in one role often makes the move to a neighbouring one easier, since you will already know how teams ship work.',
            },
        ],
        related: [
            { href: '/jobs', label: 'Jobs', note: 'See what is open' },
            { href: '/resume-for', label: 'Resume guides', note: 'Write a role-specific resume' },
            { href: '/skills', label: 'Skills', note: 'What each role asks for' },
            { href: '/internships', label: 'Internships', note: 'Try a role for real' },
            { href: '/leetcode', label: 'Coding practice', note: 'Prepare for technical rounds' },
        ],
    },

    'resume-for': {
        motto: 'One page. One role. Every line earning its place.',
        heading: 'Writing a resume that works for one specific role',
        intro:
            'A generic resume sent everywhere is read quickly and remembered by nobody. A resume written for one role, with the right words and the right evidence, is read for longer.',
        topics: [
            {
                title: 'Write one resume per role, not one for everything',
                body: [
                    'Keep a base version with everything you have done, then cut it down for each role. A data analyst resume leads with SQL and dashboards. A software engineer resume leads with the products you built. The same project can appear in both, described differently.',
                ],
            },
            {
                title: 'How an ATS actually reads your resume',
                body: [
                    'Many companies run resumes through an applicant tracking system before a person reads them. It parses your text into fields and ranks it against the listing. Plain headings, simple layouts and standard fonts parse reliably. Text inside images, multi-column designs and tables can scramble the order.',
                ],
                link: { href: '/ats-checker', label: 'Check your resume' },
            },
            {
                title: 'Use the job description\'s own words, honestly',
                body: [
                    'If a listing asks for REST APIs and you have built them, say "REST APIs", not only "backend work". Match the language of the listing where it is true. Do not add skills you cannot discuss, since the interview will find them.',
                ],
            },
            {
                title: 'Write bullets that show outcome',
                body: [
                    'A good bullet states what you did, how and what changed: "Cut page load time from 4s to 2s by lazy-loading images" is stronger than "Worked on performance". If you have no numbers, describe the scale or the result in plain terms.',
                ],
            },
            {
                title: 'Freshers: put projects up front',
                body: [
                    'With little work history, your projects are your evidence. Give each two or three lines on the problem, the tools and what you learned or achieved. Link the repository and keep it tidy, because recruiters do click.',
                ],
                link: { href: '/hackathons', label: 'Build a project at a hackathon' },
            },
            {
                title: 'Common mistakes that cost interviews',
                body: [
                    'Typos, a two-page resume for a fresher, a photo or personal details that the role does not need, a long objective statement that says nothing, and dead links to a portfolio or GitHub. Fix those before you work on anything fancy.',
                ],
            },
        ],
        faqs: [
            {
                question: 'How long should a resume be?',
                answer:
                    'One page is standard for students and early-career applicants. Experienced people can use two pages if every line is relevant. Cut anything that does not help the role you are applying for.',
            },
            {
                question: 'Should I include a photo or my date of birth?',
                answer:
                    'For most private-sector roles, no. A photo and personal details are not needed and can distract from your skills. Some applications, such as government forms, have their own rules, so follow what the notification asks.',
            },
            {
                question: 'What file format should I send?',
                answer:
                    'A PDF unless the listing asks for something else. It keeps your formatting and parses well in most systems. Name it clearly, for example with your name and the role.',
            },
            {
                question: 'Do I need an objective or summary?',
                answer:
                    'A two-line summary naming your target role and strongest skills can help. A generic objective like "seeking a challenging position" adds nothing. If it does not tell the reader something specific, leave it out.',
            },
            {
                question: 'How many skills should I list?',
                answer:
                    'List the ones you can discuss and have used, grouped sensibly. Ten genuine skills are more convincing than thirty buzzwords. Put the ones the job asks for near the top.',
            },
            {
                question: 'What if I have no work experience?',
                answer:
                    'Lead with education, then projects, then skills, then any internships, hackathons, open source or volunteer work. Describe what you built and what you learned. Honest and specific beats padded.',
            },
            {
                question: 'How do I know if my resume passes an ATS?',
                answer:
                    'You cannot be sure for any one company, because each system differs. A check like our ATS tool can flag problems such as unreadable formatting and missing keywords. Treat the result as a guide, not a guarantee.',
            },
        ],
        related: [
            { href: '/ats-checker', label: 'ATS checker', note: 'Test your resume' },
            { href: '/careers', label: 'Career paths', note: 'Understand the role first' },
            { href: '/jobs', label: 'Jobs', note: 'Find a listing to match' },
            { href: '/internships', label: 'Internships', note: 'Early-career roles' },
            { href: '/tools', label: 'Career tools', note: 'Cover letter and more' },
        ],
    },

    'japan-jobs': {
        motto: 'Japan is a real option. Go in with open eyes.',
        heading: 'What to know before you apply for jobs in Japan',
        intro:
            'Working in Japan is realistic for Indian engineers, but the route is different from applying in India. These are the points that matter most before you spend time on applications.',
        topics: [
            {
                title: 'Understand what "remote for Japan" means',
                body: [
                    'Many listings on this page come from remote-work boards. A role marked for Japan often expects you to be in Japan already, or to have the right to work there. It is not always an offer to relocate you. Read the location and eligibility lines before you apply.',
                ],
            },
            {
                title: 'Work visas need a sponsor',
                body: [
                    'To work in Japan you usually need an employer to sponsor a work visa, and the common route for engineers expects a relevant degree or experience. Visa categories and requirements change, so confirm them on the Japanese immigration authority\'s official site or with the employer\'s HR.',
                ],
            },
            {
                title: 'Language: it depends on the company',
                body: [
                    'Many Japanese companies work in Japanese and ask for a JLPT level, often N2 or N1 for local teams. International companies and startups hire for English-speaking roles. Honestly check how much Japanese a role needs, and be realistic about learning it.',
                ],
            },
            {
                title: 'How hiring and work culture differ',
                body: [
                    'Hiring can be slower and more formal than in India, with multiple interviews and a strong focus on fit with the team. Expect clear processes and an emphasis on reliability. Ask about overtime expectations and team size during interviews.',
                ],
            },
            {
                title: 'Internships in Japan',
                body: [
                    'Some listings are internships, either based in Japan or open to applicants in Japan. Rules and visa category depend on the programme and the employer. Ask the company how they arrange it, and check the official guidance before making plans.',
                ],
                link: { href: '/internships', label: 'Browse internships' },
            },
            {
                title: 'A practical first step',
                body: [
                    'Start by applying to English-language roles at international companies, keep learning Japanese on the side, and build a resume that shows concrete projects. A few years in a strong team at home can also make a later move to Japan easier.',
                ],
                link: { href: '/resume-for', label: 'Resume guides' },
            },
        ],
        faqs: [
            {
                question: 'Can an Indian graduate work in Japan?',
                answer:
                    'Yes, with an employer willing to sponsor a work visa and a qualifying degree or experience. Requirements change, so check the official immigration site. Many people start with a role in India at a company with a Japan office and move later.',
            },
            {
                question: 'Do I need to speak Japanese?',
                answer:
                    'Not for every role. Some international companies and startups hire in English, while many local teams expect a JLPT level such as N2. Check each listing, and treat Japanese as a long-term asset either way.',
            },
            {
                question: 'Are these jobs in Japan or remote?',
                answer:
                    'A mix. Many come from remote-work boards, and some are based in Japan or open only to people already there. The listing states the arrangement, so read it before applying.',
            },
            {
                question: 'Will the company help with the visa?',
                answer:
                    'Some do and some do not. A listing that mentions visa support is a good sign. If it does not say, ask early in the process, since it affects whether the role is possible for you.',
            },
            {
                question: 'Can I apply for a Japan internship from India?',
                answer:
                    'Sometimes. Some internships are open to remote applicants and some require you to be in Japan. The company can tell you the arrangement and how any visa or permission is handled.',
            },
            {
                question: 'How should I prepare my resume for Japan?',
                answer:
                    'Keep it clear and factual, with specific projects and skills. For Japanese-language roles, a Japanese-format resume may be expected, so ask the recruiter. For English-language roles, a normal tech resume works.',
            },
        ],
        related: [
            { href: '/europe-jobs', label: 'Europe jobs', note: 'Another route abroad' },
            { href: '/remote-jobs', label: 'Remote jobs', note: 'Work from India' },
            { href: '/jobs', label: 'Jobs in India', note: 'All open roles' },
            { href: '/resume-for', label: 'Resume guides', note: 'Role-specific advice' },
            { href: '/tools', label: 'Career tools', note: 'Resume and cover letter' },
        ],
    },

    'europe-jobs': {
        motto: 'Europe hires across borders. Learn the rules, then apply.',
        heading: 'Applying for jobs in Europe from India',
        intro:
            'Europe is many job markets, each with its own visa rules, languages and salary norms. A little groundwork before applying will keep you from wasting weeks on roles you cannot take.',
        topics: [
            {
                title: 'Europe is not one market',
                body: [
                    'The UK, Germany, the Netherlands and other countries differ in rules, salaries, taxes and language needs. Choose one or two countries to focus on rather than applying everywhere with the same letter.',
                ],
            },
            {
                title: 'Visa and sponsorship come first',
                body: [
                    'Most roles need a work visa. Some employers sponsor, some do not. Several countries have routes for skilled graduates, such as the EU Blue Card in participating countries, the UK Skilled Worker route and Germany\'s Opportunity Card for job seekers. Eligibility and salary thresholds change, so check official government sources before relying on any number.',
                ],
            },
            {
                title: 'Look for listings that mention relocation',
                body: [
                    'Some listings state visa sponsorship or relocation help. Those are far more likely to be open to you than a role that says nothing. Filter your attention to them first, and ask about it early in the process otherwise.',
                ],
            },
            {
                title: 'Language is a real factor',
                body: [
                    'Many tech teams in Europe work in English, especially in international companies and startups. In some countries, local-language skills are still expected for client-facing or non-tech roles. Check the listing, and consider learning the local language as a long-term plan.',
                ],
            },
            {
                title: 'CVs, not resumes',
                body: [
                    'In much of Europe the document is called a CV and follows local norms: concise, factual, often with a short professional profile. Some countries expect more personal details than India does, others fewer. Look at examples from the country you target.',
                ],
                link: { href: '/resume-for', label: 'Resume guides' },
            },
            {
                title: 'Remote roles for Europe',
                body: [
                    'Many listings here are remote roles from European companies. Some accept candidates anywhere, many require you to be in a European time zone or have the right to work in the country. Check the eligibility line, then ask about contracts and payment if you work from India.',
                ],
                link: { href: '/remote-jobs', label: 'See remote jobs' },
            },
        ],
        faqs: [
            {
                question: 'Can I get a job in Europe from India?',
                answer:
                    'Yes, though it takes preparation. You need an employer willing to sponsor a visa or a route for skilled workers, and a profile that fits the role. Many people also start with a remote role and relocate later.',
            },
            {
                question: 'Which European country is easiest for tech jobs?',
                answer:
                    'There is no simple answer. It depends on your field, language and the current visa rules. Look at the countries with the most English-language tech roles and compare their visa routes on official sites.',
            },
            {
                question: 'What is a visa-sponsored job?',
                answer:
                    'It is a job where the employer supports your work visa application, handling the paperwork and meeting the sponsor requirements. A listing that mentions visa sponsorship is more realistic for an overseas applicant.',
            },
            {
                question: 'Do I need to speak the local language?',
                answer:
                    'Not always. Many tech roles in international companies use English. Roles that deal with local customers or government often need the local language. The listing should say.',
            },
            {
                question: 'What is the difference between a CV and a resume?',
                answer:
                    'In India they are mostly used interchangeably. In much of Europe, CV is the standard word, and the format follows local conventions. Keep it concise, factual and tailored to the country.',
            },
            {
                question: 'Are salaries in Europe higher than in India?',
                answer:
                    'In nominal terms often yes, but taxes, rent and living costs are also higher. Compare what you would keep after costs, and check the real salary range on the listing or from the recruiter.',
            },
            {
                question: 'Can I work remotely for a European company from India?',
                answer:
                    'Sometimes. Some companies hire contractors anywhere, others need you in a specific region. Ask how payment, tax and your contract are handled, and get the terms in writing.',
            },
        ],
        related: [
            { href: '/japan-jobs', label: 'Japan jobs', note: 'Another route abroad' },
            { href: '/remote-jobs', label: 'Remote jobs', note: 'Work from India' },
            { href: '/jobs', label: 'Jobs in India', note: 'All open roles' },
            { href: '/resume-for', label: 'Resume guides', note: 'CV and resume advice' },
            { href: '/tools', label: 'Career tools', note: 'Resume and cover letter' },
        ],
    },
};
