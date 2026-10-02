import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_LINKS, sectionLinksExcluding, topCompaniesFromJobs, matchResumeRole, matchCareer, regionHubForJob } from '../lib/hubLinks';
import { RESUME_ROLES } from '../app/resume-for/data';
import { CAREERS } from '../app/careers/data';
import { SKILLS } from '../app/skills/data';
import { CITIES } from '../app/jobs-in/data';
import { BATCHES } from '../app/batch/data';

test('section links drop the current page and keep the other five', () => {
    assert.equal(SECTION_LINKS.length, 6);
    const rest = sectionLinksExcluding('/remote-jobs');
    assert.equal(rest.length, 5);
    assert.ok(!rest.some((s) => s.href === '/remote-jobs'));
    assert.ok(rest.some((s) => s.href === '/japan-jobs') && rest.some((s) => s.href === '/europe-jobs'));
});

test('top companies: most listings first, case-insensitive merge, top flag breaks ties, capped', () => {
    const jobs = [
        { company: 'Acme' }, { company: 'acme' }, { company: 'Beta' }, { company: 'Gamma', is_top_company: true },
        { company: 'Delta' }, { company: '' },
    ];
    const r = topCompaniesFromJobs(jobs, 3);
    assert.deepEqual(r, [{ name: 'Acme', count: 2 }, { name: 'Gamma', count: 1 }, { name: 'Beta', count: 1 }]);
});

test('resume guide and career link only when the title really names the role', () => {
    assert.equal(matchResumeRole('Senior Software Engineer II')?.slug, 'software-engineer');
    assert.equal(matchResumeRole('Data Analyst Intern')?.slug, 'data-analyst');
    assert.equal(matchResumeRole('Marketing Manager'), undefined);
    assert.equal(matchResumeRole('Softwareengineering Lead'), undefined);
    assert.equal(matchCareer('Junior Data Engineer')?.slug, 'data-engineer');
});

test('region hubs exist only for Japan and Europe jobs', () => {
    assert.equal(regionHubForJob({ country: 'Japan' })?.href, '/japan-jobs');
    assert.equal(regionHubForJob({ country: ' europe ' })?.href, '/europe-jobs');
    assert.equal(regionHubForJob({ country: 'India' }), undefined);
    assert.equal(regionHubForJob({}), undefined);
});

test('every curated link target exists (no 404s from hub blocks)', () => {
    const skills = new Set(SKILLS.map((s) => s.slug));
    for (const r of RESUME_ROLES) for (const s of r.relatedSkillSlugs) assert.ok(skills.has(s), `${r.slug} -> skill ${s}`);
    for (const c of CAREERS) for (const s of c.relatedSkillSlugs) assert.ok(skills.has(s), `${c.slug} -> skill ${s}`);
    const cities = new Set(CITIES.map((c) => c.slug));
    for (const c of CITIES) for (const s of c.relatedSlugs) assert.ok(cities.has(s), `${c.slug} -> city ${s}`);
    assert.ok(BATCHES.length > 0);
});
