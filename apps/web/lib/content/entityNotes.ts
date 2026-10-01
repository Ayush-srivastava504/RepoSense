// Module: lib/content/entityNotes.ts
// Unique editorial notes for the detail pages under /jobs-in/[city], /batch/[year],
// /careers/[role] and /resume-for/[role]. Each entity has its own paragraphs and FAQ so
// that these pages stop sharing one templated block of copy.
//
// Editing rule: durable statements only (no salaries, counts or thresholds that go stale).

import type { GuideFaq } from '@/lib/content/sectionGuides';

export interface EntityNote {
    heading: string;
    paragraphs: string[];
    faqs: GuideFaq[];
}

export const CITY_NOTES: Record<string, EntityNote> = {
    bangalore: {
        heading: 'Working in Bangalore',
        paragraphs: [
            'Bangalore has the densest mix of startups, product companies, global capability centres and IT services in the country. That makes it a common first stop for software, data and AI roles, and it is why competition for the popular ones is stiff.',
            'Commutes are the part people underestimate. Traffic can turn a short distance into a long trip, so many people choose housing near their office or near a metro line before they choose a flat they like. Ask a prospective employer how many days a week you need to be on-site.',
        ],
        faqs: [
            {
                question: 'What kinds of companies hire in Bangalore?',
                answer:
                    'A wide range: funded startups, established product companies, large IT services firms and the in-house engineering centres of global companies. Check each listing to see which kind you are looking at, since the work and hiring bar differ.',
            },
            {
                question: 'Is Bangalore good for freshers?',
                answer:
                    'It has many entry-level openings across tech, but also many applicants. A strong project, a relevant internship and a tidy resume help you stand out. Consider both startups and larger firms.',
            },
            {
                question: 'Should I move to Bangalore before I get a job?',
                answer:
                    'Usually not. Many companies interview remotely and ask you to relocate after an offer. Moving first costs rent without guaranteeing interviews, so try to secure an offer, or at least interviews, before you move.',
            },
        ],
    },
    hyderabad: {
        heading: 'Working in Hyderabad',
        paragraphs: [
            'Hyderabad is known for its large technology campuses, mostly around the HITEC City and Gachibowli areas, along with a strong pharma and life sciences base. If you are in software, data, or pharma-adjacent tech, it is worth a close look.',
            'Compared with some other metros, housing near the main business districts tends to be easier to find, though prices rise close to the big campuses. As with any city, check the commute from where you plan to live.',
        ],
        faqs: [
            {
                question: 'Which sectors hire in Hyderabad?',
                answer:
                    'Software and IT services, global company engineering centres, pharmaceuticals and life sciences are the common ones. The listings on this page show what is open now.',
            },
            {
                question: 'Are there internships in Hyderabad?',
                answer:
                    'Yes, across tech and some life sciences roles. See the internships section on this page and check whether each one is on-site, hybrid or remote, since that changes your living costs.',
            },
            {
                question: 'Is Hyderabad a good choice for a first job?',
                answer:
                    'It can be, especially if you want a large employer with structured training. Compare the role and team rather than the city alone.',
            },
        ],
    },
    chennai: {
        heading: 'Working in Chennai',
        paragraphs: [
            'Chennai combines IT services and software with a long-standing manufacturing and automotive base. That gives engineers from non-computer-science branches, such as mechanical and electronics, more options than in a purely software-focused city.',
            'Much of the tech work sits along the IT corridor in the south of the city, so the choice of neighbourhood matters. Ask where the office is before you plan accommodation.',
        ],
        faqs: [
            {
                question: 'Does Chennai only hire software engineers?',
                answer:
                    'No. Alongside software roles, there is demand in manufacturing, automotive and engineering fields. Filter the listings to the role that fits your degree.',
            },
            {
                question: 'Where are the tech jobs in Chennai?',
                answer:
                    'Many are along the southern IT corridor, with others elsewhere in the city. The listing usually names the office location; check it before accepting.',
            },
            {
                question: 'Can mechanical or electronics graduates find roles here?',
                answer:
                    'Often yes. Chennai has engineering and manufacturing employers that hire outside computer science. Search the main jobs list using your field as a keyword as well.',
            },
        ],
    },
    pune: {
        heading: 'Working in Pune',
        paragraphs: [
            'Pune has large IT parks, a strong engineering and automotive manufacturing presence, and a big student population, which gives it a younger feel than some other metros. Hinjewadi and Kharadi are the names you will hear most for tech offices.',
            'The distance between the main IT parks and the city centre can be large, so housing choice is closely tied to where you work. Ask about shuttle or transport support when you interview.',
        ],
        faqs: [
            {
                question: 'What industries hire in Pune?',
                answer:
                    'IT and software, engineering and automotive firms, and a growing startup scene. The mix means both computer science and core engineering graduates can find roles.',
            },
            {
                question: 'Is Pune cheaper than Bangalore?',
                answer:
                    'Often somewhat, but it depends on the area and the type of housing. Compare your actual rent and commute for the office you would work from.',
            },
            {
                question: 'Are there fresher openings in Pune?',
                answer:
                    'Yes, particularly in IT services and engineering firms. Check the batch and degree requirements in each listing before applying.',
            },
        ],
    },
    'delhi-ncr': {
        heading: 'Working in Delhi NCR',
        paragraphs: [
            'Delhi NCR is really several job markets. Gurugram leans toward corporate offices, consulting and finance. Noida has IT, media and electronics. Delhi itself has a wide mix, including startups and many roles tied to government and public sector work.',
            'Because the region is spread out, the address on a listing matters a lot. Two jobs both marked "Delhi NCR" can be hours apart in practice, so check the exact office before you decide.',
        ],
        faqs: [
            {
                question: 'What does NCR include?',
                answer:
                    'The National Capital Region covers Delhi and surrounding cities such as Gurugram, Noida, Faridabad and Ghaziabad. We match listings that mention any of these.',
            },
            {
                question: 'Which part of NCR should I target?',
                answer:
                    'It depends on the work. Gurugram is common for corporate and consulting roles, Noida for IT and media. Look at where your target employers have offices.',
            },
            {
                question: 'Are government jobs also in Delhi?',
                answer:
                    'Many central government offices are in Delhi, but notifications are listed separately. See the government jobs section for those.',
            },
        ],
    },
};

