// Module: app/careers/data.ts
// Defines component(s)/export(s): CAREERS
// Defines function(s): getCareerBySlug, getRelatedCareers
// Defines type(s): CareerDefinition

export interface CareerDefinition {
    slug: string;
    name: string;
    searchTerm: string;
    metaTitle: string;
    metaDescription: string;
    heroDescription: string;
    whatTheyDo: string[];
    relatedSkillSlugs: string[];
    relatedSlugs: string[];
}

function career(
    slug: string,
    name: string,
    searchTerm: string,
    whatTheyDo: string[],
    relatedSkillSlugs: string[],
    relatedSlugs: string[],
): CareerDefinition {
    return {
        slug,
        name,
        searchTerm,
        metaTitle: `${name} Career Path — Skills, Jobs & Resume Guide`,
        metaDescription: `What a ${name} does day to day, the skills employers screen for, live ${name} jobs and internships, and how to build a resume for the role — all in one place.`,
        heroDescription: `A one-stop overview of the ${name} path: what the role actually involves, the skills that show up in real job descriptions, live openings you can apply to right now, and how to get your resume and interview prep in shape.`,
        whatTheyDo,
        relatedSkillSlugs,
        relatedSlugs,
    };
}

export const CAREERS: CareerDefinition[] = [
    career(
        'software-engineer',
        'Software Engineer',
        'software engineer',
        [
            'Designs, writes, and maintains code for applications, services, or internal tools',
            'Works with a team through code review, version control, and shared coding standards',
            'Debugs production issues and writes automated tests to prevent regressions',
            'Participates in system design discussions as projects grow in scale',
        ],
        ['dsa', 'backend-development', 'react', 'git', 'sql'],
        ['ai-ml-engineer', 'devops-engineer', 'data-engineer'],
    ),
    career(
        'ai-ml-engineer',
        'AI/ML Engineer',
        'machine learning engineer',
        [
            'Builds and trains models for tasks like classification, recommendation, or NLP',
            'Cleans and prepares datasets, then evaluates models against real metrics',
            'Deploys models into production systems and monitors their performance over time',
            'Works closely with data engineers to keep training data pipelines reliable',
        ],
        ['machine-learning', 'python', 'data-analysis', 'sql'],
        ['data-engineer', 'data-analyst', 'software-engineer'],
    ),
    career(
        'devops-engineer',
        'DevOps Engineer',
        'devops engineer',
        [
            'Builds and maintains CI/CD pipelines so code ships to production reliably',
            'Manages cloud infrastructure, often using infrastructure-as-code tools',
            'Sets up monitoring, alerting, and incident response for live systems',
            'Works with engineering teams to reduce deployment friction and downtime',
        ],
        ['devops', 'docker', 'kubernetes', 'aws'],
        ['software-engineer', 'data-engineer', 'ai-ml-engineer'],
    ),
    career(
        'data-engineer',
        'Data Engineer',
        'data engineer',
        [
            'Builds pipelines that move and transform data from source systems into usable form',
            'Designs data warehouse or lake schemas that other teams query and report from',
            'Owns data quality and reliability so downstream dashboards and models can trust it',
            'Works with orchestration tools to schedule and monitor recurring data jobs',
        ],
        ['sql', 'python', 'aws', 'data-analysis'],
        ['ai-ml-engineer', 'data-analyst', 'devops-engineer'],
    ),
    career(
        'data-analyst',
        'Data Analyst',
        'data analyst',
        [
            'Answers business questions by querying and analyzing existing data',
            'Builds dashboards and reports that stakeholders check regularly',
            'Runs analyses like A/B tests or cohort breakdowns to support decisions',
            'Communicates findings in plain language, not just charts and numbers',
        ],
        ['sql', 'excel', 'power-bi', 'data-analysis'],
        ['data-engineer', 'ai-ml-engineer', 'software-engineer'],
    ),
];

export function getCareerBySlug(slug: string): CareerDefinition | undefined {
    return CAREERS.find((c) => c.slug === slug);
}

export function getRelatedCareers(current: CareerDefinition): CareerDefinition[] {
    return current.relatedSlugs
        .map((slug) => getCareerBySlug(slug))
        .filter((c): c is CareerDefinition => Boolean(c));
}
