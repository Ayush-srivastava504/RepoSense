// Module: app/skills/data.ts
// Defines component(s)/export(s): SKILLS
// Defines function(s): getSkillBySlug, getRelatedSkills
// Defines type(s): SkillDefinition

export interface SkillDefinition {
    slug: string;
    name: string;
    category: 'Language' | 'Frontend' | 'Backend' | 'Data & ML' | 'Cloud & DevOps' | 'Tools';
    searchTerm: string;
    metaTitle: string;
    metaDescription: string;
    heroDescription: string;
    relatedSlugs: string[];
}

function skill(
    slug: string,
    name: string,
    category: SkillDefinition['category'],
    searchTerm: string,
    relatedSlugs: string[],
): SkillDefinition {
    return {
        slug,
        name,
        category,
        searchTerm,
        metaTitle: `${name} Jobs & Internships for Students — InternFlow`,
        metaDescription: `Live ${name} jobs and internships for engineering students, plus resume and interview prep tools built for ${name} roles. Updated daily.`,
        heroDescription: `Every active ${name} job and internship on InternFlow, aggregated from company career pages and job boards, refreshed daily — with the companies hiring for it and the tools to get your resume ready.`,
        relatedSlugs,
    };
}

export const SKILLS: SkillDefinition[] = [
    skill('python', 'Python', 'Language', 'Python', ['django', 'machine-learning', 'data-analysis', 'sql']),
    skill('java', 'Java', 'Language', 'Java', ['spring-boot', 'dsa', 'sql']),
    skill('javascript', 'JavaScript', 'Language', 'JavaScript', ['react', 'nodejs', 'typescript']),
    skill('typescript', 'TypeScript', 'Language', 'TypeScript', ['react', 'nodejs', 'javascript']),
    skill('c-plus-plus', 'C++', 'Language', 'C++', ['dsa', 'java']),
    skill('go', 'Go', 'Language', 'Golang', ['backend-development', 'kubernetes', 'aws']),
    skill('dsa', 'Data Structures & Algorithms', 'Language', 'data structures algorithms', ['python', 'java', 'c-plus-plus']),
    skill('react', 'React', 'Frontend', 'React.js', ['javascript', 'typescript', 'nodejs']),
    skill('nodejs', 'Node.js', 'Backend', 'Node.js', ['javascript', 'typescript', 'mongodb', 'aws']),
    skill('nextjs', 'Next.js', 'Frontend', 'Next.js', ['react', 'javascript', 'typescript']),
    skill('django', 'Django', 'Backend', 'Django', ['python', 'sql', 'aws']),
    skill('spring-boot', 'Spring Boot', 'Backend', 'Spring Boot', ['java', 'sql', 'aws']),
    skill('backend-development', 'Backend Development', 'Backend', 'backend developer', ['nodejs', 'django', 'spring-boot', 'sql']),
    skill('sql', 'SQL', 'Data & ML', 'SQL', ['data-analysis', 'python', 'power-bi']),
    skill('data-analysis', 'Data Analysis', 'Data & ML', 'data analyst', ['sql', 'python', 'excel', 'power-bi']),
    skill('machine-learning', 'Machine Learning', 'Data & ML', 'machine learning', ['python', 'data-analysis', 'sql']),
    skill('excel', 'Excel', 'Data & ML', 'Excel', ['data-analysis', 'power-bi']),
    skill('power-bi', 'Power BI', 'Data & ML', 'Power BI', ['excel', 'sql', 'data-analysis']),
    skill('aws', 'AWS', 'Cloud & DevOps', 'AWS', ['devops', 'docker', 'kubernetes']),
    skill('devops', 'DevOps', 'Cloud & DevOps', 'DevOps', ['aws', 'docker', 'kubernetes']),
    skill('docker', 'Docker', 'Cloud & DevOps', 'Docker', ['devops', 'kubernetes', 'aws']),
    skill('kubernetes', 'Kubernetes', 'Cloud & DevOps', 'Kubernetes', ['docker', 'devops', 'aws']),
    skill('mongodb', 'MongoDB', 'Data & ML', 'MongoDB', ['nodejs', 'sql']),
    skill('git', 'Git', 'Tools', 'Git', ['github', 'dsa']),
];

export function getSkillBySlug(slug: string): SkillDefinition | undefined {
    return SKILLS.find((s) => s.slug === slug);
}

export function getRelatedSkills(current: SkillDefinition): SkillDefinition[] {
    return current.relatedSlugs
        .map((slug) => getSkillBySlug(slug))
        .filter((s): s is SkillDefinition => Boolean(s));
}
