// Module: app/resume-for/data.ts
// Defines component(s)/export(s): RESUME_ROLES
// Defines function(s): getResumeRoleBySlug, getRelatedResumeRoles
// Defines type(s): ResumeRoleDefinition

export interface ResumeRoleDefinition {
    slug: string;
    name: string;
    // Matches the `role` id used by the /ats-checker tool, so copy and links stay consistent.
    atsRoleId: string;
    searchTerm: string;
    metaTitle: string;
    metaDescription: string;
    heroDescription: string;
    keywordsToInclude: string[];
    commonMistakes: string[];
    bulletTemplates: string[];
    relatedSkillSlugs: string[];
    relatedSlugs: string[];
}

function role(
    slug: string,
    name: string,
    atsRoleId: string,
    searchTerm: string,
    keywordsToInclude: string[],
    commonMistakes: string[],
    bulletTemplates: string[],
    relatedSkillSlugs: string[],
    relatedSlugs: string[],
): ResumeRoleDefinition {
    return {
        slug,
        name,
        atsRoleId,
        searchTerm,
        metaTitle: `${name} Resume — Keywords, Bullet Examples & ATS Tips`,
        metaDescription: `What to put on a ${name} resume: the keywords ATS systems scan for, common mistakes to avoid, and bullet-point templates, plus a free ATS check for this role.`,
        heroDescription: `A resume for a ${name} role gets scanned by an ATS before a human ever reads it. Here's what to include, what trips people up, and how to phrase your project and experience bullets so both the parser and the recruiter reading it understand your impact.`,
        keywordsToInclude,
        commonMistakes,
        bulletTemplates,
        relatedSkillSlugs,
        relatedSlugs,
    };
}

export const RESUME_ROLES: ResumeRoleDefinition[] = [
    role(
        'software-engineer',
        'Software Engineer',
        'software_engineer',
        'software engineer',
        ['data structures & algorithms', 'REST APIs', 'Git / version control', 'unit testing', 'CI/CD', 'system design', 'Agile/Scrum', 'SQL'],
        [
            'Listing languages and frameworks with no project or outcome attached to them',
            'Describing tasks ("worked on the backend") instead of what changed because of the work',
            'Leaving out scale or impact — request volume, latency, users affected, time saved',
            'Using a two-column or table-based layout that ATS parsers misread',
        ],
        [
            'Built [feature/service] using [language/framework], reducing [metric] by [amount]',
            'Designed and implemented [API/system] that handled [scale] with [uptime/latency result]',
            'Refactored [component] to cut [build time / bug count / load time] by [amount]',
            'Wrote automated tests covering [module], raising test coverage from [X%] to [Y%]',
        ],
        ['dsa', 'backend-development', 'react', 'git', 'sql'],
        ['ai-ml-engineer', 'devops-engineer', 'data-engineer'],
    ),
    role(
        'ai-ml-engineer',
        'AI/ML Engineer',
        'ai_engineer',
        'machine learning engineer',
        ['Python', 'machine learning', 'model evaluation metrics', 'data pipelines', 'PyTorch/TensorFlow', 'feature engineering', 'SQL', 'experiment tracking'],
        [
            'Naming model architectures without saying what problem they solved or how well',
            'Skipping evaluation metrics (accuracy, F1, RMSE) that show the model actually worked',
            'Treating a coursework project like production work without noting it was academic',
            'Omitting the data side — cleaning, labeling, and pipeline work counts as real experience',
        ],
        [
            'Trained a [model type] on [dataset/size] achieving [metric] of [value], a [X%] improvement over [baseline]',
            'Built a data pipeline that processed [volume] of [data type] daily using [tools]',
            'Deployed a [model] as an API using [framework/tool], serving [X] requests with [latency]',
            'Reduced model inference time by [X%] through [technique — quantization, batching, caching]',
        ],
        ['machine-learning', 'python', 'data-analysis', 'sql'],
        ['data-engineer', 'data-analyst', 'software-engineer'],
    ),
    role(
        'devops-engineer',
        'DevOps Engineer',
        'devops_engineer',
        'devops engineer',
        ['CI/CD pipelines', 'Docker', 'Kubernetes', 'infrastructure as code', 'AWS/cloud', 'monitoring & alerting', 'shell scripting', 'Linux'],
        [
            'Listing tool names (Docker, Jenkins, Terraform) with no pipeline or outage story behind them',
            'Not quantifying deploy frequency, downtime reduction, or cost savings',
            'Skipping incident response experience — on-call and postmortems are relevant even for students',
            'Ignoring security basics (secrets management, least-privilege access) that recruiters screen for',
        ],
        [
            'Set up a CI/CD pipeline using [tool] that cut deployment time from [X] to [Y]',
            'Containerized [application] with Docker and deployed it on [platform/orchestrator]',
            'Automated [infrastructure task] with [IaC tool], reducing manual setup time by [X%]',
            'Configured monitoring and alerting for [system] using [tool], cutting mean time to detect by [X%]',
        ],
        ['devops', 'docker', 'kubernetes', 'aws'],
        ['software-engineer', 'data-engineer', 'ai-ml-engineer'],
    ),
    role(
        'data-engineer',
        'Data Engineer',
        'data_engineer',
        'data engineer',
        ['SQL', 'ETL/ELT pipelines', 'data warehousing', 'Python', 'Airflow/orchestration', 'AWS/cloud storage', 'data modeling', 'batch & streaming'],
        [
            'Describing pipelines without stating data volume, frequency, or reliability',
            'Confusing data analysis work with data engineering work on the resume',
            'Not mentioning data quality or validation, which is a core part of the job',
            'Missing the "why" — what downstream report, model, or team depended on the pipeline',
        ],
        [
            'Built an ETL pipeline using [tool] that processed [volume] of data [frequency]',
            'Designed a data warehouse schema in [tool] supporting [X] downstream reports/dashboards',
            'Migrated [data source] to [platform], reducing query time by [X%]',
            'Implemented data quality checks that caught [X%] of malformed records before they reached production',
        ],
        ['sql', 'python', 'aws', 'data-analysis'],
        ['ai-ml-engineer', 'data-analyst', 'devops-engineer'],
    ),
    role(
        'data-analyst',
        'Data Analyst',
        'data_analyst',
        'data analyst',
        ['SQL', 'Excel', 'data visualization', 'Power BI/Tableau', 'statistics', 'A/B testing', 'stakeholder communication', 'Python/R'],
        [
            'Listing dashboards built without saying what decision or metric they changed',
            'Overusing "analyzed data" without the specific question being answered',
            'Leaving out the size of the dataset or the business context',
            'Not distinguishing between building a report and acting on its findings',
        ],
        [
            'Analyzed [dataset/size] using SQL and [tool] to identify [finding], influencing [decision]',
            'Built a [Power BI/Tableau] dashboard tracking [metric], used by [team/stakeholders]',
            'Ran an A/B test on [feature] that improved [metric] by [X%]',
            'Automated a recurring [report type] with [tool], saving [X hours/week] of manual work',
        ],
        ['sql', 'excel', 'power-bi', 'data-analysis'],
        ['data-engineer', 'ai-ml-engineer', 'software-engineer'],
    ),
];

export function getResumeRoleBySlug(slug: string): ResumeRoleDefinition | undefined {
    return RESUME_ROLES.find((r) => r.slug === slug);
}

export function getRelatedResumeRoles(current: ResumeRoleDefinition): ResumeRoleDefinition[] {
    return current.relatedSlugs
        .map((slug) => getResumeRoleBySlug(slug))
        .filter((r): r is ResumeRoleDefinition => Boolean(r));
}