export const BATCH_NOTES: Record<string, EntityNote> = {
    '2025': {
        heading: 'If you graduated in 2025',
        paragraphs: [
            'You are now one year out of college. Many fresher listings still accept your batch, but some have moved on to later ones, so check the eligibility line on each role.',
            'The most important thing you can do is account for the time since graduating. Show what you built, learned or worked on in that year. A clear, honest account beats a blank.',
        ],
        faqs: [
            {
                question: 'Can the 2025 batch still apply for fresher roles?',
                answer:
                    'Often yes, if the listing says so or does not restrict the batch. Roles that name a specific graduating year will mention it. Check each one.',
            },
            {
                question: 'How should I explain the gap since graduation?',
                answer:
                    'State it plainly and show what you did: projects, courses, freelance or contract work. Keep it short and confident.',
            },
            {
                question: 'Should I look at experienced roles instead?',
                answer:
                    'If you have a year of relevant work, roles asking for one to two years may fit. Otherwise fresher roles that accept your batch are the closer match.',
            },
        ],
    },
    '2026': {
        heading: 'If you graduate in 2026',
        paragraphs: [
            'Many fresher listings are written with this batch in mind, whether you have just graduated or are about to.',
            'Apply quickly and keep your resume current. Offers often come with a joining date after your results, so state your availability clearly in your application.',
        ],
        faqs: [
            {
                question: 'Is 2026 the right batch for these roles?',
                answer:
                    'Roles on this page accept the 2026 passout year. Still check the degree, score and backlog rules in each listing.',
            },
            {
                question: 'What if I have not received my final results yet?',
                answer:
                    'Many companies hire before results and ask for proof at joining. Mention your expected date of completion in the application.',
            },
            {
                question: 'How early do companies start hiring this batch?',
                answer:
                    'Many start months before graduation. Keep checking, because new listings appear throughout the year.',
            },
        ],
    },
    '2027': {
        heading: 'If you graduate in 2027',
        paragraphs: [
            'Your final academic year is 2026-27, so this is the batch for which hiring is ramping up. Some companies already accept your year for internships and early fresher roles.',
            'Internships are the best investment now. A strong summer internship can turn into a pre-placement offer, which takes pressure off your final year.',
        ],
        faqs: [
            {
                question: 'Can the 2027 batch apply for jobs already?',
                answer:
                    'Some listings accept it, and many internships do. Check each listing\'s batch line.',
            },
            {
                question: 'What should the 2027 batch focus on now?',
                answer:
                    'Internships, two or three solid projects, and fundamentals for technical interviews. Aim to have a resume you are proud of before final-year hiring peaks.',
            },
            {
                question: 'What is a pre-placement offer?',
                answer:
                    'A job offer extended to an intern at the end of an internship, with joining after graduation. Not every company offers it, so ask during the internship.',
            },
        ],
    },
    '2028': {
        heading: 'If you graduate in 2028',
        paragraphs: [
            'You are probably in your third year. Few full-time roles are open to you yet, but internships and early-career programmes are, and applying now builds experience before the pressure of placement season.',
            'This is the time to pick a direction and go deep. Choose a path, build a project or two and join a hackathon or open source project to show your work.',
        ],
        faqs: [
            {
                question: 'Can the 2028 batch apply for internships?',
                answer:
                    'Yes. Many internships are open to pre-final-year students. Focus on those, not on full-time listings.',
            },
            {
                question: 'What should I build now?',
                answer:
                    'A few projects that show you can finish things, in the area you want to work in. Quality matters more than quantity.',
            },
            {
                question: 'Is it too early to think about placements?',
                answer:
                    'It is not too early to prepare. Building skills and a profile now makes the later months far less stressful.',
            },
        ],
    },
    '2029': {
        heading: 'If you graduate in 2029',
        paragraphs: [
            'You are early in your degree, so there are few listings open to you, and that is expected. Use the time to learn fundamentals and build the habit of making small projects.',
            'Join a college tech club, try a hackathon and keep your GitHub active. By the time listings open to you, you will have a track record, which is what recruiters look for.',
        ],
        faqs: [
            {
                question: 'Are there jobs for the 2029 batch?',
                answer:
                    'Very few. Occasional early-talent programmes and some internships accept early-year students. Focus on learning and projects.',
            },
            {
                question: 'What should a first or second year student do now?',
                answer:
                    'Learn programming fundamentals, try small projects, take part in a hackathon and read about the paths available. There is no need to rush into applications.',
            },
            {
                question: 'Why is there a page for 2029?',
                answer:
                    'Some programmes and early-talent listings state the 2029 batch. The page collects them so early-year students can see what exists.',
            },
        ],
    },
};

