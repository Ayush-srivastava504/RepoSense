// Module: lib/content/sectionGuides.ts
// Editorial content for the main listing sections (/jobs, /internships, /remote-jobs,
// /government-jobs). Every section has its own motto, its own topics and its own FAQ so
// that no two section pages share body copy. Rendered by app/components/SectionGuide.tsx
// on the plain first page of each list only (not on ?page=N or filtered views).
//
// Editing rule: keep claims durable. No vacancy counts, salary figures or fee amounts that
// go stale; point people to the listing or the notifying authority for those.

export type SectionKey = 'jobs' | 'internships' | 'remote-jobs' | 'government-jobs';

export interface GuideTopic {
    title: string;
    body: string[];
    link?: { href: string; label: string };
}

export interface GuideFaq {
    question: string;
    answer: string;
}

export interface SectionGuideContent {
    motto: string;
    heading: string;
    intro: string;
    topics: GuideTopic[];
    faqs: GuideFaq[];
    related: { href: string; label: string; note: string }[];
}

export const SECTION_GUIDES: Record<SectionKey, SectionGuideContent> = {
    jobs: {
        motto: 'Find the work. Skip the runaround.',
        heading: 'How to get more out of a job search on InternFlow',
        intro:
            'A job board is only useful if you can tell which listings are worth your evening. These are the habits that save the most time, especially if you are applying for your first or second role.',
        topics: [
            {
                title: 'Read the responsibilities before the title',
                body: [
                    'Two listings called "Software Engineer" can be completely different jobs: one is mostly writing features in a product team, the other is maintenance on a client project. The title tells you very little. The responsibilities list, the tech stack and the experience line tell you almost everything.',
                    'If a listing never says what you will actually do day to day, treat that as information too.',
                ],
            },
            {
                title: 'Batch year and eligibility matter more than people expect',
                body: [
                    'Many fresher openings are tied to a graduating batch, a degree stream or a minimum percentage. Applying outside the stated batch is the most common reason a good application is dropped without a reply.',
                    'The batch pages group openings by graduating year, so you can start from the roles that are actually open to you.',
                ],
                link: { href: '/batch', label: 'Browse jobs by batch year' },
            },
            {
                title: 'Check where the apply button leads',
                body: [
                    'A genuine application ends on the company\'s own careers page or on a recognised hiring platform such as Greenhouse, Lever or Workday. If the link goes to a form on an unrelated domain, a chat app or a payment page, stop there.',
                    'Our ranking looks at whether an apply link points to the company\'s own site or a known hiring platform, and pushes doubtful ones down. It is a signal, not a guarantee, so the check is still worth doing yourself.',
                ],
            },
            {
                title: 'Salary is often missing, so ask early',
                body: [
                    'Plenty of Indian listings do not publish pay. That is normal, not a red flag by itself. Ask in the first recruiter call, and ask for the number in the form you care about: fixed pay, variable pay and the in-hand amount per month are three different things.',
                    'Also ask about notice period terms and any service bond before you accept, not after.',
                ],
            },
            {
                title: 'Pick two or three skills and go deep',
                body: [
                    'Sending the same resume to fifty roles rarely works. Choose the two or three skills you can genuinely show in a project, then apply to roles that name them. Each skill page lists the openings that ask for it, along with the related skills that usually appear alongside it.',
                ],
                link: { href: '/skills', label: 'Browse jobs by skill' },
            },
            {
                title: 'Look at the city and work mode together',
                body: [
                    'A role in Bengaluru, Hyderabad or Pune can be fully on-site, hybrid or remote depending on the team, and the difference changes your rent, your commute and what you can realistically negotiate. Filter by work mode first, then by city.',
                ],
                link: { href: '/jobs-in', label: 'Browse jobs by city' },
            },
            {
                title: 'Keep a record of what you applied to',
                body: [
                    'After the first ten applications, nobody remembers which company asked for what. A simple list with the date, the role, the contact and the next step is enough. A follow-up a week after applying, polite and short, gets more replies than most people expect.',
                ],
                link: { href: '/tracker', label: 'Open the application tracker' },
            },
        ],
        faqs: [
            {
                question: 'How fresh are the jobs listed here?',
                answer:
                    'New listings are collected on a regular schedule, and each one shows its posted date. Listings that pass their deadline or stop being live are taken out of the active list, but a link can still die before we notice, so older posts are worth double-checking on the company\'s careers page.',
            },
            {
                question: 'Do I apply on InternFlow or on the company\'s site?',
                answer:
                    'In most cases the apply button sends you to the employer\'s own application page or to the platform they use to collect applications. We help you find and compare roles; the application itself goes to the company.',
            },
            {
                question: 'Why does the same job sometimes appear twice?',
                answer:
                    'The same opening is often posted by the company and re-posted by agencies or other boards with slightly different wording. We try to merge near-identical listings, but a few slip through. If you see a duplicate, apply through whichever link goes to the company directly.',
            },
            {
                question: 'What counts as a fresher job?',
                answer:
                    'Usually a role that asks for zero to one year of experience, or is open to the current graduating batches. Read the eligibility line, because some "fresher" listings still expect a specific degree, a minimum percentage or an earlier graduation year.',
            },
            {
                question: 'What is the difference between CTC and in-hand salary?',
                answer:
                    'CTC (cost to company) is the total the employer spends on you in a year, which can include variable pay, bonuses, insurance and provident fund. In-hand salary is what reaches your bank account each month after deductions and tax. Two offers with the same CTC can leave very different amounts in hand.',
            },
            {
                question: 'Is it normal to be asked to pay for a job or for training?',
                answer:
                    'No. A genuine employer does not charge a registration fee, a security deposit or a training fee to hire you. If a recruiter asks for money, or insists on moving the conversation to a personal chat app and away from a company email address, walk away.',
            },
            {
                question: 'How many jobs should I apply to each week?',
                answer:
                    'There is no magic number. A smaller set of applications where you have matched the skills, read the listing and adjusted your resume usually does better than a large batch of identical ones. Ten well-matched applications beat fifty rushed ones.',
            },
            {
                question: 'The listing says it has expired. What now?',
                answer:
                    'Open the company\'s careers page and search for the same role. Companies often keep a position open after the original post is taken down, and a few reopen it. If it is not there, save the company and check back, since many hire in repeated cycles.',
            },
        ],
        related: [
            { href: '/internships', label: 'Internships', note: 'For students and recent graduates' },
            { href: '/remote-jobs', label: 'Remote jobs', note: 'Work from home roles' },
            { href: '/government-jobs', label: 'Government jobs', note: 'Sarkari naukri notifications' },
            { href: '/companies', label: 'Companies', note: 'Who is hiring right now' },
            { href: '/ats-checker', label: 'ATS resume checker', note: 'Test your resume against a listing' },
        ],
    },

    internships: {
        motto: 'Learn on real work, not just on paper.',
        heading: 'Finding an internship that is actually worth your time',
        intro:
            'Most students apply to as many internships as they can find and then wonder why the replies are thin. A little judgement about which ones to pursue, and how, changes the result more than volume does.',
        topics: [
            {
                title: 'What a good internship listing should tell you',
                body: [
                    'Look for the duration, whether it is paid, the work mode, what you will build or support, and who you will report to. A listing that names a team and a concrete task is usually run by people who have thought about the intern\'s time.',
                    'A listing that only says "gain exposure" and lists no tasks often means there is no plan for you yet.',
                ],
            },
            {
                title: 'Paid, stipend, unpaid, "certificate only"',
                body: [
                    'In India you will see all four. Tech, finance and product companies tend to pay; smaller firms and some non-tech roles often do not. An unpaid internship is not automatically bad if you get real mentorship and a strong reference, but be honest with yourself about what you are getting in return.',
                    'Always ask about the stipend before accepting, and ask whether it is paid on time and in full.',
                ],
            },
            {
                title: 'Which internships lead to a job offer',
                body: [
                    'Some companies convert interns into full-time employees through a pre-placement offer, usually called a PPO. It is worth asking in the interview how many interns from the last batch received one and what the review process looks like. A direct answer is a good sign; a vague one tells you something as well.',
                ],
            },
            {
                title: 'Fitting an internship around college',
                body: [
                    'Summer breaks, a semester-long internship and a final-year six-month placement are all common. Many colleges require an internship for credit, and some need a letter or NOC from the institution first, so check with your department before you accept anything with a start date in term time.',
                ],
            },
            {
                title: 'No experience yet? Build the proof first',
                body: [
                    'Recruiters hiring interns do not expect a long work history. They look for evidence that you can finish something: a small project on GitHub, a hackathon entry, a contribution to an open source repo, a deployed app that someone actually used.',
                    'One finished, explained project is worth more than five half-built ones.',
                ],
                link: { href: '/hackathons', label: 'Find hackathons to build with' },
            },
            {
                title: 'How to spot a fake internship',
                body: [
                    'The common signs are a registration or "training" fee, a certificate you have to buy, communication only on WhatsApp or Telegram, no company email address, and an offer that arrives without any interview at all. A real internship costs you effort, not money.',
                ],
            },
            {
                title: 'Remote internships: what to ask',
                body: [
                    'A remote internship can work well, but it is easier for an intern to be forgotten at a distance. Ask who your mentor will be, how often you will have a check-in, and what a good first month looks like. If nobody can answer, expect to learn very little.',
                ],
                link: { href: '/remote-jobs', label: 'See remote opportunities' },
            },
        ],
        faqs: [
            {
                question: 'Are internships paid in India?',
                answer:
                    'Many are, especially in software, data, finance and product roles at funded companies, while others offer only a certificate or an experience letter. The listing usually states the stipend or says it is unpaid. If it does not say, ask before you commit your time.',
            },
            {
                question: 'Can first-year students apply for internships?',
                answer:
                    'Yes, though the choice is narrower. Some companies run programmes aimed at first and second years, and smaller teams are often open to students who can show a project. Start with listings that say "no experience required" or mention beginners.',
            },
            {
                question: 'Can I do an internship during the semester?',
                answer:
                    'It depends on your college rules and your timetable. Part-time and remote internships are the usual choice during term. Check attendance requirements and whether the college needs to issue a permission letter first.',
            },
            {
                question: 'How long does an internship usually last?',
                answer:
                    'Anything from four weeks to six months. Summer internships commonly run eight to twelve weeks, and final-year placements often run around six months. The listing states the duration, and it is worth confirming whether it can be extended.',
            },
            {
                question: 'Does an internship certificate actually matter?',
                answer:
                    'Less than the work behind it. Recruiters care about what you built and whether someone will vouch for you. A reference from your mentor and a project you can explain carry more weight than the certificate itself.',
            },
            {
                question: 'What should I do if I am asked to pay a fee?',
                answer:
                    'Do not pay. A genuine company does not charge to take you on as an intern. If you are unsure, search for the company\'s official website, find its careers page and check whether the same role is listed there.',
            },
            {
                question: 'How do I apply with an empty resume?',
                answer:
                    'Lead with education, then projects, then skills. Describe each project in two lines: what it does and what you used. Add coursework, a hackathon or a small open source contribution if you have one. An honest short resume is better than a padded one.',
            },
            {
                question: 'What happens after the internship ends?',
                answer:
                    'Ask for feedback in the final week and request a reference or a LinkedIn recommendation while your work is fresh. If the company offers a PPO, read the terms carefully. If it does not, stay in touch with your manager, since many hires come back through that relationship.',
            },
        ],
        related: [
            { href: '/jobs', label: 'Jobs', note: 'Full-time and fresher roles' },
            { href: '/hackathons', label: 'Hackathons', note: 'Build something to show' },
            { href: '/tools', label: 'Career tools', note: 'Resume, cover letter and more' },
            { href: '/resume-for', label: 'Resume guides', note: 'Role-specific examples' },
            { href: '/batch', label: 'Batch pages', note: 'Openings by graduating year' },
        ],
    },

    'remote-jobs': {
        motto: 'Work from where you are, not where the office is.',
        heading: 'What to check before you take a remote job',
        intro:
            'Remote work sounds simple until you read the details. Hours, contracts and payment can differ a lot between two roles that both say "remote". These are the points worth checking first.',
        topics: [
            {
                title: '"Remote" can mean three different things',
                body: [
                    'Some roles are open to anyone anywhere. Some are remote but only for candidates based in India, for tax or legal reasons. Others are remote with the expectation that you overlap with a team in the US or Europe. Read the location line closely, because it decides your daily schedule.',
                ],
            },
            {
                title: 'Time zones and real working hours',
                body: [
                    'A job with a US team can mean working into the Indian night. That suits some people and ruins others. Ask for the core hours when everyone must be available, and what happens outside them.',
                ],
            },
            {
                title: 'Employee or contractor?',
                body: [
                    'This changes more than most people realise. An employee usually gets provident fund, paid leave and tax deducted at source. A contractor or freelancer typically handles their own taxes and gets none of those benefits. Neither is wrong, but you should know which one you are signing up for and have it written in the offer.',
                ],
            },
            {
                title: 'Equipment, internet and the cost of working from home',
                body: [
                    'Ask who provides the laptop, whether there is an internet allowance and what happens if your connection or power fails. Small things, but they add up across a year.',
                ],
            },
            {
                title: 'How to stand out when nobody can meet you',
                body: [
                    'Remote teams hire for clear writing, self-direction and the habit of finishing things without being chased. Show it: a tidy portfolio, a README that explains your project well, and an application that answers exactly what was asked.',
                    'If a company gives you a trial task, keep it small. Be cautious about any request for days of unpaid work.',
                ],
                link: { href: '/tools', label: 'Resume and cover letter tools' },
            },
            {
                title: 'Remote work scams look a certain way',
                body: [
                    '"Earn a fixed amount per day", data entry roles that ask for a deposit, and jobs that skip the interview and hire you through a chat app are the usual pattern. Genuine remote employers interview you, send an offer from a company address and never ask for money.',
                ],
            },
            {
                title: 'An honest note for early-career candidates',
                body: [
                    'Entry-level remote roles exist, but they are fewer and more competitive than on-site ones, and learning from colleagues is harder at a distance. If you are just starting, a hybrid role or a remote internship with a named mentor is often a better first step.',
                ],
                link: { href: '/internships', label: 'Look at internships first' },
            },
        ],
        faqs: [
            {
                question: 'Can freshers get remote jobs?',
                answer:
                    'Yes, but the number is smaller. Look for roles that say "entry level" or "0 to 1 years", and apply with a portfolio or project link. Many freshers find that a remote internship or a short contract is an easier way in than a permanent role.',
            },
            {
                question: 'Are "work from home, earn daily" jobs real?',
                answer:
                    'Almost never. Fixed daily pay for simple tasks, typing jobs and "invest to start" offers are the standard shape of a scam. A genuine employer interviews you, sets out the role in writing and never asks you to pay in order to begin.',
            },
            {
                question: 'Do I need to live in a particular time zone?',
                answer:
                    'Sometimes. Some listings welcome any location, others require several hours of overlap with a team in another country. The listing or the first call should state the overlap hours. If it does not, ask before you apply.',
            },
            {
                question: 'How do remote companies pay people in India?',
                answer:
                    'It varies: Indian payroll for employees of an Indian entity, or international transfers for contractors paid in dollars or euros. Ask how and in which currency you will be paid, who bears transfer charges and how the tax side is handled.',
            },
            {
                question: 'What equipment do I need?',
                answer:
                    'A reliable laptop, stable internet, a quiet place for calls and a headset are the basics. Check whether the company supplies the laptop, and plan a backup such as mobile data for days when the main connection drops.',
            },
            {
                question: 'What is the difference between remote and hybrid?',
                answer:
                    'Remote means you work from anywhere you choose, within any stated limits. Hybrid means a mix of office days and home days, usually in a specific city. Hybrid roles show up in the main job list under the work mode filter.',
            },
            {
                question: 'How do I show I can work remotely?',
                answer:
                    'Point to things you have done without supervision: a project you completed, open source work, a freelance gig, a course you finished. Write clearly in your application and respond promptly. Remote hiring teams read those habits closely.',
            },
            {
                question: 'Is it okay to work two remote jobs at once?',
                answer:
                    'Check your contract first. Many employment agreements forbid it or require written permission, and breaking that clause can cost you the job. Freelance or contract work with clear terms is a different arrangement from two full-time roles.',
            },
        ],
        related: [
            { href: '/jobs', label: 'All jobs', note: 'Filter by work mode' },
            { href: '/internships', label: 'Internships', note: 'Including remote ones' },
            { href: '/skills', label: 'Skills', note: 'See what remote roles ask for' },
            { href: '/tools', label: 'Career tools', note: 'Resume and cover letter' },
            { href: '/blog', label: 'Blog', note: 'Job market guides' },
        ],
    },

    'government-jobs': {
        motto: 'Sarkari naukri, without the confusion.',
        heading: 'Reading a government job notification the right way',
        intro:
            'Government notifications are long, dense and easy to misread. Most missed opportunities come from skipping one line, usually the age cut-off date or a document requirement. Here is how to read them.',
        topics: [
            {
                title: 'Read the notification, not the headline',
                body: [
                    'A headline can say "5,000 vacancies" while the notification splits those across many posts, categories and states. Look for the advertisement number, the name of each post, the vacancies per post, the eligibility, the fee, the important dates and the selection stages. Those seven items tell you whether to apply.',
                ],
            },
            {
                title: 'Eligibility has two parts: education and age',
                body: [
                    'Education is usually clear. Age is where people slip. The limit is calculated "as on" a specific cut-off date stated in the notification, not today\'s date, and relaxations for SC, ST, OBC, EWS, PwBD candidates and ex-servicemen differ from one notification to another. Always check the table in the notification itself.',
                ],
            },
            {
                title: 'The technical and PSU route for engineers',
                body: [
                    'If you have an engineering degree, the public-sector side is worth a look. Several PSUs have recruited engineers through GATE scores in past cycles, and organisations such as ISRO and DRDO publish technical posts too. Each one sets its own eligibility and process, so read each notification fresh rather than assuming it works like the last one.',
                ],
                link: { href: '/jobs', label: 'See technical roles in the main job list' },
            },
            {
                title: 'Central, state and where to apply',
                body: [
                    'Central recruitment comes from bodies such as SSC, UPSC, the railway recruitment boards and IBPS for banks. States run their own public service commissions. Whichever it is, apply only on the official website, which normally ends in gov.in or nic.in. Our listings link to the notifying authority where we can.',
                ],
            },
            {
                title: 'Documents, fees and the correction window',
                body: [
                    'Keep a scanned photo, signature, ID proof, education certificates and category certificate ready in the sizes the portal asks for. Application fees are usually modest, and many categories are exempt. Some portals offer a correction window after submission; note its dates, because it is often your only chance to fix a mistake.',
                ],
            },
            {
                title: 'Know the stages before you start preparing',
                body: [
                    'Most exams run in stages: a preliminary or Tier I paper, a main or Tier II paper, then a skill or typing test where relevant, document verification and sometimes a medical check. Knowing the number of stages and the syllabus for each lets you plan months of preparation instead of weeks.',
                ],
            },
            {
                title: 'Never pay an agent to get you a government job',
                body: [
                    'Recruitment is run through public notifications and open exams. Nobody can legitimately sell you a seat. Be wary of anyone promising a guaranteed post for money and of coaching offers that guarantee selection. If in doubt, find the notification on the official site and check it yourself.',
                ],
            },
            {
                title: 'Put every date in a calendar',
                body: [
                    'Last date to apply, fee payment deadline, admit card release, exam date and result. Miss the first one and nothing else matters. Set a reminder a few days before the closing date, since portals tend to slow down in the final hours.',
                ],
            },
        ],
        faqs: [
            {
                question: 'Is InternFlow an official government job portal?',
                answer:
                    'No. We collect notifications from public sources such as Employment News and FreeJobAlert and link to the notifying authority\'s application page where available. The official notification is always the final word, so cross-check anything important there before you apply.',
            },
            {
                question: 'What is the difference between a post and a vacancy?',
                answer:
                    'A post is the job role, for example Junior Engineer or Assistant. Vacancies are the number of seats open for that role. One notification often covers several posts, each with its own vacancy count, eligibility and pay level.',
            },
            {
                question: 'How is the age limit calculated?',
                answer:
                    'Your age is counted as on a particular date given in the notification, which can be well before or after the application window. Relaxation for reserved categories and ex-servicemen is stated in the same notification, so read that table instead of relying on a general rule.',
            },
            {
                question: 'Do I need a GATE score for PSU jobs?',
                answer:
                    'Some PSUs have recruited engineers on GATE scores, while others hold their own exams or interviews. It depends on the company and the cycle, so check the current notification. If GATE is needed, the cut-off year for a valid score is stated there as well.',
            },
            {
                question: 'Can I apply for more than one post in the same notification?',
                answer:
                    'Often yes, but the rules differ. Some notifications want a separate application and fee for each post, while others let you pick preferences in a single form. Read the "how to apply" section before you start.',
            },
            {
                question: 'What does "advertisement number" mean?',
                answer:
                    'It is the reference number a department gives to a recruitment notice. Quote it when you contact the authority and use it to find the official notice on their website, especially if a similar notification appears from the same body.',
            },
            {
                question: 'Why does a listing sometimes have no direct apply link?',
                answer:
                    'Some authorities open the application portal only on the start date, and some publish the notification before the link goes live. In that case, read the notification now, collect your documents and check the official site on the opening date.',
            },
            {
                question: 'Which documents should I keep ready?',
                answer:
                    'A recent photograph and signature in the required sizes, a government ID, mark sheets and degree certificates, and a category or EWS certificate if you claim a reserved seat. Check each notification, since some also ask for a domicile or experience certificate.',
            },
        ],
        related: [
            { href: '/jobs', label: 'Jobs', note: 'Private sector and fresher roles' },
            { href: '/internships', label: 'Internships', note: 'Early-career opportunities' },
            { href: '/batch', label: 'Batch pages', note: 'Openings by graduating year' },
            { href: '/blog', label: 'Blog', note: 'Preparation and career guides' },
            { href: '/tools', label: 'Career tools', note: 'Resume and application help' },
        ],
    },
};