export const CAREER_NOTES: Record<string, EntityNote> = {
    'software-engineer': {
        heading: 'A realistic route into software engineering',
        paragraphs: [
            'Most entry-level software roles test fundamentals: data structures, a language you know well, and how you think about a problem. Projects matter because they show you can build something that works beyond an exercise.',
            'A common mistake is collecting many tutorials and few finished projects. One app that is deployed, documented and used by a few people tells a recruiter far more than a long list of courses.',
        ],
        faqs: [
            {
                question: 'Which language should I learn first for software engineering?',
                answer:
                    'Choose one widely used language, such as Python, Java or JavaScript, and get comfortable with it. The concepts transfer, and many fresher interviews let you pick your language.',
            },
            {
                question: 'How important is DSA for software jobs?',
                answer:
                    'Important for many product company interviews and online assessments, less so for some service roles. Practise steadily rather than cramming.',
            },
            {
                question: 'Do I need a computer science degree?',
                answer:
                    'It helps, and many listings ask for it. If you come from another branch, projects and fundamentals can make up the gap for many roles.',
            },
        ],
    },
    'ai-ml-engineer': {
        heading: 'What it takes to start in AI and ML',
        paragraphs: [
            'AI and ML roles expect more than the ability to call a library. Employers look for maths and statistics fundamentals, solid programming and the ability to take a model from a notebook to something that runs reliably.',
            'True fresher openings are fewer than in general software, and many people reach ML after a first role in software or data. Treat that as a normal route, not a detour.',
        ],
        faqs: [
            {
                question: 'What should I learn first for ML?',
                answer:
                    'Python, basic statistics and linear algebra, and a core library for data and models. Then build end-to-end projects with real data.',
            },
            {
                question: 'Is a master\'s degree needed?',
                answer:
                    'Some research-heavy roles prefer one, but many applied roles hire on skills and projects. Check the listings for your target role.',
            },
            {
                question: 'How do I show ML skill without experience?',
                answer:
                    'Publish projects that solve a real problem, explain your choices and show how you evaluated results. A clear write-up counts for a lot.',
            },
        ],
    },
    'devops-engineer': {
        heading: 'Getting into DevOps',
        paragraphs: [
            'DevOps is about getting software built, tested and running reliably. Employers look for Linux comfort, scripting, version control, a CI/CD tool, containers and a cloud platform. It rewards people who like systems and troubleshooting.',
            'Few companies hire pure DevOps freshers. A common path is to start in support, systems or software and take on pipeline and deployment work, or to build a home project that shows the full flow.',
        ],
        faqs: [
            {
                question: 'Can a fresher become a DevOps engineer?',
                answer:
                    'It is possible but less common. Build a project that deploys an app through a pipeline, using containers and a cloud account, and apply to junior and related roles.',
            },
            {
                question: 'What tools should I learn?',
                answer:
                    'Linux, Git, a CI/CD tool, Docker, a cloud platform and basic infrastructure as code. Learn the ideas first, then the tool.',
            },
            {
                question: 'Is coding needed in DevOps?',
                answer:
                    'Yes, usually scripting and some programming for automation. You do not need to be a full-time developer, but you need to be comfortable writing code.',
            },
        ],
    },
    'data-engineer': {
        heading: 'Becoming a data engineer',
        paragraphs: [
            'Data engineers build the pipelines that move and clean data so others can use it. SQL is the foundation, followed by Python, an understanding of databases and warehouses, and some experience with a workflow or processing tool.',
            'Many people arrive after a role as a software engineer or analyst. If you are starting out, a project that ingests, cleans and stores real data end to end is the best proof of readiness.',
        ],
        faqs: [
            {
                question: 'What is the difference between a data engineer and a data analyst?',
                answer:
                    'A data engineer builds and maintains the systems that deliver data. A data analyst uses that data to answer business questions.',
            },
            {
                question: 'How strong does my SQL need to be?',
                answer:
                    'Strong. Joins, window functions and query performance come up often. Practise with real datasets.',
            },
            {
                question: 'Do I need to learn Spark?',
                answer:
                    'It helps for roles with large data volumes, but start with SQL and Python. Learn a distributed tool once you have the basics.',
            },
        ],
    },
    'data-analyst': {
        heading: 'Starting as a data analyst',
        paragraphs: [
            'Data analysis has one of the more approachable entry routes. Employers mainly look for SQL, a spreadsheet tool, a visualisation tool and the ability to explain what the numbers mean to someone who is not technical.',
            'The difference between a good and an average candidate is communication. A dashboard that answers a business question clearly, with a short written summary, impresses more than a complex chart nobody understands.',
        ],
        faqs: [
            {
                question: 'What do I need for a data analyst role?',
                answer:
                    'SQL, Excel or Sheets, a BI tool such as Power BI or Tableau, and basic statistics. Python is a plus in many roles.',
            },
            {
                question: 'Is a data analyst role good for freshers?',
                answer:
                    'It has many entry-level openings. Back your application with two or three projects built on real public datasets.',
            },
            {
                question: 'Can I move into data science later?',
                answer:
                    'Yes. Many people go from analysis to data science or engineering by adding programming, statistics and modelling over time.',
            },
        ],
    },
};

export const RESUME_NOTES: Record<string, EntityNote> = {
    'software-engineer': {
        heading: 'What recruiters check on a software engineer resume',
        paragraphs: [
            'Recruiters look for the languages and tools you have really used, and for projects they can open. A link to a repository with a clear README often counts for more than a long skills section.',
            'Describe each project by what it does and how you built it: the problem, the stack and one measurable detail such as users, load or speed. Avoid listing every technology you have touched once.',
        ],
        faqs: [
            {
                question: 'How many projects should a software engineer resume have?',
                answer:
                    'Two or three strong, well-described projects are better than six thin ones. Choose the ones closest to the role.',
            },
            {
                question: 'Should I list competitive programming ratings?',
                answer:
                    'If they are strong, a single line is fine. Do not let them replace project evidence.',
            },
            {
                question: 'Do I need a GitHub link?',
                answer:
                    'It helps. Make sure the repositories you show are tidy and have a README.',
            },
        ],
    },
    'ai-ml-engineer': {
        heading: 'What recruiters check on an AI/ML resume',
        paragraphs: [
            'Show that you can take a problem from data to a working result. For each project, state the dataset, the approach, how you evaluated it and what the result was. A metric with context is far more credible than a model name alone.',
            'Avoid a skills section that lists every framework. Pick the ones you can discuss in an interview, and make sure at least one project runs end to end, not just in a notebook.',
        ],
        faqs: [
            {
                question: 'How should I describe an ML project?',
                answer:
                    'Name the problem, the data, the method, how you measured success and what you learned. Keep it to a few lines.',
            },
            {
                question: 'Do certificates matter for ML roles?',
                answer:
                    'Less than projects. They can show initiative, but evidence of building something carries more weight.',
            },
            {
                question: 'Should I include research papers?',
                answer:
                    'Yes if relevant, briefly. Highlight your own contribution and results.',
            },
        ],
    },
    'devops-engineer': {
        heading: 'What recruiters check on a DevOps resume',
        paragraphs: [
            'DevOps hiring managers want to see the pipeline you built, the tools you used and what changed as a result: faster deployments, fewer failures, lower costs. Describe the system and your role in it.',
            'List the tools in context, such as "built a CI/CD pipeline with GitHub Actions deploying a containerised app to a cloud VM", rather than as a bare list. That reads as experience instead of vocabulary.',
        ],
        faqs: [
            {
                question: 'How do I show DevOps skill without a job?',
                answer:
                    'Build and document a project that deploys an app through a pipeline using containers and a cloud account, and link it.',
            },
            {
                question: 'Which tools should be on the resume?',
                answer:
                    'The ones you have really used: a CI/CD tool, Docker, a cloud platform, Linux and infrastructure as code if you have tried it.',
            },
            {
                question: 'Are cloud certificates useful?',
                answer:
                    'They can help, especially for freshers, as long as you can also show hands-on work.',
            },
        ],
    },
    'data-engineer': {
        heading: 'What recruiters check on a data engineer resume',
        paragraphs: [
            'Describe your pipelines in terms of what flowed where: source, transformation, destination, volume and schedule. Mention how you ensured data quality, because reliability is what the role is about.',
            'SQL should be prominent, and any warehouse or workflow tool you have used should appear with context. A single end-to-end pipeline project is worth more than a long list of tools.',
        ],
        faqs: [
            {
                question: 'What should a data engineering project include?',
                answer:
                    'Ingestion from a real source, transformation, storage and some form of scheduling and checks. Document the architecture.',
            },
            {
                question: 'Do I list SQL as a skill or a project?',
                answer:
                    'Both. List it as a skill and show it in a project with real queries and results.',
            },
            {
                question: 'How do I show scale without a job?',
                answer:
                    'Use a large public dataset and describe the volume and how you handled it.',
            },
        ],
    },
    'data-analyst': {
        heading: 'What recruiters check on a data analyst resume',
        paragraphs: [
            'Analysts are hired to answer questions, so show the question, the data, what you did and the decision it supported. A bullet such as "Analysed churn across three cohorts and recommended a change to onboarding" says more than a tool list.',
            'Put SQL and your visualisation tool near the top. Include a link to a dashboard or notebook, and make sure it opens, since this is where many recruiters decide.',
        ],
        faqs: [
            {
                question: 'What projects suit a data analyst resume?',
                answer:
                    'A project that starts with a real question, uses a public dataset, and ends with a clear chart and a recommendation.',
            },
            {
                question: 'Should I list Excel?',
                answer:
                    'Yes, if you can do more than basic sums, for example pivot tables and lookups. Be specific.',
            },
            {
                question: 'How do I show business understanding?',
                answer:
                    'Describe the outcome of your analysis in plain terms, not just the method.',
            },
        ],
    },
};
